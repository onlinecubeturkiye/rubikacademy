// Sandıklar: galibiyetlerden düşer, 4 yuvaya girer. Aynı anda bir sandığın kilidi açılır.
// Taç Sandığı: rakip küplerini yendikçe taç toplanır, günde 10 taçta bedava açılır.
(function () {
  const { $, h, esc, cubeById, D } = G;
  const R = window.Render, Snd = window.Sound;
  const SLOTS = 4;

  // ---------- Küp kutusu çizimi (izometrik 3B ambalaj) ----------
  const imgCache = {};
  function cubeImg(id) {
    if (imgCache[id]) return imgCache[id];
    const c = document.createElement('canvas');
    c.width = c.height = 160; c.style.width = c.style.height = '160px';
    document.body.appendChild(c);
    R.drawPuzzle(c, cubeById(id));
    const url = c.toDataURL();
    c.remove();
    return (imgCache[id] = url);
  }
  const bil = (p, u, v) => { const a = [p[0][0] + (p[1][0] - p[0][0]) * u, p[0][1] + (p[1][1] - p[0][1]) * u], b = [p[3][0] + (p[2][0] - p[3][0]) * u, p[3][1] + (p[2][1] - p[3][1]) * u]; return [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v]; };
  const pts = (arr) => arr.map(p => p.map(n => +n.toFixed(1)).join(',')).join(' ');
  let uid = 0;
  G.chestSVG = function (type, cls = '') {
    const c = D.CHESTS[type], id = 'bx' + (uid++);
    const LF = [[16, 44], [60, 66], [60, 108], [16, 86]];          // sol (ön) yüz
    const RF = [[60, 66], [104, 44], [104, 86], [60, 108]];        // sağ yüz
    const LID = [[60, 12], [107, 36], [60, 60], [13, 36]];         // kapak üstü
    const RIML = [[13, 36], [60, 60], [60, 70], [13, 46]], RIMR = [[60, 60], [107, 36], [107, 46], [60, 70]];
    const win = [bil(LF, 0.16, 0.2), bil(LF, 0.84, 0.2), bil(LF, 0.84, 0.86), bil(LF, 0.16, 0.86)];
    const img = cubeImg(c.show);
    const op = c.clear ? ' fill-opacity="0.38"' : '';
    let inner = '';
    if (c.clear) {
      // şeffaf akrilik vitrin: küp kutunun içinde, altında kaide
      inner = `<ellipse cx="60" cy="96" rx="26" ry="9" fill="#0b1033" opacity=".35"/><rect x="40" y="86" width="40" height="10" rx="3" fill="#ffc928" stroke="#0b1033" stroke-width="2.5"/>
        <image href="${img}" x="28" y="40" width="64" height="64" class="b-glow"/>`;
    }
    let deco = '';
    if (c.window) {
      deco += `<clipPath id="${id}w"><polygon points="${pts(win)}"/></clipPath>
        <polygon points="${pts(win)}" fill="#0b1033"/>
        <image href="${img}" x="${win[0][0] - 6}" y="${win[0][1] - 4}" width="44" height="44" clip-path="url(#${id}w)"/>
        <polygon points="${pts([bil(LF, 0.16, 0.2), bil(LF, 0.5, 0.2), bil(LF, 0.16, 0.6)])}" fill="#fff" opacity=".25"/>
        <polygon points="${pts(win)}" fill="none" stroke="#0b1033" stroke-width="2.5"/>`;
    } else if (!c.clear) {
      // karton: üzerinde etiket
      deco += `<polygon points="${pts([bil(LF, 0.2, 0.3), bil(LF, 0.8, 0.3), bil(LF, 0.8, 0.62), bil(LF, 0.2, 0.62)])}" fill="#fff8e8" stroke="#0b1033" stroke-width="2"/>
        <polygon points="${pts([bil(LF, 0.28, 0.42), bil(LF, 0.72, 0.42), bil(LF, 0.72, 0.46), bil(LF, 0.28, 0.46)])}" fill="#c99a5b"/>
        <polygon points="${pts([bil(LF, 0.28, 0.5), bil(LF, 0.6, 0.5), bil(LF, 0.6, 0.54), bil(LF, 0.28, 0.54)])}" fill="#c99a5b"/>`;
    }
    // sağ yüzde marka yazısı (yüzeyin eğimine uygun)
    deco += `<text x="0" y="0" transform="matrix(1,-0.5,0,1,65,${type === 'tac' ? 81 : 80})" font-family="Baloo 2, Arial Black, sans-serif" font-weight="800" font-size="8.5" textLength="34" lengthAdjust="spacingAndGlyphs" fill="${c.label}" opacity="${c.clear ? 0.8 : 0.95}">${type === 'tac' ? '♛ ŞAMPİYON' : 'KÜP ARENA'}</text>`;
    // kapak süsü
    let lidDeco = `<polygon points="${pts([[60, 18], [100, 37], [60, 56], [20, 37]])}" fill="#fff" opacity=".08"/>`;
    if (type === 'tahta') lidDeco += `<polygon points="32,26 41,21.5 88,46 79,50.5" fill="#e6c58f" stroke="#7a5426" stroke-width="1" opacity=".95"/><polygon points="79,50.5 88,46 88,56 79,60.5" fill="#e6c58f" opacity=".85"/>`;
    if (type === 'altin') lidDeco += `<polygon points="${pts(LID)}" fill="none" stroke="#ffc928" stroke-width="1.5" opacity=".9"/><text transform="matrix(1,0.5,-1,0.5,48,30)" font-family="Baloo 2, sans-serif" font-weight="800" font-size="12" fill="#ffc928">PRO</text>`;
    if (type === 'dev') lidDeco += `<path d="M60 26l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#ffc928" stroke="#0b1033" stroke-width="1.5"/>`;
    if (type === 'gumus') lidDeco += `<polygon points="${pts([[60, 22], [92, 37], [60, 52], [28, 37]])}" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>`;
    return `<svg class="chest-svg box-${type} ${cls}" viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="110" rx="46" ry="8" fill="#0b1033" opacity=".25"/>
      ${c.clear ? inner : ''}
      <g class="c-body">
        <polygon points="${pts(LF)}" fill="${c.color}"${op} stroke="#0b1033" stroke-width="3.5" stroke-linejoin="round"/>
        <polygon points="${pts(RF)}" fill="${c.side}"${op} stroke="#0b1033" stroke-width="3.5" stroke-linejoin="round"/>
        ${deco}
      </g>
      <g class="c-lid">
        <polygon points="${pts(RIML)}" fill="${c.lid}"${op} stroke="#0b1033" stroke-width="3" stroke-linejoin="round" style="filter:brightness(.8)"/>
        <polygon points="${pts(RIMR)}" fill="${c.lid}"${op} stroke="#0b1033" stroke-width="3" stroke-linejoin="round" style="filter:brightness(.62)"/>
        <polygon points="${pts(LID)}" fill="${c.lid}"${op} stroke="#0b1033" stroke-width="3.5" stroke-linejoin="round"/>
        ${lidDeco}
      </g>
    </svg>`;
  };

  // ---------- Durum ----------
  const now = () => Date.now();
  function slots() {
    const S = G.S;
    if (!Array.isArray(S.chests) || S.chests.length !== SLOTS) S.chests = Array.from({ length: SLOTS }, (_, i) => (S.chests && S.chests[i]) || null);
    return S.chests;
  }
  const stateOf = (c) => (!c ? 'empty' : !c.end ? 'locked' : now() >= c.end ? 'ready' : 'unlocking');
  const anyUnlocking = () => slots().some(c => stateOf(c) === 'unlocking');
  const fmt = (ms) => {
    const m = Math.ceil(ms / 60000);
    if (m >= 60) return `${Math.floor(m / 60)} sa ${m % 60 ? (m % 60) + ' dk' : ''}`.trim();
    if (ms < 60000) return `${Math.ceil(ms / 1000)} sn`;
    return `${m} dk`;
  };
  // Atölye: Kutu Deposu her seviyede %10 hızlandırır
  const boxMs = (def) => Math.round(def.mins * 60000 * (1 - (G.baseBonus ? G.baseBonus('depot') : 0)));
  const rushCost = (ms) => Math.max(10, Math.ceil((ms / 60000) * 1.5));

  // Galibiyette sandık ver (yuva boşsa). Döndürür: sandık türü ya da null.
  G.dropChest = function () {
    const S = G.S, list = slots();
    const i = list.findIndex(c => !c);
    if (i < 0) return null;
    S.chestIdx = S.chestIdx || 0;
    const type = D.CHEST_CYCLE[S.chestIdx % D.CHEST_CYCLE.length];
    S.chestIdx++;
    list[i] = { type, end: null };
    return type;
  };
  G.chestsReady = () => slots().some(c => stateOf(c) === 'ready') || G.crownReady();

  // ---------- Taçlar ----------
  G.crownState = function () {
    const S = G.S, d = G.dayIndex();
    if (!S.crowns || S.crowns.day !== d) S.crowns = { day: d, n: 0, got: false };
    return S.crowns;
  };
  G.addCrowns = function (n) { const c = G.crownState(); c.n = Math.min(10, c.n + n); return c.n; };
  G.crownReady = () => { const c = G.crownState(); return c.n >= 10 && !c.got; };
  G.openCrownChest = function () {
    const c = G.crownState();
    if (c.got) return G.toast('Bugünkü Şampiyon Kutusu’nu açtın. Yarın yine 10 taç topla!');
    if (c.n < 10) return G.toast(`Şampiyon Kutusu için ${10 - c.n} taç daha. Rakip küplerini yenerek taç kazan!`);
    c.got = true; G.save();
    openChest('tac');
  };

  // ---------- Yuvalar (ana ekran) ----------
  function renderSlots() {
    const row = $('chest-row');
    if (!row) return;
    row.innerHTML = '';
    slots().forEach((c, i) => {
      const st = stateOf(c);
      const b = h('button', `slot-chest ${st}`);
      if (st === 'empty') b.innerHTML = '<span class="sc-empty">Boş raf</span>';
      else {
        const def = D.CHESTS[c.type];
        const info = st === 'ready' ? '<b class="sc-open">AÇ!</b>'
          : st === 'unlocking' ? `<b class="sc-time" data-end="${c.end}">${fmt(c.end - now())}</b>`
          : `<small>${fmt(boxMs(def))}</small><b class="sc-unlock">Aç</b>`;
        b.innerHTML = `${G.chestSVG(c.type)}<span class="box-name">${esc(def.short)}</span>${info}`;
      }
      b.onclick = () => tapSlot(i);
      row.appendChild(b);
    });
  }
  G.renderChestSlots = renderSlots;
  // Raflar yalnız durum değişince yeniden çizilir; geri sayım yerinde güncellenir
  const sig = () => slots().map(c => (c ? c.type + stateOf(c) : '-')).join('|');
  let lastSig = '';
  const origRender = renderSlots;
  G.renderChestSlots = function () { lastSig = sig(); origRender(); };
  setInterval(() => {
    if (G.current !== 'home') return;
    if (sig() !== lastSig) { G.renderChestSlots(); G.renderHeader(); } else G.tickTimers($('chest-row'));
  }, 1000);

  function tapSlot(i) {
    const list = slots(), c = list[i], st = stateOf(c);
    Snd.click();
    if (st === 'empty') return G.toast('Savaş kazan, küp kutusu kazan! Boş raflar dolsun.');
    const def = D.CHESTS[c.type];
    if (st === 'ready') { list[i] = null; G.save(); renderSlots(); return openChest(c.type); }
    const left = st === 'unlocking' ? c.end - now() : boxMs(def);
    const cost = rushCost(left);
    const body = G.modal(def.name, `
      <div class="chest-big">${G.chestSVG(c.type)}</div>
      <p>İçinde: <b>${def.cubes} küp</b> ve <b>${def.coins} jeton</b>${def.min ? ` · en az 1 <b>${D.RARITIES[def.min].name}</b>` : ''}</p>
      <p>${st === 'unlocking' ? `Açılıyor: <b>${fmt(left)}</b> kaldı` : `Açılması <b>${fmt(left)}</b> sürer.`}</p>
      ${st === 'locked' && anyUnlocking() ? '<p class="note">Aynı anda tek kutu açılabilir. Diğeri bitince bunu başlat.</p>' : ''}`,
      [
        ...(st === 'locked' ? [{ label: 'Açmaya başla', cls: 'btn-green', disabled: anyUnlocking(), onClick: () => { c.end = now() + boxMs(def); G.save(); renderSlots(); } }] : []),
        { label: `Hemen aç (${cost})`, cls: 'btn-yellow', disabled: G.S.coins < cost, onClick: () => {
          if (G.S.coins < cost) return;
          G.S.coins -= cost; G.coinFloat(-cost); list[i] = null; G.save(); renderSlots(); openChest(c.type);
        } },
      ], { replace: true });
    if (body) body.querySelector('.chest-svg').classList.add('wobble');
  }

  // ---------- Sandık açma ----------
  let opening = null;
  function rollContents(type) {
    const def = D.CHESTS[type];
    const total = def.odds.reduce((a, b) => a + b, 0);
    const picks = [];
    for (let i = 0; i < def.cubes; i++) {
      let x = Math.random() * total, ri = 0;
      for (; ri < 5; ri++) { x -= def.odds[ri]; if (x < 0) break; }
      picks.push(G.pickOne(D.CUBES.filter(c => c.rarity === D.RARITY_ORDER[Math.min(ri, 4)])));
    }
    if (def.min) {
      const minOrder = D.RARITIES[def.min].order;
      if (!picks.some(p => D.RARITIES[p.rarity].order >= minOrder)) picks[picks.length - 1] = G.pickOne(D.CUBES.filter(c => c.rarity === def.min));
    }
    // En nadir olan en sona: heyecan sona kalsın
    return picks.sort((a, b) => D.RARITIES[a.rarity].order - D.RARITIES[b.rarity].order);
  }
  function openChest(type) {
    G.holdRewards = true;
    const def = D.CHESTS[type];
    const cubes = rollContents(type);
    const results = cubes.map(c => ({ def: c, got: G.addCube(c.id) }));
    G.addCoins(def.coins);
    G.bump('packs');
    G.addXP(10 + def.cubes * 2);
    G.save();
    opening = { type, results, i: -1, coins: def.coins, stage: 'closed' };
    const ov = $('chest-open');
    $('co-chest').innerHTML = G.chestSVG(type, 'idle');
    $('co-chest').hidden = false;
    $('co-card').hidden = true; $('co-summary').hidden = true;
    $('co-hint').textContent = 'Açmak için dokun';
    $('co-left').textContent = `${def.name} · ${results.length} küp`;
    ov.hidden = false;
  }
  G.openChestType = openChest;

  async function step() {
    if (!opening) return;
    const o = opening;
    if (o.stage === 'closed') {
      o.stage = 'busy';
      const svg = $('co-chest').querySelector('.chest-svg');
      svg.classList.remove('idle'); svg.classList.add('shake'); Snd.shake();
      await G.wait(480);
      svg.classList.remove('shake'); svg.classList.add('open'); Snd.tear();
      window.FX.burstAt(svg, D.CHESTS[o.type].color, 30, 8);
      await G.wait(380);
      o.stage = 'cards';
      // önce jetonlar
      showCard({ coins: o.coins });
      return;
    }
    if (o.stage === 'cards') {
      o.i++;
      if (o.i >= o.results.length) return summary();
      showCard(o.results[o.i]);
    }
  }
  function showCard(item) {
    const o = opening;
    $('co-chest').hidden = true;
    const card = $('co-card');
    card.hidden = false;
    card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip');
    if (item.coins) {
      card.style.setProperty('--rc', '#ffc928');
      card.classList.remove('holo');
      card.innerHTML = `<div class="co-coins"><i class="coin"></i><i class="coin"></i><i class="coin"></i></div><b class="co-name">+${item.coins} jeton</b>`;
      window.FX.coins(8, card);
    } else {
      const r = D.RARITIES[item.def.rarity];
      card.style.setProperty('--rc', r.color);
      card.innerHTML = `<span class="rarity-tag" style="--glow:${r.color}">${r.name}</span><canvas></canvas>${G.brandChip(item.def)}<b class="co-name">${esc(item.def.model)}</b>
        <span class="co-sub">${item.got.holo ? '<b class="holo-txt">✨ PARLAK!</b> ' : ''}${item.got.isNew ? '<b class="good">YENİ!</b>' : `Seviye ${item.got.lvl}`}</span>`;
      card.classList.toggle('holo', !!item.got.holo);
      R.drawPuzzle(card.querySelector('canvas'), item.def);
      Snd.reveal(r.order);
      if (r.order >= 2) window.FX.burstAt(card, r.color, 16 + r.order * 10, 6);
      if (r.order >= 3) window.FX.confetti(60);
    }
    const left = o.results.length - Math.max(0, o.i + 1);
    $('co-left').textContent = left > 0 ? `${left} küp kaldı` : 'Son küp!';
    $('co-hint').textContent = 'Devam etmek için dokun';
  }
  function summary() {
    const o = opening;
    o.stage = 'done';
    $('co-card').hidden = true;
    $('co-hint').textContent = '';
    $('co-left').textContent = '';
    const s = $('co-summary');
    s.hidden = false;
    s.innerHTML = `<h3>${esc(D.CHESTS[o.type].name)}</h3><div class="co-grid"></div><p>+${o.coins} jeton</p>`;
    const grid = s.querySelector('.co-grid');
    o.results.forEach(r => {
      const it = h('div', 'co-mini', `<canvas></canvas>${r.got.isNew ? '<em>YENİ</em>' : ''}`);
      it.style.setProperty('--rc', D.RARITIES[r.def.rarity].color);
      grid.appendChild(it);
      requestAnimationFrame(() => R.drawPuzzle(it.querySelector('canvas'), r.def));
    });
    const b = h('button', 'btn btn-yellow btn-big', 'Harika!');
    b.onclick = (e) => { e.stopPropagation(); close(); };
    s.appendChild(b);
  }
  function close() {
    G.holdRewards = false; G.save();
    $('chest-open').hidden = true; opening = null;
    if (G.current === 'home') G.renderHome();
    if (G.current === 'inv') G.renderInv();
  }
  G.isChestOpen = () => !!opening;
  G.closeChest = () => { if (opening && opening.stage === 'done') close(); };
  $('chest-open').addEventListener('click', () => { if (opening && opening.stage !== 'done' && opening.stage !== 'busy') step(); });
})();
