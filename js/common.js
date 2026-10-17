/* =========================================================
   RUBIK ACADEMY — ORTAK JS (common.js)
   Tüm sayfalarda şu sırayla eklenir:

   <script>var PAGE_ID = "index";</script>
   <script src="/js/i18n.js"></script>
   <script src="/js/common.js"></script>

   Bu dosya şunları yönetir:
   - Karanlık mod (localStorage: "theme")
   - Renk körlüğü temaları (localStorage: "cvd-theme", antrenörde sorulur)
   - Dil seçici motoru (localStorage: "site-lang")
   - Dil menüsünün otomatik oluşturulması (SITE_I18N.languages)
   - Scroll reveal (IntersectionObserver)

   NOT: Çeviri metinleri SITE_I18N (i18n.js) içinde,
   PAGE_ID ile sayfaya özel + common (nav/footer) birleştirilir.
   Yeni dil eklemek için sadece i18n.js düzenlenir.
========================================================= */

/* Sayfa render olmadan önce (flash önlemek için) tema class'ını uygula */
(function () {
    var savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark-mode");
    }
})();

/* =========================================
   KARANLIK MOD (sağ üstteki 🌙/☀️ düğmesi, localStorage "theme")
========================================= */
function toggleDarkMode() {
    var isDark = document.documentElement.classList.toggle("dark-mode");
    document.body.classList.toggle("dark-mode", isDark);
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch (e) {}
    var btn = document.getElementById("darkModeBtn");
    if (btn) btn.innerHTML = isDark ? "☀️" : "🌙";
}

/* =========================================
   RENK KÖRLÜĞÜ TEMASI (localStorage "cvd-theme": "" | pro | deu | rg | tri)
   Antrenöre ilk girişte sorulur; seçim tüm sitede geçerlidir.
   Küp renkleri (CSS değişkenleri ve tüm SVG diyagramları) seçilen
   palete çevrilir. Paletler Machado (2009) renk körlüğü benzetimiyle
   seçildi: en zor ayrılan iki renk arasındaki OKLab farkı
   kırmızı-yeşil temada 4 → 14,6, mavi-sarı temada 6 → 19.
========================================= */
/* Sitede küp renkleri için kullanılan tonlar → renk ailesi */
var CVD_FAMILY = {
    "#e6252f": "R", "#e53935": "R", "#d12d28": "R", "#f0383a": "R", "#ef4444": "R",
    "#ff7a1a": "O", "#f97316": "O", "#fb8c00": "O", "#ff8a1f": "O",
    "#f6c719": "Y", "#ffd21f": "Y", "#fdd835": "Y", "#ffe600": "Y",
    "#179e4f": "G", "#12a04a": "G", "#16a34a": "G", "#16b364": "G", "#2ecc71": "G",
    "#1e6fe6": "B", "#1e6fe0": "B", "#2c6fe6": "B", "#1d5bff": "B", "#4f7dff": "B",
    "#eef2f3": "W"
};
/* pro / deu: tek türe göre seçildi (Machado 2009 benzetimi, beyaz ve gri dahil en zor ayrılan
   iki renk arasındaki OKLab farkı: protanopi 4,1 → 15,6, döteranopi 5,5 → 17,9).
   rg: türünü bilmeyenler için ikisinde de dengeli (14,6 / 15,1). */
var CVD_PALETTES = {
    pro: { R: "#f45d73", O: "#ec9b01", Y: "#fefc0c", G: "#5bcbb0", B: "#7f9ef7" },
    deu: { R: "#b84109", O: "#f89b12", Y: "#fbfe17", G: "#3fb298", B: "#5369d3" },
    rg:  { R: "#f4390b", O: "#faa51e", Y: "#fcf765", G: "#17b1a5", B: "#0270e3" },
    tri: { R: "#9d0100", O: "#eb6014", Y: "#e2b716", G: "#4cf053", B: "#0587f7" }
};
var NORMAL_SWATCH = { W: "#eef2f3", Y: "#f6c719", R: "#d12d28", O: "#ff7a1a", G: "#179e4f", B: "#2c6fe6" };
function cvdTheme() { try { return localStorage.getItem("cvd-theme") || ""; } catch (e) { return ""; } }

/* Tutuş: bir sayfa window.RA_HOLD_SWAP = { Y: "W", W: "Y", ... } verirse diyagramlardaki küp renkleri
   bu eşlemeyle değiştirilir (ör. antrenörde beyaz üst tutuş). data-hold-skip içindekiler etkilenmez. */
