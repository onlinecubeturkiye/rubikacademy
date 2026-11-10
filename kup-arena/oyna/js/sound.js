// Kodla üretilen kısa ses efektleri (dosya gerekmez, internetsiz çalışır).
(function () {
  let ctx = null, enabled = true;
  function ac() {
    if (!enabled) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { return null; }
    return ctx;
  }
  function tone(freq, dur, opts = {}) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + (opts.delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = opts.type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, opts = {}) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + (opts.delay || 0);
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = opts.filter || 'lowpass'; f.frequency.value = opts.freq || 1200;
    g.gain.value = opts.vol || 0.2;
    src.buffer = buf; src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }
  const notes = (list, step, opts) => list.forEach((f, i) => tone(f, opts.dur || 0.18, { ...opts, delay: i * step }));

  const Sound = {
    setEnabled(v) { enabled = !!v; },
    click() { tone(660, 0.06, { type: 'square', vol: 0.05 }); },
    coin() { notes([988, 1319], 0.07, { type: 'square', vol: 0.06, dur: 0.12 }); },
    shake() { noise(0.4, { freq: 700, vol: 0.12 }); },
    tear() { noise(0.25, { filter: 'highpass', freq: 2000, vol: 0.18 }); tone(300, 0.3, { to: 900, vol: 0.06 }); },
    reveal(order) {
      const scale = [523, 659, 784, 1047, 1319, 1568];
      notes(scale.slice(0, 2 + order), 0.09, { vol: 0.12, dur: 0.25 });
      if (order >= 3) notes([1047, 1568, 2093], 0.12, { type: 'sine', vol: 0.08, dur: 0.5, delay: 0.5 });
    },
    hit() { noise(0.15, { freq: 500, vol: 0.25 }); tone(140, 0.12, { to: 60, type: 'sine', vol: 0.2 }); },
    skill() { tone(400, 0.25, { to: 1200, type: 'sawtooth', vol: 0.05 }); },
    heal() { notes([523, 784, 1047], 0.07, { type: 'sine', vol: 0.08 }); },
    win() { notes([523, 659, 784, 1047], 0.12, { type: 'square', vol: 0.07, dur: 0.22 }); },
    lose() { notes([392, 330, 262], 0.16, { type: 'triangle', vol: 0.1, dur: 0.3 }); },
    turn() { tone(880, 0.04, { type: 'square', vol: 0.03 }); },
    star(i) { tone(880 + i * 220, 0.2, { type: 'sine', vol: 0.12 }); },
  };
  window.Sound = Sound;
})();
