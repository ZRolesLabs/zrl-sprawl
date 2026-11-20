/* ZRL screensaver - the Sprawl engine. ZRolesLabs. One WebGL2 city, two uses:
   film mode  : ZSS.frame(t) draws one exact frame of the looping flight (rendered offline into the TV film)
   live mode  : runs in real time (the PC screensaver, across every monitor), slow glide, with the ZRL logo act on top
   The city is a torus (period L in x and z) so a flight that ends L further on is a seamless loop. Everything that moves is periodic in the loop time T.
   No network, no storage, no audio. */
(function () {
'use strict';
const Q = new URLSearchParams(location.search);
const qn = (k, d) => Q.has(k) ? +Q.get(k) : d;
const MODE = Q.get('mode') || 'live';
const CELL = 64, NC = 32, L = CELL * NC, SW = 11;          // block pitch, blocks per period, period, street half width
const NRAND = 32;                                           // signs 0-31 are dealt out to buildings at random; later ones are placed by hand only, so adding one never reshuffles the city
const HFOV = qn('hfov', 52);                                // half of the horizontal view angle on very wide screens, degrees
const T = qn('T', MODE === 'pc' ? 720 : 150);              // loop length, seconds
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), sat = x => clamp(x, 0, 1), mix = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rng = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; }
function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
function view(e, f, roll) { const s0 = norm(cross(f, [0, 1, 0])), u0 = cross(s0, f), c = Math.cos(roll), sn = Math.sin(roll);
  const s = [s0[0] * c + u0[0] * sn, s0[1] * c + u0[1] * sn, s0[2] * c + u0[2] * sn], u = cross(s, f);
  return { m: new Float32Array([s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, e), -dot(u, e), dot(f, e), 1]), s, u, f }; }
/* piecewise smooth keys: K = [[d, value], ...] */
function key(K, d) { if (d <= K[0][0]) return K[0][1]; const n = K.length; if (d >= K[n - 1][0]) return K[n - 1][1]; let i = 0; while (d > K[i + 1][0]) i++; return mix(K[i][1], K[i + 1][1], ss(K[i][0], K[i + 1][0], d)); }

/* ---------------- the flight path ---------------- */
/* corners in block units on street centre lines; ends one period on (+32,+32) heading the way it began (+z) */
const WP = [[0, 0], [0, 10], [10, 10], [10, 20], [22, 20], [22, 26], [32, 26], [32, 32]];
const PATH = (function () {
  const pts = []; const R = 1.35;                       // corner radius in blocks
  const P = WP.map(p => [p[0] * CELL, p[1] * CELL]);
  const push = (x, z) => { const n = pts.length; if (n && Math.hypot(pts[n - 1][0] - x, pts[n - 1][1] - z) < 1e-6) return; pts.push([x, z]); };
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], d = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const s0 = i === 0 ? 0 : R * CELL, s1 = i === P.length - 2 ? len : len - R * CELL;
    for (let s = s0; s <= s1 + .01; s += 2) push(a[0] + d[0] * s, a[1] + d[1] * s);
    push(a[0] + d[0] * s1, a[1] + d[1] * s1);
    if (i < P.length - 2) { const c = P[i + 2], d2 = [Math.sign(c[0] - b[0]), Math.sign(c[1] - b[1])], p0 = [b[0] - d[0] * R * CELL, b[1] - d[1] * R * CELL], p2 = [b[0] + d2[0] * R * CELL, b[1] + d2[1] * R * CELL];
      for (let k = 1; k < 48; k++) { const u = k / 48, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u; push(w0 * p0[0] + w1 * b[0] + w2 * p2[0], w0 * p0[1] + w1 * b[1] + w2 * p2[1]); } }
  }
  const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const LEN = acc[acc.length - 1];
  function xz(d) { const w = Math.floor(d / LEN); d -= w * LEN; let lo = 0, hi = acc.length - 1; while (hi - lo > 1) { const m = lo + hi >> 1; if (acc[m] <= d) lo = m; else hi = m; }
    const k = (d - acc[lo]) / (acc[hi] - acc[lo] || 1); return [mix(pts[lo][0], pts[hi][0], k) + w * L, mix(pts[lo][1], pts[hi][1], k) + w * L]; }
  return { LEN, xz };
})();
const DU = PATH.LEN / 64;                                    // "d" keys below are written against a 64 unit lap
/* altitude, speed, pitch (radians, + = nose down) and a sideways glance (radians, + = right), keyed along the lap */
const KY = [[0, 9], [6.5, 9], [9.5, 34], [12.5, 78], [18, 84], [21.5, 150], [24.5, 236], [27.5, 236], [31, 120], [33.5, 40], [36, 26], [41, 22], [44, 15], [47.5, 13], [49.5, 30], [52, 58], [56.5, 62], [59.5, 34], [62.5, 12], [64, 9]];
const KV = [[0, 1.15], [6, 1.15], [10, 0.8], [14, .68], [17, .78], [21, 1.0], [27, 1.15], [31, 1.2], [34, .85], [38, .62], [41, .8], [46, 1.0], [50, .85], [54, .66], [58, .9], [62, 1.1], [64, 1.15]];
const KP = [[0, .02], [6.5, .0], [9, -.16], [12, .05], [14, .10], [18, .06], [21, -.05], [24, .30], [27.5, .42], [31, .34], [33.5, .10], [36, .02], [44, .02], [48, -.10], [51, .0], [54, .10], [58, .12], [61, .06], [64, .02]];
const KG = [[0, 0], [12, 0], [14.2, -.38], [16.2, -.30], [18, 0], [35.5, 0], [37.6, .50], [39.4, .42], [41, 0], [52.5, 0], [54.4, .34], [56.2, .26], [57.6, 0], [64, 0]];
const TIME = (function () {          // time -> distance, from the speed keys, normalised so one lap takes exactly T
  const n = 4096, tt = [0]; for (let i = 0; i < n; i++) tt.push(tt[i] + 1 / key(KV, (i + .5) / n * 64)); const tot = tt[n];
  return function (t) { const w = Math.floor(t / T); const u = (t / T - w) * tot; let lo = 0, hi = n; while (hi - lo > 1) { const m = lo + hi >> 1; if (tt[m] <= u) lo = m; else hi = m; }
    return (w + (lo + (u - tt[lo]) / (tt[hi] - tt[lo])) / n) * PATH.LEN; };
})();
function pathAt(d) { const p = PATH.xz(d), k = ((d / DU) % 64 + 64) % 64; return [p[0], key(KY, k), p[1]]; }
function camAt(t) {
  const d = TIME(t), k = ((d / DU) % 64 + 64) % 64, e = pathAt(d);
  const a = PATH.xz(d + 46), b = PATH.xz(d - 10), c = PATH.xz(d + 90);
  let yaw = Math.atan2(a[0] - e[0], a[2 - 1] - e[2]);
  const y2 = Math.atan2(c[0] - a[0], c[1] - a[1]), y0 = Math.atan2(e[0] - b[0], e[2] - b[1]); let turn = y2 - y0; while (turn > Math.PI) turn -= TAU; while (turn < -Math.PI) turn += TAU;
  yaw += key(KG, k);
  const pitch = key(KP, k) + (pathAt(d + 30)[1] - pathAt(d - 30)[1]) / 60 * -.55;        // nose follows the climb a little
  const f = norm([Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]);
  return { e, f, roll: clamp(-turn * .30, -.42, .42), fov: 62 * Math.PI / 180, d, k };
}

