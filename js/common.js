/* =========================================================
   RUBIK ACADEMY — ORTAK JS (common.js)
   Tüm sayfalarda şu sırayla eklenir:

   <script>var PAGE_ID = "index";</script>
   <script src="/js/i18n.js"></script>
   <script src="/js/common.js"></script>

   Bu dosya şunları yönetir:
   - Ayarlar menüsü: karanlık mod (localStorage: "theme") ve
     renk körlüğü temaları (localStorage: "cvd-theme")
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
   AYARLAR: KARANLIK MOD + RENK KÖRLÜĞÜ TEMASI
   - Tema: localStorage "theme" (light | dark)
   - Renk körlüğü: localStorage "cvd-theme" ("" | rg | tri)
     Küp renkleri (CSS değişkenleri ve tüm SVG diyagramları) seçilen
     palete çevrilir. Paletler Machado (2009) renk körlüğü benzetimiyle
     seçildi: en zor ayrılan iki renk arasındaki OKLab farkı
     kırmızı-yeşil temada 4 → 14,6, mavi-sarı temada 6 → 19.
========================================= */
function setDarkMode(isDark) {
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("dark-mode", isDark);
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch (e) {}
    renderSettings();
}
function toggleDarkMode() { setDarkMode(!document.documentElement.classList.contains("dark-mode")); }

/* Sitede küp renkleri için kullanılan tonlar → renk ailesi */
var CVD_FAMILY = {
    "#e6252f": "R", "#e53935": "R", "#d12d28": "R", "#f0383a": "R", "#ef4444": "R",
    "#ff7a1a": "O", "#f97316": "O", "#fb8c00": "O", "#ff8a1f": "O",
    "#f6c719": "Y", "#ffd21f": "Y", "#fdd835": "Y", "#ffe600": "Y",
    "#179e4f": "G", "#12a04a": "G", "#16a34a": "G", "#16b364": "G", "#2ecc71": "G",
    "#1e6fe6": "B", "#1e6fe0": "B", "#2c6fe6": "B", "#1d5bff": "B", "#4f7dff": "B"
};
var CVD_PALETTES = {
    rg:  { R: "#f4390b", O: "#faa51e", Y: "#fcf765", G: "#17b1a5", B: "#0270e3" },
    tri: { R: "#9d0100", O: "#eb6014", Y: "#e2b716", G: "#4cf053", B: "#0587f7" }
};
var NORMAL_SWATCH = { W: "#eef2f3", Y: "#f6c719", R: "#d12d28", O: "#ff7a1a", G: "#179e4f", B: "#2c6fe6" };
function cvdTheme() { try { return localStorage.getItem("cvd-theme") || ""; } catch (e) { return ""; } }

/* Bir alt ağaçtaki SVG renklerini seçili palete çevir (orijinal renk data-cvdo'da saklanır) */
function cvdRecolor(root) {
    var pal = CVD_PALETTES[cvdTheme()] || null;
    if (!root || !root.querySelectorAll) return;
    var list = root.querySelectorAll("[fill], [data-cvdo]");
    var els = (root.hasAttribute && (root.hasAttribute("fill") || root.hasAttribute("data-cvdo"))) ? [root] : [];
    for (var i = 0; i < list.length; i++) els.push(list[i]);
    els.forEach(function (el) {
        var orig = el.getAttribute("data-cvdo") || el.getAttribute("fill");
        var fam = orig && CVD_FAMILY[orig.toLowerCase()];
        if (!fam) return;
        if (!el.hasAttribute("data-cvdo")) el.setAttribute("data-cvdo", orig);
        var want = pal ? pal[fam] : orig;
        if (el.getAttribute("fill") !== want) el.setAttribute("fill", want);
    });
}
var cvdObserver = null;
function applyCvd(theme) {
    try { if (theme) localStorage.setItem("cvd-theme", theme); else localStorage.removeItem("cvd-theme"); } catch (e) {}
    document.documentElement.setAttribute("data-cvd", theme || "");
    cvdRecolor(document.body);
    // Sonradan çizilen diyagramlar (antrenör, algoritma sayfaları) da çevrilsin
    if (theme && !cvdObserver && window.MutationObserver) {
        cvdObserver = new MutationObserver(function (muts) {
            if (!cvdTheme()) return;
            muts.forEach(function (m) {
                for (var i = 0; i < m.addedNodes.length; i++) if (m.addedNodes[i].nodeType === 1) cvdRecolor(m.addedNodes[i]);
            });
        });
        cvdObserver.observe(document.body, { childList: true, subtree: true });
    }
    renderSettings();
}

