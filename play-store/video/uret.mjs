// Rubik Academy Google Play tanıtım videosunu üretir (1920×1080, 30 fps, H.264 + AAC).
// Çalıştır (repo kökünden): node play-store/video/uret.mjs [çıktı.mp4]
//   1) sunucu.py ile siteyi yerelde açar  2) kaydet.mjs ile gerçek ekranları kaydeder (KAYIT=0 ise atlar)
//   3) sahne.html'i kare kare çizer  4) muzik.py ile özgün müziği sentezler  5) ffmpeg ile MP4 yapar
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] || join(DIR, "klipler", "rubik-academy-tanitim.mp4"));
const PORT = 8765, FPS = 30;

const srv = spawn("python3", [join(DIR, "sunucu.py"), String(PORT)], { stdio: "ignore" });
process.on("exit", () => srv.kill());
await new Promise((r) => setTimeout(r, 800));
try {
  if (process.env.KAYIT !== "0" || !existsSync(join(DIR, "klipler", "pll")))
    execFileSync("node", [join(DIR, "kaydet.mjs")], { stdio: "inherit", env: { ...process.env, BASE: `http://127.0.0.1:${PORT}` } });
  const counts = {};
  for (const d of readdirSync(join(DIR, "klipler"), { withFileTypes: true })) if (d.isDirectory() && d.name !== "kareler") counts[d.name] = readdirSync(join(DIR, "klipler", d.name)).length;

  const KARE = join(DIR, "klipler", "kareler"); rmSync(KARE, { recursive: true, force: true }); mkdirSync(KARE, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/play-store/video/sahne.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const dur = await page.evaluate(() => window.DURATION), n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate(([t, c]) => window.render(t, c), [i / FPS, counts]);
    await page.screenshot({ path: join(KARE, String(i).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 95 });
    if (i % 150 === 0) console.log(`kare ${i}/${n}`);
  }
  const sinirlar = await page.evaluate(() => window.SINIRLAR || "4.5,9.5,14.5,20,24.5,29.5");
  await browser.close();

  const WAV = join(DIR, "klipler", "muzik.wav");
  execFileSync("python3", [join(DIR, "muzik.py"), String(dur), WAV, sinirlar], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(FPS), "-i", join(KARE, "%05d.jpg"), "-i", WAV,
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(FPS), "-g", "60",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", OUT], { stdio: "inherit" });
  console.log("hazır:", OUT);
} finally { srv.kill(); }
