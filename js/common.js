/* Sade tema yenilendi: eski "Klasik" (mor) temada kalanlar bir kez yeni temaya alınır */
try { if (!localStorage.getItem("ra-zkt1")) { localStorage.setItem("ra-zkt1", "1"); if (localStorage.getItem("site-skin") === "klasik") { localStorage.setItem("site-skin", "standart"); document.documentElement.removeAttribute("data-skin"); } } } catch (e) {}
/* =========================================================
   KİŞİSEL VERİ YALNIZ HESAPTA (her şeyden önce çalışır)
   - Algoritma ilerlemesi, antrenör geçmişi, yol haritası, çözüm geçmişleri, günlük sonuçlar,
     kendi algoritmaların: giriş yapılmamışsa cihaza yazılmaz, yalnız sayfa açıkken bellekte durur
     (yenileyince / çıkınca sıfırlanır). Giriş yapılınca hesapla senkronlanır.
   - Hesaptan çıkınca ya da bu cihazda oturum yokken cihazda kalan kişisel veri silinir.
   - Tema, dil, renk körlüğü, tutuş gibi tercihler herkes için saklanır.
========================================================= */
/* Sade tema geçişi (bir kerelik): daha önce Ayarlar'dan seçilmiş renkli temayı sıfırla,
   herkes sade varsayılan görünüme geçsin. İsteyen Ayarlar'dan yeniden tema seçebilir. */
