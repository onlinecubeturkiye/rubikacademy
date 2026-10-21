/* Rubik Academy — sayfa paylaşım (Open Graph) görselleri üreticisi
   Standart (Aurora, koyu) temada 1200x630 PNG üretir; her sayfanın kendi çizimi var.
   Kullanım:  node tools/og/gen.mjs            (tümü)
              node tools/og/gen.mjs oll pll    (yalnız bunlar)
   Gerekenler: playwright (Chromium) — Inter ve Noto Color Emoji yazı tipleri kurulu olmalı. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) { pw = require("/opt/node-tools/node_modules/playwright"); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "og");
const LOGO = "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "RubikAcademyLogo.png")).toString("base64");

/* ---------- renkler ---------- */
const C = { W: "#f4f5f7", Y: "#f6c719", R: "#e8262c", O: "#ff7a1a", G: "#16a34a", B: "#2563eb", X: "#3a3f4f", K: "#14171c" };
const col = (ch) => C[ch] || ch;

/* ---------- çizimler (SVG) ---------- */
// İzometrik NxN küp: top/left/right yüzleri satır satır renk harfi dizisi (n*n)
function cubeIso(n, top, left, right, opt = {}) {
    const s = 300 / n / 1.73, cx = 200, cy = opt.cy || 70, g = opt.gap ?? 0.08;
    const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
    const iso = (i, j, face) => {
        // i: satır, j: sütun; birim vektörler
        let o, a, b;
        const ux = s * 1.732 / 2 * 1, uy = s / 2;
        if (face === "t") { o = [cx, cy]; a = [ux, uy]; b = [-ux, uy]; [i, j] = [i, j]; }
        if (face === "l") { o = [cx - n * ux, cy + n * uy]; a = [ux, uy]; b = [0, s]; }
        if (face === "r") { o = [cx, cy + n * s]; a = [ux, -uy]; b = [0, s]; o = [cx, cy + n * 2 * uy]; }
        let p0, A, B;
        if (face === "t") { p0 = [o[0] + j * a[0] + i * b[0], o[1] + j * a[1] + i * b[1]]; A = a; B = b; }
        if (face === "l") { p0 = [o[0] + j * a[0] + i * b[0], o[1] + j * a[1] + i * b[1]]; A = a; B = b; }
        if (face === "r") { p0 = [o[0] + j * a[0] + i * b[0], o[1] + j * a[1] + i * b[1]]; A = a; B = b; }
        const q = (u, v) => [p0[0] + u * A[0] + v * B[0], p0[1] + u * A[1] + v * B[1]];
        return [q(g, g), q(1 - g, g), q(1 - g, 1 - g), q(g, 1 - g)].map(p => P(p[0], p[1])).join(" ");
    };
    const ux = s * 1.732 / 2, uy = s / 2;
    const outline = [[cx, cy - 6], [cx + n * ux + 6, cy + n * uy - 3], [cx + n * ux + 6, cy + n * uy + n * s + 3], [cx, cy + 2 * n * uy + n * s + 6], [cx - n * ux - 6, cy + n * uy + n * s + 3], [cx - n * ux - 6, cy + n * uy - 3]];
    let h = `<polygon points="${outline.map(p => P(p[0], p[1])).join(" ")}" fill="${C.K}" stroke="${C.K}" stroke-width="10" stroke-linejoin="round"/>`;
    const face = (arr, f, extra = "") => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const c = arr[i * n + j]; h += `<polygon points="${iso(i, j, f)}" fill="${col(c)}" rx="4" ${extra}/>`; } };
    face(top, "t"); face(left, "l"); face(right, "r");
    return h + (opt.extra || "");
}
const rep = (ch, k) => Array(k).fill(ch).join("");
const solved3 = () => cubeIso(3, rep("Y", 9), rep("G", 9), rep("O", 9));

