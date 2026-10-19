/* =========================================================
   VERİ DÜZENLEYİCİ (data-editor.js) — Ayarlar sayfası + admin paneli (DataEditor.mount ile farklı depo)
   - Antrenör istatistikleri: set ya da case bazında sil
   - Günlük sonuçlar: geçmiş günleri sil (sıralamadaki girdisiyle birlikte)
   - Bilinen algoritmalar: case durumunu değiştir (biliyorum / öğreniyorum / yok), seti temizle
   Değişiklikler localStorage'a yazılır; giriş yapılmışsa senkronla buluta gider.
========================================================= */
(function () {
  // store: { get(k) → nesne, put(k, nesne), keys() → anahtarlar, deleteDaily(gün) → Promise, onChange? }
  var CSS = ".de-msg { font-size: 13px; font-weight: 700; min-height: 16px; padding: 2px 4px; color: #16a34a; }\n.de-msg.bad { color: #e3262c; }\n.de-tabs { display: flex; gap: 6px; padding: 0 4px 10px; flex-wrap: wrap; }\n.de-tab { border: 1px solid var(--border); background: var(--surface-soft); color: var(--text); font: 800 13px Inter, sans-serif; padding: 8px 12px; border-radius: 999px; cursor: pointer; }\n.de-tab.on { background: #2c6fe6; color: #fff; border-color: transparent; }\n.de-body { padding: 0 4px 6px; }\n.de-set { border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; padding: 6px 10px; }\n.de-set > summary { cursor: pointer; font-weight: 800; padding: 6px 0; display: flex; align-items: center; gap: 8px; }\n.de-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--border); font-size: 14px; }\n.de-nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }\n.de-v { color: var(--text-soft); font-size: 12.5px; font-variant-numeric: tabular-nums; }\n.de-x, .de-del { border: 0; background: transparent; color: var(--cube-red); font: 800 13px Inter, sans-serif; cursor: pointer; padding: 4px 8px; border-radius: 8px; }\n.de-x:hover, .de-del:hover { background: var(--surface-soft); }\n.de-del { margin-left: auto; }\n.de-sel { font: 700 13px Inter, sans-serif; padding: 4px 6px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }\n.de-empty, .de-note { color: var(--text-soft); font-size: 13px; padding: 8px 2px; }\n.de-lock { color: var(--text-soft); font-size: 12px; font-weight: 700; }\n";
  function mount(root, store) {
    if (!document.getElementById("deCss")) { var st = document.createElement("style"); st.id = "deCss"; st.textContent = CSS; document.head.appendChild(st); }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function get(k) { return store.get(k); }
    function put(k, v) { var r = store.put(k, v); if (r && r.then) r.then(function (ok) { if (ok === false) say("Kaydedilemedi.", 1); }, function () { say("Kaydedilemedi.", 1); }); }
    function fmt(ms) { if (ms == null || isNaN(ms)) return "-"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    var SET_NAMES = { oll: "OLL", pll: "PLL", "2look-2lo": "2-Look OLL", "2look-2lp": "2-Look PLL", f2l: "F2L", coll: "COLL", wv: "WV", zbll: "ZBLL", cll: "CLL", eg1: "EG-1", eg2: "EG-2", "ortega-oll": "Ortega OLL", "ortega-pbl": "Ortega PBL", "roux-cmll": "Roux CMLL", "roux-eo": "Roux EO", cross: "Cross", xcross: "X-Cross", "megaminx-oll": "Megaminx OLL", "megaminx-pll": "Megaminx PLL", "mg-oll": "Megaminx OLL", "mg-pll": "Megaminx PLL" };
    function setName(id) { var card = /:card$/.test(id); id = id.replace(/:card$/, ""); return (SET_NAMES[id] || id.replace(/^square1-|^sq-/, "SQ-1 ").replace(/-/g, " ").toUpperCase()) + (card ? " (kart)" : ""); }
    var tab = "trainer";

    function renderTrainer() {
        var st = get("trainer-stats-v1"), ids = Object.keys(st).filter(function (k) { return st[k] && Object.keys(st[k]).length; });
        if (!ids.length) return '<p class="de-empty">Antrenörde kayıtlı çözüm yok.</p>';
        return ids.map(function (id) {
            var cases = st[id], keys = Object.keys(cases), total = keys.reduce(function (a, k) { return a + ((cases[k] && cases[k].n) || 0); }, 0);
            return '<details class="de-set"><summary><b>' + esc(setName(id)) + '</b><span>' + keys.length + ' case · ' + total + ' çözüm</span><button type="button" class="de-del" data-tr-set="' + esc(id) + '">Seti sil</button></summary>' +
                keys.map(function (k) { var c = cases[k] || {}; return '<div class="de-row"><span class="de-nm">' + esc(k.split("::").pop()) + '</span><span class="de-v">' + (c.n || 0) + ' çözüm · ort ' + fmt(c.n ? c.sum / c.n : null) + ' · en iyi ' + fmt(c.best) + '</span><button type="button" class="de-x" data-tr-case="' + esc(id) + '|' + esc(k) + '" aria-label="Sil">✕</button></div>'; }).join("") + '</details>';
        }).join("");
    }
    function renderDaily() {
        var res = get("daily-results-v1"), keys = Object.keys(res).sort().reverse(), today = todayStr();
        if (!keys.length) return '<p class="de-empty">Günlük sonuç yok.</p>';
        return '<p class="de-note">Silinen günün sıralamadaki girdisi de kaldırılır. Bugünün sonucu silinemez.</p>' + keys.map(function (k) {
            var r = res[k] || {}, d = k.split(":")[0], label = r.pen === "dnf" ? "DNF" : fmt((r.t || 0) + (r.pen === "+2" ? 2000 : 0)) + (r.pen === "+2" ? "+" : "");
            return '<div class="de-row"><span class="de-nm">' + esc(d) + '</span><span class="de-v" dir="ltr">' + esc(label) + '</span>' +
                (d === today ? '<span class="de-lock">bugün</span>' : '<button type="button" class="de-x" data-daily="' + esc(k) + '" aria-label="Sil">✕</button>') + '</div>';
        }).join("");
    }
    function progressKeys() { return store.keys().filter(function (k) { return k && k.indexOf("algo-progress-") === 0; }).sort(); }
    function renderAlgs() {
        var keys = progressKeys().filter(function (k) { return Object.keys(get(k)).length; });
        if (!keys.length) return '<p class="de-empty">İşaretlenmiş algoritma yok.</p>';
        return keys.map(function (k) {
            var o = get(k), cases = Object.keys(o), id = k.replace("algo-progress-", "");
            var kn = cases.filter(function (c) { return o[c] === "known"; }).length;
            return '<details class="de-set"><summary><b>' + esc(setName(id)) + '</b><span>' + kn + ' biliyorum · ' + (cases.length - kn) + ' öğreniyorum</span><button type="button" class="de-del" data-alg-set="' + esc(k) + '">Temizle</button></summary>' +
                cases.map(function (c) {
                    return '<div class="de-row"><span class="de-nm">' + esc(c.split("::").pop()) + '</span><select class="de-sel" data-alg="' + esc(k) + '|' + esc(c) + '">' +
                        [["known", "🟢 Biliyorum"], ["learning", "🟡 Öğreniyorum"], ["", "⚪ Yok"]].map(function (o2) { return '<option value="' + o2[0] + '"' + (o[c] === o2[0] ? " selected" : "") + ">" + o2[1] + "</option>"; }).join("") + '</select></div>';
                }).join("") + '</details>';
        }).join("");
    }
    function render() {
        var openSets = {}; Array.prototype.forEach.call(root.querySelectorAll("details.de-set[open] summary b"), function (b) { openSets[b.textContent] = 1; });
        root.innerHTML = '<div class="de-tabs">' + [["trainer", "⏱️ Antrenör"], ["daily", "📅 Günlük"], ["algs", "🧠 Bilinen algoritmalar"]].map(function (t) { return '<button type="button" class="de-tab' + (t[0] === tab ? " on" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") + '</div><div class="de-body">' +
            (tab === "trainer" ? renderTrainer() : tab === "daily" ? renderDaily() : renderAlgs()) + '</div><div class="set-msg de-msg"></div>';
        Array.prototype.forEach.call(root.querySelectorAll("details.de-set"), function (d) { if (openSets[d.querySelector("summary b").textContent]) d.open = true; });
    }
    function say(t, bad) { var m = root.querySelector(".de-msg"); if (m) { m.textContent = t; m.className = "set-msg de-msg" + (bad ? " bad" : ""); } }
    root.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.tab) { tab = b.dataset.tab; render(); return; }
        if (b.closest("summary")) e.preventDefault();
        if (b.dataset.trSet) {
            if (!confirm(setName(b.dataset.trSet) + " antrenör istatistikleri silinsin mi?")) return;
            var st = get("trainer-stats-v1"); delete st[b.dataset.trSet]; put("trainer-stats-v1", st); render(); say("Silindi ✓");
        } else if (b.dataset.trCase) {
            var p = b.dataset.trCase.split("|"), st2 = get("trainer-stats-v1");
            if (st2[p[0]]) { delete st2[p[0]][p.slice(1).join("|")]; if (!Object.keys(st2[p[0]]).length) delete st2[p[0]]; }
            put("trainer-stats-v1", st2); render(); say("Silindi ✓");
        } else if (b.dataset.daily) {
            var k = b.dataset.daily, d = k.split(":")[0];
            if (!confirm(d + " günlük sonucu silinsin mi? Sıralamadaki girdisi de kaldırılır.")) return;
            var res = get("daily-results-v1"); delete res[k]; put("daily-results-v1", res);
            var sent = get("daily-sent-v1"); if (sent[d]) { delete sent[d]; put("daily-sent-v1", sent); }
            render();
            Promise.resolve(store.deleteDaily ? store.deleteDaily(d) : true).then(function (ok) { say(ok === false ? "Sıralama girdisi silinemedi." : "Silindi ✓", ok === false); }, function () { say("Sıralama girdisi silinemedi.", 1); });
        } else if (b.dataset.algSet) {
            if (!confirm(setName(b.dataset.algSet.replace("algo-progress-", "")) + " işaretleri temizlensin mi?")) return;
            put(b.dataset.algSet, {}); render(); say("Temizlendi ✓");
        }
    });
    root.addEventListener("change", function (e) {
        var s = e.target.closest(".de-sel"); if (!s) return;
        var p = s.dataset.alg.split("|"), k = p[0], c = p.slice(1).join("|"), o = get(k);
        if (s.value) o[c] = s.value; else delete o[c];
        put(k, o); say("Kaydedildi ✓");
    });
    render();
    return { render: render };
  }

  // Yerel (bu cihaz) deposu — Ayarlar sayfası
  var syncT = 0;
  function sync() { clearTimeout(syncT); syncT = setTimeout(function () { if (window.Account && Account.user && Account.user()) { Account.syncNow(); if (Account.writeProfile) Account.writeProfile(); } }, 600); }
  var localStore = {
    get: function (k) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } },
    put: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} sync(); },
    keys: function () { var out = []; try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) {} return out; },
    deleteDaily: function (d) { return window.Account && Account.deleteDailyEntry && Account.user && Account.user() ? Account.deleteDailyEntry(d) : Promise.resolve(true); }
  };
  window.DataEditor = { mount: mount, localStore: localStore };
  var el = document.getElementById("dataEditor");
  if (el) { var ed = mount(el, localStore); document.addEventListener("account-synced", ed.render); }
})();
