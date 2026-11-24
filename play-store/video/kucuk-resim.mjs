// YouTube küçük resmi (1280×720, JPG) üretir. Çalıştır: node play-store/video/kucuk-resim.mjs [çıktı.jpg]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const DIR = dirname(fileURLToPath(import.meta.url)), G = join(DIR, "..", "gorseller");
const OUT = resolve(process.argv[2] || join(DIR, "klipler", "kucuk-resim-1280x720.jpg"));
const img = (f) => "data:image/png;base64," + readFileSync(join(G, f)).toString("base64");
function stickers(seed, n, avoid) {
  const cols = ["#ff4d4f", "#ffd43b", "#40c057", "#339af0", "#ff922b", "#ffffff"]; let s = seed, out = "";
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) { const z = 34 + r() * 60, x = r() * 1280, y = r() * 720, rot = r() * 50 - 25, op = .2 + r() * .25;
    if (avoid(x, y)) continue; out += `<i style="left:${x}px;top:${y}px;width:${z}px;height:${z}px;background:${cols[i % 6]};opacity:${op};transform:rotate(${rot}deg)"></i>`; }
  return out;
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1280px;height:720px;overflow:hidden;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;background:radial-gradient(120% 120% at 10% 0%,#7c5cff 0%,#4f2bd9 70%,#3a1bb0 100%)}
.glow{position:absolute;width:900px;height:900px;left:560px;top:-160px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.3),rgba(255,255,255,0) 62%)}
.dots i{position:absolute;border-radius:22%}
.t{position:absolute;left:64px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center;color:#fff}
.brand{display:flex;align-items:center;gap:16px;font:900 38px Inter;letter-spacing:-.5px;margin-bottom:26px}
.brand img{width:80px;height:80px;border-radius:20px;background:#fff;padding:6px;box-shadow:0 12px 30px rgba(0,0,0,.25)}
h1{font:900 132px/.98 Inter;letter-spacing:-5px}h1 em{font-style:normal;color:#ffd43b}
.tag{margin-top:30px;align-self:flex-start;font:800 30px Inter;padding:12px 24px;border-radius:999px;background:rgba(255,255,255,.2)}
.ph{position:absolute;border-radius:44px;background:#0d0e14;padding:10px;box-shadow:0 34px 70px rgba(10,0,40,.5)}
.ph div{width:100%;height:100%;border-radius:35px;overflow:hidden}.ph img{width:100%;display:block}
</style></head><body><div class="bg"></div><div class="dots">${stickers(5, 30, (x, y) => x > 40 && x < 1240 && y > 30 && y < 690)}</div><div class="glow"></div>
<div class="ph" style="width:330px;height:587px;left:720px;top:96px;transform:rotate(-8deg)"><div><img src="${img("ham/02-pll.png")}"></div></div>
<div class="ph" style="width:360px;height:640px;left:880px;top:52px;transform:rotate(5deg)"><div><img src="${img("ham/01-ana-sayfa.png")}"></div></div>
<div class="t"><div class="brand"><img src="${img("uygulama-simgesi-512.png")}">Rubik Academy</div>
<h1>Küpü çöz.<br><em>Hızlan.</em></h1><div class="tag">Ücretsiz · Türkçe</div></div></body></html>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.setContent(html, { waitUntil: "load" }); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: OUT, type: "jpeg", quality: 92 }); await b.close(); console.log("hazır:", OUT);
