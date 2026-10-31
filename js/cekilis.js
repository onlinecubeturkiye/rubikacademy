/* =========================================================
   ÇEKİLİŞ (/icerikler/cekilis) — cekilis.js
   - Admin / Geliştirici rolündekiler (ve site yöneticisi) sitede çekiliş kurar
   - Üyeler katılır; kayıtlar çekilişten 24 saat önce kapanır
   - Çekiliş saatinde rastgele bir katılımcı seçilir (sayfa açık olan yönetici yapar; herkes canlı görür)
   - Kazanana bildirim gider; 2 dakika içinde onaylamazsa yeni kişi çekilir
   - Onaylayan kazanan teslimat bilgilerini gönderir; bilgiler yalnız yöneticilere gelir (+ kurana bildirim)
   Firestore: giveaways/{id}, giveaways/{id}/e/{uid} (katılımcı), giveaways/{id}/claim/{uid} (teslimat)
========================================================= */
(function () {
    var cfg = window.RA_FIREBASE || {};
    var ROOT = ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents";
    var CLAIM_MS = 2 * 60000, CLOSE_MS = 24 * 3600000;
    var TS = { drawAt: 1, closeAt: 1, wAt: 1, claimBy: 1, cAt: 1, ts: 1 };
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function me() { return window.Account && Account.user && Account.user(); }
    function myName() { var u = me(); var p = window.Account && Account.localProfile ? Account.localProfile() : {}; return String((p && p.name) || (u && (u.displayName || (u.email || "").split("@")[0])) || "Cuber").slice(0, 24); }
    function req(path, opts) {
        opts = opts || {};
        var u = me(), url = ROOT + path;
        var h = { "Content-Type": "application/json" };
        if (!u || !Account.token) return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(cfg.apiKey), { method: opts.method || "GET", headers: h, body: opts.body });
        return Account.token().then(function (t) { h.Authorization = "Bearer " + t; return fetch(url, { method: opts.method || "GET", headers: h, body: opts.body }); });
    }
    function dec(d) {
        var f = (d && d.fields) || {}, o = {};
        Object.keys(f).forEach(function (k) {
            var v = f[k];
            o[k] = v.stringValue != null ? v.stringValue : v.integerValue != null ? +v.integerValue : v.timestampValue != null ? Date.parse(v.timestampValue) : v.booleanValue != null ? v.booleanValue : null;
        });
        if (d && d.name) o.id = d.name.split("/").pop();
        if (d && d.updateTime) o._ut = d.updateTime;
        return o;
    }
    function enc(o) {
        var f = {};
        Object.keys(o).forEach(function (k) {
            var v = o[k];
            if (TS[k]) f[k] = { timestampValue: new Date(v).toISOString() };
            else if (typeof v === "boolean") f[k] = { booleanValue: v };
            else if (typeof v === "number") f[k] = { integerValue: String(Math.round(v)) };
            else f[k] = { stringValue: String(v == null ? "" : v) };
        });
        return f;
    }
    function mask(o) { return Object.keys(o).map(function (k) { return "updateMask.fieldPaths=" + k; }).join("&"); }
    function patch(path, o, extra) { return req(path + "?" + mask(o) + (extra || ""), { method: "PATCH", body: JSON.stringify({ fields: enc(o) }) }); }
    function docName(path) { return "projects/" + cfg.projectId + "/databases/(default)/documents" + path; }
    function left(ms) {
        if (ms <= 0) return "şimdi";
        var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
        return d ? d + " gün " + h + " sa" : h ? h + " sa " + m + " dk" : m ? m + " dk " + ss + " sn" : ss + " sn";
    }
    function dt(ms) { try { return new Date(ms).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
    function rnd(n) { var a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] % n; }
    function newId() { var c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", s = ""; for (var i = 0; i < 12; i++) s += c[rnd(c.length)]; return s; }

    var S = { list: [], g: null, mgr: false, joined: false, count: 0, entries: null, pollT: 0, tickT: 0, busy: false, seenW: {} };
    function phase(g, now) {
        now = now || Date.now();
        if (g.st === "claimed") return "claimed";
        if (g.st === "drawn") return now <= g.claimBy ? "drawn" : "expired";
        if (g.st === "empty") return "empty";
        if (now < g.closeAt) return "open";
        if (now < g.drawAt) return "closed";
        return "drawing";
    }
    function stLabel(g) {
        var p = phase(g), now = Date.now();
        return p === "open" ? '<span class="gw-chip on">Kayıtlar açık · kapanmasına ' + left(g.closeAt - now) + '</span>'
            : p === "closed" ? '<span class="gw-chip">Kayıtlar kapandı · çekilişe ' + left(g.drawAt - now) + '</span>'
            : p === "drawing" ? '<span class="gw-chip live">Çekiliş yapılıyor…</span>'
            : p === "drawn" ? '<span class="gw-chip live">Kazanan: ' + esc(g.wName) + ' · onay bekleniyor</span>'
            : p === "expired" ? '<span class="gw-chip">Onay süresi doldu · yeni kişi çekilecek</span>'
            : p === "claimed" ? '<span class="gw-chip win">🏆 Kazanan: ' + esc(g.wName) + '</span>'
            : '<span class="gw-chip">Katılımcı olmadı</span>';
    }

    /* ---------- liste ---------- */
    function loadList() {
        return req("/giveaways?pageSize=60").then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) {
            S.list = ((d && d.documents) || []).map(dec).sort(function (a, b) {
                var pa = phase(a) === "claimed" || phase(a) === "empty" ? 1 : 0, pb = phase(b) === "claimed" || phase(b) === "empty" ? 1 : 0;
                return pa - pb || (pa ? b.drawAt - a.drawAt : a.drawAt - b.drawAt);
            });
            renderList();
        }).catch(function () { $("gwList").innerHTML = '<p class="gw-empty">Çekilişler yüklenemedi. Biraz sonra tekrar dene.</p>'; });
    }
    function card(g) {
        return '<a class="gw-card" href="/icerikler/cekilis?id=' + encodeURIComponent(g.id) + '" data-id="' + esc(g.id) + '">' +
            (g.img ? '<img class="gw-img" src="' + esc(g.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '<div class="gw-img gw-ph">🎁</div>') +
            '<div class="gw-cbody"><b>' + esc(g.title) + '</b><span class="gw-prize">🏆 ' + esc(g.prize || "") + '</span>' + stLabel(g) +
            '<small>Çekiliş: ' + esc(dt(g.drawAt)) + '</small></div></a>';
    }
    function renderList() {
        var box = $("gwList");
        box.innerHTML = S.list.length ? S.list.map(card).join("") : '<p class="gw-empty">Şu an çekiliş yok. Yakında burada olacak; takipte kal!</p>';
        Array.prototype.forEach.call(box.querySelectorAll(".gw-card"), function (a) {
            a.onclick = function (e) { e.preventDefault(); openOne(a.getAttribute("data-id")); };
        });
    }

    /* ---------- tek çekiliş ---------- */
    function openOne(id, noPush) {
        if (!noPush) try { history.pushState(null, "", "/icerikler/cekilis?id=" + encodeURIComponent(id)); } catch (e) {}
        $("gwListWrap").hidden = true; $("gwOne").hidden = false; $("gwOne").innerHTML = '<p class="gw-empty">Yükleniyor…</p>';
        S.g = null; S.entries = null;
        fetchOne(id).then(function () { if (!S.g) { $("gwOne").innerHTML = '<p class="gw-empty">Çekiliş bulunamadı. <a href="/icerikler/cekilis">Tüm çekilişler</a></p>'; return; } renderOne(); schedule(); });
        try { window.scrollTo(0, 0); } catch (e) {}
    }
    function backToList() {
        clearTimeout(S.pollT); S.g = null;
        try { history.pushState(null, "", "/icerikler/cekilis"); } catch (e) {}
        $("gwOne").hidden = true; $("gwListWrap").hidden = false; loadList();
    }
    function fetchOne(id) {
        var u = me();
        return Promise.all([
            req("/giveaways/" + id).then(function (r) { return r.ok ? r.json() : null; }),
            u ? req("/giveaways/" + id + "/e/" + u.uid).then(function (r) { return r.ok; }) : Promise.resolve(false),
            countEntries(id)
        ]).then(function (res) {
            if (!res[0]) { S.g = null; return; }
            var prev = S.g; S.g = dec(res[0]); S.joined = res[1]; S.count = res[2];
            if (S.joined) remember(S.g);
            if (prev && prev.id === S.g.id && S.g.w && S.g.w !== prev.w && S.g.st === "drawn") {
                if (me() && me().uid === S.g.w) S.winShown = 1; // onay penceresini animasyon sonunda aç
                reveal(S.g);
            }
        }).catch(function () {});
    }
    function countEntries(id) {
        var body = { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: "e" }] }, aggregations: [{ alias: "n", count: {} }] } };
        return req("/giveaways/" + id + ":runAggregationQuery", { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : []; }).then(function (a) {
            var x = a && a[0] && a[0].result && a[0].result.aggregateFields && a[0].result.aggregateFields.n; return x ? +x.integerValue : 0;
        }, function () { return 0; });
    }
    function listEntries(id) {
        var out = [];
        function page(tok) {
            return req("/giveaways/" + id + "/e?pageSize=300" + (tok ? "&pageToken=" + encodeURIComponent(tok) : "")).then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) {
                (d.documents || []).forEach(function (x) { var o = dec(x); out.push({ uid: o.id, name: o.name || "Cuber" }); });
                return d.nextPageToken && out.length < 20000 ? page(d.nextPageToken) : out;
            });
        }
        return page();
    }
    function remember(g) { try { var j = JSON.parse(localStorage.getItem("ra-gw-joined") || "{}") || {}; j[g.id] = g.drawAt; localStorage.setItem("ra-gw-joined", JSON.stringify(j)); } catch (e) {} }
    function forget(g) { try { var j = JSON.parse(localStorage.getItem("ra-gw-joined") || "{}") || {}; delete j[g.id]; localStorage.setItem("ra-gw-joined", JSON.stringify(j)); } catch (e) {} }

    function renderOne() {
        var g = S.g; if (!g) return;
        var p = phase(g), u = me(), now = Date.now(), iWon = u && g.w === u.uid;
        var act = "";
        if (p === "open") act = !u ? '<button type="button" class="btn primary gw-big" id="gwLogin">Katılmak için giriş yap</button>'
            : S.joined ? '<div class="gw-in">✅ Çekilişe katıldın. Çekiliş günü sayfada ol: kazanırsan 2 dakika içinde onaylaman gerekiyor.</div><button type="button" class="btn sm" id="gwLeave">Katılımı geri al</button>'
            : '<button type="button" class="btn primary gw-big" id="gwJoin">🎟 Çekilişe katıl</button>';
        else if (p === "closed" || p === "drawing") act = S.joined ? '<div class="gw-in">✅ Katıldın. Çekiliş ' + (p === "drawing" ? "şimdi yapılıyor…" : esc(dt(g.drawAt)) + "'de") + ' — sayfada kal!</div>' : '<div class="gw-note">Kayıtlar kapandı.</div>';
        else if (p === "drawn") act = iWon ? '<button type="button" class="btn primary gw-big" id="gwClaimOpen">🎉 Kazandın! Onaylamak için dokun</button>' : '<div class="gw-note">Kazananın onayı bekleniyor (' + left(g.claimBy - now) + ').</div>';
        else if (p === "claimed") act = iWon ? '<button type="button" class="btn primary" id="gwAddr">📦 Teslimat bilgilerim</button>' : '';
        $("gwOne").innerHTML = '<button type="button" class="gw-back" id="gwBack">← Tüm çekilişler</button>' +
            '<div class="gw-hero">' + (g.img ? '<img class="gw-himg" src="' + esc(g.img) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '') +
            '<div class="gw-hbody"><h2>' + esc(g.title) + '</h2><div class="gw-prize big">🏆 ' + esc(g.prize || "") + '</div>' + stLabel(g) +
            (g.desc ? '<p class="gw-desc">' + esc(g.desc).replace(/\n/g, "<br>") + '</p>' : '') +
            '<div class="gw-facts"><div><b id="gwCnt">' + S.count + '</b><span>katılımcı</span></div><div><b>' + esc(dt(g.closeAt)) + '</b><span>kayıtların kapanışı</span></div><div><b>' + esc(dt(g.drawAt)) + '</b><span>çekiliş</span></div></div>' +
            '<div class="gw-act">' + act + '</div><div class="gw-msg" id="gwMsg"></div></div></div>' +
            (S.mgr ? '<div class="gw-mgrbox" id="gwMgrOne"></div>' : '') +
            '<p class="gw-rules">Kurallar: Yalnız site üyeleri katılabilir, herkesin tek hakkı vardır. Kayıtlar çekilişten 24 saat önce kapanır. Kazanan rastgele seçilir ve 2 dakika içinde onaylamazsa yeni bir kişi çekilir. Teslimat bilgileri yalnız çekilişi düzenleyenlerle paylaşılır.</p>';
        $("gwBack").onclick = backToList;
        if ($("gwLogin")) $("gwLogin").onclick = function () { Account.openLogin && Account.openLogin(); };
        if ($("gwJoin")) $("gwJoin").onclick = join;
        if ($("gwLeave")) $("gwLeave").onclick = leave;
        if ($("gwClaimOpen")) $("gwClaimOpen").onclick = function () { winModal(g); };
        if ($("gwAddr")) $("gwAddr").onclick = function () { addrModal(g); };
        if (S.mgr) renderMgrOne();
        // kazandıysan ve süre varsa onay penceresini kendiliğinden aç
        if (iWon && p === "drawn" && !S.winShown) { S.winShown = g.w + g.wAt; winModal(g); }
        if (iWon && p === "claimed" && !S.addrChecked) {
            S.addrChecked = 1;
            req("/giveaways/" + g.id + "/claim/" + u.uid).then(function (r) { if (!r.ok) addrModal(g); });
        }
    }
    function msg(t, bad) { var m = $("gwMsg"); if (m) { m.textContent = t || ""; m.className = "gw-msg" + (bad ? " bad" : ""); } }
    function join() {
        var u = me(), g = S.g; if (!u || !g) return;
        $("gwJoin").disabled = true;
        var w = { writes: [{ update: { name: docName("/giveaways/" + g.id + "/e/" + u.uid), fields: { name: { stringValue: myName() } } }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }] };
        req(":commit", { method: "POST", body: JSON.stringify(w) }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            S.joined = true; S.count++; remember(g); renderOne(); msg("Katıldın, bol şans! 🍀");
        }).catch(function (e) { if ($("gwJoin")) $("gwJoin").disabled = false; msg(String(e.message) === "403" ? "Katılınamadı: kayıtlar kapanmış olabilir." : "Katılınamadı, tekrar dene.", 1); });
    }
    function leave() {
        var u = me(), g = S.g; if (!u || !g || !confirm("Çekiliş katılımın geri alınsın mı?")) return;
        req("/giveaways/" + g.id + "/e/" + u.uid, { method: "DELETE" }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            S.joined = false; S.count = Math.max(0, S.count - 1); forget(g); renderOne();
        }).catch(function () { msg("Geri alınamadı.", 1); });
    }

    /* ---------- kazanan: 2 dakikalık onay + teslimat bilgileri ---------- */
    var winT = 0;
    function modal(html) {
        var m = $("gwModal"); m.innerHTML = '<div class="gw-mbox">' + html + '</div>'; m.classList.add("open");
        return m;
    }
    function closeModal() { clearInterval(winT); $("gwModal").classList.remove("open"); }
    function winModal(g) {
        var m = modal('<div class="gw-confetti">🎉</div><h3>Tebrikler, kazandın!</h3><p>“' + esc(g.title) + '” çekilişinin ödülü <b>' + esc(g.prize) + '</b> senin. Ödülü almak için onayla:</p>' +
            '<div class="gw-timer" id="gwWinT">2:00</div><button type="button" class="btn primary gw-big" id="gwOk">✅ Onaylıyorum</button><div class="gw-msg" id="gwWinMsg"></div>');
        var t = function () {
            var l = g.claimBy - Date.now(), e = $("gwWinT"); if (!e) return clearInterval(winT);
            if (l <= 0) { clearInterval(winT); e.textContent = "0:00"; $("gwOk").disabled = true; $("gwWinMsg").textContent = "Onay süresi doldu. Üzgünüz, yeni bir kişi çekilecek."; return; }
            var s = Math.ceil(l / 1000); e.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
        };
        clearInterval(winT); t(); winT = setInterval(t, 250);
        $("gwOk").onclick = function () {
            var b = this; b.disabled = true;
            patch("/giveaways/" + g.id, { st: "claimed", cAt: Date.now() }).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                clearInterval(winT); S.g.st = "claimed"; addrModal(g); renderOne();
            }).catch(function () { b.disabled = false; $("gwWinMsg").textContent = "Onaylanamadı (süre dolmuş olabilir). Tekrar dene."; });
        };
        m.onclick = function (e) { if (e.target === m) { /* dışına dokununca kapanmasın: süre önemli */ } };
    }
    function addrModal(g) {
        var u = me(); if (!u) return;
        var f = function (id, lb, ph, type, req2, max) { return '<label class="gw-f"><span>' + lb + (req2 ? ' *' : '') + '</span><input id="' + id + '" ' + (type ? 'type="' + type + '" ' : '') + 'maxlength="' + max + '" placeholder="' + ph + '"' + (req2 ? ' required' : '') + '></label>'; };
        modal('<h3>📦 Teslimat bilgileri</h3><p>Ödülünü gönderebilmemiz için bilgilerini yaz. Bu bilgileri yalnız çekilişi düzenleyenler görür.</p>' +
            '<form id="gwForm" class="gw-form">' + f("gfName", "Ad soyad", "Ad Soyad", "", 1, 80) + f("gfPhone", "Telefon", "05xx xxx xx xx", "tel", 1, 25) + f("gfMail", "E-posta", "ornek@mail.com", "email", 0, 120) +
            '<div class="gw-row">' + f("gfCity", "İl", "İstanbul", "", 1, 40) + f("gfDist", "İlçe", "Kadıköy", "", 1, 60) + '</div>' +
            '<label class="gw-f"><span>Açık adres *</span><textarea id="gfAddr" maxlength="400" rows="3" placeholder="Mahalle, sokak, bina no, daire" required></textarea></label>' +
            f("gfZip", "Posta kodu", "34000", "", 0, 10) + f("gfNote", "Not", "İsteğe bağlı", "", 0, 300) +
            '<button type="submit" class="btn primary gw-big">Gönder</button><div class="gw-msg" id="gwFMsg"></div></form>');
        if (u.email) $("gfMail").value = u.email;
        $("gwForm").onsubmit = function (e) {
            e.preventDefault();
            var v = function (id) { return $(id).value.trim(); };
            if (v("gfName").length < 2 || v("gfPhone").replace(/\D/g, "").length < 7 || v("gfAddr").length < 6 || !v("gfCity") || !v("gfDist")) { $("gwFMsg").textContent = "Lütfen yıldızlı alanları doldur."; return; }
            var o = { name: v("gfName"), phone: v("gfPhone"), email: v("gfMail"), city: v("gfCity"), district: v("gfDist"), address: v("gfAddr"), zip: v("gfZip"), note: v("gfNote"), ts: Date.now() };
            var b = this.querySelector("button"); b.disabled = true;
            patch("/giveaways/" + g.id + "/claim/" + u.uid, o).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                // çekilişi kurana bildirim (belge adı = çekiliş kodu: tek bildirim)
                patch("/users/" + g.host + "/notifications/" + g.id, { text: "📦 “" + g.title + "” çekilişinin kazananı " + o.name + " teslimat bilgilerini gönderdi. Çekiliş sayfasından görebilirsin.", ts: Date.now(), pushed: false }).catch(function () {});
                modal('<div class="gw-confetti">📦</div><h3>Bilgilerin iletildi</h3><p>Teşekkürler! Ödülün en kısa sürede kargolanacak. Bir sorun olursa seninle iletişime geçeceğiz.</p><button type="button" class="btn primary" id="gwDone">Tamam</button>');
                $("gwDone").onclick = closeModal;
            }).catch(function () { b.disabled = false; $("gwFMsg").textContent = "Gönderilemedi, tekrar dene."; });
        };
    }

    /* ---------- çekiliş animasyonu (herkes görür) ---------- */
    function reveal(g) {
        var key = "ra-gw-rev:" + g.id + ":" + g.w; try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) {}
        if (Date.now() - g.wAt > 10 * 60000) return;
        var names = (S.entries || []).map(function (x) { return x.name; }); if (names.length < 2) names = ["…", g.wName];
        var m = modal('<h3>🎲 Çekiliş yapılıyor</h3><div class="gw-roll" id="gwRoll">…</div><p class="gw-msg" id="gwRollMsg"></p>');
        var i = 0, delay = 50;
        (function step() {
            var e = $("gwRoll"); if (!e) return;
            if (delay > 420) {
                e.textContent = g.wName; e.classList.add("win");
                var iWon = me() && me().uid === g.w;
                $("gwRollMsg").innerHTML = iWon ? "<b>Kazanan sensin!</b>" : "Kazanan: <b>" + esc(g.wName) + "</b> · onay bekleniyor";
                setTimeout(function () { if (iWon) winModal(S.g || g); else closeModal(); }, iWon ? 1200 : 3500);
                return;
            }
            e.textContent = names[rnd(names.length)]; i++; delay *= 1.12; setTimeout(step, delay);
        })();
        m.onclick = function (ev) { if (ev.target === m && !(me() && me().uid === g.w)) closeModal(); };
    }

    /* ---------- yönetici ---------- */
    function renderMgrOne() {
        var g = S.g, box = $("gwMgrOne"); if (!box) return;
        var p = phase(g);
        box.innerHTML = '<h3>🛡 Yönetici</h3><div class="gw-mrow">' +
            (p === "closed" || p === "drawing" ? '<button type="button" class="btn primary sm" id="gwDraw">🎲 Şimdi çek</button>' : '') +
            (p === "drawn" || p === "expired" || p === "claimed" ? '<button type="button" class="btn sm" id="gwRedraw">🔁 Yeniden çek</button>' : '') +
            '<button type="button" class="btn sm" id="gwShowE">👥 Katılımcılar (' + S.count + ')</button><button type="button" class="btn sm gw-del" id="gwDel">🗑 Sil</button></div>' +
            '<p class="gw-note">Çekiliş saatinde bu sayfa açıksa kazanan kendiliğinden çekilir. Kazanan 2 dakikada onaylamazsa yeni kişi kendiliğinden çekilir.</p>' +
            '<div id="gwEList"></div><div id="gwClaim"></div>';
        if ($("gwDraw")) $("gwDraw").onclick = function () { if (confirm("Kazanan şimdi çekilsin mi?")) draw(false); };
        if ($("gwRedraw")) $("gwRedraw").onclick = function () { if (confirm("Mevcut kazanan iptal edilip yeni kişi çekilsin mi?")) draw(true); };
        $("gwShowE").onclick = function () {
            $("gwEList").innerHTML = '<p class="gw-note">Yükleniyor…</p>';
            listEntries(g.id).then(function (l) { S.entries = l; $("gwEList").innerHTML = '<div class="gw-elist">' + (l.map(function (x) { return '<span>' + esc(x.name) + '</span>'; }).join("") || "Henüz katılımcı yok.") + '</div>'; });
        };
        $("gwDel").onclick = function () {
            if (!confirm("Çekiliş silinsin mi? Bu geri alınamaz.")) return;
            req("/giveaways/" + g.id, { method: "DELETE" }).then(function (r) { if (r.ok) backToList(); else alert("Silinemedi."); });
        };
        if (p === "claimed") req("/giveaways/" + g.id + "/claim/" + g.w).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var c = $("gwClaim"); if (!c) return;
            if (!d) { c.innerHTML = '<p class="gw-note">Kazanan onayladı; teslimat bilgileri henüz gönderilmedi.</p>'; return; }
            var o = dec(d), rows = [["Ad soyad", o.name], ["Telefon", o.phone], ["E-posta", o.email], ["İl / ilçe", o.city + " / " + o.district], ["Adres", o.address], ["Posta kodu", o.zip], ["Not", o.note], ["Gönderim", dt(o.ts)]];
            c.innerHTML = '<h4>📦 Teslimat bilgileri</h4><div class="gw-claim">' + rows.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + esc(x[1] || "—") + '</b></div>'; }).join("") + '</div><button type="button" class="btn sm" id="gwCopy">📋 Kopyala</button>';
            $("gwCopy").onclick = function () { var t = rows.map(function (x) { return x[0] + ": " + (x[1] || "-"); }).join("\n"); try { navigator.clipboard.writeText(t); this.textContent = "Kopyalandı ✓"; } catch (e) { prompt("Bilgiler:", t); } };
        });
    }
    function draw(redo) {
        var g = S.g; if (!g || S.busy) return; S.busy = true;
        listEntries(g.id).then(function (l) {
            S.entries = l;
            var skip = String(g.x || "").split(",").filter(Boolean); if (redo && g.w) skip.push(g.w);
            var pool = l.filter(function (x) { return skip.indexOf(x.uid) < 0; });
            var now = Date.now(), o;
            if (!pool.length) o = { st: "empty", x: skip.join(",").slice(0, 20000), n: l.length };
            else { var w = pool[rnd(pool.length)]; o = { st: "drawn", w: w.uid, wName: w.name, wAt: now, claimBy: now + CLAIM_MS + 5000, x: skip.join(",").slice(0, 20000), n: l.length }; }
            // aynı anda iki yöneticinin çekmesini önle: yazmadan hemen önce belge hâlâ aynı mı bak
            return req("/giveaways/" + g.id).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                var cur = d ? dec(d) : null;
                if (!cur || cur.st !== g.st || (cur.w || "") !== (g.w || "")) return { ok: false };
                return patch("/giveaways/" + g.id, o);
            }).then(function (r) {
                if (!r.ok) return;
                if (o.st === "drawn") patch("/users/" + o.w + "/notifications/" + newId(), { text: "🎉 Tebrikler! “" + g.title + "” çekilişini kazandın! 2 dakika içinde onaylamak için çekiliş sayfasını aç: rubikacademy.fun/icerikler/cekilis?id=" + g.id, ts: Date.now(), pushed: false }).catch(function () {});
            });
        }).then(function () { S.busy = false; return fetchOne(g.id); }, function () { S.busy = false; }).then(function () { renderOne(); schedule(); });
    }
    function autoMgr() {
        var g = S.g; if (!S.mgr || !g || S.busy) return;
        var p = phase(g);
        // birden çok yönetici açıksa çakışmasın diye kısa rastgele gecikme
        if ((p === "drawing" || p === "expired") && !S.autoT) S.autoT = setTimeout(function () {
            S.autoT = 0; var q = S.g && phase(S.g);
            if (q === "drawing") draw(false); else if (q === "expired") draw(true);
        }, 400 + rnd(2500));
    }
    function createForm() {
        var box = $("gwMgr"); if (!box) return;
        box.hidden = !S.mgr; if (!S.mgr) return;
        box.innerHTML = '<details class="gw-new"><summary>➕ Yeni çekiliş oluştur</summary><form id="gwNew" class="gw-form">' +
            '<label class="gw-f"><span>Başlık *</span><input id="gnTitle" maxlength="80" required placeholder="ör. Kasım çekilişi"></label>' +
            '<label class="gw-f"><span>Ödül *</span><input id="gnPrize" maxlength="120" required placeholder="ör. MoYu WeiLong WRM V11"></label>' +
            '<label class="gw-f"><span>Açıklama</span><textarea id="gnDesc" maxlength="1500" rows="3" placeholder="Şartlar, sponsor, notlar…"></textarea></label>' +
            '<label class="gw-f"><span>Görsel bağlantısı (isteğe bağlı)</span><input id="gnImg" maxlength="500" placeholder="https://…jpg"></label>' +
            '<label class="gw-f"><span>Çekiliş tarihi ve saati *</span><input id="gnAt" type="datetime-local" required></label>' +
            '<p class="gw-note">Kayıtlar çekilişten tam 24 saat önce kendiliğinden kapanır.</p>' +
            '<button type="submit" class="btn primary">Oluştur</button><div class="gw-msg" id="gnMsg"></div></form></details>';
        $("gwNew").onsubmit = function (e) {
            e.preventDefault();
            var at = new Date($("gnAt").value).getTime(), img = $("gnImg").value.trim();
            if (!at || at <= Date.now() + 60000) { $("gnMsg").textContent = "Gelecekte bir tarih seç."; return; }
            if (at - CLOSE_MS < Date.now() && !confirm("Çekilişe 24 saatten az var: kayıtlar hemen kapalı olur. Yine de oluşturulsun mu?")) return;
            if (img && !/^https:\/\//.test(img)) { $("gnMsg").textContent = "Görsel bağlantısı https:// ile başlamalı."; return; }
            var u = me(), id = newId(), o = { title: $("gnTitle").value.trim(), prize: $("gnPrize").value.trim(), desc: $("gnDesc").value.trim(), img: img, drawAt: at, closeAt: at - CLOSE_MS, host: u.uid, hName: myName(), st: "open", n: 0, x: "", ts: Date.now() };
            var b = this.querySelector("button"); b.disabled = true;
            patch("/giveaways/" + id, o, "&currentDocument.exists=false").then(function (r) {
                b.disabled = false;
                if (!r.ok) { $("gnMsg").textContent = "Oluşturulamadı (" + r.status + "). Firebase kurallarını yayımladın mı?"; return; }
                openOne(id);
            }, function () { b.disabled = false; $("gnMsg").textContent = "Bağlantı hatası."; });
        };
    }

    /* ---------- yenileme ---------- */
    function schedule() {
        clearTimeout(S.pollT);
        var g = S.g; if (!g) return;
        var now = Date.now(), near = (now > g.drawAt - 90000 && now < g.drawAt + 1800000) || g.st === "drawn";
        // çekiliş yaklaşırken animasyon için katılımcı adlarını önceden al
        if (near && !S.entries && S.count) listEntries(g.id).then(function (l) { S.entries = l; }).catch(function () {});
        S.pollT = setTimeout(function () {
            var sig = function () { return JSON.stringify([S.g, S.joined, S.count]); }, before = sig();
            fetchOne(g.id).then(function () { if (S.g) { if (sig() !== before) renderOne(); autoMgr(); schedule(); } });
        }, near ? 3000 : 20000);
    }
    function tick() {
        // geri sayımlar
        if (S.g && !$("gwOne").hidden) {
            var g = S.g, ch = $("gwOne").querySelector(".gw-chip"); if (ch) ch.outerHTML = stLabel(g);
            var p = phase(g); if (p !== S.lastP) { S.lastP = p; renderOne(); autoMgr(); }
        } else if (!$("gwListWrap").hidden) {
            Array.prototype.forEach.call(document.querySelectorAll("#gwList .gw-card"), function (a) {
                var g = S.list.filter(function (x) { return x.id === a.getAttribute("data-id"); })[0]; var ch = a.querySelector(".gw-chip"); if (g && ch) ch.outerHTML = stLabel(g);
            });
        }
    }
    function checkRole() {
        var u = me(); S.mgr = false;
        if (!u) { createForm(); return Promise.resolve(); }
        if (Account.isAdmin && Account.isAdmin()) { S.mgr = true; createForm(); return Promise.resolve(); }
        return Account.getRole(u.uid).then(function (r) { S.mgr = r === "admin" || r === "gelistirici"; createForm(); }, function () { createForm(); });
    }
    function start() {
        $("gwModal").onclick = function (e) { if (e.target === $("gwModal") && !$("gwModal").querySelector("#gwOk,#gwForm")) closeModal(); };
        var id = (/[?&]id=([^&]+)/.exec(location.search) || [])[1];
        checkRole().then(function () { if (id) openOne(decodeURIComponent(id), true); else loadList(); });
        clearInterval(S.tickT); S.tickT = setInterval(tick, 1000);
        window.addEventListener("popstate", function () { var i = (/[?&]id=([^&]+)/.exec(location.search) || [])[1]; if (i) openOne(decodeURIComponent(i), true); else { $("gwOne").hidden = true; $("gwListWrap").hidden = false; loadList(); } });
        if (Account.onChange) Account.onChange(function () { checkRole().then(function () { if (S.g) fetchOne(S.g.id).then(renderOne); else renderList(); }); });
    }
    if (window.Account) start(); else document.addEventListener("DOMContentLoaded", start);
    // test / geliştirme: hesap değişince yeniden yükle
    window.Cekilis = { _s: S, draw: draw, refresh: function () { return checkRole().then(function () { if (S.g) return fetchOne(S.g.id).then(renderOne); return loadList(); }); } };
})();
