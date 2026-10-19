/* Rubik Academy service worker
   - Sayfalar: önce ağ (güncel içerik), bağlantı yoksa önbellek
   - CSS/JS/JSON/görseller: önbellekten hemen ver, arka planda güncelle
   - Algoritma sayfaları ve antrenör kurulumda önceden indirilir (çevrimdışı açılsın diye)
   Sürüm (VERSION) değişince eski önbellek silinir. */
var VERSION = "ra-20261124";
var PRECACHE = [
    "/",
    "/icerikler.html",
    "/icerikler/algoritmalar.html",
    "/icerikler/baslangic.html",
    "/icerikler/f2l.html",
    "/icerikler/yol-haritasi.html",
    "/icerikler/kocluklar.html",
    "/icerikler/videolar.html",
    "/icerikler/sss.html",
    "/icerikler/algoritmalar/oll.html",
    "/icerikler/algoritmalar/pll.html",
    "/icerikler/algoritmalar/coll.html",
    "/icerikler/algoritmalar/zbll.html",
    "/icerikler/algoritmalar/megaminx.html",
    "/icerikler/algoritmalar/square1.html",
    "/icerikler/algoritmalar/mgSvg.js?v=20261124",
    "/icerikler/algoritmalar/sq1Svg.js?v=20261124",
    "/icerikler/algoritmalar/wv.html",
    "/icerikler/algoritmalar/cll.html",
    "/icerikler/algoritmalar/ortega-oll.html",
    "/icerikler/algoritmalar/ortega-pbl.html",
    "/icerikler/algoritmalar/eg1.html",
    "/icerikler/algoritmalar/eg2.html",
    "/icerikler/algoritmalar/4x4.html",
    "/icerikler/algoritmalar/5x5.html",
    "/icerikler/algoritmalar/pyraminx.html",
    "/icerikler/algoritmalar/skewb.html",
    "/icerikler/algoritmalar/roux.html",
    "/icerikler/algoritmalar/2look-oll.html",
    "/icerikler/algoritmalar/2look-pll.html",
    "/icerikler/algoritmalar/antrenor.html",
    "/icerikler/algoritmalar/yazdir.html",
    "/icerikler/algoritmalar/tanima-pll.json?v=20261124",
    "/js/cross-solver.js?v=20261124",
    "/js/recog-trainer.js?v=20261124",
    "/styles/common.css?v=20261124",
    "/js/i18n.js?v=20261124",
    "/js/common.js?v=20261124",
    "/js/custom-algs.js?v=20261124",
    "/darkmode.js",
    "/icerikler/algoritmalar/ll.js",
    "/icerikler/algoritmalar/cllSvg.js",
    "/icerikler/algoritmalar/ortegaSvg.js",
    "/icerikler/algoritmalar/ortegaOllSvg.js",
    "/icerikler/algoritmalar/antrenor-bt.js?v=20261124",
    "/icons/icon-192.png",
    "/icons/favicon-48.png",
    "/manifest.webmanifest",
    "/icerikler/algoritmalar/oll-pll.json",
    "/icerikler/algoritmalar/oll-pll.json?v=20261124",
    "/icerikler/algoritmalar/coll.json",
    "/icerikler/algoritmalar/coll.json?v=20261124",
    "/icerikler/algoritmalar/wv.json",
    "/icerikler/algoritmalar/wv.json?v=20261124",
    "/icerikler/algoritmalar/cll.json",
    "/icerikler/algoritmalar/cll.json?v=20261124",
    "/icerikler/algoritmalar/ortega-oll.json",
    "/icerikler/algoritmalar/ortega-oll.json?v=20261124",
    "/icerikler/algoritmalar/ortega-pbl.json",
    "/icerikler/algoritmalar/ortega-pbl.json?v=20261124",
    "/icerikler/algoritmalar/eg.json",
    "/icerikler/algoritmalar/eg.json?v=20261124",
    "/icerikler/algoritmalar/antrenor-karistirmalar.json?v=20261124",
    "/icerikler/algoritmalar/4x4.json?v=20261124",
    "/icerikler/algoritmalar/5x5.json?v=20261124",
    "/icerikler/algoritmalar/pyraminx.json?v=20261124",
    "/icerikler/algoritmalar/roux.json",
    "/icerikler/algoritmalar/skewb.json?v=20261124"
];

