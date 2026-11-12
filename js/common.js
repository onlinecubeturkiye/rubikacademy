/* =========================================================
   KİŞİSEL VERİ YALNIZ HESAPTA (her şeyden önce çalışır)
   - Algoritma ilerlemesi, antrenör geçmişi, yol haritası, çözüm geçmişleri, günlük sonuçlar,
     kendi algoritmaların: giriş yapılmamışsa cihaza yazılmaz, yalnız sayfa açıkken bellekte durur
     (yenileyince / çıkınca sıfırlanır). Giriş yapılınca hesapla senkronlanır.
   - Hesaptan çıkınca ya da bu cihazda oturum yokken cihazda kalan kişisel veri silinir.
   - Tema, dil, renk körlüğü, tutuş gibi tercihler herkes için saklanır.
========================================================= */
/* =========================================================
   UYGULAMA MODU (Android uygulaması / ana ekrana eklenmiş site)
   Algılama: ?source=twa|pwa, android-app:// yönlendireni ya da display-mode: standalone → oturum boyunca hatırlanır.
   html.ra-app: altta uygulama sekme çubuğu (Ana Sayfa · İçerikler · Antrenör · Yarışma · Profil),
   üst menü ve alt bilgi sadeleşir, "uygulama olarak yükle" gibi tarayıcı öğeleri gizlenir, güvenli alan boşluğu.
   Zamanlayıcı / antrenör / yarışma odası / yayın ekranı gibi tam ekran sayfalarda sekme çubuğu çıkmaz.
========================================================= */
(function () {
    var on = false;
    try {
        var q = /[?&]source=(twa|pwa)\b/.test(location.search), ref = /^android-app:\/\//.test(document.referrer || "");
        var sa = window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches) || navigator.standalone === true;
        if (q || ref || sa) sessionStorage.setItem("ra-app", "1");
        on = sessionStorage.getItem("ra-app") === "1";
    } catch (e) {}
    window.RA_APP = on;
    if (!on) return;
    var d = document.documentElement; d.classList.add("ra-app");
    var path = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
    var noBar = /\/(zkttimer|sanal-kup|tekrar|ev-yayin|admin|giris|yakinda)$|\/algoritmalar\/(antrenor|yazdir)|\/kup-arena\//.test(path);
    if (noBar) d.classList.add("ra-app-nobar");
    var st = document.createElement("style");
    st.textContent =
        "html.ra-app{-webkit-tap-highlight-color:transparent}" +
        "html.ra-app body{overscroll-behavior-y:none}" +
        // üst menü: yalnız logo + hesap; sayfa bağlantıları alttaki sekmelerde
        "html.ra-app .nav-links{display:none!important}" +
        // hesap/profil alttaki "Profil" sekmesinde; üstte ikinci kez görünmesin (sekme çubuğu olmayan sayfalarda kalır)
        "html.ra-app:not(.ra-app-nobar) #accWrap{display:none!important}" +
        "html.ra-app .navbar{padding-top:max(env(safe-area-inset-top),0px)}" +
        "html.ra-app footer{display:none!important}" +
        "html.ra-app #btnInstall,html.ra-app .pwa-install,html.ra-app [data-install]{display:none!important}" +
        "html.ra-app:not(.ra-app-nobar) body{padding-bottom:calc(74px + env(safe-area-inset-bottom))}" +
        ".ra-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:900;display:grid;grid-template-columns:repeat(5,1fr);padding:6px 6px calc(6px + env(safe-area-inset-bottom));" +
            "background:color-mix(in srgb,var(--surface,#fff) 92%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--border,#e5e7eb);box-shadow:0 -6px 20px rgba(0,0,0,.08)}" +
        ".ra-tabbar a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:54px;border-radius:14px;color:var(--text-soft,#6b7280);text-decoration:none;font:800 11px Inter,system-ui,sans-serif;letter-spacing:.1px}" +
        ".ra-tabbar a svg{width:24px;height:24px}" +
        ".ra-tabbar a.on{color:var(--ui-accent,#6c5ce7);background:color-mix(in srgb,var(--ui-accent,#6c5ce7) 12%,transparent)}" +
        ".ra-tabbar a:active{transform:scale(.94)}" +
        "html.ra-app-nobar .ra-tabbar{display:none}" +
        "html.ra-app:not(.ra-app-nobar) .ra-pushask{bottom:calc(86px + env(safe-area-inset-bottom))}" +
        "body.c-in-room .ra-tabbar{display:none}" +
        "@media(min-width:900px){.ra-tabbar{left:50%;right:auto;transform:translateX(-50%);width:560px;bottom:12px;border-radius:22px;border:1px solid var(--border,#e5e7eb);padding:6px}html.ra-app:not(.ra-app-nobar) body{padding-bottom:96px}}" +
        "@media print{.ra-tabbar{display:none}}";
    (document.head || d).appendChild(st);
    var ic = function (p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
    var TABS = [
        ["/", "Ana Sayfa", ic('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>'), /^\/$/],
        ["/icerikler", "İçerikler", ic('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'), /^\/icerikler$|^\/icerikler\/(algoritmalar|videolar|kup-rehberi|cozucu|akilli-kup|yol-haritasi|dersler|keyhole|sss)/],
        ["/icerikler/algoritmalar/antrenor", "Antrenör", ic('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'), /antrenor/],
        ["/icerikler/ev-yarismasi", "Yarışma", ic('<path d="M8 4h8v4.5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5a2.5 2.5 0 0 0 3 4M16 5.5h3a2.5 2.5 0 0 1-3 4"/><path d="M12 12.5V16M8.5 20h7M10 16h4v4h-4z"/>'), /ev-yarismasi|rekorlar|cekilis|gunluk/],
        ["/icerikler/profil", "Profil", ic('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'), /profil|ayarlar/]
    ];
    function bar() {
        if (noBar || document.getElementById("raTabbar") || !document.body) return;
        var n = document.createElement("nav"); n.id = "raTabbar"; n.className = "ra-tabbar ra-noico"; n.setAttribute("aria-label", "Uygulama menüsü");
        n.innerHTML = TABS.map(function (t) { var cur = t[3].test(path); return '<a href="' + t[0] + '"' + (cur ? ' class="on" aria-current="page"' : '') + '>' + t[2] + '<span>' + t[1] + '</span></a>'; }).join("");
        document.body.appendChild(n);
    }
    if (document.body) bar(); else document.addEventListener("DOMContentLoaded", bar);
})();
// RA ikonları: sitedeki emojileri Rubik Academy'ye özel ikonlarla değiştirir (js/ra-icons.js)
(function () {
    try {
        var hasIcons = window.RAIcons || document.querySelector('script[src*="/js/ra-icons.js"]');
        var me = document.currentScript && document.currentScript.src || "", v = (/[?&]v=([^&]+)/.exec(me) || [])[1] || "";
        if (!hasIcons) { var sc = document.createElement("script"); sc.src = "/js/ra-icons.js" + (v ? "?v=" + v : ""); sc.defer = true; (document.head || document.documentElement).appendChild(sc); }
        // sponsor banner'ı (içerik admin panelinden)
        var ad = document.createElement("script"); ad.src = "/js/ad-banner.js" + (v ? "?v=" + v : ""); ad.defer = true;
        (document.head || document.documentElement).appendChild(ad);
    } catch (e) {}
})();
(function () {
    var PRIV = /^(algo-progress-|algo-set-|recog-|roadmap-|trainer-stats-v1$|daily-results-v1$|daily-sent-v1$|daily-name-v1$|custom-algs-v1$|timer-solves-v1$|smart-solves-v1$|vcube-times-v1$|activity-days-v1$|comp-stats-v1$|lessons-v1$|ra-profile-v1$|ra-last-page$|ra-sync-meta-v1$)/;
    var ls; try { ls = window.localStorage; if (!ls) return; } catch (e) { return; }
    var S = Storage.prototype, oGet = S.getItem, oSet = S.setItem, oRem = S.removeItem, oKey = S.key;
    function signed() { try { return oGet.call(ls, "ra-auth-v1") === "1"; } catch (e) { return false; } }
    var mem = {};
    function purge() {
        var del = [];
        try { for (var i = 0; i < ls.length; i++) { var k = oKey.call(ls, i); if (k && PRIV.test(k)) del.push(k); } } catch (e) {}
        del.forEach(function (k) { try { oRem.call(ls, k); } catch (e) {} });
        mem = {};
        return del.length;
    }
    if (!signed()) purge();
    function priv(st, k) { return st === ls && PRIV.test(String(k)) && !signed(); }
    S.getItem = function (k) { if (priv(this, k)) return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; return oGet.call(this, k); };
    S.setItem = function (k, v) { if (priv(this, k)) { mem[k] = String(v); return; } return oSet.call(this, k, v); };
    S.removeItem = function (k) { if (priv(this, k)) { delete mem[k]; return; } return oRem.call(this, k); };
    window.raPurgePrivate = purge;
    window.raIsPrivateKey = function (k) { return PRIV.test(String(k)); };
    // Bağlanan akıllı küp modelleri (admin panelindeki "akıllı küp modelleri" için profil özetine girer)
    window.raNoteCube = function (name) {
        name = String(name || "").trim().slice(0, 40); if (!name) return;
        try { var o = JSON.parse(localStorage.getItem("ra-bt-cubes-v1") || "{}") || {}; o[name] = Date.now(); localStorage.setItem("ra-bt-cubes-v1", JSON.stringify(o)); } catch (e) {}
    };
    // Hata kayıtları: tarayıcıdaki JavaScript hataları errs koleksiyonuna yazılır (yalnız admin okur).
    // Sayfa başına en çok 3, aynı hata oturumda bir kez.
    (function () {
        var sent = 0;
        function report(msg, src, line) {
            try {
                var cfg = window.RA_FIREBASE; if (!cfg || !cfg.apiKey || sent >= 3 || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return;
                msg = String(msg || "").slice(0, 300); if (!msg || /ResizeObserver loop|Script error\.?$/.test(msg)) return;
                var key = "ra-err:" + msg.slice(0, 80) + "|" + line;
                if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1");
                sent++;
                var u = "", A = window.Account; try { u = A && A.user && A.user() ? A.user().uid : ""; } catch (e) {}
                var f = { m: { stringValue: msg }, s: { stringValue: String(src || "").replace(location.origin, "").slice(0, 200) }, l: { integerValue: String(+line || 0) },
                    p: { stringValue: location.pathname.slice(0, 120) }, ua: { stringValue: navigator.userAgent.slice(0, 200) }, u: { stringValue: String(u).slice(0, 40) },
                    v: { stringValue: String((document.querySelector('script[src*="common.js"]') || {}).src || "").replace(/.*v=/, "").slice(0, 20) } };
                var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
                fetch("https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents/errs?documentId=" + id + "&key=" + encodeURIComponent(cfg.apiKey) +
                    "&mask.fieldPaths=m", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: f }), keepalive: true }).catch(function () {});
            } catch (e) {}
        }
        window.addEventListener("error", function (e) { if (e && e.message) report(e.message, e.filename, e.lineno); });
        window.addEventListener("unhandledrejection", function (e) { var r = e && e.reason; if (r && (r.message || typeof r === "string")) report("Promise: " + (r.message || r), r.stack ? String(r.stack).split("\n")[1] : "", 0); });
        window.raReportError = report;
    })();
})();

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
    raSavePrefs();
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
    raSavePrefs();
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

