/* =========================================================
   EV YARIŞMASI & REKORLAR VİTRİNİ (ev-hub.js)
   <div id="raEvHub" data-mode="full|compact"></div> olan her sayfada çizilir
   (ana sayfa, İçerikler, Rekorlar, Ev yarışması lobisi). Veri: js/comp-share.js
   - Şu an canlı yarışmalar (izle / katıl)
   - Rekor sahipleri: 3x3 ve 2x2 en iyi tekil ve Ao5
   - Son şampiyonlar (final birincileri)
========================================================= */
(function () {
    var el = document.getElementById("raEvHub");
    if (!el || !window.RACompShare) return;
    var mode = el.getAttribute("data-mode") || "full";
    var S = RACompShare, fmt = S.fmt;
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function ago(t) {
        var m = Math.max(1, Math.round((Date.now() - t) / 60000));
        return m < 60 ? m + " dk önce" : m < 1440 ? Math.round(m / 60) + " sa önce" : Math.round(m / 1440) + " gün önce";
    }
    var css = ".evh{border-radius:24px;padding:22px;background:linear-gradient(135deg,rgba(255,138,31,.16),rgba(232,67,147,.12) 55%,rgba(108,92,231,.14));border:2px solid rgba(255,138,31,.35);color:var(--text)}" +
        ".evh-top{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin-bottom:16px}" +
        ".evh-top h2{margin:0;font-size:clamp(22px,3.4vw,30px);font-weight:900;letter-spacing:-.5px;flex:1 1 260px}" +
        ".evh-top h2 small{display:block;font-size:14px;font-weight:700;color:var(--text-soft);letter-spacing:0;margin-top:2px}" +
        ".evh-cta{display:flex;flex-wrap:wrap;gap:8px}" +
        ".evh-btn{display:inline-flex;align-items:center;gap:6px;padding:11px 16px;border-radius:14px;font-weight:900;font-size:14.5px;text-decoration:none;border:2px solid var(--card-border,var(--border));background:var(--surface);color:var(--text)}" +
        ".evh-btn.p{background:linear-gradient(120deg,#ff8a1f,#e84393);border-color:transparent;color:#fff}" +
        ".evh-live{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}" +
        ".evh-live a{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:var(--surface);border:1px solid var(--border);color:var(--text);text-decoration:none;font-weight:800;font-size:13.5px}" +
        ".evh-live a::before{content:'';width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.25)}" +
        ".evh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}" +
        ".evh-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:14px 14px 10px;min-width:0}" +
        ".evh-card h3{margin:0 0 8px;font-size:13px;font-weight:900;letter-spacing:.6px;color:var(--text-soft);text-transform:uppercase}" +
        ".evh-rec{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 0;border-top:1px dashed var(--border);color:var(--text);text-decoration:none}" +
        ".evh-rec:first-of-type{border-top:0}" +
        ".evh-rec .k{font-size:11.5px;font-weight:900;padding:3px 7px;border-radius:8px;background:rgba(255,138,31,.15);color:#ea580c;white-space:nowrap}" +
        ".evh-rec .n{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
        ".evh-rec .n small{display:block;font-size:11.5px;color:var(--text-soft);font-weight:700}" +
        ".evh-rec .t{font:800 16px 'JetBrains Mono',monospace}" +
        ".evh-empty{font-size:13.5px;color:var(--text-soft);font-weight:700;padding:6px 0}" +
        ".evh.compact .evh-grid{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}";
    if (!document.getElementById("raEvHubCss")) { var st = document.createElement("style"); st.id = "raEvHubCss"; st.textContent = css; document.head.appendChild(st); }

    function recRow(label, r, ev) {
        if (!r) return '<div class="evh-rec"><span class="k">' + label + '</span><span class="n" style="color:var(--text-soft)">Henüz yok</span><span></span></div>';
        return '<a class="evh-rec" href="/icerikler/profil?u=' + encodeURIComponent(r.uid) + '"><span class="k">' + label + '</span><span class="n">' + esc(r.name) + '<small>' + (r.w ? "🏆 " + r.w + " şampiyonluk" : r.n + " tur") + '</small></span><span class="t" dir="ltr">' + fmt(r.t) + '</span></a>';
    }
    function draw(d) {
        var live = d.live || [], ch = d.champs || [];
        var liveHtml = live.length ? '<div class="evh-live">' + live.slice(0, 4).map(function (o) {
            return '<a href="/icerikler/ev-yarismasi?ev=' + encodeURIComponent(o.code) + '">' + esc(o.name || "Ev yarışması") + ' · ' + (o.st === "prep" ? "hazırlık" : o.fin ? "final" : "tur " + (o.round || 1)) + '</a>';
        }).join("") + '</div>' : "";
        var recs = '<div class="evh-card"><h3>🥇 Rekorlar · 3x3</h3>' + recRow("Tekil", d.s333[0]) + recRow("Ao5", d.a5_333[0]) + '</div>' +
            '<div class="evh-card"><h3>🥇 Rekorlar · 2x2</h3>' + recRow("Tekil", d.s222[0]) + recRow("Ao5", d.a5_222[0]) + '</div>';
        var champs = '<div class="evh-card"><h3>🏆 Son şampiyonlar</h3>' + (ch.length ? ch.slice(0, mode === "compact" ? 3 : 4).map(function (c) {
            return '<a class="evh-rec" href="' + (c.uid ? "/icerikler/profil?u=" + encodeURIComponent(c.uid) : "#") + '"><span class="k">' + (c.ev === "222" ? "2x2" : "3x3") + '</span><span class="n">' + esc(c.name) + '<small>' + esc(c.comp || "") + ' · ' + ago(c.ts) + '</small></span><span class="t" dir="ltr">' + fmt(c.a) + '</span></a>';
        }).join("") : '<div class="evh-empty">İlk şampiyon sen ol!</div>') + '</div>';
        el.innerHTML = '<div class="evh ' + mode + '"><div class="evh-top"><h2>🏠 Ev Yarışması & Rekorlar<small>' +
            (live.length ? "🔴 Şu an " + live.length + " yarışma canlı" : "Evden canlı küp yarışması: aynı karıştırma, canlı sıralama, final ve sertifika") + '</small></h2>' +
            '<div class="evh-cta"><a class="evh-btn p" href="/icerikler/ev-yarismasi">' + (live.length ? "▶ Canlı yarışmaya katıl" : "🏠 Yarışmaya katıl") + '</a><a class="evh-btn" href="/icerikler/rekorlar">🥇 Rekor tablosu</a></div></div>' +
            liveHtml + '<div class="evh-grid">' + recs + champs + '</div></div>';
    }
    var pr = { s333: S.records("333", "s", 1), a5_333: S.records("333", "a5", 1), s222: S.records("222", "s", 1), a5_222: S.records("222", "a5", 1), live: S.liveComps(), champs: S.champions(4) };
    var keys = Object.keys(pr);
    Promise.all(keys.map(function (k) { return pr[k].catch(function () { return []; }); })).then(function (v) {
        var d = {}; keys.forEach(function (k, i) { d[k] = v[i] || []; }); draw(d);
    });
})();
