/* =========================================================
   REKLAM / SPONSOR BANNER'I (ad-banner.js) — common.js her sayfada yükler
   İçerik admin panelinden yönetilir (Firestore config/ad, herkes okur, admin yazar):
     on, title, text, cta, url, img, code, where ("all" | "home" | "cekilis"), ver
   - 30 dk tarayıcıda saklanır (her sayfa açılışında veritabanı okunmaz)
   - "Sponsor" etiketi; kapatılırsa o cihazda 1 gün görünmez (içerik değişince yeniden görünür)
   - Zamanlayıcı / antrenör / yarışma odası / giriş / admin sayfalarında görünmez
========================================================= */
(function () {
    if (window.RAAd) return;
    // Admin panelinden hiç ayar kaydedilmediyse gösterilen varsayılan sponsor
    var DEFAULT = { on: true, title: "Minjuan Küp Mağazası", text: "Tasarım ve zeka küpleri, speedcube'ler ve aksesuarlar Minjuan'da. Rubik Academy önerisi!", cta: "Küplere göz at", url: "https://minjuanrong.com.tr/collections/tasarim-zeka-kupleri", img: "/img/sponsor/minjuan-mark.png", code: "", where: "all", ver: "d3" };
    var KEY = "ra-ad-cache-v3", HIDE = "ra-ad-hide", TTL = 30 * 60000;
    var SKIP = /\/(admin|giris|zkttimer|gizlilik|yakinda)(\.html)?$|\/algoritmalar\/(antrenor|yazdir)|\/akilli-kup|\/sanal-kup|\/tekrar/;
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function safeUrl(u) { u = String(u || "").trim(); return /^https:\/\/[^\s"'<>]+$/.test(u) || /^\/img\/[\w\/.-]+$/.test(u) ? u : ""; }
    function withUtm(u) { if (!u) return ""; try { var x = new URL(u); if (!x.searchParams.has("utm_source")) { x.searchParams.set("utm_source", "rubikacademy"); x.searchParams.set("utm_medium", "banner"); } return x.toString(); } catch (e) { return u; } }
    function load() {
        var c = null; try { c = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
        if (c && Date.now() - c.at < TTL) return Promise.resolve(c.ad);
        var cfg = window.RA_FIREBASE; if (!cfg || !cfg.apiKey) return Promise.resolve(null);
        var url = ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents/config/ad?key=" + encodeURIComponent(cfg.apiKey);
        return fetch(url).then(function (r) { return r.ok ? r.json() : r.status === 404 ? { def: 1 } : null; }).then(function (d) {
            if (d && d.def) { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), ad: DEFAULT })); } catch (e) {} return DEFAULT; }
            var f = (d && d.fields) || {}, g = function (k) { return f[k] ? (f[k].stringValue != null ? f[k].stringValue : f[k].booleanValue != null ? f[k].booleanValue : f[k].integerValue) : ""; };
            var ad = d ? { on: !!g("on"), title: g("title"), text: g("text"), cta: g("cta"), url: g("url"), img: g("img"), code: g("code"), where: g("where") || "all", ver: String(g("ver") || "") } : null;
            try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), ad: ad })); } catch (e) {}
            return ad;
        }).catch(function () { return null; });
    }
    function fits(ad) {
        var p = location.pathname.replace(/\/index(\.html)?$/, "/");
        if (SKIP.test(p)) return false;
        if (ad.where === "home") return p === "/" || /^\/icerikler(\.html)?$/.test(p);
        if (ad.where === "cekilis") return /\/cekilis/.test(p);
        return true;
    }
    function anchor() {
        var a = document.querySelector(".h-hero, .page > .intro, section.intro, .hero, .page-hero");
        if (a) return { el: a, after: true };
        var nb = document.querySelector(".page > .nav-bar"); if (nb) return { el: nb, after: true };
        return null;
    }
    var css = ".ra-ad{position:relative;box-sizing:border-box;width:calc(100% - 32px);max-width:1100px;margin:18px auto 26px;display:flex;align-items:center;gap:16px;padding:14px 46px 14px 14px;border-radius:20px;background:linear-gradient(var(--surface),var(--surface)) padding-box,linear-gradient(120deg,#f97316,#ec4899,#6c5ce7) border-box;border:2px solid transparent;box-shadow:var(--shadow-sm,0 6px 20px rgba(0,0,0,.12));color:var(--text);text-align:start}" +
        ".ra-ad-img{flex:none;width:92px;height:92px;border-radius:14px;object-fit:cover;background:#fff;border:1px solid var(--border);box-sizing:border-box}" +
        ".ra-ad-ph{flex:none;width:92px;height:92px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:44px;background:linear-gradient(135deg,rgba(249,115,22,.18),rgba(108,92,231,.2))}" +
        ".ra-ad-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}" +
        ".ra-ad-tag{align-self:flex-start;font:900 10.5px Inter,sans-serif;letter-spacing:.8px;padding:2px 8px;border-radius:99px;background:rgba(249,115,22,.14);color:#ea580c}" +
        ".ra-ad-t{font:900 18px Inter,sans-serif;line-height:1.2}" +
        ".ra-ad-p{font-size:14px;line-height:1.45;color:var(--text-soft);font-weight:600}" +
        ".ra-ad-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px}" +
        ".ra-ad-cta{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:12px;background:linear-gradient(120deg,#f97316,#ec4899);color:#fff!important;font:900 14px Inter,sans-serif;text-decoration:none;box-shadow:0 6px 16px rgba(236,72,153,.3)}" +
        ".ra-ad-cta:hover{filter:brightness(1.06)}" +
        ".ra-ad-code{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:12px;border:2px dashed rgba(249,115,22,.6);background:transparent;color:var(--text);font:800 13px Inter,sans-serif;cursor:pointer}" +
        ".ra-ad-code b{font-family:'JetBrains Mono',monospace;letter-spacing:.5px}" +
        ".ra-ad-x{position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:10px;border:0;background:var(--surface-soft);color:var(--text-soft);cursor:pointer;font-size:14px}" +
        "@media(max-width:560px){.ra-ad{gap:12px;padding:12px 40px 12px 12px}.ra-ad-img,.ra-ad-ph{width:64px;height:64px;font-size:32px}.ra-ad-t{font-size:16px}.ra-ad-p{font-size:13px}}" +
        "@media print{.ra-ad{display:none}}";
    function html(ad, preview) {
        var url = withUtm(safeUrl(ad.url)), img = safeUrl(ad.img);
        return (img ? '<img class="ra-ad-img" src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<div class="ra-ad-ph">🧊</div>') +
            '<div class="ra-ad-b"><span class="ra-ad-tag">SPONSOR</span><div class="ra-ad-t">' + esc(ad.title || "Minjuan Küp") + '</div>' +
            (ad.text ? '<div class="ra-ad-p">' + esc(ad.text) + '</div>' : '') +
            '<div class="ra-ad-row">' + (url ? '<a class="ra-ad-cta" href="' + esc(url) + '" target="_blank" rel="sponsored noopener">' + esc(ad.cta || "Mağazaya git") + ' →</a>' : '') +
            (ad.code ? '<button type="button" class="ra-ad-code" title="Kodu kopyala">🎟 Kod: <b>' + esc(ad.code) + '</b></button>' : '') + '</div></div>' +
            (preview ? '' : '<button type="button" class="ra-ad-x" aria-label="Reklamı kapat" title="Kapat">✕</button>');
    }
    function bind(el, ad) {
        var c = el.querySelector(".ra-ad-code");
        if (c) c.onclick = function () {
            var b = this, done = function () { b.innerHTML = "✓ Kopyalandı: <b>" + esc(ad.code) + "</b>"; };
            try { navigator.clipboard.writeText(ad.code).then(done, done); } catch (e) { done(); }
        };
        var x = el.querySelector(".ra-ad-x");
        if (x) x.onclick = function () { try { localStorage.setItem(HIDE, JSON.stringify({ until: Date.now() + 86400000, ver: ad.ver })); } catch (e) {} el.remove(); };
    }
    function styles() { if (document.getElementById("raAdCss")) return; var s = document.createElement("style"); s.id = "raAdCss"; s.textContent = css; (document.head || document.documentElement).appendChild(s); }
    function show() {
        load().then(function (ad) {
            if (!ad || !ad.on || !(ad.title || ad.text) || !fits(ad) || document.getElementById("raAd")) return;
            try { var h = JSON.parse(localStorage.getItem(HIDE) || "null"); if (h && h.until > Date.now() && h.ver === ad.ver) return; } catch (e) {}
            var a = anchor(); if (!a) return;
            styles();
            var el = document.createElement("aside"); el.id = "raAd"; el.className = "ra-ad"; el.setAttribute("aria-label", "Sponsor");
            el.innerHTML = html(ad); bind(el, ad);
            a.el.parentNode.insertBefore(el, a.after ? a.el.nextSibling : a.el);
        });
    }
    // admin paneli önizlemesi için
    window.RAAd = { preview: function (box, ad) { styles(); box.innerHTML = '<aside class="ra-ad" style="margin:10px 0;width:100%">' + html(ad, true) + '</aside>'; bind(box.firstChild, ad); }, clearCache: function () { try { localStorage.removeItem(KEY); localStorage.removeItem(HIDE); } catch (e) {} } };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else show();
})();
