// Bulmacaları 2B kanvasa izometrik olarak çizer (kart, paket ve envanter görselleri için).
(function () {
  const C30 = Math.cos(Math.PI / 6);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // c: [p00, p10, p11, p01]; u boyunca p00→p10, v boyunca p00→p01
  const bil = (c, u, v) => lerp(lerp(c[0], c[1], u), lerp(c[3], c[2], u), v);

  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = f < 0 ? 0 : 255, p = Math.abs(f);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }

  function cubeFaces(cx, cy, s) {
    const top = [[cx - s * C30, cy - s / 2], [cx, cy - s], [cx + s * C30, cy - s / 2], [cx, cy]];
    const left = [[cx - s * C30, cy - s / 2], [cx, cy], [cx, cy + s], [cx - s * C30, cy + s / 2]];
    const right = [[cx, cy], [cx + s * C30, cy - s / 2], [cx + s * C30, cy + s / 2], [cx, cy + s]];
    const hex = [[cx, cy - s], [cx + s * C30, cy - s / 2], [cx + s * C30, cy + s / 2], [cx, cy + s], [cx - s * C30, cy + s / 2], [cx - s * C30, cy - s / 2]];
    return { top, left, right, hex };
  }

  // Yuvarlak köşeli dörtgen (izometrik yüzeyde çıkartma)
  function roundQuad(ctx, q, t) {
    const L = (a, b, k) => lerp(a, b, k);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const p = q[i], prev = q[(i + 3) % 4], next = q[(i + 1) % 4];
      const a = L(p, prev, t), b = L(p, next, t);
      if (i === 0) ctx.moveTo(a[0], a[1]); else ctx.lineTo(a[0], a[1]);
      ctx.quadraticCurveTo(p[0], p[1], b[0], b[1]);
    }
    ctx.closePath();
  }
  // Parlak çıkartma: renk geçişi + sol üstte ışık yansıması
  function sticker(ctx, q, col, tint) {
    const gr = ctx.createLinearGradient(q[0][0], q[0][1], q[2][0], q[2][1]);
    gr.addColorStop(0, shade(col, tint + 0.2));
    gr.addColorStop(0.55, shade(col, tint));
    gr.addColorStop(1, shade(col, tint - 0.12));
    roundQuad(ctx, q, 0.26);
    ctx.fillStyle = gr; ctx.fill();
    // ışık yansıması
    const hq = [lerp(q[0], q[2], 0.08), lerp(lerp(q[0], q[1], 0.6), q[2], 0.08), lerp(lerp(q[0], q[1], 0.6), lerp(q[3], q[2], 0.6), 0.3), lerp(lerp(q[0], q[3], 0.55), q[2], 0.08)];
    ctx.save(); ctx.globalAlpha = 0.28;
    roundQuad(ctx, hq, 0.4); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
  }

  function drawCube(ctx, cx, cy, s, n, pal, cuts) {
    const f = cubeFaces(cx, cy, s);
    // gövde: kalın, yuvarlak köşeli; altı biraz koyu
    poly(ctx, f.hex, pal.body, pal.body, s * 0.11);
    const bg = ctx.createLinearGradient(cx, cy - s, cx, cy + s);
    bg.addColorStop(0, 'rgba(255,255,255,0.10)'); bg.addColorStop(1, 'rgba(0,0,0,0.25)');
    poly(ctx, f.hex, bg);
    cuts = cuts || Array.from({ length: n + 1 }, (_, i) => i / n);
    const g = 0.04 / Math.max(1, n / 3) + 0.012;
    const faces = [[f.top, pal.U, 0.1], [f.left, pal.F, 0], [f.right, pal.R, -0.18]];
    for (const [c, col, sh] of faces) {
      for (let i = 0; i < cuts.length - 1; i++) for (let j = 0; j < cuts.length - 1; j++) {
        const u0 = cuts[i] + g, u1 = cuts[i + 1] - g, v0 = cuts[j] + g, v1 = cuts[j + 1] - g;
        const tint = pal.mirror ? sh + ((i * 7 + j * 3) % 5 - 2) * 0.04 : sh;
        sticker(ctx, [bil(c, u0, v0), bil(c, u1, v0), bil(c, u1, v1), bil(c, u0, v1)], col, tint);
      }
    }
    // gövde kenarında ince ışık çizgisi (üst kenarlar)
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(1, s * 0.018); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(f.hex[5][0], f.hex[5][1]); ctx.lineTo(f.hex[0][0], f.hex[0][1]); ctx.lineTo(f.hex[1][0], f.hex[1][1]); ctx.stroke();
    ctx.restore();
  }

  function drawSkewb(ctx, cx, cy, s, pal) {
    const f = cubeFaces(cx, cy, s);
    poly(ctx, f.hex, pal.body, pal.body, s * 0.09);
    const faces = [[f.top, pal.U, 0.1], [f.left, pal.F, 0], [f.right, pal.R, -0.16]];
    for (const [c, col, sh] of faces) {
      const g = 0.05;
      const m = [bil(c, 0.5, g), bil(c, 1 - g, 0.5), bil(c, 0.5, 1 - g), bil(c, g, 0.5)];
      poly(ctx, m, shade(col, sh));
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
      corners.forEach(([u, v]) => {
        const du = u ? -1 : 1, dv = v ? -1 : 1;
        poly(ctx, [bil(c, u + du * g, v + dv * g), bil(c, u + du * (0.5 - g * 1.6), v + dv * g), bil(c, u + du * g, v + dv * (0.5 - g * 1.6))], shade(col, sh));
      });
    }
  }

  function drawPyramid(ctx, cx, cy, s, n, pal) {
    const A = [cx, cy - s * 1.05], BL = [cx - s * 0.98, cy + s * 0.62], BM = [cx + s * 0.1, cy + s * 0.9], BR = [cx + s * 0.98, cy + s * 0.45];
    poly(ctx, [A, BL, BM, BR], pal.body, pal.body, s * 0.1);
    const faces = [[A, BL, BM, pal.D, 0], [A, BM, BR, pal.F, -0.15]];
    for (const [a, b, c, col, sh] of faces) {
      const P = (i, j) => [a[0] + (b[0] - a[0]) * i / n + (c[0] - b[0]) * j / n, a[1] + (b[1] - a[1]) * i / n + (c[1] - b[1]) * j / n];
      const tri = (p, q, r) => {
        const m = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3], k = 0.8;
        const t = [p, q, r].map(x => [m[0] + (x[0] - m[0]) * k, m[1] + (x[1] - m[1]) * k]);
        // yuvarlak köşeli üçgen + renk geçişi + parlama
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = lerp(t[i], t[(i + 2) % 3], 0.22), b = lerp(t[i], t[(i + 1) % 3], 0.22);
          if (!i) ctx.moveTo(a[0], a[1]); else ctx.lineTo(a[0], a[1]);
          ctx.quadraticCurveTo(t[i][0], t[i][1], b[0], b[1]);
        }
        ctx.closePath();
        const gr = ctx.createLinearGradient(t[0][0], t[0][1], m[0], m[1] + (m[1] - t[0][1]));
        gr.addColorStop(0, shade(col, sh + 0.2)); gr.addColorStop(1, shade(col, sh - 0.1));
        ctx.fillStyle = gr; ctx.fill();
      };
      for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
        tri(P(i, j), P(i + 1, j), P(i + 1, j + 1));
        if (j < i) tri(P(i, j), P(i + 1, j + 1), P(i, j + 1));
      }
    }
  }

  function drawMega(ctx, cx, cy, s, pal) {
    const ang = (k, off = 0) => -Math.PI / 2 + (k + off) * 2 * Math.PI / 5;
    const P = (r, k, off) => [cx + Math.cos(ang(k, off)) * r, cy + Math.sin(ang(k, off)) * r];
    const R2 = s * 0.55, R3 = s * 1.02;
    const outer = []; for (let k = 0; k < 10; k++) outer.push(P(R3, k / 2));
    poly(ctx, outer, pal.body, pal.body, s * 0.1);
    const ring = pal.ring || [pal.F, pal.R, pal.D, pal.L, pal.B];
    const lw = s * 0.045;
    for (let k = 0; k < 5; k++) {
      const pts = [P(R2, k), P(R3, k), P(R3, k, 0.5), P(R3, k + 1), P(R2, k + 1)];
      poly(ctx, pts, shade(ring[k], -0.05), pal.body, lw);
      const mid = lerp(P(R2, k), P(R2, k + 1), 0.5);
      ctx.beginPath(); ctx.moveTo(mid[0], mid[1]); const o = P(R3, k, 0.5); ctx.lineTo(o[0], o[1]); ctx.stroke();
    }
    const face = [0, 1, 2, 3, 4].map(k => P(R2, k));
    poly(ctx, face, pal.U, pal.body, lw);
    const inner = [0, 1, 2, 3, 4].map(k => P(R2 * 0.45, k));
    poly(ctx, inner, null, pal.body, lw);
    for (let k = 0; k < 5; k++) {
      const a = lerp(P(R2, k), P(R2, k + 1), 0.3), b = lerp(P(R2, k - 1), P(R2, k), 0.7);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(inner[k][0], inner[k][1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }

  // Marka logosu: üst yüzün ortasına, yüzeyin açısına uygun basılır.
  function lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; }
  function drawLogo(ctx, top, n, text, stickerColor) {
    const [c0, c1, , c3] = top;
    const odd = n % 2 === 1, k = odd ? 0.5 : (n / 2 + 0.5) / n;
    const fs = Math.min(30, (100 / n) * 0.36);
    ctx.save();
    ctx.transform((c1[0] - c0[0]) / 100, (c1[1] - c0[1]) / 100, (c3[0] - c0[0]) / 100, (c3[1] - c0[1]) / 100, c0[0], c0[1]);
    ctx.font = `800 ${fs}px "Baloo 2", "Arial Black", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = lum(stickerColor) > 0.55 ? 'rgba(29,20,70,0.7)' : 'rgba(255,255,255,0.85)';
    ctx.fillText(text, k * 100, k * 100);
    ctx.restore();
  }

  function drawPuzzleAt(ctx, def, cx, cy, s, opts = {}) {
    const P = window.GameData.PALETTES;
    let pal = P[def.pal] || P.classic;
    if (opts.unknown) pal = { U: '#3b2d6e', D: '#3b2d6e', F: '#33265f', B: '#33265f', R: '#2b2052', L: '#2b2052', body: '#221844', ring: Array(5).fill('#33265f') };
    if (def.type === 'mirror') pal = Object.assign({ mirror: true }, pal);
    switch (def.type) {
      case 'pyramid': return drawPyramid(ctx, cx, cy, s, def.n, pal);
      case 'mega': return drawMega(ctx, cx, cy, s, pal);
      case 'skewb': return drawSkewb(ctx, cx, cy, s, pal);
      case 'mirror': drawCube(ctx, cx, cy, s, 3, pal, [0, 0.24, 0.66, 1]); break;
      default: drawCube(ctx, cx, cy, s, def.n, pal);
    }
    const B = window.GameData.BRANDS;
    if (def.brand && !opts.unknown && !opts.noLogo && s > 25) drawLogo(ctx, cubeFaces(cx, cy, s).top, def.type === 'mirror' ? 3 : def.n, B[def.brand].name, pal.U);
  }

  function setup(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawPuzzle(canvas, def, opts) {
    const { ctx, w, h } = setup(canvas);
    drawPuzzleAt(ctx, def, w / 2, h / 2 + h * 0.02, Math.min(w, h) * 0.36, opts);
  }

  function drawPackArt(canvas, defs) {
    const { ctx, w, h } = setup(canvas);
    const spots = [[0.3, 0.36, 0.2], [0.72, 0.4, 0.2], [0.5, 0.66, 0.27]];
    defs.forEach((d, i) => {
      const [x, y, k] = spots[i];
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      drawPuzzleAt(ctx, d, w * x, h * y, Math.min(w, h) * k);
      ctx.restore();
    });
    // pırıltılar
    ctx.fillStyle = '#ffffff';
    [[0.14, 0.15, 6], [0.86, 0.12, 5], [0.12, 0.8, 4], [0.9, 0.78, 6], [0.5, 0.1, 4]].forEach(([x, y, r]) => {
      const X = w * x, Y = h * y;
      ctx.beginPath(); ctx.moveTo(X, Y - r * 1.8); ctx.quadraticCurveTo(X, Y, X + r * 1.8, Y); ctx.quadraticCurveTo(X, Y, X, Y + r * 1.8);
      ctx.quadraticCurveTo(X, Y, X - r * 1.8, Y); ctx.quadraticCurveTo(X, Y, X, Y - r * 1.8); ctx.fill();
    });
  }

  window.Render = { drawPuzzle, drawPackArt };
})();
