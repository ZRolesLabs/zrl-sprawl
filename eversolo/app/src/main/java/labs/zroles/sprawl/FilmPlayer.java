package labs.zroles.sprawl;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaPlayer;
import android.util.Log;
import android.view.Surface;

import java.nio.ByteBuffer;

/**
 * Plays assets/flight.mp4 onto a Surface, forever, with no gap at the loop point: at the end of the file the
 * reader jumps back to the first frame and keeps feeding the same decoder, so the last frame is followed by
 * the first exactly one frame later. Starts at a random key frame so each start looks different. Video only.
 * If the decoder path fails for any reason, falls back to the plain looping MediaPlayer.
 */
final class FilmPlayer implements Runnable {
    private static final String TAG = "ZRLSprawl";
    private static final String FILM = "flight.mp4";
    private final Context ctx;
    private final Surface surface;
    private volatile boolean stop;
    private Thread thread;
    private MediaPlayer fallback;

    FilmPlayer(Context c, Surface s) { ctx = c.getApplicationContext(); surface = s; }

    void start() { thread = new Thread(this, "zrl-film"); thread.start(); }

    void stop() {
        stop = true;
        if (thread != null) { thread.interrupt(); try { thread.join(2000); } catch (InterruptedException ignored) { } thread = null; }
        if (fallback != null) { try { fallback.release(); } catch (Exception ignored) { } fallback = null; }
    }

    @Override public void run() {
        try { loop(); }
        catch (Throwable t) { Log.w(TAG, "decoder path failed, using MediaPlayer", t); if (!stop) plain(); }
    }

    private void loop() throws Exception {
        MediaExtractor ex = new MediaExtractor();
        MediaCodec codec = null;
        AssetFileDescriptor afd = ctx.getAssets().openFd(FILM);
        try {
            ex.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            int track = -1; MediaFormat fmt = null;
            for (int i = 0; i < ex.getTrackCount(); i++) {
                MediaFormat f = ex.getTrackFormat(i); String m = f.getString(MediaFormat.KEY_MIME);
                if (m != null && m.startsWith("video/")) { track = i; fmt = f; break; }
            }
            if (track < 0) throw new IllegalStateException("no video track");
            ex.selectTrack(track);
            long dur = fmt.containsKey(MediaFormat.KEY_DURATION) ? fmt.getLong(MediaFormat.KEY_DURATION) : 0;
            int fps = fmt.containsKey(MediaFormat.KEY_FRAME_RATE) ? fmt.getInteger(MediaFormat.KEY_FRAME_RATE) : 60;
            long frameUs = 1000000L / Math.max(1, fps);
            if (dur > 2000000L) ex.seekTo((long) (Math.random() * (dur - 1000000L)), MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
            codec = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME));
            codec.configure(fmt, surface, null, 0);
            // Fill the screen without stretching: on a 16:9 screen this changes nothing, on the DMP-T8's 2:1 panel it trims top and bottom a little.
            codec.setVideoScalingMode(MediaCodec.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING);
            codec.start();
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            long loopAdd = 0, maxPts = 0, basePts = Long.MIN_VALUE, baseNano = 0;
            while (!stop) {
                int in = codec.dequeueInputBuffer(4000);
                if (in >= 0) {
                    ByteBuffer b = codec.getInputBuffer(in);
                    int n = ex.readSampleData(b, 0);
                    if (n < 0) {                       // end of file: straight back to frame one, same decoder
                        loopAdd += maxPts + frameUs;
                        ex.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC);
                        n = ex.readSampleData(b, 0);
                        if (n < 0) throw new IllegalStateException("empty film");
                    }
                    long pts = ex.getSampleTime();
                    if (pts > maxPts) maxPts = pts;
                    codec.queueInputBuffer(in, 0, n, pts + loopAdd, 0);
                    ex.advance();
                }
                int out = codec.dequeueOutputBuffer(info, 4000);
                if (out >= 0) {
                    long pts = info.presentationTimeUs;
                    if (basePts == Long.MIN_VALUE) { basePts = pts; baseNano = System.nanoTime() + 60000000L; }
                    long due = baseNano + (pts - basePts) * 1000L;
                    long wait = due - System.nanoTime();
                    if (wait < -250000000L) { baseNano -= wait; due = System.nanoTime(); }       // fell behind: re-anchor, never fast-forward
                    else if (wait > 25000000L) { try { Thread.sleep((wait - 15000000L) / 1000000L); } catch (InterruptedException e) { break; } }
                    codec.releaseOutputBuffer(out, due);
                }
            }
        } finally {
            if (codec != null) { try { codec.stop(); } catch (Exception ignored) { } try { codec.release(); } catch (Exception ignored) { } }
            try { ex.release(); } catch (Exception ignored) { }
            try { afd.close(); } catch (Exception ignored) { }
        }
    }

    private void plain() {
        try {
            AssetFileDescriptor afd = ctx.getAssets().openFd(FILM);
            MediaPlayer mp = new MediaPlayer();
            mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            mp.setSurface(surface); mp.setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING); mp.setLooping(true); mp.setVolume(0f, 0f);
            mp.setOnPreparedListener(MediaPlayer::start);
            mp.prepareAsync();
            fallback = mp;
        } catch (Throwable t) { Log.e(TAG, "no film", t); }
    }
}
