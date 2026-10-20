/* =========================================================
   ANA SAYFA (home.js)
   - Giriş yapan kişiye üstte kişisel özet
   - Site istatistikleri (sayaç animasyonu; üye sayısı admin panelinin config/site'a yazdığı değerden)
========================================================= */
(function () {
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.index) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function json(k) { try { return JSON.parse(ls(k) || "null"); } catch (e) { return null; } }
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- kişisel özet (giriş yapan) ---------- */
    function knownCount() {
        var n = 0;
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("algo-progress-") === 0) { var o = json(k) || {}; for (var c in o) if (o[c] === "known") n++; } } } catch (e) {}
        return n;
    }
    function trainerSolves() {
        var tr = json("trainer-stats-v1") || {}, n = 0;
        for (var s in tr) { var cs = tr[s]; if (cs && typeof cs === "object") for (var c in cs) { var v = cs[c] && cs[c].n; if (typeof v === "number") n += v; } }
        return n;
    }
    function dailyDone() {
        var d = new Date(), pad = function (x) { return (x < 10 ? "0" : "") + x; }, t = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
        var r = json("daily-results-v1") || {};
        return Object.keys(r).some(function (k) { return k.split(":")[0] === t; });
    }
    function renderMe() {
        var box = $("hMe"); if (!box) return;
        var u = window.Account && Account.user && Account.user();
        if (!u) { box.hidden = true; return; }
        var prof = json("ra-profile-v1") || {}, name = (prof.name || u.displayName || (u.email || "").split("@")[0] || "").split(" ")[0];
        var last = json("ra-last-page"), dd = dailyDone();
        box.innerHTML = '<div class="h-me-hi">👋 ' + esc(T("meHi", "Tekrar hoş geldin") + (name ? ", " + name : "")) + '!</div>' +
            '<div class="h-me-row">' +
            '<a class="h-chip" href="/icerikler/algoritmalar"><b>' + knownCount() + '</b><span>' + esc(T("meKnown", "bildiğin algoritma")) + '</span></a>' +
            '<a class="h-chip" href="/icerikler/algoritmalar/antrenor"><b>' + trainerSolves() + '</b><span>' + esc(T("meSolves", "antrenör çözümü")) + '</span></a>' +
            '<a class="h-chip' + (dd ? " ok" : " todo") + '" href="/icerikler/gunluk"><b>' + (dd ? "✓" : "📅") + '</b><span>' + esc(dd ? T("meDailyDone", "Günün karıştırması tamam") : T("meDailyTodo", "Günün karıştırması seni bekliyor")) + '</span></a>' +
            '</div>' +
            (last && last.p ? '<a class="h-me-cont" href="' + esc(last.p) + '">↩ ' + esc(T("meContinue", "Kaldığın yerden devam et")) + ': <b>' + esc(last.t || last.p) + '</b></a>' : "");
        box.hidden = false;
    }

    /* ---------- istatistikler ---------- */
    function countUp(el, to, suffix) {
        if (!el) return;
        if (reduce || !("IntersectionObserver" in window)) { el.textContent = to.toLocaleString("tr-TR") + (suffix || ""); return; }
        var io = new IntersectionObserver(function (es) {
            if (!es[0].isIntersecting) return; io.disconnect();
            var t0 = performance.now();
            (function step(now) {
                var k = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - k, 3);
                el.textContent = Math.round(to * e).toLocaleString("tr-TR") + (suffix || "");
                if (k < 1) requestAnimationFrame(step);
            })(t0);
        });
        io.observe(el);
    }
    function stats() {
        countUp($("stAlg"), 1400, "+");
        countUp($("stCubes"), 8);
        // Kullanıcı sayısı = üyeler + hesapsız ziyaretçi cihazları. GitHub Actions saatte bir config/site'a yazar;
        // bakım kontrolünün önbelleğinden okunur (yoksa bir kez config okunur)
        function show(c) {
            var n = c ? (c.members || 0) + (c.visitors || 0) : 0; if (!n) return false;
            $("stMemWrap").hidden = false; $("stMemWrap").parentNode.classList.add("n3");
            countUp($("stMem"), n, "+"); return true;
        }
        var tries = 0;
        (function read() {
            var c = json("ra-cfg-cache");
            if (c && c.c && "visitors" in c.c) { show(c.c); return; }
            if (++tries < 4) { setTimeout(read, 1000); return; }
            if (window.Account && Account.getConfig) Account.getConfig().then(function (cf) {
                try { localStorage.setItem("ra-cfg-cache", JSON.stringify({ at: Date.now(), c: cf })); } catch (e) {}
                show(cf);
            });
        })();
    }

    function init() {
        stats(); renderMe();
        if (window.Account && Account.onChange) Account.onChange(function () { renderMe(); });
        document.addEventListener("account-synced", renderMe);
        document.addEventListener("site-lang-change", renderMe);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
