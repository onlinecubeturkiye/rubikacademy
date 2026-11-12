/* =========================================================
   DONANIM TIMER (hw-timer.js) — csTimer'daki gibi
   1) Kablolu timer (Stackmat / SpeedStacks / QiYi / YJ): timer'ın veri çıkışı, ses kablosuyla
      telefonun / bilgisayarın mikrofon girişine bağlanır. Sinyal 1200 baud seri veridir:
      paket = durum harfi + 5 (Gen 3) ya da 6 (Gen 4/5) rakam + sağlama + "\n\r".
      Sağlama = 64 + rakamların toplamı. Kutup (ters/düz) kendiliğinden bulunur.
   2) Akıllı timer'lar (Bluetooth), seçilen cihazın adına göre:
      - GAN Smart Timer / Halo: servis 0xFFF0, durum 0xFFF5; paket 0xFE, uzunluk, ?, durum, [dk, sn, ms(2)], crc16.
        Durumlar: 1 hazırlan, 2 eller kalktı, 3 çalışıyor, 4 durdu (süre), 5 boşta, 6 eller üstte, 7 bitti
      - QiYi Smart Timer (QY-Timer / QY-Adapter): servis 0xFD50; AES-128 ile şifreli, parçalı paketler,
        CRC16/MODBUS; bağlanınca MAC adresiyle "merhaba" gönderilir, her süre kaydı onaylanır.
      (Protokoller csTimer ve açık kaynak topluluk çalışmalarındaki belgelere göre bağımsız yazıldı.)
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

    /* ---------------- Akıllı timer'lar (Bluetooth): GAN Smart Timer / Halo, QiYi Smart Timer ---------------- */
    var GAN_SVC = "0000fff0-0000-1000-8000-00805f9b34fb", GAN_STATE = "0000fff5-0000-1000-8000-00805f9b34fb";
    var QY_SVC = "0000fd50-0000-1000-8000-00805f9b34fb", QY_W = "00000001-0000-1001-8001-00805f9b07d0", QY_R = "00000002-0000-1001-8001-00805f9b07d0", QY_CIC = 0x0504;
    var GT = { dev: null, on: false, running: false, t0: 0, raf: 0, model: "", stopped: false };
    function btStart() { GT.running = true; GT.stopped = false; GT.t0 = now(); emit("start"); tickLoop(); }
    function btStop(ms) {
        cancelAnimationFrame(GT.raf);
        var was = GT.running && !GT.stopped; GT.running = false;
        if (was && ms > 0) { GT.stopped = true; emit("tick", ms); emit("stop", ms); }
    }
    function btIdle() { GT.running = false; cancelAnimationFrame(GT.raf); emit("reset"); emit("tick", 0); }
    function tickLoop() { cancelAnimationFrame(GT.raf); var f = function () { if (!GT.running) return; emit("tick", Math.round(now() - GT.t0)); GT.raf = requestAnimationFrame(f); }; f(); }
    function btLost() { GT.on = false; GT.running = false; cancelAnimationFrame(GT.raf); emit("status", { kind: "gan", on: false, msg: "Akıllı timer bağlantısı koptu." }); }

    // --- GAN: düz bildirim paketi
    function ganEvent(e) {
        var v = e.target.value; if (!v || v.byteLength < 4 || v.getUint8(0) !== 0xFE) return;
        var s = v.getUint8(3);
        if (s === 1 || s === 6) emit("ready");
        else if (s === 3) btStart();
        else if (s === 4 && v.byteLength >= 8) btStop(v.getUint8(4) * 60000 + v.getUint8(5) * 1000 + v.getUint16(6, true));
        else if (s === 5) btIdle();
        else if (s === 0) btLost();
    }
    function ganInit(srv) {
        return srv.getPrimaryService(GAN_SVC).then(function (svc) { return svc.getCharacteristic(GAN_STATE); })
            .then(function (ch) { ch.addEventListener("characteristicvaluechanged", ganEvent); return ch.startNotifications(); });
    }

    // --- QiYi: AES-128 (ECB, anahtar 16 × 0x77) ile şifreli, parçalı paketler; CRC16/MODBUS
    function crc16modbus(a) { var c = 0xFFFF; for (var i = 0; i < a.length; i++) { c ^= a[i]; for (var j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xA001 : c >>> 1; } return c; }
    function makeAes(key) {
        var S = new Array(256), Si = new Array(256), i;
        var xt = function (a) { return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff; };
        var mul = function (a, b) { var r = 0; while (b) { if (b & 1) r ^= a; a = xt(a); b >>= 1; } return r; };
        for (i = 0; i < 256; i++) {
            var inv = 0; if (i) for (var j = 1; j < 256; j++) if (mul(i, j) === 1) { inv = j; break; }
            var sv = inv, r = inv; for (var k = 0; k < 4; k++) { r = ((r << 1) | (r >> 7)) & 0xff; sv ^= r; }
            S[i] = sv ^ 0x63; Si[S[i]] = i;
        }
        var w = key.slice(), rc = 1;
        for (i = 16; i < 176; i += 4) {
            var t = w.slice(i - 4, i);
            if (i % 16 === 0) { t = [S[t[1]] ^ rc, S[t[2]], S[t[3]], S[t[0]]]; rc = xt(rc); }
            for (var q = 0; q < 4; q++) w[i + q] = w[i - 16 + q] ^ t[q];
        }
        function addKey(b, n) { for (var i = 0; i < 16; i++) b[i] ^= w[n * 16 + i]; }
        function shift(b, inv) { var c = b.slice(); for (var r = 1; r < 4; r++) for (var col = 0; col < 4; col++) b[r + 4 * col] = c[r + 4 * ((col + (inv ? 4 - r : r)) % 4)]; }
        function mix(b, inv) {
            var m = inv ? [14, 11, 13, 9] : [2, 3, 1, 1];
            for (var c = 0; c < 4; c++) { var a = b.slice(4 * c, 4 * c + 4); for (var r = 0; r < 4; r++) b[4 * c + r] = mul(a[r], m[0]) ^ mul(a[(r + 1) % 4], m[1]) ^ mul(a[(r + 2) % 4], m[2]) ^ mul(a[(r + 3) % 4], m[3]); }
        }
        return {
            encrypt: function (b) { addKey(b, 0); for (var n = 1; n <= 10; n++) { for (var i = 0; i < 16; i++) b[i] = S[b[i]]; shift(b, false); if (n < 10) mix(b, false); addKey(b, n); } return b; },
            decrypt: function (b) { addKey(b, 10); for (var n = 9; n >= 0; n--) { shift(b, true); for (var i = 0; i < 16; i++) b[i] = Si[b[i]]; addKey(b, n); if (n > 0) mix(b, true); } return b; }
        };
    }
    var QY = { aes: null, w: null, wait: 0, len: 0, buf: [], mac: "", lastSn: -1 };
    function qyAes() { return QY.aes || (QY.aes = makeAes([0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77, 0x77])); }
    function be(n, k) { var o = []; for (var i = k - 1; i >= 0; i--) o.push((n >>> (8 * i)) & 0xff); return o; }
    // Mesaj → şifreli parçalar (her parça: başlık + 16 bayt)
    function qyFrames(sn, ack, cmd, data) {
        var m = be(sn, 4).concat(be(ack, 4), be(cmd, 2), be(data.length, 2), data), c = crc16modbus(m);
        m.push(c >> 8, c & 0xff);
        var out = [];
        for (var i = 0; i < m.length; i += 16) {
            var blk = m.slice(i, i + 16); while (blk.length < 16) blk.push(1);
            qyAes().encrypt(blk);
            out.push((i === 0 ? [0x00, m.length + 2, 0x40, 0x00] : [i >> 4]).concat(blk));
        }
        return out;
    }
    function qySend(sn, ack, cmd, data) {
        var p = Promise.resolve();
        qyFrames(sn, ack, cmd, data).forEach(function (f) { p = p.then(function () { return QY.w && QY.w.writeValue(new Uint8Array(f).buffer); }); });
        return p.catch(function () {});
    }
    function qyHello(mac) {
        var d = [0, 0, 0, 0, 0, 33, 8, 0, 1, 5, 90];
        var b = mac.split(":").map(function (h) { return parseInt(h, 16) || 0; }).reverse();
        return qySend(1, 0, 1, d.concat(b));
    }
    // Gelen parçaları birleştir, çöz, doğrula → komut
    function qyFeed(bytes) {
        var m = Array.prototype.slice.call(bytes);
        if (m[0] !== QY.wait) { QY.wait = 0; QY.buf = []; if (m[0] !== 0) return null; }
        if (m[0] === 0) { QY.len = m[1] - 2; m = m.slice(4); } else m = m.slice(1);
        for (var i = 0; i < m.length; i += 16) {
            var blk = m.slice(i, i + 16);
            if (blk.length < 16) { QY.wait = 0; QY.buf = []; return null; }
            QY.buf = QY.buf.concat(qyAes().decrypt(blk));
        }
        if (QY.buf.length < QY.len) { QY.wait++; return null; }
        var d = QY.buf.slice(0, QY.len); QY.wait = 0; QY.buf = [];
        var len = d[10] << 8 | d[11];
        if (d.length < len + 14 || crc16modbus(d.slice(0, len + 12)) !== (d[len + 12] << 8 | d[len + 13])) return null;
        return { sn: (d[0] << 24 | d[1] << 16 | d[2] << 8 | d[3]) >>> 0, ack: (d[4] << 24 | d[5] << 16 | d[6] << 8 | d[7]) >>> 0, cmd: d[8] << 8 | d[9], data: d.slice(12, 12 + len) };
    }
    function u32(a, i) { return (a[i] << 24 | a[i + 1] << 16 | a[i + 2] << 8 | a[i + 3]) >>> 0; }
    function qyMsg(msg) {
        if (!msg || msg.cmd !== 0x1003) return;
        var d = msg.data;
        if (d[0] === 1 && d[1] === 1) { // çözüm kaydı: süre (ms); aynı kayıt (aynı sıra no.) ikinci kez gelirse yok sayılır
            if (msg.sn !== QY.lastSn) { QY.lastSn = msg.sn; GT.running = true; GT.stopped = false; btStop(u32(d, 8)); }
            qySend(msg.ack + 1, msg.sn, 0x1003, [0x00]);
        } else if (d[0] === 4 && d[1] === 4) { // durum: 0 boşta, 1 inceleme, 2 hazır, 3 çalışıyor, 4 bitti, 5 durdu, 6 koptu
            var s = d[4];
            if (s === 2) emit("ready");
            else if (s === 3) { if (!GT.running) btStart(); }
            else if (s === 0) { if (!GT.running) btIdle(); }
            else if (s === 6) btLost();
        }
    }
    function qyEvent(e) { var v = e.target.value; qyMsg(qyFeed(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))); }
    // MAC adresi: önce yayın paketindeki üretici verisi, yoksa addan (QY-Timer-XXXX → CC:A1:00:00:XX:XX), yoksa sor
    function qyMac(dev) {
        var key = PREF + "-mac-" + (dev.id || dev.name), saved = ""; try { saved = localStorage.getItem(key) || ""; } catch (e) {}
        var fromName = function () {
            var m = /^QY-(Timer|Adapter).*-([0-9A-F]{4})$/i.exec((dev.name || "").trim());
            return m ? (m[1].toLowerCase() === "adapter" ? "CC:A8" : "CC:A1") + ":00:00:" + m[2].slice(0, 2).toUpperCase() + ":" + m[2].slice(2, 4).toUpperCase() : "";
        };
        var fromAdv = new Promise(function (res) {
            if (!dev.watchAdvertisements || !window.AbortController) return res("");
            var ac = new AbortController(), done = function (v) { try { ac.abort(); } catch (e) {} dev.removeEventListener("advertisementreceived", on); res(v); };
            var on = function (ev) {
                var md = ev.manufacturerData; if (!md || !md.size) return;
                var dv = md.get(QY_CIC); if (!dv || dv.byteLength < 6) return;
                var mac = []; for (var i = 5; i >= 0; i--) mac.push((dv.getUint8(i) + 0x100).toString(16).slice(1).toUpperCase());
                done(mac.join(":"));
            };
            dev.addEventListener("advertisementreceived", on);
            dev.watchAdvertisements({ signal: ac.signal }).catch(function () { done(""); });
            setTimeout(function () { done(""); }, 4000);
        });
        return fromAdv.then(function (mac) {
            mac = mac || saved || fromName();
            if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac)) {
                mac = (window.prompt("QiYi timer'ın MAC adresini yaz (ör. CC:A1:00:00:12:34). Timer'ın kutusunda ya da QiYi uygulamasında yazar.", "") || "").trim().toUpperCase();
            }
            if (/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac)) { try { localStorage.setItem(key, mac); } catch (e) {} return mac; }
            throw new Error("mac");
        });
    }
    function qyInit(srv, dev, mac) {
        QY.wait = 0; QY.buf = [];
        return srv.getPrimaryService(QY_SVC).then(function (svc) { return svc.getCharacteristics(); }).then(function (chs) {
            var f = function (u) { return chs.filter(function (c) { return c.uuid.toLowerCase() === u; })[0]; };
            QY.w = f(QY_W); var r = f(QY_R);
            if (!QY.w || !r) throw new Error("chr");
            r.addEventListener("characteristicvaluechanged", qyEvent);
            return r.startNotifications();
        }).then(function () { return qyHello(mac); });
    }

    // --- ortak bağlanma
    function btModel(dev) { return /^QY-/i.test(dev.name || "") ? "qiyi" : "gan"; }
    function btAttach(dev) {
        GT.dev = dev; GT.model = btModel(dev);
        dev.removeEventListener("gattserverdisconnected", btLost); dev.addEventListener("gattserverdisconnected", btLost);
        var label = (GT.model === "qiyi" ? "QiYi" : "GAN") + " (" + (dev.name || "timer") + ")";
        emit("status", { kind: "gan", on: false, msg: "Bağlanıyor… " + label });
        var macP = GT.model === "qiyi" ? qyMac(dev) : Promise.resolve("");
        return macP.then(function (mac) {
            return dev.gatt.connect().then(function (srv) { return GT.model === "qiyi" ? qyInit(srv, dev, mac) : ganInit(srv); });
        }).then(function () {
            GT.on = true;
            try { localStorage.setItem(PREF + "-gan", dev.id || "1"); } catch (e) {}
            emit("status", { kind: "gan", on: true, msg: "Akıllı timer bağlı: " + label }); emit("detected", "gan");
            return true;
        });
    }
    function btConnect() {
        if (!navigator.bluetooth) { emit("status", { kind: "gan", on: false, msg: "Bu tarayıcı Bluetooth desteklemiyor (Android/masaüstü Chrome kullan; iPhone'da Bluefy)." }); return Promise.resolve(false); }
        var opts = { filters: [{ namePrefix: "GAN" }, { namePrefix: "Gan" }, { namePrefix: "gan" }, { namePrefix: "QY-Timer" }, { namePrefix: "QY-Adapter" }], optionalServices: [GAN_SVC, QY_SVC], optionalManufacturerData: [QY_CIC] };
        if (!/Bluefy/i.test(navigator.userAgent || "")) opts.filters.push({ services: [GAN_SVC] });
        return navigator.bluetooth.requestDevice(opts).catch(function (e) {
            // eski tarayıcı optionalManufacturerData'yı tanımıyorsa onsuz dene
            if (e && e.name === "TypeError") { delete opts.optionalManufacturerData; return navigator.bluetooth.requestDevice(opts); }
            throw e;
        }).then(btAttach)
            .catch(function (e) { emit("status", { kind: "gan", on: false, msg: e && e.name === "NotFoundError" ? "Timer seçilmedi." : e && e.message === "mac" ? "QiYi timer için MAC adresi gerekli." : "Akıllı timer'a bağlanılamadı." }); return false; });
    }
    // Daha önce izin verilmiş timer'ı sessizce bul (Chrome: getDevices + watchAdvertisements)
    function btAuto() {
        if (GT.on || !navigator.bluetooth || !navigator.bluetooth.getDevices) return Promise.resolve(false);
        var had = false; try { had = !!localStorage.getItem(PREF + "-gan"); } catch (e) {}
        if (!had) return Promise.resolve(false);
        return navigator.bluetooth.getDevices().then(function (list) {
            var dev = list.filter(function (d) { return /^(gan|qy-timer|qy-adapter)/i.test(d.name || ""); })[0];
            if (!dev) return false;
            if (!dev.watchAdvertisements) return btAttach(dev).catch(function () { return false; });
            var ac = window.AbortController ? new AbortController() : null;
            dev.addEventListener("advertisementreceived", function once() {
                dev.removeEventListener("advertisementreceived", once); try { ac && ac.abort(); } catch (e) {}
                btAttach(dev).catch(function () {});
            });
            return dev.watchAdvertisements(ac ? { signal: ac.signal } : undefined).then(function () { return true; }, function () { return false; });
        }, function () { return false; });
    }
    function btStopAll() { try { GT.dev && GT.dev.gatt.connected && GT.dev.gatt.disconnect(); } catch (e) {} GT.on = false; GT.running = false; cancelAnimationFrame(GT.raf); }

    window.HwTimer = {
        on: function (f) { cb = f; },
        // kind: "stackmat" | "gan"
        connect: function (kind) { return kind === "gan" ? btConnect() : smStart(false); },
        stop: function (kind) { if (!kind || kind === "stackmat") smStop(); if (!kind || kind === "gan") btStopAll(); },
        connected: function (kind) { return kind === "gan" ? GT.on : SM.seen; },
        listening: function () { return SM.on; },
        running: function () { return SM.running || GT.running; },
        // Otomatik algılama: izin daha önce verildiyse sormadan dene
        auto: function () {
            btAuto();
            var used = false; try { used = !!localStorage.getItem(PREF + "-mic"); } catch (e) {}
            return used ? micGranted().then(function (ok) { return ok ? smStart(true) : false; }) : Promise.resolve(false);
        },
        supported: function () { return { stackmat: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), gan: !!navigator.bluetooth }; },
        _feed: smFeed, _parse: parsePkt, _qy: { box: QY, frames: qyFrames, feed: qyFeed, msg: qyMsg, aes: makeAes, crc: crc16modbus, state: GT }, _reset: function () { SM.decs = null; SM.seen = false; SM.running = false; SM.lastMs = -1; SM.lastSt = ""; }
    };
})();
