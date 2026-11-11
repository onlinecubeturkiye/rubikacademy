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
    window.RACompShare = { image: shareImageR, text: shareTextR, fmt: fmt };
})();