(function () {
    try {
        if (localStorage.getItem("ra-sade-v1")) return;
        localStorage.setItem("ra-sade-v1", "1");
        if (localStorage.getItem("site-skin")) { localStorage.removeItem("site-skin"); document.documentElement.removeAttribute("data-skin"); }
    } catch (e) {}
})();
/* =========================================================
   ANDROID UYGULAMASI KÖPRÜSÜ (window.RAApp)
   Uygulama siteyi kendi WebView'inde açar ve window.RAAppNative verir (android/…/MainActivity.java).
   Yanıtlar window.raAppCb(id, değer) ile gelir; burada Promise'e çevrilir.
   RAApp.info() → { v, push: granted|default|denied|unavailable, google: bool }
   RAApp.call("requestPush" | "pushToken" | "googleSignIn" | "ble" | "saveFile" | "share" | "print" | "openExternal" | "setBars", arg)
========================================================= */
(function () {
    var N = window.RAAppNative; if (!N) return;
    var cbs = {};
    window.raAppCb = function (id, v) { var f = cbs[id]; delete cbs[id]; if (f) f(v); };
    function call(m, arg) {
        return new Promise(function (res) {
            var id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            cbs[id] = res;
            try { N[m](id, typeof arg === "string" ? arg : JSON.stringify(arg || {})); } catch (e) { delete cbs[id]; res(null); }
        });
    }
    window.RAApp = {
        native: true, call: call,
        info: function () { try { return JSON.parse(N.info()) || {}; } catch (e) { return {}; } }
    };
    // WebView'de Web Bluetooth yok: akıllı küp / akıllı timer için navigator.bluetooth'un kullanılan kısmını yerel köprüyle (Ble.java) taklit et
    // Eski uygulama sürümünde Bluetooth köprüsü yok: sayfalar "uygulamayı güncelle" desin
    if (!N.ble && !navigator.bluetooth) window.RA_BT_UPDATE = true;
    if (N.ble && !navigator.bluetooth) (function () {
        function fail(n) { try { return new DOMException(n, /Error$/.test(n) ? n : "NetworkError"); } catch (e) { var x = new Error(n); x.name = n; return x; } }
        function ble(o) { return call("ble", o).then(function (r) { if (!r || r.err) { var e = fail(r ? r.err : "NetworkError"); e.code2 = r && r.err; throw e; } return r; }); }
        var AL = { battery_service: 0x180f, battery_level: 0x2a19, device_information: 0x180a, generic_access: 0x1800 };
        function U(u) {
            if (typeof u === "string" && AL[u] != null) u = AL[u];
            if (typeof u === "string" && /^[0-9a-f]{4}$/i.test(u)) u = parseInt(u, 16);
            if (typeof u === "number") return ("00000000" + u.toString(16)).slice(-8) + "-0000-1000-8000-00805f9b34fb";
            return String(u).toLowerCase();
        }
        function dv(b) { var s = atob(b || ""), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new DataView(a.buffer); }
        function b64(v) { var a = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength), s = ""; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
        function pick(list, u, many) {
            var l = u == null ? list : list.filter(function (x) { return x.uuid === U(u); });
            return l.length ? Promise.resolve(many ? l.slice() : l[0]) : Promise.reject(fail("NotFoundError"));
        }
        var devs = {}, advL = [], KK = "ra-ble-known";
        // Bağlanılan cihazlar hatırlanır: getDevices() onları verir, sayfalar tek dokunuşla yeniden bağlanır
        function known() { try { return JSON.parse(localStorage.getItem(KK)) || {}; } catch (e) { return {}; } }
        function remember(d) { try { var k = known(); k[d.id] = d.name || ""; localStorage.setItem(KK, JSON.stringify(k)); } catch (e) {} }
        function fireAdv(d, e) {
            var ev = new Event("advertisementreceived"), m = new Map();
            Object.keys(e.mfr || {}).forEach(function (k) { m.set(+k, dv(e.mfr[k])); });
            ev.device = d; ev.name = e.name; ev.rssi = e.rssi; ev.manufacturerData = m; ev.serviceData = new Map(); ev.uuids = e.uuids || [];
            d.dispatchEvent(ev);
        }
        class Chr extends EventTarget {
            constructor(s, c) {
                super(); var p = c.p; this.service = s; this.uuid = c.uuid; this.value = null;
                this.properties = { broadcast: !!(p & 1), read: !!(p & 2), writeWithoutResponse: !!(p & 4), write: !!(p & 8), notify: !!(p & 16), indicate: !!(p & 32) };
            }
            _o(op, x) { return ble(Object.assign({ op: op, id: this.service.device.id, s: this.service.uuid, c: this.uuid }, x)); }
            readValue() { var c = this; return this._o("read").then(function (v) { return (c.value = dv(v)); }); }
            writeValueWithResponse(v) { return this._o("write", { v: b64(v) }).then(function () {}); }
            writeValueWithoutResponse(v) { return this._o("write", { v: b64(v), nr: true }).then(function () {}); }
            writeValue(v) { return this.properties.write ? this.writeValueWithResponse(v) : this.writeValueWithoutResponse(v); }
            startNotifications() { var c = this; return this._o("notify", { on: true }).then(function () { return c; }); }
            stopNotifications() { var c = this; return this._o("notify", { on: false }).then(function () { return c; }); }
        }
        class Svc {
            constructor(d, s) { var sv = this; this.device = d; this.uuid = s.uuid; this.isPrimary = true; this._c = s.c.map(function (c) { var ch = new Chr(sv, c); d._chars[sv.uuid + "|" + ch.uuid] = ch; return ch; }); }
            getCharacteristic(u) { return pick(this._c, u); }
            getCharacteristics(u) { return pick(this._c, u, true); }
        }
        class Gatt {
            constructor(d) { this.device = d; this.connected = false; this._s = []; }
            connect() {
                var g = this, d = this.device;
                return ble({ op: "connect", id: d.id }).then(function (l) { d._chars = {}; g._s = l.map(function (s) { return new Svc(d, s); }); g.connected = true; remember(d); return g; });
            }
            disconnect() { if (!this.connected) return; this.connected = false; ble({ op: "disconnect", id: this.device.id }).catch(function () {}); this.device.dispatchEvent(new Event("gattserverdisconnected")); }
            getPrimaryService(u) { return pick(this._s, u); }
            getPrimaryServices(u) { return pick(this._s, u, true); }
        }
        class Dev extends EventTarget {
            constructor(id, n) { super(); this.id = id; this.name = n || ""; this._chars = {}; this._watch = false; this.watchingAdvertisements = false; this.gatt = new Gatt(this); }
            watchAdvertisements(o) {
                var d = this; d._watch = d.watchingAdvertisements = true;
                if (o && o.signal) o.signal.addEventListener("abort", function () { d._watch = d.watchingAdvertisements = false; ble({ op: "stopScan" }).catch(function () {}); });
                return ble({ op: "scan" }).then(function () { if (d._adv) setTimeout(function () { if (d._watch) fireAdv(d, d._adv); }, 0); });
            }
            forget() { try { var k = known(); delete k[this.id]; localStorage.setItem(KK, JSON.stringify(k)); } catch (e) {} return Promise.resolve(); }
        }
        function dev(id, n) { var d = devs[id] || (devs[id] = new Dev(id, n)); if (n) d.name = n; return d; }
        window.raBleEv = function (e) {
            var d;
            if (e.t === "adv") { d = dev(e.id, e.name); d._adv = e; advL.slice().forEach(function (f) { f(e); }); if (d._watch) fireAdv(d, e); }
            else if (e.t === "val") { d = devs[e.id]; var c = d && d._chars[e.s + "|" + e.c]; if (c) { c.value = dv(e.v); c.dispatchEvent(new Event("characteristicvaluechanged")); } }
            else if (e.t === "scanfail") { advL.slice().forEach(function (f) { f(e); }); }
            else if (e.t === "disc") { d = devs[e.id]; if (d && d.gatt.connected) { d.gatt.connected = false; d.dispatchEvent(new Event("gattserverdisconnected")); } }
        };
        function fit(f, e) {
            var n = e.name || "";
            if (f.name && n !== f.name) return false;
            if (f.namePrefix && n.indexOf(f.namePrefix) !== 0) return false;
            if (f.services && !f.services.every(function (s) { return (e.uuids || []).indexOf(U(s)) >= 0; })) return false;
            return !!(f.name || f.namePrefix || f.services);
        }
        function ok(o, e) {
            if ((o.exclusionFilters || []).some(function (f) { return fit(f, e); })) return false;
            return o.acceptAllDevices ? !!e.name : (o.filters || []).some(function (f) { return fit(f, e); });
        }
        var MSG = {
            BluetoothOff: ["Bluetooth kapalı. Açıp tekrar dene.", "Bluetooth'u aç", "bt"],
            NotAllowedError: ["Akıllı küpü bulmak için Bluetooth (Yakındaki cihazlar) izni gerekli.", "İzin ver", "retry"],
            PermDenied: ["Bluetooth izni kapalı. Ayarlar → İzinler → Yakındaki cihazlar'ı aç.", "Ayarları aç", "app"],
            LocationOff: ["Bu Android sürümünde Bluetooth araması için Konum açık olmalı.", "Konumu aç", "location"],
            NotSupportedError: ["Bu telefonda Bluetooth LE yok.", "", ""],
            ScanFailed: ["Arama başlatılamadı. Bluetooth'u kapatıp açmayı dene.", "Tekrar dene", "retry"]
        };
        function requestDevice(o) {
            o = o || {};
            var dark = document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark" ||
                (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.getAttribute("data-theme") !== "light");
            var C = dark ? { bg: "#1c1c1f", fg: "#f2f2f2", mu: "#a0a0a8", it: "#27272b", bd: "#36363c", ac: "#5b7cff" } : { bg: "#fff", fg: "#111", mu: "#666", it: "#f6f6f8", bd: "#e2e2e6", ac: "#2563eb" };
            return new Promise(function (res, rej) {
                var box = document.createElement("div"), seen = {}, k = known(), t0 = Date.now(), tick;
                box.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center";
                box.innerHTML = '<style>@keyframes raBleS{to{transform:rotate(360deg)}}.raBleI{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:13px 12px;margin:6px 0;border:1px solid ' + C.bd + ';border-radius:14px;background:' + C.it + ';color:' + C.fg + ';font:600 15px system-ui,sans-serif}.raBleI small{display:block;font-weight:400;color:' + C.mu + ';font-size:12px}.raBleI i{margin-left:auto;font-style:normal;color:' + C.ac + ';font-size:13px}</style>' +
                    '<div style="background:' + C.bg + ';color:' + C.fg + ';width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:18px 16px calc(20px + env(safe-area-inset-bottom));font:15px system-ui,sans-serif;max-height:75vh;overflow:auto">' +
                    '<div style="display:flex;align-items:center;gap:10px"><b style="font-size:17px">Bluetooth cihazı seç</b><span class="raBleSp" style="width:16px;height:16px;border:2px solid ' + C.bd + ';border-top-color:' + C.ac + ';border-radius:50%;animation:raBleS .8s linear infinite"></span></div>' +
                    '<p class="raBleM" style="margin:6px 0 10px;color:' + C.mu + ';font-size:13px">Küpü/timer\'ı uyandır (bir yüzü çevir) ve telefona yaklaştır. Aranıyor…</p>' +
                    '<button type="button" class="raBleA" style="display:none;width:100%;padding:12px;margin-bottom:6px;border:0;border-radius:12px;background:' + C.ac + ';color:#fff;font:600 15px system-ui,sans-serif"></button>' +
                    '<div class="raBleL"></div>' +
                    '<button type="button" class="raBleX" style="margin-top:12px;width:100%;padding:12px;border:0;border-radius:12px;background:' + C.it + ';color:' + C.fg + ';font:600 15px system-ui,sans-serif">İptal</button></div>';
                var list = box.querySelector(".raBleL"), msg = box.querySelector(".raBleM"), act = box.querySelector(".raBleA"), sp = box.querySelector(".raBleSp");
                function bars(r) { return r > -60 ? "▂▄▆█" : r > -72 ? "▂▄▆" : r > -85 ? "▂▄" : "▂"; }
                function on(e) {
                    if (e.t === "scanfail") { problem("ScanFailed"); return; }
                    if (!ok(o, e)) return;
                    var b = seen[e.id], add = !b;
                    if (add) {
                        b = seen[e.id] = document.createElement("button"); b.type = "button"; b.className = "raBleI";
                        b.onclick = function () { end(dev(e.id, e.name)); };
                        msg.textContent = "Bağlanmak için cihaza dokun.";
                    }
                    b._r = e.rssi;
                    b.innerHTML = '<span style="font-size:20px">🧊</span><span>' + String(e.name || e.id).replace(/</g, "&lt;") + '<small>' + (k[e.id] != null ? "Daha önce bağlandı · " : "") + bars(e.rssi) + '</small></span><i>Bağlan →</i>';
                    // Yeni cihaz gelince güçlü sinyal (yakındaki cihaz) üste; sonra sıra sabit kalır (dokunurken kaymasın)
                    if (add) Object.keys(seen).map(function (id) { return seen[id]; }).sort(function (a, b) { return b._r - a._r; }).forEach(function (x) { list.appendChild(x); });
                }
                function problem(code) {
                    var m = MSG[code] || ["Bluetooth başlatılamadı.", "Tekrar dene", "retry"];
                    msg.textContent = m[0]; sp.style.display = "none";
                    act.style.display = m[1] ? "" : "none"; act.textContent = m[1];
                    act.onclick = function () {
                        if (m[2] === "retry") start();
                        else { ble({ op: "open", what: m[2] }).catch(function () {}); msg.textContent = "Açtıktan sonra buraya dön; arama kendiliğinden başlar."; act.style.display = "none"; waitBack(); }
                    };
                }
                function waitBack() {
                    function vis() { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", vis); setTimeout(start, 400); } }
                    document.addEventListener("visibilitychange", vis);
                }
                function start() {
                    act.style.display = "none"; sp.style.display = ""; t0 = Date.now();
                    msg.textContent = "Küpü/timer'ı uyandır (bir yüzü çevir) ve telefona yaklaştır. Aranıyor…";
                    ble({ op: "scan" }).catch(function (er) {
                        var c = er.code2 || er.name;
                        problem(c);
                        if (c === "BluetoothOff") waitBack();
                    });
                }
                function end(d) {
                    clearInterval(tick);
                    var i = advL.indexOf(on); if (i >= 0) advL.splice(i, 1);
                    ble({ op: "stopScan" }).catch(function () {}); box.remove();
                    if (d) res(d); else rej(fail("NotFoundError"));
                }
                box.querySelector(".raBleX").onclick = function () { end(null); };
                box.addEventListener("click", function (ev) { if (ev.target === box) end(null); });
                // 20 sn'de bir şey bulunamazsa ipucu
                tick = setInterval(function () {
                    if (!Object.keys(seen).length && sp.style.display !== "none" && Date.now() - t0 > 20000)
                        msg.textContent = "Henüz cihaz bulunamadı. Küp başka bir telefona/bilgisayara bağlı olmasın; bir yüzünü çevirip bekle.";
                }, 2000);
                advL.push(on); document.body.appendChild(box);
                start();
            });
        }
        try {
            Object.defineProperty(navigator, "bluetooth", { configurable: true, value: {
                getAvailability: function () { return Promise.resolve(true); },
                getDevices: function () { var k = known(); return Promise.resolve(Object.keys(k).map(function (id) { return dev(id, k[id]); })); },
                requestDevice: requestDevice
            } });
        } catch (e) {}
    })();
    // Uygulamada Google girişi yoksa (google-services.json eksik derleme) Google düğmesini ve "veya" çizgisini gizle
    try {
        if (window.RAApp.info().google === false) {
            document.documentElement.classList.add("ra-nogoogle");
            var ng = document.createElement("style");
            ng.textContent = "html.ra-nogoogle .auth-google,html.ra-nogoogle .auth-or,html.ra-nogoogle .acc-google,html.ra-nogoogle .acc-or{display:none!important}";
            (document.head || document.documentElement).appendChild(ng);
        }
    } catch (e) {}
    // Yazdır / PDF: WebView window.print desteklemiyor → Android yazdırma
    window.print = function () { call("print"); };
    // Paylaş: WebView'de navigator.share yok → Android paylaşım menüsü (yalnız metin/bağlantı)
    if (!navigator.share) { try { navigator.share = function (d) { return call("share", { title: (d && d.title) || "", text: (d && d.text) || "", url: (d && d.url) || "" }).then(function () {}); }; } catch (e) {} }
    // Durum çubuğu rengi sitenin zeminine uysun (tema değişince de)
    function bars() {
        try {
            var c = getComputedStyle(document.body || document.documentElement).backgroundColor || "rgb(244,244,242)";
            var m = c.match(/\d+(\.\d+)?/g) || [244, 244, 242], r = +m[0], g = +m[1], b = +m[2];
            var hex = "#" + [r, g, b].map(function (x) { return ("0" + Math.round(x).toString(16)).slice(-2); }).join("");
            call("setBars", { bg: hex, light: (r * 299 + g * 587 + b * 114) / 1000 > 140 });
        } catch (e) {}
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bars); else bars();
    window.addEventListener("load", bars);
    try { new MutationObserver(bars).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-skin"] }); } catch (e) {}
})();
/* =========================================================
   UYGULAMA MODU (Android uygulaması / ana ekrana eklenmiş site)
   Algılama: ?source=twa|pwa, android-app:// yönlendireni ya da display-mode: standalone → oturum boyunca hatırlanır.
   html.ra-app: altta uygulama sekme çubuğu (Ana Sayfa · İçerikler · Antrenör · Yarışma · Profil),
   üst menü ve alt bilgi sadeleşir, "uygulama olarak yükle" gibi tarayıcı öğeleri gizlenir, güvenli alan boşluğu.
   Zamanlayıcı / yarışma odası / yayın ekranı gibi tam ekran sayfalarda sekme çubuğu çıkmaz.
========================================================= */
(function () {
    var on = false;
    try {
        var q = /[?&]source=(twa|pwa|app)\b/.test(location.search) || !!window.RAAppNative, ref = /^android-app:\/\//.test(document.referrer || "");
        var sa = window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches) || navigator.standalone === true;
        if (q || ref || sa) sessionStorage.setItem("ra-app", "1");
        on = sessionStorage.getItem("ra-app") === "1";
    } catch (e) {}
    window.RA_APP = on;
    if (!on) return;
    var d = document.documentElement; d.classList.add("ra-app");
    // uygulamaya özel parçalar (styles/app.css); renk teması sitedeki gibi Ayarlar'dan seçilir
    // sayfanın <head>'i app.css'i erken yüklediyse (ilk açılışta site görünümü yanıp sönmesin) tekrar ekleme
    if (!document.querySelector('link[href^="/styles/app.css"]')) { var ln = document.createElement("link"); ln.rel = "stylesheet"; ln.href = "/styles/app.css"; (document.head || d).appendChild(ln); }
    var path = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
    var noBar = /\/(zkttimer|sanal-kup|giris)$|\/algoritmalar\/yazdir|\/kup-arena\//.test(path);
    if (noBar) d.classList.add("ra-app-nobar");
    // Android uygulaması (RAAppNative) sistem çubuklarının boşluğunu zaten kendisi bırakıyor (MainActivity);
    // WebView env(safe-area-inset-*) değerini yine de verdiği için boşluk iki kat oluyordu → uygulamada 0
    var nat = !!window.RAAppNative;
    function safeInset(side) { return nat ? "0px" : "env(safe-area-inset-" + side + ",0px)"; }
    var st = document.createElement("style");
    st.textContent =
        "html.ra-app{-webkit-tap-highlight-color:transparent}" +
        // Alt çubuksuz sayfalarda (sanal küp, ZKT timer) aşağı çekip yenileme kapalı. "body{overscroll-behavior-y:none}"
        // Chrome / uygulama WebView'inde dokunarak kaydırmayı tamamen kilitliyordu → html'de "contain"
        "html.ra-app-nobar{overscroll-behavior-y:contain}" +
        // uygulama üst barı: logo + ad, ince ve sayfayla aynı zemin (site başlığı gibi durmasın)
        "html.ra-app .navbar{min-height:0;padding-bottom:8px;justify-content:center;position:sticky}html.ra-app .nav-logo{gap:10px;margin:0 auto}html.ra-app .nav-logo-mark{width:34px;height:34px}html.ra-app .nav-logo-text{display:inline!important;font-size:19px;font-weight:900;letter-spacing:-.4px}" +
        "html.ra-app .nav-right{position:absolute;right:12px;bottom:8px}" +
        // Uygulama düzeni (telefon): "Geri Dön" düğmesi yerine üst barda geri oku; başlıklar ve boşluklar sıkı
        "html.ra-app .nav-bar{display:none!important}" +
        ".ra-back{position:absolute;left:10px;bottom:6px;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--text,#111);cursor:pointer}" +
        ".ra-back svg{width:24px;height:24px}.ra-back:active{background:color-mix(in srgb,var(--text,#111) 8%,transparent)}" +
        "@media(max-width:899px){" +
            "html.ra-app .page{padding-top:14px!important;padding-left:14px!important;padding-right:14px!important}" +
            "html.ra-app .intro,html.ra-app section.intro{margin-bottom:16px!important;padding-top:4px!important}" +
            "html.ra-app .intro h1{font-size:30px!important;letter-spacing:-.8px!important;margin-bottom:8px!important;line-height:1.08!important}" +
            "html.ra-app .intro p{font-size:14px!important;line-height:1.55!important;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;cursor:pointer}" +
            "html.ra-app .intro p.ra-more{-webkit-line-clamp:unset;display:block}" +
            "html.ra-app .intro .badge,html.ra-app .intro-badge,html.ra-app .hero .badge{margin-bottom:10px!important;padding:6px 11px!important}" +
            "html.ra-app .hero{min-height:0!important;padding:22px 18px!important;margin-bottom:16px!important;border-radius:22px!important}" +
            "html.ra-app .hero h1{font-size:32px!important;letter-spacing:-1px!important;margin-bottom:10px!important}" +
            "html.ra-app .hero p{font-size:14px!important;line-height:1.55!important}" +
            "html.ra-app .hero-cube{display:none!important}" +
            "html.ra-app .box,html.ra-app .card{border-radius:20px}" +
        "}" +
        // üst menü: yalnız logo + hesap; sayfa bağlantıları alttaki sekmelerde
        "html.ra-app .nav-links{display:none!important}" +
        // hesap/profil alttaki "Profil" sekmesinde; üstte ikinci kez görünmesin (sekme çubuğu olmayan sayfalarda kalır)
        "html.ra-app #accWrap{display:none!important}" +
        "html.ra-app .navbar{padding-top:max(" + safeInset("top") + ",10px)}" +
        "html.ra-app footer{display:none!important}" +
        "html.ra-app #btnInstall,html.ra-app .pwa-install,html.ra-app [data-install]{display:none!important}" +
        "html.ra-app:not(.ra-app-nobar) body{padding-bottom:calc(74px + " + safeInset("bottom") + ")}" +
        ".ra-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:900;display:grid;grid-template-columns:repeat(5,1fr);padding:6px 6px calc(6px + " + safeInset("bottom") + ");" +
            "background:color-mix(in srgb,var(--surface,#fff) 92%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--border,#e5e7eb);box-shadow:0 -6px 20px rgba(0,0,0,.08)}" +
        ".ra-tabbar a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:54px;border-radius:14px;color:var(--text-soft,#6b7280);text-decoration:none;font:800 11px Inter,system-ui,sans-serif;letter-spacing:.1px}" +
        ".ra-tabbar a svg{width:24px;height:24px}" +
        ".ra-tabbar a.on{color:var(--ui-accent,#6c5ce7);background:color-mix(in srgb,var(--ui-accent,#6c5ce7) 12%,transparent)}" +
        ".ra-tabbar a:active{transform:scale(.94)}" +
        "html.ra-app-nobar .ra-tabbar{display:none}" +
        ".ra-tabbar.six{grid-template-columns:repeat(6,1fr)}.ra-tabbar.six a{font-size:10px}@media(min-width:900px){.ra-tabbar.six{width:640px}}" +
        "html.ra-app:not(.ra-app-nobar) .ra-pushask{bottom:calc(86px + " + safeInset("bottom") + ")}" +
        "body.c-in-room .ra-tabbar{display:none}" +
        "@media(min-width:900px){.ra-tabbar{left:50%;right:auto;transform:translateX(-50%);width:560px;bottom:12px;border-radius:22px;border:1px solid var(--border,#e5e7eb);padding:6px}html.ra-app:not(.ra-app-nobar) body{padding-bottom:96px}}" +
        "@media print{.ra-tabbar{display:none}}";
    (document.head || d).appendChild(st);
    var ic = function (p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
    var TABS = [
        ["/", "Ana Sayfa", ic('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>'), /^\/$/],
        ["/icerikler", "İçerikler", ic('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'), /^\/icerikler$|^\/icerikler\/(algoritmalar(?!\/antrenor)|videolar|kup-rehberi|cozucu|akilli-kup|yol-haritasi|dersler|keyhole|sss|cekilis)/],
        ["/icerikler/algoritmalar/antrenor", "Antrenör", ic('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'), /antrenor/],
        ["/icerikler/ev-yarismasi", "Yarışma", ic('<path d="M8 4h8v4.5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5a2.5 2.5 0 0 0 3 4M16 5.5h3a2.5 2.5 0 0 1-3 4"/><path d="M12 12.5V16M8.5 20h7M10 16h4v4h-4z"/>'), /ev-yarismasi|rekorlar/],
        ["/icerikler/profil", "Profil", ic('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'), /profil|ayarlar/]
    ];
    function bar() {
        if (noBar || document.getElementById("raTabbar") || !document.body) return;
        var n = document.createElement("nav"); n.id = "raTabbar"; n.className = "ra-tabbar ra-noico"; n.setAttribute("aria-label", "Uygulama menüsü");
        n.innerHTML = TABS.map(function (t) { var cur = t[3].test(path); return '<a href="' + t[0] + '"' + (cur ? ' class="on" aria-current="page"' : '') + '>' + t[2] + '<span>' + t[1] + '</span></a>'; }).join("");
        document.body.appendChild(n);
        admTab();
    }
    if (document.body) bar(); else document.addEventListener("DOMContentLoaded", bar);
    // Ana sekmeler dışındaki sayfalarda üst barda geri oku (sayfadaki "Geri Dön" gizli)
    var ROOT = /^\/$|^\/icerikler$|^\/icerikler\/(algoritmalar\/antrenor|ev-yarismasi|profil|admin)$/;
    function backBtn() {
        var nb = document.querySelector(".navbar"); if (!nb || ROOT.test(path) || document.getElementById("raBack")) return;
        var old = document.querySelector(".nav-bar .back-btn"), fallback = (old && old.getAttribute("href")) || "/icerikler";
        var b = document.createElement("button"); b.type = "button"; b.id = "raBack"; b.className = "ra-back"; b.setAttribute("aria-label", "Geri");
        b.innerHTML = ic('<path d="M15 5 8 12l7 7"/>');
        b.onclick = function () { if (history.length > 1 && document.referrer && document.referrer.indexOf(location.origin) === 0) history.back(); else location.href = fallback; };
        nb.appendChild(b);
    }
    // uzun giriş yazısı 3 satır; dokununca tamamı
    document.addEventListener("click", function (e) { var p = e.target.closest && e.target.closest(".intro p"); if (p) p.classList.toggle("ra-more"); });
    if (document.readyState !== "loading") backBtn(); else document.addEventListener("DOMContentLoaded", backBtn);
    // Yönetim sekmesi: yalnız site yöneticisinde (giriş doğrulanınca); hata/oturum yoksa hiç görünmez
    var ADM = ["/icerikler/admin", "Yönetim", ic('<path d="M12 3.5 19 6v5.5c0 4.3-3 7.7-7 9-4-1.3-7-4.7-7-9V6z"/><path d="m9 12 2 2 4-4"/>'), /\/admin$/];
    function admTab() {
        var n = document.getElementById("raTabbar"); if (!n || !ADM) return;
        // Oturum geri yüklenene kadar son oturumdaki bilgiyle göster (sayfa geçişlerinde sekme kaybolup gelmesin)
        var on = false;
        try {
            if (window.Account && Account.adminHint) on = !!Account.adminHint();
            else on = localStorage.getItem("ra-auth-v1") === "1" && !!(JSON.parse(localStorage.getItem("ra-acc-hint-v1") || "{}") || {}).a;
        } catch (e) {}
        var a = document.getElementById("raTabAdm");
        if (on && !a) {
            a = document.createElement("a"); a.id = "raTabAdm"; a.href = ADM[0]; if (ADM[3].test(path)) { a.className = "on"; a.setAttribute("aria-current", "page"); }
            a.innerHTML = ADM[2] + "<span>" + ADM[1] + "</span>"; n.insertBefore(a, n.lastChild); n.classList.add("six");
        } else if (!on && a) { a.remove(); n.classList.remove("six"); }
    }
    admTab();
    document.addEventListener("account-change", admTab);
    document.addEventListener("DOMContentLoaded", function () { setTimeout(admTab, 0); });
})();
// RA ikonları: sitedeki emojileri Rubik Academy'ye özel ikonlarla değiştirir (js/ra-icons.js)
(function () {
    try {
        var hasIcons = window.RAIcons || document.querySelector('script[src*="/js/ra-icons.js"]');
        var me = document.currentScript && document.currentScript.src || "", v = (/[?&]v=([^&]+)/.exec(me) || [])[1] || "";
        if (!hasIcons) { var sc = document.createElement("script"); sc.src = "/js/ra-icons.js" + (v ? "?v=" + v : ""); sc.defer = true; (document.head || document.documentElement).appendChild(sc); }
        // özel paketler (hesaba atanmış tema / algoritma): önbellekteki tema hemen, güncel liste packs.js ile
        var pc = ""; try { pc = localStorage.getItem("ra-pack-css") || ""; } catch (e) {}
        if (pc) { var ps = document.createElement("style"); ps.id = "raPackCss"; ps.textContent = pc; (document.head || document.documentElement).appendChild(ps); }
        try { var sk0 = localStorage.getItem("site-skin") || "", pm = localStorage.getItem("ra-pack-mode"); if (pc && sk0.indexOf("p-") === 0 && pm) document.documentElement.classList.toggle("dark-mode", pm === "dark"); } catch (e) {}
        var pk = document.createElement("script"); pk.src = "/js/packs.js" + (v ? "?v=" + v : ""); pk.defer = true;
        (document.head || document.documentElement).appendChild(pk);
    } catch (e) {}
})();
(function () {
    var PRIV = /^(algo-progress-|algo-set-|recog-|roadmap-|trainer-stats-v1$|daily-results-v1$|daily-sent-v1$|daily-name-v1$|custom-algs-v1$|timer-solves-v1$|smart-solves-v1$|vcube-times-v1$|activity-days-v1$|comp-stats-v1$|lessons-v1$|ra-profile-v1$|ra-last-page$|ra-sync-meta-v1$|ra-rec-(x|xc|pin|last)$)/;
    var ls; try { ls = window.localStorage; if (!ls) return; } catch (e) { return; }
    var S = Storage.prototype, oGet = S.getItem, oSet = S.setItem, oRem = S.removeItem, oKey = S.key;
    function signed() { try { return oGet.call(ls, "ra-auth-v1") === "1"; } catch (e) { return false; } }
    var mem = {};
    function purge() {
        var del = [];
        try { for (var i = 0; i < ls.length; i++) { var k = oKey.call(ls, i); if (k && PRIV.test(k)) del.push(k); } } catch (e) {}
        del.forEach(function (k) { try { oRem.call(ls, k); } catch (e) {} });
        mem = {};
        return del.length;
    }
    if (!signed()) purge();
    function priv(st, k) { return st === ls && PRIV.test(String(k)) && !signed(); }
    S.getItem = function (k) { if (priv(this, k)) return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; return oGet.call(this, k); };
    S.setItem = function (k, v) { if (priv(this, k)) { mem[k] = String(v); return; } return oSet.call(this, k, v); };
    S.removeItem = function (k) { if (priv(this, k)) { delete mem[k]; return; } return oRem.call(this, k); };
    window.raPurgePrivate = purge;
    window.raIsPrivateKey = function (k) { return PRIV.test(String(k)); };
    // Bağlanan akıllı küp modelleri (admin panelindeki "akıllı küp modelleri" için profil özetine girer)
    window.raNoteCube = function (name) {
        name = String(name || "").trim().slice(0, 40); if (!name) return;
        try { var o = JSON.parse(localStorage.getItem("ra-bt-cubes-v1") || "{}") || {}; o[name] = Date.now(); localStorage.setItem("ra-bt-cubes-v1", JSON.stringify(o)); } catch (e) {}
    };
    // Hata kayıtları: tarayıcıdaki JavaScript hataları errs koleksiyonuna yazılır (yalnız admin okur).
    // Sayfa başına en çok 3, aynı hata oturumda bir kez.
    (function () {
        var sent = 0;
        function report(msg, src, line) {
            try {
                var A0 = window.Account; if (!(A0 && A0.isAdmin && A0.isAdmin())) return; // hata kayıtları yalnız yöneticiden toplanır
                var cfg = window.RA_FIREBASE; if (!cfg || !cfg.apiKey || sent >= 3 || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return;
                msg = String(msg || "").slice(0, 300); if (!msg || /ResizeObserver loop|Script error\.?$/.test(msg)) return;
                var key = "ra-err:" + msg.slice(0, 80) + "|" + line;
                if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1");
                sent++;
                var u = "", A = window.Account; try { u = A && A.user && A.user() ? A.user().uid : ""; } catch (e) {}
                var f = { m: { stringValue: msg }, s: { stringValue: String(src || "").replace(location.origin, "").slice(0, 200) }, l: { integerValue: String(+line || 0) },
                    p: { stringValue: location.pathname.slice(0, 120) }, ua: { stringValue: navigator.userAgent.slice(0, 200) }, u: { stringValue: String(u).slice(0, 40) },
                    v: { stringValue: String((document.querySelector('script[src*="common.js"]') || {}).src || "").replace(/.*v=/, "").slice(0, 20) } };
                var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
                fetch("https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents/errs?documentId=" + id + "&key=" + encodeURIComponent(cfg.apiKey) +
                    "&mask.fieldPaths=m", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: f }), keepalive: true }).catch(function () {});
            } catch (e) {}
        }
        window.addEventListener("error", function (e) { if (e && e.message) report(e.message, e.filename, e.lineno); });
        window.addEventListener("unhandledrejection", function (e) { var r = e && e.reason; if (r && (r.message || typeof r === "string")) report("Promise: " + (r.message || r), r.stack ? String(r.stack).split("\n")[1] : "", 0); });
        window.raReportError = report;
    })();
})();

