package fun.rubikacademy.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.app.PendingIntent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;

/** Widget'lar için ortak: Firestore REST (herkese açık okuma, giriş yok) ve sayfa açan dokunuş. */
final class WidgetNet {
    static final String KEY = "AIzaSyC5veIMb1gZLo4c36HlyCPLn2SeoJy2spI";
    static final String BASE = "https://firestore.googleapis.com/v1/projects/rubikacademydb/databases/(default)/documents";

    /** structuredQuery çalıştırır, bulunan belgeleri döndürür (hata olursa null). */
    static JSONArray query(JSONObject structuredQuery) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(BASE + ":runQuery?key=" + KEY).openConnection();
            c.setConnectTimeout(10000); c.setReadTimeout(10000);
            c.setRequestMethod("POST"); c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            byte[] body = new JSONObject().put("structuredQuery", structuredQuery).toString().getBytes("UTF-8");
            try (OutputStream o = c.getOutputStream()) { o.write(body); }
            if (c.getResponseCode() != 200) return null;
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            try (InputStream in = c.getInputStream()) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); }
            JSONArray raw = new JSONArray(b.toString("UTF-8")), out = new JSONArray();
            for (int i = 0; i < raw.length(); i++) { JSONObject d = raw.getJSONObject(i).optJSONObject("document"); if (d != null) out.put(d); }
            return out;
        } catch (Exception e) {
            return null;
        } finally { if (c != null) c.disconnect(); }
    }

    static String str(JSONObject doc, String f) {
        JSONObject v = doc.optJSONObject("fields") == null ? null : doc.optJSONObject("fields").optJSONObject(f);
        return v == null ? "" : v.optString("stringValue", "");
    }
    static boolean bool(JSONObject doc, String f) {
        JSONObject v = doc.optJSONObject("fields") == null ? null : doc.optJSONObject("fields").optJSONObject(f);
        return v != null && v.optBoolean("booleanValue", false);
    }
    static long time(JSONObject doc, String f) {
        JSONObject v = doc.optJSONObject("fields") == null ? null : doc.optJSONObject("fields").optJSONObject(f);
        return v == null ? 0 : iso(v.optString("timestampValue", ""));
    }
    static long iso(String s) {
        if (s == null || s.length() < 19) return 0;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            return f.parse(s.substring(0, 19)).getTime();
        } catch (Exception e) { return 0; }
    }
    static String id(JSONObject doc) { String n = doc.optString("name", ""); return n.substring(n.lastIndexOf('/') + 1); }

    /** "2 g 4 sa", "3 sa 10 dk", "12 dk" */
    static String left(long ms) {
        if (ms < 60000) return "1 dk";
        long m = ms / 60000, h = m / 60, d = h / 24;
        if (d > 0) return d + " g " + (h % 24) + " sa";
        if (h > 0) return h + " sa " + (m % 60) + " dk";
        return m + " dk";
    }

    /** Uygulamada bir sayfa açan dokunuş */
    static PendingIntent open(Context c, String path, int req) {
        Intent in = new Intent(Intent.ACTION_VIEW, Uri.parse("https://" + MainActivity.HOST + path), c, MainActivity.class);
        in.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, req, in, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private WidgetNet() {}
}