function holdSwap() { return (window.RA_HOLD_SWAP && typeof window.RA_HOLD_SWAP === "object") ? window.RA_HOLD_SWAP : null; }
/* Bir alt ağaçtaki SVG renklerini seçili palete çevir (orijinal renk data-cvdo'da saklanır) */
function cvdRecolor(root) {
    var pal = CVD_PALETTES[cvdTheme()] || null, swap = holdSwap();
    if (!root || !root.querySelectorAll) return;
    var list = root.querySelectorAll("[fill], [data-cvdo]");
    var els = (root.hasAttribute && (root.hasAttribute("fill") || root.hasAttribute("data-cvdo"))) ? [root] : [];
    for (var i = 0; i < list.length; i++) els.push(list[i]);
    els.forEach(function (el) {
        var orig = el.getAttribute("data-cvdo") || el.getAttribute("fill");
        var fam = orig && CVD_FAMILY[orig.toLowerCase()];
        if (!fam) return;
        if (!el.hasAttribute("data-cvdo")) el.setAttribute("data-cvdo", orig);
        var f2 = (swap && swap[fam] && !el.closest("[data-hold-skip]")) ? swap[fam] : fam;
        var want = pal ? (pal[f2] || NORMAL_SWATCH[f2]) : (f2 === fam ? orig : NORMAL_SWATCH[f2]);
        if (el.getAttribute("fill") !== want) el.setAttribute("fill", want);
    });
}
var cvdObserver = null;
function applyCvd(theme) {
    try { if (theme) localStorage.setItem("cvd-theme", theme); else localStorage.removeItem("cvd-theme"); } catch (e) {}
    document.documentElement.setAttribute("data-cvd", theme || "");
    cvdRecolor(document.body);
    // Sonradan çizilen diyagramlar (antrenör, algoritma sayfaları) da çevrilsin
    if (theme) cvdWatch();
}
function cvdWatch() {
    if (!cvdObserver && window.MutationObserver && document.body) {
        cvdObserver = new MutationObserver(function (muts) {
            if (!cvdTheme() && !holdSwap()) return;
            muts.forEach(function (m) {
                for (var i = 0; i < m.addedNodes.length; i++) if (m.addedNodes[i].nodeType === 1) cvdRecolor(m.addedNodes[i]);
            });
        });
        cvdObserver.observe(document.body, { childList: true, subtree: true });
    }
}
/* Tutuş değişince (antrenör) tüm diyagramları yeniden renklendir */
function raRecolor() { cvdRecolor(document.body); if (cvdTheme() || holdSwap()) cvdWatch(); }
/* Renk önizlemesi (6 küçük kare) */
function cvdSwatches(theme) {
    var pal = CVD_PALETTES[theme];
    var p = pal ? Object.assign({ W: NORMAL_SWATCH.W }, pal) : NORMAL_SWATCH;
    return '<span class="cvd-sw" aria-hidden="true">' + ["W", "Y", "R", "O", "G", "B"].map(function (k) {
        return '<i style="background:' + p[k] + '"></i>';
    }).join("") + "</span>";
}

document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("darkModeBtn");
    if (localStorage.getItem("theme") === "dark") {
        document.documentElement.classList.add("dark-mode");
        document.body.classList.add("dark-mode");
        if (btn) btn.innerHTML = "☀️";
    } else if (btn) btn.innerHTML = "🌙";
    if (cvdTheme()) applyCvd(cvdTheme());
    else if (holdSwap()) raRecolor();
});

/* =========================================
   DİL SEÇİCİ
========================================= */

/* i18n.js içindeki dil listesi (yoksa boş obje) */
function getLanguages() {
    return (typeof SITE_I18N !== "undefined" && SITE_I18N.languages) || {};
}

/* Dil menüsünü SITE_I18N.languages listesinden oluşturur.
   Liste yoksa sayfadaki elle yazılmış butonlara dokunmaz. */
function buildLangMenu() {
    var menu = document.getElementById("langMenu");
    var langs = getLanguages();
    var codes = Object.keys(langs);
    if (!menu || codes.length === 0) return;

    menu.innerHTML = "";

    codes.forEach(function (code) {
        var btn = document.createElement("button");
        btn.className = "lang-menu-item";
        btn.setAttribute("data-lang", code);
        btn.setAttribute("role", "menuitem");
        btn.addEventListener("click", function () {
            selectLanguage(code);
        });

        var name = document.createElement("span");
        name.textContent = langs[code].name || code;

        var check = document.createElement("span");
        check.className = "lang-check";
        check.textContent = "✓";

        btn.appendChild(name);
        btn.appendChild(check);
        menu.appendChild(btn);
    });
}

