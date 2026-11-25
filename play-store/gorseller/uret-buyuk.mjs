// Google Play TABLET (7" + 10") ve KATLANABİLİR ekran görüntülerini üretir.
// 1) Gerçek sayfaları Playwright ile çeker (açık tema, ?source=app, isMobile + hasTouch) -> ham-buyuk/
// 2) uret.mjs tarzında kompozisyon yapar -> tablet/ (2560×1440), katlanabilir/ (acik-* 2160×2160, kapali-* 1200×1920)
// 3) Boyut / kenar kontrolü yazdırır.
// Önce: python3 play-store/video/sunucu.py 8765   Sonra: node play-store/gorseller/uret-buyuk.mjs [--sadece-kompozisyon]
// Rekor adları hayali (sahteRekor); giriş bilgisi kullanılmaz; Bluetooth / akıllı küp / Çözüm Analizi / bildirim zili gizlenir.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const DIR = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://127.0.0.1:8765";
const img = (f) => "data:image/png;base64," + readFileSync(join(DIR, f)).toString("base64");

// --- kaydet.mjs'ten: hayali rekor yanıtı, açık tema, Bluetooth gizleme ---
const HAYALI = [
  ["Deniz Kaya", 7120, 14, 3], ["Ece Yıldız", 7850, 11, 2], ["Arda Demir", 8410, 9, 1], ["Zeynep Aksoy", 9030, 12, 0],
  ["Kerem Şahin", 9760, 7, 0], ["Elif Çelik", 10240, 6, 0], ["Mert Arslan", 10880, 8, 0], ["Selin Koç", 11350, 5, 0],
  ["Can Öztürk", 11920, 4, 0], ["Ada Polat", 12470, 6, 0], ["Emir Aydın", 13010, 3, 0], ["Nil Erdem", 13580, 5, 0],
];
function sahteRekor(route) {
  let f = "s333";
  try { f = JSON.parse(route.request().postData()).structuredQuery.orderBy[0].field.fieldPath; } catch (e) {}
  const k = f.startsWith("s") ? 1 : f.startsWith("a5") ? 1.22 : 1.31, k2 = f.includes("222") ? 0.42 : 1;
  const body = HAYALI.map(([name, t, n, w], i) => ({ document: { name: "projects/x/databases/(default)/documents/records/demo" + i,
    fields: { name: { stringValue: name }, [f]: { integerValue: String(Math.round(t * k * k2)) }, n: { integerValue: String(n) }, w: { integerValue: String(w) } } } }));
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}
const INIT = () => { try { localStorage.setItem("theme", "light"); localStorage.setItem("site-lang", "tr"); } catch (e) {} };
const GIZLE = "#btToggle,.bt-wrap,[data-bt]{display:none!important}";
// Uygulamada çalışmayan akıllı küp / Çözüm Analizi bağlantıları hiçbir kadrajda görünmesin
const HER_YER = "::-webkit-scrollbar{display:none}*{scrollbar-width:none}a[href*='akilli-kup'],a[href*='akilli-timer'],#raBell{display:none!important}" + GIZLE; // zil = bildirimler

