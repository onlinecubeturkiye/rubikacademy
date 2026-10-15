/* =========================================================
   GÜNÜN KARIŞTIRMASI + SIRALAMA (gunluk.js)
   - Karıştırma tarihten üretilir: herkes aynı gün aynı karıştırmayı görür
   - Tek hak: ilk tamamlanan deneme o günün sonucu olur ("daily-results-v1"),
     sonra karıştırma ve timer ertesi güne kadar gizlenir
========================================================= */
(function () {
    var RES_KEY = "daily-results-v1";
    var COLOR = { U: "#f6c719", R: "#ff7a1a", F: "#179e4f", D: "#eef2f3", L: "#d12d28", B: "#2c6fe6" };
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
    var state = "idle", t0 = 0, raf = 0, holdT = 0, last = 0;
    function fmt(ms) { if (ms == null) return "-"; var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function show(ms) { $("dTimer").textContent = fmt(ms); }
    function tick() { show(performance.now() - t0); raf = requestAnimationFrame(tick); }
    function setState(s) { state = s; $("dTimerBox").setAttribute("data-state", s); $("dHint").textContent = T("hint_" + s); }
    function press() {
        if (state === "running") { stop(); return; }
        if (state !== "idle" || official()) return;
        setState("hold"); show(0);
        holdT = setTimeout(function () { if (state === "hold") setState("ready"); }, 300);
    }
    function release() {
        if (state === "hold") { clearTimeout(holdT); setState("idle"); return; }
        if (state === "ready") { setState("running"); t0 = performance.now(); tick(); }
    }
    function stop() {
        cancelAnimationFrame(raf); last = performance.now() - t0; show(last); setState("done");
        var res = loadRes(), k = today(), key = k + ":" + puzzle;
        if (!res[key]) {
            res[key] = { t: Math.round(last), pen: "" };
            saveRes(res);
        }
        renderAll();
    }

    /* ---------- görünüm ---------- */
    function official() { return loadRes()[today() + ":" + puzzle] || null; }
    function value(r) { if (!r) return null; if (r.pen === "dnf") return Infinity; return r.t + (r.pen === "+2" ? 2000 : 0); }
    function label(r) { if (!r) return "-"; if (r.pen === "dnf") return "DNF"; return fmt(value(r)) + (r.pen === "+2" ? "+" : ""); }
    function renderToday() {
        var day = today();
        var d = new Date(), loc = { tr: "tr-TR", en: "en-GB", fr: "fr-FR", ru: "ru-RU", de: "de-DE", ar: "ar" }[lang()] || "tr-TR";
        $("dDate").textContent = d.toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", weekday: "long" });
        var r = official();
        // Çözüldüyse karıştırma ve timer ertesi güne kadar gizlenir
        $("dPlay").hidden = !!r; $("dDone").hidden = !r;
        if (r) {
            $("dScr").textContent = ""; $("dNet").innerHTML = "";
            $("dOffTime").textContent = label(r);
            $("dPen2").classList.toggle("on", r.pen === "+2");
            $("dPenDnf").classList.toggle("on", r.pen === "dnf");
            tickCountdown();
        } else {
            var scr = scramble(day, puzzle);
            $("dScr").textContent = scr; drawNet(scr);
            if (state !== "running" && state !== "hold" && state !== "ready") { show(0); setState("idle"); }
        }
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
    var SENT_KEY = "daily-sent-v1", NAME_KEY = "daily-name-v1", lbTimer = 0;
    function lbOn() { return !!(window.Leaderboard && Leaderboard.enabled()); }
    function sentToday() { try { return !!(JSON.parse(localStorage.getItem(SENT_KEY)) || {})[today()]; } catch (e) { return false; } }
    function markSent() { try { var o = JSON.parse(localStorage.getItem(SENT_KEY)) || {}; o[today()] = 1; localStorage.setItem(SENT_KEY, JSON.stringify(o)); } catch (e) {} }
    function dayOf(key) { var p = key.split("-"); return String(Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000)); }
    function lbMsg(text, kind) { var m = $("lbMsg"); m.textContent = text || ""; m.className = "lb-msg" + (kind ? " " + kind : ""); }
    function renderSend() {
        var r = official(), on = lbOn() && !!r, sent = sentToday();
        $("lbSend").hidden = !on || sent;
        $("dPen2").disabled = $("dPenDnf").disabled = on && sent; // gönderildikten sonra ceza değişmez
        if (!on) { lbMsg(""); return; }
        $("lbName").placeholder = T("lb_name", "Adın (sıralamada görünür)");
        if (!$("lbName").value) { try { $("lbName").value = localStorage.getItem(NAME_KEY) || ""; } catch (e) {} }
        if (sent) lbMsg(T("lb_sent", "Sıralamaya gönderildi ✓"), "ok");
        else if (r.t < 3000 && r.pen !== "dnf") lbMsg(T("lb_too_fast", "3 saniyenin altındaki süreler sıralamaya kabul edilmez."), "bad");
        else if ($("lbMsg").className.indexOf("bad") < 0) lbMsg("");
    }
    function sendResult() {
        var r = official(); if (!r || !lbOn() || sentToday()) return;
        var name = $("lbName").value.replace(/\s+/g, " ").trim();
        if (name.length < 2 || name.length > 20) { lbMsg(T("lb_bad_name", "Ad 2-20 karakter olmalı."), "bad"); $("lbName").focus(); return; }
        if (r.t < 3000 && r.pen !== "dnf") { lbMsg(T("lb_too_fast"), "bad"); return; }
        try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
        $("lbSendBtn").disabled = true; lbMsg(T("lb_sending", "Gönderiliyor…"));
        Leaderboard.submit(name, r.t, r.pen, dayOf(today())).then(function (res) {
            $("lbSendBtn").disabled = false;
            if (res.ok || res.exists) { markSent(); renderSend(); loadBoard(); }
            else lbMsg(T("lb_err", "Gönderilemedi. İnternet bağlantını kontrol edip tekrar dene."), "bad");
        }, function () { $("lbSendBtn").disabled = false; lbMsg(T("lb_err"), "bad"); });
    }
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

    function renderAll() { shownDay = today(); renderToday(); renderSend(); loadBoard(); renderHistory(); }

    function setPen(p) {
        var res = loadRes(), key = today() + ":" + puzzle; if (!res[key]) return;
        res[key].pen = res[key].pen === p ? "" : p; saveRes(res); renderAll();
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
        $("lbSendBtn").addEventListener("click", sendResult);
        $("lbName").addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") sendResult(); });
        $("lbName").addEventListener("keyup", function (e) { e.stopPropagation(); });
        $("lbRefresh").addEventListener("click", loadBoard);
        document.addEventListener("site-lang-change", renderAll);
        renderAll();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