/* =========================================================
   RUBIK ACADEMY — ORTAK JS (common.js)
   Tüm sayfalarda şu sırayla eklenir:

   <script>var PAGE_ID = "index";</script>
   <script src="/js/i18n.js"></script>
   <script src="/js/common.js"></script>

   Bu dosya şunları yönetir:
   - Karanlık mod (localStorage: "theme")
   - Renk körlüğü temaları (localStorage: "cvd-theme", antrenörde sorulur)
   - Dil seçici motoru (localStorage: "site-lang")
   - Dil menüsünün otomatik oluşturulması (SITE_I18N.languages)
   - Scroll reveal (IntersectionObserver)

   NOT: Çeviri metinleri SITE_I18N (i18n.js) içinde,
   PAGE_ID ile sayfaya özel + common (nav/footer) birleştirilir.
   Yeni dil eklemek için sadece i18n.js düzenlenir.
========================================================= */

/* Sayfa render olmadan önce (flash önlemek için) tema class'ını uygula */
(function () {
    var savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark-mode");
    }
})();

/* =========================================
   KARANLIK MOD (sağ üstteki 🌙/☀️ düğmesi, localStorage "theme")
========================================= */
function toggleDarkMode() {
    var isDark = document.documentElement.classList.toggle("dark-mode");
    document.body.classList.toggle("dark-mode", isDark);
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch (e) {}
    raSavePrefs();
    var btn = document.getElementById("darkModeBtn");
    if (btn) btn.innerHTML = isDark ? "☀️" : "🌙";
}

/* =========================================
   RENK KÖRLÜĞÜ TEMASI (localStorage "cvd-theme": "" | pro | deu | rg | tri)
   Antrenöre ilk girişte sorulur; seçim tüm sitede geçerlidir.
   Küp renkleri (CSS değişkenleri ve tüm SVG diyagramları) seçilen
   palete çevrilir. Paletler Machado (2009) renk körlüğü benzetimiyle
   seçildi: en zor ayrılan iki renk arasındaki OKLab farkı
   kırmızı-yeşil temada 4 → 14,6, mavi-sarı temada 6 → 19.
========================================= */
/* Sitede küp renkleri için kullanılan tonlar → renk ailesi */
var CVD_FAMILY = {
    "#e6252f": "R", "#e53935": "R", "#d12d28": "R", "#f0383a": "R", "#ef4444": "R",
    "#ff7a1a": "O", "#f97316": "O", "#fb8c00": "O", "#ff8a1f": "O",
    "#f6c719": "Y", "#ffd21f": "Y", "#fdd835": "Y", "#ffe600": "Y",
    "#179e4f": "G", "#12a04a": "G", "#16a34a": "G", "#16b364": "G", "#2ecc71": "G",
    "#1e6fe6": "B", "#1e6fe0": "B", "#2c6fe6": "B", "#1d5bff": "B", "#4f7dff": "B",
    "#eef2f3": "W"
};
/* pro / deu: tek türe göre seçildi (Machado 2009 benzetimi, beyaz ve gri dahil en zor ayrılan
   iki renk arasındaki OKLab farkı: protanopi 4,1 → 15,6, döteranopi 5,5 → 17,9).
   rg: türünü bilmeyenler için ikisinde de dengeli (14,6 / 15,1). */