function settingsText(k) {
    var lang = "tr";
    try { lang = localStorage.getItem("site-lang") || "tr"; } catch (e) {}
    var c = (typeof SITE_I18N !== "undefined" && SITE_I18N.common) || {};
    return (c[lang] && c[lang][k]) || (c.tr && c.tr[k]) || k;
}
function swatches(pal) {
    var p = pal ? Object.assign({ W: NORMAL_SWATCH.W }, pal) : NORMAL_SWATCH;
    return '<span class="sm-sw" aria-hidden="true">' + ["W", "Y", "R", "O", "G", "B"].map(function (k) {
        return '<i style="background:' + p[k] + '"></i>';
    }).join("") + "</span>";
}
function renderSettings() {
    var menu = document.getElementById("settingsMenu");
    if (!menu) return;
    var dark = document.documentElement.classList.contains("dark-mode"), cvd = cvdTheme();
    var btn = document.getElementById("settingsBtn");
    if (btn) { btn.setAttribute("aria-label", settingsText("settings")); btn.title = settingsText("settings"); }
    menu.innerHTML =
        '<div class="sm-title">' + settingsText("settings") + '</div>' +
        '<div class="sm-label">' + settingsText("set_theme") + '</div>' +
        '<div class="sm-seg" role="group">' +
            '<button type="button" data-dark="0" class="' + (dark ? "" : "active") + '">' + settingsText("theme_light") + '</button>' +
            '<button type="button" data-dark="1" class="' + (dark ? "active" : "") + '">' + settingsText("theme_dark") + '</button>' +
        '</div>' +
        '<div class="sm-label">' + settingsText("set_cvd") + '</div>' +
        [["", "cvd_none", null], ["rg", "cvd_rg", CVD_PALETTES.rg], ["tri", "cvd_tri", CVD_PALETTES.tri]].map(function (o) {
            return '<button type="button" class="sm-opt' + (cvd === o[0] ? " active" : "") + '" data-cvd="' + o[0] + '" role="radio" aria-checked="' + (cvd === o[0]) + '">' +
                '<span class="sm-opt-text">' + settingsText(o[1]) + '</span>' + swatches(o[2]) + '</button>';
        }).join("") +
        '<p class="sm-note">' + settingsText("cvd_note") + '</p>';
}
function toggleSettings(e) {
    if (e) e.stopPropagation();
    var menu = document.getElementById("settingsMenu"), btn = document.getElementById("settingsBtn");
    if (!menu) return;
    if (typeof closeLangMenu === "function") closeLangMenu();
    renderSettings();
    var open = !menu.classList.contains("open");
    menu.classList.toggle("open", open);
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}
function closeSettings() {
    var menu = document.getElementById("settingsMenu"), btn = document.getElementById("settingsBtn");
    if (menu) menu.classList.remove("open");
    if (btn) btn.setAttribute("aria-expanded", "false");
}
document.addEventListener("click", function (e) {
    var sw = document.getElementById("settingsSwitcher");
    if (!sw) return;
    var b = e.target.closest && e.target.closest("#settingsMenu button");
    if (b) {
        e.stopPropagation();
        if (b.hasAttribute("data-dark")) setDarkMode(b.getAttribute("data-dark") === "1");
        else if (b.hasAttribute("data-cvd")) applyCvd(b.getAttribute("data-cvd"));
        return;
    }
    if (!sw.contains(e.target)) closeSettings();
});
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSettings(); });

document.addEventListener("DOMContentLoaded", function () {
    if (localStorage.getItem("theme") === "dark") {
        document.documentElement.classList.add("dark-mode");
        document.body.classList.add("dark-mode");
    }
    if (cvdTheme()) applyCvd(cvdTheme()); else renderSettings();
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
            el.textContent = d[key];
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
    if (typeof renderSettings === "function") renderSettings();

    /* Sayfaya özel ek işlem gerekiyorsa (örn. dinamik kartları
       yeniden çevirmek), sayfa kendi "onLanguageApplied" fonksiyonunu
       tanımlayabilir — burada varsa çağrılır. */
    if (typeof onLanguageApplied === "function") {
        onLanguageApplied(lang);
    }
}

function toggleLangMenu(e) {
    if (e) e.stopPropagation();
    var menu = document.getElementById("langMenu");
    var btn = document.getElementById("langSwitchBtn");
    if (!menu) return;
    var willOpen = !menu.classList.contains("open");
    if (willOpen && typeof closeSettings === "function") closeSettings();
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

/* Çevrimdışı kullanım ve "ana ekrana ekle" için service worker */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
}
