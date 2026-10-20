/* =========================================================
   ANA SAYFA (home.js)
   - Giriş bölümündeki 3D küp: kendini karıştırıp adım adım çözer (CSS 3D, kütüphanesiz)
   - Giriş yapan kişiye üstte kişisel özet
   - Site istatistikleri (sayaç animasyonu; üye sayısı admin panelinin config/site'a yazdığı değerden)
========================================================= */
(function () {
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.index) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function json(k) { try { return JSON.parse(ls(k) || "null"); } catch (e) { return null; } }
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- 3D küp ---------- */
    // CSS koordinatları: x sağ, y aşağı, z izleyiciye doğru. U = -y
    var AX = { U: [0, -1, 0], D: [0, 1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
    var COL = { U: "#f5f6f8", D: "#ffd400", R: "#e8262c", L: "#ff7a00", F: "#14a84a", B: "#1e63e9" };
    var FACES = [["F", "translateZ(var(--h))"], ["B", "rotateY(180deg) translateZ(var(--h))"], ["R", "rotateY(90deg) translateZ(var(--h))"],
        ["L", "rotateY(-90deg) translateZ(var(--h))"], ["U", "rotateX(90deg) translateZ(var(--h))"], ["D", "rotateX(-90deg) translateZ(var(--h))"]];
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    // Eksen etrafında dönme matrisi (Rodrigues; CSS rotate3d ile aynı yön)
    function rotM(a, deg) {
        var t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), C = 1 - c, x = a[0], y = a[1], z = a[2];
        return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
    }
    function mulV(m, v) { return [0, 1, 2].map(function (i) { return Math.round(m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]); }); }
    function mulM(a, b) { return [0, 1, 2].map(function (i) { return [0, 1, 2].map(function (j) { return Math.round(a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]); }); }); }

    function Cube(host) {
        var scene = host.closest(".hc-scene"), S = 60; // bir parçanın boyu (px), CSS --s'den
        function unit() { S = parseFloat(getComputedStyle(scene).getPropertyValue("--s")) || 60; }
        unit();
        var pieces = [];
        host.innerHTML = "";
        for (var x = -1; x <= 1; x++) for (var y = -1; y <= 1; y++) for (var z = -1; z <= 1; z++) {
            if (!x && !y && !z) continue;
            var el = document.createElement("div"); el.className = "hc-piece";
            var p0 = [x, y, z];
            FACES.forEach(function (f) {
                var fe = document.createElement("i"); fe.className = "hc-f"; fe.style.transform = f[1];
                if (dot(p0, AX[f[0]]) === 1) { fe.className += " st"; fe.style.setProperty("--c", COL[f[0]]); }
                el.appendChild(fe);
            });
            host.appendChild(el);
            pieces.push({ el: el, p: p0.slice(), m: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] });
        }
        function base(pc) {
            var m = pc.m;
            return "matrix3d(" + [m[0][0], m[1][0], m[2][0], 0, m[0][1], m[1][1], m[2][1], 0, m[0][2], m[1][2], m[2][2], 0].join(",") +
                "," + S * pc.p[0] + "," + S * pc.p[1] + "," + S * pc.p[2] + ",1)";
        }
        function draw(layer, axis, deg) {
            pieces.forEach(function (pc) {
                var b = base(pc);
                pc.el.style.transform = layer && layer.indexOf(pc) >= 0 ? "rotate3d(" + axis.join(",") + "," + deg + "deg) " + b : b;
            });
        }
        draw();
        window.addEventListener("resize", function () { var o = S; unit(); if (o !== S) draw(); });
        // Hamle: yüze bakınca saat yönü = eksen etrafında -90° (CSS'de y aşağı olduğundan işaret ters)
        function turn(mv, ms) {
            var f = mv.charAt(0), q = mv.indexOf("2") > 0 ? 2 : mv.indexOf("'") > 0 ? -1 : 1, a = AX[f];
            var layer = pieces.filter(function (pc) { return dot(pc.p, a) === 1; }), total = -90 * q;
            return new Promise(function (res) {
                var t0 = null;
                function step(ts) {
                    if (t0 == null) t0 = ts;
                    var k = Math.min(1, (ts - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
                    draw(layer, a, total * e);
                    if (k < 1) requestAnimationFrame(step);
                    else {
                        var R = rotM(a, total);
                        layer.forEach(function (pc) { pc.p = mulV(R, pc.p); pc.m = mulM(R, pc.m); });
                        draw(); res();
                    }
                }
                requestAnimationFrame(step);
            });
        }
        return { turn: turn };
    }
    function inv(m) { return m.indexOf("2") > 0 ? m : m.indexOf("'") > 0 ? m.charAt(0) : m + "'"; }
    function randomScramble(n) {
        var F = "URFDLB", opp = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" }, out = [], last = "", prev = "";
        while (out.length < n) {
            var f = F.charAt(Math.floor(Math.random() * 6));
            if (f === last || (f === opp[last] && prev === f)) continue;
            out.push(f + ["", "'", "2"][Math.floor(Math.random() * 3)]); prev = last; last = f;
        }
        return out;
    }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function startCube() {
        var host = $("hcCube"); if (!host || !host.animate && !window.requestAnimationFrame) return;
        var cube = Cube(host);
        if (reduce) return;
        var visible = true, label = $("hcLabel");
        if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(host);
        function idle() { return new Promise(function (r) { (function chk() { if (visible && !document.hidden) r(); else setTimeout(chk, 500); })(); }); }
        function setLabel(t) { if (label) label.textContent = t; }
        function run(list, ms) { return list.reduce(function (p, mv) { return p.then(idle).then(function () { setLabel(mv); return cube.turn(mv, ms); }); }, Promise.resolve()); }
        (function loop() {
            var sc = randomScramble(18);
            wait(1200).then(function () { if (label) label.parentNode.classList.add("scr"); return run(sc, 110); })
                .then(function () { setLabel(T("cubeSolving", "Çözülüyor…")); if (label) label.parentNode.classList.remove("scr"); return wait(700); })
                .then(function () { return run(sc.slice().reverse().map(inv), 300); })
                .then(function () { setLabel("✓ " + T("cubeSolved", "Çözüldü!")); return wait(2600); })
                .then(loop);
        })();
    }

    /* ---------- kişisel özet (giriş yapan) ---------- */
    function knownCount() {
        var n = 0;
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("algo-progress-") === 0) { var o = json(k) || {}; for (var c in o) if (o[c] === "known") n++; } } } catch (e) {}
        return n;
    }
    function trainerSolves() {
        var tr = json("trainer-stats-v1") || {}, n = 0;
        for (var s in tr) { var cs = tr[s]; if (cs && typeof cs === "object") for (var c in cs) { var v = cs[c] && cs[c].n; if (typeof v === "number") n += v; } }
        return n;
    }
    function dailyDone() {
        var d = new Date(), pad = function (x) { return (x < 10 ? "0" : "") + x; }, t = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
        var r = json("daily-results-v1") || {};
        return Object.keys(r).some(function (k) { return k.split(":")[0] === t; });
    }
    function renderMe() {
        var box = $("hMe"); if (!box) return;
        var u = window.Account && Account.user && Account.user();
        if (!u) { box.hidden = true; return; }
        var prof = json("ra-profile-v1") || {}, name = (prof.name || u.displayName || (u.email || "").split("@")[0] || "").split(" ")[0];
        var last = json("ra-last-page"), dd = dailyDone();
        box.innerHTML = '<div class="h-me-hi">👋 ' + esc(T("meHi", "Tekrar hoş geldin") + (name ? ", " + name : "")) + '!</div>' +
            '<div class="h-me-row">' +
            '<a class="h-chip" href="/icerikler/algoritmalar"><b>' + knownCount() + '</b><span>' + esc(T("meKnown", "bildiğin algoritma")) + '</span></a>' +
            '<a class="h-chip" href="/icerikler/algoritmalar/antrenor"><b>' + trainerSolves() + '</b><span>' + esc(T("meSolves", "antrenör çözümü")) + '</span></a>' +
            '<a class="h-chip' + (dd ? " ok" : " todo") + '" href="/icerikler/gunluk"><b>' + (dd ? "✓" : "📅") + '</b><span>' + esc(dd ? T("meDailyDone", "Günün karıştırması tamam") : T("meDailyTodo", "Günün karıştırması seni bekliyor")) + '</span></a>' +
            '</div>' +
            (last && last.p ? '<a class="h-me-cont" href="' + esc(last.p) + '">↩ ' + esc(T("meContinue", "Kaldığın yerden devam et")) + ': <b>' + esc(last.t || last.p) + '</b></a>' : "");
        box.hidden = false;
    }

    /* ---------- istatistikler ---------- */
    function countUp(el, to, suffix) {
        if (!el) return;
        if (reduce || !("IntersectionObserver" in window)) { el.textContent = to.toLocaleString("tr-TR") + (suffix || ""); return; }
        var io = new IntersectionObserver(function (es) {
            if (!es[0].isIntersecting) return; io.disconnect();
            var t0 = performance.now();
            (function step(now) {
                var k = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - k, 3);
                el.textContent = Math.round(to * e).toLocaleString("tr-TR") + (suffix || "");
                if (k < 1) requestAnimationFrame(step);
            })(t0);
        });
        io.observe(el);
    }
    function stats() {
        countUp($("stAlg"), 1400, "+");
        countUp($("stCubes"), 8);
        // Üye sayısı: admin paneli config/site.members'a yazar; bakım kontrolünün önbelleğinden okunur (ek okuma yok)
        var tries = 0;
        (function read() {
            var c = json("ra-cfg-cache"), m = c && c.c && c.c.members;
            if (m) { $("stMemWrap").hidden = false; countUp($("stMem"), m, "+"); return; }
            if (++tries < 6) setTimeout(read, 1000);
        })();
    }

    function init() {
        startCube(); stats(); renderMe();
        if (window.Account && Account.onChange) Account.onChange(function () { renderMe(); });
        document.addEventListener("account-synced", renderMe);
        document.addEventListener("site-lang-change", renderMe);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