// Son katman diyagramı: üst 3x3 + 4 kenar şerit (her biri 3). top: 9 harf, sides: "BBB RRR GGG OOO" (arka, sağ, ön, sol)
function llDiagram(top, sides = "XXX XXX XXX XXX", arrows = "") {
    const S = 74, o = 89, g = 6, w = 16;
    let h = `<rect x="${o - 26}" y="${o - 26}" width="${3 * S + 52}" height="${3 * S + 52}" rx="22" fill="${C.K}"/>`;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) h += `<rect x="${o + j * S + g / 2}" y="${o + i * S + g / 2}" width="${S - g}" height="${S - g}" rx="9" fill="${col(top[i * 3 + j])}"/>`;
    const [bk, rt, fr, lf] = sides.split(" ");
    for (let k = 0; k < 3; k++) {
        h += `<rect x="${o + k * S + g / 2}" y="${o - w - 6}" width="${S - g}" height="${w}" rx="4" fill="${col(bk[k])}"/>`;
        h += `<rect x="${o + 3 * S + 6}" y="${o + k * S + g / 2}" width="${w}" height="${S - g}" rx="4" fill="${col(rt[k])}"/>`;
        h += `<rect x="${o + k * S + g / 2}" y="${o + 3 * S + 6}" width="${S - g}" height="${w}" rx="4" fill="${col(fr[k])}"/>`;
        h += `<rect x="${o - w - 6}" y="${o + k * S + g / 2}" width="${w}" height="${S - g}" rx="4" fill="${col(lf[k])}"/>`;
    }
    return `<g transform="translate(-26,-26) scale(1.13)">${h}${arrows}</g>`;
}
// 2x2 son katman
function ll2(top, sides = "XX XX XX XX") {
    const S = 100, o = 100, g = 8, w = 18;
    let h = `<rect x="${o - 28}" y="${o - 28}" width="${2 * S + 56}" height="${2 * S + 56}" rx="24" fill="${C.K}"/>`;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) h += `<rect x="${o + j * S + g / 2}" y="${o + i * S + g / 2}" width="${S - g}" height="${S - g}" rx="12" fill="${col(top[i * 2 + j])}"/>`;
    const [bk, rt, fr, lf] = sides.split(" ");
    for (let k = 0; k < 2; k++) {
        h += `<rect x="${o + k * S + g / 2}" y="${o - w - 6}" width="${S - g}" height="${w}" rx="5" fill="${col(bk[k])}"/>`;
        h += `<rect x="${o + 2 * S + 6}" y="${o + k * S + g / 2}" width="${w}" height="${S - g}" rx="5" fill="${col(rt[k])}"/>`;
        h += `<rect x="${o + k * S + g / 2}" y="${o + 2 * S + 6}" width="${S - g}" height="${w}" rx="5" fill="${col(fr[k])}"/>`;
        h += `<rect x="${o - w - 6}" y="${o + k * S + g / 2}" width="${w}" height="${S - g}" rx="5" fill="${col(lf[k])}"/>`;
    }
    return h;
}
const arrow = (x1, y1, x2, y2, c = "#111") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="9" stroke-linecap="round" marker-end="url(#ah)"/>`;
// NxN yüz (büyük küpler)
function faceGrid(n, colors) {
    const size = 280, o = 60, S = size / n, g = Math.max(3, 10 - n);
    let h = `<rect x="${o - 16}" y="${o - 16}" width="${size + 32}" height="${size + 32}" rx="24" fill="${C.K}"/>`;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) h += `<rect x="${o + j * S + g / 2}" y="${o + i * S + g / 2}" width="${S - g}" height="${S - g}" rx="${Math.max(3, 12 - n)}" fill="${col(colors ? colors(i, j) : "Y")}"/>`;
    return h;
}
// Pyraminx yüzü (9 üçgen)
function pyra() {
    const cx = 200, top = 52, side = 300, h = side * 0.866, r = 3, rows = [];
    let s = `<polygon points="${cx},${top - 14} ${cx + side / 2 + 16},${top + h + 8} ${cx - side / 2 - 16},${top + h + 8}" fill="${C.K}" stroke="${C.K}" stroke-width="10" stroke-linejoin="round"/>`;
    const fill = ["G", "G", "R", "G", "G", "G", "B", "G", "G"]; let k = 0;
    for (let i = 0; i < r; i++) for (let j = 0; j <= 2 * i; j++) {
        const up = j % 2 === 0, x0 = cx - (i * side / 3) / 2 + (j >> 1) * side / 3, y0 = top + i * h / 3, d = side / 3, e = 5;
        const pts = up ? [[x0, y0 + e * 1.4], [x0 + d / 2 - e, y0 + h / 3 - e * .6], [x0 - d / 2 + e, y0 + h / 3 - e * .6]]
            : [[x0 + e, y0 + e * .6], [x0 + d - e, y0 + e * .6], [x0 + d / 2, y0 + h / 3 - e * 1.4]];
        s += `<polygon points="${pts.map(p => p.join(",")).join(" ")}" fill="${col(fill[k++] || "G")}"/>`;
    }
    return s;
}
// Skewb yüzü: kare + ortada elmas
function skewb() {
    const o = 60, S = 280, m = 200;
    return `<rect x="${o - 14}" y="${o - 14}" width="${S + 28}" height="${S + 28}" rx="26" fill="${C.K}"/>` +
        [[o, o, "R"], [o + S, o, "B"], [o + S, o + S, "Y"], [o, o + S, "G"]].map(([x, y, c]) => {
            const dx = x === o ? 1 : -1, dy = y === o ? 1 : -1;
            return `<polygon points="${x + dx * 8},${y + dy * 8} ${x + dx * (S / 2 - 12)},${y + dy * 8} ${x + dx * 8},${y + dy * (S / 2 - 12)}" fill="${col(c)}"/>`;
        }).join("") + `<polygon points="${m},${o + 14} ${o + S - 14},${m} ${m},${o + S - 14} ${o + 14},${m}" fill="${C.W}"/>`;
}
// Megaminx yüzü: merkez beşgen + 5 kenar + 5 köşe parçası
function mega() {
    const cx = 200, cy = 210, R = 168;
    const V = (r, i) => { const a = (-90 + i * 72) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const O = [0, 1, 2, 3, 4].map(i => V(R, i)), I = [0, 1, 2, 3, 4].map(i => V(R * 0.46, i));
    const pts = (a) => a.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    let s = `<polygon points="${pts([0, 1, 2, 3, 4].map(i => V(R + 16, i)))}" fill="${C.K}" stroke="${C.K}" stroke-width="10" stroke-linejoin="round"/>`;
    const fill = ["#7c3aed", "#8b5cf6", "#7c3aed", "#8b5cf6", "#7c3aed"];
    for (let i = 0; i < 5; i++) {
        const n = (i + 1) % 5, pv = (i + 4) % 5;
        const a1 = lerp(O[i], O[n], 1 / 3), a2 = lerp(O[i], O[n], 2 / 3), b2 = lerp(O[pv], O[i], 2 / 3);
        s += `<polygon points="${pts([O[i], a1, I[i], b2])}" fill="${fill[i]}" stroke="${C.K}" stroke-width="7" stroke-linejoin="round"/>`; // köşe
        s += `<polygon points="${pts([a1, a2, I[n], I[i]])}" fill="#a78bfa" stroke="${C.K}" stroke-width="7" stroke-linejoin="round"/>`; // kenar
    }
    s += `<polygon points="${pts(I)}" fill="#c4b5fd" stroke="${C.K}" stroke-width="7" stroke-linejoin="round"/>`;
    return s;
}
// Square-1 üst yüzü: kare içinde 4 köşe (60°) + 4 kenar (30°)
function sq1() {
    const cx = 200, cy = 200, a = 150;
    const ray = (deg) => { const t = deg * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t), m = Math.max(Math.abs(c), Math.abs(sn)); return [cx + a * c / m, cy + a * sn / m]; };
    const pts = (arr) => arr.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    let s = `<rect x="${cx - a - 22}" y="${cy - a - 22}" width="${2 * a + 44}" height="${2 * a + 44}" rx="24" fill="${C.K}"/>`;
    const sideCol = ["R", "B", "O", "G"];
    for (let k = 0; k < 4; k++) {
        const m = k * 90; // kenar merkezi açısı (0: sağ)
        s += `<polygon points="${pts([[cx, cy], ray(m - 15), ray(m + 15)])}" fill="#ffd84d" stroke="${C.K}" stroke-width="7" stroke-linejoin="round"/>`;
        // kenarın yan rengi (dışta ince şerit)
        const e1 = ray(m - 15), e2 = ray(m + 15), nx = Math.round(Math.cos(m * Math.PI / 180)), ny = Math.round(Math.sin(m * Math.PI / 180));
        s += `<polygon points="${pts([[e1[0] + nx * 4, e1[1] + ny * 4], [e2[0] + nx * 4, e2[1] + ny * 4], [e2[0] + nx * 16, e2[1] + ny * 16], [e1[0] + nx * 16, e1[1] + ny * 16]])}" fill="${col(sideCol[k])}"/>`;
        s += `<polygon points="${pts([[cx, cy], ray(m + 15), ray(m + 45), ray(m + 75)])}" fill="${C.Y}" stroke="${C.K}" stroke-width="7" stroke-linejoin="round"/>`;
    }
    // yan renk şeritleri (kenarlarda ince)
    s += `<circle cx="${cx}" cy="${cy}" r="10" fill="${C.K}"/>`;
    return s;
}
// Clock
function clock() {
    let s = `<rect x="40" y="40" width="320" height="320" rx="160" fill="${C.K}"/><circle cx="200" cy="200" r="148" fill="#1e3a8a"/>`;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = 120 + j * 80, y = 120 + i * 80, ang = ((i * 3 + j) * 75) % 360;
        s += `<circle cx="${x}" cy="${y}" r="30" fill="#f4f5f7"/><line x1="${x}" y1="${y}" x2="${x + 20 * Math.sin(ang * Math.PI / 180)}" y2="${y - 20 * Math.cos(ang * Math.PI / 180)}" stroke="#e8262c" stroke-width="6" stroke-linecap="round"/>`;
    }
    return s;
}
// FTO (üçgen yüz, 9 parça)
function fto() { return pyra().replace(/fill="#16a34a"/g, `fill="#a855f7"`).replace(/fill="#e8262c"/g, `fill="#f4f5f7"`).replace(/fill="#2563eb"/g, `fill="#f6c719"`); }
// Emoji ya da kısa metin rozeti
const emoji = (e, size = 230) => `<text x="200" y="${215 + size * 0.05}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" font-family="Noto Color Emoji">${e}</text>`;
const bigText = (t, size = 120, c = "#eef0f7") => `<text x="200" y="210" font-size="${size}" font-weight="900" text-anchor="middle" dominant-baseline="middle" font-family="Inter" fill="${c}" letter-spacing="-3">${t}</text>`;
const withBadge = (main, e) => main + `<circle cx="318" cy="318" r="58" fill="#0b0d14" stroke="#6c5ce7" stroke-width="5"/><text x="318" y="323" font-size="62" text-anchor="middle" dominant-baseline="middle" font-family="Noto Color Emoji">${e}</text>`;

/* ---------- sayfalar ---------- */
const OLLtop = "XYXYYYXYX", PLLsides = "BGB RBR GRG OOO";
const PAGES = {
    "site": { k: "SPEEDCUBING AKADEMİSİ", t: "Küpü çöz.", t2: "Hızlan.", s: "Rehberler, 1.400+ algoritma, antrenörler ve her gün yeni bir karıştırma.", v: () => solved3() },
    "icerikler": { k: "EĞİTİM İÇERİKLERİ", t: "İçerikler", s: "Başlangıç rehberinden ZBLL'e, antrenörlerden ev yarışmasına her şey.", v: () => cubeIso(3, "YRGBYOWGB", "GGOGGBGRG", "OOWOOYOBO") },
    "algoritmalar": { k: "ALGORİTMALAR", t: "Algoritmalar", s: "OLL, PLL, F2L, ZBLL, 2x2, Pyraminx, Megaminx ve daha fazlası.", v: () => llDiagram("XYYYYYYYX", "XYX YXX XYX XXY") },
    "oll": { k: "3x3 · SON KATMAN", t: "OLL", t2: "57 vaka", s: "Son katmanın üst yüzünü tek adımda sarı yap.", v: () => llDiagram("YXYXYXYXY", "XYX XYX XYX XYX") },
    "pll": { k: "3x3 · SON KATMAN", t: "PLL", t2: "21 vaka", s: "Son katmanın parçalarını tek adımda yerine koy.", v: () => llDiagram(rep("Y", 9), "BBB RGR GRG OOO", arrow(170, 150, 170, 275) + arrow(255, 270, 255, 140)) },
    "2look-oll": { k: "3x3 · BAŞLANGIÇ", t: "2-Look OLL", s: "Önce sarı artı, sonra köşeler: 10 algoritma.", v: () => llDiagram("XYXYYYXYX", "XXY XYX YXX XYX") },
    "2look-pll": { k: "3x3 · BAŞLANGIÇ", t: "2-Look PLL", s: "Önce köşeler, sonra kenarlar: 6 algoritma.", v: () => llDiagram(rep("Y", 9), "BBB RRR GOG OGO", arrow(130, 195, 300, 195)) },
    "coll": { k: "3x3 · İLERİ", t: "COLL", t2: "42 vaka", s: "Kenarlar yönlüyken köşeleri tek adımda çöz.", v: () => llDiagram("XYXYYYYYX", "YXB RXR XGY OXO") },
    "wv": { k: "3x3 · İLERİ", t: "Winter Variation", t2: "27 vaka", s: "Son F2L çiftiyle köşeleri yönlendir, OLL'yi atla.", v: () => cubeIso(3, "XYXYYYXYY", "GGGGGGGGG", "OOOOOOOOO") },
    "zbll": { k: "3x3 · İLERİ", t: "ZBLL", t2: "472 vaka", s: "Kenarlar yönlüyken son katmanı tek algoritmada bitir.", v: () => llDiagram(rep("Y", 9).replace(/^Y/, "X").replace(/Y$/, "X"), "YBO RRG BGY OOB") },
    "cll": { k: "2x2", t: "CLL", t2: "42 vaka", s: "İlk katmandan sonra 2x2'yi tek adımda bitir.", v: () => ll2("YXXY", "XY RX YB XO") },
    "eg1": { k: "2x2 · İLERİ", t: "EG-1", t2: "42 vaka", s: "Altta komşu köşe değişimiyle tek adımda bitir.", v: () => ll2("XYYX", "YX BX XR GY") },
    "eg2": { k: "2x2 · İLERİ", t: "EG-2", t2: "42 vaka", s: "Altta çapraz köşe değişimiyle tek adımda bitir.", v: () => ll2("YXYX", "XB YR XY OX") },
    "ortega-oll": { k: "2x2 · ORTEGA", t: "Ortega OLL", t2: "7 vaka", s: "2x2'nin üst yüzünü tek adımda yönlendir.", v: () => ll2("YXXX", "XY XY YX XX") },
    "ortega-pbl": { k: "2x2 · ORTEGA", t: "Ortega PBL", t2: "5 vaka", s: "İki katmanı birlikte yerleştir: 2x2 tamam.", v: () => ll2("YYYY", "BG RO GB OR") },
    "4x4": { k: "4x4", t: "4x4 Algoritmaları", s: "OLL ve PLL parity: 3x3 gibi çözerken çıkan iki durum.", v: () => faceGrid(4, (i, j) => (i === 0 && (j === 1 || j === 2)) ? "B" : "Y") },
    "4x4-parity": { k: "4x4 · PARITY", t: "4x4 Parity", s: "OLL ve PLL parity algoritmaları ve tanıma.", v: () => faceGrid(4, (i, j) => (i === 0 && (j === 1 || j === 2)) ? "X" : "Y") },
    "5x5": { k: "5x5", t: "5x5 Algoritmaları", s: "Son kenarda kanatlar ters kaldığında: kenar parity.", v: () => faceGrid(5, (i, j) => (i === 0 && j === 2) ? "R" : "Y") },
    "3bld": { k: "GÖZÜ KAPALI", t: "3BLD", s: "Harf sistemi, M2 ve Old Pochmann ile göz bağlı çözüm.", v: () => withBadge(cubeIso(3, rep("Y", 9), rep("G", 9), rep("O", 9)) + ["A", "B", "C", "D"].map((L, i) => `<text x="${[200, 262, 200, 138][i]}" y="${[95, 128, 165, 128][i]}" font-family="Inter" font-weight="900" font-size="30" text-anchor="middle" dominant-baseline="middle" fill="#14171c">${L}</text>`).join(""), "🙈") },
    "megaminx": { k: "MEGAMINX", t: "Megaminx", t2: "2-Look OLL / PLL", s: "Yıldız, köşe yönü, kenarlar ve köşeler: 37 algoritma.", v: () => mega() },
    "pyraminx": { k: "PYRAMINX", t: "Pyraminx", s: "L3E ve L4E: son kenarları tek algoritmada çöz.", v: () => pyra() },
    "skewb": { k: "SKEWB", t: "Skewb", s: "Sarah Beginner, Intermediate ve Advanced: 165 algoritma.", v: () => skewb() },
    "square1": { k: "SQUARE-1", t: "Square-1", s: "Cubeshape, köşe/kenar yönü ve yerleştirme: 154 algoritma.", v: () => sq1() },
    "roux": { k: "3x3 · ROUX", t: "Roux", s: "Bloklar, CMLL ve son 6 kenar (EO, UL/UR, 4c).", v: () => cubeIso(3, "XXXXXXXXX", "GGGXXXGGG", "OXOOXOOXO") },
    "tek-el": { k: "TEK EL (OH)", t: "Tek El Algoritmaları", s: "Tek elle rahat çevrilen OLL, PLL ve CMLL.", v: () => withBadge(solved3(), "✋") },
    "yazdir": { k: "YAZDIR", t: "Algoritma Kağıtları", s: "OLL, PLL, CLL ve daha fazlasını yazdırılabilir kağıt olarak al.", v: () => emoji("🖨️") },
    "antrenor": { k: "ANTRENÖR", t: "Algoritma Antrenörü", s: "Karıştırmayı uygula, süreni ölç; zorlandığın vakalar daha sık gelsin.", v: () => withBadge(llDiagram("YXYXYXYXY", "XYX XYX XYX XYX"), "🎯") },
    "akilli-kup": { k: "BLUETOOTH", t: "Çözüm Analizi", s: "Bluetooth küpünü bağla; Cross, F2L, OLL ve PLL sürelerini gör.", v: () => withBadge(cubeIso(3, "YRGBYOWGB", "GGOGGBGRG", "OOWOOYOBO"), "📶") },
    "baslangic": { k: "BAŞLANGIÇ REHBERİ", t: "Küp Nasıl Çözülür?", s: "7 adım ve sadece 6 algoritmayla 3x3'ü baştan sona çöz.", v: () => cubeIso(3, "WWWWWWWWW", "GGGGGGXXX", "RRRRRRXXX") },
    "cozucu": { k: "ÇÖZÜCÜ", t: "Küp Çözücü", s: "Renkleri gir ya da kamerayla tara; çözümü adım adım gör.", v: () => withBadge(cubeIso(3, "YRGBYOWGB", "GGOGGBGRG", "OOWOOYOBO"), "📷") },
    "duello": { k: "BLUETOOTH · 1v1", t: "Akıllı Küp", t2: "Düellosu", s: "Arkadaşınla aynı karıştırmayı çöz: mo3, ao5 ya da ao12, canlı sonuç.", v: () => emoji("⚔️") },
    "ev-yarismasi": { k: "CANLI YAYIN YARIŞMASI", t: "Ev Yarışması", s: "8-16 kişilik canlı yarışma: aynı karıştırma, canlı sıralama, final turu.", v: () => emoji("🏆") },
    "f2l": { k: "3x3 · F2L", t: "Sezgisel F2L", s: "Köşe-kenar çiftlerini birlikte yerleştir: ilk iki katman.", v: () => cubeIso(3, "XXXXXXXXX", "XXXGGGGGG", "XXXOOOOOO") },
    "gunluk": { k: "HER GÜN", t: "Günün Karıştırması", s: "Herkes aynı karıştırmayı çözer; süreni gir, sıralamada yerini al.", v: () => emoji("📅") },
    "keyhole": { k: "3x3 · F2L", t: "Keyhole Yöntemi", s: "Boş yuvayı kullanarak F2L çiftlerini kolayca yerleştir.", v: () => cubeIso(3, "XXXXXXXXX", "XXXGGXGGX", "XXXXOOXOO") },
    "kocluklar": { k: "BİREBİR", t: "Koçluklar", s: "Uzman koçlarla 2x2, 3x3, tek el, Skewb ve Megaminx dersleri.", v: () => emoji("🎓") },
    "kup-rehberi": { k: "REHBER", t: "Küp Seçme ve Bakım", s: "Hangi küpü almalı, nasıl yağlanır ve ayarlanır?", v: () => withBadge(solved3(), "🛠️") },
    "profil": { k: "HESAP", t: "Profilim", s: "İlerlemen her cihazda: bildiğin algoritmalar, antrenör ve günlük sonuçlar.", v: () => emoji("👤") },
    "sanal-kup": { k: "SANAL KÜP", t: "Sanal 3D Küp", s: "Küpün yanında değil mi? Tarayıcıda klavye ya da dokunarak çöz.", v: () => withBadge(cubeIso(3, "YRGBYOWGB", "GGOGGBGRG", "OOWOOYOBO"), "🕹️") },
    "sozluk": { k: "SÖZLÜK", t: "Küp Sözlüğü", s: "Speedcubing terimleri ve notasyon tek yerde.", v: () => emoji("📖") },
    "sss": { k: "YARDIM", t: "Sıkça Sorulan Sorular", s: "Rubik Academy ve küp çözme hakkında merak edilenler.", v: () => emoji("❓") },
    "videolar": { k: "VİDEOLAR", t: "Video Eğitimleri", s: "2x2'den 7x7'ye, Clock'tan FTO'ya video anlatımlar.", v: () => withBadge(solved3(), "▶️") },
    "v-2x2": { k: "VİDEO · 2x2", t: "2x2 Eğitimi", s: "2x2'yi adım adım video ile öğren.", v: () => cubeIso(2, "YYYY", "GGGG", "OOOO") },
    "v-3x3": { k: "VİDEO · 3x3", t: "3x3 ve CFOP", s: "Başlangıçtan CFOP'a 3x3 video eğitimi.", v: () => solved3() },
    "v-3x3onehand": { k: "VİDEO · TEK EL", t: "Tek El Eğitimi", s: "3x3'ü tek elle çözmeyi video ile öğren.", v: () => withBadge(solved3(), "✋") },
    "v-4x4": { k: "VİDEO · 4x4", t: "4x4 Eğitimi", s: "Merkezler, kenar eşleme ve parity.", v: () => cubeIso(4, rep("Y", 16), rep("G", 16), rep("O", 16)) },
    "v-5x5": { k: "VİDEO · 5x5", t: "5x5 Eğitimi", s: "Merkezler, kenarlar ve 3x3 aşaması.", v: () => cubeIso(5, rep("Y", 25), rep("G", 25), rep("O", 25)) },
    "v-6x6": { k: "VİDEO · 6x6", t: "6x6 Eğitimi", s: "Büyük küplerde merkez ve kenar teknikleri.", v: () => cubeIso(6, rep("Y", 36), rep("G", 36), rep("O", 36), { gap: .1 }) },
    "v-7x7": { k: "VİDEO · 7x7", t: "7x7 Eğitimi", s: "En büyük WCA küpünü adım adım çöz.", v: () => cubeIso(7, rep("Y", 49), rep("G", 49), rep("O", 49), { gap: .1 }) },
    "v-clock": { k: "VİDEO · CLOCK", t: "Clock Eğitimi", s: "Rubik's Clock'u video ile öğren.", v: () => clock() },
    "v-fto": { k: "VİDEO · FTO", t: "FTO Eğitimi", s: "Face-Turning Octahedron video eğitimi.", v: () => fto() },
    "v-megaminx": { k: "VİDEO · MEGAMINX", t: "Megaminx Eğitimi", s: "12 yüzlü bulmacayı adım adım çöz.", v: () => mega() },
    "v-pyraminx": { k: "VİDEO · PYRAMINX", t: "Pyraminx Eğitimi", s: "Pyraminx'i video ile öğren.", v: () => pyra() },
    "v-skewb": { k: "VİDEO · SKEWB", t: "Skewb Eğitimi", s: "Skewb'i video ile öğren.", v: () => skewb() },
    "v-square1": { k: "VİDEO · SQUARE-1", t: "Square-1 Eğitimi", s: "Square-1'i video ile öğren.", v: () => sq1() },
    "fto-bencisco": { k: "FTO", t: "Bencisco Metodu", s: "FTO için adım adım Bencisco yöntemi.", v: () => fto() },
    "fto-notasyon": { k: "FTO", t: "FTO Notasyonu", s: "FTO hamleleri ve rotasyonları.", v: () => fto() },
    "yol-haritasi": { k: "ÖĞRENME YOLU", t: "Yol Haritası", s: "Küpünü seç, adımları sırayla takip et, ilerlemeni gör.", v: () => emoji("🗺️") },
    "zkttimer": { k: "ZAMANLAYICI", t: "ZKT Timer", s: "Rubik Academy ZKT zamanlayıcısı.", v: () => bigText("12.34", 112) },
    "404": { k: "HATA", t: "Sayfa bulunamadı", s: "Aradığın sayfa taşınmış ya da hiç olmamış olabilir.", v: () => bigText("404", 150, "#9a8cff") },
    "yakinda": { k: "YAKINDA", t: "Çok yakında", s: "Bu içerik hazırlanıyor.", v: () => emoji("⏳") },
    "gizlilik": { k: "GİZLİLİK", t: "Gizlilik", s: "Hangi verileri neden tuttuğumuz ve nasıl silebileceğin.", v: () => emoji("🔒") },
    "ayarlar": { k: "AYARLAR", t: "Ayarlar", s: "Tema, dil, renk körlüğü paleti ve hesap ayarları.", v: () => emoji("⚙️") },
    "giris": { k: "HESAP", t: "Giriş yap", s: "Google ya da e-posta ile giriş yap; ilerlemen her cihazda.", v: () => emoji("🔑") }
};

function html(p) {
    const title = p.t2 ? `${p.t}<br><span class="g">${p.t2}</span>` : p.t;
    const tl = (p.t + (p.t2 || "")).length;
    const ts = tl > 26 ? 66 : tl > 18 ? 76 : 88;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:Inter,"Noto Color Emoji",sans-serif;background:#0b0d14;color:#eef0f7;position:relative}
.bg{position:absolute;inset:0;background:radial-gradient(620px 420px at 86% 30%,rgba(108,92,231,.42),transparent 70%),radial-gradient(520px 360px at 6% 100%,rgba(236,72,153,.22),transparent 70%),radial-gradient(400px 300px at 50% -10%,rgba(124,108,255,.18),transparent 70%)}
.dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.06) 1.2px,transparent 1.3px);background-size:26px 26px;mask-image:linear-gradient(90deg,#000 0,transparent 70%)}
.wrap{position:absolute;inset:0;display:flex;align-items:center;padding:0 70px 0 80px;gap:40px}
.l{flex:1;min-width:0}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:27px;letter-spacing:-.3px}
.brand img{width:52px;height:52px;border-radius:14px;background:#151826;padding:6px}
.k{display:inline-block;margin-top:44px;padding:8px 16px;border-radius:999px;background:rgba(108,92,231,.18);border:1.5px solid rgba(154,140,255,.45);color:#b8adff;font-weight:800;font-size:19px;letter-spacing:1.6px}
h1{margin-top:20px;font-size:${ts}px;line-height:1.02;font-weight:900;letter-spacing:-2.5px}
h1 .g{background:linear-gradient(90deg,#9a8cff,#ec4899);-webkit-background-clip:text;color:transparent}
p{margin-top:20px;font-size:26px;line-height:1.4;color:#a4aabe;max-width:620px}
.url{position:absolute;left:80px;bottom:46px;font-weight:800;font-size:22px;color:#cfd3e4}
.card{width:420px;height:420px;border-radius:44px;background:linear-gradient(160deg,#171a29,#10121c);border:2px solid rgba(255,255,255,.08);box-shadow:0 40px 80px -30px rgba(0,0,0,.8),0 0 0 1px rgba(108,92,231,.15) inset;display:grid;place-items:center;flex:none}
.card svg{width:380px;height:380px}
.bar{position:absolute;left:0;right:0;bottom:0;height:9px;background:linear-gradient(90deg,#6c5ce7,#9a8cff 45%,#ec4899)}
</style></head><body><div class="bg"></div><div class="dots"></div>
<div class="wrap"><div class="l"><div class="brand"><img src="${LOGO}">Rubik Academy</div><div class="k">${p.k}</div><h1>${title}</h1><p>${p.s}</p></div>
<div class="card"><svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#111"/></marker></defs>${p.v()}</svg></div></div>
<div class="url">rubikacademy.fun</div><div class="bar"></div></body></html>`;
}

const only = process.argv.slice(2);
const b = await pw.chromium.launch(fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const [slug, p] of Object.entries(PAGES)) {
    if (only.length && !only.includes(slug)) continue;
    await pg.setContent(html(p), { waitUntil: "load" });
    await pg.waitForTimeout(80);
    await pg.screenshot({ path: path.join(OUT, slug + ".png") });
    console.log("✓", slug);
}
await b.close();
