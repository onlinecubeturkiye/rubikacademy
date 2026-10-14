/* ============================================================
   ALGORİTMA ANTRENÖRÜ — BLUETOOTH AKILLI KÜP (GAN)
   - gan-web-bluetooth kütüphanesi sadece "Bağlan"a basılınca yüklenir.
   - Küp beyaz üst / yeşil önde tanımlı hamleler gönderir; antrenör
     karıştırmaları sarı üst / yeşil önde tutuşa göredir (z2):
     U<->D, R<->L, F ve B aynı, yön değişmez.
   - Küpün durumu kendi modelimizde izlenir: karıştırma ilerlemesi,
     yanlış hamle düzeltmesi, ilk hamlede süre başlatma, çözülünce durdurma.
   - antrenor.html içindeki global'leri kullanır: state, current, curCase,
     curScramble, startTimer, stopTimer, T, mode.
   ============================================================ */
(function () {
    var LIB_URL = "/js/vendor/gan-web-bluetooth.min.js?v=20261019";
    var MAC_KEY = "trainer-bt-mac-v1";
    var FACES = "URFDLB";
    var MAP = { U: "D", D: "U", R: "L", L: "R", F: "F", B: "B" }; // küp çerçevesi -> sarı üst tutuş

    /* ---------- 3x3 yüz modeli (54 etiket, sadece yüz hamleleri) ---------- */
    var NORMALS = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
    var STK = []; // {p: konum, n: normal, c: renk(yüz)}
    Object.keys(NORMALS).forEach(function (f) {
        var n = NORMALS[f];
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
            var p = n.slice(), k = 0;
            for (var i = 0; i < 3; i++) if (n[i] === 0) { p[i] = k === 0 ? a : b; k++; }
            STK.push({ p: p, n: n, c: f });
        }
    });
    function key(p, n) { return p.join(",") + "|" + n.join(","); }
    var INDEX = {};
    STK.forEach(function (s, i) { INDEX[key(s.p, s.n)] = i; });
    function cross(a, v) { return [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]]; }
    function dot(a, v) { return a[0] * v[0] + a[1] * v[1] + a[2] * v[2]; }
    // yüze bakarken saat yönünde 90°: v' = -(a x v) + a(a.v)
    function rotCW(a, v) { var c = cross(a, v), d = dot(a, v); return [-c[0] + a[0] * d, -c[1] + a[1] * d, -c[2] + a[2] * d]; }
    var PERM = {};
    Object.keys(NORMALS).forEach(function (f) {
        var a = NORMALS[f];
        PERM[f] = STK.map(function (s, i) {
            if (dot(s.p, a) !== 1) return i;
            return INDEX[key(rotCW(a, s.p), rotCW(a, s.n))];
        });
    });
    function solvedModel() { return STK.map(function (s) { return s.c; }); }
    function turn(model, f, q) { // q: 1 = saat yönü, 3 = ters, 2 = çift
        for (var t = 0; t < q; t++) {
            var p = PERM[f], out = new Array(model.length);
            for (var i = 0; i < model.length; i++) out[p[i]] = model[i];
            model = out;
        }
        return model;
    }
    function isSolved(model) {
        for (var i = 0; i < model.length; i++) if (model[i] !== STK[i].c) return false;
        return true;
    }

    /* ---------- durum ---------- */
    var conn = null, sub = null, model = solvedModel(), modelKnown = false;
    var phase = "off";      // off | needSolve | scrambling | ready | solving | done
    var todo = [];          // [{f, q, fix}] yapılacak çeyrek tur sayısı (1 = X, 2 = X2, 3 = X')
    var total = 0;          // karıştırmadaki hamle sayısı
    var gotEvent = false;

    function el(id) { return document.getElementById(id); }
    function txt(k) { return (typeof T === "function") ? T(k) : k; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function fmtMove(f, q) { return f + (q === 2 ? "2" : q === 3 ? "'" : ""); }
    function supported() { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice); }
    function applies() { return conn && mode === "cube" && current && current.cube === "3x3"; }

    function parseScramble(s) {
        return s.trim().split(/\s+/).filter(Boolean).map(function (t) {
            return { f: t[0], q: t.indexOf("2") > 0 ? 2 : t.indexOf("'") > 0 ? 3 : 1, fix: false };
        });
    }

    /* ---------- arayüz ---------- */
    function renderBar() {
        var bar = el("btBar");
        if (!bar) return;
        var on = !!conn;
        bar.classList.toggle("on", on);
        el("btConnect").style.display = on ? "none" : "";
        el("btDisconnect").style.display = on ? "" : "none";
        el("btReset").style.display = on ? "" : "none";
        var st = el("btStatus");
        if (!supported()) { st.textContent = txt("bt_unsupported"); el("btConnect").disabled = true; return; }
        if (!on) { st.textContent = txt("bt_hint"); return; }
        var name = conn.deviceName || "GAN";
        if (current && current.cube !== "3x3") st.textContent = "🟢 " + name + " · " + txt("bt_only3x3");
        else if (mode !== "cube") st.textContent = "🟢 " + name + " · " + txt("bt_cube_mode");
        else st.textContent = "🟢 " + name;
    }

    function renderScramble() {
        if (!applies() || !curScramble) return;
        var box = el("scramble");
        if (phase === "needSolve") {
            box.innerHTML = '<span class="bt-warn">' + esc(txt(modelKnown ? "bt_need_solve" : "bt_unknown")) + '</span>';
            return;
        }
        var orig = parseScramble(curScramble);
        var remainingOrig = todo.filter(function (m) { return !m.fix; });
        var doneCount = orig.length - remainingOrig.length;
        var html = "";
        var fixes = [];
        for (var i = 0; i < todo.length && todo[i].fix; i++) fixes.push(fmtMove(todo[i].f, todo[i].q));
        if (fixes.length) html += '<span class="bt-fix">' + esc(txt("bt_fix")) + " " + esc(fixes.join(" ")) + '</span> ';
        orig.forEach(function (m, i) {
            var cls = i < doneCount ? "bt-done" : (i === doneCount ? "bt-cur" : "");
            var label = fmtMove(m.f, m.q);
            if (i === doneCount && remainingOrig.length && remainingOrig[0].q !== m.q && !fixes.length) cls += " bt-half";
            html += '<span class="' + cls + '">' + label + '</span> ';
        });
        box.innerHTML = html;
    }

    function setHint(k) { var h = el("timerHint"); if (h) h.textContent = txt(k); }

    /* ---------- karıştırma takibi ---------- */
    function startScrambleTracking() {
        todo = parseScramble(curScramble);
        total = todo.length;
        phase = "scrambling";
        renderScramble();
        setHint("bt_hint_scramble");
    }

    window.btOnNewCase = function () {
        renderBar();
        if (!applies()) { phase = "off"; return; }
        if (!modelKnown || !isSolved(model)) { phase = "needSolve"; renderScramble(); setHint("bt_hint_solve"); return; }
        startScrambleTracking();
    };
    window.btOnStateChange = function () { renderBar(); if (applies() && state === "done") phase = "done"; };

    function onMove(face, dir) {
        var f = MAP[FACES[face]];
        var d = dir === 0 ? 1 : 3;
        model = turn(model, f, d);
        if (!applies()) return;
        if (phase === "needSolve") {
            if (modelKnown && isSolved(model)) startScrambleTracking();
            return;
        }
        if (phase === "scrambling") {
            if (todo.length && todo[0].f === f) {
                todo[0].q = (todo[0].q - d + 8) % 4;
                if (todo[0].q === 0) todo.shift();
            } else {
                todo.unshift({ f: f, q: (4 - d) % 4, fix: true });
            }
            // art arda düzeltmelerle aynı yüzde birleşenleri sadeleştir
            if (todo.length > 1 && todo[0].fix && todo[1].f === todo[0].f) {
                var merged = (todo[0].q + todo[1].q) % 4;
                var keepFix = todo[1].fix;
                todo.splice(0, 2);
                if (merged) todo.unshift({ f: f, q: merged, fix: keepFix });
            }
            if (!todo.length) { phase = "ready"; setHint("bt_hint_ready"); }
            renderScramble();
            return;
        }
        if (phase === "ready" && state === "idle") {
            phase = "solving";
            startTimer();
            if (isSolved(model)) { stopTimer(); phase = "done"; }
            return;
        }
        if ((phase === "solving" || state === "running") && state === "running") {
            if (isSolved(model)) { stopTimer(); phase = "done"; }
        }
    }

    /* ---------- bağlantı ---------- */
    function loadLib() {
        if (window.GanBT) return Promise.resolve();
        return new Promise(function (res, rej) {
            var s = document.createElement("script");
            s.src = LIB_URL;
            s.onload = function () { res(); };
            s.onerror = function () { rej(new Error("lib")); };
            document.head.appendChild(s);
        });
    }
    function savedMacs() { try { return JSON.parse(localStorage.getItem(MAC_KEY)) || {}; } catch (e) { return {}; } }
    function macProvider(device, isFallback) {
        var saved = savedMacs()[device.name || "?"];
        if (!isFallback) return Promise.resolve(saved || null);
        var mac = prompt(txt("bt_mac_prompt"), saved || "");
        if (!mac) return Promise.resolve(null);
        mac = mac.trim().toUpperCase();
        if (!/^([0-9A-F]{2}[:\-]){5}[0-9A-F]{2}$/.test(mac)) { alert(txt("bt_mac_bad")); return Promise.resolve(null); }
        return Promise.resolve(mac);
    }

    function connect() {
        if (!supported()) return;
        el("btConnect").disabled = true;
        el("btStatus").textContent = txt("bt_connecting");
        loadLib().then(function () {
            return window.GanBT.connectGanCube(macProvider);
        }).then(function (c) {
            conn = c;
            gotEvent = false;
            try {
                var macs = savedMacs();
                if (c.deviceMAC) { macs[c.deviceName || "?"] = c.deviceMAC; localStorage.setItem(MAC_KEY, JSON.stringify(macs)); }
            } catch (e) {}
            modelKnown = false;
            sub = c.events$.subscribe(function (ev) {
                gotEvent = true;
                if (ev.type === "MOVE") onMove(ev.face, ev.direction);
                else if (ev.type === "FACELETS") {
                    if (!modelKnown) {
                        if (ev.facelets === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB") { model = solvedModel(); modelKnown = true; }
                        window.btOnNewCase();
                    }
                } else if (ev.type === "DISCONNECT") { dropConnection(); }
            });
            c.sendCubeCommand({ type: "REQUEST_FACELETS" });
            setTimeout(function () {
                if (conn === c && !gotEvent) {
                    el("btStatus").textContent = txt("bt_no_data");
                    var macs = savedMacs(); delete macs[c.deviceName || "?"];
                    try { localStorage.setItem(MAC_KEY, JSON.stringify(macs)); } catch (e) {}
                }
            }, 6000);
            el("btConnect").disabled = false;
            renderBar();
            window.btOnNewCase();
        }).catch(function (err) {
            el("btConnect").disabled = false;
            conn = null;
            renderBar();
            if (err && err.name === "NotFoundError") return; // kullanıcı seçim penceresini kapattı
            el("btStatus").textContent = txt("bt_failed");
            console.error("Bluetooth bağlantısı kurulamadı:", err);
        });
    }
    function dropConnection() {
        if (sub) { try { sub.unsubscribe(); } catch (e) {} }
        sub = null; conn = null; phase = "off";
        renderBar();
        if (curScramble) el("scramble").textContent = curScramble;
        if (state === "idle") setHint("hint_ready");
    }
    function disconnect() {
        var c = conn;
        dropConnection();
        if (c) c.disconnect().catch(function () {});
    }
    function markSolved() {
        model = solvedModel(); modelKnown = true;
        if (state === "running") return;
        window.btOnNewCase();
    }

    document.addEventListener("DOMContentLoaded", init);
    if (document.readyState !== "loading") init();
    var inited = false;
    function init() {
        if (inited || !el("btBar")) return;
        inited = true;
        el("btConnect").addEventListener("click", connect);
        el("btDisconnect").addEventListener("click", disconnect);
        el("btReset").addEventListener("click", markSolved);
        renderBar();
    }
    window.btRenderBar = renderBar;
    window.btIsActive = function () { return applies() && phase !== "off"; };
})();
