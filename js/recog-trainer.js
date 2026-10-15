/* Tanıma antrenörü (antrenör sayfasındaki "Tanıma" sekmesi): 3x3 PLL ve OLL modları. tanima-*.json içinde her case için
   küp simülasyonuyla üretilmiş farklı görünümler (AUF, küp döndürme) var; 3B görünümden case seçilir. */
(function () {
    var started = false;
    var V = "20261087";
    var MODES = {
        pll: { file: "tanima-pll.json", key: "recog-pll-v1", set: "pll", thumbs: false },
        oll: { file: "tanima-oll.json", key: "recog-oll-v1", set: "oll", thumbs: true, draw: function (c, s) { return llSvg(c.pattern, "oll", s); } }
    };
    var MODE_KEY = "recog-mode-v1", mode = "pll", cache = {};
    try { if (MODES[localStorage.getItem(MODE_KEY)]) mode = localStorage.getItem(MODE_KEY); } catch (e) {}
    var STATS_KEY = MODES[mode].key;
    var DATA = null, cur = null, startT = 0, raf = 0, answered = false, lastName = null;
    var stats = load();
    function load() { try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { n: 0, ok: 0, sum: 0, streak: 0, cases: {} }; } catch (e) { return { n: 0, ok: 0, sum: 0, streak: 0, cases: {} }; } }
    function save() { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {} }
    function lang() { return localStorage.getItem("site-lang") || "tr"; }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.tanima) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function short(n) { return n.replace(" perm", "").replace(/^OLL /, ""); }
    function diag(c, size) { return MODES[mode].draw ? MODES[mode].draw(c, size) : llSvg(PAT[c.name], "pll", size); }
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
            var mine = window.CustomAlgs ? CustomAlgs.get(MODES[mode].set, "", cur.name) : null;
            document.getElementById("rcRevealDiag").innerHTML = diag(cur, 70);
            document.getElementById("rcRevealName").textContent = cur.name;
            document.getElementById("rcRevealAlg").textContent = mine || cur.alg;
            document.getElementById("rcReveal").classList.add("show");
            document.getElementById("rcNext").focus();
        }
    }
    var PAT = {};
    function renderAnswers() {
        var box = document.getElementById("rcAnswers");
        box.classList.toggle("thumbs", MODES[mode].thumbs);
        if (!MODES[mode].thumbs) {
            box.innerHTML = DATA.cases.map(function (c) { return c.name; }).sort().map(function (n) {
                return '<button type="button" class="rc-ans" data-n="' + esc(n) + '">' + esc(short(n)) + '</button>';
            }).join("");
            return;
        }
        // OLL: alt gruplara göre küçük diyagramlı butonlar
        var html = "", last = null;
        DATA.cases.forEach(function (c) {
            if (c.subset !== last) { last = c.subset; html += '<div class="rc-sub">' + esc(c.subset) + '</div>'; }
            html += '<button type="button" class="rc-ans rc-thumb" data-n="' + esc(c.name) + '" aria-label="' + esc(c.name) + '">' + diag(c, 46) + '<small>' + esc(short(c.name)) + '</small></button>';
        });
        box.innerHTML = html;
    }
    function renderModes() {
        Array.prototype.forEach.call(document.querySelectorAll(".rc-mode"), function (b) {
            var on = b.getAttribute("data-mode") === mode;
            b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        var intro = document.getElementById("rcIntro");
        intro.setAttribute("data-i18n", mode === "pll" ? "intro" : "intro_" + mode);
        intro.textContent = T(intro.getAttribute("data-i18n"), intro.textContent);
    }
    function loadMode(m) {
        mode = m; STATS_KEY = MODES[m].key; stats = load();
        try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
        renderModes(); cancelAnimationFrame(raf);
        var got = cache[m] ? Promise.resolve(cache[m]) : fetch("/icerikler/algoritmalar/" + MODES[m].file + "?v=" + V).then(function (r) { return r.json(); });
        return got.then(function (d) {
            cache[m] = d; if (mode !== m) return;
            DATA = d; lastName = null; renderAnswers(); renderStats(); next();
        });
    }
    document.getElementById("rcModes").addEventListener("click", function (e) {
        var b = e.target.closest(".rc-mode"); if (b && b.getAttribute("data-mode") !== mode) loadMode(b.getAttribute("data-mode")).catch(fail);
    });
    function fail() { document.getElementById("rcFeedback").textContent = T("load_err", "Veriler yüklenemedi."); }
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
    function onLang() { if (DATA) { renderStats(); renderModes(); } }
    function start() {
        if (started) return; started = true;
        fetch("/icerikler/algoritmalar/oll-pll.json?v=" + V).then(function (r) { return r.json(); }).then(function (d) {
            d.pll.forEach(function (g) { g.cases.forEach(function (c) { PAT[c.name] = c.pattern; }); });
            return loadMode(mode);
        }).catch(fail);
    }
    window.RecogTrainer = { start: start, onLang: onLang };
})();
