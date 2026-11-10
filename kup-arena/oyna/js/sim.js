// 3B küp simülatörü (Three.js). Sim.load(n, palet) ile küp yüklenir; çözülünce Sim.onSolved çağrılır.
(function () {
  const V = THREE.Vector3;
  const $ = (id) => document.getElementById(id);
  const canvas = $('sim-cv'), stage = $('sim-stage');
  const FACES = [
    { key: 'R', n: [1, 0, 0] }, { key: 'L', n: [-1, 0, 0] },
    { key: 'U', n: [0, 1, 0] }, { key: 'D', n: [0, -1, 0] },
    { key: 'F', n: [0, 0, 1] }, { key: 'B', n: [0, 0, -1] },
  ];

  const Sim = { active: false, onSolved: null, onChange: null };
  window.Sim = Sim;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    stage.insertAdjacentHTML('beforeend', '<p class="sim-error">Bu cihaz 3B görüntülemeyi desteklemiyor.</p>');
    Sim.load = () => {};
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 300);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 0.85));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
  keyLight.position.set(3, 5, 4);
  // arkadan dolgu ışığı: kenarlar parlasın
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.45);
  rim.position.set(-4, 2, -3);
  camera.add(rim);
  camera.add(keyLight);
  const root = new THREE.Group();
  scene.add(root);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.42, metalness: 0.05 });
  const stickerMats = {};
  // Cilalı plastik çıkartma
  const glossy = (opts) => new THREE.MeshPhysicalMaterial(Object.assign({ roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12 }, opts));
  FACES.forEach(f => (stickerMats[f.key] = glossy({ color: 0xffffff })));
  // Yuvarlak kenarlı parça (gerçek küplerdeki gibi)
  function roundedBox(size, r, seg) {
    const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg);
    const pos = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3(), inner = size / 2 - r;
    const cl = (x) => Math.max(-inner, Math.min(inner, x));
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      c.set(cl(v.x), cl(v.y), cl(v.z));
      const d = v.clone().sub(c);
      if (d.lengthSq() > 1e-9) v.copy(c).add(d.normalize().multiplyScalar(r));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  const bodyGeo = roundedBox(0.98, 0.08, 4);
  const stickerGeo = new THREE.ShapeGeometry(roundedSquare(0.82, 0.14), 6);
  function roundedSquare(s, r) {
    const h = s / 2, sh = new THREE.Shape();
    sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r);
    sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h); sh.lineTo(-h + r, h);
    sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h);
    return sh;
  }
  const r2 = (v) => Math.round(v * 2) / 2;

  let N = 3, O = 1, cubies = [], bodies = [];
  function build(n) {
    for (const c of cubies) root.remove(c);
    N = n; O = (n - 1) / 2; cubies = []; bodies = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const x = i - O, y = j - O, z = k - O;
      if (Math.abs(x) < O - 0.01 && Math.abs(y) < O - 0.01 && Math.abs(z) < O - 0.01) continue;
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.userData.stickers = [];
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.userData.cubie = g;
      g.add(body); bodies.push(body);
      for (const f of FACES) {
        const [a, b, c] = f.n;
        if (Math.abs(a * x + b * y + c * z - O) > 0.01) continue;
        const isLogo = logoOn && f.key === 'U' && N % 2 === 1 && Math.abs(x) < 0.01 && Math.abs(z) < 0.01;
        const s = new THREE.Mesh(stickerGeo, isLogo ? logoMat : stickerMats[f.key]);
        s.position.set(a * 0.495, b * 0.495, c * 0.495);
        s.lookAt(a, b, c);
        s.userData = { face: f.key, n: new V(a, b, c) };
        g.add(s); g.userData.stickers.push(s);
      }
      root.add(g); cubies.push(g);
    }
    fitCamera();
  }
  function snap(c) {
    c.position.set(r2(c.position.x), r2(c.position.y), r2(c.position.z));
    const m = new THREE.Matrix4().makeRotationFromQuaternion(c.quaternion);
    for (let i = 0; i < 16; i++) m.elements[i] = Math.round(m.elements[i]);
    c.quaternion.setFromRotationMatrix(m);
  }
  function isSolved() {
    const seen = {};
    for (const c of cubies) for (const s of c.userData.stickers) {
      const n = s.userData.n.clone().applyQuaternion(c.quaternion);
      const k = Math.round(n.x) + ',' + Math.round(n.y) + ',' + Math.round(n.z);
      if (seen[k] && seen[k] !== s.userData.face) return false;
      seen[k] = s.userData.face;
    }
    return true;
  }

  const BASE = { U: ['y', 1, -1], D: ['y', -1, 1], R: ['x', 1, -1], L: ['x', -1, 1], F: ['z', 1, -1], B: ['z', -1, 1] };
  function parseMove(s) {
    const [axis, side, dir] = BASE[s[0]];
    return { axis, layer: side * O, dir: s.includes("'") ? -dir : dir };
  }
  const inverse = (m) => ({ axis: m.axis, layer: m.layer, dir: -m.dir });
  const NAMES = { x: ['R', 'L', 'M', 1], y: ['U', 'D', 'E', 1], z: ['F', 'B', 'S', -1] };
  function moveName(m) {
    const [pos, neg, mid, midDir] = NAMES[m.axis];
    if (Math.abs(m.layer) < 0.01) return mid + (m.dir === midDir ? '' : "'");
    if (m.layer > 0) { const k = Math.round(O - m.layer) + 1; return (k > 1 ? k : '') + pos + (m.dir === -1 ? '' : "'"); }
    const k = Math.round(O + m.layer) + 1;
    return (k > 1 ? k : '') + neg + (m.dir === 1 ? '' : "'");
  }

  // ---------- Animasyon kuyruğu ----------
  const queue = [];
  let anim = null;
  function startNext() {
    while (!anim && queue.length) {
      const m = queue.shift();
      root.updateMatrixWorld(true);
      const pivot = new THREE.Object3D();
      root.add(pivot);
      const layer = cubies.filter(c => Math.abs(c.position[m.axis] - m.layer) < 0.1);
      layer.forEach(c => pivot.attach(c));
      const dur = queue.length > 1 && m.kind === 'user' ? m.dur * 0.5 : m.dur;
      anim = { m, pivot, layer, t0: performance.now(), dur };
      if (dur <= 0) finishAnim();
    }
  }
  function finishAnim() {
    const { m, pivot, layer } = anim;
    pivot.rotation[m.axis] = m.dir * Math.PI / 2;
    pivot.updateMatrixWorld(true);
    layer.forEach(c => { root.attach(c); snap(c); });
    root.remove(pivot);
    anim = null;
    if (m.kind === 'user' && phase === 'timing' && isSolved()) win();
  }
  function stepAnim(now) {
    if (!anim) return;
    const t = Math.min(1, (now - anim.t0) / anim.dur);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    anim.pivot.rotation[anim.m.axis] = anim.m.dir * Math.PI / 2 * e;
    if (t >= 1) finishAnim();
  }

  // ---------- Durum ----------
  // idle (serbest) | scrambling | ready (ilk hamle bekleniyor) | timing | solving | solved
  let phase = 'idle', history = [], userMoves = [], moveCount = 0, t0 = 0, elapsed = 0;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let SPEED = reduced ? 90 : 170;
  const busy = () => phase === 'scrambling' || phase === 'solving';

  function userTurn(m) {
    if (busy()) return;
    if (phase === 'solved') setPhase('idle');
    history.push(m); userMoves.push(m); moveCount++;
    if (phase === 'ready') { setPhase('timing'); t0 = performance.now(); }
    queue.push({ ...m, kind: 'user', dur: SPEED });
    addTrail(moveName(m));
    refresh();
  }
  function undo() {
    if (busy() || !userMoves.length) return;
    const m = userMoves.pop();
    history.pop(); moveCount++;
    queue.push({ ...inverse(m), kind: 'user', dur: SPEED });
    addTrail('↶');
    refresh();
  }
  function scramble(len, rng, outerOnly) {
    if (busy()) return;
    if (challenge && !len) return restartChallenge();
    rng = rng || Math.random;
    len = len || Math.round(10 + N * N * 1.5);
    const axes = ['x', 'y', 'z'];
    let last = null;
    for (let i = 0; i < len; i++) {
      let m;
      do {
        const axis = axes[(rng() * 3) | 0];
        let layer = outerOnly ? (rng() < 0.5 ? 1 : -1) * O : ((rng() * N) | 0) - O;
        if (N === 3 && Math.abs(layer) < 0.01) layer = (rng() < 0.5 ? 1 : -1) * O;
        m = { axis, layer, dir: rng() < 0.5 ? 1 : -1 };
      } while (last && last.axis === m.axis && Math.abs(last.layer - m.layer) < 0.01);
      last = m;
      history.push(m);
      queue.push({ ...m, kind: 'scramble', dur: reduced ? 0 : (outerOnly ? 220 : Math.max(25, 60 - N * 5)) });
    }
    userMoves = []; moveCount = 0; elapsed = 0;
    setTrail([]);
    setPhase('scrambling');
    refresh();
  }
  function solve() {
    if (challenge) return hint();
    if (busy() || !history.length) return;
    const seq = history.slice().reverse().map(inverse);
    const dur = reduced ? 0 : Math.max(30, Math.min(150, 3500 / seq.length));
    seq.forEach(m => queue.push({ ...m, kind: 'solve', dur }));
    history = []; userMoves = [];
    setPhase('solving');
    refresh();
  }
  // İpucu: son hamleyi geri çeviren doğru hamleyi yapar.
  function hint() {
    if (busy() || !history.length || phase === 'solved') return;
    const m = history.pop();
    if (userMoves.length) userMoves.pop();
    moveCount++; hints++;
    if (phase === 'ready') { setPhase('timing'); t0 = performance.now(); }
    queue.push({ ...inverse(m), kind: 'user', dur: SPEED });
    addTrail('?');
    refresh();
  }
  let challenge = null, hints = 0;
  function restartChallenge() {
    const c = challenge;
    reset(c.n);
    hints = 0;
    scramble(c.depth, seeded(c.seed), true);
  }
  function seeded(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  Sim.seeded = seeded;

  function reset(n = N) {
    queue.length = 0;
    if (anim) { root.remove(anim.pivot); anim = null; }
    build(n);
    history = []; userMoves = []; moveCount = 0; elapsed = 0;
    setTrail([]);
    setPhase('idle');
    refresh();
  }
  function onQueueEmpty() {
    if (phase === 'scrambling') { setPhase(isSolved() ? 'idle' : 'ready'); elapsed = 0; refresh(); }
    else if (phase === 'solving') { setPhase('idle'); refresh(); }
  }
  function win() {
    elapsed = performance.now() - t0;
    setPhase('solved');
    refresh();
    if (Sim.onSolved) Sim.onSolved({ n: N, ms: elapsed, moves: moveCount, hints, challenge: challenge && challenge.id });
  }

  const STATUS = {
    idle: 'Serbest mod', scrambling: 'Karıştırılıyor…', ready: 'Hazır: ilk hamlede süre başlar',
    timing: 'Süre işliyor', solving: 'Otomatik çözülüyor…', solved: 'Çözüldü!',
  };
  function setPhase(p) { phase = p; $('sim-status').dataset.phase = p; $('sim-status').textContent = STATUS[p]; }
  const fmt = (ms) => {
    const cs = Math.floor(ms / 10), m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60, c = cs % 100;
    return m + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
  };
  Sim.fmt = fmt;
  let trail = [];
  function addTrail(s) { trail.push(s); if (trail.length > 40) trail.shift(); setTrail(trail); }
  function setTrail(t) { trail = t; $('sim-trail').innerHTML = '<span dir="ltr">' + t.join(' ') + '</span>'; }
  function refresh() {
    $('sim-moves').textContent = moveCount;
    $('sim-timer').textContent = fmt(elapsed);
    const b = busy();
    document.querySelectorAll('#sim-pad button').forEach(x => (x.disabled = b));
    $('sim-undo').disabled = b || !userMoves.length;
    $('sim-solve').disabled = b || !history.length;
    $('sim-scramble').disabled = b;
    $('sim-solve').textContent = challenge ? 'İpucu' : 'Otomatik çöz';
    $('sim-scramble').textContent = challenge ? 'Baştan' : 'Karıştır';
    if (challenge) $('sim-solve').disabled = b || !history.length || phase === 'solved';
    if (Sim.onChange) Sim.onChange(phase);
  }

  $('sim-pad').addEventListener('click', e => { const b = e.target.closest('button'); if (b) userTurn(parseMove(b.dataset.move)); });
  $('sim-scramble').onclick = () => scramble();
  $('sim-undo').onclick = undo;
  $('sim-solve').onclick = solve;
  $('sim-reset').onclick = () => (challenge ? restartChallenge() : reset());
  window.addEventListener('keydown', e => {
    if (!Sim.active || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toUpperCase();
    if (BASE[k]) { userTurn(parseMove(e.shiftKey ? k + "'" : k)); e.preventDefault(); }
    else if (e.key === 'Backspace') { undo(); e.preventDefault(); }
  });

  // ---------- Kamera ve dokunma ----------
  let theta = 0.62, phi = 0.98, radius = 10;
  function fitCamera() {
    const half = 0.95 * N;
    radius = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect || 1) + N * 0.5;
    updateCamera();
  }
  function updateCamera() { camera.position.setFromSphericalCoords(radius, phi, theta); camera.lookAt(0, 0, 0); }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
  }
  new ResizeObserver(resize).observe(stage);

  const ray = new THREE.Raycaster();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    const hit = ray.intersectObjects(bodies, false)[0];
    if (!hit) return null;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const ax = Math.abs(n.x) > Math.abs(n.y) ? (Math.abs(n.x) > Math.abs(n.z) ? 'x' : 'z') : (Math.abs(n.y) > Math.abs(n.z) ? 'y' : 'z');
    const normal = new V(); normal[ax] = Math.sign(n[ax]);
    return { point: hit.point.clone(), normal, cubie: hit.object.userData.cubie };
  }
  function toScreen(v) {
    const p = v.clone().project(camera);
    return new THREE.Vector2((p.x + 1) / 2 * canvas.clientWidth, (1 - p.y) / 2 * canvas.clientHeight);
  }
  function turnFromDrag(hit, dx, dy) {
    const n = hit.normal, p = hit.point, sp = toScreen(p);
    const d = new THREE.Vector2(dx, dy).normalize();
    let best = null, bestDot = 0;
    for (const t of [new V(1, 0, 0), new V(0, 1, 0), new V(0, 0, 1)]) {
      if (Math.abs(t.dot(n)) > 0.5) continue;
      const s = toScreen(p.clone().add(t)).sub(sp).normalize();
      const dot = s.dot(d);
      if (Math.abs(dot) > Math.abs(bestDot)) { bestDot = dot; best = t; }
    }
    if (!best) return;
    const t = best.clone().multiplyScalar(Math.sign(bestDot));
    const a = new V().crossVectors(n, t); // a ekseni etrafında +90° dönüş, dokunulan noktayı t yönünde taşır
    const axis = Math.abs(a.x) > 0.5 ? 'x' : Math.abs(a.y) > 0.5 ? 'y' : 'z';
    userTurn({ axis, layer: r2(hit.cubie.position[axis]), dir: Math.sign(a[axis]) });
  }
  let ptr = null;
  canvas.addEventListener('pointerdown', e => {
    if (ptr) return;
    canvas.setPointerCapture(e.pointerId);
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, hit: busy() ? null : pick(e), done: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (ptr.hit) {
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      if (!ptr.done && Math.hypot(dx, dy) > 12) { ptr.done = true; turnFromDrag(ptr.hit, dx, dy); }
    } else {
      theta -= (e.clientX - ptr.lx) * 0.009;
      phi = Math.min(Math.PI - 0.15, Math.max(0.15, phi - (e.clientY - ptr.ly) * 0.009));
      updateCamera();
    }
    ptr.lx = e.clientX; ptr.ly = e.clientY;
  });
  const endPtr = e => { if (ptr && e.pointerId === ptr.id) ptr = null; };
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);

  function loop(now) {
    stepAnim(now);
    if (!anim) { if (queue.length) startNext(); else onQueueEmpty(); }
    if (phase === 'timing') { elapsed = now - t0; $('sim-timer').textContent = fmt(elapsed); }
    if (Sim.active) renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  // Marka logolu orta parça
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = logoCanvas.height = 256;
  const logoTex = new THREE.CanvasTexture(logoCanvas);
  logoTex.repeat.set(1 / 0.84, 1 / 0.84); logoTex.offset.set(0.5, 0.5);
  const logoMat = glossy({ map: logoTex });
  let logoOn = false;
  function paintLogo(pal, text) {
    const c = logoCanvas.getContext('2d');
    c.fillStyle = pal.U; c.fillRect(0, 0, 256, 256);
    const n = parseInt(pal.U.slice(1), 16), l = (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
    c.fillStyle = l > 0.55 ? 'rgba(29,20,70,0.78)' : 'rgba(255,255,255,0.9)';
    c.font = '800 84px "Baloo 2", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 132);
    logoTex.needsUpdate = true;
  }
  function paint(pal, logo) {
    FACES.forEach(f => stickerMats[f.key].color.set(pal[f.key]));
    bodyMat.color.set(pal.body);
    logoOn = !!logo;
    if (logo) paintLogo(pal, logo);
  }
  Sim.load = function (n, pal, logo, speed) {
    challenge = null;
    SPEED = reduced ? 90 : (speed || 170);
    paint(pal, logo);
    reset(n);
    resize();
  };
  // Meydan okuma: belli sayıda dış katman hamlesiyle (aynı tohumla hep aynı) karıştırılmış küp.
  Sim.challenge = function (cfg) {
    challenge = cfg;
    SPEED = reduced ? 90 : 170;
    paint(cfg.pal);
    resize();
    restartChallenge();
  };
  Sim.inChallenge = () => !!challenge;
  Sim.resize = resize;
  Sim.isBusy = () => busy() || phase === 'timing';
  Sim.load(3, window.GameData.PALETTES.classic);
  requestAnimationFrame(loop);
})();
