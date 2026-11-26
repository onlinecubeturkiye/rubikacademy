package fun.rubikacademy.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/** Ana ekran widget'ı: 4 hızlı bağlantı. Ağdan veri çekmez (pil ve Firebase kotası harcamaz). */
public class QuickWidget extends AppWidgetProvider {
    static final int[] IDS = { R.id.w_trainer, R.id.w_comp, R.id.w_gift, R.id.w_cube };
    static final String[] URLS = { "/icerikler/algoritmalar/antrenor", "/icerikler/ev-yarismasi", "/icerikler/cekilis", "/icerikler/sanal-kup" };

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] widgetIds) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quick);
        for (int i = 0; i < IDS.length; i++) {
            Intent in = new Intent(Intent.ACTION_VIEW, Uri.parse("https://" + MainActivity.HOST + URLS[i]), c, MainActivity.class);
            in.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            v.setOnClickPendingIntent(IDS[i], PendingIntent.getActivity(c, 100 + i, in, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        for (int id : widgetIds) m.updateAppWidget(id, v);
    }
}
