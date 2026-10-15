/* =========================================================
   GÜNÜN KARIŞTIRMASI + SERİ + ROZETLER (gunluk.js)
   - Karıştırma tarihten üretilir: herkes aynı gün aynı karıştırmayı görür
   - İlk tamamlanan deneme o günün resmi sonucu olur ("daily-results-v1")
   - Seri ve rozetler streak.js ve sitedeki ilerleme kayıtlarından hesaplanır
========================================================= */
(function () {
    var RES_KEY = "daily-results-v1", PZ_KEY = "daily-puzzle-v1";
    var COLOR = { U: "#f6c719", R: "#ff7a1a", F: "#179e4f", D: "#eef2f3", L: "#d12d28", B: "#2c6fe6" };
    var NET = [["U", 1, 0], ["L", 0, 1], ["F", 1, 1], ["R", 2, 1], ["B", 3, 1], ["D", 1, 2]];
    var puzzle = "333";
    try { if (localStorage.getItem(PZ_KEY) === "222") puzzle = "222"; } catch (e) {}
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.gunluk) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function today() { return Streak.dayKey(); }
    function loadRes() { try { return JSON.parse(localStorage.getItem(RES_KEY)) || {}; } catch (e) { return {}; } }
    function saveRes(o) { try { localStorage.setItem(RES_KEY, JSON.stringify(o)); } catch (e) {} }

    /* ---------- tarihten karıştırma ---------- */
    function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function scramble(day, pz) {
        var r = rng(hash("rubikacademy:" + pz + ":" + day)), sfx = ["", "'", "2"], out = [];
        if (pz === "222") {
            var f2 = "RUF", last2 = -1;
            while (out.length < 10) { var g = Math.floor(r() * 3); if (g === last2) continue; out.push(f2[g] + sfx[Math.floor(r() * 3)]); last2 = g; }
            return out.join(" ");
        }
        var faces = "URFDLB", last = -1, prev = -1;
        while (out.length < 20) {
            var f = Math.floor(r() * 6);
            if (f === last || (f % 3 === last % 3 && f % 3 === prev % 3)) continue;
            out.push(faces[f] + sfx[Math.floor(r() * 3)]); prev = last; last = f;
        }
        return out.join(" ");
    }
    function drawNet(alg, pz) {
        var c = new Cube(); c.move(alg);
        var s = c.asString(), html = "", idx = pz === "222" ? [0, 2, 6, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
        NET.forEach(function (n) {
            var fi = "URFDLB".indexOf(n[0]);
            html += '<div class="dn-f' + (pz === "222" ? " two" : "") + '" style="grid-column:' + (n[1] + 1) + ';grid-row:' + (n[2] + 1) + '">';
            idx.forEach(function (i) { html += '<i style="background:' + COLOR[s[fi * 9 + i]] + '"></i>'; });
            html += "</div>";
        });
        $("dNet").innerHTML = html;
    }

    /* ---------- zamanlayıcı ---------- */
    var state = "idle", t0 = 0, raf = 0, holdT = 0, last = 0;
    function fmt(ms) { if (ms == null) return "-"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function show(ms) { $("dTimer").textContent = fmt(ms); }
    function tick() { show(performance.now() - t0); raf = requestAnimationFrame(tick); }
    function setState(s) { state = s; $("dTimerBox").setAttribute("data-state", s); $("dHint").textContent = T("hint_" + s); }
    function press() {
        if (state === "running") { stop(); return; }
        if (state !== "idle" && state !== "done") return;
        setState("hold"); show(0);
        holdT = setTimeout(function () { if (state === "hold") setState("ready"); }, 300);
    }
    function release() {
        if (state === "hold") { clearTimeout(holdT); setState(last ? "done" : "idle"); if (last) show(last); return; }
        if (state === "ready") { setState("running"); t0 = performance.now(); tick(); }
    }
    function stop() {
        cancelAnimationFrame(raf); last = performance.now() - t0; show(last); setState("done");
        var res = loadRes(), k = today(), key = k + ":" + puzzle;
        if (!res[key]) {
            res[key] = { t: Math.round(last), pen: "" };
            saveRes(res); Streak.mark("daily");
        }
        renderAll();
    }

    /* ---------- görünüm ---------- */
    function official() { return loadRes()[today() + ":" + puzzle] || null; }
    function value(r) { if (!r) return null; if (r.pen === "dnf") return Infinity; return r.t + (r.pen === "+2" ? 2000 : 0); }
    function label(r) { if (!r) return "-"; if (r.pen === "dnf") return "DNF"; return fmt(value(r)) + (r.pen === "+2" ? "+" : ""); }
    function renderToday() {
        var day = today(), scr = scramble(day, puzzle);
        var d = new Date(), loc = { tr: "tr-TR", en: "en-GB", fr: "fr-FR", ru: "ru-RU", de: "de-DE", ar: "ar" }[lang()] || "tr-TR";
        $("dDate").textContent = d.toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", weekday: "long" });
        $("dScr").textContent = scr;
        drawNet(scr, puzzle);
        Array.prototype.forEach.call(document.querySelectorAll(".d-pz"), function (b) { var on = b.getAttribute("data-pz") === puzzle; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
        var r = official();
        $("dOfficial").hidden = !r;
        if (r) {
            $("dOffTime").textContent = label(r);
            $("dPen2").classList.toggle("on", r.pen === "+2");
            $("dPenDnf").classList.toggle("on", r.pen === "dnf");
        }
        if (state !== "running" && state !== "hold" && state !== "ready") { show(r ? value(r) === Infinity ? null : value(r) : 0); if (r && r.pen === "dnf") $("dTimer").textContent = "DNF"; setState(r ? "done" : "idle"); last = r ? r.t : 0; }
        $("dNote").textContent = r ? T("note_done", "Bugünün resmi sonucu kaydedildi. İstersen tekrar çözebilirsin; yeni denemeler kaydedilmez.") : T("note_first", "İlk tamamladığın deneme bugünün resmi sonucu olur.");
    }
    function renderStreak() {
        $("sCur").textContent = Streak.current();
        $("sBest").textContent = Streak.best();
        $("sDays").textContent = Streak.totals().days;
        var days = Streak.days(), now = new Date(), html = "";
        // son 5 hafta, pazartesiden başlayarak
        var start = Streak.shift(now, -((now.getDay() + 6) % 7) - 28);
        for (var i = 0; i < 35; i++) {
            var d = Streak.shift(start, i), k = Streak.dayKey(d), a = days[k], n = a ? (a.alg || 0) + (a.recog || 0) + (a.daily || 0) * 5 : 0;
            var lvl = !a ? 0 : n < 10 ? 1 : n < 40 ? 2 : 3;
            var future = d > now;
            html += '<i class="l' + lvl + (future ? " fut" : "") + (k === today() ? " today" : "") + '" title="' + k + (a ? " · " + n : "") + '"></i>';
        }
        $("sCal").innerHTML = html;
    }
    function knownCount(key) { try { var o = JSON.parse(localStorage.getItem(key)) || {}; return Object.keys(o).filter(function (k) { return o[k] === "known"; }).length; } catch (e) { return 0; } }
    function bestDaily(pz) { var res = loadRes(), b = Infinity; Object.keys(res).forEach(function (k) { if (k.split(":")[1] === pz) b = Math.min(b, value(res[k])); }); return b; }
    var BADGES = [
        ["first", "🌅", function (t) { return t.daily >= 1; }],
        ["streak3", "🔥", function () { return Streak.best() >= 3; }],
        ["streak7", "💪", function () { return Streak.best() >= 7; }],
        ["streak30", "🏆", function () { return Streak.best() >= 30; }],
        ["days10", "📅", function (t) { return t.days >= 10; }],
        ["sub30", "⚡", function () { return bestDaily("333") < 30000; }],
        ["sub20", "🚀", function () { return bestDaily("333") < 20000; }],
        ["sub5_2", "🎯", function () { return bestDaily("222") < 5000; }],
        ["alg100", "🧠", function (t) { return t.alg >= 100; }],
        ["alg1000", "🤖", function (t) { return t.alg >= 1000; }],
        ["recog200", "👁", function (t) { return t.recog >= 200; }],
        ["pll", "🟢", function () { return knownCount("algo-progress-pll") >= 21; }],
        ["oll", "🟡", function () { return knownCount("algo-progress-oll") >= 57; }]
    ];
    function renderBadges() {
        var t = Streak.totals(), got = 0;
        $("bGrid").innerHTML = BADGES.map(function (b) {
            var on = false; try { on = b[2](t); } catch (e) {}
            if (on) got++;
            return '<div class="bd' + (on ? " on" : "") + '"><span class="bi">' + b[1] + '</span><b>' + esc(T("b_" + b[0])) + '</b><small>' + esc(T("bd_" + b[0])) + '</small></div>';
        }).join("");
        $("bCount").textContent = got + " / " + BADGES.length;
    }
    function renderHistory() {
        var res = loadRes(), rows = Object.keys(res).filter(function (k) { return k.split(":")[1] === puzzle; }).sort().reverse().slice(0, 7);
        $("hList").innerHTML = rows.length ? rows.map(function (k) { return '<div class="h-row"><span>' + esc(k.split(":")[0]) + '</span><b>' + esc(label(res[k])) + '</b></div>'; }).join("") : '<p class="h-empty">' + esc(T("no_hist", "Henüz sonuç yok.")) + '</p>';
    }
    function renderAll() { renderToday(); renderStreak(); renderBadges(); renderHistory(); }

    function setPen(p) {
        var res = loadRes(), key = today() + ":" + puzzle; if (!res[key]) return;
        res[key].pen = res[key].pen === p ? "" : p; saveRes(res); state = "idle"; renderAll();
    }
    function share() {
        var r = official(); if (!r) return;
        var txt = T("share_txt", "Rubik Academy · Günün Karıştırması") + " (" + (puzzle === "222" ? "2x2" : "3x3") + ", " + today() + "): " + label(r) + " ⏱️ · 🔥 " + Streak.current() + "\nhttps://rubikacademy.fun/icerikler/gunluk";
        var done = function () { $("dShare").textContent = T("copied", "Kopyalandı ✓"); setTimeout(function () { $("dShare").textContent = T("share", "📤 Paylaş"); }, 1600); };
        if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {}); 
    }

    function init() {
        var box = $("dTimerBox");
        document.addEventListener("keydown", function (e) {
            if (e.target.closest("input, textarea, button, a") && e.code !== "Space") return;
            if (e.code === "Space") { e.preventDefault(); if (!e.repeat) press(); }
            else if (state === "running") stop();
        });
        document.addEventListener("keyup", function (e) { if (e.code === "Space") { e.preventDefault(); release(); } });
        box.addEventListener("touchstart", function (e) { e.preventDefault(); press(); }, { passive: false });
        box.addEventListener("touchend", function (e) { e.preventDefault(); release(); }, { passive: false });
        box.addEventListener("mousedown", function () { press(); });
        box.addEventListener("mouseup", function () { release(); });
        document.querySelector(".d-pzs").addEventListener("click", function (e) {
            var b = e.target.closest(".d-pz"); if (!b || state === "running") return;
            puzzle = b.getAttribute("data-pz"); try { localStorage.setItem(PZ_KEY, puzzle); } catch (x) {}
            state = "idle"; last = 0; renderAll(); b.blur();
        });
        $("dPen2").addEventListener("click", function () { setPen("+2"); });
        $("dPenDnf").addEventListener("click", function () { setPen("dnf"); });
        $("dShare").addEventListener("click", share);
        document.addEventListener("site-lang-change", renderAll);
        renderAll();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
