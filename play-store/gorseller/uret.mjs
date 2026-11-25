// Google Play mağaza görsellerini üretir (ekran görüntüleri 1080×1920 + öne çıkan grafik 1024×500).
// Kaynak: ham/*.png (uygulamanın gerçek ekran görüntüleri; açık tema, uygulama modu, 360×640 @3x; rekor adları hayali). Çalıştır: node play-store/gorseller/uret.mjs
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const img = (f) => "data:image/png;base64," + readFileSync(join(DIR, f)).toString("base64");
const ICON = img("uygulama-simgesi-512.png");

// Her ekran: tek fayda, kısa başlık. Sıra = mağazadaki sıra (en güçlüsü önce).
const SHOTS = [
  { src: "01-ana-sayfa.png", out: "01-kupu-cozmeyi-ogren.png", bg: ["#7c5cff", "#4f2bd9"], kicker: "SIFIRDAN İLERİ SEVİYEYE", title: "Küpü çözmeyi<br><em>adım adım</em> öğren", c: "#ffd43b" },
  { src: "02-pll.png", out: "02-algoritmalar.png", bg: ["#ff8a1f", "#f0490f"], kicker: "OLL · PLL · F2L · ZBLL", title: "<em>1.400+</em> algoritma<br>tek yerde", c: "#fff3bf" },
  { src: "03-antrenor.png", out: "03-antrenor.png", bg: ["#16b36e", "#0b7d4b"], kicker: "SÜRE · TEKRAR · GELİŞİM", title: "Antrenörle<br><em>ezberle</em>, hızlan", c: "#d3f9d8" },
  { src: "04-rekorlar.png", out: "04-ev-yarismalari.png", bg: ["#ff4f8b", "#c81d63"], kicker: "CANLI · HER HAFTA", title: "Evden yarış,<br><em>rekorunu</em> kır", c: "#ffe066" },
  { src: "05-yol-haritasi.png", out: "05-yol-haritasi.png", bg: ["#2f80ff", "#1546c9"], kicker: "KİŞİSEL YOL HARİTASI", title: "Sırada ne var,<br><em>hep bil</em>", c: "#a5f3fc" },
  { src: "06-sanal-kup.png", out: "06-sanal-kup.png", bg: ["#ffc61a", "#f59f00"], kicker: "KÜP YANINDA DEĞİL Mİ?", title: "Sanal <em>3D küple</em><br>pratik yap", c: "#b33c00", dark: true },
  { src: "07-icerikler.png", out: "07-her-sey-burada.png", bg: ["#13141f", "#2b1f5c"], kicker: "TÜRKÇE · ÜCRETSİZ", title: "Ders, rehber, antrenör:<br><em>hepsi burada</em>", c: "#b197fc" },
];

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.dots i{position:absolute;border-radius:22%;opacity:.9}
`;
// Dekor: küp yüzü kareleri (marka renkleri)
function stickers(seed, w, h, n, minS, maxS, avoid) {
  const cols = ["#ff4d4f", "#ffd43b", "#40c057", "#339af0", "#ff922b", "#ffffff"];
  let s = seed, out = "";
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const size = minS + r() * (maxS - minS), x = r() * w, y = r() * h, rot = r() * 50 - 25;
    if (avoid && avoid(x, y)) continue;
    out += `<i style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${cols[i % cols.length]};transform:rotate(${rot}deg);opacity:${0.18 + r() * 0.25}"></i>`;
  }
  return out;
}