function applyLanguage(lang) {
    if (typeof SITE_I18N === "undefined") {
        console.error("i18n.js yüklenmemiş — common.js'den ÖNCE eklenmeli.");
        return;
    }
    if (!SITE_I18N.common[lang]) {
        lang = "tr";
    }

    var commonDict = SITE_I18N.common[lang] || {};
    var pageId = typeof PAGE_ID !== "undefined" ? PAGE_ID : null;
    var pageDict = (pageId && SITE_I18N.pages[pageId] && SITE_I18N.pages[pageId][lang]) || {};

    /* Sayfaya özel anahtar varsa o kazanır, yoksa ortak (common) kullanılır */
    var dict = Object.assign({}, commonDict, pageDict);

    /* data-i18n-scope="sayfa" içindeki öğeler o sayfanın çevirisini kullanır
       (örn. antrenör sayfasındaki PLL tanıma ve cross sekmeleri) */
    var scoped = {};
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        var sc = el.closest("[data-i18n-scope]"), d = dict;
        if (sc) {
            var sid = sc.getAttribute("data-i18n-scope");
            if (!scoped[sid]) {
                var sp = SITE_I18N.pages[sid] || {};
                scoped[sid] = Object.assign({}, commonDict, sp.tr || {}, sp[lang] || {});
            }
            d = scoped[sid];
        }
        if (d && d[key]) {
            // data-i18n-html: çeviri metni <b>, <code> gibi etiketler içerir (i18n.js'deki sabit metinler)
            if (el.hasAttribute("data-i18n-html")) el.innerHTML = d[key];
            else el.textContent = d[key];
        }
    });

    var info = getLanguages()[lang];

    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", (info && info.dir) || "ltr");

    var label = document.getElementById("langLabel");
    if (label) {
        label.textContent = (info && info.code) || lang.toUpperCase();
    }

    document.querySelectorAll(".lang-menu-item").forEach(function (item) {
        item.classList.toggle("active", item.getAttribute("data-lang") === lang);
    });

    localStorage.setItem("site-lang", lang);

    /* Sayfaya özel ek işlem gerekiyorsa (örn. dinamik kartları
       yeniden çevirmek), sayfa kendi "onLanguageApplied" fonksiyonunu
       tanımlayabilir — burada varsa çağrılır. */
    if (typeof onLanguageApplied === "function") {
        onLanguageApplied(lang);
    }
    try { document.dispatchEvent(new CustomEvent("site-lang-change", { detail: lang })); } catch (e) {}
}

function toggleLangMenu(e) {
    if (e) e.stopPropagation();
    var menu = document.getElementById("langMenu");
    var btn = document.getElementById("langSwitchBtn");
    if (!menu) return;
    var willOpen = !menu.classList.contains("open");
    menu.classList.toggle("open", willOpen);
    if (btn) btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

function closeLangMenu() {
    var menu = document.getElementById("langMenu");
    var btn = document.getElementById("langSwitchBtn");
    if (menu) menu.classList.remove("open");
    if (btn) btn.setAttribute("aria-expanded", "false");
}

function selectLanguage(lang) {
    applyLanguage(lang);
    closeLangMenu();
}

document.addEventListener("click", function (e) {
    var switcher = document.getElementById("langSwitcher");
    if (switcher && !switcher.contains(e.target)) {
        closeLangMenu();
    }
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLangMenu();
});

document.addEventListener("DOMContentLoaded", function () {
    buildLangMenu(); /* önce menüyü oluştur, sonra dili uygula (active işareti için) */
    var savedLang = localStorage.getItem("site-lang") || "tr";
    applyLanguage(savedLang);
});

/* =========================================
   SCROLL REVEAL ANİMASYONU
========================================= */
document.addEventListener("DOMContentLoaded", function () {
    var observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("active");
                }
            });
        },
        { threshold: 0.15 }
    );

    document.querySelectorAll(".reveal").forEach(function (element) {
        observer.observe(element);
    });
});