var CVD_PALETTES = {
    pro: { R: "#f45d73", O: "#ec9b01", Y: "#fefc0c", G: "#5bcbb0", B: "#7f9ef7" },
    deu: { R: "#b84109", O: "#f89b12", Y: "#fbfe17", G: "#3fb298", B: "#5369d3" },
    rg:  { R: "#f4390b", O: "#faa51e", Y: "#fcf765", G: "#17b1a5", B: "#0270e3" },
    tri: { R: "#9d0100", O: "#eb6014", Y: "#e2b716", G: "#4cf053", B: "#0587f7" }
};
var NORMAL_SWATCH = { W: "#eef2f3", Y: "#f6c719", R: "#d12d28", O: "#ff7a1a", G: "#179e4f", B: "#2c6fe6" };
function cvdTheme() { try { return localStorage.getItem("cvd-theme") || ""; } catch (e) { return ""; } }

/* Tutuş: bir sayfa window.RA_HOLD_SWAP = { Y: "W", W: "Y", ... } verirse diyagramlardaki küp renkleri
   bu eşlemeyle değiştirilir (ör. antrenörde beyaz üst tutuş). data-hold-skip içindekiler etkilenmez. */
function holdSwap() { return (window.RA_HOLD_SWAP && typeof window.RA_HOLD_SWAP === "object") ? window.RA_HOLD_SWAP : null; }
/* Bir alt ağaçtaki SVG renklerini seçili palete çevir (orijinal renk data-cvdo'da saklanır) */
function cvdRecolor(root) {
    var pal = CVD_PALETTES[cvdTheme()] || null, swap = holdSwap();
    if (!root || !root.querySelectorAll) return;
    var list = root.querySelectorAll("[fill], [data-cvdo]");
    var els = (root.hasAttribute && (root.hasAttribute("fill") || root.hasAttribute("data-cvdo"))) ? [root] : [];
    for (var i = 0; i < list.length; i++) els.push(list[i]);
    els.forEach(function (el) {
        var orig = el.getAttribute("data-cvdo") || el.getAttribute("fill");
        var fam = orig && CVD_FAMILY[orig.toLowerCase()];
        if (!fam) return;
        if (!el.hasAttribute("data-cvdo")) el.setAttribute("data-cvdo", orig);
        var f2 = (swap && swap[fam] && !el.closest("[data-hold-skip]")) ? swap[fam] : fam;
        var want = pal ? (pal[f2] || NORMAL_SWATCH[f2]) : (f2 === fam ? orig : NORMAL_SWATCH[f2]);
        if (el.getAttribute("fill") !== want) el.setAttribute("fill", want);
    });
}
var cvdObserver = null;
function applyCvd(theme) {
    try { if (theme) localStorage.setItem("cvd-theme", theme); else localStorage.removeItem("cvd-theme"); } catch (e) {}
    raSavePrefs();
    document.documentElement.setAttribute("data-cvd", theme || "");
    cvdRecolor(document.body);
    // Sonradan çizilen diyagramlar (antrenör, algoritma sayfaları) da çevrilsin
    if (theme) cvdWatch();
}
function cvdWatch() {
    if (!cvdObserver && window.MutationObserver && document.body) {
        cvdObserver = new MutationObserver(function (muts) {
            if (!cvdTheme() && !holdSwap()) return;
            muts.forEach(function (m) {
                for (var i = 0; i < m.addedNodes.length; i++) if (m.addedNodes[i].nodeType === 1) cvdRecolor(m.addedNodes[i]);
            });
        });
        cvdObserver.observe(document.body, { childList: true, subtree: true });
    }
}
/* Tutuş değişince (antrenör) tüm diyagramları yeniden renklendir */
function raRecolor() { cvdRecolor(document.body); if (cvdTheme() || holdSwap()) cvdWatch(); }
/* Renk önizlemesi (6 küçük kare) */
function cvdSwatches(theme) {
    var pal = CVD_PALETTES[theme];
    var p = pal ? Object.assign({ W: NORMAL_SWATCH.W }, pal) : NORMAL_SWATCH;
    return '<span class="cvd-sw" aria-hidden="true">' + ["W", "Y", "R", "O", "G", "B"].map(function (k) {
        return '<i style="background:' + p[k] + '"></i>';
    }).join("") + "</span>";
}

/* 10 Kasım anma şeridi kaldırıldı (özel günler için yönetimden duyuru yapılır) */
function raMourn() { return false; }

document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("darkModeBtn");
    // Varsayılan karanlık mod: "light" açıkça seçilmedikçe karanlık
    var isDark = (localStorage.getItem("theme") || "dark") !== "light";
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("dark-mode", isDark);
    if (btn) btn.innerHTML = isDark ? "☀️" : "🌙";
    // Halloween süresi bittiyse önceki temaya dön
    // Mevsimlik temanın süresi bittiyse önceki temaya dön
    if (raSeasonOf(raSkin()) && !raSeasonOn(raSkin())) { var prevSk = "standart"; try { if (!localStorage.getItem("ra-rated-" + raSkin())) localStorage.setItem("ra-rate-pending", raSkin()); prevSk = localStorage.getItem("ra-season-prev") || localStorage.getItem("ra-hw-prev") || "standart"; if (raSeasonOf(prevSk)) prevSk = "standart"; localStorage.setItem("site-skin", prevSk); } catch (e) {} raSavePrefs(); }
    raApplySkin(raSkin());
    setTimeout(raSeasonOffer, 1800);
    // tema puanlama penceresi kaldırıldı
    if (cvdTheme()) applyCvd(cvdTheme());
    else if (holdSwap()) raRecolor();
    raInitSettings();
});

