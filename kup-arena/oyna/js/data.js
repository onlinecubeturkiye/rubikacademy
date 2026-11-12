// Oyun verileri: nadirlikler, renk paletleri, küpler, paketler, bilgisayar rakipler.
(function () {
  const RARITIES = {
    common:    { name: 'Yaygın', color: '#a9bcd6', sell: 10,  mult: 1.0,  order: 0 },
    rare:      { name: 'Nadir',  color: '#3fa9ff', sell: 25,  mult: 1.2,  order: 1 },
    epic:      { name: 'Epik',   color: '#b45cff', sell: 60,  mult: 1.45, order: 2 },
    legendary: { name: 'Efsane', color: '#ffb020', sell: 150, mult: 1.8,  order: 3 },
    mythic:    { name: 'Mitik',  color: '#ff3d8b', sell: 400, mult: 2.3,  order: 4 },
    season:    { name: 'Sezon',  color: '#2ee6c8', sell: 300, mult: 2.1,  order: 4 }, // yalnız Sezon Yolu'nun son ödülü
  };
  const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

  const PALETTES = {
    classic: { U: '#f4f4f0', D: '#ffd21f', F: '#16a34a', B: '#1d4ed8', R: '#c81e2e', L: '#ff7a14', body: '#15161a' },
    pastel:  { U: '#fdfcf7', D: '#ffe9a8', F: '#9fe3bb', B: '#a9c8ff', R: '#ffb3c1', L: '#ffcf9e', body: '#e6e0f3' },
    neon:    { U: '#f8fff0', D: '#faff00', F: '#39ff7a', B: '#2e9bff', R: '#ff2e88', L: '#ff8a00', body: '#0b0b12' },
    ice:     { U: '#ffffff', D: '#d9f4ff', F: '#7fd6ff', B: '#2f7fd8', R: '#9ab0ff', L: '#3fc3d8', body: '#1b2a44' },
    fire:    { U: '#fff3c4', D: '#ffd000', F: '#ff8a00', B: '#8a0f0f', R: '#e3261b', L: '#ff5a1f', body: '#1a0a05' },
    gold:    { U: '#fff4c2', D: '#f1cf6a', F: '#d4a017', B: '#6b4a10', R: '#a8741a', L: '#e8b84a', body: '#2a1d06' },
    galaxy:  { U: '#f2e9ff', D: '#ffd6f5', F: '#8b5cff', B: '#3434a8', R: '#ff4fa3', L: '#38d6ff', body: '#0d0820' },
    crystal: { U: '#f2fdff', D: '#c7f0ff', F: '#8fe3ff', B: '#6aa8ff', R: '#d5c4ff', L: '#a8ffe8', body: '#7fc8ee' },
    void:    { U: '#8b5cf6', D: '#2a2770', F: '#c084fc', B: '#4338ca', R: '#ec4899', L: '#06b6d4', body: '#000000' },
    silver:  { U: '#eef0f3', D: '#cbd5e1', F: '#a3b1c2', B: '#64748b', R: '#8e9aab', L: '#d7dde5', body: '#1f2937' },
    mirrorgold: { U: '#fff2b8', D: '#f0cc5a', F: '#d9a521', B: '#8a6212', R: '#b8861d', L: '#f6dc85', body: '#2a1d06' },
    frost:   { U: '#ffffff', D: '#e0f7ff', F: '#a6e4ff', B: '#5aa7ff', R: '#c9d7ff', L: '#7ff0ff', body: '#e8f4ff' },
    lava:    { U: '#ffe08a', D: '#ff9a1f', F: '#ff5a1f', B: '#5a0a0a', R: '#d6150f', L: '#ffbf3f', body: '#1a0505' },
    forest:  { U: '#f4ffe0', D: '#c8e86a', F: '#2fa84f', B: '#1f5f3a', R: '#7a4a1e', L: '#9be15d', body: '#14200e' },
    nebula:  { U: '#ffe6ff', D: '#ff9de2', F: '#7a5cff', B: '#1e1b6e', R: '#ff3d8b', L: '#3de0ff', body: '#06041a' },
    mint:    { U: '#f6fff9', D: '#ffe66d', F: '#2ec4a6', B: '#3a86ff', R: '#ff6b6b', L: '#ff9f1c', body: '#10302b' },
    shadow:  { U: '#d9dbe6', D: '#8d93ab', F: '#5a6078', B: '#2c3048', R: '#b0413e', L: '#3f6fb5', body: '#0a0b12' },
    steel:   { U: '#f2f6fa', D: '#b8c4d2', F: '#8da0b5', B: '#4a5a70', R: '#6f8298', L: '#d2dbe6', body: '#141a22' },
    sunset:  { U: '#fff1d6', D: '#ffc857', F: '#ff7b54', B: '#6a2c70', R: '#e84a5f', L: '#ffa94d', body: '#2a0f2e' },
    candy:   { U: '#ffffff', D: '#fff59d', F: '#b2f2bb', B: '#a5d8ff', R: '#ffa8c5', L: '#ffd8a8', body: '#ff8fb3' },
    coral:   { U: '#f0fbff', D: '#ffd166', F: '#06d6a0', B: '#118ab2', R: '#ef476f', L: '#ff9e6d', body: '#073b4c' },
    plasma:  { U: '#f3fff0', D: '#d0ff4f', F: '#39ffb0', B: '#7a2cff', R: '#ff2bd6', L: '#2bd9ff', body: '#12002b' },
    diamond: { U: '#e8fdff', D: '#b5f5ff', F: '#67e8f9', B: '#0ea5e9', R: '#a5f3fc', L: '#22d3ee', body: '#0b3a4a' },
    rainbow: { U: '#b45cff', D: '#ffffff', F: '#ff3b3b', B: '#2ec4ff', R: '#ff9f1c', L: '#3ee08f', body: '#111018',
               ring: ['#ff3b3b', '#ff9f1c', '#ffe14d', '#3ee08f', '#2ec4ff'] },
  };

  const SKILLS = {
    double: { name: 'Köşe Darbesi', desc: '2 kat hasar verir.', cost: 5 },
    heal:   { name: 'Hizala',       desc: 'Kendini ya da yanındaki dostunu %35 iyileştirir.', cost: 4 },
    stun:   { name: 'Karıştır',     desc: 'Az hasar verir, rakip 1 tur bekler.', cost: 5 },
    shield: { name: 'Kalkan',       desc: 'Sonraki 2 saldırıda yarı hasar alır.', cost: 3 },
    drain:  { name: 'Emici',        desc: 'Hasar verir, yarısını can olarak alır.', cost: 4 },
  };

  function mk(id, name, type, n, pal, rarity, skill) {
    const base = {
      cube:    { hp: 60 + n * 10, atk: 8 + n * 2.5 },
      pyramid: { hp: 55 + n * 12, atk: 10 + n * 3 },
      mega:    { hp: 120, atk: 22 },
      skewb:   { hp: 85, atk: 17 },
      mirror:  { hp: 95, atk: 18 },
    }[type];
    const m = RARITIES[rarity].mult;
    return { id, name, type, n, pal, rarity, skill, hp: Math.round(base.hp * m), atk: Math.round(base.atk * m) };
  }

  const CUBES = [
    mk('c2',  '2×2 Klasik',        'cube',    2, 'classic', 'common',    'double'),
    mk('c3',  '3×3 Klasik',        'cube',    3, 'classic', 'common',    'heal'),
    mk('p2',  'Mini Piramit',      'pyramid', 2, 'classic', 'common',    'stun'),
    mk('c2p', '2×2 Pastel',        'cube',    2, 'pastel',  'common',    'shield'),
    mk('c3p', '3×3 Pastel',        'cube',    3, 'pastel',  'common',    'drain'),
    mk('c4',  '4×4 Klasik',        'cube',    4, 'classic', 'rare',      'shield'),
    mk('c3n', '3×3 Neon',          'cube',    3, 'neon',    'rare',      'double'),
    mk('p3',  'Piramit',           'pyramid', 3, 'classic', 'rare',      'stun'),
    mk('sk',  'Eğik Küp',          'skewb',   2, 'classic', 'rare',      'drain'),
    mk('c3i', '3×3 Buz',           'cube',    3, 'ice',     'rare',      'heal'),
    mk('c2f', '2×2 Ateş',          'cube',    2, 'fire',    'rare',      'double'),
    mk('c5',  '5×5 Klasik',        'cube',    5, 'classic', 'epic',      'heal'),
    mk('mg',  'Megaküp',           'mega',    3, 'classic', 'epic',      'shield'),
    mk('c3f', '3×3 Ateş',          'cube',    3, 'fire',    'epic',      'double'),
    mk('mr',  'Ayna Küp',          'mirror',  3, 'silver',  'epic',      'stun'),
    mk('p4',  'Usta Piramit',      'pyramid', 4, 'neon',    'epic',      'drain'),
    mk('c4i', '4×4 Buz',           'cube',    4, 'ice',     'epic',      'shield'),
    mk('c6',  '6×6 Klasik',        'cube',    6, 'classic', 'legendary', 'heal'),
    mk('c7',  '7×7 Klasik',        'cube',    7, 'classic', 'legendary', 'shield'),
    mk('c3g', '3×3 Altın',         'cube',    3, 'gold',    'legendary', 'double'),
    mk('mgr', 'Gökkuşağı Megaküp', 'mega',    3, 'rainbow', 'legendary', 'drain'),
    mk('c5g', '5×5 Galaksi',       'cube',    5, 'galaxy',  'legendary', 'stun'),
    mk('c3c', 'Kristal Küp',       'cube',    3, 'crystal', 'mythic',    'heal'),
    mk('c5v', 'Kara Delik',        'cube',    5, 'void',    'mythic',    'drain'),
    mk('p3d', 'Elmas Piramit',     'pyramid', 3, 'diamond', 'mythic',    'double'),
    mk('mrg', 'Altın Ayna',        'mirror',  3, 'mirrorgold', 'mythic', 'stun'),
    // v3.4 yeni küpler
    mk('p2p', 'Pastel Piramit',    'pyramid', 2, 'candy',   'common',    'shield'),
    mk('skm', 'Eğik Mint',         'skewb',   2, 'mint',    'common',    'double'),
    mk('c4p', '4×4 Şeker',         'cube',    4, 'candy',   'rare',      'heal'),
    mk('c5m', '5×5 Mint',          'cube',    5, 'mint',    'rare',      'shield'),
    mk('c3s', '3×3 Gölge',         'cube',    3, 'shadow',  'rare',      'drain'),
    mk('c4n', '4×4 Neon',          'cube',    4, 'neon',    'epic',      'stun'),
    mk('mgn', 'Neon Megaküp',      'mega',    3, 'neon',    'epic',      'drain'),
    mk('mrs', 'Çelik Ayna',        'mirror',  3, 'steel',   'epic',      'shield'),
    mk('c2g', '2×2 Altın',         'cube',    2, 'gold',    'epic',      'double'),
    mk('p4o', 'Mercan Piramit',    'pyramid', 4, 'coral',   'epic',      'heal'),
    mk('c6i', '6×6 Buz',           'cube',    6, 'ice',     'legendary', 'shield'),
    mk('c4z', '4×4 Gün Batımı',    'cube',    4, 'sunset',  'legendary', 'stun'),
    mk('skv', 'Eğik Void',         'skewb',   2, 'void',    'legendary', 'drain'),
    mk('c6p', '6×6 Plazma',        'cube',    6, 'plasma',  'legendary', 'double'),
    mk('c7v', 'Void 7',            'cube',    7, 'void',    'mythic',    'shield'),
    mk('mgp', 'Plazma Megaküp',    'mega',    3, 'plasma',  'mythic',    'stun'),
    // Sezon küpleri: paketten çıkmaz, yalnız o sezonun Sezon Yolu sonunda kazanılır
    mk('ss1', 'Kar Tanesi',        'cube',    3, 'frost',   'season',    'shield'),
    mk('ss2', 'Volkan Piramit',    'pyramid', 3, 'lava',    'season',    'double'),
    mk('ss3', 'Orman Megaküp',     'mega',    3, 'forest',  'season',    'heal'),
    mk('ss4', 'Nebula 4',          'cube',    4, 'nebula',  'season',    'drain'),
  ];

  // Kurgusal küp markaları. Gerçek markalarla bir ilgisi yoktur.
  // Seviyeler: ekonomik (ucuz, basit), orta segment (fiyatına göre güzel), rekabetçi (yarışma küpleri).
  // speed: 3B küpte bir katmanın dönme süresi (ms). Pahalı küpler daha hızlı ve akıcı döner.
  const TIERS = {
    eko:   { name: 'Ekonomik',     color: '#8bc34a', speed: 240, desc: 'Ucuz ve basit. Yeni başlayanlar için.' },
    orta:  { name: 'Orta segment', color: '#38bdf8', speed: 175, desc: 'Fiyatına göre çok güzel, renkli ve akıcı.' },
    pro:   { name: 'Rekabetçi',    color: '#ffcc1f', speed: 115, desc: 'Yarışmalarda kullanılan en iyi küpler.' },
  };
  const BRANDS = {
    topac:  { logo: 'M12 2.2c.9 0 1.5.7 1.5 1.5V6h3.6c1.7 0 2.8 1.8 2 3.3l-5.3 10c-.8 1.4-2.8 1.4-3.6 0l-5.3-10C4.100 7.800 5.200 6 6.900 6h3.600V3.700c0-.8.600-1.500 1.500-1.500Z', name: 'TOPAÇ',  tier: 'eko',  color: '#65a30d', tag: 'Oyuncakçıdaki renkli küpler', perk: 'Güçlendirme %40 ucuz' },
    kairo:  { logo: 'M4 16.500a8 8 0 0 1 16 0ZM2.800 18.300h18.400v2.400H2.800ZM11 2.500h2v3.600h-2ZM3.900 6.900l1.500-1.400 2.400 2.500-1.500 1.400ZM20.100 6.900l-1.500-1.400-2.400 2.500 1.500 1.400Z', name: 'KAIRO',  tier: 'eko',  color: '#0ea5e9', tag: 'Herkes için uygun fiyatlı küpler', perk: '+%15 can' },
    hayate: { logo: 'M8 4.500h13.500L20 8.300H6.500ZM4 10.100h14.500L17 13.900H2.500ZM9.500 15.700H20l-1.500 3.800H8Z', name: 'HAYATE', tier: 'orta', color: '#f59e0b', tag: 'Hafif, hızlı ve şeker gibi', perk: 'Yetenekler 1 enerji ucuz' },
    torva:  { logo: 'M12 1.800l8.800 5.100v10.200L12 22.200l-8.800-5.100V6.900ZM12 7.400l-4 2.300v4.600l4 2.300 4-2.300V9.700Z', name: 'TORVA',  tier: 'orta', color: '#10b981', tag: 'Güçlü mıknatıslar, sağlam yapı', perk: 'Savaşa 1 kalkanla başlar' },
    zenko:  { logo: 'M12 2.500a9.500 9.500 0 1 0 9 6.500h-3a6.600 6.600 0 1 1-6-3.600ZM17.800 2.600a2.300 2.300 0 1 0 .01 0Z', name: 'ZENKO',  tier: 'pro',  color: '#e11d48', tag: 'Şampiyonların tercihi amiral gemisi küpler', perk: 'Kritik şansı %20 (normali %10)' },
    vexa:   { logo: 'M12 1.200l2.700 8.100 8.100 2.700-8.100 2.700L12 22.800l-2.700-8.100L1.200 12l8.100-2.700ZM12 9.200L9.200 12 12 14.800 14.800 12Z', name: 'VEXA',   tier: 'pro',  color: '#8b5cf6', tag: 'Rekabetçi ve sıra dışı tasarımlar', perk: 'Kritik vuruş 2 kat (normali 1,5)' },
  };
  const MODELS = {
    c2: ['kairo', 'KAIRO Mini 2'], c3: ['kairo', 'KAIRO Start 3'], p2: ['kairo', 'KAIRO Piramit S'],
    c2p: ['topac', 'TOPAÇ Renkli 2'], c3p: ['topac', 'TOPAÇ Renkli 3'],
    c4: ['torva', 'TORVA Grid 4'], c3n: ['hayate', 'HAYATE Neon 3'], p3: ['hayate', 'HAYATE Piramit'],
    sk: ['vexa', 'VEXA Eğik X'], c3i: ['torva', 'TORVA Frost 3'], c2f: ['hayate', 'HAYATE Blaze 2'],
    c5: ['torva', 'TORVA Grid 5 M'], mg: ['vexa', 'VEXA Mega 12'], c3f: ['hayate', 'HAYATE Blaze 3 M'],
    mr: ['vexa', 'VEXA Ayna'], p4: ['zenko', 'ZENKO Piramit Pro'], c4i: ['torva', 'TORVA Frost 4 M'],
    c6: ['zenko', 'ZENKO Aero 6 M'], c7: ['zenko', 'ZENKO Aero 7 M'], c3g: ['zenko', 'ZENKO Aero 3 Gold'],
    mgr: ['vexa', 'VEXA Mega Prizma'], c5g: ['hayate', 'HAYATE Galaxy 5 M'],
    c3c: ['zenko', 'ZENKO Kristal MAX'], c5v: ['vexa', 'VEXA Void 5'], p3d: ['zenko', 'ZENKO Elmas Piramit'], mrg: ['vexa', 'VEXA Ayna Gold'],
    p2p: ['topac', 'TOPAÇ Şeker Piramit'], c4p: ['topac', 'TOPAÇ Şeker 4'], skm: ['kairo', 'KAIRO Eğik S'], c5m: ['kairo', 'KAIRO Start 5'],
    c3s: ['torva', 'TORVA Shadow 3'], mrs: ['torva', 'TORVA Çelik Ayna'], c6i: ['torva', 'TORVA Frost 6 M'],
    c4n: ['hayate', 'HAYATE Neon 4'], mgn: ['hayate', 'HAYATE Mega Neon'], p4o: ['hayate', 'HAYATE Mercan Piramit'],
    c2g: ['zenko', 'ZENKO Aero 2 Gold'], c4z: ['zenko', 'ZENKO Aero 4 Sunset'], c6p: ['zenko', 'ZENKO Plazma 6 M'],
    skv: ['vexa', 'VEXA Eğik Void'], c7v: ['vexa', 'VEXA Void 7'], mgp: ['vexa', 'VEXA Mega Plazma'],
    ss1: ['torva', 'TORVA Kar Tanesi'], ss2: ['zenko', 'ZENKO Volkan Piramit'], ss3: ['hayate', 'HAYATE Orman Megaküp'], ss4: ['vexa', 'VEXA Nebula 4'],
  };
  CUBES.forEach(c => { const m = MODELS[c.id]; c.brand = m[0]; c.name = m[1]; c.model = m[1].slice(BRANDS[m[0]].name.length + 1); if (c.brand === 'kairo') c.hp = Math.round(c.hp * 1.15); });

  const SEASONS = [
    { name: 'Buz Sezonu', cube: 'ss1', color: '#7fd6ff' }, { name: 'Ateş Sezonu', cube: 'ss2', color: '#ff6a1f' },
    { name: 'Orman Sezonu', cube: 'ss3', color: '#2fa84f' }, { name: 'Uzay Sezonu', cube: 'ss4', color: '#7a5cff' },
  ];
  // Oranlar: Yaygın, Nadir, Epik, Efsane, Mitik (yüzde)
  const PACKS = [
    { id: 'klasik', name: 'Klasik Paket', price: 100, odds: [70, 22, 6.5, 1.4, 0.1],
      bg: 'linear-gradient(160deg,#1f6bff,#21d4fd)', cap: '#0b4fd1', art: ['c2', 'c3', 'p2'] },
    { id: 'usta', name: 'Usta Paketi', price: 250, odds: [35, 40, 18, 6, 1],
      bg: 'linear-gradient(160deg,#7b2ff7,#ff4fa3)', cap: '#5a17c9', art: ['p3', 'mg', 'c4'] },
    { id: 'efsane', name: 'Efsane Paketi', price: 600, odds: [0, 35, 40, 20, 5],
      bg: 'linear-gradient(160deg,#ff9a00,#ff2e88 55%,#8b2cff)', cap: '#c2186b', art: ['c5g', 'mgr', 'c3g'] },
    // Marka kutuları: yalnızca o markanın bulmacaları çıkar.
    { id: 'b-topac', brand: 'topac', name: 'TOPAÇ Kutusu', price: 50, odds: [100, 0, 0, 0, 0],
      bg: 'linear-gradient(160deg,#a3e635,#4d7c0f)', cap: '#3f6212', art: ['c2p', 'c3p', 'c2p'] },
    { id: 'b-kairo', brand: 'kairo', name: 'KAIRO Kutusu', price: 80, odds: [100, 0, 0, 0, 0],
      bg: 'linear-gradient(160deg,#38bdf8,#0369a1)', cap: '#075985', art: ['c3', 'c2', 'p2'] },
    { id: 'b-torva', brand: 'torva', name: 'TORVA Kutusu', price: 300, odds: [0, 70, 30, 0, 0],
      bg: 'linear-gradient(160deg,#34d399,#047857)', cap: '#065f46', art: ['c4', 'c3i', 'c5'] },
    { id: 'b-hayate', brand: 'hayate', name: 'HAYATE Kutusu', price: 300, odds: [0, 70, 22, 8, 0],
      bg: 'linear-gradient(160deg,#fbbf24,#ea580c)', cap: '#9a3412', art: ['p3', 'c3n', 'c2f'] },
    { id: 'b-vexa', brand: 'vexa', name: 'VEXA Kutusu', price: 450, odds: [0, 40, 40, 14, 6],
      bg: 'linear-gradient(160deg,#a78bfa,#5b21b6)', cap: '#4c1d95', art: ['sk', 'mg', 'mr'] },
    { id: 'b-zenko', brand: 'zenko', name: 'ZENKO Kutusu', price: 800, odds: [0, 0, 40, 48, 12],
      bg: 'linear-gradient(160deg,#fb7185,#9f1239)', cap: '#881337', art: ['c3g', 'p4', 'c6'] },
  ];

  // Bilgisayar rakipler (gerçek oyuncular değil).
  const BOTS = [
    ['Usta Robot', 2610], ['Şampiyon Bot', 2380], ['Hız Makinesi', 2190], ['Demir Küp', 2040], ['Piramit Bot', 1880],
    ['Kristal Bot', 1750], ['Mega Robot', 1620], ['Turbo Küp', 1505], ['Robo Çözücü', 1390], ['Çelik Bot', 1280],
    ['Neon Bot', 1175], ['Mıknatıs Bot', 1080], ['Zeki Robot', 990], ['Pusula Bot', 905], ['Yıldız Bot', 820],
    ['Roket Bot', 745], ['Bulut Bot', 670], ['Şimşek Bot', 600], ['Kedi Bot', 530], ['Yağmur Bot', 470],
    ['Fener Bot', 410], ['Minik Robot', 355], ['Toprak Bot', 300], ['Rüzgar Bot', 250], ['Çırak Bot', 205],
    ['Oyuncak Bot', 160], ['Bebek Bot', 120], ['Uykucu Bot', 85], ['Acemi Bot', 50], ['Yeni Bot', 20],
  ].map(([name, tr]) => ({ name, tr }));

  // Tür avantajı: Küp > Piramit > Özel > Küp
  const TYPE_OF = { cube: 'kup', pyramid: 'piramit', mega: 'ozel', skewb: 'ozel', mirror: 'ozel' };
  const TYPES = {
    kup:     { name: 'Küp',     beats: 'piramit', color: '#ffd23f' },
    piramit: { name: 'Piramit', beats: 'ozel',    color: '#3ee08f' },
    ozel:    { name: 'Özel',    beats: 'kup',     color: '#2ee6ff' },
  };

  // Macera dünyaları. Her dünyada 6 bölüm: savaş, savaş, çözme, savaş, savaş, boss.
  const WORLDS = [
    { id: 'w1', name: 'Oyuncak Kasabası', desc: 'Renkli sokaklarda ilk adımların.', pal: 'pastel',
      bg: 'linear-gradient(170deg,#ff9ec7,#ffcf6b 60%,#7fe0b0)', ink: '#3a1030',
      pool: ['c2', 'c3', 'p2', 'c2p', 'c3p'], base: 1, mult: 0.75,
      solve: { n: 2, depth: 2 }, boss: { id: 'c3p', name: 'Kasaba Bekçisi' }, reward: 'sk' },
    { id: 'w2', name: 'Buz Vadisi', desc: 'Donmuş göller, kaygan küpler.', pal: 'ice',
      bg: 'linear-gradient(170deg,#bfeaff,#5aa9ff 60%,#3b4fd1)', ink: '#0b2350',
      pool: ['c3i', 'c2', 'c3', 'c4', 'p2'], base: 2, mult: 0.9,
      solve: { n: 3, depth: 3 }, boss: { id: 'c4i', name: 'Buz Devi' }, reward: 'c4i' },
    { id: 'w3', name: 'Ateş Dağı', desc: 'Lavların arasında sıcak savaşlar.', pal: 'fire',
      bg: 'linear-gradient(170deg,#ffd000,#ff5a1f 55%,#8a0f0f)', ink: '#3a0a00',
      pool: ['c2f', 'c3n', 'p3', 'sk', 'c4'], base: 3, mult: 1.0,
      solve: { n: 3, depth: 4 }, boss: { id: 'c3f', name: 'Lav Ejderi' }, reward: 'c3f' },
    { id: 'w4', name: 'Altın Çöl', desc: 'Kumların altında altın sırlar.', pal: 'gold',
      bg: 'linear-gradient(170deg,#fff0a8,#e8b84a 55%,#8a5a12)', ink: '#3a2400',
      pool: ['p3', 'p4', 'mr', 'c5', 'mg'], base: 5, mult: 1.05,
      solve: { n: 4, depth: 4 }, boss: { id: 'c3g', name: 'Çöl Firavunu' }, reward: 'c3g' },
    { id: 'w5', name: 'Galaksi Kalesi', desc: 'Yıldızların arasında bir kale.', pal: 'galaxy',
      bg: 'linear-gradient(170deg,#8b5cff,#3434a8 55%,#0d0820)', ink: '#ffffff',
      pool: ['mg', 'c6', 'p4', 'c4i', 'c5'], base: 6, mult: 1.1,
      solve: { n: 3, depth: 6 }, boss: { id: 'c5g', name: 'Yıldız Lordu' }, reward: 'c5g' },
    { id: 'w6', name: 'Kaos Boyutu', desc: 'Her şeyin karıştığı son durak.', pal: 'void',
      bg: 'linear-gradient(170deg,#ec4899,#4338ca 50%,#000000)', ink: '#ffffff',
      pool: ['c7', 'mgr', 'c6', 'c5g', 'p3d'], base: 8, mult: 1.2,
      solve: { n: 4, depth: 6 }, boss: { id: 'c5v', name: 'Kaos Ustası' }, reward: 'c3c' },
    { id: 'w7', name: 'Mercan Derinliği', desc: 'Denizin dibinde parlayan küpler.', pal: 'coral',
      bg: 'linear-gradient(170deg,#7ff0e0,#118ab2 55%,#073b4c)', ink: '#ffffff',
      pool: ['p4o', 'c5m', 'skm', 'c6i', 'mrs'], base: 11, mult: 1.25,
      solve: { n: 3, depth: 7 }, boss: { id: 'c6i', name: 'Derinlerin Bekçisi' }, reward: 'p4o' },
    { id: 'w8', name: 'Plazma Çekirdeği', desc: 'Enerjinin kalbi. En zorlu rakipler burada.', pal: 'plasma',
      bg: 'linear-gradient(170deg,#d0ff4f,#ff2bd6 50%,#12002b)', ink: '#ffffff',
      pool: ['c6p', 'mgn', 'c4z', 'skv', 'c7v'], base: 14, mult: 1.3,
      solve: { n: 4, depth: 7 }, boss: { id: 'mgp', name: 'Plazma Titanı' }, reward: 'c6p' },
  ];

  // Günlük görevler: her gün bu havuzdan 3 tane seçilir. İlerleme, sayaçların gün başındaki değerine göre ölçülür.
  const QUESTS = [
    { id: 'pack',    text: '2 paket aç',               stat: 'packs',    target: 2, reward: 80 },
    { id: 'win',     text: '3 savaş kazan',            stat: 'wins',     target: 3, reward: 120 },
    { id: 'solve',   text: '1 küp çöz',                stat: 'solves',   target: 1, reward: 100 },
    { id: 'skill',   text: '5 yetenek kullan',         stat: 'skills',   target: 5, reward: 60 },
    { id: 'stage',   text: '2 macera bölümü geç',      stat: 'stages',   target: 2, reward: 100 },
    { id: 'upgrade', text: 'Bir bulmacayı güçlendir',  stat: 'upgrades', target: 1, reward: 80 },
    { id: 'tower',   text: 'Kulede 3 kat çık',         stat: 'floors',   target: 3, reward: 120 },
    { id: 'arena',   text: 'Arenada 2 maç yap',        stat: 'arena',    target: 2, reward: 90 },
  ];

  const ACHIEVEMENTS = [
    { id: 'col5',    name: 'Koleksiyoncu',       desc: '5 farklı bulmaca topla',       stat: 'collection', target: 5,  reward: 100 },
    { id: 'col15',   name: 'Müze Sahibi',        desc: '15 farklı bulmaca topla',      stat: 'collection', target: 15, reward: 300 },
    { id: 'colAll',  name: 'Tam Koleksiyon',     desc: 'Bütün küpleri topla (sezon küpleri hariç)', stat: 'collection', target: CUBES.filter(c => c.rarity !== 'season').length, reward: 1500 },
    { id: 'world1',  name: 'Kasabanın Kahramanı', desc: 'İlk dünyayı bitir',           stat: 'worlds',     target: 1,  reward: 100 },
    { id: 'world3',  name: 'Kaşif',              desc: '3 dünyayı bitir',              stat: 'worlds',     target: 3,  reward: 300 },
    { id: 'worldAll',name: 'Kaosu Yenen',        desc: '8 dünyanın hepsini bitir',     stat: 'worlds',     target: 8,  reward: 1000 },
    { id: 'stars30', name: 'Yıldız Toplayıcı',   desc: 'Macerada 30 yıldız topla',     stat: 'stars',      target: 30, reward: 300 },
    { id: 'starsAll',name: 'Kusursuz',           desc: 'Macerada 108 yıldızın hepsi',  stat: 'stars',      target: 108, reward: 1000 },
    { id: 'win10',   name: 'Savaşçı',            desc: '10 savaş kazan',               stat: 'wins',       target: 10, reward: 150 },
    { id: 'win50',   name: 'Arena Efsanesi',     desc: '50 savaş kazan',               stat: 'wins',       target: 50, reward: 500 },
    { id: 'tr1000',  name: 'Kupa Avcısı',        desc: 'Arenada 1000 kupaya ulaş',     stat: 'trophies',   target: 1000, reward: 400 },
    { id: 'tower10', name: 'Kule Tırmanıcısı',   desc: 'Sonsuz Kule’de 10. kata çık',  stat: 'towerBest',  target: 10, reward: 200 },
    { id: 'tower30', name: 'Gökdelen',           desc: 'Sonsuz Kule’de 30. kata çık',  stat: 'towerBest',  target: 30, reward: 600 },
    { id: 'solve1',  name: 'İlk Çözüm',          desc: 'Karışık bir küpü çöz',         stat: 'solves',     target: 1,  reward: 50 },
    { id: 'solve10', name: 'Çözücü',             desc: '10 küp çöz',                   stat: 'solves',     target: 10, reward: 250 },
    { id: 'big5',    name: 'Dev Avcısı',         desc: '5×5 veya daha büyük bir küpü çöz', stat: 'bigSolve', target: 1, reward: 300 },
    { id: 'sub120',  name: 'Hızlı Eller',        desc: '3×3’ü 2 dakikanın altında çöz', stat: 'fast3',     target: 1,  reward: 300 },
    { id: 'sub60',   name: 'Şimşek',             desc: '3×3’ü 1 dakikanın altında çöz', stat: 'flash3',    target: 1,  reward: 600 },
    { id: 'mythic',  name: 'Mitik Şans',         desc: 'Bir Mitik bulmaca bul',        stat: 'mythics',    target: 1,  reward: 300 },
    { id: 'max10',   name: 'Usta Eğitmen',       desc: 'Bir bulmacayı seviye 10 yap',  stat: 'maxLevel',   target: 10, reward: 400 },
    { id: 'packs50', name: 'Paket Tutkunu',      desc: '50 paket aç',                  stat: 'packs',      target: 50, reward: 300 },
    { id: 'brandSet', name: 'Marka Tutkunu',     desc: 'Bir markanın tüm bulmacalarını topla', stat: 'brandSet', target: 1, reward: 500 },
    { id: 'proCube', name: 'Yarışmacı',          desc: 'Rekabetçi seviyede bir küp bul',        stat: 'proOwned', target: 1, reward: 200 },
    { id: 'pvp1',    name: 'Dostluk Maçı',       desc: 'Arkadaşınla aynı telefonda oyna', stat: 'pvp',     target: 1,  reward: 100 },
  ];

  // Küp kutuları (gerçek speedcube ambalajları gibi): galibiyetlerden düşer, 4 raf yerine girer, sırayla açılır.
  // style: kutunun görünüşü (kraft karton, pencereli, premium siyah, koleksiyon, şeffaf vitrin, şampiyon).
  // odds: Yaygın, Nadir, Epik, Efsane, Mitik (yüzde); min: en az bu nadirlikte 1 küp garanti.
  const CHESTS = {
    tahta:   { name: 'Karton Kutu',       short: 'Karton',     mins: 3,   cubes: 2,  coins: 40,  odds: [75, 22, 3, 0, 0],  color: '#c99a5b', lid: '#b07f43', side: '#9c6d35', label: '#f4e3c3', show: 'c2' },
    gumus:   { name: 'Pencereli Kutu',    short: 'Pencereli',  mins: 15,  cubes: 4,  coins: 90,  odds: [62, 30, 7, 1, 0],  color: '#f4f6fb', lid: '#2e8cff', side: '#cfd6e6', label: '#2e8cff', show: 'c3', window: true },
    altin:   { name: 'Premium Kutu',      short: 'Premium',    mins: 60,  cubes: 7,  coins: 220, odds: [50, 35, 12, 3, 0], color: '#22232e', lid: '#15161e', side: '#101118', label: '#ffc928', show: 'c3g', window: true, min: 'rare' },
    dev:     { name: 'Koleksiyon Kutusu', short: 'Koleksiyon', mins: 180, cubes: 14, coins: 500, odds: [55, 32, 10, 3, 0], color: '#7b4dff', lid: '#5a2fd0', side: '#4a24ad', label: '#ffffff', show: 'c5', window: true, min: 'epic' },
    sihirli: { name: 'Vitrin Kutusu',     short: 'Vitrin',     mins: 360, cubes: 6,  coins: 300, odds: [0, 45, 40, 13, 2], color: '#bfe9ff', lid: '#e6f7ff', side: '#9fd7f5', label: '#0b1033', show: 'c3c', clear: true, min: 'legendary' },
    tac:     { name: 'Şampiyon Kutusu',   short: 'Şampiyon',   mins: 0,   cubes: 5,  coins: 150, odds: [55, 33, 10, 2, 0], color: '#e0283f', lid: '#ffc928', side: '#a3142a', label: '#ffc928', show: 'c3n', window: true, min: 'rare' },
  };
  // Düşme sırası (tekrar eder): çoğu tahta/gümüş, arada altın, nadiren dev ve sihirli.
  const CHEST_CYCLE = ['tahta', 'tahta', 'gumus', 'tahta', 'altin', 'gumus', 'tahta', 'gumus', 'tahta', 'altin',
                       'tahta', 'gumus', 'sihirli', 'tahta', 'gumus', 'altin', 'tahta', 'gumus', 'tahta', 'dev'];
  const EMOTES = [['😂', 'Haha!'], ['👍', 'İyi oyun!'], ['😮', 'Vay be!'], ['😡', 'Grrr!'], ['💪', 'Hadi!'], ['😭', 'Olamaz!']];

  window.GameData = { SEASONS, CHESTS, CHEST_CYCLE, EMOTES, TIERS, BRANDS, RARITIES, RARITY_ORDER, PALETTES, SKILLS, CUBES, PACKS, BOTS, TYPE_OF, TYPES, WORLDS, QUESTS, ACHIEVEMENTS };
})();
