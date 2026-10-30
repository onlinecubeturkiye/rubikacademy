/* =========================================================
   MIKNATIS TIMER (magnet-timer.js) — ZKT Timer'daki gibi
   Mıknatıslı küp telefonun üstündeyken pusula/manyetometre sapar:
     beyaz  = küp yok          → küpü telefonun üstüne koy
     turuncu = küp var, sinyal oturuyor (hazırlanıyor)
     yeşil  = sinyal sabit (hazır) → küp kalkınca süre başlar
   Süre: küp masaya bırakılınca titreşim (ivmeölçer) ile durur;
   yedek olarak küp tekrar telefona konunca ya da ekrana dokununca durur.
   Kaynak: Magnetometer (Generic Sensor, varsa) → yoksa pusula yönü
   (deviceorientationabsolute / iOS webkitCompassHeading).
========================================================= */
(function () {
    var S = {
        on: false, src: "", state: "white", base: null, buf: [], last: null, t0: 0, gotData: 0,
        cb: null, mag: null, armedAt: 0, stopAt: 0
    };
    var STABLE_MS = 700, MIN_SOLVE = 1200;
    function now() { return performance.now(); }
    function emit(type, data) { if (S.cb) try { S.cb(type, data); } catch (e) {} }
    function setState(st) { if (S.state !== st) { S.state = st; emit("state", st); } }

    // Sinyal → taban çizgisinden uzaklık (µT ya da derece)
    function dist(v) {
        if (S.base == null) return 0;
        if (S.src === "magnet") return Math.abs(v - S.base);
        var d = Math.abs(v - S.base) % 360; return d > 180 ? 360 - d : d;
    }
    // Eşikler: pusula (derece) daha gürültülü ve yumuşatılmış geldiği için daha toleranslı
    function thOn() { return S.src === "magnet" ? 40 : 14; }    // küp var
    function thOff() { return S.src === "magnet" ? 20 : 7; }    // küp yok sayılır
    function thLift() { return S.src === "magnet" ? 25 : 6; }   // hazırken küp kalkıyor
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
        // Taban çizgisi (küp yokken): sinyal oturunca ya da en geç 1.5 sn sonra ortanca değer
        if (S.base == null) {
            if ((stable && S.buf.length > 5) || t - S.firstAt > 1500) { S.base = median(S.buf); emit("calibrated"); }
            return;
        }
        var d = dist(v);
        if (S.state === "white") {
            if (d > thOn()) setState("orange");
            else if (stable) S.base = median(S.buf); // ortam yavaşça değişirse takip et
        } else if (S.state === "orange") {
            if (d < thOff()) setState("white");
            else if (stable) { S.ready = median(S.buf); setState("green"); }
        } else if (S.state === "green") {
            // Küp kalkınca sinyal hazır değerden tabana doğru belirgin şekilde döner (sensör gecikse bile ilk kıpırtıda başlar)
            var back = dist(S.ready) - d;
            if (d < thOff() || (back > thLift() && between(v, S.ready) > thLift())) { S.t0 = t; setState("running"); emit("start"); }
            else if (stable) S.ready = median(S.buf); // küp yerinde hafifçe kaydıysa takip et
        } else if (S.state === "running") {
            // küp tekrar telefonun üstüne konursa da dur
            if (t - S.t0 > MIN_SOLVE && d > thOn() && stable) finish(t - STABLE_MS * 0.5);
        } else if (S.state === "done") {
            if (d < thOff() && t - S.stopAt > 1500) setState("white");
            else if (d > thOn() && stable && t - S.stopAt > 1500) { S.ready = median(S.buf); setState("green"); }
        }
    }
    function finish(atT) {
        if (S.state !== "running") return;
        var ms = Math.max(0, Math.round((atT || now()) - S.t0));
        S.stopAt = now(); setState("done"); emit("stop", ms);
    }

    // Titreşim: ivme büyüklüğünde ani sıçrama
    var lastA = null;
    function onMotion(e) {
        if (!S.on) return;
        var a = e.accelerationIncludingGravity || e.acceleration; if (!a || a.x == null) return;
        var m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        if (lastA != null && S.state === "running" && now() - S.t0 > MIN_SOLVE && Math.abs(m - lastA) > 2.2) finish(now());
        lastA = m;
    }
    function onOrient(e) {
        var h = null;
        if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
        else if (e.absolute && typeof e.alpha === "number") h = e.alpha;
        if (h == null || S.src === "magnet") return;
        if (!S.src) S.src = "compass";
        if (S.src === "compass") sample(h);
    }

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

    window.MagnetTimer = {
        // Kullanıcı dokunuşuyla çağrılmalı (iOS izinleri için)
        start: function (cb) {
            if (S.on) { S.cb = cb; emit("state", S.state); return Promise.resolve(true); }
            S.cb = cb; S.base = null; S.buf = []; S.state = "white"; S.src = ""; S.gotData = 0; S.firstAt = 0;
            return needPerm().then(function (ok) {
                if (!ok) { emit("error", "perm"); return false; }
                S.on = true;
                startMagnetometer();
                window.addEventListener("deviceorientationabsolute", onOrient);
                window.addEventListener("deviceorientation", onOrient);
                window.addEventListener("devicemotion", onMotion);
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
        reset: function () { if (S.state === "done") setState(S.base != null && S.last != null && dist(S.last) > thOn() ? "orange" : "white"); },
        recalibrate: function () { S.base = null; S.buf = []; S.firstAt = 0; setState("white"); },
        state: function () { return S.state; },
        elapsed: function () { return S.state === "running" ? now() - S.t0 : 0; },
        source: function () { return S.src; },
        // test için: sinyal/titreşim enjekte et
        _feed: function (v, src) { S.src = src || S.src || "magnet"; S.gotData = now(); sample(v); },
        _shake: function () { if (S.state === "running" && now() - S.t0 > MIN_SOLVE) finish(now()); }
    };
})();
