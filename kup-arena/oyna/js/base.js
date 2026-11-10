// Atölye (köy): binalar jeton üretir, oyuncuyu güçlendirir. Aynı anda tek bina yükseltilir (Usta Robot).
(function () {
  const { $, h, esc } = G;
  const Snd = window.Sound;
  const MAX = 5;
  const B = {
    mine:  { name: 'Jeton Madeni',      unlock: 1, desc: 'Sen yokken bile jeton biriktirir.', roof: '#ffc928', wall: '#c99a5b', icon: 'coin',
             rate: [0, 20, 35, 55, 80, 110], cap: 8, cost: [0, 0, 300, 700, 1500, 3000], mins: [0, 0, 5, 30, 120, 360] },
    gym:   { name: 'Antrenman Salonu',  unlock: 2, desc: 'Her seviye +%10 XP.', roof: '#3bdc6e', wall: '#e8ecff', icon: 'dumbbell',
             cost: [250, 600, 1200, 2500, 4500], mins: [5, 30, 120, 300, 600] },
    depot: { name: 'Kutu Deposu',       unlock: 3, desc: 'Her seviye küp kutuları %10 daha hızlı açılır.', roof: '#ff8a1f', wall: '#b07f43', icon: 'box',
             cost: [300, 700, 1500, 3000, 5000], mins: [5, 30, 120, 300, 600] },
    lab:   { name: 'Laboratuvar',       unlock: 4, desc: 'Her seviye tüm küplerine +%3 can ve saldırı.', roof: '#8a5cff', wall: '#dfe6ff', icon: 'flask',
             cost: [400, 900, 1800, 3500, 6000], mins: [10, 45, 180, 480, 720] },
    table: { name: 'Küp Masası',        unlock: 1, desc: '3B küp çöz, jeton kazan. Her gün yeni bir bulmaca.', roof: '#2e8cff', wall: '#ffffff', icon: 'cube' },
  };
  const ORDER = ['mine', 'table', 'gym', 'depot', 'lab'];

  function st() {
    const S = G.S;
    if (!S.base) S.base = { mine: { lv: 1, t: Date.now() }, gym: { lv: 0 }, depot: { lv: 0 }, lab: { lv: 0 }, build: null };
    return S.base;
  }
  const lv = (k) => (st()[k] && st()[k].lv) || 0;
  G.baseLevel = lv;
  G.baseBonus = (k) => ({ lab: 0.03, gym: 0.1, depot: 0.1 }[k] || 0) * lv(k);

  // ---------- Maden ----------
  function mined() {
    const m = st().mine, d = B.mine;
    const hours = (Date.now() - m.t) / 3600000;
    return Math.min(d.rate[m.lv] * d.cap, Math.floor(d.rate[m.lv] * hours));
  }
  G.mineReady = () => mined() >= B.mine.rate[lv('mine')] * B.mine.cap * 0.5;
  function collect(btn) {
    const n = mined(); if (n < 1) return G.toast('Henüz jeton birikmedi');
    st().mine.t = Date.now();
    G.addCoins(n); G.coinFloat(n); window.FX.coins(Math.min(12, 3 + Math.floor(n / 30)), btn);
    G.save(); G.renderBase();
  }

  // ---------- Yükseltme ----------
  const fmt = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60 ? (m % 60) + ' dk' : ''}`.trim() : ms < 60000 ? `${Math.ceil(ms / 1000)} sn` : `${m} dk`; };
  const nextCost = (k) => { const d = B[k], l = lv(k); return d.cost && l < MAX ? { coins: d.cost[k === 'mine' ? l + 1 : l], mins: d.mins[k === 'mine' ? l + 1 : l] } : null; };
  const rushCost = (ms) => Math.max(10, Math.ceil(ms / 60000 * 1.5));
  function checkBuild() {
    const s = st(), b = s.build;
    if (!b || Date.now() < b.end) return;
    s[b.k] = s[b.k] || { lv: 0 };
    if (b.k === 'mine') { const n = mined(); s.mine.lv++; s.mine.t = Date.now() - n / B.mine.rate[s.mine.lv] * 3600000; }
    else s[b.k].lv++;
    s.build = null;
    G.save();
    window.FX.confetti(70); Snd.win();
    G.toast(`${B[b.k].name} seviye ${lv(b.k)} oldu!`);
  }
  function upgrade(k) {
    const s = st(), c = nextCost(k);
    if (!c) return;
    if (s.build) return G.toast('Usta Robot meşgul. Önceki yükseltme bitsin.');
    if (G.S.coins < c.coins) return G.toast(`Yeterli jeton yok (${c.coins} gerekli)`);
    G.S.coins -= c.coins; G.coinFloat(-c.coins);
    if (k !== 'mine' && !s[k]) s[k] = { lv: 0 };
    s.build = { k, end: Date.now() + c.mins * 60000 };
    G.save(); Snd.click(); G.renderBase();
  }
  function rush() {
    const b = st().build; if (!b) return;
    const cost = rushCost(b.end - Date.now());
    if (G.S.coins < cost) return G.toast(`Yeterli jeton yok (${cost} gerekli)`);
    G.S.coins -= cost; G.coinFloat(-cost); b.end = Date.now(); checkBuild(); G.renderBase();
  }

  // ---------- Bina çizimi (izometrik) ----------
  const ICON = {
    coin: '<circle cx="0" cy="0" r="9" fill="#ffc928" stroke="#0b1033" stroke-width="2.5"/><text x="0" y="4" text-anchor="middle" font-size="11" font-weight="900" fill="#a86400">₺</text>',
    dumbbell: '<rect x="-10" y="-2" width="20" height="4" fill="#0b1033"/><rect x="-13" y="-7" width="5" height="14" rx="1.5" fill="#ff4d5e" stroke="#0b1033" stroke-width="2"/><rect x="8" y="-7" width="5" height="14" rx="1.5" fill="#ff4d5e" stroke="#0b1033" stroke-width="2"/>',
    box: '<path d="M-9-4 0-9 9-4 9 6 0 11-9 6z" fill="#c99a5b" stroke="#0b1033" stroke-width="2" stroke-linejoin="round"/><path d="M-9-4 0 1 9-4M0 1v10" fill="none" stroke="#0b1033" stroke-width="2"/>',
    flask: '<path d="M-3-10h6v6l7 12c1 2 0 3-2 3h-16c-2 0-3-1-2-3l7-12z" fill="#7dffa6" stroke="#0b1033" stroke-width="2" stroke-linejoin="round"/><path d="M-6 4h12" stroke="#0b1033" stroke-width="2"/>',
    cube: '<path d="M0-10 10-4v10L0 12-10 6V-4z" fill="#ffc928" stroke="#0b1033" stroke-width="2" stroke-linejoin="round"/><path d="M-10-4 0 2 10-4M0 2v10" fill="none" stroke="#0b1033" stroke-width="2"/><path d="M0 2 10-4v10L0 12z" fill="#ff8a1f" stroke="#0b1033" stroke-width="2" stroke-linejoin="round"/>',
  };
  function buildingSVG(k, level, locked) {
    const d = B[k], H = 30 + Math.min(level, 5) * 5;            // seviye arttıkça bina yükselir
    const L = [16, 72], F = [50, 89], R = [84, 72];               // zemindeki köşeler
    const up = (p, dy = H) => [p[0], p[1] - dy];
    const P = (...a) => a.map(p => p.join(',')).join(' ');
    const apex = [50, 72 - H - 26];
    const Lr = [8, 72 - H + 2], Fr = [50, 93 - H], Rr = [92, 72 - H + 2];
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d0 = lerp(L, F, 0.38), d1 = lerp(L, F, 0.66);
    const w0 = lerp(F, R, 0.3), w1 = lerp(F, R, 0.7);
    return `<svg class="bld${locked ? ' locked' : ''}" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="86" rx="44" ry="12" fill="#1f9b46" stroke="#0b1033" stroke-width="2.5"/>
      <polygon points="${P(up(L), up(F), F, L)}" fill="${d.wall}" stroke="#0b1033" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="${P(up(F), up(R), R, F)}" fill="${d.wall}" stroke="#0b1033" stroke-width="3" stroke-linejoin="round" style="filter:brightness(.75)"/>
      <polygon points="${P(d0, d1, up(d1, 18), up(d0, 18))}" fill="#8a5a22" stroke="#0b1033" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="${P(up(w0, H * 0.45), up(w1, H * 0.45), up(w1, H * 0.8), up(w0, H * 0.8))}" fill="#bfe9ff" stroke="#0b1033" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="${P(Lr, Fr, apex)}" fill="${d.roof}" stroke="#0b1033" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="${P(Fr, Rr, apex)}" fill="${d.roof}" stroke="#0b1033" stroke-width="3" stroke-linejoin="round" style="filter:brightness(.72)"/>
      <path d="M${P(lerp(Lr, apex, 0.15), lerp(Fr, apex, 0.15))}" stroke="#fff" stroke-width="2" opacity=".35"/>
      <g transform="translate(${apex[0]} ${apex[1] + 30})">${ICON[d.icon]}</g>
    </svg>`;
  }

  // ---------- Köy manzarası: toplam bina seviyesi arttıkça büyür ----------
  const STAGES = [
    { min: 0, name: 'Boş Arsa' }, { min: 4, name: 'Küçük Atölye' }, { min: 8, name: 'Atölye Köyü' },
    { min: 12, name: 'Küp Kasabası' }, { min: 16, name: 'Küp Şehri' },
  ];
  const total = () => ['mine', 'gym', 'depot', 'lab'].reduce((a, k) => a + lv(k), 0);
  function house(x, k, l) {
    const d = B[k], base = 118;
    if (!l) return `<g transform="translate(${x} ${base})"><rect x="-2" y="-22" width="4" height="22" fill="#8a5a22"/><rect x="-14" y="-30" width="28" height="12" rx="2" fill="#ffd23f" stroke="#0b1033" stroke-width="2"/><path d="M-10 -24h20" stroke="#0b1033" stroke-width="2" stroke-dasharray="4 3"/></g>`;
    const hgt = 18 + l * 7, w = 26 + l * 2;
    let floors = '';
    for (let i = 0; i < l; i++) floors += `<rect x="${-w / 2 + 5}" y="${-hgt + 14 + i * 7}" width="5" height="4" fill="${i % 2 ? '#ffe88a' : '#9fd3ff'}"/><rect x="${w / 2 - 10}" y="${-hgt + 14 + i * 7}" width="5" height="4" fill="#9fd3ff"/>`;
    return `<g transform="translate(${x} ${base})">
      <rect x="${-w / 2}" y="${-hgt}" width="${w}" height="${hgt}" fill="${d.wall}" stroke="#0b1033" stroke-width="2"/>
      <path d="M${-w / 2 - 4} ${-hgt} L0 ${-hgt - 14 - l * 2} L${w / 2 + 4} ${-hgt}Z" fill="${d.roof}" stroke="#0b1033" stroke-width="2" stroke-linejoin="round"/>
      ${floors}<rect x="-4" y="-10" width="8" height="10" fill="#6b4220" stroke="#0b1033" stroke-width="1.5"/>
      ${l >= 5 ? `<path d="M0 ${-hgt - 16 - l * 2}v-12" stroke="#0b1033" stroke-width="1.5"/><path d="M0 ${-hgt - 28 - l * 2}l10 3-10 3z" fill="${d.roof}" stroke="#0b1033" stroke-width="1"/>` : ''}
    </g>`;
  }
  const tree = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="-8" width="4" height="10" fill="#7a4a1e"/><circle cy="-16" r="11" fill="#2fb35a" stroke="#0b1033" stroke-width="2"/><circle cx="-4" cy="-19" r="4" fill="#5fd884"/></g>`;
  const lamp = (x) => `<g transform="translate(${x} 122)"><rect x="-1.5" y="-26" width="3" height="26" fill="#2a2f5a"/><circle cy="-28" r="4.5" fill="#ffe88a" stroke="#0b1033" stroke-width="1.5"/><circle cy="-28" r="12" fill="#ffe88a" opacity=".25"/></g>`;
  function townSVG() {
    const T = total(), sg = STAGES.filter(x => T >= x.min).length - 1;
    const night = sg >= 4;
    const sky = night ? ['#2a2f8a', '#7a5cff'] : sg >= 3 ? ['#3d8bff', '#ffc38a'] : ['#4fb4ff', '#bfe9ff'];
    let o = `<svg viewBox="0 0 360 150" class="town-svg" aria-hidden="true"><defs><linearGradient id="tsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
      <rect width="360" height="150" fill="url(#tsky)"/>`;
    if (night) o += [[30, 20], [80, 12], [140, 26], [220, 14], [300, 22], [340, 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join('') + '<circle cx="320" cy="30" r="12" fill="#fff6c8"/>';
    else o += '<circle cx="315" cy="30" r="14" fill="#fff3a0"/><ellipse cx="70" cy="30" rx="26" ry="8" fill="#fff" opacity=".8"/><ellipse cx="190" cy="22" rx="20" ry="6" fill="#fff" opacity=".7"/>';
    o += `<path d="M0 110 Q60 80 120 104 T240 98 T360 104 V150 H0Z" fill="${night ? '#2b6e4a' : '#5fcf7a'}"/>`;
    o += `<rect y="118" width="360" height="32" fill="${sg === 0 ? '#c9965a' : night ? '#2f8a4f' : '#3fbf5f'}"/>`;
    if (sg >= 2) o += '<path d="M0 132 H360 V142 H0Z" fill="#d9c9a8"/><path d="M0 132 H360" stroke="#b5a37f" stroke-width="1.5" stroke-dasharray="10 6"/>';
    else if (sg === 0) o += '<ellipse cx="60" cy="128" rx="10" ry="4" fill="#a0713f"/><ellipse cx="290" cy="132" rx="14" ry="5" fill="#a0713f"/><path d="M200 118l14-20 14 20z" fill="#e8ecff" stroke="#0b1033" stroke-width="2"/>';
    if (sg >= 1) o += `<path d="M6 118v-10M18 118v-10M30 118v-10M330 118v-10M342 118v-10M354 118v-10M2 111H34M326 111H358" stroke="#8a5a22" stroke-width="3"/>` + tree(48, 118, 0.9) + tree(312, 118, 1);
    if (sg >= 2) o += lamp(110) + lamp(250) + '<g fill="#ff6ad5"><circle cx="70" cy="128" r="2.5"/><circle cx="76" cy="130" r="2.5" fill="#ffd23f"/><circle cx="290" cy="128" r="2.5"/></g>';
    if (sg >= 3) o += tree(20, 116, 0.7) + tree(345, 116, 0.75) + `<g transform="translate(180 128)"><ellipse rx="26" ry="7" fill="#7fc8ff" stroke="#0b1033" stroke-width="2"/><rect x="-6" y="-22" width="12" height="18" fill="#cfd6ff" stroke="#0b1033" stroke-width="2"/><g transform="translate(0 -30)"><path d="M0-8 8-4 0 0-8-4z" fill="#ffd23f" stroke="#0b1033" stroke-width="1.2"/><path d="M-8-4 0 0v9l-8-4z" fill="#ff4757" stroke="#0b1033" stroke-width="1.2"/><path d="M8-4 0 0v9l8-4z" fill="#3d8bff" stroke="#0b1033" stroke-width="1.2"/></g></g>`;
    // binalar
    const xs = { mine: 80, gym: 140, depot: 222, lab: 282 };
    o += Object.entries(xs).map(([k, x]) => (sg === 0 && !lv(k) ? '' : house(x, k, lv(k)))).join('');
    if (sg >= 4) o += `<g transform="translate(180 64)"><rect x="-8" y="0" width="16" height="40" fill="#5a4fd6" stroke="#0b1033" stroke-width="2"/><g class="town-cube"><path d="M0-22 14-15 0-8-14-15z" fill="#fff"/><path d="M-14-15 0-8v15l-14-7z" fill="#2ed47a"/><path d="M14-15 0-8v15l14-7z" fill="#ff4757"/></g></g>` +
      '<g fill="#ffd23f"><circle cx="40" cy="40" r="2"/><circle cx="46" cy="34" r="1.5"/><circle cx="34" cy="34" r="1.5"/><circle cx="270" cy="46" r="2" fill="#ff6ad5"/><circle cx="276" cy="40" r="1.5" fill="#ff6ad5"/></g>';
    o += '</svg>';
    const next = STAGES[sg + 1];
    return `${o}<div class="town-cap"><b>${STAGES[sg].name}</b><small>${next ? `Sonraki görünüm: ${next.name} · ${T}/${next.min} bina yıldızı` : 'En büyük köy! Tebrikler'}</small></div>`;
  }

  // ---------- Görünüm ----------
  function render() {
    checkBuild();
    const S = G.S, s = st();
    const b = s.build;
    $('builder').innerHTML = `<svg viewBox="0 0 48 48" class="robot" aria-hidden="true"><rect x="10" y="14" width="28" height="22" rx="6" fill="#b9c5ff" stroke="#0b1033" stroke-width="3"/><circle cx="19" cy="25" r="4" fill="#0b1033"/><circle cx="29" cy="25" r="4" fill="#0b1033"/><path d="M24 14V7" stroke="#0b1033" stroke-width="3"/><circle cx="24" cy="6" r="3" fill="#ff4d5e" stroke="#0b1033" stroke-width="2"/><rect x="14" y="36" width="20" height="6" rx="2" fill="#7b4dff" stroke="#0b1033" stroke-width="2.5"/></svg>
      <div><b>Usta Robot</b><small>${b ? `${esc(B[b.k].name)} yükseltiliyor · <span data-end="${b.end}">${fmt(b.end - Date.now())}</span>` : 'Boşta. Bir bina yükselt!'}</small></div>
      ${b ? `<button class="btn btn-small btn-yellow" id="rush-btn" data-rush="${b.end}">Hemen bitir (${rushCost(b.end - Date.now())})</button>` : ''}`;
    if (b) $('rush-btn').onclick = rush;
    $('town').innerHTML = townSVG();
    const v = $('village'); v.innerHTML = '';
    ORDER.forEach(k => {
      const d = B[k], l = k === 'table' ? 1 : lv(k), locked = S.level < d.unlock;
      const card = h('div', 'bld-card' + (locked ? ' locked' : '') + (b && b.k === k ? ' building' : ''));
      let status = '', actions = '';
      if (locked) status = `<small>Seviye ${d.unlock}’de açılır</small>`;
      else if (k === 'table') { status = `<small>${esc(d.desc)}</small>`; actions = '<button class="btn btn-small btn-blue" data-act="table">Masaya otur</button>'; }
      else {
        const stars = `<span class="stars">${'★'.repeat(l)}${'☆'.repeat(MAX - l)}</span>`;
        let eff = '';
        if (k === 'mine') { const n = mined(), cap = d.rate[l] * d.cap; eff = `<small>${d.rate[l]} jeton/saat · depo ${cap}</small><span class="bar"><i style="width:${Math.min(100, n / cap * 100)}%"></i></span>`; actions += `<button class="btn btn-small btn-green" data-act="collect" ${n < 1 ? 'disabled' : ''}>Topla ${n}</button>`; }
        else eff = `<small>${l ? `Şu an: ${k === 'lab' ? `+%${l * 3} güç` : k === 'gym' ? `+%${l * 10} XP` : `%${l * 10} hızlı`}` : esc(d.desc)}</small>`;
        status = stars + eff;
        const c = nextCost(k);
        if (b && b.k === k) actions += `<span class="bld-time" data-end="${b.end}">${fmt(b.end - Date.now())}</span>`;
        else if (c) actions += `<button class="btn btn-small btn-yellow" data-act="up" ${b || S.coins < c.coins ? 'disabled' : ''}><i class="coin"></i>${c.coins} · ${fmt(c.mins * 60000)}</button>`;
        else actions += '<span class="bld-max">EN ÜST</span>';
      }
      card.innerHTML = `${buildingSVG(k, l, locked)}<div class="bld-info"><b>${esc(d.name)}${k !== 'table' && !locked ? ` <em>Sv ${l}</em>` : ''}</b>${status}</div><div class="bld-acts">${actions}</div>`;
      card.querySelectorAll('[data-act]').forEach(btn => (btn.onclick = () => {
        const a = btn.dataset.act;
        if (a === 'collect') collect(btn);
        else if (a === 'up') upgrade(k);
        else if (a === 'table') { Snd.click(); G.show('solve'); }
      }));
      v.appendChild(card);
    });
  }
  G.renderBase = render;
  G.baseNeedsAttention = () => { checkBuild(); return G.mineReady() || (!st().build && ORDER.some(k => B[k].cost && G.S.level >= B[k].unlock && nextCost(k) && G.S.coins >= nextCost(k).coins)); };
  // Atölye yalnız durum değişince yeniden çizilir (bina bitti, maden doldu, seviye/jeton değişti)
  const sig = () => { const s = st(); return [lv('mine'), lv('gym'), lv('depot'), lv('lab'), s.build && s.build.k, mined(), G.S.coins, G.S.level].join('|'); };
  let lastSig = '';
  const origRender = render;
  G.renderBase = function () { origRender(); lastSig = sig(); };
  setInterval(() => {
    checkBuild();
    if (G.current !== 'base') return;
    if (sig() !== lastSig) { if (!G.isModalOpen()) G.renderBase(); } else G.tickTimers($('tab-base'));
  }, 1000);
})();
