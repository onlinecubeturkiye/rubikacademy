// Gerçek uygulama ekranlarını (açık tema, ?source=app, 360×640 @3x) kaydeder.
// Her klip: CDP screencast kareleri -> klipler/<ad>/NNNN.jpg (30 fps'e yeniden örneklenmiş).
// Rekor tablosu Firestore yanıtı hayali adlarla taklit edilir (gerçek kullanıcı adı yok).
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const DIR = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://127.0.0.1:8765";
const FPS = 30;

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

// Dokunma göstergesi + yumuşak kaydırma yardımcıları (sayfaya enjekte edilir)
const INIT = () => {
  try { localStorage.setItem("theme", "light"); localStorage.setItem("site-lang", "tr"); } catch (e) {}
  window.__tap = (x, y) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(124,92,255,.35);border:2px solid rgba(124,92,255,.85);z-index:2147483647;pointer-events:none;transform:scale(.4);opacity:1;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .55s ease .15s`;
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = "scale(1.25)"; d.style.opacity = "0"; }));
    setTimeout(() => d.remove(), 900);
  };
  window.__scroll = (to, ms, el) => new Promise((res) => {
    const sc = el ? document.querySelector(el) : document.scrollingElement;
    const from = sc.scrollTop, t0 = performance.now();
    const step = (now) => { const p = Math.min(1, (now - t0) / ms), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      sc.scrollTop = from + (to - from) * e; p < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });
};

async function klip(browser, ad, url, { hazirla, oyna, uye, css }) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "tr-TR" });
  await ctx.addInitScript(INIT);
  await ctx.route(/googletagmanager|google-analytics/, (r) => r.abort());
  await ctx.route(/firestore\.googleapis\.com.*:runQuery/, sahteRekor);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [" + ad + "] hata:", e.message.slice(0, 120)));
  const u = BASE + url + (url.includes("?") ? "&" : "?") + "source=app";
  for (let i = 0; i < 4; i++) { // Firestore/ağ bazen 429 verir: yeniden dene
    const r = await page.goto(u, { waitUntil: "networkidle", timeout: 45000 }).catch(() => null);
    if (r && r.ok()) break;
    await page.waitForTimeout(1500 * (i + 1));
  }
  if (uye) await page.evaluate(() => { // üyeye açık sayfanın görünümü (giriş bilgisi kullanılmaz)
    if (window.Account) { Account.user = () => ({ uid: "demo", displayName: "Deniz Kaya" }); }
    document.querySelectorAll(".ra-lock").forEach((x) => x.remove()); document.documentElement.classList.remove("ra-locked");
  });
  await page.addStyleTag({ content: "::-webkit-scrollbar{display:none}*{scrollbar-width:none}" + (css || "") });
  await page.waitForTimeout(900);
  if (hazirla) await hazirla(page);
  await page.waitForTimeout(600);

  const out = join(DIR, "klipler", ad); rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => { frames.push({ t: f.metadata.timestamp, d: f.data }); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const tap = async (sel, opt = {}) => {
    const el = typeof sel === "string" ? page.locator(sel).first() : sel;
    if (!opt.noScroll) await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    const b = await el.boundingBox({ timeout: 3000 }).catch(() => null);
    if (!b) { console.log("  [" + ad + "] yok:", sel); return; }
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.evaluate(([x, y]) => window.__tap(x, y), [x, y]);
    await page.waitForTimeout(160);
    if (opt.js) await el.evaluate((e) => e.click()); else await page.touchscreen.tap(x, y);
  };
  const scroll = (to, ms = 1200, el) => page.evaluate(([a, b, c]) => window.__scroll(a, b, c), [to, ms, el]);
  // Dokunarak sürükleme (CDP dokunma olayları)
  const drag = async (x0, y0, x1, y1, ms = 700) => {
    await page.evaluate(([x, y]) => window.__tap(x, y), [x0, y0]);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
    const n = Math.round(ms / 16);
    for (let i = 1; i <= n; i++) { const p = i / n, e = p * p * (3 - 2 * p);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e }] }); await page.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await oyna({ page, tap, scroll, drag, wait: (ms) => page.waitForTimeout(ms) });
  const t1 = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await ctx.close();
  // 30 fps'e yeniden örnekle (her an için o ana kadarki son kare)
  frames.sort((a, b) => a.t - b.t);
  const n = Math.round((t1 - t0) * FPS); let j = 0;
  for (let i = 0; i < n; i++) {
    const tt = t0 + i / FPS;
    while (j + 1 < frames.length && frames[j + 1].t <= tt) j++;
    writeFileSync(join(out, String(i).padStart(4, "0") + ".jpg"), Buffer.from(frames[j].d, "base64"));
  }
  console.log(`${ad}: ${n} kare (${frames.length} ham)`);
}

// Not: Bluetooth/akıllı küp öğeleri uygulamada çalışmadığı için kayıtta gizlenir; ana sayfada o kartlara kaydırılmaz.
const GIZLE = "#btToggle,.bt-wrap,[data-bt]{display:none!important}";
const KLIPLER = {
  "ana-sayfa": ["/", { oyna: async ({ wait, scroll }) => { await wait(2200); await scroll(110, 1400); await wait(1200); } }],
  "pll": ["/icerikler/algoritmalar/pll", { oyna: async ({ wait, scroll, tap }) => {
    await wait(400); await scroll(330, 1000); await wait(300);
    await tap(".alg-more"); await wait(450); await tap(".alg-menu-pop:not([hidden]) .alg-play-btn"); await wait(4600);
  } }],
  "antrenor": ["/icerikler/algoritmalar/antrenor", { uye: true, css: GIZLE, oyna: async ({ wait, tap, scroll, page }) => {
    await wait(500); await tap(".set-tab:text-is('PLL')", { noScroll: true }); await wait(700);
    await scroll(430, 1000); await wait(500);
    await tap("#timerArea", { noScroll: true }); await wait(1900);
    await tap("#timerArea", { noScroll: true }); await wait(1500);
  } }],
  "ev-yarismasi": ["/icerikler/ev-yarismasi", { oyna: async ({ wait, tap, page }) => {
    await wait(500); await tap("input", { noScroll: true }); await wait(200);
    for (const c of "48213") { await page.keyboard.type(c); await wait(170); } await wait(700);
  } }],
  "rekorlar": ["/icerikler/rekorlar", { oyna: async ({ wait, tap }) => {
    await wait(1200); await tap("[data-k=a5]"); await wait(1200); await tap("[data-ev='222']"); await wait(1300);
  } }],
  "yol-haritasi": ["/icerikler/yol-haritasi", { oyna: async ({ wait, scroll }) => { await wait(700); await scroll(420, 1400); await wait(500); await scroll(880, 1300); await wait(700); } }],
  "sanal-kup": ["/icerikler/sanal-kup", { oyna: async ({ wait, tap, scroll, drag }) => {
    await wait(300); await scroll(140, 700); await wait(250);
    await tap("#vcScramble", { noScroll: true }); await wait(900);
    await drag(250, 300, 110, 330, 900); await wait(300);
    await drag(120, 260, 260, 250, 900); await wait(300); await drag(180, 330, 190, 180, 800); await wait(400);
    await wait(500);
  } }],
};
const sec = process.argv.slice(2);
const browser = await chromium.launch();
for (const [ad, [url, o]] of Object.entries(KLIPLER)) if (!sec.length || sec.includes(ad)) await klip(browser, ad, url, o);
await browser.close();
