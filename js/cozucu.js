/* =========================================================
   KÜP ÇÖZÜCÜ (cozucu.js)
   - Renkleri elle gir ya da kamerayla tara
   - Durum doğrulanır, çözüm web worker'da cubejs ile bulunur
   - Çözüm, cubing.js oynatıcısında adım adım gösterilir
   Yüz sırası (cubejs/Kociemba): U R F D L B, her yüz 9 kare, satır satır.
   Tutuş: sarı üstte (U), yeşil önde (F), turuncu sağda (R).
========================================================= */
(function () {
    var V = "20261091";
    var FACES = "URFDLB";
    var COLOR = { U: "#f6c719", R: "#ff7a1a", F: "#179e4f", D: "#eef2f3", L: "#d12d28", B: "#2c6fe6" };
    var CNAME = { U: "c_yellow", R: "c_orange", F: "c_green", D: "c_white", L: "c_red", B: "c_blue" };
    // ağ yerleşimi: [yüz, sütun, satır] (3x3 blok koordinatı)
    var NET = [["U", 1, 0], ["L", 0, 1], ["F", 1, 1], ["R", 2, 1], ["B", 3, 1], ["D", 1, 2]];
    var state = [];       // 54 harf ya da ""
    var paint = "U";
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.cozucu) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

    function blank() { state = []; for (var f = 0; f < 6; f++) for (var i = 0; i < 9; i++) state.push(i === 4 ? FACES[f] : ""); }
    function solvedState() { state = []; for (var f = 0; f < 6; f++) for (var i = 0; i < 9; i++) state.push(FACES[f]); }

    /* ---------- ağ ---------- */
    function buildNet() {
        var net = $("net"), html = "";
        NET.forEach(function (n) {
            var f = n[0], fi = FACES.indexOf(f);
            html += '<div class="nf" style="grid-column:' + (n[1] + 1) + ';grid-row:' + (n[2] + 1) + '" data-face="' + f + '">';
            for (var i = 0; i < 9; i++) {
                var k = fi * 9 + i;
                html += '<button type="button" class="st' + (i === 4 ? " ctr" : "") + '" data-k="' + k + '"' + (i === 4 ? " disabled" : "") + '></button>';
            }
            html += "</div>";
        });
        net.innerHTML = html;
        var down = false;
        net.addEventListener("pointerdown", function (e) { var b = e.target.closest(".st"); if (!b || b.disabled) return; down = true; set(b); try { net.releasePointerCapture(e.pointerId); } catch (x) {} });
        net.addEventListener("pointerover", function (e) { if (!down) return; var b = e.target.closest(".st"); if (b && !b.disabled) set(b); });
        window.addEventListener("pointerup", function () { down = false; });
        net.addEventListener("keydown", function (e) { var b = e.target.closest(".st"); if (b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); set(b); } });
    }
    function set(b) { var k = +b.getAttribute("data-k"); state[k] = paint; renderNet(); clearResult(); }
    function renderNet() {
        Array.prototype.forEach.call(document.querySelectorAll("#net .st"), function (b) {
            var c = state[+b.getAttribute("data-k")];
            b.style.background = c ? COLOR[c] : "";
            b.classList.toggle("empty", !c);
            b.setAttribute("aria-label", c ? T(CNAME[c]) : T("empty", "boş"));
        });
        var n = 0; state.forEach(function (c) { if (!c) n++; });
        $("emptyCount").textContent = n ? T("left", "{n} kare boş").replace("{n}", n) : T("all_set", "Tüm kareler dolu");
    }
    function buildPalette() {
        $("palette").innerHTML = FACES.split("").map(function (f) {
            return '<button type="button" class="pc" data-c="' + f + '" style="background:' + COLOR[f] + '"><span data-i18n="' + CNAME[f] + '">' + esc(T(CNAME[f])) + '</span></button>';
        }).join("");
        $("palette").addEventListener("click", function (e) { var b = e.target.closest(".pc"); if (b) { paint = b.getAttribute("data-c"); renderPalette(); } });
        renderPalette();
    }
    function renderPalette() {
        Array.prototype.forEach.call(document.querySelectorAll(".pc"), function (b) {
            var on = b.getAttribute("data-c") === paint;
            b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
        });
    }

    /* ---------- doğrulama ---------- */
    function validate() {
        var empty = state.filter(function (c) { return !c; }).length;
        if (empty) return T("err_empty", "Önce tüm kareleri doldur ({n} boş).").replace("{n}", empty);
        var cnt = {}; state.forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; });
        var bad = FACES.split("").filter(function (f) { return cnt[f] !== 9; });
        if (bad.length) return T("err_count", "Her renkten tam 9 kare olmalı: ") + bad.map(function (f) { return T(CNAME[f]) + " " + (cnt[f] || 0); }).join(", ");
        var c;
        try { c = Cube.fromString(state.join("")); } catch (e) { return T("err_piece"); }
        function isPerm(a, n) { if (!a || a.length !== n) return false; var s = {}; for (var i = 0; i < n; i++) { if (typeof a[i] !== "number" || s[a[i]]) return false; s[a[i]] = 1; } return true; }
        if (!isPerm(c.cp, 8) || !isPerm(c.ep, 12)) return T("err_piece", "Bazı parçalar gerçek bir küpte olamaz. Renkleri kontrol et.");
        var tw = c.co.reduce(function (a, b) { return a + b; }, 0), fl = c.eo.reduce(function (a, b) { return a + b; }, 0);
        if (tw % 3) return T("err_twist", "Bir köşe kendi yerinde dönmüş görünüyor. Köşe renklerini kontrol et.");
        if (fl % 2) return T("err_flip", "Bir kenar ters görünüyor. Kenar renklerini kontrol et.");
        function par(a) { var p = 0; for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) if (a[i] > a[j]) p ^= 1; return p; }
        if (par(c.cp) !== par(c.ep)) return T("err_parity", "İki parça yer değiştirmiş görünüyor. Renkleri kontrol et.");
        return null;
    }

    /* ---------- çözüm ---------- */
    var worker = null, reqId = 0;
    function getWorker() {
        if (!worker) worker = new Worker("/js/solver-worker.js?v=" + V);
        return worker;
    }
    function setMsg(text, kind) { var m = $("msg"); m.textContent = text || ""; m.className = "msg" + (kind ? " " + kind : ""); }
    function clearResult() { $("result").hidden = true; setMsg(""); }
    function solve() {
        var err = validate();
        if (err) { setMsg(err, "bad"); $("result").hidden = true; return; }
        var f = state.join("");
        if (f === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB") { setMsg(T("already", "Küp zaten çözülmüş! 🎉"), "ok"); $("result").hidden = true; return; }
        var id = ++reqId, w = getWorker(), t0 = performance.now();
        setMsg(T("working", "Çözüm aranıyor… (ilk seferde birkaç saniye sürebilir)"), "");
        $("solveBtn").disabled = true;
        w.onmessage = function (e) {
            var d = e.data;
            if (d.cmd !== "solve" || d.id !== reqId) return;
            $("solveBtn").disabled = false;
            if (!d.ok) { setMsg(T("err_solve", "Çözüm bulunamadı. Renkleri kontrol et."), "bad"); return; }
            showSolution(d.solution.trim(), performance.now() - t0);
        };
        w.onerror = function () { $("solveBtn").disabled = false; setMsg(T("err_solve"), "bad"); };
        w.postMessage({ cmd: "solve", id: id, facelets: f });
    }
    var player = null, lib = null;
    function showSolution(sol, ms) {
        var moves = sol ? sol.split(/\s+/) : [];
        setMsg(T("found", "Çözüm bulundu: {n} hamle").replace("{n}", moves.length), "ok");
        $("solMoves").innerHTML = moves.map(function (m, i) { return '<span class="mv"><small>' + (i + 1) + '</small>' + esc(m) + '</span>'; }).join("");
        $("solText").textContent = sol;
        $("result").hidden = false;
        $("result").scrollIntoView({ behavior: "smooth", block: "start" });
        if (!lib) lib = import("/js/vendor/cubing/twisty.js?v=" + V);
        lib.then(function (m) {
            if (!player) {
                player = new m.TwistyPlayer({ puzzle: "3x3x3", background: "none", controlPanel: "bottom-row", hintFacelets: "none", experimentalSetupAnchor: "end", experimentalSetupAlg: "z2", tempoScale: 1.2 });
                $("solPlayer").appendChild(player);
            }
            player.alg = sol; player.timestamp = 0;
        }).catch(function () { lib = null; });
    }

    /* ---------- örnek karıştırma ---------- */
    function randomScramble() {
        var faces = "URFDLB", sfx = ["", "'", "2"], out = [], last = -1, prev = -1;
        while (out.length < 22) {
            var f = Math.floor(Math.random() * 6);
            if (f === last || (f % 3 === last % 3 && f % 3 === prev % 3)) continue;
            out.push(faces[f] + sfx[Math.floor(Math.random() * 3)]); prev = last; last = f;
        }
        return out.join(" ");
    }
    function example() {
        var s = randomScramble(), c = new Cube(); c.move(s);
        state = c.asString().split("");
        renderNet(); clearResult();
        setMsg(T("example", "Örnek karıştırma: ") + s, "");
    }

    /* ---------- kamera ---------- */
    var ORDER = ["F", "R", "B", "L", "U", "D"];
    var REF = { U: [215, 190, 40], R: [235, 120, 40], F: [30, 150, 80], D: [225, 228, 225], L: [190, 35, 40], B: [35, 90, 200] };
    var stream = null, timer = 0, step = 0, raw = {}, mirror = false, canvas = document.createElement("canvas");
    function lab(rgb) {
        var c = rgb.map(function (v) { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; });
        var x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047, y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722, z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
        function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
        return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
    }
    function refs() { var r = {}; FACES.split("").forEach(function (f) { r[f] = lab(raw[f] ? raw[f][4] : REF[f]); }); return r; }
    function classify(rgb, R) {
        var L = lab(rgb), best = null, bd = 1e9;
        for (var f in R) {
            var q = R[f], dl = (L[0] - q[0]) * 0.6, da = L[1] - q[1], db = L[2] - q[2], d = dl * dl + da * da + db * db;
            if (d < bd) { bd = d; best = f; }
        }
        return best;
    }
    function sample() {
        var v = $("camVideo"), w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) return null;
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(v, 0, 0, w, h);
        var size = Math.min(w, h) * 0.6, x0 = (w - size) / 2, y0 = (h - size) / 2, cell = size / 3, p = Math.max(2, Math.round(cell / 6)), out = [];
        for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
            var cx = Math.round(x0 + (c + 0.5) * cell), cy = Math.round(y0 + (r + 0.5) * cell);
            var d = ctx.getImageData(cx - p, cy - p, 2 * p, 2 * p).data, s = [0, 0, 0], n = 0;
            for (var i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
            out.push([s[0] / n, s[1] / n, s[2] / n]);
        }
        return out;
    }
    function live() {
        var s = sample();
        if (s) {
            var R = refs(), dots = document.querySelectorAll("#camGrid i");
            s.forEach(function (rgb, i) { dots[i].style.setProperty("--c", COLOR[classify(rgb, R)]); });
        }
    }
    function stepText() {
        var f = ORDER[step];
        $("camStep").textContent = step < 6 ? (step + 1) + "/6 · " + T("cam_" + f) : T("cam_done", "Tamam! Renkleri kontrol et, sonra Çöz'e bas.");
        $("camCapture").disabled = step >= 6;
        $("camUndo").disabled = step === 0;
        Array.prototype.forEach.call(document.querySelectorAll("#camDots span"), function (d, i) { d.className = i < step ? "done" : i === step ? "cur" : ""; });
    }
    function reclassifyAll() {
        var R = refs();
        ORDER.slice(0, step).forEach(function (f) {
            var fi = FACES.indexOf(f);
            raw[f].forEach(function (rgb, i) { state[fi * 9 + i] = i === 4 ? f : classify(rgb, R); });
        });
        renderNet(); clearResult();
    }
    function capture() {
        var s = sample(); if (!s || step >= 6) return;
        raw[ORDER[step]] = s; step++;
        reclassifyAll(); stepText();
        if (step >= 6) stopCam(true);
    }
    function undo() {
        if (step === 0) return;
        step--; var f = ORDER[step], fi = FACES.indexOf(f); delete raw[f];
        for (var i = 0; i < 9; i++) state[fi * 9 + i] = i === 4 ? f : "";
        reclassifyAll(); stepText();
        if (!stream) startCam();
    }
    function startCam() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMsg(T("cam_err", "Kamera açılamadı."), "bad"); return; }
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 960 }, height: { ideal: 720 } }, audio: false }).then(function (s) {
            stream = s;
            var v = $("camVideo"); v.srcObject = s; v.play();
            var st = s.getVideoTracks()[0].getSettings ? s.getVideoTracks()[0].getSettings() : {};
            mirror = st.facingMode !== "environment";
            $("camView").classList.toggle("mirror", mirror);
            $("camBox").hidden = false; $("camStart").hidden = true;
            clearInterval(timer); timer = setInterval(live, 180);
            stepText();
        }).catch(function () { setMsg(T("cam_err", "Kamera açılamadı. Tarayıcıya izin ver ya da renkleri elle gir."), "bad"); });
    }
    function stopCam(finished) {
        clearInterval(timer);
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
        if (finished) { $("camBox").hidden = true; $("camStart").hidden = false; setMsg(T("cam_done"), "ok"); }
    }
    function camReset() { stopCam(false); step = 0; raw = {}; }

    /* ---------- sekmeler ---------- */
    function showTab(t) {
        Array.prototype.forEach.call(document.querySelectorAll(".sv-tab"), function (b) { var on = b.getAttribute("data-tab") === t; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
        $("camPanel").hidden = t !== "cam";
        if (t !== "cam") { camReset(); $("camBox").hidden = true; $("camStart").hidden = false; }
    }

    function init() {
        blank(); buildNet(); buildPalette(); renderNet();
        $("solveBtn").addEventListener("click", solve);
        $("clearBtn").addEventListener("click", function () { blank(); renderNet(); clearResult(); camReset(); $("camBox").hidden = true; $("camStart").hidden = false; });
        $("solvedBtn").addEventListener("click", function () { solvedState(); renderNet(); clearResult(); });
        $("exampleBtn").addEventListener("click", example);
        $("camStart").addEventListener("click", function () { if (step >= 6) { camReset(); blank(); renderNet(); } startCam(); });
        $("camCapture").addEventListener("click", capture);
        $("camUndo").addEventListener("click", undo);
        $("camStop").addEventListener("click", function () { stopCam(false); $("camBox").hidden = true; $("camStart").hidden = false; });
        document.querySelector(".sv-tabs").addEventListener("click", function (e) { var b = e.target.closest(".sv-tab"); if (b) showTab(b.getAttribute("data-tab")); });
        document.addEventListener("site-lang-change", function () { renderNet(); if ($("camBox") && !$("camBox").hidden) stepText(); });
        // çözücü tablolarını boşta önceden hazırla
        setTimeout(function () { try { getWorker().postMessage({ cmd: "init" }); } catch (e) {} }, 1500);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