/* ---------------- the city ---------------- */
const PAL = [[.78, .42, 1.0], [.2, .9, 1.0], [.9, .21, .78], [1, .65, .24], [1, .85, .6], [.39, .9, .69], [.48, .18, .94]];
const HOLO = [];                         // plaza holograms {x,z,h,seed}
function buildCity(slots) {
  const boxes = [], signs = [], craft = [], cellTex = new Uint8Array(NC * NC * 4);
  const idx = (i, j) => ((j % NC + NC) % NC) * NC + ((i % NC + NC) % NC);
  /* path clearance: lowest camera height passing over/near each block, and streets used at low level */
  const clear = new Float32Array(NC * NC).fill(1e9);
  for (let d = 0; d < PATH.LEN; d += 2) { const p = pathAt(d); for (let di = -1; di <= 0; di++) for (let dj = -1; dj <= 0; dj++) {
    const i = Math.floor(p[0] / CELL) + di, j = Math.floor(p[2] / CELL) + dj, cx = (i + .5) * CELL, cz = (j + .5) * CELL;
    const dx = Math.abs(p[0] - cx) - (CELL / 2 - SW), dz = Math.abs(p[2] - cz) - (CELL / 2 - SW), out = Math.max(dx, dz);
    if (out < 15) clear[idx(i, j)] = Math.min(clear[idx(i, j)], p[1] - 16 + Math.max(0, out - 7) * 6); } }
  const dense = (i, j) => { const u = i / NC * TAU, v = j / NC * TAU; return .55 + .32 * Math.sin(u + 1.3) * Math.cos(v * 2 + .4) + .28 * Math.sin(u * 3 + v + 2.1) + .2 * Math.cos(v * 3 - u * 2); };
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
    const r = rng(i * 7919 + j * 104729 + 17), cx = (i + .5) * CELL, cz = (j + .5) * CELL, o = idx(i, j) * 4;
    const dn = clamp(dense(i, j), .12, 1.3); let plaza = r() < .04;
    let h = 26 + Math.pow(r(), 1.8) * 150 * dn; if (r() < .10 * dn) h = 210 + r() * 250;
    let cap = clear[idx(i, j)]; if (cap < 1e8) { if (cap < 14) plaza = true; else h = Math.min(h, cap); }
    const seed = r() * 97 + 1; cellTex[o] = plaza ? 255 : 0; cellTex[o + 1] = seed * 2.6; cellTex[o + 3] = 255;
    if (plaza) { if (r() < .6) HOLO.push({ x: cx, z: cz, h: 34 + r() * 26, seed }); continue; }
    const hw = 15 + r() * 6, hd = 15 + r() * 6, ox = (r() - .5) * (42 - hw * 2), oz = (r() - .5) * (42 - hd * 2), bx = cx + ox, bz = cz + oz;
    const style = h > 200 ? (r() < .5 ? 3 : 1) : Math.floor(r() * 3), win = PAL[Math.floor(r() * 5)], trim = PAL[[0, 1, 2, 3, 6, 1, 2][Math.floor(r() * 7)]], trimOn = r() < .72 ? 1 : 0;
    const tiers = h > 200 ? 3 : h > 70 ? (r() < .7 ? 2 : 1) : 1; let y0 = 0, w = hw, dd = hd;
    for (let k = 0; k < tiers; k++) { const top = k === tiers - 1 ? h : h * (k === 0 ? .5 + r() * .22 : .86); boxes.push(bx, (y0 + top) / 2, bz, w, (top - y0) / 2, dd, seed + k * 3.1, style, trimOn, top, win[0], win[1], win[2], trim[0], trim[1], trim[2]); y0 = top; w -= 2.5 + r() * 4; dd -= 2.5 + r() * 4; }
    for (let k = 0, n = Math.floor(r() * 4); k < n; k++) { const cw = 1.2 + r() * 3, cd2 = 1.2 + r() * 3, ch = .8 + r() * 2.2; boxes.push(bx + (r() - .5) * 2 * Math.max(0, w + 2.5 - cw), h + ch, bz + (r() - .5) * 2 * Math.max(0, dd + 2.5 - cd2), cw, ch, cd2, seed, 9, 0, 0, 0, 0, 0, 0, 0, 0); }
    if (h > 200) { boxes.push(bx, h + 14, bz, .5, 14, .5, seed, 9, 0, h + 28, 0, 0, 0, 0, 0, 0); craft.push(bx, h + 29, bz, 0, 0, r(), 1, .1, .15, 1, 2.2, 0); }
    /* signs on this building */
    const faces = [[1, 0, hw], [-1, 0, hw], [0, 1, hd], [0, -1, hd]];
    const wall = (slot, fw, fh, y, fi) => { const f = faces[fi], n = [f[0], f[1]], rt = [n[1], -n[0]]; const wide = fi < 2 ? hd : hw;     // n=(-rz,rx) => r=(nz,-nx)
      signs.push(bx + n[0] * (f[2] + .5), y, bz + n[1] * (f[2] + .5), rt[0], rt[1], Math.min(fw, wide - 1.5), fh * Math.min(1, (wide - 1.5) / fw), ...slot, seed, 0, 1.6); };
    if (h > 34 && r() < .5) { const sl = slots.land[Math.floor(r() * NRAND)], fw = 11 + r() * 8; wall(sl, fw, fw / 2, 14 + r() * Math.min(h * .5, 60), Math.floor(r() * 4)); }
    if (h > 230 && r() < .8) { const sl = slots.land[[0, 0, 1, 3, 19, 15, 16, 10, 20, 27, 24, 22, 28, 30][Math.floor(r() * 14)]]; wall(sl, 19, 9.5, h * (.52 + r() * .25), Math.floor(r() * 4)); }
    if (r() < .62) { /* blade sign sticking out over the street: readable both ways along the street */
      const fi = Math.floor(r() * 4), f = faces[fi], n = [f[0], f[1]], sl = slots.vert[Math.floor(r() * slots.vert.length)], hh = 7 + r() * 5, y = 9 + hh + r() * Math.min(26, h * .3), t = (r() - .5) * (fi < 2 ? hd : hw) * 1.4;
      signs.push(bx + n[0] * (f[2] + 2.2 + hh * .25) + n[1] * t, y, bz + n[1] * (f[2] + 2.2 + hh * .25) + n[0] * t, n[0], n[1], hh * .25, hh, ...sl, seed, 1, 1.7); }
    if (h < 120 && r() < .22) { /* rooftop billboard on legs */
      const sl = slots.land[Math.floor(r() * NRAND)], a = Math.floor(r() * 4) * Math.PI / 2 + (r() - .5) * .5, fw = Math.min(hw, hd) - 2.5;
      signs.push(bx, h + 4 + fw / 2, bz, Math.cos(a), Math.sin(a), fw, fw / 2, ...sl, seed, 0, 1.8);
      boxes.push(bx + Math.cos(a) * fw * .7, h + 2.2, bz + Math.sin(a) * fw * .7, .35, 2.2, .35, seed, 9, 0, h + 4, 0, 0, 0, 0, 0, 0, bx - Math.cos(a) * fw * .7, h + 2.2, bz - Math.sin(a) * fw * .7, .35, 2.2, .35, seed, 9, 0, h + 4, 0, 0, 0, 0, 0, 0); }
  }
  /* hero signs hung over the route so the camera gets a long, square look at them. d on the 64 lap, slot, half width, height above the camera line */
  const HERO = [[4.6, 1, 9.5, 15], [15.6, 0, 26, 1, -30], [26.2, 19, 30, -70], [38.6, 0, 17, 3, 26], [46.4, 16, 9.5, 14], [55.2, 3, 22, 2, 28], [61.5, 15, 9.5, 20], [8.2, 12, 9.5, 30], [34.5, 8, 14, 10], [50.5, 2, 12, 16], [22.6, 9, 22, -36], [57.9, 18, 14, 4, -22], [43.2, 13, 9.5, 12],
    /* the Sprawl books */ [11.4, 22, 9.5, 12], [19.2, 27, 22, 4, 30], [29.5, 24, 26, -32], [41.3, 21, 9.5, 11], [47.9, 25, 9.5, 12], [52.8, 23, 11, 10], [59.8, 26, 9.5, 13],
    /* Chiba clinics and friends */ [13.5, 28, 9.5, 12], [17.4, 29, 9.5, 12], [32.5, 30, 11, 10], [63.2, 31, 9.5, 13]];
  HERO.forEach(hp => { const d = hp[0] * DU, p = pathAt(d), q = pathAt(d + 4), tx = q[0] - p[0], tz = q[2] - p[2], tl = Math.hypot(tx, tz) || 1, t = [tx / tl, tz / tl], n = [-t[0], -t[1]], rt = [n[1], -n[0]], side = hp[4] || 0;
    const x = p[0] + rt[0] * -side, z = p[2] + rt[1] * -side, y = p[1] + hp[3] + hp[2] / 2, ang = side ? Math.atan2(side, 60) * .9 : 0, ca = Math.cos(ang), sa = Math.sin(ang), r2 = [rt[0] * ca - rt[1] * sa, rt[0] * sa + rt[1] * ca];
    signs.push(x, y, z, r2[0], r2[1], hp[2], hp[2] / 2, ...slots.land[hp[1]], hp[0], 0, 2.1);
    for (const sgn of [-1, 1]) if (!side && y - hp[2] / 2 > 3) boxes.push(x + r2[0] * sgn * (hp[2] + .6), (y + hp[2] / 2) / 2, z + r2[1] * sgn * (hp[2] + .6), .5, (y + hp[2] / 2) / 2, .5, 3, 9, 0, 0, 0, 0, 0, 0, 0, 0);
    if (side) boxes.push(x, (y - hp[2] / 2) / 2, z, 1.2, (y - hp[2] / 2) / 2, 1.2, 3, 9, 0, 0, 0, 0, 0, 0, 0, 0); });
  /* traffic in the air: lanes above the streets. [fixed, alt, travel, axis, cycles, phase, kind, r,g,b, len, pad] */
  const cr = rng(4242);
  for (let i = 0; i < 300; i++) { const axis = cr() < .5 ? 0 : 1, lane = Math.floor(cr() * NC) * CELL + (cr() < .5 ? -4 : 4), alt = [26, 44, 70, 110, 160, 215, 280][Math.floor(cr() * 7)] + cr() * 6, cyc = (1 + Math.floor(cr() * 3)) * (cr() < .5 ? -1 : 1), c = PAL[[1, 2, 3, 4, 0][Math.floor(cr() * 5)]];
    craft.push(lane, alt, cr() * L, axis, cyc, cr(), 0, c[0], c[1], c[2], 9 + cr() * 10, 0); }
  return { boxes: new Float32Array(boxes), signs: new Float32Array(signs), craft: new Float32Array(craft), cellTex };
}

