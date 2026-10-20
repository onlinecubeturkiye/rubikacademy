/* =========================================================
   ANA SAYFA (home.js)
   - Giriş bölümünde günün karıştırması kartı (karıştırma, görsel, bugün kaç kişi çözdü)
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

    /* ---------- günün karıştırması kartı (gunluk.js ile aynı üretim: herkes aynı karıştırmayı görür) ---------- */
    var COLOR = { U: "#eef2f3", R: "#d12d28", F: "#179e4f", D: "#f6c719", L: "#ff7a1a", B: "#2c6fe6" };
    var NET = [["U", 1, 0], ["L", 0, 1], ["F", 1, 1], ["R", 2, 1], ["B", 3, 1], ["D", 1, 2]];
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function scramble(day) {
        var r = rng(hash("rubikacademy:333:" + day)), sfx = ["", "'", "2"], out = [], faces = "URFDLB", last = -1, prev = -1;
        while (out.length < 20) {
            var f = Math.floor(r() * 6);
            if (f === last || (f % 3 === last % 3 && f % 3 === prev % 3)) continue;
            out.push(faces[f] + sfx[Math.floor(r() * 3)]); prev = last; last = f;
        }
        return out.join(" ");
    }
    function netHtml(alg) {
        if (typeof Cube === "undefined") return "";
        var c = new Cube(); c.move(alg);
        var st = c.asString();
        return NET.map(function (n) {
            var fi = "URFDLB".indexOf(n[0]), h = '<div class="dn-f" style="grid-column:' + (n[1] + 1) + ';grid-row:' + (n[2] + 1) + '">';
            for (var i = 0; i < 9; i++) h += '<i style="background:' + COLOR[st[fi * 9 + i]] + '"></i>';
            return h + "</div>";
        }).join("");
    }
    function fmtT(r) {
        if (!r) return "";
        if (r.pen === "dnf") return "DNF";
        var ms = r.t + (r.pen === "+2" ? 2000 : 0), s = ms / 1000;
        var txt = s < 60 ? s.toFixed(2) : Math.floor(s / 60) + ":" + (s % 60).toFixed(2).padStart(5, "0");
        return txt + (r.pen === "+2" ? "+" : "");
    }
    // Bugün kaç kişi gönderdi: tek okumalık sayım sorgusu, 5 dk önbellek
    function solvedCount() {
        var cfg = window.RA_FIREBASE || {}; if (!cfg.apiKey) return Promise.resolve(null);
        var d = new Date(), day = String(Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000));
        var c = json("ra-daily-count"); if (c && c.day === day && Date.now() - c.at < 5 * 60000) return Promise.resolve(c.n);
        var url = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents/days/" + day + ":runAggregationQuery?key=" + encodeURIComponent(cfg.apiKey);
        var body = { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: "times" }] }, aggregations: [{ alias: "n", count: {} }] } };
        return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (a) {
            var x = a && a[0] && a[0].result && a[0].result.aggregateFields && a[0].result.aggregateFields.n; if (!x) return null;
            var n = +x.integerValue; try { localStorage.setItem("ra-daily-count", JSON.stringify({ day: day, n: n, at: Date.now() })); } catch (e) {}
            return n;
        }, function () { return null; });
    }
    function renderDaily() {
        var box = $("hDaily"); if (!box) return;
        var day = today(), sc = scramble(day), res = (json("daily-results-v1") || {})[day + ":333"];
        var dt = new Date(); var dateTxt = dt.toLocaleDateString(lang() === "ar" ? "ar" : lang(), { day: "numeric", month: "long" });
        box.innerHTML = '<div class="hd-top"><span class="hd-kick">📅 ' + esc(T("dailyTitle", "Günün karıştırması")) + '</span><span class="hd-date">' + esc(dateTxt) + '</span></div>' +
            '<div class="hd-net" aria-hidden="true">' + netHtml(sc) + '</div>' +
            '<div class="hd-scr" dir="ltr">' + esc(sc) + '</div>' +
            '<div class="hd-foot"><span class="hd-count" id="hdCount"></span>' +
            (res ? '<span class="hd-mine">✓ ' + esc(T("dailyYours", "Senin süren")) + ': <b>' + esc(fmtT(res)) + '</b></span><a class="btn btn-secondary hd-btn" href="/icerikler/gunluk">' + esc(T("dailyBoard", "Sıralamayı gör →")) + '</a>'
                 : '<a class="btn btn-primary hd-btn" href="/icerikler/gunluk">' + esc(T("dailyGo", "Hemen çöz →")) + '</a>') + '</div>';
        solvedCount().then(function (n) {
            var e = $("hdCount"); if (!e || n == null) return;
            e.textContent = n ? "👥 " + T("dailyCount", "{n} kişi bugün çözdü").replace("{n}", n) : "🚀 " + T("dailyFirst", "İlk çözen sen ol!");
        });
    }

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
        // Üye sayısı: admin paneli config/site.members'a yazar; bakım kontrolünün önbelleğinden okunur (ek okuma yok)
        var tries = 0;
        (function read() {
            var c = json("ra-cfg-cache"), m = c && c.c && c.c.members;
            if (m) {
                // üye sayısı biliniyorsa "6 dil" kutusunun yerine geçer
                $("stMemIc").textContent = "👥"; var l = $("stMemL"); l.setAttribute("data-i18n", "statMembers"); l.textContent = T("statMembers", "üye");
                countUp($("stMem"), m, "+"); return;
            }
            if (++tries < 6) setTimeout(read, 1000);
        })();
    }

    function init() {
        renderDaily(); stats(); renderMe();
        if (window.Account && Account.onChange) Account.onChange(function () { renderMe(); });
        document.addEventListener("account-synced", renderMe);
        document.addEventListener("site-lang-change", function () { renderMe(); renderDaily(); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