/* =========================================================
   10 KASIM ANMA GÖRÜNÜMÜ
   Türkiye saatiyle 10 Kasım 00:00 – 23:59: site siyah-beyaz olur, sayfaların üstünde anma şeridi
   (yas kurdelesi + söz) çıkar; reklam, tema ve puan pencereleri gösterilmez.
   09.05'te bir dakikalık saygı duruşu ekranı açılır (dokununca kapanır).
   Her yıl kendiliğinden çalışır (yalnız tarih kontrolü).
========================================================= */
function raMournInfo(now) {
    now = now || Date.now();
    var y = new Date(now).getUTCFullYear();
    // 10 Kasım 00:00 TSİ = 9 Kasım 21:00 UTC; 23:59:59 TSİ = 10 Kasım 20:59:59 UTC
    var from = Date.UTC(y, 10, 9, 21, 0, 0), to = Date.UTC(y, 10, 10, 21, 0, 0);
    return { on: now >= from && now < to, year: y - 1938, from: from };
}
function raMourn() { return raMournInfo().on; }
(function () {
    if (!raMourn()) return;
    var d = document.documentElement; d.classList.add("ra-mourn");
    var st = document.createElement("style");
    // Sayfanın tamamı siyah-beyaz yapılmaz (küp diyagramları ve algoritma renkleri okunur kalmalı):
    // yalnız sitenin vurgu renkleri sade koyu griye döner, logo ve dekoratif parıltılar renksizleşir
    st.textContent = "html.ra-mourn,html.ra-mourn body{--ui-accent:#3f3f46!important;--ui-accent-hover:#27272a!important;--ui-accent-text:#fff!important;--ui-accent-soft:rgba(113,113,122,.16)!important;" +
            "--primary:#52525b!important;--primary-dark:#3f3f46!important;--primary-light:rgba(113,113,122,.14)!important;--btn-bg:#3f3f46!important;--btn-hover-bg:#27272a!important;--btn-text:#fff!important;" +
            "--badge-bg:rgba(113,113,122,.16)!important;--badge-text:#52525b!important;--hero-bg:linear-gradient(135deg,#ececee 0%,#f6f6f7 100%)!important}" +
        "html.ra-mourn.dark-mode,html.ra-mourn.dark-mode body{--ui-accent:#d4d4d8!important;--ui-accent-hover:#e4e4e7!important;--ui-accent-text:#111!important;--primary:#d4d4d8!important;--primary-dark:#e4e4e7!important;" +
            "--btn-bg:#d4d4d8!important;--btn-hover-bg:#e4e4e7!important;--btn-text:#111!important;--badge-text:#d4d4d8!important;--hero-bg:linear-gradient(135deg,#1a1a1c 0%,#111113 100%)!important}" +
        "html.ra-mourn .nav-logo-mark,html.ra-mourn .bg-glow,html.ra-mourn .navbar::after,html.ra-mourn .gradient-text,html.ra-mourn .badge i{filter:grayscale(1)}" +
        "html.ra-mourn .gradient-text{background:none!important;-webkit-text-fill-color:currentColor!important;color:inherit!important}" +
        "html.ra-mourn #raAd,html.ra-mourn #raHwAsk,html.ra-mourn #raRate{display:none!important}" +
        ".ra-mourn-bar{position:relative;z-index:5;background:#0b0b0c;color:#f2f2f2;border-bottom:1px solid #2a2a2c;font-family:Inter,system-ui,sans-serif}" +
        ".ra-mourn-in{max-width:1100px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:14px}" +
        ".ra-mourn-rib{flex:none;width:30px;height:42px}" +
        // Ana sayfa: portre şeridin arka planında, sağa doğru siyaha karışır
        ".ra-mourn-bar.home{overflow:hidden;background:#0b0b0c}" +
        ".ra-mourn-bar.home::before{content:'';position:absolute;left:0;top:0;bottom:0;width:min(420px,48%);background:url(/img/ataturk-banner.jpg) 50% 18%/cover no-repeat;" +
            "-webkit-mask-image:linear-gradient(90deg,#000 45%,transparent);mask-image:linear-gradient(90deg,#000 45%,transparent);opacity:.95}" +
        ".ra-mourn-bar.home .ra-mourn-in{position:relative;min-height:210px;padding:26px 16px 26px min(380px,40%)}" +
        ".ra-mourn-bar.home .ra-mourn-tx b{font-size:19px}.ra-mourn-bar.home .ra-mourn-tx span{font-size:14px;margin-top:4px}" +
        ".ra-mourn-bar.home .ra-mourn-rib{width:34px;height:48px}" +
        ".ra-mourn-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}" +
        ".ra-mourn-tx b{font-size:14.5px;font-weight:800;letter-spacing:.2px;line-height:1.4}" +
        ".ra-mourn-tx span{font-size:12.5px;color:#bdbdbd;font-style:italic;line-height:1.45}" +
        "@media(max-width:600px){.ra-mourn-in{padding:10px 14px;gap:10px}.ra-mourn-rib{width:20px;height:28px}.ra-mourn-bar.home::before{width:62%;opacity:.55}.ra-mourn-bar.home .ra-mourn-in{min-height:190px;padding:20px 14px 20px 34%}.ra-mourn-bar.home .ra-mourn-tx b{font-size:14.5px;text-shadow:0 1px 6px #000}.ra-mourn-bar.home .ra-mourn-tx span{font-size:12px;color:#d0d0d0;text-shadow:0 1px 6px #000}.ra-mourn-bar.home .ra-mourn-rib{display:none}.ra-mourn-tx b{font-size:13px}.ra-mourn-tx span{font-size:11.5px}}" +
        ".ra-silence{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.94);color:#f2f2f2;text-align:center;font-family:Inter,system-ui,sans-serif;cursor:pointer}" +
        ".ra-silence div{max-width:520px;display:flex;flex-direction:column;align-items:center;gap:12px}" +
        ".ra-silence b{font-size:22px;font-weight:800;line-height:1.35}.ra-silence p{margin:0;font-size:15px;color:#c8c8c8;line-height:1.6}" +
        ".ra-silence small{font-size:12px;color:#8a8a8a}" +
        ".ra-silence img{width:min(220px,52vw);aspect-ratio:3/4;object-fit:cover;border-radius:16px;border:2px solid #3a3a3d;box-shadow:0 18px 50px rgba(0,0,0,.6)}" +
        "@media print{.ra-mourn-bar{display:none}}";
    (document.head || d).appendChild(st);
    var info = raMournInfo();
    var ribbon = '<svg class="ra-mourn-rib" viewBox="0 0 30 42" aria-hidden="true"><path d="M15 3c-4.5 0-7 3-7 6.5 0 2.6 1.4 5 3.2 7.6L3.5 39l6.2-2.4L15 22.4l5.3 14.2 6.2 2.4-7.7-21.9c1.8-2.6 3.2-5 3.2-7.6C22 6 19.5 3 15 3zm0 4c1.8 0 3 1.2 3 2.8 0 1.4-1.2 3.5-3 5.9-1.8-2.4-3-4.5-3-5.9C12 8.2 13.2 7 15 7z" fill="#e8e8e8"/></svg>';
    function bar() {
        if (document.getElementById("raMourn") || !document.body || /\/(admin|yazdir|kup-arena\/baglan)/.test(location.pathname)) return;
        var el = document.createElement("aside"); el.id = "raMourn"; el.className = "ra-mourn-bar ra-noico" + (/^\/(index(\.html)?)?$/.test(location.pathname) ? " home" : ""); el.setAttribute("aria-label", "10 Kasım anma");
        el.innerHTML = '<div class="ra-mourn-in">' + ribbon + '<div class="ra-mourn-tx"><b>Cumhuriyetimizin kurucusu Ulu Önder Gazi Mustafa Kemal Atatürk\'ü aramızdan ayrılışının ' + info.year + '. yılında saygı, özlem ve minnetle anıyoruz.</b>' +
            '<span>“Benim naçiz vücudum elbet bir gün toprak olacaktır, fakat Türkiye Cumhuriyeti ilelebet payidar kalacaktır.”</span></div></div>';
        document.body.insertBefore(el, document.body.firstChild);
    }
    // 09.05 (TSİ): bir dakikalık saygı duruşu
    function silence() {
        var t = Date.now(), at = info.from + (9 * 60 + 5) * 60000; // 10 Kasım 09:05 TSİ
        var show = function () {
            if (document.getElementById("raSilence") || !document.body) return;
            var s = document.createElement("div"); s.id = "raSilence"; s.className = "ra-silence ra-noico"; s.setAttribute("role", "dialog");
            s.innerHTML = '<div><img src="/img/ataturk.jpg" alt="Mustafa Kemal Atatürk" width="220" height="293">' + ribbon.replace('class="ra-mourn-rib"', 'width="30" height="42"') + '<b>Saat 09.05 — Saygı duruşu</b><p>Ulu Önder Mustafa Kemal Atatürk\'ü saygı ve minnetle anıyoruz.</p><small>Ekran bir dakika sonra kendiliğinden kapanır.</small></div>';
            s.onclick = function () { s.remove(); };
            document.body.appendChild(s);
            setTimeout(function () { s.remove(); }, Math.max(5000, at + 60000 - Date.now()));
        };
        if (t >= at && t < at + 60000) show();
        else if (t < at && at - t < 24 * 3600000) setTimeout(show, at - t);
    }
    if (document.body) { bar(); silence(); } else document.addEventListener("DOMContentLoaded", function () { bar(); silence(); });
})();

