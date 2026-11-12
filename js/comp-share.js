/* =========================================================
   EV YARIŞMASI SONUÇ GÖRSELİ / METNİ (comp-share.js)
   Yarışma sayfası (akilli-kup.js) ve yönetim paneli (admin.js) aynı görseli üretir.
   RACompShare.image(d, r) → Promise<Blob>   (d: comps/{kod} belgesi, r: R listesindeki bir tur)
   RACompShare.text(d, r)  → paylaşım metni
========================================================= */
(function () {
    if (window.RACompShare) return;
    var DNF = 99999999;
    function fmt(ms) { if (ms == null || isNaN(ms)) return "-"; if (ms >= DNF) return "DNF"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function evName(e) { return e === "222" ? "2x2" : "3x3"; }
    function rS(r) { return (r && r.s) || 5; }
    function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
    function shareTextR(d, r) {
        return "🏠 " + d.name + " · " + (r.f ? "Final" : "Tur " + r.n) + " (" + evName(d.ev) + " Ao" + rS(r) + ")\n" + r.rows.map(function (x, i) {
            return (i + 1) + ". " + x.n + " — " + (x.a == null ? "-" : fmt(x.a)) + "  (" + x.t.map(fmt).join(", ") + ")";
        }).join("\n") + "\nrubikacademy.fun/icerikler/ev-yarismasi";
    }
    var logoP = null;
    function loadLogo() {
        if (!logoP) logoP = new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = "/RubikAcademyLogo.png"; });
        return logoP;
    }
    // Metni verilen genişliğe sığdırır: önce yazıyı küçültür, yetmezse sonunu "…" ile keser
    function fitText(x, s, maxW, weight, size, minSize, fam) {
        s = String(s || ""); fam = fam || "Inter, sans-serif";
        for (var z = size; z >= minSize; z -= 2) { x.font = weight + " " + z + "px " + fam; if (x.measureText(s).width <= maxW) return s; }
        while (s.length > 1 && x.measureText(s + "…").width > maxW) s = s.slice(0, -1);
        return s + "…";
    }
    function shareBg(x, W, H, acc) {
        x.fillStyle = "#0b0d14"; x.fillRect(0, 0, W, H);
        [[W * 0.1, 80, 520, acc], [W * 0.95, H * 0.55, 560, "#e84393"], [W * 0.3, H, 480, acc]].forEach(function (b) {
            var g = x.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]); g.addColorStop(0, b[3] + "55"); g.addColorStop(1, b[3] + "00");
            x.fillStyle = g; x.fillRect(0, 0, W, H);
        });
        var bar = x.createLinearGradient(0, 0, W, 0); bar.addColorStop(0, acc); bar.addColorStop(1, "#e84393");
        x.fillStyle = bar; x.fillRect(0, H - 12, W, 12);
        return bar;
    }
    function shareHead(x, W, logo, kicker) {
        if (logo) { x.fillStyle = "#151826"; roundRect(x, 60, 52, 76, 76, 20); x.fill(); x.drawImage(logo, 69, 61, 58, 58); }
        x.textAlign = "left"; x.fillStyle = "#eef0f7"; x.font = "800 36px Inter, sans-serif"; x.fillText("Rubik Academy", logo ? 156 : 60, 102);
        x.font = "800 24px Inter, sans-serif"; var kw = x.measureText(kicker).width + 44;
        x.fillStyle = "rgba(108,92,231,.22)"; roundRect(x, W - 60 - kw, 64, kw, 52, 26); x.fill();
        x.strokeStyle = "rgba(162,155,254,.5)"; x.lineWidth = 2; x.stroke();
        x.fillStyle = "#c9c3ff"; x.textAlign = "center"; x.fillText(kicker, W - 60 - kw / 2, 98);
    }
    function shareImageR(d, r) {
        return loadLogo().then(function (logo) {
            var W = 1080, rowH = 112, top = 360, H = Math.max(1080, top + r.rows.length * rowH + 130);
            var c = document.createElement("canvas"); c.width = W; c.height = H;
            var x = c.getContext("2d"), acc = (getComputedStyle(document.body).getPropertyValue("--ui-accent") || "#6c5ce7").trim();
            if (!/^#[0-9a-f]{6}$/i.test(acc)) acc = "#6c5ce7";
            var bar = shareBg(x, W, H, acc);
            shareHead(x, W, logo, "🏠 EV YARIŞMASI");
            x.textAlign = "left"; x.fillStyle = "#eef0f7";
            x.fillText(fitText(x, d.name, W - 120, "900", 64, 40), 60, 220);
            x.font = "800 34px Inter, sans-serif"; x.fillStyle = bar;
            x.fillText((r.f ? "🏆 Final" : "Tur " + r.n) + " · " + evName(d.ev) + " · Ao" + rS(r) + " · " + r.rows.length + " yarışmacı", 60, 280);
            var medal = ["🥇", "🥈", "🥉"], aoW = 230;
            r.rows.forEach(function (row, i) {
                var y = top + i * rowH, win = i === 0;
                if (win) { var wg = x.createLinearGradient(60, 0, W - 60, 0); wg.addColorStop(0, acc); wg.addColorStop(1, "#a03a8a"); x.fillStyle = wg; }
                else x.fillStyle = i % 2 ? "rgba(255,255,255,.045)" : "rgba(255,255,255,.075)";
                roundRect(x, 60, y, W - 120, rowH - 14, 22); x.fill();
                var mid = y + (rowH - 14) / 2;
                x.textAlign = "center";
                if (i < 3) { x.fillStyle = "#fff"; x.font = "48px 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif"; x.fillText(medal[i], 116, mid + 17); }
                else { x.fillStyle = "#a4aabe"; x.font = "900 36px Inter, sans-serif"; x.fillText(i + 1, 116, mid + 13); }
                // Ao5 kutusu (sağ) — isim ve süreler bu kutuya asla taşmaz
                var bx = W - 60 - 18 - aoW;
                x.fillStyle = win ? "rgba(0,0,0,.22)" : "rgba(0,0,0,.28)"; roundRect(x, bx, y + 14, aoW, rowH - 42, 16); x.fill();
                x.fillStyle = "#fff"; x.textAlign = "center";
                x.fillText(fitText(x, row.a == null ? "DNF" : fmt(row.a), aoW - 24, "900", 42, 26, "'JetBrains Mono', monospace"), bx + aoW / 2, mid + 15);
                var nx = 166, nw = bx - 24 - nx;
                x.textAlign = "left"; x.fillStyle = win ? "#fff" : "#eef0f7";
                x.fillText(fitText(x, row.n, nw, "800", 34, 22), nx, y + 46);
                x.fillStyle = win ? "rgba(255,255,255,.85)" : "#a4aabe";
                x.fillText(fitText(x, row.t.map(fmt).join(row.t.length > 5 ? " " : "  ·  "), nw, "600", 22, 14, "'JetBrains Mono', monospace"), nx, y + 80);
            });
            x.textAlign = "center"; x.fillStyle = "#a4aabe"; x.font = "700 28px Inter, sans-serif"; x.fillText("rubikacademy.fun/icerikler/ev-yarismasi", W / 2, H - 50);
            return new Promise(function (res) { c.toBlob(res, "image/png"); });
        });
    }
    // Final sertifikası (ilk 3): o = { name: kişi, comp: yarışma adı, ev, place: 1-3, a: ortalama (ms), n: 5|12, ts }
    function certImage(o) {
        return loadLogo().then(function (logo) {
            var W = 1600, H = 1131, c = document.createElement("canvas"); c.width = W; c.height = H;
            var x = c.getContext("2d");
            var MED = [["#f5c542", "#b8860b", "BİRİNCİLİK"], ["#d9dde6", "#8a93a6", "İKİNCİLİK"], ["#e0a36b", "#9a5b2b", "ÜÇÜNCÜLÜK"]][Math.max(0, Math.min(2, (o.place || 1) - 1))];
            // zemin
            var bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#10121c"); bg.addColorStop(1, "#1b1530"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
            [[W * 0.12, H * 0.1, 520, "#6c5ce7"], [W * 0.92, H * 0.95, 560, "#e84393"]].forEach(function (b) {
                var g = x.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]); g.addColorStop(0, b[3] + "44"); g.addColorStop(1, b[3] + "00"); x.fillStyle = g; x.fillRect(0, 0, W, H);
            });
            // çerçeve
            x.strokeStyle = MED[0]; x.lineWidth = 6; roundRect(x, 40, 40, W - 80, H - 80, 28); x.stroke();
            x.strokeStyle = MED[0] + "55"; x.lineWidth = 2; roundRect(x, 62, 62, W - 124, H - 124, 20); x.stroke();
            x.textAlign = "center";
            if (logo) { x.fillStyle = "#151826"; roundRect(x, W / 2 - 48, 100, 96, 96, 24); x.fill(); x.drawImage(logo, W / 2 - 37, 111, 74, 74); }
            x.fillStyle = "#c9c3ff"; x.font = "800 30px Inter, sans-serif"; x.fillText("RUBIK ACADEMY · EV YARIŞMASI", W / 2, 250);
            x.fillStyle = "#eef0f7"; x.font = "900 86px Inter, sans-serif"; x.fillText("BAŞARI SERTİFİKASI", W / 2, 350);
            // madalya rozeti
            var my = 470, g2 = x.createLinearGradient(W / 2 - 60, my - 60, W / 2 + 60, my + 60); g2.addColorStop(0, MED[0]); g2.addColorStop(1, MED[1]);
            x.fillStyle = g2; x.beginPath(); x.arc(W / 2, my, 62, 0, Math.PI * 2); x.fill();
            x.fillStyle = "#1b1530"; x.font = "900 64px Inter, sans-serif"; x.fillText(String(o.place || 1), W / 2, my + 23);
            x.fillStyle = "#a4aabe"; x.font = "700 30px Inter, sans-serif"; x.fillText("Bu sertifika", W / 2, 600);
            x.fillStyle = "#ffffff"; x.fillText(fitText(x, o.name || "Yarışmacı", W - 300, "900", 78, 44), W / 2, 690);
            x.strokeStyle = MED[0]; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 - 300, 720); x.lineTo(W / 2 + 300, 720); x.stroke();
            x.fillStyle = "#d7d9e4"; x.font = "700 32px Inter, sans-serif";
            x.fillText(fitText(x, "“" + (o.comp || "Ev yarışması") + "” " + evName(o.ev) + " finalinde", W - 300, "700", 32, 22), W / 2, 780);
            x.fillStyle = MED[0]; x.font = "900 46px Inter, sans-serif"; x.fillText(MED[2] + " ELDE ETTİĞİ İÇİN VERİLMİŞTİR", W / 2, 845);
            x.fillStyle = "#eef0f7"; x.font = "800 34px 'JetBrains Mono', monospace"; x.fillText("Ao" + (o.n || 5) + ": " + (o.a == null ? "DNF" : fmt(o.a)), W / 2, 915);
            var dt = new Date(o.ts || Date.now()).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
            x.fillStyle = "#8d93a8"; x.font = "700 26px Inter, sans-serif"; x.fillText(dt + "  ·  rubikacademy.fun", W / 2, 1010);
            return new Promise(function (res) { c.toBlob(res, "image/png"); });
        });
    }
    // Bir final turundan ilk 3 için sertifika bilgisi
    function certInfo(d, r, i) { var row = r.rows[i]; return row ? { name: row.n, comp: d.name, ev: d.ev, place: i + 1, a: row.a, n: rS(r), ts: d.ts ? Date.parse(d.ts) : Date.now() } : null; }
    function save(blob, name) {
        var file = null; try { file = new File([blob], name, { type: "image/png" }); } catch (e) {}
        var dl = function () { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); };
        // telefonda paylaşım menüsü (galeriye kaydet / WhatsApp), masaüstünde indirme
        if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) return navigator.share({ files: [file] }).catch(function (e) { if (!e || e.name !== "AbortError") dl(); });
        dl(); return Promise.resolve();
    }
    // Dosya adı yalnız ASCII (bazı tarayıcılar Türkçe harfli adı yok sayıp "download" diye kaydediyor)
    function certFile(o) {
        var tr = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u" };
        var n = String(o.name || "yarismaci").replace(/[çğıöşüÇĞİÖŞÜ]/g, function (c) { return tr[c]; }).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "yarismaci";
        return "sertifika-" + n + "-" + (o.place || 1) + ".png";
    }
    function downloadCert(o) { return certImage(o).then(function (b) { return save(b, certFile(o)); }); }
    // Şüpheli süre kontrolü (yalnız yöneticiye uyarı; süreyi değiştirmez)
    //  - dünya rekoru seviyesinde süre: 3x3 < 4.00, 2x2 < 0.70
    //  - kişinin bu turdaki diğer (DNF olmayan) sürelerinin ortancasının yarısından hızlı (en az 3 süre daha varsa)
    function suspect(times, ev) {
        var out = {}, lim = ev === "222" ? 700 : 4000;
        var ok = (times || []).map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x != null && o.x > 0 && o.x < DNF; });
        ok.forEach(function (o) {
            if (o.x < lim) { out[o.i] = "Dünya rekoru seviyesinde süre (" + fmt(o.x) + ")"; return; }
            var rest = ok.filter(function (p) { return p.i !== o.i; }).map(function (p) { return p.x; }).sort(function (a, b) { return a - b; });
            if (rest.length >= 3) { var med = rest[Math.floor(rest.length / 2)]; if (o.x < med * 0.5) out[o.i] = "Kişinin diğer sürelerinin yarısından hızlı (ortanca " + fmt(med) + ")"; }
        });
        return out;
    }
    /* --- Rekorlar ve yarışmalar (herkese açık okuma, 5 dk bellekte) --- */
    var memo = {};
    function cfg() { return window.RA_FIREBASE || {}; }
    function runQuery(q) {
        var c = cfg(); if (!c.apiKey) return Promise.resolve([]);
        var base = ((c.emulator && c.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + c.projectId + "/databases/(default)/documents:runQuery?key=" + encodeURIComponent(c.apiKey);
        return fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: q }) })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (a) { return (a || []).filter(function (x) { return x.document; }).map(function (x) { return x.document; }); });
    }
    function cached(key, fn) {
        var m = memo[key]; if (m && Date.now() - m.t < 300000) return m.p;
        var p = fn().catch(function () { delete memo[key]; return []; }); memo[key] = { t: Date.now(), p: p }; return p;
    }
    function fv(f, k) { var x = f[k]; return x == null ? null : x.integerValue != null ? +x.integerValue : x.stringValue != null ? x.stringValue : x.timestampValue != null ? x.timestampValue : null; }
    // Rekor tablosu: kind "s" (tekil), "a5", "a12"; ev "333" | "222"
    function records(ev, kind, n) {
        var f = kind === "s" ? "s" + ev : kind + "_" + ev;
        return cached("rec:" + f + ":" + (n || 10), function () {
            return runQuery({ from: [{ collectionId: "records" }], where: { fieldFilter: { field: { fieldPath: f }, op: "GREATER_THAN", value: { integerValue: "0" } } }, orderBy: [{ field: { fieldPath: f }, direction: "ASCENDING" }], limit: n || 10 })
                .then(function (docs) { return docs.map(function (d) { var x = d.fields || {}; return { uid: d.name.split("/").pop(), name: fv(x, "name") || "Cuber", t: fv(x, f), n: fv(x, "n") || 0, w: fv(x, "w") || 0 }; }); });
        });
    }
    // Son güncellenen yarışmalar: canlı olanlar ve finali bitenlerin şampiyonları
    function comps() {
        return cached("comps", function () {
            return runQuery({ from: [{ collectionId: "comps" }], orderBy: [{ field: { fieldPath: "ts" }, direction: "DESCENDING" }], limit: 40 }).then(function (docs) {
                return docs.map(function (d) { var x = d.fields || {}, o = {}; Object.keys(x).forEach(function (k) { o[k] = fv(x, k); }); o.code = d.name.split("/").pop(); o.up = Date.parse(d.updateTime) || 0; return o; });
            });
        });
    }
    function liveComps() { var now = Date.now(); return comps().then(function (l) { return l.filter(function (o) { return o.st && o.st !== "lobby" && !(o.st === "end" && o.fin) && now - o.up < 6 * 3600000; }); }); }
    function champions(n) {
        return comps().then(function (l) {
            return l.filter(function (o) { return o.fin && o.st === "end"; }).map(function (o) {
                var R = []; try { R = JSON.parse(o.R || "[]"); } catch (e) {}
                var fin = R.filter(function (r) { return r.f; }).pop() || R[R.length - 1]; if (!fin || !fin.rows || !fin.rows.length) return null;
                return { code: o.code, comp: o.name, ev: o.ev, name: fin.rows[0].n, uid: fin.rows[0].u, a: fin.rows[0].a, n: rS(fin), ts: o.up, rows: fin.rows.length };
            }).filter(Boolean).slice(0, n || 6);
        });
    }
    window.RACompShare = { records: records, comps: comps, liveComps: liveComps, champions: champions, suspect: suspect, image: shareImageR, save: save, downloadCert: downloadCert, text: shareTextR, cert: certImage, certInfo: certInfo, fmt: fmt };
})();
