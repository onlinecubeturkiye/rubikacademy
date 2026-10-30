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
        if (S.state === "clear") {
            if (d < thOff()) setState("white");
        } else if (S.state === "white") {
            if (d > thOn()) setState("orange");
            else if (stable) S.base = median(S.buf); // ortam yavaşça değişirse takip et
        } else if (S.state === "orange") {
            if (d < thOff()) setState("white");
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
            if (t - S.stopAt > 1500) setState(d < thOff() ? "white" : "clear");
        }
    }
    function finish(atT) {
        if (S.state !== "running") return;
        var ms = Math.max(0, Math.round((atT || now()) - S.t0));
        S.stopAt = now(); setState("done"); emit("stop", ms);
    }

    // Titreşim: küp masaya bırakılınca telefonda küçük bir sarsıntı olur.
    // Sabit 2.2 m/s² eşiği hafif bırakışları kaçırıyordu; artık telefonun kendi gürültüsü
    // ölçülür ve ona göre çok daha düşük, uyarlanır bir eşik kullanılır.
    var lastA = null, noise = 0.15;
    function onMotion(e) {
        if (!S.on) return;
        var lin = e.acceleration && e.acceleration.x != null, a = lin ? e.acceleration : e.accelerationIncludingGravity;
        if (!a || a.x == null) return;
        var m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        if (lastA != null) {
            var j = Math.abs(m - lastA), th = Math.max(lin ? 0.28 : 0.4, noise * 4.5);
            if (S.state === "running" && now() - S.t0 > MIN_SOLVE && j > th) finish(now());
            else noise = noise * 0.97 + Math.min(j, 1.5) * 0.03; // sessizken gürültü tabanını öğren
        }
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
        _motion: function (x, y, z, lin) { var v = { x: x, y: y, z: z }; onMotion(lin ? { acceleration: v } : { accelerationIncludingGravity: v }); },
        reset: function () { if (S.state === "done") setState(S.base != null && S.last != null && dist(S.last) > thOff() ? "clear" : "white"); },
        // Çözüm yapılabilir mi? false iken yeşil/başlama yok; true olunca küp telefondaysa önce kaldırılmalı
        arm: function (on) {
            on = !!on; if (S.armed === on) return; S.armed = on;
            if (S.state === "green" || (on && S.state === "orange")) setState("clear");
        },
        recalibrate: function () { S.base = null; S.buf = []; S.firstAt = 0; setState("white"); },
        state: function () { return S.state; },
        elapsed: function () { return S.state === "running" ? now() - S.t0 : 0; },
        source: function () { return S.src; },
        // test için: sinyal/titreşim enjekte et
        _feed: function (v, src) { S.src = src || S.src || "magnet"; S.gotData = now(); sample(v); },
        _shake: function () { if (S.state === "running" && now() - S.t0 > MIN_SOLVE) finish(now()); }
    };
})();