/* =========================================
   AYARLAR MENÜSÜ (⚙) — tema, dil, renk körlüğü tek yerde
========================================= */
var SETTINGS_TXT = {
    tr: { set: "Ayarlar", theme: "Tema", dark: "Karanlık", light: "Açık", lang: "Dil", cvd: "Renk körlüğü", cvd_off: "Kapalı (normal)", cvd_pro: "Protanopi", cvd_deu: "Döteranopi", cvd_rg: "Kırmızı-Yeşil", cvd_tri: "Tritanopi (mavi-sarı)" , skin: "Tema stili", skin_standart: "Sade", skin_klasik: "Klasik", skin_rubik: "Rubik's Cube", skin_neon: "Neon", skin_gunbatimi: "Gün Batımı", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    en: { set: "Settings", theme: "Theme", dark: "Dark", light: "Light", lang: "Language", cvd: "Color blindness", cvd_off: "Off (normal)", cvd_pro: "Protanopia", cvd_deu: "Deuteranopia", cvd_rg: "Red-Green", cvd_tri: "Tritanopia (blue-yellow)" , skin: "Theme style", skin_standart: "Simple", skin_klasik: "Classic", skin_rubik: "Rubik's Cube", skin_neon: "Neon", skin_gunbatimi: "Sunset", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    fr: { set: "Paramètres", theme: "Thème", dark: "Sombre", light: "Clair", lang: "Langue", cvd: "Daltonisme", cvd_off: "Désactivé (normal)", cvd_pro: "Protanopie", cvd_deu: "Deutéranopie", cvd_rg: "Rouge-Vert", cvd_tri: "Tritanopie (bleu-jaune)" , skin: "Style du thème", skin_standart: "Sobre", skin_klasik: "Classique", skin_rubik: "Rubik's Cube", skin_neon: "Néon", skin_gunbatimi: "Coucher de soleil", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    ru: { set: "Настройки", theme: "Тема", dark: "Тёмная", light: "Светлая", lang: "Язык", cvd: "Дальтонизм", cvd_off: "Выкл (обычный)", cvd_pro: "Протанопия", cvd_deu: "Дейтеранопия", cvd_rg: "Красно-зелёный", cvd_tri: "Тританопия (сине-жёлтый)" , skin: "Стиль темы", skin_standart: "Простой", skin_klasik: "Классический", skin_rubik: "Rubik's Cube", skin_neon: "Неон", skin_gunbatimi: "Закат", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    de: { set: "Einstellungen", theme: "Thema", dark: "Dunkel", light: "Hell", lang: "Sprache", cvd: "Farbenblindheit", cvd_off: "Aus (normal)", cvd_pro: "Protanopie", cvd_deu: "Deuteranopie", cvd_rg: "Rot-Grün", cvd_tri: "Tritanopie (Blau-Gelb)" , skin: "Designstil", skin_standart: "Schlicht", skin_klasik: "Klassisch", skin_rubik: "Rubik's Cube", skin_neon: "Neon", skin_gunbatimi: "Sonnenuntergang", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" },
    ar: { set: "الإعدادات", theme: "السمة", dark: "داكن", light: "فاتح", lang: "اللغة", cvd: "عمى الألوان", cvd_off: "إيقاف (عادي)", cvd_pro: "بروتانوبيا", cvd_deu: "ديوترانوبيا", cvd_rg: "أحمر-أخضر", cvd_tri: "تريتانوبيا (أزرق-أصفر)" , skin: "نمط السمة", skin_standart: "بسيط", skin_klasik: "كلاسيكي", skin_rubik: "Rubik's Cube", skin_neon: "نيون", skin_gunbatimi: "غروب الشمس", skin_halloween: "🎃 Halloween", skin_yilbasi: "🎄 Yılbaşı" }
};
function raSetLang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
function raEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function raSetTheme(mode) {
    var isDark = mode !== "light";
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("dark-mode", isDark);
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch (e) {}
    raSavePrefs();
    var btn = document.getElementById("darkModeBtn"); if (btn) btn.innerHTML = isDark ? "☀️" : "🌙";
    renderSettingsMenu();
}
/* Görünüm tercihleri hesaba bağlı: tema, tema stili ve renk körlüğü paleti tek kayıtta ("site-prefs-v1")
   tutulur ve hesapla senkronlanır; cihazlar arasında en son yapılan seçim geçerli olur. */
function raSavePrefs() {
    try {
        var g = function (k) { return localStorage.getItem(k) || ""; };
        localStorage.setItem("site-prefs-v1", JSON.stringify({ skin: g("site-skin") || "standart", theme: g("theme") || "dark", cvd: g("cvd-theme"), t: Date.now() }));
    } catch (e) {}
}
/* Buluttan gelen tercihleri uygula (account.js senkronu çağırır) */
function raApplyPrefs(json) {
    try {
        var p = JSON.parse(json || "null"); if (!p) return;
        if (p.skin) localStorage.setItem("site-skin", p.skin);
        if (p.theme) localStorage.setItem("theme", p.theme);
        if (p.cvd) localStorage.setItem("cvd-theme", p.cvd); else localStorage.removeItem("cvd-theme");
    } catch (e) {}
}
// Eski cihazlar: tercih kaydı yoksa mevcut seçimden oluştur (t: 0 → buluttaki kayıt önceliklidir)
(function () {
    try {
        if (localStorage.getItem("site-prefs-v1")) return;
        var s = localStorage.getItem("site-skin"), th = localStorage.getItem("theme"), c = localStorage.getItem("cvd-theme");
        if (s || th || c) localStorage.setItem("site-prefs-v1", JSON.stringify({ skin: s || "standart", theme: th || "dark", cvd: c || "", t: 0 }));
    } catch (e) {}
})();
/* Tema stili (renk paleti + yazı tipi): localStorage "site-skin" */
var RA_SKINS = [
    ["standart", ["#f5f4f0", "#2b50d6", "#ffffff", "#18181b"]],
    ["klasik", ["#f7f8fc", "#6c5ce7", "#ec4899", "#12141f"]],
    ["rubik", ["#fff8ec", "#ffd21f", "#1d5bff", "#17171f"]],
    ["neon", ["#05060b", "#22d3ee", "#d946ef", "#e8f6ff"]],
    ["gunbatimi", ["#fdf6f0", "#e8573a", "#f5a524", "#2a1712"]]
];
// Sınırlı süreli (mevsimlik) temalar: süresi içinde listede görünür, siteye girene bir kez sorulur,
// süre bitince seçenler önceki temalarına döner
var RA_SEASONS = [
    { k: "halloween", from: 0, to: 1, sw: ["#0b0710", "#f97316", "#7c3aed", "#fff1e6"] },
    { k: "yilbasi", from: new Date(2026, 11, 1).getTime(), to: new Date(2027, 0, 8).getTime(), sw: ["#0a1222", "#dc2626", "#16a34a", "#fbbf24"] }
];
function raSeasonOf(k) { for (var i = 0; i < RA_SEASONS.length; i++) if (RA_SEASONS[i].k === k) return RA_SEASONS[i]; return null; }
function raSeasonOn(k) { var o = raSeasonOf(k), n = Date.now(); return !!o && n >= o.from && n < o.to; }
function raSeasonNow() { for (var i = 0; i < RA_SEASONS.length; i++) if (raSeasonOn(RA_SEASONS[i].k)) return RA_SEASONS[i]; return null; }
function raHwOn() { return raSeasonOn("halloween"); }
RA_SEASONS.forEach(function (o) { if (raSeasonOn(o.k)) RA_SKINS.push([o.k, o.sw]); });
var RA_SKIN_FONTS = { halloween: "Creepster", yilbasi: "Mountains+of+Christmas:wght@700", rubik: "Rubik:wght@500;600;700;800;900", neon: "Space+Grotesk:wght@500;600;700", gunbatimi: "Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800;9..144,900" };
function raSkin() { try { return localStorage.getItem("site-skin") || "standart"; } catch (e) { return "standart"; } }
function raApplySkin(k) {
    var d = document.documentElement;
    if (!k || k === "standart") d.removeAttribute("data-skin"); else d.setAttribute("data-skin", k);
    var f = RA_SKIN_FONTS[k];
    if (f && !document.getElementById("raSkinFont-" + k)) {
        var l = document.createElement("link"); l.rel = "stylesheet"; l.id = "raSkinFont-" + k;
        l.href = "https://fonts.googleapis.com/css2?family=" + f + "&display=swap";
        document.head.appendChild(l);
    }
}
// Kaldırılan mevsimlik temayı kullananlara bir kez puan sor (1-5 yıldız + isteğe bağlı yorum)
// → Firestore feedback koleksiyonu (herkes ekler, yalnız admin okur)
var RA_RATE_NAMES = { halloween: "Halloween", yilbasi: "Yılbaşı" };
function raRateTheme() {
    if (raMourn()) return; // 10 Kasım'da pencere açılmaz (ertesi gün sorulur)
    var k; try { k = localStorage.getItem("ra-rate-pending"); } catch (e) { return; }
    if (!k || /\/(admin|yazdir|giris|kup-arena\/baglan)/.test(location.pathname)) return;
    if (document.getElementById("raHwAsk") || document.getElementById("raPushAsk") || document.getElementById("raRate")) { setTimeout(raRateTheme, 4000); return; }
    var done = function () { try { localStorage.removeItem("ra-rate-pending"); localStorage.setItem("ra-rated-" + k, "1"); } catch (e) {} el.remove(); };
    var nm = RA_SEASON_UI[k] ? RA_RATE_NAMES[k] || k : k, stars = 0;
    var st = document.createElement("style");
    st.textContent = ".ra-rate{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,12,18,.62);backdrop-filter:blur(3px)}" +
        ".ra-rate-b{width:min(380px,100%);box-sizing:border-box;padding:22px 20px 16px;border-radius:22px;background:var(--surface,#fff);color:var(--text,#111);border:var(--card-bw,2px) solid var(--card-border,#ddd);box-shadow:0 24px 60px rgba(0,0,0,.35);text-align:center;font-family:Inter,sans-serif}" +
        ".ra-rate-b h3{margin:4px 0 6px;font:900 20px Inter,sans-serif}.ra-rate-b p{margin:0 0 12px;font-size:14px;line-height:1.5;color:var(--text-soft,#666)}" +
        ".ra-stars{display:flex;justify-content:center;gap:6px;margin:6px 0 12px}.ra-stars button{border:0;background:none;padding:2px;cursor:pointer;font-size:36px;line-height:1;color:var(--border,#ccc);transition:transform .1s}" +
        ".ra-stars button.on{color:#f59e0b}.ra-stars button:active{transform:scale(.9)}" +
        ".ra-rate textarea{width:100%;box-sizing:border-box;min-height:64px;padding:10px 12px;border-radius:12px;border:1px solid var(--border,#ddd);background:var(--surface-soft,#f6f6f6);color:var(--text,#111);font:600 14px Inter,sans-serif;resize:vertical}" +
        ".ra-rate-a{display:flex;flex-direction:column;gap:6px;margin-top:10px}.ra-rate-a button{border:0;border-radius:14px;padding:12px;font:900 15px Inter,sans-serif;cursor:pointer}" +
        ".ra-rate-ok{background:var(--ui-accent,#6c5ce7);color:var(--ui-accent-text,#fff)}.ra-rate-ok:disabled{opacity:.5;cursor:default}.ra-rate-no{background:none;color:var(--text-soft,#666);font-weight:700!important;font-size:13px!important}";
    document.head.appendChild(st);
    var el = document.createElement("div"); el.id = "raRate"; el.className = "ra-rate"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    el.innerHTML = '<div class="ra-rate-b"><div style="font-size:40px;line-height:1">' + (k === "halloween" ? "🎃" : "🎄") + '</div><h3>' + nm + ' teması bitti</h3>' +
        '<p>Bir süre ' + nm + ' temasını kullandın. Beğendin mi? Puanın bir sonraki temayı daha güzel yapmamıza yardım eder.</p>' +
        '<div class="ra-stars ra-noico" role="radiogroup" aria-label="Puan">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" aria-label="' + n + ' yıldız">★</button>'; }).join("") + '</div>' +
        '<textarea maxlength="300" placeholder="Eklemek istediğin bir şey var mı? (isteğe bağlı)"></textarea>' +
        '<div class="ra-rate-a"><button type="button" class="ra-rate-ok" disabled>Gönder</button><button type="button" class="ra-rate-no">Şimdi değil</button></div></div>';
    var btns = el.querySelectorAll(".ra-stars button"), ok = el.querySelector(".ra-rate-ok");
    Array.prototype.forEach.call(btns, function (b) { b.onclick = function () { stars = +b.getAttribute("data-n"); Array.prototype.forEach.call(btns, function (x) { x.classList.toggle("on", +x.getAttribute("data-n") <= stars); }); ok.disabled = false; }; });
    ok.onclick = function () {
        var cfg = window.RA_FIREBASE; ok.disabled = true; ok.textContent = "Gönderiliyor…";
        var u = ""; try { u = window.Account && Account.user && Account.user() ? Account.user().uid : ""; } catch (e) {}
        var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        var D = "projects/" + cfg.projectId + "/databases/(default)/documents";
        var body = { writes: [{ update: { name: D + "/feedback/" + id, fields: { topic: { stringValue: "tema-" + k }, stars: { integerValue: String(stars) }, text: { stringValue: el.querySelector("textarea").value.trim().slice(0, 300) }, u: { stringValue: u } } },
            updateTransforms: [{ fieldPath: "ts", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }] };
        var tk = u && window.Account && Account.token ? Account.token().catch(function () { return ""; }) : Promise.resolve("");
        tk.then(function (t) {
            if (!t) body.writes[0].update.fields.u.stringValue = ""; // kimlik yoksa uid gönderilmez
            var h = { "Content-Type": "application/json" }; if (t) h.Authorization = "Bearer " + t;
            return fetch(((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/" + D + ":commit?key=" + encodeURIComponent(cfg.apiKey), { method: "POST", headers: h, body: JSON.stringify(body) });
        }).then(function () { el.querySelector(".ra-rate-b").innerHTML = '<div style="font-size:40px">💜</div><h3>Teşekkürler!</h3><p>Puanın kaydedildi.</p>'; setTimeout(done, 1600); }, done);
    };
    el.querySelector(".ra-rate-no").onclick = done;
    document.body.appendChild(el);
}
// Siteye girene bir kez: "<mevsim> teması ister misin?"
var RA_SEASON_UI = {
    halloween: { font: "Creepster", ff: "Creepster,Inter,cursive", title: "Halloween Teması", yes: "🎃 Evet, temayı aç",
        text: "Rubik Academy cadılar bayramı kostümünü giydi! Turuncu-mor renkler, örümcek ağları ve balkabakları… Denemek ister misin?",
        bg: "radial-gradient(120% 120% at 0% 0%,#3a1a08 0%,#150e1d 48%,#2a0f45 100%)", bd: "#f97316", tc: "#fb923c", pc: "#e9d8f4", sc: "#8f7aa0", nc: "#b9a3c4", nb: "#3b2a52", btn: "linear-gradient(120deg,#f97316,#c2410c)",
        icon: '<svg class="ra-hw-pk" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 14c-3 0-4-6 0-9" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="37" rx="13" ry="19" fill="#ea580c"/><ellipse cx="42" cy="37" rx="13" ry="19" fill="#ea580c"/><ellipse cx="32" cy="37" rx="12" ry="21" fill="#f97316"/><path d="M20 31l6 4-7 2zM44 31l-6 4 7 2zM21 45q11 9 22 0l-4 1-3-3-3 3-3-3-3 3-3-3z" fill="#1a0d02"/></svg>',
        deco: function (css) { return '<svg class="ra-hw-bat" style="' + css + '" viewBox="0 0 48 24" aria-hidden="true"><path d="M24 8c2-3 4-3 5 0 3-4 9-5 15-2-4 1-6 4-6 8-3-2-6-2-8 1-2-2-4-3-6-3s-4 1-6 3c-2-3-5-3-8-1 0-4-2-7-6-8 6-3 12-2 15 2 1-3 3-3 5 0z" fill="#a855f7"/></svg>'; } },
    yilbasi: { font: "Mountains+of+Christmas:wght@700", ff: "'Mountains of Christmas',Georgia,serif", title: "Yılbaşı Teması", yes: "🎄 Evet, temayı aç",
        text: "Rubik Academy yeni yıla hazır! Kırmızı-yeşil renkler, yağan kar ve parıldayan süsler… Denemek ister misin?",
        bg: "radial-gradient(120% 120% at 0% 0%,#3b0d12 0%,#0b1426 50%,#0b3320 100%)", bd: "#fbbf24", tc: "#fde68a", pc: "#dbe7f5", sc: "#8ea3bd", nc: "#b6c6da", nb: "#24344d", btn: "linear-gradient(120deg,#dc2626,#16a34a)",
        icon: '<svg class="ra-hw-pk" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5l4 6h-8z" fill="#fbbf24"/><path d="M32 9 16 30h8L12 45h12L10 58h44L40 45h12L40 30h8z" fill="#16a34a"/><rect x="28" y="57" width="8" height="6" rx="1" fill="#7c2d12"/><circle cx="26" cy="36" r="2.4" fill="#dc2626"/><circle cx="38" cy="44" r="2.4" fill="#fbbf24"/><circle cx="30" cy="50" r="2.4" fill="#3b82f6"/><circle cx="35" cy="26" r="2" fill="#dc2626"/><circle cx="22" cy="52" r="2" fill="#fbbf24"/></svg>',
        deco: function (css) { return '<svg class="ra-hw-bat" style="' + css + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2" stroke="#e0f2fe" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>'; } }
};
function raSeasonOffer() {
    if (raMourn()) return;
    var se = raSeasonNow(); if (!se) return;
    var U = RA_SEASON_UI[se.k]; if (!U) return;
    try {
        if (raSkin() === se.k || localStorage.getItem("ra-season-asked-" + se.k) || (se.k === "halloween" && localStorage.getItem("ra-hw-asked"))) return;
        if (/\/(admin|yazdir|giris|kup-arena\/baglan)/.test(location.pathname) || document.getElementById("raMaint") || document.getElementById("raHwAsk") || document.getElementById("raPushAsk")) { if (document.getElementById("raPushAsk")) setTimeout(raSeasonOffer, 4000); return; }
    } catch (e) { return; }
    var end = new Date(se.to - 1), p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    var endTxt = p2(end.getDate()) + "." + p2(end.getMonth() + 1) + "." + end.getFullYear();
    var days = Math.max(1, Math.ceil((se.to - Date.now()) / 86400000));
    if (!document.getElementById("raSkinFont-" + se.k)) { var l = document.createElement("link"); l.rel = "stylesheet"; l.id = "raSkinFont-" + se.k; l.href = "https://fonts.googleapis.com/css2?family=" + U.font + "&display=swap"; document.head.appendChild(l); }
    var st = document.createElement("style");
    st.textContent = ".ra-hw{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,4,14,.72);backdrop-filter:blur(4px);animation:raHwF .25s ease-out}" +
        "@keyframes raHwF{from{opacity:0}}" +
        ".ra-hw-b{position:relative;width:min(400px,100%);box-sizing:border-box;padding:26px 22px 20px;border-radius:24px;text-align:center;color:#fff;background:" + U.bg + ";border:2px solid " + U.bd + ";box-shadow:0 0 40px " + U.bd + "55,0 30px 80px rgba(0,0,0,.5);animation:raHwP .35s cubic-bezier(.2,1.4,.4,1)}" +
        "@keyframes raHwP{from{transform:scale(.85) rotate(-2deg);opacity:0}}" +
        ".ra-hw-pk{width:84px;height:84px;margin:-6px auto 4px;animation:raHwB 2.2s ease-in-out infinite}" +
        "@keyframes raHwB{50%{transform:translateY(-6px) rotate(3deg)}}" +
        ".ra-hw-t{font:700 34px/1.05 " + U.ff + ";letter-spacing:1px;color:" + U.tc + ";text-shadow:0 0 18px " + U.bd + "77;margin:6px 0 8px}" +
        ".ra-hw-p{font:600 15px/1.55 Inter,sans-serif;color:" + U.pc + ";margin:0 0 6px}" +
        ".ra-hw-d{display:inline-block;margin:6px 0 16px;padding:5px 12px;border-radius:999px;background:" + U.bd + "26;border:1px solid " + U.bd + "88;font:800 13px Inter,sans-serif;color:" + U.tc + "}" +
        ".ra-hw-a{display:flex;flex-direction:column;gap:8px}" +
        ".ra-hw-a button{border:0;border-radius:14px;padding:13px;font:900 15px Inter,sans-serif;cursor:pointer}" +
        ".ra-hw-yes{background:" + U.btn + ";color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.3)}" +
        ".ra-hw-no{background:transparent;color:" + U.nc + ";border:1px solid " + U.nb + "!important}" +
        ".ra-hw-s{font:600 12px Inter,sans-serif;color:" + U.sc + ";margin-top:10px}" +
        ".ra-hw-bat{position:absolute;width:34px;opacity:.8;animation:raHwBat 3s ease-in-out infinite}" +
        "@keyframes raHwBat{50%{transform:translate(6px,-8px) scale(.92)}}";
    document.head.appendChild(st);
    var el = document.createElement("div"); el.id = "raHwAsk"; el.className = "ra-hw"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    el.innerHTML = '<div class="ra-hw-b">' + U.deco("top:14px;left:16px") + U.deco("top:28px;right:18px;animation-delay:.8s;width:26px") + U.icon +
        '<div class="ra-hw-t">' + U.title + '</div><p class="ra-hw-p">' + U.text + '</p>' +
        '<span class="ra-hw-d">🗓 ' + endTxt + ' tarihine kadar · ' + days + ' gün kaldı</span>' +
        '<div class="ra-hw-a"><button type="button" class="ra-hw-yes">' + U.yes + '</button><button type="button" class="ra-hw-no">Hayır, teşekkürler</button></div>' +
        '<div class="ra-hw-s">İstediğin zaman ⚙ Ayarlar › Tema stili’nden değiştirebilirsin.</div></div>';
    var done = function () { try { localStorage.setItem("ra-season-asked-" + se.k, "1"); } catch (e) {} el.remove(); };
    el.querySelector(".ra-hw-yes").onclick = function () {
        try { if (!raSeasonOf(raSkin())) localStorage.setItem("ra-season-prev", raSkin()); localStorage.setItem("theme", "dark"); } catch (e) {}
        document.documentElement.classList.add("dark-mode"); document.body.classList.add("dark-mode");
        var b = document.getElementById("darkModeBtn"); if (b) b.innerHTML = "☀️";
        raSetSkin(se.k); done();
    };
    el.querySelector(".ra-hw-no").onclick = done;
    el.onclick = function (e) { if (e.target === el) done(); };
    document.body.appendChild(el);
}
function raSetSkin(k, target) {
    try { localStorage.setItem("site-skin", k); } catch (e) {}
    raSavePrefs();
    raApplySkin(k);
    renderSettingsMenu(target);
}
function renderSettingsMenu(target) {
    var menu = target || document.getElementById("raSetMenu"); if (!menu) return;
    var L = SETTINGS_TXT[raSetLang()] || SETTINGS_TXT.tr;
    var th = (function () { try { return localStorage.getItem("theme") || "dark"; } catch (e) { return "dark"; } })();
    var langs = getLanguages(), curLang = raSetLang(), cvd = cvdTheme();
    var cur = function (c) { return c ? ' aria-current="true"' : ''; };
    var html = '<div class="set-grp"><div class="set-h">' + raEsc(L.theme) + '</div>' +
        '<button class="set-opt" data-theme="dark"' + cur(th !== "light") + '>🌙 ' + raEsc(L.dark) + '</button>' +
        '<button class="set-opt" data-theme="light"' + cur(th === "light") + '>☀️ ' + raEsc(L.light) + '</button>' +
        (raSkin().indexOf("p-") === 0 ? '<p style="margin:6px 4px 0;font-size:12.5px;opacity:.7">Özel tema kendi açık/koyu görünümünü kullanıyor; seçimin tema değişince geçerli olur.</p>' : '') + '</div>';
    var sk = raSkin();
    html += '<div class="set-grp"><div class="set-h">' + raEsc(L.skin || "Tema stili") + '</div>';
    RA_SKINS.forEach(function (o) {
        html += '<button class="set-opt" data-skin="' + o[0] + '"' + cur(o[0] === sk) + '><span class="skin-sw" aria-hidden="true">' + o[1].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + '</span>' + raEsc(L["skin_" + o[0]] || (window.RA_SKIN_LABEL || {})[o[0]] || o[0]) + '</button>';
    });
    html += '</div>';
    var codes = Object.keys(langs);
    if (codes.length) {
        html += '<div class="set-grp"><div class="set-h">' + raEsc(L.lang) + '</div>';
        codes.forEach(function (c) { html += '<button class="set-opt" data-lang="' + c + '"' + cur(c === curLang) + '>' + raEsc(langs[c].name || c) + '</button>'; });
        html += '</div>';
    }
    var opts = [["", "off"], ["pro", "pro"], ["deu", "deu"], ["rg", "rg"], ["tri", "tri"]];
    // Tek seçenek: "Renk körlüğü dostu" (dengeli kırmızı-yeşil paleti). Eski 5 seçenek denemek için katlanır bölümde
    html += '<div class="set-grp"><div class="set-h">Renk körlüğü dostu</div>' +
        '<button class="set-opt cvd" data-cvd=""' + cur(!cvd) + '>' + cvdSwatches("") + '<span>Kapalı</span></button>' +
        '<button class="set-opt cvd" data-cvd="rg"' + cur(!!cvd) + '>' + cvdSwatches("rg") + '<span>Açık</span></button>' +
        '<details class="set-old"' + (cvd && cvd !== "rg" ? " open" : "") + '><summary>Eski seçenekler (deneme)</summary>';
    opts.forEach(function (o) { html += '<button class="set-opt cvd" data-cvd="' + o[0] + '"' + cur(o[0] === cvd) + '>' + cvdSwatches(o[0]) + '<span>' + raEsc(L["cvd_" + o[1]]) + '</span></button>'; });
    html += '</details></div>';
    menu.innerHTML = html;
    Array.prototype.forEach.call(menu.querySelectorAll("[data-theme]"), function (b) { b.onclick = function () { raSetTheme(b.getAttribute("data-theme")); }; });
    Array.prototype.forEach.call(menu.querySelectorAll("button[data-skin]"), function (b) { b.onclick = function () { raSetSkin(b.getAttribute("data-skin"), target); }; });
    Array.prototype.forEach.call(menu.querySelectorAll("[data-lang]"), function (b) { b.onclick = function () { selectLanguage(b.getAttribute("data-lang")); }; });
    Array.prototype.forEach.call(menu.querySelectorAll("[data-cvd]"), function (b) { b.onclick = function () { applyCvd(b.getAttribute("data-cvd")); renderSettingsMenu(target); }; });
}
/* Ayarlar artık ayrı sayfada (/ayarlar). Sayfa bu fonksiyonla kendi kabını doldurur. */
window.raRenderSettings = function (el) { renderSettingsMenu(el); };
/* Footer'a "Ayarlar" bağlantısı ekle (giriş yapılmamışken de erişilsin) */
function raInitSettings() {
    var L = SETTINGS_TXT[raSetLang()] || SETTINGS_TXT.tr;
    var foot = document.querySelector("footer");
    if (foot && !document.getElementById("raFootSet")) {
        var a = document.createElement("a");
        a.id = "raFootSet"; a.className = "foot-set"; a.href = "/ayarlar";
        a.textContent = "⚙️ " + L.set;
        foot.appendChild(a);
        document.addEventListener("site-lang-change", function () { a.textContent = "⚙️ " + ((SETTINGS_TXT[raSetLang()] || SETTINGS_TXT.tr).set); });
    }
}

/* =========================================
   DİL SEÇİCİ
========================================= */

/* i18n.js içindeki dil listesi (yoksa boş obje) */
function getLanguages() {
    return (typeof SITE_I18N !== "undefined" && SITE_I18N.languages) || {};
}

/* Dil menüsünü SITE_I18N.languages listesinden oluşturur.
   Liste yoksa sayfadaki elle yazılmış butonlara dokunmaz. */
function buildLangMenu() {
    var menu = document.getElementById("langMenu");
    var langs = getLanguages();
    var codes = Object.keys(langs);
    if (!menu || codes.length === 0) return;

    menu.innerHTML = "";

    codes.forEach(function (code) {
        var btn = document.createElement("button");
        btn.className = "lang-menu-item";
        btn.setAttribute("data-lang", code);
        btn.setAttribute("role", "menuitem");
        btn.addEventListener("click", function () {
            selectLanguage(code);
        });

        var name = document.createElement("span");
        name.textContent = langs[code].name || code;

        var check = document.createElement("span");
        check.className = "lang-check";
        check.textContent = "✓";

        btn.appendChild(name);
        btn.appendChild(check);
        menu.appendChild(btn);
    });
}

function applyLanguage(lang) {
    if (typeof SITE_I18N === "undefined") {
        console.error("i18n.js yüklenmemiş — common.js'den ÖNCE eklenmeli.");
        return;
    }
    if (!SITE_I18N.common[lang]) {
        lang = "tr";
    }

    var commonDict = SITE_I18N.common[lang] || {};
    var pageId = typeof PAGE_ID !== "undefined" ? PAGE_ID : null;
    var pageDict = (pageId && SITE_I18N.pages[pageId] && SITE_I18N.pages[pageId][lang]) || {};

    /* Sayfaya özel anahtar varsa o kazanır, yoksa ortak (common) kullanılır */
    var dict = Object.assign({}, commonDict, pageDict);

    /* data-i18n-scope="sayfa" içindeki öğeler o sayfanın çevirisini kullanır
       (örn. antrenör sayfasındaki PLL tanıma ve cross sekmeleri) */
    var scoped = {};
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        var sc = el.closest("[data-i18n-scope]"), d = dict;
        if (sc) {
            var sid = sc.getAttribute("data-i18n-scope");
            if (!scoped[sid]) {
                var sp = SITE_I18N.pages[sid] || {};
                scoped[sid] = Object.assign({}, commonDict, sp.tr || {}, sp[lang] || {});
            }
            d = scoped[sid];
        }
        if (d && d[key]) {
            // data-i18n-html: çeviri metni <b>, <code> gibi etiketler içerir (i18n.js'deki sabit metinler)
            if (el.hasAttribute("data-i18n-html")) el.innerHTML = d[key];
            else el.textContent = d[key];
        }
    });

    var info = getLanguages()[lang];

    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", (info && info.dir) || "ltr");

    var label = document.getElementById("langLabel");
    if (label) {
        label.textContent = (info && info.code) || lang.toUpperCase();
    }

    document.querySelectorAll(".lang-menu-item").forEach(function (item) {
        item.classList.toggle("active", item.getAttribute("data-lang") === lang);
    });

    localStorage.setItem("site-lang", lang);

    /* Sayfaya özel ek işlem gerekiyorsa (örn. dinamik kartları
       yeniden çevirmek), sayfa kendi "onLanguageApplied" fonksiyonunu
       tanımlayabilir — burada varsa çağrılır. */
    if (typeof onLanguageApplied === "function") {
        onLanguageApplied(lang);
    }
    try { document.dispatchEvent(new CustomEvent("site-lang-change", { detail: lang })); } catch (e) {}
}

function toggleLangMenu(e) {
    if (e) e.stopPropagation();
    var menu = document.getElementById("langMenu");
    var btn = document.getElementById("langSwitchBtn");
    if (!menu) return;
    var willOpen = !menu.classList.contains("open");
    menu.classList.toggle("open", willOpen);
    if (btn) btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

function closeLangMenu() {
    var menu = document.getElementById("langMenu");
    var btn = document.getElementById("langSwitchBtn");
    if (menu) menu.classList.remove("open");
    if (btn) btn.setAttribute("aria-expanded", "false");
}

function selectLanguage(lang) {
    applyLanguage(lang);
    closeLangMenu();
}

document.addEventListener("click", function (e) {
    var switcher = document.getElementById("langSwitcher");
    if (switcher && !switcher.contains(e.target)) {
        closeLangMenu();
    }
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLangMenu();
});

document.addEventListener("DOMContentLoaded", function () {
    buildLangMenu(); /* önce menüyü oluştur, sonra dili uygula (active işareti için) */
    var savedLang = localStorage.getItem("site-lang") || "tr";
    applyLanguage(savedLang);
});

/* =========================================
   SCROLL REVEAL ANİMASYONU
========================================= */
document.addEventListener("DOMContentLoaded", function () {
    var observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("active");
                }
            });
        },
        { threshold: 0.15 }
    );

    document.querySelectorAll(".reveal").forEach(function (element) {
        observer.observe(element);
    });
});

/* Ana sayfadaki "Kaldığın yerden devam et" için son açılan ALGORİTMA sayfası (yalnızca algoritma setleri) */
(function () {
    try {
        var p = location.pathname.replace(/\.html$/, "").replace(/\/$/, "");
        if (!/^\/icerikler\/algoritmalar\/[^\/]+$/.test(p) || /\/antrenor$/.test(p)) return;
        var h = document.querySelector("h1"), t = (h && h.textContent.trim()) || document.title.split(/\s[·|–-]\s/)[0];
        localStorage.setItem("ra-last-page", JSON.stringify({ p: p, t: String(t).replace(/\s+/g, " ").slice(0, 60) }));
    } catch (e) {}
})();

/* Çevrimdışı kullanım ve "ana ekrana ekle" için service worker */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        // sw.js her zaman sunucudan kontrol edilsin (tarayıcı önbelleğindeki eski sw.js'e takılmasın)
        navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(function () {});
    });
}

/* YENİ SÜRÜM KONTROLÜ
   Uygulama (WebView) ve ana ekrana eklenen site arka planda günlerce açık kalabiliyor; eski sayfa ve
   önbellekteki dosyalar yüzünden güncelleme ancak "verileri temizle" ile geliyordu.
   /version.json her yayında GitHub Pages tarafından kendiliğinden yazılır (yayınlanan commit kimliği;
   elle sürüm artırmak gerekmez). Cihaz son gördüğü kimliği saklar; kimlik değişince (yeni PR yayınlandı)
   bu BİR KEZ işlenir: önbellekler silinir, service worker güncellenir ve uygulamaya / sekmeye geri dönülünce
   sayfa bir kez yenilenir. Yeni kimlik hemen kaydedildiği için aynı güncelleme bir daha sorulmaz. */
(function () {
    if (!window.fetch) return;
    var KEY = "ra-build";
    function known() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
    function remember(v) { try { localStorage.setItem(KEY, v); localStorage.removeItem("ra-upd-chk"); } catch (e) {} }
    function clean() {
        var jobs = [];
        try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })); } catch (e) {}
        try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); })); } catch (e) {}
        return Promise.all(jobs).catch(function () {});
    }
    // Kullanıcı bir şeyle uğraşıyorsa (yarışma odası, timer, yazı yazıyor) sayfayı yenileme: tek seferlik not göster
    function busy() {
        var a = document.activeElement;
        return !!(document.body && (document.body.classList.contains("c-in-room") || document.body.hasAttribute("data-macro-guard")) ||
            (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || document.querySelector(".gw-modal.open, .acc-modal.open"));
    }
    function note() {
        if (!document.body || document.getElementById("raUpd")) return;
        var el = document.createElement("div"); el.id = "raUpd"; el.className = "ra-upd ra-noico"; el.setAttribute("role", "status");
        el.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(92px + env(safe-area-inset-bottom));z-index:1200;display:flex;align-items:center;gap:8px;" +
            "max-width:calc(100% - 24px);padding:8px 8px 8px 14px;border-radius:14px;background:#17171f;color:#fff;font:700 13.5px Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)";
        el.innerHTML = '<span>Yeni sürüm hazır</span><button type="button" data-r style="border:0;border-radius:10px;padding:8px 12px;background:#3b6cf6;color:#fff;font:800 13px Inter,system-ui,sans-serif;cursor:pointer">Yenile</button>' +
            '<button type="button" data-x aria-label="Kapat" style="border:0;background:none;color:#aaa;font:800 16px Inter,sans-serif;cursor:pointer;padding:4px 6px">✕</button>';
        el.querySelector("[data-r]").onclick = function () { location.reload(); };
        el.querySelector("[data-x]").onclick = function () { el.remove(); };
        document.body.appendChild(el);
    }
    var hiddenAt = 0;
    function check(resumed) {
        fetch("/version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var v = d && d.v != null ? String(d.v).slice(0, 80) : "";
            if (!v || v.indexOf("{{") >= 0) return;          // yerelde (Jekyll'siz) çalışırken
            var k = known();
            if (!k) { remember(v); return; }                  // ilk kez: yalnız kaydet
            if (v === k) return;                              // güncelleme yok
            remember(v);                                      // bu güncelleme bir kez işlenir
            clean().then(function () {
                // yeni açılan sayfa zaten sunucudan geldi: yalnız önbellek temizlenir.
                // uzun süre arka planda kalıp geri dönülen sayfa eski olabilir: bir kez yenilenir
                if (!resumed) return;
                if (busy()) note(); else location.reload();
            });
        }).catch(function () {});
    }
    setTimeout(function () { check(false); }, 1500);
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
        // en az 1 dakika arka planda kaldıysa bak (sekme değiştirip dönmelerde her seferinde sorma)
        if (hiddenAt && Date.now() - hiddenAt > 60000) check(true);
    });
    window.addEventListener("pageshow", function (e) { if (e.persisted) check(true); });
})();

