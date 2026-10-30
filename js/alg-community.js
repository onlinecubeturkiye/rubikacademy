/* =========================================================
   TOPLULUK ALGORİTMALARI (alg-community.js)
   Algoritma sayfalarındaki her case kartına "💬 Öneriler" ekler.
   - Firestore: algsug/{caseId}/s/{uid} = { a, u, n, ts, vs: {uid: 1} }
     Her üye bir case'e tek öneri verir (belge kimliği = uid), sonra güncelleyebilir/silebilir.
     Oy: vs haritasına kendi uid'ini ekler/çıkarır (kural yalnız kendi anahtarına izin verir).
   - Okumak herkese açık; önermek, oylamak ve "Bunu kullan" üyelere özel.
========================================================= */
(function () {
    var cfg = window.RA_FIREBASE || {};
    var wrapEl = null;
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function base() { return "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents"; }
    function user() { return window.Account && Account.user && Account.user(); }
    function scope() { return { page: window.PAGE_ID || "", set: typeof window.currentSet === "string" ? window.currentSet : "" }; }
    function caseName(card) { return String(card.getAttribute("data-case") || "").split("::").pop(); }
    // Firestore belge kimliği: güvenli karakterler dışındakiler _hex olur (eğik çizgi vb. olmasın)
    function caseId(sc, name) {
        return (sc.page + "~" + sc.set + "~" + name).replace(/[^A-Za-z0-9~-]/g, function (c) { return "_" + c.charCodeAt(0).toString(16); }).slice(0, 400);
    }
    function clean(a) { return String(a).replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim(); }
    function valid(a) { return /^[A-Za-z0-9'()\[\]+\s\-↔\/,]+$/.test(a); }
    function myName() {
        var u = user(); var p = {}; try { p = JSON.parse(localStorage.getItem("ra-profile-v1") || "{}") || {}; } catch (e) {}
        return String(p.name || (u && (u.displayName || (u.email || "").split("@")[0])) || "Cuber").slice(0, 24);
    }
    function authFetch(path, opts) {
        return Account.token().then(function (tok) {
            opts = opts || {}; opts.headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };
            return fetch(base() + path, opts);
        });
    }

    /* ---------- pencere ---------- */
    var modal = null, cur = null; // cur: { card, sc, name, id, list }
    function ensureModal() {
        if (modal) return modal;
        var css = document.createElement("style");
        css.textContent =
            ".alg-sug-btn{display:inline-flex;align-items:center;gap:4px;margin:8px 0 0 6px;padding:4px 10px;border-radius:999px;cursor:pointer;border:1.5px solid var(--border);background:var(--surface-soft);color:var(--text);font:800 12px Inter,sans-serif}" +
            ".alg-sug-btn:hover,.alg-sug-btn:focus-visible{border-color:var(--ui-accent);background:var(--ui-accent);color:var(--ui-accent-text)}" +
            ".case-card.editing .alg-sug-btn{display:none}" +
            ".sg-modal{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(10,12,18,.6)}" +
            ".sg-modal.open{display:flex}" +
            ".sg-box{position:relative;width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;padding:18px;border-radius:20px;background:var(--surface);color:var(--text);border:var(--card-bw,2px) solid var(--card-border);box-shadow:var(--shadow-hover)}" +
            ".sg-box h3{margin:0 34px 4px 0;font:900 19px Inter,sans-serif}" +
            ".sg-sub{margin:0 0 14px;font-size:13px;color:var(--text-soft)}" +
            ".sg-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:10px;border:1px solid var(--border);background:var(--surface-soft);color:var(--text);cursor:pointer;font-size:15px}" +
            ".sg-list{display:grid;gap:8px}" +
            ".sg-item{border:1px solid var(--border);border-radius:14px;padding:10px 12px;background:var(--surface-soft)}" +
            ".sg-item.mine{border-color:var(--ui-accent)}" +
            ".sg-alg{font:700 14.5px 'JetBrains Mono',monospace;line-height:1.5;word-break:break-word;color:var(--text)}" +
            ".sg-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:8px;font-size:12.5px;color:var(--text-soft);font-weight:700}" +
            ".sg-meta .sp{flex:1}" +
            ".sg-meta button{border:1px solid var(--border);background:var(--surface);color:var(--text);font:800 12.5px Inter,sans-serif;padding:5px 10px;border-radius:999px;cursor:pointer}" +
            ".sg-meta button.on{background:var(--ui-accent);color:var(--ui-accent-text);border-color:transparent}" +
            ".sg-empty{padding:14px;text-align:center;color:var(--text-soft);font-size:14px}" +
            ".sg-form{margin-top:14px;border-top:1px solid var(--border);padding-top:12px}" +
            ".sg-form textarea{width:100%;box-sizing:border-box;min-height:56px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface-soft);color:var(--text);font:600 14px 'JetBrains Mono',monospace;resize:vertical}" +
            ".sg-form .sg-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}" +
            ".sg-form button{border:0;background:var(--ui-accent);color:var(--ui-accent-text);font:800 13.5px Inter,sans-serif;padding:9px 14px;border-radius:12px;cursor:pointer}" +
            ".sg-form button.ghost{background:var(--surface-soft);color:var(--text);border:1px solid var(--border)}" +
            ".sg-err{min-height:18px;margin-top:6px;font-size:13px;font-weight:700;color:var(--text-soft)}" +
            ".sg-err.bad{color:#ef4444}" +
            ".sg-login{margin-top:14px;padding:12px;border-radius:12px;background:var(--surface-soft);font-size:14px;text-align:center;color:var(--text-soft)}" +
            ".sg-login button{margin-left:6px;border:0;background:var(--ui-accent);color:var(--ui-accent-text);font:800 13px Inter,sans-serif;padding:7px 12px;border-radius:10px;cursor:pointer}";
        document.head.appendChild(css);
        modal = document.createElement("div");
        modal.className = "sg-modal"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
        modal.innerHTML = '<div class="sg-box"><button type="button" class="sg-x" aria-label="Kapat">✕</button><div class="sg-body"></div></div>';
        modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest(".sg-x")) close(); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
        document.body.appendChild(modal);
        return modal;
    }
    function close() { if (modal) modal.classList.remove("open"); cur = null; }
    function body() { return modal.querySelector(".sg-body"); }

    function open(card) {
        ensureModal();
        var sc = scope(), name = caseName(card);
        cur = { card: card, sc: sc, name: name, id: caseId(sc, name), list: null };
        modal.classList.add("open");
        draw();
        load();
    }
    function load() {
        var c = cur; if (!c) return;
        fetch(base() + "/algsug/" + c.id + "/s?pageSize=60&key=" + encodeURIComponent(cfg.apiKey)).then(function (r) {
            if (r.status === 404) return {};
            if (!r.ok) throw new Error(r.status);
            return r.json();
        }).then(function (j) {
            if (cur !== c) return;
            c.list = (j.documents || []).map(function (d) {
                var f = d.fields || {}, vs = (f.vs && f.vs.mapValue && f.vs.mapValue.fields) || {};
                return { uid: d.name.split("/").pop(), a: f.a ? f.a.stringValue : "", n: f.n ? f.n.stringValue : "Cuber", vs: Object.keys(vs) };
            }).filter(function (x) { return x.a; });
            c.list.sort(function (x, y) { return y.vs.length - x.vs.length; });
            draw();
        }).catch(function () { if (cur === c) { c.list = []; c.err = "Öneriler yüklenemedi."; draw(); } });
    }
    function draw() {
        var c = cur; if (!c) return;
        var u = user(), me = u ? u.uid : "", mine = null;
        var orig = c.card.getAttribute("data-orig") || ((c.card.querySelector(".case-alg") || {}).textContent || "");
        var html = '<h3>💬 ' + esc(c.name) + '</h3><p class="sg-sub">Topluluğun önerdiği algoritmalar · en çok beğenilen üstte</p>';
        if (c.list == null) html += '<div class="sg-empty">Yükleniyor…</div>';
        else if (!c.list.length) html += '<div class="sg-empty">' + esc(c.err || "Bu case için henüz öneri yok. İlk öneriyi sen yap!") + '</div>';
        else html += '<div class="sg-list">' + c.list.map(function (x, i) {
            if (x.uid === me) mine = x;
            var voted = me && x.vs.indexOf(me) >= 0;
            return '<div class="sg-item' + (x.uid === me ? " mine" : "") + '"><div class="sg-alg" dir="ltr">' + esc(x.a) + '</div>' +
                '<div class="sg-meta"><span>' + (i === 0 && x.vs.length ? "⭐ " : "") + esc(x.n) + (x.uid === me ? " (sen)" : "") + '</span><span class="sp"></span>' +
                '<button type="button" data-vote="' + esc(x.uid) + '" class="' + (voted ? "on" : "") + '" title="Beğen">👍 ' + x.vs.length + '</button>' +
                '<button type="button" data-use="' + i + '" title="Bu algoritmayı kendi algoritman yap">Bunu kullan</button></div></div>';
        }).join("") + '</div>';
        if (u) {
            html += '<div class="sg-form"><b style="font-size:14px">' + (mine ? "Önerini güncelle" : "Kendi algoritmanı öner") + '</b>' +
                '<textarea id="sgIn" dir="ltr" spellcheck="false" autocomplete="off" placeholder="ör. ' + esc(orig || "R U R' U'") + '">' + esc(mine ? mine.a : "") + '</textarea>' +
                '<div class="sg-acts"><button type="button" id="sgSend">' + (mine ? "Güncelle" : "Öner") + '</button>' + (mine ? '<button type="button" class="ghost" id="sgDel">Önerimi sil</button>' : '') + '</div>' +
                '<div class="sg-err" id="sgErr"></div></div>';
        } else {
            html += '<div class="sg-login">Öneri yapmak ve oy vermek için üye ol.<button type="button" id="sgLogin">Giriş yap / Üye ol</button></div>';
        }
        body().innerHTML = html;
        bind();
    }
    function msg(t, bad) { var e = document.getElementById("sgErr"); if (e) { e.textContent = t || ""; e.className = "sg-err" + (bad ? " bad" : ""); } }
    function bind() {
        var c = cur, b = body();
        var lg = document.getElementById("sgLogin"); if (lg) lg.onclick = function () { Account.openLogin && Account.openLogin(); };
        Array.prototype.forEach.call(b.querySelectorAll("[data-vote]"), function (btn) { btn.onclick = function () { vote(btn.getAttribute("data-vote")); }; });
        Array.prototype.forEach.call(b.querySelectorAll("[data-use]"), function (btn) {
            btn.onclick = function () {
                if (!user()) { Account.openLogin && Account.openLogin(); return; }
                var x = c.list[+btn.getAttribute("data-use")]; if (!x || !window.CustomAlgs) return;
                CustomAlgs.set(c.sc.page, c.sc.set, c.name, x.a);
                if (CustomAlgs.refresh) CustomAlgs.refresh(c.card);
                btn.textContent = "✓ Kullanılıyor";
            };
        });
        var send = document.getElementById("sgSend");
        if (send) send.onclick = function () {
            var v = clean(document.getElementById("sgIn").value);
            if (!v) { msg("Algoritma yaz.", 1); return; }
            if (v.length > 200 || !valid(v)) { msg("Geçersiz karakter ya da çok uzun (en fazla 200).", 1); return; }
            var u = user(), mine = (c.list || []).filter(function (x) { return x.uid === u.uid; })[0];
            send.disabled = true; msg("Gönderiliyor…");
            var fields = { a: { stringValue: v }, u: { stringValue: u.uid }, n: { stringValue: myName() }, ts: { timestampValue: new Date().toISOString() } };
            var mask = "?updateMask.fieldPaths=a&updateMask.fieldPaths=u&updateMask.fieldPaths=n&updateMask.fieldPaths=ts";
            if (!mine) { fields.vs = { mapValue: { fields: {} } }; fields.vs.mapValue.fields[u.uid] = { integerValue: "1" }; mask += "&updateMask.fieldPaths=vs"; }
            authFetch("/algsug/" + c.id + "/s/" + u.uid + mask, { method: "PATCH", body: JSON.stringify({ fields: fields }) }).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                msg("Önerin kaydedildi ✓"); load();
            }).catch(function (e) { send.disabled = false; msg("Kaydedilemedi (" + e.message + ").", 1); });
        };
        var del = document.getElementById("sgDel");
        if (del) del.onclick = function () {
            if (!confirm("Önerin silinsin mi?")) return;
            authFetch("/algsug/" + c.id + "/s/" + user().uid, { method: "DELETE" }).then(function () { load(); });
        };
    }
    function vote(owner) {
        var c = cur, u = user();
        if (!u) { Account.openLogin && Account.openLogin(); return; }
        var x = (c.list || []).filter(function (y) { return y.uid === owner; })[0]; if (!x) return;
        var on = x.vs.indexOf(u.uid) < 0;
        // yalnız kendi oy alanı yazılır/silinir
        var path = "/algsug/" + c.id + "/s/" + owner + "?updateMask.fieldPaths=" + encodeURIComponent("vs.`" + u.uid + "`");
        var fields = { vs: { mapValue: { fields: {} } } };
        if (on) fields.vs.mapValue.fields[u.uid] = { integerValue: "1" };
        if (on) x.vs.push(u.uid); else x.vs = x.vs.filter(function (k) { return k !== u.uid; });
        draw();
        authFetch(path, { method: "PATCH", body: JSON.stringify({ fields: fields }) }).then(function (r) { if (!r.ok) throw new Error(r.status); })
            .catch(function () { load(); });
    }

    /* ---------- kartlara düğme ---------- */
    function decorate(root) {
        Array.prototype.forEach.call((root || document).querySelectorAll(".case-card[data-case]"), function (card) {
            if (card.querySelector(".alg-sug-btn")) return;
            var b = document.createElement("button");
            b.type = "button"; b.className = "alg-sug-btn"; b.textContent = "💬 Öneriler"; b.title = "Topluluğun önerdiği algoritmalar";
            (card.querySelector(".case-body") || card).appendChild(b);
        });
    }
    function init() {
        wrapEl = document.getElementById("subsetsWrap");
        if (!wrapEl) return;
        ensureModal();
        // Kartın "öğreniyorum/biliyorum" döngüsünü tetiklemesin
        wrapEl.addEventListener("click", function (e) {
            var b = e.target.closest(".alg-sug-btn");
            if (b) { e.stopPropagation(); e.preventDefault(); open(b.closest(".case-card")); }
        }, true);
        wrapEl.addEventListener("keydown", function (e) {
            if (e.target.closest(".alg-sug-btn") && (e.key === "Enter" || e.key === " ")) { e.stopPropagation(); e.preventDefault(); open(e.target.closest(".case-card")); }
        }, true);
        decorate(wrapEl);
        new MutationObserver(function () { decorate(wrapEl); }).observe(wrapEl, { childList: true, subtree: true });
        if (window.Account && Account.onChange) Account.onChange(function () { if (cur) draw(); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
