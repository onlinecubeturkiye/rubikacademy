package fun.rubikacademy.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Canlı ev yarışması: açık oda varsa adı ve kodu (dokununca katılma sayfası). 30 dk'da bir 1 sorgu. */
public class CompWidget extends AppWidgetProvider {
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
            JSONArray states = new JSONArray()
                .put(new JSONObject().put("stringValue", "lobby")).put(new JSONObject().put("stringValue", "prep")).put(new JSONObject().put("stringValue", "run"));
            JSONObject q = new JSONObject()
                .put("from", new JSONArray().put(new JSONObject().put("collectionId", "comps")))
                .put("where", new JSONObject().put("fieldFilter", new JSONObject()
                    .put("field", new JSONObject().put("fieldPath", "st")).put("op", "IN")
                    .put("value", new JSONObject().put("arrayValue", new JSONObject().put("values", states)))))
                .put("limit", 8);
            JSONArray docs = WidgetNet.query(q);
            if (docs == null) return null;
            long now = System.currentTimeMillis(), best = 0; JSONObject pick = new JSONObject();
            for (int i = 0; i < docs.length(); i++) {
                JSONObject d = docs.getJSONObject(i); long up = WidgetNet.iso(d.optString("updateTime"));
                if (now - up < 6 * 3600000L && up > best) { best = up; pick = d; }
            }
            return pick;
        } catch (Exception e) { return null; }
    }

    static void render(Context c, AppWidgetManager m, int[] ids, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_comp);
        String path = "/icerikler/ev-yarismasi";
        if (d == null) {
            v.setTextViewText(R.id.c_state, "Ev yarışması");
            v.setTextViewText(R.id.c_name, "Bağlantı yok, sonra tekrar denenecek");
            v.setTextViewText(R.id.c_code, "");
        } else if (!d.has("name")) {
            v.setTextViewText(R.id.c_state, "⚪ Şu an yarışma yok");
            v.setTextViewText(R.id.c_name, "Yarışma açılınca burada görünür");
            v.setTextViewText(R.id.c_code, "Aç");
        } else {
            String code = WidgetNet.id(d), st = WidgetNet.str(d, "st"), name = WidgetNet.str(d, "name");
            v.setTextViewText(R.id.c_state, "lobby".equals(st) ? "🟢 Katılmaya açık" : "🔴 Yarışma sürüyor");
            v.setTextViewText(R.id.c_name, name.isEmpty() ? "Ev yarışması" : name);
            v.setTextViewText(R.id.c_code, code);
            path = "/icerikler/ev-yarismasi?ev=" + code;
        }
        v.setOnClickPendingIntent(R.id.c_root, WidgetNet.open(c, path, 220));
        for (int id : ids) m.updateAppWidget(id, v);
    }
}
