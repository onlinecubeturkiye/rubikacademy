/* =========================================================
   SANAL 3D KÜP (sanal-kup.js)
   - Görünüm: cubing.js TwistyPlayer (MPL-2.0, /js/vendor/cubing/), sarı üstte, yeşil önde
   - Hamleler klavye (csTimer ile aynı tuşlar), ekrandaki butonlar ya da küpe tıklayarak yapılır
   - Küpün durumu burada 54 etiketlik bir modelde izlenir: çözülünce süre durur
     (dönüşler ve orta katman hamleleri dahil; çözülmüşlük yönden bağımsız kontrol edilir)
   - Son süreler: localStorage "vcube-times-v1"
========================================================= */
(function () {
    var V = "20261092";
    var TIMES_KEY = "vcube-times-v1";
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.sanal_kup) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }

    /* ---------- 54 etiketlik model ---------- */
    var N = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
    var STK = [], IDX = {};
    function key(p, n) { return p.join(",") + "|" + n.join(","); }
    Object.keys(N).forEach(function (f) {
        var n = N[f];
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
            var p = n[0] ? [n[0], a, b] : n[1] ? [a, n[1], b] : [a, b, n[2]];
            IDX[key(p, n)] = STK.length; STK.push({ p: p, n: n });
        }
    });
    function cross(a, v) { return [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]]; }
    function dot(a, v) { return a[0] * v[0] + a[1] * v[1] + a[2] * v[2]; }
    function rot(a, v) { var c = cross(a, v), d = dot(a, v); return [-c[0] + a[0] * d, -c[1] + a[1] * d, -c[2] + a[2] * d]; } // saat yönü (eksene bakınca)
    var LAYER = {
        U: ["U", 1], D: ["D", 1], R: ["R", 1], L: ["L", 1], F: ["F", 1], B: ["B", 1],
        u: ["U", 0], d: ["D", 0], r: ["R", 0], l: ["L", 0], f: ["F", 0], b: ["B", 0],
        M: ["L", "mid"], E: ["D", "mid"], S: ["F", "mid"], x: ["R", "all"], y: ["U", "all"], z: ["F", "all"]
    };
    var PERM = {};
    function perm(base) {
        if (PERM[base]) return PERM[base];
        var L = LAYER[base], a = N[L[0]], P = [];
        STK.forEach(function (s, i) {
            var d = dot(s.p, a);
            var moves = L[1] === "all" || (L[1] === "mid" ? d === 0 : L[1] === 1 ? d === 1 : d >= 0);
            P[i] = moves ? IDX[key(rot(a, s.p), rot(a, s.n))] : i;
        });
        return (PERM[base] = P);
    }
    var state = STK.map(function (s, i) { return i; }); // konum -> etiket
    function parseMove(m) {
        var b = m.charAt(0);
        if (!LAYER[b]) return null;
        var rest = m.slice(1).replace(/w/, ""), q = rest.indexOf("2") >= 0 ? 2 : rest.indexOf("'") >= 0 ? 3 : 1;
        if (/^[UDRLFB]w/.test(m)) b = b.toLowerCase();
        return { b: b, q: q };
    }
    function applyMove(m) {
        var mv = parseMove(m); if (!mv) return;
        var P = perm(mv.b);
        for (var k = 0; k < mv.q; k++) {
            var nw = [];
            for (var i = 0; i < 54; i++) nw[P[i]] = state[i];
            state = nw;
        }
    }
    function colorOf(stickerId) { var n = STK[stickerId].n; return n.join(","); }
    function isSolved() {
        var face = {};
        for (var i = 0; i < 54; i++) {
            var f = STK[i].n.join(","), c = colorOf(state[i]);
            if (face[f] === undefined) face[f] = c; else if (face[f] !== c) return false;
        }
        return true;
    }
    function isRotation(m) { return /^[xyz]/.test(m); }

    /* ---------- karıştırma ---------- */
    function genScramble() {
        var faces = "URFDLB", sfx = ["", "'", "2"], out = [], last = -1, prev = -1;
        while (out.length < 20) {
            var f = Math.floor(Math.random() * 6);
            if (f === last || (f % 3 === last % 3 && f % 3 === prev % 3)) continue;
            out.push(faces[f] + sfx[Math.floor(Math.random() * 3)]); prev = last; last = f;
        }
        return out.join(" ");
    }

    /* ---------- oynatıcı ---------- */
    var player = null, origAdd = null, lib = null;
    function loadLib() {
        if (!lib) lib = import("/js/vendor/cubing/twisty.js?v=" + V).catch(function (e) { lib = null; throw e; });
        return lib;
    }
    function build(m) {
        player = new m.TwistyPlayer({
            puzzle: "3x3x3", visualization: "PG3D", background: "none", controlPanel: "none", hintFacelets: "floating",
            experimentalSetupAlg: "z2", experimentalMovePressInput: "basic", tempoScale: 4
        });
        player.className = "vc-player";
        $("vcStage").appendChild(player);
        // Küpe tıklayarak yapılan hamleler de dahil her hamle modelden geçsin
        var model = player.experimentalModel;
        origAdd = model.experimentalAddMove.bind(model);
        model.experimentalAddMove = function (mv, opts) {
            onMove(String(mv));
            return origAdd(mv, Object.assign({}, opts || {}, { cancel: false }));
        };
        $("vcMsg").hidden = true;
    }

    /* ---------- süre ve durum ---------- */
    var mode = "free", t0 = 0, raf = 0, count = 0, scr = "", history = [];
    function fmt(ms) { var s = ms / 1000; if (s < 60) return s.toFixed(2); var mm = Math.floor(s / 60); return mm + ":" + (s - mm * 60).toFixed(2).padStart(5, "0"); }
    function tick() { $("vcTime").textContent = fmt(performance.now() - t0); raf = requestAnimationFrame(tick); }
    function setStatus(k, vars) {
        var s = T(k);
        if (vars) Object.keys(vars).forEach(function (v) { s = s.replace("{" + v + "}", vars[v]); });
        $("vcStatus").textContent = s;
        $("vcStatus").setAttribute("data-k", k);
        $("vcStatus")._vars = vars || null;
    }
    function loadTimes() { try { return JSON.parse(localStorage.getItem(TIMES_KEY)) || []; } catch (e) { return []; } }
    function renderTimes() {
        var ts = loadTimes(), best = null;
        ts.forEach(function (r) { if (best === null || r.t < best) best = r.t; });
        $("vcBest").textContent = best === null ? "-" : fmt(best);
        $("vcList").innerHTML = ts.slice(-5).reverse().map(function (r) {
            return '<li><b dir="ltr">' + fmt(r.t) + '</b><span>' + r.n + " " + T("moves_s", "hamle") + '</span></li>';
        }).join("") || '<li class="vc-empty">' + T("no_times", "Henüz süre yok.") + '</li>';
    }
    function onMove(m) {
        applyMove(m);
        history.push(m);
        var rotation = isRotation(m);
        if (mode === "scrambled" && !rotation) {
            mode = "solving"; count = 0; t0 = performance.now(); tick(); setStatus("st_solving");
        }
        if (mode === "solving") {
            if (!rotation) count++;
            $("vcCount").textContent = count;
            if (isSolved()) {
                cancelAnimationFrame(raf);
                var t = performance.now() - t0;
                $("vcTime").textContent = fmt(t);
                mode = "free";
                var ts = loadTimes(); ts.push({ t: Math.round(t), n: count, d: Date.now() }); ts = ts.slice(-50);
                try { localStorage.setItem(TIMES_KEY, JSON.stringify(ts)); } catch (e) {}
                renderTimes();
                setStatus("st_done", { t: fmt(t), n: count, tps: (count / (t / 1000)).toFixed(2) });
            }
        }
    }
    function doMove(m) {
        if (!player) return;
        player.experimentalAddMove(m);
    }
    function invert(m) { return /2/.test(m) ? m : /'/.test(m) ? m.replace("'", "") : m + "'"; }
    // Son hamlenin tersini yap; ikisi de geçmişten silinir (art arda geri alınabilsin)
    function undo() {
        if (!history.length) return;
        var last = history.pop();
        doMove(invert(last));
        history.pop();
    }
    function resetModel() { state = STK.map(function (s, i) { return i; }); history = []; }
    function reset() {
        cancelAnimationFrame(raf); mode = "free"; scr = ""; resetModel();
        $("vcScr").textContent = ""; $("vcTime").textContent = "0.00"; $("vcCount").textContent = "0";
        if (player) { player.experimentalSetupAlg = "z2"; player.alg = ""; }
        setStatus("st_free");
    }
    function scramble() {
        cancelAnimationFrame(raf); resetModel();
        scr = genScramble();
        scr.split(" ").forEach(applyMove);
        history = [];
        if (player) { player.experimentalSetupAlg = "z2 " + scr; player.alg = ""; }
        $("vcScr").textContent = scr; $("vcTime").textContent = "0.00"; $("vcCount").textContent = "0";
        mode = isSolved() ? "free" : "scrambled";
        setStatus("st_scr");
    }

    /* ---------- klavye (csTimer ile aynı) ---------- */
    var KEYS = {
        i: "R", k: "R'", j: "U", f: "U'", h: "F", g: "F'", d: "L", e: "L'", s: "D", l: "D'", w: "B", o: "B'",
        u: "r", m: "r'", v: "l", r: "l'", "5": "M", "6": "M", x: "M'", ".": "M'",
        t: "x", y: "x", b: "x'", n: "x'", ";": "y", a: "y'", p: "z", q: "z'"
    };
    var BTNS = ["R", "R'", "U", "U'", "F", "F'", "L", "L'", "D", "D'", "B", "B'", "M", "M'", "x", "x'", "y", "y'", "z", "z'"];
    function keyFor(m) { for (var k in KEYS) if (KEYS[k] === m) return k.toUpperCase(); return ""; }
    function renderButtons() {
        $("vcBtns").innerHTML = BTNS.map(function (m) {
            var k = keyFor(m);
            return '<button type="button" class="vc-btn' + (isRotation(m) ? " rot" : "") + '" data-m="' + m + '"><b>' + m + '</b>' + (k ? '<small>' + k + '</small>' : "") + '</button>';
        }).join("");
    }

    function init() {
        renderButtons(); renderTimes(); setStatus("st_free");
        $("vcMsg").textContent = T("loading", "Yükleniyor…");
        loadLib().then(build).catch(function () { $("vcMsg").textContent = T("load_err", "Küp yüklenemedi."); });
        $("vcBtns").addEventListener("click", function (e) { var b = e.target.closest(".vc-btn"); if (b) doMove(b.getAttribute("data-m")); });
        $("vcScramble").addEventListener("click", scramble);
        $("vcReset").addEventListener("click", reset);
        $("vcUndo").addEventListener("click", undo);
        $("vcClear").addEventListener("click", function () { try { localStorage.removeItem(TIMES_KEY); } catch (e) {} renderTimes(); });
        document.addEventListener("keydown", function (e) {
            if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, textarea, select")) return;
            if (e.key === " ") { e.preventDefault(); scramble(); return; }
            if (e.key === "Escape") { reset(); return; }
            if (e.key === "Backspace") { e.preventDefault(); undo(); return; }
            var m = KEYS[(e.key || "").toLowerCase()];
            if (m) { e.preventDefault(); doMove(m); }
        });
        document.addEventListener("site-lang-change", function () {
            renderTimes();
            var st = $("vcStatus"); setStatus(st.getAttribute("data-k") || "st_free", st._vars);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
    window.VCube = { solved: isSolved, move: doMove, state: function () { return mode; } };
})();
