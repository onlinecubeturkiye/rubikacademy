/* ============================================================
   ALGORİTMA ANTRENÖRÜ — BLUETOOTH AKILLI KÜP (GAN)
   - gan-web-bluetooth kütüphanesi sadece "Bağlan"a basılınca yüklenir.
   - Küp beyaz üst / yeşil önde tanımlı hamleler gönderir; antrenör
     karıştırmaları sarı üst / yeşil önde tutuşa göredir (z2):
     U<->D, R<->L, F ve B aynı, yön değişmez.
   - Küpün durumu kendi modelimizde izlenir: karıştırma ilerlemesi,
     yanlış hamle düzeltmesi, ilk hamlede süre başlatma, çözülünce durdurma.
   - antrenor.html içindeki global'leri kullanır: state, current, curCase,
     curScramble, startTimer, stopTimer, T, mode. Günün karıştırması
     (gunluk.js) aynı global'leri sağlayarak bu modülü kullanır.
   ============================================================ */
(function () {
    var LIB_URL = "/js/vendor/smartcube-bluetooth.min.js?v=20261197";
    var MAC_KEY = "trainer-bt-mac-v1";
    // Karıştırma ve ipucu kutuları (günün karıştırması sayfası kendi kimliklerini verir)
    var SCR_ID = (window.BT_IDS && BT_IDS.scramble) || "scramble", HINT_ID = (window.BT_IDS && BT_IDS.hint) || "timerHint";
    var FACES = "URFDLB";
    // Küp çerçevesi -> tutuş. Sarı üst: z2 (U<->D, R<->L). Beyaz üst (günün karıştırması ya da antrenörde
    // beyaz üst tutuş, window.BT_WHITE_TOP): çevirme yok. Tutuş değişebildiği için her seferinde okunur.
    var Z2 = { U: "D", D: "U", R: "L", L: "R", F: "F", B: "B" };
    function whiteTop() { return !!window.BT_WHITE_TOP; }
    function mapF(x) { return whiteTop() ? x : Z2[x]; }

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
    // M katmanı (L yönünde): Roux'da kontrol için
    PERM.M = STK.map(function (s, i) {
        if (s.p[0] !== 0) return i;
        var a = NORMALS.L;
        return INDEX[key(rotCW(a, s.p), rotCW(a, s.n))];
    });
    var CENTER = {};
    Object.keys(NORMALS).forEach(function (f) { CENTER[f] = INDEX[key(NORMALS[f], NORMALS[f])]; });
    // Renkleri merkezlerin şu anki yerine göre yeniden adlandır (küp dönmüş/M kaymış olsa da karşılaştırılabilsin)
    function normalize(model) {
        var map = {};
        Object.keys(CENTER).forEach(function (f) { map[model[CENTER[f]]] = f; });
        return model.map(function (c) { return map[c]; });
    }
    /* Roux: sarı merkez üstte olmak zorunda değil. Küp M katmanı dışında çözülüyse
       (merkezler kayık) hazır sayılır. Tutuş çerçevesi köşelerden bulunur:
       sarı köşe etiketlerinin olduğu yüz "üst", yeşil köşe etiketlerinin olduğu yüz "ön".
       Döndürür: tutuş harfi -> modeldeki (merkezlere göre) yüz harfi, ya da null. */
    var OPP = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };
    function letterOf(n) { for (var f in NORMALS) if (NORMALS[f][0] === n[0] && NORMALS[f][1] === n[1] && NORMALS[f][2] === n[2]) return f; return null; }
    function cornerFace(model, color) {
        var face = null;
        for (var i = 0; i < model.length; i++) {
            var p = STK[i].p;
            if (model[i] !== color || !p[0] || !p[1] || !p[2]) continue;
            var f = letterOf(STK[i].n);
            if (face && face !== f) return null;
            face = f;
        }
        return face;
    }
    function rouxFrame(model) {
        var ok = false;
        for (var j = 0; j < 4 && !ok; j++) ok = isSolved(normalize(j ? turn(model, "M", j) : model));
        if (!ok) return null;
        var u = cornerFace(model, "U"), fr = cornerFace(model, "F");
        if (!u || !fr) return null;
        var r = letterOf(cross(NORMALS[u], NORMALS[fr]));
        var m = { U: u, D: OPP[u], F: fr, B: OPP[fr], R: r, L: OPP[r] };
        m.inv = {}; Object.keys(OPP).forEach(function (k) { m.inv[m[k]] = k; });
        return m;
    }
    var IDENT = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L", inv: { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" } };
    var hold = IDENT; // karıştırma takibinde tutuş çerçevesi
    /* Roux + "Küpüm çözülmüş": küp durumunu göndermiyorsa M katmanının kayması bilinmez.
       Dört aday (M, M2, M' kayık ya da düz) tutulur; ilk karıştırma hamlesi hangisi olduğunu belirler. */
    var mCands = null;
    function startMGuess() {
        mCands = [0, 1, 2, 3].map(function (k) {
            var m = k ? turn(turn(solvedModel(), "R", k), "L", 4 - k) : solvedModel();
            return { model: m, frame: rouxFrame(m) || IDENT };
        });
    }
    var mOdd = false; // Roux EO: M katmanı çeyrek kayık (case değişir)
    /* Küpün gönderdiği durum (Kociemba sırası URFDLB, küpün kendi beyaz-üst çerçevesinde)
       -> bizim model (sarı-üst tutuş, z2). Merkezler her zaman sabittir: M kayık bir küp de
       merkezlere göre doğru raporlanır, böylece sarı merkezi üste almak gerekmez. */
    var FACELET_POS = {
        U: function (r, c) { return [[c - 1, 1, r - 1], [0, 1, 0]]; },
        R: function (r, c) { return [[1, 1 - r, 1 - c], [1, 0, 0]]; },
        F: function (r, c) { return [[c - 1, 1 - r, 1], [0, 0, 1]]; },
        D: function (r, c) { return [[c - 1, -1, 1 - r], [0, -1, 0]]; },
        L: function (r, c) { return [[-1, 1 - r, c - 1], [-1, 0, 0]]; },
        B: function (r, c) { return [[1 - c, 1 - r, -1], [0, 0, -1]]; }
    };
    function parseFacelets(str) {
        if (!str || str.length !== 54) return null;
        var m = new Array(STK.length);
        for (var fi = 0; fi < 6; fi++) for (var k = 0; k < 9; k++) {
            var pn = FACELET_POS[FACES[fi]](Math.floor(k / 3), k % 3);
            var wt = whiteTop();
            var p = wt ? pn[0] : [-pn[0][0], -pn[0][1], pn[0][2]], n = wt ? pn[1] : [-pn[1][0], -pn[1][1], pn[1][2]]; // z2
            var col = mapF(str.charAt(fi * 9 + k));
            if (!col) return null;
            m[INDEX[key(p, n)]] = col;
        }
        return m;
    }
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
    function matches(model, test) {
        for (var i = 0; i < model.length; i++) if (test(STK[i]) && model[i] !== STK[i].c) return false;
        return true;
    }
    function isF2L(s) { return s.p[1] < 1; }
    function isTopFace(s) { return s.n[1] === 1; }
    function isTopEdgeUp(s) { return s.n[1] === 1 && (s.p[0] === 0 || s.p[2] === 0); } // üst yüzün artısı (merkez + 4 kenar)
    function isTopCorner(s) { return s.p[1] === 1 && s.p[0] !== 0 && s.p[2] !== 0; }
    // Beyaz artı (sarı üst tutuşta alt yüz): alt merkez, 4 alt kenar ve yanlardaki eşleri
    function isCrossSt(s) { return s.p[1] === -1 && (s.p[0] === 0 || s.p[2] === 0); }
    /* Artı bir yüzde (fy = -1 alt, +1 üst) tamamlanmış mı? Rengi önemsemez: o yüzün 4 kenarının
       yüze bakan stickerları merkezle aynı renk, yan stickerları da yan merkezlerle eşli olmalı.
       Böylece kişi beyaz ya da sarı artıyı, üstte ya da altta yapmış olsun algılanır. */
    function faceCrossDone(model, fy) {
        var cen = model[INDEX[key([0, fy, 0], [0, fy, 0])]];
        for (var i = 0; i < STK.length; i++) {
            var s = STK[i];
            if (s.p[1] !== fy) continue;
            if ((s.p[0] === 0) === (s.p[2] === 0)) continue; // yalnız kenarlar (tam bir koordinatı 0)
            if (s.n[1] === fy) { if (model[i] !== cen) return false; }          // yüze bakan: merkezle aynı
            else if (s.n[1] === 0 && model[i] !== model[INDEX[key(s.n, s.n)]]) return false; // yan: yan merkezle eşli
        }
        return true;
    }
    function crossDone(model) { return faceCrossDone(model, -1) || faceCrossDone(model, 1); }
    /* X-Cross: artı + o artının yanındaki en az bir F2L yuvası (orta kenar + köşe) çözülü */
    function stOk(model, i) { var s = STK[i]; return model[i] === model[INDEX[key(s.n, s.n)]]; }
    function slotDone(model, fy, x, z) {
        for (var i = 0; i < STK.length; i++) {
            var p = STK[i].p;
            if (p[0] === x && p[2] === z && (p[1] === 0 || p[1] === fy) && !stOk(model, i)) return false;
        }
        return true;
    }
    function faceXcrossDone(model, fy) {
        if (!faceCrossDone(model, fy)) return false;
        return [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(function (c) { return slotDone(model, fy, c[0], c[1]); });
    }
    function xcrossDone(model) { return faceXcrossDone(model, -1) || faceXcrossDone(model, 1); }
    function isRouxBlock(s) { return s.p[0] !== 0 && s.p[1] < 1; }
    function isLseOnUD(s) { return s.p[0] === 0 && s.p[2] !== 0 ? s.n[1] !== 0 : (s.p[2] === 0 && s.p[1] === 1 && s.p[0] !== 0 && s.n[1] === 1); }
    /* Roux: iki blok + üst köşeler (AUF hariç) yerinde; M katmanı kayık olabilir.
       eo = true ise kalan 6 kenarın U/D rengi U ya da D yüzünde olmalı. */
    function rouxDone(model, eo) {
        // Küp x ekseninde dönmüş tutulabilir (M kayıkken merkezler başka yerde): R^r L'^r M^k hepsi denenir
        for (var t = 0; t < 16; t++) {
            var r = t >> 2, k = t & 3;
            // R^r L'^r = x^r M^r, yani toplam M kayması r+k. EO yalnızca M katmanı düz ya da M2 kaymışken
            // geçerlidir; çeyrek kaymışken kenarlar bir an "yönlü" görünür ve süre son M'den önce dururdu.
            if (eo && (r + k) % 2) continue;
            var m = r ? turn(turn(model, "R", r), "L", 4 - r) : model;
            m = normalize(k ? turn(m, "M", k) : m);
            for (var j = 0; j < 4; j++) {
                if (matches(m, isRouxBlock) && matches(m, isTopCorner)) {
                    if (!eo) return true;
                    var ok = true;
                    for (var i = 0; i < m.length; i++) if (isLseOnUD(STK[i]) && m[i] !== "U" && m[i] !== "D") { ok = false; break; }
                    if (ok) return true;
                }
                m = turn(m, "U", 1);
            }
        }
        return false;
    }
    function upToAUF(model, test) {
        for (var k = 0; k < 4; k++) { if (matches(model, test)) return true; model = turn(model, "U", 1); }
        return false;
    }
    /* ---------- 2x2 (GAN 251 ui) ----------
       2x2'de merkez yok: küpün içindeki çekirdek köşelere göre dönebilir ve küp bir hamleyi
       karşı yüzün hamlesi olarak bildirebilir (R yerine L gibi). Kullanıcının küpü hangi yönde
       tuttuğu bu yüzden kesin bilinemez. 2x2'de takip ve "çözüldü" kontrolü yönden bağımsızdır:
       yalnızca köşe etiketlerine bakılır, durumlar 24 dönüşe ve renk adlarına göre karşılaştırılır. */
    var CUBE222 = /^(GAN251|GANic251)/i;
    var CORNERS = [];
    STK.forEach(function (s, i) { if (s.p[0] && s.p[1] && s.p[2]) CORNERS.push(i); });
    var ROTS = (function () {
        function rotPerm(a) { return STK.map(function (s) { return INDEX[key(rotCW(a, s.p), rotCW(a, s.n))]; }); }
        function comp(p, q) { return p.map(function (x) { return q[x]; }); } // önce p, sonra q
        var gens = [rotPerm(NORMALS.R), rotPerm(NORMALS.U)], id = STK.map(function (s, i) { return i; });
        var seen = {}, out = [id], k = 0; seen[id.join()] = 1;
        while (k < out.length) {
            gens.forEach(function (g) { var n = comp(out[k], g), h = n.join(); if (!seen[h]) { seen[h] = 1; out.push(n); } });
            k++;
        }
        return out; // 24 tüm küp dönüşü
    })();
    // Yönden ve renk adlarından bağımsız durum anahtarı
    function canon222(model) {
        var best = null;
        ROTS.forEach(function (r) {
            var m = new Array(model.length);
            for (var i = 0; i < model.length; i++) m[r[i]] = model[i];
            var names = {}, n = 0, str = "";
            for (var j = 0; j < CORNERS.length; j++) {
                var c = m[CORNERS[j]];
                if (!(c in names)) names[c] = "abcdef".charAt(n++);
                str += names[c];
            }
            if (best === null || str < best) best = str;
        });
        return best;
    }
    function faceUniform222(model, f) {
        var n = NORMALS[f], c = null;
        for (var j = 0; j < CORNERS.length; j++) {
            var s = STK[CORNERS[j]];
            if (s.n[0] !== n[0] || s.n[1] !== n[1] || s.n[2] !== n[2]) continue;
            var v = model[CORNERS[j]];
            if (c === null) c = v; else if (v !== c) return false;
        }
        return true;
    }
    function solved222(model) { for (var f in NORMALS) if (!faceUniform222(model, f)) return false; return true; }
    function faceColor222(model, f) { var n = NORMALS[f]; for (var j = 0; j < CORNERS.length; j++) { var s = STK[CORNERS[j]]; if (s.n[0] === n[0] && s.n[1] === n[1] && s.n[2] === n[2]) return model[CORNERS[j]]; } return null; }
    var base2 = null; // Ortega OLL: karıştırma bitince tek renk olan alt yüzün rengi
    function caseDone222(model, id) {
        // Ortega OLL: alt yüzün rengi ve karşısı tek renk (hangi eksende olduğu önemli değil)
        if (id === "ortega-oll") return ["U", "R", "F"].some(function (f) {
            if (!faceUniform222(model, f) || !faceUniform222(model, OPP[f])) return false;
            return base2 === null || faceColor222(model, f) === base2 || faceColor222(model, OPP[f]) === base2;
        });
        return solved222(model); // CLL, EG-1, EG-2, Ortega PBL: son AUF dahil küp çözülü
    }
    // Karıştırma takibi: her ara durumun anahtarı; küp hangisindeyse o kadar ilerlenmiştir
    var exp2 = [], prog2 = 0, off2 = 0;
    function startTrack222() {
        var moves = parseScramble(curScramble), m = solvedModel();
        exp2 = [canon222(m)];
        moves.forEach(function (mv) { m = turn(m, mv.f, mv.q); exp2.push(canon222(m)); });
        prog2 = 0; off2 = 0;
        todo = moves.slice();
    }
    function step222() {
        var c = canon222(model), j = -1;
        if (prog2 + 1 < exp2.length && exp2[prog2 + 1] === c) j = prog2 + 1;
        else for (var k = exp2.length - 1; k >= 0; k--) if (exp2[k] === c) { j = k; break; }
        if (j >= 0) { prog2 = j; off2 = 0; } else off2++;
        todo = parseScramble(curScramble).slice(prog2);
    }

    /* Case'in çözüldüğü an: sete göre (tüm küpün çözülmesi beklenmez)
       OLL / WV: ilk iki katman + üst yüz tek renk
       COLL: + köşeler yerinde (AUF hariç)
       PLL: küp AUF hariç çözülü */
    function caseDone(model) {
        // ⭐ Öğreniyorum setinde her case kendi setinin kuralını kullanır
        var id = (typeof curCase !== "undefined" && curCase && curCase.setId) || (current ? current.id : "");
        id = { "oh-oll": "oll", "oh-pll": "pll", "oh-cmll": "roux-cmll" }[id] || id; // tek el setleri aynı kuralla biter
        if (is222()) return caseDone222(model, id);
        if (id === "oll" || id === "wv") return matches(model, isF2L) && matches(model, isTopFace);
        if (id === "coll") return matches(model, isF2L) && matches(model, isTopFace) && upToAUF(model, isTopCorner);
        if (id === "pll") return upToAUF(model, function () { return true; });
        if (id === "cross") return crossDone(model);
        if (id === "xcross") return xcrossDone(model);
        if (id === "f2l") return matches(model, isF2L);
        // 2-Look: alt kümeye göre adımın bittiği an
        var sub = (typeof curCase !== "undefined" && curCase) ? curCase.subset : "";
        if (id === "2look-2lo") return matches(model, isF2L) && matches(model, sub === "lo_e" ? isTopEdgeUp : isTopFace);
        if (id === "2look-2lp") return sub === "lp_c" ? (matches(model, isF2L) && upToAUF(model, isTopCorner)) : upToAUF(model, function () { return true; });
        if (id === "roux-cmll") return rouxDone(model, false);
        if (id === "roux-eo") return rouxDone(model, true);
        return isSolved(model);
    }

    /* ---------- durum ---------- */
    var conn = null, sub = null, model = solvedModel(), modelKnown = false;
    var phase = "off";      // off | needSolve | scrambling | ready | solving | done
    var todo = [];          // [{f, q, fix}] yapılacak çeyrek tur sayısı (1 = X, 2 = X2, 3 = X')
    var total = 0;          // karıştırmadaki hamle sayısı
    var gotEvent = false, connecting = false, afterCase = false, tooMany = false;
    var noData = false, forceMac = false, lastMac = "";
    var attempt = 0, stage = "", stageName = "", connTimer = 0, lastError = ""; // bağlantı aşaması: takılırsa nerede kaldığı görünsün
    var CONNECT_TIMEOUT = 25000;
    var lastDevice = null, userDisconnect = false; // bu sayfada seçilen küp: tekrar bağlanırken Chrome listesi açılmasın
    var MAX_FIX = 10; // bundan fazla düzeltme hamlesi birikirse "küpü çöz" denir
    /* Cross seti: küpü her seferinde tamamen çözmek gerekmez. Artı kenarlarının durumu
       CrossSolver ile izlenir; yeni karıştırmanın başına artıyı geri kuran kısa bir giriş eklenir. */
    var crossSt = window.CrossSolver ? CrossSolver.SOLVED : null;
    var inspTimer = 0, lastSolveFace = null;
    window.btSolveCount = null; // cross çözümünde yapılan hamle sayısı (aynı yüz art arda tek sayılır)
    function isCross() { return !!(current && current.gen === "cross"); }
    function setSolved() { model = solvedModel(); modelKnown = true; if (window.CrossSolver) crossSt = CrossSolver.SOLVED; }

    function el(id) { return document.getElementById(id); }
    /* i18n.js eski bir sürümden gelirse ham anahtar görünmesin diye Türkçe yedekler */
    var FB = {
        bt_insp: "İnceleme: {n} sn · artıyı planla, ilk hamlende süre başlar", bt_insp_over: "İnceleme süresi doldu, başla!",
        bt_title: "Bluetooth akıllı küp", bt_connect: "Bağlan", bt_reset: "Küpüm çözülmüş", bt_disconnect: "Bağlantıyı kes",
        bt_hint: "GAN (i, i2, i3, i Carry, ui…), MoYu, QiYi, GoCube veya Giiker akıllı küpünü bağla: karıştırma takip edilir, süre kendiliğinden başlar ve case çözülünce durur.",
        bt_unsupported: "Bu tarayıcı Bluetooth desteklemiyor. Akıllı küp için Chrome veya Edge kullan (Android, Windows, Mac).",
        bt_unsup_ios: "iPad ve iPhone'daki tarayıcılar (Safari, Chrome) Bluetooth desteklemiyor. Akıllı küp için bu sayfayı App Store'daki Bluefy tarayıcısıyla aç.",
        bt_only3x3: "Bluetooth sadece 3x3 ve 2x2 setlerinde çalışır",
        bt_title222: "2x2 akıllı küp", bt_hint222: "2x2 akıllı küp (GAN 251 ui) bağlayabilirsin.",
        bt_is222: "Bu bir 2x2 akıllı küp: sadece 2x2 setlerinde kullanılabilir.",
        bt_is333: "Bu bir 3x3 akıllı küp: 2x2 setlerinde 2x2 akıllı küp (GAN 251 ui) gerekir.",
        bt_undo222: "Yanlış hamle: son hamleni geri al.", bt_cube_mode: "Bluetooth için \"Küple çalış\" modunu seç",
        bt_hint_scramble_roux: "Karıştırmayı sarı köşeler üstte, yeşil önde tutarak uygula (merkezlerin rengi önemli değil)",
        bt_roux_m: "EO için M katmanını hizala: üstte sarı ya da beyaz merkez olsun (M2 kayık olabilir).",
        bt_need_solve: "Önce küpü çöz (ya da yaptığın hamleleri geri al). Çözülünce karıştırma başlar.",
        bt_unknown: "Küp çözülmüş değil görünüyor. Çöz ve \"Küpüm çözülmüş\" butonuna bas.",
        bt_fix: "Düzelt:", bt_too_many: "Çok fazla farklı hamle yapıldı. Küpü çöz; çözülünce karıştırma baştan başlar.", bt_finish_cube: "Case tamam! Yeni karıştırma için küpü bitir (tamamen çöz) ya da algoritmanın tersini yap.", bt_hint_scramble: "Karıştırmayı sarı üstte, yeşil önde tutarak uygula",
        bt_hint_solve: "Küp çözülünce karıştırma başlayacak", bt_hint_ready: "Hazır! İlk hamlende süre başlar, küp çözülünce durur",
        bt_connected: "Bağlı", bt_connecting: "Bağlanıyor…",
        bt_no_data: "Küpten veri gelmiyor. MAC adresi yanlış olabilir; bağlantıyı kesip tekrar dene.",
        bt_no_data_t: "veri gelmiyor",
        bt_no_data2: "Küp bağlandı ama hamle gelmiyor. Genelde küpün MAC adresi yanlıştır: bağlantıyı kesip tekrar bağlan, adres yeniden sorulacak. Küp telefonda GAN uygulamasına bağlıysa önce oradan çıkar.",
        bt_mac_used: "Kullanılan MAC:",
        bt_turn_test: "Test: bir yüzü çevir, hamlen burada görünmeli.", bt_moves: "Gelen hamleler:",
        bt_st_pick: "küp seçiliyor", bt_st_found: "küp bulundu", bt_st_mac: "MAC adresi alınıyor", bt_st_link: "küple bağlantı kuruluyor",
        bt_timeout: "Bağlantı tamamlanamadı. Küp telefondaki GAN uygulamasına bağlıysa uygulamayı kapat, küpü bir yüzünü çevirerek uyandır ve tekrar dene. Olmazsa Bluetooth'u kapatıp aç.",
        bt_stage: "Kaldığı aşama:", bt_error: "Hata:",
        bt_failed: "Bağlantı kurulamadı. Küpün açık olduğundan emin ol ve tekrar dene.",
        bt_mac_title: "Küpün MAC adresi gerekli",
        bt_mac_intro: "GAN küpler şifreli iletişim kurar; bunun için küpün MAC adresi lazım. Tarayıcın bunu otomatik okuyamadı. İki yoldan birini kullan (sadece bir kez gerekir):",
        bt_way_a: "Yol 1: Otomatik bulmayı aç (önerilen)",
        bt_way_a1: "Aşağıdaki adresi kopyala ve Chrome'un adres çubuğuna yapıştır.",
        bt_way_a2: "\"Experimental Web Platform features\" ayarını Enabled yap ve Chrome'u yeniden başlat.",
        bt_way_a3: "Bu sayfaya dönüp tekrar Bağlan'a bas; adres otomatik bulunur.",
        bt_way_b: "Yol 2: Adresi elle bul",
        bt_way_b1: "Aşağıdaki adresi kopyala ve yeni sekmede Chrome'un adres çubuğuna yapıştır.",
        bt_way_b2: "\"Start scan\" butonuna bas; listede küpünün adını (ör. GAN12i_5962) bul.",
        bt_way_b3: "Yanındaki adresi (AB:12:34:56:78:9A gibi) aşağıya yaz.",
        bt_copy: "Kopyala", bt_copied: "Kopyalandı ✓", bt_mac_ok: "Bağlan", bt_mac_cancel: "İptal",
        bt_mac_bad: "MAC adresi geçersiz. Biçim: AB:12:34:56:78:9A",
        bt_pick_title: "Küpünü seç", bt_pick_intro: "Küpünün açık olduğundan emin ol (bir yüzü çevir, uyanır).",
        bt_pick_known: "Daha önce bağlandı", bt_pick_none: "Henüz kayıtlı küp yok. Yeni küp ara'ya bas ve listeden küpünü seç; sonraki seferlerde burada görünür.",
        bt_pick_scan: "🔍 Yeni küp ara",
        bt_tip_title: "Chrome listesini bir daha görmemek için (bir kez):",
        bt_tip_1: "Aşağıdaki adresi kopyala, Chrome'un adres çubuğuna yapıştır.",
        bt_tip_2: "\"Use the new permissions backend for Web Bluetooth\" ayarını Enabled yap, Chrome'u yeniden başlat.",
        bt_tip_3: "Küpü bir kez daha \"Yeni küp ara\" ile eşle; sonra hep burada tek dokunuşla görünür.", bt_pick_go: "Bağlan →",
        bt_auto_next: "Küpü tamamen çözünce sıradaki karıştırma otomatik gelir.", bt_auto_soon: "Sıradaki karıştırma geliyor…"
    };
    function txt(k) {
        var v = (typeof T === "function") ? T(k) : k;
        return (v && v !== k) ? v : (FB[k] || k);
    }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function fmtMove(f, q) { return f + (q === 2 ? "2" : q === 3 ? "'" : ""); }
    function supported() { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice); }
    // iPadOS masaüstü sitesi isterken kendini Mac olarak tanıtır: dokunmatik Mac = iPad
    function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); }
    // Bluetooth: 3x3 setleri (CFOP, Roux) yalnızca 3x3 akıllı küple, 2x2 setleri yalnızca 2x2 akıllı küple
    function btSet() { return !!(current && !current.noBT && (current.cube === "3x3" || current.cube === "2x2")); }
    function kindOf(name) { return CUBE222.test(name || "") ? "2x2" : "3x3"; }
    function connKind() { return conn ? kindOf(conn.deviceName) : null; }
    function is222() { return !!(current && current.cube === "2x2"); }
    function applies() { return conn && mode === "cube" && btSet() && connKind() === current.cube; }

    // Küp dönüşleri (x, y, z) akıllı küpte hamle olarak gelmez: takipte atlanır, ekranda sonda gösterilir
    function isRot(t) { return /^[xyz]/.test(t); }
    function parseScramble(s) {
        return s.trim().split(/\s+/).filter(function (t) { return t && !isRot(t); }).map(function (t) {
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
        el("btReset").style.display = on && !noData ? "" : "none";
        bar.classList.toggle("warn", on && noData);
        var st = el("btStatus");
        el("btTitle").textContent = on ? (conn.deviceName || "GAN") + " · " + (noData ? "⚠ " + txt("bt_no_data_t") : txt("bt_connected")) : txt(is222() ? "bt_title222" : "bt_title");
        el("btConnect").textContent = txt("bt_connect");
        el("btReset").textContent = txt("bt_reset");
        el("btDisconnect").textContent = txt("bt_disconnect");
        // Bluetooth sadece 3x3 ve 2x2 setlerinde: diğer küplerde kutu hiç görünmez
        bar.classList.toggle("unsup", !btSet());
        // Tarayıcı Bluetooth desteklemiyorsa (iPad/iPhone, Firefox, Samsung Internet) kutu gizlenmez: nedenini ve çözümünü söyler
        bar.classList.toggle("nobt", !supported());
        if (!supported()) {
            el("btConnect").style.display = "none";
            bar.classList.add("has-msg");
            st.textContent = txt(isIOS() ? "bt_unsup_ios" : "bt_unsupported");
            return;
        }
        if (connecting) bar.classList.add("has-msg");
        if (connecting) { st.textContent = txt("bt_connecting") + (stage ? " (" + txt("bt_st_" + stage) + (stageName ? ": " + stageName : "") + ")" : ""); return; }
        if (!on && lastError) { st.textContent = lastError; bar.classList.add("has-msg"); return; }
        bar.classList.remove("has-msg");
        bar.title = on ? "" : txt("bt_hint");
        if (!on) { st.textContent = is222() ? txt("bt_hint222") : ""; return; }
        if (noData) { st.textContent = txt("bt_no_data2") + (lastMac ? " " + txt("bt_mac_used") + " " + lastMac : ""); return; }
        if (!btSet()) st.textContent = txt("bt_only3x3");
        else if (connKind() !== current.cube) st.textContent = txt(connKind() === "2x2" ? "bt_is222" : "bt_is333");
        else if (mode !== "cube") st.textContent = txt("bt_cube_mode");
        else st.textContent = txt(state === "running" ? "bt_hint_ready" : (isRoux() ? "bt_hint_scramble_roux" : "bt_hint_scramble"));
    }

    function renderScramble() {
        if (!applies() || !curScramble) return;
        var box = el(SCR_ID);
        if (phase === "needSolve") {
            box.innerHTML = '<span class="bt-warn">' + esc(txt(!modelKnown ? "bt_unknown" : mOdd ? "bt_roux_m" : tooMany ? "bt_too_many" : (afterCase ? "bt_finish_cube" : "bt_need_solve"))) + '</span>';
            return;
        }
        var orig = parseScramble(curScramble);
        var remainingOrig = todo.filter(function (m) { return !m.fix; });
        var doneCount = orig.length - remainingOrig.length;
        var html = "";
        var fixes = [];
        for (var i = 0; i < todo.length && todo[i].fix; i++) fixes.push(fmtMove(todo[i].f, todo[i].q));
        if (fixes.length) html += '<span class="bt-fix">' + esc(txt("bt_fix")) + " " + esc(fixes.join(" ")) + '</span> ';
        if (is222() && off2) html += '<span class="bt-fix">' + esc(txt("bt_undo222")) + '</span> ';
        orig.forEach(function (m, i) {
            var cls = i < doneCount ? "bt-done" : (i === doneCount ? "bt-cur" : "");
            var label = fmtMove(m.f, m.q);
            if (i === doneCount && remainingOrig.length && remainingOrig[0].q !== m.q && !fixes.length) cls += " bt-half";
            html += '<span class="' + cls + '">' + label + '</span> ';
        });
        curScramble.trim().split(/\s+/).filter(isRot).forEach(function (t) { html += '<span class="bt-rot">' + esc(t) + '</span> '; });
        box.innerHTML = html;
    }

    function setHint(k) { var h = el(HINT_ID); if (h) h.textContent = txt(k); }

    /* ---------- karıştırma takibi ---------- */
    // İki hamle dizisini birleştir; birleşme yerinde aynı yüz varsa tek hamleye indir
    function joinMoves(a, b) {
        var x = parseScramble(a || ""), y = parseScramble(b || "");
        while (x.length && y.length && x[x.length - 1].f === y[0].f) {
            var m = x.pop(), q = (m.q + y.shift().q) % 4;
            if (q) { x.push({ f: m.f, q: q }); break; }
        }
        return x.concat(y).map(function (m) { return fmtMove(m.f, m.q); }).join(" ");
    }
    function crossPrefix() {
        var base = (typeof curBaseScramble === "string" && curBaseScramble) || curScramble;
        var pre = (window.CrossSolver && crossSt) ? CrossSolver.solveState(crossSt, 1).solutions[0] : "";
        curScramble = joinMoves(pre, base);
    }
    function stopInsp() { clearInterval(inspTimer); inspTimer = 0; }
    // Cross: karıştırma bitince 15 sn inceleme geri sayımı; ilk hamlede süre başlar
    function startInsp() {
        stopInsp();
        var end = Date.now() + 15000;
        function upd() {
            var left = Math.ceil((end - Date.now()) / 1000), h = el(HINT_ID);
            if (!h) return;
            if (left <= 0) { h.textContent = txt("bt_insp_over"); stopInsp(); return; }
            h.textContent = txt("bt_insp").replace("{n}", left);
        }
        upd(); inspTimer = setInterval(upd, 250);
    }
    function startScrambleTracking() {
        stopInsp();
        window.btSolveCount = null;
        tooMany = false;
        todo = parseScramble(curScramble);
        total = todo.length;
        if (is222()) startTrack222();
        phase = "scrambling";
        renderScramble();
        setHint(isRoux() ? "bt_hint_scramble_roux" : "bt_hint_scramble");
    }

    // Karıştırma başlayabilir mi? (Roux'da M katmanı kayık olabilir)
    function readyFrame() {
        mOdd = false;
        if (!modelKnown) return null;
        if (is222()) return solved222(model) ? IDENT : null;
        if (!isRoux()) {
            if (!isSolved(model)) return null;
            if (window.CrossSolver && !crossSt) crossSt = CrossSolver.SOLVED;
            return IDENT;
        }
        var fr = rouxFrame(model);
        // EO'da merkezler çeyrek kaymışsa (üstte yeşil/mavi merkez) case anlamı değişir
        if (fr && current.id === "roux-eo" && fr.U !== "U" && fr.U !== "D") { mOdd = true; return null; }
        return fr;
    }
    function isRoux() { return !!(current && (current.puzzle === "roux" || current.id === "oh-cmll")); }
    window.btOnNewCase = function () {
        renderBar();
        if (!applies()) { phase = "off"; return; }
        afterCase = phase === "done";
        hold = IDENT;
        if (!isRoux()) mCands = null;
        if (isCross() && modelKnown && crossSt) { crossPrefix(); startScrambleTracking(); return; }
        var fr = readyFrame();
        if (!fr) { phase = "needSolve"; renderScramble(); setHint("bt_hint_solve"); return; }
        hold = fr;
        startScrambleTracking();
    };
    window.btOnStateChange = function () { renderBar(); if (applies() && state === "done") phase = "done"; };

    // Case bitti ve küp tamamen çözülü: sıradaki karıştırmaya otomatik geç (süre normal kaydedilir).
    // Küp case biter bitmez çözülüyse (ör. PLL) "Zor" diyebilmek için kısa bir süre beklenir.
    var autoT = 0;
    function autoHint() {
        if (state !== "done") return; // gösterim kapalıysa süre zaten kaydedilip sıradakine geçildi
        var h = el(HINT_ID), solvedNow = !!readyFrame();
        if (h) h.textContent = txt("hint_done") + " · " + txt(solvedNow ? "bt_auto_soon" : "bt_auto_next");
        if (solvedNow) autoNext(1800);
    }
    function autoNext(delay) {
        clearTimeout(autoT);
        autoT = setTimeout(function () {
            if (!applies() || state !== "done" || phase !== "done" || !readyFrame()) return;
            if (typeof grade === "function") grade(false);
        }, delay);
    }

    function onMove(face, dir) {
        var f = mapF(FACES[face]);
        var d = dir === 0 ? 1 : 3;
        model = turn(model, f, d);
        if (mCands) mCands.forEach(function (c) { c.model = turn(c.model, f, d); });
        if (crossSt && window.CrossSolver) crossSt = CrossSolver.apply(crossSt, fmtMove(f, d));
        if (!applies()) return;
        if (phase === "done" && state === "done") { if (readyFrame()) { var h0 = el(HINT_ID); if (h0) h0.textContent = txt("bt_auto_soon"); autoNext(400); } return; }
        if (phase === "needSolve") {
            var fr = readyFrame();
            if (fr) { hold = fr; startScrambleTracking(); } else if (mOdd) renderScramble();
            return;
        }
        if (phase === "scrambling" && is222()) {
            step222();
            if (off2 > MAX_FIX) { phase = "needSolve"; tooMany = true; afterCase = false; renderScramble(); setHint("bt_hint_solve"); return; }
            if (prog2 === exp2.length - 1 && !off2) {
                todo = []; phase = "ready"; setHint("bt_hint_ready");
                var uni = Object.keys(NORMALS).filter(function (f) { return faceUniform222(model, f); });
                base2 = uni.length === 1 ? faceColor222(model, uni[0]) : null;
            }
            renderScramble();
            return;
        }
        if (phase === "scrambling") {
            if (mCands) {
                // Beklenen karıştırma hamlesine uyan adayları tut; tek aday kalınca onu kabul et
                var want = todo.length && !todo[0].fix ? todo[0].f : null, mf = f;
                var keep = want ? mCands.filter(function (c) { return c.frame.inv[mf] === want; }) : [];
                if (keep.length === 1 || !keep.length) {
                    var pick = keep[0] || mCands[0];
                    model = pick.model; hold = pick.frame; mCands = null;
                    // EO'da M çeyrek kayıksa case anlamı değişir: hizalamasını iste
                    if (current.id === "roux-eo" && hold.U !== "U" && hold.U !== "D") {
                        mOdd = true; phase = "needSolve"; renderScramble(); setHint("bt_hint_solve"); return;
                    }
                } else mCands = keep;
                if (mCands) hold = mCands[0].frame; // kalanlar bu hamle için aynı yüzü verir (ör. R, L)
            }
            f = hold.inv[f]; // merkezlere göre gelen yüz -> tutuştaki yüz
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
            // Çok fazla yanlış hamle: uzun düzeltme listesi yerine küpü çözmesini iste
            var fixCount = 0;
            for (var k = 0; k < todo.length && todo[k].fix; k++) fixCount += todo[k].q === 2 ? 2 : 1;
            if (fixCount > MAX_FIX && isCross()) { crossPrefix(); startScrambleTracking(); return; }
            if (fixCount > MAX_FIX) {
                phase = "needSolve"; tooMany = true; afterCase = false;
                renderScramble(); setHint("bt_hint_solve");
                return;
            }
            if (!todo.length && mCands) { model = mCands[0].model; hold = mCands[0].frame; mCands = null; }
            if (!todo.length) { phase = "ready"; setHint("bt_hint_ready"); if (isCross()) startInsp(); }
            renderScramble();
            return;
        }
        if (phase === "ready" && state === "idle") {
            phase = "solving";
            stopInsp();
            window.btSolveCount = 1; lastSolveFace = f;
            startTimer();
            if (caseDone(model)) { stopTimer(); phase = "done"; autoHint(); }
            return;
        }
        if ((phase === "solving" || state === "running") && state === "running") {
            if (window.btSolveCount != null && f !== lastSolveFace) window.btSolveCount++;
            lastSolveFace = f;
            if (caseDone(model)) { stopTimer(); phase = "done"; autoHint(); }
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
    function setStage(k, name) { stage = k; if (name) stageName = name; renderBar(); }
    function armTimeout(id) {
        clearTimeout(connTimer);
        connTimer = setTimeout(function () {
            if (id !== attempt || !connecting) return;
            attempt++; // geç gelen sonuçları yok say
            var where = stage ? txt("bt_st_" + stage) : "";
            connecting = false;
            try { if (lastDevice && lastDevice.gatt && lastDevice.gatt.connected) lastDevice.gatt.disconnect(); } catch (e) {}
            lastError = txt("bt_timeout") + (where ? " " + txt("bt_stage") + " " + where + "." : "");
            el("btConnect").disabled = false;
            renderBar();
        }, CONNECT_TIMEOUT);
    }
    function macProvider(device, isFallback) {
        var id = attempt;
        setStage("mac", device && device.name);
        if (isFallback || forceMac) clearTimeout(connTimer); // kullanıcı MAC yazarken süre işlemesin
        var p = macProvider0(device, isFallback);
        return Promise.resolve(p).then(function (m) { if (id === attempt) { setStage("link"); armTimeout(id); } return m; });
    }
    function macProvider0(device, isFallback) {
        var saved = savedMacs()[device.name || "?"];
        if (forceMac) { forceMac = false; return askMac(saved || lastMac || ""); }
        if (!isFallback) return Promise.resolve(saved || null);
        return askMac(saved || "");
    }

    /* Site tasarımında MAC adresi penceresi (tarayıcının prompt() kutusu yerine) */
    function askMac(initial) {
        return new Promise(function (resolve) {
            var modal = el("btModal"), input = el("btMacInput"), err = el("btMacErr");
            var map = { btMacTitle: "bt_mac_title", btMacIntro: "bt_mac_intro", btWayA: "bt_way_a", btWayA1: "bt_way_a1", btWayA2: "bt_way_a2",
                btWayA3: "bt_way_a3", btWayB: "bt_way_b", btWayB1: "bt_way_b1", btWayB2: "bt_way_b2", btWayB3: "bt_way_b3",
                btMacOk: "bt_mac_ok", btMacCancel: "bt_mac_cancel" };
            Object.keys(map).forEach(function (id) { el(id).textContent = txt(map[id]); });
            Array.prototype.forEach.call(modal.querySelectorAll(".bt-copy-btn"), function (b) {
                b.textContent = txt("bt_copy");
                b.onclick = function () {
                    var code = b.parentNode.querySelector("code").textContent;
                    var done = function () { b.textContent = txt("bt_copied"); setTimeout(function () { b.textContent = txt("bt_copy"); }, 1500); };
                    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, function () {});
                    else { var r = document.createRange(); r.selectNodeContents(b.parentNode.querySelector("code")); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
                };
            });
            input.value = initial; err.textContent = "";
            modal.classList.add("show");
            setTimeout(function () { input.focus(); }, 50);
            function close(v) {
                modal.classList.remove("show");
                el("btMacOk").onclick = el("btMacCancel").onclick = input.oninput = input.onkeydown = modal.onclick = null;
                resolve(v);
            }
            input.oninput = function () {
                // yazarken iki nokta üst üsteleri kendiliğinden ekle
                var hex = input.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 12);
                input.value = hex.replace(/(..)(?=.)/g, "$1:");
                err.textContent = "";
            };
            el("btMacOk").onclick = function () {
                var mac = input.value.trim().toUpperCase();
                if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) { err.textContent = txt("bt_mac_bad"); return; }
                close(mac);
            };
            el("btMacCancel").onclick = function () { close(null); };
            modal.onclick = function (e) { if (e.target === modal) close(null); };
            input.onkeydown = function (e) { if (e.key === "Enter") el("btMacOk").onclick(); else if (e.key === "Escape") close(null); };
        });
    }

    /* Site içi küp seçme penceresi. Chrome'un kendi cihaz listesi sadece ilk eşleşmede açılır;
       daha önce izin verilen küpler (getDevices) burada listelenir ve doğrudan bağlanır. */
    function openPicker() {
        if (!supported()) return;
        loadLib().catch(function () {}); // Chrome'un cihaz penceresi dokunuştan hemen sonra açılabilsin diye önceden yükle
        var modal = el("btPick"), list = el("btPickList");
        el("btPickTitle").textContent = txt("bt_pick_title");
        el("btPickIntro").textContent = txt("bt_pick_intro");
        el("btPickScan").textContent = txt("bt_pick_scan");
        el("btPickCancel").textContent = txt("bt_mac_cancel");
        list.innerHTML = "";
        function close() { modal.classList.remove("show"); modal.onclick = null; }
        el("btPickCancel").onclick = close;
        modal.onclick = function (e) { if (e.target === modal) close(); };
        el("btPickScan").onclick = function () { close(); connect(null); };
        var getter = navigator.bluetooth.getDevices ? navigator.bluetooth.getDevices() : Promise.resolve([]);
        getter.catch(function () { return []; }).then(function (devs) {
            if (lastDevice && !devs.some(function (d) { return d.id === lastDevice.id; })) devs = [lastDevice].concat(devs);
            var wantK = current && current.cube === "2x2" ? "2x2" : "3x3";
            devs = devs.filter(function (d) { return kindOf(d.name) === wantK; });
            if (!devs.length) {
                // Chrome kayıtlı küpleri bildirmiyorsa: hatırlamayı açan ayarı göster (Chrome listesi bir daha gelmesin)
                var flag = "chrome://flags/#enable-web-bluetooth-new-permissions-backend";
                list.innerHTML = '<p class="bt-pick-empty">' + esc(txt("bt_pick_none")) + '</p>' +
                    '<div class="bt-way"><b>' + esc(txt("bt_tip_title")) + '</b><ol><li>' + esc(txt("bt_tip_1")) + '</li><li>' +
                    esc(txt("bt_tip_2")) + '</li><li>' + esc(txt("bt_tip_3")) + '</li></ol>' +
                    '<div class="bt-copy"><code dir="ltr">' + flag + '</code><button class="btn-sm" type="button" id="btTipCopy">' + esc(txt("bt_copy")) + '</button></div></div>';
                el("btTipCopy").onclick = function () {
                    var b = this;
                    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(flag).then(function () {
                        b.textContent = txt("bt_copied"); setTimeout(function () { b.textContent = txt("bt_copy"); }, 1500);
                    }, function () {});
                };
                return;
            }
            devs.forEach(function (d) {
                var b = document.createElement("button");
                b.type = "button"; b.className = "bt-cube";
                b.innerHTML = '<span class="bt-icon" aria-hidden="true">🧊</span><span>' + esc(d.name || "Smart cube") +
                    '<small>' + esc(txt("bt_pick_known")) + '</small></span><span class="go">' + esc(txt("bt_pick_go")) + '</span>';
                b.onclick = function () { close(); connect(d); };
                list.appendChild(b);
            });
        });
        modal.classList.add("show");
    }

    function connect(knownDevice) {
        if (!supported()) return;
        // Kayıtlı küp seçildiyse kütüphanenin cihaz seçme çağrısını bir kereliğine o küpe yönlendir
        var bt = navigator.bluetooth, origRequest = bt.requestDevice;
        // Kayıtlı küp varsa doğrudan onu ver; yoksa Chrome'un listesini aç ve seçilen küpü bu sayfa için hafızada tut
        var id = ++attempt;
        lastError = ""; stage = ""; stageName = "";
        var want = current && current.cube === "2x2" ? "2x2" : "3x3";
        var P222 = ["GAN251", "gan251", "Gan251", "GANic251", "ganic251", "Ganic251"].map(function (x) { return { namePrefix: x }; });
        bt.requestDevice = function (opts) {
            bt.requestDevice = origRequest;
            // 2x2 setinde listede sadece 2x2 küpler, 3x3 setinde 2x2 küpler hariç
            opts = Object.assign({}, opts);
            if (want === "2x2") { opts.filters = P222; delete opts.acceptAllDevices; }
            else opts.exclusionFilters = P222;
            var found = function (d) { lastDevice = d; if (id === attempt) { setStage("found", d && d.name); armTimeout(id); } return d; };
            if (knownDevice) return Promise.resolve(found(knownDevice));
            setStage("pick");
            return origRequest.call(bt, opts).then(found);
        };
        el("btConnect").disabled = true;
        connecting = true; renderBar();
        loadLib().then(function () {
            return window.GanBT.connectSmartCube(macProvider);
        }).then(function (c) {
            if (id !== attempt) { try { c.disconnect(); } catch (e) {} return; } // zaman aşımından sonra geldi
            if (kindOf(c.deviceName) !== want) {
                // Yanlış tür küp: 3x3 setine 2x2, 2x2 setine 3x3 bağlanmaz
                clearTimeout(connTimer); stage = ""; connecting = false;
                try { c.disconnect(); } catch (e) {}
                el("btConnect").disabled = false;
                lastError = txt(want === "2x2" ? "bt_is333" : "bt_is222");
                renderBar();
                return;
            }
            clearTimeout(connTimer); stage = "";
            conn = c; connecting = false;
            gotEvent = false; noData = false; lastMac = c.deviceMAC || lastMac;
            try {
                var macs = savedMacs();
                if (c.deviceMAC) { macs[c.deviceName || "?"] = c.deviceMAC; localStorage.setItem(MAC_KEY, JSON.stringify(macs)); }
            } catch (e) {}
            modelKnown = false;
            sub = c.events$.subscribe(function (ev) {
                gotEvent = true;
                if (noData) { noData = false; renderBar(); }
                if (ev.type === "MOVE") {
                    onMove(ev.face, ev.direction);
                }
                else if (ev.type === "FACELETS") {
                    var fm = parseFacelets(ev.facelets);
                    if (!modelKnown || (pendingCheck && fm && (is222() ? solved222(fm) : rouxFrame(fm)))) {
                        // Küpün kendi bildirdiği durum: çözülmüş ya da (Roux) M katmanı kayık olabilir
                        if (fm) {
                            model = fm; modelKnown = true; mCands = null;
                            crossSt = (window.CrossSolver && isSolved(fm)) ? CrossSolver.SOLVED : null;
                        }
                        pendingCheck = false;
                        if (state !== "running") window.btOnNewCase();
                    }
                    pendingCheck = false;
                } else if (ev.type === "DISCONNECT") {
                    var wasUser = userDisconnect; userDisconnect = false;
                    dropConnection();
                    // Küp uykuya geçince vb. kopan bağlantıyı Chrome listesi açmadan bir kez yeniden kur
                    if (!wasUser && lastDevice) setTimeout(function () { if (!conn && !connecting) connect(lastDevice); }, 1500);
                }
            });
            if (!c.capabilities || c.capabilities.facelets) c.sendCommand({ type: "REQUEST_FACELETS" }).catch(function () {});
            else { model = solvedModel(); modelKnown = false; }
            setTimeout(function () {
                if (conn === c && !gotEvent) {
                    noData = true; renderBar();
                    var macs = savedMacs(); delete macs[c.deviceName || "?"];
                    try { localStorage.setItem(MAC_KEY, JSON.stringify(macs)); } catch (e) {}
                }
            }, 6000);
            el("btConnect").disabled = false;
            renderBar();
            window.btOnNewCase();
        }).catch(function (err) {
            if (bt.requestDevice !== origRequest) bt.requestDevice = origRequest;
            if (id !== attempt) return;
            clearTimeout(connTimer);
            var where = stage ? txt("bt_st_" + stage) : ""; stage = "";
            el("btConnect").disabled = false;
            conn = null; connecting = false;
            renderBar();
            if (err && err.name === "NotFoundError") return; // kullanıcı seçim penceresini kapattı
            lastError = txt("bt_failed") + (where ? " " + txt("bt_stage") + " " + where + "." : "") + (err && err.message ? " " + txt("bt_error") + " " + err.message : "");
            renderBar();
            console.error("Bluetooth bağlantısı kurulamadı:", err);
        });
    }
    function dropConnection() {
        if (sub) { try { sub.unsubscribe(); } catch (e) {} }
        sub = null; conn = null; phase = "off"; noData = false; stopInsp(); window.btSolveCount = null; mCands = null;
        if (isCross() && typeof curBaseScramble === "string" && curBaseScramble) curScramble = curBaseScramble;
        renderBar();
        if (curScramble) el(SCR_ID).textContent = curScramble;
        if (state === "idle") setHint("hint_ready");
    }
    function disconnect() {
        userDisconnect = true;
        // Hamle gelmiyorduysa MAC büyük ihtimalle yanlış: kaydı sil, sonraki bağlanmada yeniden sorulsun
        if (conn && noData) {
            var macs = savedMacs(); delete macs[conn.deviceName || "?"];
            try { localStorage.setItem(MAC_KEY, JSON.stringify(macs)); } catch (e) {}
            forceMac = true;
        }
        var c = conn;
        dropConnection();
        if (c) c.disconnect().catch(function () {});
    }
    var pendingCheck = false;
    function markSolved() {
        setSolved();
        // 2x2: küpün kendi kaydını da çözülmüş yap (çekirdek kaymış olsa bile model ile küp aynı kalır)
        if (is222() && conn) conn.sendCommand({ type: "REQUEST_RESET" }).catch(function () {});
        mCands = null;
        if (isRoux()) startMGuess();
        // Roux'da küp M kayık olabilir: küpün kendi durumunu iste, M dışında çözülmüşse onu kullan
        if (conn && (!conn.capabilities || conn.capabilities.facelets)) {
            pendingCheck = true;
            conn.sendCommand({ type: "REQUEST_FACELETS" }).catch(function () { pendingCheck = false; });
        }
        if (state === "running") return;
        window.btOnNewCase();
    }

    document.addEventListener("DOMContentLoaded", init);
    if (document.readyState !== "loading") init();
    var inited = false;
    function init() {
        if (inited || !el("btBar")) return;
        inited = true;
        el("btConnect").addEventListener("click", openPicker);
        el("btDisconnect").addEventListener("click", disconnect);
        el("btReset").addEventListener("click", markSolved);
        renderBar();
    }
    window.btRenderBar = renderBar;
    // Antrenörde tutuş değişti: küpün durumu yeni çerçevede yeniden okunur
    window.btHoldChanged = function () {
        if (!conn) { renderBar(); return; }
        mCands = null; crossSt = null;
        if (!conn.capabilities || conn.capabilities.facelets) {
            modelKnown = false;
            conn.sendCommand({ type: "REQUEST_FACELETS" }).catch(function () {});
        } else { model = solvedModel(); modelKnown = false; }
        renderBar();
        if (state !== "running") window.btOnNewCase();
    };
    window.btRenderScramble = renderScramble;
    window.btIsActive = function () { return applies() && phase !== "off"; };
})();
