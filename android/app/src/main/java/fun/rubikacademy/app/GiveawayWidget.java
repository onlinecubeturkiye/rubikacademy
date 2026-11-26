package fun.rubikacademy.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Çekiliş geri sayımı: en yakın çekiliş, kayıtların / çekilişin kalan süresi. 30 dk'da bir 1 sorgu. */
public class GiveawayWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        final BroadcastReceiver.PendingResult pr = goAsync();
        final Context app = c.getApplicationContext();
        new Thread(() -> {
            try { render(app, m, ids, fetch()); } finally { pr.finish(); }
        }).start();
    }

    static JSONObject fetch() {
        try {
            long now = System.currentTimeMillis();
            String nowIso = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US) {{ setTimeZone(java.util.TimeZone.getTimeZone("UTC")); }}.format(new java.util.Date(now));
            JSONObject q = new JSONObject()
                .put("from", new JSONArray().put(new JSONObject().put("collectionId", "giveaways")))
                .put("where", new JSONObject().put("fieldFilter", new JSONObject()
                    .put("field", new JSONObject().put("fieldPath", "drawAt")).put("op", "GREATER_THAN")
                    .put("value", new JSONObject().put("timestampValue", nowIso))))
                .put("orderBy", new JSONArray().put(new JSONObject().put("field", new JSONObject().put("fieldPath", "drawAt")).put("direction", "ASCENDING")))
                .put("limit", 4);
            JSONArray docs = WidgetNet.query(q);
            if (docs == null) return null;
            for (int i = 0; i < docs.length(); i++) { JSONObject d = docs.getJSONObject(i); if (!WidgetNet.bool(d, "test")) return d; }
            return new JSONObject();
        } catch (Exception e) { return null; }
    }

    static void render(Context c, AppWidgetManager m, int[] ids, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_giveaway);
        String path = "/icerikler/cekilis";
        if (d == null) {
            v.setTextViewText(R.id.g_title, "Çekiliş");
            v.setTextViewText(R.id.g_prize, "Bağlantı yok, sonra tekrar denenecek");
            v.setViewVisibility(R.id.g_left, View.GONE);
        } else if (!d.has("name")) {
            v.setTextViewText(R.id.g_title, "Şu an çekiliş yok");
            v.setTextViewText(R.id.g_prize, "Yeni çekiliş açılınca burada görünür");
            v.setViewVisibility(R.id.g_left, View.GONE);
        } else {
            long now = System.currentTimeMillis(), draw = WidgetNet.time(d, "drawAt"), close = WidgetNet.time(d, "closeAt");
            String prize = WidgetNet.str(d, "prize"), title = WidgetNet.str(d, "title");
            v.setTextViewText(R.id.g_title, title.isEmpty() ? "Çekiliş" : title);
            v.setTextViewText(R.id.g_prize, prize.isEmpty() || prize.equals(title) ? "🎁 Katıl, kazan!" : "🎁 " + prize);
            v.setViewVisibility(R.id.g_left, View.VISIBLE);
            v.setTextViewText(R.id.g_left, close > now && close < draw ? "Kayıtların kapanmasına " + WidgetNet.left(close - now) : "Çekilişe " + WidgetNet.left(draw - now));
            path = "/icerikler/cekilis?id=" + WidgetNet.id(d);
        }
        v.setOnClickPendingIntent(R.id.g_root, WidgetNet.open(c, path, 210));
        for (int id : ids) m.updateAppWidget(id, v);
    }
}
