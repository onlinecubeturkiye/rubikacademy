/* =========================================================
   AKILLI KÜP (akilli-kup.js) — Bluetooth özellikleri
   - Bağlantı: smartcube-bluetooth (GAN vb.), "Bağlan"a basınca yüklenir
   - Çözüm analizi: karıştırma takibi, ilk hamlede süre, CFOP aşamaları
     (Cross, F2L 1-4, OLL, PLL) süre / hamle / TPS, öneri, geçmiş
   - Canlı düello: iki kişi aynı karıştırma, Firestore "duels/{kod}" ile
     (1 sn'de bir yoklama). Yalnızca akıllı küple.
   Küp modeli: cubejs (Cube) — küpün kendi çerçevesi (beyaz üst, yeşil önde).
========================================================= */
(function () {
    var DNF = 99999999;
    var LIB_URL = "/js/vendor/smartcube-bluetooth.min.js?v=20261159";
    var MAC_KEY = "trainer-bt-mac-v1", HIST_KEY = "smart-solves-v1";
    var FACES = "URFDLB";
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function fmt(ms) { if (ms == null || isNaN(ms)) return "-"; if (ms >= 99999999) return "DNF"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

    /* ---------- küp modeli ve aşama tespiti ---------- */
    // cubejs sırası — kenarlar: UR UF UL UB DR DF DL DB FR FL BL BR · köşeler: URF UFL ULB UBR DFR DLF DBL DRB
    var EDGE_F = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];
    var CORN_F = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"];
    var OPP = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };
    var FACE_INFO = {};
    FACES.split("").forEach(function (X) {
        var cross = [], slots = [];
        EDGE_F.forEach(function (e, i) {
            if (e.indexOf(X) >= 0) cross.push(i);
            else if (e.indexOf(OPP[X]) < 0) {
                var c = -1;
                CORN_F.forEach(function (k, j) { if (k.indexOf(X) >= 0 && k.indexOf(e[0]) >= 0 && k.indexOf(e[1]) >= 0) c = j; });
                slots.push([i, c]);
            }
        });
        FACE_INFO[X] = { cross: cross, slots: slots };
    });
    function edgeOk(c, i) { return c.ep[i] === i && c.eo[i] === 0; }
    function cornOk(c, j) { return c.cp[j] === j && c.co[j] === 0; }
    function crossOk(c, X) { return FACE_INFO[X].cross.every(function (i) { return edgeOk(c, i); }); }
    function pairsOk(c, X) { return FACE_INFO[X].slots.filter(function (s) { return edgeOk(c, s[0]) && cornOk(c, s[1]); }).length; }
    function faceUniform(c, Y) { var s = c.asString(), k = FACES.indexOf(Y) * 9, ch = s[k + 4]; for (var i = 0; i < 9; i++) if (s[k + i] !== ch) return false; return true; }
    function solved(c) { return c.asString() === SOLVED_STR; }
    var SOLVED_STR = null;

    // 2x2: R U F ile rastgele 10 hamle (aynı yüz art arda gelmez)
    function genScramble222() {
        var sfx = ["", "'", "2"], out = [], last = -1, n = 10;
        while (out.length < n) { var f = Math.floor(Math.random() * 3); if (f === last) continue; out.push("RUF"[f] + sfx[Math.floor(Math.random() * 3)]); last = f; }
        return out.join(" ");
    }
    function genScramble() {
        var sfx = ["", "'", "2"], out = [], last = -1, prev = -1;
        while (out.length < 20) {
            var f = Math.floor(Math.random() * 6);
            if (f === last || (f % 3 === last % 3 && f % 3 === prev % 3)) continue;
            out.push(FACES[f] + sfx[Math.floor(Math.random() * 3)]); prev = last; last = f;
        }
        return out.join(" ");
    }
    function inv(m) { return m[1] === "2" ? m : (m[1] === "'" ? m[0] : m[0] + "'"); }
    // art arda aynı yüz hamlelerini birleştir (R R -> R2, R R' -> yok)
    function simplify(list) {
        var out = [];
        list.forEach(function (m) {
            var q = m[1] === "2" ? 2 : (m[1] === "'" ? 3 : 1);
            var last = out[out.length - 1];
            if (last && last.f === m[0]) { last.q = (last.q + q) % 4; if (!last.q) out.pop(); }
            else out.push({ f: m[0], q: q });
        });
        return out.map(function (x) { return x.f + (x.q === 2 ? "2" : x.q === 3 ? "'" : ""); });
    }

    /* ---------- durum ---------- */
    var cube = null;                 // Cube (cubejs)
    var conn = null, sub = null, connecting = false, lastDevice = null, modelKnown = false;
    var tab = "analysis";
    var scr = "", scrMoves = [], prefix = [], prog = 0, dev = [];
    var phase = "idle";              // idle | scrambling | ready | solving | done
    var t0 = 0, tick = 0, moves = [], st = null, lastResult = null;
    var duel = null;                 // { code, doc, me: "h"|"g" }

    /* ---------- karıştırma takibi ---------- */
    function setScramble(s) {
        scr = s; scrMoves = s.split(/\s+/).filter(Boolean);
        prefix = [];
        var c = new Cube(); prefix.push(c.asString());
        scrMoves.forEach(function (m) { c.move(m); prefix.push(c.asString()); });
        prog = 0; dev = [];
        phase = conn ? "scrambling" : "idle";
        if (conn && cube) syncProgress();
        stopTick(); $("akTime").textContent = "0.00"; miniHide(); last = null; renderLast();
        renderStages(null);
        renderScramble(); renderHint();
    }
    function syncProgress() {
        var s = cube.asString(), k = prefix.lastIndexOf(s);
        if (k >= 0) { prog = k; dev = []; }
        if (prog === scrMoves.length && phase === "scrambling") { phase = "ready"; dev = []; }
    }
    function renderScramble() {
        var html = scrMoves.map(function (m, i) {
            var cls = conn && (phase === "scrambling" || phase === "ready" || phase === "solving" || phase === "done") && i < prog ? "done" : (conn && phase === "scrambling" && i === prog && !dev.length ? "cur" : "");
            return '<span class="' + cls + '">' + esc(m) + "</span>";
        }).join(" ");
        $("akScr").innerHTML = html || "&nbsp;";
    }
    function renderHint() {
        var h = "";
        if (phase === "scrambling") {
            if (!modelKnown && prog === 0) h = "Küpü çözülmüş hale getir, beyaz üstte yeşil önde tutarak karıştırmayı uygula.";
            else if (dev.length) h = "⚠️ Yanlış hamle — geri al: <b dir=\"ltr\">" + esc(simplify(dev.slice().reverse().map(inv)).join(" ")) + "</b>";
            else h = "Karıştırmayı uygula (" + prog + " / " + scrMoves.length + ")";
        } else if (phase === "ready") h = "✅ Karıştırma tamam. <b>İlk hamlende süre başlar.</b>";
        else if (phase === "solving") h = "Çözülüyor…";
        else if (phase === "done") h = tab === "comp" ? "Kaydedildi ✓" : tab === "duel" ? "Bitti! Sonucun rakibine gönderildi." : "Bitti! Yeni karıştırma için butona bas.";
        else if (phase === "holding") h = "Bırakınca süre başlar…";
        else if (tab === "comp" && comp) h = compHint();
        else h = conn ? "" : "🔗 Başlamak için akıllı küpünü bağla.";
        $("akHint").innerHTML = h;
        var sv = $("akSolve"); if (sv) sv.hidden = tab === "comp"; // yarışmada süre girişi oda içinde
    }

    /* ---------- hamle geldi ---------- */
    function onMove(face, dir) {
        var m = FACES[face] + (dir === 0 ? "" : "'");
        if (!cube) cube = new Cube();
        cube.move(m);
        if (tab === "comp" && (!comp || comp.mode !== "bt" || !compCanSolve())) return;
        if (phase === "scrambling") {
            var s = cube.asString(), k = prefix.lastIndexOf(s);
            if (k >= 0) { prog = k; dev = []; } else dev.push(m);
            if (prog === scrMoves.length) { phase = "ready"; dev = []; publish("hazır"); }
            renderScramble(); renderHint();
            return;
        }
        if (phase === "ready") { startSolve(); }
        if (phase === "solving") {
            moves.push({ m: m, t: now() - t0 });
            stageCheck();
            if (solved(cube)) finishSolve();
        } else if (phase === "done" || phase === "idle") {
            // çözüldükten sonra yeniden karıştırmaya başlarsa takip et
            if (scr) { phase = "scrambling"; var s2 = cube.asString(), k2 = prefix.lastIndexOf(s2); prog = k2 >= 0 ? k2 : 0; dev = k2 >= 0 ? [] : [m]; renderScramble(); renderHint(); }
        }
    }

    /* ---------- çözüm ve aşamalar ---------- */
    function startSolve() {
        phase = "solving"; t0 = now(); moves = [];
        st = { face: null, cross: null, pairs: [null, null, null, null], oll: null, pll: null, crossIdx: 0, pairIdx: [0, 0, 0, 0], ollIdx: 0 };
        startTick(); renderHint(); renderStages(st); publish("çözüyor"); miniShow("run");
    }
    function stageCheck() {
        var t = now() - t0, n = moves.length;
        if (!st.face) {
            for (var i = 0; i < 6; i++) { var X = FACES[i]; if (crossOk(cube, X)) { st.face = X; st.cross = t; st.crossIdx = n; break; } }
        }
        if (st.face && crossOk(cube, st.face)) {
            var p = pairsOk(cube, st.face);
            for (var k = 0; k < p; k++) if (st.pairs[k] == null) { st.pairs[k] = t; st.pairIdx[k] = n; }
            if (p === 4 && st.oll == null && faceUniform(cube, OPP[st.face])) { st.oll = t; st.ollIdx = n; }
        }
        renderStages(st); publishStage();
    }
    function finishSolve() {
        var t = now() - t0;
        stopTick(); phase = "done";
        $("akTime").textContent = fmt(t);
        if (st.face) { for (var k = 0; k < 4; k++) if (st.pairs[k] == null) { st.pairs[k] = t; st.pairIdx[k] = moves.length; } if (st.oll == null) { st.oll = t; st.ollIdx = moves.length; } }
        st.pll = t;
        var r = buildResult(t);
        lastResult = r;
        var inDuel = !!(duel && tab === "duel") || tab === "comp";
        if (!inDuel) saveHist(r);
        renderStages(st); renderResult(r); renderHist(); renderHint();
        setLast(Math.round(t), false); miniShow("done");
        publishDone(Math.round(t)); compDone(Math.round(t));
    }
    function buildResult(total) {
        var segs = [];
        var names = ["Cross", "F2L 1", "F2L 2", "F2L 3", "F2L 4", "OLL", "PLL"];
        if (st.face) {
            var ends = [st.cross, st.pairs[0], st.pairs[1], st.pairs[2], st.pairs[3], st.oll, total];
            var idx = [st.crossIdx, st.pairIdx[0], st.pairIdx[1], st.pairIdx[2], st.pairIdx[3], st.ollIdx, moves.length];
            var pt = 0, pi = 0;
            for (var i = 0; i < 7; i++) {
                var mv = moves.slice(pi, idx[i]).map(function (x) { return x.m; });
                segs.push({ n: names[i], t: Math.max(0, ends[i] - pt), mv: simplify(mv) });
                pt = ends[i]; pi = idx[i];
            }
        }
        var all = simplify(moves.map(function (x) { return x.m; }));
        return { t: Math.round(total), ts: Date.now(), scr: scr, face: st.face, segs: segs.map(function (s) { return { n: s.n, t: Math.round(s.t), k: s.mv.length, mv: s.mv.join(" ") }; }), moves: all.length };
    }
    /* ---------- mini süre ekranı (çözüm sırasında ortada) ---------- */
    var miniT = 0;
    function miniShow(state) {
        var m = $("akMini"); clearTimeout(miniT);
        m.className = "ak-mini show " + (state || "") + (tab === "comp" && comp && comp.mode !== "bt" ? " nobt" : "");
        if (state === "done") miniT = setTimeout(miniHide, 2600);
    }
    function miniHide() { clearTimeout(miniT); $("akMini").className = "ak-mini"; }
    /* ---------- son çözüm + DNF ---------- */
    var last = null; // { ms, dnf, ctx: "a"|"d", ts }
    function setLast(ms, dnf, why) {
        last = { ms: ms, dnf: !!dnf, ctx: tab === "comp" ? "c" : duel && tab === "duel" ? "d" : "a", ts: Date.now(), idx: comp ? myTimes().length : -1 };
        renderLast(why);
    }
    function renderLast(why) {
        var b = $("akLast");
        if (!last) { b.hidden = true; return; }
        b.hidden = false;
        $("akLastT").textContent = last.dnf ? "DNF" + (last.ms < DNF ? " (" + fmt(last.ms) + ")" : "") : fmt(last.ms);
        $("akLastWhy").textContent = why || "";
        $("akDnf").textContent = last.dnf ? "↩︎ DNF'yi kaldır" : "DNF";
        $("akDnf").hidden = last.ms >= DNF; // bağlantı kopması: geri alınamaz
        $("akMiniDnf").textContent = $("akDnf").textContent; $("akMiniDnf").hidden = $("akDnf").hidden;
        $("akTime").textContent = last.dnf ? "DNF" : fmt(last.ms);
    }
    function toggleDnf() {
        if (!last || last.ms >= DNF) return;
        last.dnf = !last.dnf;
        if (last.ctx === "a") {
            var h = loadHist(); if (h[0] && Math.abs(h[0].ts - last.ts) < 5000) { h[0].dnf = last.dnf; try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) {} renderHist(); }
        } else if (last.ctx === "c") compSetDnf(last.idx, last.dnf);
        else setMyTime(last.dnf ? DNF : last.ms);
        renderLast();
    }
    function startTick() { stopTick(); tick = setInterval(function () { $("akTime").textContent = fmt(now() - t0); }, 37); }
    function stopTick() { clearInterval(tick); tick = 0; }

    var STAGE_COL = ["#ef4444", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#3b82f6", "#8b5cf6"];
    function renderStages(s) {
        var items = [["Cross", s && s.cross != null], ["F2L 1", s && s.pairs[0] != null], ["F2L 2", s && s.pairs[1] != null], ["F2L 3", s && s.pairs[2] != null], ["F2L 4", s && s.pairs[3] != null], ["OLL", s && s.oll != null], ["PLL", phase === "done" && s]];
        $("akStages").innerHTML = items.map(function (x, i) { return '<span class="ak-st' + (x[1] ? " on" : "") + '" style="--c:' + STAGE_COL[i] + '">' + x[0] + "</span>"; }).join("");
    }
    function adviceFor(r) {
        if (!r.segs.length) return "Aşamalar CFOP'a uymadı (cross bulunamadı). Analiz CFOP çözümleri için çalışır.";
        var s = r.segs, f2l = s[1].t + s[2].t + s[3].t + s[4].t, out = [];
        var tps = function (x) { return x.t ? x.k / (x.t / 1000) : 0; };
        if (s[0].k > 9) out.push("Cross " + s[0].k + " hamle sürdü: inceleme sırasında cross'u <b>8 hamle ve altı</b> planlamaya çalış. <a href=\"/icerikler/algoritmalar/antrenor\">Cross antrenörü →</a>");
        if (f2l / r.t > 0.55) out.push("Sürenin <b>%" + Math.round(f2l / r.t * 100) + "</b>'i F2L'de geçti. Çiftler arasındaki duraksamaları azaltmak için yavaş ama kesintisiz (look-ahead) çöz.");
        if (s[5].k && tps(s[5]) < 3) out.push("OLL'de hamle hızın düşük (" + tps(s[5]).toFixed(1) + " TPS): tanıma süresi uzun. <a href=\"/icerikler/algoritmalar/antrenor\">Tanıma antrenörü →</a>");
        if (s[6].k && tps(s[6]) < 3) out.push("PLL'de tanıma/duraksama var (" + tps(s[6]).toFixed(1) + " TPS). PLL'leri AUF'tan önce tanımaya çalış.");
        if (!out.length) out.push("Dengeli bir çözüm! En uzun aşaman: <b>" + s.slice().sort(function (a, b) { return b.t - a.t; })[0].n + "</b>.");
        return out.join("<br>");
    }
    function renderResult(r) {
        var box = $("akResult"); box.hidden = false;
        var tps = r.t ? (r.moves / (r.t / 1000)).toFixed(2) : "-";
        var bar = r.segs.map(function (s, i) { return '<i style="flex:' + Math.max(s.t, 1) + ';background:' + STAGE_COL[i] + '" title="' + s.n + " " + fmt(s.t) + '"></i>'; }).join("");
        var rows = r.segs.map(function (s, i) {
            return '<tr><td><span class="ak-dot" style="background:' + STAGE_COL[i] + '"></span>' + s.n + '</td><td>' + fmt(s.t) + '</td><td>' + s.k + '</td><td>' + (s.t ? (s.k / (s.t / 1000)).toFixed(1) : "-") + '</td><td class="ak-mv" dir="ltr">' + esc(s.mv) + "</td></tr>";
        }).join("");
        box.innerHTML = '<h2>📊 Çözüm analizi</h2>' +
            '<div class="ak-sum"><div><b>' + fmt(r.t) + '</b><span>Süre</span></div><div><b>' + r.moves + '</b><span>Hamle</span></div><div><b>' + tps + '</b><span>TPS</span></div><div><b>' + (r.face ? r.face.replace("D", "Alt").replace("U", "Üst").replace("F", "Ön").replace("B", "Arka").replace("R", "Sağ").replace("L", "Sol") : "-") + '</b><span>Cross yüzü</span></div></div>' +
            (r.segs.length ? '<div class="ak-bar">' + bar + '</div><div class="ak-tbl"><table><thead><tr><th>Aşama</th><th>Süre</th><th>Hamle</th><th>TPS</th><th>Hamleler</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : "") +
            '<div class="ak-tip">💡 ' + adviceFor(r) + '</div>';
    }

    /* ---------- geçmiş ---------- */
    function loadHist() { try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) { return []; } }
    function saveHist(r) { var h = loadHist(); h.unshift(r); h = h.slice(0, 100); try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) {} }
    function renderHist() {
        var h = loadHist(), box = $("akHist");
        if (!h.length) { box.innerHTML = '<p class="ak-empty">Henüz analiz edilmiş çözüm yok. Akıllı küpünü bağla ve bir çözüm yap.</p>'; return; }
        var last = h.slice(0, 12), withSegs = last.filter(function (r) { return r.segs && r.segs.length === 7; });
        var avg = function (arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; };
        var mean = avg(last.filter(function (r) { return !r.dnf; }).map(function (r) { return r.t; }));
        var segAvg = withSegs.length ? ["Cross", "F2L", "OLL", "PLL"].map(function (n, i) {
            var v = avg(withSegs.map(function (r) { return i === 0 ? r.segs[0].t : i === 1 ? r.segs[1].t + r.segs[2].t + r.segs[3].t + r.segs[4].t : i === 2 ? r.segs[5].t : r.segs[6].t; }));
            return '<div><b>' + fmt(v) + '</b><span>' + n + ' ort.</span></div>';
        }).join("") : "";
        box.innerHTML = '<div class="ak-sum">' + '<div><b>' + fmt(mean) + '</b><span>Son ' + last.length + ' ort.</span></div>' + segAvg + '</div>' +
            '<ul class="ak-list">' + h.slice(0, 10).map(function (r, i) {
                var d = new Date(r.ts);
                return '<li><button type="button" data-h="' + i + '"><b>' + (r.dnf ? "DNF" + (r.t < DNF ? " (" + fmt(r.t) + ")" : "") : fmt(r.t)) + '</b><span>' + r.moves + ' hamle · ' + d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) + '</span></button></li>';
            }).join("") + '</ul><button type="button" class="ak-link" id="akHistClear">Geçmişi temizle</button>';
        Array.prototype.forEach.call(box.querySelectorAll("[data-h]"), function (b) { b.onclick = function () { renderResult(loadHist()[+b.getAttribute("data-h")]); $("akResult").scrollIntoView({ behavior: "smooth", block: "start" }); }; });
        $("akHistClear").onclick = function () { if (confirm("Analiz geçmişi silinsin mi?")) { try { localStorage.removeItem(HIST_KEY); } catch (e) {} renderHist(); } };
    }


    /* ---------- Bluetooth bağlantısı ---------- */
    function supported() { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice); }
    function loadLib() {
        if (window.GanBT) return Promise.resolve();
        return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = LIB_URL; s.onload = res; s.onerror = function () { rej(new Error("lib")); }; document.head.appendChild(s); });
    }
    function savedMacs() { try { return JSON.parse(localStorage.getItem(MAC_KEY)) || {}; } catch (e) { return {}; } }
    function askMac(initial) {
        return new Promise(function (resolve) {
            var m = $("akMac"), inp = $("akMacIn");
            inp.value = initial || ""; $("akMacErr").textContent = ""; m.classList.add("show"); setTimeout(function () { inp.focus(); }, 50);
            function close(v) { m.classList.remove("show"); resolve(v); }
            inp.oninput = function () { var hex = inp.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 12); inp.value = hex.replace(/(..)(?=.)/g, "$1:"); };
            $("akMacOk").onclick = function () { var v = inp.value.trim().toUpperCase(); if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(v)) { $("akMacErr").textContent = "Geçerli bir MAC adresi yaz (ör. AB:12:CD:34:EF:56)."; return; } close(v); };
            $("akMacNo").onclick = function () { close(null); };
        });
    }
    function macProvider(device, isFallback) {
        var saved = savedMacs()[(device && device.name) || "?"];
        if (!isFallback) return Promise.resolve(saved || null);
        return askMac(saved || "");
    }
    function setConn(text, cls) { var s = $("akConnState"); s.textContent = text; s.className = "ak-pill " + (cls || ""); }
    function connect() {
        if (!supported()) return;
        if (conn || connecting) return;
        connecting = true; $("akConnect").disabled = true; setConn("Bağlanıyor…", "wait");
        var P222 = ["GAN251", "gan251", "Gan251", "GANic251", "ganic251", "Ganic251"].map(function (x) { return { namePrefix: x }; });
        var bt = navigator.bluetooth, orig = bt.requestDevice;
        bt.requestDevice = function (opts) { bt.requestDevice = orig; opts = Object.assign({}, opts, { exclusionFilters: P222 }); return orig.call(bt, opts).then(function (d) { lastDevice = d; return d; }); };
        loadLib().then(function () { return window.GanBT.connectSmartCube(macProvider); }).then(function (c) {
            if (bt.requestDevice !== orig) bt.requestDevice = orig;
            conn = c; connecting = false; modelKnown = false; cube = new Cube();
            try { if (c.deviceMAC) { var macs = savedMacs(); macs[c.deviceName || "?"] = c.deviceMAC; localStorage.setItem(MAC_KEY, JSON.stringify(macs)); } } catch (e) {}
            sub = c.events$.subscribe(function (ev) {
                if (ev.type === "MOVE") onMove(ev.face, ev.direction);
                else if (ev.type === "FACELETS") {
                    if (!modelKnown && ev.facelets && ev.facelets.length === 54) {
                        try { cube = Cube.fromString(ev.facelets); modelKnown = true; } catch (e) {}
                        if (phase === "scrambling" || phase === "idle") { phase = "scrambling"; syncProgress(); renderScramble(); renderHint(); }
                    }
                } else if (ev.type === "BATTERY") { $("akBatt").textContent = ev.batteryLevel != null ? "🔋 %" + ev.batteryLevel : ""; }
                else if (ev.type === "DISCONNECT") dropConn();
            });
            if (!c.capabilities || c.capabilities.facelets) c.sendCommand({ type: "REQUEST_FACELETS" }).catch(function () {});
            try { c.sendCommand({ type: "REQUEST_BATTERY" }).catch(function () {}); } catch (e) {}
            setConn("Bağlı: " + (c.deviceName || "akıllı küp"), "ok");
            var dq = new URLSearchParams(location.search).get("duel"); // bağlantıyla gelen düello daveti
            if (dq && !duel && signedIn()) setTimeout(function () { joinDuel(dq); }, 300);
            $("akConnect").hidden = true; $("akDisc").hidden = false; $("akConnect").disabled = false; $("akReset").hidden = false;
            if (phase !== "solving") { phase = "scrambling"; syncProgress(); }
            renderScramble(); renderHint();
        }).catch(function (err) {
            if (bt.requestDevice !== orig) bt.requestDevice = orig;
            connecting = false; $("akConnect").disabled = false;
            if (err && err.name === "NotFoundError") { setConn("Bağlı değil", ""); return; }
            setConn("Bağlanamadı" + (err && err.message ? ": " + err.message : ""), "bad");
        });
    }
    function dropConn() {
        if (sub) { try { sub.unsubscribe(); } catch (e) {} }
        sub = null; conn = null; modelKnown = false;
        if (phase === "solving") { // çözüm sırasında bağlantı koptu: DNF
            var t = now() - t0; stopTick(); phase = "done";
            if (!(duel && tab === "duel") && tab !== "comp") { var r = buildResult(t); r.dnf = true; r.t = DNF; saveHist(r); renderHist(); }
            setLast(DNF, true, "Bağlantı koptu"); miniShow("done");
            publishDone(DNF); compDone(DNF);
        }
        if (phase !== "done") phase = "idle";
        setConn("Bağlı değil", ""); $("akConnect").hidden = false; $("akDisc").hidden = true; $("akReset").hidden = true; $("akBatt").textContent = "";
        renderScramble(); renderHint();
    }
    function disconnect() { var c = conn; dropConn(); if (c) c.disconnect().catch(function () {}); }
    // Kullanıcı "küpüm çözülmüş" derse modeli sıfırla (küp durumu bildiremiyorsa)
    function resetModel() { cube = new Cube(); modelKnown = true; if (phase !== "solving") { phase = "scrambling"; syncProgress(); } renderScramble(); renderHint(); }

    /* ---------- düello (Firestore REST) ---------- */
    var cfg = window.RA_FIREBASE || {}, pollT = 0;
    function docsBase() { return "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents"; }
    function api(path, opts) {
        return window.Account.token().then(function (tok) {
            opts = opts || {}; opts.headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };
            return fetch(docsBase() + path + (path.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(cfg.apiKey), opts);
        });
    }
    function val(v) { return typeof v === "number" ? { integerValue: String(v) } : { stringValue: String(v) }; }
    function parseDoc(d) { var o = {}, f = (d && d.fields) || {}; Object.keys(f).forEach(function (k) { var x = f[k]; o[k] = x.integerValue != null ? +x.integerValue : (x.stringValue != null ? x.stringValue : x.timestampValue); }); return o; }
    function patch(fields) {
        var body = {}, mask = Object.keys(fields).concat(["ts"]).map(function (k) { return "updateMask.fieldPaths=" + k; }).join("&");
        Object.keys(fields).forEach(function (k) { body[k] = val(fields[k]); });
        body.ts = { timestampValue: new Date().toISOString() };
        return api("/duels/" + duel.code + "?" + mask, { method: "PATCH", body: JSON.stringify({ fields: body }) });
    }
    function myName() { var u = window.Account && Account.user && Account.user(); return String((u && (u.displayName || (u.email || "").split("@")[0])) || "Oyuncu").slice(0, 24); }
    function code5() { var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = ""; for (var i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
    function signedIn() { return !!(window.Account && Account.user && Account.user()); }
    function needCube() { if (conn) return false; duelMsg("⚔️ Düello yalnızca akıllı küple oynanır. Önce yukarıdan <b>küpünü bağla</b>.", 1); return true; }
    function createDuel() {
        if (!signedIn()) { Account.openLogin && Account.openLogin(); return; }
        if (needCube()) return;
        var c = code5(), u = Account.user(), s = genScramble();
        var fm = +(document.querySelector('input[name="akFmt"]:checked') || {}).value || 5;
        var fields = { host: u.uid, hName: myName(), guest: "", gName: "", round: 1, scr: s, hT: -1, gT: -1, hSt: "bekliyor", gSt: "", hW: 0, gW: 0, sc: 0, fmt: fm, hL: "", gL: "" };
        var body = {}; Object.keys(fields).forEach(function (k) { body[k] = val(fields[k]); }); body.ts = { timestampValue: new Date().toISOString() };
        duelMsg("Oda oluşturuluyor…");
        api("/duels?documentId=" + c, { method: "POST", body: JSON.stringify({ fields: body }) }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            enterDuel(c, "h");
        }).catch(function (e) { duelMsg("Oda oluşturulamadı (" + esc(e.message) + "). Kurallar yayımlandı mı?", 1); });
    }
    function joinDuel(c) {
        c = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (c.length !== 5) { duelMsg("Oda kodu 5 karakter olmalı.", 1); return; }
        if (!signedIn()) { Account.openLogin && Account.openLogin(); return; }
        if (needCube()) return;
        duelMsg("Odaya bağlanılıyor…");
        api("/duels/" + c, { method: "GET" }).then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? "Oda bulunamadı" : r.status); return r.json(); }).then(function (d) {
            var o = parseDoc(d), uid = Account.user().uid;
            if (o.host === uid) return enterDuel(c, "h");
            if (o.guest === uid) return enterDuel(c, "g");
            if (o.guest) throw new Error("Oda dolu");
            duel = { code: c, me: "g", doc: o };
            return patch({ guest: uid, gName: myName(), gSt: "bekliyor" }).then(function (r2) { if (!r2.ok) throw new Error(r2.status); enterDuel(c, "g"); });
        }).catch(function (e) { duel = null; duelMsg(esc(e.message), 1); });
    }
    function enterDuel(c, me) {
        duel = { code: c, me: me, doc: null, round: 0 };
        try { history.replaceState(null, "", "?duel=" + c); } catch (e) {}
        $("akLobby").hidden = true; $("akRoom").hidden = false; duelMsg("");
        poll();
        clearInterval(pollT); pollT = setInterval(function () { if (document.visibilityState === "visible") poll(); }, 1200);
    }
    function leaveDuel() {
        clearInterval(pollT); duel = null;
        try { history.replaceState(null, "", location.pathname); } catch (e) {}
        $("akLobby").hidden = false; $("akRoom").hidden = true;
        setScramble(genScramble());
    }
    function poll() {
        if (!duel) return;
        api("/duels/" + duel.code, { method: "GET" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
            if (!duel) return;
            var o = parseDoc(d); duel.doc = o;
            if (o.round !== duel.round) { duel.round = o.round; if (tab === "duel") setScramble(o.scr); }
            // Ev sahibi: iki süre de geldiyse turu puanla
            if (duel.me === "h" && o.guest) {
                var hl = listOf(o.hL), gl = listOf(o.gL), hw = 0, gw = 0;
                for (var i = 0; i < Math.min(hl.length, gl.length); i++) { if (hl[i] < gl[i]) hw++; else if (gl[i] < hl[i]) gw++; }
                if (hw !== o.hW || gw !== o.gW) patch({ hW: hw, gW: gw, sc: o.round });
            }
            renderRoom(o);
        }).catch(function () {});
    }
    var lastPub = "";
    function publish(stText) {
        if (!duel || tab !== "duel") return;
        var k = duel.me === "h" ? "hSt" : "gSt";
        if (lastPub === stText) return; lastPub = stText;
        var f = {}; f[k] = stText; patch(f);
    }
    function publishStage() {
        if (!st) return;
        var p = st.pairs.filter(function (x) { return x != null; }).length;
        publish(st.oll != null ? "çözüyor · PLL" : p ? "çözüyor · F2L " + p + "/4" : st.cross != null ? "çözüyor · F2L" : "çözüyor · Cross");
    }
    function publishDone(ms) {
        if (!duel || tab !== "duel") return;
        var d = duel.doc || {}, mine = duel.me === "h" ? d.hT : d.gT;
        if (mine >= 0 && d.round === duel.round) return; // bu turda zaten gönderdi
        var f = {}; f[duel.me + "T"] = ms; f[duel.me + "St"] = "bitti"; lastPub = "bitti";
        var L = listOf(duel.me === "h" ? d.hL : d.gL), ri = Math.max(1, d.round || 1) - 1;
        if (ri >= (d.fmt || 5)) return; // maç bitti, fazla çözüm sayılmaz
        L = L.slice(0, ri); while (L.length < ri) L.push(0); L[ri] = ms; // her tur kendi yerine
        L = L.map(function (x) { return x || ms; });
        f[duel.me + "L"] = L.join(",");
        patch(f).then(poll);
    }
    function setMyTime(ms) {
        if (!duel || !duel.doc) return;
        var d = duel.doc, ri = Math.max(1, d.round || 1) - 1, L = listOf(duel.me === "h" ? d.hL : d.gL);
        if (ri >= (d.fmt || 5) || L.length <= ri) return;
        L[ri] = ms; var f = {}; f[duel.me + "T"] = ms; f[duel.me + "L"] = L.join(",");
        patch(f).then(poll);
    }
    function nextRound() {
        if (!duel || duel.me !== "h" || !duel.doc) return;
        var o = duel.doc; lastPub = "";
        if (matchOver(o)) { // rövanş: aynı formatla baştan
            closeFinal();
            patch({ round: 1, scr: genScramble(), hT: -1, gT: -1, hSt: "bekliyor", gSt: o.guest ? "bekliyor" : "", hW: 0, gW: 0, hL: "", gL: "", sc: 0 }).then(poll);
            return;
        }
        patch({ round: o.round + 1, scr: genScramble(), hT: -1, gT: -1, hSt: "bekliyor", gSt: o.guest ? "bekliyor" : "" }).then(poll);
    }
    /* ---------- maç formatı ve sonuçlar ---------- */
    function listOf(str) { return String(str || "").split(",").filter(Boolean).map(Number); }
    function fmtName(n) { return n === 3 ? "mo3" : n === 12 ? "ao12" : "ao5"; }
    function avgOf(arr, n) {
        if (arr.length < n) return null;
        var a = arr.slice(0, n);
        if (n !== 3) a = a.slice().sort(function (x, y) { return x - y; }).slice(1, -1); // en iyi ve en kötü atılır (DNF en kötüdür)
        if (a.some(function (x) { return x >= DNF; })) return DNF;
        return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    }
    // Maç bitti: son turda (tur = format sayısı) iki süre de geldi
    function matchOver(o) { var n = o.fmt || 5; return !!o.guest && o.hT >= 0 && o.gT >= 0 && (o.round || 1) >= n; }
    function matchData(o) {
        var n = o.fmt || 5, hl = listOf(o.hL).slice(0, n), gl = listOf(o.gL).slice(0, n);
        var ha = avgOf(hl, n), ga = avgOf(gl, n);
        var win = ha == null || ga == null ? "" : (ha < ga ? "h" : ga < ha ? "g" : "");
        return { n: n, f: fmtName(n), hl: hl, gl: gl, ha: ha, ga: ga, win: win, hw: o.hW, gw: o.gW };
    }
    function shareText(o, m) {
        var line = function (name, l, a) { return name + ": " + fmt(a) + " " + m.f + " (" + l.map(fmt).join(", ") + ")"; };
        var w = m.win === "h" ? o.hName : m.win === "g" ? o.gName : "";
        return "⚔️ Rubik Academy düellosu (" + m.f + ")\n" + line(o.hName, m.hl, m.ha) + "\n" + line(o.gName, m.gl, m.ga) + "\n" +
            (w ? "🏆 Kazanan: " + w : "🤝 Berabere") + " · Tur skoru " + m.hw + "-" + m.gw + "\nrubikacademy.fun/icerikler/akilli-kup";
    }
    function shareImage(o, m) {
        var W = 1080, H = 1080, c = document.createElement("canvas"); c.width = W; c.height = H;
        var x = c.getContext("2d"), cs = getComputedStyle(document.body);
        var acc = (cs.getPropertyValue("--ui-accent") || "#6c5ce7").trim();
        var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0b0d14"); g.addColorStop(1, "#1d1838");
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.textAlign = "center"; x.fillStyle = "#a4aabe"; x.font = "700 34px Inter, sans-serif";
        x.fillText("RUBIK ACADEMY · DÜELLO · " + m.f.toUpperCase(), W / 2, 110);
        function player(cx, name, l, a, won) {
            x.fillStyle = won ? acc : "#1a1e2c"; roundRect(x, cx - 230, 190, 460, 560, 36); x.fill();
            x.fillStyle = won ? "#ffffff" : "#eef0f7"; x.font = "800 44px Inter, sans-serif"; x.fillText(clip(name, 16), cx, 280);
            x.font = "900 96px 'JetBrains Mono', monospace"; x.fillText(fmt(a), cx, 410);
            x.font = "700 30px Inter, sans-serif"; x.fillStyle = won ? "rgba(255,255,255,.85)" : "#a4aabe"; x.fillText(m.f, cx, 455);
            x.font = "600 28px 'JetBrains Mono', monospace";
            l.forEach(function (t, i) { x.fillText(fmt(t), cx + (i % 2 ? 100 : -100), 520 + Math.floor(i / 2) * 40); });
            if (won) { x.font = "900 40px Inter, sans-serif"; x.fillStyle = "#fff"; x.fillText("🏆 KAZANAN", cx, 720); }
        }
        player(290, o.hName, m.hl, m.ha, m.win === "h");
        player(790, o.gName, m.gl, m.ga, m.win === "g");
        x.fillStyle = "#eef0f7"; x.font = "900 54px Inter, sans-serif"; x.fillText("VS", W / 2, 470);
        x.font = "800 40px Inter, sans-serif"; x.fillText("Tur skoru " + m.hw + " - " + m.gw, W / 2, 860);
        x.fillStyle = "#a4aabe"; x.font = "700 30px Inter, sans-serif"; x.fillText("rubikacademy.fun/icerikler/akilli-kup", W / 2, 990);
        return new Promise(function (res) { c.toBlob(res, "image/png"); });
    }
    function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
    function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
    function renderFinal(o) {
        var m = matchData(o), meH = duel.me === "h", box = $("akFinalBox");
        var col = function (name, l, a, won, mine) {
            return '<div class="ak-fin-p' + (won ? " win" : "") + '"><div class="ak-pl-n">' + esc(name) + (mine ? " <small>(sen)</small>" : "") + '</div>' +
                '<div class="ak-fin-a">' + fmt(a) + '</div><div class="ak-fin-f">' + m.f + '</div>' +
                '<div class="ak-fin-l">' + l.map(function (t) { return '<span>' + fmt(t) + '</span>'; }).join("") + '</div>' + (won ? '<div class="ak-fin-w">🏆 Kazanan</div>' : "") + '</div>';
        };
        $("akFinal").classList.add("show");
        box.innerHTML = '<button type="button" class="ak-x" id="akFinClose" aria-label="Kapat">✕</button><h3>🏁 Maç bitti · ' + m.f + '</h3>' +
            '<p class="ak-fin-k">' + (m.win ? '🏆 Kazanan: <b>' + esc(m.win === "h" ? o.hName : o.gName) + '</b>' : '🤝 Berabere') + '</p><div class="ak-fin">' + col(o.hName, m.hl, m.ha, m.win === "h", meH) + col(o.gName, m.gl, m.ga, m.win === "g", !meH) + '</div>' +
            '<p class="ak-fin-s">' + (m.win ? "" : "🤝 Berabere · ") + 'Tur skoru ' + m.hw + ' - ' + m.gw + '</p>' +
            '<div class="ak-fin-b"><button type="button" class="btn primary" id="akShareImg">🖼️ Görsel olarak paylaş</button><button type="button" class="btn" id="akShareTxt">📝 Metin olarak paylaş</button></div>' +
            '<div class="ak-fin-b" style="margin-top:8px">' + (meH ? '<button type="button" class="btn" id="akRematch">🔁 Rövanş</button>' : '') + '<button type="button" class="btn" id="akFinClose2">Kapat</button></div><div class="ak-msg" id="akShareMsg"></div>';
        $("akFinClose").onclick = $("akFinClose2").onclick = closeFinal;
        if ($("akRematch")) $("akRematch").onclick = nextRound;
        $("akShareTxt").onclick = function () {
            var t = shareText(o, m);
            if (navigator.share) navigator.share({ text: t }).catch(function () {});
            else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $("akShareMsg").textContent = "Metin kopyalandı ✓"; });
            else prompt("Sonuç:", t);
        };
        $("akShareImg").onclick = function () {
            shareImage(o, m).then(function (blob) {
                var file = new File([blob], "rubikacademy-duello.png", { type: "image/png" });
                if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], text: shareText(o, m) }).catch(function () {});
                else { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); $("akShareMsg").textContent = "Görsel indirildi ✓"; }
            });
        };
    }
    function closeFinal() { $("akFinal").classList.remove("show"); }
    function renderRoom(o) {
        $("akCode").textContent = duel.code;
        var meH = duel.me === "h";
        function card(name, w, t, s, mine, empty) {
            if (empty) return '<div class="ak-pl wait"><div class="ak-pl-n">Rakip bekleniyor…</div><div class="ak-pl-s">Oda kodunu ya da bağlantıyı paylaş</div></div>';
            var win = o.hT >= 0 && o.gT >= 0 && ((mine ? (meH ? o.hT < o.gT : o.gT < o.hT) : (meH ? o.gT < o.hT : o.hT < o.gT)));
            return '<div class="ak-pl' + (mine ? " me" : "") + (win ? " win" : "") + '"><div class="ak-pl-n">' + esc(name) + (mine ? " <small>(sen)</small>" : "") + '</div>' +
                '<div class="ak-pl-w">' + w + '</div><div class="ak-pl-t">' + (t >= 0 ? fmt(t) : "—") + '</div><div class="ak-pl-s">' + esc(s || "") + (win ? " · 🏆 turu kazandı" : "") + '</div></div>';
        }
        var a = card(o.hName, o.hW, o.hT, o.hSt, meH, false), b = card(o.gName, o.gW, o.gT, o.gSt, !meH, !o.guest);
        $("akPlayers").innerHTML = a + '<div class="ak-vs">VS</div>' + b;
        var n = o.fmt || 5, over = matchOver(o);
        $("akRound").textContent = fmtName(n) + " · Tur " + Math.min(o.round || 1, n) + " / " + n;
        var both = o.hT >= 0 && o.gT >= 0;
        $("akNext").hidden = !meH; $("akNext").disabled = !o.guest || !both;
        $("akNext").textContent = over ? "🔁 Rövanş" : both ? "Sonraki tur →" : "Tur sürüyor…";
        var fk = [o.hL, o.gL, o.hW, o.gW, o.round].join("|");
        if (over) { if (duel.shown !== fk) { duel.shown = fk; renderFinal(o); } } else { duel.shown = ""; closeFinal(); }
        $("akShowFin").hidden = !over;
        $("akRoomHint").textContent = over ? (meH ? "Maç bitti. Rövanş başlatabilirsin." : "Maç bitti.") : !o.guest ? "Rakibin katılınca aynı karıştırmayı çözeceksiniz." : (both ? (meH ? "Sonraki turu başlatabilirsin." : "Ev sahibi sonraki turu başlatacak.") : "Karıştırmayı uygula ve çöz. Rakibinin durumu canlı görünür.");
    }
    function duelMsg(t, bad) { var m = $("akDuelMsg"); m.innerHTML = t || ""; m.className = "ak-msg" + (bad ? " bad" : ""); }


    /* =========================================================
       EV YARIŞMASI — comps/{kod} + comps/{kod}/p/{uid}
       8-16 kişi, 3x3 ya da 2x2, her tur 5 çözüm (Ao5). Organizatör turları yönetir.
       Süre girişi: akıllı küp (bt), timer (boşluk/dokunma), elle yazma.
    ========================================================= */
    var comp = null; // { code, doc, players, mode, uid, round, orig, shownR }
    var compPollT = 0;
    function cPath(x) { return "/comps/" + comp.code + (x || ""); }
    function cMsg(t, bad) { var m = $("cMsg"); m.innerHTML = t || ""; m.className = "ak-msg" + (bad ? " bad" : ""); }
    function cBody(fields) { var b = {}; Object.keys(fields).forEach(function (k) { b[k] = val(fields[k]); }); b.ts = { timestampValue: new Date().toISOString() }; return b; }
    function cMask(fields) { return Object.keys(fields).concat(["ts"]).map(function (k) { return "updateMask.fieldPaths=" + k; }).join("&"); }
    // Giriş yapmamış izleyici de okuyabilsin (kurallar comps okumayı herkese açar)
    function apiAny(path, opts) {
        if (signedIn()) return api(path, opts);
        opts = opts || {}; opts.headers = { "Content-Type": "application/json" };
        return fetch(docsBase() + path + (path.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(cfg.apiKey), opts);
    }
    function viewerId() {
        if (signedIn()) return Account.user().uid;
        try { var v = localStorage.getItem("ra-viewer-id"); if (!v) { v = "v" + Math.random().toString(36).slice(2, 14); localStorage.setItem("ra-viewer-id", v); } return v; }
        catch (e) { return "v" + Math.random().toString(36).slice(2, 14); }
    }
    // Canlı izleyici sayısı: herkes 20 sn'de bir comps/{kod}/w/{id} yazar; son 45 sn'de yazanlar sayılır
    var HB_MS = 30000, FRESH_MS = 75000, hbT = 0;
    function heartbeat() {
        if (!comp) return;
        var body = { fields: { ts: { timestampValue: new Date().toISOString() } } };
        apiAny(cPath("/w/" + viewerId()) + "?updateMask.fieldPaths=ts", { method: "PATCH", body: JSON.stringify(body) }).catch(function () {});
    }
    function compPatch(fields) { return api(cPath() + "?" + cMask(fields), { method: "PATCH", body: JSON.stringify({ fields: cBody(fields) }) }); }
    function mePatch(fields) { return api(cPath("/p/" + comp.uid) + "?" + cMask(fields), { method: "PATCH", body: JSON.stringify({ fields: cBody(fields) }) }); }
    function isOrgUser() {
        if (!signedIn()) return Promise.resolve(false);
        if (Account.isAdmin && Account.isAdmin()) return Promise.resolve(true);
        return Account.getRole(Account.user().uid).then(function (r) { return r === "organizator"; });
    }
    // Oda sahibi (ya da admin): moderatör atar, odayı devreder. Moderatör: turları yönetir, yarışmacı çıkarır.
    function isOwner() { return !!(comp && comp.doc && (comp.doc.host === comp.uid || (Account.isAdmin && Account.isAdmin()))); }
    function modList() { return String((comp && comp.doc && comp.doc.mods) || "").split(",").filter(Boolean); }
    function isMod(uid) { return modList().indexOf(uid) >= 0; }
    function isHost() { return isOwner() || !!(comp && isMod(comp.uid)); }
    function kickPlayer(uid) {
        if (!confirm("Bu yarışmacı çıkarılsın mı? Bu yarışmaya tekrar katılamaz.")) return;
        var bl = String(comp.doc.ban || "").split(",").filter(Boolean); if (bl.indexOf(uid) < 0) bl.push(uid);
        compPatch({ ban: bl.join(",") }).then(function () { return api(cPath("/p/" + uid), { method: "DELETE" }); }).then(function (r) {
            if (r && !r.ok) alert("Çıkarılamadı (" + r.status + "). Firebase kurallarını yayımladın mı?");
            if (comp) comp.tableHtml = ""; compPoll();
        }, function () { alert("Çıkarılamadı."); });
    }
    function toggleMod(uid) {
        var l = modList(), i = l.indexOf(uid);
        if (i >= 0) l.splice(i, 1); else l.push(uid);
        compPatch({ mods: l.join(",") }).then(compPoll);
    }
    function transferTo(uid, name) {
        if (!confirm("Oda " + name + " kişisine devredilsin mi? Sen moderatör olarak kalırsın.")) return;
        var l = modList().filter(function (x) { return x !== uid; });
        if (l.indexOf(comp.doc.host) < 0) l.push(comp.doc.host);
        compPatch({ host: uid, hName: String(name || "").slice(0, 24), mods: l.join(",") }).then(compPoll);
    }
    function banned(uid) { return String((comp && comp.doc && comp.doc.ban) || "").split(",").indexOf(uid) >= 0; }
    var betaOk = false, betaP = Promise.resolve(false); // şimdilik yalnız tester / organizatör / geliştirici (ve admin)
    var SLOT_MS = window.__evSlotMs || 90000; // 1:30 içinde süre girilmezse DNF
    // Sıradaki çözümün açıldığı an (bu cihazın gördüğü): k -> zaman
    function slotStart(k) { comp.slot = comp.slot || {}; var key = comp.doc.round + ":" + k; if (!comp.slot[key]) comp.slot[key] = Date.now(); return comp.slot[key]; }
    function slotLeft() { var si = syncInfo(); if (!comp.doc || comp.doc.st !== "run" || si.min >= 5) return null; return SLOT_MS - (Date.now() - slotStart(si.min)); }
    function onlineOf(uid) { var t = comp.seen && comp.seen[uid]; return t == null ? true : Date.now() - t < FRESH_MS; }
    // Süre dolunca: yarışmacı kendine DNF yazar; oda sahibi/moderatör gelmeyenlere (arka planda kalan, düşen) DNF yazar
    function checkTimeout() {
        if (!comp || !comp.doc || comp.doc.st !== "run") return;
        var si = syncInfo(), k = si.min; if (k >= 5) return;
        var waited = Date.now() - slotStart(k);
        if (!comp.watch && myP() && eligible(comp.uid) && myTimes().length === k && comp.editIdx == null && waited > SLOT_MS) {
            $("cTypeIn") && ($("cTypeIn").value = "");
            compDone(DNF); cMsg("");
            return;
        }
        if (isHost() && waited > SLOT_MS + 6000 && !comp.dnfBusy) {
            var late = comp.players.filter(function (p) { return p.uid !== comp.uid && eligible(p.uid) && timesOf(p).length === k; });
            if (!late.length) return;
            comp.dnfBusy = true;
            Promise.all(late.map(function (p) {
                return apiAny(cPath("/p/" + p.uid), { method: "GET" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (x) {
                    if (!x) return;
                    var cur = parseDoc(x), t = cur.rnd === comp.doc.round ? listOf(cur.t) : [];
                    if (t.length !== k) return; // bu arada kendisi girmiş
                    t.push(DNF);
                    return api(cPath("/p/" + p.uid) + "?updateMask.fieldPaths=t&updateMask.fieldPaths=rnd&updateMask.fieldPaths=ts", { method: "PATCH", body: JSON.stringify({ fields: { t: val(t.join(",")), rnd: val(comp.doc.round), ts: { timestampValue: new Date().toISOString() } } }) });
                });
            })).then(function () { comp && (comp.dnfBusy = false); compPoll(); }, function () { comp && (comp.dnfBusy = false); });
        }
    }
    function scrList() { return String((comp && comp.doc && comp.doc.scr) || "").split("|").filter(Boolean); }
    function eligible(uid) { var a = String((comp.doc && comp.doc.adv) || ""); return !a || a.split(",").indexOf(uid) >= 0; }
    function timesOf(p) { return p && p.rnd === comp.doc.round ? listOf(p.t) : []; }
    function myP() { return (comp && comp.players || []).filter(function (p) { return p.uid === comp.uid; })[0]; }
    function myTimes() { return comp ? (comp.local && comp.local.rnd === comp.doc.round ? comp.local.t.slice() : timesOf(myP())) : []; }
    // Herkes aynı anda: k. çözüme, tur içindeki herkes k-1 çözümü bitirince geçilir
    function syncInfo() {
        var rows = (comp.players || []).filter(function (p) { return eligible(p.uid); });
        var counts = rows.map(function (p) { return p.uid === comp.uid && !comp.watch ? myTimes().length : timesOf(p).length; });
        return { min: counts.length ? Math.min.apply(null, counts) : 0, counts: counts, total: rows.length };
    }
    function doneCount(k) { return syncInfo().counts.filter(function (c) { return c >= k; }).length; }
    function compCanSolve() {
        if (!(comp && !comp.watch && comp.doc && comp.doc.st === "run" && myP() && eligible(comp.uid))) return false;
        var n = myTimes().length;
        return n < 5 && n <= syncInfo().min;
    }
    function evName(e) { return e === "222" ? "2x2" : "3x3"; }
    function roundLabel(d) { return d.fin ? "🏆 Final" : "Tur " + (d.round || 1); }
    function compHint() {
        var d = comp.doc || {};
        if (d.st === "lobby" || !d.st) return "Organizatör turu başlatınca karıştırmalar gelecek.";
        if (d.st === "end") return "Tur bitti. Sonuçları gör; organizatör yeni turu başlatacak.";
        if (!eligible(comp.uid)) return "Bu turda yoksun (bir sonraki tura kalmadın).";
        var n = myTimes().length;
        if (n >= 5) return "✅ 5 çözümün tamam. Diğerleri bekleniyor…";
        return "⌨️ Karıştırmayı uygula, kendi timer'ınla çöz ve süreni aşağıya yaz. (" + (n + 1) + ". çözüm)";
    }
    // Süre girişi: noktasız rakamlar da olur — son iki hane salise: 192 = 1.92, 1943 = 19.43, 10234 = 1:02.34
    function parseTime(str) {
        str = String(str || "").trim().toUpperCase().replace(",", ".");
        if (str === "DNF") return DNF;
        var ms;
        if (/^\d+$/.test(str)) {
            if (str.length > 7) return null;
            var cs = +str.slice(-2), rest = str.slice(0, -2) || "0", sec = +rest.slice(-2) || 0, min = +rest.slice(0, -2) || 0;
            if (min > 0 && sec >= 60) return null;
            ms = ((min * 60 + sec) * 100 + cs) * 10;
        } else {
            var m = str.match(/^(?:(\d+):)?(\d+(?:\.\d{1,3})?)$/);
            if (!m) return null;
            ms = Math.round(((+m[1] || 0) * 60 + parseFloat(m[2])) * 1000);
        }
        return ms >= 300 && ms < 3600000 ? ms : null;
    }

    /* --- kur / katıl / çık --- */
    function createComp() {
        if (!signedIn()) { Account.openLogin && Account.openLogin(); return; }
        isOrgUser().then(function (ok) {
            if (!ok) { cMsg("Yalnızca <b>organizatör</b> rolündeki kişiler yarışma kurabilir.", 1); return; }
            var c = code5(), u = Account.user(), cap = Math.max(8, Math.min(16, +($("cCapR") && $("cCapR").value) || 8));
            var evc = (document.querySelector('input[name="cEv"]:checked') || {}).value === "222" ? "222" : "333";
            var name = ($("cName").value || "").trim().slice(0, 40) || (myName() + " ev yarışması");
            var f = { host: u.uid, hName: myName(), name: name, cap: cap, ev: evc, round: 0, fin: 0, st: "lobby", scr: "", adv: "", R: "[]", mods: "" };
            cMsg("Oluşturuluyor…");
            api("/comps?documentId=" + c, { method: "POST", body: JSON.stringify({ fields: cBody(f) }) }).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                joinComp(c);
            }).catch(function (e) { cMsg("Oluşturulamadı (" + esc(e.message) + "). Kurallar yayımlandı mı?", 1); });
        });
    }
    function joinComp(code, watch, watch_retry) {
        code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (code.length !== 5) { cMsg("Yarışma kodu 5 karakter olmalı.", 1); return; }
        if (!signedIn()) { if (!watch) Account.openLogin && Account.openLogin(); else cMsg("Yarışmaları izlemek için giriş yap.", 1); if (watch) return; return; }
        if (!betaOk && !watch_retry) { betaP.then(function () { joinComp(code, watch, true); }); return; }
        if (!betaOk) { cMsg("🔒 Ev yarışması şu an yalnızca tester, organizatör ve geliştiricilere açık.", 1); return; }
        cMsg(watch ? "Yarışma açılıyor…" : "Bağlanılıyor…");
        var uid = signedIn() ? Account.user().uid : viewerId();
        comp = { code: code, uid: uid, doc: null, players: [], mode: "manual", orig: {}, shownR: -1, local: null, watch: !!watch };
        Promise.all([apiAny(cPath(), { method: "GET" }), apiAny(cPath("/p?pageSize=50"), { method: "GET" })]).then(function (rs) {
            if (!rs[0].ok) throw new Error(rs[0].status === 404 ? "Yarışma bulunamadı" : rs[0].status);
            return Promise.all([rs[0].json(), rs[1].ok ? rs[1].json() : {}]);
        }).then(function (res) {
            comp.doc = parseDoc(res[0]);
            comp.players = parsePlayers(res[1]);
            var mine = myP();
            if (mine && !watch) comp.watch = false; // "İzle" denirse kayıtlı olsa da izleyici olarak açılır
            if (comp.watch) return null;
            if (banned(uid)) throw new Error("Bu yarışmadan çıkarıldın.");
            if (!mine && comp.players.length >= comp.doc.cap) throw new Error("Yarışma dolu (" + comp.doc.cap + " kişi)");
            if (!mine && comp.doc.st === "run") throw new Error("Tur sürüyor; tur bitince katılabilirsin. Şimdilik 👁 İzle ile takip edebilirsin.");
            comp.mode = "manual"; // yarışmada süre yalnızca elle yazılır
            return mine ? null : mePatch({ name: myName(), mode: comp.mode, t: "", rnd: 0 }).then(function (r) { if (!r.ok) throw new Error(r.status); });
        }).then(function () {
            try { history.replaceState(null, "", (comp.watch ? "?izle=" : "?ev=") + code); } catch (e) {}
            $("cLobby").hidden = true; $("cRoom").hidden = false; cMsg("");
            document.body.classList.add("c-in-room");
            try { $("akComp").scrollIntoView({ block: "start" }); } catch (e) {}
            comp.chat = []; comp.chatKey = null; chatUi(); compPoll(); heartbeat();
            startPoll(); liveStart();
            clearInterval(hbT); hbT = setInterval(function () { if (document.visibilityState === "visible") heartbeat(); }, HB_MS);
            clearInterval(comp.cdT); comp.cdT = setInterval(function () { if (comp && comp.doc && comp.doc.st === "run") { renderNow(); checkTimeout(); } }, 1000);
        }).catch(function (e) { comp = null; cMsg(esc(e.message), 1); });
    }
    function leaveComp() {
        clearInterval(compPollT); clearInterval(hbT); if (comp) { clearInterval(comp.cdT); if (comp.liveStop) comp.liveStop(); }
        if (comp && !comp.watch && myP()) api(cPath("/p/" + comp.uid), { method: "DELETE" }).catch(function () {});
        comp = null; closeFinal(); document.body.classList.remove("c-in-room");
        try { history.replaceState(null, "", location.pathname); } catch (e) {}
        $("cLobby").hidden = false; $("cRoom").hidden = true; $("cType").hidden = true; $("akPad").hidden = true;
        setScramble(""); loadLive();
    }
    function parsePlayers(d) {
        return ((d && d.documents) || []).map(function (x) { var o = parseDoc(x); o.uid = x.name.split("/").pop(); return o; });
    }
    // Canlı dinleme varsa yalnız ondan gelen veri kullanılır; yoksa REST ile yavaş yoklama (yedek)
    function compPoll() {
        if (!comp) return;
        if (comp.live) { applyComp(comp.doc, comp.players); return; }
        Promise.all([apiAny(cPath(), { method: "GET" }), apiAny(cPath("/p?pageSize=50"), { method: "GET" })]).then(function (rs) {
            if (!rs[0].ok) throw new Error(rs[0].status);
            return Promise.all([rs[0].json(), rs[1].ok ? rs[1].json() : {}]);
        }).then(function (res) {
            if (!comp || comp.live) return;
            applyComp(parseDoc(res[0]), parsePlayers(res[1]));
        }).catch(function () {});
    }
    function applyComp(d, players) {
            if (!comp || !d) return;
            var prev = comp.prevDoc || {};
            comp.prevDoc = d; comp.doc = d; comp.players = players || [];
            if (!comp.watch && (!myP() || banned(comp.uid)) && prev.host) { comp.watch = true; leaveComp(); cMsg("Yarışmadan çıkarıldın.", 1); return; }
            // sunucuda daha fazla süre varsa (ör. süre dolunca yazılan DNF) yerel kopyayı bırak
            var mp = myP(); if (comp.local && mp && timesOf(mp).length >= comp.local.t.length) comp.local = null;
            // izleyici sayısı (ucuz sayım sorgusu) ve oda yöneticisi için bağlantı durumu: 30 sn'de bir
            if (!comp.wT || Date.now() - comp.wT > 30000) {
                comp.wT = Date.now();
                countFresh(comp.code).then(function (n) {
                    if (!comp) return; n = Math.max(0, n - comp.players.length);
                    comp.watchers = n; var w = $("cWatch"); if (w) w.textContent = "👁 " + n + " kişi izliyor";
                });
                if (isHost()) apiAny(cPath("/w?pageSize=60"), { method: "GET" }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (wd) {
                    if (!comp) return; comp.seen = {};
                    (wd.documents || []).forEach(function (x) { comp.seen[x.name.split("/").pop()] = Date.parse(((x.fields || {}).ts || {}).timestampValue || "") || 0; });
                    comp.players.forEach(function (p) { if (comp.seen[p.uid] == null) comp.seen[p.uid] = 0; });
                    comp.tableHtml = ""; renderComp();
                }, function () {});
            }
            if (!comp.live) { comp.pn = (comp.pn || 0) + 1; if (comp.pn % 2 === 1) chatLoad(); else renderChat(); }
            comp.mode = "manual";
            // tur ya da durum değişti: sıradaki karıştırmayı göster
            if (prev.round !== d.round || prev.st !== d.st) { comp.local = null; comp.orig = {}; comp.editIdx = null; nextScramble(true); }
            if (isHost() && d.st === "run") autoEnd();
            checkTimeout();
            if (d.st === "end" && comp.shownR !== d.round + ":" + d.fin) { comp.shownR = d.round + ":" + d.fin; showRoundResults(lastRound()); }
            renderComp();
    }
    /* --- canlı dinleme (Firestore SDK): yalnız değişen belgeler okunur --- */
    function snapObj(s) {
        var o = {}, x = s.data() || {};
        Object.keys(x).forEach(function (k) { var v = x[k]; o[k] = v && typeof v.toDate === "function" ? v.toDate().toISOString() : v; });
        return o;
    }
    function liveStart() {
        if (!comp || !(window.Account && Account.firestore)) return;
        var code = comp.code;
        Account.firestore().then(function (F) {
            if (!comp || comp.code !== code) return;
            var fs = F.fs, db = F.db, got = { d: null, p: null }, subs = [];
            var stop = function () { subs.forEach(function (u) { try { u(); } catch (e) {} }); };
            var fail = function () { stop(); if (comp && comp.code === code) { comp.live = null; startPoll(); } };
            var push = function () { if (comp && comp.code === code && got.d && got.p) { comp.live = stop; applyComp(got.d, got.p); } };
            subs.push(fs.onSnapshot(fs.doc(db, "comps", code), function (snap) {
                if (!snap.exists()) { if (comp && comp.code === code) { stop(); comp.live = null; leaveComp(); cMsg("Yarışma silindi.", 1); } return; }
                got.d = snapObj(snap); push();
            }, fail));
            subs.push(fs.onSnapshot(fs.collection(db, "comps", code, "p"), function (qs) {
                got.p = qs.docs.map(function (x) { var o = snapObj(x); o.uid = x.id; return o; }); push();
            }, fail));
            subs.push(fs.onSnapshot(fs.query(fs.collection(db, "comps", code, "m"), fs.orderBy("ts", "desc"), fs.limit(40)), function (qs) {
                if (!comp || comp.code !== code) return;
                comp.chat = qs.docs.map(function (x) { var o = snapObj(x); o.id = x.id; return o; }).reverse(); renderChat();
            }, function () {}));
            comp.liveStop = stop;
        }, function () {});
    }
    function startPoll() {
        clearInterval(compPollT);
        compPollT = setInterval(function () { if (document.visibilityState === "visible") compPoll(); }, comp && comp.watch ? 6000 : 4000);
    }
    // Son 75 sn'de kalp atışı yazan (açık) cihaz sayısı — tek okuma sayılan sayım sorgusu
    function countFresh(code) {
        var body = { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: "w" }], where: { fieldFilter: { field: { fieldPath: "ts" }, op: "GREATER_THAN", value: { timestampValue: new Date(Date.now() - FRESH_MS).toISOString() } } } }, aggregations: [{ alias: "n", count: {} }] } };
        return apiAny("/comps/" + code + ":runAggregationQuery", { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : []; }).then(function (a) {
            var x = a && a[0] && a[0].result && a[0].result.aggregateFields && a[0].result.aggregateFields.n; return x ? +x.integerValue : 0;
        }, function () { return 0; });
    }
    function countDocs(path) {
        var parts = path.split("/"), coll = parts.pop(), parent = parts.join("/");
        var body = { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: coll }] }, aggregations: [{ alias: "n", count: {} }] } };
        return apiAny(parent + ":runAggregationQuery", { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : []; }).then(function (a) {
            var x = a && a[0] && a[0].result && a[0].result.aggregateFields && a[0].result.aggregateFields.n; return x ? +x.integerValue : 0;
        }, function () { return 0; });
    }
    function nextScramble(force) {
        if (!comp) return;
        var n = myTimes().length, list = scrList();
        if (comp.doc.st === "run" && eligible(comp.uid) && n < 5 && list[n]) { if (force || scr !== list[n]) setScramble(list[n]); }
        else if (force) setScramble("");
        renderModeUi();
    }
    /* --- süre kaydı --- */
    function compDone(ms) {
        if (tab !== "comp" || !comp || !compCanSolve()) return;
        var t = myTimes(); t.push(ms); comp.orig[t.length - 1] = ms;
        comp.local = { rnd: comp.doc.round, t: t };
        mePatch({ name: myName(), mode: comp.mode, t: t.join(","), rnd: comp.doc.round }).then(compPoll);
        renderComp();
    }
    function compSetDnf(i, on) {
        var t = myTimes(); if (i < 0 || i >= t.length) return;
        if (on) { if (t[i] < DNF) comp.orig[i] = t[i]; t[i] = DNF; }
        else if (comp.orig[i]) t[i] = comp.orig[i]; else return;
        comp.local = { rnd: comp.doc.round, t: t };
        mePatch({ t: t.join(","), rnd: comp.doc.round }).then(compPoll);
        renderComp();
    }
    function setMode(m) {
        if (!comp || phase === "solving") return;
        comp.mode = m; comp.modeLocked = true;
        mePatch({ name: myName(), mode: m, t: myTimes().join(","), rnd: (comp.doc && comp.doc.round) || 0 }).then(function () { comp && (comp.modeLocked = false); });
        nextScramble(true); renderComp();
    }
    function renderModeUi() {
        if (!comp) return;
        var can = compCanSolve();
        $("akPad").hidden = !(tab === "comp" && comp.mode === "timer" && can);
        $("cType").hidden = !(tab === "comp" && (can || comp.editIdx != null));
        var ok = $("cTypeOk"); if (ok) ok.textContent = comp.editIdx != null ? "Düzenlemeyi kaydet" : "Kaydet";
        renderHint();
    }
    /* --- klavye / dokunma süresi (yalnız yarışmada "timer" modu) --- */
    var holdT = 0;
    function manualOn() { return false; } // yarışmada timer kapalı: süre yalnızca elle yazılır
    function manualDown() {
        if (!manualOn()) return;
        if (phase === "solving") { manualStop(); return; }
        if (phase === "idle" || phase === "done") { phase = "holding"; holdT = now(); $("akTime").textContent = fmt(0); miniShow("hold"); renderHint(); }
    }
    function manualUp() {
        if (phase !== "holding") return;
        if (now() - holdT < 300) { phase = "idle"; miniHide(); renderHint(); return; }
        phase = "solving"; t0 = now(); moves = []; st = null; startTick(); miniShow("run"); renderHint();
    }
    function manualStop() {
        var t = Math.round(now() - t0); stopTick(); phase = "done";
        setLast(t, false); miniShow("done"); renderHint(); compDone(t);
    }
    document.addEventListener("keydown", function (e) {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (!manualOn()) return;
        if (e.code === "Space") { e.preventDefault(); if (!e.repeat) manualDown(); }
        else if (phase === "solving") { e.preventDefault(); manualStop(); }
    });
    document.addEventListener("keyup", function (e) { if (e.code === "Space" && phase === "holding") { e.preventDefault(); manualUp(); } });
    function typeSave(pen) {
        var ms = pen === "dnf" ? DNF : parseTime($("cTypeIn").value);
        if (ms == null) { $("cTypeErr").className = "ak-msg bad"; $("cTypeErr").textContent = "Süreyi rakamla yaz: 1943 = 19.43 · 10234 = 1:02.34"; $("cTypeIn").focus(); return; }
        if (pen === "+2" && ms < DNF) ms += 2000;
        $("cTypeErr").textContent = ""; $("cTypeIn").value = "";
        if (comp && comp.editIdx != null) { compEdit(comp.editIdx, ms); return; }
        compDone(ms);
    }
    function compEdit(i, ms) {
        var t = myTimes(); if (i < 0 || i >= t.length) return;
        t[i] = ms; comp.orig[i] = ms; comp.editIdx = null;
        comp.local = { rnd: comp.doc.round, t: t };
        mePatch({ t: t.join(","), rnd: comp.doc.round }).then(compPoll);
        renderComp();
    }
    function startEdit() {
        var n = myTimes().length; if (!n || comp.doc.st !== "run") return;
        comp.editIdx = n - 1; $("cTypeIn").value = ""; renderComp(); setTimeout(function () { $("cTypeIn").focus(); }, 30);
    }
    function typePreview() {
        var v = $("cTypeIn").value.trim(), e = $("cTypeErr");
        if (!v) { e.textContent = ""; return; }
        var ms = parseTime(v);
        e.className = "ak-msg" + (ms == null ? " bad" : " ok");
        e.textContent = ms == null ? "Geçersiz süre" : "= " + fmt(ms);
    }
    /* --- sonuçlar --- */
    function rankRows() {
        var d = comp.doc;
        return comp.players.filter(function (p) { return eligible(p.uid); }).map(function (p) {
            var t = p.uid === comp.uid ? myTimes() : timesOf(p);
            var best = t.length ? Math.min.apply(null, t) : null;
            return { uid: p.uid, n: p.name, m: p.mode, t: t, a: t.length >= 5 ? avgOf(t, 5) : null, b: best };
        }).sort(function (x, y) {
            var ax = x.a == null ? Infinity : x.a, ay = y.a == null ? Infinity : y.a;
            if (ax !== ay) return ax - ay;
            if (y.t.length !== x.t.length) return y.t.length - x.t.length;
            return (x.b == null ? Infinity : x.b) - (y.b == null ? Infinity : y.b);
        });
    }
    function autoEnd() {
        var rows = rankRows();
        if (rows.length && rows.every(function (r) { return r.t.length >= 5; })) endRound();
    }
    function hist() { try { return JSON.parse((comp.doc && comp.doc.R) || "[]") || []; } catch (e) { return []; } }
    function lastRound() { var h = hist(); return h[h.length - 1] || null; }
    function endRound() {
        if (!isHost() || comp.ending) return;
        comp.ending = true;
        var d = comp.doc, h = hist().filter(function (x) { return x.n !== d.round; });
        h.push({ n: d.round, f: d.fin ? 1 : 0, rows: rankRows().map(function (r) { return { u: r.uid, n: r.n, t: r.t, a: r.a }; }) });
        compPatch({ st: "end", R: JSON.stringify(h) }).then(function () { comp && (comp.ending = false); compPoll(); });
    }
    function startRound(fin, topN) {
        if (!isHost()) return;
        var d = comp.doc, adv = "";
        var lr = lastRound();
        if (topN && lr) adv = lr.rows.filter(function (r) { return r.a != null && r.a < DNF; }).slice(0, topN).map(function (r) { return r.u; }).join(",");
        var s = []; for (var i = 0; i < 5; i++) s.push(d.ev === "222" ? genScramble222() : genScramble());
        closeFinal();
        compPatch({ round: (d.round || 0) + 1, st: "run", scr: s.join("|"), fin: fin ? 1 : 0, adv: adv }).then(compPoll);
    }
    // Final turu yapmadan bitir: son tur final sayılır, birincisi şampiyon olur
    function finishComp() {
        if (!isHost() || !comp.doc || comp.doc.st !== "end" || comp.doc.fin) return;
        if (!confirm("Yarışma burada bitirilsin mi? Son turun birincisi şampiyon olur.")) return;
        var h = hist(); if (h.length) h[h.length - 1].f = 1;
        closeFinal();
        compPatch({ fin: 1, R: JSON.stringify(h) }).then(compPoll);
    }
    /* --- mini sohbet: comps/{kod}/m/{id} = {u, n, x, ts} --- */
    function chatLoad() {
        if (!comp || comp.live) return;
        apiAny(cPath("/m?pageSize=40&orderBy=ts%20desc"), { method: "GET" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            if (!comp || !d) return;
            comp.chat = (d.documents || []).map(function (x) { var o = parseDoc(x); o.id = x.name.split("/").pop(); return o; }).reverse();
            renderChat();
        }).catch(function () {});
    }
    function renderChat() {
        var box = $("cChatList"); if (!box || !comp) return;
        var list = comp.chat || [], host = isHost(), key = list.map(function (m) { return m.id; }).join(",") + "|" + host;
        if (comp.chatKey === key) return;
        comp.chatKey = key;
        var atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
        box.innerHTML = list.length ? list.map(function (m) {
            var me = m.u === comp.uid, badge = comp.doc && m.u === comp.doc.host ? "👑 " : isMod(m.u) ? "🛡️ " : "";
            return '<div class="c-cm' + (me ? " me" : "") + '"><b>' + badge + esc(m.n) + '</b> ' + esc(m.x) +
                (host || me ? '<button type="button" class="c-cdel" data-mid="' + esc(m.id) + '" title="Sil">✕</button>' : '') + '</div>';
        }).join("") : '<p class="c-chat-empty">Henüz mesaj yok. İlk mesajı sen yaz 👋</p>';
        if (atEnd || !comp.chatSeen) box.scrollTop = box.scrollHeight;
        comp.chatSeen = true;
        Array.prototype.forEach.call(box.querySelectorAll("[data-mid]"), function (b) {
            b.onclick = function () { api(cPath("/m/" + b.getAttribute("data-mid")), { method: "DELETE" }).then(function () { comp && (comp.chatKey = ""); chatLoad(); }); };
        });
    }
    function chatSend() {
        var inp = $("cChatIn"), x = inp.value.trim().slice(0, 200), err = $("cChatErr");
        if (!x || !comp || !signedIn()) return;
        var now = Date.now();
        if (comp.chatT && now - comp.chatT < 1500) { err.textContent = "Biraz yavaş 🙂"; return; }
        comp.chatT = now; inp.value = ""; err.textContent = "";
        var id = now.toString(36) + Math.random().toString(36).slice(2, 7);
        var body = { fields: { u: val(Account.user().uid), n: val(myName()), x: val(x), ts: { timestampValue: new Date().toISOString() } } };
        api(cPath("/m") + "?documentId=" + id, { method: "POST", body: JSON.stringify(body) }).then(function (r) {
            if (!r.ok) { inp.value = x; err.textContent = "Mesaj gönderilemedi."; }
            chatLoad();
        }, function () { inp.value = x; err.textContent = "Mesaj gönderilemedi."; });
    }
    function chatUi() { if (!$("cChatForm")) return; var ok = signedIn(); $("cChatForm").hidden = !ok; $("cChatLogin").hidden = ok; }
    function modeIcon(m) { return m === "bt" ? "🧊" : m === "manual" ? "⌨️" : "⏱️"; }
    function shareTextR(r) {
        var d = comp.doc;
        return "🏠 " + d.name + " · " + (r.f ? "Final" : "Tur " + r.n) + " (" + evName(d.ev) + " Ao5)\n" + r.rows.map(function (x, i) {
            return (i + 1) + ". " + x.n + " — " + (x.a == null ? "-" : fmt(x.a)) + "  (" + x.t.map(fmt).join(", ") + ")";
        }).join("\n") + "\nrubikacademy.fun/icerikler/ev-yarismasi";
    }
    function shareImageR(r) {
        var d = comp.doc, W = 1080, rowH = 74, H = 330 + r.rows.length * rowH + 90;
        var c = document.createElement("canvas"); c.width = W; c.height = H;
        var x = c.getContext("2d"), acc = (getComputedStyle(document.body).getPropertyValue("--ui-accent") || "#6c5ce7").trim();
        var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0b0d14"); g.addColorStop(1, "#1d1838"); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.textAlign = "center"; x.fillStyle = "#a4aabe"; x.font = "700 32px Inter, sans-serif"; x.fillText("RUBIK ACADEMY · EV YARIŞMASI", W / 2, 90);
        x.fillStyle = "#eef0f7"; x.font = "900 56px Inter, sans-serif"; x.fillText(clip(d.name, 28), W / 2, 170);
        x.fillStyle = acc; x.font = "800 38px Inter, sans-serif"; x.fillText((r.f ? "🏆 Final" : "Tur " + r.n) + " · " + evName(d.ev) + " Ao5", W / 2, 230);
        r.rows.forEach(function (row, i) {
            var y = 290 + i * rowH;
            x.fillStyle = i === 0 ? acc : i % 2 ? "#141826" : "#1a1e2c"; roundRect(x, 60, y, W - 120, rowH - 10, 18); x.fill();
            x.textAlign = "left"; x.fillStyle = i === 0 ? "#fff" : "#eef0f7";
            x.font = "900 34px Inter, sans-serif"; x.fillText((i + 1) + ".", 90, y + 46);
            x.font = "800 32px Inter, sans-serif"; x.fillText(clip(row.n, 18), 160, y + 46);
            x.textAlign = "right"; x.font = "900 36px 'JetBrains Mono', monospace"; x.fillText(row.a == null ? "-" : fmt(row.a), W - 90, y + 47);
            x.font = "600 20px 'JetBrains Mono', monospace"; x.fillStyle = i === 0 ? "rgba(255,255,255,.85)" : "#a4aabe";
            x.fillText(row.t.map(fmt).join("  "), W - 290, y + 44);
        });
        x.textAlign = "center"; x.fillStyle = "#a4aabe"; x.font = "700 28px Inter, sans-serif"; x.fillText("rubikacademy.fun", W / 2, H - 40);
        return new Promise(function (res) { c.toBlob(res, "image/png"); });
    }
    function showRoundResults(r) {
        if (!r) return;
        var d = comp.doc, host = isHost(), latest = d.st === "end" && r.n === d.round;
        var champ = r.f && r.rows[0] ? '<p class="ak-fin-k">🏆 Şampiyon: <b>' + esc(r.rows[0].n) + '</b></p>' : "";
        $("akFinal").classList.add("show");
        $("akFinalBox").innerHTML = '<button type="button" class="ak-x" id="akFinClose" aria-label="Kapat">✕</button>' +
            '<h3>🏁 ' + (r.f ? "Final" : "Tur " + r.n) + ' sonuçları</h3>' + champ +
            '<div class="c-res"><table><thead><tr><th>#</th><th>Yarışmacı</th><th>Ao5</th><th>Süreler</th></tr></thead><tbody>' +
            r.rows.map(function (x, i) { return '<tr' + (i === 0 ? ' class="win"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(x.n) + '</td><td class="mono"><b>' + (x.a == null ? "-" : fmt(x.a)) + '</b></td><td class="mono small">' + x.t.map(fmt).join(", ") + '</td></tr>'; }).join("") +
            '</tbody></table></div>' +
            '<div class="ak-fin-b"><button type="button" class="btn primary" id="cShareImg">🖼️ Görsel paylaş</button><button type="button" class="btn" id="cShareTxt">📝 Metin paylaş</button></div>' +
            (host && latest && !r.f ? '<div class="c-next"><label>Sonraki tura geçenler <select id="cAdv"><option value="0">Herkes</option><option value="8">İlk 8</option><option value="4">İlk 4</option><option value="2">İlk 2</option></select></label>' +
                '<div class="ak-fin-b"><button type="button" class="btn" id="cNextR">▶ Yeni tur başlat</button><button type="button" class="btn primary" id="cFinalR">🏆 Final turu başlat</button></div>' +
                '<div class="ak-fin-b" style="margin-top:6px"><button type="button" class="btn" id="cFinishR">🏁 Final olmadan yarışmayı bitir</button></div></div>' : "") +
            (latest && r.f ? '<p class="ak-fin-s">Yarışma bitti 🎉</p>' : "") +
            '<div class="ak-fin-b" style="margin-top:8px"><button type="button" class="btn" id="akFinClose2">Kapat</button></div><div class="ak-msg" id="akShareMsg"></div>';
        $("akFinClose").onclick = $("akFinClose2").onclick = closeFinal;
        $("cShareTxt").onclick = function () {
            var t = shareTextR(r);
            if (navigator.share) navigator.share({ text: t }).catch(function () {});
            else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $("akShareMsg").textContent = "Metin kopyalandı ✓"; });
            else prompt("Sonuçlar:", t);
        };
        $("cShareImg").onclick = function () {
            shareImageR(r).then(function (blob) {
                var file = new File([blob], "ev-yarismasi-" + (r.f ? "final" : "tur" + r.n) + ".png", { type: "image/png" });
                if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], text: shareTextR(r) }).catch(function () {});
                else { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); $("akShareMsg").textContent = "Görsel indirildi ✓"; }
            });
        };
        if ($("cNextR")) $("cNextR").onclick = function () { startRound(false, +$("cAdv").value); };
        if ($("cFinalR")) $("cFinalR").onclick = function () { startRound(true, +$("cAdv").value); };
        if ($("cFinishR")) $("cFinishR").onclick = finishComp;
    }
    // Karıştırılmış küpün açılımı (beyaz üst, yeşil ön). 2x2: aynı R U F hamleleri 3x3 modelinde, yalnız köşeler.
    var NET_COL = { U: "#f4f4f4", R: "#e3262c", F: "#16a34a", D: "#f6c719", L: "#ff7a1a", B: "#2c6fe6" };
    var NET_POS = [["U", 1, 0], ["L", 0, 1], ["F", 1, 1], ["R", 2, 1], ["B", 3, 1], ["D", 1, 2]];
    function netHtml(sc, is2) {
        if (!sc || typeof Cube === "undefined") return "";
        var c = new Cube(); try { c.move(sc); } catch (e) { return ""; }
        var st = c.asString(), idx = is2 ? [0, 2, 6, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
        return '<div class="c-netg' + (is2 ? " two" : "") + '">' + NET_POS.map(function (n) {
            var fi = "URFDLB".indexOf(n[0]);
            return '<div class="c-netf" style="grid-column:' + (n[1] + 1) + ';grid-row:' + (n[2] + 1) + '">' + idx.map(function (i) { return '<i style="background:' + NET_COL[st[fi * 9 + i]] + '"></i>'; }).join("") + '</div>';
        }).join("") + '</div>';
    }
    function renderNow() {
        var box = $("cNow"); if (!box) return;
        var d = comp.doc, list = scrList(), si = syncInfo(), n = myTimes().length, h = "", show = -1, head = "";
        var bar = function (k) { var c = doneCount(k); return '<div class="c-prog"><i style="width:' + (si.total ? Math.round(c / si.total * 100) : 0) + '%"></i></div><small class="c-prog-t">' + c + ' / ' + si.total + ' kişi ' + k + '. çözümü bitirdi</small>'; };
        var player = !comp.watch && myP() && eligible(comp.uid);
        if (d.st === "lobby" || !d.st) { head = "⏳ Hazırlık"; h = '<p class="c-now-p">Organizatör turu başlatınca karıştırma yukarıda görünecek.</p>'; }
        else if (d.st === "end") { head = "🏁 " + roundLabel(d) + " bitti"; h = '<p class="c-now-p">' + (d.fin ? "Yarışma bitti, sonuçlara bak! 🏆" : "Organizatör yeni turu başlatacak.") + '</p>'; }
        else if (!player) { show = Math.min(si.min, 4); head = roundLabel(d) + " · " + (si.min + 1 > 5 ? "bitti" : (si.min + 1) + ". çözüm"); h = comp.watch ? '<p class="c-now-p">👁 Canlı izliyorsun.</p>' + (si.min < 5 ? bar(si.min + 1) : "") : '<p class="c-now-p">Bu turda yoksun; tabloyu izleyebilirsin.</p>'; }
        else if (comp.editIdx != null) { show = Math.min(n, 4); head = roundLabel(d) + " · " + (n + 1 > 5 ? 5 : n + 1) + ". çözüm"; h = '<div class="c-now-h">✏️ ' + (comp.editIdx + 1) + '. çözümü düzenle</div><p class="c-now-p">Şu an: <b>' + fmt(myTimes()[comp.editIdx]) + '</b> · <button type="button" class="c-linkbtn" id="cEditCancel">Vazgeç</button></p>'; }
        else if (n >= 5) { head = roundLabel(d) + " · 5 çözüm tamam"; h = '<div class="c-now-h">✅ 5 çözümün tamam</div><p class="c-now-p">Tur, herkes bitirince kendiliğinden biter.</p>' + bar(5); }
        else if (n > si.min) { head = roundLabel(d) + " · " + (n + 1) + ". çözüm birazdan"; h = '<div class="c-now-h">✅ ' + n + '. çözüm kaydedildi</div><p class="c-now-p">Herkes bitirince ' + (n + 1) + '. karıştırma gelecek.</p>' + bar(n); }
        else { show = n; head = roundLabel(d) + " · Çözüm " + (n + 1) + " / 5"; h = '<div class="c-now-h">Çözüm <b>' + (n + 1) + '</b> / 5</div><p class="c-now-tip">Kendi timer\'ınla çöz, süreni yaz: <b>1943</b> = 19.43</p>'; }
        var left = slotLeft();
        if (left != null && d.st === "run") { var sec = Math.max(0, Math.ceil(left / 1000)); h += '<p class="c-cd' + (sec <= 20 ? " warn" : "") + '">⏱ ' + Math.floor(sec / 60) + ':' + ("0" + sec % 60).slice(-2) + (sec ? ' içinde girilmeyen süre <b>DNF</b> olur' : ' · süre doldu, DNF yazılıyor') + '</p>'; }
        box.innerHTML = h;
        var c = $("cEditCancel"); if (c) c.onclick = function () { comp.editIdx = null; renderComp(); };
        // üst: büyük karıştırma + görsel
        var sc = show >= 0 ? list[show] : "";
        $("cScrHead").textContent = head;
        $("cScrBig").innerHTML = sc ? sc.split(" ").map(function (m) { return "<span>" + esc(m) + "</span>"; }).join(" ") : '<span class="c-scr-wait">' + (d.st === "run" ? "⏳ Sıradaki karıştırma, herkes bitirince gelecek" : "—") + '</span>';
        $("cNet").innerHTML = sc ? netHtml(sc, d.ev === "222") : "";
    }
    function renderComp() {
        if (!comp || !comp.doc) return;
        var d = comp.doc, host = isHost(), owner = isOwner();
        $("cTitle").textContent = d.name || "Ev yarışması";
        $("cCode").textContent = comp.code;
        $("cRound").textContent = evName(d.ev) + " · " + (d.st === "lobby" ? "Lobi · " + comp.players.length + "/" + d.cap + " kişi" : roundLabel(d) + " · " + (d.st === "end" ? "bitti" : "sürüyor") + " · " + comp.players.length + "/" + d.cap);
        Array.prototype.forEach.call(document.querySelectorAll(".c-mode button"), function (b) { b.classList.toggle("on", b.getAttribute("data-m") === comp.mode); b.disabled = phase === "solving"; });
        $("cWatchBadge").hidden = !comp.watch;
        if (comp.watch) {
            var sl = scrList();
            $("cScrs").hidden = true;
            $("cScrs").innerHTML = '<b>' + roundLabel(d) + ' karıştırmaları</b>' + sl.map(function (x, i) { return '<div><span>' + (i + 1) + '.</span><code dir="ltr">' + esc(x) + '</code></div>'; }).join("");
        } else $("cScrs").hidden = true;
        // kendi süreleri
        var t = comp.watch ? [] : myTimes();
        $("cMine").innerHTML = !comp.watch && d.st === "run" && myP() && eligible(comp.uid) ? '<div class="c-mine-h"><span class="c-lbl">Sürelerin</span>' + (t.length && comp.editIdx == null ? '<button type="button" class="c-linkbtn" id="cEditLast">✏️ Son süreyi düzenle</button>' : '') + '</div><div class="c-chips">' + [0, 1, 2, 3, 4].map(function (i) {
            if (i >= t.length) return '<span class="c-chip empty">' + (i + 1) + '</span>';
            return '<button type="button" class="c-chip' + (t[i] >= DNF ? " dnf" : "") + (i === comp.editIdx ? " edit" : "") + '" data-ci="' + i + '" title="DNF yap / kaldır">' + fmt(t[i]) + '</button>';
        }).join("") + '</div>' + (t.length >= 5 ? '<div class="c-ao">Ao5 <b>' + fmt(avgOf(t, 5)) + '</b></div>' : "") : "";
        if ($("cEditLast")) $("cEditLast").onclick = startEdit;
        Array.prototype.forEach.call($("cMine").querySelectorAll("[data-ci]"), function (b) {
            b.onclick = function () { var i = +b.getAttribute("data-ci"), on = myTimes()[i] < DNF; if (on && !confirm((i + 1) + ". çözüm DNF yapılsın mı?")) return; compSetDnf(i, on); };
        });
        // tablo: her yarışmacı bir sütun; satırlar Sıra, Ao5, 1-5. çözüm
        var rows = rankRows(), out = comp.players.filter(function (p) { return !eligible(p.uid); });
        var si2 = syncInfo(), cur = d.st === "run" ? si2.min : -1;
        var bestOf = [0, 1, 2, 3, 4].map(function (i) { var v = rows.map(function (r) { return r.t[i]; }).filter(function (x) { return x != null && x < DNF; }); return v.length > 1 ? Math.min.apply(null, v) : null; });
        var bestAo = (function () { var v = rows.map(function (r) { return r.a; }).filter(function (x) { return x != null && x < DNF; }); return v.length > 1 ? Math.min.apply(null, v) : null; })();
        var headCells = rows.map(function (r) {
            var badge = r.uid === d.host ? ' <span title="Oda sahibi">👑</span>' : isMod(r.uid) ? ' <span title="Moderatör">🛡️</span>' : '';
            var acts = host ? '<div class="c-acts">' + (owner && r.uid !== d.host ? '<button type="button" class="c-mini" data-mod="' + esc(r.uid) + '" title="' + (isMod(r.uid) ? "Moderatörlüğü al" : "Moderatör yap") + '">' + (isMod(r.uid) ? "🛡️−" : "🛡️+") + '</button><button type="button" class="c-mini" data-tr="' + esc(r.uid) + '" data-n="' + esc(r.n) + '" title="Odayı devret">👑→</button>' : '') +
                (r.uid !== comp.uid && r.uid !== d.host ? '<button type="button" class="c-mini kick" data-k="' + esc(r.uid) + '" title="Çıkar">✕</button>' : '') + '</div>' : '';
            var off = r.uid !== comp.uid && !onlineOf(r.uid) ? ' <span class="c-off" title="Bağlantısı yok / uygulama arka planda">📴</span>' : '';
            return '<th class="' + (r.uid === comp.uid ? "me" : "") + '"><div class="c-pn">' + esc(r.n) + badge + off + '</div>' + acts + '</th>';
        }).join("");
        var line = function (label, cls, fn) { return '<tr class="' + cls + '"><td class="c-rl">' + label + '</td>' + rows.map(function (r) { return '<td class="' + (r.uid === comp.uid ? "me" : "") + '">' + fn(r) + '</td>'; }).join("") + '</tr>'; };
        var tHtml = rows.length ? '<table class="c-grid-t"><thead><tr><th class="c-rl">#</th>' + headCells + '</tr></thead><tbody>' +
            line("SIRA", "c-rank", function (r) { return r.a == null ? "-" : (rows.indexOf(r) + 1) + "."; }) +
            line("AO5", "c-avg", function (r) { return '<b class="' + (bestAo != null && r.a === bestAo ? "best" : "") + '">' + (r.a == null ? "-" : fmt(r.a)) + "</b>"; }) +
            [0, 1, 2, 3, 4].filter(function (i) { return i <= cur || rows.some(function (r) { return r.t[i] != null; }); }).map(function (i) {
                return line(String(i + 1), i === cur ? "cur" : "", function (r) {
                    var x = r.t[i]; if (x == null) return i === cur ? '<span class="c-wait">…</span>' : "-";
                    return '<span class="' + (x >= DNF ? "dnf" : bestOf[i] === x ? "best" : "") + '">' + fmt(x) + "</span>";
                });
            }).join("") + '</tbody></table>' : '<p class="c-now-p">Henüz yarışmacı yok.</p>';
        // tablo değişmediyse yeniden çizme (yoksa butona basarken buton yenilenip tıklama kayboluyor)
        if (comp.tableHtml !== tHtml) { comp.tableHtml = tHtml; $("cTable").innerHTML = tHtml; bindTable(); }
        $("cOut").textContent = out.length ? "Elenenler: " + out.map(function (p) { return p.name; }).join(", ") : "";
        renderComp2();
    }
    function bindTable() {
        Array.prototype.forEach.call($("cTable").querySelectorAll("[data-mod]"), function (b) { b.onclick = function () { toggleMod(b.getAttribute("data-mod")); }; });
        Array.prototype.forEach.call($("cTable").querySelectorAll("[data-tr]"), function (b) { b.onclick = function () { transferTo(b.getAttribute("data-tr"), b.getAttribute("data-n")); }; });
        Array.prototype.forEach.call($("cTable").querySelectorAll("[data-k]"), function (b) {
            b.onclick = function () { kickPlayer(b.getAttribute("data-k")); };
        });
    }
    function renderComp2() {
        var d = comp.doc, host = isHost(), owner = isOwner();
        // organizatör / moderatör kontrolleri
        renderNow();
        $("cOrg").hidden = !host || (d.st === "end" && !!d.fin);
        $("cOrgWho").textContent = owner ? "👑 Oda sahibi:" : "🛡️ Moderatör:";
        $("cStart").hidden = d.st !== "lobby"; $("cStart").disabled = comp.players.length < 2;
        $("cEnd").hidden = d.st !== "run";
        if ($("cFinish")) $("cFinish").hidden = !(d.st === "end" && !d.fin);
        $("cShowRes").hidden = !hist().length;
        $("cHint").textContent = comp.watch ? "👁 İzleyici modundasın: tablo canlı güncellenir." : d.st === "lobby" ? (host ? "Yarışmacılar katılınca turu başlat (en az 2 kişi)." : "Organizatörün turu başlatması bekleniyor.") : d.st === "run" ? "Herkes 5 çözümü bitirince tur kendiliğinden biter." : (d.fin ? "Final bitti." : "Tur bitti.");
        renderModeUi();
    }
    /* --- şu an canlı yarışmalar (izle) --- */
    var liveT = 0;
    function loadLive() {
        var box = $("cLive"); if (!box) return;
        if (!betaOk) { $("cLiveWrap").hidden = true; if ($("cOpenWrap")) $("cOpenWrap").hidden = true; return; }
        // son güncellenen 15 yarışma (tümünü listelemek pahalı)
        var q = { structuredQuery: { from: [{ collectionId: "comps" }], orderBy: [{ field: { fieldPath: "ts" }, direction: "DESCENDING" }], limit: 15 } };
        apiAny(":runQuery", { method: "POST", body: JSON.stringify(q) }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (arr) {
            var d = { documents: (arr || []).filter(function (x) { return x.document; }).map(function (x) { return x.document; }) };
            var now = Date.now();
            var all = (d.documents || []).map(function (x) { var o = parseDoc(x); o.code = x.name.split("/").pop(); o.up = Date.parse(x.updateTime) || 0; return o; });
            renderOpen(all.filter(function (o) { return (o.st === "lobby" || (o.st === "end" && !o.fin)) && now - o.up < 6 * 3600000; }).sort(function (a, b) { return b.up - a.up; }).slice(0, 10));
            var list = (d.documents || []).map(function (x) { var o = parseDoc(x); o.code = x.name.split("/").pop(); o.up = Date.parse(x.updateTime) || 0; return o; })
                // başlatılmamış (lobi) yarışmalar listede görünmez
                .filter(function (o) { return o.st && o.st !== "lobby" && now - o.up < 6 * 3600000 && !(o.st === "end" && o.fin && now - o.up > 1800000); })
                .sort(function (a, b) { return b.up - a.up; }).slice(0, 10);
            $("cLiveWrap").hidden = !list.length;
            if (!list.length) return;
            return Promise.all(list.map(function (o) {
                return Promise.all([countDocs("/comps/" + o.code + "/p"), countFresh(o.code)]).then(function (c) { o.n = c[0]; o.w = Math.max(0, c[1] - c[0]); return o; });
            })).then(function (rows) {
                box.innerHTML = rows.map(function (o) {
                    var stt = o.st === "lobby" ? "Lobi" : o.st === "run" ? roundLabel(o) + " sürüyor" : roundLabel(o) + " bitti";
                    return '<div class="c-live"><span class="c-dot' + (o.st === "run" ? " on" : "") + '"></span><div class="c-live-tx"><b>' + esc(o.name || "Ev yarışması") + '</b><small>' + evName(o.ev) + ' · ' + stt + ' · 👤 ' + o.n + '/' + o.cap + ' · 👁 ' + o.w + ' izliyor · ' + esc(o.hName || "") + '</small></div>' +
                        '<button type="button" class="btn sm" data-watch="' + esc(o.code) + '">👁 İzle</button></div>';
                }).join("");
                Array.prototype.forEach.call(box.querySelectorAll("[data-watch]"), function (b) { b.onclick = function () { joinComp(b.getAttribute("data-watch"), true); }; });
            });
        }).catch(function () { $("cLiveWrap").hidden = true; });
    }
    // Katılmaya açık yarışmalar (lobi ya da tur arası)
    function renderOpen(list) {
        var wrap = $("cOpenWrap"), box = $("cOpen"); if (!box) return;
        wrap.hidden = !list.length; if (!list.length) { box.innerHTML = ""; return; }
        Promise.all(list.map(function (o) {
            return countDocs("/comps/" + o.code + "/p").then(function (n) { o.n = n; return o; });
        })).then(function (rows) {
            box.innerHTML = rows.map(function (o) {
                var full = o.n >= o.cap;
                return '<div class="c-live"><span class="c-dot on"></span><div class="c-live-tx"><b>' + esc(o.name || "Ev yarışması") + '</b><small>' + evName(o.ev) + ' · ' + (o.st === "lobby" ? "Başlamayı bekliyor" : roundLabel(o) + " bitti, yeni tur bekleniyor") + ' · 👤 ' + o.n + '/' + o.cap + ' · ' + esc(o.hName || "") + '</small></div>' +
                    (full ? '<span class="ak-pill">Dolu</span>' : '<button type="button" class="btn primary sm" data-join="' + esc(o.code) + '">Katıl</button>') + '</div>';
            }).join("");
            Array.prototype.forEach.call(box.querySelectorAll("[data-join]"), function (b) { b.onclick = function () { $("cJoinIn").value = b.getAttribute("data-join"); joinComp(b.getAttribute("data-join")); }; });
        });
    }
    function initCompRole() {
        isOrgUser().then(function (ok) { $("cCreateBox").classList.toggle("locked", !ok); $("cCreate").disabled = !ok; $("cOrgNote").hidden = ok; });
        // Şimdilik yalnız tester / organizatör / geliştirici (ve admin) kullanabilir
        var pend = window.Account && Account.isPending && Account.isPending();
        var p = !signedIn() ? Promise.resolve(false) : (Account.isAdmin && Account.isAdmin()) ? Promise.resolve(true)
            : Account.getRole(Account.user().uid).then(function (r) { return ["tester", "organizator", "gelistirici"].indexOf(r) >= 0; }, function () { return false; });
        betaP = p.then(function (ok) {
            var was = betaOk; betaOk = ok;
            document.body.classList.toggle("c-locked", !ok && !pend);
            if ($("cBeta")) $("cBeta").innerHTML = signedIn() ? "🔒 Ev yarışması şu an <b>test aşamasında</b>: yalnızca <b>tester</b>, <b>organizatör</b> ve <b>geliştirici</b> rolündekiler kullanabilir. Yakında herkese açılacak!" : '🔒 Ev yarışması şu an <b>test aşamasında</b>. Rolün varsa <button type="button" class="c-linkbtn" id="cBetaLogin">giriş yap</button>.';
            if ($("cBetaLogin")) $("cBetaLogin").onclick = function () { Account.openLogin && Account.openLogin(); };
            if (ok && !was && !comp) loadLive();
            return ok;
        });
    }
    function initComp() {
        initCompRole();
        loadLive(); clearInterval(liveT); liveT = setInterval(function () { if (!comp && document.visibilityState === "visible") loadLive(); }, 60000);
        $("cCreate").onclick = createComp;
        if ($("cCapR")) $("cCapR").oninput = function () { $("cCapV").textContent = this.value; };
        $("cJoin").onclick = function () { joinComp($("cJoinIn").value); };
        $("cJoinIn").onkeydown = function (e) { if (e.key === "Enter") joinComp($("cJoinIn").value); };
        if ($("cLoginNote")) $("cLoginNote").hidden = signedIn() || !!(window.Account && Account.isPending && Account.isPending());
        if ($("cLoginBtn")) $("cLoginBtn").onclick = function () { Account.openLogin && Account.openLogin(); };
        $("cLeave").onclick = function () {
            var playing = comp && !comp.watch && myP() && comp.doc && comp.doc.st !== "lobby";
            if (confirm(playing ? "Yarışmadan çıkılsın mı? Kaydın silinir; bu turdaki sürelerin sayılmaz (geçmiş turların sonuçları kalır)." : "Yarışmadan çıkılsın mı?")) leaveComp();
        };
        $("cStart").onclick = function () { startRound(false, 0); };
        if ($("cFinish")) $("cFinish").onclick = finishComp;
        if ($("cChatForm")) {
            $("cChatForm").onsubmit = function (e) { e.preventDefault(); chatSend(); };
            $("cChatLoginBtn").onclick = function () { Account.openLogin && Account.openLogin(); };
        }
        $("cEnd").onclick = function () { if (confirm("Tur şimdi bitirilsin mi? Eksik çözümü olanların Ao5'i olmaz.")) endRound(); };
        $("cShowRes").onclick = function () { var h = hist(); if (h.length) showRoundResults(h[h.length - 1]); };
        Array.prototype.forEach.call(document.querySelectorAll(".c-mode button"), function (b) { b.onclick = function () { setMode(b.getAttribute("data-m")); }; });
        $("cTypeOk").onclick = function () { typeSave(""); };
        $("cTypeP2").onclick = function () { typeSave("+2"); };
        $("cTypeDnf").onclick = function () { typeSave("dnf"); };
        $("cTypeIn").onkeydown = function (e) { if (e.key === "Enter") typeSave(""); };
        $("cTypeIn").oninput = typePreview;
        $("cCopy").onclick = function () {
            var link = location.origin + "/icerikler/ev-yarismasi?" + (comp && comp.watch ? "izle=" : "ev=") + (comp && comp.code);
            var done = function () { $("cCopy").textContent = "Kopyalandı ✓"; setTimeout(function () { $("cCopy").textContent = "🔗 Davet bağlantısı"; }, 1500); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () {}); else prompt("Bağlantı:", link);
        };
        ["akPad", "akMini"].forEach(function (id) {
            var el = $(id);
            function inBtn(e) { var b = e.target.closest("button"); return b && b.id !== "akPad"; }
            el.addEventListener("touchstart", function (e) { if (!manualOn() || inBtn(e)) return; e.preventDefault(); manualDown(); }, { passive: false });
            el.addEventListener("touchend", function (e) { if (!manualOn() && phase !== "holding") return; if (inBtn(e)) return; e.preventDefault(); manualUp(); }, { passive: false });
            el.addEventListener("mousedown", function (e) { if (manualOn() && !inBtn(e)) manualDown(); });
            el.addEventListener("mouseup", function (e) { if (!inBtn(e)) manualUp(); });
        });
    }

    /* ---------- sekmeler ve başlangıç ---------- */
    function setTab(t) {
        tab = t;
        Array.prototype.forEach.call(document.querySelectorAll(".ak-tab"), function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === t); });
        $("akDuel").hidden = t !== "duel"; $("akComp").hidden = t !== "comp"; $("akAnalysisExtra").hidden = t !== "analysis";
        $("akNew").hidden = t !== "analysis";
        $("akPad").hidden = true; $("cType").hidden = true;
        $("akConnBox").hidden = t === "comp"; // yarışmada akıllı küp kullanılmıyor
        if (t === "duel" && duel && duel.doc) setScramble(duel.doc.scr);
        else if (t === "analysis") setScramble(genScramble());
        else if (t === "comp") { if (comp && comp.doc) nextScramble(true); else setScramble(""); }
    }
    function init() {
        SOLVED_STR = new Cube().asString();
        if (!supported()) { $("akNoBt").hidden = false; $("akConnect").disabled = true; }
        $("akConnect").onclick = connect;
        $("akDisc").onclick = disconnect;
        $("akReset").onclick = resetModel;
        $("akNew").onclick = function () { setScramble(genScramble()); };
        $("akDnf").onclick = toggleDnf; $("akMiniDnf").onclick = toggleDnf;
        $("akMiniX").onclick = miniHide;
        Array.prototype.forEach.call(document.querySelectorAll(".ak-tab"), function (b) { b.onclick = function () { setTab(b.getAttribute("data-tab")); }; });
        $("akCreate").onclick = createDuel;
        $("akJoin").onclick = function () { joinDuel($("akJoinIn").value); };
        $("akJoinIn").onkeydown = function (e) { if (e.key === "Enter") joinDuel($("akJoinIn").value); };
        $("akLeave").onclick = leaveDuel;
        $("akNext").onclick = nextRound;
        $("akShowFin").onclick = function () { if (duel && duel.doc) renderFinal(duel.doc); };
        $("akFinal").onclick = function (e) { if (e.target === $("akFinal")) closeFinal(); };
        $("akCopy").onclick = function () {
            var link = location.origin + "/icerikler/akilli-kup?duel=" + (duel && duel.code);
            var done = function () { $("akCopy").textContent = "Kopyalandı ✓"; setTimeout(function () { $("akCopy").textContent = "🔗 Bağlantıyı kopyala"; }, 1500); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () {}); else prompt("Bağlantı:", link);
        };
        var qs = new URLSearchParams(location.search), ev = qs.get("ev"), EV_PAGE = window.AK_PAGE === "ev";
        // Ev yarışması ayrı sayfada: eski bağlantılar oraya gitsin
        if (!EV_PAGE && (ev || qs.get("tab") === "ev")) { location.replace("/icerikler/ev-yarismasi" + (ev ? "?ev=" + encodeURIComponent(ev) : "")); return; }
        renderStages(null); renderHist(); initComp();
        if (EV_PAGE) {
            setTab("comp");
            var iz = qs.get("izle");
            if (iz) {
                var tryIz = function () { if (signedIn() && !comp) joinComp(iz, true); };
                if (window.Account && Account.onChange) Account.onChange(function (u) { if (u) tryIz(); });
                setTimeout(function () { if (!comp) { if (signedIn()) tryIz(); else if (!(Account.isPending && Account.isPending())) cMsg("Yarışmayı izlemek için giriş yap.", 1); } }, 1500);
            }
            if (ev) {
                if ($("cJoinIn")) $("cJoinIn").value = String(ev).toUpperCase().slice(0, 5);
                var tryEv = function () { if (signedIn() && !comp) joinComp(ev); };
                if (window.Account && Account.onChange) Account.onChange(function (u) { if (u) tryEv(); else cMsg("Yarışmaya katılmak için giriş yap.", 1); });
                setTimeout(tryEv, 1200);
            }
        }
        var q = qs.get("duel");
        if (q) {
            setTab("duel");
            var tryJoin = function () { if (signedIn()) joinDuel(q); else duelMsg("Düelloya katılmak için giriş yap.", 1); };
            if (window.Account && Account.onChange) Account.onChange(function (u) { if (u && !duel) joinDuel(q); });
            setTimeout(tryJoin, 1200);
        } else if (!EV_PAGE) setTab("analysis");
        if (window.Account && Account.onChange) Account.onChange(function () { $("akLoginNote").hidden = signedIn(); $("cLoginNote").hidden = signedIn(); initCompRole(); if (comp) chatUi(); });
        $("akLoginNote").hidden = signedIn();
        $("akLoginBtn").onclick = function () { Account.openLogin && Account.openLogin(); };
    }
    window.AkilliKup = { setScramble: setScramble, shareImage: shareImage, matchData: matchData, comp: function () { return comp; }, refreshRole: function () { initCompRole(); return betaP; } }; // test/geliştirme için
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
