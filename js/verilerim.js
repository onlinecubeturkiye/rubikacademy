/* =========================================================
   VERİLERİM (verilerim.js) — bu tarayıcıdaki ilerlemeyi yedekle / geri yükle / sil
   Yedek dosyası: { app: "rubikacademy", v: 1, date, data: { anahtar: değer } }
   Yedeğe giren kayıtlar: algoritma ilerlemesi ve set seçimleri, antrenör, tanıma, günün
   karıştırması, kendi algoritmaların, sanal küp süreleri, görünüm ayarları (dil, tema, renkler).
   Cihaza özel olanlar (sıralama cihaz kimliği) yedeğe girmez.
========================================================= */
(function () {
    var PREFIX = ["algo-progress-", "algo-set-", "recog-", "trainer-", "roadmap-", "daily-", "vcube-", "custom-algs-"];
    var EXACT = ["site-lang", "theme", "cvd-theme", "cvd-asked"];
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.verilerim) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function mine(k) { return EXACT.indexOf(k) >= 0 || PREFIX.some(function (p) { return k.indexOf(p) === 0; }); }
    function collect() {
        var out = {};
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && mine(k)) out[k] = localStorage.getItem(k); } } catch (e) {}
        return out;
    }
    function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
    // Kayıtlardan kısa özet (sayılar)
    function summary(data) {
        var known = 0, learning = 0, solves = 0, daily = 0, custom = 0, vc = 0;
        Object.keys(data).forEach(function (k) {
            var v = parse(data[k]);
            if (k.indexOf("algo-progress-") === 0 && v && typeof v === "object") {
                Object.keys(v).forEach(function (c) { if (v[c] === "known") known++; else if (v[c] === "learning") learning++; });
            } else if (k === "trainer-stats-v1" && v) {
                Object.keys(v).forEach(function (s) { var o = v[s] || {}; Object.keys(o).forEach(function (c) { solves += (o[c] && o[c].n) || 0; }); });
            } else if (k === "daily-results-v1" && v) daily = Object.keys(v).length;
            else if (k === "custom-algs-v1" && v) custom = Object.keys(v).length;
            else if (k === "vcube-times-v1" && Array.isArray(v)) vc = v.length;
        });
        return [[known, "s_known"], [learning, "s_learning"], [solves, "s_solves"], [daily, "s_daily"], [custom, "s_custom"], [vc, "s_vcube"]];
    }
    function renderSummary() {
        var data = collect(), n = Object.keys(data).length;
        $("vrStats").innerHTML = summary(data).map(function (x) {
            return '<div class="vr-stat"><b>' + x[0] + '</b><span>' + T(x[1]) + '</span></div>';
        }).join("");
        $("vrEmpty").hidden = n > 0;
    }
    function msg(text, kind) { var m = $("vrMsg"); m.textContent = text || ""; m.className = "vr-msg" + (kind ? " " + kind : ""); }
    function pad(x) { return (x < 10 ? "0" : "") + x; }
    function download() {
        var d = new Date(), data = collect();
        var file = { app: "rubikacademy", v: 1, date: d.toISOString(), data: data };
        var blob = new Blob([JSON.stringify(file, null, 1)], { type: "application/json" });
        var name = "rubikacademy-yedek-" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".json";
        var url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        msg(T("saved").replace("{n}", Object.keys(data).length), "ok");
    }
    function restore(file) {
        var r = new FileReader();
        r.onload = function () {
            var j = parse(r.result);
            if (!j || j.app !== "rubikacademy" || !j.data || typeof j.data !== "object") { msg(T("bad_file"), "bad"); return; }
            var keys = Object.keys(j.data).filter(function (k) { return mine(k) && typeof j.data[k] === "string"; });
            if (!keys.length) { msg(T("bad_file"), "bad"); return; }
            var when = ""; try { when = new Date(j.date).toLocaleString(); } catch (e) {}
            var info = summary(j.data).filter(function (x) { return x[0]; }).map(function (x) { return x[0] + " " + T(x[1]).toLocaleLowerCase(); }).join(", ");
            if (!confirm(T("confirm_restore").replace("{d}", when).replace("{i}", info || "-"))) return;
            try { keys.forEach(function (k) { localStorage.setItem(k, j.data[k]); }); } catch (e) { msg(T("err"), "bad"); return; }
            msg(T("restored").replace("{n}", keys.length), "ok");
            setTimeout(function () { location.reload(); }, 900);
        };
        r.onerror = function () { msg(T("err"), "bad"); };
        r.readAsText(file);
    }
    function wipe() {
        if (!confirm(T("confirm_wipe"))) return;
        Object.keys(collect()).forEach(function (k) { if (["site-lang", "theme"].indexOf(k) < 0) { try { localStorage.removeItem(k); } catch (e) {} } });
        msg(T("wiped"), "ok"); renderSummary();
    }
    function init() {
        $("vrDownload").addEventListener("click", download);
        $("vrUpload").addEventListener("click", function () { $("vrFile").click(); });
        $("vrFile").addEventListener("change", function () { if (this.files && this.files[0]) restore(this.files[0]); this.value = ""; });
        $("vrWipe").addEventListener("click", wipe);
        document.addEventListener("site-lang-change", renderSummary);
        renderSummary();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
