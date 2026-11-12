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
  var SUPPORT_MAIL = "rubikacademy.iletisim@gmail.com"; // sitede yayımlanan iletişim adresi (ana sayfa)
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
    if (role === "admin") return '<span class="p-badge adm">🛡 Admin</span>';
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
  function compGrid(st, isMe, myName) {
    var c = st && st.comp;
    if (!c) return '<p class="p-note">Henüz ev yarışmasına katılmadı.</p>';
    var tiles = [["Oda", c.rooms || 0], ["Tur", c.rounds || 0], ["Final", c.finals || 0], ["🏆 Şampiyonluk", c.wins || 0]];
    var html = '<div class="stat-tiles">' + tiles.map(function (r) { return '<div class="stat-tile"><b>' + esc(r[1]) + "</b><span>" + r[0] + "</span></div>"; }).join("") + "</div>";
    var evs = [["333", "3x3"], ["222", "2x2"]].filter(function (e) { return c.pb && c.pb[e[0]]; });
    if (evs.length) html += '<div class="p-pb">' + evs.map(function (e) {
      var pb = c.pb[e[0]];
      return '<div class="p-pb-row"><b>' + e[1] + '</b><span>Tekil <i dir="ltr">' + fmt(pb.s) + '</i></span><span>Ao5 <i dir="ltr">' + fmt(pb.a5) + '</i></span><span>Ao12 <i dir="ltr">' + fmt(pb.a12) + '</i></span></div>';
    }).join("") + "</div>";
    html += '<p class="p-note" style="margin-top:10px"><a href="/icerikler/rekorlar" style="color:var(--ui-accent);font-weight:800">🥇 Rekor tablosu →</a></p>';
    var list = c.list || [], groups = groupComps(list);
    // Sertifikalar: final ilk 3 (yalnız kendi profilinde indirilebilir; başkasının profilinde rozet olarak görünür)
    var certs = groups.map(function (g) { var f = g.rounds.filter(function (e) { return e.f && !e.pd && e.rk >= 1 && e.rk <= 3; })[0]; return f ? { g: g, e: f } : null; }).filter(Boolean);
    html += '<h3 class="p-sub">🎓 ' + (isMe ? "Sertifikalarım" : "Sertifikalar") + '</h3>' + (certs.length ? '<div class="p-certs">' + certs.map(function (x) {
      var o = { name: myName || "", comp: x.g.nm || x.g.c, ev: x.e.ev, place: x.e.rk, a: x.e.a, n: x.e.n || 5, ts: x.e.ts };
      return '<div class="p-cert p' + x.e.rk + '"><span class="p-cert-m">' + ["🥇", "🥈", "🥉"][x.e.rk - 1] + '</span><span class="p-cert-t"><b>' + esc(o.comp) + '</b><small>' + (x.e.ev === "222" ? "2x2" : "3x3") + ' finali · ' + x.e.rk + '. · Ao' + o.n + ' ' + fmt(o.a) + '</small></span>' +
        (isMe && window.RACompShare ? '<button type="button" class="p-btn sm" data-cert="' + encodeURIComponent(JSON.stringify(o)) + '">İndir</button>' : '') + '</div>';
    }).join("") + '</div>' : '<p class="p-note">' + (isMe ? "Bir ev yarışmasının finalinde ilk 3'e girince sertifikan burada çıkar." : "Henüz final derecesi yok.") + '</p>');
    if (list.length) html += progressChart(list.filter(function (e) { return !e.pd; })) + '<h3 class="p-sub">Yarışma geçmişi</h3><div class="p-clist">' + groups.map(function (g) {
      var dt = g.ts ? new Date(g.ts).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "";
      var fin = g.rounds.filter(function (e) { return e.f; })[0], last = fin || g.rounds[g.rounds.length - 1];
      var bestS = null; g.rounds.forEach(function (e) { if (typeof e.s === "number" && (bestS == null || e.s < bestS)) bestS = e.s; });
      // sıra rozeti: final derecesi ya da (final yoksa) son turdaki sıra
      var place = fin ? (fin.rk === 1 ? '<span class="p-badge gold">🏆 Şampiyon</span>' : fin.rk <= 3 ? '<span class="p-badge ' + (fin.rk === 2 ? "silver" : "bronze") + '">' + ["", "🥈", "🥉"][fin.rk - 1] + ' Final ' + fin.rk + '.</span>' : '<span class="p-badge">Final ' + fin.rk + '.' + (fin.p ? ' / ' + fin.p : '') + '</span>')
        : last && last.rk ? '<span class="p-badge">Tur ' + last.r + ' · ' + last.rk + '.' + (last.p ? ' / ' + last.p : '') + '</span>' : '<span class="p-badge">—</span>';
      var rounds = g.rounds.map(function (e) {
        var ts = Array.isArray(e.t) && e.t.length ? ' <span class="p-ctimes" dir="ltr">' + e.t.map(function (x) { return '<span class="' + (x < 0 ? "dnf" : x === e.s ? "pb" : "") + '">' + (x < 0 ? "DNF" : fmt(x)) + '</span>'; }).join("") + '</span>' : '';
        return '<div class="p-rnd"><b>' + (e.f ? "Final" : "Tur " + e.r) + '</b><span>' + (e.rk ? e.rk + "." + (e.p ? "/" + e.p : "") : "-") + '</span><span>Ao' + (e.n || 5) + ' <i dir="ltr">' + fmt(e.a) + '</i></span>' + ts + '</div>';
      }).join("");
      var pend = g.rounds.some(function (e) { return e.pd; });
      return '<div class="p-comp' + (fin && fin.rk === 1 && !pend ? " win" : "") + '"><div class="p-comp-h"><div class="p-c1"><b>' + esc(g.nm || g.c) + (pend ? ' <span class="p-pend" title="Yönetici süreleri kontrol edince rekorlara ve sertifikalara işlenir">⏳ Onay bekliyor</span>' : '') + '</b><small>' + esc(dt) + ' · ' + (g.ev === "222" ? "2x2" : "3x3") + ' · ' + g.rounds.length + ' tur</small></div>' +
        '<div class="p-comp-s">' + place + '<span>En iyi Ao <i dir="ltr">' + fmt(g.bestA) + '</i></span><span>Tekil <i dir="ltr">' + fmt(bestS) + '</i></span></div></div>' +
        '<details class="p-rnds"><summary>Turlar</summary>' + rounds + '</details></div>';
    }).join("") + "</div>";
    return html;
  }
  // Aynı yarışmanın turlarını bir arada göster (en yeni yarışma üstte, turlar sırayla)
  function groupComps(list) {
    var by = {}, out = [];
    list.forEach(function (e) {
      var g = by[e.c]; if (!g) { g = by[e.c] = { c: e.c, nm: e.nm, ev: e.ev, ts: 0, rounds: [], bestA: null }; out.push(g); }
      g.rounds.push(e); g.ts = Math.max(g.ts, e.ts || 0);
      if (typeof e.a === "number" && (g.bestA == null || e.a < g.bestA)) g.bestA = e.a;
    });
    out.forEach(function (g) { g.rounds.sort(function (a, b) { return (a.f - b.f) || (a.r - b.r); }); });
    return out.sort(function (a, b) { return b.ts - a.ts; });
  }
  // Gelişim grafiği: her turun ortalaması (eskiden yeniye); her küp türü kendi ölçeğinde ayrı grafik
  function progressChart(list) {
    var html = ["333", "222"].map(function (ev, k) {
      var pts = list.filter(function (e) { return (e.ev || "333") === ev && typeof e.a === "number" && e.ts; }).sort(function (a, b) { return a.ts - b.ts; });
      if (pts.length < 2) return "";
      var W = 640, H = 200, P = { l: 70, r: 14, t: 16, b: 30 };
      var ys = pts.map(function (e) { return e.a; }), lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      var pad = Math.max(300, (hi - lo) * 0.15); lo -= pad; hi += pad;
      var X = function (i) { return P.l + (W - P.l - P.r) * i / (pts.length - 1); };
      var Y = function (v) { return P.t + (H - P.t - P.b) * (1 - (v - lo) / (hi - lo)); };
      var grid = [0, 0.5, 1].map(function (f) { var v = lo + (hi - lo) * f, y = Y(v); return '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y + '" y2="' + y + '" class="g"/><text x="' + (P.l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt(v) + '</text>'; }).join("");
      var d = pts.map(function (e, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(e.a).toFixed(1); }).join(" ");
      var dots = pts.map(function (e, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(e.a).toFixed(1) + '" r="4.5" class="s' + k + '"><title>' + esc((e.nm || e.c) + " · " + (e.f ? "Final" : "Tur " + e.r) + " · Ao" + (e.n || 5) + " " + fmt(e.a)) + '</title></circle>'; }).join("");
      var dt = function (t) { return new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }); };
      var first = pts[0].a, last = pts[pts.length - 1].a, diff = first - last;
      var trend = Math.abs(diff) >= 50 ? (diff > 0 ? '<b class="up">▼ ' + fmt(diff) + ' hızlandın</b>' : '<b class="down">▲ ' + fmt(-diff) + ' yavaşladın</b>') : '<b>≈ aynı</b>';
      return '<div class="p-chart"><div class="p-chart-h"><span class="s' + k + '">' + (ev === "222" ? "2x2" : "3x3") + ' tur ortalaması</span>' + trend + '</div><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (ev === "222" ? "2x2" : "3x3") + ' tur ortalamalarının zamanla değişimi">' + grid +
        '<path d="' + d + '" class="s' + k + '"/>' + dots +
        '<text x="' + P.l + '" y="' + (H - 6) + '">' + dt(pts[0].ts) + '</text><text x="' + (W - P.r) + '" y="' + (H - 6) + '" text-anchor="end">' + dt(pts[pts.length - 1].ts) + '</text></svg></div>';
    }).join("");
    return html ? '<h3 class="p-sub">Gelişim <small style="font-weight:700;color:var(--text-soft)">(aşağı = daha hızlı)</small></h3><div class="p-charts">' + html + '</div>' : "";
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
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">🏠 Ev yarışması</h2>' + compGrid(data.stats, isMe, data.name) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İlerleme</h2>' + setsGrid(data.stats) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">📅 Günlük çözümler</h2>' + dailyGrid(data.stats) + '</div>' +
      (!isMe && window.RAReport ? '<p class="p-note" style="text-align:center;margin:4px 0 18px"><button class="p-btn sm" id="pReport">⚑ Bu profili şikayet et</button></p>' : '');
    showRole(uid);
    if (isMe) bindShare(uid);
    bindCerts();
    if ($("pReport")) $("pReport").onclick = function () { RAReport.open({ t: "user", tu: uid, tn: data.name || "", x: data.bio || "", ref: "users/" + uid }); };
  }

  function bindCerts() {
    Array.prototype.forEach.call(root.querySelectorAll("[data-cert]"), function (b) {
      b.onclick = function (e) {
        e.preventDefault(); var t = b.textContent; b.disabled = true; b.textContent = "Hazırlanıyor…";
        var done = function () { b.disabled = false; b.textContent = t; };
        try { RACompShare.downloadCert(JSON.parse(decodeURIComponent(b.getAttribute("data-cert")))).then(done, done); } catch (x) { done(); }
      };
    });
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
    var name = prof.name || (u && u.displayName) || (u && (u.email || "").split("@")[0]) || "Cuber";
    // ad başka yerde (ör. Küp Arena) belirlenmişse ilk yazımda yerel profile alınır → sayfayı onunla yenile
    if (window.Account.writeProfile) Promise.resolve(window.Account.writeProfile()).then(function () {
      var p2 = window.Account.localProfile();
      if ((p2.name || "") !== (prof.name || "") && p2.name && $("pEdit")) renderOwn();
    });
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
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">🏠 Ev yarışmalarım</h2>' + compGrid(st, true, name) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">İlerlemem</h2>' + setsGrid(st) + '</div>' +
      '<div class="box"><h2 style="font-size:19px;font-weight:850;margin-bottom:12px">📅 Günlük çözümlerim</h2>' + dailyGrid(st) + '</div>' + linksBox();

    showRole(u.uid);
    bindShare(u.uid);
    bindCerts();
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

  // Uygulama içi zorunlu bağlantılar (Google Play): ayarlar, gizlilik, koşullar, hesap silme, iletişim
  function linksBox() {
    var L = [["/ayarlar", "⚙️", "Ayarlar"], ["/gizlilik", "🔒", "Gizlilik politikası"], ["/kosullar", "📄", "Kullanım koşulları"], ["/hesap-silme", "🗑️", "Hesap ve veri silme"], ["mailto:" + SUPPORT_MAIL, "✉️", "İletişim: " + SUPPORT_MAIL]];
    return '<div class="box p-links">' + L.map(function (l) { return '<a href="' + l[0] + '"><span>' + l[1] + '</span>' + esc(l[2]) + '<i aria-hidden="true">›</i></a>'; }).join("") + '</div>';
  }
  function renderSignin() {
    root.innerHTML = '<div class="box p-signin"><h1 style="font-size:26px;font-weight:900;margin-bottom:6px">Profilim</h1>' +
      '<p>İlerlemeni (bildiğin case\'ler, trainer istatistikleri, günlük çözümler) her cihazda görmek ve paylaşılabilir profilin olması için giriş yap.</p>' +
      '<button class="p-btn main" id="pLogin" style="margin:auto">👤 Giriş yap / Kayıt ol</button></div>' + linksBox();
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
