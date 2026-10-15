/* =========================================================
   LOOK-AHEAD & TPS (hiz.js)
   - Metronom: her vuruşta bir hamle; algoritmadaki sıradaki hamleyi vurgular
   - Kademeli mod: her turda BPM artar
   - TPS hesaplayıcı: hamle sayısı (rotasyonlar hariç) / süre
========================================================= */
(function () {
    function $(id) { return document.getElementById(id); }
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function T(k, fb) { var p = (window.SITE_I18N && SITE_I18N.pages.hiz) || {}; return (p[lang()] && p[lang()][k]) || (p.tr && p.tr[k]) || fb || k; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function moves(alg) { return String(alg).replace(/[’‘`´]/g, "'").replace(/[()\[\]]/g, " ").split(/\s+/).filter(Boolean); }
    function isRot(m) { return /^[xyz]/.test(m); }
    function count(alg) { return moves(alg).filter(function (m) { return !isRot(m); }).length; }

    /* ---------- metronom ---------- */
    var ctx = null, timer = 0, nextT = 0, beat = 0, running = false, seq = [], bpm = 90, rounds = 0;
    function audio() { if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); } return ctx; }
    function click(t, accent) {
        var c = audio(); if (!c || $("mMute").checked) return;
        var o = c.createOscillator(), g = c.createGain();
        o.frequency.value = accent ? 1320 : 880;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.08);
    }
    function renderSeq(active) {
        $("mSeq").innerHTML = seq.length ? seq.map(function (m, i) { return '<span class="mm' + (i === active ? " on" : "") + (isRot(m) ? " rot" : "") + '">' + esc(m) + '</span>'; }).join("") : '<span class="mm-empty">' + esc(T("m_empty", "Algoritma yaz ya da hazır birini seç.")) + '</span>';
    }
    function setBpm(v) {
        bpm = Math.max(30, Math.min(300, Math.round(v)));
        $("mBpm").value = bpm; $("mBpmVal").textContent = bpm; $("mTps").textContent = (bpm / 60).toFixed(2);
    }
    function schedule() {
        var c = audio(), now = c ? c.currentTime : performance.now() / 1000;
        while (nextT < now + 0.12) {
            var i = seq.length ? beat % seq.length : 0, accent = i === 0;
            click(nextT, accent);
            (function (idx, at) {
                var delay = Math.max(0, (at - now) * 1000);
                setTimeout(function () {
                    if (!running) return;
                    renderSeq(seq.length ? idx : -1);
                    var p = $("mPulse"); p.classList.remove("hit"); void p.offsetWidth; p.classList.add("hit");
                }, delay);
            })(i, nextT);
            beat++;
            if (seq.length && beat % seq.length === 0) {
                rounds++; $("mRounds").textContent = rounds;
                if ($("mRamp").checked) setBpm(bpm + (+$("mRampStep").value || 5));
            }
            nextT += 60 / bpm;
        }
    }
    function start() {
        seq = moves($("mAlg").value);
        var c = audio(); if (c && c.state === "suspended") c.resume();
        running = true; beat = 0; rounds = 0; $("mRounds").textContent = 0;
        nextT = (c ? c.currentTime : performance.now() / 1000) + 0.1;
        timer = setInterval(schedule, 25); schedule();
        $("mStart").textContent = T("m_stop", "■ Durdur"); $("mStart").classList.add("on");
    }
    function stop() {
        running = false; clearInterval(timer);
        $("mStart").textContent = T("m_start", "▶ Başlat"); $("mStart").classList.remove("on");
        renderSeq(-1);
    }

    /* ---------- TPS hesaplayıcı ---------- */
    function calc() {
        var n = count($("tAlg").value), t = parseFloat(String($("tTime").value).replace(",", "."));
        $("tMoves").textContent = n;
        $("tOut").textContent = n && t > 0 ? (n / t).toFixed(2) : "-";
    }

    function init() {
        setBpm(+$("mBpm").value || 90);
        $("mBpm").addEventListener("input", function () { setBpm(+this.value); });
        $("mMinus").addEventListener("click", function () { setBpm(bpm - 5); });
        $("mPlus").addEventListener("click", function () { setBpm(bpm + 5); });
        $("mStart").addEventListener("click", function () { running ? stop() : start(); });
        $("mAlg").addEventListener("input", function () { seq = moves(this.value); beat = 0; renderSeq(-1); });
        document.querySelector(".m-presets").addEventListener("click", function (e) {
            var b = e.target.closest("[data-alg]"); if (!b) return;
            $("mAlg").value = b.getAttribute("data-alg"); seq = moves($("mAlg").value); beat = 0; renderSeq(-1);
        });
        Array.prototype.forEach.call(document.querySelectorAll("[data-bpm]"), function (b) {
            b.addEventListener("click", function () {
                setBpm(+b.getAttribute("data-bpm"));
                if (b.getAttribute("data-alg2")) { $("mAlg").value = b.getAttribute("data-alg2"); seq = moves($("mAlg").value); renderSeq(-1); }
                $("metro").scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
        $("tAlg").addEventListener("input", calc); $("tTime").addEventListener("input", calc);
        document.addEventListener("site-lang-change", function () { if (!running) { $("mStart").textContent = T("m_start"); renderSeq(-1); } });
        seq = moves($("mAlg").value); renderSeq(-1); calc();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