// --- Sahneler (uret.mjs SHOTS ile aynı başlık ve renkler) ---
const SHOTS = [
  { id: "01-ana-sayfa", url: "/", out: "01-kupu-cozmeyi-ogren", bg: ["#7c5cff", "#4f2bd9"], kicker: "SIFIRDAN İLERİ SEVİYEYE", title: "Küpü çözmeyi<br><em>adım adım</em> öğren", c: "#ffd43b" },
  { id: "02-pll", url: "/icerikler/algoritmalar/pll", out: "02-algoritmalar", bg: ["#ff8a1f", "#f0490f"], kicker: "OLL · PLL · F2L · ZBLL", title: "<em>1.400+</em> algoritma<br>tek yerde", c: "#fff3bf", scroll: 0.35 },
  { id: "03-antrenor", url: "/icerikler/algoritmalar/antrenor", out: "03-antrenor", bg: ["#16b36e", "#0b7d4b"], kicker: "SÜRE · TEKRAR · GELİŞİM", title: "Antrenörle<br><em>ezberle</em>, hızlan", c: "#d3f9d8", uye: true,
    hazirla: async (p) => { await p.locator(".set-tab:text-is('PLL')").first().click({ timeout: 3000 }).catch(() => {}); } },
  { id: "04-rekorlar", url: "/icerikler/rekorlar", out: "04-ev-yarismalari", bg: ["#ff4f8b", "#c81d63"], kicker: "CANLI · HER HAFTA", title: "Evden yarış,<br><em>rekorunu</em> kır", c: "#ffe066", bekle: 1500 },
  { id: "05-yol-haritasi", url: "/icerikler/yol-haritasi", out: "05-yol-haritasi", bg: ["#2f80ff", "#1546c9"], kicker: "KİŞİSEL YOL HARİTASI", title: "Sırada ne var,<br><em>hep bil</em>", c: "#a5f3fc", scroll: 0.5 },
  { id: "06-sanal-kup", url: "/icerikler/sanal-kup", out: "06-sanal-kup", bg: ["#ffc61a", "#f59f00"], kicker: "KÜP YANINDA DEĞİL Mİ?", title: "Sanal <em>3D küple</em><br>pratik yap", c: "#b33c00", dark: true,
    hazirla: async (p) => { await p.locator("#vcScramble").first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200); } },
  { id: "07-icerikler", url: "/icerikler", out: "07-her-sey-burada", bg: ["#13141f", "#2b1f5c"], kicker: "TÜRKÇE · ÜCRETSİZ", title: "Ders, rehber, antrenör:<br><em>hepsi burada</em>", c: "#b197fc" },
];
// Cihaz biçimleri: ham viewport + çıktı
const FORMLAR = {
  tablet: { vw: 1280, vh: 800, dsf: 2, W: 2560, H: 1440, klasor: "tablet", ad: (s) => s.out, sahneler: SHOTS.map((s) => s.id) },
  acik: { vw: 840, vh: 840, dsf: 2, W: 2160, H: 2160, klasor: "katlanabilir", ad: (s) => "acik-" + s.out, sahneler: ["01-ana-sayfa", "02-pll", "03-antrenor", "06-sanal-kup"] },
  kapali: { vw: 400, vh: 640, dsf: 3, W: 1200, H: 1920, klasor: "katlanabilir", ad: (s) => "kapali-" + s.out, sahneler: ["01-ana-sayfa", "04-rekorlar"] },
};

async function hamCek(browser) {
  mkdirSync(join(DIR, "ham-buyuk"), { recursive: true });
  for (const [fad, F] of Object.entries(FORMLAR)) {
    const ctx = await browser.newContext({ viewport: { width: F.vw, height: F.vh }, deviceScaleFactor: F.dsf, isMobile: true, hasTouch: true, locale: "tr-TR" });
    await ctx.addInitScript(INIT);
    await ctx.route(/googletagmanager|google-analytics/, (r) => r.abort());
    await ctx.route(/firestore\.googleapis\.com.*:runQuery/, sahteRekor);
    for (const id of F.sahneler) {
      const s = SHOTS.find((x) => x.id === id);
      const page = await ctx.newPage();
      const u = BASE + s.url + (s.url.includes("?") ? "&" : "?") + "source=app";
      for (let i = 0; i < 4; i++) { // Firestore/ağ bazen 429 verir: bekleyip yeniden dene
        const r = await page.goto(u, { waitUntil: "networkidle", timeout: 45000 }).catch(() => null);
        if (r && r.ok()) break;
        console.log(`  ${id}: yeniden deneniyor (${r ? r.status() : "ağ"})`);
        await page.waitForTimeout(2000 * (i + 1));
      }
      if (s.uye) await page.evaluate(() => { // üye görünümü (giriş bilgisi kullanılmaz)
        if (window.Account) { Account.user = () => ({ uid: "demo", displayName: "Deniz Kaya" }); }
        document.querySelectorAll(".ra-lock").forEach((x) => x.remove()); document.documentElement.classList.remove("ra-locked");
      });
      await page.addStyleTag({ content: HER_YER });
      await page.waitForTimeout(900);
      if (s.hazirla) await s.hazirla(page);
      await page.evaluate((k) => window.scrollTo(0, Math.round(innerHeight * k)), s.scroll || 0);
      // görünür alana giren "reveal" animasyonlarının bitmesi için
      await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in", "visible", "show")));
      await page.waitForTimeout(s.bekle || 900);
      await page.screenshot({ path: join(DIR, "ham-buyuk", `${fad}-${id}.png`) });
      await page.close();
      console.log(`ham: ${fad}-${id}`);
    }
    await ctx.close();
  }
}

