/* PLL tanıma antrenörü (antrenör sayfasındaki "PLL Tanıma" sekmesi): tanima-pll.json içinde her PLL için 3x3 simülasyonuyla üretilmiş
   farklı görünümler (ön-AUF, son-AUF, küp döndürme) var; iki yüzlü 3B görünümden case seçilir. */
(function () {
    var started = false;
    var STATS_KEY = "recog-pll-v1";
    var DATA = null, cur = null, startT = 0, raf = 0, answered = false, lastName = null;
    var stats = load();
    function load() { try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { n: 0, ok: 0, sum: 0, streak: 0, cases: {} }; } catch (e) { return { n: 0, ok: 0, sum: 0, streak: 0, cases: {} }; } }
    function save() { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {} }
    function lang() { return localStorage.getItem("site-lang") || "tr"; }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.tanima) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function short(n) { return n.replace(" perm", ""); }
    function cubeSvg(v) {
        var g = DATA.geom, b = g.view, sw = (b[2] / 120).toFixed(3);
        return '<svg viewBox="' + b.join(" ") + '" xmlns="http://www.w3.org/2000/svg">' + g.polys.map(function (p, i) {
            return '<polygon points="' + p.map(function (q) { return q[0] + "," + q[1]; }).join(" ") + '" fill="' + DATA.colors[v.charAt(i)] + '" stroke="#17171f" stroke-width="' + sw + '" stroke-linejoin="round"/>';
        }).join("") + '</svg>';
    }
    function tick() { document.getElementById("rcTimer").textContent = ((performance.now() - startT) / 1000).toFixed(2); raf = requestAnimationFrame(tick); }
    function pick() {
        // zorlandığın ve az gördüğün case'ler daha sık gelir
        var w = DATA.cases.map(function (c) {
            var s = stats.cases[c.name];
            if (c.name === lastName) return 0.2;
            if (!s) return 3;
            return 1 + 3 * (1 - s.ok / s.n) + Math.min(2, (s.sum / Math.max(1, s.ok)) / 2000);
        });
        var tot = w.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * tot;
        for (var i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return DATA.cases[i]; }
        return DATA.cases[0];
    }
    function next() {
        cur = pick(); lastName = cur.name; answered = false;
        var v = cur.views[Math.floor(Math.random() * cur.views.length)];
        document.getElementById("rcCube").innerHTML = cubeSvg(v);
        document.getElementById("rcFeedback").textContent = ""; document.getElementById("rcFeedback").className = "rc-feedback";
        document.getElementById("rcReveal").classList.remove("show");
        Array.prototype.forEach.call(document.querySelectorAll(".rc-ans"), function (b) { b.disabled = false; b.classList.remove("right", "wrong"); });
        cancelAnimationFrame(raf); startT = performance.now(); tick();
    }
    function answer(name, btn) {
        if (answered) return; answered = true;
        cancelAnimationFrame(raf);
        var t = performance.now() - startT, ok = name === cur.name;
        var cs = stats.cases[cur.name] || (stats.cases[cur.name] = { n: 0, ok: 0, sum: 0 });
        stats.n++; cs.n++;
        if (ok) { stats.ok++; stats.sum += t; stats.streak++; cs.ok++; cs.sum += t; } else stats.streak = 0;
        save(); renderStats();
        var fb = document.getElementById("rcFeedback");
        Array.prototype.forEach.call(document.querySelectorAll(".rc-ans"), function (b) {
            b.disabled = true;
            if (b.getAttribute("data-n") === cur.name) b.classList.add("right");
        });
        if (ok) {
            fb.className = "rc-feedback ok"; fb.textContent = "✓ " + short(cur.name) + " · " + (t / 1000).toFixed(2) + " s";
            setTimeout(function () { if (answered) next(); }, 650);
        } else {
            btn.classList.add("wrong");
            fb.className = "rc-feedback bad"; fb.textContent = "✗ " + T("was", "Doğrusu:") + " " + short(cur.name);
            var mine = window.CustomAlgs ? CustomAlgs.get("pll", "", cur.name) : null;
            document.getElementById("rcRevealDiag").innerHTML = llSvg(findPattern(cur.name), "pll", 70);
            document.getElementById("rcRevealName").textContent = cur.name;
            document.getElementById("rcRevealAlg").textContent = mine || cur.alg;
            document.getElementById("rcReveal").classList.add("show");
            document.getElementById("rcNext").focus();
        }
    }
    var PAT = {};
    function findPattern(n) { return PAT[n]; }
    function renderAnswers() {
        document.getElementById("rcAnswers").innerHTML = DATA.cases.map(function (c) { return c.name; }).sort().map(function (n) {
            return '<button type="button" class="rc-ans" data-n="' + esc(n) + '">' + esc(short(n)) + '</button>';
        }).join("");
    }
    function renderStats() {
        document.getElementById("stAcc").textContent = stats.n ? Math.round(100 * stats.ok / stats.n) + "%" : "-";
        document.getElementById("stAvg").textContent = stats.ok ? (stats.sum / stats.ok / 1000).toFixed(2) + " s" : "-";
        document.getElementById("stStreak").textContent = stats.streak;
        document.getElementById("stCount").textContent = stats.n;
        var rows = Object.keys(stats.cases).map(function (k) { var s = stats.cases[k]; return { k: k, acc: s.ok / s.n, avg: s.ok ? s.sum / s.ok : 99999, n: s.n }; })
            .sort(function (a, b) { return a.acc - b.acc || b.avg - a.avg; }).slice(0, 6);
        document.getElementById("weakList").innerHTML = rows.length ? rows.map(function (r) {
            return '<div class="rc-row"><span>' + esc(short(r.k)) + '</span><small>' + Math.round(100 * r.acc) + '% · ' + (r.avg < 99999 ? (r.avg / 1000).toFixed(2) + "s" : "-") + '</small></div>';
        }).join("") : '<p class="rc-empty">' + esc(T("no_stats", "Henüz deneme yok.")) + '</p>';
    }
    document.getElementById("rcAnswers").addEventListener("click", function (e) {
        var b = e.target.closest(".rc-ans"); if (b) answer(b.getAttribute("data-n"), b);
    });
    document.getElementById("rcNext").addEventListener("click", next);
    document.addEventListener("keydown", function (e) { if (!document.getElementById("toolRecog").hidden && answered && (e.key === "Enter" || e.key === " ") && document.getElementById("rcReveal").classList.contains("show")) { e.preventDefault(); next(); } });
    document.getElementById("rcReset").addEventListener("click", function () {
        if (!confirm(T("reset_confirm", "Tanıma istatistikleri silinsin mi?"))) return;
        stats = { n: 0, ok: 0, sum: 0, streak: 0, cases: {} }; save(); renderStats();
    });
    function onLang() { if (DATA) renderStats(); }
    function start() {
    if (started) return; started = true;
    Promise.all([
        fetch("/icerikler/algoritmalar/tanima-pll.json?v=20261057").then(function (r) { return r.json(); }),
        fetch("/icerikler/algoritmalar/oll-pll.json").then(function (r) { return r.json(); })
    ]).then(function (res) {
        DATA = res[0];
        res[1].pll.forEach(function (g) { g.cases.forEach(function (c) { PAT[c.name] = c.pattern; }); });
        renderAnswers(); renderStats(); next();
    }).catch(function () { document.getElementById("rcFeedback").textContent = T("load_err", "Veriler yüklenemedi."); });
    }
    window.RecogTrainer = { start: start, onLang: onLang };
})();
