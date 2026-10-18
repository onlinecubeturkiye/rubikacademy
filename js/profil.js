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
  var SET_LABELS = { oll: "OLL", pll: "PLL", "2look-2lo": "2-Look OLL", "2look-2lp": "2-Look PLL", f2l: "F2L", coll: "COLL", wv: "WV", cll: "CLL", eg1: "EG-1", eg2: "EG-2", "ortega-oll": "Ortega OLL", "ortega-pbl": "Ortega PBL", "roux-cmll": "Roux CMLL" };
  function initials(n) { n = (n || "?").trim().split(/\s+/); return ((n[0] || "?")[0] + (n[1] ? n[1][0] : "")).toUpperCase(); }
  function avatar(photo, name) { return photo ? '<img src="' + esc(photo) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(name)); }
  function dateStr(ms) { if (!ms) return ""; try { return new Date(ms).toLocaleDateString("tr-TR", { year: "numeric", month: "long" }); } catch (e) { return ""; } }
  function roleBadge(role) {
    if (role === "gelistirici") return '<span class="p-badge dev">Geliştirici</span>';
    if (role === "tester") return '<span class="p-badge test">Tester</span>';
    return "";
  }
  function showRole(uid) {
    if (!window.Account.getRole) return;
    window.Account.getRole(uid).then(function (role) {
      var h = $("profRoot") && $("profRoot").querySelector("h1");
      if (h && role && role !== "uye" && !h.querySelector(".p-badge")) h.insertAdjacentHTML("beforeend", " " + roleBadge(role));
    });
  }

  function statTiles(st) {
    st = st || {};
    var rows = [["Bilinen case", st.known || 0], ["Öğrenilen", st.learning || 0], ["Trainer çözüm", st.solves || 0], ["Günlük en iyi", fmt(st.best)], ["Günlük gün", st.daily || 0]];
    return '<div class="stat-tiles">' + rows.map(function (r) { return '<div class="stat-tile"><b>' + esc(r[1]) + "</b><span>" + r[0] + "</span></div>"; }).join("") + "</div>";
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
    root.innerHTML =
      '<div class="box"><div class="p-head"><div class="p-ava">' + avatar(data.photo, data.name) + '</div>' +
      '<div class="p-id"><h1>' + esc(data.name) + '</h1>' + (data.bio ? '<div class="p-bio">' + esc(data.bio) + '</div>' : '') +
      (data.joined ? '<div class="p-meta">📅 ' + esc(dateStr(data.joined)) + '\'den beri üye</div>' : '') + '</div></div>' +
      (isMe ? '<div class="p-actions"><button class="p-btn" id="pShare">🔗 Paylaşım linkini kopyala</button><a class="p-btn" href="/icerikler/profil">← Kendi panona dön</a></div><div class="p-msg" id="pMsg"></div>' : '') +
      '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İstatistikler</h2>' + statTiles(data.stats) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İlerleme</h2>' + setsGrid(data.stats) + '</div>';
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
      '<div class="box"><div class="p-head"><div class="p-ava">' + avatar(u && u.photoURL, name) + '</div>' +
      '<div class="p-id"><h1>' + esc(name) + '</h1>' + (prof.bio ? '<div class="p-bio">' + esc(prof.bio) + '</div>' : '') +
      '<div class="p-meta">' + esc((u && u.email) || "") + '</div></div></div>' +
      '<div class="p-actions">' +
      '<button class="p-btn main" id="pShare">🔗 Profilimi paylaş</button>' +
      '<a class="p-btn" id="pView" href="/icerikler/profil?u=' + encodeURIComponent(u.uid) + '">👁 Herkese açık halini gör</a>' +
      '<button class="p-btn" id="pEdit">✎ Düzenle</button>' +
      '<button class="p-btn" id="pOut">Çıkış yap</button>' +
      '<button class="p-btn danger" id="pDel">Hesabı sil</button>' +
      (window.Account.isAdmin && window.Account.isAdmin() ? '<a class="p-btn" href="/icerikler/admin">🛠 Yönetim paneli</a>' : '') +
      '</div><div class="p-msg" id="pMsg"></div>' +
      '<div id="pEditBox" hidden><div class="p-edit">' +
      '<input id="pName" maxlength="24" placeholder="Görünen ad" value="' + esc(name) + '">' +
      '<textarea id="pBio" maxlength="160" placeholder="Kısa bio (opsiyonel)">' + esc(prof.bio || "") + '</textarea>' +
      '<button class="p-btn main" id="pSave" style="justify-self:start">Kaydet</button></div></div>' +
      '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İstatistiklerim</h2>' + statTiles(st) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İlerlemem</h2>' + setsGrid(st) + '</div>';

    showRole(u.uid);
    bindShare(u.uid);
    $("pEdit").onclick = function () { var e = $("pEditBox"); e.hidden = !e.hidden; };
    $("pSave").onclick = function () {
      var nm = $("pName").value.trim().slice(0, 24) || name, bio = $("pBio").value.trim().slice(0, 160);
      window.Account.setProfile({ name: nm, bio: bio });
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
