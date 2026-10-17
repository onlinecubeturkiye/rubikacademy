/* =========================================================
   SİTE İÇİ ARAMA (search.js) — common.js'ten sonra her sayfada
   - Üst menüye 🔍 düğmesi ekler; "/" ya da Ctrl+K ile de açılır
   - Dizin (/arama.json, tools/arama-dizini.py ile üretilir) ilk açılışta yüklenir
   - Algoritma sonucu ?case=AD ile açılır: sayfa o kartı bulup vurgular
========================================================= */
(function () {
    var V = "20261104";
    var TXT = {
        tr: { btn: "Ara", ph: "Ara: OLL 27, T perm, Sune, parity…", none: "Sonuç bulunamadı.", load: "Yükleniyor…", pages: "Sayfa", hint: "↑↓ seç · Enter aç · Esc kapat" },
        en: { btn: "Search", ph: "Search: OLL 27, T perm, Sune, parity…", none: "No results.", load: "Loading…", pages: "Page", hint: "↑↓ select · Enter open · Esc close" },
        fr: { btn: "Rechercher", ph: "Rechercher : OLL 27, T perm, Sune, parity…", none: "Aucun résultat.", load: "Chargement…", pages: "Page", hint: "↑↓ choisir · Entrée ouvrir · Échap fermer" },
        ru: { btn: "Поиск", ph: "Поиск: OLL 27, T perm, Sune, parity…", none: "Ничего не найдено.", load: "Загрузка…", pages: "Страница", hint: "↑↓ выбор · Enter открыть · Esc закрыть" },
        de: { btn: "Suche", ph: "Suche: OLL 27, T perm, Sune, Parity…", none: "Keine Ergebnisse.", load: "Wird geladen…", pages: "Seite", hint: "↑↓ wählen · Enter öffnen · Esc schließen" },
        ar: { btn: "بحث", ph: "ابحث: OLL 27، T perm، Sune، parity…", none: "لا نتائج.", load: "جارٍ التحميل…", pages: "صفحة", hint: "↑↓ اختيار · Enter فتح · Esc إغلاق" }
    };
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function t(k) { return (TXT[lang()] || TXT.tr)[k]; }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    // Küçük harf, Türkçe karakterler sadeleşir, noktalama boşluk olur
    function norm(s) {
        return String(s || "").toLocaleLowerCase("tr").replace(/[ıİ]/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
            .replace(/ö/g, "o").replace(/ü/g, "u").replace(/[’'`´]/g, "'").replace(/[^\p{L}\p{N}']+/gu, " ").trim();
    }
    var index = null, loading = null, modal, input, list, sel = 0, results = [];
    function load() {
        if (index) return Promise.resolve(index);
        if (!loading) loading = fetch("/arama.json?v=" + V).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (j) {
                index = j.items.map(function (it) {
                    var hay = norm(it.t + " " + (it.s || "") + " " + (it.k || "") + " " + (it.a || ""));
                    return { it: it, hay: hay, flat: hay.replace(/\s+/g, ""), title: norm(it.t) };
                });
                return index;
            }).catch(function (e) { loading = null; throw e; });
        return loading;
    }
    // Algoritma dizisi mi? (ör. "R U R' U'"): hamle sırasına göre aranır
    var MOVE_RE = /^\s*([RLUDFBMESxyzrludfb]w?2?'?2?\s*)+$/;
    // Büyük/küçük harf ayrımı yapılmaz: telefonda "r u r' u'" yazılsa da bulunur
    function algKey(a) { return " " + String(a || "").replace(/[()\[\]]/g, " ").replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim().toLowerCase() + " "; }
    function search(q) {
        var nq = norm(q); if (!nq) return [];
        var toks = nq.split(" "), flatq = nq.replace(/\s+/g, "");
        var asAlg = MOVE_RE.test(q) && q.trim().split(/\s+/).length >= 2 ? algKey(q) : null;
        var out = [];
        index.forEach(function (e) {
            if (asAlg) {
                if (!e.it.a) return;
                var ak = algKey(e.it.a), at = ak.indexOf(asAlg);
                if (at < 0) return;
                out.push({ e: e, sc: (at === 0 ? 30 : 0) - ak.length * 0.2 });
                return;
            }
            var ok = toks.every(function (tk) { return e.hay.indexOf(tk) >= 0; }) || e.flat.indexOf(flatq) >= 0;
            if (!ok) return;
            var sc = 0, tf = e.title.replace(/\s+/g, ""), words = e.title.split(" ");
            if (e.title === nq || tf === flatq) sc += 100;
            else if (e.title.indexOf(nq) === 0 || tf.indexOf(flatq) === 0) sc += 50;
            else if (e.title.indexOf(nq) >= 0) sc += 25;
            toks.forEach(function (tk) { if (words.indexOf(tk) >= 0) sc += 10; }); // başlıkta tam kelime eşleşmesi
            if (e.it.p) sc += 8;
            sc -= e.it.t.length * 0.05;
            out.push({ e: e, sc: sc });
        });
        out.sort(function (a, b) { return b.sc - a.sc; });
        return out.slice(0, 40).map(function (x) { return x.e.it; });
    }
    function render() {
        var q = input.value;
        if (!index) { list.innerHTML = '<p class="sr-msg">' + esc(t("load")) + '</p>'; return; }
        results = search(q); sel = 0;
        if (!q.trim()) { list.innerHTML = '<p class="sr-msg">' + esc(t("hint")) + '</p>'; return; }
        if (!results.length) { list.innerHTML = '<p class="sr-msg">' + esc(t("none")) + '</p>'; return; }
        list.innerHTML = results.map(function (it, i) {
            return '<a class="sr-item' + (i === 0 ? " on" : "") + '" href="' + esc(it.u) + '" role="option">' +
                '<span class="sr-t">' + esc(it.t) + (it.p ? ' <small>' + esc(t("pages")) + '</small>' : "") + '</span>' +
                '<span class="sr-s">' + esc(it.s || "") + '</span>' +
                (it.a ? '<code class="sr-a" dir="ltr">' + esc(it.a) + '</code>' : "") + '</a>';
        }).join("");
    }
    function move(d) {
        var items = list.querySelectorAll(".sr-item"); if (!items.length) return;
        items[sel].classList.remove("on"); sel = (sel + d + items.length) % items.length; items[sel].classList.add("on");
        items[sel].scrollIntoView({ block: "nearest" });
    }
    function build() {
        modal = document.createElement("div");
        modal.className = "sr-modal";
        modal.innerHTML = '<div class="sr-box" role="dialog" aria-modal="true"><div class="sr-top"><span aria-hidden="true">🔍</span>' +
            '<input type="text" inputmode="search" enterkeyhint="search" class="sr-input" autocomplete="off" spellcheck="false"><button type="button" class="sr-x" aria-label="Esc">✕</button></div>' +
            '<div class="sr-list" role="listbox"></div></div>';
        document.body.appendChild(modal);
        input = modal.querySelector(".sr-input"); list = modal.querySelector(".sr-list");
        input.addEventListener("input", render);
        input.addEventListener("keydown", function (e) {
            if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
            else if (e.key === "Enter") { var a = list.querySelectorAll(".sr-item")[sel]; if (a) location.href = a.getAttribute("href"); }
            else if (e.key === "Escape") close();
            e.stopPropagation();
        });
        input.addEventListener("keyup", function (e) { e.stopPropagation(); });
        modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest(".sr-x")) close(); });
    }
    function open() {
        if (!modal) build();
        input.placeholder = t("ph");
        modal.classList.add("open");
        setTimeout(function () { input.focus(); input.select(); }, 30);
        render();
        load().then(render, function () { list.innerHTML = '<p class="sr-msg">✕</p>'; });
    }
    function close() { if (modal) modal.classList.remove("open"); }
    function addButton() {
        var right = document.querySelector(".nav-right"); if (!right || document.getElementById("searchBtn")) return;
        var b = document.createElement("button");
        b.type = "button"; b.id = "searchBtn"; b.className = "search-btn";
        b.innerHTML = '<span aria-hidden="true">🔍</span>';
        b.setAttribute("aria-label", t("btn")); b.title = t("btn") + " (Ctrl+K)";
        b.addEventListener("click", open);
        right.insertBefore(b, document.getElementById("langSwitcher") || right.firstChild);
    }
    // Arama sonucundan gelince: ?case=AD olan kartı bul, ortala ve vurgula
    function flashCase() {
        var m = /[?&]case=([^&#]*)/.exec(location.search); if (!m) return;
        var name = decodeURIComponent(m[1].replace(/\+/g, " ")), tries = 0;
        (function look() {
            var cards = document.querySelectorAll(".case-card"), hit = null;
            for (var i = 0; i < cards.length; i++) {
                var dc = cards[i].getAttribute("data-case") || "";
                if (dc === name || dc.slice(-(name.length + 2)) === "::" + name) { hit = cards[i]; break; }
            }
            if (hit) {
                hit.scrollIntoView({ block: "center", behavior: "smooth" });
                hit.classList.add("case-flash");
                setTimeout(function () { hit.classList.remove("case-flash"); }, 3600);
            } else if (++tries < 40) setTimeout(look, 200);
        })();
    }
    function init() {
        addButton(); flashCase();
        document.addEventListener("keydown", function (e) {
            if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
            if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !e.ctrlKey && !e.metaKey)) { e.preventDefault(); open(); }
        });
        document.addEventListener("site-lang-change", function () {
            var b = document.getElementById("searchBtn"); if (b) { b.setAttribute("aria-label", t("btn")); b.title = t("btn") + " (Ctrl+K)"; }
            if (modal) { input.placeholder = t("ph"); if (modal.classList.contains("open")) render(); }
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
    window.SiteSearch = { open: open };
})();
