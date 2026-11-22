/* =========================================================
   ÇEKİLİŞ (/icerikler/cekilis) — cekilis.js
   - Admin / Geliştirici rolündekiler (ve site yöneticisi) sitede çekiliş kurar
   - Üyeler katılır; kayıtlar çekiliş anına kadar açık (mini: 10 dk önce kapanır)
   - Çekiliş saatinde rastgele bir katılımcı seçilir (sayfa açık olan yönetici yapar; herkes canlı görür)
   - Kazanana bildirim gider; 2 dakika içinde onaylamazsa yeni kişi çekilir
   - Onaylayan kazanan teslimat bilgilerini gönderir; bilgiler yalnız yöneticilere gelir (+ kurana bildirim)
   Firestore: giveaways/{id}, giveaways/{id}/e/{uid} (katılımcı), giveaways/{id}/claim/{uid} (teslimat)
========================================================= */
(function () {
    var cfg = window.RA_FIREBASE || {};
    var ROOT = ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents";
    var CLAIM_MS = 2 * 60000;
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

    // Hazır çekiliş görselleri (/img/cekilis/*.svg): tür seçilince başlık/ödül önerisi de gelir
    var PRESETS = [
        ["kup", "Küp", "Küp çekilişi", "3x3 manyetik speed küp"], ["timer", "Timer", "Timer çekilişi", "Speed timer"],
        ["mat", "Mat", "Mat çekilişi", "Küp matı"], ["kocluk", "Koçluk", "Koçluk çekilişi", "1 saatlik birebir online ders"],
        ["akilli-kup", "Akıllı küp", "Akıllı küp çekilişi", "Bluetooth akıllı küp"], ["yag", "Lube", "Lube çekilişi", "Küp yağı ve bakım seti"]
    ];
    function imgOf(g) { return g.img || "/img/cekilis/kup.svg"; }
    function modeOf(g) { return g.mode === "mini" || g.mode === "rastgele" ? g.mode : "cark"; }
    var MODE_LBL = { cark: "🎡 Çark", mini: "⚡ Mini", rastgele: "🎲 Rastgele" };
    function badges(g) {
        return '<span class="gw-tag ' + modeOf(g) + '">' + MODE_LBL[modeOf(g)] + '</span>' + (g.test ? '<span class="gw-tag test">🧪 Deneme</span>' : '');
    }
    var CLOSE = { cark: 0, mini: 10 * 60000, rastgele: 0 };
    // varsayılan katılım şartı: bu kanala abone olduğunu gösteren ekran görüntüsü (oluştururken değiştirilebilir)
    var YT_DEF = [["Mert Sağdınç", "https://www.youtube.com/@AlgoMert"], ["Rubik Academy", "https://www.youtube.com/@rubikacademyy"]];
    // g.yt = "Kanal 1|Kanal 2", g.ytUrl = "url1|url2": her kanal için ayrı abonelik görseli istenir (en çok 2)
    function chans(g) { var n = String(g.yt || "").split("|"), u = String(g.ytUrl || "").split("|"); return n.map(function (x, i) { return { name: x.trim(), url: (u[i] || "").trim() }; }).filter(function (c) { return c.name; }).slice(0, 2); }
    var PF = ["img", "img2"];

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
            : p === "drawing" ? '<span class="gw-chip live">Çekiliş birazdan başlıyor…</span>'
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
            '<div class="gw-imgw"><img class="gw-img" src="' + esc(imgOf(g)) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/img/cekilis/kup.svg\'"><div class="gw-tags">' + badges(g) + '</div></div>' +
            '<div class="gw-cbody"><b>' + esc(g.title) + '</b><span class="gw-prize">🏆 ' + esc(g.prize || "") + '</span>' + stLabel(g) +
            '<small>Çekiliş: ' + esc(dt(g.drawAt)) + '</small></div></a>';
    }
    function renderList() {
        var box = $("gwList");
        box.innerHTML = S.list.length ? S.list.map(card).join("") : '<div class="gw-emptyc"><img src="/img/cekilis/kup.svg" alt=""><div><b>Şu an açık çekiliş yok</b><p>Yeni çekilişler burada ve bildirimlerde duyurulur. Takipte kal!</p></div></div>';
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
                (d.documents || []).forEach(function (x) { var o = dec(x); out.push({ uid: o.id, name: o.name || "Cuber", d: o.d || "", ts: o.ts || 0 }); });
                return d.nextPageToken && out.length < 20000 ? page(d.nextPageToken) : out;
            });
        }
        return page();
    }
    // cihaz kimliği: aynı cihazdan birden çok hesapla katılımı yöneticiye göstermek için (kişisel bilgi değil, rastgele)
    function devId() {
        try { var d = localStorage.getItem("ra-dev"); if (!d || !/^[a-z0-9]{16}$/.test(d)) { var c = "abcdefghijklmnopqrstuvwxyz0123456789"; d = ""; for (var i = 0; i < 16; i++) d += c[rnd(c.length)]; localStorage.setItem("ra-dev", d); } return d; } catch (e) { return ""; }
    }
    function remember(g) { try { var j = JSON.parse(localStorage.getItem("ra-gw-joined") || "{}") || {}; j[g.id] = g.drawAt; localStorage.setItem("ra-gw-joined", JSON.stringify(j)); } catch (e) {} }
    function forget(g) { try { var j = JSON.parse(localStorage.getItem("ra-gw-joined") || "{}") || {}; delete j[g.id]; localStorage.setItem("ra-gw-joined", JSON.stringify(j)); } catch (e) {} }

    function renderOne() {
        var g = S.g; if (!g) return;
        var p = phase(g), u = me(), now = Date.now(), iWon = u && g.w === u.uid;
        var act = "";
        if (p === "open") act = S.joined ? '<div class="gw-in">✅ Çekilişe katıldın. Çekiliş günü sayfada ol: kazanırsan 2 dakika içinde onaylaman gerekiyor.</div><button type="button" class="btn sm" id="gwLeave">Katılımı geri al</button>'
            : reqHtml(g);
        else if (p === "closed" || p === "drawing") act = S.joined ? '<div class="gw-in">✅ Katıldın. Çekiliş ' + (p === "drawing" ? "şimdi yapılıyor…" : esc(dt(g.drawAt)) + "'de") + ' — sayfada kal!</div>' : '<div class="gw-note">Kayıtlar kapandı.</div>';
        else if (p === "drawn") act = iWon ? '<button type="button" class="btn primary gw-big" id="gwClaimOpen">🎉 Kazandın! Onaylamak için dokun</button>' : '<div class="gw-note">Kazananın onayı bekleniyor (' + left(g.claimBy - now) + ').</div>';
        else if (p === "claimed") act = iWon ? '<button type="button" class="btn primary" id="gwAddr">📦 Teslimat bilgilerim</button>' : '';
        $("gwOne").innerHTML = '<button type="button" class="gw-back" id="gwBack">← Tüm çekilişler</button>' +
            '<div class="gw-hero"><div class="gw-htop"><div class="gw-imgw"><img class="gw-himg" src="' + esc(imgOf(g)) + '" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/img/cekilis/kup.svg\'"><div class="gw-tags">' + badges(g) + '</div></div>' +
            '<div class="gw-hhead"><h2>' + esc(g.title) + '</h2><div class="gw-prize big">🏆 ' + esc(g.prize || "") + '</div>' + stLabel(g) +
            (g.desc ? '<p class="gw-desc">' + esc(g.desc).replace(/\n/g, "<br>") + '</p>' : '') +
            '<div class="gw-facts"><div><b id="gwCnt">' + S.count + '</b><span>katılımcı</span></div>' + (g.closeAt < g.drawAt ? '<div><b>' + esc(dt(g.closeAt)) + '</b><span>kayıtların kapanışı</span></div>' : '') + '<div><b>' + esc(dt(g.drawAt)) + '</b><span>çekiliş</span></div></div></div></div>' +
            '<div class="gw-hbody"><div class="gw-act">' + act + '</div><div class="gw-msg" id="gwMsg"></div></div></div>' +
            '<section class="gw-ppl"><h3>👥 Katılanlar <span id="gwPplN">' + S.count + '</span></h3><div class="gw-pplc" id="gwPplList"><p class="gw-note">Yükleniyor…</p></div></section>' +
            (S.mgr ? '<div class="gw-mgrbox" id="gwMgrOne"></div>' : '') +
            '<p class="gw-rules">Kurallar: Yalnız site üyeleri katılabilir, herkesin tek hakkı vardır. ' + (g.test ? 'Bu bir deneme çekilişidir; ödül verilmez. ' : modeOf(g) === "mini" ? 'Mini çekilişte kayıtlar çekilişten 10 dakika önce kapanır. ' : 'Kayıtlar çekiliş anına kadar açıktır. ') + 'Kazanan rastgele seçilir ve 2 dakika içinde onaylamazsa yeni bir kişi çekilir. Teslimat bilgileri yalnız çekilişi düzenleyenlerle paylaşılır.</p>';
        $("gwBack").onclick = backToList;
        if ($("gwLogin")) $("gwLogin").onclick = function () { Account.openLogin && Account.openLogin(); };
        if ($("gwJoin")) $("gwJoin").onclick = function () { join(false); };
        bindReq(g);
        if ($("gwLeave")) $("gwLeave").onclick = leave;
        if ($("gwClaimOpen")) $("gwClaimOpen").onclick = function () { winModal(g); };
        if ($("gwAddr")) $("gwAddr").onclick = function () { addrModal(g); };
        if (S.mgr) renderMgrOne();
        loadPeople();
        // kazandıysan ve süre varsa onay penceresini kendiliğinden aç
        if (iWon && p === "drawn" && !S.winShown) { S.winShown = g.w + g.wAt; winModal(g); }
        if (iWon && p === "claimed" && !S.addrChecked) {
            S.addrChecked = 1;
            req("/giveaways/" + g.id + "/claim/" + u.uid).then(function (r) { if (!r.ok) addrModal(g); });
        }
    }
    function msg(t, bad) { var m = $("gwMsg"); if (m) { m.textContent = t || ""; m.className = "gw-msg" + (bad ? " bad" : ""); } }
    // Katılmak için bildirim izni şart (kazanınca 2 dakikada haber alabilmek için)
    function pushOk() { return !window.Account || !Account.pushState || Account.pushState() === "granted"; }
    /* ---------- katılım şartları: 1) hesap 2) bildirimler 3) (istenirse) YouTube abonelik görseli ---------- */
    function reqState(g) {
        var u = me(), ps = window.Account && Account.pushState ? Account.pushState() : "granted";
        var pr = S.proof && S.proof.id === g.id ? S.proof.imgs : [], ch = chans(g);
        return { acc: !!u, push: pushOk(), ps: ps, yt: ch.every(function (c, i) { return !!pr[i]; }), proofs: pr, ch: ch };
    }
    function reqHtml(g) {
        var r = reqState(g), u = me();
        var row = function (ok, n, title, body) { return '<li class="' + (ok ? "ok" : "") + '"><b>' + (ok ? "✓" : n) + '</b><div><strong>' + title + '</strong>' + (body || "") + '</div></li>'; };
        var all = r.acc && r.push && r.yt;
        return '<div class="gw-req"><h3>Katılma şartları</h3><ol>' +
            row(r.acc, 1, "Rubik Academy hesabın açık olsun", r.acc ? '<span>' + esc(myName()) + ' olarak giriş yaptın</span>' : '<button type="button" class="btn sm primary" id="gwLogin">Giriş yap / Üye ol</button>') +
            row(r.push, 2, "Bildirimler açık olsun", r.push ? '<span>Kazanırsan telefonuna anında bildirim gelir; site kapalı olsa bile.</span>'
                : '<span>' + (r.ps === "denied" ? 'Bildirimler bu tarayıcıda kapalı. Düğmeye dokun, nasıl açılacağını adım adım gösterelim.' : 'Kazanırsan 2 dakika içinde onaylaman gerekiyor; haberin olsun diye şart.') + '</span><button type="button" class="btn sm primary" id="gwPush">🔔 Bildirimleri aç</button>') +
            r.ch.map(function (c, i) {
                var p = r.proofs[i] || "";
                return row(!!p, 3 + i, esc(c.name) + " kanalına abone ol", '<span>Abone olduktan sonra kanal sayfasında <b>Abone olundu</b> yazısı görünecek şekilde ekran görüntüsü al ve yükle. Görseli yalnız çekilişi düzenleyenler görür.</span>' +
                    '<div class="gw-reqb">' + (c.url ? '<a class="btn sm gw-yt" href="' + esc(c.url) + '" target="_blank" rel="noopener">▶ Kanala git</a>' : '') +
                    '<label class="btn sm' + (p ? '' : ' primary') + '">📸 ' + (p ? "Görseli değiştir" : "Ekran görüntüsü yükle") + '<input type="file" accept="image/*" class="gwProof" data-i="' + i + '" hidden' + (r.acc ? '' : ' disabled') + '></label></div>' +
                    (p ? '<img class="gw-proofp" src="' + p + '" alt="Yüklenen görsel">' : ''));
            }).join("") +
            '</ol>' + (u ? '<button type="button" class="btn primary gw-big" id="gwJoin"' + (all ? '' : ' disabled') + '>🎟 Çekilişe katıl</button>' : '') +
            (u && !all ? '<p class="gw-note" style="text-align:center">Şartların hepsi tamamlanınca katılabilirsin.</p>' : '') + '</div>';
    }
    function bindReq(g) {
        if ($("gwPush")) $("gwPush").onclick = function () {
            var b = this; b.disabled = true;
            Account.enablePush().then(function (p) { renderOne(); if (p !== "granted") pushHelp(p); else msg("Bildirimler açıldı ✓"); }, function () { b.disabled = false; pushHelp("denied"); });
        };
        Array.prototype.forEach.call(document.querySelectorAll(".gwProof"), function (inp) { inp.onchange = function () {
            var f = this.files && this.files[0], idx = +this.getAttribute("data-i"); if (!f) return;
            if (!/^image\//.test(f.type)) { msg("Lütfen bir görsel seç.", 1); return; }
            msg("Görsel hazırlanıyor…");
            shrink(f).then(function (img) {
                if (!S.proof || S.proof.id !== g.id) S.proof = { id: g.id, imgs: [] };
                S.proof.imgs[idx] = img; renderOne(); msg("Görsel hazır ✓");
            }, function () { msg("Görsel okunamadı, başka bir görsel dene.", 1); });
        }; });
    }
    // izin verilmediyse: nasıl açılacağını adım adım göster, geri dönünce kendiliğinden yenile
    function pushHelp(st) {
        var app = !!window.RA_APP, ios = st === "ios", uns = st === "unsupported";
        var steps = ios || uns ? '<p>' + (Account.pushHelpHtml ? Account.pushHelpHtml(st) : "") + '</p>'
            : app ? '<ol class="gw-steps2"><li>Telefonun <b>Ayarlar</b> uygulamasını aç</li><li><b>Uygulamalar → Rubik Academy</b></li><li><b>Bildirimler</b> → aç</li><li>Buraya geri dön</li></ol>'
            : '<ol class="gw-steps2"><li>Adres çubuğunun solundaki <b>kilit / ayar</b> simgesine dokun</li><li><b>İzinler</b> ya da <b>Site ayarları</b>na gir</li><li><b>Bildirimler</b> → <b>İzin ver</b></li><li>Aşağıdaki <b>Sayfayı yenile</b>ye dokun</li></ol>';
        modal('<div class="gw-confetti">🔔</div><h3>Bildirimleri aç</h3><p>Tarayıcı izin penceresini göstermedi; bildirimler daha önce engellenmiş. Şöyle açabilirsin:</p>' + steps +
            '<div class="gw-act">' + (ios || uns ? '' : '<button type="button" class="btn primary gw-big" id="gwPushRe">🔄 Sayfayı yenile</button>') + '<button type="button" class="btn" id="gwPushX">Kapat</button></div>');
        if ($("gwPushRe")) $("gwPushRe").onclick = function () { location.reload(); };
        $("gwPushX").onclick = closeModal;
    }
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState !== "visible" || !S.g || $("gwOne").hidden || pushOk() || phase(S.g) !== "open" || S.joined) return;
        renderOne(); if (pushOk()) { closeModal(); msg("Bildirimler açıldı ✓"); }
    });
    // ekran görüntüsünü küçült: en uzun kenar 1000 px, JPEG; 380 KB'ı geçmeyecek şekilde
    function shrink(file) {
        return new Promise(function (res, rej) {
            var url = URL.createObjectURL(file), im = new Image();
            im.onload = function () {
                URL.revokeObjectURL(url);
                var max = 1000, w = im.naturalWidth, h = im.naturalHeight;
                for (var tries = 0; tries < 6; tries++) {
                    var k = Math.min(1, max / Math.max(w, h)), c = document.createElement("canvas");
                    c.width = Math.round(w * k); c.height = Math.round(h * k);
                    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
                    var d = c.toDataURL("image/jpeg", tries < 3 ? 0.72 : 0.6);
                    if (d.length <= 380000) return res(d);
                    max = Math.round(max * 0.8);
                }
                rej(new Error("big"));
            };
            im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("img")); };
            im.src = url;
        });
    }
    function join(skipPush) {
        var u = me(), g = S.g; if (!u || !g) return;
        if (!skipPush && !pushOk()) {
            var st = Account.pushState();
            if (st === "default") { $("gwJoin").disabled = true; Account.enablePush().then(function (p) { if ($("gwJoin")) $("gwJoin").disabled = false; if (p === "granted") join(true); else { renderOne(); msg("Katılmak için bildirimlere izin vermelisin.", 1); } }); return; }
            renderOne(); return;
        }
        $("gwJoin").disabled = true;
        var r0 = reqState(g);
        if (!r0.yt) { msg("Önce abonelik ekran görüntülerini yükle.", 1); return; }
        var w = { writes: [{ update: { name: docName("/giveaways/" + g.id + "/e/" + u.uid), fields: { name: { stringValue: myName() }, d: { stringValue: devId() } } }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }] };
        if (g.yt) w.writes.unshift({ update: { name: docName("/giveaways/" + g.id + "/proof/" + u.uid), fields: (function () { var o = {}; r0.ch.forEach(function (c, i) { o[PF[i]] = { stringValue: r0.proofs[i] }; }); return o; })() }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }] });
        req(":commit", { method: "POST", body: JSON.stringify(w) }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            S.joined = true; S.count++; remember(g); renderOne(); msg("Katıldın, bol şans! 🍀");
        }).catch(function (e) { if ($("gwJoin")) $("gwJoin").disabled = false; msg(String(e.message) === "403" ? "Katılınamadı: kayıtlar kapanmış olabilir." : "Katılınamadı, tekrar dene.", 1); });
    }
    function leave() {
        var u = me(), g = S.g; if (!u || !g || !confirm("Çekiliş katılımın geri alınsın mı?")) return;
        req("/giveaways/" + g.id + "/e/" + u.uid, { method: "DELETE" }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            if (g.yt) req("/giveaways/" + g.id + "/proof/" + u.uid, { method: "DELETE" }).catch(function () {});
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
        var iWon = me() && me().uid === g.w;
        var m = modal('<h3>' + ({ mini: "⚡ Mini çekiliş", rastgele: "🎲 Rastgele seçiliyor", cark: "🎡 Çark dönüyor" })[modeOf(g)] + '</h3><div id="gwAnim"></div><p class="gw-msg" id="gwRollMsg"></p>');
        Draw.run($("gwAnim"), modeOf(g), names, g.wName, function () {
            var e = $("gwRollMsg"); if (!e) return;
            e.innerHTML = iWon ? "<b>Kazanan sensin!</b>" : "Kazanan: <b>" + esc(g.wName) + "</b> · onay bekleniyor";
            setTimeout(function () { if (iWon) winModal(S.g || g); else closeModal(); }, iWon ? 1400 : 3500);
        });
        m.onclick = function (ev) { if (ev.target === m && !iWon) closeModal(); };
    }

    /* ---------- yönetici ---------- */
    function renderMgrOne() {
        var g = S.g, box = $("gwMgrOne"); if (!box) return;
        // eski 24 saat kuralıyla açılmış çark/rastgele çekilişlerini yöneticide kendiliğinden yeniden aç
        // katılan yokken yanlışlıkla çekilip "boş" kalan çekilişi de yeniden aç
        if (g.drawAt > Date.now() && !S.fixing && ((g.st === "open" && !g.test && modeOf(g) !== "mini" && g.closeAt < g.drawAt) || g.st === "empty")) {
            S.fixing = 1;
            patch("/giveaways/" + g.id, g.st === "empty" ? { st: "open", closeAt: modeOf(g) === "mini" && !g.test ? g.drawAt - 10 * 60000 : g.drawAt } : { closeAt: g.drawAt }).then(function (r) { S.fixing = 0; if (r.ok) return fetchOne(g.id).then(renderOne); }, function () { S.fixing = 0; });
        }
        var p = phase(g);
        box.innerHTML = '<h3>🛡 Yönetici</h3><div class="gw-mrow">' +
            (p === "closed" || p === "drawing" || (g.test && p === "open") ? '<button type="button" class="btn primary sm" id="gwDraw">' + MODE_LBL[modeOf(g)].split(" ")[0] + ' Şimdi çek</button>' : '') +
            (p === "drawn" || p === "expired" || p === "claimed" || p === "empty" ? '<button type="button" class="btn sm" id="gwRedraw">🔁 Yeniden çek</button>' : '') +
            '<button type="button" class="btn sm gw-del" id="gwDel">🗑 Çekilişi sil</button></div>' +
            '<p class="gw-note">Çekilişi sen başlatırsın (kayıtlar kapandıktan sonra <b>Şimdi çek</b>). Kazanan 2 dakika içinde onaylamazsa bu sayfa açıkken sıradaki kişi kendiliğinden çekilir.</p>' +
            (skipNames(g).length ? '<p class="gw-note">Onaylamayan / iptal edilenler: <b>' + skipNames(g).map(esc).join(" → ") + '</b></p>' : '') +
            '<div id="gwClaim"></div><div class="gw-chk" id="gwChk"><h4>🔍 Katılımcı kontrolü</h4><p class="gw-note">Yükleniyor…</p></div>';
        if ($("gwDraw")) $("gwDraw").onclick = function () { if (confirm("Kazanan şimdi çekilsin mi?")) draw(false); };
        if ($("gwRedraw")) $("gwRedraw").onclick = function () { if (confirm("Mevcut kazanan iptal edilip yeni kişi çekilsin mi?")) draw(true); };
        checkPeople();
        $("gwDel").onclick = function () {
            if (!confirm("Çekiliş silinsin mi? Bu geri alınamaz.")) return;
            req("/giveaways/" + g.id, { method: "DELETE" }).then(function (r) { if (r.ok) backToList(); else alert("Silinemedi."); });
        };
        if (p === "claimed") req("/giveaways/" + g.id + "/claim/" + g.w).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var c = $("gwClaim"); if (!c) return;
            if (!d) {
                c.innerHTML = '<div class="gw-wait"><p><b>' + esc(g.wName) + '</b> onayladı ama teslimat bilgilerini henüz göndermedi' + (g.cAt ? ' (' + left(Date.now() - g.cAt).replace("şimdi", "az önce") + ' önce onayladı)' : '') + '.</p>' +
                    '<button type="button" class="btn sm gw-del" id="gwNoInfo">🔁 Bilgi girmedi — yeni kişi çek</button></div>';
                $("gwNoInfo").onclick = function () { if (confirm(g.wName + " iptal edilip yeni bir kişi rastgele çekilsin mi?")) draw(true); };
                return;
            }
            var o = dec(d), rows = [["Ad soyad", o.name], ["Telefon", o.phone], ["E-posta", o.email], ["İl / ilçe", o.city + " / " + o.district], ["Adres", o.address], ["Posta kodu", o.zip], ["Not", o.note], ["Gönderim", dt(o.ts)]];
            c.innerHTML = '<h4>📦 Teslimat bilgileri</h4><div class="gw-claim">' + rows.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + esc(x[1] || "—") + '</b></div>'; }).join("") + '</div><button type="button" class="btn sm" id="gwCopy">📋 Kopyala</button>';
            $("gwCopy").onclick = function () { var t = rows.map(function (x) { return x[0] + ": " + (x[1] || "-"); }).join("\n"); try { navigator.clipboard.writeText(t); this.textContent = "Kopyalandı ✓"; } catch (e) { prompt("Bilgiler:", t); } };
        });
    }
    function draw(redo) {
        var g = S.g; if (!g || S.busy) return; S.busy = true;
        listEntries(g.id).then(function (l) {
            S.entries = l;
            // katılan yokken çekiliş yapılmaz: hiçbir şey yazmadan uyar
            if (!l.length) { alert("Henüz katılan yok, çekiliş yapılamaz."); return; }
            // x: onaylamayan / iptal edilen kazananlar ("uid|isim,uid|isim"), tekrar çekilmezler
            var skip = String(g.x || "").split(",").filter(Boolean);
            if (redo && g.w) skip.push(g.w + "|" + String(g.wName || "").replace(/[,|]/g, " ").slice(0, 24));
            var skipU = skip.map(function (x) { return x.split("|")[0]; });
            var pool = l.filter(function (x) { return skipU.indexOf(x.uid) < 0; });
            // askıya alınmış / silinmiş hesaplar çekilmez: seçileni kontrol et, uygunsa kabul et
            function pick() {
                if (!pool.length) return Promise.resolve(null);
                var i = rnd(pool.length), w = pool[i];
                return roleOf(w.uid).then(function (r) { if (r === "askida" || r === "silindi") { pool.splice(i, 1); return pick(); } return w; });
            }
            return pick().then(function (w) {
                var now = Date.now(), o;
                if (!w) o = { st: "empty", x: skip.join(",").slice(0, 20000), n: l.length };
                else o = { st: "drawn", w: w.uid, wName: w.name, wAt: now, claimBy: now + CLAIM_MS + 5000, x: skip.join(",").slice(0, 20000), n: l.length };
                // aynı anda iki yöneticinin çekmesini önle: yazmadan hemen önce belge hâlâ aynı mı bak
                return req("/giveaways/" + g.id).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                    var cur = d ? dec(d) : null;
                    if (!cur || cur.st !== g.st || (cur.w || "") !== (g.w || "")) return { ok: false };
                    return patch("/giveaways/" + g.id, o);
                }).then(function (r) {
                    if (!r.ok) return;
                    if (o.st === "drawn") patch("/users/" + o.w + "/notifications/" + newId(), { text: "🎉 Tebrikler! “" + g.title + "” çekilişini kazandın! 2 dakika içinde onaylamak için çekiliş sayfasını aç: rubikacademy.fun/icerikler/cekilis?id=" + g.id, ts: Date.now(), pushed: false }).catch(function () {});
                });
            });
        }).then(function () { S.busy = false; return fetchOne(g.id); }, function () { S.busy = false; }).then(function () { renderOne(); schedule(); });
    }
    var ROLE = {};
    function roleOf(uid) {
        if (ROLE[uid] !== undefined) return Promise.resolve(ROLE[uid]);
        return req("/roles/" + uid).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { var v = d ? (dec(d).role || "") : ""; ROLE[uid] = v; return v; }, function () { return ""; });
    }

    /* ---------- katılımcılar: herkese isimler, yöneticiye kontrol + çıkarma ---------- */
    function loadPeople() {
        var g = S.g; if (!g) return;
        var box = $("gwPplList"); if (!box) return;
        var paint = function (l) {
            var b = $("gwPplList"); if (!b) return;
            $("gwPplN").textContent = l.length;
            var shown = l.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
            b.innerHTML = l.length ? shown.slice(0, 80).map(function (x) { return '<a href="/icerikler/profil?u=' + encodeURIComponent(x.uid) + '" target="_blank" rel="noopener"' + (me() && me().uid === x.uid ? ' class="me"' : '') + '>' + esc(x.name) + '</a>'; }).join("") + (l.length > 80 ? '<span>+' + (l.length - 80) + ' kişi</span>' : '') : '<p class="gw-note">Henüz katılan yok. İlk sen katıl!</p>';
        };
        if (S.entries && S.entriesFor === g.id && S.entriesN === S.count) { paint(S.entries); return; }
        listEntries(g.id).then(function (l) { S.entries = l; S.entriesFor = g.id; S.entriesN = l.length; paint(l); }).catch(function () {});
    }
    function age(ms) { var d = Math.floor(ms / 86400000); return d >= 1 ? d + " gün" : Math.max(1, Math.floor(ms / 3600000)) + " sa"; }
    function checkPeople() {
        var g = S.g, box = $("gwChk"); if (!g || !box) return;
        listEntries(g.id).then(function (l) {
            S.entries = l;
            // katılan yokken çekiliş yapılmaz: hiçbir şey yazmadan uyar
            if (!l.length) { alert("Henüz katılan yok, çekiliş yapılamaz."); return; } S.entriesFor = g.id; S.entriesN = l.length;
            var jobs = l.map(function (x) { return x; }), out = {}, k = 0;
            function worker() {
                if (k >= jobs.length) return Promise.resolve();
                var x = jobs[k++];
                return Promise.all([req("/users/" + x.uid).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), roleOf(x.uid),
                    g.yt ? req("/giveaways/" + g.id + "/proof/" + x.uid).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null)]).then(function (res) {
                    var u = res[0] ? dec(res[0]) : null, st = {};
                    try { st = u && u.stats ? JSON.parse(u.stats) : {}; } catch (e) {}
                    var pd = res[2] ? dec(res[2]) : {};
                    out[x.uid] = { u: u, role: res[1], st: st || {}, proofs: PF.map(function (k) { return pd[k] || ""; }) };
                }).then(worker);
            }
            var ws = []; for (var i = 0; i < 8; i++) ws.push(worker());
            return Promise.all(ws).then(function () { S.chk = out; paintCheck(); });
        }).catch(function () { box.innerHTML = '<h4>🔍 Katılımcı kontrolü</h4><p class="gw-note">Yüklenemedi.</p>'; });
    }
    function flagsOf(x, all) {
        var c = (S.chk || {})[x.uid] || {}, u = c.u, f = [];
        if (c.role === "askida" || c.role === "silindi") f.push(["bad", "⛔ Askıda: çekilmez"]);
        if (S.g && S.g.yt && S.chk) chans(S.g).forEach(function (ch, i) { if (!(c.proofs || [])[i]) f.push(["bad", "📸 " + ch.name + " görseli yok"]); });
        if (x.d) { var n = all.filter(function (y) { return y.d === x.d; }).length; if (n > 1) f.push(["bad", "📱 Aynı cihaz ×" + n]); }
        var nm = String(x.name || "").toLocaleLowerCase("tr").trim(), sn = all.filter(function (y) { return String(y.name || "").toLocaleLowerCase("tr").trim() === nm; }).length;
        if (sn > 1) f.push(["warn", "👯 Aynı isim ×" + sn]);
        if (!u) f.push(["warn", "❓ Profil yok"]);
        else {
            if (u.joined && x.ts && x.ts - u.joined < 3 * 86400000) f.push(["warn", "🆕 Yeni hesap (" + age(Math.max(0, x.ts - u.joined)) + ")"]);
            var act = (+c.st.known || 0) + (+c.st.solves || 0) + (c.st.comp && c.st.comp.length ? c.st.comp.length : 0);
            if (!act) f.push(["warn", "💤 Sitede etkinliği yok"]);
        }
        return f;
    }
    function paintCheck() {
        var g = S.g, box = $("gwChk"); if (!g || !box) return;
        var l = S.entries || [], onlySus = !!S.onlySus;
        var rows = l.map(function (x) { return { x: x, f: flagsOf(x, l) }; });
        var sus = rows.filter(function (r) { return r.f.length; });
        var groups = {}; l.forEach(function (x) { if (x.d) (groups[x.d] = groups[x.d] || []).push(x); });
        var extra = []; Object.keys(groups).forEach(function (d) { var a = groups[d].slice().sort(function (p, q) { return (p.ts || 0) - (q.ts || 0); }); extra = extra.concat(a.slice(1)); });
        var list = (onlySus ? sus : rows).sort(function (a, b) { return b.f.length - a.f.length || (a.x.ts || 0) - (b.x.ts || 0); });
        box.innerHTML = '<h4>🔍 Katılımcı kontrolü <span class="gw-sub">' + l.length + ' kişi · ' + sus.length + ' işaretli</span></h4>' +
            '<p class="gw-note">Aynı cihazdan birden çok hesap, aynı isim, yeni açılmış ya da sitede hiç etkinliği olmayan hesaplar işaretlenir. Askıya alınmış hesaplar kendiliğinden çekilmez. Şüphelendiğini <b>Çıkar</b> ile listeden çıkarabilirsin.</p>' +
            '<div class="gw-mrow"><label class="gw-chkf"><input type="checkbox" id="gwOnlySus"' + (onlySus ? " checked" : "") + '> Yalnız işaretliler</label>' +
            (extra.length ? '<button type="button" class="btn sm gw-del" id="gwDupOut">📱 Aynı cihaz fazlalarını çıkar (' + extra.length + ')</button>' : '') +
            '<button type="button" class="btn sm" id="gwReChk">↻ Yenile</button></div>' +
            '<div class="gw-plist">' + (list.map(function (r) {
                var x = r.x;
                var prs = (((S.chk || {})[x.uid] || {}).proofs || []).filter(Boolean);
                return '<div class="gw-prow' + (r.f.some(function (t) { return t[0] === "bad"; }) ? " bad" : r.f.length ? " warn" : "") + '">' + (prs.length ? '<button type="button" class="gw-pth" data-proof="' + esc(x.uid) + '" title="Abonelik görselleri"><img src="' + prs[0] + '" alt="">' + (prs.length > 1 ? '<i>' + prs.length + '</i>' : '') + '</button>' : '') + '<div class="gw-pn"><a href="/icerikler/profil?u=' + encodeURIComponent(x.uid) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a>' +
                    '<small>' + (x.ts ? esc(dt(x.ts)) : "") + '</small><div class="gw-flags">' + r.f.map(function (t) { return '<span class="' + t[0] + '">' + esc(t[1]) + '</span>'; }).join("") + '</div></div>' +
                    '<button type="button" class="btn sm gw-del" data-out="' + esc(x.uid) + '">Çıkar</button></div>';
            }).join("") || '<p class="gw-note">' + (onlySus ? "İşaretli katılımcı yok ✓" : "Henüz katılımcı yok.") + '</p>') + '</div>';
        $("gwOnlySus").onchange = function () { S.onlySus = this.checked; paintCheck(); };
        Array.prototype.forEach.call(box.querySelectorAll("[data-proof]"), function (b) {
            b.onclick = function () {
                var uid = b.getAttribute("data-proof"), x = l.filter(function (y) { return y.uid === uid; })[0], prs = (S.chk[uid] || {}).proofs || [], ch = chans(S.g);
                var m = modal('<h3>📸 ' + esc(x ? x.name : "") + '</h3><p class="gw-note">Her görselde kanalın <b>Abone olundu</b> göründüğünü kontrol et.</p>' + ch.map(function (c, i) { return '<h4 class="gw-prh">' + esc(c.name) + '</h4>' + (prs[i] ? '<img class="gw-proofbig" src="' + prs[i] + '" alt="">' : '<p class="gw-note">Görsel yok</p>'); }).join("") + '<div class="gw-mrow" style="justify-content:center;margin-top:10px"><button type="button" class="btn sm" id="gwPrOk">Tamam</button><button type="button" class="btn sm gw-del" id="gwPrOut">Uygun değil — çıkar</button></div>');
                $("gwPrOk").onclick = closeModal;
                $("gwPrOut").onclick = function () { closeModal(); removeMany([uid]); };
            };
        });
        $("gwReChk").onclick = checkPeople;
        if ($("gwDupOut")) $("gwDupOut").onclick = function () {
            if (!confirm(extra.length + " hesap çıkarılsın mı? (Her cihazdan ilk katılan kalır)")) return;
            removeMany(extra.map(function (x) { return x.uid; }));
        };
        Array.prototype.forEach.call(box.querySelectorAll("[data-out]"), function (b) {
            b.onclick = function () {
                var uid = b.getAttribute("data-out"), x = l.filter(function (y) { return y.uid === uid; })[0];
                if (confirm((x ? x.name : "Bu kişi") + " çekilişten çıkarılsın mı?")) removeMany([uid]);
            };
        });
    }
    function removeMany(uids) {
        var g = S.g; if (!g) return;
        Promise.all(uids.map(function (u) { return req("/giveaways/" + g.id + "/e/" + u, { method: "DELETE" }).then(function (r) { return r.ok; }, function () { return false; }); })).then(function (res) {
            var ok = res.filter(Boolean).length;
            S.entries = (S.entries || []).filter(function (x) { return uids.indexOf(x.uid) < 0 || !res[uids.indexOf(x.uid)]; });
            S.count = S.entries.length; S.entriesN = S.count;
            paintCheck(); loadPeople();
            var c = $("gwCnt"); if (c) c.textContent = S.count;
            msg(ok + " kişi çıkarıldı." + (ok < uids.length ? " (" + (uids.length - ok) + " çıkarılamadı)" : ""), ok < uids.length);
        });
    }
    function skipNames(g) { return String(g.x || "").split(",").filter(Boolean).map(function (x) { return x.split("|")[1] || "?"; }); }
    function autoMgr() {
        var g = S.g; if (!S.mgr || !g || S.busy) return;
        var p = phase(g);
        // birden çok yönetici açıksa çakışmasın diye kısa rastgele gecikme
        // çekilişi yetkili elle başlatır; kazanan süresinde onaylamazsa sıradaki kişi kendiliğinden çekilir
        if (p === "expired" && !S.autoT) S.autoT = setTimeout(function () {
            S.autoT = 0; if (S.g && phase(S.g) === "expired") draw(true);
        }, 400 + rnd(2500));
    }
    function createForm() {
        var box = $("gwMgr"); if (!box) return;
        box.hidden = !S.mgr; if (!S.mgr) return;
        var owner = !!(window.Account && Account.isAdmin && Account.isAdmin());
        var pick = "kup", mode = "cark";
        box.innerHTML = '<details class="gw-new"><summary>➕ Yeni çekiliş oluştur</summary><form id="gwNew" class="gw-form">' +
            '<div class="gw-f"><span>Çekiliş türü</span><div class="gw-seg" id="gnMode"><button type="button" data-m="cark" class="on">🎡 Çark<small>Kayıtlar çekilişe kadar açık, çark döner</small></button><button type="button" data-m="mini">⚡ Mini<small>Kısa çekiliş: kayıtlar 10 dk önce kapanır</small></button><button type="button" data-m="rastgele">🎲 Rastgele<small>Katılanlar arasından ışık gezer, bir kişide durur</small></button></div></div>' +
            '<div class="gw-f"><span>Görsel</span><div class="gw-presets" id="gnPre">' + PRESETS.map(function (p) { return '<button type="button" data-p="' + p[0] + '"' + (p[0] === pick ? ' class="on"' : '') + '><img src="/img/cekilis/' + p[0] + '.svg" alt="" loading="lazy"><span>' + esc(p[1]) + '</span></button>'; }).join("") + '</div></div>' +
            '<div class="gw-row2"><label class="gw-f"><span>Başlık *</span><input id="gnTitle" maxlength="80" required placeholder="Küp çekilişi"></label>' +
            '<label class="gw-f"><span>Ödül *</span><input id="gnPrize" maxlength="120" required placeholder="3x3 manyetik speed küp"></label></div>' +
            // açıklama ve kendi görsel bağlantısı yalnız site sahibinin hesabında görünür
            (owner ? '<label class="gw-f"><span>Açıklama</span><textarea id="gnDesc" maxlength="1500" rows="3" placeholder="Şartlar, sponsor, notlar…"></textarea></label>' +
            '<label class="gw-f"><span>Kendi görsel bağlantın (isteğe bağlı, hazır görselin yerine)</span><input id="gnImg" maxlength="500" placeholder="https://…jpg"></label>' : '') +
            '<label class="gw-f"><span>Çekiliş tarihi ve saati *</span><input id="gnAt" type="datetime-local" required></label>' +
            '<div class="gw-f"><span>Katılma şartları</span><div class="gw-reqbox"><p class="gw-note" style="margin:0 0 8px">Her çekilişte: hesap açık ve bildirimler açık olmalı.</p>' +
            YT_DEF.map(function (c, i) { return '<div class="gw-ych"><label class="gw-chkf"><input type="checkbox" class="gnYt" data-i="' + i + '" checked> YouTube aboneliği: <b>' + esc(c[0]) + '</b></label>' +
                '<div class="gw-row"><input class="gnYtName" maxlength="40" value="' + esc(c[0]) + '" aria-label="Kanal adı"><input class="gnYtUrl" maxlength="120" value="' + esc(c[1]) + '" placeholder="https://www.youtube.com/@kanal" aria-label="Kanal bağlantısı"></div></div>'; }).join("") +
            '<p class="gw-note" style="margin:6px 0 0">İşaretli her kanal için katılımcıdan ayrı bir abonelik ekran görüntüsü istenir.</p></div></div>' +
            '<label class="gw-check"><input type="checkbox" id="gnTest"> <span><b>🧪 Deneme çekilişi</b><small>Ödül verilmez, kartında "Deneme" yazar. Herkes katılabilir; katılanların adı kendiliğinden listeye gelir. Kayıtlar çekiliş anına kadar açık kalır, istediğin an çekebilirsin.</small></span></label>' +
            '<p class="gw-note" id="gnInfo"></p>' +
            '<button type="submit" class="btn primary">Oluştur</button><div class="gw-msg" id="gnMsg"></div></form></details>';
        function info() {
            var t = $("gnTest").checked;
            $("gnInfo").textContent = t ? "Deneme: kayıtlar çekiliş saatine kadar açık; Şimdi çek ile hemen çekebilirsin." : mode === "mini" ? "Mini: kayıtlar çekilişten 10 dakika önce kapanır." : mode === "rastgele" ? "Rastgele: kayıtlar çekiliş anına kadar açık; kazanan katılımcı listesinden rastgele seçilir." : "Çark: kayıtlar çekiliş anına kadar açık.";
        }
        function suggest() {
            var p = PRESETS.filter(function (x) { return x[0] === pick; })[0];
            $("gnTitle").placeholder = (mode === "mini" ? "Mini " + p[2].charAt(0).toLocaleLowerCase("tr") + p[2].slice(1) : p[2]); $("gnPrize").placeholder = p[3];
        }
        $("gnMode").onclick = function (e) { var b = e.target.closest("button"); if (!b) return; mode = b.getAttribute("data-m"); Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); }); info(); suggest(); };
        $("gnPre").onclick = function (e) { var b = e.target.closest("button"); if (!b) return; pick = b.getAttribute("data-p"); Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); }); suggest(); };
        $("gnTest").onchange = function () {
            info();
            if (this.checked && !$("gnAt").value) { var d = new Date(Date.now() + 5 * 60000); d.setSeconds(0, 0); $("gnAt").value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
            if (this.checked && !$("gnTitle").value) $("gnTitle").value = "Deneme çekilişi";
            if (this.checked && !$("gnPrize").value) $("gnPrize").value = "Deneme (ödül yok)";
        };
        info(); suggest();
        $("gwNew").onsubmit = function (e) {
            e.preventDefault();
            var test = $("gnTest").checked, close = test ? 0 : CLOSE[mode];
            var at = new Date($("gnAt").value).getTime(), img = $("gnImg") ? $("gnImg").value.trim() : "";
            if (!at || at <= Date.now() + 60000) { $("gnMsg").textContent = "En az 1 dakika sonrası için bir tarih seç."; return; }
            if (!test && close && at - close < Date.now() && !confirm("Çekilişe 10 dakikadan az var: kayıtlar hemen kapalı olur. Yine de oluşturulsun mu?")) return;
            if (img && !/^https:\/\//.test(img)) { $("gnMsg").textContent = "Görsel bağlantısı https:// ile başlamalı."; return; }
            var ycs = [], bad = "";
            Array.prototype.forEach.call(document.querySelectorAll(".gw-ych"), function (row) {
                if (!row.querySelector(".gnYt").checked) return;
                var n = row.querySelector(".gnYtName").value.replace(/\|/g, " ").trim(), u = row.querySelector(".gnYtUrl").value.replace(/\|/g, "").trim();
                if (!n) bad = "Kanal adını yaz.";
                else if (u && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(u)) bad = "Kanal bağlantısı bir YouTube adresi olmalı.";
                ycs.push([n, u]);
            });
            if (bad) { $("gnMsg").textContent = bad; return; }
            var yt = ycs.map(function (c) { return c[0]; }).join("|"), ytUrl = ycs.length ? ycs.map(function (c) { return c[1]; }).join("|") : "";
            var u = me(), id = newId(), o = { title: $("gnTitle").value.trim(), prize: $("gnPrize").value.trim(), desc: $("gnDesc") ? $("gnDesc").value.trim() : "", img: img || "/img/cekilis/" + pick + ".svg", drawAt: at, closeAt: at - close, host: u.uid, hName: myName(), st: "open", n: 0, x: "", ts: Date.now(), mode: mode, test: test, yt: yt, ytUrl: ytUrl };
            var b = this.querySelector("button[type=submit]"); b.disabled = true;
            patch("/giveaways/" + id, o, "&currentDocument.exists=false").then(function (r) {
                b.disabled = false;
                if (!r.ok) { $("gnMsg").textContent = "Oluşturulamadı (" + r.status + ")."; return; }
                openOne(id);
            }, function () { b.disabled = false; $("gnMsg").textContent = "Bağlantı hatası."; });
        };
    }

    /* ---------- animasyonlar: çark ve mini (slot) ---------- */
    var Draw = {
        COLORS: ["#2b50d6", "#e6252f", "#f6c719", "#179e4f", "#ff7a1a", "#7c3aed", "#0ea5e9", "#db2777"],
        run: function (el, mode, names, winner, done) { if (!el) return; return mode === "mini" ? this.mini(el, names, winner, done) : mode === "rastgele" ? this.grid(el, names, winner, done) : this.wheel(el, names, winner, done); },
        // rastgele: katılımcı kutuları arasında ışık gezer, yavaşlayıp kazananda durur
        grid: function (el, names, winner, done) {
            var others = names.filter(function (n) { return n !== winner; });
            for (var i = others.length - 1; i > 0; i--) { var j = rnd(i + 1), t = others[i]; others[i] = others[j]; others[j] = t; }
            var list = others.slice(0, 29); list.splice(rnd(list.length + 1), 0, winner);
            el.innerHTML = '<div class="gw-grid">' + list.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join("") + '</div>';
            var cells = el.querySelectorAll(".gw-grid span"), wi = list.indexOf(winner), cur = -1, delay = 60, steps = 0, total = 20 + rnd(6);
            (function step() {
                if (!el.isConnected) return;
                if (cur >= 0) cells[cur].classList.remove("on");
                if (steps >= total) { cells[wi].classList.add("on", "win"); if (done) done(); return; }
                var nx; do { nx = rnd(cells.length); } while (cells.length > 1 && nx === cur);
                if (steps === total - 1) nx = wi;
                cur = nx; cells[cur].classList.add("on"); steps++; delay = Math.min(420, delay * 1.12); setTimeout(step, delay);
            })();
        },
        wheel: function (el, names, winner, done) {
            // en fazla 24 dilim: kalabalıkta kazanan + rastgele 23 kişi gösterilir
            var others = names.filter(function (n, i) { return n !== winner || names.indexOf(winner) !== i; }).filter(function (n) { return n !== winner; });
            for (var i = others.length - 1; i > 0; i--) { var j = rnd(i + 1), t = others[i]; others[i] = others[j]; others[j] = t; }
            var list = others.slice(0, 23); list.splice(rnd(list.length + 1), 0, winner);
            if (list.length < 2) list.push("…");
            var n = list.length, seg = 360 / n, R = 140, C = this.COLORS, wi = list.indexOf(winner);
            var p = function (a, r) { a = (a - 90) * Math.PI / 180; return (150 + r * Math.cos(a)).toFixed(2) + "," + (150 + r * Math.sin(a)).toFixed(2); };
            var sl = list.map(function (nm, i) {
                var a0 = i * seg, a1 = (i + 1) * seg, col = C[i % C.length]; if (n % C.length === 1 && i === n - 1) col = C[2];
                var dark = col === "#f6c719" || col === "#0ea5e9";
                var label = nm.length > 12 ? nm.slice(0, 11) + "…" : nm, mid = a0 + seg / 2;
                return '<path d="M150,150 L' + p(a0, R) + ' A' + R + ',' + R + ' 0 ' + (seg > 180 ? 1 : 0) + ',1 ' + p(a1, R) + ' Z" fill="' + col + '" stroke="#fff" stroke-width="2"/>' +
                    '<text x="150" y="150" transform="rotate(' + (mid - 90) + ' 150 150) translate(' + (R - 12) + ' 0)" text-anchor="end" dominant-baseline="middle" font-size="' + (n > 16 ? 10 : n > 10 ? 12 : 14) + '" font-weight="800" fill="' + (dark ? "#15171c" : "#fff") + '" font-family="Inter,sans-serif">' + esc(label) + '</text>';
            }).join("");
            var bulbs = ""; for (var k = 0; k < 24; k++) bulbs += '<circle class="gw-bulb' + (k % 2 ? ' b2' : '') + '" cx="' + p(k * 15, 146).split(",")[0] + '" cy="' + p(k * 15, 146).split(",")[1] + '" r="2.6"/>';
            el.innerHTML = '<div class="gw-wheel"><div class="gw-ptr"></div><svg viewBox="0 0 300 300"><defs><radialGradient id="gwHub" cx="40%" cy="35%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e5e7eb"/></radialGradient><radialGradient id="gwShade" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient></defs>' +
                '<circle cx="150" cy="150" r="150" fill="#15171c"/><g class="gw-wg">' + sl + '</g><circle cx="150" cy="150" r="140" fill="url(#gwShade)" pointer-events="none"/>' + bulbs +
                '<circle cx="150" cy="150" r="26" fill="url(#gwHub)" stroke="#15171c" stroke-width="4"/><image href="/RubikAcademyLogo.png" x="134" y="134" width="32" height="32"/></svg></div><div class="gw-wname" id="gwWName"></div>';
            var g = el.querySelector(".gw-wg"), target = 360 * 6 - (wi * seg + seg / 2) + (rnd(60) - 30) / 100 * seg;
            g.style.transformOrigin = "150px 150px"; g.style.transform = "rotate(0deg)";
            var wh = el.querySelector(".gw-wheel"); wh.classList.add("spin");
            requestAnimationFrame(function () { requestAnimationFrame(function () { g.style.transition = "transform 6s cubic-bezier(.12,.62,.08,1)"; g.style.transform = "rotate(" + target + "deg)"; }); });
            setTimeout(function () { wh.classList.remove("spin"); wh.classList.add("won"); var w = el.querySelector(".gw-wname"); if (w) { w.textContent = "🏆 " + winner; w.classList.add("on"); } if (done) done(); }, 6200);
        },
        mini: function (el, names, winner, done) {
            el.innerHTML = '<div class="gw-slot"><div class="gw-slot-in" id="gwSlotIn"></div></div>';
            var box = el.querySelector(".gw-slot-in"), delay = 45, steps = 0;
            (function step() {
                if (!box.isConnected) return;
                if (delay > 380) { box.textContent = winner; box.parentNode.classList.add("win"); if (done) done(); return; }
                box.textContent = names[rnd(names.length)]; box.classList.remove("tick"); void box.offsetWidth; box.classList.add("tick");
                steps++; delay *= 1.1; setTimeout(step, delay);
            })();
        }
    };

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
    document.addEventListener("ra-push-change", function () { if (S.g) renderOne(); });
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
    window.Cekilis = { _s: S, draw: draw, Draw: Draw, refresh: function () { return checkRole().then(function () { if (S.g) return fetchOne(S.g.id).then(renderOne); return loadList(); }); } };
})();
