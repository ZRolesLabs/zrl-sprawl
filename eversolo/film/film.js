// node film.js <outdir> <first> <lastExclusive> <fps> <W> <H> [query] [ext=png] [mod] [rem]   renders frames of ../../sprawl served on 127.0.0.1:8896; frame f is t = f/fps
const { chromium } = require('playwright'); const fs = require('fs');
const [OUT, A, B, FPS, W, H, Qx, EXT, MOD, REM] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6], +process.argv[7], process.argv[8] || '', process.argv[9] || 'png', +(process.argv[10] || 1), +(process.argv[11] || 0)];
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:8896/index.html?mode=film&' + Qx); await p.waitForFunction('window.ZSS && window.ZSS.ready', null, { timeout: 120000 });
  const t0 = Date.now(); let n = 0;
  for (let f = A; f < B; f++) { if (f % MOD !== REM) continue; const fn = `${OUT}/f${String(f).padStart(5, '0')}.${EXT}`; if (fs.existsSync(fn)) continue;
    await p.evaluate(t => ZSS.frame(t), f / FPS); await p.screenshot({ path: fn + '.tmp', type: EXT === 'png' ? 'png' : 'jpeg', quality: EXT === 'png' ? undefined : 96, timeout: 180000 }); fs.renameSync(fn + '.tmp', fn); n++;
    if (n % 50 === 0) console.log(f, ((Date.now() - t0) / n).toFixed(0) + ' ms/frame'); }
  await b.close(); console.log('DONE', A, B);
})();
