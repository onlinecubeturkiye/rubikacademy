/* =========================================================
   REKOR TABLOSU (ev yarışması sayfasının içinde, #rekorlar)
   records/{uid} belgelerinden en iyi tekil / Ao5 / Ao12 sıralaması.
   İlk 3 kürsüde, sonrakiler listede; ilk 10 görünür, "Tümünü gör" ile 50'ye kadar.
   Her kategori bir kez okunur (sayfa içinde önbellek): Firebase okuma kotası için.
========================================================= */
(function () {
    var root = document.getElementById("rekorlar");
    if (!root) return;
    var cfg = window.RA_FIREBASE || {}, ev = "333", kind = "s", cache = {}, all = false;
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
    function fmt(ms) { var s = ms / 1000; if (s < 60) return s.toFixed(2); var m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(2).padStart(5, "0"); }
    function field() { return kind === "s" ? "s" + ev : kind + "_" + ev; }
    function me() { try { return window.Account && Account.user && Account.user() ? Account.user().uid : ""; } catch (e) { return ""; } }
    function link(r) { return "/icerikler/profil?u=" + encodeURIComponent(r.uid); }

    function load() {
        var f = field(), box = $("rkList");
        if (cache[f]) return render(cache[f]);
        box.innerHTML = '<div class="rk-empty"><span class="rk-spin"></span>Yükleniyor…</div>';
        var q = { structuredQuery: { from: [{ collectionId: "records" }],
            where: { fieldFilter: { field: { fieldPath: f }, op: "GREATER_THAN", value: { integerValue: "0" } } },
            orderBy: [{ field: { fieldPath: f }, direction: "ASCENDING" }], limit: 50 } };
        fetch("https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents:runQuery?key=" + encodeURIComponent(cfg.apiKey),
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (j) {
                var rows = (j || []).filter(function (x) { return x.document; }).map(function (x) {
                    var d = x.document, fl = d.fields || {}, g = function (k) { return fl[k] ? (fl[k].stringValue != null ? fl[k].stringValue : +fl[k].integerValue) : null; };
                    return { uid: d.name.split("/").pop(), name: g("name") || "Cuber", t: g(f), n: g("n") || 0, w: g("w") || 0 };
                });
                cache[f] = rows; if (field() === f) render(rows);
            })
            .catch(function () { if (field() === f) box.innerHTML = '<div class="rk-empty">Rekorlar yüklenemedi. <button type="button" class="rk-more" id="rkRetry">Tekrar dene</button></div>'; if ($("rkRetry")) $("rkRetry").onclick = load; });
    }

    function render(rows) {
        var box = $("rkList"), u = me();
        if (!rows.length) {
            box.innerHTML = '<div class="rk-empty"><b>Bu kategoride henüz rekor yok.</b>İlk rekoru sen kır: yukarıdan bir yarışmaya katıl.</div>';
            return;
        }
        // kürsü: 2 - 1 - 3 sırasıyla
        var top = rows.slice(0, 3), medal = ["🥇", "🥈", "🥉"];
        var pod = '<div class="rk-pod">' + [1, 0, 2].map(function (i) {
            var r = top[i]; if (!r) return '<div class="rk-p rk-p' + (i + 1) + ' empty"></div>';
            return '<a class="rk-p rk-p' + (i + 1) + (r.uid === u ? ' me' : '') + '" href="' + link(r) + '"><span class="rk-pm">' + medal[i] + '</span>' +
                '<span class="rk-pn">' + esc(r.name) + '</span><span class="rk-pt" dir="ltr">' + fmt(r.t) + '</span><span class="rk-pb">' + (i + 1) + '</span></a>';
        }).join("") + '</div>';
        var rest = rows.slice(3), shown = all ? rest : rest.slice(0, 7);
        var list = rest.length ? '<div class="rk-rows">' + shown.map(function (r, k) {
            return '<a class="rk-row' + (r.uid === u ? ' me' : '') + '" href="' + link(r) + '"><span class="rk-n">' + (k + 4) + '</span>' +
                '<span class="rk-name">' + esc(r.name) + '<small>' + r.n + ' tur' + (r.w ? ' · 🏆 ' + r.w : '') + '</small></span><span class="rk-t" dir="ltr">' + fmt(r.t) + '</span></a>';
        }).join("") + '</div>' : '';
        // kendi sıram (listede görünmüyorsa altta)
        var mine = -1; rows.forEach(function (r, k) { if (r.uid === u) mine = k; });
        var myRow = mine >= 3 + shown.length ? '<a class="rk-row me rk-mine" href="' + link(rows[mine]) + '"><span class="rk-n">' + (mine + 1) + '</span><span class="rk-name">Sen<small>' + esc(rows[mine].name) + '</small></span><span class="rk-t" dir="ltr">' + fmt(rows[mine].t) + '</span></a>' : '';
        var more = !all && rest.length > shown.length ? '<button type="button" class="rk-more" id="rkMore">Tümünü gör (' + rows.length + ')</button>' : '';
        box.innerHTML = pod + list + myRow + more;
        if ($("rkMore")) $("rkMore").onclick = function () { all = true; render(rows); };
    }

    function seg(id, attr, set) {
        $(id).addEventListener("click", function (e) {
            var b = e.target.closest("button"); if (!b || b.classList.contains("on")) return;
            Array.prototype.forEach.call($(id).children, function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
            set(b.getAttribute(attr)); all = false; load();
        });
    }
    seg("rkEv", "data-ev", function (v) { ev = v; });
    seg("rkKind", "data-k", function (v) { kind = v; });

    // tablo görünür olunca yükle (sayfanın altında; açılışta gereksiz okuma yapma)
    var started = false;
    function start() { if (started) return; started = true; load(); }
    if (location.hash === "#rekorlar") start();
    else if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); start(); } }, { rootMargin: "300px" });
        io.observe(root);
    } else start();
    window.addEventListener("hashchange", function () { if (location.hash === "#rekorlar") { start(); try { root.scrollIntoView({ behavior: "smooth" }); } catch (e) {} } });
    if (window.Account && Account.onChange) Account.onChange(function () { var f = field(); if (cache[f]) render(cache[f]); });
})();
