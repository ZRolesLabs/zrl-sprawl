package labs.zroles.sprawl;

import android.service.dreams.DreamService;
import android.view.SurfaceHolder;
import android.view.SurfaceView;

/** The screensaver itself. Any button or touch ends it (not interactive). Silent. */
public class SprawlDream extends DreamService implements SurfaceHolder.Callback {
    private FilmPlayer film;

    @Override public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(true);
        SurfaceView v = new SurfaceView(this);
        v.getHolder().addCallback(this);
        setContentView(v);
    }

    @Override public void surfaceCreated(SurfaceHolder h) { end(); film = new FilmPlayer(this, h.getSurface()); film.start(); }
    @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int hh) { }
    @Override public void surfaceDestroyed(SurfaceHolder h) { end(); }
    @Override public void onDreamingStopped() { end(); super.onDreamingStopped(); }
    @Override public void onDetachedFromWindow() { end(); super.onDetachedFromWindow(); }

    private void end() { if (film != null) { film.stop(); film = null; } }
}
