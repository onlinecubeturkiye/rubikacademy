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
                return { email: gv(f, "email") || "", provider: gv(f, "provider") || "", theme: gv(f, "theme") || "", cvd: gv(f, "cvd") || "", lang: gv(f, "lang") || "", dev: gv(f, "dev") || "", marks: marks };
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

    /* Kullanıcı durumu (arama/süzme/toplu seçim için saklanır) */
    var _users = [];          // tüm kullanıcılar
    var _selected = {};        // uid -> true (toplu seçim)
    function matchesFilter(u) {
        var q = ($id("uSearch") ? $id("uSearch").value : "").trim().toLocaleLowerCase("tr");
        if (q && (u.name || "").toLocaleLowerCase("tr").indexOf(q) < 0) return false;
        var f = $id("uFilter") ? $id("uFilter").value : "all", now = Date.now(), d1 = 86400000;
        if (f === "a1") return u.seen && now - u.seen < d1;
        if (f === "a7") return u.seen && now - u.seen < 7 * d1;
        if (f === "pasif") return !u.seen || now - u.seen > 30 * d1;
        return true;
    }
    function renderPicker() {
        var picker = $id("uPicker"), detailBox = $id("uDetail");
        if (!picker) return;
        var list = _users.filter(matchesFilter);
        if (!list.length) { picker.innerHTML = '<p class="a-note" style="padding:8px">Eşleşen kullanıcı yok.</p>'; updateBulkBar(); return; }
        picker.innerHTML = list.map(function (u) {
            var badge = (u.role && u.role !== "uye") ? '<span class="role-badge ' + u.role + '">' + (u.role === "gelistirici" ? "Geliştirici" : "Tester") + '</span>' : '';
            return '<div class="u-pick-wrap"><input type="checkbox" class="u-chk" data-uid="' + esc(u.uid) + '"' + (_selected[u.uid] ? ' checked' : '') + '>' +
                '<button type="button" class="u-pick" data-uid="' + esc(u.uid) + '"><span class="u-ava sm">' + avatarMini(u) + '</span>' +
                '<span class="u-pick-id"><b>' + esc(u.name) + '</b><small>' + esc(dateFmt(u.seen)) + '</small>' + badge + '</span></button></div>';
        }).join("");
        Array.prototype.forEach.call(picker.querySelectorAll(".u-pick"), function (btn) {
            btn.addEventListener("click", function () {
                var u = findUser(btn.getAttribute("data-uid"));
                if (u) selectUser(u, detailBox, btn, picker);
            });
        });
        Array.prototype.forEach.call(picker.querySelectorAll(".u-chk"), function (chk) {
            chk.addEventListener("change", function () {
                if (chk.checked) _selected[chk.getAttribute("data-uid")] = true; else delete _selected[chk.getAttribute("data-uid")];
                updateBulkBar();
            });
        });
        updateBulkBar();
    }
    function findUser(uid) { for (var i = 0; i < _users.length; i++) if (_users[i].uid === uid) return _users[i]; return null; }
    function applyUserFilter() { renderPicker(); }

    /* ---------- toplu işlemler ---------- */
    function selectedUids() { return Object.keys(_selected); }
    function updateBulkBar() {
        var bar = $id("uBulk"), n = selectedUids().length;
        if (!bar) return;
        bar.hidden = n === 0;
        var c = $id("uSelCount"); if (c) c.textContent = n;
    }
    function bindBulk() {
        var go = $id("uBulkRoleGo"), notify = $id("uBulkNotify");
        if (go) go.addEventListener("click", function () {
            var role = $id("uBulkRole").value, uids = selectedUids();
            if (!role) { msg($id("uBulkMsg"), "Önce rol seç.", "bad"); return; }
            if (!uids.length) { msg($id("uBulkMsg"), "Kullanıcı seçili değil.", "bad"); return; }
            if (!confirm(uids.length + " kullanıcıya “" + role + "” rolü atanacak. Onaylıyor musun?")) return;
            go.disabled = true; msg($id("uBulkMsg"), "Uygulanıyor…");
            var done = 0, fail = 0;
            Promise.all(uids.map(function (uid) {
                return setRole(uid, role).then(function (ok) { if (ok) { done++; var u = findUser(uid); if (u) u.role = role; } else fail++; }, function () { fail++; });
            })).then(function () {
                go.disabled = false;
                msg($id("uBulkMsg"), done + " kullanıcıya uygulandı" + (fail ? " · " + fail + " başarısız" : "") + " ✓", fail ? "bad" : "ok");
                renderPicker();
            });
        });
        if (notify) notify.addEventListener("click", function () {
            var uids = selectedUids();
            if (!uids.length) { msg($id("uBulkMsg"), "Kullanıcı seçili değil.", "bad"); return; }
            var text = prompt("Seçili " + uids.length + " kullanıcıya gönderilecek bildirim:");
            if (text == null) return; text = text.trim();
            if (text.length < 2) { msg($id("uBulkMsg"), "Mesaj çok kısa.", "bad"); return; }
            notify.disabled = true; msg($id("uBulkMsg"), "Gönderiliyor…");
            var done = 0, fail = 0;
            Promise.all(uids.map(function (uid) {
                return window.Account.sendNotif(uid, text).then(function (ok) { if (ok) done++; else fail++; }, function () { fail++; });
            })).then(function () {
                notify.disabled = false;
                msg($id("uBulkMsg"), done + " kişiye gönderildi" + (fail ? " · " + fail + " başarısız" : "") + " ✓", fail ? "bad" : "ok");
            });
        });
    }

    /* ---------- aktiflik grafiği (son 14 gün, son görülmeye göre) ---------- */
    function renderChart() {
        var box = $id("aChart"); if (!box) return;
        var now = Date.now(), d1 = 86400000, days = 14, buckets = [];
        for (var i = days - 1; i >= 0; i--) {
            var start = now - (i + 1) * d1, end = now - i * d1;
            var c = _users.filter(function (u) { return u.seen && u.seen >= start && u.seen < end; }).length;
            var lbl = new Date(end - d1 / 2); buckets.push({ n: c, d: pad(lbl.getDate()) + "." + pad(lbl.getMonth() + 1) });
        }
        var max = Math.max(1, buckets.reduce(function (m, b) { return Math.max(m, b.n); }, 0));
        box.innerHTML = '<div class="chart-bars">' + buckets.map(function (b) {
            var h = Math.round((b.n / max) * 100);
            return '<div class="cb" title="' + b.d + ': ' + b.n + ' aktif"><span class="cb-v">' + (b.n || "") + '</span>' +
                '<span class="cb-bar" style="height:' + Math.max(h, b.n ? 6 : 2) + '%"></span><span class="cb-x">' + b.d + '</span></div>';
        }).join("") + '</div><p class="a-note" style="margin-top:4px">Son 14 günde her gün aktif olan üye sayısı.</p>';
    }

    function renderUsers() {
        var box = $id("aUsersList"); box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        _selected = {};
        listUsers().then(function (users) {
            _users = users;
            $id("aUsersCount").textContent = users.length + " kullanıcı";
            if (!users.length) { box.innerHTML = '<p class="a-note">Henüz kayıtlı kullanıcı yok.</p>'; return; }
            box.innerHTML = '<div class="u-split"><div class="u-picker" id="uPicker"></div><div class="u-detailwrap" id="uDetail"><p class="a-note">Soldan bir kullanıcı seç; tüm verisi burada görünür.</p></div></div>';
            renderPicker();
            // Rolleri arkada çek (rozet + süzme için); gelince listeyi tazele
            Promise.all(users.map(function (u) { return fetchRole(u.uid).then(function (r) { u.role = r; }, function () {}); })).then(function () { renderPicker(); });
            // Bildirim hedef listesini doldur
            var sel = $id("bcTarget");
            if (sel) { sel.innerHTML = '<option value="all">📢 Herkese (duyuru)</option>' + users.map(function (u) { return '<option value="' + esc(u.uid) + '">' + esc(u.name) + '</option>'; }).join(""); }
            // Genel bakış + grafik
            var ov = $id("aOverview");
            if (ov) {
                var now = Date.now(), d1 = 86400000, d7 = 7 * d1;
                function cnt(f) { return users.filter(f).length; }
                var tiles = [["Toplam üye", users.length], ["Son 24 saat aktif", cnt(function (u) { return u.seen && now - u.seen < d1; })], ["Son 7 gün aktif", cnt(function (u) { return u.seen && now - u.seen < d7; })], ["Bu hafta katılan", cnt(function (u) { return u.joined && now - u.joined < d7; })]];
                ov.innerHTML = tiles.map(function (t) { return '<div class="stat-tile"><b>' + t[1] + '</b><span>' + t[0] + '</span></div>'; }).join("") + '<div class="stat-tile"><b id="ovDaily">…</b><span>Bugün günlük gönderim</span></div>';
                window.Leaderboard.fetchDay(dayNumOf(todayStr()), 300).then(function (rows) { var e = $id("ovDaily"); if (e) e.textContent = rows.length; }, function () {});
            }
            renderChart();
        }, function (e) {
            var code = e && e.message;
            var hint = (code === "403" || code === 403) ? ' — Firestore kurallarını Firebase Console’dan yayımladığından ve bu hesabın yönetici (pikapikachuyt0@gmail.com, Google) olduğundan emin ol.' : '';
            box.innerHTML = '<p class="a-note">Kullanıcılar yüklenemedi (' + esc(code) + ')' + hint + '</p>';
        });
    }

    /* ---------- duyuru geçmişi ---------- */
    function renderBroadcasts() {
        var box = $id("aBcList"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        window.Account.listBroadcasts().then(function (list) {
            if (!list.length) { box.innerHTML = '<p class="a-note">Henüz duyuru yok.</p>'; return; }
            box.innerHTML = list.map(function (b) {
                return '<div class="bc-row" data-id="' + esc(b.id) + '"><div class="bc-main"><p>' + esc(b.text) + '</p><small>' + esc(dateFmt(b.ts)) + '</small></div>' +
                    '<button class="a-btn danger sm" data-del="' + esc(b.id) + '">Sil</button></div>';
            }).join("");
            Array.prototype.forEach.call(box.querySelectorAll("[data-del]"), function (btn) {
                btn.addEventListener("click", function () {
                    if (!confirm("Bu duyuru silinsin mi?")) return;
                    btn.disabled = true;
                    window.Account.deleteBroadcast(btn.getAttribute("data-del")).then(function (ok) {
                        if (ok) renderBroadcasts(); else { btn.disabled = false; alert("Silinemedi."); }
                    }, function () { btn.disabled = false; alert("Silinemedi."); });
                });
            });
        }, function () { box.innerHTML = '<p class="a-note">Duyurular yüklenemedi.</p>'; });
    }

    /* ---------- cihaz & tarayıcı dağılımı ---------- */
    function renderDevices() {
        var box = $id("aDevBox"), btn = $id("aDevLoad");
        if (!box) return;
        if (!_users.length) { box.innerHTML = '<p class="a-note">Önce kullanıcılar yüklensin.</p>'; return; }
        box.innerHTML = '<p class="a-note">Hesaplanıyor… (0/' + _users.length + ')</p>';
        if (btn) btn.disabled = true;
        var browsers = {}, oses = {}, done = 0, total = _users.length;
        function bump(obj, k) { k = k || "Bilinmiyor"; obj[k] = (obj[k] || 0) + 1; }
        Promise.all(_users.map(function (u) {
            return fetchMeta(u.uid).then(function (m) {
                var dev = (m && m.dev) || "";
                var parts = dev.split("·");
                bump(browsers, (parts[0] || "").trim());
                bump(oses, (parts[1] || "").trim());
            }, function () { bump(browsers, ""); bump(oses, ""); }).then(function () {
                done++; var p = box.querySelector(".a-note"); if (p) p.textContent = "Hesaplanıyor… (" + done + "/" + total + ")";
            });
        })).then(function () {
            if (btn) btn.disabled = false;
            box.innerHTML = '<div class="dev-cols"><div><h4>Tarayıcı</h4>' + distHtml(browsers, total) + '</div>' +
                '<div><h4>İşletim sistemi</h4>' + distHtml(oses, total) + '</div></div>';
        });
    }
    function distHtml(obj, total) {
        var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
        if (!keys.length) return '<p class="a-note">Veri yok.</p>';
        return keys.map(function (k) {
            var n = obj[k], pct = Math.round((n / total) * 100);
            return '<div class="dist-row"><span class="dist-lbl">' + esc(k || "Bilinmiyor") + '</span>' +
                '<span class="dist-bar"><span style="width:' + pct + '%"></span></span><b>' + n + '</b></div>';
        }).join("");
    }

    /* ---------- bakım modu ---------- */
    function renderMaintenance() {
        var box = $id("aMaintBox"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        window.Account.getConfig().then(function (c) {
            c = c || {};
            box.innerHTML = '<div class="a-ctrl" style="flex-direction:column;align-items:stretch">' +
                '<label class="mt-tog"><input type="checkbox" id="mtOn"' + (c.maintenance ? ' checked' : '') + '> <span>Bakım modu açık</span></label>' +
                '<input id="mtMsg" maxlength="200" placeholder="Ziyaretçilere gösterilecek mesaj (isteğe bağlı)" value="' + esc(c.msg || "") + '" style="padding:10px 12px;border-radius:12px;border:var(--card-bw) solid var(--ink);background:var(--surface);color:var(--text);font:600 14px Inter,sans-serif">' +
                '<div><button class="a-btn main" id="mtSave">Kaydet</button><span class="a-msg" id="mtMsg2" style="margin:0 0 0 8px"></span></div></div>' +
                (c.maintenance ? '<p class="a-note" style="color:var(--bad,#d33);margin-top:6px">⚠️ Şu an bakım modu AÇIK — ziyaretçiler siteyi göremiyor.</p>' : '');
            $id("mtSave").addEventListener("click", function () {
                var on = $id("mtOn").checked, m = $id("mtMsg").value.trim();
                $id("mtSave").disabled = true; msg($id("mtMsg2"), "Kaydediliyor…");
                window.Account.setMaintenance(on, m).then(function (ok) {
                    $id("mtSave").disabled = false;
                    if (ok) { msg($id("mtMsg2"), "Kaydedildi ✓", "ok"); renderMaintenance(); }
                    else msg($id("mtMsg2"), "Kaydedilemedi (kuralları yayımladın mı?)", "bad");
                }, function () { $id("mtSave").disabled = false; msg($id("mtMsg2"), "Kaydedilemedi.", "bad"); });
            });
        }, function () { box.innerHTML = '<p class="a-note">Ayar yüklenemedi.</p>'; });
    }

    /* ---------- kabuk ---------- */
    function $id(id) { return document.getElementById(id); }
    function msg(el, text, kind) { if (!el) return; el.textContent = text || ""; el.className = "a-msg" + (kind ? " " + kind : ""); }
    function renderPanel() {
        root.innerHTML =
            '<h1 class="a-h1">Yönetim paneli</h1><p class="a-sub">Yalnızca sen görüyorsun.</p>' +
            '<div class="box"><h2>📊 Genel bakış</h2><div id="aOverview" class="stat-tiles"><p class="a-note">Yükleniyor…</p></div>' +
            '<h4 style="margin-top:14px">Aktiflik (son görülmeye göre)</h4><div id="aChart"></div></div>' +
            '<div class="box"><h2>🔔 Bildirim gönder</h2>' +
            '<p class="a-note">Yazdığın mesaj seçtiğin kişiye (ya da herkese) bildirim olarak gider. Bildirime izin veren kullanıcılarda telefon/sistem bildirimi; herkeste site içi bildirim olarak düşer.</p>' +
            '<div class="a-ctrl" style="flex-direction:column;align-items:stretch">' +
            '<textarea id="bcText" maxlength="500" rows="2" placeholder="Bildirim metni…" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:var(--card-bw) solid var(--ink);background:var(--surface);color:var(--text);font:600 14.5px Inter,sans-serif"></textarea>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select id="bcTarget"><option value="all">📢 Herkese (duyuru)</option></select>' +
            '<button class="a-btn main" id="bcSend">Gönder</button><span class="a-msg" id="bcMsg" style="margin:0"></span></div></div></div>' +
            '<div class="box"><h2>📜 Duyuru geçmişi <button class="a-btn sm" id="bcReload" style="float:right">↻</button></h2><div id="aBcList"><p class="a-note">Yükleniyor…</p></div></div>' +
            '<div class="box"><h2>👥 Kullanıcılar <span class="a-sub" id="aUsersCount" style="margin:0"></span></h2>' +
            '<div class="a-ctrl"><input id="uSearch" placeholder="Ada göre ara…" style="flex:1;min-width:140px"><select id="uFilter"><option value="all">Tümü</option><option value="a1">Son 24 saat aktif</option><option value="a7">Son 7 gün aktif</option><option value="pasif">30 günden eski</option></select><button class="a-btn" id="aUsersLoad">↻ Yenile</button></div>' +
            '<div class="bulk-bar" id="uBulk" hidden><b id="uSelCount">0</b> seçili · <select id="uBulkRole"><option value="">Rol ata…</option><option value="uye">Üye</option><option value="gelistirici">Geliştirici</option><option value="tester">Tester</option></select> <button class="a-btn sm" id="uBulkRoleGo">Uygula</button> <button class="a-btn sm" id="uBulkNotify">Bildirim gönder</button><span class="a-msg" id="uBulkMsg" style="margin:0"></span></div>' +
            '<div id="aUsersList"></div></div>' +
            '<div class="box"><h2>🖥️ Cihaz &amp; tarayıcı dağılımı</h2><p class="a-note">Her üyenin cihaz bilgisini çeker (biraz sürebilir).</p><button class="a-btn main" id="aDevLoad">Hesapla</button><div id="aDevBox" style="margin-top:10px"></div></div>' +
            '<div class="box"><h2>🛠️ Bakım modu</h2><p class="a-note">Açıkken site, sen hariç herkese “Bakımdayız” sayfası gösterir.</p><div id="aMaintBox"><p class="a-note">Yükleniyor…</p></div></div>' +
            '<div class="box"><h2>🏆 Günlük sıralama moderasyonu</h2>' +
            '<div class="a-ctrl"><input type="date" id="aDate" value="' + todayStr() + '"><button class="a-btn main" id="aDailyLoad">Getir</button></div>' +
            '<p class="a-note">Yanlış bir süreyi sil; o kullanıcı o gün için yeniden gönderebilir.</p>' +
            '<div class="a-msg" id="aDailyMsg"></div><div id="aDailyList" class="a-list"></div></div>';
        $id("aDailyLoad").addEventListener("click", renderDaily);
        $id("aUsersLoad").addEventListener("click", renderUsers);
        $id("uSearch").addEventListener("input", applyUserFilter);
        $id("uFilter").addEventListener("change", applyUserFilter);
        $id("bcReload").addEventListener("click", renderBroadcasts);
        $id("aDevLoad").addEventListener("click", renderDevices);
        bindBulk(); renderBroadcasts(); renderMaintenance();
        $id("bcSend").addEventListener("click", function () {
            var text = $id("bcText").value.trim(), to = $id("bcTarget").value;
            if (text.length < 2) { msg($id("bcMsg"), "Mesaj yaz.", "bad"); return; }
            $id("bcSend").disabled = true; msg($id("bcMsg"), "Gönderiliyor…");
            var p = (to === "all") ? window.Account.sendBroadcast(text) : window.Account.sendNotif(to, text);
            p.then(function (ok) {
                $id("bcSend").disabled = false;
                if (ok) { msg($id("bcMsg"), "Gönderildi ✓", "ok"); $id("bcText").value = ""; renderBroadcasts(); }
                else msg($id("bcMsg"), "Gönderilemedi (kuralları yayımladın mı?)", "bad");
            }, function () { $id("bcSend").disabled = false; msg($id("bcMsg"), "Gönderilemedi.", "bad"); });
        });
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
