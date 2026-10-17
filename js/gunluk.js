/* =========================================================
   GÜNÜN KARIŞTIRMASI + SIRALAMA (gunluk.js)
   - Karıştırma tarihten üretilir: herkes aynı gün aynı karıştırmayı görür
   - Tek hak: ilk tamamlanan deneme o günün sonucu olur ("daily-results-v1"),
     sonra karıştırma ve timer ertesi güne kadar gizlenir
========================================================= */
(function () {
    var RES_KEY = "daily-results-v1";
    // Günün karıştırması beyaz üstte, yeşil önde uygulanır
    var COLOR = { U: "#eef2f3", R: "#d12d28", F: "#179e4f", D: "#f6c719", L: "#ff7a1a", B: "#2c6fe6" };
    var NET = [["U", 1, 0], ["L", 0, 1], ["F", 1, 1], ["R", 2, 1], ["B", 3, 1], ["D", 1, 2]];
    var puzzle = "333";
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.gunluk) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function loadRes() { try { return JSON.parse(localStorage.getItem(RES_KEY)) || {}; } catch (e) { return {}; } }
    function saveRes(o) { try { localStorage.setItem(RES_KEY, JSON.stringify(o)); } catch (e) {} }

    /* ---------- tarihten karıştırma ---------- */
    function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function scramble(day, pz) {
        var r = rng(hash("rubikacademy:" + pz + ":" + day)), sfx = ["", "'", "2"], out = [];
        var faces = "URFDLB", last = -1, prev = -1;
        while (out.length < 20) {
            var f = Math.floor(r() * 6);
            if (f === last || (f % 3 === last % 3 && f % 3 === prev % 3)) continue;
            out.push(faces[f] + sfx[Math.floor(r() * 3)]); prev = last; last = f;
        }
        return out.join(" ");
    }
    function drawNet(alg) {
        var c = new Cube(); c.move(alg);
        var s = c.asString(), html = "";
        NET.forEach(function (n) {
            var fi = "URFDLB".indexOf(n[0]);
            html += '<div class="dn-f" style="grid-column:' + (n[1] + 1) + ';grid-row:' + (n[2] + 1) + '">';
            for (var i = 0; i < 9; i++) html += '<i style="background:' + COLOR[s[fi * 9 + i]] + '"></i>';
            html += "</div>";
        });
        $("dNet").innerHTML = html;
    }

    /* ---------- zamanlayıcı ---------- */
    var state = "idle", t0 = 0, raf = 0, holdT = 0, last = 0, pending = null;
    function fmt(ms) { if (ms == null) return "-"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function show(ms) { $("dTimer").textContent = fmt(ms); }
    function tick() { show(performance.now() - t0); raf = requestAnimationFrame(tick); }
    function setState(s) {
        state = s; $("dTimerBox").setAttribute("data-state", s); $("dHint").textContent = T("hint_" + s);
        if (window.btOnStateChange) window.btOnStateChange();
    }
    function press() {
        if (state === "running") { stop(); return; }
        if (state !== "idle" || locked()) return;
        setState("hold"); show(0);
        holdT = setTimeout(function () { if (state === "hold") setState("ready"); }, 300);
    }
    function release() {
        if (state === "hold") { clearTimeout(holdT); setState("idle"); return; }
        if (state === "ready") { setState("running"); t0 = performance.now(); tick(); }
    }
    function stop() {
        cancelAnimationFrame(raf); last = performance.now() - t0; show(last); setState("done");
        // Çözüm henüz kilitlenmez: kullanıcı "Sıralamaya gönder" demedikçe tekrar deneyebilir.
        pending = { t: Math.round(last), pen: "" };
        renderAll();
    }

    /* ---------- Bluetooth akıllı küp (antrenor-bt.js) ----------
       Modül antrenörün global'lerini bekler; burada günün karıştırması için sağlanır:
       çözülmüş küpe karıştırma hamle hamle takip edilir, ilk hamlede süre başlar,
       küp çözülünce durur. */
    window.BT_IDS = { scramble: "dScr", hint: "dHint" };
    window.BT_WHITE_TOP = true;
    window.mode = "cube";
    window.current = { id: "daily", cube: "3x3" };
    Object.defineProperty(window, "state", { configurable: true, get: function () { return state === "done" ? "done" : state === "running" ? "running" : "idle"; } });
    Object.defineProperty(window, "curScramble", { configurable: true, get: function () { return locked() ? "" : scramble(today(), puzzle); }, set: function () {} });
    window.startTimer = function () { if (state === "running" || locked()) return; clearTimeout(holdT); setState("running"); t0 = performance.now(); tick(); };
    window.stopTimer = function () { if (state === "running") stop(); };
    // Bluetooth metinleri antrenör sayfasının çevirilerinden gelir
    // (günlük sayfaya özel metin varsa o kullanılır)
    window.T = function (k) {
        var g = (window.SITE_I18N && SITE_I18N.pages.gunluk) || {}, p = (window.SITE_I18N && SITE_I18N.pages.antrenor) || {};
        return (g[lang()] && g[lang()][k]) || (p[lang()] && p[lang()][k]) || (g.tr && g.tr[k]) || (p.tr && p.tr[k]) || k;
    };

    /* ---------- görünüm ----------
       Model: çözüm hemen kilitlenmez. "Sıralamaya gönder" (= paylaş) denince
       hesaba bağlı olarak days/{gün}/times/{uid}'ye yazılır ve o günün sonucu
       olarak kilitlenir. Gönderilmezse kullanıcı tekrar çözebilir (2. hak).
       Admin sıralamadan silerse gönderim geri alınır, kullanıcı tekrar çözebilir. */
    var SENT_KEY = "daily-sent-v1", lbTimer = 0, reconciled = false;
    function lbOn() { return !!(window.Leaderboard && Leaderboard.enabled()); }
    function sentToday() { try { return !!(JSON.parse(localStorage.getItem(SENT_KEY)) || {})[today()]; } catch (e) { return false; } }
    function markSent() { try { var o = JSON.parse(localStorage.getItem(SENT_KEY)) || {}; o[today()] = 1; localStorage.setItem(SENT_KEY, JSON.stringify(o)); } catch (e) {} }
    function unmarkSent() { try { var o = JSON.parse(localStorage.getItem(SENT_KEY)) || {}; delete o[today()]; localStorage.setItem(SENT_KEY, JSON.stringify(o)); } catch (e) {} }
    function locked() { return sentToday(); }               // gönderilmiş = o gün kilitli
    function official() { return loadRes()[today() + ":" + puzzle] || null; }
    function value(r) { if (!r) return null; if (r.pen === "dnf") return Infinity; return r.t + (r.pen === "+2" ? 2000 : 0); }
    function label(r) { if (!r) return "-"; if (r.pen === "dnf") return "DNF"; return fmt(value(r)) + (r.pen === "+2" ? "+" : ""); }
    function dayOf(key) { var p = key.split("-"); return String(Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000)); }
    function lbMsg(text, kind) { var m = $("lbMsg"); m.textContent = text || ""; m.className = "lb-msg" + (kind ? " " + kind : ""); }

    function renderToday() {
        var day = today();
        var d = new Date(), loc = { tr: "tr-TR", en: "en-GB", fr: "fr-FR", ru: "ru-RU", de: "de-DE", ar: "ar" }[lang()] || "tr-TR";
        $("dDate").textContent = d.toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", weekday: "long" });
        var lk = locked(), pend = !lk && !!pending, r = lk ? (official() || pending) : pending;
        var done = lk || pend;
        $("dPlay").hidden = done; $("dDone").hidden = !done;
        if (done) {
            $("dScr").textContent = ""; $("dNet").innerHTML = "";
            r = r || { t: 0, pen: "" };
            $("dOffTime").textContent = label(r);
            $("dDoneH").textContent = lk ? T("done_h", "Bugünü tamamladın! 🎉") : T("attempt_h", "Süren");
            $("dPen2").classList.toggle("on", r.pen === "+2");
            $("dPenDnf").classList.toggle("on", r.pen === "dnf");
            $("dPen2").disabled = $("dPenDnf").disabled = lk;   // gönderildikten sonra ceza değişmez
            $("dAttempt").hidden = lk; $("dLocked").hidden = !lk;
            $("dRetryNote").hidden = lk; $("dCountWrap").hidden = !lk;
            renderAttemptMsg(r, lk);
            if (lk) tickCountdown();
        } else {
            var scr = scramble(day, puzzle);
            $("dScr").textContent = scr; drawNet(scr);
            if (window.btIsActive && btIsActive()) btRenderScramble();
            if (state !== "running" && state !== "hold" && state !== "ready") { show(0); setState("idle"); }
        }
    }
    function renderAttemptMsg(r, lk) {
        if (lk) { lbMsg(T("lb_sent", "Sıralamaya gönderildi ✓"), "ok"); return; }
        var tooFast = r.t < 3000 && r.pen !== "dnf";
        $("dSubmit").disabled = tooFast || !lbOn();
        if (tooFast) { lbMsg(T("lb_too_fast", "3 saniyenin altındaki süreler sıralamaya kabul edilmez. Tekrar dene."), "bad"); return; }
        if (!lbOn()) { lbMsg(T("lb_off", "Sıralama şu an kullanılamıyor."), "bad"); return; }
        if (!Leaderboard.signedIn()) lbMsg(T("lb_need_login", "Sıralamaya göndermek ve kaydetmek için giriş yap."), "");
        else if ($("lbMsg").className.indexOf("bad") < 0) lbMsg("");
    }
    function submitAttempt() {
        if (!pending || locked()) return;
        var r = pending;
        if (r.t < 3000 && r.pen !== "dnf") { lbMsg(T("lb_too_fast"), "bad"); return; }
        if (!lbOn()) { lbMsg(T("lb_off", "Sıralama şu an kullanılamıyor."), "bad"); return; }
        if (!Leaderboard.signedIn()) {
            lbMsg(T("lb_need_login", "Sıralamaya göndermek ve kaydetmek için giriş yap."), "");
            if (window.Account) window.Account.openLogin();
            return;
        }
        $("dSubmit").disabled = true; lbMsg(T("lb_sending", "Gönderiliyor…"));
        Leaderboard.submit(r.t, r.pen, dayOf(today())).then(function (res) {
            $("dSubmit").disabled = false;
            if (res.ok || res.exists) {
                var all = loadRes(); all[today() + ":" + puzzle] = { t: r.t, pen: r.pen }; saveRes(all);
                pending = null; markSent();
                if (window.Account && window.Account.syncNow) window.Account.syncNow();
                renderAll();
            } else if (res.needAuth) { lbMsg(T("lb_need_login"), ""); if (window.Account) window.Account.openLogin(); }
            else if (res.badName) lbMsg(T("lb_bad_name", "Sıralamada görünecek bir ad gerekli. Profilinden ad ekle."), "bad");
            else if (res.status === "PERMISSION_DENIED" || res.status === 403) lbMsg(T("lb_err_perm", "Sıralama sunucusu gönderimi kabul etmedi. Biraz sonra tekrar dene."), "bad");
            else lbMsg(T("lb_err_srv", "Gönderilemedi (sunucu hatası). Biraz sonra tekrar dene.") + " [" + res.status + "]", "bad");
        }, function () { $("dSubmit").disabled = false; lbMsg(T("lb_err", "Gönderilemedi."), "bad"); });
    }
    function retry() { pending = null; setState("idle"); renderAll(); }
    // Admin sıralamadan silince (ya da hiç gönderilmemişse) kilidi aç → tekrar çözülebilsin
    function reconcile() {
        if (reconciled || !lbOn() || !Leaderboard.signedIn() || !locked()) return;
        reconciled = true;
        Leaderboard.hasSubmitted(dayOf(today())).then(function (has) {
            if (has === false) {
                var all = loadRes(); delete all[today() + ":" + puzzle]; saveRes(all);
                unmarkSent(); pending = null;
                if (window.Account && window.Account.syncNow) window.Account.syncNow();
                renderAll();
            }
        });
    }
    var cdTimer = 0, shownDay = null;
    function tickCountdown() {
        clearTimeout(cdTimer);
        var now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), s = Math.max(0, Math.round((mid - now) / 1000));
        var p = function (n) { return (n < 10 ? "0" : "") + n; };
        $("dCountdown").textContent = p(Math.floor(s / 3600)) + ":" + p(Math.floor(s / 60) % 60) + ":" + p(s % 60);
        cdTimer = setTimeout(function () { if (today() !== shownDay) { shownDay = today(); renderAll(); } else tickCountdown(); }, 1000);
    }
    function renderHistory() {
        var res = loadRes(), rows = Object.keys(res).filter(function (k) { return k.split(":")[1] === puzzle; }).sort().reverse().slice(0, 7);
        $("hList").innerHTML = rows.length ? rows.map(function (k) { return '<div class="h-row"><span>' + esc(k.split(":")[0]) + '</span><b>' + esc(label(res[k])) + '</b></div>'; }).join("") : '<p class="h-empty">' + esc(T("no_hist", "Henüz sonuç yok.")) + '</p>';
    }
    /* ---------- sıralama tablosu (Firebase) ---------- */
    function loadBoard() {
        if (!lbOn()) { $("lbBox").hidden = true; return; }
        $("lbBox").hidden = false;
        clearTimeout(lbTimer);
        Leaderboard.fetchDay(dayOf(today()), 200).then(function (rows) {
            if (!rows.length) { $("lbList").innerHTML = '<p class="lb-empty">' + esc(T("lb_empty", "Bugün henüz kimse göndermedi. İlk sen ol!")) + '</p>'; return; }
            var medal = ["🥇", "🥈", "🥉"], html = "", meIdx = -1;
            rows.forEach(function (x, i) { if (x.mine) meIdx = i; });
            rows.forEach(function (x, i) {
                if (i >= 50 && i !== meIdx) return;
                if (i === meIdx && i >= 50) html += '<div class="lb-gap">⋯</div>';
                html += '<div class="lb-row' + (i < 3 ? " top" : "") + (x.mine ? " me" : "") + '"><span class="rk">' + (i < 3 && x.pen !== "dnf" ? medal[i] : (i + 1)) + '</span><span class="nm">' + esc(x.name) + '</span><span class="tm" dir="ltr">' + esc(label(x)) + '</span></div>';
            });
            $("lbList").innerHTML = html;
        }, function () {
            $("lbList").innerHTML = '<p class="lb-empty">' + esc(T("lb_load_err", "Sıralama yüklenemedi.")) + '</p>';
        }).then(function () { lbTimer = setTimeout(loadBoard, 30000); });
    }

    function renderAll() { shownDay = today(); renderToday(); loadBoard(); renderHistory(); reconcile(); }

    function setPen(p) {
        if (locked() || !pending) return;           // ceza yalnızca gönderilmeden önce değişir
        pending.pen = pending.pen === p ? "" : p; renderAll();
    }
    function share() {
        var r = official(); if (!r) return;
        var txt = T("share_txt", "Rubik Academy · Günün Karıştırması") + " (3x3, " + today() + "): " + label(r) + " ⏱️\nhttps://rubikacademy.fun/icerikler/gunluk";
        var done = function () { $("dShare").textContent = T("copied", "Kopyalandı ✓"); setTimeout(function () { $("dShare").textContent = T("share", "📤 Paylaş"); }, 1600); };
        if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {});
    }

    function init() {
        try { localStorage.removeItem("activity-days-v1"); } catch (e) {} // eski seri kaydı (seri özelliği kaldırıldı)
        try { localStorage.removeItem("daily-name-v1"); } catch (e) {}     // ad artık hesaptan gelir
        // Eski modelden kalan, gönderilmemiş bugünkü sonucu temizle (yeni modelde yalnızca gönderince kilitlenir)
        try { var all = loadRes(), k = today() + ":" + puzzle; if (all[k] && !sentToday()) { delete all[k]; saveRes(all); } } catch (e) {}
        var box = $("dTimerBox");
        document.addEventListener("keydown", function (e) {
            if (e.target.closest("input, textarea, button, a") && e.code !== "Space") return;
            if (e.code === "Space") { e.preventDefault(); if (!e.repeat) press(); }
            else if (state === "running") stop();
        });
        document.addEventListener("keyup", function (e) { if (e.code === "Space") { e.preventDefault(); release(); } });
        box.addEventListener("touchstart", function (e) { e.preventDefault(); press(); }, { passive: false });
        box.addEventListener("touchend", function (e) { e.preventDefault(); release(); }, { passive: false });
        box.addEventListener("mousedown", function () { press(); });
        box.addEventListener("mouseup", function () { release(); });
        $("dPen2").addEventListener("click", function () { setPen("+2"); });
        $("dPenDnf").addEventListener("click", function () { setPen("dnf"); });
        $("dShare").addEventListener("click", share);
        $("dSubmit").addEventListener("click", submitAttempt);
        $("dRetry").addEventListener("click", retry);
        $("lbRefresh").addEventListener("click", loadBoard);
        document.addEventListener("site-lang-change", function () { renderAll(); if (window.btRenderBar) btRenderBar(); });
        // Giriş/çıkış olunca sıralama durumu ve kilidi yeniden değerlendir
        if (window.Account && window.Account.onChange) window.Account.onChange(function () { reconciled = false; renderAll(); });
        renderAll();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
