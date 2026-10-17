/* =========================================================
   SIRALAMA TABLOSU (leaderboard.js) — Firestore REST API, SDK yok
   days/{gün}/times/{uid}: { name, t (ms), pen ("", "+2", "dnf"), v (sıralama değeri), ts (sunucu zamanı) }
   Hesaba bağlıdır: yalnızca giriş yapmış kullanıcı kendi uid'sine gönderebilir
   ve günde bir kez (admin silerse tekrar gönderebilir).
========================================================= */
(function () {
    var cfg = window.RA_FIREBASE || {};
    function enabled() { return !!(cfg.apiKey && cfg.projectId); }
    function base() { return ((cfg.emulator && cfg.emulator.firestore) || cfg.host || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents"; }
    function q() { return "?key=" + encodeURIComponent(cfg.apiKey); }
    function acct() { return (window.Account && window.Account.enabled()) ? window.Account : null; }
    function signedIn() { var a = acct(); return !!(a && a.uid()); }
    // Yerel tarihin gün numarası (sunucu kuralı ±1 gün tolerans tanır)
    function dayNum(d) { d = d || new Date(); return String(Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)); }
    function value(t, pen) { return pen === "dnf" ? 99999999 : t + (pen === "+2" ? 2000 : 0); }
    function myName() {
        var a = acct(); if (!a) return "";
        var p = (a.localProfile && a.localProfile()) || {}, u = a.user();
        var n = (p && p.name) || (u && u.displayName) || (u && (u.email || "").split("@")[0]) || "";
        return String(n).replace(/\s+/g, " ").trim().slice(0, 20);
    }
    function submit(t, pen, day) {
        var a = acct(); if (!a || !a.uid()) return Promise.resolve({ ok: false, needAuth: true });
        var uid = a.uid(), name = myName();
        if (name.length < 2) return Promise.resolve({ ok: false, badName: true });
        day = day || dayNum();
        var doc = "projects/" + cfg.projectId + "/databases/(default)/documents/days/" + day + "/times/" + uid;
        var body = { writes: [{
            update: { name: doc, fields: {
                name: { stringValue: name }, t: { integerValue: String(t) }, pen: { stringValue: pen }, v: { integerValue: String(value(t, pen)) }
            } },
            currentDocument: { exists: false },
            updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }]
        }] };
        return a.token().then(function (tok) {
            return fetch(base() + ":commit" + q(), { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify(body) })
                .then(function (r) {
                    if (r.ok) return { ok: true };
                    return r.json().catch(function () { return {}; }).then(function (j) {
                        var st = j && j.error && j.error.status;
                        return { ok: false, exists: st === "ALREADY_EXISTS" || st === "FAILED_PRECONDITION", status: st || r.status };
                    });
                });
        }, function () { return { ok: false, needAuth: true }; });
    }
    // Giriş yapmış kullanıcının o güne gönderimi var mı? (admin silince tekrar gönderebilsin)
    function hasSubmitted(day) {
        var a = acct(); if (!a || !a.uid()) return Promise.resolve(false);
        day = day || dayNum();
        return fetch(base() + "/days/" + day + "/times/" + a.uid() + q())
            .then(function (r) { return r.ok; }).catch(function () { return null; });
    }
    function fetchDay(day, limit) {
        var body = { structuredQuery: { from: [{ collectionId: "times" }], orderBy: [{ field: { fieldPath: "v" }, direction: "ASCENDING" }], limit: limit || 100 } };
        return fetch(base() + "/days/" + (day || dayNum()) + ":runQuery" + q(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
            .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
            .then(function (rows) {
                var me = signedIn() ? acct().uid() : null;
                return rows.filter(function (x) { return x.document; }).map(function (x) {
                    var f = x.document.fields || {}, id = x.document.name.split("/").pop();
                    return { name: f.name && f.name.stringValue || "?", t: +(f.t && f.t.integerValue || 0), pen: f.pen && f.pen.stringValue || "",
                        uid: id, mine: !!me && id === me };
                });
            });
    }
    window.Leaderboard = { enabled: enabled, submit: submit, fetchDay: fetchDay, dayNum: dayNum, signedIn: signedIn, myName: myName, hasSubmitted: hasSubmitted };
})();