/* =========================================================
   2-LOOK <-> TAM OLL/PLL İLERLEME SENKRONU
   2-Look OLL köşeleri (OCLL) ve 2-Look PLL kenarları, tam OLL/PLL'deki
   aynı case'lerle birebir aynıdır. Birinde "Öğreniyorum/Biliyorum"
   işaretlenince diğerinde de işaretlenir (işaret kaldırma dahil).
========================================================= */
(function () {
    "use strict";
    var RANK = { "": 0, learning: 1, known: 2 };
    // [2look-store, 2look-case, full-store, full-case]
    var SYNC = [
        ["algo-progress-2look-2lo", "Sune",       "algo-progress-oll", "OLL 27"],
        ["algo-progress-2look-2lo", "Antisune",   "algo-progress-oll", "OLL 26"],
        ["algo-progress-2look-2lo", "H",          "algo-progress-oll", "OLL 21"],
        ["algo-progress-2look-2lo", "Pi",         "algo-progress-oll", "OLL 22"],
        ["algo-progress-2look-2lo", "Headlights", "algo-progress-oll", "OLL 23"],
        ["algo-progress-2look-2lo", "T",          "algo-progress-oll", "OLL 24"],
        ["algo-progress-2look-2lo", "Bowtie",     "algo-progress-oll", "OLL 25"],
        ["algo-progress-2look-2lp", "Ua", "algo-progress-pll", "Edge perm::Ua perm"],
        ["algo-progress-2look-2lp", "Ub", "algo-progress-pll", "Edge perm::Ub perm"],
        ["algo-progress-2look-2lp", "H",  "algo-progress-pll", "Edge perm::H perm"],
        ["algo-progress-2look-2lp", "Z",  "algo-progress-pll", "Edge perm::Z perm"]
    ];
    var WATCH = {}, LOOK = {};
    SYNC.forEach(function (e) {
        WATCH[e[0]] = 1; WATCH[e[2]] = 1;
        LOOK[e[0] + "||" + e[1]] = [e[2], e[3]];
        LOOK[e[2] + "||" + e[3]] = [e[0], e[1]];
    });
    var _set, store;
    var _proto;
    try { store = window.localStorage; _proto = Storage.prototype.setItem; _set = function (k, v) { return _proto.call(store, k, v); }; store.removeItem("setItem"); } catch (e) { return; }
    function parse(k) { try { return JSON.parse(store.getItem(k)) || {}; } catch (e) { return {}; } }
    var syncing = false;
    // Storage nesnesine atama yapılamaz (anahtar olarak kaydedilir); prototype üzerinden sar.
    Storage.prototype.setItem = function (k, v) {
        if (this !== store || syncing || !WATCH[k]) return _proto.call(this, k, v);
        var prev = parse(k);
        _set(k, v);
        var next; try { next = JSON.parse(v) || {}; } catch (e) { return; }
        syncing = true;
        try {
            var seen = {}, writes = {};
            Object.keys(prev).concat(Object.keys(next)).forEach(function (c) {
                if (seen[c]) return; seen[c] = 1;
                var pv = prev[c] || "", nv = next[c] || "";
                if (pv === nv) return;
                var t = LOOK[k + "||" + c]; if (!t) return;
                if (!writes[t[0]]) writes[t[0]] = parse(t[0]);
                if (nv) writes[t[0]][t[1]] = nv; else delete writes[t[0]][t[1]];
            });
            Object.keys(writes).forEach(function (ts) { _set(ts, JSON.stringify(writes[ts])); });
        } finally { syncing = false; }
    };
    // Tek seferlik uzlaştırma: mevcut işaretleri iki tarafta eşitle (yalnız yükseltir)
    try {
        var cache = {}, dirty = {};
        function get(s) { if (!(s in cache)) cache[s] = parse(s); return cache[s]; }
        SYNC.forEach(function (e) {
            var a = get(e[0]), b = get(e[2]), av = a[e[1]] || "", bv = b[e[3]] || "";
            if (av === bv) return;
            var hi = RANK[av] >= RANK[bv] ? av : bv;
            if (av !== hi) { if (hi) a[e[1]] = hi; else delete a[e[1]]; dirty[e[0]] = 1; }
            if (bv !== hi) { if (hi) b[e[3]] = hi; else delete b[e[3]]; dirty[e[2]] = 1; }
        });
        Object.keys(dirty).forEach(function (s) { _set(s, JSON.stringify(cache[s])); });
    } catch (e) {}
})();

