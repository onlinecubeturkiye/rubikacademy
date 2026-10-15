/* Cross antrenörü (antrenör sayfasındaki "Cross" sekmesi): rastgele karıştırma, 15 sn inceleme, en kısa beyaz artı çözümü (CrossSolver, tarayıcıda BFS) */
(function () {
    var started = false;
    var LEVEL_KEY = "cross-level-v1", STATS_KEY = "cross-stats-v1";
    var level = "all", scr = "", res = null, timer = 0, tEnd = 0;
    try { level = localStorage.getItem(LEVEL_KEY) || "all"; } catch (e) {}
    var stats = (function () { try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { n: 0, opt: 0 }; } catch (e) { return { n: 0, opt: 0 }; } })();
    function lang() { return localStorage.getItem("site-lang") || "tr"; }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.cross) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function el(id) { return document.getElementById(id); }
    function okLevel(n) { return level === "all" || (level === "easy" && n <= 5) || (level === "mid" && n === 6) || (level === "hard" && n >= 7); }
    function newScramble() {
        var s, r, tries = 0;
        do { s = CrossSolver.scramble(20); r = CrossSolver.solve(s, 3); tries++; } while (!okLevel(r.length) && tries < 400);
        scr = s; res = r;
        el("cxScr").textContent = scr;
        el("cxResult").classList.remove("show");
        el("cxSols").innerHTML = ""; el("cxLenText").textContent = "";
        el("cxMine").value = ""; el("cxMsg").textContent = ""; el("cxMsg").className = "cx-msg";
        stopTimer(); el("cxTimer").hidden = true;
    }
    function showLen() {
        el("cxResult").classList.add("show");
        el("cxLenText").innerHTML = T("len", "En kısa çözüm: {n} hamle").replace("{n}", "<b>" + res.length + "</b>");
    }
    function showSol() {
        showLen(); stopTimer();
        el("cxSols").innerHTML = res.solutions.map(function (s) { return "<li>" + s + "</li>"; }).join("");
    }
    function stopTimer() { clearInterval(timer); timer = 0; }
    function startInsp() {
        stopTimer();
        var t = el("cxTimer"); t.hidden = false; t.className = "cx-insp run";
        tEnd = Date.now() + 15000;
        function upd() {
            var left = Math.ceil((tEnd - Date.now()) / 1000);
            if (left <= 0) { t.className = "cx-insp over"; t.textContent = T("time_up", "Süre doldu"); stopTimer(); return; }
            t.textContent = left; t.className = "cx-insp " + (left <= 5 ? "warn" : "run");
        }
        upd(); timer = setInterval(upd, 200);
    }
    function check() {
        var v = el("cxMine").value.replace(/[’‘`]/g, "'").trim(), m = el("cxMsg");
        if (!v) return;
        var d;
        try { d = CrossSolver.distance(scr + " " + v); } catch (e) { m.className = "cx-msg bad"; m.textContent = T("bad_moves", "Hamleleri okuyamadım. Örnek: F R' D2 L"); return; }
        var n = v.split(/\s+/).filter(Boolean).length;
        if (d === 0) {
            stats.n++; if (n <= res.length) stats.opt++;
            try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
            m.className = "cx-msg ok";
            m.textContent = n <= res.length ? T("ok_opt", "✓ Artı çözüldü, {n} hamle: en kısa çözüm!").replace("{n}", n)
                                            : T("ok_long", "✓ Artı çözüldü, {n} hamle (en kısa {m}).").replace("{n}", n).replace("{m}", res.length);
            renderStats();
        } else {
            m.className = "cx-msg bad"; m.textContent = T("not_solved", "✗ Bu hamlelerden sonra beyaz artı tamam değil.");
        }
    }
    function renderStats() {
        el("cxStats").textContent = stats.n ? T("stats", "Kontrol edilen çözüm: {n} · en kısa bulunan: {o}").replace("{n}", stats.n).replace("{o}", stats.opt) : "";
    }
    function renderLevels() {
        Array.prototype.forEach.call(document.querySelectorAll(".cx-lvl"), function (b) { b.classList.toggle("active", b.getAttribute("data-l") === level); });
    }
    el("cxLevels").addEventListener("click", function (e) {
        var b = e.target.closest(".cx-lvl"); if (!b) return;
        level = b.getAttribute("data-l"); try { localStorage.setItem(LEVEL_KEY, level); } catch (err) {}
        renderLevels(); newScramble();
    });
    el("cxInsp").addEventListener("click", startInsp);
    el("cxLen").addEventListener("click", showLen);
    el("cxSol").addEventListener("click", showSol);
    el("cxNew").addEventListener("click", newScramble);
    el("cxCheck").addEventListener("click", check);
    el("cxMine").addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
    function onLang() { renderStats(); if (el("cxResult").classList.contains("show")) showLen(); }
    function start() {
        if (started) return; started = true;
        renderLevels(); renderStats();
        setTimeout(newScramble, 0);
    }
    window.CrossTrainer = { start: start, onLang: onLang };
})();
