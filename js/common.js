/* =========================================================
   RUBIK ACADEMY — ORTAK JS (common.js)
   Tüm sayfalarda şu sırayla eklenir:

   <script>var PAGE_ID = "index";</script>
   <script src="/js/i18n.js"></script>
   <script src="/js/common.js"></script>

   Bu dosya şunları yönetir:
   - Karanlık mod (localStorage: "theme")
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
   KARANLIK MOD
========================================= */
function toggleDarkMode() {
    var isDark = document.documentElement.classList.toggle("dark-mode");
    document.body.classList.toggle("dark-mode", isDark);

    var btn = document.getElementById("darkModeBtn");

    if (isDark) {
        localStorage.setItem("theme", "dark");
        if (btn) btn.innerHTML = "☀️";
    } else {
        localStorage.setItem("theme", "light");
        if (btn) btn.innerHTML = "🌙";
    }
}

document.addEventListener("DOMContentLoaded", function () {
    var savedTheme = localStorage.getItem("theme");
    var btn = document.getElementById("darkModeBtn");

    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark-mode");
        document.body.classList.add("dark-mode");
        if (btn) btn.innerHTML = "☀️";
    } else if (btn) {
        btn.innerHTML = "🌙";
    }
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

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        if (dict && dict[key]) {
            el.textContent = dict[key];
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
