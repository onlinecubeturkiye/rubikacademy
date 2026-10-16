/* =====================================================================
   ÖZEL TIMER (timer.js) — kişisel, sitede görünmeyen hız küpü zamanlayıcısı
   Referanslar: csTimer, CubeDesk, zktimer. Statik sitede çalışır, tüm veri
   yalnızca bu tarayıcıda (localStorage) tutulur.
   Bölümler: kapı(parola) · karıştırıcılar · NxN/3x3 görsel · istatistik ·
             oturumlar · zamanlayıcı+inceleme · arayüz · grafik · dışa/içe aktar
   ===================================================================== */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var DEFAULT_GATE = "49ac9e224a0f52d8bfe91b58d9e402765f8d96c2715c4a7e9d291da9df2d45ae"; // sha256("rubik-ozel")

  /* ---------------- PAROLA KAPISI ----------------
     Statik sitede gerçek sunucu kimlik doğrulaması yok; bu, adresi bilinmeyen
     sayfayı meraklı ziyaretçiden koruyan basit bir perde. Parola değişince hash
     localStorage'a yazılır; kilit "ra-timer-ok" ile hatırlanır. */
  function sha256(s) {
    var buf = new TextEncoder().encode(s);
    return crypto.subtle.digest("SHA-256", buf).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }
  function gateHash() { try { return localStorage.getItem("ra-timer-gate") || DEFAULT_GATE; } catch (e) { return DEFAULT_GATE; } }
  function unlocked() { try { return localStorage.getItem("ra-timer-ok") === "1"; } catch (e) { return false; } }
  function lock() { try { localStorage.removeItem("ra-timer-ok"); } catch (e) {} location.reload(); }

  /* ---------------- KARIŞTIRICILAR ---------------- */
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function rnd() { return Math.random(); }
  var SUF = ["", "'", "2"];
  // NxN: yüz + genişlik (w=1 dış katman, w>1 => "Nw"); aynı eksende ardışık hamle yok
  function scrNxN(n, len) {
    var faces = "URFDLB", out = [], lastAx = -1, lastAx2 = -1, maxW = Math.floor(n / 2);
    while (out.length < len) {
      var fi = Math.floor(rnd() * 6), ax = fi % 3;
      if (ax === lastAx) continue;
      var w = n <= 2 ? 1 : 1 + Math.floor(rnd() * maxW); // 1..maxW
      var mv = (w > 1 ? (w === 2 ? "" : w) + faces[fi] + "w" : faces[fi]) + SUF[Math.floor(rnd() * 3)];
      out.push(mv); lastAx2 = lastAx; lastAx = ax;
    }
    return out.join(" ");
  }
  function scr2(n, len) { // 2x2: yalnız U R F, daha doğal görünür
    var faces = "URF", out = [], last = -1;
    while (out.length < len) { var fi = Math.floor(rnd() * 3); if (fi === last) continue; out.push(faces[fi] + SUF[Math.floor(rnd() * 3)]); last = fi; }
    return out.join(" ");
  }
  function scrPyra() {
    var faces = "ULRB", out = [], last = -1, suf = ["", "'"];
    while (out.length < 10) { var fi = Math.floor(rnd() * 4); if (fi === last) continue; out.push(faces[fi] + suf[Math.floor(rnd() * 2)]); last = fi; }
    var tips = "ulrb".split("");
    tips.forEach(function (t) { var k = Math.floor(rnd() * 3); if (k) out.push(t + (k === 2 ? "'" : "")); });
    return out.join(" ");
  }
  function scrSkewb() {
    var faces = "ULRB", out = [], last = -1, suf = ["", "'"];
    while (out.length < 11) { var fi = Math.floor(rnd() * 4); if (fi === last) continue; out.push(faces[fi] + suf[Math.floor(rnd() * 2)]); last = fi; }
    return out.join(" ");
  }
  function scrMega() {
    var lines = [], pm = ["++", "--"];
    for (var L = 0; L < 7; L++) {
      var mv = [];
      for (var i = 0; i < 5; i++) { mv.push("R" + pm[Math.floor(rnd() * 2)]); mv.push("D" + pm[Math.floor(rnd() * 2)]); }
      mv.push(rnd() < 0.5 ? "U" : "U'");
      lines.push(mv.join(" "));
    }
    return lines.join("\n");
  }
  // Etkinlik tanımları
  var EVENTS = {
    "222": { name: "2x2", gen: function () { return scr2(2, 11); }, img: 2 },
    "333": { name: "3x3", gen: function () { return scrNxN(3, 20); }, img: 3 },
    "444": { name: "4x4", gen: function () { return scrNxN(4, 45); }, img: 4 },
    "555": { name: "5x5", gen: function () { return scrNxN(5, 60); }, img: 5 },
    "666": { name: "6x6", gen: function () { return scrNxN(6, 80); }, img: 6 },
    "777": { name: "7x7", gen: function () { return scrNxN(7, 100); }, img: 7 },
    "333oh": { name: "3x3 OH", gen: function () { return scrNxN(3, 20); }, img: 3 },
    "333bf": { name: "3x3 BLD", gen: function () { return scrNxN(3, 20); }, img: 3 },
    "333fm": { name: "3x3 FMC", gen: function () { return scrNxN(3, 25); }, img: 3 },
    "pyram": { name: "Pyraminx", gen: scrPyra, img: 0 },
    "skewb": { name: "Skewb", gen: scrSkewb, img: 0 },
    "mega": { name: "Megaminx", gen: scrMega, img: 0 }
  };
  var EVENT_ORDER = ["222", "333", "444", "555", "666", "777", "333oh", "333bf", "333fm", "pyram", "skewb", "mega"];

  /* ---------------- 3x3 GÖRSEL (cubejs ile) ---------------- */
  var NETCOL = { U: "#f4f4f6", R: "#d12d28", F: "#179e4f", D: "#f6c719", L: "#ff7a1a", B: "#2c6fe6" };
  var NET = [["U", 1, 0], ["L", 0, 1], ["F", 1, 1], ["R", 2, 1], ["B", 3, 1], ["D", 1, 2]];
  function draw333(alg) {
    if (typeof Cube === "undefined") return "";
    try {
      var c = new Cube(); c.move(alg.replace(/\n/g, " ")); var s = c.asString(), html = "";
      NET.forEach(function (nn) {
        var fi = "URFDLB".indexOf(nn[0]);
        html += '<div class="tn-f" style="grid-column:' + (nn[1] + 1) + ';grid-row:' + (nn[2] + 1) + '">';
        for (var i = 0; i < 9; i++) html += '<i style="background:' + NETCOL[s[fi * 9 + i]] + '"></i>';
        html += "</div>";
      });
      return html;
    } catch (e) { return ""; }
  }

  /* ---------------- İSTATİSTİK (WCA ortalamaları) ---------------- */
  function val(s) { return s.pen === "dnf" ? Infinity : s.t + (s.pen === "+2" ? 2000 : 0); }
  function best(solves) { var b = Infinity; solves.forEach(function (s) { var v = val(s); if (v < b) b = v; }); return b === Infinity ? null : b; }
  // Son n için ortalama: n>=5 trimli (en iyi+en kötü atılır, 2+ DNF => DNF), n==3 mean of 3 (DNF varsa yok)
  function avgOf(solves, n) {
    if (solves.length < n) return null;
    var w = solves.slice(-n).map(val);
    if (n < 5) { if (w.indexOf(Infinity) >= 0) return null; return w.reduce(function (a, b) { return a + b; }, 0) / n; }
    var dnf = w.filter(function (v) { return v === Infinity; }).length;
    if (dnf >= 2) return Infinity;
    var sorted = w.slice().sort(function (a, b) { return a - b; });
    var trimmed = sorted.slice(1, sorted.length - 1); // en iyi + en kötü at
    return trimmed.reduce(function (a, b) { return a + b; }, 0) / trimmed.length;
  }
  function sessionMean(solves) {
    var vs = solves.map(val).filter(function (v) { return v !== Infinity; });
    if (!vs.length) return null;
    return vs.reduce(function (a, b) { return a + b; }, 0) / vs.length;
  }

  /* ---------------- BİÇİM ---------------- */
  function fmt(ms) {
    if (ms == null) return "—";
    if (ms === Infinity) return "DNF";
    var s = ms / 1000;
    if (s < 60) return s.toFixed(2);
    var m = Math.floor(s / 60); s -= m * 60;
    if (m < 60) return m + ":" + s.toFixed(2).padStart(5, "0");
    var h = Math.floor(m / 60); m -= h * 60;
    return h + ":" + String(m).padStart(2, "0") + ":" + s.toFixed(2).padStart(5, "0");
  }
  function fmtSolve(s) { return s.pen === "dnf" ? "DNF" + (s.t ? "(" + fmt(s.t) + ")" : "") : fmt(s.t) + (s.pen === "+2" ? "+" : ""); }

  /* ---------------- DEPOLAMA (oturumlar) ---------------- */
  var DB_KEY = "ra-timer-v1";
  var db = { sessions: [], cur: 0, settings: { insp: true, hold: 300, hideTime: false, img: true } };
  function load() {
    try { var d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && d.sessions) db = d; } catch (e) {}
    if (!db.sessions.length) db.sessions = [{ name: "Oturum 1", event: "333", solves: [] }];
    if (db.cur >= db.sessions.length) db.cur = 0;
    if (!db.settings) db.settings = { insp: true, hold: 300, hideTime: false, img: true };
  }
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) {} }
  function sess() { return db.sessions[db.cur]; }
  function ev() { return EVENTS[sess().event] || EVENTS["333"]; }

  /* ---------------- ZAMANLAYICI DURUMU ---------------- */
  var state = "idle", t0 = 0, raf = 0, holdTimer = 0, pending = null, curScr = "";
  var insp = { on: false, start: 0, iv: 0, pen: "" };
  function newScramble() { curScr = ev().gen(); renderScramble(); }
  function showTime(ms) { $("tTime").textContent = db.settings.hideTime && state === "running" ? "çözülüyor…" : fmt(ms); }
  function setState(s) { state = s; $("tStage").setAttribute("data-state", s); updateHint(); }
  function updateHint() {
    var h = { idle: "Boşluk/dokun → bekle · bırak → başla", hold: "Biraz daha tut…", ready: "Bırak → başla!", running: "Boşluk/dokun → dur", done: "Yeni karıştırma hazır" };
    var insH = insp.on ? "İnceleme: " + Math.max(0, 15 - Math.floor((performance.now() - insp.start) / 1000)) + " sn — başlamak için tut/bırak" : "";
    $("tHint").textContent = insp.on ? insH : (h[state] || "");
  }
  function tick() { showTime(performance.now() - t0); raf = requestAnimationFrame(tick); }

  function startInspection() {
    insp.on = true; insp.start = performance.now(); insp.pen = ""; setState("idle"); showTime(0);
    $("tStage").setAttribute("data-insp", "1");
    insp.iv = setInterval(function () {
      var el = (performance.now() - insp.start) / 1000;
      if (el >= 17) insp.pen = "dnf"; else if (el >= 15) insp.pen = "+2";
      $("tTime").textContent = insp.pen === "dnf" ? "DNF" : insp.pen === "+2" ? "+2" : String(Math.ceil(15 - el));
      $("tStage").setAttribute("data-warn", el >= 12 ? "2" : el >= 8 ? "1" : "0");
    }, 50);
  }
  function stopInspection() { clearInterval(insp.iv); insp.on = false; $("tStage").removeAttribute("data-insp"); $("tStage").removeAttribute("data-warn"); }

  function press() {
    if (state === "running") { stopSolve(); return; }
    if (state === "done") return;
    if (db.settings.insp && !insp.on && state === "idle") { startInspection(); return; }
    // inceleme sırasında ya da inceleme kapalıyken: tut
    setState("hold"); if (!insp.on) showTime(0);
    holdTimer = setTimeout(function () { if (state === "hold") setState("ready"); }, db.settings.hold);
  }
  function release() {
    if (state === "hold") { clearTimeout(holdTimer); setState(insp.on ? "idle" : "idle"); if (insp.on) updateHint(); return; }
    if (state === "ready") { beginSolve(); }
  }
  function beginSolve() { stopInspection(); setState("running"); t0 = performance.now(); tick(); }
  function stopSolve() {
    cancelAnimationFrame(raf); var el = performance.now() - t0; showTime(el);
    var s = { t: Math.round(el), pen: insp.pen || "", scr: curScr, ts: Date.now(), note: "" };
    insp.pen = ""; sess().solves.push(s); save(); renderAll();
    setState("idle"); newScramble();
  }

  /* ---------------- GİRDİ (klavye + dokunmatik) ---------------- */
  function onKeyDown(e) {
    if (gateOpen) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); if (!spaceDown) { spaceDown = true; press(); } }
  }
  function onKeyUp(e) {
    if (gateOpen) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); spaceDown = false; release(); }
  }
  var spaceDown = false;
  function bindTouch() {
    var pad = $("tStage");
    pad.addEventListener("touchstart", function (e) { e.preventDefault(); press(); }, { passive: false });
    pad.addEventListener("touchend", function (e) { e.preventDefault(); release(); }, { passive: false });
    pad.addEventListener("mousedown", function (e) { if (e.button === 0 && !isTouch) press(); });
    pad.addEventListener("mouseup", function (e) { if (e.button === 0 && !isTouch) release(); });
  }
  var isTouch = false;
  window.addEventListener("touchstart", function () { isTouch = true; }, { once: true });

  /* ---------------- ARAYÜZ ---------------- */
  function renderScramble() {
    $("tScramble").textContent = curScr;
    var img = db.settings.img && ev().img === 3 ? draw333(curScr) : "";
    $("tImg").innerHTML = img;
    $("tImg").style.display = img ? "" : "none";
  }
  function renderStats() {
    var sv = sess().solves;
    var rows = [
      ["Sayı", String(sv.length)],
      ["En iyi", fmt(best(sv))],
      ["ao5", fmt(avgOf(sv, 5))],
      ["ao12", fmt(avgOf(sv, 12))],
      ["ao50", fmt(avgOf(sv, 50))],
      ["ao100", fmt(avgOf(sv, 100))],
      ["mo3", fmt(avgOf(sv, 3))],
      ["Oturum ort.", fmt(sessionMean(sv))]
    ];
    $("tStats").innerHTML = rows.map(function (r) {
      return '<div class="tst"><span>' + r[0] + '</span><b>' + r[1] + "</b></div>";
    }).join("");
  }
  function renderList() {
    var sv = sess().solves, html = "";
    for (var i = sv.length - 1; i >= 0; i--) {
      var s = sv[i];
      html += '<li data-i="' + i + '"><span class="tli-n">' + (i + 1) + '</span><span class="tli-t' + (s.pen === "dnf" ? " dnf" : "") + '">' + esc(fmtSolve(s)) + "</span>" + (s.note ? '<span class="tli-c">✎</span>' : "") + "</li>";
    }
    $("tList").innerHTML = html || '<li class="tli-empty">Henüz çözüm yok</li>';
  }
  function renderSessions() {
    $("tSessSel").innerHTML = db.sessions.map(function (s, i) {
      return '<option value="' + i + '"' + (i === db.cur ? " selected" : "") + ">" + esc(s.name) + " · " + (EVENTS[s.event] || {}).name + " (" + s.solves.length + ")</option>";
    }).join("");
    $("tEventSel").value = sess().event;
  }
  function renderAll() { renderStats(); renderList(); renderSessions(); drawGraph(); }

  /* ---------------- ÇÖZÜM DÜZENLE (modal) ---------------- */
  function openSolve(i) {
    var sv = sess().solves, s = sv[i]; if (!s) return;
    var box = $("tModal");
    box.querySelector("#tmTitle").textContent = "Çözüm #" + (i + 1) + " · " + fmtSolve(s);
    box.querySelector("#tmScr").textContent = s.scr || "";
    box.querySelector("#tmNote").value = s.note || "";
    box.setAttribute("data-i", i);
    box.hidden = false;
  }
  function solveAction(act) {
    var box = $("tModal"), i = +box.getAttribute("data-i"), sv = sess().solves, s = sv[i]; if (!s) return;
    if (act === "+2") s.pen = s.pen === "+2" ? "" : "+2";
    else if (act === "dnf") s.pen = s.pen === "dnf" ? "" : "dnf";
    else if (act === "del") { sv.splice(i, 1); box.hidden = true; save(); renderAll(); return; }
    else if (act === "note") { s.note = box.querySelector("#tmNote").value.slice(0, 500); }
    box.querySelector("#tmTitle").textContent = "Çözüm #" + (i + 1) + " · " + fmtSolve(s);
    save(); renderAll();
  }

  /* ---------------- GRAFİK (tek seri çizgi + en iyi işaret) ---------------- */
  function drawGraph() {
    var svg = $("tGraph"), sv = sess().solves.map(val).map(function (v) { return v === Infinity ? null : v; });
    var pts = sv.map(function (v, i) { return { i: i, v: v }; }).filter(function (p) { return p.v != null; });
    var W = 640, H = 180, PL = 8, PR = 8, PT = 12, PB = 14;
    if (pts.length < 2) { svg.innerHTML = '<text x="' + (W / 2) + '" y="' + (H / 2) + '" fill="var(--t-muted)" font-size="13" text-anchor="middle">Grafik için en az 2 çözüm gerekir</text>'; svg.setAttribute("viewBox", "0 0 " + W + " " + H); return; }
    var vals = pts.map(function (p) { return p.v; }), mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mx === mn) mx = mn + 1;
    var n = pts.length;
    var x = function (k) { return PL + (W - PL - PR) * (n === 1 ? 0.5 : pts[k].i / (sess().solves.length - 1 || 1)); };
    var y = function (v) { return PT + (H - PT - PB) * (1 - (v - mn) / (mx - mn)); };
    var d = "", bi = 0;
    pts.forEach(function (p, k) { d += (k ? "L" : "M") + x(k).toFixed(1) + " " + y(p.v).toFixed(1) + " "; if (p.v === mn) bi = k; });
    // yatay ızgara (3 çizgi)
    var grid = "";
    for (var g = 0; g <= 2; g++) { var gy = PT + (H - PT - PB) * g / 2; grid += '<line x1="' + PL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + gy.toFixed(1) + '" stroke="var(--t-border)" stroke-width="1"/>'; }
    var labTop = '<text x="' + (W - PR) + '" y="' + (PT + 4) + '" fill="var(--t-muted)" font-size="11" text-anchor="end">' + fmt(mx) + "</text>";
    var labBot = '<text x="' + (W - PR) + '" y="' + (H - PB + 11) + '" fill="var(--t-muted)" font-size="11" text-anchor="end">' + fmt(mn) + "</text>";
    var bx = x(bi), by = y(pts[bi].v);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = grid + labTop + labBot +
      '<path d="' + d.trim() + '" fill="none" stroke="var(--t-accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="4" fill="var(--t-accent)" stroke="var(--t-surface)" stroke-width="2"/>' +
      '<text x="' + bx.toFixed(1) + '" y="' + Math.max(10, by - 8).toFixed(1) + '" fill="var(--t-text)" font-size="11" font-weight="700" text-anchor="middle">PB ' + fmt(mn) + "</text>";
  }

  /* ---------------- DIŞA / İÇE AKTAR ---------------- */
  function exportJSON() {
    var blob = new Blob([JSON.stringify(db, null, 0)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "ra-timer-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function importJSON(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try { var d = JSON.parse(fr.result); if (!d.sessions) throw 0; db = d; if (!db.settings) db.settings = { insp: true, hold: 300, hideTime: false, img: true }; db.cur = 0; save(); applySettings(); newScramble(); renderAll(); alert("İçe aktarıldı."); }
      catch (e) { alert("Dosya okunamadı."); }
    };
    fr.readAsText(file);
  }

  /* ---------------- AYARLAR ---------------- */
  function applySettings() {
    $("tSetInsp").checked = db.settings.insp;
    $("tSetHold").value = db.settings.hold;
    $("tSetHide").checked = db.settings.hideTime;
    $("tSetImg").checked = db.settings.img;
  }

  /* ---------------- BAĞLAMA ---------------- */
  var gateOpen = true;
  function initUI() {
    load(); applySettings(); newScramble(); renderAll();
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    bindTouch();

    $("tEventSel").onchange = function () { sess().event = this.value; save(); newScramble(); renderAll(); };
    $("tSessSel").onchange = function () { db.cur = +this.value; save(); newScramble(); renderAll(); };
    $("tNewScr").onclick = function () { newScramble(); };
    $("tSessNew").onclick = function () { db.sessions.push({ name: "Oturum " + (db.sessions.length + 1), event: sess().event, solves: [] }); db.cur = db.sessions.length - 1; save(); newScramble(); renderAll(); };
    $("tSessRen").onclick = function () { var nm = prompt("Oturum adı:", sess().name); if (nm) { sess().name = nm.slice(0, 40); save(); renderSessions(); } };
    $("tSessClear").onclick = function () { if (confirm("Bu oturumdaki tüm çözümler silinsin mi?")) { sess().solves = []; save(); renderAll(); } };
    $("tSessDel").onclick = function () { if (db.sessions.length < 2) { alert("Son oturum silinemez."); return; } if (confirm("Oturum silinsin mi?")) { db.sessions.splice(db.cur, 1); db.cur = 0; save(); newScramble(); renderAll(); } };

    $("tList").onclick = function (e) { var li = e.target.closest("li[data-i]"); if (li) openSolve(+li.getAttribute("data-i")); };
    $("tModal").querySelector("#tmClose").onclick = function () { $("tModal").hidden = true; };
    $("tModal").addEventListener("click", function (e) { if (e.target.id === "tModal") $("tModal").hidden = true; });
    ["+2", "dnf", "del", "note"].forEach(function (a) { $("tm_" + a).onclick = function () { solveAction(a); }; });

    $("tSetInsp").onchange = function () { db.settings.insp = this.checked; save(); };
    $("tSetHold").onchange = function () { db.settings.hold = Math.max(0, Math.min(1000, +this.value || 0)); save(); };
    $("tSetHide").onchange = function () { db.settings.hideTime = this.checked; save(); };
    $("tSetImg").onchange = function () { db.settings.img = this.checked; save(); renderScramble(); };
    $("tExport").onclick = exportJSON;
    $("tImport").onchange = function () { if (this.files[0]) importJSON(this.files[0]); this.value = ""; };
    $("tLock").onclick = lock;
    $("tPwChange").onclick = function () {
      var p = prompt("Yeni parola (bu cihazda ve adresi bilenlerde geçerli):"); if (!p) return;
      sha256(p).then(function (h) { try { localStorage.setItem("ra-timer-gate", h); } catch (e) {} alert("Parola güncellendi."); });
    };
    $("tTheme").onclick = function () {
      var dark = !document.documentElement.classList.contains("dark-mode");
      document.documentElement.classList.toggle("dark-mode", dark);
      try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {}
      drawGraph();
    };

    var panel = $("tPanel"), toggle = $("tPanelBtn");
    toggle.onclick = function () { panel.classList.toggle("open"); };
  }

  /* ---------------- KAPI AKIŞI ---------------- */
  function showGate() {
    gateOpen = true;
    $("tGate").hidden = false; $("tApp").hidden = true;
    var inp = $("tGateInput"), btn = $("tGateBtn"), err = $("tGateErr");
    function tryOpen() {
      err.textContent = "";
      sha256(inp.value).then(function (h) {
        if (h === gateHash()) { try { localStorage.setItem("ra-timer-ok", "1"); } catch (e) {} openApp(); }
        else { err.textContent = "Parola yanlış."; inp.value = ""; inp.focus(); }
      });
    }
    btn.onclick = tryOpen;
    inp.onkeydown = function (e) { if (e.key === "Enter") tryOpen(); };
    inp.focus();
  }
  function openApp() { gateOpen = false; $("tGate").hidden = true; $("tApp").hidden = false; initUI(); }

  document.addEventListener("DOMContentLoaded", function () {
    if (unlocked()) openApp(); else showGate();
  });
})();