function shotHtml(s, i) {
  const ink = s.dark ? "#1b1300" : "#ffffff";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
  html,body{width:1080px;height:1920px;overflow:hidden}
  .bg{position:absolute;inset:0;background:radial-gradient(120% 80% at 20% 0%, ${s.bg[0]} 0%, ${s.bg[1]} 75%)}
  .glow{position:absolute;width:900px;height:900px;left:90px;top:760px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,.28), rgba(255,255,255,0) 65%)}
  .head{position:absolute;left:80px;right:80px;top:120px;color:${ink};text-align:center}
  .kick{display:inline-block;font:800 30px Inter;letter-spacing:4px;padding:14px 28px;border-radius:999px;background:${s.dark ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.18)"};margin-bottom:34px}
  h1{font:900 96px/1.04 Inter;letter-spacing:-3px}
  h1 em{font-style:normal;color:${s.c}}
  .phone{position:absolute;left:140px;top:600px;width:800px;height:1422px;border-radius:96px;background:#0d0e14;padding:22px;box-shadow:0 60px 120px rgba(0,0,0,.45),0 0 0 3px rgba(255,255,255,.18) inset}
  .scr{width:100%;height:100%;border-radius:76px;overflow:hidden;background:#000}
  .scr img{width:100%;display:block}
  .notch{position:absolute;left:50%;top:44px;width:34px;height:34px;margin-left:-17px;border-radius:50%;background:#0d0e14;box-shadow:0 0 0 6px #0d0e14}
  </style></head><body>
  <div class="bg"></div><div class="dots">${stickers(i * 17 + 3, 1080, 1920, 16, 50, 130, (x) => x > 90 && x < 960) /* yalnız kenarlarda */}</div><div class="glow"></div>
  <div class="head"><div class="kick">${s.kicker}</div><h1>${s.title}</h1></div>
  <div class="phone"><div class="scr"><img src="${img("ham/" + s.src)}"></div></div>
  </body></html>`;
}

function featureHtml() {
  const a = img("ham/02-pll.png"), b = img("ham/01-ana-sayfa.png"), c = img("ham/03-antrenor.png");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
  html,body{width:1024px;height:500px;overflow:hidden}
  .bg{position:absolute;inset:0;background:linear-gradient(115deg,#5b2bff 0%,#9b2cff 38%,#ff4f8b 72%,#ff8a1f 100%)}
  .t{position:absolute;left:56px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;color:#fff}
  .brand{display:flex;align-items:center;gap:14px;font:800 26px Inter;margin-bottom:22px}
  .brand img{width:58px;height:58px;border-radius:16px;background:#fff;padding:5px}
  h1{font:900 66px/1.02 Inter;letter-spacing:-2px}
  h1 em{font-style:normal;color:#ffe066}
  p{margin-top:18px;font:700 22px/1.35 Inter;opacity:.95}
  .ph{position:absolute;width:210px;height:373px;border-radius:30px;background:#0d0e14;padding:8px;box-shadow:0 24px 50px rgba(30,0,60,.45)}
  .ph div{width:100%;height:100%;border-radius:23px;overflow:hidden}.ph img{width:100%;display:block}
  </style></head><body><div class="bg"></div>
  <div class="dots">${stickers(7, 1024, 500, 14, 26, 60, (x) => x < 520)}</div>
  <div class="t"><div class="brand"><img src="${ICON}">Rubik Academy</div>
  <h1>Küpü çöz.<br><em>Hızlan.</em></h1><p>1.400+ algoritma, antrenörler<br>ve canlı ev yarışmaları</p></div>
  <div class="ph" style="left:560px;top:96px;transform:rotate(-8deg)"><div><img src="${a}"></div></div>
  <div class="ph" style="left:790px;top:96px;transform:rotate(8deg)"><div><img src="${c}"></div></div>
  <div class="ph" style="left:672px;top:60px;z-index:2;width:228px;height:405px"><div><img src="${b}"></div></div>
  </body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
mkdirSync(join(DIR, "ekran-goruntuleri"), { recursive: true });
for (const [i, s] of SHOTS.entries()) {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.setContent(shotHtml(s, i), { waitUntil: "load" });
  await page.screenshot({ path: join(DIR, "ekran-goruntuleri", s.out) });
}
await page.setViewportSize({ width: 1024, height: 500 });
await page.setContent(featureHtml(), { waitUntil: "load" });
await page.screenshot({ path: join(DIR, "one-cikan-grafik-1024x500.png") });
await browser.close();
console.log("ok");
