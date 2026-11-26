package fun.rubikacademy.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Rubik Academy: siteyi uygulamanın kendi WebView'inde açar (Chrome gerekmez).
 * Site, window.RAAppNative köprüsüyle yerel özellikleri kullanır; yanıtlar window.raAppCb(id, değer) ile döner.
 */
public class MainActivity extends Activity {
    static final String HOST = "rubikacademy.fun";
    static final String HOME = "https://" + HOST + "/?source=app";
    static final int RQ_FILE = 11, RQ_PERM = 12, RQ_NOTIF = 13, RQ_BLE = 14;

    WebView web;
    FrameLayout root;
    ValueCallback<Uri[]> fileCb;
    PermissionRequest pendingPerm;
    String pendingPushId;
    Ble ble;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        applyOrientation(getResources().getConfiguration());
        PushService.ensureChannel(this);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#F4F4F2"));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        // her sürümde kenardan kenara: çubukların arkası sitenin zemin rengini alır (setBars), içerik boşlukla korunur
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        if (Build.VERSION.SDK_INT < 35) { getWindow().setStatusBarColor(Color.TRANSPARENT); getWindow().setNavigationBarColor(Color.TRANSPARENT); }

        // Android 15+ uygulamayı kenardan kenara çizer: durum ve gezinme çubuğu kadar boşluk bırak
        root.setOnApplyWindowInsetsListener((v, ins) -> {
            int top, bottom, left, right;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets s = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = ins.getInsets(WindowInsets.Type.ime());
                top = s.top; left = s.left; right = s.right; bottom = Math.max(s.bottom, ime.bottom);
            } else {
                top = ins.getSystemWindowInsetTop(); bottom = ins.getSystemWindowInsetBottom();
                left = ins.getSystemWindowInsetLeft(); right = ins.getSystemWindowInsetRight();
            }
            v.setPadding(left, top, right, bottom);
            return ins;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " RubikAcademyApp/" + versionName());
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        ble = new Ble(this);
        web.addJavascriptInterface(new Bridge(), "RAAppNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return handleUrl(req.getUrl());
            }
            // Yeni sayfa açılınca önceki sayfanın Bluetooth bağlantıları kapanır (küp yeni sayfada tekrar bağlanabilsin)
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                super.onPageStarted(view, url, icon);
                if (ble != null) ble.closeAll();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { startActivityForResult(p.createIntent(), RQ_FILE); }
                catch (ActivityNotFoundException e) { fileCb = null; return false; }
                return true;
            }
            @Override
            public void onPermissionRequest(PermissionRequest req) {
                runOnUiThread(() -> askMediaPermission(req));
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> openExternal(url));

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }

        if (saved != null) web.restoreState(saved);
        if (saved == null || web.getUrl() == null) web.loadUrl(startUrl(getIntent()));
    }

    // Telefon (en kısa kenar < 600dp): dikey. Tablet / açık katlanabilir / Chromebook: kullanıcı nasıl tutarsa.
    // Katlanabilir telefon açılıp kapanınca yeniden hesaplanır (configChanges sayesinde sayfa yeniden yüklenmez).
    void applyOrientation(Configuration c) {
        boolean large = c.smallestScreenWidthDp >= 600;
        // Çoklu pencere / serbest pencerede yön kilitlenmez (sistem zaten yok sayar, pencere bozulmasın)
        boolean multi = Build.VERSION.SDK_INT >= 24 && isInMultiWindowMode();
        int want = large || multi ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        if (getRequestedOrientation() != want) setRequestedOrientation(want);
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        applyOrientation(c);
    }

    @Override
    public void onMultiWindowModeChanged(boolean on, Configuration c) {
        super.onMultiWindowModeChanged(on, c);
        applyOrientation(c);
    }

    String startUrl(Intent i) {
        if (i != null) {
            String u = i.getStringExtra("url");
            if (u != null && u.startsWith("/")) return "https://" + HOST + u;
            Uri d = i.getData();
            if (d != null && HOST.equals(d.getHost())) return d.toString();
        }
        return HOME;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i != null && (i.getStringExtra("url") != null || i.getData() != null)) web.loadUrl(startUrl(i));
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    void goBack() { if (web.canGoBack()) web.goBack(); else finish(); }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() { goBack(); }

    boolean handleUrl(Uri u) {
        String sch = u.getScheme() == null ? "" : u.getScheme();
        String host = u.getHost() == null ? "" : u.getHost();
        if (("https".equals(sch) || "http".equals(sch)) && (host.equals(HOST) || host.endsWith("." + HOST))) return false;
        openExternal(u.toString());
        return true;
    }

    void openExternal(String url) {
        try {
            Intent i = url.startsWith("intent:") ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "Bağlantı açılamadı", Toast.LENGTH_SHORT).show();
        }
    }

    // Site kamera / mikrofon isteyince Android izni sor, sonra siteye ver
    void askMediaPermission(PermissionRequest req) {
        List<String> need = new ArrayList<>();
        for (String r : req.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && !has(Manifest.permission.CAMERA)) need.add(Manifest.permission.CAMERA);
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && !has(Manifest.permission.RECORD_AUDIO)) need.add(Manifest.permission.RECORD_AUDIO);
        }
        if (need.isEmpty() || Build.VERSION.SDK_INT < 23) { grantMedia(req); return; }
        pendingPerm = req;
        requestPermissions(need.toArray(new String[0]), RQ_PERM);
    }

    void grantMedia(PermissionRequest req) {
        List<String> ok = new ArrayList<>();
        for (String r : req.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && has(Manifest.permission.CAMERA)) ok.add(r);
            else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && has(Manifest.permission.RECORD_AUDIO)) ok.add(r);
        }
        if (ok.isEmpty()) req.deny(); else req.grant(ok.toArray(new String[0]));
    }

    boolean has(String p) { return ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED; }

    @Override
    protected void onDestroy() {
        if (ble != null) ble.closeAll();
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == RQ_PERM && pendingPerm != null) { grantMedia(pendingPerm); pendingPerm = null; }
        if (code == RQ_BLE) ble.onPerm();
        if (code == RQ_NOTIF && pendingPushId != null) { reply(pendingPushId, JSONObject.quote(pushStatus())); pendingPushId = null; }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == RQ_FILE && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCb = null;
        }
    }

    String versionName() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "2"; }
    }

    boolean firebaseOn() {
        try { return !FirebaseApp.getApps(this).isEmpty(); } catch (Throwable t) { return false; }
    }

    String pushStatus() {
        if (!firebaseOn()) return "unavailable";
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null && !nm.areNotificationsEnabled()) {
            if (Build.VERSION.SDK_INT >= 33 && !has(Manifest.permission.POST_NOTIFICATIONS)) {
                return getSharedPreferences("ra", MODE_PRIVATE).getBoolean("asked", false) && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) ? "denied" : "default";
            }
            return "denied";
        }
        return "granted";
    }

    String webClientId() {
        int id = getResources().getIdentifier("default_web_client_id", "string", getPackageName());
        return id == 0 ? null : getString(id);
    }

    // Siteye yanıt: window.raAppCb(id, json)
    void reply(String id, String json) {
        if (id == null) return;
        final String js = "window.raAppCb&&window.raAppCb(" + JSONObject.quote(id) + "," + json + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    void js(String s) { runOnUiThread(() -> web.evaluateJavascript(s, null)); }

    class Bridge {
        // Bluetooth LE (akıllı küp / akıllı timer): bkz. Ble.java
        @JavascriptInterface
        public void ble(String id, String arg) { ble.handle(id, arg); }

        @JavascriptInterface
        public String info() {
            try {
                JSONObject o = new JSONObject();
                o.put("v", versionName());
                o.put("push", pushStatus());
                o.put("google", firebaseOn() && webClientId() != null);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface
        public void requestPush(String id, String arg) {
            runOnUiThread(() -> {
                String st = pushStatus();
                if (Build.VERSION.SDK_INT >= 33 && "default".equals(st)) {
                    getSharedPreferences("ra", MODE_PRIVATE).edit().putBoolean("asked", true).apply();
                    pendingPushId = id;
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, RQ_NOTIF);
                } else reply(id, JSONObject.quote(st));
            });
        }

        @JavascriptInterface
        public void pushToken(String id, String arg) {
            if (!firebaseOn()) { reply(id, "null"); return; }
            try {
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t ->
                        reply(id, t.isSuccessful() && t.getResult() != null ? JSONObject.quote(t.getResult()) : "null"));
            } catch (Throwable e) { reply(id, "null"); }
        }

        @JavascriptInterface
        public void googleSignIn(String id, String arg) {
            String cid = webClientId();
            if (!firebaseOn() || cid == null) { reply(id, "{\"err\":\"unavailable\"}"); return; }
            runOnUiThread(() -> {
                try {
                    GetSignInWithGoogleOption opt = new GetSignInWithGoogleOption.Builder(cid).build();
                    GetCredentialRequest req = new GetCredentialRequest.Builder().addCredentialOption(opt).build();
                    CredentialManager.create(MainActivity.this).getCredentialAsync(MainActivity.this, req, new CancellationSignal(),
                            ContextCompat.getMainExecutor(MainActivity.this),
                            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                                @Override
                                public void onResult(GetCredentialResponse r) {
                                    Credential c = r.getCredential();
                                    try {
                                        if (c instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                                            GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(c.getData());
                                            reply(id, "{\"token\":" + JSONObject.quote(g.getIdToken()) + "}");
                                            return;
                                        }
                                    } catch (Exception ignored) { }
                                    reply(id, "{\"err\":\"type\"}");
                                }
                                @Override
                                public void onError(GetCredentialException e) {
                                    String err = e instanceof GetCredentialCancellationException ? "cancel" : String.valueOf(e.getType());
                                    reply(id, "{\"err\":" + JSONObject.quote(err) + ",\"msg\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
                                }
                            });
                } catch (Throwable t) {
                    reply(id, "{\"err\":\"fail\",\"msg\":" + JSONObject.quote(String.valueOf(t.getMessage())) + "}");
                }
            });
        }

        // Görsel/sertifika: paylaş menüsü (galeriye kaydet, WhatsApp, Drive…)
        @JavascriptInterface
        public void saveFile(String id, String arg) {
            try {
                JSONObject o = new JSONObject(arg);
                String name = o.optString("name", "rubikacademy.png").replaceAll("[^A-Za-z0-9._-]", "_");
                byte[] data = Base64.decode(o.getString("b64"), Base64.DEFAULT);
                File dir = new File(getCacheDir(), "share");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(data); }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", f);
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType(o.optString("mime", "image/png"));
                i.putExtra(Intent.EXTRA_STREAM, uri);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(Intent.createChooser(i, "Kaydet ya da paylaş")));
                reply(id, "true");
            } catch (Exception e) { reply(id, "false"); }
        }

        @JavascriptInterface
        public void share(String id, String arg) {
            try {
                JSONObject o = new JSONObject(arg);
                String text = (o.optString("text", "") + " " + o.optString("url", "")).trim();
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                if (o.has("title")) i.putExtra(Intent.EXTRA_SUBJECT, o.optString("title"));
                i.putExtra(Intent.EXTRA_TEXT, text);
                runOnUiThread(() -> startActivity(Intent.createChooser(i, "Paylaş")));
                reply(id, "true");
            } catch (Exception e) { reply(id, "false"); }
        }

        @JavascriptInterface
        public void print(String id, String arg) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                if (pm != null) pm.print("Rubik Academy", web.createPrintDocumentAdapter("Rubik Academy"), new PrintAttributes.Builder().build());
            });
        }

        @JavascriptInterface
        public void openExternal(String id, String arg) { MainActivity.this.openExternal(arg); }

        // Durum/gezinme çubuğu rengi sitenin zeminine uysun
        @JavascriptInterface
        public void setBars(String id, String arg) {
            runOnUiThread(() -> {
                try {
                    JSONObject o = new JSONObject(arg);
                    int c = Color.parseColor(o.getString("bg"));
                    boolean light = o.optBoolean("light", true);
                    root.setBackgroundColor(c);
                    if (Build.VERSION.SDK_INT >= 30) {
                        WindowInsetsController wc = getWindow().getInsetsController();
                        if (wc != null) {
                            int m = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                            wc.setSystemBarsAppearance(light ? m : 0, m);
                        }
                    } else {
                        int f = getWindow().getDecorView().getSystemUiVisibility();
                        int lf = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
                        f = light ? (f | lf) : (f & ~lf);
                        getWindow().getDecorView().setSystemUiVisibility(f);
                    }
                } catch (Exception ignored) { }
            });
        }
    }
}
