/* ZRL screensaver - the logo act for two monitors (a single screen uses its middle as the gap). The emblem crosses the gap between the screens three ways, in turn:
   CRUISE  it sails across both screens, flipping like a coin as it passes over the bezel
   BOUNCE  a real rigid body: it falls under gravity, tumbles, and bounces off the outer edges of the whole 3840 wide
           desktop on its own outline (neck, shoulders, base corners), picking up spin from every hit
   JACK    it breaks into light on one screen, streams across the bezel, and re-forms on the other */
window.ZLogoAct = function (S, cv, o) {
  'use strict';
  const PAL = [[.2, .9, 1], [.9, .21, .78], [.78, .42, 1], [1, .65, .24], [.39, .9, .69]];
  const sp = [], streams = []; let act = -1, at = 0, st = null, gap = 3, clock = 0;
  const W = () => cv.width, H = () => cv.height, split = () => (o.split > 0 && o.split < W() ? o.split * (W() / (o.cssW || W())) : W() / 2);
  const LH = () => H() * .37, AR = 1024 / 896;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rnd = (a, b) => a + Math.random() * (b - a), pick = () => PAL[Math.floor(Math.random() * PAL.length)];
  function burst(x, y, n, c, v) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), s = rnd(.25, 1) * v; sp.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: c || pick(), life: 0, max: rnd(.5, 1.3), g: H() * .25 }); } }
  function trail(x, y, hh, dir) { const k = H() / 1080; for (let i = 0; i < 3; i++) sp.push({ x: x - dir * hh * AR * rnd(.2, .46), y: y + rnd(-.42, .42) * hh, vx: -dir * rnd(140, 520) * k, vy: rnd(-30, 30) * k, c: pick(), life: 0, max: rnd(.7, 1.9), g: 0, min: 26 }); }
  function stream(ax, ay, bx, by, hh) { for (let i = 0; i < 380; i++) streams.push({ sx: ax + rnd(-.5, .5) * hh * AR * .8, sy: ay + rnd(-.5, .5) * hh * .85, tx: bx + rnd(-.5, .5) * hh * AR * .8, ty: by + rnd(-.5, .5) * hh * .85, t0: rnd(0, 1.5), dur: rnd(1.1, 1.9), arc: rnd(-.16, .16) * H(), c: pick() }); }
  const ACTS = [
    { dur: 27, run(t, dt, time) { const hh = LH(), ww = hh * AR;
        const leg = (u0, u1, dir, y0, sc) => { if (t < u0 || t > u1) return; const u = (t - u0) / (u1 - u0), e = u, x = dir > 0 ? -ww + (W() + 2 * ww) * e : W() + ww - (W() + 2 * ww) * e, y = H() * y0 + Math.sin(t * 1.15) * H() * .07;
          const b = (x - split()) / (ww * .9), sq = Math.abs(b) < 1 ? Math.cos((b + 1) * Math.PI) : 1; S.drawLogo(x, y, hh * sc, { squash: sq, gain: 1 + .5 * (1 - Math.min(1, Math.abs(b))), time }); trail(x, y, hh * sc, dir); if (Math.abs(b) < .08 && Math.random() < .5) burst(split(), y + rnd(-.3, .3) * hh, 4, [.2, .9, 1], 380); };
        leg(0, 12.5, 1, .47, 1); leg(14, 26.5, -1, .52, .72); } },
    { dur: 96, run(t, dt, time) { const hh = H() * .27;
        if (!st) st = Object.assign(ZLogoAct.body(W(), H(), hh, split() * .5, H() * .34), { fl: 0, tint: PAL[0], lastX: -9, lastY: -9, cool: 0 });
        const k = ss(0, 1.2, t) * (1 - ss(this.dur - 1.5, this.dur, t)); st.cool -= dt;
        for (const h of st.step(dt)) { if (h.wall < 2) st.lastX = t; else st.lastY = t; const pow = Math.min(1, h.j / (H() * .9));
          if (st.cool > 0 || pow < .08) continue; st.cool = .09; st.tint = pick(); st.fl = Math.max(st.fl, .2 + .6 * pow); const corner = Math.abs(st.lastX - st.lastY) < .05;
          burst(h.x, h.y, corner ? 240 : Math.round(14 + 60 * pow), corner ? null : st.tint, corner ? 900 : 260 + 420 * pow); if (corner) st.fl = 2; }
        st.fl = Math.max(0, st.fl - dt * 1.8); const q = st.quad();
        if (o.hull) { const c = Math.cos(st.a), sn = Math.sin(st.a); for (const p of st.pts) sp.push({ x: st.x + p[0] * c - p[1] * sn - 6, y: st.y + p[0] * sn + p[1] * c, vx: 200, vy: 0, c: [1, 1, 1], life: 0, max: .09, g: 0, min: 12 }); }   /* debug: mark the collision outline */
        S.drawLogo(q[0], q[1], hh, { rot: st.a, gain: k * (1 + st.fl * .7), mono: Math.min(1, st.fl) * .45, tint: st.tint, glitch: Math.max(0, st.fl - 1.2) * .5, time }); } },
    { dur: 25, run(t, dt, time) { const hh = LH(), L = [split() * .5, H() * .5], R = [split() + (W() - split()) * .5, H() * .5];
        if (!st) st = { a: 0, b: 0 };
        if (t > 7 && !st.a) { st.a = 1; stream(L[0], L[1], R[0], R[1], hh); } if (t > 16 && !st.b) { st.b = 1; stream(R[0], R[1], L[0], L[1], hh); }
        const breathe = 1 + .12 * Math.sin(t * 2.4);
        /* left copy */ { const dis = t < 2 ? 1 - ss(0, 2, t) : t < 7 ? 0 : t < 9 ? ss(7, 8.6, t) : t < 18 ? 1 : t < 20.4 ? 1 - ss(18.4, 20.4, t) : t < 22.5 ? 0 : ss(22.5, 24.6, t), gl = ss(6, 7, t) * (1 - ss(8.2, 8.8, t)) + (1 - ss(20.2, 21, t)) * ss(18.3, 18.8, t) * .6;
          if (dis < .999) S.drawLogo(L[0], L[1] + Math.sin(t * .9) * 8, hh, { dissolve: dis, glitch: gl, gain: breathe, time }); }
        /* right copy */ { const dis = t < 9 ? 1 : t < 11.4 ? 1 - ss(9.3, 11.4, t) : t < 16 ? 0 : t < 18 ? ss(16, 17.6, t) : 1, gl = ss(15, 16, t) * (1 - ss(17.2, 17.8, t)) + (1 - ss(11.2, 12, t)) * ss(9.2, 9.7, t) * .6;
          if (dis < .999) S.drawLogo(R[0], R[1] + Math.sin(t * .9 + 2) * 8, hh, { dissolve: dis, glitch: gl, gain: breathe, time }); } } },
  ];
  function draw(time, dt) {
    dt = Math.min(dt, .1); clock += dt;
    if (act < 0 || at > ACTS[act].dur + gap) { act = (act + 1) % ACTS.length; at = 0; st = null; gap = 5; if (o.act != null && o.act >= 0) act = o.act; }
    at += dt; if (at <= ACTS[act].dur) ACTS[act].run(at, dt, clock);
    const list = [];
    for (let i = sp.length - 1; i >= 0; i--) { const p = sp[i]; p.life += dt; if (p.life > p.max) { sp.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; const a = 1 - p.life / p.max, v = Math.hypot(p.vx, p.vy);
      list.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, c: p.c, a: a * a * 1.4, len: Math.max(p.min || 0, Math.min(70, 6 + v * .06)) }); }
    for (let i = streams.length - 1; i >= 0; i--) { const p = streams[i]; p.t0 -= dt; if (p.t0 > 0) continue; const u = -p.t0 / p.dur; if (u >= 1) { streams.splice(i, 1); continue; }
      const e = u * u * (3 - 2 * u), x = p.sx + (p.tx - p.sx) * e, y = p.sy + (p.ty - p.sy) * e + Math.sin(u * Math.PI) * p.arc, e2 = Math.min(1, u + .02), ee = e2 * e2 * (3 - 2 * e2);
      list.push({ x, y, vx: (p.tx - p.sx) * (ee - e) + 1e-3, vy: (p.ty - p.sy) * (ee - e) + (Math.sin(e2 * Math.PI) - Math.sin(u * Math.PI)) * p.arc, c: p.c, a: Math.sin(u * Math.PI) * 1.5 + .25, len: 14 + 90 * Math.sin(u * Math.PI) }); }
    S.drawSparks(list);
  }
  return { draw };
};
/* The flask as a rigid body. Units are canvas pixels, y down. Collides on its own outline with the four outer edges.
   Gravity, restitution and edge friction are real; two small cheats keep a screensaver alive forever: the bounce is a touch
   livelier when the body has lost energy (and duller when it has too much), and it never quite stops drifting sideways. */
