/* =========================================================
   EOLR (eolr.js) — Roux 4a + 4b tek adımda
   eolr.json: 960 vaka -> en kısa M/U algoritması (54 etiketlik simülasyonla
   genişlik öncelikli aramayla bulundu ve doğrulandı).
   Anahtar: UF UB UL UR DF DB yuvaları sırasıyla, her biri:
     o / x : M katmanı kenarı (UF, UB, DF, DB parçalarından biri), yönü doğru / ters
     L / l : UL kenarı, doğru / ters      R / r : UR kenarı, doğru / ters
   Varsayım: köşeler yerinde (AUF yapılmış), sarı ya da beyaz merkez üstte.
========================================================= */
(function () {
    var V = "20261086";
    var SLOTS = ["UF", "UB", "UL", "UR", "DF", "DB"];
    var CYCLE = ["o", "x", "L", "l", "R", "r"];
    var COL = { Y: "#f6c719", L: "#d12d28", R: "#ff7a1a", M: "#9aa1ad", X: "#4b515c" };
    var state = { UF: "o", UB: "o", UL: "L", UR: "R", DF: "o", DB: "o" }, table = null, hideAlg = false;
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.eolr) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function key() { return SLOTS.map(function (s) { return state[s]; }).join(""); }
    // Yuvadaki kenarın görünen iki rengi: [üst/alt yüzdeki, yandaki]
    function colors(c) {
        switch (c) {
            case "o": return [COL.Y, COL.M];
            case "x": return [COL.M, COL.Y];
            case "L": return [COL.Y, COL.L];
            case "l": return [COL.L, COL.Y];
            case "R": return [COL.Y, COL.R];
            case "r": return [COL.R, COL.Y];
        }
    }
    function label(c) { return { o: "✓", x: "✗", L: "L✓", l: "L✗", R: "R✓", r: "R✗" }[c]; }
    function render() {
        SLOTS.forEach(function (s) {
            var b = $("slot" + s), c = colors(state[s]);
            b.querySelector(".fa").style.background = c[0];
            b.querySelector(".sd").style.background = c[1];
            b.querySelector(".lb").textContent = label(state[s]);
            b.setAttribute("aria-label", s + " " + label(state[s]));
        });
        var k = key(), bad = k.replace(/[oLR]/g, "").length;
        var nL = (k.match(/[Ll]/g) || []).length, nR = (k.match(/[Rr]/g) || []).length;
        var out = $("eoAlg"), msg = $("eoMsg");
        out.classList.remove("hid");
        if (nL !== 1 || nR !== 1) { out.textContent = "—"; msg.textContent = T("e_lr", "Tam olarak bir L ve bir R kenarı olmalı."); msg.className = "eo-msg bad"; return; }
        if (bad % 2) { out.textContent = "—"; msg.textContent = T("e_odd", "Ters kenar sayısı çift olmalı: tek sayıda ters kenar olamaz."); msg.className = "eo-msg bad"; return; }
        if (!table) { out.textContent = "…"; msg.textContent = ""; return; }
        var a = table[k];
        if (a === undefined) { out.textContent = "—"; msg.textContent = T("e_none", "Bu durum bulunamadı."); msg.className = "eo-msg bad"; return; }
        out.textContent = a || T("solved", "Zaten çözülmüş: EOLR gerekmez.");
        if (hideAlg && a) out.classList.add("hid");
        var n = a ? a.split(" ").length : 0;
        msg.textContent = n ? T("moves", "{n} hamle").replace("{n}", n) + " · " + T("bad_n", "{n} ters kenar").replace("{n}", bad) : "";
        msg.className = "eo-msg";
    }
    function randomCase() {
        var keys = Object.keys(table || {}).filter(function (k) { return table[k]; });
        if (!keys.length) return;
        var k = keys[Math.floor(Math.random() * keys.length)];
        SLOTS.forEach(function (s, i) { state[s] = k.charAt(i); });
        hideAlg = true; render();
    }
    function init() {
        SLOTS.forEach(function (s) {
            $("slot" + s).addEventListener("click", function () {
                state[s] = CYCLE[(CYCLE.indexOf(state[s]) + 1) % CYCLE.length];
                hideAlg = false; render();
            });
        });
        $("eoRandom").addEventListener("click", randomCase);
        $("eoReset").addEventListener("click", function () { state = { UF: "o", UB: "o", UL: "L", UR: "R", DF: "o", DB: "o" }; hideAlg = false; render(); });
        $("eoAlg").addEventListener("click", function () { if (hideAlg) { hideAlg = false; render(); } });
        document.addEventListener("site-lang-change", render);
        render();
        fetch("/icerikler/algoritmalar/eolr.json?v=" + V).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (j) { table = j; render(); })
            .catch(function () { $("eoMsg").textContent = T("load_error", "Veri yüklenemedi."); $("eoMsg").className = "eo-msg bad"; });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
