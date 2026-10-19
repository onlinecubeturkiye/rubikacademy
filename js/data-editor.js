/* =========================================================
   VERİ DÜZENLEYİCİ (data-editor.js) — Ayarlar sayfası
   - Antrenör istatistikleri: set ya da case bazında sil
   - Günlük sonuçlar: geçmiş günleri sil (sıralamadaki girdisiyle birlikte)
   - Bilinen algoritmalar: case durumunu değiştir (biliyorum / öğreniyorum / yok), seti temizle
   Değişiklikler localStorage'a yazılır; giriş yapılmışsa senkronla buluta gider.
========================================================= */
(function () {
    var root = document.getElementById("dataEditor");
    if (!root) return;
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function get(k) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
    function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} sync(); }
    var syncT = 0;
    function sync() { clearTimeout(syncT); syncT = setTimeout(function () { if (window.Account && Account.user && Account.user()) { Account.syncNow(); if (Account.writeProfile) Account.writeProfile(); } }, 600); }
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
    function progressKeys() { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("algo-progress-") === 0) out.push(k); } } catch (e) {} return out.sort(); }
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
            (tab === "trainer" ? renderTrainer() : tab === "daily" ? renderDaily() : renderAlgs()) + '</div><div class="set-msg" id="deMsg"></div>';
        Array.prototype.forEach.call(root.querySelectorAll("details.de-set"), function (d) { if (openSets[d.querySelector("summary b").textContent]) d.open = true; });
    }
    function say(t, bad) { var m = document.getElementById("deMsg"); if (m) { m.textContent = t; m.className = "set-msg" + (bad ? " bad" : ""); } }
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
            if (window.Account && Account.deleteDailyEntry) Account.deleteDailyEntry(d).then(function () { say("Silindi ✓"); }); else say("Silindi ✓");
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
    document.addEventListener("account-synced", render);
})();
