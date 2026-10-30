/* =========================================================
   PROFİL (profil.js)
   - ?u=<uid> yoksa: kendi panon (giriş gerekir; düzenle, paylaş, çıkış)
   - ?u=<uid> varsa: o kişinin herkese açık profili (salt-okunur)
   Veri: account.js'in yazdığı users/{uid} herkese açık dokümanı + yerel kayıtlar.
========================================================= */
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(ms) { if (!ms) return "—"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
  var root = $("profRoot");
  var ACCENTS = [["", "Varsayılan"], ["#d12d28", "Kırmızı"], ["#ff7a1a", "Turuncu"], ["#f6c719", "Sarı"], ["#179e4f", "Yeşil"], ["#2c6fe6", "Mavi"], ["#8b5cf6", "Mor"], ["#ec4899", "Pembe"]];
  var CUBES = ["", "3x3", "2x2", "4x4", "5x5", "6x6", "7x7", "Pyraminx", "Skewb", "Megaminx", "Square-1", "Clock", "FTO"];
  function avaStyle(acc) { return acc ? ' style="border-color:' + acc + ';box-shadow:0 0 0 4px ' + acc + '33"' : ''; }
  function favLine(fav) { return fav ? '<div class="p-meta">⭐ Favori küp: ' + esc(fav) + '</div>' : ''; }
  var SET_LABELS = { oll: "OLL", pll: "PLL", "2look-2lo": "2-Look OLL", "2look-2lp": "2-Look PLL", f2l: "F2L", coll: "COLL", wv: "WV", cll: "CLL", eg1: "EG-1", eg2: "EG-2", "ortega-oll": "Ortega OLL", "ortega-pbl": "Ortega PBL", "roux-cmll": "Roux CMLL", zbll: "ZBLL", "megaminx-oll": "Megaminx OLL", "megaminx-pll": "Megaminx PLL", "square1-shape": "SQ-1 Cubeshape", "square1-co": "SQ-1 CO", "square1-eo": "SQ-1 EO", "square1-cp": "SQ-1 CP", "square1-ep": "SQ-1 EP" };
  function initials(n) { n = (n || "?").trim().split(/\s+/); return ((n[0] || "?")[0] + (n[1] ? n[1][0] : "")).toUpperCase(); }
  function avatar(photo, name) { return photo ? '<img src="' + esc(photo) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(name)); }
  function dateStr(ms) { if (!ms) return ""; try { return new Date(ms).toLocaleDateString("tr-TR", { year: "numeric", month: "long" }); } catch (e) { return ""; } }
  // Yüklenen fotoğrafı kare kırpıp küçültür, data URL döndürür (profil dokümanına sığsın diye)
  function downscalePhoto(file, cb) {
    if (!file || !/^image\//.test(file.type)) { cb(null); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      function render(size, q) { var c = document.createElement("canvas"); c.width = c.height = size; c.getContext("2d").drawImage(img, sx, sy, s, s, 0, 0, size, size); return c.toDataURL("image/jpeg", q); }
      var data = render(180, 0.72), q = 0.72;
      while (data.length > 38000 && q > 0.35) { q -= 0.1; data = render(180, q); }
      if (data.length > 38000) data = render(120, 0.6);
      URL.revokeObjectURL(url); cb(data.length <= 40000 ? data : null);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }
  function roleBadge(role) {
    if (role === "gelistirici") return '<span class="p-badge dev">Geliştirici</span>';
    if (role === "tester") return '<span class="p-badge test">Tester</span>';
    if (role === "organizator") return '<span class="p-badge org">🏠 Organizatör</span>';
    return '<span class="p-badge member">Üye</span>';
  }
  function showRole(uid) {
    if (!window.Account.getRole) return;
    window.Account.getRole(uid).then(function (role) {
      var h = $("profRoot") && $("profRoot").querySelector("h1");
      if (h && !h.querySelector(".p-badge")) h.insertAdjacentHTML("beforeend", " " + roleBadge(role || "uye"));
    });
  }

  function statTiles(st) {
    st = st || {};
    var rows = [["Bilinen case", st.known || 0], ["Öğrenilen", st.learning || 0], ["Trainer çözüm", st.solves || 0], ["Günlük en iyi", fmt(st.best)], ["Günlük gün", st.daily || 0]];
    return '<div class="stat-tiles">' + rows.map(function (r) { return '<div class="stat-tile"><b>' + esc(r[1]) + "</b><span>" + r[0] + "</span></div>"; }).join("") + "</div>";
  }
  // Ev yarışması: odalar, turlar, şampiyonluk ve küp başına kişisel rekorlar (en iyi tekil, Ao5, Ao12)
  function compGrid(st) {
    var c = st && st.comp;
    if (!c) return '<p class="p-note">Henüz ev yarışmasına katılmadı.</p>';
    var tiles = [["Oda", c.rooms || 0], ["Tur", c.rounds || 0], ["Final", c.finals || 0], ["🏆 Şampiyonluk", c.wins || 0]];
    var html = '<div class="stat-tiles">' + tiles.map(function (r) { return '<div class="stat-tile"><b>' + esc(r[1]) + "</b><span>" + r[0] + "</span></div>"; }).join("") + "</div>";
    var evs = [["333", "3x3"], ["222", "2x2"]].filter(function (e) { return c.pb && c.pb[e[0]]; });
    if (evs.length) html += '<div class="p-pb">' + evs.map(function (e) {
      var pb = c.pb[e[0]];
      return '<div class="p-pb-row"><b>' + e[1] + '</b><span>Tekil <i dir="ltr">' + fmt(pb.s) + '</i></span><span>Ao5 <i dir="ltr">' + fmt(pb.a5) + '</i></span><span>Ao12 <i dir="ltr">' + fmt(pb.a12) + '</i></span></div>';
    }).join("") + "</div>";
    var list = c.list || [];
    if (list.length) html += '<h3 class="p-sub">Yarışma geçmişi</h3><div class="p-clist">' + list.map(function (e) {
      var dt = e.ts ? new Date(e.ts).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "";
      var place = e.rk ? (e.rk === 1 && e.f ? "🏆 1." : e.rk + ".") + (e.p ? " / " + e.p : "") : "-";
      return '<div class="p-crow' + (e.f && e.rk === 1 ? " win" : "") + '">' +
        '<div class="p-c1"><b>' + esc(e.nm || e.c) + '</b><small>' + esc(dt) + ' · ' + (e.ev === "222" ? "2x2" : "3x3") + ' · ' + (e.f ? "Final" : "Tur " + e.r) + '</small></div>' +
        '<div class="p-c2"><span class="p-place">' + esc(place) + '</span><span>Ao' + (e.n || 5) + ' <i dir="ltr">' + fmt(e.a) + '</i></span><span>Tekil <i dir="ltr">' + fmt(e.s) + '</i></span></div></div>';
    }).join("") + "</div>";
    return html;
  }
  function dailyGrid(st) {
    var dl = (st && st.dlist) || [];
    if (!dl.length) return '<p class="p-note">Henüz günlük çözüm yok.</p>';
    return '<div class="p-daily">' + dl.map(function (r) {
      var lbl = r.pen === "dnf" ? "DNF" : (fmt(r.t + (r.pen === "+2" ? 2000 : 0)) + (r.pen === "+2" ? "+" : ""));
      return '<div class="p-drow"><span>' + esc(r.d) + '</span><b dir="ltr">' + esc(lbl) + '</b></div>';
    }).join("") + "</div>";
  }
  function setsGrid(st) {
    var sets = (st && st.sets) || {}, ids = Object.keys(sets);
    if (!ids.length) return '<p class="p-note">Henüz işaretlenmiş case yok.</p>';
    return '<div class="p-sets">' + ids.map(function (id) {
      var s = sets[id], tot = s.t || (s.k + s.l) || 1, kp = Math.min(100, Math.round(100 * s.k / tot)), lp = Math.min(100 - kp, Math.round(100 * s.l / tot));
      return '<div class="p-set"><div class="p-set-top"><b>' + esc(SET_LABELS[id] || id) + '</b><span>' + s.k + (s.t ? " / " + s.t : "") + ' biliyorum</span></div>' +
        '<div class="p-bar"><i style="width:' + kp + '%"></i><i class="l" style="width:' + lp + '%"></i></div></div>';
    }).join("") + "</div>";
  }

  function renderShared(uid, data, isMe) {
    if (!data) { root.innerHTML = '<div class="box"><h1 style="font-size:24px;font-weight:900">Profil bulunamadı</h1><p class="p-note" style="margin-top:8px">Bu profil herkese açık değil ya da hiç giriş yapılmamış.</p></div>'; return; }
    var acc = (data.stats && data.stats.accent) || "", fav = (data.stats && data.stats.fav) || "";
    root.innerHTML =
      '<div class="box"><div class="p-head"><div class="p-ava"' + avaStyle(acc) + '>' + avatar(data.photo, data.name) + '</div>' +
      '<div class="p-id"><h1>' + esc(data.name) + '</h1>' + (data.bio ? '<div class="p-bio">' + esc(data.bio) + '</div>' : '') +
      (data.joined ? '<div class="p-meta">📅 ' + esc(dateStr(data.joined)) + '\'den beri üye</div>' : '') + favLine(fav) + '</div></div>' +
      (isMe ? '<div class="p-actions"><button class="p-btn" id="pShare">🔗 Paylaşım linkini kopyala</button><a class="p-btn" href="/icerikler/profil">← Kendi panona dön</a></div><div class="p-msg" id="pMsg"></div>' : '') +
      '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İstatistikler</h2>' + statTiles(data.stats) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">🏠 Ev yarışması</h2>' + compGrid(data.stats) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İlerleme</h2>' + setsGrid(data.stats) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">📅 Günlük çözümler</h2>' + dailyGrid(data.stats) + '</div>';
    showRole(uid);
    if (isMe) bindShare(uid);
  }

  function bindShare(uid) {
    var b = $("pShare"); if (!b) return;
    b.onclick = function () {
      var url = location.origin + "/icerikler/profil?u=" + encodeURIComponent(uid);
      var done = function () { var m = $("pMsg"); if (m) { m.textContent = "Link kopyalandı ✓"; setTimeout(function () { m.textContent = ""; }, 2500); } };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt("Linki kopyala:", url); });
      else prompt("Linki kopyala:", url);
    };
  }

  function renderOwn() {
    var u = window.Account.user(), prof = window.Account.localProfile(), st = window.Account.computeStats();
    // Paylaşım linki çalışsın diye herkese açık profil dokümanının yazıldığından emin ol
    if (window.Account.writeProfile) window.Account.writeProfile();
    var name = prof.name || (u && u.displayName) || (u && (u.email || "").split("@")[0]) || "Cuber";
    root.innerHTML =
      '<div class="box"><div class="p-head"><div class="p-ava"' + avaStyle(prof.accent) + '>' + avatar(u && u.photoURL, name) + '</div>' +
      '<div class="p-id"><h1>' + esc(name) + '</h1>' + (prof.bio ? '<div class="p-bio">' + esc(prof.bio) + '</div>' : '') +
      '<div class="p-meta">' + esc((u && u.email) || "") + '</div>' + favLine(prof.fav) + '</div></div>' +
      '<div class="p-actions">' +
      '<button class="p-btn main" id="pShare">🔗 Profilimi paylaş</button>' +
      '<a class="p-btn" id="pView" href="/icerikler/profil?u=' + encodeURIComponent(u.uid) + '">👁 Herkese açık halini gör</a>' +
      '<button class="p-btn" id="pEdit">✎ Düzenle</button>' +
      '<button class="p-btn" id="pOut">Çıkış yap</button>' +
      '<button class="p-btn danger" id="pDel">Hesabı sil</button>' +
      (window.Account.isAdmin && window.Account.isAdmin() ? '<a class="p-btn" href="/icerikler/admin">🛠 Yönetim paneli</a>' : '') +
      '</div><div class="p-msg" id="pMsg"></div>' +
      '<div id="pEditBox" hidden><div class="p-edit">' +
      '<div class="p-fld"><label>Profil fotoğrafı</label><div class="p-photo"><div class="p-ava sm" id="pPhotoPrev">' + avatar((prof.photo || (u && u.photoURL)), name) + '</div>' +
      '<label class="p-btn" for="pPhoto">📷 Yükle</label><input type="file" id="pPhoto" accept="image/*" hidden>' +
      '<button type="button" class="p-btn" id="pPhotoClear">Kaldır</button></div><div class="p-msg" id="pPhotoMsg"></div></div>' +
      '<input id="pName" maxlength="24" placeholder="Görünen ad" value="' + esc(name) + '">' +
      '<textarea id="pBio" maxlength="160" placeholder="Kısa bio (opsiyonel)">' + esc(prof.bio || "") + '</textarea>' +
      '<div class="p-fld"><label>Vurgu rengi</label><div class="p-accents" id="pAccents">' +
      ACCENTS.map(function (a) { return '<button type="button" class="p-acc' + ((prof.accent || "") === a[0] ? ' on' : '') + '" data-acc="' + a[0] + '" title="' + a[1] + '" style="background:' + (a[0] || "var(--border)") + '"></button>'; }).join("") + '</div></div>' +
      '<div class="p-fld"><label>Favori küp</label><select id="pFav">' + CUBES.map(function (c) { return '<option value="' + c + '"' + ((prof.fav || "") === c ? ' selected' : '') + '>' + (c || "— Yok —") + '</option>'; }).join("") + '</select></div>' +
      '<button class="p-btn main" id="pSave" style="justify-self:start">Kaydet</button></div></div>' +
      '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İstatistiklerim</h2>' + statTiles(st) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İlerlemem</h2>' + setsGrid(st) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">📅 Günlük çözümlerim</h2>' + dailyGrid(st) + '</div>';

    showRole(u.uid);
    bindShare(u.uid);
    $("pEdit").onclick = function () { var e = $("pEditBox"); e.hidden = !e.hidden; };
    var pickedAcc = prof.accent || "", pickedPhoto = prof.photo || "", photoChanged = false;
    if ($("pAccents")) Array.prototype.forEach.call($("pAccents").querySelectorAll(".p-acc"), function (b) {
      b.onclick = function () { pickedAcc = b.getAttribute("data-acc"); Array.prototype.forEach.call($("pAccents").querySelectorAll(".p-acc"), function (x) { x.classList.toggle("on", x === b); }); };
    });
    if ($("pPhoto")) $("pPhoto").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var pm = $("pPhotoMsg"); if (pm) pm.textContent = "İşleniyor…";
      downscalePhoto(f, function (data) {
        if (!data) { if (pm) pm.textContent = "Görsel işlenemedi."; return; }
        pickedPhoto = data; photoChanged = true;
        var pv = $("pPhotoPrev"); if (pv) pv.innerHTML = '<img src="' + data + '" alt="">';
        if (pm) pm.textContent = "Hazır — Kaydet'e bas.";
      });
    };
    if ($("pPhotoClear")) $("pPhotoClear").onclick = function () {
      pickedPhoto = ""; photoChanged = true;
      var pv = $("pPhotoPrev"); if (pv) pv.innerHTML = avatar((u && u.photoURL), name);
      var pm = $("pPhotoMsg"); if (pm) pm.textContent = "Fotoğraf kaldırıldı — Kaydet'e bas.";
    };
    $("pSave").onclick = function () {
      var nm = $("pName").value.trim().slice(0, 24) || name, bio = $("pBio").value.trim().slice(0, 160);
      var upd = { name: nm, bio: bio, accent: pickedAcc, fav: $("pFav").value };
      if (photoChanged) upd.photo = pickedPhoto;
      window.Account.setProfile(upd);
      var m = $("pMsg"); if (m) { m.textContent = "Kaydedildi ✓"; setTimeout(function () { m.textContent = ""; }, 2500); }
      setTimeout(renderOwn, 300);
    };
    $("pOut").onclick = function () { window.Account.signOut(); };
    $("pDel").onclick = function () { if (confirm("Hesabın ve buluttaki verilerin kalıcı olarak silinsin mi?")) window.Account.deleteAccount(); };
  }

  function renderSignin() {
    root.innerHTML = '<div class="box p-signin"><h1 style="font-size:26px;font-weight:900;margin-bottom:6px">Profilim</h1>' +
      '<p>İlerlemeni (bildiğin case\'ler, trainer istatistikleri, günlük çözümler) her cihazda görmek ve paylaşılabilir profilin olması için giriş yap.</p>' +
      '<button class="p-btn main" id="pLogin" style="margin:auto">👤 Giriş yap / Kayıt ol</button></div>';
    var b = $("pLogin"); if (b) b.onclick = function () { if (window.Account) window.Account.openLogin(); };
  }

  function start() {
    if (!window.Account || !window.Account.enabled()) {
      root.innerHTML = '<div class="box"><p class="p-note">Hesap sistemi şu an kullanılamıyor.</p></div>'; return;
    }
    var sharedUid = new URLSearchParams(location.search).get("u");
    if (sharedUid) {
      // başka kişinin (ya da kendi herkese açık) profili
      window.Account.onChange(function () {});
      window.Account.getProfile(sharedUid).then(function (data) {
        var me = window.Account.uid();
        renderShared(sharedUid, data, !!me && me === sharedUid);
      });
      // kendi profilimiz olabilir: oturum yüklensin ki "isMe" doğru çıksın
      if (window.Account.isPending()) window.Account.load();
      return;
    }
    // kendi panomuz
    window.Account.onChange(function (u) { if (u) renderOwn(); else renderSignin(); });
    if (window.Account.user()) renderOwn();
    else if (window.Account.isPending()) { root.innerHTML = '<div class="box"><p class="p-note">Yükleniyor…</p></div>'; window.Account.load(); }
    else renderSignin();
  }
  if (document.readyState !== "loading") start(); else document.addEventListener("DOMContentLoaded", start);
})();