self.addEventListener("install", function (event) {
    event.waitUntil(caches.open(VERSION).then(function (cache) {
        // Biri başarısız olsa da diğerleri önbelleğe girsin
        return Promise.all(PRECACHE.map(function (url) {
            return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
        }));
    }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
    event.waitUntil(caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }));
});

function fromCache(request) {
    return caches.open(VERSION).then(function (cache) {
        return cache.match(request).then(function (hit) {
            if (hit) return hit;
            // ?v= sürümü farklıysa veya .html'li/.html'siz adres
            return cache.match(request, { ignoreSearch: true }).then(function (hit2) {
                if (hit2 || request.mode !== "navigate") return hit2;
                var url = new URL(request.url), p = url.pathname;
                var alt = p.endsWith(".html") ? p.slice(0, -5) : p + ".html";
                if (p.endsWith("/index.html")) alt = p.slice(0, -10);
                return cache.match(alt, { ignoreSearch: true });
            });
        });
    });
}

self.addEventListener("fetch", function (event) {
    var req = event.request;
    if (req.method !== "GET") return;
    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // Google Analytics, fontlar vb. tarayıcıya kalsın

    if (req.mode === "navigate") {
        event.respondWith(fetch(req).then(function (res) {
            if (res && res.ok) {
                var copy = res.clone();
                caches.open(VERSION).then(function (c) { c.put(req, copy); });
            }
            if (res && res.ok) return res;
            // Sunucu hata verdiyse (ör. .html'siz adres) önbellekteki sürümü dene
            return fromCache(req).then(function (hit) { return hit || res; });
        }).catch(function () {
            return fromCache(req).then(function (hit) { return hit || caches.match("/", { ignoreSearch: true }); });
        }));
        return;
    }

    // CSS/JS/JSON: aynı adres (?v= dahil) önbellekte varsa hemen ver, arka planda güncelle.
    // Sürümü farklı bir kopyayı ASLA ağdan önce verme: eski (ör. hatalı) dosya yeni sayfaya karışmasın.
    // Farklı sürümlü kopya sadece çevrimdışıyken kullanılır.
    event.respondWith(caches.open(VERSION).then(function (cache) { return cache.match(req); }).then(function (hit) {
        var net = fetch(req).then(function (res) {
            if (res && res.ok) {
                var copy = res.clone();
                caches.open(VERSION).then(function (c) { c.put(req, copy); });
            }
            return res;
        });
        if (hit) { net.catch(function () {}); return hit; }
        return net.catch(function () { return fromCache(req); });
    }));
});

/* ---------- Web Push: arka planda bildirim ---------- */
self.addEventListener("push", function (event) {
    var d = {};
    try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
    var title = d.title || "Rubik Academy", body = d.body || "", tag = d.tag || "ra", url = d.url || "/";
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
        // Site o an önündeyse sistem bildirimi yerine site içi bildirim göster
        var front = list.filter(function (c) { return c.focused; })[0];
        if (front) { front.postMessage({ type: "ra-push", body: body, tag: tag }); return; }
        return self.registration.showNotification(title, { body: body, tag: tag, icon: "/icons/icon-192.png", badge: "/icons/favicon-48.png", data: { url: url } });
    }));
});

// Bildirime tıklayınca siteyi (ana sayfa) aç; açık sekme varsa onu öne getir
self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    var url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
        var c = list.filter(function (x) { return new URL(x.url).origin === self.location.origin; })[0];
        if (c) return c.focus().then(function (w) { return (w || c).navigate ? (w || c).navigate(url).catch(function () {}) : null; });
        return self.clients.openWindow(url);
    }));
});