// --- Kompozisyon (uret.mjs tarzı) ---
const CSS = `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.dots i{position:absolute;border-radius:22%;opacity:.9}`;
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
function html(fad, s, i) {
  const F = FORMLAR[fad], ink = s.dark ? "#1b1300" : "#ffffff";
  const ortak = `html,body{width:${F.W}px;height:${F.H}px;overflow:hidden}
  .bg{position:absolute;inset:0;background:radial-gradient(120% 90% at 15% 0%, ${s.bg[0]} 0%, ${s.bg[1]} 75%)}
  .head{position:absolute;color:${ink}}
  .kick{display:inline-block;font-weight:800;letter-spacing:4px;border-radius:999px;background:${s.dark ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.18)"}}
  h1{font-weight:900;line-height:1.04}h1 em{font-style:normal;color:${s.c}}
  .dev{position:absolute;background:#0d0e14;box-shadow:0 60px 120px rgba(0,0,0,.45),0 0 0 3px rgba(255,255,255,.18) inset}
  .scr{width:100%;height:100%;overflow:hidden;background:#fff}.scr img{width:100%;height:100%;display:block}
  .glow{position:absolute;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,.28), rgba(255,255,255,0) 65%)}`;
  let lay, dots;
  const src = img(`ham-buyuk/${fad}-${s.id}.png`);
  if (fad === "tablet") { // solda başlık, sağda yatay tablet
    lay = `.head{left:130px;top:0;bottom:0;width:760px;display:flex;flex-direction:column;justify-content:center}
    .kick{font-size:30px;padding:14px 28px;margin-bottom:40px;align-self:flex-start}h1{font-size:104px;letter-spacing:-3px}
    .dev{right:110px;top:${(1440 - 1012) / 2}px;width:1584px;height:1012px;border-radius:64px;padding:32px}.scr{border-radius:34px}
    .glow{width:1500px;height:1500px;right:150px;top:-30px}`;
    dots = stickers(i * 17 + 3, 2560, 1440, 22, 50, 140, (x, y) => (x > 860 && y > 150 && y < 1290) || (x > 90 && x < 860 && y > 330 && y < 1100));
  } else if (fad === "acik") { // üstte başlık, altta kare açık katlanabilir
    lay = `.head{left:120px;right:120px;top:120px;text-align:center}
    .kick{font-size:34px;padding:16px 32px;margin-bottom:36px}h1{font-size:112px;letter-spacing:-3px}
    .dev{left:${(2160 - 1504) / 2}px;top:600px;width:1504px;height:1504px;border-radius:72px;padding:32px}.scr{border-radius:42px}
    .hinge{position:absolute;left:1079px;top:600px;width:2px;height:1504px;background:rgba(0,0,0,.08);z-index:2}
    .glow{width:1800px;height:1800px;left:180px;top:500px}`;
    dots = stickers(i * 17 + 5, 2160, 2160, 22, 60, 150, (x, y) => x > 250 && x < 1910 && y > 80);
  } else { // kapalı katlanabilir: dikey, telefon gibi
    lay = `html,body{}.head{left:80px;right:80px;top:120px;text-align:center}
    .kick{font-size:32px;padding:14px 28px;margin-bottom:34px}h1{font-size:100px;letter-spacing:-3px}
    .dev{left:${(1200 - 848) / 2}px;top:560px;width:848px;height:1336px;border-radius:72px;padding:24px}.scr{border-radius:52px}
    .glow{width:1000px;height:1000px;left:100px;top:760px}`;
    dots = stickers(i * 17 + 3, 1200, 1920, 16, 50, 130, (x) => x > 100 && x < 1080);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${ortak}${lay}</style></head><body>
  <div class="bg"></div><div class="dots">${dots}</div><div class="glow"></div>
  <div class="head"><div class="kick">${s.kicker}</div><h1>${s.title}</h1></div>
  <div class="dev"><div class="scr"><img src="${src}"></div></div>${fad === "acik" ? '<div class="hinge"></div>' : ""}
  </body></html>`;
}

const browser = await chromium.launch();
if (!process.argv.includes("--sadece-kompozisyon")) await hamCek(browser);
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [fad, F] of Object.entries(FORMLAR)) {
  mkdirSync(join(DIR, F.klasor), { recursive: true });
  await page.setViewportSize({ width: F.W, height: F.H });
  for (const id of F.sahneler) {
    const i = SHOTS.findIndex((x) => x.id === id);
    await page.setContent(html(fad, SHOTS[i], i), { waitUntil: "load" });
    await page.screenshot({ path: join(DIR, F.klasor, F.ad(SHOTS[i]) + ".png") });
  }
}
await browser.close();

// --- Kontrol: PNG, < 8 MB, kenarlar 960–3840 px ---
let hata = 0;
for (const k of ["tablet", "katlanabilir"]) for (const f of readdirSync(join(DIR, k)).sort()) {
  const p = join(DIR, k, f), b = readFileSync(p), mb = statSync(p).size / 1048576;
  const png = b.slice(1, 4).toString() === "PNG", w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const ok = png && mb < 8 && Math.min(w, h) >= 960 && Math.max(w, h) <= 3840;
  if (!ok) hata++;
  console.log(`${ok ? "OK  " : "HATA"} ${k}/${f}  ${w}×${h}  ${mb.toFixed(2)} MB`);
}
console.log(hata ? `${hata} dosya sınır dışında!` : "Tümü uygun.");
process.exitCode = hata ? 1 : 0;
