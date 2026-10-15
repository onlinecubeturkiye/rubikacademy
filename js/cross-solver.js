/* =========================================================
   CROSS ÇÖZÜCÜ (cross-solver.js)
   Beyaz artı (D yüzü) için en kısa çözüm. Küp sarı üstte, yeşil önde tutulur.
   Durum: 4 beyaz kenarın (DR, DF, DL, DB) yeri ve yönü → 190 080 durum.
   Tarayıcı ilk kullanımda çözülmüş durumdan BFS ile mesafe tablosu kurar (~0,1 sn).
   Kenar numaraları ve hamle tabloları Kociemba'nın küp modelindendir:
   0 UR, 1 UF, 2 UL, 3 UB, 4 DR, 5 DF, 6 DL, 7 DB, 8 FR, 9 FL, 10 BL, 11 BR
========================================================= */
(function (root) {
    // ep[i]: hamleden sonra i konumuna gelen kenarın eski konumu; eo[i]: o konumda yön değişimi
    var BASE = {
        U: { ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        R: { ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        F: { ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
        D: { ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        L: { ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        B: { ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] }
    };
    var FACES = ["U", "R", "F", "D", "L", "B"];
    var MOVES = [];      // { name, face, to: [12] yeni konum, flip: [12] }
    FACES.forEach(function (f) {
        // tek çeyrek tur: eski konum p → yeni konum i (ep[i] === p), yön ^= eo[i]
        var to = [], flip = [];
        for (var i = 0; i < 12; i++) { to[BASE[f].ep[i]] = i; flip[BASE[f].ep[i]] = BASE[f].eo[i]; }
        var cur = { to: to.slice(), flip: flip.slice() };
        ["", "2", "'"].forEach(function (suf, k) {
            if (k > 0) { // bir çeyrek tur daha ekle
                var nt = [], nf = [];
                for (var p = 0; p < 12; p++) { nt[p] = to[cur.to[p]]; nf[p] = cur.flip[p] ^ flip[cur.to[p]]; }
                cur = { to: nt, flip: nf };
            }
            MOVES.push({ name: f + suf, face: f, to: cur.to.slice(), flip: cur.flip.slice() });
        });
    });
    var PIECES = [4, 5, 6, 7];
    function enc(s) { return ((s[0] * 24 + s[1]) * 24 + s[2]) * 24 + s[3]; } // s[k] = konum*2 + yön
    function step(s, m) {
        var o = [];
        for (var k = 0; k < 4; k++) { var p = s[k] >> 1, r = s[k] & 1; o[k] = (m.to[p] << 1) | (r ^ m.flip[p]); }
        return o;
    }
    var SOLVED = PIECES.map(function (p) { return p << 1; });
    var DIST = null;
    function build() {
        if (DIST) return;
        DIST = new Int8Array(331776).fill(-1);
        var q = [SOLVED], head = 0;
        DIST[enc(SOLVED)] = 0;
        while (head < q.length) {
            var s = q[head++], d = DIST[enc(s)];
            for (var i = 0; i < MOVES.length; i++) {
                var t = step(s, MOVES[i]), e = enc(t);
                if (DIST[e] < 0) { DIST[e] = d + 1; q.push(t); }
            }
        }
    }
    function parse(alg) {
        return alg.trim().split(/\s+/).filter(Boolean).map(function (t) {
            var m = MOVES.filter(function (x) { return x.name === t.replace("’", "'"); })[0];
            if (!m) throw new Error("hamle: " + t);
            return m;
        });
    }
    function stateAfter(alg) { var s = SOLVED; parse(alg).forEach(function (m) { s = step(s, m); }); return s; }
    function distance(alg) { build(); return DIST[enc(stateAfter(alg))]; }
    // En kısa çözümler (en fazla `limit` tane; aynı yüzü art arda çevirmez)
    function solve(alg, limit) { return solveState(stateAfter(alg), limit); }
    // Herhangi bir durumdan (ör. Bluetooth küpün o anki hali) en kısa çözümler
    function solveState(start, limit) {
        build();
        limit = limit || 3;
        var out = [];
        (function dfs(s, path, last) {
            if (out.length >= limit) return;
            var d = DIST[enc(s)];
            if (d === 0) { out.push(path.join(" ")); return; }
            for (var i = 0; i < MOVES.length; i++) {
                var m = MOVES[i];
                if (m.face === last) continue;
                var t = step(s, m);
                if (DIST[enc(t)] === d - 1) dfs(t, path.concat(m.name), m.face);
                if (out.length >= limit) return;
            }
        })(start, [], null);
        return { length: DIST[enc(start)], solutions: out };
    }
    // Rastgele hamle karıştırması: aynı yüz art arda yok, karşı yüzler (U-D, R-L, F-B) üç kez üst üste yok
    var AXIS = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
    function scramble(n) {
        n = n || 20;
        var out = [], f1 = null, f2 = null;
        while (out.length < n) {
            var m = MOVES[Math.floor(Math.random() * MOVES.length)];
            if (m.face === f1) continue;
            if (f1 && f2 && AXIS[m.face] === AXIS[f1] && AXIS[f1] === AXIS[f2]) continue;
            if (f1 && AXIS[m.face] === AXIS[f1] && m.face === f2) continue;
            out.push(m.name); f2 = f1; f1 = m.face;
        }
        return out.join(" ");
    }
    // Durumu hamlelerle ilerlet (Bluetooth küpün artı kenarlarını izlemek için)
    function apply(state, alg) { var s = state; parse(alg).forEach(function (m) { s = step(s, m); }); return s; }
    var api = { solve: solve, solveState: solveState, distance: distance, scramble: scramble, build: build, apply: apply, SOLVED: SOLVED };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CrossSolver = api;
})(this);