/* ---------------- shaders ---------------- */
const GH = '#version 300 es\nprecision highp float;precision highp int;\n';
const COMMON = `
uniform vec3 uCam; uniform float uPh; uniform float uT; uniform float uL;
const vec3 SUN = vec3(0.,.070,.9975);
float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}
vec3 haze(vec3 rd){float h=abs(rd.y);vec3 c=mix(vec3(.15,.04,.24),vec3(.006,.005,.02),smoothstep(0.,.36,h));
 float s=max(dot(normalize(vec3(rd.x,0.,rd.z)+1e-5),vec3(0.,0.,1.)),0.);c+=vec3(1.,.28,.50)*pow(s,5.)*.26*exp(-h*7.);c+=vec3(.11,.03,.19)*exp(-h*16.);return c;}
vec3 fog(vec3 col,vec3 wp){vec3 d=wp-uCam;float l=length(d);float f=1.-exp(-pow(l/640.,1.55));return mix(col,haze(d/l)*.85,f);}
`;
const VS_FS = GH + 'out vec2 v;void main(){v=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(v*2.-1.,0.,1.);}';

const FS_SKY = GH + COMMON + `in vec2 v;uniform vec3 uR,uU,uF;uniform vec2 uTan;uniform float uFlip;out vec4 o;
void main(){vec2 n=v*2.-1.;vec3 rd=normalize(uF+n.x*uTan.x*uR+n.y*uTan.y*uU);rd.y*=uFlip;float below=step(rd.y,0.);rd.y=abs(rd.y);
 vec3 c=haze(rd);
 vec3 q=floor(rd*560.);float s=h1(q.xy+q.z*17.3);c+=step(.9988,s)*smoothstep(.08,.34,rd.y)*vec3(.8,.82,1.)*(.25+h1(q.yz)*.9);
 /* cloud deck lit from below */
 vec2 cp=rd.xz/(rd.y+.09)*1.3;float cl=mix(vn(cp*1.1+vec2(uPh*4.,0.)),vn(cp*1.1+vec2(uPh*4.-4.,0.)),uPh)*.6+vn(cp*2.7)*.3+vn(cp*6.1)*.1;cl=smoothstep(.45,.85,cl)*smoothstep(.02,.22,rd.y)*exp(-rd.y*1.2);
 c+=vec3(.30,.08,.42)*cl*.22;
 /* the sun: banded, low on the +z horizon */
 float sd=dot(rd,SUN);float ang=acos(clamp(sd,-1.,1.));float R=.135;
 float yy=(rd.y-SUN.y)/R;float disc=smoothstep(R,R-.004,ang);
 float cut=step(yy,.12)*step(.5,fract((yy-.12)*5.2*(1.+max(-yy,0.)*.6)+uPh*30.));
 vec3 sc=mix(vec3(1.,.22,.60),vec3(1.,.86,.36),smoothstep(-.9,.75,yy));
 c=mix(c,sc*1.55,disc*(1.-cut));c+=vec3(1.,.35,.55)*exp(-ang*6.)*.22+vec3(.9,.3,.7)*exp(-ang*2.2)*.05;
 /* far skyline, beyond the fog */
 float az=atan(rd.x,rd.z);float k=az*70./3.14159;float id=floor(k);float fx=fract(k);
 float hh=.012+.085*pow(h1(vec2(id,3.)),3.)+.02*h1(vec2(floor(k*.25),9.));float w=.55+.4*h1(vec2(id,5.));
 if(rd.y<hh&&fx<w){vec3 b=haze(vec3(rd.x,0.,rd.z))*.42;vec2 wc=floor(vec2(fx*14.,rd.y*900.));float lit=step(.80,h1(wc+id*7.))*step(.3,fract(fx*14.))*step(.4,fract(rd.y*900.));
  b+=mix(vec3(1.,.7,.35),vec3(.7,.4,1.),h1(vec2(id,1.)))*lit*.16;c=mix(c,b,0.);}
 if(below>.5)c=haze(vec3(rd.x,0.,rd.z))*.85;
 o=vec4(c,1.);}`;

const VS_BOX = GH + COMMON + `layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 iC;layout(location=3)in vec3 iH;layout(location=4)in vec4 iA;layout(location=5)in vec3 iW;layout(location=6)in vec3 iT;
uniform mat4 uVP;out vec3 vP;out vec3 vN;out vec2 vUV;out vec3 vLoc;flat out vec3 vHs;flat out vec4 vA;flat out vec3 vW;flat out vec3 vTr;
void main(){vec3 c=iC;c.xz+=uL*floor((uCam.xz-c.xz)/uL+.5);vec3 l=aP*iH;vec3 wp=c+l;vP=wp;vN=aN;vLoc=l;vHs=iH;vA=iA;vW=iW;vTr=iT;
 float u=abs(aN.x)>.5?l.z:l.x;vUV=vec2(u,wp.y);gl_Position=uVP*vec4(wp,1.);}`;
