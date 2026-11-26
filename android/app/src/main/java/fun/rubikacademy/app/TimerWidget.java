package fun.rubikacademy.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Mini timer: dokun → başlar, dokun → durur. Süreler bir yere kaydedilmez; yalnız bu widget'ın oturumunda
 * (son 50 süre, Ao5 için) telefonda tutulur. "JSON" ile oturum metin olarak paylaşılır, "Sıfırla" ile silinir.
 */
public class TimerWidget extends AppWidgetProvider {
    static final String ACT_TOGGLE = "fun.rubikacademy.app.TIMER_TOGGLE", ACT_RESET = "fun.rubikacademy.app.TIMER_RESET";
    static final String P = "ra_timer_widget";

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { render(c); }

    @Override
    public void onReceive(Context c, Intent in) {
        super.onReceive(c, in);
        String a = in.getAction();
        if (!ACT_TOGGLE.equals(a) && !ACT_RESET.equals(a)) return;
        SharedPreferences p = c.getSharedPreferences(P, Context.MODE_PRIVATE);
        long now = SystemClock.elapsedRealtime();
        if (ACT_RESET.equals(a)) p.edit().clear().apply();
        else if (p.getBoolean("run", false)) {
            long t = now - p.getLong("start", now);
            JSONArray l = times(p);
            l.put(t);
            while (l.length() > 50) l.remove(0);
            p.edit().putBoolean("run", false).putLong("last", t).putString("times", l.toString()).apply();
        } else p.edit().putBoolean("run", true).putLong("start", now).apply();
        render(c);
    }

    static JSONArray times(SharedPreferences p) {
        try { return new JSONArray(p.getString("times", "[]")); } catch (Exception e) { return new JSONArray(); }
    }
    static String fmt(long ms) {
        double s = ms / 1000.0;
        if (s < 60) return String.format(Locale.US, "%.2f", s);
        long m = (long) (s / 60); return String.format(Locale.US, "%d:%05.2f", m, s - m * 60);
    }
    static String ao5(JSONArray l) {
        if (l.length() < 5) return "-";
        List<Long> x = new ArrayList<>();
        for (int i = l.length() - 5; i < l.length(); i++) x.add(l.optLong(i));
        Collections.sort(x);
        return fmt((x.get(1) + x.get(2) + x.get(3)) / 3);
    }
    static PendingIntent act(Context c, String a, int req) {
        Intent in = new Intent(c, TimerWidget.class).setAction(a);
        return PendingIntent.getBroadcast(c, req, in, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void render(Context c) {
        SharedPreferences p = c.getSharedPreferences(P, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_timer);
        boolean run = p.getBoolean("run", false);
        JSONArray l = times(p);
        if (run) {
            v.setViewVisibility(R.id.t_chrono, View.VISIBLE); v.setViewVisibility(R.id.t_time, View.GONE);
            v.setChronometer(R.id.t_chrono, p.getLong("start", SystemClock.elapsedRealtime()), null, true);
            v.setTextViewText(R.id.t_hint, "Durdurmak için dokun");
        } else {
            v.setChronometer(R.id.t_chrono, SystemClock.elapsedRealtime(), null, false);
            v.setViewVisibility(R.id.t_chrono, View.GONE); v.setViewVisibility(R.id.t_time, View.VISIBLE);
            v.setTextViewText(R.id.t_time, l.length() > 0 ? fmt(p.getLong("last", 0)) : "0.00");
            v.setTextViewText(R.id.t_hint, "Başlatmak için dokun");
        }
        v.setTextViewText(R.id.t_stats, "Ao5 " + ao5(l) + "  ·  " + l.length() + " çözüm");
        v.setOnClickPendingIntent(R.id.t_tap, act(c, ACT_TOGGLE, 301));
        v.setOnClickPendingIntent(R.id.t_reset, act(c, ACT_RESET, 302));
        Intent ex = new Intent(c, TimerExportActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setOnClickPendingIntent(R.id.t_json, PendingIntent.getActivity(c, 303, ex, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        AppWidgetManager.getInstance(c).updateAppWidget(new ComponentName(c, TimerWidget.class), v);
    }
}
