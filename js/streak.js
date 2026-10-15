/* =========================================================
   GÜNLÜK SERİ (streak.js)
   Sitede pratik yapılan günleri kaydeder (antrenör, tanıma, günün karıştırması).
   localStorage "activity-days-v1": { "YYYY-MM-DD": { alg: n, recog: n, daily: n } }
========================================================= */
(function () {
    var KEY = "activity-days-v1";
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function load() { try { var o = JSON.parse(localStorage.getItem(KEY)); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
    function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
    function shift(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
    function current() {
        var days = load(), d = new Date(), n = 0;
        if (!days[dayKey(d)]) d = shift(d, -1);      // bugün henüz pratik yoksa seri dünden sayılır
        while (days[dayKey(d)]) { n++; d = shift(d, -1); }
        return n;
    }
    function best() {
        var keys = Object.keys(load()).sort(), b = 0, run = 0, prev = null;
        keys.forEach(function (k) {
            var p = k.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
            run = prev && dayKey(shift(prev, 1)) === k ? run + 1 : 1;
            b = Math.max(b, run); prev = d;
        });
        return b;
    }
    function totals() {
        var t = { days: 0, alg: 0, recog: 0, daily: 0 }, days = load();
        Object.keys(days).forEach(function (k) { t.days++; ["alg", "recog", "daily"].forEach(function (f) { t[f] += days[k][f] || 0; }); });
        return t;
    }
    window.Streak = {
        mark: function (type) {
            var o = load(), k = dayKey();
            var d = o[k] || (o[k] = {});
            d[type] = (d[type] || 0) + 1;
            save(o);
        },
        days: load, current: current, best: best, totals: totals, dayKey: dayKey, shift: shift
    };
})();
