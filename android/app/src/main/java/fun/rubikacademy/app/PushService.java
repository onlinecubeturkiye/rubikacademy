package fun.rubikacademy.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Bildirimler (Firebase Cloud Messaging). Gönderici (GitHub Actions: .github/push/send.mjs) yalnız veri yollar:
 * title, body, url, tag → burada Android bildirimi kurulur; dokununca uygulama o sayfayı açar.
 */
public class PushService extends FirebaseMessagingService {
    static final String CH = "ra";

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CH) != null) return;
        NotificationChannel ch = new NotificationChannel(CH, "Duyurular ve yarışmalar", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Yeni ev yarışmaları, çekiliş sonuçları ve duyurular");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    @Override
    public void onMessageReceived(RemoteMessage m) {
        Map<String, String> d = m.getData();
        String title = d.get("title"), body = d.get("body"), url = d.get("url"), tag = d.get("tag");
        if (m.getNotification() != null) {
            if (title == null) title = m.getNotification().getTitle();
            if (body == null) body = m.getNotification().getBody();
        }
        if (body == null || body.isEmpty()) return;
        if (title == null || title.isEmpty()) title = "Rubik Academy";
        show(this, title, body, url == null ? "/" : url, tag == null ? "ra" : tag);
    }

    static void show(Context c, String title, String body, String url, String tag) {
        ensureChannel(c);
        Intent i = new Intent(c, MainActivity.class);
        i.putExtra("url", url);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(c, tag.hashCode(), i, flags);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(Color.parseColor("#111111"))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi);
        try { NotificationManagerCompat.from(c).notify(tag, 1, b.build()); } catch (SecurityException ignored) { }
    }

    @Override
    public void onNewToken(String token) {
        // site her açılışta jetonu RAAppNative.pushToken ile alıp kaydeder
        getSharedPreferences("ra", MODE_PRIVATE).edit().putString("token", token).apply();
    }
}
