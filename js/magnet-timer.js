/* =========================================================
   MIKNATIS TIMER (magnet-timer.js) — ZKT Timer'daki gibi
   Mıknatıslı küp telefonun üstündeyken pusula/manyetometre sapar:
     beyaz  = küp yok          → küpü telefonun üstüne koy
     turuncu = küp var, sinyal oturuyor (hazırlanıyor)
     yeşil  = sinyal sabit (hazır) → küp kalkınca süre başlar
   Süre: küp masaya bırakılınca titreşim (ivmeölçer, uyarlanır eşik) ile durur;
   yedek olarak küp tekrar telefona konunca ya da ekrana dokununca durur.
   Kaynak: Magnetometer (Generic Sensor, varsa) → yoksa pusula yönü
   (deviceorientationabsolute / iOS webkitCompassHeading).
========================================================= */
(function () {
    var S = {
        on: false, src: "", state: "white", base: null, buf: [], last: null, t0: 0, gotData: 0,
        cb: null, mag: null, armedAt: 0, stopAt: 0, armed: true
    };
    // Durumlar: white (küp yok) → orange (küp kondu) → green (hazır) → running → done
    //   clear: küp telefonda ama yeni çözüm için önce kaldırılmalı (karıştırılmamış küp yanlışlıkla
    //          yeşile geçip kaldırınca süre başlamasın). Küp kalkınca white olur.
    //   armed=false: sıradaki karıştırma beklenirken yeşile geçilmez, süre başlamaz.
    var STABLE_MS = 700, MIN_SOLVE = 1200;
    function now() { return performance.now(); }
    function emit(type, data) { if (S.cb) try { S.cb(type, data); } catch (e) {} }
    function setState(st) { if (S.state !== st) { S.state = st; if (st === "orange") S.orangeAt = now(); emit("state", st); } }

    // Sinyal → taban çizgisinden uzaklık (µT ya da derece)
    function dist(v) {
        if (S.base == null) return 0;
        if (S.src === "magnet") return Math.abs(v - S.base);
        var d = Math.abs(v - S.base) % 360; return d > 180 ? 360 - d : d;
    }
    // Eşikler: pusula (derece) daha gürültülü ve yumuşatılmış geldiği için daha toleranslı
    // Ayar (sihirbazla ölçülen, küp yerindeyken sapma) varsa eşikler ona göre: "hazır" = ölçümün %35'i
    // Birden çok küp: { act: "XMan V3", list: { "XMan V3": { src, on, t } } }
    var CAL_KEY = "ra-mag-cal-v2";
    function calDb() {
        var d = null;
        try { d = JSON.parse(localStorage.getItem(CAL_KEY) || "null"); } catch (e) {}
        if (!d || typeof d.list !== "object") {
            d = { act: "", list: {} };
            try { var o = JSON.parse(localStorage.getItem("ra-mag-cal-v1") || "null"); if (o && o.on > 0) { d.list["Küpüm"] = o; d.act = "Küpüm"; } } catch (e) {}
        }
        return d;
    }
    function calPut(d) { try { localStorage.setItem(CAL_KEY, JSON.stringify(d)); } catch (e) {} }
    function cal() { var d = calDb(), c = d.list[d.act]; return c && c.src === S.src && c.on > 0 ? c.on : 0; }
    function thOn() { var c = cal(), d = S.src === "magnet" ? 40 : 14; return c ? Math.max(S.src === "magnet" ? 15 : 5, c * 0.35) : d; }    // küp var
    function thOff() { return thOn() * 0.5; }    // küp yok sayılır
    function thLift() { var c = cal(); return c ? Math.max(S.src === "magnet" ? 10 : 3, c * 0.18) : (S.src === "magnet" ? 25 : 6); }   // hazırken küp kalkıyor
    function thStable() { return S.src === "magnet" ? 8 : 4; }  // sinyal sabit
    function spread(arr) {
        if (arr.length < 3) return Infinity;
        if (S.src === "magnet") { var mn = Infinity, mx = -Infinity; arr.forEach(function (x) { mn = Math.min(mn, x.v); mx = Math.max(mx, x.v); }); return mx - mn; }
        var ref = arr[0].v, m = 0; arr.forEach(function (x) { var d = Math.abs(x.v - ref) % 360; m = Math.max(m, d > 180 ? 360 - d : d); }); return m;
    }
    function median(arr) { var v = arr.map(function (x) { return x.v; }).sort(function (a, b) { return a - b; }); return v[Math.floor(v.length / 2)]; }
    function between(a, b) { if (S.src === "magnet") return Math.abs(a - b); var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

    function sample(v) {
        if (!S.on || v == null || isNaN(v)) return;
        var t = now(); S.gotData = t; S.last = v;
        if (!S.firstAt) S.firstAt = t;
        S.buf.push({ t: t, v: v }); while (S.buf.length && t - S.buf[0].t > STABLE_MS) S.buf.shift();
        var stable = spread(S.buf) < thStable();
        if (stable) S.stableSince = S.stableSince || t; else S.stableSince = 0;
        var still = stable ? t - S.stableSince : 0;
        // Taban çizgisi (küp yokken): sinyal oturunca ya da en geç 1.5 sn sonra ortanca değer
        if (S.base == null) {
            if ((stable && S.buf.length > 5) || t - S.firstAt > 1500) { S.base = median(S.buf); emit("calibrated"); }
            return;
        }
        var d = dist(v); S.level = d; S.stable = stable;
        if (S.calMode) { if (stable && S.calMode === "base") S.base = median(S.buf); return; } // ayar sihirbazı: durum makinesi çalışmaz
        // Pusula zamanla kayar: küp yokken sinyal uzun süre sabit ve küpün ölçülen gücünden belirgin zayıfsa
        // bu küp değil kaymadır → taban çizgisi yeniden alınır (bar sıfırlanır)
        var c = cal(), weak = c ? d < c * 0.6 : d < thOn() * 1.3;
        if (S.state === "clear") {
            if (d < thOff()) { if (stable) S.base = median(S.buf); setState("white"); }
            else if (still > 2500 && weak) { S.base = median(S.buf); setState("white"); }
        } else if (S.state === "white") {
            if (d > thOn()) setState("orange");
            else if (stable) S.base = median(S.buf); // ortam yavaşça değişirse takip et
        } else if (S.state === "orange") {
            if (d < thOff()) setState("white");
            else if (still > 6000 && (c ? d < c * 0.42 : false)) { S.base = median(S.buf); setState("white"); }
            else if (stable && S.armed && t - S.orangeAt > 1000) { S.ready = median(S.buf); setState("green"); }
        } else if (S.state === "green") {
            if (!S.armed) { setState("clear"); return; }
            // Küp kalkınca sinyal hazır değerden tabana doğru belirgin şekilde döner (sensör gecikse bile ilk kıpırtıda başlar)
            var back = dist(S.ready) - d;
            if (d < thOff() || (back > thLift() && between(v, S.ready) > thLift())) { S.t0 = t; setState("running"); emit("start"); }
            else if (stable) S.ready = median(S.buf); // küp yerinde hafifçe kaydıysa takip et
        } else if (S.state === "running") {
            // küp tekrar telefonun üstüne konursa da dur: eşiği geçtiği an bitiş sayılır,
            // 250 ms boyunca üstte kalırsa onaylanır (sabitlenmesi beklenmez)
            if (t - S.t0 > MIN_SOLVE && d > thOn()) {
                if (!S.backAt) S.backAt = t;
                else if (t - S.backAt > 250) { var at = S.backAt; S.backAt = 0; finish(at); }
            } else S.backAt = 0;
        } else if (S.state === "done") {
            // bitişten sonra küp telefondaysa önce kaldırılmalı (doğrudan yeşile geçmez)
            if (t - S.stopAt > 1500) {
                if (d > thOn()) setState("clear");
                else { if (stable) S.base = median(S.buf); setState("white"); }
            }
        }
    }
    function finish(atT) {
        if (S.state !== "running") return;
        var ms = Math.max(0, Math.round((atT || now()) - S.t0));
        S.stopAt = now(); setState("done"); emit("stop", ms);
    }

    // Titreşim: küp masaya bırakılınca telefonda küçük bir sarsıntı olur.
    // - ivme VEKTÖRÜNDEKİ ani değişim (yalnız büyüklük değil: masa yatayken yan sarsıntılar büyüklüğü değiştirmez)
    // - jiroskop (dönme hızı) sıçraması: hafif tıklar en çok burada görünür
    // Eşik telefonun hareketsizken ölçülen kendi gürültüsüne göre uyarlanır; hassasiyet ayardan değişir.
    var lastV = null, lastR = null, noise = 0.05, noiseR = 0.4, motionN = 0;
    var SENS_KEY = "ra-mag-sens";
    function sensK() { var v = "2"; try { v = localStorage.getItem(SENS_KEY) || "2"; } catch (e) {} return v === "3" ? 0.55 : v === "1" ? 1.7 : 1; }
    function onMotion(e) {
        if (!S.on) return;
        var lin = e.acceleration && e.acceleration.x != null, v = lin ? e.acceleration : e.accelerationIncludingGravity;
        if (!v || v.x == null) return;
        motionN++;
        var j = lastV ? Math.sqrt(Math.pow(v.x - lastV.x, 2) + Math.pow(v.y - lastV.y, 2) + Math.pow(v.z - lastV.z, 2)) : 0;
        lastV = { x: v.x, y: v.y, z: v.z };
        var r = e.rotationRate, rj = 0;
        if (r && r.alpha != null) {
            if (lastR) rj = Math.sqrt(Math.pow(r.alpha - lastR.a, 2) + Math.pow((r.beta || 0) - lastR.b, 2) + Math.pow((r.gamma || 0) - lastR.g, 2));
            lastR = { a: r.alpha, b: r.beta || 0, g: r.gamma || 0 };
        }
        var k = sensK(), th = Math.max(lin ? 0.09 : 0.14, noise * 4) * k, thR = Math.max(1.2, noiseR * 5) * k;
        if (motionN > 5) S.shake = Math.max(S.shake || 0, j / th, rj / thR); // bar/ayar için: 1'in üstü = durdurur (okununca sıfırlanır)
        if (motionN > 5 && S.state === "running" && now() - S.t0 > MIN_SOLVE && (j > th || rj > thR)) finish(now());
        else { noise = noise * 0.97 + Math.min(j, 1) * 0.03; noiseR = noiseR * 0.97 + Math.min(rj, 20) * 0.03; } // sessizken gürültü tabanını öğren
    }
    function onOrient(e) {
        var h = null;
        if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
        else if (e.absolute && typeof e.alpha === "number") h = e.alpha;
        if (h == null || S.src === "magnet") return;
        if (!S.src) S.src = "compass";
        if (S.src === "compass") sample(h);
    }

    // iPhone/iPad: hareket-yön sensörü izni yalnız bir dokunuşla istenebilir
    var IOS_PERM = !!(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function");
    function needPerm() {
        var ps = [];
        if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") ps.push(DeviceOrientationEvent.requestPermission().catch(function () { return "denied"; }));
        if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") ps.push(DeviceMotionEvent.requestPermission().catch(function () { return "denied"; }));
        return Promise.all(ps).then(function (r) { return r.every(function (x) { return x === "granted"; }); });
    }
    function startMagnetometer() {
        if (!("Magnetometer" in window)) return false;
        try {
            var m = new window.Magnetometer({ frequency: 60 });
            m.addEventListener("reading", function () {
                if (S.src !== "magnet") { S.src = "magnet"; S.base = null; S.buf = []; S.firstAt = 0; } // pusuladan doğrudan sensöre geç
                sample(Math.sqrt(m.x * m.x + m.y * m.y + m.z * m.z));
            });
            m.addEventListener("error", function () { if (S.src === "magnet") S.src = ""; });
            m.start(); S.mag = m; return true;
        } catch (e) { return false; }
    }

    function listen(on) {
        var f = on ? "addEventListener" : "removeEventListener";
        window[f]("deviceorientationabsolute", onOrient);
        window[f]("deviceorientation", onOrient);
        window[f]("devicemotion", onMotion);
    }
    window.MagnetTimer = {
        needsTap: function () { return IOS_PERM; },
        // Kullanıcı dokunuşuyla çağrılmalı (iOS izinleri için)
        // quiet: dokunuş olmadan (sayfa açılınca) dene; iPhone'da izin istenmez, daha önce verildiyse veri gelir,
        // gelmezse "needtap" hatası verilir ve dokunuşla izin istenir
        start: function (cb, quiet) {
            if (S.on) { S.cb = cb; emit("state", S.state); return Promise.resolve(true); }
            S.cb = cb; S.base = null; S.buf = []; S.state = "white"; S.src = ""; S.gotData = 0; S.firstAt = 0;
            if (quiet && IOS_PERM) {
                S.on = true; listen(true);
                return new Promise(function (res) {
                    setTimeout(function () {
                        if (S.gotData) { emit("state", S.state); res(true); return; }
                        S.on = false; listen(false); emit("error", "needtap"); res(false);
                    }, 1500);
                });
            }
            return needPerm().then(function (ok) {
                if (!ok) { emit("error", "perm"); return false; }
                S.on = true;
                startMagnetometer();
                listen(true);
                emit("state", "white");
                setTimeout(function () { if (S.on && !S.gotData) emit("error", "nosensor"); }, 2500);
                return true;
            });
        },
        stop: function () {
            S.on = false; S.cb = null;
            window.removeEventListener("deviceorientationabsolute", onOrient);
            window.removeEventListener("deviceorientation", onOrient);
            window.removeEventListener("devicemotion", onMotion);
            if (S.mag) { try { S.mag.stop(); } catch (e) {} S.mag = null; }
        },
        // Ekrana dokunarak durdurma (yedek)
        tapStop: function () { if (S.state === "running") finish(now()); },
        _motion: function (x, y, z, lin) { var v = { x: x, y: y, z: z }; onMotion(lin ? { acceleration: v } : { accelerationIncludingGravity: v }); },
        // Durdurma hassasiyeti: "1" az, "2" normal, "3" hassas
        sens: function (v) { if (v) try { localStorage.setItem(SENS_KEY, v); } catch (e) {} try { return localStorage.getItem(SENS_KEY) || "2"; } catch (e) { return "2"; } },
        motionOk: function () { return motionN > 0; },
        shake: function () { var x = S.shake || 0; S.shake = 0; return x; },
        reset: function () { if (S.state === "done") setState(S.base != null && S.last != null && dist(S.last) > thOn() ? "clear" : "white"); },
        // Çözüm yapılabilir mi? false iken yeşil/başlama yok; true olunca küp telefondaysa önce kaldırılmalı
        arm: function (on) {
            on = !!on; if (S.armed === on) return; S.armed = on;
            if (S.state === "green" || (on && S.state === "orange")) setState("clear");
        },
        recalibrate: function () { S.base = null; S.buf = []; S.firstAt = 0; setState("white"); },
        state: function () { return S.state; },
        // Bar için: tabandan anlık sapma, "hazır" eşiği ve ayar değeri
        level: function () { return { v: S.base == null ? null : S.level || 0, th: thOn(), cal: cal(), stable: !!S.stable, src: S.src, ready: S.base != null }; },
        // Ayar sihirbazı: "base" = taban ölçülüyor (küp uzakta), "cube" = küp ölçülüyor; null = normal çalışma
        calMode: function (m) { S.calMode = m || null; if (m === "base") { S.base = null; S.buf = []; S.firstAt = 0; } if (!m) setState(S.level > thOn() ? "clear" : "white"); },
        saveCal: function (on, name) {
            name = String(name || "Küpüm").trim().slice(0, 30) || "Küpüm";
            var d = calDb(); d.list[name] = { src: S.src, on: Math.round(on * 10) / 10, t: Date.now() }; d.act = name; calPut(d);
        },
        hasCal: function () { return cal() > 0; },
        // Kayıtlı küpler (bu sensör türünde ölçülmüş olanlar) ve seçili küp
        cubes: function () { var d = calDb(); return Object.keys(d.list).filter(function (k) { return !S.src || d.list[k].src === S.src; }).sort(function (a, b) { return d.list[b].t - d.list[a].t; }); },
        cube: function () { var d = calDb(); return d.list[d.act] && (!S.src || d.list[d.act].src === S.src) ? d.act : ""; },
        useCube: function (n) { var d = calDb(); if (d.list[n]) { d.act = n; calPut(d); } },
        delCube: function (n) { var d = calDb(); delete d.list[n]; if (d.act === n) d.act = Object.keys(d.list)[0] || ""; calPut(d); },
        elapsed: function () { return S.state === "running" ? now() - S.t0 : 0; },
        source: function () { return S.src; },
        // test için: sinyal/titreşim enjekte et
        _feed: function (v, src) { S.src = src || S.src || "magnet"; S.gotData = now(); sample(v); },
        _shake: function () { if (S.state === "running" && now() - S.t0 > MIN_SOLVE) finish(now()); }
    };
})();