/* ---------- MAKRO ENGELLEYİCİ ----------
   <body data-macro-guard> olan sayfalarda (günlük karıştırma, antrenör):
   - Betik/makro ile üretilmiş sahte olaylar (event.isTrusted === false) zamanlayıcıya ve
     [data-guard] düğmelerine ulaşmadan engellenir.
   - Saniyede 15'ten fazla basış "makro" sayılır.
   Sayfa RAGuard.flag ile denemenin şüpheli olup olmadığını kontrol eder, RAGuard.reset() ile sıfırlar. */
(function () {
    var G = { flag: false, reason: "", hits: [] };
    G.reset = function () { G.flag = false; G.reason = ""; G.hits = []; };
    window.RAGuard = G;
    function on() { return document.body && document.body.hasAttribute("data-macro-guard"); }
    ["keydown", "keyup", "mousedown", "mouseup", "touchstart", "touchend", "click", "pointerdown", "pointerup"].forEach(function (type) {
        document.addEventListener(type, function (e) {
            if (!on()) return;
            var tg = e.target && e.target.closest ? e.target : null;
            var guarded = type.indexOf("key") === 0 ? !(tg && tg.closest("input, textarea, select, [contenteditable]")) : !!(tg && tg.closest("[data-guard]"));
            if (!guarded) return;
            if (e.isTrusted === false) {
                e.stopImmediatePropagation(); e.preventDefault();
                G.flag = true; G.reason = "synthetic";
                return;
            }
            if (type === "keydown" || type === "mousedown" || type === "touchstart") {
                if (type === "keydown" && e.repeat) return;
                var n = performance.now();
                G.hits.push(n); G.hits = G.hits.filter(function (x) { return n - x < 1000; });
                if (G.hits.length > 15) { G.flag = true; G.reason = "rapid"; }
            }
        }, true);
    });
})();