const FS_BOX = GH + COMMON + `in vec3 vP;in vec3 vN;in vec2 vUV;in vec3 vLoc;flat in vec3 vHs;flat in vec4 vA;flat in vec3 vW;flat in vec3 vTr;out vec4 o;
void main(){float seed=vA.x;int style=int(vA.y+.5);vec3 col=vec3(.016,.011,.028);
 vec3 V=normalize(uCam-vP);float dW=max(1.,length(uCam-vP)*.0042);
 if(style==9){col=vec3(.012,.01,.018);}
 else if(abs(vN.y)>.5){col=vec3(.011,.008,.019);vec2 e=vHs.xz-abs(vLoc.xz);float ed=min(e.x,e.y);
  if(vN.y>0.){col+=vTr*vA.z*smoothstep(.6*dW,.2*dW,ed)*1.2/sqrt(dW);vec2 g=fract(vLoc.xz/5.);col+=vec3(.012,.008,.02)*step(.92,max(g.x,g.y));}}
 else{
  vec2 cs=style==1?vec2(4.6,3.1):style==2?vec2(1.7,3.7):vec2(2.3,3.1);vec2 mg=style==1?vec2(.03,.24):style==2?vec2(.2,.12):vec2(.17,.2);
  vec2 g=(vUV+vec2(seed*7.3,0.))/cs;vec2 id=floor(g),f=fract(g);vec2 fw=fwidth(g);
  float band=h1(vec2(id.y*1.7,seed));float p=.22+.42*h1(vec2(seed,4.2));if(style==3)p*=.55;p*=band<.16?.12:band>.9?1.9:1.;p=min(p,.95);
  float r=h1(id+seed*91.7);float lit=step(r,p);
  float kk=mod(floor(uPh*uT*1.6),240.);if(h1(id*1.31+seed)>.988)lit=step(.5,h1(id+kk));
  float wx=smoothstep(mg.x-fw.x,mg.x+fw.x,f.x)*smoothstep(mg.x-fw.x,mg.x+fw.x,1.-f.x);float wy=smoothstep(mg.y-fw.y,mg.y+fw.y,f.y)*smoothstep(mg.y-fw.y,mg.y+fw.y,1.-f.y);
  float cr=h1(id*2.1+seed*13.);vec3 wc=cr<.66?vW:cr<.88?vec3(1.,.70,.32):vec3(.78,.9,1.);float br=.22+1.25*h1(id*3.7+seed);
  /* a blind half drawn, a bright lamp spot: breaks up flat squares */
  float blind=mix(1.,.35,step(h1(id*5.3+seed),.3)*step(f.y,.55+.3*h1(id*.7)));
  float pane=abs(fract(f.x*(style==1?3.:style==2?1.:2.))-.5);wx*=1.-(1.-smoothstep(.0,.035+fw.x*2.,pane))*.8*step(float(style),1.5)*(1.-smoothstep(.1,.3,max(fw.x,fw.y)));
  vec3 pat=wc*br*lit*wx*wy*blind*mix(.72,1.18,smoothstep(.15,.85,f.y));col+=vec3(.012,.008,.02)*smoothstep(.07,.03,f.y)*(1.-smoothstep(.1,.4,fw.y));
  float cover=(1.-2.*mg.x)*(1.-2.*mg.y);vec3 avg=mix(vW,vec3(1.,.72,.4),.22)*1.0*p*cover;
  float lod=smoothstep(.3,.85,max(fw.x,fw.y));col+=mix(pat,avg*.8,lod)*.82;
  /* street level: shop fronts */
  if(vA.w>0.&&vP.y<5.2&&vP.y-0.<5.2&&vHs.y*2.>20.&&vP.y>.5){vec2 sg=vec2((vUV.x+seed*3.)/6.5,0.);float sid=floor(sg.x);float sf=fract(sg.x);float on=step(.42,h1(vec2(sid,seed)));
   vec3 scol=h1(vec2(sid,seed+2.))<.4?vec3(1.,.72,.35):h1(vec2(sid,seed+5.))<.5?vec3(.25,.9,1.):vec3(.95,.3,.8);
   col=vec3(.016,.011,.028)+scol*on*smoothstep(.06,.1,sf)*smoothstep(.06,.1,1.-sf)*smoothstep(.5,.9,vP.y)*smoothstep(5.2,4.6,vP.y)*.95;
   col+=scol*on*smoothstep(4.5,4.8,vP.y)*.9;}
  /* neon trim at the top of each tier, and corner tubes on monoliths */
  float tt=vA.w-vP.y;col+=vTr*vA.z*smoothstep(.8*dW,.5*dW,tt)*smoothstep(-.1,.1,tt)*1.9/sqrt(dW);
  float hwid=abs(vN.x)>.5?vHs.z:vHs.x;if(style==3){float ce=hwid-abs(vUV.x);col+=vTr*smoothstep(.4*dW,.2*dW,ce)*1.7/sqrt(dW);}
  if(style==2&&vA.z>.5){float st=abs(fract(vUV.x/(hwid*.6667)+.5)-.5)*hwid*.6667;col+=vTr*smoothstep(.3*dW,.12*dW,st)*1.2/dW*step(.5,h1(vec2(seed,8.)));}
  /* glassy walls pick up the haze */
  float fr=pow(1.-max(dot(V,vN),0.),4.);col+=haze(reflect(-V,vN))*fr*.5;
 }
 o=vec4(fog(col,vP),1.);}`;

const VS_GND = GH + COMMON + `layout(location=0)in vec2 aP;uniform mat4 uVP;out vec3 vP;void main(){vP=vec3(uCam.x+aP.x*9000.,0.,uCam.z+aP.y*9000.);gl_Position=uVP*vec4(vP,1.);}`;
const FS_GND = GH + COMMON + `in vec3 vP;uniform sampler2D uRefl;uniform sampler2D uCells;uniform vec2 uRes;out vec4 o;
const float C=64.,SWd=11.;
vec3 cars(float s,float off,float lane,float dir){float sp=uL/24.;float cyc=dir*(2.+mod(lane,3.))*floor(uT/45.+.5);float q=s/sp+uPh*cyc+h1(vec2(lane,1.7));float cq=mod(floor(q),24.);float fq=fract(q)-.5;
 float on=step(.5,h1(vec2(cq,lane*3.1)));float along=fq*sp*dir;
 vec3 c=vec3(0.);float lat=exp(-off*off*.55);
 c+=vec3(1.,.93,.75)*lat*on*exp(-pow(max(along-1.,0.),1.)*.22)*step(1.,along)*1.5*exp(-off*off*.2);     /* head light pool ahead */
 c+=vec3(1.,.1,.12)*lat*on*exp(-abs(along+2.)*1.1)*2.2;                                                     /* tail lights */
 c+=vec3(1.,.95,.85)*lat*on*exp(-abs(along-1.)*2.5)*3.;return c;}
void main(){vec3 V=normalize(uCam-vP);float dist=length(uCam-vP);
 vec2 m=mod(vP.xz+C*.5,C)-C*.5;bool zs=abs(m.x)<SWd;bool xs=abs(m.y)<SWd;
 vec3 col=vec3(.010,.008,.016);float wet=.55;float aa=clamp(dist*.004,0.04,3.);
 if(zs||xs){
  float rough=vn(vP.xz*.9)*.5+vn(vP.xz*3.)*.5;col=vec3(.007,.006,.012)*(0.8+rough*.4);
  float pud=smoothstep(.40,.74,vn(vP.xz*.07)*.7+vn(vP.xz*.23)*.3);wet=mix(.5,1.,pud);
  float fade=exp(-dist/420.);
  if(zs&&!xs){col+=vec3(1.,.62,.22)*smoothstep(.22+aa*.1,.1,abs(m.x))*step(.5,fract(vP.z/9.))*.5*fade;col+=vec3(.2,.9,1.)*smoothstep(.34+aa*.12,.1,abs(abs(m.x)-SWd+.6))*1.7*fade;
   float st=floor((vP.x+C*.5)/C);col+=cars(vP.z,m.x-3.6,st*2.,1.)+cars(vP.z,m.x+3.6,st*2.+1.,-1.);}
  if(xs&&!zs){col+=vec3(1.,.62,.22)*smoothstep(.22+aa*.1,.1,abs(m.y))*step(.5,fract(vP.x/9.))*.5*fade;col+=vec3(.95,.22,.8)*smoothstep(.34+aa*.12,.1,abs(abs(m.y)-SWd+.6))*1.7*fade;
   float st=floor((vP.z+C*.5)/C);col+=cars(vP.x,m.y+3.6,st*2.+101.,1.)+cars(vP.x,m.y-3.6,st*2.+100.,-1.);}
  if(zs&&xs){vec2 a=abs(m);float zb=step(SWd-4.5,max(a.x,a.y))*step(.5,fract((a.x>a.y?m.y:m.x)/2.4));col+=vec3(.5,.5,.6)*zb*.07*fade;}
 }else{
  vec2 cell=floor(vP.xz/C);vec4 ct=texelFetch(uCells,ivec2(mod(cell,32.)),0);vec2 lp=fract(vP.xz/C)*C-C*.5;
  vec2 tg=abs(fract(vP.xz/2.5)-.5);col=vec3(.013,.010,.021)+vec3(.012,.008,.02)*smoothstep(.46,.5,max(tg.x,tg.y));wet=.3;
  if(ct.r>.5){float r=length(lp);float ring=smoothstep(.35,.1,abs(fract(r/4.-uPh*floor(uT*.25+.5))-.5)*4.)*exp(-r*.085);
   vec3 pc=mix(vec3(.2,.9,1.),vec3(.78,.42,1.),h1(cell));col+=pc*ring*1.3+pc*exp(-r*.16)*.9;wet=.7;
   vec2 gq=abs(fract(lp/5.)-.5);col+=pc*smoothstep(.47,.5,max(gq.x,gq.y))*.25;}
 }
 /* wet reflection of everything above */
 vec2 uv=gl_FragCoord.xy/uRes;vec2 nz=vec2(vn(vP.xz*.45+3.)-.5,vn(vP.xz*.45+17.)-.5)+.25*vec2(vn(vP.xz*1.9)-.5,vn(vP.xz*1.9+9.)-.5);
 float sc=clamp(26./dist,0.,1.)*.03;vec3 rf=vec3(0.);float tw=0.;
 for(int i=0;i<6;i++){float t=float(i)/5.;vec2 of=nz*sc*(.16+(1.-wet)*.5)+vec2(0.,(t-.25)*sc*(1.6+(1.-wet)*3.2));float w=1.-abs(t-.25)*.9;rf+=texture(uRefl,uv+of).rgb*w;tw+=w;}
 rf/=tw;float F=.04+.96*pow(1.-max(V.y,0.),4.);float k=clamp(F*1.1+.07*wet,0.,1.)*mix(.55,1.,wet);
 col=col*(1.-k*.5)+rf*k;
 o=vec4(fog(col,vP),1.);}`;

