package labs.zroles.sprawl;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Eversolo tile: three big touch buttons. Changes no setting by itself; the screensaver choice is made in Android's own picker. */
public class Setup extends Activity {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#05070D"));

        TextView title = new TextView(this);
        title.setText("ZRL SCREENSAVER");
        title.setTextColor(Color.parseColor("#2EF2FF"));
        title.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        title.setTextSize(34);
        title.setLetterSpacing(0.12f);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView sub = new TextView(this);
        sub.setText("The Sprawl flight, silent. Pick it in the list, then come back.");
        sub.setTextColor(Color.parseColor("#9FB3C8"));
        sub.setTextSize(15);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, 8, 0, 28);
        root.addView(sub);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        row.addView(button("PREVIEW", "#2EF2FF", () -> startActivity(new Intent(this, Preview.class))));
        row.addView(button("CHOOSE SCREENSAVER", "#FF3EA5", this::openPicker));
        row.addView(button("CLOSE", "#5A6B80", this::finish));
        root.addView(row);
        setContentView(root);
    }

    private void openPicker() {
        Intent i = new Intent(Settings.ACTION_DREAM_SETTINGS);
        try { startActivity(i); return; } catch (Exception ignored) { }
        try { startActivity(new Intent().setComponent(new ComponentName("com.android.settings", "com.android.settings.Settings$DreamSettingsActivity"))); }
        catch (Exception ignored) { }
    }

    private Button button(String text, String color, Runnable r) {
        Button bt = new Button(this);
        bt.setText(text);
        bt.setAllCaps(true);
        bt.setTextSize(16);
        bt.setTextColor(Color.parseColor(color));
        bt.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        GradientDrawable g = new GradientDrawable();
        g.setColor(Color.parseColor("#0B1220"));
        g.setStroke(3, Color.parseColor(color));
        g.setCornerRadius(18);
        bt.setBackground(g);
        bt.setPadding(36, 22, 36, 22);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.setMargins(18, 0, 18, 0);
        bt.setLayoutParams(lp);
        bt.setOnClickListener(v -> r.run());
        return bt;
    }
}
