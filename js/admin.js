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
                var users = (rows || []).filter(function (x) { return x.document; }).map(function (x) {
                    var f = x.document.fields || {}, uid = x.document.name.split("/").pop(), st = {};
                    try { st = JSON.parse(gv(f, "stats") || "{}"); } catch (e) {}
                    return { uid: uid, name: gv(f, "name") || "?", photo: gv(f, "photo") || "", bio: gv(f, "bio") || "", joined: +gv(f, "joined") || 0, seen: +gv(f, "seen") || 0, stats: st, meta: null };
                }).sort(function (a, b) { return (b.seen || 0) - (a.seen || 0); });
                return users;   // hafif liste; ayrıntı (meta + ziyaret) seçince çekilir
            });
    }
    function fetchMeta(uid) {
        return authed(docsBase() + "/users/" + uid + "/meta/self", { method: "GET" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d || !d.fields) return null; var f = d.fields, marks = {};
                try { marks = JSON.parse(gv(f, "marks") || "{}"); } catch (e) {}
                return { email: gv(f, "email") || "", provider: gv(f, "provider") || "", theme: gv(f, "theme") || "", cvd: gv(f, "cvd") || "", lang: gv(f, "lang") || "", marks: marks };
            }).catch(function () { return null; });
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
    function fetchRole(uid) {
        return authed(docsBase() + "/roles/" + uid, { method: "GET" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { return (d && d.fields && d.fields.role && d.fields.role.stringValue) || "uye"; })
            .catch(function () { return "uye"; });
    }
    function setRole(uid, role) {
        return authed(docsBase() + "/roles/" + uid + "?updateMask.fieldPaths=role", { method: "PATCH", body: JSON.stringify({ fields: { role: { stringValue: role } } }) })
            .then(function (r) { return r.ok; });
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
    var SET_LBL = { oll: "OLL", pll: "PLL", "2look-2lo": "2-Look OLL", "2look-2lp": "2-Look PLL", f2l: "F2L", coll: "COLL", wv: "WV", cll: "CLL", eg1: "EG-1", eg2: "EG-2", "ortega-oll": "Ortega OLL", "ortega-pbl": "Ortega PBL", "roux-cmll": "Roux CMLL" };
    function provLabel(p) { return p === "google.com" ? "Google" : (p === "password" ? "E-posta/şifre" : (p || "—")); }
    function marksHtml(marks) {
        var ids = Object.keys(marks || {});
        if (!ids.length) return '<p class="a-note">Henüz işaret yok.</p>';
        return ids.map(function (id) {
            var m = marks[id], known = [], learning = [];
            for (var c in m) { if (m[c] === "k") known.push(c); else if (m[c] === "l") learning.push(c); }
            var kh = known.map(function (c) { return '<span class="pill k">' + esc(c) + "</span>"; }).join("");
            var lh = learning.map(function (c) { return '<span class="pill l">' + esc(c) + "</span>"; }).join("");
            return '<details class="m-set"><summary><b>' + esc(SET_LBL[id] || id) + '</b>' +
                '<span class="a-note"> biliyorum ' + known.length + ' · öğreniyorum ' + learning.length + '</span></summary>' +
                '<div class="m-pills">' + kh + lh + '</div></details>';
        }).join("");
    }
    function visitsHtml(vs) {
        if (!vs || !vs.length) return '<p class="a-note">Kayıtlı ziyaret yok.</p>';
        return vs.map(function (v) { return '<div class="v-row"><span class="vp">' + esc(v.p) + '</span><span>' + esc(dateFmt(v.ts)) + '</span></div>'; }).join("");
    }
    function avatarMini(u) {
        var ini = (u.name || "?").trim().charAt(0).toUpperCase() || "?";
        return u.photo ? '<img src="' + esc(u.photo) + '" alt="" referrerpolicy="no-referrer">' : esc(ini);
    }
    function infoRow(k, v) { return '<div class="ir"><span>' + k + '</span><b>' + v + '</b></div>'; }
    // Seçilen kullanıcının tüm verisi — derli toplu
    function userDetailHtml(u, me, visits) {
        var st = u.stats || {}, sets = st.sets || {}, setIds = Object.keys(sets);
        var markCount = 0, mk = me.marks || {}; for (var s0 in mk) { for (var c0 in mk[s0]) markCount++; }
        var pills = setIds.slice(0, 20).map(function (id) { var s = sets[id]; return '<span class="pill">' + esc(SET_LBL[id] || id) + " " + (s.k || 0) + (s.t ? "/" + s.t : "") + "</span>"; }).join("");
        var acct = '<div class="info-grid">' +
            infoRow("E-posta", '<span class="mono">' + esc(me.email || "—") + '</span>') +
            infoRow("Kullanıcı ID", '<span class="mono small">' + esc(u.uid) + '</span>') +
            infoRow("Giriş türü", esc(provLabel(me.provider))) +
            infoRow("Tema", me.theme === "dark" ? "🌙 Karanlık" : "☀️ Açık") +
            infoRow("Renk körlüğü", esc(me.cvd || "—")) +
            infoRow("Dil", esc((me.lang || "—").toUpperCase())) +
            infoRow("Üyelik", esc(dateFmt(u.joined))) +
            infoRow("Son görülme", esc(dateFmt(u.seen))) + '</div>';
        return '<div class="u-top"><div class="u-ava">' + avatarMini(u) + '</div>' +
            '<div class="u-id"><b>' + esc(u.name) + '</b><small>' + esc(me.email || u.uid) + '</small>' +
            '<div class="u-stat">Bilinen ' + (st.known || 0) + ' · Öğrenilen ' + (st.learning || 0) + ' · Trainer ' + (st.solves || 0) + ' · Günlük en iyi ' + fmt(st.best) + '</div></div></div>' +
            '<h4>Hesap bilgileri</h4>' + acct + (u.bio ? '<h4>Bio</h4><p class="a-note">“' + esc(u.bio) + '”</p>' : '') +
            (pills ? '<h4>İlerleme özeti</h4><div class="pill-wrap">' + pills + '</div>' : '') +
            '<details class="sec"><summary><b>İşaretlediği case\'ler</b> <span class="a-note">(' + markCount + ')</span></summary><div class="sec-body">' + marksHtml(me.marks) + '</div></details>' +
            '<details class="sec"><summary><b>Gezdiği sayfalar</b> <span class="a-note">(' + (visits ? visits.length : 0) + ')</span></summary><div class="sec-body v-list">' + visitsHtml(visits) + '</div></details>';
    }
    var ROLES = [["uye", "Üye"], ["gelistirici", "Geliştirici"], ["tester", "Tester"]];
    function roleBox(uid, role) {
        var opts = ROLES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === role ? ' selected' : '') + '>' + r[1] + '</option>'; }).join("");
        return '<h4>Rol</h4><div class="a-ctrl"><select id="roleSel">' + opts + '</select>' +
            '<button class="a-btn main sm" id="roleSave">Kaydet</button><span class="a-msg" id="roleMsg" style="margin:0"></span></div>';
    }
    function selectUser(u, detailBox, pickBtn, picker) {
        Array.prototype.forEach.call(picker.querySelectorAll(".u-pick"), function (b) { b.classList.remove("on"); });
        if (pickBtn) pickBtn.classList.add("on");
        detailBox.innerHTML = '<div class="u-card open"><p class="a-note">Yükleniyor…</p></div>';
        Promise.all([fetchMeta(u.uid), listVisits(u.uid, 200), fetchRole(u.uid)]).then(function (res) {
            var role = res[2] || "uye";
            detailBox.innerHTML = '<div class="u-card open">' + roleBox(u.uid, role) + userDetailHtml(u, res[0] || {}, res[1] || []) + '</div>';
            var save = $id("roleSave");
            if (save) save.addEventListener("click", function () {
                var val = $id("roleSel").value;
                save.disabled = true; msg($id("roleMsg"), "Kaydediliyor…");
                setRole(u.uid, val).then(function (ok) {
                    save.disabled = false;
                    if (ok) { msg($id("roleMsg"), "Rol kaydedildi ✓", "ok"); refreshPickBadge(pickBtn, val); }
                    else msg($id("roleMsg"), "Kaydedilemedi (kuralları yayımladın mı?)", "bad");
                }, function () { save.disabled = false; msg($id("roleMsg"), "Kaydedilemedi.", "bad"); });
            });
        }, function () { detailBox.innerHTML = '<div class="u-card open"><p class="a-note">Kullanıcı verisi yüklenemedi.</p></div>'; });
    }
    function refreshPickBadge(btn, role) {
        if (!btn) return;
        var b = btn.querySelector(".role-badge"); if (b) b.remove();
        if (role && role !== "uye") {
            var span = document.createElement("span"); span.className = "role-badge " + role;
            span.textContent = role === "gelistirici" ? "Geliştirici" : "Tester";
            btn.querySelector(".u-pick-id").appendChild(span);
        }
    }
    function renderUsers() {
        var box = $id("aUsersList"); box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        listUsers().then(function (users) {
            $id("aUsersCount").textContent = users.length + " kullanıcı";
            if (!users.length) { box.innerHTML = '<p class="a-note">Henüz kayıtlı kullanıcı yok.</p>'; return; }
            box.innerHTML = '<div class="u-split"><div class="u-picker" id="uPicker"></div><div class="u-detailwrap" id="uDetail"><p class="a-note">Soldan bir kullanıcı seç; tüm verisi burada görünür.</p></div></div>';
            var picker = $id("uPicker"), detailBox = $id("uDetail");
            picker.innerHTML = users.map(function (u, i) {
                return '<button type="button" class="u-pick" data-i="' + i + '"><span class="u-ava sm">' + avatarMini(u) + '</span>' +
                    '<span class="u-pick-id"><b>' + esc(u.name) + '</b><small>' + esc(dateFmt(u.seen)) + '</small></span></button>';
            }).join("");
            Array.prototype.forEach.call(picker.querySelectorAll(".u-pick"), function (btn) {
                btn.addEventListener("click", function () { selectUser(users[+btn.getAttribute("data-i")], detailBox, btn, picker); });
            });
        }, function (e) {
            var code = e && e.message;
            var hint = (code === "403" || code === 403) ? ' — Firestore kurallarını Firebase Console’dan yayımladığından ve bu hesabın yönetici (pikapikachuyt0@gmail.com, Google) olduğundan emin ol.' : '';
            box.innerHTML = '<p class="a-note">Kullanıcılar yüklenemedi (' + esc(code) + ')' + hint + '</p>';
        });
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
            '<div class="a-ctrl"><button class="a-btn main" id="aUsersLoad">↻ Yenile</button></div>' +
            '<p class="a-note">Her üyenin e-postası, giriş türü, teması, işaretlediği case\'ler ve gezdiği sayfalar otomatik yüklenir.</p>' +
            '<div id="aUsersList"></div></div>';
        $id("aDailyLoad").addEventListener("click", renderDaily);
        $id("aUsersLoad").addEventListener("click", renderUsers);
        renderDaily();
        renderUsers();   // kullanıcılar ve tüm verileri otomatik gelsin
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
