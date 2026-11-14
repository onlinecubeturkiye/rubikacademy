/* =========================================================
   ÖZEL PAKETLER (packs.js) — common.js her sayfada yükler
   Yönetici paket oluşturur (packs/{id}) ve hesaplara atar (grants/{uid}.p = [paket id'leri]).
   Paket yalnız atandığı kişiye görünür (firestore.rules):
   - kind "theme": özel tema → Ayarlar > Tema stili listesine "p-<id>" olarak eklenir
       data = { bg, surface, text, accent }
   - kind "alg": özel algoritma seti → profilde "Özel paketlerim" altında
       data = { algs: [{ n: ad, a: algoritma, note }] }
   Cihazda önbellek: ra-packs-v1 (temanın sayfa açılışında hemen uygulanması için)
========================================================= */
(function () {
    if (window.RAPacks) return;
    var KEY = "ra-packs-v1";
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function cache() { try { var a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function hex(c, d) { return /^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : d; }
    function lum(h) { var n = parseInt(h.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000; }
    function themeCss(p) {
        var t = p.data || {}, bg = hex(t.bg, "#f4f4f2"), sf = hex(t.surface, "#ffffff"), tx = hex(t.text, "#111111"), ac = hex(t.accent, "#111111");
        var at = lum(ac) > 150 ? "#111111" : "#ffffff", sel = 'html[data-skin="p-' + p.id + '"]';
        var v = "--background:" + bg + ";--surface:" + sf + ";--surface-soft:color-mix(in srgb," + sf + " 86%," + tx + ");--text:" + tx +
            ";--text-soft:color-mix(in srgb," + tx + " 62%," + bg + ");--border:color-mix(in srgb," + tx + " 14%," + sf + ");--card-border:color-mix(in srgb," + tx + " 14%," + sf + ")" +
            ";--ui-accent:" + ac + ";--ui-accent-hover:" + ac + ";--ui-accent-text:" + at + ";--ui-accent-soft:color-mix(in srgb," + ac + " 16%," + sf + ")" +
            ";--primary:" + ac + ";--primary-dark:" + ac + ";--primary-light:color-mix(in srgb," + ac + " 16%," + sf + ")" +
            ";--btn-bg:" + ac + ";--btn-hover-bg:" + ac + ";--btn-text:" + at + ";--hero-bg:" + sf + ";--hero-border:color-mix(in srgb," + tx + " 14%," + sf + ");--badge-bg:color-mix(in srgb," + ac + " 16%," + sf + ");--badge-text:" + tx + ";--bottom-bg:" + sf + ";";
        return sel + "," + sel + " body{" + v + "}" + sel + "," + sel + " body{background:" + bg + "!important;background-image:none!important}";
    }
    function apply(list) {
        var themes = list.filter(function (p) { return p.kind === "theme"; });
        var st = document.getElementById("raPackCss");
        if (!st) { st = document.createElement("style"); st.id = "raPackCss"; (document.head || document.documentElement).appendChild(st); }
        st.textContent = themes.map(themeCss).join("");
        try { localStorage.setItem("ra-pack-css", st.textContent); } catch (e) {}
        // Ayarlar > Tema stili listesine ekle
        if (window.RA_SKINS) {
            for (var i = RA_SKINS.length - 1; i >= 0; i--) if (String(RA_SKINS[i][0]).indexOf("p-") === 0) RA_SKINS.splice(i, 1);
            themes.forEach(function (p) { var t = p.data || {}; RA_SKINS.push(["p-" + p.id, [hex(t.bg, "#f4f4f2"), hex(t.accent, "#111111"), hex(t.surface, "#ffffff"), hex(t.text, "#111111")]]); });
        }
        window.RA_SKIN_LABEL = window.RA_SKIN_LABEL || {};
        themes.forEach(function (p) { RA_SKIN_LABEL["p-" + p.id] = "🎁 " + p.name; });
        // açık Ayarlar listesini yenile
        if (window.raRenderSettings) { var sr = document.getElementById("setRoot"); if (sr) raRenderSettings(sr); if (document.getElementById("raSetMenu")) raRenderSettings(); }
        // seçili özel tema artık atanmış değilse sade temaya dön
        var sk = ""; try { sk = localStorage.getItem("site-skin") || ""; } catch (e) {}
        if (sk.indexOf("p-") === 0 && !themes.some(function (p) { return "p-" + p.id === sk; }) && window.raSetSkin) {
            try { localStorage.setItem("site-skin", "standart"); } catch (e) {}
            if (window.raApplySkin) raApplySkin("standart");
        }
    }
    apply(cache());

    var cfg = window.RA_FIREBASE || {};
    function base() { return ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents"; }
    function val(x) {
        if (!x) return null;
        if (x.arrayValue) return (x.arrayValue.values || []).map(val);
        return x.stringValue != null ? x.stringValue : x.integerValue != null ? +x.integerValue : x.booleanValue != null ? x.booleanValue : x.timestampValue || null;
    }
    var busy = false;
    function sync(u) {
        if (!u) { if (cache().length) { try { localStorage.removeItem(KEY); } catch (e) {} apply([]); render(); } return; }
        if (busy || !window.Account || !Account.token) return; busy = true;
        Account.token().then(function (tok) {
            var H = { headers: { Authorization: "Bearer " + tok } };
            return fetch(base() + "/grants/" + u.uid, H).then(function (r) { return r.status === 404 ? null : r.ok ? r.json() : Promise.reject(r.status); }).then(function (g) {
                var ids = ((g && g.fields && val(g.fields.p)) || []).filter(Boolean).slice(0, 40);
                return Promise.all(ids.map(function (id) {
                    return fetch(base() + "/packs/" + encodeURIComponent(id), H).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                        if (!d || !d.fields) return null;
                        var f = d.fields, data = {}; try { data = JSON.parse(val(f.data) || "{}") || {}; } catch (e) {}
                        return { id: id, name: String(val(f.name) || "Paket").slice(0, 40), kind: val(f.kind) === "alg" ? "alg" : "theme", desc: String(val(f.desc) || ""), data: data };
                    }, function () { return null; });
                }));
            });
        }).then(function (list) {
            list = (list || []).filter(Boolean);
            try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
            apply(list); render();
            try { document.dispatchEvent(new CustomEvent("ra-packs")); } catch (e) {}
        }).catch(function () {}).then(function () { busy = false; });
    }
    function useTheme(id) { if (window.raSetSkin) raSetSkin("p-" + id); else { try { localStorage.setItem("site-skin", "p-" + id); } catch (e) {} if (window.raApplySkin) raApplySkin("p-" + id); } render(); }

    // Profil: "Özel paketlerim" (yalnız kendi profilinde, <div id="raPacks"> varsa)
    var css = ".rp-box{margin-top:16px}.rp-box h2{font-size:19px;font-weight:850;margin:0 0 4px}.rp-box>p{margin:0 0 12px;color:var(--text-soft);font-size:13.5px}" +
        ".rp-p{border:1px solid var(--border);border-radius:14px;background:var(--surface);margin-bottom:8px;overflow:hidden}" +
        ".rp-h{display:flex;align-items:center;gap:10px;padding:12px 14px}.rp-h b{flex:1;min-width:0;font-weight:850}.rp-h small{display:block;font-weight:600;color:var(--text-soft);font-size:12.5px}" +
        ".rp-sw{display:flex;gap:3px}.rp-sw i{width:14px;height:14px;border-radius:4px;border:1px solid var(--border)}" +
        ".rp-btn{font:800 13px Inter,sans-serif;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer}.rp-btn.on{background:var(--btn-bg,var(--text));color:var(--btn-text,var(--surface));border-color:transparent}" +
        ".rp-algs{border-top:1px solid var(--border);padding:6px 14px 10px}.rp-a{padding:8px 0;border-bottom:1px dashed var(--border)}.rp-a:last-child{border-bottom:0}" +
        ".rp-a b{display:block;font-size:13.5px}.rp-a code{display:block;font:700 14px 'JetBrains Mono',monospace;margin-top:3px;word-break:break-word}.rp-a small{color:var(--text-soft);font-size:12.5px}";
    function render() {
        var el = document.getElementById("raPacks"); if (!el) return;
        if (!document.getElementById("raPackUiCss")) { var s = document.createElement("style"); s.id = "raPackUiCss"; s.textContent = css; document.head.appendChild(s); }
        var list = cache(); if (!list.length) { el.innerHTML = ""; return; }
        var sk = ""; try { sk = localStorage.getItem("site-skin") || ""; } catch (e) {}
        el.innerHTML = '<div class="box rp-box"><h2>🎁 Özel paketlerim</h2><p>Sana özel atanmış temalar ve algoritmalar.</p>' + list.map(function (p) {
            if (p.kind === "theme") {
                var t = p.data || {}, on = sk === "p-" + p.id;
                return '<div class="rp-p"><div class="rp-h"><span class="rp-sw">' + [t.bg, t.surface, t.accent, t.text].map(function (c) { return '<i style="background:' + esc(hex(c, "#ccc")) + '"></i>'; }).join("") + '</span><b>' + esc(p.name) + '<small>Tema' + (p.desc ? " · " + esc(p.desc) : "") + '</small></b>' +
                    '<button type="button" class="rp-btn' + (on ? " on" : "") + '" data-rp-theme="' + esc(p.id) + '">' + (on ? "✓ Kullanılıyor" : "Uygula") + '</button></div></div>';
            }
            var algs = (p.data && p.data.algs) || [];
            return '<details class="rp-p"><summary class="rp-h"><b>' + esc(p.name) + '<small>' + algs.length + ' algoritma' + (p.desc ? " · " + esc(p.desc) : "") + '</small></b><span class="rp-btn">Aç</span></summary><div class="rp-algs">' +
                (algs.length ? algs.map(function (a) { return '<div class="rp-a"><b>' + esc(a.n || "") + '</b><code dir="ltr">' + esc(a.a || "") + '</code>' + (a.note ? '<small>' + esc(a.note) + '</small>' : '') + '</div>'; }).join("") : '<p class="rp-a">Boş paket.</p>') + '</div></details>';
        }).join("") + '</div>';
        Array.prototype.forEach.call(el.querySelectorAll("[data-rp-theme]"), function (b) { b.onclick = function () { useTheme(b.getAttribute("data-rp-theme")); }; });
    }
    window.RAPacks = { apply: apply, list: cache, sync: function () { if (window.Account && Account.user) sync(Account.user()); }, render: render };
    function hook() {
        if (!window.Account || !Account.onChange) { setTimeout(hook, 500); return; }
        Account.onChange(function (u) { sync(u); });
    }
    hook();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render); else render();
})();