const VS_SIGN = GH + COMMON + `layout(location=0)in vec2 aP;layout(location=2)in vec3 iP;layout(location=3)in vec2 iR;layout(location=4)in vec2 iS;layout(location=5)in vec4 iUV;layout(location=6)in vec3 iF;
uniform mat4 uVP;uniform float uHolo;out vec2 vQ;out vec3 vP;flat out vec4 vUV;flat out vec3 vF;flat out float vFront;
void main(){vec3 c=iP;c.xz+=uL*floor((uCam.xz-c.xz)/uL+.5);vec2 r=iR;
 if(uHolo>.5){float a=iF.x+uPh*6.2831853*floor(uT/26.+.5)*(iF.y>1.5?1.:1.);a+=iF.z;r=vec2(cos(a),sin(a));}
 vec3 wp=c+vec3(r.x,0.,r.y)*aP.x*iS.x+vec3(0.,1.,0.)*aP.y*iS.y;vP=wp;vQ=aP*.5+.5;vUV=iUV;vF=iF;
 vec3 n=vec3(-r.y,0.,r.x);vFront=dot(n,uCam-c);gl_Position=uVP*vec4(wp,1.);}`;
const FS_SIGN = GH + COMMON + `in vec2 vQ;in vec3 vP;flat in vec4 vUV;flat in vec3 vF;flat in float vFront;uniform sampler2D uAtlas;uniform float uHolo;out vec4 o;
void main(){vec2 q=vQ;bool front=vFront>0.;
 if(uHolo>.5){ if(!front)q.x=1.-q.x; vec2 uv=mix(vUV.xy,vUV.zw,vec2(q.x,1.-q.y));vec3 t=texture(uAtlas,uv).rgb;float lum=dot(t,vec3(.3,.5,.2));
  float scan=.62+.38*step(.5,fract(vP.y*.9-uPh*floor(uT*1.3+.5)));float fl=.82+.18*h1(vec2(floor(uPh*uT*14.),vF.x));
  float roll=smoothstep(.0,.04,abs(fract(q.y-uPh*floor(uT*.11+.5))-.5)-.46)*1.6;
  vec3 hc=mix(vec3(.12,.8,1.),t*1.3,.6);float dist=length(uCam-vP);
  o=vec4(hc*lum*scan*fl*(.5+roll*.5)*exp(-pow(dist/620.,1.6)),1.);return;}
 float kind=vF.y;
 if(!front){ if(kind>.5)q.x=1.-q.x; else{ vec2 e=min(q,1.-q);float rim=step(min(e.x,e.y),.03);o=vec4(fog(vec3(.012,.01,.02)+vec3(.05,.02,.08)*rim,vP),1.);return;} }
 /* a rare glitch: a few rows slip sideways for a moment */
 float gk=floor(uPh*uT*3.);float gl=step(.93,h1(vec2(gk,vF.x)));float row=floor(q.y*24.);q.x+=gl*(h1(vec2(row,gk))-.5)*.08*step(.6,h1(vec2(row,vF.x+gk)));
 vec2 uv=mix(vUV.xy,vUV.zw,vec2(clamp(q.x,0.,1.),1.-q.y));vec3 t=texture(uAtlas,uv).rgb;
 float fl=1.-.5*step(.965,h1(vec2(floor(uPh*uT*9.),vF.x*3.7)))*step(.5,h1(vec2(vF.x,2.)));
 float px=.92+.08*sin(q.y*3.14159*vF.z*60.);
 vec3 col=t*(.3+.7*t)*vF.z*1.3*fl*px+t*.1;
 o=vec4(fog(col,vP),1.);}`;

const VS_CRAFT = GH + COMMON + `layout(location=0)in vec2 aP;layout(location=2)in vec4 iA;layout(location=3)in vec4 iB;layout(location=4)in vec4 iC;
uniform mat4 uVP;uniform vec3 uR,uU;out vec2 vQ;flat out vec3 vC;flat out vec2 vK;
void main(){vec3 c;vec3 ax;float kind=iB.z;
 if(kind>.5){c=vec3(iA.x,iA.y,iA.z);ax=vec3(0.);}
 else{float s=iA.z+uL*uPh*iB.x*max(1.,floor(uT/150.+.5))*2.;if(iA.w<.5){c=vec3(s,iA.y,iA.x);ax=vec3(1.,0.,0.);}else{c=vec3(iA.x,iA.y,s);ax=vec3(0.,0.,1.);}ax*=sign(iB.x);}
 c.xz+=uL*floor((uCam.xz-c.xz)/uL+.5);vec3 wp;
 if(kind>.5){wp=c+(uR*aP.x+uU*aP.y)*iC.z;}
 else{vec3 side=normalize(cross(ax,uCam-c));wp=c+ax*(aP.x-.6)*iC.z+side*aP.y*1.15;}
 vQ=aP;vC=vec3(iB.w,iC.x,iC.y);vK=vec2(kind,iB.y);float dist=length(uCam-wp);vC*=exp(-pow(dist/700.,1.6));gl_Position=uVP*vec4(wp,1.);}`;
const FS_CRAFT = GH + COMMON + `in vec2 vQ;flat in vec3 vC;flat in vec2 vK;out vec4 o;
void main(){ if(vK.x>.5){float r=length(vQ);float bl=step(.55,fract(uPh*floor(uT/1.6+.5)+vK.y));o=vec4(vC*exp(-r*r*5.)*5.*bl+vC*exp(-r*3.)*.6*bl,1.);return;}
 float y=exp(-vQ.y*vQ.y*9.);float t=clamp(vQ.x*.5+.5,0.,1.);float tail=t*t*sqrt(t);float head=exp(-(1.-t)*(1.-t)*81.);
 o=vec4((vC*tail*1.6+vec3(1.,.96,.9)*head*5.)*y,1.);}`;

