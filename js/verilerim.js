/* =========================================================
   VERİLERİM (verilerim.js) — bu tarayıcıdaki ilerlemeyi yedekle / aktar / geri yükle / sil
   Yedek dosyası: { app: "rubikacademy", v: 1, date, data: { anahtar: değer } }
   Yedeğe giren kayıtlar: algoritma ilerlemesi ve set seçimleri, antrenör, tanıma, günün
   karıştırması, kendi algoritmaların, sanal küp süreleri, görünüm ayarları (dil, tema, renkler).
   Cihaza özel olanlar (sıralama cihaz kimliği) yedeğe girmez.

   Kodla aktarma (Firestore REST, SDK yok):
   - Gönderen cihaz 8 haneli rastgele kod üretir (0000-0000), 30 saniyede bir yenilenir.
   - Veri kodla şifrelenir (PBKDF2 → AES-GCM); belge kimliği kodun SHA-256 özetidir,
     kod ya da açık veri sunucuya gitmez. Belge en fazla 60 sn geçerlidir (firestore.rules).
   - Alan cihaz kodu girince belgeyi okur, çözer, onaylatıp uygular ve belgeyi siler;
     gönderen cihaz belgenin silindiğini görünce "aktarıldı" der.
========================================================= */
(function () {
    var PREFIX = ["algo-progress-", "algo-set-", "recog-", "trainer-", "roadmap-", "daily-", "vcube-", "custom-algs-"];
    var EXACT = ["site-lang", "theme", "cvd-theme", "cvd-asked"];
    var cfg = window.RA_FIREBASE || {};
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.verilerim) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function mine(k) { return EXACT.indexOf(k) >= 0 || PREFIX.some(function (p) { return k.indexOf(p) === 0; }); }
    function collect() {
        var out = {};
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && mine(k)) out[k] = localStorage.getItem(k); } } catch (e) {}
        return out;
    }
    function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
    function isMobile() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); }
    // Kayıtlardan kısa özet (sayılar)
    function summary(data) {
        var known = 0, learning = 0, solves = 0, daily = 0, custom = 0, vc = 0;
        Object.keys(data).forEach(function (k) {
            var v = parse(data[k]);
            if (k.indexOf("algo-progress-") === 0 && v && typeof v === "object") {
                Object.keys(v).forEach(function (c) { if (v[c] === "known") known++; else if (v[c] === "learning") learning++; });
            } else if (k === "trainer-stats-v1" && v) {
                Object.keys(v).forEach(function (s) { var o = v[s] || {}; Object.keys(o).forEach(function (c) { solves += (o[c] && o[c].n) || 0; }); });
            } else if (k === "daily-results-v1" && v) daily = Object.keys(v).length;
            else if (k === "custom-algs-v1" && v) custom = Object.keys(v).length;
            else if (k === "vcube-times-v1" && Array.isArray(v)) vc = v.length;
        });
        return [[known, "s_known"], [learning, "s_learning"], [solves, "s_solves"], [daily, "s_daily"], [custom, "s_custom"], [vc, "s_vcube"]];
    }
    function infoText(data) {
        return summary(data).filter(function (x) { return x[0]; }).map(function (x) { return x[0] + " " + T(x[1]).toLocaleLowerCase(); }).join(", ") || "-";
    }
    function renderSummary() {
        var data = collect(), n = Object.keys(data).length;
        $("vrStats").innerHTML = summary(data).map(function (x) {
            return '<div class="vr-stat"><b>' + x[0] + '</b><span>' + T(x[1]) + '</span></div>';
        }).join("");
        $("vrEmpty").hidden = n > 0;
    }
    function msg(id, text, kind) { var m = $(id); m.textContent = text || ""; m.className = "vr-msg" + (kind ? " " + kind : ""); }
    function pad(x) { return (x < 10 ? "0" : "") + x; }
    function payload() { return { app: "rubikacademy", v: 1, date: new Date().toISOString(), data: collect() }; }
    // Yedekteki kayıtları uygula (onay sorulur), sonra sayfayı yenile
    function apply(j, msgId) {
        if (!j || j.app !== "rubikacademy" || !j.data || typeof j.data !== "object") { msg(msgId, T("bad_file"), "bad"); return false; }
        var keys = Object.keys(j.data).filter(function (k) { return mine(k) && typeof j.data[k] === "string"; });
        if (!keys.length) { msg(msgId, T("bad_file"), "bad"); return false; }
        var when = ""; try { when = new Date(j.date).toLocaleString(); } catch (e) {}
        if (!confirm(T("confirm_restore").replace("{d}", when).replace("{i}", infoText(j.data)))) return false;
        try { keys.forEach(function (k) { localStorage.setItem(k, j.data[k]); }); } catch (e) { msg(msgId, T("err"), "bad"); return false; }
        msg(msgId, T("restored").replace("{n}", keys.length), "ok");
        setTimeout(function () { location.reload(); }, 1200);
        return true;
    }

    /* ---------- dosyayla yedek ---------- */
    function download() {
        var d = new Date(), p = payload();
        var name = "rubikacademy-yedek-" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".json";
        var text = JSON.stringify(p, null, 1), file = null;
        try { file = new File([text], name, { type: "application/json" }); } catch (e) {}
        // Telefonda paylaş menüsü: "Dosyalar'a kaydet" / "Drive'a kaydet" ile yerini kullanıcı seçer
        if (isMobile() && file && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: name }).then(function () {
                msg("vrMsg", T("saved_share"), "ok");
            }, function (e) { if (e && e.name !== "AbortError") plainDownload(text, name); });
            return;
        }
        plainDownload(text, name);
    }
    function plainDownload(text, name) {
        var blob = new Blob([text], { type: "application/json" });
        var url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        msg("vrMsg", T(isMobile() ? "saved_mobile" : "saved").replace("{n}", Object.keys(collect()).length).replace("{f}", name), "ok");
    }
    function restore(file) {
        var r = new FileReader();
        r.onload = function () { apply(parse(r.result), "vrMsg"); };
        r.onerror = function () { msg("vrMsg", T("err"), "bad"); };
        r.readAsText(file);
    }

    /* ---------- kodla aktarma ---------- */
    var te = new TextEncoder(), td = new TextDecoder();
    function enabled() { return !!(cfg.apiKey && cfg.projectId && window.crypto && crypto.subtle); }
    function base() { return ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents/transfer"; }
    function q() { return "?key=" + encodeURIComponent(cfg.apiKey); }
    function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join(""); }
    function b64(buf) { var s = "", a = new Uint8Array(buf); for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
    function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
    function docId(code) { return crypto.subtle.digest("SHA-256", te.encode("rubikacademy-transfer:" + code)).then(function (h) { return hex(h).slice(0, 32); }); }
    function keyFor(code, id) {
        return crypto.subtle.importKey("raw", te.encode(code), "PBKDF2", false, ["deriveKey"]).then(function (k) {
            return crypto.subtle.deriveKey({ name: "PBKDF2", salt: te.encode(id), iterations: 120000, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        });
    }
    function randCode() {
        var a = new Uint32Array(1); crypto.getRandomValues(a);
        var s = String(a[0] % 100000000); while (s.length < 8) s = "0" + s; return s;
    }
    function fmtCode(c) { return c.slice(0, 4) + "-" + c.slice(4); }

    var send = null; // { code, id, timer, poll, tick, until }
    function stopSend(text, kind) {
        if (!send) return;
        clearTimeout(send.timer); clearInterval(send.poll); clearInterval(send.tick);
        var old = send; send = null;
        if (old.id) fetch(base() + "/" + old.id + q(), { method: "DELETE" }).catch(function () {});
        $("trCodeBox").hidden = true; $("trSend").hidden = false; $("trStop").hidden = true;
        msg("trMsg", text || "", kind);
    }
    // Yeni kod üret, veriyi şifreleyip yükle; 30 sn sonra yenile
    function publish() {
        if (!send) return;
        var code = randCode(), id, prevId = send.id;
        var data = te.encode(JSON.stringify(payload()));
        docId(code).then(function (x) { id = x; return keyFor(code, id); }).then(function (key) {
            var iv = crypto.getRandomValues(new Uint8Array(12));
            return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data).then(function (ct) {
                var exp = new Date(Date.now() + 60000).toISOString();
                var body = { fields: { d: { stringValue: b64(ct) }, iv: { stringValue: b64(iv) }, exp: { timestampValue: exp } } };
                return fetch(base() + q() + "&documentId=" + id, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            });
        }).then(function (r) {
            if (!send) return;
            if (r.status === 409) { publish(); return; } // aynı kod denk geldi
            if (!r.ok) throw new Error("http " + r.status);
            if (prevId) fetch(base() + "/" + prevId + q(), { method: "DELETE" }).catch(function () {});
            send.code = code; send.id = id; send.until = Date.now() + 30000;
            $("trCode").textContent = fmtCode(code);
            $("trCodeBox").hidden = false;
            msg("trMsg", T("tr_wait"));
            clearTimeout(send.timer); send.timer = setTimeout(publish, 30000);
        }).catch(function (e) {
            console.warn("Aktarma kodu oluşturulamadı:", e);
            stopSend(T(/http 403/.test(String(e)) ? "tr_err_rules" : "tr_err"), "bad");
        });
    }
    function startSend() {
        if (!enabled()) { msg("trMsg", T("tr_off"), "bad"); return; }
        stopSend();
        send = { code: null, id: null };
        $("trSend").hidden = true; $("trStop").hidden = false; $("trCode").textContent = "····-····";
        msg("trMsg", T("tr_making"));
        publish();
        // geri sayım çubuğu
        send.tick = setInterval(function () {
            if (!send || !send.until) return;
            var left = Math.max(0, send.until - Date.now());
            $("trBar").style.width = (left / 300) + "%";
            $("trLeft").textContent = Math.ceil(left / 1000) + " sn";
        }, 200);
        // diğer cihaz aldı mı? (belge silindiyse aktarıldı)
        send.poll = setInterval(function () {
            if (!send || !send.id || Date.now() > send.until + 25000) return;
            var id = send.id;
            fetch(base() + "/" + id + q()).then(function (r) {
                // Belge henüz süresi dolmadan yok olduysa (kurallar gereği 404 ya da 403) diğer cihaz aldı
                if (send && send.id === id && (r.status === 404 || r.status === 403) && Date.now() < send.until + 25000) stopSend(T("tr_sent"), "ok");
            }).catch(function () {});
        }, 2500);
    }
    function receive() {
        var code = $("trInput").value.replace(/\D/g, "");
        if (code.length !== 8) { msg("trInMsg", T("tr_need8"), "bad"); return; }
        if (!enabled()) { msg("trInMsg", T("tr_off"), "bad"); return; }
        if (send && send.code === code) { msg("trInMsg", T("tr_same"), "bad"); return; }
        $("trGet").disabled = true; msg("trInMsg", T("tr_getting"));
        var id;
        docId(code).then(function (x) { id = x; return fetch(base() + "/" + id + q()); }).then(function (r) {
            if (r.status === 404 || r.status === 403) throw new Error("nf");
            if (!r.ok) throw new Error("http " + r.status);
            return r.json();
        }).then(function (doc) {
            var f = doc.fields || {};
            return keyFor(code, id).then(function (key) {
                return crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(f.iv.stringValue) }, key, unb64(f.d.stringValue));
            });
        }).then(function (plain) {
            var j = parse(td.decode(plain));
            if (apply(j, "trInMsg")) fetch(base() + "/" + id + q(), { method: "DELETE" }).catch(function () {}); // gönderen cihaz "aktarıldı" görür
            else if (j && j.app === "rubikacademy") msg("trInMsg", "");
        }).catch(function (e) {
            msg("trInMsg", T(String(e && e.message) === "nf" ? "tr_notfound" : "tr_err"), "bad");
        }).then(function () { $("trGet").disabled = false; });
    }

    function wipe() {
        if (!confirm(T("confirm_wipe"))) return;
        Object.keys(collect()).forEach(function (k) { if (["site-lang", "theme"].indexOf(k) < 0) { try { localStorage.removeItem(k); } catch (e) {} } });
        msg("vrMsg", T("wiped"), "ok"); renderSummary();
    }
    function init() {
        $("vrDownload").addEventListener("click", download);
        $("vrUpload").addEventListener("click", function () { $("vrFile").click(); });
        $("vrFile").addEventListener("change", function () { if (this.files && this.files[0]) restore(this.files[0]); this.value = ""; });
        $("vrWipe").addEventListener("click", wipe);
        $("trSend").addEventListener("click", startSend);
        $("trStop").addEventListener("click", function () { stopSend(); });
        $("trGet").addEventListener("click", receive);
        $("trInput").addEventListener("input", function () {
            var d = this.value.replace(/\D/g, "").slice(0, 8);
            this.value = d.length > 4 ? d.slice(0, 4) + "-" + d.slice(4) : d;
            if (d.length === 8) receive(); // 8 hane girilince kendiliğinden alır
        });
        $("trInput").addEventListener("keydown", function (e) { if (e.key === "Enter") receive(); });
        if (!enabled()) { $("trBox").classList.add("off"); msg("trMsg", T("tr_off"), "bad"); }
        window.addEventListener("pagehide", function () { stopSend(); });
        document.addEventListener("site-lang-change", renderSummary);
        renderSummary();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
