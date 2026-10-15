/* =========================================================
   PROFİL (profil.js) — hesap bilgisi, ilerleme ve istatistik özeti
   Veriler bu cihazdaki kayıtlardan okunur; giriş yapılınca account.js
   bunları hesapla eşitler.
========================================================= */
(function () {
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.profil) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
    function fmt(ms) { var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }

    // Algoritma setleri: ad, sayfa, toplam case
    var SETS = [
        ["oll", "OLL", "/icerikler/algoritmalar/oll", 57], ["pll", "PLL", "/icerikler/algoritmalar/pll", 21],
        ["2look-2lo", "2-Look OLL", "/icerikler/algoritmalar/2look-oll", 10], ["2look-2lp", "2-Look PLL", "/icerikler/algoritmalar/2look-pll", 6],
        ["f2l", "F2L", "/icerikler/f2l", 8], ["coll", "COLL", "/icerikler/algoritmalar/coll", 42], ["wv", "WV", "/icerikler/algoritmalar/wv", 27],
        ["roux-cmll", "Roux CMLL", "/icerikler/algoritmalar/roux", 0], ["roux-eo", "Roux EO", "/icerikler/algoritmalar/roux", 0],
        ["cll", "CLL", "/icerikler/algoritmalar/cll", 42], ["eg1", "EG-1", "/icerikler/algoritmalar/eg1", 42], ["eg2", "EG-2", "/icerikler/algoritmalar/eg2", 42],
        ["ortega-oll", "Ortega OLL", "/icerikler/algoritmalar/ortega-oll", 7], ["ortega-pbl", "Ortega PBL", "/icerikler/algoritmalar/ortega-pbl", 5],
        ["4x4-parity", "4x4", "/icerikler/algoritmalar/4x4", 0], ["5x5-parity", "5x5", "/icerikler/algoritmalar/5x5", 0],
        ["pyraminx-l3e", "Pyraminx L3E", "/icerikler/algoritmalar/pyraminx", 0], ["pyraminx-l4e", "Pyraminx L4E", "/icerikler/algoritmalar/pyraminx", 0],
        ["skewb-beginner", "Skewb", "/icerikler/algoritmalar/skewb", 0], ["skewb-intermediate", "Skewb +", "/icerikler/algoritmalar/skewb", 0], ["skewb-advanced", "Skewb ++", "/icerikler/algoritmalar/skewb", 0]
    ];
    function progress() {
        var rows = [];
        SETS.forEach(function (s) {
            var o = get("algo-progress-" + s[0]) || {}, known = 0, learning = 0;
            Object.keys(o).forEach(function (k) { if (o[k] === "known") known++; else if (o[k] === "learning") learning++; });
            if (known || learning || s[0] === "oll" || s[0] === "pll") rows.push({ name: s[1], url: s[2], total: s[3], known: known, learning: learning });
        });
        return rows;
    }
    function renderProgress() {
        $("pfProg").innerHTML = progress().map(function (r) {
            var pct = r.total ? Math.round(100 * r.known / r.total) : 0;
            return '<a class="pf-set" href="' + r.url + '"><div class="pf-set-top"><b>' + esc(r.name) + '</b><span>' +
                (r.total ? r.known + " / " + r.total : r.known + " " + esc(T("known_s", "biliyor"))) +
                (r.learning ? ' · <i>' + r.learning + " " + esc(T("learning_s", "öğreniyor")) + '</i>' : "") + '</span></div>' +
                (r.total ? '<div class="pf-bar"><i style="width:' + pct + '%"></i></div>' : "") + '</a>';
        }).join("");
    }
    function renderStats() {
        // Antrenör
        var st = get("trainer-stats-v1") || {}, solves = 0, cases = 0;
        Object.keys(st).forEach(function (set) { var s = st[set] || {}; Object.keys(s).forEach(function (c) { var n = (s[c] && s[c].n) || 0; if (n) { solves += n; cases++; } }); });
        $("pfTrSolves").textContent = solves; $("pfTrCases").textContent = cases;
        // Tanıma
        ["pll", "oll"].forEach(function (m) {
            var r = get("recog-" + m + "-v1") || {};
            $("pfRc" + m).textContent = r.n ? r.n + " · " + Math.round(100 * (r.ok || 0) / r.n) + "%" : "-";
        });
        // Günün karıştırması
        var res = get("daily-results-v1") || {}, days = [], best = null, sum = 0, cnt = 0;
        Object.keys(res).forEach(function (k) {
            var p = k.split(":"); if (p[1] !== "333") return;
            var r = res[k], v = r.pen === "dnf" ? null : r.t + (r.pen === "+2" ? 2000 : 0);
            days.push({ d: p[0], r: r, v: v });
            if (v != null) { cnt++; sum += v; if (best === null || v < best) best = v; }
        });
        days.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
        $("pfDlDays").textContent = days.length;
        $("pfDlBest").textContent = best === null ? "-" : fmt(best);
        $("pfDlAvg").textContent = cnt ? fmt(sum / cnt) : "-";
        $("pfDlList").innerHTML = days.length ? days.slice(0, 7).map(function (x) {
            var lab = x.r.pen === "dnf" ? "DNF" : fmt(x.v) + (x.r.pen === "+2" ? "+" : "");
            return '<div class="pf-row"><span>' + esc(x.d) + '</span><b dir="ltr">' + esc(lab) + '</b></div>';
        }).join("") : '<p class="pf-empty">' + esc(T("no_daily", "Henüz günün karıştırmasını çözmedin.")) + '</p>';
    }
    function renderAccount() {
        var A = window.Account, u = A && A.user(), pending = A && A.isPending();
        $("pfIn").hidden = !u; $("pfOut").hidden = !!u || !!pending; $("pfWait").hidden = !pending || !!u;
        $("pfDanger").hidden = !u;
        if (!u) return;
        var nm = u.displayName || (u.email || "").split("@")[0];
        $("pfAvatar").innerHTML = u.photoURL ? '<img src="' + esc(u.photoURL) + '" alt="" referrerpolicy="no-referrer">' : '<span>' + esc((nm || "?").charAt(0).toUpperCase()) + '</span>';
        $("pfName").textContent = nm;
        $("pfEmail").textContent = u.email || "";
        var isG = (u.providerData || []).some(function (p) { return p.providerId === "google.com"; });
        $("pfProvider").textContent = isG ? "Google" : T("email_login", "E-posta ile giriş");
        try {
            var loc = { tr: "tr-TR", en: "en-GB", fr: "fr-FR", ru: "ru-RU", de: "de-DE", ar: "ar" }[lang()] || "tr-TR";
            $("pfSince").textContent = T("since", "Üyelik:") + " " + new Date(u.metadata.creationTime).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" });
        } catch (e) { $("pfSince").textContent = ""; }
        if (document.activeElement !== $("pfNameIn")) $("pfNameIn").value = (u.displayName || "").slice(0, 20);
    }
    function msg(id, text, kind) { var m = $(id); m.textContent = text || ""; m.className = "pf-msg" + (kind ? " " + kind : ""); }
    function renderAll() { renderAccount(); renderProgress(); renderStats(); }

    function init() {
        $("pfLogin").addEventListener("click", function () { Account.openLogin("login"); });
        $("pfSignup").addEventListener("click", function () { Account.openLogin("signup"); });
        $("pfSaveName").addEventListener("click", function () {
            var v = $("pfNameIn").value.replace(/\s+/g, " ").trim();
            if (v.length < 2 || v.length > 20) { msg("pfNameMsg", T("bad_name", "Ad 2-20 karakter olmalı."), "bad"); return; }
            $("pfSaveName").disabled = true;
            Account.setName(v).then(function () { msg("pfNameMsg", T("saved", "Kaydedildi ✓"), "ok"); renderAccount(); },
                function () { msg("pfNameMsg", T("err", "Bir hata oldu, tekrar dene."), "bad"); })
                .then(function () { $("pfSaveName").disabled = false; });
        });
        $("pfSync").addEventListener("click", function () {
            $("pfSync").disabled = true;
            Account.syncNow().then(function () { msg("pfSyncMsg", T("synced", "Eşitlendi ✓"), "ok"); }).then(function () { $("pfSync").disabled = false; });
        });
        $("pfOutBtn").addEventListener("click", function () {
            Account.signOut().then(function () { renderAll(); });
        });
        $("pfDelete").addEventListener("click", function () {
            if (!confirm(T("del_confirm", "Hesabın ve buluttaki tüm ilerlemen kalıcı olarak silinsin mi? Bu cihazdaki kayıtlar kalır."))) return;
            $("pfDelete").disabled = true;
            Account.deleteAccount().then(function () { msg("pfDelMsg", T("deleted", "Hesabın silindi."), "ok"); renderAll(); },
                function () { msg("pfDelMsg", T("del_err", "Hesap silinemedi. Çıkış yapıp tekrar giriş yaptıktan sonra dene."), "bad"); })
                .then(function () { $("pfDelete").disabled = false; });
        });
        document.addEventListener("account-change", renderAll);
        document.addEventListener("account-synced", renderAll);
        document.addEventListener("site-lang-change", renderAll);
        renderAll();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
