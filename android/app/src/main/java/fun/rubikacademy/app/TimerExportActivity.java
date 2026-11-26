package fun.rubikacademy.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

/** Timer widget'ındaki süreleri JSON metni olarak paylaşır (kaydetmek isteyen için). Görünmez, hemen kapanır. */
public class TimerExportActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        try {
            JSONArray l = TimerWidget.times(getSharedPreferences(TimerWidget.P, Context.MODE_PRIVATE)), out = new JSONArray();
            for (int i = 0; i < l.length(); i++) out.put(new JSONObject().put("n", i + 1).put("ms", l.optLong(i)).put("t", TimerWidget.fmt(l.optLong(i))));
            if (out.length() == 0) { Toast.makeText(this, "Henüz süre yok", Toast.LENGTH_SHORT).show(); finish(); return; }
            String json = new JSONObject().put("app", "Rubik Academy timer").put("ao5", TimerWidget.ao5(l)).put("times", out).toString(2);
            Intent s = new Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_TEXT, json).putExtra(Intent.EXTRA_SUBJECT, "Rubik Academy süreleri");
            startActivity(Intent.createChooser(s, "Süreleri paylaş (JSON)"));
        } catch (Exception e) { Toast.makeText(this, "Paylaşılamadı", Toast.LENGTH_SHORT).show(); }
        finish();
    }
}