/* Kaldırılan hesap sisteminden kalan kayıtlar */
try { ["ra-auth-v1", "ra-sync-meta-v1", "ra-data-owner-v1"].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}

/* Çevrimdışı kullanım ve "ana ekrana ekle" için service worker */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
}

/* =========================================================
   2-LOOK <-> TAM OLL/PLL İLERLEME SENKRONU
   2-Look OLL köşeleri (OCLL) ve 2-Look PLL kenarları, tam OLL/PLL'deki
   aynı case'lerle birebir aynıdır. Birinde "Öğreniyorum/Biliyorum"
   işaretlenince diğerinde de işaretlenir (işaret kaldırma dahil).
========================================================= */
(function () {
    "use strict";
    var RANK = { "": 0, learning: 1, known: 2 };
    // [2look-store, 2look-case, full-store, full-case]
    var SYNC = [
        ["algo-progress-2look-2lo", "Sune",       "algo-progress-oll", "OLL 27"],
        ["algo-progress-2look-2lo", "Antisune",   "algo-progress-oll", "OLL 26"],
        ["algo-progress-2look-2lo", "H",          "algo-progress-oll", "OLL 21"],
        ["algo-progress-2look-2lo", "Pi",         "algo-progress-oll", "OLL 22"],
        ["algo-progress-2look-2lo", "Headlights", "algo-progress-oll", "OLL 23"],
        ["algo-progress-2look-2lo", "T",          "algo-progress-oll", "OLL 24"],
        ["algo-progress-2look-2lo", "Bowtie",     "algo-progress-oll", "OLL 25"],
        ["algo-progress-2look-2lp", "Ua", "algo-progress-pll", "Edge perm::Ua perm"],
        ["algo-progress-2look-2lp", "Ub", "algo-progress-pll", "Edge perm::Ub perm"],
        ["algo-progress-2look-2lp", "H",  "algo-progress-pll", "Edge perm::H perm"],
        ["algo-progress-2look-2lp", "Z",  "algo-progress-pll", "Edge perm::Z perm"]
    ];
    var WATCH = {}, LOOK = {};
    SYNC.forEach(function (e) {
        WATCH[e[0]] = 1; WATCH[e[2]] = 1;
        LOOK[e[0] + "||" + e[1]] = [e[2], e[3]];
        LOOK[e[2] + "||" + e[3]] = [e[0], e[1]];
    });
    var _set, store;
    try { store = window.localStorage; _set = store.setItem.bind(store); } catch (e) { return; }
    function parse(k) { try { return JSON.parse(store.getItem(k)) || {}; } catch (e) { return {}; } }
    var syncing = false;
    store.setItem = function (k, v) {
        if (syncing || !WATCH[k]) return _set(k, v);
        var prev = parse(k);
        _set(k, v);
        var next; try { next = JSON.parse(v) || {}; } catch (e) { return; }
        syncing = true;
        try {
            var seen = {}, writes = {};
            Object.keys(prev).concat(Object.keys(next)).forEach(function (c) {
                if (seen[c]) return; seen[c] = 1;
                var pv = prev[c] || "", nv = next[c] || "";
                if (pv === nv) return;
                var t = LOOK[k + "||" + c]; if (!t) return;
                if (!writes[t[0]]) writes[t[0]] = parse(t[0]);
                if (nv) writes[t[0]][t[1]] = nv; else delete writes[t[0]][t[1]];
            });
            Object.keys(writes).forEach(function (ts) { _set(ts, JSON.stringify(writes[ts])); });
        } finally { syncing = false; }
    };
    // Tek seferlik uzlaştırma: mevcut işaretleri iki tarafta eşitle (yalnız yükseltir)
    try {
        var cache = {}, dirty = {};
        function get(s) { if (!(s in cache)) cache[s] = parse(s); return cache[s]; }
        SYNC.forEach(function (e) {
            var a = get(e[0]), b = get(e[2]), av = a[e[1]] || "", bv = b[e[3]] || "";
            if (av === bv) return;
            var hi = RANK[av] >= RANK[bv] ? av : bv;
            if (av !== hi) { if (hi) a[e[1]] = hi; else delete a[e[1]]; dirty[e[0]] = 1; }
            if (bv !== hi) { if (hi) b[e[3]] = hi; else delete b[e[3]]; dirty[e[2]] = 1; }
        });
        Object.keys(dirty).forEach(function (s) { _set(s, JSON.stringify(cache[s])); });
    } catch (e) {}
})();
