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
    // Son 14 günün gönderim sayıları: hangi günde kayıt olduğu bir bakışta görünsün
    function renderDayChips() {
        var host = $id("aDayChips"); if (!host) return;
        var days = [];
        for (var i = 0; i < 14; i++) { var d = new Date(); d.setDate(d.getDate() - i); days.push(d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())); }
        host.innerHTML = days.map(function (ds) { return '<button type="button" class="day-chip" data-ds="' + ds + '">' + ds.slice(8) + "." + ds.slice(5, 7) + ' <b>…</b></button>'; }).join("");
        days.forEach(function (ds) {
            window.Leaderboard.fetchDay(dayNumOf(ds), 300).then(function (rows) {
                var b = host.querySelector('[data-ds="' + ds + '"]'); if (!b) return;
                b.querySelector("b").textContent = rows.length; b.classList.toggle("has", rows.length > 0);
            }, function () { var b = host.querySelector('[data-ds="' + ds + '"] b'); if (b) b.textContent = "!"; });
        });
        markDayChip();
    }
    function markDayChip() {
        var cur = $id("aDate").value || todayStr();
        Array.prototype.forEach.call(document.querySelectorAll("#aDayChips .day-chip"), function (b) { b.classList.toggle("on", b.getAttribute("data-ds") === cur); });
    }
    function renderDaily() {
        var ds = $id("aDate").value || todayStr(), day = dayNumOf(ds);
        markDayChip();
        var box = $id("aDailyList"); box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        window.Leaderboard.fetchDay(day, 300).then(function (rows) {
            if (!rows.length) { box.innerHTML = '<p class="a-note">' + esc(ds) + ' (gün no ' + day + ') için gönderim yok.</p>'; return; }
            box.innerHTML = '<p class="a-note">' + esc(ds) + ' · ' + rows.length + ' gönderim</p>' + rows.map(function (x, i) {
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
        }, function (e) { box.innerHTML = '<p class="a-note">Sıralama yüklenemedi (' + esc(e && e.message) + ').</p>'; });
    }

    /* ---------- kullanıcılar ---------- */
    var SET_LBL = { oll: "OLL", pll: "PLL", "2look-2lo": "2-Look OLL", "2look-2lp": "2-Look PLL", f2l: "F2L", coll: "COLL", wv: "WV", cll: "CLL", eg1: "EG-1", eg2: "EG-2", "ortega-oll": "Ortega OLL", "ortega-pbl": "Ortega PBL", "roux-cmll": "Roux CMLL", zbll: "ZBLL", "megaminx-oll": "Megaminx OLL", "megaminx-pll": "Megaminx PLL", "square1-shape": "SQ-1 Cubeshape", "square1-co": "SQ-1 CO", "square1-eo": "SQ-1 EO", "square1-cp": "SQ-1 CP", "square1-ep": "SQ-1 EP" };
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
    function skinLabel(k) {
        var S = { standart: ["Standart", "#6c5ce7"], rubik: ["Rubik's Cube", "#ffd21f"], neon: ["Neon", "#22d3ee"], gunbatimi: ["Gün Batımı", "#e8573a"], halloween: ["Halloween", "#f97316"], yilbasi: ["Yılbaşı", "#dc2626"] };
        var x = S[k || ""]; if (!x) return k ? esc(k) : "—";
        return '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + x[1] + ';margin-inline-end:6px;vertical-align:middle"></span>' + x[0];
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
            infoRow("Tema stili", skinLabel(me.skin)) +
            infoRow("Renk körlüğü", esc(me.cvd || "—")) +
            infoRow("Dil", esc((me.lang || "—").toUpperCase())) +
            infoRow("Üyelik", esc(dateFmt(u.joined))) +
            infoRow("Son görülme", esc(dateFmt(u.seen))) + '</div>';
        return '<div class="u-top"><div class="u-ava">' + avatarMini(u) + '</div>' +
            '<div class="u-id"><b>' + esc(u.name) + '</b><small>' + esc(me.email || u.uid) + '</small>' +
            '<a class="a-btn sm u-prof" href="/icerikler/profil?u=' + encodeURIComponent(u.uid) + '" target="_blank" rel="noopener">👤 Profiline git ↗</a>' +
            '<div class="u-stat">Bilinen ' + (st.known || 0) + ' · Öğrenilen ' + (st.learning || 0) + ' · Trainer ' + (st.solves || 0) + ' · Günlük en iyi ' + fmt(st.best) + '</div></div></div>' +
            '<h4>Hesap bilgileri</h4>' + acct + (u.bio ? '<h4>Bio</h4><p class="a-note">“' + esc(u.bio) + '”</p>' : '') +
            (pills ? '<h4>İlerleme özeti</h4><div class="pill-wrap">' + pills + '</div>' : '') +
            '<details class="sec"><summary><b>İşaretlediği case\'ler</b> <span class="a-note">(' + markCount + ')</span></summary><div class="sec-body">' + marksHtml(me.marks) + '</div></details>' +
            '<details class="sec"><summary><b>Gezdiği sayfalar</b> <span class="a-note">(' + (visits ? visits.length : 0) + ')</span></summary><div class="sec-body v-list">' + visitsHtml(visits) + '</div></details>';
    }
    var ROLES = [["uye", "Üye"], ["admin", "🛡 Admin"], ["gelistirici", "Geliştirici"], ["tester", "Tester"], ["organizator", "🏠 Organizatör"], ["askida", "⛔ Askıda"], ["silindi", "🗑️ Silindi"]];
    function roleBox(uid, role) {
        var opts = ROLES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === role ? ' selected' : '') + '>' + r[1] + '</option>'; }).join("");
        return '<h4>Rol</h4><div class="a-ctrl"><select id="roleSel">' + opts + '</select>' +
            '<button class="a-btn main sm" id="roleSave">Kaydet</button><span class="a-msg" id="roleMsg" style="margin:0"></span></div>';
    }
    function roleName(r) { return r === "admin" ? "Admin" : r === "gelistirici" ? "Geliştirici" : r === "organizator" ? "Organizatör" : (r === "tester" ? "Tester" : (r === "askida" ? "Askıda" : (r === "silindi" ? "Silindi" : "Üye"))); }
    function dangerBox(role) {
        return '<h4>Hesap işlemleri</h4><div class="a-ctrl">' +
            '<button class="a-btn sm" id="uSuspend">' + (role === "askida" ? "✅ Askıdan çıkar" : "⛔ Askıya al") + '</button>' +
            '<button class="a-btn danger sm" id="uWipe">🗑️ Tüm verilerini sil</button>' +
            '<button class="a-btn danger sm" id="uDelete">⚠️ Hesabı tamamen sil</button><span class="a-msg" id="uDangerMsg" style="margin:0"></span></div>' +
            '<p class="a-note"><b>Tüm verilerini sil:</b> ilerleme, antrenör, günlük sonuçlar, sıralama girdileri, ziyaret/bildirim kayıtları silinir; kişinin cihazları da bir sonraki açılışta temizlenir (veriler geri gelmez). Hesap kalır.<br>' +
            '<b>Hesabı tamamen sil:</b> yukarıdakilere ek olarak profil, oturumlar, bildirim abonelikleri ve Firebase giriş hesabı silinir. Giriş hesabını GitHub Actions’taki görev (FIREBASE_SERVICE_ACCOUNT) birkaç dakika içinde siler; kişi siteye girerse hesap orada da kapatılır.</p>';
    }
    function listDocNames(path) {
        var out = [];
        function page(tok) {
            return authed(docsBase() + path + "?pageSize=300&mask.fieldPaths=zz" + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""), { method: "GET" })
                .then(function (r) { return r.ok ? r.json() : {}; })
                .then(function (d) { (d.documents || []).forEach(function (x) { out.push(x.name.split("/documents")[1]); }); return d.nextPageToken ? page(d.nextPageToken) : out; });
        }
        return page("");
    }
    function delDoc(path) { return authed(docsBase() + path, { method: "DELETE" }).then(function (r) { return r.ok; }, function () { return false; }); }
    function docName(path) { return "projects/" + cfg.projectId + "/databases/(default)/documents" + path; }
    // Toplu yazma (400'lük parçalar)
    function commit(writes) {
        var chunks = []; for (var i = 0; i < writes.length; i += 400) chunks.push(writes.slice(i, i + 400));
        return chunks.reduce(function (p, w) {
            return p.then(function () { return authed(docsBase() + ":commit", { method: "POST", body: JSON.stringify({ writes: w }) }); })
                .then(function (r) { if (!r.ok) throw new Error("commit " + r.status); });
        }, Promise.resolve());
    }
    function dayRange() { var td = Math.floor(Date.now() / 86400000), out = []; for (var d = td - 370; d <= td + 1; d++) out.push(d); return out; }
    function kvWrite(uid, key, v) {
        var t = Date.now();
        return authed(docsBase() + "/users/" + uid + "/kv/" + encodeURIComponent(key), { method: "PATCH", body: JSON.stringify({ fields: { v: { stringValue: v }, t: { integerValue: String(t) } } }) })
            .then(function (r) { return r.ok; });
    }
    // Tüm verileri sil (hesap kalır): kv + sıralama + ziyaret/bildirim/meta; "wipe-v1" işaretiyle cihazlar da temizlenir
    function wipeUserData(uid) {
        var now = Date.now();
        return Promise.all(["kv", "visits", "notifications", "meta"].map(function (c) { return listDocNames("/users/" + uid + "/" + c); })).then(function (lists) {
            var writes = [].concat.apply([], lists).filter(function (p) { return !/\/kv\/wipe-v1$/.test(p); }).map(function (p) { return { delete: docName(p) }; });
            dayRange().forEach(function (dn) { writes.push({ delete: docName("/days/" + dn + "/times/" + uid) }); });
            writes.push({ delete: docName("/users/" + uid) });
            writes.push({ update: { name: docName("/users/" + uid + "/kv/wipe-v1"), fields: { v: { stringValue: String(now) }, t: { integerValue: String(now) } } } });
            return commit(writes);
        });
    }
    function listPushSubsOf(uid) {
        var out = [];
        function page(tok) {
            return authed(docsBase() + "/pushsubs?pageSize=300&mask.fieldPaths=uid" + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""), { method: "GET" })
                .then(function (r) { return r.ok ? r.json() : {}; })
                .then(function (d) { (d.documents || []).forEach(function (x) { if (gv(x.fields || {}, "uid") === uid) out.push(x.name.split("/documents")[1]); }); return d.nextPageToken ? page(d.nextPageToken) : out; });
        }
        return page("");
    }
    // Hesabı tamamen sil: tüm belgeler + rol "silindi" (cihazlar kendini kapatır) + deletions kuyruğu (Auth hesabını Actions siler)
    function deleteUserFully(u) {
        var uid = u.uid;
        return Promise.all(["kv", "visits", "sessions", "notifications", "meta"].map(function (c) { return listDocNames("/users/" + uid + "/" + c); }).concat([listPushSubsOf(uid)])).then(function (lists) {
            var writes = [].concat.apply([], lists).map(function (p) { return { delete: docName(p) }; });
            dayRange().forEach(function (dn) { writes.push({ delete: docName("/days/" + dn + "/times/" + uid) }); });
            writes.push({ delete: docName("/users/" + uid) });
            writes.push({ update: { name: docName("/roles/" + uid), fields: { role: { stringValue: "silindi" } } } });
            writes.push({ update: { name: docName("/deletions/" + uid), fields: { ts: { timestampValue: new Date().toISOString() }, name: { stringValue: String(u.name || "").slice(0, 40) } } } });
            return commit(writes);
        });
    }
    function bindDanger(u, role, pickBtn) {
        var sb = $id("uSuspend"), wb = $id("uWipe"), db = $id("uDelete");
        if (sb) sb.addEventListener("click", function () {
            var to = role === "askida" ? "uye" : "askida";
            if (to === "askida" && !confirm(u.name + " askıya alınsın mı?")) return;
            sb.disabled = true;
            setRole(u.uid, to).then(function (ok) {
                sb.disabled = false;
                if (!ok) { msg($id("uDangerMsg"), "Olmadı (kuralları yayımladın mı?)", "bad"); return; }
                role = to; u.role = to; refreshPickBadge(pickBtn, to);
                sb.textContent = to === "askida" ? "✅ Askıdan çıkar" : "⛔ Askıya al";
                var rs = $id("roleSel"); if (rs) rs.value = to;
                msg($id("uDangerMsg"), to === "askida" ? "Askıya alındı ✓" : "Askıdan çıkarıldı ✓", "ok");
            });
        });
        if (wb) wb.addEventListener("click", function () {
            if (prompt("“" + u.name + "” kullanıcısının TÜM verileri (ilerleme, antrenör, günlük, sıralama) kalıcı olarak silinecek. Onay için SİL yaz:") !== "SİL") return;
            wb.disabled = true; msg($id("uDangerMsg"), "Siliniyor…");
            wipeUserData(u.uid).then(function () { msg($id("uDangerMsg"), "Tüm verileri silindi ✓", "ok"); wb.disabled = false; }, function (e) { wb.disabled = false; msg($id("uDangerMsg"), "Silinemedi (" + esc(e && e.message) + ") — kuralları yayımladın mı?", "bad"); });
        });
        if (db) db.addEventListener("click", function () {
            if (prompt("“" + u.name + "” hesabı Firebase dahil TAMAMEN silinecek, geri alınamaz. Onay için HESABI SİL yaz:") !== "HESABI SİL") return;
            db.disabled = true; msg($id("uDangerMsg"), "Siliniyor…");
            deleteUserFully(u).then(function () { msg($id("uDangerMsg"), "Hesap silindi ✓ (giriş hesabı birkaç dakika içinde kaldırılır)", "ok"); setTimeout(renderUsers, 1200); }, function (e) { db.disabled = false; msg($id("uDangerMsg"), "Silinemedi (" + esc(e && e.message) + ") — kuralları yayımladın mı?", "bad"); });
        });
    }
    // Kullanıcının bulut verisi (users/{uid}/kv) — veri düzenleyici için
    function loadKv(uid) {
        var kv = {};
        function page(tok) {
            return authed(docsBase() + "/users/" + uid + "/kv?pageSize=300" + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""), { method: "GET" })
                .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
                .then(function (d) {
                    (d.documents || []).forEach(function (x) { var k = decodeURIComponent(x.name.split("/kv/")[1]); kv[k] = { v: gv(x.fields || {}, "v") || "", t: +gv(x.fields || {}, "t") || 0 }; });
                    return d.nextPageToken ? page(d.nextPageToken) : kv;
                });
        }
        return page("");
    }
    function adminStore(uid, kv) {
        return {
            get: function (k) { try { var v = JSON.parse((kv[k] || {}).v); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } },
            put: function (k, obj) { var v = JSON.stringify(obj); kv[k] = { v: v, t: Date.now() }; return kvWrite(uid, k, v); },
            keys: function () { return Object.keys(kv); },
            deleteDaily: function (d) { return deleteTime(dayNumOf(d), uid); }
        };
    }
    function bindEditor(u) {
        var sec = $id("uEditSec"), box = $id("uEditor"); if (!sec || !box) return;
        var done = false;
        sec.addEventListener("toggle", function () {
            if (!sec.open || done) return; done = true;
            box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
            loadKv(u.uid).then(function (kv) {
                if (!window.DataEditor) { box.innerHTML = '<p class="a-note">Düzenleyici yüklenemedi.</p>'; return; }
                box.innerHTML = "";
                window.DataEditor.mount(box, adminStore(u.uid, kv));
            }, function (e) { done = false; box.innerHTML = '<p class="a-note">Veriler yüklenemedi (' + esc(e && e.message) + ').</p>'; });
        });
    }
    function selectUser(u, detailBox, pickBtn, picker) {
        Array.prototype.forEach.call(picker.querySelectorAll(".u-pick"), function (b) { b.classList.remove("on"); });
        if (pickBtn) pickBtn.classList.add("on");
        detailBox.innerHTML = '<div class="u-card open"><p class="a-note">Yükleniyor…</p></div>';
        Promise.all([fetchMeta(u.uid), listVisits(u.uid, 200), fetchRole(u.uid)]).then(function (res) {
            var role = res[2] || "uye";
            detailBox.innerHTML = '<div class="u-card open">' + roleBox(u.uid, role) + userDetailHtml(u, res[0] || {}, res[1] || []) +
                '<details class="sec" id="uEditSec"><summary><b>✏️ Verilerini düzenle</b> <span class="a-note">(antrenör · günlük · bilinen algoritmalar)</span></summary><div class="sec-body"><p class="a-note">Değişiklikler kişinin buluttaki verisine yazılır; cihazları bir sonraki senkronda alır.</p><div id="uEditor"></div></div></details>' +
                dangerBox(role) + '</div>';
            bindDanger(u, role, pickBtn); bindEditor(u);
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
            span.textContent = roleName(role);
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
            var badge = (u.role && u.role !== "uye") ? '<span class="role-badge ' + u.role + '">' + roleName(u.role) + '</span>' : '';
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
            // ana sayfadaki üye sayısını güncelle (değiştiyse)
            if (window.Account.getConfig && window.Account.setMemberCount) window.Account.getConfig().then(function (c) { if (c.members !== users.length) window.Account.setMemberCount(users.length); });
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
                ov.innerHTML = tiles.map(function (t) { return '<div class="stat-tile"><b>' + t[1] + '</b><span>' + t[0] + '</span></div>'; }).join("") + '<div class="stat-tile"><b id="ovDaily">…</b><span>Bugün günlük gönderim</span></div><div class="stat-tile"><b id="ovPush">…</b><span>Bildirim abonesi (cihaz)</span></div>';
                countPushSubs().then(function (n) { var e = $id("ovPush"); if (e) e.textContent = n; });
                window.Leaderboard.fetchDay(dayNumOf(todayStr()), 300).then(function (rows) { var e = $id("ovDaily"); if (e) e.textContent = rows.length; }, function () {});
            }
            renderChart(); renderActive(); renderSiteStats();
        }, function (e) {
            var code = e && e.message;
            var hint = (code === "429" || code === 429) ? ' — Firebase günlük ücretsiz okuma kotası doldu. Kota her gün saat 10:00 civarı (TR) sıfırlanır; Firebase Console → Usage kısmından kullanımı görebilirsin.' : (code === "403" || code === 403) ? ' — Firestore kurallarını Firebase Console’dan yayımladığından ve bu hesabın yönetici (pikapikachuyt0@gmail.com, Google) olduğundan emin ol.' : '';
            box.innerHTML = '<p class="a-note">Kullanıcılar yüklenemedi (' + esc(code) + ')' + hint + '</p>';
        });
    }

    /* ---------- dışa aktarma ---------- */
    function download(name, text, type) {
        var a = document.createElement("a"), url = URL.createObjectURL(new Blob([text], { type: type }));
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }
    function csvCell(v) { v = v == null ? "" : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    function toCsv(rows) { return "\ufeff" + rows.map(function (r) { return r.map(csvCell).join(";"); }).join("\r\n"); }   // Excel için BOM + ;
    function isoDate(ms) { return ms ? new Date(ms).toISOString().replace("T", " ").slice(0, 16) : ""; }
    function exportUsers(kind) {
        if (!_users.length) { alert("Önce kullanıcılar yüklensin."); return; }
        var btn = $id(kind === "csv" ? "uCsv" : "uJson"); if (btn) btn.disabled = true;
        Promise.all(_users.map(function (u) { return fetchMeta(u.uid).then(function (m) { return m || {}; }); })).then(function (metas) {
            if (btn) btn.disabled = false;
            var stamp = todayStr();
            if (kind === "json") {
                var data = _users.map(function (u, i) { var m = metas[i]; return { uid: u.uid, name: u.name, email: m.email || "", provider: m.provider || "", role: u.role || "uye", joined: isoDate(u.joined), seen: isoDate(u.seen), device: m.dev || "", bio: u.bio, stats: u.stats }; });
                download("rubikacademy-kullanicilar-" + stamp + ".json", JSON.stringify(data, null, 2), "application/json");
            } else {
                var rows = [["Ad", "E-posta", "UID", "Rol", "Giriş türü", "Üyelik", "Son görülme", "Bilinen", "Öğrenilen", "Trainer çözüm", "Günlük katılım", "Günlük en iyi (sn)", "Cihaz"]];
                _users.forEach(function (u, i) { var m = metas[i], st = u.stats || {}; rows.push([u.name, m.email || "", u.uid, roleName(u.role), provLabel(m.provider), isoDate(u.joined), isoDate(u.seen), st.known || 0, st.learning || 0, st.solves || 0, st.daily || 0, st.best ? (st.best / 1000).toFixed(2) : "", m.dev || ""]); });
                download("rubikacademy-kullanicilar-" + stamp + ".csv", toCsv(rows), "text/csv;charset=utf-8");
            }
        }, function () { if (btn) btn.disabled = false; alert("Dışa aktarılamadı."); });
    }
    function exportDaily() {
        var ds = $id("aDate").value || todayStr();
        window.Leaderboard.fetchDay(dayNumOf(ds), 300).then(function (rows) {
            var out = [["Sıra", "Ad", "Süre", "Ceza", "UID"]];
            rows.forEach(function (x, i) { out.push([i + 1, x.name, label(x), x.pen || "", x.uid]); });
            download("gunluk-siralama-" + ds + ".csv", toCsv(out), "text/csv;charset=utf-8");
        }, function () { alert("Sıralama alınamadı."); });
    }

    /* ---------- en aktif kullanıcılar ---------- */
    var _actSort = "score";
    function actScore(u) { var st = u.stats || {}; return (st.solves || 0) + (st.daily || 0) * 10 + (st.known || 0) * 2; }
    function renderActive() {
        var box = $id("aActive"); if (!box) return;
        if (!_users.length) { box.innerHTML = '<p class="a-note">Kullanıcı yok.</p>'; return; }
        var key = { score: actScore, solves: function (u) { return (u.stats || {}).solves || 0; }, daily: function (u) { return (u.stats || {}).daily || 0; }, known: function (u) { return (u.stats || {}).known || 0; }, seen: function (u) { return u.seen || 0; } }[_actSort];
        var list = _users.slice().sort(function (a, b) { return key(b) - key(a); }).slice(0, 25);
        var cols = [["score", "Puan"], ["solves", "Trainer"], ["daily", "Günlük"], ["known", "Bilinen"], ["seen", "Son görülme"]];
        box.innerHTML = '<div class="act-wrap"><table class="act-tbl"><thead><tr><th>#</th><th>Kullanıcı</th>' +
            cols.map(function (c) { return '<th><button type="button" data-sort="' + c[0] + '" class="' + (c[0] === _actSort ? "on" : "") + '">' + c[1] + (c[0] === _actSort ? " ▼" : "") + '</button></th>'; }).join("") + '</tr></thead><tbody>' +
            list.map(function (u, i) {
                var st = u.stats || {};
                return '<tr><td>' + (i + 1) + '</td><td class="act-nm">' + esc(u.name) + '</td><td>' + actScore(u) + '</td><td>' + (st.solves || 0) + '</td><td>' + (st.daily || 0) + '</td><td>' + (st.known || 0) + '</td><td class="act-dt">' + esc(dateFmt(u.seen)) + '</td></tr>';
            }).join("") + '</tbody></table></div><p class="a-note">Puan = trainer çözüm + günlük katılım×10 + bilinen case×2. Başlığa tıklayıp sırala.</p>';
        Array.prototype.forEach.call(box.querySelectorAll("[data-sort]"), function (b) { b.addEventListener("click", function () { _actSort = b.getAttribute("data-sort"); renderActive(); }); });
    }
    function countPushSubs() {
        return authed(docsBase() + "/pushsubs?pageSize=300&mask.fieldPaths=uid", { method: "GET" })
            .then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) { return (d.documents || []).length; }, function () { return 0; });
    }

    /* ---------- ev yarışmaları (comps/{kod}, comps/{kod}/p/{uid}) ---------- */
    function listComps() {
        var out = [];
        function page(tok) {
            return authed(docsBase() + "/comps?pageSize=300" + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""), { method: "GET" })
                .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
                .then(function (d) {
                    (d.documents || []).forEach(function (x) {
                        var f = x.fields || {}, o = { code: x.name.split("/").pop(), updated: Date.parse(x.updateTime) || 0, created: Date.parse(x.createTime) || 0 };
                        Object.keys(f).forEach(function (k) { o[k] = gv(f, k); });
                        out.push(o);
                    });
                    return d.nextPageToken ? page(d.nextPageToken) : out;
                });
        }
        return page("");
    }
    function compPlayers(code) {
        return authed(docsBase() + "/comps/" + code + "/p?pageSize=50", { method: "GET" })
            .then(function (r) { return r.ok ? r.json() : {}; })
            .then(function (d) { return (d.documents || []).map(function (x) { var f = x.fields || {}; return { uid: x.name.split("/").pop(), name: gv(f, "name"), t: gv(f, "t"), rnd: gv(f, "rnd") }; }); });
    }
    function tFmt(x) { return +x >= 99999999 ? "DNF" : fmt(+x); }
    function deleteComp(code) {
        return Promise.all([compPlayers(code), listDocNames("/comps/" + code + "/w"), listDocNames("/comps/" + code + "/m")]).then(function (res) {
            return Promise.all(res[0].map(function (p) { return delDoc("/comps/" + code + "/p/" + p.uid); }).concat(res[1].map(delDoc), res[2].map(delDoc)));
        }).then(function () { return delDoc("/comps/" + code); });
    }
    /* --- Ev yarışmaları: liste + onay (double check) ---
       Durumlar: canlı (son 6 saatte hareketli, bitmemiş) · bekliyor (sonucu var, onay/ret yok) · onaylı (ok=1) · reddedildi (ok=-1)
       Bu özellikten önce açılan yarışmalar onaylı sayılır (oyuncuların kayıtları da öyle sayar). */
    var COMP_OK_FROM = Date.UTC(2026, 10, 12, 8, 0), compTab = "pend";
    function compState(o) {
        var now = Date.now(), R = o._R || [];
        if (!(o.st === "end" && o.fin) && now - o.updated < 6 * 3600000) return "live";
        if (o.ok === 1) return "ok"; if (o.ok === -1) return "rej";
        if (!R.length) return "empty";
        return o.created < COMP_OK_FROM ? "ok" : "pend";
    }
    var DNFV = 99999999;
    function avgN(t, n) {
        if (t.length < n) return null;
        var a = t.slice(0, n).slice().sort(function (x, y) { return x - y; }).slice(1, -1);
        if (a.some(function (x) { return x >= DNFV; })) return DNFV;
        return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    }
    function reRank(r) {
        var n = r.s || 5;
        (r.rows || []).forEach(function (x) { x.a = (x.t || []).length >= n ? avgN(x.t, n) : null; });
        r.rows.sort(function (x, y) {
            var ax = x.a == null ? Infinity : x.a, ay = y.a == null ? Infinity : y.a; if (ax !== ay) return ax - ay;
            var bx = Math.min.apply(null, (x.t || []).concat([Infinity])), by = Math.min.apply(null, (y.t || []).concat([Infinity])); return bx - by;
        });
    }
    function parseTimeIn(v) {
        v = String(v || "").trim().replace(",", ".");
        if (/^dnf$/i.test(v)) return DNFV;
        var m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(v); if (!m) return null;
        var ms = Math.round(((+m[1] || 0) * 60 + parseFloat(m[2])) * 1000);
        return ms > 0 && ms < 3600000 ? ms : null;
    }
    function renderComps() {
        var box = $id("aCompList"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        listComps().then(function (list) {
            list.sort(function (a, b) { return b.updated - a.updated; });
            var byCode = {}, cnt = { live: 0, pend: 0, ok: 0, rej: 0, empty: 0 }, people = {};
            list.forEach(function (o) {
                var R = []; try { R = JSON.parse(o.R || "[]"); } catch (e) {}
                o._R = R; o._st = compState(o); cnt[o._st]++; byCode[o.code] = o;
                var names = {}; R.forEach(function (r) { (r.rows || []).forEach(function (x) { if (x.u) { names[x.u] = x.n; people[x.u] = 1; } }); }); o._names = names;
            });
            box.byCode = byCode;
            $id("aCompCount").textContent = list.length + " yarışma" + (cnt.pend ? " · " + cnt.pend + " onay bekliyor" : "");
            if (adminTabs.badge) adminTabs.badge("ev", cnt.pend);
            var tile = function (k, label, v) { return '<button class="cp-tile' + (compTab === k ? " on" : "") + (k === "pend" && v ? " hot" : "") + '" data-tab="' + k + '"><b>' + v + '</b><span>' + label + '</span></button>'; };
            var head = '<div class="cp-tiles">' + tile("pend", "⏳ Onay bekleyen", cnt.pend) + tile("live", "🔴 Canlı", cnt.live) + tile("ok", "✓ Onaylı", cnt.ok) + tile("rej", "✗ Reddedilen", cnt.rej) + tile("all", "Tümü", list.length) + tile("cert", "🎓 Sertifikalar", certCount(list)) + '</div>' +
                '<p class="a-note" style="margin:6px 0 10px">👥 Toplam ' + Object.keys(people).length + ' farklı yarışmacı. ' +
                (compTab === "pend" ? 'Biten yarışmaların süreleri <b>sen onaylayana kadar</b> rekor tablosuna, profillere, şampiyonluklara ve sertifikalara girmez. Süreye dokunarak düzelt ya da DNF yap; hileli kişiyi 🚫 ile diskalifiye et; sonra <b>Onayla</b>.' : '') + '</p>';
            if (compTab === "cert") { box.innerHTML = head + certList(list); bindCompList(box); bindCompExtras(box, byCode); bindCertSearch(box); return; }
            var shown = list.filter(function (o) { return compTab === "all" ? true : o._st === compTab; });
            box.innerHTML = head + (shown.length ? shown.map(function (o) { return compCard(o); }).join("") : '<p class="a-note">' + (compTab === "pend" ? "Onay bekleyen yarışma yok ✓" : "Bu listede yarışma yok.") + '</p>');
            bindCompList(box); bindCompExtras(box, byCode);
        }, function (e) { box.innerHTML = '<p class="a-note">Yarışmalar yüklenemedi (' + esc(e && e.message) + ') — kuralları yayımladın mı?</p>'; });
    }
    // Sertifikalar: onaylı (ya da özellikten önceki) yarışmaların final ilk 3'ü — herkesinkini indir
    function certFinals(list) {
        var out = [];
        list.forEach(function (o) {
            if (o._st !== "ok") return;
            o._R.forEach(function (r, ri) { if (r.f && (r.rows || []).length) out.push({ o: o, r: r, ri: ri }); });
        });
        return out;
    }
    function certCount(list) { var n = 0; certFinals(list).forEach(function (x) { n += Math.min(3, x.r.rows.length); }); return n; }
    // Kişi kişi: isme dokununca altında o kişinin bütün sertifikaları açılır
    function certList(list) {
        var F = certFinals(list);
        if (!F.length) return '<p class="a-note">Henüz sertifika yok. Final turu olan yarışmalar onaylanınca ilk 3 burada çıkar.</p>';
        var P = {}, order = [];
        F.forEach(function (x) {
            x.r.rows.slice(0, 3).forEach(function (row, i) {
                var k = row.u || ("n:" + row.n), e = P[k];
                if (!e) { e = P[k] = { n: row.n, u: row.u, m: [0, 0, 0], c: [] }; order.push(k); }
                e.m[i]++; e.c.push({ x: x, row: row, i: i, ts: x.o.updated || 0 });
            });
        });
        var people = order.map(function (k) { return P[k]; }).sort(function (a, b) { return b.m[0] - a.m[0] || b.m[1] - a.m[1] || b.m[2] - a.m[2] || a.n.localeCompare(b.n, "tr"); });
        var res = function (row, r) {
            if (row.a != null && row.a < 99999999) return "Ao" + (r.s || 5) + " " + tFmt(row.a);
            var ok = (row.t || []).filter(function (t) { return t > 0 && t < 99999999; });
            return ok.length ? "en iyi " + tFmt(Math.min.apply(null, ok)) : "DNF";
        };
        return '<input type="search" class="cp-search" id="cpCertQ" placeholder="İsim ya da yarışma ara…" autocomplete="off">' +
            '<p class="a-note" style="margin:0 0 8px">' + people.length + ' kişi · ' + certCount(list) + ' sertifika. İsme dokun, sertifikaları açılsın.</p>' +
            '<div class="cp-people">' + people.map(function (e) {
                var q = (e.n + " " + e.c.map(function (c) { return c.x.o.name || ""; }).join(" ")).toLocaleLowerCase("tr");
                return '<details class="cp-person" data-q="' + esc(q) + '"><summary><span class="nm">' + esc(e.n) + '</span>' +
                    '<span class="md">' + (e.m[0] ? '<span class="g">🥇' + e.m[0] + '</span>' : '') + (e.m[1] ? '<span class="s">🥈' + e.m[1] + '</span>' : '') + (e.m[2] ? '<span class="b">🥉' + e.m[2] + '</span>' : '') + '</span><span class="ch">▾</span></summary>' +
                    '<div class="cp-certs">' + e.c.sort(function (a, b) { return b.ts - a.ts; }).map(function (c) {
                        return '<div class="cp-cert p' + (c.i + 1) + '"><span class="m">' + ["🥇", "🥈", "🥉"][c.i] + '</span>' +
                            '<span class="t"><b>' + esc(c.x.o.name || c.x.o.code) + '</b><small>' + (c.x.o.ev === "222" ? "2x2" : "3x3") + ' · ' + (c.i + 1) + '. · ' + res(c.row, c.x.r) + ' · ' + esc(dateFmt(c.x.o.updated).split(" ")[0]) + '</small></span>' +
                            '<button class="a-btn sm main" data-rcert="' + esc(c.x.o.code) + '|' + c.x.ri + '|' + c.i + '">İndir</button></div>';
                    }).join("") + '</div></details>';
            }).join("") + '</div>';
    }
    function bindCertSearch(box) {
        var q = $id("cpCertQ"); if (!q) return;
        q.addEventListener("input", function () { var v = q.value.trim().toLocaleLowerCase("tr"); Array.prototype.forEach.call(box.querySelectorAll(".cp-person"), function (c) { c.hidden = !!v && c.getAttribute("data-q").indexOf(v) < 0; }); });
    }
    function compCard(o, open) {
        var ev = o.ev === "222" ? "2x2" : "3x3", R = o._R, st = o._st, names = o._names, edit = st === "pend" || o._editing;
        var fin = R.filter(function (r) { return r.f; }).pop(), champ = fin && fin.rows && fin.rows[0];
        var nP = 0; R.forEach(function (r) { nP = Math.max(nP, (r.rows || []).length); });
        var chip = { live: '<span class="cp-chip live">● Canlı · ' + (o.st === "lobby" ? "lobi" : o.st === "prep" ? "hazırlık" : o.fin ? "final" : "tur " + (o.round || 1)) + '</span>', pend: '<span class="cp-chip pend">⏳ Onay bekliyor</span>',
            ok: '<span class="cp-chip done">✓ Onaylı</span>', rej: '<span class="cp-chip rej">✗ Reddedildi</span>', empty: '<span class="cp-chip idle">Sonuç yok</span>' }[st];
        var mods = String(o.mods || "").split(",").filter(Boolean).map(function (u) { return esc(names[u] || u.slice(0, 6) + "…"); }).join(", ");
        var rounds = R.map(function (r, ri) {
            var acts = window.RACompShare && (r.rows || []).length && !edit ? '<span class="cp-acts"><button class="a-btn sm" data-rimg="' + esc(o.code) + '|' + ri + '" title="Sonuç görselini indir">🖼️</button><button class="a-btn sm" data-rtxt="' + esc(o.code) + '|' + ri + '" title="Sonuç metnini kopyala">📝</button>' +
                (r.f && st === "ok" ? (r.rows || []).slice(0, 3).map(function (x, i) { return '<button class="a-btn sm" data-rcert="' + esc(o.code) + '|' + ri + '|' + i + '" title="Sertifika: ' + esc(x.n) + '">🎓' + (i + 1) + '</button>'; }).join("") : '') + '</span>' : '';
            return '<div class="cp-round"><div class="cp-rh"><b>' + (r.f ? "🏆 Final" : "Tur " + r.n) + '</b><small>' + (r.rows || []).length + ' kişi · Ao' + (r.s || 5) + '</small>' + acts + '</div>' +
                '<table class="cp-t"><tbody>' + (r.rows || []).map(function (x, i) {
                    var sus = window.RACompShare ? RACompShare.suspect(x.t, o.ev) : {}, sk = Object.keys(sus);
                    var tl = (x.t || []).map(function (t, k) {
                        var cls = (sus[k] ? "s" : "") + (x._ed && x._ed[k] ? " e" : "");
                        return edit ? '<button class="cp-tm ' + cls + '" data-ed="' + esc(o.code) + '|' + ri + '|' + esc(x.u) + '|' + k + '" title="' + esc(sus[k] || "Düzelt / DNF") + '">' + tFmt(t) + '</button>' : '<span class="' + cls + '">' + tFmt(t) + '</span>';
                    }).join("");
                    return '<tr' + (i === 0 ? ' class="w"' : '') + '><td class="p">' + (["🥇", "🥈", "🥉"][i] || (i + 1) + ".") + '</td><td class="n">' + esc(x.n) +
                        (sk.length ? ' <span class="cp-sus" title="' + esc(sk.map(function (k) { return (+k + 1) + ". çözüm: " + sus[k]; }).join(" · ")) + '">⚠️</span>' : '') +
                        (edit ? ' <button class="cp-dq" data-dq="' + esc(o.code) + '|' + esc(x.u) + '" title="Diskalifiye et (tüm turlardan çıkar)">🚫</button>' : '') +
                        '<div class="tt">' + tl + '</div></td><td class="a">' + (x.a == null ? "-" : tFmt(x.a)) + '</td><td class="t">' + tl + '</td></tr>';
                }).join("") + '</tbody></table></div>';
        }).join("");
        var sus = 0; R.forEach(function (r) { (r.rows || []).forEach(function (x) { if (window.RACompShare && Object.keys(RACompShare.suspect(x.t, o.ev)).length) sus++; }); });
        // Onay ekranı: kişi kişi kontrol (her kişinin bütün turları tek kartta, "✓ Doğru" ile işaretlenir)
        if (edit) {
            var P = [], seen = {}, chk = o._chk || {};
            R.slice().reverse().forEach(function (r) { (r.rows || []).forEach(function (x) { if (!seen[x.u]) { seen[x.u] = 1; P.push({ u: x.u, n: x.n }); } }); });
            var nOk = P.filter(function (p) { return chk[p.u]; }).length;
            rounds = '<div class="cv-prog"><div class="cv-bar"><i style="width:' + (P.length ? Math.round(nOk * 100 / P.length) : 0) + '%"></i></div><b>' + nOk + ' / ' + P.length + ' kişi kontrol edildi</b>' +
                (nOk < P.length ? '<button class="a-btn sm" data-chkall="' + esc(o.code) + '">Hepsini doğru say</button>' : '') + '</div><div class="cv-list">' + P.map(function (p) {
                var any = false, lines = R.map(function (r, ri) {
                    var j = -1; (r.rows || []).forEach(function (x, q) { if (x.u === p.u) j = q; }); if (j < 0) return "";
                    var x = r.rows[j], sus = window.RACompShare ? RACompShare.suspect(x.t, o.ev) : {}; if (Object.keys(sus).length) any = true;
                    return '<div class="cv-r"><span class="cv-rn">' + (r.f ? "Final" : "Tur " + r.n) + '</span><span class="cv-rk">' + (["🥇", "🥈", "🥉"][j] || (j + 1) + ".") + '</span><span class="cv-ts">' + (x.t || []).map(function (t, k) {
                        return '<button class="cp-tm ' + (sus[k] ? "s" : "") + (x._ed && x._ed[k] ? " e" : "") + '" data-ed="' + esc(o.code) + '|' + ri + '|' + esc(p.u) + '|' + k + '" title="' + esc(sus[k] || "Düzelt / DNF") + '">' + tFmt(t) + '</button>';
                    }).join("") + '</span><span class="cv-a">Ao' + (r.s || 5) + ' <b>' + (x.a == null ? "—" : tFmt(x.a)) + '</b></span></div>';
                }).join("");
                return '<div class="cv-p' + (chk[p.u] ? " ok" : any ? " sus" : "") + '"><div class="cv-h"><b>' + esc(p.n) + '</b>' + (any ? '<span class="cv-flag">⚠️ şüpheli süre</span>' : '') +
                    '<a class="a-btn sm" href="/icerikler/profil?u=' + encodeURIComponent(p.u) + '" target="_blank" rel="noopener" title="Profil">👤</a>' +
                    '<button class="a-btn sm cv-ok' + (chk[p.u] ? " on" : "") + '" data-chk="' + esc(o.code) + '|' + esc(p.u) + '">' + (chk[p.u] ? "✓ Doğru" : "Doğru mu?") + '</button>' +
                    '<button class="a-btn danger sm" data-dq="' + esc(o.code) + '|' + esc(p.u) + '" title="Diskalifiye et">🚫</button></div>' + lines + '</div>';
            }).join("") + '</div><p class="a-note">Süreye dokun → düzelt ya da DNF yaz. Turuncu süreler şüpheli.</p>';
        }
        var review = edit ? '<div class="cp-rev">' + (o._dirty ? '<p class="cp-dirty">✏️ Düzeltmeler yapıldı (' + o._dirty.length + '): onaylayınca kaydedilir.</p>' : '') +
                (sus ? '<p class="cp-dirty" style="color:#d97706">⚠️ ' + sus + ' kişide şüpheli süre var, kontrol et.</p>' : '') +
                '<div class="a-ctrl"><button class="a-btn main" data-ok="' + esc(o.code) + '">✓ Onayla, rekorlara ekle</button><button class="a-btn danger" data-rej="' + esc(o.code) + '">✗ Reddet (hiç sayılmasın)</button>' +
                (o._dirty ? '<button class="a-btn" data-undo="' + esc(o.code) + '">↺ Düzeltmeleri geri al</button>' : '') + '</div></div>'
            : (st === "ok" || st === "rej") && (o.okBy || o.ok) ? '<div class="cp-rev"><p class="a-note">' + (st === "ok" ? "✓ Onaylandı" : "✗ Reddedildi") + (o.okTs ? " · " + esc(dateFmt(Date.parse(o.okTs) || 0)) : "") + (o.okNote ? " · " + esc(o.okNote) : "") + '</p>' +
                '<div class="a-ctrl"><button class="a-btn sm" data-reopen="' + esc(o.code) + '">↺ Yeniden incele</button></div></div>' : '';
        return '<details class="cp" data-code="' + esc(o.code) + '"' + (st === "live" ? ' data-live="1"' : '') + (open || st === "pend" ? ' open' : '') + '><summary>' +
            '<div class="cp-s1"><b>' + esc(o.name || "Ev yarışması") + '</b>' + chip + '</div>' +
            '<div class="cp-s2"><span class="mono">' + esc(o.code) + '</span><span>' + ev + '</span><span>' + (nP || "?") + ' / ' + (o.cap || "?") + ' kişi</span><span>' + R.length + ' tur</span>' +
            (champ ? '<span class="cp-champ">🏆 ' + esc(champ.n) + ' · ' + tFmt(champ.a) + '</span>' : '') + '<span class="a-note">' + esc(dateFmt(o.updated)) + '</span></div></summary>' +
            '<div class="cp-body"><div class="cp-meta"><span>👑 <b>' + esc(o.hName || "?") + '</b></span>' + (mods ? '<span>🛡️ ' + mods + '</span>' : '') + '<span>📅 ' + esc(dateFmt(o.created)) + '</span></div>' +
            (st === "live" ? '<h4>Yarışmacılar (canlı)</h4><div class="c-ps a-note">Açınca yüklenir…</div>' : '') +
            (rounds ? '<div class="cp-rhead"><h4>Tur sonuçları</h4>' + (window.RACompShare && R.length > 1 && !edit ? '<button class="a-btn sm" data-rall="' + esc(o.code) + '">🖼️ Tüm görseller</button>' : '') + '</div>' + rounds : '<p class="a-note">Henüz biten tur yok.</p>') +
            review +
            '<div class="a-ctrl" style="margin-top:10px"><a class="a-btn sm" href="/icerikler/ev-yarismasi?ev=' + esc(o.code) + '" target="_blank" rel="noopener">👁 Aç</a>' +
            '<a class="a-btn sm" href="/icerikler/ev-yayin?ev=' + esc(o.code) + '" target="_blank" rel="noopener">📺 Yayın ekranı</a>' +
            (o.host ? '<a class="a-btn sm" href="/icerikler/profil?u=' + encodeURIComponent(o.host) + '" target="_blank" rel="noopener">👤 Oda sahibi</a>' : '') +
            '<button class="a-btn sm" data-rn="' + esc(o.code) + '">✏️ Adı değiştir</button>' +
            '<button class="a-btn danger sm" data-cd="' + esc(o.code) + '">🗑️ Sil</button></div></div></details>';
    }
    function redrawComp(box, o) {
        var old = box.querySelector('details[data-code="' + o.code + '"]'); if (!old) return;
        var t = document.createElement("div"); t.innerHTML = compCard(o, true); old.replaceWith(t.firstChild);
    }
    function compPatchAdmin(code, fields, del) {
        var body = {}, mask = Object.keys(fields).concat(del || []);
        Object.keys(fields).forEach(function (k) { var v = fields[k]; body[k] = typeof v === "number" ? { integerValue: String(v) } : v && v.ts ? { timestampValue: new Date().toISOString() } : { stringValue: String(v) }; });
        return authed(docsBase() + "/comps/" + code + "?" + mask.map(function (k) { return "updateMask.fieldPaths=" + k; }).join("&"), { method: "PATCH", body: JSON.stringify({ fields: body }) }).then(function (r) { return r.ok; }, function () { return false; });
    }
    function bindCompList(box) {
        if (box.raCompBound) return; box.raCompBound = 1;
        box.addEventListener("click", function (e) {
            var b = e.target.closest && e.target.closest("button,[data-tab]"); if (!b) return;
            var B = box.byCode || {}, g = function (a) { return (b.getAttribute(a) || "").split("|"); };
            if (b.hasAttribute("data-tab")) { compTab = b.getAttribute("data-tab"); renderComps(); return; }
            // süre düzelt / DNF
            if (b.hasAttribute("data-ed")) {
                e.preventDefault(); var k = g("data-ed"), o = B[k[0]], r = o && o._R[+k[1]], row = r && r.rows.filter(function (x) { return x.u === k[2]; })[0]; if (!row) return;
                var cur = row.t[+k[3]], v = prompt(row.n + " · " + (r.f ? "Final" : "Tur " + r.n) + " · " + (+k[3] + 1) + ". çözüm\nŞu an: " + tFmt(cur) + "\n\nYeni süreyi yaz (ör. 12.34 ya da 1:02.50) ya da DNF yaz:", cur >= DNFV ? "DNF" : (cur / 1000).toFixed(2));
                if (v == null) return; var ms = parseTimeIn(v); if (ms == null) { alert("Süre anlaşılamadı. Örnek: 12.34 ya da DNF"); return; }
                if (ms === cur) return;
                if (!o._orig) o._orig = JSON.stringify(o._R);
                row.t[+k[3]] = ms; row._ed = row._ed || {}; row._ed[+k[3]] = 1; reRank(r);
                (o._dirty = o._dirty || []).push(row.n + " " + (r.f ? "final" : "tur " + r.n) + " " + (+k[3] + 1) + ". çözüm: " + tFmt(cur) + " → " + tFmt(ms));
                redrawComp(box, o); return;
            }
            // diskalifiye: kişiyi bütün turlardan çıkar
            if (b.hasAttribute("data-dq")) {
                e.preventDefault(); var q = g("data-dq"), o2 = B[q[0]]; if (!o2) return;
                var nm = o2._names[q[1]] || "Bu kişi"; if (!confirm(nm + " diskalifiye edilsin mi? Bütün turlardan çıkarılır, süreleri hiç sayılmaz (onaylayınca kesinleşir).")) return;
                if (!o2._orig) o2._orig = JSON.stringify(o2._R);
                o2._R.forEach(function (r) { r.rows = (r.rows || []).filter(function (x) { return x.u !== q[1]; }); reRank(r); });
                (o2._dirty = o2._dirty || []).push(nm + " diskalifiye");
                redrawComp(box, o2); return;
            }
            if (b.hasAttribute("data-chk")) { e.preventDefault(); var c1 = g("data-chk"), oc1 = B[c1[0]]; if (!oc1) return; oc1._chk = oc1._chk || {}; oc1._chk[c1[1]] = !oc1._chk[c1[1]]; redrawComp(box, oc1); return; }
            if (b.hasAttribute("data-chkall")) { e.preventDefault(); var oc2 = B[b.getAttribute("data-chkall")]; if (!oc2) return; oc2._chk = oc2._chk || {}; oc2._R.forEach(function (r) { (r.rows || []).forEach(function (x) { oc2._chk[x.u] = 1; }); }); redrawComp(box, oc2); return; }
            if (b.hasAttribute("data-undo")) { var o3 = B[b.getAttribute("data-undo")]; if (o3 && o3._orig) { o3._R = JSON.parse(o3._orig); o3._orig = null; o3._dirty = null; redrawComp(box, o3); } return; }
            if (b.hasAttribute("data-ok") || b.hasAttribute("data-rej")) {
                var code = b.getAttribute("data-ok") || b.getAttribute("data-rej"), o4 = B[code], yes = b.hasAttribute("data-ok"); if (!o4) return;
                var note = yes ? (o4._dirty ? o4._dirty.join("; ") : "") : prompt("Reddetme nedeni (isteğe bağlı, ör. hileli süreler):", "");
                if (!yes && note == null) return;
                var unc = 0; if (yes) { var sn = {}; o4._R.forEach(function (r) { (r.rows || []).forEach(function (x) { if (!sn[x.u]) { sn[x.u] = 1; if (!(o4._chk || {})[x.u]) unc++; } }); }); }
                if (yes && unc && !confirm(unc + " kişiyi henüz kontrol etmedin. Yine de onaylansın mı?")) return;
                if (yes && !confirm(o4._dirty ? o4._dirty.length + " düzeltmeyle onaylansın mı? Sonuçlar rekorlara ve profillere işlenir." : "Sonuçlar olduğu gibi onaylansın mı? Rekorlara ve profillere işlenir.")) return;
                // düzeltme yapılmadıysa R'ye dokunma (yarışma hâlâ odadaysa sonuç ezilmesin)
                var f = { ok: yes ? 1 : -1, okBy: (Account.user && Account.user() && Account.user().uid) || "admin", okTs: { ts: 1 }, okNote: String(note || "").slice(0, 300) };
                if (o4._dirty) f.R = JSON.stringify(o4._R.map(function (r) { return { n: r.n, f: r.f, s: r.s, rows: r.rows.map(function (x) { return { u: x.u, n: x.n, t: x.t, a: x.a }; }) }; }));
                b.disabled = true;
                compPatchAdmin(code, f).then(function (ok) {
                    if (!ok) { b.disabled = false; alert("Kaydedilemedi. Güncel Firebase kurallarını yayınladın mı?"); return; }
                    msg($id("aCompMsg"), (yes ? "✓ " + (o4.name || code) + " onaylandı. Yarışmacılar siteye bir sonraki girişlerinde rekorları güncellenir." : "✗ " + (o4.name || code) + " reddedildi."), "ok");
                    renderComps();
                });
                return;
            }
            if (b.hasAttribute("data-rn")) {
                var rc = b.getAttribute("data-rn"), orn = B[rc]; if (!orn) return;
                var nn = prompt("Yarışmanın yeni adı (en çok 40 karakter):", orn.name || ""); if (nn == null) return;
                nn = nn.trim().slice(0, 40); if (!nn || nn === orn.name) return;
                b.disabled = true;
                compPatchAdmin(rc, { name: nn }).then(function (ok) {
                    b.disabled = false; if (!ok) { alert("Kaydedilemedi."); return; }
                    orn.name = nn; redrawComp(box, orn);
                    msg($id("aCompMsg"), "✓ Ad değişti: " + nn + ". Yarışmacıların profilinde birkaç dakika içinde (siteye girdiklerinde) güncellenir.", "ok");
                });
                return;
            }
            if (b.hasAttribute("data-cd")) {
                var cd = b.getAttribute("data-cd"), oc = B[cd];
                if (!confirm(cd + " yarışması ve tüm kayıtları silinsin mi?" + (oc && oc._st === "pend" ? "\n\nOnay bekliyordu: silinirse sonuçları hiç sayılmaz (reddetmekle aynı)." : ""))) return;
                b.disabled = true;
                deleteComp(cd).then(function (ok) { if (ok) renderComps(); else { b.disabled = false; alert("Silinemedi (kuralları yayımladın mı?)"); } });
                return;
            }
            if (b.hasAttribute("data-reopen")) {
                var c5 = b.getAttribute("data-reopen"); if (!confirm("Onay/ret kaldırılsın ve yeniden incelensin mi? (Siteye girmiş oyuncuların kayıtları değişmez; yeniden onaylayınca güncellenir.)")) return;
                compPatchAdmin(c5, {}, ["ok", "okBy", "okTs", "okNote"]).then(function (ok) { if (ok) { compTab = "pend"; renderComps(); } else alert("Kaydedilemedi."); });
            }
        });
    }
    function bindCompExtras(box, byCode) {
            // canlı odalarda yarışmacı listesi (çıkarma yalnız burada; biten odada kimse çıkarılamaz)
            Array.prototype.forEach.call(box.querySelectorAll("details[data-live]"), function (d) {
                d.addEventListener("toggle", function () {
                    if (!d.open || d.dataset.loaded) return; d.dataset.loaded = "1";
                    var code = d.getAttribute("data-code"), el = d.querySelector(".c-ps");
                    compPlayers(code).then(function (ps) {
                        if (!ps.length) { el.textContent = "Odada kimse yok."; return; }
                        el.classList.remove("a-note");
                        el.innerHTML = ps.map(function (p) {
                            return '<div class="cp-pl"><span class="n">' + esc(p.name || "?") + '</span><span class="mono small">' + String(p.t || "").split(",").filter(Boolean).map(tFmt).join("  ") + '</span>' +
                                '<a class="a-btn sm" href="/icerikler/profil?u=' + encodeURIComponent(p.uid) + '" target="_blank" rel="noopener" title="Profil">👤</a>' +
                                '<button class="a-btn danger sm" data-cp="' + esc(code) + '|' + esc(p.uid) + '" title="Odadan çıkar">Çıkar</button></div>';
                        }).join("");
                        Array.prototype.forEach.call(el.querySelectorAll("[data-cp]"), function (b) {
                            b.addEventListener("click", function () {
                                var x = b.getAttribute("data-cp").split("|"); if (!confirm("Bu yarışmacı odadan çıkarılsın mı?")) return;
                                b.disabled = true; delDoc("/comps/" + x[0] + "/p/" + x[1]).then(function (ok) { if (ok) b.closest(".cp-pl").remove(); else { b.disabled = false; alert("Çıkarılamadı."); } });
                            });
                        });
                    }, function () { el.textContent = "Yüklenemedi."; });
                });
            });
            // Tur sonuç görselleri (yarışma sayfasındakiyle aynı görsel: js/comp-share.js)
            var fileName = function (o, r) { return "ev-yarismasi-" + o.code + "-" + (r.f ? "final" : "tur" + r.n) + ".png"; };
            var saveImg = function (o, r) {
                return RACompShare.image(o, r).then(function (blob) {
                    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fileName(o, r);
                    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
                });
            };
            box.byCode = byCode;
            if (!box.raImgBound) box.raImgBound = 1, box.addEventListener("click", function (e) {
                var b = e.target.closest && e.target.closest("[data-rimg],[data-rtxt],[data-rall],[data-rcert]"); if (!b) return;
                e.preventDefault();
                var k = (b.getAttribute("data-rimg") || b.getAttribute("data-rtxt") || b.getAttribute("data-rall") || b.getAttribute("data-rcert")).split("|"), o = box.byCode[k[0]]; if (!o) return;
                if (b.hasAttribute("data-rcert")) {
                    var ci = RACompShare.certInfo(o, o._R[+k[1]], +k[2]); if (!ci) return;
                    ci.ts = o.updated || Date.now(); b.disabled = true;
                    RACompShare.downloadCert(ci).then(function () { b.disabled = false; }, function () { b.disabled = false; });
                    return;
                }
                var old = b.textContent;
                if (b.hasAttribute("data-rtxt")) {
                    var t = RACompShare.text(o, o._R[+k[1]]);
                    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = "✓ Kopyalandı"; }, function () { prompt("Sonuçlar:", t); })
                        .then(function () { setTimeout(function () { b.textContent = old; }, 1500); });
                    return;
                }
                b.disabled = true; b.textContent = "Hazırlanıyor…";
                var list2 = b.hasAttribute("data-rall") ? o._R.filter(function (r) { return (r.rows || []).length; }) : [o._R[+k[1]]];
                list2.reduce(function (p, r) { return p.then(function () { return saveImg(o, r); }).then(function () { return new Promise(function (res) { setTimeout(res, 400); }); }); }, Promise.resolve())
                    .then(function () { b.textContent = "✓ İndirildi"; }, function () { b.textContent = "İndirilemedi"; })
                    .then(function () { setTimeout(function () { b.disabled = false; b.textContent = old; }, 1800); });
            });
    }
    function cleanOldComps() {
        if (!confirm("3 günden eski, sonucu olmayan ya da reddedilmiş ev yarışmaları silinsin mi? (Onay bekleyenler ve onaylılar kalır.)")) return;
        var lim = Date.now() - 3 * 86400000;
        listComps().then(function (list) {
            // onay bekleyenler silinmez (önce incelenmeli); onaylı yarışmalar da geçmiş/şampiyon kaydı olarak kalır
            var old = list.filter(function (o) { var R = []; try { R = JSON.parse(o.R || "[]"); } catch (e) {} o._R = R; return o.updated < lim && (!R.length || o.ok === -1); });
            return Promise.all(old.map(function (o) { return deleteComp(o.code); })).then(function () { msg($id("aCompMsg"), old.length + " eski yarışma silindi ✓", "ok"); renderComps(); });
        }, function () { msg($id("aCompMsg"), "Silinemedi.", "bad"); });
    }

    /* ---------- kategori sekmeleri: paneli bölümlere ayırır, yalnız seçili kategori görünür ---------- */
    var ADM_CATS = [
        ["ev", "🏠", "Ev yarışmaları", ["Ev yarışmaları"]],
        ["users", "👥", "Kullanıcılar", ["Kullanıcılar", "En aktif kullanıcılar", "Hesapsız ziyaretçiler", "Günlük sıralama"]],
        ["notify", "🔔", "Bildirimler", ["Bildirim gönder", "Duyuru geçmişi"]],
        ["stats", "📊", "İstatistik", ["Genel bakış", "Site istatistikleri", "Cihaz, tarayıcı", "Firebase kullanımı"]],
        ["content", "🧩", "İçerik", ["Topluluk algoritma", "Puanlar ve geri bildirim", "Sponsor banner"]],
        ["system", "🛠️", "Sistem", ["Bakım modu", "Hata kayıtları"]]
    ];
    function adminTabs(root) {
        var boxes = Array.prototype.slice.call(root.querySelectorAll(":scope > .box"));
        boxes.forEach(function (b) {
            var h = (b.querySelector("h2") || {}).textContent || "", cat = "stats";
            ADM_CATS.forEach(function (c) { c[3].forEach(function (k) { if (h.indexOf(k) >= 0) cat = c[0]; }); });
            b.setAttribute("data-cat", cat);
        });
        var cur = "ev"; try { cur = (location.hash || "").slice(1) || localStorage.getItem("ra-adm-tab") || "ev"; } catch (e) {}
        if (!ADM_CATS.some(function (c) { return c[0] === cur; })) cur = "ev";
        var bar = document.createElement("nav"); bar.className = "adm-tabs"; bar.setAttribute("role", "tablist");
        bar.innerHTML = ADM_CATS.map(function (c) { return '<button type="button" role="tab" data-cat="' + c[0] + '"><span class="i">' + c[1] + '</span><span class="t">' + c[2] + '</span><b class="n" hidden></b></button>'; }).join("");
        var first = root.querySelector(":scope > .box"); root.insertBefore(bar, first);
        function show(c) {
            cur = c;
            boxes.forEach(function (b) { b.hidden = b.getAttribute("data-cat") !== c; });
            Array.prototype.forEach.call(bar.children, function (x) { var on = x.getAttribute("data-cat") === c; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
            try { localStorage.setItem("ra-adm-tab", c); history.replaceState(null, "", "#" + c); } catch (e) {}
            var on = bar.querySelector(".on"); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {}
        }
        bar.addEventListener("click", function (e) { var b = e.target.closest("[data-cat]"); if (!b) return; show(b.getAttribute("data-cat")); try { window.scrollTo({ top: bar.offsetTop - 70, behavior: "smooth" }); } catch (x) {} });
        show(cur);
        // onay bekleyen yarışma sayısı sekmede rozet olarak görünür
        adminTabs.badge = function (cat, n) { var b = bar.querySelector('[data-cat="' + cat + '"] .n'); if (b) { b.hidden = !n; b.textContent = n; } };
    }
    /* ---------- şikayetler (reports/{id}) ---------- */
    var REP_R = { spam: "Spam / reklam", abuse: "Hakaret / taciz", inappropriate: "Uygunsuz içerik", cheat: "Hile", impersonation: "Taklit", other: "Diğer" };
    function renderReports() {
        var box = $id("aRepList"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        authed(docsBase() + "/reports?pageSize=200", { method: "GET" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
            var L = (d.documents || []).map(function (x) { var f = x.fields || {}, o = { id: x.name.split("/").pop() }; Object.keys(f).forEach(function (k) { o[k] = gv(f, k); }); o.when = Date.parse(o.ts || x.createTime) || 0; return o; })
                .sort(function (a, b) { return b.when - a.when; });
            $id("aRepCount").textContent = L.length ? L.length + " açık şikayet" : "";
            if (adminTabs.badge) adminTabs.badge("users", L.length);
            var nm = function (uid) { var u = (_users || []).filter(function (x) { return x.uid === uid; })[0]; return u ? u.name : (uid || "?").slice(0, 8) + "…"; };
            box.innerHTML = L.length ? L.map(function (o) {
                return '<div class="rep-row" data-id="' + esc(o.id) + '"><div class="rep-h"><b>' + (o.t === "user" ? "👤 Profil" : "💬 Sohbet mesajı") + '</b><span class="cp-chip pend">' + esc(REP_R[o.r] || o.r || "?") + '</span><span class="a-note">' + esc(dateFmt(o.when)) + '</span></div>' +
                    '<div class="rep-x"><b>' + esc(o.tn || nm(o.tu)) + ':</b> ' + esc(o.x || "(içerik yok)") + '</div>' + (o.note ? '<div class="a-note">Not: ' + esc(o.note) + '</div>' : '') +
                    '<div class="a-note">Bildiren: ' + esc(nm(o.by)) + (o.ref ? ' · <span class="mono small">' + esc(o.ref) + '</span>' : '') + '</div>' +
                    '<div class="a-ctrl"><a class="a-btn sm" href="/icerikler/profil?u=' + encodeURIComponent(o.tu || "") + '" target="_blank" rel="noopener">👤 Profil</a>' +
                    (o.t === "chat" && /^comps\/[A-Z0-9]{5}\/m\/[\w-]+$/.test(o.ref || "") ? '<button class="a-btn danger sm" data-repdel="' + esc(o.ref) + '">🗑️ Mesajı sil</button>' : '') +
                    '<button class="a-btn sm" data-repok="' + esc(o.id) + '">✓ Kapat</button></div></div>';
            }).join("") : '<p class="a-note">Açık şikayet yok ✓</p>';
            Array.prototype.forEach.call(box.querySelectorAll("[data-repdel]"), function (b) { b.onclick = function () { if (!confirm("Bu sohbet mesajı silinsin mi?")) return; b.disabled = true; delDoc("/" + b.getAttribute("data-repdel")).then(function (ok) { b.textContent = ok ? "✓ Silindi" : "Silinemedi"; }); }; });
            Array.prototype.forEach.call(box.querySelectorAll("[data-repok]"), function (b) { b.onclick = function () { b.disabled = true; delDoc("/reports/" + b.getAttribute("data-repok")).then(function (ok) { if (ok) renderReports(); else { b.disabled = false; alert("Kapatılamadı (kuralları yayımladın mı?)"); } }); }; });
        }, function (e) { box.innerHTML = '<p class="a-note">Şikayetler yüklenemedi (' + esc(e && e.message) + ') — güncel Firebase kurallarını yayımladın mı?</p>'; });
    }
    /* ---------- bildirim formu: kime (herkes / aramalı kişi seçimi) ve ne zaman (hazır seçenekler) ---------- */
    function bcFormInit() {
        var sel = $id("bcTarget"), at = $id("bcAt"); if (!sel || bcFormInit.done) return; bcFormInit.done = 1;
        var who = "all", when = "now";
        function pad(n) { return String(n).padStart(2, "0"); }
        function local(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
        function label() {
            var name = who === "all" ? "Herkese" : (sel.options[sel.selectedIndex] || {}).text || "";
            if (who === "one" && sel.value === "all") name = "";
            var w = when === "now" || !at.value ? "şimdi gönder" : "planla · " + dateFmt(new Date(at.value).getTime());
            $id("bcSendTx").textContent = who === "one" && !name ? "👤 Önce kişiyi seç" : (when === "now" ? "🚀 " : "⏰ ") + name + " " + w;
            $id("bcSend").disabled = who === "one" && !name;
        }
        function list() {
            var q = ($id("bcSearch").value || "").trim().toLocaleLowerCase("tr"), opts = Array.prototype.slice.call(sel.options, 1);
            var hit = opts.filter(function (o) { return !q || o.text.toLocaleLowerCase("tr").indexOf(q) >= 0; }).slice(0, 30);
            $id("bcList").innerHTML = hit.length ? hit.map(function (o) { return '<button type="button" class="bc-u' + (sel.value === o.value ? " on" : "") + '" data-u="' + esc(o.value) + '"><span class="bc-av">' + esc((o.text || "?").trim().charAt(0).toLocaleUpperCase("tr")) + '</span>' + esc(o.text) + '</button>'; }).join("") : '<p class="a-note">Üye bulunamadı.</p>';
        }
        $id("bcText").addEventListener("input", function () { $id("bcCnt").textContent = this.value.length + "/500"; });
        $id("bcWho").addEventListener("click", function (e) {
            var b = e.target.closest("[data-who]"); if (!b) return; who = b.getAttribute("data-who");
            Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); });
            $id("bcPick").hidden = who !== "one"; if (who === "all") sel.value = "all"; else { sel.value = "all"; list(); $id("bcSearch").focus(); }
            label();
        });
        $id("bcSearch").addEventListener("input", list);
        $id("bcList").addEventListener("click", function (e) { var b = e.target.closest("[data-u]"); if (!b) return; sel.value = b.getAttribute("data-u"); list(); label(); });
        $id("bcWhen").addEventListener("click", function (e) {
            var b = e.target.closest("[data-w]"); if (!b) return; when = b.getAttribute("data-w");
            Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); });
            var d = new Date(); at.hidden = when !== "pick";
            if (when === "now") at.value = "";
            else if (when === "1h") at.value = local(new Date(d.getTime() + 3600000));
            else if (when === "eve") { d.setHours(20, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); at.value = local(d); }
            else if (when === "tom") { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); at.value = local(d); }
            else { if (!at.value) at.value = local(new Date(d.getTime() + 3600000)); at.focus(); }
            label();
        });
        at.addEventListener("input", label);
        bcFormInit.reset = function () { $id("bcCnt").textContent = "0/500"; when = "now"; at.hidden = true; Array.prototype.forEach.call($id("bcWhen").children, function (x, i) { x.classList.toggle("on", i === 0); }); label(); };
        label();
    }
    /* ---------- duyuru geçmişi ---------- */
    function renderBroadcasts() {
        var box = $id("aBcList"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        window.Account.listBroadcasts().then(function (list) {
            if (!list.length) { box.innerHTML = '<p class="a-note">Henüz duyuru yok.</p>'; return; }
            box.innerHTML = list.map(function (b) {
                var planned = b.at && b.at > Date.now();
                return '<div class="bc-row" data-id="' + esc(b.id) + '"><div class="bc-main"><p>' + esc(b.text) + '</p><small>' + (planned ? '⏰ Planlı: ' + esc(dateFmt(b.at)) : esc(dateFmt(b.at || b.ts)) + (b.pushed ? ' · 📱 telefona gitti' : '')) + '</small></div>' +
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

    /* ---------- hesapsız ziyaretçiler (anon/{id}) ---------- */
    function listAnon() {
        var out = [];
        function page(tok) {
            return authed(docsBase() + "/anon?pageSize=300" + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""), { method: "GET" })
                .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
                .then(function (d) {
                    (d.documents || []).forEach(function (x) { var f = x.fields || {}; out.push({ f: +gv(f, "f") || 0, l: +gv(f, "l") || 0, d: +gv(f, "d") || 0, s: +gv(f, "s") || 0, p: gv(f, "p") || "/", dev: gv(f, "dev") || "?" }); });
                    return d.nextPageToken && out.length < 30000 ? page(d.nextPageToken) : out;
                });
        }
        return page();
    }
    function renderAnon() {
        var box = $id("aAnon"), more = $id("aAnonMore"); if (!box) return;
        listAnon().then(function (list) {
            // ana sayfadaki kullanıcı sayısı için hesapsız cihaz sayısını da güncelle
            if (window.Account.getConfig && window.Account.setMemberCount) window.Account.getConfig().then(function (c) { if (c.visitors !== list.length) window.Account.setMemberCount(list.length, "visitors"); });
            var now = Date.now(), D = 86400000;
            function cnt(f) { return list.filter(f).length; }
            var sess = list.reduce(function (a, x) { return a + x.s; }, 0);
            var tiles = [["Son 24 saat", cnt(function (x) { return now - x.l < D; })], ["Son 7 gün", cnt(function (x) { return now - x.l < 7 * D; })], ["Son 30 gün", cnt(function (x) { return now - x.l < 30 * D; })],
                ["Toplam cihaz", list.length], ["Bugün ilk kez gelen", cnt(function (x) { return now - x.f < D; })], ["Toplam ziyaret (oturum)", sess], ["Geri dönen (2+ gün)", cnt(function (x) { return x.d >= 2; })]];
            box.innerHTML = tiles.map(function (t) { return '<div class="stat-tile"><b>' + t[1] + '</b><span>' + t[0] + '</span></div>'; }).join("");
            // son 14 gün: o gün son görülen cihazlar
            var bars = [];
            for (var i = 13; i >= 0; i--) {
                var day = new Date(now - i * D); day.setHours(0, 0, 0, 0); var a = day.getTime(), b = a + D;
                bars.push({ n: cnt(function (x) { return x.l >= a && x.l < b; }), d: ("0" + day.getDate()).slice(-2) + "." + ("0" + (day.getMonth() + 1)).slice(-2) });
            }
            var max = Math.max(1, Math.max.apply(null, bars.map(function (x) { return x.n; })));
            var week = list.filter(function (x) { return now - x.l < 7 * D; });
            function top(key) {
                var m = {}; week.forEach(function (x) { m[x[key]] = (m[x[key]] || 0) + 1; });
                return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, 8).map(function (k) { return '<li><span>' + esc(k) + '</span><b>' + m[k] + '</b></li>'; }).join("") || '<li class="a-note">Veri yok</li>';
            }
            more.innerHTML = '<h4 style="margin-top:14px">Son görülme günü (son 14 gün)</h4><div class="chart-bars">' + bars.map(function (x) {
                var h = Math.round(x.n / max * 100);
                return '<div class="cb" title="' + x.d + ': ' + x.n + ' cihaz"><span class="cb-v">' + (x.n || "") + '</span><span class="cb-bar" style="height:' + Math.max(h, x.n ? 6 : 2) + '%"></span><span class="cb-x">' + x.d + '</span></div>';
            }).join("") + '</div>' +
                '<div class="anon-two"><div><h4>Son girdiği sayfa (7 gün)</h4><ul class="anon-top">' + top("p") + '</ul></div><div><h4>Cihaz (7 gün)</h4><ul class="anon-top">' + top("dev") + '</ul></div></div>';
        }, function (e) { box.innerHTML = '<p class="a-note">Yüklenemedi (' + esc(e && e.message) + ') — kuralları yayımladın mı?</p>'; });
    }
    /* ---------- cihaz & tarayıcı dağılımı ---------- */
    function renderDevices() {
        var box = $id("aDevBox"), btn = $id("aDevLoad");
        if (!box) return;
        if (!_users.length) { box.innerHTML = '<p class="a-note">Önce kullanıcılar yüklensin.</p>'; return; }
        box.innerHTML = '<p class="a-note">Hesaplanıyor… (0/' + _users.length + ')</p>';
        if (btn) btn.disabled = true;
        var browsers = {}, oses = {}, langs = {}, themes = {}, cvds = {}, provs = {}, done = 0, total = _users.length;
        function bump(obj, k) { k = k || "Bilinmiyor"; obj[k] = (obj[k] || 0) + 1; }
        Promise.all(_users.map(function (u) {
            return fetchMeta(u.uid).then(function (m) {
                var dev = (m && m.dev) || "";
                var parts = dev.split("·");
                bump(browsers, (parts[0] || "").trim());
                bump(oses, (parts[1] || "").trim());
                bump(langs, m ? ({ tr: "Türkçe", en: "English" }[m.lang] || m.lang || "Türkçe (varsayılan)") : "");
                bump(themes, m ? (m.theme === "light" ? "☀️ Açık" : m.theme === "dark" ? "🌙 Koyu" : m.theme || "Varsayılan") : "");
                bump(cvds, m ? (m.cvd ? "Açık: " + m.cvd : "Kapalı") : "");
                bump(provs, m ? provLabel(m.provider) : "");
            }, function () { bump(browsers, ""); bump(oses, ""); }).then(function () {
                done++; var p = box.querySelector(".a-note"); if (p) p.textContent = "Hesaplanıyor… (" + done + "/" + total + ")";
            });
        })).then(function () {
            if (btn) btn.disabled = false;
            box.innerHTML = '<div class="dev-cols"><div><h4>Tarayıcı</h4>' + distHtml(browsers, total) + '</div>' +
                '<div><h4>İşletim sistemi</h4>' + distHtml(oses, total) + '</div>' +
                '<div><h4>Dil</h4>' + distHtml(langs, total) + '</div><div><h4>Tema</h4>' + distHtml(themes, total) + '</div>' +
                '<div><h4>Renk körlüğü modu</h4>' + distHtml(cvds, total) + '</div><div><h4>Giriş türü</h4>' + distHtml(provs, total) + '</div></div>';
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

    /* ---------- site istatistikleri (üyelerin profil özetlerinden; ek okuma yok) ---------- */
    function tiles(arr) { return arr.map(function (t) { return '<div class="stat-tile"><b>' + t[1] + '</b><span>' + t[0] + '</span></div>'; }).join(""); }
    function nf(n) { return (n || 0).toLocaleString("tr-TR"); }
    function renderSiteStats() {
        var box = $id("aSiteStats"); if (!box) return;
        if (!_users.length) { box.innerHTML = '<p class="a-note">Kullanıcılar yüklenince hesaplanır.</p>'; return; }
        var sm = 0, vc = 0, ev = 0, tr = 0, mag = 0, man = 0, magU = 0, manU = 0, cubes = {}, cubeUsers = 0;
        var rooms = 0, rounds = 0, wins = 0, compUsers = 0, rr = {}, top = [];
        _users.forEach(function (u) {
            var s = u.stats || {}, c = s.cnt || {};
            sm += c.sm || 0; vc += c.vc || 0; ev += c.ev || 0; tr += c.tr || s.solves || 0; mag += c.mag || 0; man += c.man || 0;
            if (c.mag) magU++; if (c.man) manU++;
            if (Array.isArray(s.cubes) && s.cubes.length) { cubeUsers++; s.cubes.forEach(function (n) { cubes[n] = (cubes[n] || 0) + 1; }); }
            var cp = s.comp;
            if (cp && (cp.rooms || cp.rounds)) {
                compUsers++; rooms += cp.rooms || 0; rounds += cp.rounds || 0; wins += cp.wins || 0;
                top.push({ n: u.name, r: cp.rooms || 0, w: cp.wins || 0, t: cp.rounds || 0 });
                (cp.list || []).forEach(function (x) { if (x.p) rr[x.c + ":" + x.r] = x.p; });
            }
        });
        var sizes = Object.keys(rr).map(function (k) { return rr[k]; }), avg = sizes.length ? (sizes.reduce(function (a, b) { return a + b; }, 0) / sizes.length) : 0;
        top.sort(function (a, b) { return b.r - a.r || b.w - a.w; });
        var inpT = mag + man;
        var evBox = $id("aEvStats");
        var evHtml =
            '<div class="stat-tiles">' + tiles([["Ev yarışması çözümü", nf(ev)]]) +
            tiles([["Yarışmaya katılan üye", compUsers], ["Oda girişi (toplam)", nf(rooms)], ["Oynanan tur (kişi×tur)", nf(rounds)], ["Ortalama tur büyüklüğü", avg ? avg.toFixed(1) + " kişi" : "—"], ["Şampiyonluk", wins]]) + '</div>' +
            (top.length ? '<h4 style="margin-top:12px">En çok yarışan</h4>' + top.slice(0, 8).map(function (x, i) { return '<div class="dist-row"><span class="dist-lbl">' + (i + 1) + '. ' + esc(x.n) + '</span><span class="a-note">' + x.r + ' oda · ' + x.t + ' tur · ' + x.w + ' 🏆</span></div>'; }).join("") : '') +
            '<h4 style="margin-top:12px">En aktif organizatörler (açık / son odalar)</h4><div id="aOrgTop"><p class="a-note">Yükleniyor…</p></div>' +
            '<h4 style="margin-top:14px">Süre giriş yöntemi</h4>' + (inpT ? '<p class="a-note" style="margin:0 0 6px">Kişi = o yöntemi en az bir kez kullanan üye; çözüm = o yöntemle girilen toplam süre (her tur 5 çözüm).</p>' +
                [["⌨️ Elle yazma", manU, man], ["⏱️ Timer (mıknatıs / kablolu / akıllı)", magU, mag]].map(function (r) { var pc = Math.round(100 * r[2] / inpT); return '<div class="dist-row"><span class="dist-lbl">' + r[0] + '</span><span class="a-note"><b>' + r[1] + ' kişi</b> · ' + nf(r[2]) + ' çözüm · %' + pc + '</span></div>'; }).join("") : '<p class="a-note">Henüz veri yok.</p>');
        if (evBox) evBox.innerHTML = evHtml;
        box.innerHTML =
            '<h4>Çözümler</h4><div class="stat-tiles">' + tiles([["Akıllı küp çözümü", nf(sm)], ["Sanal küp çözümü", nf(vc)], ["Antrenör denemesi", nf(tr)]]) + '</div>' +
            '<p class="a-note">Akıllı küp ve sanal küp sayıları kişi başı son 100 kayda kadar sayılır. Sayılar üyelerin profil özetinden gelir; üye siteye girdikçe güncellenir.</p>' +
            '<h4 style="margin-top:14px">Akıllı küp modelleri <span class="a-sub" style="margin:0">' + cubeUsers + ' üye bağlamış</span></h4>' + (cubeUsers ? distHtml(cubes, cubeUsers) : '<p class="a-note">Henüz veri yok (bundan sonra bağlanan küpler kaydedilir).</p>');
        listComps().then(function (list) {
            var o = {}; list.forEach(function (c) { var k = c.hName || "?"; o[k] = (o[k] || 0) + 1; });
            var e = $id("aOrgTop"); if (e) e.innerHTML = list.length ? distHtml(o, list.length) : '<p class="a-note">Şu an kayıtlı oda yok.</p>';
        }, function () { var e = $id("aOrgTop"); if (e) e.innerHTML = '<p class="a-note">Yüklenemedi.</p>'; });
    }

    /* ---------- topluluk algoritma önerileri ---------- */
    function renderSug() {
        var box = $id("aSugList"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        var q = { structuredQuery: { from: [{ collectionId: "s", allDescendants: true }], limit: 400 } };
        authed(docsBase() + ":runQuery", { method: "POST", body: JSON.stringify(q) }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (rows) {
            var list = (rows || []).filter(function (x) { return x.document && x.document.name.indexOf("/algsug/") > 0; }).map(function (x) {
                var f = x.document.fields || {}, path = x.document.name.split("/documents")[1], parts = path.split("/");
                var vs = (f.vs && f.vs.mapValue && f.vs.mapValue.fields) || {};
                return { path: path, cid: decodeURIComponent(parts[2] || ""), a: gv(f, "a") || "", n: gv(f, "n") || "?", u: gv(f, "u") || "", v: Object.keys(vs).length, ts: Date.parse(gv(f, "ts") || "") || 0 };
            });
            $id("aSugCount").textContent = list.length + " öneri";
            if (!list.length) { box.innerHTML = '<p class="a-note">Henüz öneri yok.</p>'; return; }
            var mode = ($id("aSugSort") || {}).value || "new";
            list.sort(function (a, b) { return mode === "vote" ? b.v - a.v || b.ts - a.ts : b.ts - a.ts; });
            box.innerHTML = list.slice(0, 150).map(function (x) {
                return '<div class="a-row2"><div style="min-width:0;flex:1"><b>' + esc(x.cid) + '</b> <span class="a-note">· ' + esc(x.n) + ' · ' + esc(dateFmt(x.ts)) + ' · 👍 ' + x.v + '</span><div class="mono small" style="word-break:break-word">' + esc(x.a) + '</div></div>' +
                    '<button class="a-btn danger sm" data-sd="' + esc(x.path) + '">Sil</button></div>';
            }).join("");
            Array.prototype.forEach.call(box.querySelectorAll("[data-sd]"), function (b) {
                b.onclick = function () {
                    if (!confirm("Bu öneri silinsin mi?")) return;
                    b.disabled = true;
                    delDoc(b.getAttribute("data-sd")).then(function (ok) { if (ok) b.closest(".a-row2").remove(); else { b.disabled = false; alert("Silinemedi (kuralları yayımladın mı?)"); } });
                };
            });
        }).catch(function (e) { box.innerHTML = '<p class="a-note">Öneriler yüklenemedi (' + esc(e && e.message) + '). Firebase kurallarını yayımladın mı?</p>'; });
    }

    /* ---------- rekor tablosu yönetimi: şüpheli dereceler ---------- */
    var REC_LIM = { s333: 4000, a5_333: 5500, a12_333: 6000, s222: 600, a5_222: 1000, a12_222: 1200 };
    var REC_LBL = { s333: "3x3 tekil", a5_333: "3x3 Ao5", a12_333: "3x3 Ao12", s222: "2x2 tekil", a5_222: "2x2 Ao5", a12_222: "2x2 Ao12" };
    function renderRecords() {
        var box = $id("aRecList"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        var q = { structuredQuery: { from: [{ collectionId: "records" }], limit: 500 } };
        authed(docsBase() + ":runQuery", { method: "POST", body: JSON.stringify(q) }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (rows) {
            var list = (rows || []).filter(function (x) { return x.document; }).map(function (x) {
                var f = x.document.fields || {}, o = { uid: x.document.name.split("/").pop(), name: gv(f, "name") || "?", flags: [] };
                Object.keys(REC_LIM).forEach(function (k) { o[k] = +gv(f, k) || 0; if (o[k] && o[k] < REC_LIM[k]) o.flags.push(REC_LBL[k] + " çok hızlı"); });
                [["333", "s333", "a5_333"], ["222", "s222", "a5_222"]].forEach(function (e) { if (o[e[2]] && o[e[1]] && o[e[2]] < o[e[1]]) o.flags.push(e[0] + " Ao5 tekilden hızlı"); });
                return o;
            });
            var onlyBad = $id("aRecBad") && $id("aRecBad").checked;
            var bad = list.filter(function (o) { return o.flags.length; });
            $id("aRecCount").textContent = list.length + " kişi · " + bad.length + " şüpheli";
            var show = (onlyBad ? bad : list).sort(function (a, b) { return b.flags.length - a.flags.length || (a.s333 || 9e9) - (b.s333 || 9e9); });
            if (!show.length) { box.innerHTML = '<p class="a-note">' + (onlyBad ? "Şüpheli derece yok ✓" : "Kayıt yok.") + '</p>'; return; }
            box.innerHTML = show.slice(0, 200).map(function (o) {
                // 3x3 ve 2x2: tekil · Ao5 · Ao12 (olmayan "—"); şüpheli değer kırmızı
                var cell = function (k) { var bad = o[k] && o[k] < REC_LIM[k]; return '<span' + (bad ? ' class="bad"' : '') + '>' + (o[k] ? tFmt(o[k]) : "—") + '</span>'; };
                var vals = '<div class="rec-g"><i></i><i>Tekil</i><i>Ao5</i><i>Ao12</i>' +
                    '<b>3x3</b>' + cell("s333") + cell("a5_333") + cell("a12_333") +
                    '<b>2x2</b>' + cell("s222") + cell("a5_222") + cell("a12_222") + '</div>';
                return '<div class="a-row2"><div style="min-width:0;flex:1"><b>' + esc(o.name) + '</b>' + (o.flags.length ? ' <span class="pill l">⚠ ' + esc(o.flags.join(", ")) + '</span>' : '') + vals + '</div>' +
                    '<a class="a-btn sm" href="/icerikler/profil?u=' + encodeURIComponent(o.uid) + '" target="_blank" rel="noopener">👤</a><button class="a-btn danger sm" data-rd="' + esc(o.uid) + '">Sil</button></div>';
            }).join("");
            Array.prototype.forEach.call(box.querySelectorAll("[data-rd]"), function (b) {
                b.onclick = function () {
                    if (!confirm("Bu kişinin rekor kaydı silinsin mi? (Kişi yeni bir yarışmaya girince rekorları yeniden yazılabilir; tekrarlarsa hesabı askıya al.)")) return;
                    b.disabled = true;
                    delDoc("/records/" + b.getAttribute("data-rd")).then(function (ok) { if (ok) b.closest(".a-row2").remove(); else { b.disabled = false; alert("Silinemedi."); } });
                };
            });
        }).catch(function (e) { box.innerHTML = '<p class="a-note">Rekorlar yüklenemedi (' + esc(e && e.message) + ').</p>'; });
    }

    /* ---------- hata kayıtları ---------- */
    function renderErrs() {
        var box = $id("aErrList"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        var q = { structuredQuery: { from: [{ collectionId: "errs" }], limit: 500 } };
        authed(docsBase() + ":runQuery", { method: "POST", body: JSON.stringify(q) }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (rows) {
            var docs = (rows || []).filter(function (x) { return x.document; }).map(function (x) {
                var f = x.document.fields || {};
                return { path: x.document.name.split("/documents")[1], m: gv(f, "m") || "", s: gv(f, "s") || "", l: +gv(f, "l") || 0, p: gv(f, "p") || "", ua: gv(f, "ua") || "", v: gv(f, "v") || "", ts: Date.parse(x.document.createTime) || 0 };
            });
            $id("aErrCount").textContent = docs.length + " kayıt";
            if (!docs.length) { box.innerHTML = '<p class="a-note">Hata kaydı yok ✓</p>'; return; }
            var g = {};
            docs.forEach(function (d) {
                var k = d.m + "|" + d.s + ":" + d.l, e = g[k] || (g[k] = { m: d.m, s: d.s, l: d.l, n: 0, last: 0, pages: {}, uas: {}, v: d.v, paths: [] });
                e.n++; e.paths.push(d.path); if (d.ts > e.last) { e.last = d.ts; e.v = d.v; }
                e.pages[d.p] = 1; e.uas[uaShort(d.ua)] = 1;
            });
            var arr = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.last - a.last; });
            box.innerHTML = arr.map(function (e, i) {
                return '<details class="duel-row"><summary><b>' + e.n + '×</b><span class="mono small" style="word-break:break-word">' + esc(e.m) + '</span><span class="a-note">' + esc(dateFmt(e.last)) + '</span></summary>' +
                    '<div class="duel-body"><div class="info-grid">' + infoRow("Dosya", '<span class="mono small">' + esc(e.s || "—") + (e.l ? ":" + e.l : "") + '</span>') +
                    infoRow("Sayfalar", esc(Object.keys(e.pages).join(", "))) + infoRow("Cihazlar", esc(Object.keys(e.uas).join(", "))) + infoRow("Son sürüm", esc(e.v || "—")) + '</div>' +
                    '<button class="a-btn danger sm" data-eg="' + i + '">🗑️ Bu hatanın kayıtlarını sil</button></div></details>';
            }).join("");
            Array.prototype.forEach.call(box.querySelectorAll("[data-eg]"), function (b) {
                b.onclick = function () {
                    var e = arr[+b.getAttribute("data-eg")]; b.disabled = true;
                    commit(e.paths.map(function (p) { return { delete: docName(p) }; })).then(function () { b.closest("details").remove(); }, function () { b.disabled = false; alert("Silinemedi."); });
                };
            });
            box.dataset.all = JSON.stringify(docs.map(function (d) { return d.path; }));
        }).catch(function (e) { box.innerHTML = '<p class="a-note">Hata kayıtları yüklenemedi (' + esc(e && e.message) + '). Firebase kurallarını yayımladın mı?</p>'; });
    }
    function uaShort(ua) {
        var b = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Diğer";
        var o = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "?";
        return b + "/" + o;
    }

    /* ---------- Firebase kullanımı (tahmini) ---------- */
    function countColl(coll) {
        var body = { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: coll }] }, aggregations: [{ alias: "n", count: {} }] } };
        return authed(docsBase() + ":runAggregationQuery", { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : []; }).then(function (a) {
            var x = a && a[0] && a[0].result && a[0].result.aggregateFields && a[0].result.aggregateFields.n; return x ? +x.integerValue : 0;
        }, function () { return null; });
    }
    function renderUsage() {
        var box = $id("aUsage"); if (!box) return;
        box.innerHTML = '<p class="a-note">Hesaplanıyor…</p>';
        var colls = [["users", "Üye profili"], ["comps", "Ev yarışması (biten dahil)"], ["records", "Rekor kaydı"], ["pushsubs", "Bildirim aboneliği"], ["anon", "Hesapsız cihaz"], ["errs", "Hata kaydı"], ["broadcasts", "Duyuru"]];
        Promise.all(colls.map(function (c) { return countColl(c[0]); }).concat([listComps().catch(function () { return []; })])).then(function (ns) {
            var now = Date.now(), d1 = 86400000, cl = ns.pop() || [];
            // "açık oda": yalnız son 6 saatte hareketi olan ve bitmemiş odalar (biten odalar geçmiş olarak durur, okuma yapmaz)
            var live = cl.filter(function (o) { return !(o.st === "end" && o.fin) && now - o.updated < 6 * 3600000; }).length, done = cl.length - live;
            var act = _users.filter(function (u) { return u.seen && now - u.seen < d1; }).length;
            var anonN = ns[4] || 0;
            // kaba tahmin: aktif üye başına ~60 okuma / ~15 yazma (senkron, profil, sıralamalar); hesapsız cihaz ~8 okuma; açık oda başına ~400 okuma
            var openRooms = live, estR = act * 60 + Math.round(anonN * 0.15) * 8 + openRooms * 400, estW = act * 15 + openRooms * 60;
            var pr = Math.round(estR / 50000 * 100), pw = Math.round(estW / 20000 * 100), lvl = Math.max(pr, pw);
            box.innerHTML = '<div class="stat-tiles">' + tiles([["Tahmini okuma / gün", nf(estR) + " <small>(%" + pr + ")</small>"], ["Tahmini yazma / gün", nf(estW) + " <small>(%" + pw + ")</small>"], ["Son 24 saat aktif üye", act], ["Açık (canlı) oda", openRooms + (done ? ' <small>· ' + done + ' biten</small>' : '')]]) + '</div>' +
                (lvl >= 70 ? '<p class="a-msg bad" style="display:block">⚠ Günlük ücretsiz kotanın %' + lvl + '\'ine yaklaşılmış olabilir. Kota dolarsa site verileri yarın 10:00\'a (TR) kadar yüklenmez. Eski odaları ve hata kayıtlarını temizle.</p>' : '<p class="a-note">✓ Kota rahat görünüyor.</p>') +
                '<p class="a-note">Ücretsiz plan: günde 50.000 okuma, 20.000 yazma, 20.000 silme. Bu değerler kaba bir tahmindir; gerçek kullanım için <a href="https://console.firebase.google.com/project/' + esc(cfg.projectId) + '/firestore/usage" target="_blank" rel="noopener">Firebase Console → Usage</a>.</p>' +
                '<h4 style="margin-top:12px">Belge sayıları</h4>' + colls.map(function (c, i) { return '<div class="dist-row"><span class="dist-lbl">' + c[1] + '</span><b>' + (ns[i] == null ? "?" : nf(ns[i])) + '</b></div>'; }).join("");
        });
    }

    /* ---------- geri bildirim / tema puanları (feedback) ---------- */
    function renderFeedback() {
        var box = $id("aFbList"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        var q = { structuredQuery: { from: [{ collectionId: "feedback" }], limit: 1000 } };
        authed(docsBase() + ":runQuery", { method: "POST", body: JSON.stringify(q) }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (rows) {
            var list = (rows || []).filter(function (x) { return x.document; }).map(function (x) {
                var f = x.document.fields || {};
                return { topic: gv(f, "topic") || "?", stars: +gv(f, "stars") || 0, text: gv(f, "text") || "", u: gv(f, "u") || "", ts: Date.parse(gv(f, "ts") || "") || 0 };
            });
            if (!list.length) { box.innerHTML = '<p class="a-note">Henüz puan yok.</p>'; return; }
            var by = {}; list.forEach(function (x) { (by[x.topic] = by[x.topic] || []).push(x); });
            box.innerHTML = Object.keys(by).map(function (t) {
                var a = by[t], avg = a.reduce(function (s, x) { return s + x.stars; }, 0) / a.length, dist = {};
                a.forEach(function (x) { dist[x.stars + " ★"] = (dist[x.stars + " ★"] || 0) + 1; });
                var ord = {}; [5, 4, 3, 2, 1].forEach(function (n) { if (dist[n + " ★"]) ord[n + " ★"] = dist[n + " ★"]; });
                var notes = a.filter(function (x) { return x.text; }).sort(function (x, y) { return y.ts - x.ts; });
                var name = function (uid) { var u = uid && findUser(uid); return u ? u.name : (uid ? "üye" : "hesapsız"); };
                return '<h4 style="margin-top:10px">' + esc(t.replace(/^tema-/, "") + " teması") + ' · <b>' + avg.toFixed(1) + ' ★</b> <span class="a-sub" style="margin:0">' + a.length + ' oy</span></h4>' + distHtml(ord, a.length) +
                    (notes.length ? '<div class="a-list" style="margin-top:8px">' + notes.map(function (x) { return '<div class="a-row2"><b>' + x.stars + '★</b><span style="flex:1">' + esc(x.text) + '</span><span class="a-note">' + esc(name(x.u)) + ' · ' + esc(dateFmt(x.ts)) + '</span></div>'; }).join("") + '</div>' : '<p class="a-note">Yorum yok.</p>');
            }).join("");
        }).catch(function (e) { box.innerHTML = '<p class="a-note">Yüklenemedi (' + esc(e && e.message) + '). Firebase kurallarını yayımladın mı?</p>'; });
    }

    /* ---------- sponsor banner'ı (config/ad) ---------- */
    function renderAd() {
        var box = $id("aAdBox"); if (!box) return;
        box.innerHTML = '<p class="a-note">Yükleniyor…</p>';
        authed(docsBase() + "/config/ad", { method: "GET" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var f = (d && d.fields) || {}, g = function (k) { return f[k] ? (f[k].stringValue != null ? f[k].stringValue : f[k].booleanValue) : ""; };
            var ad = { on: d ? !!g("on") : true, title: g("title") || "Minjuan Küp Mağazası", text: g("text") || "Tasarım ve zeka küpleri, speedcube'ler ve aksesuarlar Minjuan'da. Rubik Academy önerisi!", cta: g("cta") || "Küplere göz at", url: g("url") || "https://minjuanrong.com.tr/collections/tasarim-zeka-kupleri", img0: d ? "" : "/img/sponsor/minjuan-mark.png", img: g("img"), code: g("code"), where: g("where") || "all" };
            var inp = function (id, lb, v, ph, max) { return '<label class="ad-f"><span>' + lb + '</span><input id="' + id + '" maxlength="' + max + '" value="' + esc(v) + '" placeholder="' + esc(ph) + '"></label>'; };
            box.innerHTML = '<label class="mt-tog"><input type="checkbox" id="adOn"' + (ad.on ? ' checked' : '') + '> <span>Banner yayında</span></label>' +
                '<div class="ad-grid">' + inp("adTitle", "Başlık", ad.title, "Minjuan Küp", 60) + inp("adCta", "Buton yazısı", ad.cta, "Alışverişe başla", 30) +
                '<label class="ad-f ad-wide"><span>Metin</span><textarea id="adText" maxlength="220" rows="2">' + esc(ad.text) + '</textarea></label>' +
                inp("adUrl", "Bağlantı (https://…)", ad.url, "https://minjuan…", 300) + inp("adImg", "Görsel bağlantısı (isteğe bağlı)", ad.img || ad.img0, "https://…/logo.png", 500) +
                inp("adCode", "İndirim kodu (isteğe bağlı)", ad.code, "RUBIK10", 30) +
                '<label class="ad-f"><span>Nerede görünsün</span><select id="adWhere"><option value="all">Tüm sayfalar</option><option value="home">Ana sayfa + İçerikler</option><option value="cekilis">Sadece çekiliş sayfası</option></select></label></div>' +
                '<h4 style="margin:12px 0 0">Önizleme</h4><div id="adPrev"></div>' +
                '<div><button class="a-btn main" id="adSave">Kaydet</button><span class="a-msg" id="adMsg" style="margin:0 0 0 8px"></span></div>' +
                '<p class="a-note">Zamanlayıcı, antrenör, akıllı küp, sanal küp, giriş ve admin sayfalarında banner çıkmaz. Ziyaretçi kapatırsa o cihazda 1 gün görünmez (içeriği değiştirince yeniden görünür). Değişiklik ziyaretçilere en geç 30 dakikada yansır. Bağlantıya utm_source=rubikacademy eklenir; tıklamaları mağaza kendi istatistiğinde görebilir.</p>';
            $id("adWhere").value = ad.where;
            var cur = function () { return { on: $id("adOn").checked, title: $id("adTitle").value.trim(), text: $id("adText").value.trim(), cta: $id("adCta").value.trim(), url: $id("adUrl").value.trim(), img: $id("adImg").value.trim(), code: $id("adCode").value.trim(), where: $id("adWhere").value }; };
            var prev = function () { if (window.RAAd) RAAd.preview($id("adPrev"), cur()); };
            Array.prototype.forEach.call(box.querySelectorAll("input,textarea,select"), function (x) { x.addEventListener("input", prev); x.addEventListener("change", prev); });
            setTimeout(prev, 300);
            $id("adSave").addEventListener("click", function () {
                var o = cur();
                if (o.url && !/^https:\/\//.test(o.url)) { msg($id("adMsg"), "Bağlantı https:// ile başlamalı.", "bad"); return; }
                if (o.img && !/^https:\/\//.test(o.img) && !/^\/img\//.test(o.img)) { msg($id("adMsg"), "Görsel bağlantısı https:// ile başlamalı.", "bad"); return; }
                if (o.on && !o.url) { msg($id("adMsg"), "Yayına almak için bağlantı gir.", "bad"); return; }
                var fields = { on: { booleanValue: o.on }, ver: { stringValue: String(Date.now()) } };
                ["title", "text", "cta", "url", "img", "code", "where"].forEach(function (k) { fields[k] = { stringValue: o[k] }; });
                $id("adSave").disabled = true; msg($id("adMsg"), "Kaydediliyor…");
                authed(docsBase() + "/config/ad", { method: "PATCH", body: JSON.stringify({ fields: fields }) }).then(function (r) {
                    $id("adSave").disabled = false;
                    if (r.ok) { if (window.RAAd) RAAd.clearCache(); msg($id("adMsg"), o.on ? "Kaydedildi ✓ Banner yayında." : "Kaydedildi ✓ (yayında değil)", "ok"); }
                    else msg($id("adMsg"), "Kaydedilemedi (" + r.status + ").", "bad");
                }, function () { $id("adSave").disabled = false; msg($id("adMsg"), "Kaydedilemedi.", "bad"); });
            });
        }).catch(function () { box.innerHTML = '<p class="a-note">Yüklenemedi.</p>'; });
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
            '<div class="box cp-sec" id="aEvSec"><h2>🏠 Ev yarışmaları <span class="a-sub" id="aCompCount" style="margin:0"></span></h2>' +
            '<div class="a-ctrl"><button class="a-btn main" id="aCompLoad">↻ Yenile</button><button class="a-btn danger" id="aCompClean">🧹 Eski boş / reddedilmişleri sil</button></div>' +
            '<div class="a-msg" id="aCompMsg"></div><div id="aCompList" class="a-list"></div>' +
            '<h3 class="cp-h3">📊 Ev yarışması istatistikleri</h3><div id="aEvStats"><p class="a-note">Kullanıcılar yüklenince hesaplanır.</p></div>' +
            '<h3 class="cp-h3">🏆 Rekor tablosu yönetimi <span class="a-sub" id="aRecCount" style="margin:0"></span></h3>' +
            '<div class="a-ctrl"><button class="a-btn main" id="aRecLoad">↻ Yükle</button><label class="a-note"><input type="checkbox" id="aRecBad" checked> Yalnız şüpheliler</label></div>' +
            '<p class="a-note">Şüpheli: 3x3 tekil 4 sn, Ao5 5,5 sn, Ao12 6 sn altı; 2x2 tekil 0,6 sn, Ao5 1 sn, Ao12 1,2 sn altı ya da ortalaması tekilinden hızlı olanlar.</p><div id="aRecList" class="a-list"></div>' +
            '<p class="a-note" style="margin-top:12px">Yarışmalar herkese açık sayfada: <a href="/icerikler/ev-yarismasi" target="_blank" rel="noopener">Ev yarışması</a> · <a href="/icerikler/rekorlar" target="_blank" rel="noopener">Rekor tablosu</a></p></div>' +
            '<div class="box"><h2>👤 Hesapsız ziyaretçiler</h2><p class="a-note">Giriş yapmadan siteyi kullanan cihazlar (her cihaz bir kez sayılır, oturum başına güncellenir).</p><div id="aAnon" class="stat-tiles"><p class="a-note">Yükleniyor…</p></div><div id="aAnonMore"></div></div>' +
            '<div class="box"><h2>🔔 Bildirim gönder</h2>' +
            '<div class="bc-form">' +
            '<div class="bc-step"><span class="bc-lbl">1 · Mesaj</span><div class="bc-ta"><textarea id="bcText" maxlength="500" rows="3" placeholder="Ör. Bu akşam 21.00\'de ev yarışması var, kaçırma! 🏠"></textarea><span class="bc-cnt" id="bcCnt">0/500</span></div></div>' +
            '<div class="bc-step"><span class="bc-lbl">2 · Kime</span><div class="bc-seg" id="bcWho"><button type="button" class="on" data-who="all">📢 Herkese</button><button type="button" data-who="one">👤 Bir kişiye</button></div>' +
            '<div class="bc-pick" id="bcPick" hidden><input type="search" id="bcSearch" placeholder="Üye ara…" autocomplete="off"><div class="bc-list" id="bcList"></div></div>' +
            '<select id="bcTarget" hidden><option value="all">📢 Herkese (duyuru)</option></select></div>' +
            '<div class="bc-step"><span class="bc-lbl">3 · Ne zaman</span><div class="bc-chips" id="bcWhen"><button type="button" class="on" data-w="now">⚡ Şimdi</button><button type="button" data-w="1h">1 saat sonra</button><button type="button" data-w="eve">Bu akşam 20:00</button><button type="button" data-w="tom">Yarın 10:00</button><button type="button" data-w="pick">📅 Tarih seç</button></div>' +
            '<input type="datetime-local" id="bcAt" class="bc-dt" hidden></div>' +
            '<button class="bc-send" id="bcSend"><span id="bcSendTx">🚀 Herkese şimdi gönder</span></button><span class="a-msg" id="bcMsg"></span>' +
            '<p class="a-note">Bildirime izin verenlere telefon/sistem bildirimi, herkese site içi bildirim olarak düşer. Telefon bildirimi birkaç dakika içinde ulaşır.</p></div></div>' +
            '<div class="box"><h2>📜 Duyuru geçmişi <button class="a-btn sm" id="bcReload" style="float:right">↻</button></h2><div id="aBcList"><p class="a-note">Yükleniyor…</p></div></div>' +
            '<div class="box"><h2>👥 Kullanıcılar <span class="a-sub" id="aUsersCount" style="margin:0"></span></h2>' +
            '<div class="a-ctrl"><input id="uSearch" placeholder="Ada göre ara…" style="flex:1;min-width:140px"><select id="uFilter"><option value="all">Tümü</option><option value="a1">Son 24 saat aktif</option><option value="a7">Son 7 gün aktif</option><option value="pasif">30 günden eski</option></select><button class="a-btn" id="aUsersLoad">↻ Yenile</button><button class="a-btn" id="uCsv">⬇ CSV</button><button class="a-btn" id="uJson">⬇ JSON</button></div>' +
            '<div class="bulk-bar" id="uBulk" hidden><b id="uSelCount">0</b> seçili · <select id="uBulkRole"><option value="">Rol ata…</option><option value="uye">Üye</option><option value="admin">Admin</option><option value="gelistirici">Geliştirici</option><option value="tester">Tester</option><option value="organizator">Organizatör</option></select> <button class="a-btn sm" id="uBulkRoleGo">Uygula</button> <button class="a-btn sm" id="uBulkNotify">Bildirim gönder</button><span class="a-msg" id="uBulkMsg" style="margin:0"></span></div>' +
            '<div id="aUsersList"></div></div>' +
            '<div class="box"><h2>🚩 Şikayetler <span class="a-sub" id="aRepCount" style="margin:0"></span></h2><p class="a-note">Kullanıcıların uygulama içinden bildirdiği sohbet mesajları ve profiller (Google Play kullanıcı içeriği kuralı). İncele, gerekirse içeriği sil ya da hesabı askıya al, sonra kapat.</p><div class="a-ctrl"><button class="a-btn main" id="aRepLoad">↻ Yükle</button></div><div id="aRepList" class="a-list"></div></div>' +
            '<div class="box"><h2>🏅 En aktif kullanıcılar</h2><div id="aActive"><p class="a-note">Yükleniyor…</p></div></div>' +
            '<div class="box"><h2>🖥️ Cihaz, tarayıcı &amp; tercihler</h2><p class="a-note">Her üyenin cihaz, dil, tema, renk körlüğü modu ve giriş türü bilgisini çeker (üye başına 1 okuma, biraz sürebilir).</p><button class="a-btn main" id="aDevLoad">Hesapla</button><div id="aDevBox" style="margin-top:10px"></div></div>' +
            '<div class="box"><h2>📈 Site istatistikleri</h2><div id="aSiteStats"><p class="a-note">Yükleniyor…</p></div></div>' +
            '<div class="box"><h2>💡 Topluluk algoritma önerileri <span class="a-sub" id="aSugCount" style="margin:0"></span></h2>' +
            '<div class="a-ctrl"><button class="a-btn main" id="aSugLoad">↻ Yükle</button><select id="aSugSort"><option value="new">En yeni</option><option value="vote">En çok oy</option></select></div><div id="aSugList" class="a-list"></div></div>' +
            '<div class="box"><h2>🐞 Hata kayıtları <span class="a-sub" id="aErrCount" style="margin:0"></span></h2>' +
            '<p class="a-note">Ziyaretçilerin tarayıcısında oluşan JavaScript hataları (aynı hata gruplanır).</p>' +
            '<div class="a-ctrl"><button class="a-btn main" id="aErrLoad">↻ Yükle</button><button class="a-btn danger" id="aErrClear">🗑️ Tümünü sil</button></div><div id="aErrList" class="a-list"></div></div>' +
            '<div class="box"><h2>🔥 Firebase kullanımı</h2><button class="a-btn main" id="aUsageLoad">Hesapla</button><div id="aUsage" style="margin-top:10px"></div></div>' +
            '<div class="box"><h2>⭐ Puanlar ve geri bildirim</h2><p class="a-note">Biten temalar için kullanıcıların verdiği puanlar ve yorumlar.</p><button class="a-btn main" id="aFbLoad">↻ Yükle</button><div id="aFbList" style="margin-top:8px"></div></div>' +
            '<div class="box"><h2>📣 Sponsor banner\'ı</h2><p class="a-note">Sitedeki reklam alanı (ör. Minjuan küp mağazası).</p><div id="aAdBox"></div></div>' +
            '<div class="box"><h2>🛠️ Bakım modu</h2><p class="a-note">Açıkken site, sen hariç herkese “Bakımdayız” sayfası gösterir.</p><div id="aMaintBox"><p class="a-note">Yükleniyor…</p></div></div>' +
            '<div class="box"><h2>🏆 Günlük sıralama moderasyonu</h2>' +
            '<div class="a-ctrl"><input type="date" id="aDate" value="' + todayStr() + '"><button class="a-btn main" id="aDailyLoad">↻ Yenile</button><button class="a-btn" id="aDailyCsv">⬇ CSV</button></div>' +
            '<div class="day-chips" id="aDayChips"></div>' +
            '<p class="a-note">Yanlış bir süreyi sil; o kullanıcı o gün için yeniden gönderebilir.</p>' +
            '<div class="a-msg" id="aDailyMsg"></div><div id="aDailyList" class="a-list"></div></div>';
        adminTabs(root);
        $id("aDailyLoad").addEventListener("click", function () { renderDaily(); renderDayChips(); });
        $id("aDate").addEventListener("change", renderDaily);
        $id("aDayChips").addEventListener("click", function (e) { var b = e.target.closest(".day-chip"); if (!b) return; $id("aDate").value = b.getAttribute("data-ds"); renderDaily(); });
        $id("aUsersLoad").addEventListener("click", renderUsers);
        $id("uCsv").addEventListener("click", function () { exportUsers("csv"); });
        $id("uJson").addEventListener("click", function () { exportUsers("json"); });
        $id("aDailyCsv").addEventListener("click", exportDaily);
        $id("aCompLoad").addEventListener("click", renderComps);
        $id("aCompClean").addEventListener("click", cleanOldComps);
        $id("uSearch").addEventListener("input", applyUserFilter);
        $id("uFilter").addEventListener("change", applyUserFilter);
        $id("bcReload").addEventListener("click", renderBroadcasts);
        $id("aDevLoad").addEventListener("click", renderDevices);
        $id("aRecLoad").addEventListener("click", renderRecords); $id("aRecBad").addEventListener("change", renderRecords);
        $id("aSugLoad").addEventListener("click", renderSug); $id("aSugSort").addEventListener("change", renderSug);
        $id("aErrLoad").addEventListener("click", renderErrs);
        $id("aErrClear").addEventListener("click", function () {
            var all = []; try { all = JSON.parse($id("aErrList").dataset.all || "[]"); } catch (e) {}
            if (!all.length || !confirm(all.length + " hata kaydı silinsin mi?")) return;
            commit(all.map(function (p) { return { delete: docName(p) }; })).then(renderErrs, function () { alert("Silinemedi."); });
        });
        $id("aUsageLoad").addEventListener("click", renderUsage);
        $id("aFbLoad").addEventListener("click", renderFeedback);
        bindBulk(); renderBroadcasts(); renderMaintenance(); renderAnon(); renderAd();
        bcFormInit();
        if ($id("aRepLoad")) { $id("aRepLoad").addEventListener("click", renderReports); renderReports(); }
        $id("bcSend").addEventListener("click", function () {
            var text = $id("bcText").value.trim(), to = $id("bcTarget").value, atv = $id("bcAt").value, at = atv ? new Date(atv).getTime() : 0;
            if (at && at < Date.now() - 60000) { msg($id("bcMsg"), "Planlanan zaman geçmişte.", "bad"); return; }
            if (text.length < 2) { msg($id("bcMsg"), "Mesaj yaz.", "bad"); return; }
            $id("bcSend").disabled = true; msg($id("bcMsg"), "Gönderiliyor…");
            var p = (to === "all") ? window.Account.sendBroadcast(text, at) : window.Account.sendNotif(to, text, at);
            p.then(function (ok) {
                $id("bcSend").disabled = false;
                if (ok) { msg($id("bcMsg"), at > Date.now() ? "Planlandı ✓ (" + dateFmt(at) + ")" : "Gönderildi ✓", "ok"); $id("bcText").value = ""; $id("bcAt").value = ""; bcFormInit.reset && bcFormInit.reset(); renderBroadcasts(); }
                else msg($id("bcMsg"), "Gönderilemedi (kuralları yayımladın mı?)", "bad");
            }, function () { $id("bcSend").disabled = false; msg($id("bcMsg"), "Gönderilemedi.", "bad"); });
        });
        renderDaily(); renderDayChips(); renderComps(); renderErrs();
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
