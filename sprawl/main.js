/* ZRL screensaver - page driver. ?mode=film (frame by frame, ZSS.frame(t)), ?mode=pc (two monitors, logo act), default live preview. */
(async function () {
'use strict';
const Q = new URLSearchParams(location.search), qn = (k, d) => Q.has(k) ? +Q.get(k) : d, MODE = ZSprawl.MODE;
const cv = document.getElementById('c'), err = m => { document.getElementById('e').textContent = String(m); console.log('ZSS-ERR ' + m); };
try {
  const dpr = qn('dpr', MODE === 'film' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  const size = () => { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); }; size(); addEventListener('resize', size);
  const atlas = await ZAtlas.build();
  if (Q.has('atlas')) { document.body.style.overflow = 'auto'; atlas.canvas.style.cssText = 'width:2048px;height:3072px'; document.body.replaceChildren(atlas.canvas); window.ZSS = { ready: true }; return; }
  const S = ZSprawl.start(cv, atlas);
  const ZSS = window.ZSS = { S, ready: true, info: S.info };
  console.log('ZSS ' + JSON.stringify(S.info));
  if (Q.has('step')) { const act = window.ZLogoAct ? ZLogoAct(S, cv, { split: qn('split', 0), cssW: qn('cssw', 0), act: qn('act', -1), hull: qn('hull', 0) }) : null, px = new Uint8Array(4); let lt = null; ZSS.frame = t => { const dt = lt == null ? 0 : t - lt; lt = t; S.render(t, { scale: qn('scale', 1), msaa: qn('msaa', 4), overlay: act ? tt => act.draw(tt, dt) : null }); S.gl.readPixels(0, 0, 1, 1, S.gl.RGBA, S.gl.UNSIGNED_BYTE, px); return 1; }; ZSS.frame(0); return; }
  if (MODE === 'film') { const scale = qn('ss', 1), msaa = qn('msaa', 4); const px = new Uint8Array(4); ZSS.frame = t => { const a = performance.now(); S.render(t, { scale, msaa, rain: qn('rain', .7), grain: qn('grain', .004) }); S.gl.readPixels(0, 0, 1, 1, S.gl.RGBA, S.gl.UNSIGNED_BYTE, px); return performance.now() - a; }; ZSS.frame(qn('t', 0)); return; }
  /* live: real time with a resolution governor so a small GPU stays smooth */
  /* the desktop flight (the TV film, live across both monitors) is mode=pc with T=150&world=60&logo=0&rain=.7&grain=.004 */
  let scale = qn('scale', 1), ema = 16, last = performance.now(), t0 = last, lastAdj = last; const fixed = Q.has('scale'), msaa = qn('msaa', 4), cap = qn('fps', 60), half = MODE === 'pc' && qn('world', 30) < 59;
  const act = MODE === 'pc' && window.ZLogoAct && qn('logo', 1) ? ZLogoAct(S, cv, { split: qn('split', 0), cssW: qn('cssw', 0), act: qn('act', -1), hull: qn('hull', 0) }) : null;
  const tStart = Q.has('t') ? qn('t', 0) : qn('rand', 0) ? Math.random() * ZSprawl.T : 0;   /* rand=1: join the loop at a random point, like the TV app */
  let nextDue = 0; const shots = Q.has('shots') && window.chrome && chrome.webview ? Q.get('shots').split(',').map(Number).filter(x => x > 0) : [];
  function tick(now) { requestAnimationFrame(tick); if (cap < 59 && now < nextDue) return; nextDue = Math.max(nextDue + 1000 / cap, now - 4);
    const dt = Math.min(100, now - last); last = now; ema += (dt - ema) * .05; const t = tStart + (now - t0) / 1000 * qn('rate', 1);
    if (!fixed && now - lastAdj > 2500) { lastAdj = now; const budget = 1000 / cap; if (ema > budget * 1.22 && scale > .5) scale = Math.max(.5, scale - .1); else if (ema < budget * 1.06 && scale < 1) scale = Math.min(1, scale + .05); }
    S.render(t, { scale, msaa, half, rain: Q.has('rain') ? qn('rain', 1) : null, grain: Q.has('grain') ? qn('grain', .012) : null, overlay: act ? tt => act.draw(tt, dt / 1000) : null }); ZSS.stat = { ema, scale };
    /* self-test only (shots=10,22,...): hand the host the frame just drawn, so the test needs no screen capture */
    if (shots.length && (now - t0) / 1000 >= shots[0]) { const sec = shots.shift(); try { cv.toBlob(b => { const fr = new FileReader(); fr.onload = () => chrome.webview.postMessage('shot:' + sec + ':' + String(fr.result).split(',')[1]); fr.readAsDataURL(b); }, 'image/jpeg', .88); } catch (e) { } } }
  if (Q.has('stats') && window.chrome && chrome.webview) setInterval(() => chrome.webview.postMessage('stat:' + JSON.stringify({ ms: +ema.toFixed(1), scale: +scale.toFixed(2), w: cv.width, h: cv.height, gpu: (() => { try { const g = S.gl, e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; } catch (x) { return ''; } })() })), 4000);
  requestAnimationFrame(tick);
} catch (e) { err(e && e.stack || e); }
})();