/* =========================================================
   ALGORİTMA SETLERİ: "Hepsini seç" çubuğu
   Sayfanın kendi loadProgress/saveProgress/applyState/updateSummary
   fonksiyonlarını kullanır; ekrandaki tüm case'leri tek seferde işaretler.
========================================================= */
(function () {
    var TXT = {
        tr: { all: "Hepsini:", k: "🟢 Biliyorum", l: "🟡 Öğreniyorum", c: "⚪ Temizle", ask: "Bu sayfadaki tüm case'lerin işaretleri temizlensin mi?" },
        en: { all: "Mark all:", k: "🟢 Known", l: "🟡 Learning", c: "⚪ Clear", ask: "Clear the marks of all cases on this page?" },
        de: { all: "Alle:", k: "🟢 Kann ich", l: "🟡 Ich lerne", c: "⚪ Leeren", ask: "Markierungen aller Fälle auf dieser Seite löschen?" },
        fr: { all: "Tout :", k: "🟢 Je sais", l: "🟡 J'apprends", c: "⚪ Effacer", ask: "Effacer les marques de tous les cas de cette page ?" },
        ru: { all: "Все:", k: "🟢 Знаю", l: "🟡 Учу", c: "⚪ Сбросить", ask: "Сбросить отметки всех случаев на этой странице?" },
        ar: { all: "الكل:", k: "🟢 أعرف", l: "🟡 أتعلم", c: "⚪ مسح", ask: "مسح علامات جميع الحالات في هذه الصفحة؟" }
    };
    function t() { var l = "tr"; try { l = localStorage.getItem("site-lang") || "tr"; } catch (e) {} return TXT[l] || TXT.tr; }
    function ready() {
        var sum = document.getElementById("progressSummary");
        if (!sum || document.getElementById("raMarkAll") || sum.closest(".ra-prog")) return;
        if (typeof window.loadProgress !== "function" || typeof window.saveProgress !== "function" || typeof window.applyState !== "function") return;
        // İlerleme kartı: sayılar + ilerleme çubuğu + "Hepsini" tuşları tek kutuda
        var css = document.createElement("style");
        css.textContent = ".ra-prog{max-width:1250px;box-sizing:border-box;margin:0 auto 28px;padding:14px 16px;border-radius:18px;background:var(--surface);border:var(--card-bw,2px) solid var(--card-border,var(--border));box-shadow:var(--shadow-sm,none);display:flex;flex-direction:column;gap:12px}" +
            ".ra-prog .progress-summary{margin:0!important;max-width:none!important;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;font-weight:800}" +
            ".ra-prog .progress-summary>span{padding:0!important;border:0!important;background:none!important;border-radius:0!important;color:var(--text);display:inline-flex;align-items:center}" +
            ".ra-pbar{position:relative;height:10px;border-radius:99px;background:var(--surface-soft);border:1px solid var(--border);overflow:hidden}" +
            ".ra-pbar i{position:absolute;top:0;bottom:0;left:0;border-radius:99px;transition:width .35s}" +
            ".ra-pbar i.k{background:#22c55e}.ra-pbar i.l{background:#facc15}" +
            ".ra-phead{display:flex;align-items:center;gap:10px}.ra-pct{font:900 15px 'JetBrains Mono',monospace;color:#16a34a;margin-inline-start:auto}" +
            ".ra-markall{display:flex;flex-wrap:wrap;align-items:center;gap:6px}" +
            ".ra-markall>span{font-size:12.5px;font-weight:800;color:var(--text-soft);margin-inline-end:2px}" +
            ".ra-markall button{display:inline-flex;align-items:center;border:1px solid var(--border);background:var(--surface-soft);color:var(--text);font:800 13px Inter,sans-serif;padding:6px 12px;border-radius:999px;cursor:pointer}" +
            ".ra-markall button:hover{border-color:var(--text-soft)}" +
            "@media(max-width:560px){.ra-prog{padding:12px}.ra-markall button{padding:6px 10px;font-size:12.5px}}";
        document.head.appendChild(css);
        var wrap = document.createElement("div"); wrap.className = "ra-prog";
        sum.parentNode.insertBefore(wrap, sum); wrap.appendChild(sum);
        var pbar = document.createElement("div"); pbar.className = "ra-pbar"; pbar.innerHTML = '<i class="k"></i><i class="l"></i>';
        wrap.appendChild(pbar);
        var bar = document.createElement("div"); bar.id = "raMarkAll"; bar.className = "ra-markall";
        function draw() { var x = t(); bar.innerHTML = '<span>' + x.all + '</span><button type="button" data-st="known">' + x.k + '</button><button type="button" data-st="learning">' + x.l + '</button><button type="button" data-st="">' + x.c + '</button>'; }
        draw(); // "Hepsini: Biliyorum/Öğreniyorum/Temizle" çubuğu kaldırıldı (kartta tek dokunuş yeterli)
        // özet metnindeki sayılardan çubuğu çiz: "öğreniyorum: L" ve "biliyorum: K / T"
        function fill() {
            var n = (sum.textContent.match(/\d+/g) || []).map(Number);
            if (n.length < 3) { pbar.hidden = true; return; }
            var l = n[0], k = n[1], tot = n[2] || 1; pbar.hidden = false;
            pbar.children[0].style.width = (k / tot * 100) + "%";
            pbar.children[1].style.left = (k / tot * 100) + "%"; pbar.children[1].style.width = (l / tot * 100) + "%";
            pct.textContent = "%" + Math.round(k / tot * 100);
        }
        // yüzde, özetin yanında (özetin içine yazılmaz; sayılar karışmasın)
        var head = document.createElement("div"); head.className = "ra-phead";
        wrap.insertBefore(head, sum); head.appendChild(sum);
        var pct = document.createElement("b"); pct.className = "ra-pct"; head.appendChild(pct);
        fill();
        if (window.MutationObserver) new MutationObserver(fill).observe(sum, { childList: true, subtree: true, characterData: true });
        document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("#langMenu")) setTimeout(draw, 60); });
        bar.addEventListener("click", function (e) {
            var b = e.target.closest("button"); if (!b) return;
            var st = b.getAttribute("data-st");
            if (!st && !confirm(t().ask)) return;
            // Görünen case'ler (arama/filtreyle gizlenenler hariç); hiçbiri görünmüyorsa hepsi
            var all = Array.prototype.slice.call(document.querySelectorAll(".case-card[data-case]"));
            var vis = all.filter(function (c) { return c.offsetParent !== null || c.closest("details:not([open])"); });
            var cards = vis.length ? vis : all;
            var p = window.loadProgress() || {};
            cards.forEach(function (c) {
                var n = c.getAttribute("data-case");
                if (st) p[n] = st; else delete p[n];
                window.applyState(c, st);
            });
            window.saveProgress(p);
            if (typeof window.updateSummary === "function") window.updateSummary();
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(ready, 0); });
    else setTimeout(ready, 0);
    window.addEventListener("load", ready);
})();

/* =========================================================
   ALGORİTMA KARTLARI: sade görünüm
   - ▶ İzle ve ✏️ Düzenle düğmeleri tek "⋯" menüsünde
   - Alternatif algoritmalar "Alternatifler (n)" ile açılır
========================================================= */
(function () {
    function setup() {
        var wrap = document.getElementById("subsetsWrap"); if (!wrap || wrap.raCard) return; wrap.raCard = 1;
        var css = document.createElement("style");
        css.textContent = ".alg-menu{position:relative;display:flex;justify-content:flex-end;margin-top:6px}" +
            ".alg-more{border:1px solid var(--border);background:var(--surface-soft);color:var(--text);border-radius:10px;width:36px;height:30px;font:900 16px Inter,sans-serif;line-height:1;cursor:pointer}" +
            ".alg-menu-pop{position:absolute;right:0;bottom:calc(100% + 4px);z-index:20;display:flex;flex-direction:column;gap:4px;min-width:150px;padding:6px;border-radius:12px;background:var(--surface);border:1px solid var(--border);box-shadow:0 10px 28px rgba(0,0,0,.22)}" +
            ".alg-menu-pop[hidden]{display:none}.alg-menu-pop>button{margin:0!important;width:100%;justify-content:flex-start;text-align:left}" +
            ".case-alts.ra-alt-c{display:none}.case-alts.ra-alt-c.open{display:block}" +
            ".alg-alt-tg{display:inline-block;margin-top:4px;border:0;background:none;padding:2px 0;font:700 12.5px Inter,sans-serif;color:var(--text-soft);cursor:pointer;text-decoration:underline}";
        document.head.appendChild(css);
        function close(except) { Array.prototype.forEach.call(wrap.querySelectorAll(".alg-menu-pop:not([hidden])"), function (p) { if (p !== except) p.hidden = true; }); }
        function deco() {
            Array.prototype.forEach.call(wrap.querySelectorAll(".case-card"), function (card) {
                var btns = Array.prototype.filter.call(card.querySelectorAll(".alg-play-btn, .alg-edit-btn"), function (b) { return !b.closest(".alg-menu-pop"); });
                if (btns.length) {
                    var m = card.querySelector(".alg-menu");
                    if (!m) {
                        m = document.createElement("div"); m.className = "alg-menu";
                        m.innerHTML = '<button type="button" class="alg-more" aria-label="Diğer işlemler" aria-haspopup="true">⋯</button><div class="alg-menu-pop" hidden></div>';
                        (card.querySelector(".case-body") || card).appendChild(m);
                    }
                    var pop = m.lastChild;
                    btns.forEach(function (b) { if (b.classList.contains("alg-play-btn")) pop.insertBefore(b, pop.firstChild); else pop.appendChild(b); });
                }
                var alts = card.querySelector(".case-alts");
                if (alts && !alts.classList.contains("ra-alt-c")) {
                    var n = alts.children.length; if (!n) return;
                    alts.classList.add("ra-alt-c");
                    var tg = document.createElement("button"); tg.type = "button"; tg.className = "alg-alt-tg"; tg.textContent = "Alternatifler (" + n + ")";
                    alts.parentNode.insertBefore(tg, alts);
                }
            });
        }
        wrap.addEventListener("click", function (e) {
            var m = e.target.closest(".alg-more"), tg = e.target.closest(".alg-alt-tg");
            if (m) { e.stopPropagation(); e.preventDefault(); var p = m.nextSibling; var was = p.hidden; close(); p.hidden = !was; return; }
            if (tg) { e.stopPropagation(); e.preventDefault(); var a = tg.nextSibling; if (a) { a.classList.toggle("open"); tg.textContent = (a.classList.contains("open") ? "Alternatifleri gizle" : "Alternatifler (" + a.children.length + ")"); } return; }
            if (e.target.closest(".alg-menu-pop button")) setTimeout(close, 0);
        }, true);
        document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".alg-menu")) close(); });
        deco();
        new MutationObserver(function () { deco(); }).observe(wrap, { childList: true, subtree: true });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();
    window.addEventListener("load", setup);
})();

/* ---------- Çekiliş: kaçırılan çark ----------
   Katıldığın bir çekilişin sonucu açıklandığında çekiliş sayfasında değilsen, sitede hangi sayfaya
   girersen gir çark önüne açılır ("… önce çevrildi" yazısıyla). Okuma tasarrufu: yalnız bu tarayıcıda
   katıldığın, saati gelmiş ve sonucunu henüz görmediğin çekiliş için, en fazla 5 dakikada bir 1 belge okunur. */
(function () {
    try { if (window.top !== window) return; } catch (e) { return; }
    if (/^\/icerikler\/cekilis(\.html)?$/.test(location.pathname) && /[?&]id=/.test(location.search)) return; // açık çekiliş sayfası kendisi gösterir
    function get(k) { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }
    function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function open(id) {
        if (document.getElementById("raGwOv")) return;
        var ov = document.createElement("div"); ov.id = "raGwOv";
        ov.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:radial-gradient(80% 70% at 50% 40%,rgba(22,34,92,.94),rgba(3,5,14,.99));display:flex;align-items:center;justify-content:center";
        ov.innerHTML = '<div style="color:#c7d2fe;font:800 15px Inter,sans-serif">🎡 Çekiliş sonucu yükleniyor…</div>' +
            '<iframe title="Çekiliş sonucu" src="/icerikler/cekilis?id=' + encodeURIComponent(id) + '&izle=1" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent" allow="clipboard-write"></iframe>' +
            '<button type="button" aria-label="Kapat" style="position:absolute;top:14px;left:14px;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-size:17px;cursor:pointer;z-index:2;display:none">✕</button>';
        var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); document.documentElement.style.overflow = ""; };
        var xb = ov.querySelector("button"), shown = false;
        xb.onclick = close;
        // çark açılırsa içindeki ✕ kullanılır; 8 sn içinde açılmazsa (bağlantı sorunu) dıştaki ✕ görünür
        setTimeout(function () { if (!shown) xb.style.display = ""; }, 8000);
        window.addEventListener("message", function (e) {
            if (e.origin !== location.origin || !e.data) return;
            if (e.data.raGw === "close") close(); else if (e.data.raGw === "shown") { shown = true; xb.style.display = "none"; }
        });
        document.documentElement.style.overflow = "hidden";
        document.body.appendChild(ov);
    }
    function check() {
        var cfg = window.RA_FIREBASE; if (!cfg || !cfg.apiKey || !cfg.projectId) return;
        var joined = get("ra-gw-joined"), seen = get("ra-gw-seen"), chk = get("ra-gw-chk"), now = Date.now(), W = 7 * 86400000;
        // eski kayıtları temizle
        Object.keys(joined).forEach(function (id) { if (!(joined[id] > now - W)) { delete joined[id]; delete chk[id]; } });
        set("ra-gw-joined", joined);
        var ids = Object.keys(joined).filter(function (id) { return joined[id] <= now && !seen[id] && !(chk[id] > now - 300000); });
        if (!ids.length) { set("ra-gw-chk", chk); return; }
        var id = ids[0]; chk[id] = now; set("ra-gw-chk", chk);
        var root = ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents";
        fetch(root + "/giveaways/" + encodeURIComponent(id) + "?key=" + encodeURIComponent(cfg.apiKey) + "&mask.fieldPaths=st&mask.fieldPaths=w&mask.fieldPaths=wAt&mask.fieldPaths=man")
            .then(function (r) { if (r.status === 404) { var j = get("ra-gw-joined"); delete j[id]; set("ra-gw-joined", j); return null; } return r.ok ? r.json() : null; })
            .then(function (d) {
                var f = (d && d.fields) || {}, st = f.st && f.st.stringValue, w = f.w && f.w.stringValue;
                var wAt = f.wAt ? Date.parse(f.wAt.timestampValue || "") || +(f.wAt.integerValue || 0) : 0;
                if (!w || (f.man && f.man.booleanValue) || !(st === "drawn" || st === "claimed") || !(wAt > now - 3 * 86400000)) return;
                if (get("ra-gw-seen")[id] === w) return;
                open(id);
            }).catch(function () {});
    }
    function later() { setTimeout(check, 1500); }
    if (document.readyState === "complete") later(); else window.addEventListener("load", later);
})();
