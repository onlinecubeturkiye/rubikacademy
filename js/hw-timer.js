/* =========================================================
   DONANIM TIMER (hw-timer.js) — csTimer'daki gibi
   1) Kablolu timer (Stackmat / SpeedStacks / QiYi / YJ): timer'ın veri çıkışı, ses kablosuyla
      telefonun / bilgisayarın mikrofon girişine bağlanır. Sinyal 1200 baud seri veridir:
      paket = durum harfi + 5 (Gen 3) ya da 6 (Gen 4/5) rakam + sağlama + "\n\r".
      Sağlama = 64 + rakamların toplamı. Kutup (ters/düz) kendiliğinden bulunur.
   2) Akıllı timer (GAN Smart Timer / Halo): Bluetooth, servis 0xFFF0, durum karakteristiği 0xFFF5.
      Olay paketi: 0xFE, uzunluk, ?, durum, [dk, sn, ms(2 bayt)], crc16.
      Durumlar: 1 hazırlan, 2 eller kalktı, 3 çalışıyor, 4 durdu (süre), 5 boşta, 6 eller üstte, 7 bitti
   Olaylar: cb(type, data) → "status" {kind, on, msg}, "ready", "start", "tick" ms, "stop" ms, "reset"
   Otomatik algılama:
   - Mikrofon izni daha önce verildiyse sessizce dinler; geçerli paket gelince "detected" olayı.
   - Daha önce eşlenen GAN timer (getDevices) reklam yayınlayınca kendiliğinden bağlanır.
========================================================= */
(function () {
    if (window.HwTimer) return;
    var cb = null, PREF = "ra-hw-timer";
    function emit(t, d) { if (cb) try { cb(t, d); } catch (e) {} }
    function now() { return performance.now(); }

    /* ---------------- Stackmat (ses girişi) ---------------- */
    var SM = { on: false, ctx: null, stream: null, node: null, src: null, lastPkt: 0, lastMs: -1, lastSt: "", running: false, seen: false, decs: null, lostT: 0 };

    // UART çözücü: örnekleri 1/0'a çevirir, başlangıç bitini bulup her bitin ortasından örnekler
    function Uart(rate, inv) {
        this.bit = rate / 1200; this.inv = inv; this.state = 0; this.cnt = 0; this.next = 0; this.byte = 0; this.nb = 0; this.buf = []; this.prev = 1;
    }
    Uart.prototype.push = function (b, out) {
        if (this.inv) b = 1 - b;
        if (this.state === 0) { // boşta (1): 1→0 geçişi başlangıç biti
            if (this.prev === 1 && b === 0) { this.state = 1; this.cnt = 0; this.next = this.bit * 1.5; this.byte = 0; this.nb = 0; }
        } else {
            this.cnt++;
            if (this.cnt >= this.next) {
                if (this.nb < 8) { this.byte |= b << this.nb; this.nb++; this.next += this.bit; }
                else { // dur biti 1 olmalı
                    if (b === 1) this.feedByte(this.byte, out); else this.buf = [];
                    this.state = 0;
                }
            }
        }
        this.prev = b;
    };
    Uart.prototype.feedByte = function (c, out) {
        this.buf.push(c);
        if (this.buf.length > 12) this.buf.shift();
        var n = this.buf.length;
        if (n >= 9 && this.buf[n - 2] === 10 && this.buf[n - 1] === 13) {
            // Gen 4/5: 10 bayt (6 rakam), Gen 3: 9 bayt (5 rakam)
            var p = n >= 10 ? parsePkt(this.buf.slice(n - 10)) : null;
            if (!p) p = parsePkt(this.buf.slice(n - 9));
            if (p) out.push(p);
            this.buf = [];
        }
    };
    function parsePkt(b) {
        var digits = b.slice(1, b.length - 3), sum = 0;
        if (digits.length !== 5 && digits.length !== 6) return null;
        for (var i = 0; i < digits.length; i++) { var d = digits[i] - 48; if (d < 0 || d > 9) return null; digits[i] = d; sum += d; }
        if (b[b.length - 3] !== 64 + sum) return null;
        var st = String.fromCharCode(b[0]);
        if ("IASLRC ".indexOf(st) < 0) return null;
        var ms = digits[0] * 60000 + (digits[1] * 10 + digits[2]) * 1000 + (digits.length === 6 ? digits[3] * 100 + digits[4] * 10 + digits[5] : (digits[3] * 10 + digits[4]) * 10);
        return { st: st, ms: ms, gen: digits.length === 6 ? 4 : 3 };
    }
    // Ham ses örneklerini çözücülere ver (test için de dışarı açık)
    function smFeed(samples, rate) {
        if (!SM.decs || SM.decs.rate !== rate) SM.decs = { rate: rate, a: new Uart(rate, false), b: new Uart(rate, true), dc: 0, amp: 0.02 };
        var D = SM.decs, pk = [];
        for (var i = 0; i < samples.length; i++) {
            var v = samples[i];
            D.dc += (v - D.dc) * 0.001;               // yavaş DC takibi
            var x = v - D.dc, ax = Math.abs(x);
            D.amp += (ax - D.amp) * 0.0005;            // genlik takibi (eşik için)
            var bit = x > 0 ? 1 : 0;
            if (ax < D.amp * 0.25) bit = D.last == null ? 1 : D.last; // sıfır yakınında titreşmeyi yok say
            D.last = bit;
            D.a.push(bit, pk); D.b.push(bit, pk);
        }
        pk.forEach(smPacket);
    }
    function smPacket(p) {
        SM.lastPkt = Date.now();
        if (!SM.seen) { SM.seen = true; emit("status", { kind: "stackmat", on: true, msg: "Kablolu timer bağlı" }); emit("detected", "stackmat"); }
        var running = p.st === " " && p.ms > 0;
        if (running && !SM.running) { SM.running = true; emit("start"); }
        if (running) emit("tick", p.ms);
        if (!running && SM.running) {
            SM.running = false;
            if (p.ms > 0 && (p.st === "S" || p.st === "I" || p.st === "A" || p.st === "L" || p.st === "R" || p.st === "C")) emit("stop", p.ms);
        }
        if (p.st === "A" && !SM.running && SM.lastSt !== "A") emit("ready");
        if (p.ms === 0 && SM.lastMs > 0 && !SM.running) emit("reset");
        if (!running && p.ms === 0 && SM.lastSt !== p.st) emit("tick", 0);
        SM.lastMs = p.ms; SM.lastSt = p.st;
    }
    function smStart(quiet) {
        if (SM.on) return Promise.resolve(true);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { emit("status", { kind: "stackmat", on: false, msg: "Bu tarayıcı ses girişini desteklemiyor." }); return Promise.resolve(false); }
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (stream) {
            var AC = window.AudioContext || window.webkitAudioContext;
            var ctx = new AC();
            var src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(4096, 1, 1);
            node.onaudioprocess = function (e) { smFeed(e.inputBuffer.getChannelData(0), ctx.sampleRate); };
            src.connect(node); node.connect(ctx.destination);
            if (ctx.state === "suspended") ctx.resume().catch(function () {});
            SM.on = true; SM.ctx = ctx; SM.stream = stream; SM.node = node; SM.src = src; SM.seen = Date.now() - SM.lastPkt < 1500; SM.decs = null;
            try { localStorage.setItem(PREF + "-mic", "1"); } catch (e) {}
            if (!SM.seen) emit("status", { kind: "stackmat", on: false, listening: true, msg: "Dinleniyor… timer'ı kabloyla bağla ve aç" });
            clearInterval(SM.lostT);
            SM.lostT = setInterval(function () {
                if (SM.seen && Date.now() - SM.lastPkt > 1500) { SM.seen = false; SM.running = false; emit("status", { kind: "stackmat", on: false, listening: true, msg: "Timer sinyali yok: kablo takılı ve timer açık mı?" }); }
            }, 500);
            return true;
        }, function (e) {
            if (!quiet) emit("status", { kind: "stackmat", on: false, msg: e && e.name === "NotAllowedError" ? "Mikrofon izni verilmedi." : "Ses girişi açılamadı." });
            return false;
        });
    }
    function smStop() {
        clearInterval(SM.lostT);
        try { SM.node && SM.node.disconnect(); SM.src && SM.src.disconnect(); } catch (e) {}
        try { SM.stream && SM.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { SM.ctx && SM.ctx.close(); } catch (e) {}
        SM.on = false; SM.seen = false; SM.running = false; SM.ctx = SM.stream = SM.node = SM.src = null;
    }
    // Mikrofon izni daha önce verildiyse (sormadan) dinlemeye başla
    function micGranted() {
        try {
            if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(false);
            return navigator.permissions.query({ name: "microphone" }).then(function (r) { return r.state === "granted"; }, function () { return false; });
        } catch (e) { return Promise.resolve(false); }
    }

    /* ---------------- GAN Smart Timer (Bluetooth) ---------------- */
    var GAN_SVC = "0000fff0-0000-1000-8000-00805f9b34fb", GAN_STATE = "0000fff5-0000-1000-8000-00805f9b34fb";
    var GT = { dev: null, ch: null, on: false, running: false, t0: 0, raf: 0 };
    function ganEvent(e) {
        var v = e.target.value; if (!v || v.byteLength < 4 || v.getUint8(0) !== 0xFE) return;
        var s = v.getUint8(3);
        if (s === 1 || s === 6) emit("ready");
        else if (s === 3) { GT.running = true; GT.t0 = now(); emit("start"); tickLoop(); }
        else if (s === 4 && v.byteLength >= 8) {
            GT.running = false; cancelAnimationFrame(GT.raf);
            var ms = v.getUint8(4) * 60000 + v.getUint8(5) * 1000 + v.getUint16(6, true);
            emit("tick", ms); emit("stop", ms);
        }
        else if (s === 5) { GT.running = false; cancelAnimationFrame(GT.raf); emit("reset"); emit("tick", 0); }
        else if (s === 0) ganLost();
    }
    function tickLoop() { cancelAnimationFrame(GT.raf); var f = function () { if (!GT.running) return; emit("tick", Math.round(now() - GT.t0)); GT.raf = requestAnimationFrame(f); }; f(); }
    function ganLost() { GT.on = false; GT.running = false; cancelAnimationFrame(GT.raf); emit("status", { kind: "gan", on: false, msg: "Akıllı timer bağlantısı koptu." }); }
    function ganAttach(dev) {
        GT.dev = dev;
        dev.addEventListener("gattserverdisconnected", ganLost);
        emit("status", { kind: "gan", on: false, msg: "Bağlanıyor… (" + (dev.name || "timer") + ")" });
        return dev.gatt.connect().then(function (srv) { return srv.getPrimaryService(GAN_SVC); })
            .then(function (svc) { return svc.getCharacteristic(GAN_STATE); })
            .then(function (ch) { GT.ch = ch; ch.addEventListener("characteristicvaluechanged", ganEvent); return ch.startNotifications(); })
            .then(function () {
                GT.on = true;
                try { localStorage.setItem(PREF + "-gan", dev.id || "1"); } catch (e) {}
                emit("status", { kind: "gan", on: true, msg: "Akıllı timer bağlı: " + (dev.name || "GAN") }); emit("detected", "gan");
                return true;
            });
    }
    function ganConnect() {
        if (!navigator.bluetooth) { emit("status", { kind: "gan", on: false, msg: "Bu tarayıcı Bluetooth desteklemiyor (Android/masaüstü Chrome kullan; iPhone'da Bluefy)." }); return Promise.resolve(false); }
        return navigator.bluetooth.requestDevice({ filters: [{ namePrefix: "GAN" }, { namePrefix: "Gan" }, { namePrefix: "gan" }], optionalServices: [GAN_SVC] })
            .then(ganAttach)
            .catch(function (e) { emit("status", { kind: "gan", on: false, msg: e && e.name === "NotFoundError" ? "Timer seçilmedi." : "Akıllı timer'a bağlanılamadı." }); return false; });
    }
    // Daha önce izin verilmiş GAN timer'ı sessizce bul (Chrome: getDevices + watchAdvertisements)
    function ganAuto() {
        if (GT.on || !navigator.bluetooth || !navigator.bluetooth.getDevices) return Promise.resolve(false);
        var had = false; try { had = !!localStorage.getItem(PREF + "-gan"); } catch (e) {}
        if (!had) return Promise.resolve(false);
        return navigator.bluetooth.getDevices().then(function (list) {
            var dev = list.filter(function (d) { return /^gan/i.test(d.name || ""); })[0];
            if (!dev) return false;
            if (!dev.watchAdvertisements) return ganAttach(dev).catch(function () { return false; });
            var ac = window.AbortController ? new AbortController() : null;
            dev.addEventListener("advertisementreceived", function once() {
                dev.removeEventListener("advertisementreceived", once); try { ac && ac.abort(); } catch (e) {}
                ganAttach(dev).catch(function () {});
            });
            return dev.watchAdvertisements(ac ? { signal: ac.signal } : undefined).then(function () { return true; }, function () { return false; });
        }, function () { return false; });
    }
    function ganStop() { try { GT.dev && GT.dev.gatt.connected && GT.dev.gatt.disconnect(); } catch (e) {} GT.on = false; GT.running = false; cancelAnimationFrame(GT.raf); }

    window.HwTimer = {
        on: function (f) { cb = f; },
        // kind: "stackmat" | "gan"
        connect: function (kind) { return kind === "gan" ? ganConnect() : smStart(false); },
        stop: function (kind) { if (!kind || kind === "stackmat") smStop(); if (!kind || kind === "gan") ganStop(); },
        connected: function (kind) { return kind === "gan" ? GT.on : SM.seen; },
        listening: function () { return SM.on; },
        running: function () { return SM.running || GT.running; },
        // Otomatik algılama: izin daha önce verildiyse sormadan dene
        auto: function () {
            ganAuto();
            var used = false; try { used = !!localStorage.getItem(PREF + "-mic"); } catch (e) {}
            return used ? micGranted().then(function (ok) { return ok ? smStart(true) : false; }) : Promise.resolve(false);
        },
        supported: function () { return { stackmat: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), gan: !!navigator.bluetooth }; },
        _feed: smFeed, _parse: parsePkt, _reset: function () { SM.decs = null; SM.seen = false; SM.running = false; SM.lastMs = -1; SM.lastSt = ""; }
    };
})();
