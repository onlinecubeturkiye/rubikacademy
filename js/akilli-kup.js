/* =========================================================
   AKILLI KÜP (akilli-kup.js) — Bluetooth özellikleri
   - Bağlantı: smartcube-bluetooth (GAN vb.), "Bağlan"a basınca yüklenir
   - Çözüm analizi: karıştırma takibi, ilk hamlede süre, CFOP aşamaları
     (Cross, F2L 1-4, OLL, PLL) süre / hamle / TPS, öneri, geçmiş
   - Canlı düello: iki kişi aynı karıştırma, Firestore "duels/{kod}" ile
     (1 sn'de bir yoklama). Akıllı küp yoksa klavye/dokunma süresi.
   Küp modeli: cubejs (Cube) — küpün kendi çerçevesi (beyaz üst, yeşil önde).
========================================================= */
(function () {
    var DNF = 99999999;
    var LIB_URL = "/js/vendor/smartcube-bluetooth.min.js?v=20261140";
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
    var phase = "idle";              // idle | scrambling | ready | solving | done | holding (klavye)
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
        else if (phase === "done") h = tab === "duel" ? "Bitti! Sonucun rakibine gönderildi." : "Bitti! Yeni karıştırma için butona bas.";
        else if (phase === "holding") h = "Bırakınca süre başlar…";
        else h = conn ? "" : "Akıllı küp bağlı değil: <b>boşluk tuşunu</b> ya da aşağıdaki alanı basılı tut, bırakınca süre başlar.";
        $("akHint").innerHTML = h;
    }

    /* ---------- hamle geldi ---------- */
    function onMove(face, dir) {
        var m = FACES[face] + (dir === 0 ? "" : "'");
        if (!cube) cube = new Cube();
        cube.move(m);
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
        var inDuel = !!(duel && tab === "duel");
        if (!inDuel) saveHist(r);
        renderStages(st); renderResult(r); renderHist(); renderHint();
        setLast(Math.round(t), false); miniShow("done");
        publishDone(Math.round(t));
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
        m.className = "ak-mini show " + (state || "") + (conn ? "" : " nobt");
        if (state === "done") miniT = setTimeout(miniHide, 2600);
    }
    function miniHide() { clearTimeout(miniT); $("akMini").className = "ak-mini"; }
    /* ---------- son çözüm + DNF ---------- */
    var last = null; // { ms, dnf, ctx: "a"|"d", ts }
    function setLast(ms, dnf, why) {
        last = { ms: ms, dnf: !!dnf, ctx: duel && tab === "duel" ? "d" : "a", ts: Date.now() };
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
        } else setMyTime(last.dnf ? DNF : last.ms);
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

    /* ---------- klavye / dokunma süresi (akıllı küp yokken) ---------- */
    var holdT = 0;
    function manualDown() {
        if (conn) return;
        if (phase === "solving") { manualStop(); return; }
        if (phase === "idle" || phase === "done") { phase = "holding"; holdT = now(); $("akTime").textContent = fmt(0); $("akTime").classList.add("hold"); miniShow("hold"); renderHint(); }
    }
    function manualUp() {
        if (conn || phase !== "holding") return;
        $("akTime").classList.remove("hold");
        if (now() - holdT < 300) { phase = "idle"; miniHide(); renderHint(); return; }
        phase = "solving"; t0 = now(); moves = []; st = null; startTick(); renderHint(); publish("çözüyor"); miniShow("run");
    }
    function manualStop() {
        var t = now() - t0; stopTick(); phase = "done"; setLast(Math.round(t), false); miniShow("done"); renderHint(); publishDone(Math.round(t));
    }
    document.addEventListener("keydown", function (e) {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (e.code === "Space") { e.preventDefault(); if (!e.repeat) manualDown(); }
        else if (phase === "solving" && !conn) { e.preventDefault(); manualStop(); }
    });
    document.addEventListener("keyup", function (e) { if (e.code === "Space") { e.preventDefault(); manualUp(); } });

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
            $("akConnect").hidden = true; $("akDisc").hidden = false; $("akConnect").disabled = false; $("akReset").hidden = false; $("akPad").hidden = true;
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
            if (!(duel && tab === "duel")) { var r = buildResult(t); r.dnf = true; r.t = DNF; saveHist(r); renderHist(); }
            setLast(DNF, true, "Bağlantı koptu"); miniShow("done");
            publishDone(DNF);
        }
        if (phase !== "done") phase = "idle";
        setConn("Bağlı değil", ""); $("akConnect").hidden = false; $("akDisc").hidden = true; $("akReset").hidden = true; $("akPad").hidden = false; $("akBatt").textContent = "";
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
    function createDuel() {
        if (!signedIn()) { Account.openLogin && Account.openLogin(); return; }
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

    /* ---------- sekmeler ve başlangıç ---------- */
    function setTab(t) {
        tab = t;
        Array.prototype.forEach.call(document.querySelectorAll(".ak-tab"), function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === t); });
        $("akDuel").hidden = t !== "duel"; $("akAnalysisExtra").hidden = t !== "analysis";
        $("akNew").hidden = t === "duel";
        if (t === "duel" && duel && duel.doc) setScramble(duel.doc.scr);
        else if (t === "analysis") setScramble(genScramble());
    }
    function init() {
        SOLVED_STR = new Cube().asString();
        if (!supported()) { $("akNoBt").hidden = false; $("akConnect").disabled = true; }
        $("akConnect").onclick = connect;
        $("akDisc").onclick = disconnect;
        $("akReset").onclick = resetModel;
        $("akNew").onclick = function () { setScramble(genScramble()); };
        function inBtn(e) { var b = e.target.closest("button"); return b && b.id !== "akPad"; }
        ["akPad", "akMini"].forEach(function (id) {
            $(id).addEventListener("touchstart", function (e) { if (inBtn(e)) return; e.preventDefault(); manualDown(); }, { passive: false });
            $(id).addEventListener("touchend", function (e) { if (inBtn(e)) return; e.preventDefault(); manualUp(); }, { passive: false });
            $(id).addEventListener("mousedown", function (e) { if (!inBtn(e)) manualDown(); });
            $(id).addEventListener("mouseup", function (e) { if (!inBtn(e)) manualUp(); });
        });
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
        renderStages(null); renderHist();
        var q = new URLSearchParams(location.search).get("duel");
        if (q) {
            setTab("duel");
            var tryJoin = function () { if (signedIn()) joinDuel(q); else duelMsg("Düelloya katılmak için giriş yap.", 1); };
            if (window.Account && Account.onChange) Account.onChange(function (u) { if (u && !duel) joinDuel(q); });
            setTimeout(tryJoin, 1200);
        } else setTab("analysis");
        if (window.Account && Account.onChange) Account.onChange(function () { $("akLoginNote").hidden = signedIn(); });
        $("akLoginNote").hidden = signedIn();
        $("akLoginBtn").onclick = function () { Account.openLogin && Account.openLogin(); };
    }
    window.AkilliKup = { setScramble: setScramble, shareImage: shareImage, matchData: matchData }; // test/geliştirme için
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