/* the ZRL logo act (live mode): one glowing emblem, drawn in screen space before the bloom */
const VS_LOGO = GH + `layout(location=0)in vec2 aP;uniform vec4 uBox;uniform vec2 uSkew;uniform vec3 uRot;out vec2 vQ;void main(){vQ=aP*.5+.5;vec2 p=aP;p.x*=uSkew.x;vec2 q=p*uBox.zw*vec2(uRot.z,1.);q=vec2(q.x*uRot.x-q.y*uRot.y,q.x*uRot.y+q.y*uRot.x);gl_Position=vec4(uBox.xy+q/vec2(uRot.z,1.),0.,1.);}`;
const FS_LOGO = GH + `in vec2 vQ;uniform sampler2D uTex;uniform vec4 uFx;uniform vec3 uTint;uniform float uTime;out vec4 o;
float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){vec2 q=vQ;float gl=uFx.x;float row=floor(q.y*46.);float k=floor(uTime*18.);
 q.x+=gl*(h1(vec2(row,k))-.5)*.5*step(.45,h1(vec2(row*1.7,k+3.)));
 float ca=gl*.035+.0015;vec4 a=texture(uTex,vec2(q.x-ca,1.-q.y)),b=texture(uTex,vec2(q.x,1.-q.y)),c=texture(uTex,vec2(q.x+ca,1.-q.y));
 vec3 col=vec3(a.r*a.a,b.g*b.a,c.b*c.a);float al=max(a.a,max(b.a,c.a));
 float dis=uFx.y;float nz=h1(vec2(row,floor(q.x*90.)));float keep=step(dis,nz*.999+.0005);
 col*=keep;al*=keep;col=mix(col,(dot(col,vec3(.3,.5,.2))*1.8+.08*al)*uTint,uFx.z);
 float inside=step(0.,q.x)*step(q.x,1.);
 o=vec4(col*uFx.w*inside*1.5,al*inside*.92*min(uFx.w,1.));}`;
const VS_SPARK = GH + `layout(location=0)in vec2 aP;layout(location=2)in vec4 iA;layout(location=3)in vec4 iB;uniform vec2 uPx;uniform float uW;out vec2 vQ;flat out vec4 vC;
void main(){vec2 dir=normalize(iA.zw+1e-5);vec2 n=vec2(-dir.y,dir.x);float len=iB.w*uW;vec2 p=iA.xy+dir*(aP.x-.8)*len+n*aP.y*3.2*uW;vQ=aP;vC=vec4(iB.rgb,1.);gl_Position=vec4(p*uPx*2.-1.,0.,1.);gl_Position.y=-gl_Position.y;}`;
const FS_SPARK = GH + `in vec2 vQ;flat in vec4 vC;out vec4 o;void main(){float t=clamp(vQ.x*.5+.5,0.,1.);float y=exp(-vQ.y*vQ.y*6.);o=vec4(vC.rgb*(t*t*2.2+exp(-(1.-t)*(1.-t)*49.)*6.)*y,1.);}`;

const FS_DOWN = GH + `in vec2 v;uniform sampler2D uS;uniform vec2 uPx;uniform float uThr;out vec4 o;
vec3 pre(vec3 c){float l=max(c.r,max(c.g,c.b));float k=max(l-uThr,0.)/max(l,1e-4);return uThr>0.?c*k:c;}
void main(){vec3 a=pre(texture(uS,v+uPx*vec2(-1,-1)).rgb)+pre(texture(uS,v+uPx*vec2(1,-1)).rgb)+pre(texture(uS,v+uPx*vec2(-1,1)).rgb)+pre(texture(uS,v+uPx*vec2(1,1)).rgb);
 vec3 b=pre(texture(uS,v+uPx*vec2(-2,0)).rgb)+pre(texture(uS,v+uPx*vec2(2,0)).rgb)+pre(texture(uS,v+uPx*vec2(0,-2)).rgb)+pre(texture(uS,v+uPx*vec2(0,2)).rgb);
 vec3 c=pre(texture(uS,v).rgb);vec3 r=a*.125+b*.0625+c*.25;if(!(r.r+r.g+r.b<1e5))r=vec3(0.);o=vec4(min(r,vec3(40.)),1.);}`;
const FS_UP = GH + `in vec2 v;uniform sampler2D uS;uniform sampler2D uB;uniform vec2 uPx;uniform float uK;out vec4 o;
void main(){vec3 s=texture(uS,v+uPx*vec2(-1,-1)).rgb+texture(uS,v+uPx*vec2(1,-1)).rgb+texture(uS,v+uPx*vec2(-1,1)).rgb+texture(uS,v+uPx*vec2(1,1)).rgb;
 s+=2.*(texture(uS,v+uPx*vec2(-1,0)).rgb+texture(uS,v+uPx*vec2(1,0)).rgb+texture(uS,v+uPx*vec2(0,-1)).rgb+texture(uS,v+uPx*vec2(0,1)).rgb)+4.*texture(uS,v).rgb;
 o=vec4(texture(uB,v).rgb+s/16.*uK,1.);}`;
const FS_STREAK = GH + `in vec2 v;uniform sampler2D uS;uniform vec2 uPx;out vec4 o;void main(){vec3 s=vec3(0.);float tw=0.;for(int i=-10;i<=10;i++){float w=exp(-float(i*i)/38.);s+=texture(uS,v+uPx*float(i)).rgb*w;tw+=w;}o=vec4(s/tw,1.);}`;
const FS_FINAL = GH + `in vec2 v;uniform sampler2D uS;uniform sampler2D uB;uniform sampler2D uK;uniform vec2 uRes;uniform float uPh;uniform float uT;uniform float uFrame;uniform float uRain;uniform float uGrain;out vec4 o;
float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 c=v-.5;float r2=dot(c,c);vec2 ca=c*r2*.005;
 vec3 s=vec3(texture(uS,v+ca).r,texture(uS,v).g,texture(uS,v-ca).b);if(!(s.r+s.g+s.b<1e5))s=vec3(0.);
 vec3 b=texture(uB,v).rgb;vec3 k=texture(uK,v).rgb;
 vec3 col=s+b*.40+k*vec3(.55,.42,1.)*.30;
 /* rain close to the lens */
 float asp=uRes.x/uRes.y;float rn=0.;
 for(int i=0;i<3;i++){float fi=float(i);float n=(46.+fi*38.)*asp;float x=v.x*n+v.y*(1.4+fi*.5);float id=floor(x);float fx=fract(x);float cyc=floor(uT*(1.3+h1(vec2(id,fi))*1.1)+.5);
  float y=fract(v.y*(1.1+fi*.5)+uPh*cyc+h1(vec2(id,fi+7.)));float on=step(.55,h1(vec2(id,fi+3.)));
  rn+=on*smoothstep(.0,.06,y)*smoothstep(.22,.06,y)*smoothstep(.5,.2,abs(fx-.5)*(3.+fi*2.))*(.10-fi*.02);}
 col+=vec3(.75,.7,1.)*rn*uRain*(.5+2.*dot(b,vec3(.33)));
 col=aces(col*1.0);col=pow(col,vec3(.4545));
 col*=1.-r2*.55;col+=(h1(v*uRes+uFrame*13.7)-.5)*uGrain;
 o=vec4(col,1.);}`;