document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("darkModeBtn");
    // Varsayılan karanlık mod: "light" açıkça seçilmedikçe karanlık
    var isDark = (localStorage.getItem("theme") || "dark") !== "light";
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("dark-mode", isDark);
    if (btn) btn.innerHTML = isDark ? "☀️" : "🌙";
    // Halloween süresi bittiyse önceki temaya dön
    // Mevsimlik temanın süresi bittiyse önceki temaya dön
    if (raSeasonOf(raSkin()) && !raSeasonOn(raSkin())) { var prevSk = "standart"; try { if (!localStorage.getItem("ra-rated-" + raSkin())) localStorage.setItem("ra-rate-pending", raSkin()); prevSk = localStorage.getItem("ra-season-prev") || localStorage.getItem("ra-hw-prev") || "standart"; if (raSeasonOf(prevSk)) prevSk = "standart"; localStorage.setItem("site-skin", prevSk); } catch (e) {} raSavePrefs(); }
    raApplySkin(raSkin());
    setTimeout(raSeasonOffer, 1800);
    setTimeout(raRateTheme, 2200);
    if (cvdTheme()) applyCvd(cvdTheme());
    else if (holdSwap()) raRecolor();
    raInitSettings();
});

/* =========================================
   AYARLAR MENÜSÜ (⚙) — tema, dil, renk körlüğü tek yerde
========================================= */
var SETTINGS_TXT = {
    tr: { set: "Ayarlar", theme: "Tema", dark: "Karanlık", light: "Açık", lang: "Dil", cvd: "Renk körlüğü", cvd_off: "Kapalı (normal)", cvd_pro: "Protanopi", cvd_deu: "Döteranopi", cvd_rg: "Kırmızı-Yeşil", cvd_tri: "Tritanopi (mavi-sarı)" , skin: "Tema stili", skin_standart: "Standart", skin_rubik: "Rubik's Cube", skin_neon: "Neon", skin_gunbatimi: "Gün Batımı", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    en: { set: "Settings", theme: "Theme", dark: "Dark", light: "Light", lang: "Language", cvd: "Color blindness", cvd_off: "Off (normal)", cvd_pro: "Protanopia", cvd_deu: "Deuteranopia", cvd_rg: "Red-Green", cvd_tri: "Tritanopia (blue-yellow)" , skin: "Theme style", skin_standart: "Standard", skin_rubik: "Rubik's Cube", skin_neon: "Neon", skin_gunbatimi: "Sunset", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    fr: { set: "Paramètres", theme: "Thème", dark: "Sombre", light: "Clair", lang: "Langue", cvd: "Daltonisme", cvd_off: "Désactivé (normal)", cvd_pro: "Protanopie", cvd_deu: "Deutéranopie", cvd_rg: "Rouge-Vert", cvd_tri: "Tritanopie (bleu-jaune)" , skin: "Style du thème", skin_standart: "Standard", skin_rubik: "Rubik's Cube", skin_neon: "Néon", skin_gunbatimi: "Coucher de soleil", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    ru: { set: "Настройки", theme: "Тема", dark: "Тёмная", light: "Светлая", lang: "Язык", cvd: "Дальтонизм", cvd_off: "Выкл (обычный)", cvd_pro: "Протанопия", cvd_deu: "Дейтеранопия", cvd_rg: "Красно-зелёный", cvd_tri: "Тританопия (сине-жёлтый)" , skin: "Стиль темы", skin_standart: "Стандартный", skin_rubik: "Rubik's Cube", skin_neon: "Неон", skin_gunbatimi: "Закат", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    de: { set: "Einstellungen", theme: "Thema", dark: "Dunkel", light: "Hell", lang: "Sprache", cvd: "Farbenblindheit", cvd_off: "Aus (normal)", cvd_pro: "Protanopie", cvd_deu: "Deuteranopie", cvd_rg: "Rot-Grün", cvd_tri: "Tritanopie (Blau-Gelb)" , skin: "Designstil", skin_standart: "Standard", skin_rubik: "Rubik's Cube", skin_neon: "Neon", skin_gunbatimi: "Sonnenuntergang", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    ar: { set: "الإعدادات", theme: "السمة", dark: "داكن", light: "فاتح", lang: "اللغة", cvd: "عمى الألوان", cvd_off: "إيقاف (عادي)", cvd_pro: "بروتانوبيا", cvd_deu: "ديوترانوبيا", cvd_rg: "أحمر-أخضر", cvd_tri: "تريتانوبيا (أزرق-أصفر)" , skin: "نمط السمة", skin_standart: "قياسي", skin_rubik: "Rubik's Cube", skin_neon: "نيون", skin_gunbatimi: "غروب الشمس", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" }
};
function raSetLang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
function raEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function raSetTheme(mode) {
    var isDark = mode !== "light";
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("dark-mode", isDark);
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch (e) {}
    raSavePrefs();
    var btn = document.getElementById("darkModeBtn"); if (btn) btn.innerHTML = isDark ? "☀️" : "🌙";
    renderSettingsMenu();
}
/* Görünüm tercihleri hesaba bağlı: tema, tema stili ve renk körlüğü paleti tek kayıtta ("site-prefs-v1")
   tutulur ve hesapla senkronlanır; cihazlar arasında en son yapılan seçim geçerli olur. */
function raSavePrefs() {
    try {
        var g = function (k) { return localStorage.getItem(k) || ""; };
        localStorage.setItem("site-prefs-v1", JSON.stringify({ skin: g("site-skin") || "standart", theme: g("theme") || "dark", cvd: g("cvd-theme"), t: Date.now() }));
    } catch (e) {}
}
/* Buluttan gelen tercihleri uygula (account.js senkronu çağırır) */
function raApplyPrefs(json) {
    try {
        var p = JSON.parse(json || "null"); if (!p) return;
        if (p.skin) localStorage.setItem("site-skin", p.skin);
        if (p.theme) localStorage.setItem("theme", p.theme);
        if (p.cvd) localStorage.setItem("cvd-theme", p.cvd); else localStorage.removeItem("cvd-theme");
    } catch (e) {}
}
// Eski cihazlar: tercih kaydı yoksa mevcut seçimden oluştur (t: 0 → buluttaki kayıt önceliklidir)
(function () {
    try {
        if (localStorage.getItem("site-prefs-v1")) return;
        var s = localStorage.getItem("site-skin"), th = localStorage.getItem("theme"), c = localStorage.getItem("cvd-theme");
        if (s || th || c) localStorage.setItem("site-prefs-v1", JSON.stringify({ skin: s || "standart", theme: th || "dark", cvd: c || "", t: 0 }));
    } catch (e) {}
})();
/* Tema stili (renk paleti + yazı tipi): localStorage "site-skin" */
var RA_SKINS = [
    ["standart", ["#f7f8fc", "#6c5ce7", "#ec4899", "#12141f"]],
    ["rubik", ["#fff8ec", "#ffd21f", "#1d5bff", "#17171f"]],
    ["neon", ["#05060b", "#22d3ee", "#d946ef", "#e8f6ff"]],
    ["gunbatimi", ["#fdf6f0", "#e8573a", "#f5a524", "#2a1712"]]
];
// Sınırlı süreli (mevsimlik) temalar: süresi içinde listede görünür, siteye girene bir kez sorulur,
// süre bitince seçenler önceki temalarına döner
var RA_SEASONS = [
    { k: "halloween", from: 0, to: 1, sw: ["#0b0710", "#f97316", "#7c3aed", "#fff1e6"] },
    { k: "yilbasi", from: new Date(2026, 11, 1).getTime(), to: new Date(2027, 0, 8).getTime(), sw: ["#0a1222", "#dc2626", "#16a34a", "#fbbf24"] }
];
function raSeasonOf(k) { for (var i = 0; i < RA_SEASONS.length; i++) if (RA_SEASONS[i].k === k) return RA_SEASONS[i]; return null; }
function raSeasonOn(k) { var o = raSeasonOf(k), n = Date.now(); return !!o && n >= o.from && n < o.to; }
function raSeasonNow() { for (var i = 0; i < RA_SEASONS.length; i++) if (raSeasonOn(RA_SEASONS[i].k)) return RA_SEASONS[i]; return null; }
function raHwOn() { return raSeasonOn("halloween"); }
RA_SEASONS.forEach(function (o) { if (raSeasonOn(o.k)) RA_SKINS.push([o.k, o.sw]); });
var RA_SKIN_FONTS = { halloween: "Creepster", yilbasi: "Mountains+of+Christmas:wght@700", rubik: "Rubik:wght@500;600;700;800;900", neon: "Space+Grotesk:wght@500;600;700", gunbatimi: "Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800;9..144,900" };
function raSkin() { try { return localStorage.getItem("site-skin") || "standart"; } catch (e) { return "standart"; } }
function raApplySkin(k) {
    var d = document.documentElement;
    if (!k || k === "standart") d.removeAttribute("data-skin"); else d.setAttribute("data-skin", k);
    var f = RA_SKIN_FONTS[k];
    if (f && !document.getElementById("raSkinFont-" + k)) {
        var l = document.createElement("link"); l.rel = "stylesheet"; l.id = "raSkinFont-" + k;
        l.href = "https://fonts.googleapis.com/css2?family=" + f + "&display=swap";
        document.head.appendChild(l);
    }
}
// Kaldırılan mevsimlik temayı kullananlara bir kez puan sor (1-5 yıldız + isteğe bağlı yorum)
// → Firestore feedback koleksiyonu (herkes ekler, yalnız admin okur)
var RA_RATE_NAMES = { halloween: "Halloween", yilbasi: "Yılbaşı" };
function raRateTheme() {
    if (raMourn()) return; // 10 Kasım'da pencere açılmaz (ertesi gün sorulur)
    var k; try { k = localStorage.getItem("ra-rate-pending"); } catch (e) { return; }
    if (!k || /\/(admin|yazdir|giris|kup-arena\/baglan)/.test(location.pathname)) return;
    if (document.getElementById("raHwAsk") || document.getElementById("raPushAsk") || document.getElementById("raRate")) { setTimeout(raRateTheme, 4000); return; }
    var done = function () { try { localStorage.removeItem("ra-rate-pending"); localStorage.setItem("ra-rated-" + k, "1"); } catch (e) {} el.remove(); };
    var nm = RA_SEASON_UI[k] ? RA_RATE_NAMES[k] || k : k, stars = 0;
    var st = document.createElement("style");
    st.textContent = ".ra-rate{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,12,18,.62);backdrop-filter:blur(3px)}" +
        ".ra-rate-b{width:min(380px,100%);box-sizing:border-box;padding:22px 20px 16px;border-radius:22px;background:var(--surface,#fff);color:var(--text,#111);border:var(--card-bw,2px) solid var(--card-border,#ddd);box-shadow:0 24px 60px rgba(0,0,0,.35);text-align:center;font-family:Inter,sans-serif}" +
        ".ra-rate-b h3{margin:4px 0 6px;font:900 20px Inter,sans-serif}.ra-rate-b p{margin:0 0 12px;font-size:14px;line-height:1.5;color:var(--text-soft,#666)}" +
        ".ra-stars{display:flex;justify-content:center;gap:6px;margin:6px 0 12px}.ra-stars button{border:0;background:none;padding:2px;cursor:pointer;font-size:36px;line-height:1;color:var(--border,#ccc);transition:transform .1s}" +
        ".ra-stars button.on{color:#f59e0b}.ra-stars button:active{transform:scale(.9)}" +
        ".ra-rate textarea{width:100%;box-sizing:border-box;min-height:64px;padding:10px 12px;border-radius:12px;border:1px solid var(--border,#ddd);background:var(--surface-soft,#f6f6f6);color:var(--text,#111);font:600 14px Inter,sans-serif;resize:vertical}" +
        ".ra-rate-a{display:flex;flex-direction:column;gap:6px;margin-top:10px}.ra-rate-a button{border:0;border-radius:14px;padding:12px;font:900 15px Inter,sans-serif;cursor:pointer}" +
        ".ra-rate-ok{background:var(--ui-accent,#6c5ce7);color:var(--ui-accent-text,#fff)}.ra-rate-ok:disabled{opacity:.5;cursor:default}.ra-rate-no{background:none;color:var(--text-soft,#666);font-weight:700!important;font-size:13px!important}";
    document.head.appendChild(st);
    var el = document.createElement("div"); el.id = "raRate"; el.className = "ra-rate"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    el.innerHTML = '<div class="ra-rate-b"><div style="font-size:40px;line-height:1">' + (k === "halloween" ? "🎃" : "🎄") + '</div><h3>' + nm + ' teması bitti</h3>' +
        '<p>Bir süre ' + nm + ' temasını kullandın. Beğendin mi? Puanın bir sonraki temayı daha güzel yapmamıza yardım eder.</p>' +
        '<div class="ra-stars ra-noico" role="radiogroup" aria-label="Puan">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" aria-label="' + n + ' yıldız">★</button>'; }).join("") + '</div>' +
        '<textarea maxlength="300" placeholder="Eklemek istediğin bir şey var mı? (isteğe bağlı)"></textarea>' +
        '<div class="ra-rate-a"><button type="button" class="ra-rate-ok" disabled>Gönder</button><button type="button" class="ra-rate-no">Şimdi değil</button></div></div>';
    var btns = el.querySelectorAll(".ra-stars button"), ok = el.querySelector(".ra-rate-ok");
    Array.prototype.forEach.call(btns, function (b) { b.onclick = function () { stars = +b.getAttribute("data-n"); Array.prototype.forEach.call(btns, function (x) { x.classList.toggle("on", +x.getAttribute("data-n") <= stars); }); ok.disabled = false; }; });
    ok.onclick = function () {
        var cfg = window.RA_FIREBASE; ok.disabled = true; ok.textContent = "Gönderiliyor…";
        var u = ""; try { u = window.Account && Account.user && Account.user() ? Account.user().uid : ""; } catch (e) {}
        var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        var D = "projects/" + cfg.projectId + "/databases/(default)/documents";
        var body = { writes: [{ update: { name: D + "/feedback/" + id, fields: { topic: { stringValue: "tema-" + k }, stars: { integerValue: String(stars) }, text: { stringValue: el.querySelector("textarea").value.trim().slice(0, 300) }, u: { stringValue: u } } },
            updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }] };
        var tk = u && window.Account && Account.token ? Account.token().catch(function () { return ""; }) : Promise.resolve("");
        tk.then(function (t) {
            if (!t) body.writes[0].update.fields.u.stringValue = ""; // kimlik yoksa uid gönderilmez
            var h = { "Content-Type": "application/json" }; if (t) h.Authorization = "Bearer " + t;
            return fetch(((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/" + D + ":commit?key=" + encodeURIComponent(cfg.apiKey), { method: "POST", headers: h, body: JSON.stringify(body) });
        }).then(function () { el.querySelector(".ra-rate-b").innerHTML = '<div style="font-size:40px">💜</div><h3>Teşekkürler!</h3><p>Puanın kaydedildi.</p>'; setTimeout(done, 1600); }, done);
    };
    el.querySelector(".ra-rate-no").onclick = done;
    document.body.appendChild(el);
}
// Siteye girene bir kez: "<mevsim> teması ister misin?"
var RA_SEASON_UI = {
    halloween: { font: "Creepster", ff: "Creepster,Inter,cursive", title: "Halloween Teması", yes: "🎃 Evet, temayı aç",
        text: "Rubik Academy cadılar bayramı kostümünü giydi! Turuncu-mor renkler, örümcek ağları ve balkabakları… Denemek ister misin?",
        bg: "radial-gradient(120% 120% at 0% 0%,#3a1a08 0%,#150e1d 48%,#2a0f45 100%)", bd: "#f97316", tc: "#fb923c", pc: "#e9d8f4", sc: "#8f7aa0", nc: "#b9a3c4", nb: "#3b2a52", btn: "linear-gradient(120deg,#f97316,#c2410c)",
        icon: '<svg class="ra-hw-pk" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 14c-3 0-4-6 0-9" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="37" rx="13" ry="19" fill="#ea580c"/><ellipse cx="42" cy="37" rx="13" ry="19" fill="#ea580c"/><ellipse cx="32" cy="37" rx="12" ry="21" fill="#f97316"/><path d="M20 31l6 4-7 2zM44 31l-6 4 7 2zM21 45q11 9 22 0l-4 1-3-3-3 3-3-3-3 3-3-3z" fill="#1a0d02"/></svg>',
        deco: function (css) { return '<svg class="ra-hw-bat" style="' + css + '" viewBox="0 0 48 24" aria-hidden="true"><path d="M24 8c2-3 4-3 5 0 3-4 9-5 15-2-4 1-6 4-6 8-3-2-6-2-8 1-2-2-4-3-6-3s-4 1-6 3c-2-3-5-3-8-1 0-4-2-7-6-8 6-3 12-2 15 2 1-3 3-3 5 0z" fill="#a855f7"/></svg>'; } },
    yilbasi: { font: "Mountains+of+Christmas:wght@700", ff: "'Mountains of Christmas',Georgia,serif", title: "Yılbaşı Teması", yes: "🎄 Evet, temayı aç",
        text: "Rubik Academy yeni yıla hazır! Kırmızı-yeşil renkler, yağan kar ve parıldayan süsler… Denemek ister misin?",
        bg: "radial-gradient(120% 120% at 0% 0%,#3b0d12 0%,#0b1426 50%,#0b3320 100%)", bd: "#fbbf24", tc: "#fde68a", pc: "#dbe7f5", sc: "#8ea3bd", nc: "#b6c6da", nb: "#24344d", btn: "linear-gradient(120deg,#dc2626,#16a34a)",
        icon: '<svg class="ra-hw-pk" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5l4 6h-8z" fill="#fbbf24"/><path d="M32 9 16 30h8L12 45h12L10 58h44L40 45h12L40 30h8z" fill="#16a34a"/><rect x="28" y="57" width="8" height="6" rx="1" fill="#7c2d12"/><circle cx="26" cy="36" r="2.4" fill="#dc2626"/><circle cx="38" cy="44" r="2.4" fill="#fbbf24"/><circle cx="30" cy="50" r="2.4" fill="#3b82f6"/><circle cx="35" cy="26" r="2" fill="#dc2626"/><circle cx="22" cy="52" r="2" fill="#fbbf24"/></svg>',
        deco: function (css) { return '<svg class="ra-hw-bat" style="' + css + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2" stroke="#e0f2fe" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>'; } }
};
function raSeasonOffer() {
    if (raMourn()) return;
    var se = raSeasonNow(); if (!se) return;
    var U = RA_SEASON_UI[se.k]; if (!U) return;
    try {
        if (raSkin() === se.k || localStorage.getItem("ra-season-asked-" + se.k) || (se.k === "halloween" && localStorage.getItem("ra-hw-asked"))) return;
        if (/\/(admin|yazdir|giris|kup-arena\/baglan)/.test(location.pathname) || document.getElementById("raMaint") || document.getElementById("raHwAsk") || document.getElementById("raPushAsk")) { if (document.getElementById("raPushAsk")) setTimeout(raSeasonOffer, 4000); return; }
    } catch (e) { return; }
    var end = new Date(se.to - 1), p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    var endTxt = p2(end.getDate()) + "." + p2(end.getMonth() + 1) + "." + end.getFullYear();
    var days = Math.max(1, Math.ceil((se.to - Date.now()) / 86400000));
    if (!document.getElementById("raSkinFont-" + se.k)) { var l = document.createElement("link"); l.rel = "stylesheet"; l.id = "raSkinFont-" + se.k; l.href = "https://fonts.googleapis.com/css2?family=" + U.font + "&display=swap"; document.head.appendChild(l); }
    var st = document.createElement("style");
    st.textContent = ".ra-hw{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,4,14,.72);backdrop-filter:blur(4px);animation:raHwF .25s ease-out}" +
        "@keyframes raHwF{from{opacity:0}}" +
        ".ra-hw-b{position:relative;width:min(400px,100%);box-sizing:border-box;padding:26px 22px 20px;border-radius:24px;text-align:center;color:#fff;background:" + U.bg + ";border:2px solid " + U.bd + ";box-shadow:0 0 40px " + U.bd + "55,0 30px 80px rgba(0,0,0,.5);animation:raHwP .35s cubic-bezier(.2,1.4,.4,1)}" +
        "@keyframes raHwP{from{transform:scale(.85) rotate(-2deg);opacity:0}}" +
        ".ra-hw-pk{width:84px;height:84px;margin:-6px auto 4px;animation:raHwB 2.2s ease-in-out infinite}" +
        "@keyframes raHwB{50%{transform:translateY(-6px) rotate(3deg)}}" +
        ".ra-hw-t{font:700 34px/1.05 " + U.ff + ";letter-spacing:1px;color:" + U.tc + ";text-shadow:0 0 18px " + U.bd + "77;margin:6px 0 8px}" +
        ".ra-hw-p{font:600 15px/1.55 Inter,sans-serif;color:" + U.pc + ";margin:0 0 6px}" +
        ".ra-hw-d{display:inline-block;margin:6px 0 16px;padding:5px 12px;border-radius:999px;background:" + U.bd + "26;border:1px solid " + U.bd + "88;font:800 13px Inter,sans-serif;color:" + U.tc + "}" +
        ".ra-hw-a{display:flex;flex-direction:column;gap:8px}" +
        ".ra-hw-a button{border:0;border-radius:14px;padding:13px;font:900 15px Inter,sans-serif;cursor:pointer}" +
        ".ra-hw-yes{background:" + U.btn + ";color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.3)}" +
        ".ra-hw-no{background:transparent;color:" + U.nc + ";border:1px solid " + U.nb + "!important}" +
        ".ra-hw-s{font:600 12px Inter,sans-serif;color:" + U.sc + ";margin-top:10px}" +
        ".ra-hw-bat{position:absolute;width:34px;opacity:.8;animation:raHwBat 3s ease-in-out infinite}" +
        "@keyframes raHwBat{50%{transform:translate(6px,-8px) scale(.92)}}";
    document.head.appendChild(st);
    var el = document.createElement("div"); el.id = "raHwAsk"; el.className = "ra-hw"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    el.innerHTML = '<div class="ra-hw-b">' + U.deco("top:14px;left:16px") + U.deco("top:28px;right:18px;animation-delay:.8s;width:26px") + U.icon +
        '<div class="ra-hw-t">' + U.title + '</div><p class="ra-hw-p">' + U.text + '</p>' +
        '<span class="ra-hw-d">🗓 ' + endTxt + ' tarihine kadar · ' + days + ' gün kaldı</span>' +
        '<div class="ra-hw-a"><button type="button" class="ra-hw-yes">' + U.yes + '</button><button type="button" class="ra-hw-no">Hayır, teşekkürler</button></div>' +
        '<div class="ra-hw-s">İstediğin zaman ⚙ Ayarlar › Tema stili’nden değiştirebilirsin.</div></div>';
    var done = function () { try { localStorage.setItem("ra-season-asked-" + se.k, "1"); } catch (e) {} el.remove(); };
    el.querySelector(".ra-hw-yes").onclick = function () {
        try { if (!raSeasonOf(raSkin())) localStorage.setItem("ra-season-prev", raSkin()); localStorage.setItem("theme", "dark"); } catch (e) {}
        document.documentElement.classList.add("dark-mode"); document.body.classList.add("dark-mode");
        var b = document.getElementById("darkModeBtn"); if (b) b.innerHTML = "☀️";
        raSetSkin(se.k); done();
    };
    el.querySelector(".ra-hw-no").onclick = done;
    el.onclick = function (e) { if (e.target === el) done(); };
    document.body.appendChild(el);
}
function raSetSkin(k, target) {
    try { localStorage.setItem("site-skin", k); } catch (e) {}
    raSavePrefs();
    raApplySkin(k);
    renderSettingsMenu(target);
}
function renderSettingsMenu(target) {
    var menu = target || document.getElementById("raSetMenu"); if (!menu) return;
    var L = SETTINGS_TXT[raSetLang()] || SETTINGS_TXT.tr;
    var th = (function () { try { return localStorage.getItem("theme") || "dark"; } catch (e) { return "dark"; } })();
    var langs = getLanguages(), curLang = raSetLang(), cvd = cvdTheme();
    var cur = function (c) { return c ? ' aria-current="true"' : ''; };
    var html = '<div class="set-grp"><div class="set-h">' + raEsc(L.theme) + '</div>' +
        '<button class="set-opt" data-theme="dark"' + cur(th !== "light") + '>🌙 ' + raEsc(L.dark) + '</button>' +
        '<button class="set-opt" data-theme="light"' + cur(th === "light") + '>☀️ ' + raEsc(L.light) + '</button></div>';
    var sk = raSkin();
    html += '<div class="set-grp"><div class="set-h">' + raEsc(L.skin || "Tema stili") + '</div>';
    RA_SKINS.forEach(function (o) {
        html += '<button class="set-opt" data-skin="' + o[0] + '"' + cur(o[0] === sk) + '><span class="skin-sw" aria-hidden="true">' + o[1].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + '</span>' + raEsc(L["skin_" + o[0]] || o[0]) + '</button>';
    });
    html += '</div>';
    var codes = Object.keys(langs);
    if (codes.length) {
        html += '<div class="set-grp"><div class="set-h">' + raEsc(L.lang) + '</div>';
        codes.forEach(function (c) { html += '<button class="set-opt" data-lang="' + c + '"' + cur(c === curLang) + '>' + raEsc(langs[c].name || c) + '</button>'; });
        html += '</div>';
    }
    var opts = [["", "off"], ["pro", "pro"], ["deu", "deu"], ["rg", "rg"], ["tri", "tri"]];
    html += '<div class="set-grp"><div class="set-h">' + raEsc(L.cvd) + '</div>';
    opts.forEach(function (o) { html += '<button class="set-opt cvd" data-cvd="' + o[0] + '"' + cur(o[0] === cvd) + '>' + cvdSwatches(o[0]) + '<span>' + raEsc(L["cvd_" + o[1]]) + '</span></button>'; });
    html += '</div>';
    menu.innerHTML = html;
    Array.prototype.forEach.call(menu.querySelectorAll("[data-theme]"), function (b) { b.onclick = function () { raSetTheme(b.getAttribute("data-theme")); }; });
    Array.prototype.forEach.call(menu.querySelectorAll("button[data-skin]"), function (b) { b.onclick = function () { raSetSkin(b.getAttribute("data-skin"), target); }; });
    Array.prototype.forEach.call(menu.querySelectorAll("[data-lang]"), function (b) { b.onclick = function () { selectLanguage(b.getAttribute("data-lang")); }; });
    Array.prototype.forEach.call(menu.querySelectorAll("[data-cvd]"), function (b) { b.onclick = function () { applyCvd(b.getAttribute("data-cvd")); renderSettingsMenu(target); }; });
}
/* Ayarlar artık ayrı sayfada (/ayarlar). Sayfa bu fonksiyonla kendi kabını doldurur. */
window.raRenderSettings = function (el) { renderSettingsMenu(el); };
/* Footer'a "Ayarlar" bağlantısı ekle (giriş yapılmamışken de erişilsin) */
function raInitSettings() {
    var L = SETTINGS_TXT[raSetLang()] || SETTINGS_TXT.tr;
    var foot = document.querySelector("footer");
    if (foot && !document.getElementById("raFootSet")) {
        var a = document.createElement("a");
        a.id = "raFootSet"; a.className = "foot-set"; a.href = "/ayarlar";
        a.textContent = "⚙️ " + L.set;
        foot.appendChild(a);
        document.addEventListener("site-lang-change", function () { a.textContent = "⚙️ " + ((SETTINGS_TXT[raSetLang()] || SETTINGS_TXT.tr).set); });
    }
}

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

/* Ana sayfadaki "Kaldığın yerden devam et" için son gezilen içerik sayfası */
(function () {
    try {
        var p = location.pathname.replace(/\.html$/, "").replace(/\/$/, "");
        if (!p || !/^\/icerikler\//.test(p) || /\/(admin|profil)$/.test(p)) return;
        var h = document.querySelector("h1"), t = (h && h.textContent.trim()) || document.title.split(/\s[·|–-]\s/)[0];
        localStorage.setItem("ra-last-page", JSON.stringify({ p: p, t: String(t).replace(/\s+/g, " ").slice(0, 60) }));
    } catch (e) {}
})();

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
    var _proto;
    try { store = window.localStorage; _proto = Storage.prototype.setItem; _set = function (k, v) { return _proto.call(store, k, v); }; store.removeItem("setItem"); } catch (e) { return; }
    function parse(k) { try { return JSON.parse(store.getItem(k)) || {}; } catch (e) { return {}; } }
    var syncing = false;
    // Storage nesnesine atama yapılamaz (anahtar olarak kaydedilir); prototype üzerinden sar.
    Storage.prototype.setItem = function (k, v) {
        if (this !== store || syncing || !WATCH[k]) return _proto.call(this, k, v);
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

/* ---------- MAKRO ENGELLEYİCİ ----------
   <body data-macro-guard> olan sayfalarda (günlük karıştırma, antrenör):
   - Betik/makro ile üretilmiş sahte olaylar (event.isTrusted === false) zamanlayıcıya ve
     [data-guard] düğmelerine ulaşmadan engellenir.
   - Saniyede 15'ten fazla basış "makro" sayılır.
   Sayfa RAGuard.flag ile denemenin şüpheli olup olmadığını kontrol eder, RAGuard.reset() ile sıfırlar. */
(function () {
    var G = { flag: false, reason: "", hits: [] };
    G.reset = function () { G.flag = false; G.reason = ""; G.hits = []; };
    window.RAGuard = G;
    function on() { return document.body && document.body.hasAttribute("data-macro-guard"); }
    ["keydown", "keyup", "mousedown", "mouseup", "touchstart", "touchend", "click", "pointerdown", "pointerup"].forEach(function (type) {
        document.addEventListener(type, function (e) {
            if (!on()) return;
            var tg = e.target && e.target.closest ? e.target : null;
            var guarded = type.indexOf("key") === 0 ? !(tg && tg.closest("input, textarea, select, [contenteditable]")) : !!(tg && tg.closest("[data-guard]"));
            if (!guarded) return;
            if (e.isTrusted === false) {
                e.stopImmediatePropagation(); e.preventDefault();
                G.flag = true; G.reason = "synthetic";
                return;
            }
            if (type === "keydown" || type === "mousedown" || type === "touchstart") {
                if (type === "keydown" && e.repeat) return;
                var n = performance.now();
                G.hits.push(n); G.hits = G.hits.filter(function (x) { return n - x < 1000; });
                if (G.hits.length > 15) { G.flag = true; G.reason = "rapid"; }
            }
        }, true);
    });
})();

/* =========================================================
   ALGORİTMA SETLERİ: "Hepsini seç" çubuğu
   Sayfanın kendi loadProgress/saveProgress/applyState/updateSummary
   fonksiyonlarını kullanır; ekrandaki tüm case'leri tek seferde işaretler.
========================================================= */
(function () {
    var TXT = {
        tr: { all: "Hepsini:", k: "🟢 Biliyorum", l: "🟡 Öğreniyorum", c: "⚪ Temizle", ask: "Bu sayfadaki tüm case'lerin işaretleri temizlensin mi?" },
        en: { all: "Mark all:", k: "🟢 Known", l: "🟡 Learning", c: "⚪ Clear", ask: "Clear the marks of all cases on this page?" },
        de: { all: "Alle:", k: "🟢 Kann ich", l: "🟡 Ich lerne", c: "⚪ Leeren", ask: "Markierungen aller Fälle auf dieser Seite löschen?" },
        fr: { all: "Tout :", k: "🟢 Je sais", l: "🟡 J'apprends", c: "⚪ Effacer", ask: "Effacer les marques de tous les cas de cette page ?" },
        ru: { all: "Все:", k: "🟢 Знаю", l: "🟡 Учу", c: "⚪ Сбросить", ask: "Сбросить отметки всех случаев на этой странице?" },
        ar: { all: "الكل:", k: "🟢 أعرف", l: "🟡 أتعلم", c: "⚪ مسح", ask: "مسح علامات جميع الحالات في هذه الصفحة؟" }
    };
    function t() { var l = "tr"; try { l = localStorage.getItem("site-lang") || "tr"; } catch (e) {} return TXT[l] || TXT.tr; }
    function ready() {
        var sum = document.getElementById("progressSummary");
        if (!sum || document.getElementById("raMarkAll")) return;
        if (typeof window.loadProgress !== "function" || typeof window.saveProgress !== "function" || typeof window.applyState !== "function") return;
        // İlerleme kartı: sayılar + ilerleme çubuğu + "Hepsini" tuşları tek kutuda
        var css = document.createElement("style");
        css.textContent = ".ra-prog{max-width:1250px;box-sizing:border-box;margin:0 auto 28px;padding:14px 16px;border-radius:18px;background:var(--surface);border:var(--card-bw,2px) solid var(--card-border,var(--border));box-shadow:var(--shadow-sm,none);display:flex;flex-direction:column;gap:12px}" +
            ".ra-prog .progress-summary{margin:0!important;max-width:none!important;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;font-weight:800}" +
            ".ra-prog .progress-summary>span{padding:0!important;border:0!important;background:none!important;border-radius:0!important;color:var(--text);display:inline-flex;align-items:center}" +
            ".ra-pbar{position:relative;height:10px;border-radius:99px;background:var(--surface-soft);border:1px solid var(--border);overflow:hidden}" +
            ".ra-pbar i{position:absolute;top:0;bottom:0;left:0;border-radius:99px;transition:width .35s}" +
            ".ra-pbar i.k{background:#22c55e}.ra-pbar i.l{background:#facc15}" +
            ".ra-phead{display:flex;align-items:center;gap:10px}.ra-pct{font:900 15px 'JetBrains Mono',monospace;color:#16a34a;margin-inline-start:auto}" +
            ".ra-markall{display:flex;flex-wrap:wrap;align-items:center;gap:6px}" +
            ".ra-markall>span{font-size:12.5px;font-weight:800;color:var(--text-soft);margin-inline-end:2px}" +
            ".ra-markall button{display:inline-flex;align-items:center;border:1px solid var(--border);background:var(--surface-soft);color:var(--text);font:800 13px Inter,sans-serif;padding:6px 12px;border-radius:999px;cursor:pointer}" +
            ".ra-markall button:hover{border-color:var(--text-soft)}" +
            "@media(max-width:560px){.ra-prog{padding:12px}.ra-markall button{padding:6px 10px;font-size:12.5px}}";
        document.head.appendChild(css);
        var wrap = document.createElement("div"); wrap.className = "ra-prog";
        sum.parentNode.insertBefore(wrap, sum); wrap.appendChild(sum);
        var pbar = document.createElement("div"); pbar.className = "ra-pbar"; pbar.innerHTML = '<i class="k"></i><i class="l"></i>';
        wrap.appendChild(pbar);
        var bar = document.createElement("div"); bar.id = "raMarkAll"; bar.className = "ra-markall";
        function draw() { var x = t(); bar.innerHTML = '<span>' + x.all + '</span><button type="button" data-st="known">' + x.k + '</button><button type="button" data-st="learning">' + x.l + '</button><button type="button" data-st="">' + x.c + '</button>'; }
        draw();
        wrap.appendChild(bar);
        // özet metnindeki sayılardan çubuğu çiz: "öğreniyorum: L" ve "biliyorum: K / T"
        function fill() {
            var n = (sum.textContent.match(/\d+/g) || []).map(Number);
            if (n.length < 3) { pbar.hidden = true; return; }
            var l = n[0], k = n[1], tot = n[2] || 1; pbar.hidden = false;
            pbar.children[0].style.width = (k / tot * 100) + "%";
            pbar.children[1].style.left = (k / tot * 100) + "%"; pbar.children[1].style.width = (l / tot * 100) + "%";
            pct.textContent = "%" + Math.round(k / tot * 100);
        }
        // yüzde, özetin yanında (özetin içine yazılmaz; sayılar karışmasın)
        var head = document.createElement("div"); head.className = "ra-phead";
        wrap.insertBefore(head, sum); head.appendChild(sum);
        var pct = document.createElement("b"); pct.className = "ra-pct"; head.appendChild(pct);
        fill();
        if (window.MutationObserver) new MutationObserver(fill).observe(sum, { childList: true, subtree: true, characterData: true });
        document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("#langMenu")) setTimeout(draw, 60); });
        bar.addEventListener("click", function (e) {
            var b = e.target.closest("button"); if (!b) return;
            var st = b.getAttribute("data-st");
            if (!st && !confirm(t().ask)) return;
            // Görünen case'ler (arama/filtreyle gizlenenler hariç); hiçbiri görünmüyorsa hepsi
            var all = Array.prototype.slice.call(document.querySelectorAll(".case-card[data-case]"));
            var vis = all.filter(function (c) { return c.offsetParent !== null || c.closest("details:not([open])"); });
            var cards = vis.length ? vis : all;
            var p = window.loadProgress() || {};
            cards.forEach(function (c) {
                var n = c.getAttribute("data-case");
                if (st) p[n] = st; else delete p[n];
                window.applyState(c, st);
            });
            window.saveProgress(p);
            if (typeof window.updateSummary === "function") window.updateSummary();
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(ready, 0); });
    else setTimeout(ready, 0);
    window.addEventListener("load", ready);
})();
