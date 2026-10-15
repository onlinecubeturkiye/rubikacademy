/* =========================================================
   SIRALAMA TABLOSU (leaderboard.js) — Firestore REST API, SDK yok
   days/{gün}/times/{uid}: { name, t (ms), pen ("", "+2", "dnf"), v (sıralama değeri), ts (sunucu zamanı) }
   Gönderim için hesapla giriş gerekir (account.js); her hesap günde bir kez gönderebilir.
========================================================= */
(function () {
    var cfg = window.RA_FIREBASE || {};
    var DEV_KEY = "ra-device-id";
    function enabled() { return !!(cfg.apiKey && cfg.projectId); }
    function base() { return ((cfg.emulator && cfg.emulator.firestore) || cfg.host || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents"; }
    function q() { return "?key=" + encodeURIComponent(cfg.apiKey); }
    function deviceId() {
        var id = null;
        try { id = localStorage.getItem(DEV_KEY); } catch (e) {}
        if (!id || !/^[a-z0-9]{20}$/.test(id)) {
            var a = "abcdefghijklmnopqrstuvwxyz0123456789", r = new Uint8Array(20); id = "";
            (window.crypto || window.msCrypto).getRandomValues(r);
            for (var i = 0; i < 20; i++) id += a.charAt(r[i] % a.length);
            try { localStorage.setItem(DEV_KEY, id); } catch (e) {}
        }
        return id;
    }
    // Yerel tarihin gün numarası (sunucu kuralı ±1 gün tolerans tanır)
    function dayNum(d) { d = d || new Date(); return String(Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)); }
    function value(t, pen) { return pen === "dnf" ? 99999999 : t + (pen === "+2" ? 2000 : 0); }
    function submit(name, t, pen, day) {
        if (!window.Account || !Account.uid()) return Promise.resolve({ ok: false, needLogin: true });
        var uid = Account.uid(); day = day || dayNum();
        var doc = "projects/" + cfg.projectId + "/databases/(default)/documents/days/" + day + "/times/" + uid;
        var body = { writes: [{
            update: { name: doc, fields: {
                name: { stringValue: name }, t: { integerValue: String(t) }, pen: { stringValue: pen }, v: { integerValue: String(value(t, pen)) }
            } },
            currentDocument: { exists: false },
            updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }]
        }] };
        return Account.token().then(function (tk) {
            return fetch(base() + ":commit" + q(), { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tk }, body: JSON.stringify(body) });
        }).then(function (r) {
                if (r.ok) return { ok: true };
                return r.json().catch(function () { return {}; }).then(function (j) {
                    var st = j && j.error && j.error.status;
                    return { ok: false, exists: st === "ALREADY_EXISTS" || st === "FAILED_PRECONDITION", status: st || r.status };
                });
            });
    }
    function fetchDay(day, limit) {
        var body = { structuredQuery: { from: [{ collectionId: "times" }], orderBy: [{ field: { fieldPath: "v" }, direction: "ASCENDING" }], limit: limit || 100 } };
        return fetch(base() + "/days/" + (day || dayNum()) + ":runQuery" + q(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
            .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
            .then(function (rows) {
                var me = (window.Account && Account.uid()) || deviceId();
                return rows.filter(function (x) { return x.document; }).map(function (x) {
                    var f = x.document.fields || {};
                    return { name: f.name && f.name.stringValue || "?", t: +(f.t && f.t.integerValue || 0), pen: f.pen && f.pen.stringValue || "",
                        mine: x.document.name.split("/").pop() === me };
                });
            });
    }
    window.Leaderboard = { enabled: enabled, submit: submit, fetchDay: fetchDay, dayNum: dayNum, deviceId: deviceId };
})();