/* ---------------- GL plumbing ---------------- */
function start(canvas, atlas, opts) {
  opts = opts || {};
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance', preserveDrawingBuffer: MODE === 'film' });
  if (!gl) throw new Error('no webgl2');
  const hf = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  const IF = hf ? gl.RGBA16F : gl.RGBA8, TY = hf ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  function prog(vs, fs) { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + '\n' + s.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n').slice(0, 6000)); gl.attachShader(p, sh); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; }
  function tex(w, h, lin) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, IF, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function target(w, h, depth, msaa) { const o = { w, h, fb: gl.createFramebuffer(), tex: tex(w, h) };
    if (msaa > 1) { o.ms = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, o.ms); const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, msaa, IF, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
      const db = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, db); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, msaa, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, db); o.rbs = [rb, db]; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, o.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, o.tex, 0);
    if (depth && !(msaa > 1)) { const db = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, db); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, db); o.rbs = [db]; }
    o.draw = o.ms || o.fb; return o; }
  function freeTarget(o) { if (!o) return; gl.deleteFramebuffer(o.fb); if (o.ms) gl.deleteFramebuffer(o.ms); gl.deleteTexture(o.tex); (o.rbs || []).forEach(r => gl.deleteRenderbuffer(r)); }

  const P = { sky: prog(VS_FS, FS_SKY), box: prog(VS_BOX, FS_BOX), gnd: prog(VS_GND, FS_GND), sign: prog(VS_SIGN, FS_SIGN), craft: prog(VS_CRAFT, FS_CRAFT), down: prog(VS_FS, FS_DOWN), up: prog(VS_FS, FS_UP), streak: prog(VS_FS, FS_STREAK), fin: prog(VS_FS, FS_FINAL), logo: prog(VS_LOGO, FS_LOGO), spark: prog(VS_SPARK, FS_SPARK) };
  const city = buildCity(atlas.slots);
  /* holograms: a spinning ghost flask over every plaza, made of two crossed sheets */
  const holo = []; HOLO.forEach(h => { for (let k = 0; k < 2; k++) holo.push(h.x, h.h * .5 + 7, h.z, 1, 0, h.h * .42, h.h * .37, ...atlas.slots.sq[1], h.seed, 2, k * Math.PI / 2); });
  const cube = (function () { const v = []; const F = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    for (const [n, a, b] of F) for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) v.push(n[0] + a[0] * s + b[0] * t, n[1] + a[1] * s + b[1] * t, n[2] + a[2] * s + b[2] * t, n[0], n[1], n[2]); return new Float32Array(v); })();
  const quad = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
  function vao(geom, gsize, gattrs, inst, stride, iattrs, dyn) { const va = gl.createVertexArray(); gl.bindVertexArray(va); const gb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gb); gl.bufferData(gl.ARRAY_BUFFER, geom, gl.STATIC_DRAW);
    let off = 0; gattrs.forEach(([loc, n]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, gsize * 4, off * 4); off += n; });
    let ib = null; if (inst) { ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, inst, dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); off = 0; iattrs.forEach(([loc, n]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride * 4, off * 4); gl.vertexAttribDivisor(loc, 1); off += n; }); }
    gl.bindVertexArray(null); return { va, n: inst ? inst.length / stride : 0, ib }; }
  const V = { box: vao(cube, 6, [[0, 3], [1, 3]], city.boxes, 16, [[2, 3], [3, 3], [4, 4], [5, 3], [6, 3]]),
    sign: vao(quad, 2, [[0, 2]], city.signs, 14, [[2, 3], [3, 2], [4, 2], [5, 4], [6, 3]]), holo: vao(quad, 2, [[0, 2]], new Float32Array(holo), 14, [[2, 3], [3, 2], [4, 2], [5, 4], [6, 3]]),
    drone: vao(quad, 2, [[0, 2]], new Float32Array(14 * 8), 14, [[2, 3], [3, 2], [4, 2], [5, 4], [6, 3]], true),
    craft: vao(quad, 2, [[0, 2]], city.craft, 12, [[2, 4], [3, 4], [4, 4]]), gnd: vao(quad, 2, [[0, 2]]), fs: gl.createVertexArray(),
    spark: vao(quad, 2, [[0, 2]], new Float32Array(8 * 600), 8, [[2, 4], [3, 4]], true) };
  const atlasTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); const af = gl.getExtension('EXT_texture_filter_anisotropic'); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const cellTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, cellTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NC, NC, 0, gl.RGBA, gl.UNSIGNED_BYTE, city.cellTex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  /* the logo, drawn once to its own canvas at high resolution */
  const logoCv = document.createElement('canvas'); logoCv.width = 1024; logoCv.height = 896; { const g = logoCv.getContext('2d'); g.drawImage(atlas.emblem, 0, 0, 1024, 896); }
  const logoTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, logoTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, logoCv); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let R = null;   // render targets for the current size
  function resize(scale, msaa) { const W = Math.max(64, Math.round(canvas.width * scale)), H = Math.max(64, Math.round(canvas.height * scale)); if (R && R.W === W && R.H === H && R.msaa === msaa) return;
    if (R) { freeTarget(R.scene); freeTarget(R.comp); freeTarget(R.refl); R.bl.forEach(freeTarget); R.up.forEach(freeTarget); freeTarget(R.st0); freeTarget(R.st1); }
    R = { W, H, msaa, scene: target(W, H, true, msaa), comp: target(W, H), refl: target(W >> 1, H >> 1, true, 0), bl: [], up: [], have: false };
    let w = W >> 1, h = H >> 1; for (let i = 0; i < 6 && w > 8 && h > 8; i++) { R.bl.push(target(w, h)); R.up.push(target(w, h)); w >>= 1; h >>= 1; }
    R.st0 = target(R.bl[2].w, R.bl[2].h); R.st1 = target(R.bl[2].w, R.bl[2].h); }

  function common(p, cam, t) { gl.useProgram(p.p); gl.uniform3fv(p.u.uCam, cam); gl.uniform1f(p.u.uPh, ((t / T) % 1 + 1) % 1); gl.uniform1f(p.u.uT, T); gl.uniform1f(p.u.uL, L); }
  function world(cm, vp, eye, t, refl, asp) {
    const tan = Math.tan(cm.fov / 2);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
    common(P.sky, eye, t); gl.uniform3fv(P.sky.u.uR, cm.v.s); gl.uniform3fv(P.sky.u.uU, cm.v.u); gl.uniform3fv(P.sky.u.uF, cm.v.f); gl.uniform2f(P.sky.u.uTan, tan * asp, tan); gl.uniform1f(P.sky.u.uFlip, refl ? -1 : 1);
    gl.bindVertexArray(V.fs); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
    if (!refl) { common(P.gnd, eye, t); gl.uniformMatrix4fv(P.gnd.u.uVP, false, vp); gl.uniform2f(P.gnd.u.uRes, R.W, R.H); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.refl.tex); gl.uniform1i(P.gnd.u.uRefl, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cellTex); gl.uniform1i(P.gnd.u.uCells, 1); gl.bindVertexArray(V.gnd.va); gl.drawArrays(gl.TRIANGLES, 0, 6); }
    common(P.box, eye, t); gl.uniformMatrix4fv(P.box.u.uVP, false, vp); gl.bindVertexArray(V.box.va); gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, V.box.n);
    common(P.sign, eye, t); gl.uniformMatrix4fv(P.sign.u.uVP, false, vp); gl.uniform1f(P.sign.u.uHolo, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.uniform1i(P.sign.u.uAtlas, 0);
    gl.bindVertexArray(V.sign.va); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, V.sign.n);
    if (nDrone) { gl.bindVertexArray(V.drone.va); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nDrone); }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.uniform1f(P.sign.u.uHolo, 1); gl.bindVertexArray(V.holo.va); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, V.holo.n);
    common(P.craft, eye, t); gl.uniformMatrix4fv(P.craft.u.uVP, false, vp); gl.uniform3fv(P.craft.u.uR, cm.v.s); gl.uniform3fv(P.craft.u.uU, cm.v.u); gl.bindVertexArray(V.craft.va); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, V.craft.n);
    gl.disable(gl.BLEND); gl.depthMask(true);
  }
  function fsq(p, dst, w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.viewport(0, 0, w, h); gl.bindVertexArray(V.fs); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function bind(p, name, unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(p.u[name], unit); }

  /* escort screens: flying billboards that drop in ahead of the camera, hold station for a good look, then pull away. Keyed on lap position so film and live agree. */
  const ESC = [[0.8, 6.6, atlas.slots.land[0], 8.4, 4.2, 2.2, 40], [23.2, 29.6, atlas.slots.land[0], 30, 15, -44, 120], [44.4, 48.8, atlas.slots.sq[0], 5, 5, 1.8, 40], [36.2, 40.6, atlas.slots.land[20], 9.5, 4.75, 5, 46], [53.4, 57.8, atlas.slots.land[32], 11.5, 5.75, 4, 40]];   /* the last one is for Mac: it flies ahead of the camera for the longest look of the lap */
  const droneBuf = new Float32Array(14 * 8); let nDrone = 0;
  function drones(cm) { nDrone = 0; for (const e of ESC) { if (cm.k < e[0] || cm.k > e[1]) continue; const u = (cm.k - e[0]) / (e[1] - e[0]), a = mix(560, e[6], ss(0, .3, u)) + Math.pow(ss(.74, 1, u), 2) * 700;
      const p = PATH.xz(cm.d + a), q = PATH.xz(cm.d + a + 3), tl = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, n = [-(q[0] - p[0]) / tl, -(q[1] - p[1]) / tl], rt = [n[1], -n[0]], o = nDrone * 14;
      const y = mix(pathAt(cm.d + a)[1], cm.e[1], ss(.1, .3, u) * (1 - ss(.74, .9, u))) + e[5] + Math.sin(u * 23) * .5 + (1 - ss(0, .3, u)) * 26;
      droneBuf.set([p[0] + rt[0] * Math.sin(u * 15) * 1.5, y, p[1] + rt[1] * Math.sin(u * 15) * 1.5, rt[0], rt[1], e[3], e[4], e[2][0], e[2][1], e[2][2], e[2][3], e[0] + 5, 1, 2.0], o); nDrone++; }
    if (nDrone) { gl.bindBuffer(gl.ARRAY_BUFFER, V.drone.ib); gl.bufferSubData(gl.ARRAY_BUFFER, 0, droneBuf.subarray(0, nDrone * 14)); } }
  let frameNo = 0;
  function render(t, o) {
    o = o || {}; resize(o.scale || 1, o.msaa == null ? 4 : o.msaa); frameNo++;
    const cm = o.cam || camAt(t), asp = canvas.width / canvas.height; if (asp > 2.2) cm.fov = 2 * Math.atan(Math.tan(HFOV * Math.PI / 180) / asp); cm.v = view(cm.e, cm.f, cm.roll); drones(cm);
    const pr = persp(cm.fov, asp, 1.2, 14000), vp = mul(pr, cm.v.m);
    const vr = cm.v.m.slice(); vr[4] = -vr[4]; vr[5] = -vr[5]; vr[6] = -vr[6]; vr[7] = -vr[7]; const vpr = mul(pr, vr);
    /* the city may be drawn every other frame (live mode on a small GPU): it glides slowly, while the logo, sparks and rain stay at full rate */
    if (!(o.half && (frameNo & 1) && R.have)) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.refl.draw); gl.viewport(0, 0, R.refl.w, R.refl.h); gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      world(cm, vpr, [cm.e[0], -cm.e[1], cm.e[2]], t, true, asp);
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.scene.draw); gl.viewport(0, 0, R.W, R.H); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      world(cm, vp, cm.e, t, false, asp);
      if (R.scene.ms) { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, R.scene.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, R.scene.fb); gl.blitFramebuffer(0, 0, R.W, R.H, 0, 0, R.W, R.H, gl.COLOR_BUFFER_BIT, gl.NEAREST); }
      R.have = true;
    }
    let img = R.scene;
    if (o.overlay) { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, R.scene.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, R.comp.fb); gl.blitFramebuffer(0, 0, R.W, R.H, 0, 0, R.W, R.H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.comp.fb); gl.viewport(0, 0, R.W, R.H); gl.disable(gl.DEPTH_TEST); gl.depthMask(false); o.overlay(t); img = R.comp; }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    /* bloom */
    gl.useProgram(P.down.p); let src = img;
    R.bl.forEach((b, i) => { bind(P.down, 'uS', 0, src.tex); gl.uniform2f(P.down.u.uPx, 1 / src.w, 1 / src.h); gl.uniform1f(P.down.u.uThr, i === 0 ? .8 : 0); fsq(P.down, b.fb, b.w, b.h); src = b; });
    gl.useProgram(P.up.p); let acc = R.bl[R.bl.length - 1];
    for (let i = R.bl.length - 2; i >= 0; i--) { bind(P.up, 'uS', 0, acc.tex); bind(P.up, 'uB', 1, R.bl[i].tex); gl.uniform2f(P.up.u.uPx, 1 / acc.w, 1 / acc.h); gl.uniform1f(P.up.u.uK, .95); fsq(P.up, R.up[i].fb, R.up[i].w, R.up[i].h); acc = R.up[i]; }
    gl.useProgram(P.streak.p); bind(P.streak, 'uS', 0, R.bl[2].tex); gl.uniform2f(P.streak.u.uPx, 2.2 / R.bl[2].w, 0); fsq(P.streak, R.st0.fb, R.st0.w, R.st0.h);
    bind(P.streak, 'uS', 0, R.st0.tex); gl.uniform2f(P.streak.u.uPx, 6.5 / R.bl[2].w, 0); fsq(P.streak, R.st1.fb, R.st1.w, R.st1.h);
    gl.useProgram(P.fin.p); bind(P.fin, 'uS', 0, img.tex); bind(P.fin, 'uB', 1, acc.tex); bind(P.fin, 'uK', 2, R.st1.tex); gl.uniform2f(P.fin.u.uRes, canvas.width, canvas.height);
    gl.uniform1f(P.fin.u.uPh, ((t / T) % 1 + 1) % 1); gl.uniform1f(P.fin.u.uT, T); gl.uniform1f(P.fin.u.uFrame, MODE === 'film' ? Math.round(t * 60) % 600 : frameNo % 600); gl.uniform1f(P.fin.u.uRain, o.rain == null ? 1 : o.rain); gl.uniform1f(P.fin.u.uGrain, o.grain == null ? .012 : o.grain);
    fsq(P.fin, null, canvas.width, canvas.height);
  }
  /* logo drawing helpers for the live act: all in canvas pixels, y down */
  const sparks = new Float32Array(8 * 600);
  function drawLogo(cx, cy, hpx, fx) { const wpx = hpx * 1024 / 896; gl.useProgram(P.logo.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform4f(P.logo.u.uBox, cx / canvas.width * 2 - 1, 1 - cy / canvas.height * 2, wpx / canvas.width, hpx / canvas.height); gl.uniform2f(P.logo.u.uSkew, fx.squash == null ? 1 : fx.squash, 0); gl.uniform3f(P.logo.u.uRot, Math.cos(fx.rot || 0), -Math.sin(fx.rot || 0), canvas.width / canvas.height);
    gl.uniform4f(P.logo.u.uFx, fx.glitch || 0, fx.dissolve || 0, fx.mono || 0, fx.gain == null ? 1 : fx.gain); gl.uniform3fv(P.logo.u.uTint, fx.tint || [1, 1, 1]); gl.uniform1f(P.logo.u.uTime, fx.time || 0);
    bind(P.logo, 'uTex', 0, logoTex); gl.bindVertexArray(V.gnd.va); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.disable(gl.BLEND); }
  function drawSparks(list) { const n = Math.min(list.length, 600); if (!n) return; for (let i = 0; i < n; i++) { const s = list[i], o = i * 8; sparks[o] = s.x; sparks[o + 1] = s.y; sparks[o + 2] = s.vx; sparks[o + 3] = s.vy; sparks[o + 4] = s.c[0] * s.a; sparks[o + 5] = s.c[1] * s.a; sparks[o + 6] = s.c[2] * s.a; sparks[o + 7] = s.len; }
    gl.useProgram(P.spark.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.uniform2f(P.spark.u.uPx, 1 / canvas.width, 1 / canvas.height); gl.uniform1f(P.spark.u.uW, Math.max(.5, canvas.height / 1080)); gl.bindBuffer(gl.ARRAY_BUFFER, V.spark.ib); gl.bufferSubData(gl.ARRAY_BUFFER, 0, sparks.subarray(0, n * 8));
    gl.bindVertexArray(V.spark.va); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n); gl.disable(gl.BLEND); }
  return { gl, render, drawLogo, drawSparks, camAt, T, PAL, city, info: { boxes: V.box.n, signs: V.sign.n, craft: V.craft.n, holo: V.holo.n, hf: !!hf, len: PATH.LEN } };
}
window.ZSprawl = { start, MODE, T, camAt, pathAt, PATH, DU };
})();
