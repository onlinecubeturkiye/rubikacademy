// Gezinme, profil, görevler, ilk açılış rehberi, Android geri tuşu ve başlatma.
(function () {
  const { $, h, esc, D } = G;
  const Snd = window.Sound;
  const RENDER = { base: () => G.renderBase(), home: () => G.renderHome(), adv: () => G.renderAdventure(), arena: () => G.renderArena(), shop: () => G.renderShop(), inv: () => G.renderInv(), solve: () => G.renderSolve() };

  // Tarayıcıda (uygulama dışında) masaüstü yerleşimi ve web'e özel parçalar
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  document.documentElement.classList.toggle('web', !native);
  G.current = 'home';
  G.show = function (tab) {
    if (!RENDER[tab]) return;
    G.current = tab;
    document.querySelectorAll('.tab').forEach(s => (s.hidden = s.id !== 'tab-' + tab));
    document.querySelectorAll('#tabs button').forEach(b => {
      const nav = tab === 'adv' ? 'home' : tab === 'solve' ? 'base' : tab;
      if (b.dataset.tab === nav) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    window.Sim.active = tab === 'solve';
    RENDER[tab]();
    $('main').scrollTop = 0;
  };
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { Snd.click(); G.show(b.dataset.tab); } });

  // ---------- Görevler ----------
  function openQuests() {
    const qs = G.ensureQuests();
    const rows = qs.list.map((q, i) => {
      const { def, progress, done } = G.questInfo(q);
      const pct = progress / def.target * 100;
      return `<div class="quest${q.claimed ? ' claimed' : ''}">
        <div class="q-main"><b>${esc(def.text)}</b><div class="qbar"><i style="width:${pct}%"></i></div><small>${progress}/${def.target}</small></div>
        <button class="btn btn-small ${done && !q.claimed ? 'btn-yellow' : ''}" data-q="${i}" ${done && !q.claimed ? '' : 'disabled'}>${q.claimed ? 'Alındı' : `+${def.reward}`}</button>
      </div>`;
    }).join('');
    const allClaimed = qs.list.every(q => q.claimed);
    const body = G.modal('Günlük görevler', `
      <div class="quests">${rows}</div>
      <div class="quest bonus${qs.bonus ? ' claimed' : ''}">
        <div class="q-main"><b>Hepsini tamamla</b><small>Ödül: bedava Usta Paketi</small></div>
        <button class="btn btn-small ${allClaimed && !qs.bonus ? 'btn-pink' : ''}" data-q="bonus" ${allClaimed && !qs.bonus ? '' : 'disabled'}>${qs.bonus ? 'Alındı' : 'Paket'}</button>
      </div>
      <p class="note">Görevler her gece yenilenir.</p>`, [{ label: 'Kapat' }], { replace: true });
    if (!body) return;
    body.querySelectorAll('[data-q]').forEach(b => (b.onclick = () => {
      const k = b.dataset.q;
      if (k === 'bonus') { qs.bonus = true; G.S.packs.usta++; G.toast('Usta Paketi Mağaza’da seni bekliyor!'); }
      else {
        const q = qs.list[+k], info = G.questInfo(q);
        if (!info.done || q.claimed) return;
        q.claimed = true; G.addCoins(info.def.reward); G.addXP(25);
      }
      G.save(); openQuests();
    }));
  }
  $('quest-btn').onclick = () => { Snd.click(); openQuests(); };

  // ---------- Profil ----------
  function openProfile() {
    const S = G.S;
    const need = G.xpNeed(S.level);
    const st = [
      ['Galibiyet', S.stats.wins], ['Yenilgi', S.stats.losses], ['Kupa', S.trophies],
      ['Yıldız', `${G.totalStars()}/${G.allStages.length * 3}`], ['Kule', S.stats.towerBest || 0], ['Paket', S.stats.packs],
      ['Çözüm', S.stats.solves], ['En uzun seri', S.bestStreak || 0], ['En iyi kombo', S.stats.maxCombo || 0], ['Giriş serisi', `${S.login.streak}. gün`], ['Koleksiyon', `${G.statValue('collection')}/${G.baseCubeCount()}`], ['3×3 rekor', S.best[3] ? window.Sim.fmt(S.best[3]) : '-'],
    ];
    const doneAch = D.ACHIEVEMENTS.filter(a => S.ach[a.id]).length;
    const ach = D.ACHIEVEMENTS.map(a => {
      const ok = S.ach[a.id], p = G.achProgress(a);
      return `<li class="${ok ? 'ok' : ''}"><span class="a-ico">${ok ? '★' : '☆'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}${ok ? '' : ` · ${p}/${a.target}`}</small></div><span class="a-rw">+${a.reward}</span></li>`;
    }).join('');
    const body = G.modal('Profil', `
      ${G.profileCardHTML()}
      <div class="lvl-big"><span>Seviye ${S.level}</span><div class="qbar"><i style="width:${S.xp / need * 100}%"></i></div><small>${S.xp}/${need} XP · her 5 seviyede bedava Usta Paketi</small></div>
      <div class="pstats">${st.map(([k, v]) => `<div><span class="label">${k}</span><b>${v}</b></div>`).join('')}</div>
      <div class="sec-head"><h3>Son savaşlar</h3></div>
      ${G.replayListHTML()}
      <div class="sec-head"><h3>Başarımlar</h3><span class="note">${doneAch}/${D.ACHIEVEMENTS.length}</span></div>
      <ul class="ach">${ach}</ul>
      ${G.auth.enabled ? `<h3>RA ID hesabı</h3>
      <div class="account">${G.auth.user
        ? `<span>Giriş yapıldı: <b>${esc(G.auth.user.email || G.auth.user.displayName || 'RA ID')}</b><br><small>İlerlemen buluta kaydediliyor.</small></span>
           <div class="settings"><button class="btn btn-small" id="ra-out">Çıkış yap</button><button class="btn btn-small danger" id="ra-del">Küp Arena kaydımı sil</button></div>
           <small>RA ID hesabını tamamen silmek için: <a href="${G.auth.deleteUrl}" target="_blank" rel="noopener">rubikacademy.fun/ayarlar</a> → Hesabımı sil</small>`
        : `<span>Giriş yapmadın. ${G.auth.trialLeft() ? `${G.auth.trialLeft()} deneme maçın kaldı.` : 'Deneme maçların bitti.'}</span>
           <button class="btn btn-yellow" id="ra-in">RA ID ile giriş yap</button>`}</div>` : ''}
      <h3>Ayarlar</h3>
      <div class="settings">
        <button class="btn btn-small" id="set-sound">Ses: ${S.settings.sound ? 'Açık' : 'Kapalı'}</button>
        <button class="btn btn-small" id="set-power">Güç çubuğu: ${S.settings.power !== false ? 'Açık' : 'Kapalı'}</button>
        <button class="btn btn-small" id="set-name">Adını değiştir</button>
        <button class="btn btn-small" id="set-backup">Kaydı yedekle / yükle</button>
        <button class="btn btn-small" id="set-intro">Nasıl oynanır?</button>
        <button class="btn btn-small danger" id="set-reset">Oyunu sıfırla</button>
      </div>
      <p class="note">Küp Arena v3.3 · Oyundaki küp markaları (TOPAÇ, KAIRO, HAYATE, TORVA, ZENKO, VEXA) kurgusaldır; gerçek markalarla ilgisi yoktur.</p>`, [{ label: 'Kapat' }], { replace: true, wide: true });
    if (!body) return;
    G.bindProfileCard(body, openProfile);
    G.bindReplayList(body);
    if (G.auth.enabled) {
      if ($('ra-in')) $('ra-in').onclick = () => G.auth.openLogin('profile');
      if ($('ra-out')) $('ra-out').onclick = () => G.confirm('Çıkış yap?', 'Bu cihazdaki ilerleme kalır. Tekrar giriş yapınca buluttan devam edersin.', 'Çıkış yap', G.auth.signOut);
      if ($('ra-del')) $('ra-del').onclick = () => G.confirm('Küp Arena kaydın silinsin mi?', 'Buluttaki Küp Arena ilerlemen kalıcı olarak silinir. RA ID hesabın ve Rubik Academy verilerin durur.', 'Kalıcı olarak sil', G.auth.deleteGameData);
    }
    $('set-power').onclick = () => { S.settings.power = S.settings.power === false; G.save(); openProfile(); };
    $('set-sound').onclick = () => { S.settings.sound = !S.settings.sound; Snd.setEnabled(S.settings.sound); G.save(); openProfile(); };
    $('set-name').onclick = rename;
    $('set-backup').onclick = backup;
    $('set-intro').onclick = () => { G.closeModal(); G.startTour(false); };
    $('set-reset').onclick = () => G.confirm('Oyunu sıfırla?', 'Tüm ilerlemen silinir. Bu geri alınamaz.', 'Sıfırla', G.resetSave);
  }
  $('lvl-btn').onclick = () => { Snd.click(); openProfile(); };

  function rename() {
    const body = G.modal('Adını değiştir', `<input class="field" id="name-input" maxlength="16" value="${esc(G.S.name)}" aria-label="Oyuncu adı">`, [
      { label: 'Vazgeç' },
      { label: 'Kaydet', cls: 'btn-yellow', onClick: () => {
        const v = ($('name-input').value || '').trim().slice(0, 16);
        if (v) { G.S.name = v; G.save(); if (G.current === 'arena') G.renderArena(); }
      } },
    ], { replace: true });
    if (body) { const i = body.querySelector('input'); i.focus(); i.select(); }
  }
  function backup() {
    const code = G.exportSave();
    const body = G.modal('Kayıt yedeği', `
      <p class="note">Bu kodu bir yere kaydet. Başka cihazda “Yükle” ile ilerlemeni geri getirebilirsin.</p>
      <textarea class="field code" id="bk-out" readonly rows="3">${code}</textarea>
      <button class="btn btn-small" id="bk-copy">Kodu kopyala</button>
      <textarea class="field code" id="bk-in" rows="3" placeholder="Yedek kodunu buraya yapıştır"></textarea>`,
      [{ label: 'Kapat' }, { label: 'Yükle', cls: 'btn-pink', keep: true, onClick: () => {
        const v = $('bk-in').value;
        if (!v.trim()) return G.toast('Önce bir kod yapıştır');
        if (G.importSave(v)) { G.closeModal(); G.toast('Kayıt yüklendi!'); G.show('home'); }
        else G.toast('Kod geçersiz');
      } }], { replace: true });
    if (!body) return;
    $('bk-copy').onclick = () => {
      const ta = $('bk-out');
      const sel = () => { ta.focus(); ta.select(); };
      try { navigator.clipboard.writeText(code).then(() => G.toast('Kopyalandı'), () => { sel(); G.toast('Seçildi, kopyala'); }); }
      catch (e) { sel(); G.toast('Seçildi, kopyala'); }
    };
  }

  // ---------- İlk açılış ----------
  function intro(first) {
    G.modal(first ? 'Küp Arena’ya hoş geldin!' : 'Nasıl oynanır?', `
      <ul class="howto">
        <li><b>Macera:</b> 6 dünyayı geç, boss’ları yen, yıldız topla. Her boss sana nadir bir bulmaca verir.</li>
        <li><b>Mağaza:</b> Paket aç, yeni bulmacalar bul. Her 3 saatte bedava paket, her gün Şans Çarkı!</li>
        <li><b>Envanter:</b> En iyi 3 bulmacanı takıma koy, jetonla güçlendir.</li>
        <li><b>Savaş:</b> Saldır’a bas, ibre yeşilin ortasındayken dokun: <b>MÜKEMMEL</b> vuruş! Küp &gt; Piramit &gt; Özel &gt; Küp.</li>
        <li><b>Küp kutuları:</b> Her galibiyette bir küp kutusu kazanırsın. Açılınca içinden küpler çıkar.</li>
        <li><b>Arena:</b> Kupa topla, ligini yükselt. Arkadaşınla aynı telefonda da oynayabilirsin.</li>
        <li><b>Çöz:</b> 3B küpü çöz, jeton kazan. Her gün yeni bir bulmaca var.</li>
        <li><b>Görevler</b> ve <b>başarımlar</b> sağ üstte. Oyuncu seviyen arttıkça ödül alırsın.</li>
      </ul>
      ${first ? '<p class="good">Başlangıç hediyesi: <b>Klasik Paket</b>! Hemen açalım.</p>' : ''}`,
      [{ label: first ? 'Paketi aç' : 'Tamam', cls: 'btn-yellow', onClick: () => {
        if (!first) return;
        G.S.seenIntro = true; G.save();
        G.openPack(D.PACKS[0]);
      } }], { replace: true });
  }

  // ---------- Android geri tuşu ----------
  function back() {
    if (!$('opener').hidden) { if (!$('open-actions').hidden) G.closeOpener(); return true; }
    if (!$('chest-open').hidden) { G.closeChest(); return true; }
    if (G.isModalOpen()) { G.closeModal(); return true; }
    if (G.inBattle()) { $('b-quit').click(); return true; }
    if (G.current !== 'home') { G.show('home'); return true; }
    return false;
  }
  try {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App) App.addListener('backButton', () => { if (!back()) App.exitApp(); });
  } catch (e) {}
  window.addEventListener('keydown', e => { if (e.key === 'Escape') back(); });

  // ---------- Başlat ----------
  G.ensureQuests();
  G.save();
  $('adv-back').onclick = () => { Snd.click(); G.show('home'); };
  $('solve-back').onclick = () => { Snd.click(); G.show('base'); };
  G.show('home');
  if (!G.S.seenIntro) G.startTour(true);
  else if (!(G.S.tut && G.S.tut.tour)) G.startTour(false); // eski oyunculara yeni eğitici bir kez gösterilir
  else G.checkLogin();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    G.ensureQuests(); G.renderHeader();
    if (G.S.seenIntro && !G.inBattle() && !G.isModalOpen() && !G.inTour()) G.checkLogin();
  });
})();
