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
    // veritabanı kotası/yoğunluğu (429, 503): birkaç kez bekleyip yeniden dene
    var _fetch = window.fetch.bind(window);
    function fetch(url, o) {
        var n = 0;
        return (function go() {
            return _fetch(url, o).then(function (r) {
                // kota doluysa bekletme: bir kez kısa dene, sonra hemen yedeğe geç
                if ((r.status === 429 || r.status === 503) && !S.quota && n < 1) { n++; return new Promise(function (res) { setTimeout(res, 300); }).then(go); }
                if (r.status === 429) S.quota = true; else if (r.ok) S.quota = false;
                return r;
            });
        })();
    }
    var _bk = null;
    function backup() { return _bk || (_bk = _fetch("/data/cekilis-yedek.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })); }
    // kaydedilen değişikliği hemen göster (veritabanı okunamasa bile): sayfadaki, önbellekteki ve listedeki kayıt güncellenir
    function applyLocal(id, o, only) {
        var f = enc(o);
        if (S.g && S.g.id === id) Object.keys(o).forEach(function (k) { S.g[k] = o[k]; });
        if (only) return;
        var d = cacheGet("g:" + id);
        if (!d && S.g && S.g.id === id) { var o2 = {}; Object.keys(S.g).forEach(function (k) { if (k !== "id" && k.charAt(0) !== "_" && S.g[k] != null) o2[k] = S.g[k]; }); d = { name: docName("/giveaways/" + id), fields: enc(o2) }; }
        if (d && d.fields) { Object.assign(d.fields, f); cacheSet("g:" + id, d); }
        var l = cacheGet("list"); if (!l && S.list && S.list.length) { l = { documents: S.list.map(function (x) { var o3 = {}; Object.keys(x).forEach(function (k) { if (k !== "id" && k.charAt(0) !== "_" && x[k] != null) o3[k] = x[k]; }); return { name: docName("/giveaways/" + x.id), fields: enc(o3) }; }) }; }
        if (l && l.documents) { l.documents.forEach(function (x) { if (x.name.split("/").pop() === id) Object.assign(x.fields, f); }); cacheSet("list", l); }
        (S.list || []).forEach(function (x) { if (x.id === id) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); });
    }
    function cacheSet(k, v) { try { localStorage.setItem("ra-gw-c:" + k, JSON.stringify(v)); } catch (e) {} }
    function cacheGet(k) { try { return JSON.parse(localStorage.getItem("ra-gw-c:" + k) || "null"); } catch (e) { return null; } }
    function req(path, opts) {
        opts = opts || {};
        var u = me(), url = ROOT + path;
        var h = { "Content-Type": "application/json" };
        if (!u || !Account.token) return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(cfg.apiKey), { method: opts.method || "GET", headers: h, body: opts.body });
        var pub = function () { return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(cfg.apiKey), { method: "GET", headers: { "Content-Type": "application/json" } }); };
        var get = !opts.method || opts.method === "GET";
        return Account.token().then(function (t) { h.Authorization = "Bearer " + t; return fetch(url, { method: opts.method || "GET", headers: h, body: opts.body }); }, function (e) { if (get) return pub(); throw e; })
            // oturum anahtarı geçersiz/eskiyse herkese açık okumayı girişsiz yeniden dene (liste boş görünmesin)
            .then(function (r) { if (get && (r.status === 401 || r.status === 403) && !/\/(proof|claim|rev)(\/|\?|$)/.test(path)) return pub().then(function (r2) { return r2.ok ? r2 : r; }); return r; });
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
    // elle eklenen katılımcı (hesabı yok): kimliği "m_" ile başlar; yalnız site sahibi ekler
    // kazanandan istenecek bilgiler: ask yoksa (eski çekilişler) ad + telefon + e-posta + adres
    var ASK = [["name", "Ad soyad"], ["phone", "Telefon"], ["email", "E-posta"], ["address", "Posta adresi (il, ilçe, açık adres)"]];
    function askL(g) { return g.ask == null ? ["name", "phone", "email", "address"] : String(g.ask).split(",").filter(Boolean); }
    function needInfo(g) { return !!(askL(g).length || g.askQ); }
    function isM(uid) { return /^m_/.test(String(uid || "")); }
    function isOwner() { return !!(window.Account && Account.isAdmin && Account.isAdmin()); }
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
    var PF = ["img", "img2", "img3", "img4"]; // img3 / img4: 1. ve 2. WhatsApp topluluğu bonus görseli
    var WA_DEF = [["Mert Sağdınç", ""], ["Rubik Academy", ""]];
    function waList(g) { var n = String(g.wa || "").split("|"), u = String(g.waUrl || "").split("|"); return n.map(function (x, i) { return { name: x.trim(), url: (u[i] || "").trim() }; }).filter(function (c) { return c.name; }).slice(0, 2); }
    function waLabel(g) { return waList(g).map(function (c) { return c.name; }).join(" veya ") + " WhatsApp topluluğu"; }

    // ?izle=1: başka bir sayfadaki açılır pencerede (iframe) kaçırılan çarkı göster
    var IZLE = /[?&]izle=1/.test(location.search), EMBED = (function () { try { return window.top !== window; } catch (e) { return true; } })();
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
            : p === "expired" ? '<span class="gw-chip">Onay süresi doldu · yeni kişiyi yetkili çekecek</span>'
            : p === "claimed" ? '<span class="gw-chip win">🏆 Kazanan: ' + esc(g.wName) + '</span>'
            : '<span class="gw-chip">Katılımcı olmadı</span>';
    }

    /* ---------- düzenleyen kişi, geri sayım, paylaş ---------- */
    var HOSTS = {};
    function initials(n) { return String(n || "R").trim().split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0).toLocaleUpperCase("tr"); }).join("") || "R"; }
    function orgHtml(g, big) {
        return '<div class="gw-org' + (big ? ' big' : '') + '"><span class="gw-ava" data-host="' + esc(g.host || "") + '">' + esc(initials(g.hName)) + '</span>' +
            '<div class="gw-orgt"><b data-hname="' + esc(g.host || "") + '">' + esc(g.hName || "Rubik Academy") + '</b><small>Çekilişi düzenleyen</small></div>' +
            (big && g.host ? '<a class="btn sm gw-orgp" href="/icerikler/profil?u=' + encodeURIComponent(g.host) + '" target="_blank" rel="noopener">Profil</a>' : '') + '</div>';
    }
    // düzenleyenin profil fotoğrafı ve adı (herkese açık profil)
    function fillHosts(root) {
        Array.prototype.forEach.call((root || document).querySelectorAll("[data-host]"), function (el) {
            var uid = el.getAttribute("data-host"); if (!uid) return;
            if (!HOSTS[uid]) HOSTS[uid] = req("/users/" + uid).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return d ? dec(d) : {}; }, function () { return {}; });
            HOSTS[uid].then(function (h) {
                if (h.photo && /^(https:|data:image\/)/.test(h.photo)) el.innerHTML = '<img src="' + esc(h.photo) + '" alt="" referrerpolicy="no-referrer">';
                if (h.accent && /^#[0-9a-f]{3,8}$/i.test(h.accent)) el.style.background = h.accent;
                if (h.name) Array.prototype.forEach.call(document.querySelectorAll('[data-hname="' + uid + '"]'), function (b) { b.textContent = String(h.name).slice(0, 40); });
            });
        });
    }
    function cdTarget(g) { var p = phase(g); return p === "open" ? [g.closeAt, g.closeAt < g.drawAt ? "Kayıtların kapanmasına" : "Çekilişe kalan"] : p === "closed" ? [g.drawAt, "Çekilişe kalan"] : null; }
    function cdHtml(g) {
        var t = cdTarget(g); if (!t) return '<div class="gw-cdst">' + stLabel(g) + '</div>';
        return '<div class="gw-cdw"><small>' + t[1] + '</small><div class="gw-cd" data-t="' + t[0] + '">' + ["Gün", "Saat", "Dakika", "Saniye"].map(function (x) { return '<div><b>00</b><span>' + x + '</span></div>'; }).join("") + '</div></div>';
    }
    function updCd() {
        Array.prototype.forEach.call(document.querySelectorAll(".gw-cd[data-t]"), function (el) {
            var l = Math.max(0, +el.getAttribute("data-t") - Date.now()), sec = Math.floor(l / 1000);
            var v = [Math.floor(sec / 86400), Math.floor(sec % 86400 / 3600), Math.floor(sec % 3600 / 60), sec % 60];
            Array.prototype.forEach.call(el.querySelectorAll("b"), function (b, i) { var t = String(v[i]).padStart(2, "0"); if (b.textContent !== t) b.textContent = t; });
        });
    }
    function share(g, btn) {
        var url = "https://rubikacademy.fun/icerikler/cekilis?id=" + encodeURIComponent(g.id), t = g.title + " — " + (g.prize || "") + " | Rubik Academy";
        if (navigator.share) { navigator.share({ title: t, text: "🎁 " + t, url: url }).catch(function () {}); return; }
        var ok = function () { if (btn) { var o = btn.innerHTML; btn.innerHTML = "✓ Bağlantı kopyalandı"; setTimeout(function () { btn.innerHTML = o; }, 1800); } };
        try { navigator.clipboard.writeText(url).then(ok, function () { prompt("Bağlantı:", url); }); } catch (e) { prompt("Bağlantı:", url); }
    }

    /* ---------- liste ---------- */
    function loadList() {
        // çekiliş listesi herkese açık: oturum anahtarı beklenmeden doğrudan okunur
        var url = ROOT + "/giveaways?pageSize=60&key=" + encodeURIComponent(cfg.apiKey);
        return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { cacheSet("list", d); return d; }, function (e) {
            var c = cacheGet("list"); if (c) { S.stale = true; return c; }
            // veritabanı kotası dolduysa sitedeki yedek liste
            return backup().then(function (b) { if (b) { S.stale = true; return b; } throw e; });
        }).then(function (d) {
            S.list = ((d && d.documents) || []).map(dec).sort(function (a, b) {
                // yöneticinin sabitlediği çekiliş en üstte (herkese etiketsiz görünür)
                var qa = +a.pin || 0, qb = +b.pin || 0; if (qa || qb) return qb - qa;
                var pa = phase(a) === "claimed" || phase(a) === "empty" ? 1 : 0, pb = phase(b) === "claimed" || phase(b) === "empty" ? 1 : 0;
                return pa - pb || (pa ? b.drawAt - a.drawAt : a.drawAt - b.drawAt);
            });
            S.listLoaded = true; renderList();
        }).catch(function (e) { $("gwList").innerHTML = '<p class="gw-empty">' + (String(e && e.message) === "429" ? "Site şu an çok yoğun, çekilişler birazdan yüklenecek. Lütfen biraz sonra sayfayı yenile." : "Çekilişler yüklenemedi (" + esc(e && e.message || "bağlantı") + "). Sayfayı yenile.") + '</p>'; setTimeout(loadList, 15000); });
    }
    function card(g) {
        var p = phase(g);
        return '<a class="gw-card" href="/icerikler/cekilis?id=' + encodeURIComponent(g.id) + '" data-id="' + esc(g.id) + '">' + orgHtml(g, false) +
            '<div class="gw-imgw"><img class="gw-img" src="' + esc(imgOf(g)) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/img/cekilis/kup.svg\'"><div class="gw-tags">' + badges(g) + '</div>' +
            // yalnız yetkililer görür: listeden de sabitle / kaldır
            (S.mgr ? '<button type="button" class="gw-pinb' + (g.pin ? ' on' : '') + '" data-pin="' + esc(g.id) + '" title="' + (g.pin ? 'Sabitlemeyi kaldır' : 'En üste sabitle') + '">📌 ' + (g.pin ? 'Sabitli' : 'Sabitle') + '</button>' : '') + '</div>' +
            '<div class="gw-cbody"><b>' + esc(g.title) + '</b>' +
            '<div class="gw-cstats"><div><span>Katılımcı</span><b class="gw-cn" data-n="' + esc(g.id) + '">' + (p === "open" || p === "closed" ? "…" : (g.n || 0)) + '</b></div><div><span>Ödül</span><b class="gw-prize">' + esc(g.prize || "") + '</b></div></div>' +
            cdHtml(g) +
            '<div class="gw-cbtns"><span class="btn sm">Detaylar</span>' + (p === "open" ? '<span class="btn sm primary">Çekilişe katıl</span>' : '') + '</div>' +
            '<button type="button" class="btn sm gw-share" data-share="' + esc(g.id) + '">↗ Çekilişi paylaş</button></div></a>';
    }
    function renderList() {
        var box = $("gwList");
        if (!S.listLoaded) { box.innerHTML = '<p class="gw-empty">Yükleniyor…</p>'; return; }
        box.innerHTML = S.list.length ? S.list.map(card).join("") : '<div class="gw-emptyc"><img src="/img/cekilis/kup.svg" alt=""><div><b>Şu an açık çekiliş yok</b><p>Yeni çekilişler burada ve bildirimlerde duyurulur. Takipte kal!</p></div></div>';
        Array.prototype.forEach.call(box.querySelectorAll(".gw-card"), function (a) {
            a.onclick = function (e) { e.preventDefault(); openOne(a.getAttribute("data-id")); };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-share]"), function (b) {
            b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var g = S.list.filter(function (x) { return x.id === b.getAttribute("data-share"); })[0]; if (g) share(g, b); };
        });
        // açık çekilişlerin katılımcı sayısı
        S.list.forEach(function (g) { var p = phase(g); if (p !== "open" && p !== "closed") return; countEntries(g.id).then(function (n) { var e = box.querySelector('.gw-cn[data-n="' + g.id + '"]'); if (e && n != null) e.textContent = n; }); });
        fillHosts(box); updCd(); deletedBox();
        Array.prototype.forEach.call(box.querySelectorAll("[data-pin]"), function (b) {
            b.onclick = function (e) {
                e.preventDefault(); e.stopPropagation(); b.disabled = true;
                var g = S.list.filter(function (x) { return x.id === b.getAttribute("data-pin"); })[0]; if (!g) return;
                patch("/giveaways/" + g.id, { pin: g.pin ? 0 : Date.now() }).then(function (r) { if (!r.ok) throw 0; return loadList(); }).catch(function () { b.disabled = false; alert("Sabitlenemedi."); });
            };
        });
    }

    /* ---------- site sahibi: yanlışlıkla silinen çekilişi yedekten geri yükle ----------
       Silmek yalnız çekiliş belgesini siler; katılımcılar, görseller ve incelemeler (alt koleksiyonlar) durur.
       Belge, sitedeki yedekteki (data/cekilis-yedek.json) son hâliyle yeniden yazılır. */
    var GK = ["title", "prize", "desc", "img", "drawAt", "closeAt", "host", "hName", "st", "w", "wName", "wAt", "claimBy", "cAt", "x", "n", "ts", "mode", "test", "yt", "ytUrl", "pin", "onlyOk", "wa", "waUrl", "wn", "man", "ask", "askQ"];
    function deletedBox() {
        if (!isOwner() || S.stale || !S.listLoaded) return;
        backup().then(function (b) {
            var have = {}; S.list.forEach(function (g) { have[g.id] = 1; });
            var del = ((b && b.documents) || []).map(dec).filter(function (g) { return !have[g.id]; });
            var box = $("gwList"); if (!del.length || !box || box.querySelector(".gw-delb")) return;
            var d = document.createElement("div"); d.className = "gw-delb";
            d.innerHTML = '<h4>🗂 Silinen çekilişler</h4><p class="gw-note">Yalnız sen görürsün. Geri yüklenince katılımcılar ve görselleri aynen geri gelir (silme yalnız çekilişin kendisini siler).</p>' +
                del.map(function (g) { return '<div class="gw-delr"><span><b>' + esc(g.title) + '</b><small>' + esc(dtS(g.drawAt)) + ' · yedekteki son hâli</small></span><button type="button" class="btn sm primary" data-restore="' + esc(g.id) + '">↩ Geri yükle</button></div>'; }).join("");
            box.insertBefore(d, box.firstChild);
            Array.prototype.forEach.call(d.querySelectorAll("[data-restore]"), function (btn) {
                btn.onclick = function () {
                    var g = del.filter(function (x) { return x.id === btn.getAttribute("data-restore"); })[0]; if (!g || !confirm("“" + g.title + "” geri yüklensin mi?")) return;
                    btn.disabled = true; btn.textContent = "Yükleniyor…";
                    restoreGw(g).then(function () { openOne(g.id); }, function () { btn.disabled = false; btn.textContent = "↩ Geri yükle"; alert("Geri yüklenemedi. Tekrar dene."); });
                };
            });
        });
    }
    function restoreGw(g) {
        var o = {}; GK.forEach(function (k) { if (g[k] != null && g[k] !== "") o[k] = g[k]; });
        // kural gereği yeni belge geleceğe tarihli ve "open" açılır; hemen ardından asıl alanlar yazılır
        var t = Date.now() + 10 * 60000, first = Object.assign({}, o, { host: me().uid, st: "open", drawAt: t, closeAt: t });
        ["w", "wName", "wAt", "claimBy", "cAt"].forEach(function (k) { delete first[k]; });
        return patch("/giveaways/" + g.id, first, "&currentDocument.exists=false").then(function (r) {
            if (!r.ok) throw 0;
            return patch("/giveaways/" + g.id, o);
        }).then(function (r) { if (!r.ok) throw 0; cacheSet("list", null); });
    }

    /* ---------- site sahibi: kazananı elle düzenle ---------- */
    function winEdHtml(g, p) {
        if (!isOwner() || p === "open") return "";
        return '<details class="gw-madd gw-wed" id="gwWEd"><summary>✍️ Kazananı elle düzenle</summary><p class="gw-note">Yanlış kişi görünüyorsa katılımcılardan doğru kişiyi seç. Onaylanmış sayılır; çark yeniden dönmez, kazanana bildirim gider. Yalnız sen görürsün.</p>' +
            '<div class="gw-maddr"><select id="gwWSel" aria-label="Kazanan"><option value="">Katılımcılar yükleniyor…</option></select><button type="button" class="btn sm primary" id="gwWBtn" disabled>Kazanan yap</button></div><p class="gw-msg" id="gwWMsg"></p></details>';
    }
    function bindWinEd(g) {
        var d = $("gwWEd"); if (!d) return;
        d.addEventListener("toggle", function () {
            if (!d.open || d._ld) return; d._ld = 1;
            listEntries(g.id).then(function (l) {
                l = l.slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), "tr"); });
                $("gwWSel").innerHTML = '<option value="">Kişi seç…</option>' + l.map(function (x) { return '<option value="' + esc(x.uid) + '"' + (x.uid === g.w ? ' selected' : '') + '>' + esc(x.name) + (x.uid === g.w ? ' (şu anki kazanan)' : '') + '</option>'; }).join("");
                S.wedList = l; $("gwWBtn").disabled = false;
            }, function () { $("gwWMsg").textContent = "Katılımcılar yüklenemedi."; });
        });
        $("gwWBtn").onclick = function () {
            var uid = $("gwWSel").value, x = (S.wedList || []).filter(function (y) { return y.uid === uid; })[0], m = $("gwWMsg"), b = this;
            if (!x) { m.textContent = "Bir kişi seç."; m.className = "gw-msg bad"; return; }
            if (!confirm("Kazanan “" + x.name + "” olarak kaydedilsin mi?")) return;
            b.disabled = true;
            var now = Date.now(), o = { st: "claimed", w: x.uid, wName: x.name, wAt: now, claimBy: now, cAt: now, man: true };
            patch("/giveaways/" + g.id, o).then(function (r) {
                if (!r.ok) throw 0;
                if (!isM(x.uid)) patch("/users/" + x.uid + "/notifications/" + newId(), { text: "🎉 Tebrikler! “" + g.title + "” çekilişinin kazananı sensin. Ödül için çekiliş sayfasını aç: rubikacademy.fun/icerikler/cekilis?id=" + g.id, ts: Date.now(), pushed: false }).catch(function () {});
                return fetchOne(g.id).then(function () { renderOne(); });
            }).catch(function () { b.disabled = false; m.textContent = "Kaydedilemedi, tekrar dene."; m.className = "gw-msg bad"; });
        };
    }

    /* ---------- tek çekiliş ---------- */
    function openOne(id, noPush) {
        if (!noPush) try { history.pushState(null, "", "/icerikler/cekilis?id=" + encodeURIComponent(id)); } catch (e) {}
        $("gwListWrap").hidden = true; $("gwOne").hidden = false; $("gwOne").innerHTML = '<p class="gw-empty">Yükleniyor…</p>';
        S.g = null; S.entries = null; S.pplSeen = 0;
        fetchOne(id).then(function () { if (!S.g) { $("gwOne").innerHTML = '<p class="gw-empty">Çekiliş bulunamadı. <a href="/icerikler/cekilis">Tüm çekilişler</a></p>'; return; } renderOne(); schedule(); });
        try { window.scrollTo(0, 0); } catch (e) {}
    }
    function backToList() {
        clearTimeout(S.pollT); S.g = null;
        try { history.pushState(null, "", "/icerikler/cekilis"); } catch (e) {}
        $("gwOne").hidden = true; $("gwListWrap").hidden = false; loadList();
    }
    // light: yalnız çekiliş belgesi (1 okuma); katılımım ve kişi sayısı önceki değerinde kalır
    function fetchOne(id, light) {
        var u = light ? null : me();
        return Promise.all([
            fetch(ROOT + "/giveaways/" + id + "?key=" + encodeURIComponent(cfg.apiKey)).then(function (r) { if (!r.ok) throw r.status; return r.json(); }).then(function (d) { cacheSet("g:" + id, d); return d; }, function () { return cacheGet("g:" + id) || backup().then(function (b) { return b && (b.documents || []).filter(function (x) { return x.name.split("/").pop() === id; })[0] || null; }); }),
            // kendi katılımım: herkese açık belge, oturum beklenmeden okunur
            u ? fetch(ROOT + "/giveaways/" + id + "/e/" + u.uid + "?key=" + encodeURIComponent(cfg.apiKey)).then(function (r) { return r.ok ? r.json() : r.status === 404 ? null : (localJoined(id) ? { fields: {} } : null); }, function () { return localJoined(id) ? { fields: {} } : null; }) : Promise.resolve(null),
            light ? Promise.resolve(null) : countEntries(id)
        ]).then(function (res) {
            if (light) res[1] = undefined;
            if (!res[0]) { if (!S.g || S.g.id !== id) S.g = null; return; }
            var prev = S.g; S.g = dec(res[0]); S.joined = !!res[1] || (prev && prev.id === S.g.id && S.joined && res[1] === undefined); S.myBonus = res[1] ? (function (e) { return (e.b ? 1 : 0) + (e.b2 ? 1 : 0); })(dec(res[1])) : 0; if (res[2] != null) S.count = res[2];
            if (S.joined) remember(S.g);
            if (prev && prev.id === S.g.id && S.g.w && S.g.w !== prev.w && !S.g.man && (S.g.st === "drawn" || (S.g.st === "claimed" && (isM(S.g.w) || S.g.cAt === S.g.wAt)))) {
                if (me() && me().uid === S.g.w) S.winShown = 1; // onay penceresini animasyon sonunda aç
                reveal(S.g);
            } else if ((!prev || prev.id !== S.g.id) && missed(S.g)) {
                if (me() && me().uid === S.g.w) S.winShown = 1;
                reveal(S.g, true);
            } else if (EMBED && !S.embedDone) embedClose();
            S.embedDone = 1;
        }).catch(function () {});
    }
    function countEntries(id) {
        var body = { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: "e" }] }, aggregations: [{ alias: "n", count: {} }] } };
        return fetch(ROOT + "/giveaways/" + id + ":runAggregationQuery?key=" + encodeURIComponent(cfg.apiKey), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : []; }).then(function (a) {
            var x = a && a[0] && a[0].result && a[0].result.aggregateFields && a[0].result.aggregateFields.n;
            if (x) { cacheSet("n:" + id, +x.integerValue); return +x.integerValue; }
            throw 0;
        }).catch(function () {
            // kota doluyken: bilinen son sayı (bu cihazdaki kayıt ya da sitedeki yedek); bu cihazda katıldıysan en az o kadar
            var c = cacheGet("n:" + id);
            return backup().then(function (b) { var n = Math.max(c || 0, (b && b._n && b._n[id]) || 0); return n ? n + (localJoined(id) && c == null ? 1 : 0) : null; });
        });
    }
    // yönetici inceleme sonuçları: { uid: "ok" | "no" }
    function listRev(id) {
        var out = {};
        function page(tok) {
            return req("/giveaways/" + id + "/rev?pageSize=300" + (tok ? "&pageToken=" + encodeURIComponent(tok) : "")).then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) {
                (d.documents || []).forEach(function (x) { var o = dec(x); out[o.id] = { v: o.v || "", b: o.b || "", b2: o.b2 || "", ts: o.ts || 0 }; });
                return d.nextPageToken ? page(d.nextPageToken) : out;
            });
        }
        return page().catch(function () { return out; });
    }
    function changedAfter(uid) { var r = (S.rev || {})[uid], c = (S.chk || {})[uid]; return !!(r && c && c.pts && r.ts && c.pts > r.ts + 1000); }
    function revOf(uid) { return changedAfter(uid) ? "" : ((S.rev || {})[uid] || {}).v || ""; }
    function revB(uid, k) { return changedAfter(uid) ? "" : ((S.rev || {})[uid] || {})[k || "b"] || ""; }
    // WhatsApp bonusu: her topluluk ayrı görsel + ayrı onay. Bir topluluk 2×, iki topluluk 3×.
    // b = 1. topluluk görseli (img3), b2 = 2. topluluk görseli (img4); onaylar rev.b / rev.b2
    var BK = ["b", "b2"];
    function waN(g) { return g && g.wa ? waList(g).length : 0; }
    function hasBk(x, i) { return !!(x[BK[i]] && i < waN(S.g)); }
    function bonusCnt(x, rv) { var r = (rv || S.rev || {})[x.uid] || {}; return [0, 1].filter(function (i) { return hasBk(x, i) && r[BK[i]] === "ok"; }).length; }
    // çarktaki ağırlık: 1 + onaylı bonus sayısı (+ site sahibinin verdiği ×2), en çok 3
    function weightOf(x, rv) { return 1 + Math.min(2, bonusCnt(x, rv) + (x.x2 ? 1 : 0)); }
    function bonusOk(x, rv) { return weightOf(x, rv) > 1; }
    // yüklenen (henüz incelenmemiş olabilir) bonus görsel sayısı
    function bonusUp(x) { return [0, 1].filter(function (i) { return hasBk(x, i); }).length; }
    function setRev(uid, v) {
        return setRevF(uid, "v", v);
    }
    // onay/ret kaldırılır: kişi yeniden "bekliyor" olur
    function clearRev(uid) {
        S.rev = S.rev || {}; var old = S.rev[uid]; delete S.rev[uid];
        return req("/giveaways/" + S.g.id + "/rev/" + uid, { method: "DELETE" }).then(function (r) { if (!r.ok) throw 0; }).catch(function () { S.rev[uid] = old; alert("Geri alınamadı."); paintCheck(); });
    }
    function setRevF(uid, k, v) {
        // görseller incelemeden sonra değiştiyse eski kararın diğer yarısı da silinir (yeniden incelensin)
        var stale = changedAfter(uid), others = ["v", "b", "b2"].filter(function (x) { return x !== k; });
        S.rev = S.rev || {}; var old = S.rev[uid]; S.rev[uid] = Object.assign({}, old || {}); S.rev[uid][k] = v; S.rev[uid].ts = Date.now(); if (stale) others.forEach(function (x) { delete S.rev[uid][x]; });
        var o = { ts: Date.now() }; o[k] = v;
        return req("/giveaways/" + S.g.id + "/rev/" + uid + "?" + mask(o) + (stale ? others.map(function (x) { return "&updateMask.fieldPaths=" + x; }).join("") : ""), { method: "PATCH", body: JSON.stringify({ fields: enc(o) }) }).then(function (r) { if (!r.ok) throw 0; }).catch(function () { S.rev[uid] = old; alert("Kaydedilemedi, tekrar dene."); paintCheck(); });
    }
    function listEntries(id) {
        var out = [];
        function page(tok) {
            return fetch(ROOT + "/giveaways/" + id + "/e?pageSize=300&key=" + encodeURIComponent(cfg.apiKey) + (tok ? "&pageToken=" + encodeURIComponent(tok) : "")).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
                (d.documents || []).forEach(function (x) { var o = dec(x); out.push({ uid: o.id, name: o.name || "Cuber", d: o.d || "", ts: o.ts || 0, b: !!o.b, b2: !!o.b2, m: !!o.m, x2: !!o.x2, oc: !!o.oc }); });
                return d.nextPageToken && out.length < 20000 ? page(d.nextPageToken) : out;
            });
        }
        return page();
    }
    // cihaz kimliği: aynı cihazdan birden çok hesapla katılımı yöneticiye göstermek için (kişisel bilgi değil, rastgele)
    // Biçim: "<rastgele kimlik>.<cihaz özeti>". Rastgele kimlik tarayıcı verisi silinince / uygulama ile Chrome
    // arasında değişir; cihaz özeti (ekran, saat dilimi, işlemci, model) değişmez ama aynı model iki farklı
    // telefonda da aynı çıkabilir → yalnız "muhtemelen aynı kişi" uyarısı olarak kullanılır, kendiliğinden çıkarmaz.
    function devFp() {
        try {
            var sc = window.screen || {}, a = [sc.width || 0, sc.height || 0].sort(function (p, q) { return p - q; }), ua = navigator.userAgent || "";
            var mm = /Android [\d.]+; ([^;)]+)[;)]/.exec(ua), model = mm && mm[1] !== "K" ? mm[1].trim() : /iPhone|iPad/.exec(ua) ? /iPhone|iPad/.exec(ua)[0] : "";
            var src = [a[0], a[1], Math.round((window.devicePixelRatio || 1) * 100), (Intl.DateTimeFormat().resolvedOptions().timeZone || ""), navigator.hardwareConcurrency || 0, navigator.deviceMemory || 0, navigator.maxTouchPoints || 0, model].join("|");
            var h = 2166136261; for (var i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
            return (h >>> 0).toString(36);
        } catch (e) { return ""; }
    }
    function devId() {
        var d = "";
        try { d = localStorage.getItem("ra-dev"); if (!d || !/^[a-z0-9]{16}$/.test(d)) { var c = "abcdefghijklmnopqrstuvwxyz0123456789"; d = ""; for (var i = 0; i < 16; i++) d += c[rnd(c.length)]; localStorage.setItem("ra-dev", d); } } catch (e) { d = ""; }
        var f = devFp(); return f ? d + "." + f : d;
    }
    function gapTxt(ms) { var m = Math.round(ms / 60000); return m < 60 ? Math.max(1, m) + " dk" : m < 1440 ? Math.round(m / 60) + " sa" : Math.round(m / 1440) + " gün"; }
    function devOf(x) { return String(x.d || "").split(".")[0]; }
    function fpOf(x) { return String(x.d || "").split(".")[1] || ""; }
    function normName(n) { return String(n || "").toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean); }
    // "Özgür" ↔ "Özgür Ayan": birinin kelimeleri diğerinin başı
    function similarName(a, b) {
        var p = normName(a), q = normName(b); if (!p.length || !q.length) return false;
        if (p.length > q.length) { var t = p; p = q; q = t; }
        if (p[0].length < 3) return false;
        for (var i = 0; i < p.length; i++) if (p[i] !== q[i]) return false;
        return true;
    }
    // Aynı cihaz kimliği olmayan ama muhtemelen aynı kişi olan gruplar: aynı cihaz özeti ya da 2 gün içinde benzer isimle katılım
    function maybeSame(l) {
        // aynı cihaz kimliğinden yalnız ilk katılan karşılaştırılır (diğerleri zaten kesin listede çıkarılır)
        var first = {}; l.slice().sort(function (p, q) { return (p.ts || 0) - (q.ts || 0); }).forEach(function (x) { var k = devOf(x); if (!x.m && (!k || !first[k])) first[k || x.uid] = x; });
        var xs = Object.keys(first).map(function (k) { return first[k]; }), par = {}, why = {};
        var find = function (u) { while (par[u] && par[u] !== u) u = par[u]; return u; };
        xs.forEach(function (x) { par[x.uid] = x.uid; });
        for (var i = 0; i < xs.length; i++) for (var j = i + 1; j < xs.length; j++) {
            var a = xs[i], b = xs[j]; if (devOf(a) && devOf(a) === devOf(b)) continue;
            var r = "";
            if (fpOf(a) && fpOf(a) === fpOf(b)) r = "aynı cihaz özellikleri";
            else if (similarName(a.name, b.name) && Math.abs((a.ts || 0) - (b.ts || 0)) < 2 * 86400000) r = "benzer isim, " + gapTxt(Math.abs((a.ts || 0) - (b.ts || 0))) + " arayla";
            if (!r) continue;
            par[find(b.uid)] = find(a.uid); why[a.uid] = why[a.uid] || r; why[b.uid] = why[b.uid] || r;
        }
        var g = {}; xs.forEach(function (x) { if (why[x.uid]) (g[find(x.uid)] = g[find(x.uid)] || []).push(x); });
        return Object.keys(g).map(function (k) { return g[k].sort(function (p, q) { return (p.ts || 0) - (q.ts || 0); }); }).filter(function (a) { return a.length > 1; }).map(function (a) { a.why = why; return a; });
    }
    function remember(g) { try { var j = JSON.parse(localStorage.getItem("ra-gw-joined") || "{}") || {}; j[g.id] = g.drawAt; localStorage.setItem("ra-gw-joined", JSON.stringify(j)); } catch (e) {} }
    function localJoined(id) { try { return !!(JSON.parse(localStorage.getItem("ra-gw-joined") || "{}") || {})[id]; } catch (e) { return false; } }
    function forget(g) { try { var j = JSON.parse(localStorage.getItem("ra-gw-joined") || "{}") || {}; delete j[g.id]; localStorage.setItem("ra-gw-joined", JSON.stringify(j)); } catch (e) {} }

    function dtS(ms) { try { return new Date(ms).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
    function winsHtml(g) {
        var p = phase(g), past = skipNames(g);
        var win = g.w && (p === "drawn" || p === "claimed" || p === "expired") ? '<div class="gw-winr' + (p === "claimed" ? " ok" : "") + '"><span class="gw-wava">' + esc(initials(g.wName)) + '</span><div><b>' + esc(g.wName) + '</b><small>' +
            (p === "claimed" ? "✅ Ödülü onayladı" : p === "drawn" ? "⏳ Onay bekleniyor (<span data-left=\"" + g.claimBy + "\">" + left(g.claimBy - Date.now()) + "</span>)" : "⌛ Onay süresi doldu") + '</small></div></div>' : '';
        if (!win && p !== "empty") return '<div class="gw-winfo">ℹ️ Bu çekiliş henüz sonuçlanmadı. Çekiliş yapılınca kazanan burada görünür.</div>';
        return (win || '<div class="gw-winfo">Çekilebilecek katılımcı kalmadı.</div>') + (past.length ? '<p class="gw-note">Onaylamayan: ' + past.map(esc).join(", ") + '</p>' : '');
    }
    function renderOne() {
        var g = S.g; if (!g) return;
        var p = phase(g), u = me(), now = Date.now(), iWon = u && g.w === u.uid;
        var act = "";
        if (p !== "open") S.editing = false;
        if (p === "open") act = S.joined && !S.editing ? '<div class="gw-in">✅ Çekilişe katıldın. Çekiliş günü sayfada ol: kazanırsan 2 dakika içinde onaylaman gerekiyor.' + (g.wa && (S.myBonus || 0) < waN(g) ? '<br><small>⭐ Bonus: WhatsApp topluluğu görseli ekle; ' + (waN(g) > 1 ? 'bir topluluk 2×, iki topluluk 3× şans' : 'çarkta adın 2 kez yazılır') + '. <b>Görsellerimi düzenle</b>ye dokun.</small>' : '') + '</div>' +
                '<div class="gw-mrow">' + (g.yt || g.wa ? '<button type="button" class="btn sm" id="gwEdit">📸 Görsellerimi düzenle</button>' : '') + '<button type="button" class="btn sm" id="gwLeave">Katılımı geri al</button></div>'
            : reqHtml(g);
        else if (p === "closed" || p === "drawing") act = S.joined ? '<div class="gw-in">✅ Katıldın. Çekiliş ' + (p === "drawing" ? "şimdi yapılıyor…" : esc(dt(g.drawAt)) + "'de") + ' — sayfada kal!</div>' : '<div class="gw-note">Kayıtlar kapandı.</div>';
        else if (p === "drawn") act = iWon ? '<button type="button" class="btn primary gw-big" id="gwClaimOpen">🎉 Kazandın! Onaylamak için dokun</button>' : '<div class="gw-note">Kazananın onayı bekleniyor (<span data-left="' + g.claimBy + '">' + left(g.claimBy - now) + '</span>).</div>';
        else if (p === "claimed") act = iWon ? (needInfo(g) ? '<button type="button" class="btn primary" id="gwAddr">' + (askL(g).indexOf("address") >= 0 ? "📦 Teslimat bilgilerim" : "📝 Bilgilerim") + '</button>' : '<div class="gw-in">✅ Onayladın. Çekilişi düzenleyen kişi ödülün için seninle iletişime geçecek.</div>') : '';
        $("gwOne").innerHTML = '<button type="button" class="gw-back" id="gwBack">← Tüm çekilişler</button>' +
            '<div class="gw-detail"><div class="gw-hero">' + orgHtml(g, true) +
            '<div class="gw-imgw"><img class="gw-himg" src="' + esc(imgOf(g)) + '" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/img/cekilis/kup.svg\'"><div class="gw-tags">' + badges(g) + '</div></div>' +
            '<div class="gw-hhead"><h2>' + esc(g.title) + '</h2>' + (g.desc ? '<p class="gw-desc">' + esc(g.desc).replace(/\n/g, "<br>") + '</p>' : '') +
            '<div class="gw-dstats"><div><span>Katılımcı</span><b id="gwCnt">' + S.count + '</b></div><div><span>Tür</span><b>' + MODE_LBL[modeOf(g)] + '</b></div><div><span>Çekiliş</span><b>' + esc(dtS(g.drawAt)) + '</b></div></div>' +
            '<div class="gw-pbox"><span>Ödül</span><b class="gw-prize big">🏆 ' + esc(g.prize || "") + '</b></div>' +
            '<div class="gw-stl">' + stLabel(g) + '</div>' + (cdTarget(g) ? cdHtml(g) : '') + '</div>' +
            '<div class="gw-hbody"><div class="gw-act">' + topDrawHtml(g, p) + act + '</div><div class="gw-msg" id="gwMsg"></div><button type="button" class="btn gw-big gw-sharebtn" id="gwShare">↗ Çekilişi paylaş</button></div></div>' +
            '<section class="gw-ppl"><h3>👥 Katılımcılar <span id="gwPplN">' + S.count + '</span></h3><div class="gw-pplc" id="gwPplList"><p class="gw-note">Yükleniyor…</p></div><div class="gw-pg" id="gwPg"></div></section>' +
            '<section class="gw-wins"><h3>🏆 Kazananlar</h3>' + winsHtml(g) + '</section></div>' +
            (S.mgr ? '<div class="gw-mgrbox" id="gwMgrOne"></div>' : '') +
            '<p class="gw-rules">Kurallar: Yalnız site üyeleri katılabilir, herkesin tek hakkı vardır. ' + (g.test ? 'Bu bir deneme çekilişidir; ödül verilmez. ' : modeOf(g) === "mini" ? 'Mini çekilişte kayıtlar çekilişten 10 dakika önce kapanır. ' : 'Kayıtlar çekiliş anına kadar açıktır. ') + 'Kazanan rastgele seçilir ve 2 dakika içinde onaylamazsa yeni bir kişi çekilir. Teslimat bilgileri yalnız çekilişi düzenleyenlerle paylaşılır.</p>';
        $("gwShare").onclick = function () { share(g, this); };
        fillHosts($("gwOne")); updCd();
        $("gwBack").onclick = backToList;
        if ($("gwLogin")) $("gwLogin").onclick = function () { Account.openLogin && Account.openLogin(); };
        if ($("gwJoin")) $("gwJoin").onclick = function () { join(false); };
        bindReq(g);
        if ($("gwLeave")) $("gwLeave").onclick = leave;
        if ($("gwEdit")) $("gwEdit").onclick = editProofs;
        if ($("gwClaimOpen")) $("gwClaimOpen").onclick = function () { winModal(g); };
        if ($("gwAddr")) $("gwAddr").onclick = function () { addrModal(g); };
        if (S.mgr) renderMgrOne(); else bindDraw(g);
        loadPeople();
        // kazandıysan ve süre varsa onay penceresini kendiliğinden aç
        if (iWon && p === "drawn" && !S.winShown) { S.winShown = g.w + g.wAt; winModal(g); }
        if (iWon && p === "claimed" && !S.addrChecked && needInfo(g)) {
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
        return { acc: !!u, push: pushOk(), ps: ps, yt: ch.every(function (c, i) { return !!pr[i]; }), proofs: pr, ch: ch, bonus: pr[2] || "", bonus2: pr[3] || "" };
    }
    function reqHtml(g) {
        var r = reqState(g), u = me();
        // sıkı satır: numara · başlık + kısa not + küçük düğmeler · sağda küçük önizleme
        var row = function (ok, n, title, body, thumb, cls) { return '<li class="gw-rq' + (ok ? " ok" : "") + (cls ? " " + cls : "") + '"><b>' + (ok ? "✓" : n) + '</b><div><strong>' + title + '</strong>' + (body || "") + '</div>' + (thumb ? '<img class="gw-proofp" src="' + thumb + '" alt="Yüklenen görsel" title="Yüklenen görsel">' : '') + '</li>'; };
        var up = function (i, p, lbl) { return '<label class="btn sm' + (p ? '' : ' primary') + '">📸 ' + (p ? "Değiştir" : lbl) + '<input type="file" accept="image/*" class="gwProof" data-i="' + i + '" hidden' + (r.acc ? '' : ' disabled') + '></label>'; };
        var all = r.acc && r.yt; // bildirim artık şart değil
        var ed = !!S.editing;
        return '<div class="gw-req"><h3>' + (ed ? "📸 Görsellerimi düzenle" : "Katılma şartları") + '</h3>' +
            (u && (r.ch.length || g.wa) ? '<p class="gw-pchint">💡 Ekran görüntülerinde <b>Abone olundu</b> yazısı görünmeli; yalnız düzenleyenler görür.<span class="gw-pch2"> Bilgisayarda görseli kutuya <b>sürükle</b> ya da kutuya tıklayıp <b>Ctrl+V</b> ile yapıştır.</span></p>' : '') + '<ol>' +
            row(r.acc, 1, "Rubik Academy hesabın açık olsun", r.acc ? '<span>' + esc(myName()) + ' olarak giriş yaptın</span>' : '<div class="gw-reqb"><button type="button" class="btn sm primary" id="gwLogin">Giriş yap / Üye ol</button></div>') +
            r.ch.map(function (c, i) {
                var p = r.proofs[i] || "";
                return row(!!p, 2 + i, esc(c.name) + " kanalına abone ol", '<div class="gw-reqb">' + (c.url ? '<a class="btn sm gw-yt" href="' + esc(c.url) + '" target="_blank" rel="noopener">▶ Kanala git</a>' : '') + up(i, p, "Görüntü yükle") + '</div>', p);
            }).join("") +
            (g.wa ? waList(g).map(function (c, i, wl) {
                var p = i ? r.bonus2 : r.bonus;
                return row(!!p, "⭐", "Bonus: " + esc(c.name) + ' WhatsApp topluluğu <em>isteğe bağlı · ' + (wl.length > 1 ? 'biri 2×, ikisi 3× şans' : 'çarkta 2×') + '</em>',
                    '<div class="gw-reqb">' + (c.url ? '<a class="btn sm gw-wa" href="' + esc(c.url) + '" target="_blank" rel="noopener">💬 Topluluğa git</a>' : '') + up(2 + i, p, "Görüntü yükle") +
                    (p ? '<button type="button" class="btn sm" data-bx="' + (2 + i) + '">Kaldır</button>' : '') + '</div>', p, "gw-bonus");
            }).join("") : '') +
            '</ol>' + (ed ? '<div class="gw-edact"><button type="button" class="btn primary gw-big" id="gwEdSave"' + (all ? '' : ' disabled') + '>💾 Değişiklikleri kaydet</button><button type="button" class="btn" id="gwEdX">Vazgeç</button></div>'
                : u ? '<button type="button" class="btn primary gw-big" id="gwJoin"' + (all ? '' : ' disabled') + '>🎟 Çekilişe katıl</button>' : '') +
            (u && !all ? '<p class="gw-note" style="text-align:center">' + (ed ? "Abonelik görselleri olmadan kaydedilemez." : "Şartların hepsi tamamlanınca katılabilirsin.") + '</p>' : '') + '</div>';
    }
    function bindReq(g) {
        Array.prototype.forEach.call(document.querySelectorAll("[data-bx]"), function (b) { b.onclick = function () { if (S.proof) S.proof.imgs[+b.getAttribute("data-bx")] = ""; renderOne(); }; });
        if ($("gwEdX")) $("gwEdX").onclick = function () { S.editing = false; S.proof = null; renderOne(); };
        if ($("gwEdSave")) $("gwEdSave").onclick = function () { saveProofs(g, this); };
        if ($("gwPush")) $("gwPush").onclick = function () {
            var b = this; b.disabled = true;
            Account.enablePush().then(function (p) { renderOne(); if (p !== "granted") pushHelp(p); else msg("Bildirimler açıldı ✓"); }, function () { b.disabled = false; pushHelp("denied"); });
        };
        Array.prototype.forEach.call(document.querySelectorAll(".gwProof"), function (inp) {
            var idx = +inp.getAttribute("data-i"), li = inp.closest("li");
            inp.onchange = function () { useFile(this.files && this.files[0], idx, g); };
            if (!li) return;
            // bilgisayarda: kutuya sürükle-bırak; kutuya tıklayınca yapıştırma (Ctrl+V) hedefi olur
            li.setAttribute("data-slot", idx);
            li.ondragover = function (e) { e.preventDefault(); li.classList.add("drop"); };
            li.ondragleave = function () { li.classList.remove("drop"); };
            li.ondrop = function (e) { e.preventDefault(); li.classList.remove("drop"); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; useFile(f, idx, g); };
            li.onclick = function (e) { if (e.target.closest("a,button,label")) return; S.pasteSlot = idx; Array.prototype.forEach.call(document.querySelectorAll(".gw-req li[data-slot]"), function (x) { x.classList.toggle("tgt", x === li); }); };
            if (S.pasteSlot === idx) li.classList.add("tgt");
        });
    }
    function useFile(f, idx, g) {
        if (!f) return;
        if (!/^image\//.test(f.type)) { msg("Lütfen bir görsel seç.", 1); return; }
        msg("Görsel hazırlanıyor…");
        shrink(f).then(function (img) {
            if (!S.proof || S.proof.id !== g.id) S.proof = { id: g.id, imgs: [] };
            S.proof.imgs[idx] = img;
            // sıradaki boş kutu yapıştırma hedefi olsun
            var nx = [0, 1, 2, 3].filter(function (k) { return document.querySelector('.gw-req li[data-slot="' + k + '"]') && !S.proof.imgs[k]; })[0];
            S.pasteSlot = nx == null ? idx : nx;
            renderOne(); msg(S.editing ? "Görsel hazır ✓ — kaydetmeyi unutma" : "Görsel hazır ✓");
        }, function () { msg("Görsel okunamadı, başka bir görsel dene.", 1); });
    }
    // Ctrl+V: panodaki ekran görüntüsünü seçili (ya da ilk boş) kutuya koy
    document.addEventListener("paste", function (e) {
        var g = S.g; if (!g || !document.querySelector(".gw-req li[data-slot]") || /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) return;
        var it = Array.prototype.filter.call((e.clipboardData && e.clipboardData.items) || [], function (x) { return /^image\//.test(x.type); })[0]; if (!it) return;
        e.preventDefault();
        var imgs = (S.proof && S.proof.id === g.id ? S.proof.imgs : []) || [];
        var idx = S.pasteSlot != null && document.querySelector('.gw-req li[data-slot="' + S.pasteSlot + '"]') ? S.pasteSlot : [0, 1, 2, 3].filter(function (k) { return document.querySelector('.gw-req li[data-slot="' + k + '"]') && !imgs[k]; })[0];
        if (idx == null) idx = 0;
        useFile(it.getAsFile(), idx, g);
    });
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
                    if (d.length <= 230000) return res(d); // 4 görsel tek belgeye sığsın (1 MB sınırı)
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
        // bildirim şart değil: izin sorulmamışsa katılırken bir kez sor, beklemeden devam et
        if (!skipPush && window.Account && Account.pushState && Account.pushState() === "default") try { Account.enablePush(); } catch (e) {}
        $("gwJoin").disabled = true;
        var r0 = reqState(g);
        if (!r0.yt) { msg("Önce abonelik ekran görüntülerini yükle.", 1); return; }
        if (tooBig(r0)) { $("gwJoin").disabled = false; msg("Görseller çok büyük; birini yeniden yükle.", 1); return; }
        var w = { writes: [{ update: { name: docName("/giveaways/" + g.id + "/e/" + u.uid), fields: (function () { var f = { name: { stringValue: myName() }, d: { stringValue: devId() } }; if (g.wa && r0.bonus) f.b = { booleanValue: true }; if (waN(g) > 1 && r0.bonus2) f.b2 = { booleanValue: true }; return f; })() }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }] };
        if (g.yt || (g.wa && (r0.bonus || r0.bonus2))) w.writes.unshift({ update: { name: docName("/giveaways/" + g.id + "/proof/" + u.uid), fields: proofFields(g, r0) }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }] });
        req(":commit", { method: "POST", body: JSON.stringify(w) }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            S.joined = true; S.count++; cacheSet("n:" + g.id, S.count); remember(g); renderOne(); msg("Katıldın, bol şans! 🍀");
        }).catch(function (e) { if ($("gwJoin")) $("gwJoin").disabled = false; msg(String(e.message) === "403" ? "Katılınamadı: kayıtlar kapanmış olabilir." : "Katılınamadı, tekrar dene.", 1); });
    }
    function tooBig(r0) { return r0.proofs.slice(0, 4).reduce(function (a, x) { return a + String(x || "").length; }, 0) > 1000000; }
    function proofFields(g, r0) { var o = {}; r0.ch.forEach(function (c, i) { o[PF[i]] = { stringValue: r0.proofs[i] }; }); if (g.wa && r0.bonus) o.img3 = { stringValue: r0.bonus }; if (waN(g) > 1 && r0.bonus2) o.img4 = { stringValue: r0.bonus2 }; return o; }
    // katıldıktan sonra görselleri değiştir: önce kendi görsellerini getir
    function editProofs() {
        var u = me(), g = S.g; if (!u || !g) return;
        msg("Görsellerin yükleniyor…");
        req("/giveaways/" + g.id + "/proof/" + u.uid).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var o = d ? dec(d) : {}; S.proof = { id: g.id, imgs: PF.map(function (k) { return o[k] || ""; }) }; S.editing = true; renderOne(); msg("");
            var e = document.querySelector(".gw-req"); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" });
        }).catch(function () { msg("Görseller getirilemedi.", 1); });
    }
    function saveProofs(g, b) {
        var u = me(); if (!u) return; var r0 = reqState(g); if (!r0.yt) return;
        b.disabled = true;
        if (tooBig(r0)) { b.disabled = false; msg("Görseller çok büyük; birini yeniden yükle.", 1); return; }
        var w = { writes: [{ update: { name: docName("/giveaways/" + g.id + "/proof/" + u.uid), fields: proofFields(g, r0) }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }] }] };
        if (g.wa) w.writes.push({ update: { name: docName("/giveaways/" + g.id + "/e/" + u.uid), fields: { b: { booleanValue: !!r0.bonus }, b2: { booleanValue: waN(g) > 1 && !!r0.bonus2 } } }, updateMask: { fieldPaths: ["b", "b2"] }, currentDocument: { exists: true } });
        req(":commit", { method: "POST", body: JSON.stringify(w) }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            S.editing = false; S.proof = null; renderOne(); msg("Görsellerin güncellendi ✓");
        }).catch(function (e) { b.disabled = false; msg(String(e.message) === "403" ? "Kaydedilemedi: kayıtlar kapanmış olabilir." : "Kaydedilemedi, tekrar dene.", 1); });
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
        var m = $("gwModal"); m.classList.remove("gw-full"); m.innerHTML = '<div class="gw-mbox">' + html + '</div>'; m.classList.add("open");
        return m;
    }
    function closeModal() { clearInterval(winT); $("gwModal").classList.remove("open"); embedClose(); }
    // site içi onay penceresi (tarayıcının confirm'ü yerine)
    function askBox(title, body, okTxt, danger) {
        return new Promise(function (res) {
            modal('<h3>' + title + '</h3>' + body + '<div class="gw-askb"><button type="button" class="btn gw-big ' + (danger ? 'gw-dangerbtn' : 'primary') + '" id="gwAskOk">' + okTxt + '</button><button type="button" class="btn" id="gwAskNo">Vazgeç</button></div>');
            var end = function (v) { closeModal(); res(v); };
            $("gwAskOk").onclick = function () { end(true); }; $("gwAskNo").onclick = function () { end(false); };
        });
    }
    // çekiliş zamanı gelince (ya da kazanan onaylamayınca) çekme düğmesi yöneticiye sayfanın en üstünde görünür
    function topDrawHtml(g, p) {
        if (!S.mgr) return "";
        if (p === "drawing") return '<button type="button" class="btn primary gw-big gw-drawtop" id="gwDraw">' + MODE_LBL[modeOf(g)].split(" ")[0] + ' Şimdi çek</button>';
        if (p === "expired") return '<button type="button" class="btn primary gw-big gw-drawtop" id="gwRedraw">🔁 Sıradaki kişiyi çek</button>';
        return "";
    }
    function bindDraw(g) {
        if ($("gwDraw")) $("gwDraw").onclick = function () { askBox("🎡 Kazanan şimdi çekilsin mi?", '<p>Herkes çarkı aynı anda görür.</p>', "Şimdi çek").then(function (ok) { if (ok) draw(false); }); };
        if ($("gwRedraw")) $("gwRedraw").onclick = function () {
            var ex = phase(S.g || g) === "expired";
            askBox(ex ? "🔁 Sıradaki kişi çekilsin mi?" : "🔁 Yeniden çekilsin mi?", '<p>' + (ex ? "Kazanan süresinde onaylamadı." : "Mevcut kazanan iptal edilip yeni kişi çekilir.") + '</p>', ex ? "Sıradakini çek" : "Yeniden çek", !ex).then(function (ok) { if (ok) draw(true); });
        };
    }
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
                clearInterval(winT); S.g.st = "claimed";
                if (needInfo(g)) addrModal(g);
                else { modal('<div class="gw-confetti">🏆</div><h3>Onaylandı!</h3><p>Bu çekilişte senden ek bilgi istenmiyor. Çekilişi düzenleyen kişi ödülün için seninle iletişime geçecek.</p><button type="button" class="btn primary" id="gwDone">Tamam</button>'); $("gwDone").onclick = closeModal; }
                renderOne();
            }).catch(function () { b.disabled = false; $("gwWinMsg").textContent = "Onaylanamadı (süre dolmuş olabilir). Tekrar dene."; });
        };
        m.onclick = function (e) { if (e.target === m) { /* dışına dokununca kapanmasın: süre önemli */ } };
    }
    function addrModal(g) {
        var u = me(); if (!u) return;
        var a = askL(g), has = function (k) { return a.indexOf(k) >= 0; }, adr = has("address");
        var f = function (id, lb, ph, type, req2, max) { return '<label class="gw-f"><span>' + lb + (req2 ? ' *' : '') + '</span><input id="' + id + '" ' + (type ? 'type="' + type + '" ' : '') + 'maxlength="' + max + '" placeholder="' + ph + '"' + (req2 ? ' required' : '') + '></label>'; };
        modal('<h3>' + (adr ? '📦 Teslimat bilgileri' : '📝 Bilgilerin') + '</h3><p>' + (adr ? 'Ödülünü gönderebilmemiz için bilgilerini yaz.' : 'Ödülün için çekilişi düzenleyen kişinin istediği bilgileri yaz.') + ' Bu bilgileri yalnız çekilişi düzenleyenler görür.</p>' +
            '<form id="gwForm" class="gw-form">' + (has("name") ? f("gfName", "Ad soyad", "Ad Soyad", "", 1, 80) : '') + (has("phone") ? f("gfPhone", "Telefon", "05xx xxx xx xx", "tel", 1, 25) : '') + (has("email") ? f("gfMail", "E-posta", "ornek@mail.com", "email", 1, 120) : '') +
            (adr ? '<div class="gw-row">' + f("gfCity", "İl", "İstanbul", "", 1, 40) + f("gfDist", "İlçe", "Kadıköy", "", 1, 60) + '</div>' +
                '<label class="gw-f"><span>Açık adres *</span><textarea id="gfAddr" maxlength="400" rows="3" placeholder="Mahalle, sokak, bina no, daire" required></textarea></label>' + f("gfZip", "Posta kodu", "34000", "", 0, 10) : '') +
            (g.askQ ? f("gfExtra", esc(g.askQ), "", "", 1, 200) : '') + f("gfNote", "Not", "İsteğe bağlı", "", 0, 300) +
            '<button type="submit" class="btn primary gw-big">Gönder</button><div class="gw-msg" id="gwFMsg"></div></form>');
        if (u.email && $("gfMail")) $("gfMail").value = u.email;
        $("gwForm").onsubmit = function (e) {
            e.preventDefault();
            var v = function (id) { return $(id) ? $(id).value.trim() : ""; };
            if ((has("name") && v("gfName").length < 2) || (has("phone") && v("gfPhone").replace(/\D/g, "").length < 7) || (has("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("gfMail"))) ||
                (adr && (v("gfAddr").length < 6 || !v("gfCity") || !v("gfDist"))) || (g.askQ && !v("gfExtra"))) { $("gwFMsg").textContent = "Lütfen yıldızlı alanları doğru doldur."; return; }
            var o = { ts: Date.now() };
            if (has("name")) o.name = v("gfName"); if (has("phone")) o.phone = v("gfPhone"); if (has("email")) o.email = v("gfMail");
            if (adr) { o.city = v("gfCity"); o.district = v("gfDist"); o.address = v("gfAddr"); o.zip = v("gfZip"); }
            if (g.askQ) o.extra = v("gfExtra"); if (v("gfNote")) o.note = v("gfNote");
            var b = this.querySelector("button"); b.disabled = true;
            // claim belgesi her seferinde baştan yazılır (updateMask yok): eski alanlar kalmaz
            req("/giveaways/" + g.id + "/claim/" + u.uid, { method: "PATCH", body: JSON.stringify({ fields: enc(o) }) }).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                // çekilişi kurana bildirim (belge adı = çekiliş kodu: tek bildirim)
                patch("/users/" + g.host + "/notifications/" + g.id, { text: "📦 “" + g.title + "” çekilişinin kazananı " + (o.name || g.wName || "") + " bilgilerini gönderdi. Çekiliş sayfasından görebilirsin.", ts: Date.now(), pushed: false }).catch(function () {});
                modal('<div class="gw-confetti">' + (adr ? '📦' : '📝') + '</div><h3>Bilgilerin iletildi</h3><p>Teşekkürler! Çekilişi düzenleyen kişi ödülün için seninle iletişime geçecek.</p><button type="button" class="btn primary" id="gwDone">Tamam</button>');
                $("gwDone").onclick = closeModal;
            }).catch(function () { b.disabled = false; $("gwFMsg").textContent = "Gönderilemedi, tekrar dene."; });
        };
    }

    /* ---------- çekiliş animasyonu (herkes görür) ---------- */
    function confetti(el) {
        var C = ["#f6c719", "#e6252f", "#2b50d6", "#179e4f", "#ff7a1a", "#ffffff", "#7c3aed"], h = "";
        for (var k = 0; k < 90; k++) h += '<i style="left:' + rnd(100) + '%;background:' + C[k % C.length] + ';animation-delay:' + (rnd(900) / 1000) + 's;animation-duration:' + (2.2 + rnd(1600) / 1000) + 's;transform:rotate(' + rnd(360) + 'deg)"></i>';
        var d = document.createElement("div"); d.className = "gw-conf"; d.innerHTML = h; el.appendChild(d);
    }
    // canlı yayına uygun tam ekran sahne: ekran kararır, çark ortada büyük döner, kazanan büyük yazılır
    // görülen sonuçlar: { çekilişId: kazananUid } — aynı sonuç bir daha gösterilmez (diğer sayfalardaki açılır pencere de bunu okur)
    function seenGet() { try { return JSON.parse(localStorage.getItem("ra-gw-seen") || "{}") || {}; } catch (e) { return {}; } }
    function seenSet(g) { try { var o = seenGet(); o[g.id] = g.w; localStorage.setItem("ra-gw-seen", JSON.stringify(o)); } catch (e) {} }
    function agoTxt(ms) { var m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24); return m < 1 ? "az önce" : d ? d + " gün önce" : h ? h + " saat önce" : m + " dakika önce"; }
    function embedClose() { if (EMBED) try { parent.postMessage({ raGw: "close" }, location.origin); } catch (e) {} }
    // çekiliş anında sayfada olmayan katılımcıya sonradan: aynı çark, "… önce çevrildi" yazısıyla
    function missed(g) {
        if (!g || !g.w || !g.wAt || g.man || !(g.st === "drawn" || g.st === "claimed")) return false;
        if (seenGet()[g.id] === g.w) return false;
        return IZLE || Date.now() - g.wAt < 3 * 86400000;
    }
    function reveal(g, late) {
        var key = "ra-gw-rev:" + g.id + ":" + g.w; try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) {}
        if (!late && Date.now() - g.wAt > 10 * 60000) return;
        seenSet(g);
        if (EMBED) try { parent.postMessage({ raGw: "shown" }, location.origin); } catch (e) {}
        var names = []; try { names = JSON.parse(g.wn || "[]"); } catch (e) {}
        if (!names.length) names = (S.entries || []).map(function (x) { return x.name; });
        if (names.length < 2) names = names.concat(["…"]);
        var iWon = me() && me().uid === g.w;
        var m = modal('<div class="gw-fs"><button type="button" class="gw-fsx" id="gwFsX" aria-label="Kapat">✕</button>' +
            '<div class="gw-fst"><small>' + ({ mini: "⚡ Mini çekiliş", rastgele: "🎲 Rastgele seçim", cark: "🎡 Çekiliş" })[modeOf(g)] + '</small><h2>' + esc(g.title) + '</h2><p>🏆 ' + esc(g.prize || "") + '</p>' +
            (late ? '<p class="gw-ago">🕒 Bu çark ' + esc(agoTxt(Date.now() - g.wAt)) + ' çevrildi · tekrar gösteriliyor</p>' : '') + '</div>' +
            '<div id="gwAnim"></div><div class="gw-fsw" id="gwRollMsg"></div></div>');
        m.classList.add("gw-full");
        $("gwFsX").onclick = closeModal;
        Draw.run($("gwAnim"), modeOf(g), names, g.wName, function () {
            var e = $("gwRollMsg"); if (!e) return;
            var cur = S.g && S.g.id === g.id ? S.g : g, pc = phase(cur), canClaim = iWon && pc === "drawn";
            var sub = late ? (pc === "claimed" ? "Kazanan ödülünü onayladı ✓" : pc === "drawn" ? (iWon ? "Onaylamak için birazdan pencere açılacak" : "Onaylaması bekleniyor") : "Kazanan süresinde onaylamadı; yetkili yeni kişiyi çekecek")
                : (iWon ? "Onaylamak için birazdan pencere açılacak" : "2 dakika içinde onaylaması bekleniyor");
            e.innerHTML = '<small>' + (iWon ? "🎉 Kazanan sensin!" : "🎉 Kazanan") + '</small><b>' + esc(g.wName) + '</b><span>' + sub + '</span>' +
                (EMBED ? '<a class="btn gw-fsgo" href="/icerikler/cekilis?id=' + encodeURIComponent(g.id) + '" target="_top">Çekiliş sayfasını aç</a>' : '');
            e.classList.add("on"); confetti(m.querySelector(".gw-fs"));
            // sonradan izleyen kendi kapatır; canlıda kazanan olmayan için kendiliğinden kapanır
            if (canClaim) setTimeout(function () { winModal(S.g || g); }, 2600);
            else if (!late && !iWon) setTimeout(function () { if ($("gwModal").classList.contains("gw-full")) closeModal(); }, 12000);
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
        var top, p = phase(g), now = Date.now(), canDraw = p === "closed" || p === "drawing" || (g.test && p === "open"), reDraw = p === "drawn" || p === "expired" || p === "claimed" || p === "empty";
        var sl = function (ms) { var m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60); return d ? d + " gün" : h ? h + " sa" : (m % 60) + " dk"; }, left = sl;
        var when = p === "open" ? [left(g.closeAt - now), g.closeAt < g.drawAt ? "kayıt kapanışına" : "çekilişe"] : p === "closed" ? [left(g.drawAt - now), "çekilişe"] : p === "drawn" ? [left(g.claimBy - now), "onay süresi"] : ["—", p === "claimed" ? "onaylandı" : "bitti"];
        box.innerHTML = '<div class="gwm-head"><div class="gwm-ic">🛡</div><div><h3>Yönetim</h3><small>Bu bölümü yalnız yetkililer görür</small></div></div>' +
            '<div class="gwm-stats"><div><b>' + S.count + '</b><span>katılımcı</span></div><div><b id="gwmOk">…</b><span>onaylı</span></div><div><b' + (p === "drawn" ? ' data-left="' + g.claimBy + '"' : p === "open" ? ' data-left="' + g.closeAt + '"' : p === "closed" ? ' data-left="' + g.drawAt + '"' : '') + '>' + esc(when[0]) + '</b><span>' + when[1] + '</span></div></div>' +
            (top = p === "drawing" || p === "expired", canDraw && !top || reDraw && !top ? '<div class="gwm-main">' + (canDraw && !top ? '<button type="button" class="btn primary gw-big" id="gwDraw">' + MODE_LBL[modeOf(g)].split(" ")[0] + ' Şimdi çek</button>' : '') +
                (reDraw && !top ? '<button type="button" class="btn gw-big' + (p === "expired" ? ' primary' : '') + '" id="gwRedraw">' + (p === "expired" ? '🔁 Sıradaki kişiyi çek' : '🔁 Yeniden çek') + '</button>' : '') + '</div>' : '') +
            '<div class="gwm-acts"><button type="button" class="gwm-a' + (g.pin ? ' on' : '') + '" id="gwPin"><i>📌</i><span>' + (g.pin ? 'Sabitlendi<small>Kaldırmak için dokun</small>' : 'En üste sabitle<small>Listede ilk sırada görünür</small>') + '</span></button>' +
            '<button type="button" class="gwm-a" id="gwEditGw"><i>✏️</i><span>Düzenle<small>Başlık, ödül, tarih, şartlar</small></span></button>' +
            '<button type="button" class="gwm-a" id="gwLink"><i>🔗</i><span>Bağlantıyı kopyala<small>Paylaşmak için</small></span></button>' +
            '<button type="button" class="gwm-a del" id="gwDel"><i>🗑</i><span>Çekilişi sil<small>Geri alınamaz</small></span></button></div>' +
            '<details class="gwm-help"><summary>Nasıl çalışır?</summary><p>Kayıtlar kapanınca <b>Şimdi çek</b>e dokun; herkes çarkı aynı anda görür. Kazanan 2 dakika içinde onaylamazsa sıradaki kişi kendiliğinden çekilmez: <b>Sıradaki kişiyi çek</b>e sen dokunursun. Sabitlenen çekiliş listede en üstte durur, katılımcılar bunu görmez. Görselleri incele: <b>yalnız onayladığın kişiler çekilir</b>; reddedilen ve bekleyenler çekilmez. WhatsApp bonusu: onaylanan her topluluk çarkta +1 sayılır (bir topluluk 2×, iki topluluk 3×).</p></details>' +
            (skipNames(g).length ? '<p class="gw-note">Onaylamayan / iptal edilenler: <b>' + skipNames(g).map(esc).join(" → ") + '</b></p>' : '') +
            (isOwner() && (p === "open" || p === "closed" || p === "drawing") ? '<form class="gw-madd" id="gwMAdd" autocomplete="off"><h4>✋ Elle katılımcı ekle</h4><p class="gw-note">Hesabı olan birini adıyla ya da profil bağlantısıyla bul, ya da hesabı olmayan birini adıyla ekle. Onaylı sayılır, görsel istenmez. Yalnız sen görürsün.</p>' +
                '<div class="gw-maddr"><input id="gwMName" maxlength="200" placeholder="Ad veya profil bağlantısı" required><label class="gw-mx2"><input type="checkbox" id="gwMX2"> ×2 şans</label><button type="submit" class="btn sm primary" id="gwMBtn">Ara</button></div><div class="gw-mres" id="gwMRes"></div><p class="gw-msg" id="gwMMsg"></p></form>' : '') +
            winEdHtml(g, p) +
            '<div id="gwClaim"></div><div class="gw-chk" id="gwChk"><h4>🔍 Katılımcı kontrolü</h4><p class="gw-note">Yükleniyor…</p></div>';
        if ($("gwMAdd")) $("gwMAdd").onsubmit = function (e) { e.preventDefault(); findPerson(g); };
        bindWinEd(g);
        $("gwPin").onclick = function () {
            var b = this; b.disabled = true;
            patch("/giveaways/" + g.id, { pin: g.pin ? 0 : Date.now() }).then(function (r) { if (!r.ok) throw 0; return fetchOne(g.id).then(renderOne); }).catch(function () { b.disabled = false; alert("Sabitlenemedi."); });
        };
        $("gwEditGw").onclick = editGw;
        $("gwLink").onclick = function () {
            var u = "https://rubikacademy.fun/icerikler/cekilis?id=" + encodeURIComponent(g.id), b = this;
            var ok = function () { var sp = b.lastElementChild; sp.innerHTML = 'Kopyalandı<small>' + esc(u.replace("https://", "")) + '</small>'; b.classList.add("on"); setTimeout(function () { b.classList.remove("on"); sp.innerHTML = 'Bağlantıyı kopyala<small>Paylaşmak için</small>'; }, 2500); };
            try { navigator.clipboard.writeText(u).then(ok, function () { prompt("Bağlantı:", u); }); } catch (e) { prompt("Bağlantı:", u); }
        };
        bindDraw(g);
        checkPeople();
        $("gwDel").onclick = function () {
            if (!confirm("Çekiliş silinsin mi? Bu geri alınamaz.")) return;
            req("/giveaways/" + g.id, { method: "DELETE" }).then(function (r) { if (r.ok) backToList(); else alert("Silinemedi."); });
        };
        if (p === "claimed") loadClaim(g);
    }
    // site sahibi: hesabı olanı ada / profil bağlantısına göre bul (az okuma: önek araması, en çok 6 sonuç)
    function findPerson(g) {
        var q = $("gwMName").value.trim().replace(/\s+/g, " "), box = $("gwMRes"), m = $("gwMMsg"), b = $("gwMBtn");
        if (!q) return;
        m.textContent = ""; m.className = "gw-msg"; box.innerHTML = '<p class="gw-note">Aranıyor…</p>'; b.disabled = true;
        var idm = q.match(/[?&]u=([A-Za-z0-9]{20,40})/) || (/^[A-Za-z0-9]{20,40}$/.test(q) ? [0, q] : null);
        var find = idm ? req("/users/" + idm[1]).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return d ? [dec(d)] : []; })
            : Promise.all([q, q.charAt(0).toLocaleUpperCase("tr") + q.slice(1)].filter(function (x, i, a) { return a.indexOf(x) === i; }).map(function (v) {
                var body = { structuredQuery: { from: [{ collectionId: "users" }], where: { compositeFilter: { op: "AND", filters: [
                    { fieldFilter: { field: { fieldPath: "name" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: v } } },
                    { fieldFilter: { field: { fieldPath: "name" }, op: "LESS_THAN", value: { stringValue: v + "\uf8ff" } } }] } }, limit: 6 } };
                return req(":runQuery", { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : []; }).then(function (a) { return (a || []).filter(function (x) { return x.document; }).map(function (x) { return dec(x.document); }); }, function () { return []; });
            })).then(function (ls) { var seen = {}, out = []; ls.forEach(function (l) { l.forEach(function (u) { if (!seen[u.id]) { seen[u.id] = 1; out.push(u); } }); }); return out.slice(0, 8); });
        find.then(function (us) {
            b.disabled = false;
            var have = {}; (S.entries || []).forEach(function (y) { have[y.uid] = 1; });
            box.innerHTML = us.map(function (u) {
                var nm = String(u.name || "Cuber").slice(0, 24);
                return '<button type="button" class="gw-mpick" data-uid="' + esc(u.id) + '" data-nm="' + esc(nm) + '"' + (have[u.id] ? ' disabled' : '') + '><b>' + esc(nm) + '</b><small>' + (have[u.id] ? "zaten katılıyor" : "hesabı var · ekle") + '</small></button>';
            }).join("") + (idm ? "" : '<button type="button" class="gw-mpick nm" data-uid="" data-nm="' + esc(q.slice(0, 24)) + '"><b>' + esc(q.slice(0, 24)) + '</b><small>hesapsız olarak ekle</small></button>') +
                (!us.length ? '<p class="gw-note">' + (idm ? "Bu bağlantıyla hesap bulunamadı." : "Bu adla başlayan hesap bulunamadı (büyük/küçük harf önemli).") + '</p>' : "");
            Array.prototype.forEach.call(box.querySelectorAll(".gw-mpick"), function (x) { x.onclick = function () { addManual(g, x.getAttribute("data-uid"), x.getAttribute("data-nm")); }; });
        }, function () { b.disabled = false; box.innerHTML = ""; m.textContent = "Aranamadı, tekrar dene."; m.className = "gw-msg bad"; });
    }
    function addManual(g, uid, nm) {
        nm = String(nm || "").trim().slice(0, 24); var x2 = $("gwMX2").checked, b = $("gwMBtn"), m = $("gwMMsg");
        if (!nm) return;
        if (!uid && (S.entries || []).some(function (y) { return String(y.name).toLocaleLowerCase("tr") === nm.toLocaleLowerCase("tr"); }) && !confirm("“" + nm + "” adında biri zaten var. Yine de eklensin mi?")) return;
        var id = uid || "m_" + newId(); b.disabled = true; m.textContent = ""; m.className = "gw-msg";
        var w = { writes: [
            { update: { name: docName("/giveaways/" + g.id + "/e/" + id), fields: { name: { stringValue: nm }, m: { booleanValue: true }, x2: { booleanValue: x2 } } }, updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } },
            { update: { name: docName("/giveaways/" + g.id + "/rev/" + id), fields: enc({ v: "ok", ts: Date.now() }) } }] };
        req(":commit", { method: "POST", body: JSON.stringify(w) }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            if ($("gwMRes")) $("gwMRes").innerHTML = "";
            S.count = (S.count || 0) + 1; S.rev = S.rev || {}; S.rev[id] = { v: "ok", b: "", ts: Date.now() };
            (S.entries = S.entries || []).push({ uid: id, name: nm, d: "", ts: Date.now(), b: false, m: true, x2: x2 });
            $("gwMName").value = ""; $("gwMX2").checked = false; b.disabled = false;
            m.textContent = "✓ " + nm + " eklendi" + (x2 ? " (×2)" : ""); m.className = "gw-msg";
            if ($("gwPplN")) $("gwPplN").textContent = S.count;
            paintCheck(); loadPeople();
        }).catch(function (e) { b.disabled = false; m.textContent = String(e && e.message) === "403" ? "Eklenemedi: yetki yok." : String(e && e.message) === "400" || String(e && e.message) === "409" ? "Bu kişi zaten katılıyor." : "Eklenemedi, tekrar dene."; m.className = "gw-msg bad"; });
    }
    function loadClaim(g) {
        if (isM(g.w)) { var c0 = $("gwClaim"); if (c0) c0.innerHTML = '<div class="gw-wait"><p>✋ <b>' + esc(g.wName) + '</b> elle eklenen bir katılımcı (hesabı yok). Ödülün teslimatını kendin ayarla.</p></div>'; return; }
        if (!needInfo(g)) { var c1 = $("gwClaim"); if (c1) c1.innerHTML = '<div class="gw-wait"><p>🏆 <b>' + esc(g.wName) + '</b> onayladı. Bu çekilişte kazanandan bilgi istenmedi; ödül için kazananla sen iletişime geç. <a href="/icerikler/profil?u=' + encodeURIComponent(g.w) + '" target="_blank" rel="noopener">Profilini aç ↗</a></p></div>'; S.claimSeen = g.id + g.w; return; }
        req("/giveaways/" + g.id + "/claim/" + g.w).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var c = $("gwClaim"); if (!c) return;
            if (!d) {
                c.innerHTML = '<div class="gw-wait"><p><b>' + esc(g.wName) + '</b> onayladı ama bilgilerini henüz göndermedi' + (g.cAt ? ' (<span data-ago="' + g.cAt + '">' + left(Date.now() - g.cAt).replace("şimdi", "az önce") + '</span> önce onayladı)' : '') + '.</p>' +
                    '<button type="button" class="btn sm gw-del" id="gwNoInfo">🔁 Bilgi girmedi — yeni kişi çek</button></div>';
                $("gwNoInfo").onclick = function () { if (confirm(g.wName + " iptal edilip yeni bir kişi rastgele çekilsin mi?")) draw(true); };
                return;
            }
            S.claimSeen = g.id + g.w;
            var o = dec(d), rows = [["Ad soyad", o.name], ["Telefon", o.phone], ["E-posta", o.email], ["İl / ilçe", o.city != null ? o.city + " / " + (o.district || "") : null], ["Adres", o.address], ["Posta kodu", o.zip], [g.askQ || "Özel soru", o.extra], ["Not", o.note], ["Gönderim", dt(o.ts)]]
                .filter(function (x) { return x[1] != null && x[1] !== ""; });
            c.innerHTML = '<h4>' + (o.address ? '📦 Teslimat bilgileri' : '📝 Kazananın bilgileri') + '</h4><div class="gw-claim">' + rows.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + esc(x[1] || "—") + '</b></div>'; }).join("") + '</div><button type="button" class="btn sm" id="gwCopy">📋 Kopyala</button>';
            $("gwCopy").onclick = function () { var t = rows.map(function (x) { return x[0] + ": " + (x[1] || "-"); }).join("\n"); try { navigator.clipboard.writeText(t); this.textContent = "Kopyalandı ✓"; } catch (e) { prompt("Bilgiler:", t); } };
        });
    }

    // çarkta görünecek adlar (en çok 40): kazananın tüm kopyaları + rastgele diğerleri
    function wheelNames(pool, w) {
        var win = pool.filter(function (x) { return x.uid === w.uid; }).map(function (x) { return x.name; });
        var oth = pool.filter(function (x) { return x.uid !== w.uid; }).map(function (x) { return x.name; });
        for (var i = oth.length - 1; i > 0; i--) { var j = rnd(i + 1), t = oth[i]; oth[i] = oth[j]; oth[j] = t; }
        return JSON.stringify(win.concat(oth.slice(0, 40 - win.length)).map(function (n) { return String(n).slice(0, 24); }));
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
                return (isM(w.uid) ? Promise.resolve("") : roleOf(w.uid)).then(function (r) { if (r === "askida" || r === "silindi") { pool = pool.filter(function (y) { return y.uid !== w.uid; }); return pick(); } return w; });
            }
            // yönetici incelemesi: "uygun değil" işaretlenenler hiç çekilmez; istenirse yalnız onaylananlar arasından
            return listRev(g.id).then(function (rv) {
                S.rev = rv;
                // görsel istenen çekilişte yalnız onaylananlar çekilir; reddedilen ve bekleyen asla
                pool = pool.filter(function (x) { var v = (rv[x.uid] || {}).v; return g.yt ? v === "ok" : v !== "no"; });
                // WhatsApp topluluğu bonusu: onaylı her topluluk +1 (biri 2×, ikisi 3×); site sahibinin ×2'si de +1 (en çok 3×)
                pool = pool.reduce(function (a, x) { for (var k = weightOf(x, rv); k > 0; k--) a.push(x); return a; }, []);
                if (!pool.length && !redo) { alert(g.yt ? "Onaylanmış katılımcı yok. Önce görselleri incele ve onayla." : "Çekilebilecek katılımcı yok."); return "stop"; }
                return pick();
            }).then(function (w) {
                if (w === "stop") return;
                var now = Date.now(), o;
                if (!w) o = { st: "empty", x: skip.join(",").slice(0, 20000), n: l.length };
                else o = { st: isM(w.uid) || w.oc ? "claimed" : "drawn", w: w.uid, wName: w.name, wAt: now, claimBy: now + CLAIM_MS + 5000, x: skip.join(",").slice(0, 20000), n: l.length, wn: wheelNames(pool, w) };
                // elle eklenen kazananın hesabı yok: onay beklenmez, teslimatı yönetici kendisi ayarlar
                // yönetimin "onaysız" seçtiği kişi de onay beklemeden kazanır (cAt == wAt)
                if (w && (isM(w.uid) || w.oc)) o.cAt = now;
                if (g.man) o.man = false;
                // aynı anda iki yöneticinin çekmesini önle: yazmadan hemen önce belge hâlâ aynı mı bak
                return req("/giveaways/" + g.id).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                    var cur = d ? dec(d) : null;
                    if (!cur || cur.st !== g.st || (cur.w || "") !== (g.w || "")) return { ok: false };
                    // okuma ile yazma arasında başka biri (ikinci yönetici / onaylayan kazanan) değiştirdiyse yazma
                    return patch("/giveaways/" + g.id, o, d.updateTime ? "&currentDocument.updateTime=" + encodeURIComponent(d.updateTime) : "");
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
            var shown = l.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }), per = 12, pages = Math.max(1, Math.ceil(shown.length / per));
            S.pplPage = Math.min(S.pplPage || 0, pages - 1); var pg = S.pplPage;
            b.innerHTML = l.length ? shown.slice(pg * per, pg * per + per).map(function (x) {
                return '<div class="gw-prow2' + (me() && me().uid === x.uid ? ' me' : '') + '"><a' + (isM(x.uid) ? '' : ' href="/icerikler/profil?u=' + encodeURIComponent(x.uid) + '" target="_blank" rel="noopener"') + '><b class="gw-pnm">' + esc(x.name) + '</b>' + (function () { var n = Math.min(2, bonusUp(x) + (x.x2 ? 1 : 0)); return n ? '<i class="gw-star" title="Çarkta ' + (n + 1) + ' kez">' + (bonusUp(x) ? '⭐' : '') + '×' + (n + 1) + '</i>' : ''; })() + '</a><span>🕒 ' + esc(dtS(x.ts)) + '</span></div>';
            }).join("") : '<p class="gw-note">Henüz katılan yok. İlk sen katıl!</p>';
            var pgEl = $("gwPg"); if (!pgEl) return;
            pgEl.innerHTML = pages > 1 ? '<button type="button" data-pg="' + (pg - 1) + '"' + (pg ? '' : ' disabled') + '>‹</button>' + Array.apply(null, Array(pages)).map(function (_, i) { return i < 7 || i === pages - 1 ? '<button type="button" data-pg="' + i + '"' + (i === pg ? ' class="on"' : '') + '>' + (i + 1) + '</button>' : i === 7 ? '<span>…</span>' : ''; }).join("") + '<button type="button" data-pg="' + (pg + 1) + '"' + (pg < pages - 1 ? '' : ' disabled') + '>›</button>' : '';
            Array.prototype.forEach.call(pgEl.querySelectorAll("[data-pg]"), function (x) { x.onclick = function () { S.pplPage = +x.getAttribute("data-pg"); paint(l); }; });
        };
        if (S.entries && S.entriesFor === g.id && S.entriesN === S.count) { paint(S.entries); return; }
        // okuma tasarrufu: liste her katılımcı için 1 okuma demek. Bu tarayıcıda son 10 dakikada okunduysa
        // ve katılımcı sayısı değişmediyse önbellekten çiz; okumayı da yalnız liste ekrana yaklaşınca yap
        var ck = cacheGet("ppl:" + g.id);
        if (ck && ck.n === S.count && Date.now() - ck.t < 600000 && ck.l) { paint(ck.l); return; }
        if (EMBED) return;
        if (!S.pplSeen && window.IntersectionObserver) {
            if (S.pplObs) S.pplObs.disconnect();
            S.pplObs = new IntersectionObserver(function (en) { if (en.some(function (x) { return x.isIntersecting; })) { S.pplObs.disconnect(); S.pplSeen = 1; loadPeople(); } }, { rootMargin: "400px" });
            S.pplObs.observe(box); return;
        }
        listEntries(g.id).then(function (l) {
            S.entries = l; S.entriesFor = g.id; S.entriesN = l.length; paint(l);
            cacheSet("ppl:" + g.id, { t: Date.now(), n: l.length, l: l.map(function (x) { return { uid: x.uid, name: x.name, ts: x.ts, b: x.b, b2: x.b2, x2: x.x2, m: x.m }; }) });
        }).catch(function () {
            // kota doluyken: sitedeki yedekteki son katılımcı listesi
            backup().then(function (bk) {
                var e = bk && bk._e && bk._e[g.id];
                if (e && e.length) { paint(e.map(function (x) { return { uid: x.uid, name: x.name, ts: Date.parse(x.ts) || 0, b: !!x.b }; })); if ($("gwPplN")) $("gwPplN").textContent = Math.max(S.count || 0, e.length); return; }
                var b = $("gwPplList"); if (b) b.innerHTML = '<p class="gw-note">Site şu an çok yoğun; katılımcı listesi birazdan görünecek. Katılımlar kaydediliyor.</p>';
                if ($("gwPplN")) $("gwPplN").textContent = S.count || "…";
            });
        });
    }
    function age(ms) { var d = Math.floor(ms / 86400000); return d >= 1 ? d + " gün" : Math.max(1, Math.floor(ms / 3600000)) + " sa"; }
    // Firestore toplu okuma (tek istekte 100 belgeye kadar); izin hatasında tek tek okumaya düşer
    function batchGet(paths) {
        var pre = "projects/" + cfg.projectId + "/databases/(default)/documents", out = {}, ch = [];
        for (var i = 0; i < paths.length; i += 100) ch.push(paths.slice(i, i + 100));
        return Promise.all(ch.map(function (c) {
            return req(":batchGet", { method: "POST", body: JSON.stringify({ documents: c.map(function (p) { return pre + p; }) }) })
                .then(function (r) { if (!r.ok) throw 0; return r.json(); })
                .then(function (a) { (a || []).forEach(function (x) { if (x.found) out[x.found.name.slice(pre.length)] = x.found; }); })
                .catch(function () {
                    return Promise.all(c.map(function (p) { return req(p).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d) out[p] = d; }, function () {}); }));
                });
        })).then(function () { return out; });
    }
    // Katılımcı kontrolü: bir kez yüklenen kişiler hafızada kalır; yeniden çizimde yalnız yeni katılanlar okunur
    // (Firebase okuma kotası için). "Yenile" (force) hepsini baştan okur.
    function checkPeople(force) {
        var g = S.g, box = $("gwChk"); if (!g || !box) return;
        var cached = S.chkFor === g.id && S.chk && S.entries;
        // elde bu çekilişin güncel listesi varsa (sayı değişmemiş) yeniden okuma; yalnız eksik kişileri tamamla
        var useList = cached && !force && S.entriesFor === g.id && S.entries.length === S.count;
        if (useList) { paintCheck(); if (S.entries.every(function (x) { return S.chk[x.uid]; })) return; }
        if (force || !cached) { S.chk = {}; S.chkFor = g.id; pfTok++; }
        if (S.chkBusy === g.id) return; S.chkBusy = g.id;
        Promise.all([useList ? S.entries : listEntries(g.id), useList ? (S.rev || {}) : listRev(g.id)]).then(function (res) {
            var l = res[0], out = S.chk;
            S.rev = res[1]; S.entries = l; S.entriesFor = g.id; S.entriesN = l.length;
            var need = l.filter(function (x) { if (x.m) out[x.uid] = { u: null, role: "", st: {}, proofs: [], pts: 0, m: 1 }; return !x.m && !out[x.uid]; });
            // 1) profiller ve roller (küçük): hemen çiz  2) görseller (büyük, base64) küçük gruplar halinde,
            // önce incelenmemiş kişiler; her grup gelince çizilir. Eskiden hepsi tek seferde bekleniyordu:
            // görseller hep birlikte, geç geliyordu ve bu arada "Görsel yok" yazıyordu.
            var paths = [], withProof = !!(g.yt || g.wa);
            need.forEach(function (x) { paths.push("/users/" + x.uid); if (ROLE[x.uid] === undefined) paths.push("/roles/" + x.uid); });
            return (paths.length ? batchGet(paths) : Promise.resolve({})).then(function (d) {
                need.forEach(function (x) {
                    var ud = d["/users/" + x.uid], u = ud ? dec(ud) : null, st = {};
                    if (ROLE[x.uid] === undefined) { var rd = d["/roles/" + x.uid]; ROLE[x.uid] = rd ? (dec(rd).role || "") : ""; }
                    try { st = u && u.stats ? JSON.parse(u.stats) : {}; } catch (e) {}
                    out[x.uid] = { u: u, role: ROLE[x.uid], st: st || {}, proofs: [], pts: 0, pl: withProof ? 0 : 1 };
                });
                S.chkBusy = null; if (S.g && S.g.id === g.id) paintCheck();
                if (withProof && need.length) loadProofs(g, need.slice().sort(function (a, b) { return (revOf(a.uid) ? 1 : 0) - (revOf(b.uid) ? 1 : 0) || (b.ts || 0) - (a.ts || 0); }), out);
            });
        }).catch(function () { S.chkBusy = null; if (!S.chk || !Object.keys(S.chk).length) box.innerHTML = '<h4>🔍 Katılımcı kontrolü</h4><p class="gw-note">Yüklenemedi. <button type="button" class="btn sm" id="gwReChk2">↻ Tekrar dene</button></p>'; if ($("gwReChk2")) $("gwReChk2").onclick = function () { checkPeople(true); }; });
    }
    var pfTok = 0, pfPaintT = 0;
    function loadProofs(g, list, out) {
        var tok = ++pfTok, CH = 6, chunks = [];
        for (var i = 0; i < list.length; i += CH) chunks.push(list.slice(i, i + CH));
        function repaint(uids) {
            // inceleme penceresinde şu an gösterilen kişinin görseli geldiyse pencereyi tazele
            if (S.rvCur && uids.indexOf(S.rvCur) >= 0 && S.rvShow && $("gwRvOk")) S.rvShow();
            clearTimeout(pfPaintT); pfPaintT = setTimeout(function () { if (S.g && S.g.id === g.id && !($("gwModal") && $("gwModal").classList.contains("open"))) paintCheck(); }, 120);
        }
        function next() {
            if (tok !== pfTok || !chunks.length) { if (tok === pfTok && S.g && S.g.id === g.id) paintCheck(); return Promise.resolve(); }
            var c = chunks.shift();
            return batchGet(c.map(function (x) { return "/giveaways/" + g.id + "/proof/" + x.uid; })).then(function (d) {
                if (tok !== pfTok) return;
                c.forEach(function (x) { var pd = d["/giveaways/" + g.id + "/proof/" + x.uid]; pd = pd ? dec(pd) : {}; var o = out[x.uid]; if (!o) return; o.proofs = PF.map(function (k) { return pd[k] || ""; }); o.pts = pd.ts || 0; o.pl = 1; });
                repaint(c.map(function (x) { return x.uid; }));
            }, function () { c.forEach(function (x) { if (out[x.uid]) out[x.uid].pl = 1; }); }).then(next);
        }
        // aynı anda 3 grup
        next(); next(); next();
    }
    function proofLoading(uid) { var c = (S.chk || {})[uid]; return !!(c && c.pl === 0); }
    function flagsOf(x, all) {
        var c = (S.chk || {})[x.uid] || {}, u = c.u, f = [];
        if (x.m) return [["star", isM(x.uid) ? "✋ Elle eklendi (hesapsız)" : "✋ Elle eklendi"]].concat(x.x2 ? [["star", "×2 şans"]] : []);
        if (x.x2) f.push(["star", "×2 şans (site sahibi verdi)"]);
        if (c.role === "askida" || c.role === "silindi") f.push(["bad", "⛔ Askıda: çekilmez"]);
        if (S.g && S.g.yt && S.chk && c.pl !== 0) chans(S.g).forEach(function (ch, i) { if (!(c.proofs || [])[i]) f.push(["bad", "📸 " + ch.name + " görseli yok"]); });
        if (devOf(x)) { var n = all.filter(function (y) { return devOf(y) === devOf(x); }).length; if (n > 1) f.push(["bad", "📱 Aynı cihaz ×" + n]); }
        (S.maybe || []).forEach(function (grp) { if (grp.some(function (y) { return y.uid === x.uid; })) f.push(["warn", "🧩 Muhtemelen aynı kişi: " + grp.filter(function (y) { return y.uid !== x.uid; }).map(function (y) { return y.name; }).join(", ")]); });
        var nm = String(x.name || "").toLocaleLowerCase("tr").trim(), sn = all.filter(function (y) { return String(y.name || "").toLocaleLowerCase("tr").trim() === nm; }).length;
        if (sn > 1) f.push(["warn", "👯 Aynı isim ×" + sn]);
        if (changedAfter(x.uid)) f.unshift(["new", "🔄 Görselini güncelledi"]);
        [0, 1].forEach(function (i) {
            if (!hasBk(x, i)) return; var v = revB(x.uid, BK[i]), nm = waList(S.g)[i].name;
            f.push([v === "no" ? "bad" : "star", "⭐ " + nm + ": " + (v === "no" ? "bonus geçersiz" : v === "ok" ? "bonus onaylı" : "bonus bekliyor")]);
        });
        if (bonusUp(x)) f.push(["star", "🎡 Çarkta " + weightOf(x) + "×"]);
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
        var l = S.entries || [], tab = S.tab || "all";
        S.maybe = maybeSame(l);
        var rows = l.map(function (x) { return { x: x, f: flagsOf(x, l).filter(function (t) { return t[0] !== "star"; }), s: flagsOf(x, l).filter(function (t) { return t[0] === "star"; }), v: revOf(x.uid) }; });
        var n = { all: rows.length, wait: 0, ok: 0, no: 0, sus: 0, wa: 0, wawait: 0 };
        rows.forEach(function (r) { n[r.v || "wait"]++; if (r.f.some(function (t) { return t[0] !== "new"; })) n.sus++; if (bonusUp(r.x)) { n.wa++; if ([0, 1].some(function (i) { return hasBk(r.x, i) && !revB(r.x.uid, BK[i]); })) n.wawait++; } });
        var groups = {}; l.forEach(function (x) { if (devOf(x)) (groups[devOf(x)] = groups[devOf(x)] || []).push(x); });
        var maybe = S.maybe, maybeN = maybe.reduce(function (n, a) { return n + a.length - 1; }, 0);
        var extra = [], dupG = []; Object.keys(groups).forEach(function (d) { var a = groups[d].slice().sort(function (p, q) { return (p.ts || 0) - (q.ts || 0); }); extra = extra.concat(a.slice(1));
            if (a.length > 1) dupG.push(a); });
        var list = rows.filter(function (r) { return tab === "all" || (tab === "sus" ? r.f.some(function (t) { return t[0] !== "new"; }) : tab === "wa" ? bonusUp(r.x) > 0 : (r.v || "wait") === tab); })
            // bekleyenler önce; onlar içinde görselini güncelleyen ve en yeni katılan en üstte
            .sort(function (a, b) { return (a.v ? 1 : 0) - (b.v ? 1 : 0) || (changedAfter(b.x.uid) ? 1 : 0) - (changedAfter(a.x.uid) ? 1 : 0) || (b.x.ts || 0) - (a.x.ts || 0); });
        if ($("gwmOk")) $("gwmOk").textContent = n.ok + "/" + n.all;
        var TABS = [["all", "Tümü"], ["wait", "⏳ Bekleyen"], ["ok", "✅ Onaylı"], ["no", "❌ Uygun değil"]].concat(g.wa ? [["wa", "💬 WhatsApp"]] : []).concat([["sus", "⚠️ İşaretli"]]);
        var ST = { ok: '<span class="gw-rvst ok">✅ Onaylı</span>', no: '<span class="gw-rvst no">❌ Uygun değil</span>', "": '<span class="gw-rvst">⏳ Bekliyor</span>' };
        box.innerHTML = '<h4>🔍 Katılımcılar ve görseller <span class="gw-sub">' + n.all + ' kişi</span></h4>' +
            (n.all && (g.yt || g.wa) ? '<div class="gw-rvgos">' + (g.yt ? '<button type="button" class="btn primary gw-big gw-rvgo" id="gwRev">📺 YouTube görselleri<small>' + (n.wait ? n.wait + ' bekleyen' : 'hepsi incelendi ✓') + '</small></button>' : '') +
                (g.wa ? '<button type="button" class="btn gw-big gw-rvgo gw-rvwa" id="gwRevWa">💬 WhatsApp görselleri<small>' + (n.wa ? (n.wawait ? n.wawait + ' bekleyen · ' : 'hepsi incelendi ✓ · ') + n.wa + ' kişi' : 'henüz yükleyen yok') + '</small></button>' : '') + '</div>' : '') +
            '<div class="gw-tabs">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (tab === t[0] ? ' class="on"' : '') + '>' + t[1] + ' <b>' + n[t[0]] + '</b></button>'; }).join("") + '</div>' +
            '<div class="gw-mrow">' + (extra.length || maybeN ? '<button type="button" class="btn sm gw-del" id="gwDupOut">📱 Aynı kişi kontrolü (' + (extra.length + maybeN) + ')</button>' : '') +
            '<button type="button" class="btn sm" id="gwReChk">↻ Yenile</button></div>' +
            '<div class="gw-plist">' + (list.map(function (r) {
                var x = r.x, prs = (((S.chk || {})[x.uid] || {}).proofs || []).filter(Boolean), vb = revB(x.uid) || revB(x.uid, "b2"), any = r.v || vb, wt = weightOf(x);
                var stt = r.v === "ok" ? '<b class="ok">✅ Onaylı</b>' : r.v === "no" ? '<b class="no">❌ Uygun değil</b>' : '<b>⏳ Bekliyor</b>';
                var upd = r.f.some(function (t) { return t[0] === "new"; }), ff = r.f.filter(function (t) { return t[0] !== "new"; });
                var warn = ff.map(function (t) { return t[1]; }), bad = ff.some(function (t) { return t[0] === "bad"; });
                return '<div class="gw-prow' + (r.v === "ok" ? " okd" : r.v === "no" ? " nod" : "") + '">' +
                    '<button type="button" class="gw-pth" data-proof="' + esc(x.uid) + '" title="Görselleri incele">' + (prs.length ? '<img src="' + prs[0] + '" alt="" loading="lazy" decoding="async">' + (prs.length > 1 ? '<i>' + prs.length + '</i>' : '') : proofLoading(x.uid) ? '<span class="gw-pld" aria-label="Yükleniyor"></span>' : '📷') + '</button>' +
                    '<div class="gw-pn"><div class="gw-pl1"><a' + (isM(x.uid) ? '' : ' href="/icerikler/profil?u=' + encodeURIComponent(x.uid) + '" target="_blank" rel="noopener"') + '>' + esc(x.name) + '</a>' + (x.m ? '<i class="gw-star" title="' + (isM(x.uid) ? "Elle eklendi (hesapsız)" : "Elle eklendi") + '">✋</i>' : '') + '</div>' +
                    '<div class="gw-pl2">' + stt + (x.x2 ? '<i class="gw-star" title="Site sahibi verdi">×2</i>' : '') + (x.oc ? '<i class="gw-star" title="Kazanırsa onay beklenmez">⚡</i>' : '') + (bonusUp(x) ? '<i class="gw-star" title="WhatsApp bonusu: ' + bonusUp(x) + ' görsel, ' + bonusCnt(x) + ' onaylı">⭐' + bonusCnt(x) + '/' + bonusUp(x) + '</i>' : '') + (wt > 1 ? '<i class="gw-star" title="Çarkta ' + wt + ' kez">🎡×' + wt + '</i>' : '') + (upd ? '<span class="new">🔄 Görselini güncelledi</span>' : '') + (warn.length ? '<span class="' + (bad ? "bad" : "warn") + '" title="' + esc(warn.join(" · ")) + '">⚠️ ' + esc(warn.join(" · ")) + '</span>' : '') + '</div></div>' +
                    // görünür: yalnız ✓ / ✗ ve "⋯"; seyrek işlemler "⋯" ile satırın altında açılır
                    '<div class="gw-pact">' + (x.m ? '' : '<div class="gw-okno"><button type="button" class="gw-qb ok' + (r.v === "ok" ? " on" : "") + '" data-rv="ok" data-u="' + esc(x.uid) + '" title="Onayla" aria-label="Onayla">✓</button><button type="button" class="gw-qb no' + (r.v === "no" ? " on" : "") + '" data-rv="no" data-u="' + esc(x.uid) + '" title="Uygun değil" aria-label="Uygun değil">✗</button></div>') +
                    '<button type="button" class="gw-qb more" data-more title="Diğer işlemler" aria-label="Diğer işlemler" aria-expanded="false">⋯</button></div>' +
                    '<div class="gw-pmore">' + (isOwner() ? '<button type="button" class="gw-mb' + (x.x2 ? " on" : "") + '" data-x2="' + esc(x.uid) + '">×2 ' + (x.x2 ? "şansı kaldır" : "şans ver") + '</button><button type="button" class="gw-mb' + (x.oc ? " on" : "") + '" data-oc="' + esc(x.uid) + '">⚡ ' + (x.oc ? "Onaysız kazanmayı kaldır" : "Kazanırsa onay beklenmesin") + '</button>' : '') +
                    (!x.m && any ? '<button type="button" class="gw-mb" data-rst="' + esc(x.uid) + '">↺ Beklemeye geri al</button>' : '') +
                    '<button type="button" class="gw-mb del" data-out="' + esc(x.uid) + '">🗑 Çekilişten çıkar</button></div></div>';
            }).join("") || '<p class="gw-note">' + (n.all ? "Bu bölümde kimse yok." : "Henüz katılımcı yok.") + '</p>') + '</div>';
        Array.prototype.forEach.call(box.querySelectorAll("[data-more]"), function (b) {
            b.onclick = function () {
                var row = b.closest(".gw-prow"), on = !row.classList.contains("more");
                Array.prototype.forEach.call(box.querySelectorAll(".gw-prow.more"), function (o) { o.classList.remove("more"); var mb = o.querySelector("[data-more]"); if (mb) mb.setAttribute("aria-expanded", "false"); });
                row.classList.toggle("more", on); b.setAttribute("aria-expanded", on ? "true" : "false");
            };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-tab]"), function (b) { b.onclick = function () { S.tab = b.getAttribute("data-tab"); paintCheck(); }; });
        Array.prototype.forEach.call(box.querySelectorAll("[data-proof]"), function (b) { b.onclick = function () { review(b.getAttribute("data-proof")); }; });
        Array.prototype.forEach.call(box.querySelectorAll("[data-x2]"), function (b) {
            b.onclick = function () {
                var uid = b.getAttribute("data-x2"), x = l.filter(function (y) { return y.uid === uid; })[0]; if (!x) return;
                var v = !x.x2; b.disabled = true;
                patch("/giveaways/" + g.id + "/e/" + uid, { x2: v }, "&currentDocument.exists=true").then(function (r) { if (!r.ok) throw 0; x.x2 = v; paintCheck(); }).catch(function () { b.disabled = false; alert("Kaydedilemedi."); });
            };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-oc]"), function (b) {
            b.onclick = function () {
                var uid = b.getAttribute("data-oc"), x = l.filter(function (y) { return y.uid === uid; })[0]; if (!x) return;
                var v = !x.oc; b.disabled = true;
                patch("/giveaways/" + g.id + "/e/" + uid, { oc: v }, "&currentDocument.exists=true").then(function (r) { if (!r.ok) throw 0; x.oc = v; paintCheck(); }).catch(function () { b.disabled = false; alert("Kaydedilemedi."); });
            };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-rst]"), function (b) { b.onclick = function () { clearRev(b.getAttribute("data-rst")); paintCheck(); }; });
        Array.prototype.forEach.call(box.querySelectorAll("[data-rv]"), function (b) {
            b.onclick = function () { var u = b.getAttribute("data-u"), v = b.getAttribute("data-rv"); if (revOf(u) === v) clearRev(u); else setRev(u, v); paintCheck(); };
        });
        if ($("gwRev")) $("gwRev").onclick = function () { review(null, "yt"); };
        if ($("gwRevWa")) $("gwRevWa").onclick = function () { review(null, "wa"); };
        $("gwReChk").onclick = function () { this.disabled = true; this.textContent = "Yenileniyor…"; checkPeople(true); };
        if ($("gwDupOut")) $("gwDupOut").onclick = function () {
            var nm = function (y, cls, tag) { return '<div class="' + cls + '"><span class="gw-tag">' + tag + '</span><b>' + esc(y.name || "Cuber") + '</b><small>' + esc(dtS(y.ts)) + '</small></div>'; };
            var pick = {};
            var chk = function (y, why) { return '<div class="x maybe"><label class="chk"><input type="checkbox" data-mb="' + esc(y.uid) + '"><span style="flex:1;min-width:0"><b style="display:block">' + esc(y.name || "Cuber") + '</b><span class="why">' + esc(why || "") + '</span></span><small>' + esc(dtS(y.ts)) + '</small></label></div>'; };
            var okTxt = function () { var n = extra.length + Object.keys(pick).length; return n ? n + " hesabı çıkar" : "Çıkarılacak hesap yok"; };
            var p = askBox("📱 Aynı kişi kontrolü",
                (dupG.length ? '<p class="gw-note"><b>Kesin:</b> bu hesaplar aynı cihazdan katılmış. Her cihazdan <b>ilk katılan kalır</b>, diğerleri çıkarılır.</p><div class="gw-dups">' +
                    dupG.map(function (a) { return '<div class="gw-dup">' + nm(a[0], "k", "✓ Kalır") + a.slice(1).map(function (y) { return nm(y, "x", "✕ Çıkar"); }).join("") + '</div>'; }).join("") + '</div>' : '') +
                (maybe.length ? '<div class="gw-dups"><h5>🧩 Kontrol et (kesin değil)</h5><p class="gw-note" style="margin:0">Farklı tarayıcıdan, uygulamadan ya da verileri silip yeniden katılmış olabilir. Aynı kişiyse çıkarılacakları işaretle.</p>' +
                    maybe.map(function (a) { return '<div class="gw-dup maybe">' + nm(a[0], "k", "İlk katılan") + a.slice(1).map(function (y) { return chk(y, a.why[y.uid]); }).join("") + '</div>'; }).join("") + '</div>' : ''),
                okTxt(), true);
            var okB = $("gwAskOk"); okB.disabled = !extra.length;
            Array.prototype.forEach.call(document.querySelectorAll("[data-mb]"), function (cb) {
                cb.onchange = function () { var u = cb.getAttribute("data-mb"); if (cb.checked) pick[u] = 1; else delete pick[u]; okB.textContent = okTxt(); okB.disabled = !(extra.length + Object.keys(pick).length); };
            });
            p.then(function (ok) { if (ok) removeMany(extra.map(function (x) { return x.uid; }).concat(Object.keys(pick))); });
        };
        Array.prototype.forEach.call(box.querySelectorAll("[data-out]"), function (b) {
            b.onclick = function () {
                var uid = b.getAttribute("data-out"), x = l.filter(function (y) { return y.uid === uid; })[0];
                if (confirm((x ? x.name : "Bu kişi") + " çekilişten çıkarılsın mı?")) removeMany([uid]);
            };
        });
    }
    // inceleme penceresi açıkken klavye: 1 = uygun değil, 2 = onayla, boşluk = atla, Esc = kapat
    document.addEventListener("keydown", function (e) {
        var m = $("gwModal"); if (!m || !m.classList.contains("open") || !$("gwRvOk") || e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) return;
        var id = e.key === "1" ? "gwRvNo" : e.key === "2" ? "gwRvOk" : e.key === " " ? "gwRvSkip" : e.key === "Escape" ? "gwRvX" : "";
        if (!id || !$(id)) return; e.preventDefault(); if (e.repeat) return; $(id).click();
    });
    // görselleri sırayla incele: büyük görseller, Onayla / Uygun değil / Atla, sonra sıradaki kişi
    function review(start, mode) {
        var l = S.entries || []; if (!l.length) return;
        var hasWa = function (x) { return bonusUp(x) > 0; };
        var waPend = function (x) { return [0, 1].some(function (k) { return hasBk(x, k) && !revB(x.uid, BK[k]); }); };
        var pool = mode === "wa" ? l.filter(hasWa) : l;
        if (!pool.length) { alert("WhatsApp görseli yükleyen kimse yok."); return; }
        var isPend = function (x) { return mode === "wa" ? waPend(x) : mode === "yt" ? !revOf(x.uid) : !revOf(x.uid) || waPend(x); };
        var newest = function (a, b) { return (changedAfter(b.uid) ? 1 : 0) - (changedAfter(a.uid) ? 1 : 0) || (b.ts || 0) - (a.ts || 0); };
        var pend = pool.filter(isPend).sort(newest).map(function (x) { return x.uid; });
        var q = start ? [start].concat(pend.filter(function (u) { return u !== start; })) : pend.length ? pend : pool.slice().sort(newest).map(function (x) { return x.uid; });
        var i = 0, ch = chans(S.g);
        function done() {
            var n = { ok: 0, no: 0, wait: 0 }; l.forEach(function (x) { n[revOf(x.uid) || "wait"]++; });
            modal('<div class="gw-confetti">✅</div><h3>İnceleme bitti</h3><p><b>' + n.ok + '</b> onaylı · <b>' + n.no + '</b> uygun değil · <b>' + n.wait + '</b> bekleyen</p><button type="button" class="btn primary gw-big" id="gwRvEnd">Tamam</button>');
            S.rvCur = null;
            $("gwRvEnd").onclick = function () { closeModal(); paintCheck(); };
        }
        // her kişi için adım adım: her kanal ayrı onaylanır, varsa WhatsApp topluluğu da ayrı onaylanır
        var st = 0;
        function show() {
            var x = null; while (i < q.length && !(x = l.filter(function (y) { return y.uid === q[i]; })[0])) i++;
            if (!x) return done();
            S.rvCur = x.uid; S.rvShow = show;
            var ldg = proofLoading(x.uid);
            var prs = ((S.chk || {})[x.uid] || {}).proofs || [], f = flagsOf(x, l).filter(function (t) { return t[0] !== "star"; }), v = revOf(x.uid), vb = revB(x.uid), vb2 = revB(x.uid, "b2");
            var items = mode === "wa" ? [] : ch.map(function (c, k) { return { k: k, cap: "📺 " + c.name + " kanalı", img: prs[k], kind: "ch" }; });
            if (mode !== "yt") [0, 1].forEach(function (k) { if (hasBk(x, k)) items.push({ k: 2 + k, cap: "⭐ WhatsApp: " + waList(S.g)[k].name, img: prs[2 + k], kind: "wa", bk: BK[k] }); });
            if (!items.length) { i++; st = 0; return show(); }
            if (st >= items.length) st = 0;
            var cur = items[st];
            var dots = items.map(function (it, n) { return '<span class="' + (n < st ? "ok" : n === st ? "on" : "") + '">' + (n < st ? "✓" : n + 1) + '</span>'; }).join("");
            modal('<div class="gw-rvtop"><span>' + (mode === "wa" ? "💬 WhatsApp · " : mode === "yt" ? "📺 YouTube · " : "") + 'Kişi ' + (i + 1) + ' / ' + q.length + '</span><button type="button" class="gw-rvx" id="gwRvX" aria-label="Kapat">✕</button></div>' +
                '<h3 class="gw-rvname">' + esc(x.name) + '</h3>' +
                (v || vb || vb2 ? '<p>' + (v === "ok" ? '<span class="gw-rvst ok">✅ Kanallar onaylı</span>' : v === "no" ? '<span class="gw-rvst no">❌ Uygun değil</span>' : '') + [vb, vb2].map(function (z, k) { return !z || !hasBk(x, k) ? '' : '<span class="gw-rvst ' + z + '">⭐ ' + esc(waList(S.g)[k].name) + (z === "ok" ? ' onaylı' : ' geçersiz') + '</span>'; }).join("") + '</p>' : '') +
                (f.length ? '<div class="gw-flags" style="justify-content:center">' + f.map(function (t) { return '<span class="' + t[0] + '">' + esc(t[1]) + '</span>'; }).join("") + '</div>' : '') +
                '<div class="gw-rvstep"><div class="gw-rvdots">' + dots + '</div><b>Adım ' + (st + 1) + ' / ' + items.length + ': ' + esc(cur.cap) + '</b><small>' + (cur.kind === "wa" ? "Görselde topluluk adı ve üyelik görünmeli." : "Görselde kanal adı ve <b>Abone olundu</b> yazısı görünmeli.") + '</small></div>' +
                '<div class="gw-rvimgs">' + items.map(function (it, n) { return '<figure class="' + (it.kind === "wa" ? "gw-rvb " : "") + (n === st ? "cur" : n < st ? "done" : "dim") + '"><figcaption>' + (n < st ? "✓ " : "") + esc(it.cap) + '</figcaption>' + (it.img ? '<img src="' + it.img + '" alt="" title="Büyütmek için dokun">' : ldg ? '<div class="gw-rvnone ld"><span class="gw-pld"></span>Görsel yükleniyor…</div>' : '<div class="gw-rvnone">Görsel yok</div>') + '</figure>'; }).join("") + '</div>' +
                '<div class="gw-rvact"><button type="button" class="btn gw-rvno" id="gwRvNo"><kbd>1</kbd> ✗ ' + (cur.kind === "wa" ? "Bonus geçersiz" : "Uygun değil") + '</button><button type="button" class="btn" id="gwRvSkip">Atla</button><button type="button" class="btn gw-rvok" id="gwRvOk"><kbd>2</kbd> ✓ Onayla' + (st < items.length - 1 ? ' → sonraki görsel' : '') + '</button></div>' +
                '<p class="gw-rvkeys">Klavye: <kbd>1</kbd> reddet · <kbd>2</kbd> onayla · <kbd>Boşluk</kbd> kişiyi atla · <kbd>Esc</kbd> kapat</p>' +
                '<div class="gw-rvlinks">' + (v || vb || vb2 ? '<button type="button" class="gw-rvrst" id="gwRvRst">↺ Beklemeye geri al</button>' : '') + '<button type="button" class="gw-rvout" id="gwRvOut">🗑 Çekilişten çıkar</button></div>');
            if ($("gwRvRst")) $("gwRvRst").onclick = function () { clearRev(x.uid); st = 0; show(); };
            Array.prototype.forEach.call(document.querySelectorAll(".gw-rvimgs img"), function (im) { im.onclick = function () { im.closest(".gw-rvimgs").classList.toggle("zoom"); }; });
            var c = document.querySelector(".gw-rvimgs figure.cur"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest" });
            var nextPerson = function () { i++; st = 0; show(); };
            if (ldg) $("gwRvOk").disabled = true; // görsel gelmeden onaylanmasın
            $("gwRvOk").onclick = function () {
                if (cur.kind === "wa") setRevF(x.uid, cur.bk, "ok");
                else if (!items.slice(st + 1).some(function (it) { return it.kind === "ch"; })) setRev(x.uid, "ok"); // son kanal da onaylandı
                st++; if (st >= items.length) nextPerson(); else show();
            };
            $("gwRvNo").onclick = function () {
                if (cur.kind === "wa") { setRevF(x.uid, cur.bk, "no"); st++; if (st >= items.length) nextPerson(); else show(); return; } // bonus reddi yalnız o bonusu düşürür
                setRev(x.uid, "no"); // kanal reddi: kişi uygun değil
                nextPerson();
            };
            $("gwRvSkip").onclick = nextPerson;
            $("gwRvX").onclick = function () { closeModal(); paintCheck(); };
            $("gwRvOut").onclick = function () { if (confirm(x.name + " çekilişten çıkarılsın mı?")) { closeModal(); removeMany([x.uid]); } };
        }
        show();
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
        // çekilişi ve yeniden çekilişi yalnız yetkili elle başlatır: kazanan süresinde onaylamazsa
        // sıradaki kişi kendiliğinden çekilmez, yetkili "Sıradaki kişiyi çek"e basar
        void p;
    }
    function waFormHtml(px, g, isNew) {
        var cur = waList(g);
        return '<div class="gw-wabox"><p class="gw-wah">⭐ <b>Bonus: WhatsApp topluluğu</b> — bir topluluğun üyesi 2×, iki topluluğun üyesi 3× şans (isteğe bağlı, her topluluk için ayrı görsel)</p>' +
            [0, 1].map(function (i) {
                var c = cur[i] || { name: WA_DEF[i][0], url: WA_DEF[i][1] }, on = isNew ? true : !!cur[i];
                return '<div class="gw-ych gw-wab"><label class="gw-chkf"><input type="checkbox" class="' + px + 'WaC"' + (on ? ' checked' : '') + '> WhatsApp topluluğu: <b>' + esc(c.name) + '</b></label>' +
                    '<div class="gw-row"><input class="' + px + 'WaN" maxlength="40" value="' + esc(c.name) + '" aria-label="Topluluk adı"><input class="' + px + 'WaU" maxlength="200" value="' + esc(c.url) + '" placeholder="https://chat.whatsapp.com/…" aria-label="Topluluk bağlantısı"></div></div>';
            }).join("") + '<p class="gw-note" style="margin:6px 0 0">İşaretli topluluklar katılımcıya gösterilir. Her topluluğun görseli ayrı incelenir: onaylı her topluluk çarkta +1 sayılır. Hiçbiri işaretli değilse bonus kapalıdır.</p></div>';
    }
    function waFormRead(px) {
        var ns = [], us = [], bad = "";
        Array.prototype.forEach.call(document.querySelectorAll("." + px + "WaC"), function (cb) {
            if (!cb.checked) return; var row = cb.closest(".gw-wab");
            var n = row.querySelector("." + px + "WaN").value.replace(/\|/g, " ").trim(), u = row.querySelector("." + px + "WaU").value.replace(/\|/g, "").trim();
            if (!n) bad = "Topluluk adını yaz."; else if (u && !/^https:\/\//.test(u)) bad = "Topluluk bağlantısı https:// ile başlamalı.";
            ns.push(n.slice(0, 40)); us.push(u);
        });
        if (bad) return { err: bad };
        return { wa: ns.join("|"), waUrl: us.some(Boolean) ? us.join("|") : "" };
    }
    // yönetici: çekilişi sonradan düzenle
    function askFormHtml(px, g) {
        var a = askL(g);
        return '<div class="gw-f"><span>Kazanandan istenecek bilgiler</span><div class="gw-reqbox gw-askbox">' +
            '<div class="gw-askp" id="' + px + 'AskP"><button type="button" data-a="name,phone,email,address">📦 Kargo (hepsi)</button><button type="button" data-a="name,phone,email">📞 Yalnız iletişim</button><button type="button" data-a="">🚫 Hiçbir şey isteme</button></div>' +
            ASK.map(function (x) { return '<label class="gw-chkf"><input type="checkbox" class="' + px + 'Ask" value="' + x[0] + '"' + (a.indexOf(x[0]) >= 0 ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join("") +
            '<label class="gw-f" style="margin-top:8px"><span>Özel soru (isteğe bağlı)</span><input id="' + px + 'AskQ" maxlength="80" value="' + esc(g.askQ || "") + '" placeholder="Ör. Discord kullanıcı adın"></label>' +
            '<p class="gw-note" style="margin:4px 0 0">Kazanan onayladıktan sonra yalnız işaretli bilgiler istenir. Hiçbiri işaretli değilse ve özel soru boşsa bilgi istenmez; kazananla sen iletişime geçersin.</p></div></div>';
    }
    function askFormBind(px) {
        $(px + "AskP").onclick = function (e) {
            var b = e.target.closest("button"); if (!b) return; var v = b.getAttribute("data-a").split(",");
            Array.prototype.forEach.call(document.querySelectorAll("." + px + "Ask"), function (c) { c.checked = v.indexOf(c.value) >= 0; });
        };
    }
    function askFormRead(px) {
        var a = []; Array.prototype.forEach.call(document.querySelectorAll("." + px + "Ask"), function (c) { if (c.checked) a.push(c.value); });
        return { ask: a.join(","), askQ: $(px + "AskQ").value.trim().slice(0, 80) };
    }
    function editGw() {
        var g = S.g; if (!g || !S.mgr) return;
        var owner = !!(window.Account && Account.isAdmin && Account.isAdmin()), p = phase(g), canDate = p === "open" || p === "closed", m0 = modeOf(g), ch = chans(g);
        var loc = function (t) { var d = new Date(t); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
        modal('<h3>✏️ Çekilişi düzenle</h3><form id="geForm" class="gw-form">' +
            '<label class="gw-f"><span>Başlık *</span><input id="geTitle" maxlength="80" required value="' + esc(g.title) + '"></label>' +
            '<label class="gw-f"><span>Ödül *</span><input id="gePrize" maxlength="120" required value="' + esc(g.prize || "") + '"></label>' +
            (owner ? '<label class="gw-f"><span>Açıklama</span><textarea id="geDesc" maxlength="1500" rows="3">' + esc(g.desc || "") + '</textarea></label>' : '') +
            '<div class="gw-f"><span>Görsel</span><div class="gw-presets" id="gePre">' + PRESETS.map(function (x) { return '<button type="button" data-p="' + x[0] + '"' + (imgOf(g) === "/img/cekilis/" + x[0] + ".svg" ? ' class="on"' : '') + '><img src="/img/cekilis/' + x[0] + '.svg" alt="" loading="lazy"><span>' + esc(x[1]) + '</span></button>'; }).join("") + '</div></div>' +
            (owner ? '<label class="gw-f"><span>Kendi görsel bağlantın (isteğe bağlı)</span><input id="geImg" maxlength="500" value="' + esc(/^\/img\/cekilis\//.test(imgOf(g)) ? "" : imgOf(g)) + '" placeholder="https://…jpg"></label>' : '') +
            '<div class="gw-f"><span>Çekiliş türü</span><div class="gw-seg" id="geMode">' + ["cark", "mini", "rastgele"].map(function (k) { return '<button type="button" data-m="' + k + '"' + (k === m0 ? ' class="on"' : '') + '>' + MODE_LBL[k] + '</button>'; }).join("") + '</div></div>' +
            '<label class="gw-f"><span>Çekiliş tarihi ve saati *' + (canDate ? '' : ' (çekiliş yapıldı, değiştirilemez)') + '</span><input id="geAt" type="datetime-local" value="' + loc(g.drawAt) + '"' + (canDate ? '' : ' disabled') + '></label>' +
            '<div class="gw-f"><span>Katılma şartları</span><div class="gw-reqbox">' + [0, 1].map(function (i) { var c = ch[i] || { name: YT_DEF[i][0], url: YT_DEF[i][1] }; return '<div class="gw-ych"><label class="gw-chkf"><input type="checkbox" class="geYt"' + (ch[i] ? ' checked' : '') + '> YouTube aboneliği</label><div class="gw-row"><input class="geYtName" maxlength="40" value="' + esc(c.name) + '" aria-label="Kanal adı"><input class="geYtUrl" maxlength="120" value="' + esc(c.url) + '" aria-label="Kanal bağlantısı"></div></div>'; }).join("") +
            waFormHtml("ge", g, false) + '</div></div>' + askFormHtml("ge", g) +
            '<p class="gw-note">Şartları değiştirirsen daha önce katılanların görselleri yeni şartlara uymayabilir; kontrol listesinde görünür.</p>' +
            '<div class="gw-act"><button type="submit" class="btn primary gw-big">💾 Kaydet</button><button type="button" class="btn" id="geX">Vazgeç</button></div><div class="gw-msg" id="geMsg"></div></form>');
        var pick = null, mode = m0;
        $("gePre").onclick = function (e) { var b = e.target.closest("button"); if (!b) return; pick = b.getAttribute("data-p"); Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); }); };
        $("geMode").onclick = function (e) { var b = e.target.closest("button"); if (!b) return; mode = b.getAttribute("data-m"); Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); }); };
        $("geX").onclick = closeModal; askFormBind("ge");
        $("geForm").onsubmit = function (e) {
            e.preventDefault();
            var o = { title: $("geTitle").value.trim(), prize: $("gePrize").value.trim(), mode: mode };
            if (!o.title) { $("geMsg").textContent = "Başlık boş olamaz."; return; }
            if ($("geDesc")) o.desc = $("geDesc").value.trim();
            var own = $("geImg") ? $("geImg").value.trim() : "";
            if (own && !/^https:\/\//.test(own)) { $("geMsg").textContent = "Görsel bağlantısı https:// ile başlamalı."; return; }
            if (own) o.img = own; else if (pick) o.img = "/img/cekilis/" + pick + ".svg"; else if ($("geImg") && !own && !/^\/img\/cekilis\//.test(imgOf(g))) o.img = "/img/cekilis/kup.svg";
            var ycs = [], bad = "";
            Array.prototype.forEach.call(document.querySelectorAll("#geForm .gw-ych:not(.gw-wab)"), function (row) {
                if (!row.querySelector(".geYt").checked) return;
                var n = row.querySelector(".geYtName").value.replace(/\|/g, " ").trim(), u = row.querySelector(".geYtUrl").value.replace(/\|/g, "").trim();
                if (!n) bad = "Kanal adını yaz."; else if (u && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(u)) bad = "Kanal bağlantısı bir YouTube adresi olmalı.";
                ycs.push([n, u]);
            });
            if (bad) { $("geMsg").textContent = bad; return; }
            o.yt = ycs.map(function (c) { return c[0]; }).join("|"); o.ytUrl = ycs.length ? ycs.map(function (c) { return c[1]; }).join("|") : "";
            var wa = waFormRead("ge"); if (wa.err) { $("geMsg").textContent = wa.err; return; } o.wa = wa.wa; o.waUrl = wa.waUrl;
            var ak = askFormRead("ge"); o.ask = ak.ask; o.askQ = ak.askQ;
            if (canDate) {
                var at = new Date($("geAt").value).getTime();
                if (!at) { $("geMsg").textContent = "Tarih seç."; return; }
                if (at !== g.drawAt || mode !== m0) {
                    if (at <= Date.now() + 60000) { $("geMsg").textContent = "En az 1 dakika sonrası için bir tarih seç."; return; }
                    o.drawAt = at; o.closeAt = g.test ? at : at - (CLOSE[mode] || 0);
                    if (g.st === "open" || phase(g) === "closed") o.st = "open";
                }
            }
            var b = this.querySelector("button[type=submit]"); b.disabled = true;
            patch("/giveaways/" + g.id, o).then(function (r) {
                if (!r.ok) throw new Error(r.status);
                closeModal(); applyLocal(g.id, o);
                return fetchOne(g.id).then(function () { applyLocal(g.id, o, true); renderOne(); msg("Çekiliş güncellendi ✓"); });
            }).catch(function (er) { b.disabled = false; $("geMsg").textContent = "Kaydedilemedi (" + er.message + ")."; });
        };
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
            '<p class="gw-note" style="margin:6px 0 0">İşaretli her kanal için katılımcıdan ayrı bir abonelik ekran görüntüsü istenir.</p>' + waFormHtml("gn", {}, true) + '</div></div>' + askFormHtml("gn", {}) +
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
        info(); suggest(); askFormBind("gn");
        $("gwNew").onsubmit = function (e) {
            e.preventDefault();
            var test = $("gnTest").checked, close = test ? 0 : CLOSE[mode];
            var at = new Date($("gnAt").value).getTime(), img = $("gnImg") ? $("gnImg").value.trim() : "";
            if (!at || at <= Date.now() + 60000) { $("gnMsg").textContent = "En az 1 dakika sonrası için bir tarih seç."; return; }
            if (!test && close && at - close < Date.now() && !confirm("Çekilişe 10 dakikadan az var: kayıtlar hemen kapalı olur. Yine de oluşturulsun mu?")) return;
            if (img && !/^https:\/\//.test(img)) { $("gnMsg").textContent = "Görsel bağlantısı https:// ile başlamalı."; return; }
            var ycs = [], bad = "";
            Array.prototype.forEach.call(document.querySelectorAll("#gwNew .gw-ych:not(.gw-wab)"), function (row) {
                if (!row.querySelector(".gnYt").checked) return;
                var n = row.querySelector(".gnYtName").value.replace(/\|/g, " ").trim(), u = row.querySelector(".gnYtUrl").value.replace(/\|/g, "").trim();
                if (!n) bad = "Kanal adını yaz.";
                else if (u && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(u)) bad = "Kanal bağlantısı bir YouTube adresi olmalı.";
                ycs.push([n, u]);
            });
            if (bad) { $("gnMsg").textContent = bad; return; }
            var yt = ycs.map(function (c) { return c[0]; }).join("|"), ytUrl = ycs.length ? ycs.map(function (c) { return c[1]; }).join("|") : "";
            var wa = waFormRead("gn"); if (wa.err) { $("gnMsg").textContent = wa.err; return; }
            var u = me(), id = newId(), o = { title: $("gnTitle").value.trim(), prize: $("gnPrize").value.trim(), desc: $("gnDesc") ? $("gnDesc").value.trim() : "", img: img || "/img/cekilis/" + pick + ".svg", drawAt: at, closeAt: at - close, host: u.uid, hName: myName(), st: "open", n: 0, x: "", ts: Date.now(), mode: mode, test: test, yt: yt, ytUrl: ytUrl, wa: wa.wa, waUrl: wa.waUrl };
            var ak = askFormRead("gn"); o.ask = ak.ask; o.askQ = ak.askQ;
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
            var wn = Math.max(1, names.filter(function (n) { return n === winner; }).length), list = others.slice(0, 24 - wn);
            for (var k = 0; k < wn; k++) list.splice(rnd(list.length + 1), 0, winner);
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
        // yönetici, kazanan teslimat bilgilerini gönderene kadar sık yoklar (sayfayı yenilemeden görsün)
        var waitClaim = S.mgr && g.st === "claimed" && !isM(g.w) && needInfo(g) && S.claimSeen !== g.id + g.w;
        // okuma tasarrufu: sık yoklama yalnız sonuç beklenirken (çekilişten önce / çekiliş anında);
        // sonuç çıktıktan sonra yalnız yönetici ve kazanan sık yoklar, diğer izleyiciler dakikada bir
        var now = Date.now(), waitDraw = (g.st === "open" || !g.st) && now > g.drawAt - 90000 && now < g.drawAt + 1800000;
        var iWin = !!(me() && me().uid === g.w), near = waitDraw || (g.st === "drawn" && now < g.claimBy + 600000 && (S.mgr || iWin || S.joined)) || waitClaim; // katılan, yeniden çekilişte kendisi seçilebilir
        // sık yoklamada yalnız çekiliş belgesi okunur; tam yenileme (katılımım + sayı) 5 dakikada bir
        S.pollN = (S.pollN || 0) + 1;
        var light = near || S.pollN % 5 !== 0;

        // okuma tasarrufu: sık yoklama yalnız yönetici ve kazanan için 5 sn; diğer izleyiciler 15 sn
        // (sonuç geldiğinde çark animasyonu zaten oynar, birkaç saniyelik gecikme fark edilmez)
        var fast = S.mgr || iWin || waitClaim;
        S.pollT = setTimeout(function () { pollNow(light, waitClaim); }, document.hidden ? 120000 : near ? (fast ? 5000 : 15000) : 60000);
    }
    function pollNow(light, waitClaim) {
        var g = S.g; if (!g) return;
        clearTimeout(S.pollT);
        var sig = function () { return JSON.stringify([S.g, S.joined, S.count]); }, before = sig();
        fetchOne(g.id, light).then(function () {
            if (!S.g) return;
            try { if (sig() !== before) renderOne(); else if (waitClaim && S.g.st === "claimed" && $("gwClaim")) loadClaim(S.g); autoMgr(); }
            finally { schedule(); } // çizimde hata olsa da yoklama durmasın
        });
    }
    // telefonda başka uygulamaya geçip dönünce (sayfa arka planda 2 dakikada bir yokluyordu) hemen güncelle
    function wake() {
        if (!S.g || document.hidden || $("gwOne").hidden) return;
        var t = Date.now(); if (t - (S.lastWake || 0) < 4000) return; S.lastWake = t;
        var g = S.g, waitClaim = S.mgr && g.st === "claimed" && !isM(g.w) && needInfo(g) && S.claimSeen !== g.id + g.w;
        pollNow(true, waitClaim);
    }
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    function tick() {
        updCd();
        var tn = Date.now();
        Array.prototype.forEach.call(document.querySelectorAll("[data-left]"), function (el) { var v = left(+el.getAttribute("data-left") - tn); if (el.textContent !== v) el.textContent = v; });
        Array.prototype.forEach.call(document.querySelectorAll("[data-ago]"), function (el) { var v = left(tn - +el.getAttribute("data-ago")); if (el.textContent !== v) el.textContent = v; });
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
        if (Account.isAdmin && Account.isAdmin()) { S.mgr = true; createForm(); if (S.list && !$("gwListWrap").hidden) renderList(); return Promise.resolve(); }
        return Account.getRole(u.uid).then(function (r) { S.mgr = r === "admin" || r === "gelistirici"; createForm(); if (S.mgr && S.list && !$("gwListWrap").hidden) renderList(); }, function () { createForm(); });
    }
    document.addEventListener("ra-push-change", function () { if (S.g) renderOne(); });
    function start() {
        $("gwModal").onclick = function (e) { if (e.target === $("gwModal") && !$("gwModal").querySelector("#gwOk,#gwForm")) closeModal(); };
        var id = (/[?&]id=([^&]+)/.exec(location.search) || [])[1];
        // liste/çekiliş hesaptan bağımsız hemen yüklenir; rol öğrenilince yönetim araçları eklenir
        if (id) openOne(decodeURIComponent(id), true); else loadList();
        try { checkRole().then(function () { if (S.g) renderOne(); else if (S.listLoaded) renderList(); }, function () {}); } catch (e) {}
        clearInterval(S.tickT); S.tickT = setInterval(tick, 1000);
        window.addEventListener("popstate", function () { var i = (/[?&]id=([^&]+)/.exec(location.search) || [])[1]; if (i) openOne(decodeURIComponent(i), true); else { $("gwOne").hidden = true; $("gwListWrap").hidden = false; loadList(); } });
        if (Account.onChange) Account.onChange(function () { checkRole().then(function () { if (S.g) fetchOne(S.g.id).then(renderOne); else renderList(); }); });
    }
    if (window.Account) start(); else document.addEventListener("DOMContentLoaded", start);
    // test / geliştirme: hesap değişince yeniden yükle
    window.Cekilis = { _s: S, draw: draw, Draw: Draw, weight: weightOf, refresh: function () { return checkRole().then(function () { if (S.g) return fetchOne(S.g.id).then(renderOne); return loadList(); }); } };
})();
