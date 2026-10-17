/* =========================================================
   YÖNETİM PANELİ (admin.js) — yalnızca pikapikachuyt0@gmail.com (Google)
   - Günlük sıralama moderasyonu: hatalı süreleri sil (kişi tekrar gönderebilir)
   - Kullanıcılar: profil/istatistik ve son sayfa ziyaretleri
   Erişim hem istemcide hem Firestore kurallarında (isAdmin) kısıtlıdır.
========================================================= */
(function () {
    var cfg = window.RA_FIREBASE || {};
    var root = document.getElementById("adminRoot");
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function fmt(ms) { if (!ms) return "—"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function label(r) { if (r.pen === "dnf") return "DNF"; var v = r.t + (r.pen === "+2" ? 2000 : 0); return fmt(v) + (r.pen === "+2" ? "+" : ""); }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function dayNumOf(ds) { var p = ds.split("-"); return String(Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000)); }
    function dateFmt(ms) { if (!ms) return "—"; try { return new Date(ms).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }); } catch (e) { return ""; } }

    function docsBase() { return ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents"; }
    function authed(url, opts) {
        return window.Account.token().then(function (tok) {
            opts = opts || {}; opts.headers = Object.assign({ "Content-Type": "application/json", "Authorization": "Bearer " + tok }, opts.headers || {});
            return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(cfg.apiKey), opts);
        });
    }
    function gv(f, x) { return f[x] && (f[x].stringValue != null ? f[x].stringValue : (f[x].integerValue != null ? +f[x].integerValue : f[x].timestampValue)); }

    function listUsers() {
        var body = { structuredQuery: { from: [{ collectionId: "users" }], limit: 300 } };
        return authed(docsBase() + ":runQuery", { method: "POST", body: JSON.stringify(body) })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (rows) {
                return (rows || []).filter(function (x) { return x.document; }).map(function (x) {
                    var f = x.document.fields || {}, uid = x.document.name.split("/").pop(), st = {};
                    try { st = JSON.parse(gv(f, "stats") || "{}"); } catch (e) {}
                    return { uid: uid, name: gv(f, "name") || "?", photo: gv(f, "photo") || "", bio: gv(f, "bio") || "", joined: +gv(f, "joined") || 0, seen: +gv(f, "seen") || 0, stats: st };
                }).sort(function (a, b) { return (b.seen || 0) - (a.seen || 0); });
            });
    }
    function listVisits(uid, limit) {
        var body = { structuredQuery: { from: [{ collectionId: "visits" }], orderBy: [{ field: { fieldPath: "ts" }, direction: "DESCENDING" }], limit: limit || 40 } };
        return authed(docsBase() + "/users/" + uid + ":runQuery", { method: "POST", body: JSON.stringify(body) })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (rows) {
                return (rows || []).filter(function (x) { return x.document; }).map(function (x) {
                    var f = x.document.fields || {}; return { p: (f.p && f.p.stringValue) || "?", ts: (f.ts && f.ts.timestampValue) || "" };
                });
            });
    }
    function deleteTime(day, uid) {
        return authed(docsBase() + "/days/" + day + "/times/" + uid, { method: "DELETE" }).then(function (r) { return r.ok; });
    }

    /* ---------- günlük moderasyon ---------- */
    function renderDaily() {
        var day = dayNumOf($id("aDate").value || todayStr());
        var box = $id("aDailyList"); box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        window.Leaderboard.fetchDay(day, 300).then(function (rows) {
            if (!rows.length) { box.innerHTML = '<p class="a-note">Bu gün için gönderim yok.</p>'; return; }
            box.innerHTML = rows.map(function (x, i) {
                return '<div class="a-row" data-uid="' + esc(x.uid) + '"><span class="rk">' + (i + 1) + '</span>' +
                    '<span class="nm">' + esc(x.name) + '</span>' +
                    '<span class="tm" dir="ltr">' + esc(label(x)) + '</span>' +
                    '<button class="a-btn danger sm" data-del="' + esc(x.uid) + '">Sil</button></div>';
            }).join("");
            Array.prototype.forEach.call(box.querySelectorAll("[data-del]"), function (btn) {
                btn.addEventListener("click", function () {
                    var uid = btn.getAttribute("data-del");
                    if (!confirm("Bu süre silinsin mi? Kullanıcı yeniden gönderebilecek.")) return;
                    btn.disabled = true;
                    deleteTime(day, uid).then(function (ok) {
                        if (ok) { msg($id("aDailyMsg"), "Silindi ✓ — kullanıcı tekrar gönderebilir.", "ok"); renderDaily(); }
                        else { btn.disabled = false; msg($id("aDailyMsg"), "Silinemedi.", "bad"); }
                    }, function () { btn.disabled = false; msg($id("aDailyMsg"), "Silinemedi.", "bad"); });
                });
            });
        }, function () { box.innerHTML = '<p class="a-note">Sıralama yüklenemedi.</p>'; });
    }

    /* ---------- kullanıcılar ---------- */
    function userCard(u) {
        var st = u.stats || {}, sets = st.sets || {}, setIds = Object.keys(sets);
        var ini = (u.name || "?").trim().charAt(0).toUpperCase() || "?";
        var ava = u.photo ? '<img src="' + esc(u.photo) + '" alt="" referrerpolicy="no-referrer">' : esc(ini);
        var pills = setIds.slice(0, 16).map(function (id) { var s = sets[id]; return '<span class="pill">' + esc(id) + ": " + (s.k || 0) + (s.t ? "/" + s.t : "") + "</span>"; }).join("");
        return '<div class="u-card" data-uid="' + esc(u.uid) + '">' +
            '<div class="u-top"><div class="u-ava">' + ava + '</div>' +
            '<div class="u-id"><b>' + esc(u.name) + '</b><small>' + esc(u.uid) + '</small>' +
            '<div class="u-stat">Bilinen ' + (st.known || 0) + ' · Öğrenilen ' + (st.learning || 0) + ' · Trainer ' + (st.solves || 0) + ' · Günlük en iyi ' + fmt(st.best) + ' · Son görülme ' + dateFmt(u.seen) + '</div></div>' +
            '<button class="a-btn sm" data-expand>Detay</button></div>' +
            '<div class="u-detail">' + (u.bio ? '<p class="a-note">“' + esc(u.bio) + '”</p>' : '') +
            (pills ? '<h4>İlerleme setleri</h4><div>' + pills + '</div>' : '') +
            '<h4>Son sayfa ziyaretleri</h4><div class="v-list"><p class="a-note">…</p></div></div></div>';
    }
    function bindUserCards(container) {
        Array.prototype.forEach.call(container.querySelectorAll(".u-card"), function (card) {
            var btn = card.querySelector("[data-expand]"), loaded = false;
            btn.addEventListener("click", function () {
                var open = card.classList.toggle("open");
                btn.textContent = open ? "Gizle" : "Detay";
                if (open && !loaded) {
                    loaded = true;
                    var uid = card.getAttribute("data-uid"), vl = card.querySelector(".v-list");
                    listVisits(uid, 50).then(function (vs) {
                        vl.innerHTML = vs.length ? vs.map(function (v) { return '<div class="v-row"><span class="vp">' + esc(v.p) + '</span><span>' + esc(dateFmt(v.ts)) + '</span></div>'; }).join("")
                            : '<p class="a-note">Kayıtlı ziyaret yok.</p>';
                    }, function () { vl.innerHTML = '<p class="a-note">Ziyaretler yüklenemedi.</p>'; loaded = false; });
                }
            });
        });
    }
    function renderUsers() {
        var box = $id("aUsersList"); box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        listUsers().then(function (users) {
            $id("aUsersCount").textContent = users.length + " kullanıcı";
            box.innerHTML = users.length ? users.map(userCard).join("") : '<p class="a-note">Kullanıcı yok.</p>';
            bindUserCards(box);
        }, function (e) { box.innerHTML = '<p class="a-note">Kullanıcılar yüklenemedi (' + esc(e && e.message) + ').</p>'; });
    }

    /* ---------- kabuk ---------- */
    function $id(id) { return document.getElementById(id); }
    function msg(el, text, kind) { if (!el) return; el.textContent = text || ""; el.className = "a-msg" + (kind ? " " + kind : ""); }
    function renderPanel() {
        root.innerHTML =
            '<h1 class="a-h1">Yönetim paneli</h1><p class="a-sub">Yalnızca sen görüyorsun. Günlük sıralamayı düzenle ve kullanıcı etkinliğini izle.</p>' +
            '<div class="box"><h2>🏆 Günlük sıralama moderasyonu</h2>' +
            '<div class="a-ctrl"><input type="date" id="aDate" value="' + todayStr() + '"><button class="a-btn main" id="aDailyLoad">Getir</button></div>' +
            '<p class="a-note">Yanlış bir süreyi sil; o kullanıcı o gün için yeniden gönderebilir.</p>' +
            '<div class="a-msg" id="aDailyMsg"></div><div id="aDailyList" class="a-list"></div></div>' +
            '<div class="box"><h2>👥 Kullanıcılar <span class="a-sub" id="aUsersCount" style="margin:0"></span></h2>' +
            '<div class="a-ctrl"><button class="a-btn main" id="aUsersLoad">Kullanıcıları yükle</button></div>' +
            '<div id="aUsersList"></div></div>';
        $id("aDailyLoad").addEventListener("click", renderDaily);
        $id("aUsersLoad").addEventListener("click", renderUsers);
        renderDaily();
    }
    function renderGate(kind) {
        if (kind === "forbidden") {
            root.innerHTML = '<div class="box a-gate"><h1>Erişim yok</h1><p>Bu sayfa yalnızca site yöneticisine açıktır.</p><a class="a-btn" href="/icerikler/profil">Profilim</a></div>';
        } else {
            root.innerHTML = '<div class="box a-gate"><h1>Yönetim</h1><p>Devam etmek için yönetici hesabıyla giriş yap.</p><button class="a-btn main" id="aLogin">Giriş yap</button></div>';
            var b = $id("aLogin"); if (b) b.addEventListener("click", function () { if (window.Account) window.Account.openLogin(); });
        }
    }

    function start() {
        if (!window.Account || !window.Account.enabled()) { root.innerHTML = '<div class="box"><p class="a-note">Hesap sistemi kullanılamıyor.</p></div>'; return; }
        window.Account.onChange(function (u) {
            if (u) { if (window.Account.isAdmin()) renderPanel(); else renderGate("forbidden"); }
            else if (window.Account.isPending()) root.innerHTML = '<div class="box"><p class="a-note">Yükleniyor…</p></div>';
            else renderGate("login");
        });
        if (window.Account.isPending()) window.Account.load();
    }
    if (document.readyState !== "loading") start(); else document.addEventListener("DOMContentLoaded", start);
})();