window.ZLogoAct.body = function (W, H, hh, x0, y0) {
  /* outline in emblem units (viewBox -200 -205 400 350, so the picture is 350 tall and its centre is at 0,-30) */
  const hull = [[-49, -181], [49, -181], [183, 105], [165, 134], [-165, 134], [-183, 105]].map(p => [p[0] / 350 * hh, (p[1] + 30) / 350 * hh]);
  let A = 0, cx = 0, cy = 0, I = 0;
  for (let i = 0; i < hull.length; i++) { const p = hull[i], q = hull[(i + 1) % hull.length], c = p[0] * q[1] - q[0] * p[1]; A += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
  A /= 2; cx /= 6 * A; cy /= 6 * A; const pts = hull.map(p => [p[0] - cx, p[1] - cy]);
  { let n = 0, d = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], c = Math.abs(p[0] * q[1] - q[0] * p[1]); n += c * (p[0] * p[0] + p[1] * p[1] + p[0] * q[0] + p[1] * q[1] + q[0] * q[0] + q[1] * q[1]); d += c; } I = n / (6 * d); }   /* per unit mass */
  const g = H * .62, mu = .2, E0 = g * H * .8 + .5 * (W / 10) * (W / 10);
  const b = { x: x0, y: y0, vx: W / 10, vy: 0, a: 0, w: .9, I, pts, g };
  b.energy = () => .5 * (b.vx * b.vx + b.vy * b.vy) + g * (H - b.y);   /* travel + height; spin is left out so tumbling cannot starve the bounce */
  b.quad = () => { const c = Math.cos(b.a), s = Math.sin(b.a); return [b.x - (cx * c - cy * s), b.y - (cx * s + cy * c)]; };
  b.step = dt => { const hits = [], n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let k = 0; k < n; k++) {
      b.vy += g * h; b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h; b.w *= 1 - .7 * h;
      const c = Math.cos(b.a), s = Math.sin(b.a);
      for (let wall = 0; wall < 4; wall++) { const nx = wall === 0 ? 1 : wall === 1 ? -1 : 0, ny = wall === 2 ? 1 : wall === 3 ? -1 : 0; let pen = 0, rx = 0, ry = 0;
        for (const p of pts) { const px = p[0] * c - p[1] * s, py = p[0] * s + p[1] * c, d = wall === 0 ? -(b.x + px) : wall === 1 ? b.x + px - W : wall === 2 ? -(b.y + py) : b.y + py - H; if (d > pen) { pen = d; rx = px; ry = py; } }
        if (pen <= 0) continue; b.x += nx * pen; b.y += ny * pen;
        const ux = b.vx - b.w * ry, uy = b.vy + b.w * rx, vn = ux * nx + uy * ny; if (vn >= 0) continue;
        const E = b.energy(), e = Math.min(1.35, Math.max(.55, .9 + 2.2 * (E0 - E) / E0));
        const rn = rx * ny - ry * nx, j = -(1 + e) * vn / (1 + rn * rn / I), tx = -ny, ty = nx, vt = ux * tx + uy * ty, rt = rx * ty - ry * tx;
        const jt = Math.max(-mu * j, Math.min(mu * j, -vt / (1 + rt * rt / I))), Jx = j * nx + jt * tx, Jy = j * ny + jt * ty;
        b.vx += Jx; b.vy += Jy; b.w += (rx * Jy - ry * Jx) / I;
        if (wall === 3 && Math.abs(b.vx) < W / 13) b.vx += (b.vx < 0 ? -1 : 1) * W / 50;      /* keep wandering */
        if (wall === 3) { const want = Math.sqrt(2 * Math.max(0, E0 - g * (H - b.y) - .5 * b.vx * b.vx)), up = Math.abs(Math.min(0, b.vy)); b.vy = -(up + .55 * (want - up)); }   /* the floor has some spring: arcs stay tall */
        b.w = Math.max(-5, Math.min(5, b.w));
        hits.push({ wall, x: b.x + rx, y: b.y + ry, j });
      }
    }
    return hits; };
  return b;
};
