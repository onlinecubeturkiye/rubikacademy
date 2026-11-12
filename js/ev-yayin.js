/* =========================================================
   EV YARIŞMASI YAYIN EKRANI (ev-yayin.js) — /icerikler/ev-yayin?ev=KOD
   comps/{kod} ve comps/{kod}/p herkese açık okunur; 2 sn'de bir yoklanır.
   Üstte büyük: o an süre giren yarışmacı (yoksa turun lideri), sağda canlı sıralama,
   altta küçük kartlar: diğer yarışmacıların YALNIZ bu turdaki süreleri.
========================================================= */
(function () {
    var DNF = 99999999, POLL = 2000, SPOT_MS = 14000;
    var cfg = window.RA_FIREBASE || {}, qs = new URLSearchParams(location.search);
    var code = String(qs.get("ev") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    var arka = qs.get("arka"); if (arka === "yesil") document.body.classList.add("green"); else if (arka === "seffaf") document.body.classList.add("clear");
    var W = document.getElementById("w");
    var st = { doc: null, players: [], prev: {}, spot: null, spotAt: 0, lastHtml: "", rec: {} };
    // Rekor tablosunun 1.'leri (5 dk'da bir): yeni süre onları geçerse "SİTE REKORU" yazar
    function loadRec() {
        if (!window.RACompShare || !st.doc) return;
        var ev = st.doc.ev === "222" ? "222" : "333", ak = NS(st.doc) === 12 ? "a12" : "a5";
        Promise.all([RACompShare.records(ev, "s", 1), RACompShare.records(ev, ak, 1)]).then(function (v) { st.rec = { ev: ev, s: v[0][0] || null, a: v[1][0] || null }; st.lastHtml = ""; render(); }, function () {});
    }
    setInterval(loadRec, 300000);

    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function fmt(ms) { if (ms == null || isNaN(ms)) return "-"; if (ms >= DNF) return "DNF"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
    function base() { return ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents"; }
    function get(path) { return fetch(base() + path + (path.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(cfg.apiKey)).then(function (r) { if (r.status === 404) return { notFound: 1 }; if (!r.ok) throw new Error(r.status); return r.json(); }); }
    function val(x) { return x == null ? null : x.integerValue != null ? +x.integerValue : x.doubleValue != null ? +x.doubleValue : x.stringValue != null ? x.stringValue : x.timestampValue != null ? x.timestampValue : x.booleanValue; }
    function parse(d) { var o = {}, f = (d && d.fields) || {}; Object.keys(f).forEach(function (k) { o[k] = val(f[k]); }); return o; }
    function list(s) { return String(s || "").split(",").filter(Boolean).map(Number); }
    function NS(d) { return String(d.scr || "").split("|").filter(Boolean).length === 12 ? 12 : 5; }
    function avgOf(arr, n) {
        if (arr.length < n) return null;
        var a = arr.slice(0, n).slice().sort(function (x, y) { return x - y; }).slice(1, -1);
        if (a.some(function (x) { return x >= DNF; })) return DNF;
        return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    }
    function meanOk(t) { var ok = t.filter(function (x) { return x < DNF; }); return ok.length ? ok.reduce(function (a, b) { return a + b; }, 0) / ok.length : null; }
    var MODE = { timer: "⏱", magnet: "🧲", stackmat: "⏱", gan: "📶", manual: "" };

    function rows() {
        var d = st.doc, adv = String(d.adv || ""), n = NS(d);
        return st.players.filter(function (p) { return !adv || adv.split(",").indexOf(p.uid) >= 0; }).map(function (p) {
            var t = p.rnd === d.round ? list(p.t) : [];
            var a = t.length >= n ? avgOf(t, n) : null, ok = t.filter(function (x) { return x < DNF; });
            return { uid: p.uid, n: p.name || "?", m: p.mode || "", t: t, a: a, mean: meanOk(t), best: ok.length ? Math.min.apply(null, ok) : null };
        }).sort(function (x, y) {
            // tamamlayanlar ortalamaya göre; diğerleri (canlı) o ana kadarki ortalamaya göre
            var kx = x.a != null ? [0, x.a] : x.mean != null ? [1, x.mean] : [2, 0], ky = y.a != null ? [0, y.a] : y.mean != null ? [1, y.mean] : [2, 0];
            return kx[0] - ky[0] || kx[1] - ky[1] || x.n.localeCompare(y.n, "tr");
        });
    }
    function chips(t, n, cls, newIdx) {
        var ok = t.filter(function (x) { return x < DNF; }), best = ok.length > 1 ? Math.min.apply(null, ok) : null, out = "";
        for (var i = 0; i < n; i++) {
            var x = t[i];
            out += x == null ? '<span class="' + cls + ' e">' + (i + 1) + '</span>' : '<span class="' + cls + (x >= DNF ? " dnf" : x === best ? " best" : "") + (i === newIdx ? " new" : "") + '">' + fmt(x) + '</span>';
        }
        return out;
    }

    function render() {
        var d = st.doc;
        if (!d) return;
        var n = NS(d), R = rows(), now = Date.now();
        // yeni süre giren yarışmacıyı öne çıkar
        R.forEach(function (r) { var c = r.t.length, pc = st.prev[r.uid]; if (pc != null && c > pc) { st.spot = r.uid; st.spotAt = now; st.pop = 1; } st.prev[r.uid] = c; });
        if (st.spot && (now - st.spotAt > SPOT_MS || !R.some(function (r) { return r.uid === st.spot; }))) st.spot = null;
        var rl = d.fin ? "🏆 Final" + (n === 12 ? " · Ao12" : "") : "Tur " + (d.round || 1);
        var ev = d.ev === "222" ? "2x2" : "3x3";
        var done = R.length ? Math.min.apply(null, R.map(function (r) { return r.t.length; })) : 0;
        var chip = d.st === "run" ? '<span class="chip live">CANLI · ' + Math.min(n, done + 1) + ' / ' + n + '. çözüm</span>'
            : d.st === "prep" ? '<span class="chip">⏳ Hazırlık ' + mmss((d.pa || 0) - now) + '</span>'
            : d.st === "end" ? '<span class="chip">' + (d.fin ? "🏆 Final bitti" : "🏁 Tur bitti") + '</span>' : '<span class="chip">⏳ Lobi</span>';
        var scr = String(d.scr || "").split("|")[Math.min(n - 1, done)] || "";
        var top = '<div class="top"><img src="/RubikAcademyLogo.png" alt=""><div class="t1"><h1>' + esc(d.name || "Ev yarışması") + '</h1><small>' + rl + ' · ' + ev + ' · Ao' + n + ' · ' + R.length + ' yarışmacı' + (d.st === "run" && scr ? ' · <span class="scr">' + esc(scr) + '</span>' : '') + (st.rec.s ? ' · <span class="rec">Rekor ' + fmt(st.rec.s.t) + ' (' + esc(st.rec.s.name) + ')</span>' : '') + '</small></div>' + chip + '</div>';

        var main;
        if (!R.length || d.st === "lobby") {
            main = '<div class="main"><div class="spot"><div class="k">' + (d.st === "lobby" ? "Lobi" : "Bekleniyor") + '</div><div class="nm">Yarışma birazdan başlıyor</div><div class="row">' + st.players.map(function (p) { return '<span class="tm">' + esc(p.name || "?") + '</span>'; }).join("") + '</div></div>' + rankHtml([]) + '</div>';
        } else if (d.st === "prep") {
            main = '<div class="main"><div class="spot"><div class="k">' + rl + ' · hazırlık</div><div class="nm">Tur birazdan başlıyor</div><div class="prep">' + mmss((d.pa || 0) - now) + '</div></div>' + rankHtml([]) + '</div>';
        } else {
            var ended = d.st === "end", sp = null;
            if (!ended && st.spot) sp = R.filter(function (r) { return r.uid === st.spot; })[0];
            var isLeader = !sp; if (!sp) sp = R[0];
            var last = sp.t.length ? sp.t[sp.t.length - 1] : null, pos = R.indexOf(sp);
            var kick = ended ? (d.fin ? "🏆 Şampiyon" : "Turun birincisi") : isLeader ? "Lider" : "Yeni süre · " + sp.t.length + ". çözüm";
            var bigV = ended || isLeader ? (sp.a != null ? sp.a : sp.mean) : last;
            main = '<div class="main"><div class="spot' + (st.pop ? " pop" : "") + '">' +
                (ended && pos === 0 ? '<div class="medal">' + (d.fin ? "🏆" : "🥇") + '</div>' : '') +
                '<div class="k">' + kick + (MODE[sp.m] ? " · " + MODE[sp.m] : "") + '</div><div class="nm">' + esc(sp.n) + recBadge(sp, n) + '</div>' +
                '<div class="big' + (bigV != null && bigV >= DNF ? " dnf" : "") + '">' + (bigV == null ? "—" : fmt(bigV)) + '</div>' +
                '<div class="row">' + chips(sp.t, n, "tm", ended || isLeader ? -1 : sp.t.length - 1) +
                '<div class="avg"><span>' + (sp.a != null ? "AO" + n : "ORT.") + ' · ' + (pos + 1) + '. SIRA</span><b>' + fmt(sp.a != null ? sp.a : sp.mean) + '</b></div></div></div>' +
                rankHtml(R) + '</div>';
            st.pop = 0;
            var others = R.filter(function (r) { return r !== sp; });
            main += '<div class="others">' + others.map(function (r) {
                return '<div class="oc' + (r.uid === st.spot ? " hot" : "") + '"><div class="h"><em>' + (R.indexOf(r) + 1) + '.</em><b>' + esc(r.n) + '</b><i>' + fmt(r.a != null ? r.a : r.mean) + '</i></div><div class="ts">' + chips(r.t, n, "", -1).replace(/class="/g, 'class="') + '</div></div>';
            }).join("") + '</div>';
        }
        var html = top + main;
        if (html !== st.lastHtml) { st.lastHtml = html; W.innerHTML = html; }
    }
    function recBadge(r, n) {
        var ok = r.t.filter(function (x) { return x < DNF; }), best = ok.length ? Math.min.apply(null, ok) : null, b = [];
        if (best != null && st.rec.s && best < st.rec.s.t) b.push("🔥 TEKİL SİTE REKORU");
        if (r.a != null && r.a < DNF && st.rec.a && r.a < st.rec.a.t) b.push("🔥 AO" + n + " SİTE REKORU");
        return b.map(function (t) { return '<span class="recb">' + t + '</span>'; }).join("");
    }
    function rankHtml(R) {
        var n = st.doc ? NS(st.doc) : 5;
        return '<div class="rank"><h2>SIRALAMA · BU TUR</h2>' + (R.length ? R.slice(0, 10).map(function (r, i) {
            var v = r.a != null ? r.a : r.mean;
            return '<div class="rk' + (i === 0 && v != null ? " r1" : "") + '"><span class="p">' + (i + 1) + '</span><span class="n">' + esc(r.n) + '</span><span class="a">' + fmt(v) + (r.a == null && r.t.length ? '<small>' + r.t.length + '/' + n + '</small>' : '') + '</span></div>';
        }).join("") : '<div class="rk"><span class="p">–</span><span class="n" style="color:var(--soft)">Süreler gelince burada</span><span></span></div>') + '</div>';
    }

    function poll() {
        if (!code) { W.innerHTML = '<div class="msg">Adreste yarışma kodu yok. Odadaki “📺 Yayın ekranı” düğmesiyle aç.</div>'; return; }
        Promise.all([get("/comps/" + code), get("/comps/" + code + "/p?pageSize=50")]).then(function (res) {
            if (res[0].notFound) { W.innerHTML = '<div class="msg">' + esc(code) + ' kodlu yarışma bulunamadı ya da kapandı.</div>'; return; }
            st.doc = parse(res[0]);
            st.players = (res[1].documents || []).map(function (x) { var o = parse(x); o.uid = x.name.split("/").pop(); return o; });
            document.title = (st.doc.name || "Ev yarışması") + " · Yayın ekranı";
            if (!st.recAsked) { st.recAsked = 1; loadRec(); }
            render();
        }).catch(function () {}).then(function () { setTimeout(poll, POLL); });
    }
    // hazırlık geri sayımı her saniye akar
    setInterval(function () { if (st.doc && st.doc.st === "prep") render(); }, 1000);
    poll();
})();
