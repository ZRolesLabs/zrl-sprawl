package labs.zroles.sprawl;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.WindowManager;

/** Plays the same film as an ordinary screen, for a look without waiting for the screen to go idle. Any button (or a tap on a touch screen) closes it. */
public class Preview extends Activity implements SurfaceHolder.Callback {
    private FilmPlayer film;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        SurfaceView v = new SurfaceView(this);
        v.getHolder().addCallback(this);
        setContentView(v);
    }

    @Override public void surfaceCreated(SurfaceHolder h) { end(); film = new FilmPlayer(this, h.getSurface()); film.start(); }
    @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int hh) { }
    @Override public void surfaceDestroyed(SurfaceHolder h) { end(); }
    @Override public boolean onKeyDown(int code, KeyEvent e) { finish(); return true; }
    @Override public boolean onTouchEvent(MotionEvent e) { if (e.getActionMasked() == MotionEvent.ACTION_UP) finish(); return true; }   // touch screens
    @Override protected void onStop() { super.onStop(); finish(); }

    private void end() { if (film != null) { film.stop(); film = null; } }
}
