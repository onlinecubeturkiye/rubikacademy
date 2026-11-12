/* =========================================================
   ŞİKAYET ve ENGELLEME (report.js)
   Kullanıcı içeriği (yarışma sohbeti, herkese açık profil) için Google Play kullanıcı içeriği politikası:
   - Şikayet et: reports/{id} = { t: "chat"|"user", tu: hedef uid, tn: hedef ad, x: içerik, ref: yol, r: neden, note, by, ts }
     Yalnız giriş yapan üye yazar, yalnız yönetici okur (firestore.rules).
   - Engelle: engellenen kişinin sohbet mesajları bu cihazda/hesapta gizlenir (ra-blocked-v1).
   RAReport.open({ t, tu, tn, x, ref }) · RAReport.blocked(uid) · RAReport.block(uid, on)
========================================================= */
(function () {
    if (window.RAReport) return;
    var KEY = "ra-blocked-v1";
    var REASONS = [["spam", "Spam / reklam"], ["abuse", "Hakaret, taciz ya da zorbalık"], ["inappropriate", "Uygunsuz içerik (cinsel, şiddet, nefret)"], ["cheat", "Hile ya da sahte süre"], ["impersonation", "Başkasını taklit ediyor"], ["other", "Diğer"]];
    function list() { try { var a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function blocked(uid) { return !!uid && list().indexOf(uid) >= 0; }
    function block(uid, on) {
        var a = list().filter(function (x) { return x !== uid; }); if (on) a.push(uid);
        try { localStorage.setItem(KEY, JSON.stringify(a.slice(-200))); } catch (e) {}
        try { document.dispatchEvent(new CustomEvent("ra-blocked-change")); } catch (e) {}
    }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function send(o, reason, note) {
        var A = window.Account, cfg = window.RA_FIREBASE || {};
        if (!A || !A.user || !A.user()) return Promise.reject(new Error("login"));
        var base = ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents/reports";
        var f = { t: o.t === "user" ? "user" : "chat", tu: String(o.tu || "").slice(0, 128), tn: String(o.tn || "").slice(0, 60), x: String(o.x || "").slice(0, 300),
            ref: String(o.ref || "").slice(0, 200), r: reason, note: String(note || "").slice(0, 300), by: A.user().uid };
        var fields = {}; Object.keys(f).forEach(function (k) { fields[k] = { stringValue: f[k] }; });
        fields.ts = { timestampValue: new Date().toISOString() };
        return A.token().then(function (tok) {
            return fetch(base, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ fields: fields }) });
        }).then(function (r) { if (!r.ok) throw new Error(r.status); return true; });
    }
    var css = ".ra-rep{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,12,18,.62);backdrop-filter:blur(3px)}" +
        ".ra-rep-b{width:min(420px,100%);max-height:92vh;overflow:auto;box-sizing:border-box;padding:18px;border-radius:20px;background:var(--surface,#fff);color:var(--text,#111);border:var(--card-bw,2px) solid var(--card-border,#e5e7eb);box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif}" +
        ".ra-rep-b h3{margin:0 0 4px;font-size:18px;font-weight:900}.ra-rep-b p{margin:0 0 12px;font-size:13.5px;color:var(--text-soft,#6b7280);line-height:1.5}" +
        ".ra-rep-q{padding:9px 11px;border-radius:12px;background:var(--surface-soft,#f3f4f6);font-size:13.5px;margin-bottom:12px;word-break:break-word}" +
        ".ra-rep-r{display:grid;gap:6px;margin-bottom:10px}.ra-rep-r label{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:12px;border:2px solid var(--border,#e5e7eb);font-weight:700;font-size:14px;cursor:pointer}" +
        ".ra-rep-r label:has(input:checked){border-color:var(--ui-accent,#6c5ce7)}" +
        ".ra-rep-b textarea{width:100%;box-sizing:border-box;min-height:64px;padding:10px 12px;border-radius:12px;border:2px solid var(--border,#e5e7eb);background:var(--surface,#fff);color:var(--text,#111);font:600 14px Inter,sans-serif}" +
        ".ra-rep-blk{display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:14px;font-weight:700}" +
        ".ra-rep-a{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}" +
        ".ra-rep-a button{font-family:inherit;padding:10px 16px;border-radius:12px;border:2px solid var(--border,#e5e7eb);background:var(--surface,#fff);color:var(--text,#111);font-weight:850;font-size:14px;cursor:pointer}" +
        ".ra-rep-a button.p{background:#dc2626;border-color:#dc2626;color:#fff}.ra-rep-m{margin-top:8px;font-size:13px;font-weight:800}";
    function open(o) {
        if (!document.getElementById("raRepCss")) { var st = document.createElement("style"); st.id = "raRepCss"; st.textContent = css; document.head.appendChild(st); }
        var A = window.Account;
        if (!A || !A.user || !A.user()) { if (A && A.openLogin) A.openLogin(); return; }
        var w = document.createElement("div"); w.className = "ra-rep"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true");
        w.innerHTML = '<div class="ra-rep-b"><h3>' + (o.t === "user" ? "Kullanıcıyı şikayet et" : "Mesajı şikayet et") + '</h3>' +
            '<p>Şikayetin yalnız site yöneticisine gider; şikayet edilen kişi kimin bildirdiğini görmez. Yönetici inceleyip içeriği kaldırabilir ya da hesabı askıya alabilir.</p>' +
            (o.x ? '<div class="ra-rep-q"><b>' + esc(o.tn || "") + ':</b> ' + esc(o.x) + '</div>' : o.tn ? '<div class="ra-rep-q"><b>' + esc(o.tn) + '</b></div>' : '') +
            '<div class="ra-rep-r">' + REASONS.map(function (r, i) { return '<label><input type="radio" name="raRepR" value="' + r[0] + '"' + (i === 0 ? " checked" : "") + '> ' + r[1] + '</label>'; }).join("") + '</div>' +
            '<textarea maxlength="300" placeholder="Ek açıklama (isteğe bağlı)"></textarea>' +
            (o.tu && o.tu !== A.user().uid ? '<label class="ra-rep-blk"><input type="checkbox" class="ra-rep-bk"' + (blocked(o.tu) ? " checked" : "") + '> Bu kişiyi engelle (mesajlarını görmem)</label>' : '') +
            '<div class="ra-rep-m"></div><div class="ra-rep-a"><button type="button" data-x>Vazgeç</button><button type="button" class="p" data-s>Şikayet et</button></div></div>';
        document.body.appendChild(w);
        var close = function () { w.remove(); };
        w.addEventListener("click", function (e) { if (e.target === w || e.target.hasAttribute("data-x")) close(); });
        w.querySelector("[data-s]").onclick = function () {
            var b = this, m = w.querySelector(".ra-rep-m"), bk = w.querySelector(".ra-rep-bk");
            if (bk) block(o.tu, bk.checked);
            b.disabled = true; m.textContent = "Gönderiliyor…";
            send(o, (w.querySelector('input[name="raRepR"]:checked') || {}).value || "other", w.querySelector("textarea").value).then(function () {
                m.style.color = "#16a34a"; m.textContent = "Teşekkürler, şikayetin yöneticiye iletildi ✓"; setTimeout(close, 1400);
            }, function () { b.disabled = false; m.style.color = "#dc2626"; m.textContent = "Gönderilemedi. İnternet bağlantını kontrol edip tekrar dene."; });
        };
    }
    window.RAReport = { open: open, blocked: blocked, block: block, list: list };
})();
