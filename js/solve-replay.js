/* =========================================================
   ÇÖZÜM TEKRARI (solve-replay.js)
   Akıllı küple yapılmış bir çözümü (karıştırma + aşama aşama hamleler) 3B küpte oynatır.
   - SolveReplay.open(r): pencerede oynat (Çözüm Analizi)
   - SolveReplay.link(r): paylaşılabilir bağlantı (/icerikler/tekrar#d=...)
   - SolveReplay.decode(hash) / mount(el, r): tekrar sayfası için
   r = { t, scr, face, segs: [{ n, t, k, mv }] } (Çözüm Analizi geçmiş kaydı)
========================================================= */
(function () {
    var V = "20261207";
    var NAMES = ["Cross", "F2L 1", "F2L 2", "F2L 3", "F2L 4", "OLL", "PLL"];
    var lib = null;
    function loadLib() {
        if (!lib) lib = import("/js/vendor/cubing/twisty.js?v=" + V).catch(function (e) { lib = null; throw e; });
        return lib;
    }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function fmt(ms) { if (ms == null) return "-"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function ok(r) { return !!(r && r.scr && r.segs && r.segs.length && r.segs.some(function (s) { return s.mv; })); }
    // Aşamalar yorum satırı olarak: oynatıcıda hangi aşamada olunduğu görünür
    function algOf(r) { return r.segs.filter(function (s) { return s.mv; }).map(function (s) { return s.mv + " // " + s.n; }).join("\n"); }
    function moveCount(r) { return r.segs.reduce(function (a, s) { return a + (s.k || 0); }, 0); }
    function tps(r) { var n = moveCount(r); return r.t ? n / (r.t / 1000) : 0; }

    function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
    function b64d(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }
    function link(r) {
        var d = { s: r.scr, t: Math.round(r.t), f: r.face || "", g: r.segs.map(function (s) { return [Math.round(s.t), s.mv || ""]; }) };
        return location.origin + "/icerikler/tekrar#d=" + b64e(JSON.stringify(d));
    }
    function decode(hash) {
        var m = /[#&]d=([^&]+)/.exec(hash || ""); if (!m) return null;
        try {
            var d = JSON.parse(b64d(m[1]));
            if (!d || typeof d.s !== "string" || !Array.isArray(d.g)) return null;
            var clean = function (x) { return String(x || "").replace(/[^URFDLBMESxyzw2' ]/g, "").slice(0, 600); };
            return { scr: clean(d.s), t: +d.t || 0, face: String(d.f || "").slice(0, 1), segs: d.g.slice(0, 7).map(function (x, i) {
                var mv = clean(x[1]); return { n: NAMES[i] || "", t: +x[0] || 0, mv: mv, k: mv ? mv.split(" ").filter(Boolean).length : 0 };
            }) };
        } catch (e) { return null; }
    }

    // Bir kabın içine oynatıcı + özet koy
    function mount(el, r) {
        var n = moveCount(r), sp = tps(r);
        el.innerHTML = '<div class="sr-sum"><div><b>' + fmt(r.t) + '</b><span>Süre</span></div><div><b>' + n + '</b><span>Hamle</span></div><div><b>' + (sp ? sp.toFixed(2) : "-") + '</b><span>TPS</span></div></div>' +
            '<div class="sr-stage"><p class="sr-msg">Yükleniyor…</p></div>' +
            '<div class="sr-scr"><b>Karıştırma</b> <code dir="ltr">' + esc(r.scr) + '</code></div>' +
            '<div class="sr-segs">' + r.segs.filter(function (s) { return s.mv; }).map(function (s) {
                return '<div><b>' + esc(s.n) + '</b><span>' + fmt(s.t) + ' · ' + s.k + ' hamle</span><code dir="ltr">' + esc(s.mv) + '</code></div>';
            }).join("") + '</div>';
        return loadLib().then(function (m) {
            var p = new m.TwistyPlayer({
                puzzle: "3x3x3", background: "none", controlPanel: "bottom-row", hintFacelets: "none",
                experimentalSetupAlg: r.scr, alg: algOf(r),
                // gerçek hıza yakın: ~2 TPS'de normal tempo
                tempoScale: Math.max(0.6, Math.min(4, (sp || 2) / 2))
            });
            p.className = "sr-player";
            var st = el.querySelector(".sr-stage"); st.innerHTML = ""; st.appendChild(p);
            setTimeout(function () { try { p.play(); } catch (e) {} }, 400);
            return p;
        }).catch(function () { var msg = el.querySelector(".sr-msg"); if (msg) msg.textContent = "Oynatıcı yüklenemedi."; });
    }

    var css = document.createElement("style");
    css.textContent =
        ".sr-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}" +
        ".sr-sum div{border:1px solid var(--border);border-radius:12px;background:var(--surface-soft);padding:8px;text-align:center}" +
        ".sr-sum b{display:block;font:900 20px 'JetBrains Mono',monospace;color:var(--text)}" +
        ".sr-sum span{font-size:12px;font-weight:700;color:var(--text-soft)}" +
        ".sr-stage{display:flex;justify-content:center;align-items:center;min-height:260px}" +
        ".sr-player{width:100%;max-width:420px;height:300px}" +
        ".sr-msg{color:var(--text-soft);font-weight:700}" +
        ".sr-scr{margin:10px 0;font-size:13px;color:var(--text-soft);word-break:break-word}" +
        ".sr-scr code,.sr-segs code{font:600 12.5px 'JetBrains Mono',monospace;color:var(--text)}" +
        ".sr-segs{display:grid;gap:6px}" +
        ".sr-segs div{border:1px solid var(--border);border-radius:10px;padding:7px 10px;background:var(--surface-soft);text-align:left}" +
        ".sr-segs b{font-weight:850;margin-right:8px;color:var(--text)}" +
        ".sr-segs span{font-size:12px;font-weight:700;color:var(--text-soft)}" +
        ".sr-segs code{display:block;margin-top:3px;word-break:break-word}" +
        ".sr-modal{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(10,12,18,.6)}" +
        ".sr-modal.open{display:flex}" +
        ".sr-box{position:relative;width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;padding:18px;border-radius:20px;background:var(--surface);color:var(--text);border:var(--card-bw,2px) solid var(--card-border);box-shadow:var(--shadow-hover)}" +
        ".sr-box h3{margin:0 40px 12px 0;font:900 19px Inter,sans-serif}" +
        ".sr-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:10px;border:1px solid var(--border);background:var(--surface-soft);color:var(--text);cursor:pointer}" +
        ".sr-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}" +
        ".sr-acts button{border:0;background:var(--ui-accent);color:var(--ui-accent-text);font:800 13.5px Inter,sans-serif;padding:9px 14px;border-radius:12px;cursor:pointer}";
    (document.head || document.documentElement).appendChild(css);

    function share(r, btn) {
        var url = link(r), done = function () { if (btn) { var t0 = btn.textContent; btn.textContent = "Bağlantı kopyalandı ✓"; setTimeout(function () { btn.textContent = t0; }, 1800); } };
        if (navigator.share) { navigator.share({ title: "Çözümüm · " + fmt(r.t), url: url }).catch(function () {}); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt("Bağlantı:", url); });
        else prompt("Bağlantı:", url);
    }
    var modal = null, player = null;
    function open(r) {
        if (!ok(r)) return;
        if (!modal) {
            modal = document.createElement("div"); modal.className = "sr-modal"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
            modal.innerHTML = '<div class="sr-box"><button type="button" class="sr-x" aria-label="Kapat">✕</button><h3>▶ Çözüm tekrarı</h3><div class="sr-body"></div><div class="sr-acts"><button type="button" class="sr-share">🔗 Paylaş</button></div></div>';
            modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest(".sr-x")) { modal.classList.remove("open"); if (player) try { player.pause(); } catch (x) {} } });
            document.body.appendChild(modal);
        }
        modal.classList.add("open");
        modal.querySelector(".sr-share").onclick = function () { share(r, this); };
        mount(modal.querySelector(".sr-body"), r).then(function (p) { player = p; });
    }
    window.SolveReplay = { ok: ok, open: open, link: link, share: share, decode: decode, mount: mount, fmt: fmt };
})();
