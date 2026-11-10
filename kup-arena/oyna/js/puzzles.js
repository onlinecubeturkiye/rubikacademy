// Haftalık bulmaca savaşları: hazır takımlar, hazır konumlar, tur sınırı. Her hafta 3 yeni bulmaca.
(function () {
  const { $, esc, cubeById, D } = G;
  const R = window.Render, Snd = window.Sound;
  // a/b: [küp, seviye, satır, sütun]  goal: en fazla kaç turda kazanılmalı
  const POOL = [
    { id: 'z1', name: 'Sırayı Çevir', hint: 'Piramidin düz çizgide vurur. Rakip hizada değilse sırayı döndür!', goal: 4, mult: 0.45,
      a: [['p3', 4, 3, 1]], b: [['c3', 3, 0, 0]] },
    { id: 'z2', name: 'İki Cephe', hint: 'Küpün öne, piramidin arkadan. Önce zayıfı bitir.', goal: 5, mult: 0.42,
      a: [['c4', 4, 3, 0], ['p3', 4, 3, 2]], b: [['c3', 3, 0, 1], ['p2', 3, 1, 1]] },
    { id: 'z3', name: 'Patron Avı', hint: 'Patron canı yarıya inince öfkelenir. Ondan önce güç karesine geç!', goal: 6, mult: 0.45, boss: true,
      a: [['c3n', 5, 3, 1], ['sk', 5, 2, 1]], b: [['c3p', 4, 0, 1]] },
    { id: 'z4', name: 'Güç Yolu', hint: 'Ortadaki ⚡ karelerde duran %30 fazla vurur.', goal: 5, mult: 0.42, power: [[1, 1], [2, 1]],
      a: [['c2f', 4, 3, 0], ['mg', 3, 3, 2]], b: [['c3i', 3, 0, 0], ['c3i', 3, 0, 2]] },
    { id: 'z5', name: 'Tek Başına', hint: 'Üç rakibe karşı tek küp. Yan yana duranları ayır!', goal: 7, mult: 0.45,
      a: [['c5', 6, 3, 1]], b: [['c2', 3, 0, 0], ['c3', 3, 0, 1], ['p2', 3, 0, 2]] },
    { id: 'z6', name: 'Hızlı Nişancı', hint: 'Piramit 2 kare uzaktan daha çok kritik vurur.', goal: 3, mult: 0.4,
      a: [['p4', 5, 3, 1]], b: [['c4', 4, 1, 1]] },
    { id: 'z7', name: 'Aura Gücü', hint: 'Özel küpün yanındaki dostlar %10 fazla vurur. Takımını topla!', goal: 7, mult: 0.38,
      a: [['c3', 4, 3, 0], ['mgr', 4, 3, 1], ['c3', 4, 3, 2]], b: [['c4', 4, 0, 0], ['p3', 4, 0, 1], ['c4', 4, 0, 2]] },
    { id: 'z8', name: 'Köşe Kapanı', hint: 'Rakipler sağ sütunda. Döndürerek yanına çek!', goal: 5, mult: 0.38,
      a: [['c3c', 3, 2, 0]], b: [['p3', 3, 0, 2], ['p2', 3, 1, 2]] },
  ];
  G.PUZZLES = POOL;
  G.playPuzzle = (id) => play(POOL.find(p => p.id === id));
  const week = () => Math.floor(G.dayIndex() / 7);
  function thisWeek() {
    const w = week(), list = POOL.slice();
    let x = w * 9301 + 49297;
    for (let i = list.length - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = x % (i + 1); [list[i], list[j]] = [list[j], list[i]]; }
    return list.slice(0, 3);
  }
  function state() {
    const S = G.S;
    if (!S.puz || S.puz.wk !== week()) S.puz = { wk: week(), done: [], bonus: false };
    return S.puz;
  }
  G.puzzlesLeft = () => { const st = state(); return thisWeek().filter(p => !st.done.includes(p.id)).length; };

  G.renderPuzzleCard = function () {
    const el = $('puz-card'); if (!el) return;
    const st = state(), list = thisWeek(), n = list.filter(p => st.done.includes(p.id)).length;
    const left = 7 - (G.dayIndex() % 7);
    el.innerHTML = `<span class="puz-ico">🧩</span><div><b>Haftalık Bulmacalar</b><small>${n}/3 çözüldü · ${left} gün kaldı · Hepsine Usta Paketi</small></div><span class="puz-dots">${list.map(p => `<i class="${st.done.includes(p.id) ? 'on' : ''}"></i>`).join('')}</span>`;
    el.classList.toggle('dot', n < 3);
  };
  function open() {
    Snd.click();
    const st = state(), list = thisWeek();
    const body = G.modal('Haftalık Bulmacalar', `
      <p class="note">Hazır takımla, tur sınırı içinde kazan. Her bulmaca +150 jeton; üçünü de çözersen Usta Paketi!</p>
      <div class="puz-list">${list.map((p, i) => {
        const done = st.done.includes(p.id);
        return `<div class="puz-row${done ? ' done' : ''}"><div class="puz-team">${p.a.map(x => `<canvas data-cv="${x[0]}"></canvas>`).join('')}</div>
          <div><b>${i + 1}. ${esc(p.name)}</b><small>${p.goal} turda kazan · ${esc(p.hint)}</small></div>
          <button class="btn btn-small ${done ? '' : 'btn-pink'}" data-p="${p.id}">${done ? 'Tekrar' : 'Oyna'}</button></div>`;
      }).join('')}</div>`, [{ label: 'Kapat' }], { replace: true, wide: true });
    if (!body) return;
    body.querySelectorAll('[data-cv]').forEach(c => requestAnimationFrame(() => R.drawPuzzle(c, cubeById(c.dataset.cv))));
    body.querySelectorAll('[data-p]').forEach(b => (b.onclick = () => { G.closeModal(); play(POOL.find(p => p.id === b.dataset.p)); }));
  }
  function play(p) {
    G.battle({
      mode: 'puzzle', title: `Bulmaca · ${p.name}`, nameA: G.S.name, nameB: 'Bulmaca', noAuto: true, goal: p.goal,
      bg: 'linear-gradient(170deg, #7b4dff, #2e8cff 55%, #19c0a8)',
      teamA: p.a.map(x => ({ id: x[0], lvl: x[1] })), posA: p.a.map(x => [x[2], x[3]]),
      teamB: p.b.map((x, i) => ({ id: x[0], lvl: x[1], mult: p.mult, boss: p.boss && i === 0, label: p.boss && i === 0 ? 'Bulmaca Patronu' : undefined })), posB: p.b.map(x => [x[2], x[3]]),
      power: p.power ? p.power.map(([r, c]) => ({ r, c })) : undefined,
      onEnd: (res) => {
        const st = state();
        if (!res.won) {
          G.modal('Olmadı!', `<p>${p.goal} turda kazanman gerekiyordu.</p><p class="note">İpucu: ${esc(p.hint)}</p>${G.replayButtonsHTML()}`,
            [{ label: 'Kapat', onClick: open }, { label: 'Tekrar dene', cls: 'btn-pink', onClick: () => play(p) }]);
          return;
        }
        if (G.clubWin) G.clubWin();
        let html = `<p>${res.rounds}. turda çözdün!</p>`;
        if (!st.done.includes(p.id)) {
          st.done.push(p.id); G.addCoins(150); G.addXP(40); G.bump('puzzles');
          html += '<p>+150 jeton · +40 XP</p>';
          if (st.done.length >= 3 && !st.bonus) { st.bonus = true; G.S.packs.usta++; html += '<p><b>Haftanın bulmacaları bitti! Usta Paketi Mağaza’da.</b></p>'; window.FX.confetti(120); }
        } else html += '<p class="note">Bu bulmacanın ödülünü bu hafta zaten aldın.</p>';
        G.save();
        G.modal('Bulmaca çözüldü!', html + G.replayButtonsHTML(), [{ label: 'Bulmacalara dön', cls: 'btn-yellow', onClick: open }]);
        G.renderPuzzleCard();
      },
    });
  }
  $('puz-card').onclick = open;
})();
