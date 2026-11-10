// Görsel efektler: parçacık patlaması, konfeti, ekran sarsıntısı, uçan jetonlar.
(function () {
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.id = 'fx';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let parts = [], running = false, dpr = 1;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size(); addEventListener('resize', size);

  function loop() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      if (p.shape === 'rect') { ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      else if (p.shape === 'star') { star(p.s); }
      else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function star(s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.25 : s * 0.6, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }
  function add(list) {
    if (reduced) return;
    parts.push(...list);
    if (parts.length > 400) parts = parts.slice(-400);
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  const COLORS = ['#ffcc1f', '#ff4f9a', '#2fcf73', '#22d3ee', '#7b4dff', '#ff8a1f', '#ffffff'];

  const FX = {};
  FX.burst = function (x, y, color, n = 16, power = 6) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = power * (0.4 + Math.random());
      list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.25, s: 6 + Math.random() * 7, c: color || COLORS[i % COLORS.length], life: 30 + Math.random() * 20, rot: 0, vr: (Math.random() - 0.5) * 0.4, shape: Math.random() < 0.5 ? 'star' : 'dot' });
    }
    add(list);
  };
  FX.burstAt = function (el, color, n, power) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height / 2, color, n, power);
  };
  FX.confetti = function (n = 120) {
    const list = [];
    for (let i = 0; i < n; i++) {
      list.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.4, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, g: 0.06, s: 8 + Math.random() * 8, c: COLORS[i % COLORS.length], life: 140 + Math.random() * 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, shape: 'rect' });
    }
    add(list);
  };
  FX.shake = function (el) {
    if (!el || reduced) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 380);
  };
  // Jetonlar ekranın ortasından (ya da bir öğeden) üstteki jeton sayacına uçar.
  FX.coins = function (n = 8, fromEl) {
    if (reduced) return;
    const target = document.getElementById('coins');
    if (!target) return;
    const t = target.getBoundingClientRect();
    let sx = innerWidth / 2, sy = innerHeight / 2;
    if (fromEl) { const r = fromEl.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; }
    for (let i = 0; i < Math.min(n, 14); i++) {
      const c = document.createElement('i');
      c.className = 'coin fly-coin';
      const ox = (Math.random() - 0.5) * 80, oy = (Math.random() - 0.5) * 60;
      c.style.left = (sx + ox) + 'px'; c.style.top = (sy + oy) + 'px';
      document.body.appendChild(c);
      setTimeout(() => { c.style.transform = `translate(${t.left - sx - ox}px, ${t.top - sy - oy}px) scale(0.7)`; c.style.opacity = '0.4'; }, 30 + i * 45);
      setTimeout(() => { c.remove(); if (i === 0) FX.pop(target.parentElement); }, 800 + i * 45);
    }
  };
  FX.pop = function (el) {
    if (!el || reduced) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
  };
  window.FX = FX;
})();
