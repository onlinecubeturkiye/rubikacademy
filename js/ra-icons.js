/* =========================================================
   RA İKONLARI (ra-icons.js)
   Rubik Academy'ye özel ikon seti. Sitedeki emojiler sayfa açılınca bu ikonlarla
   değiştirilir (tüm sayfalarda; common.js yükler):
   - rozetler: logodaki altıgen biçiminde, gradyan dolgulu (sahip, moderatör, kupa, madalya…)
   - çizgi ikonlar: yazı rengini alır (ev, ayar, saat, kitap…)
   - renk anlamı taşıyanlar (yeşil/sarı nokta, uyarı, onay) renkli kalır
   RAIcons.svg(ad) · RAIcons.paint(kök) · RAIcons.watch(kökler)
   Kullanıcı yazısı (.c-cx / .ra-noico), giriş kutuları, kod ve canvas'a dokunulmaz.
   Orijinal emoji görünmez metin olarak kalır (kopyalama / textContent bozulmaz).
========================================================= */
(function () {
    if (window.RAIcons) return;
    var HEX = "M12 1.6 21.2 6.8v10.4L12 22.4 2.8 17.2V6.8z";
    function badge(grad, inner) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" class="ra-hex"><path d="' + HEX + '" fill="url(#' + grad + ')" stroke="rgba(255,255,255,.55)" stroke-width="1" stroke-linejoin="round"/>' + inner + '</svg>';
    }
    function line(inner, fill) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="' + (fill ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
    }
    function dot(c) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="' + c + '"/><circle cx="9.5" cy="9.5" r="2.6" fill="#fff" opacity=".35"/></svg>'; }
    function medal(grad, n) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h4l2 6H9zM17 2h-4l-2 6h4z" fill="#6c5ce7" opacity=".85"/><path d="M12 7.5l6.1 3.5v7L12 21.5 5.9 18v-7z" fill="url(#' + grad + ')" stroke="rgba(255,255,255,.6)" stroke-width="1"/><text x="12" y="17.6" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="7.5" fill="#fff">' + n + '</text></svg>';
    }
    var W = '#fff';
    var CROWN = '<path d="M7 15.6h10l.9-6.4-3 2.3L12 7.4l-2.9 4.1-3-2.3z" fill="#fff"/><rect x="7" y="16.6" width="10" height="1.5" rx=".7" fill="#fff"/>';
    var SHIELD = '<path d="M12 6.4l4.6 1.8v3.4c0 2.9-1.9 5-4.6 6-2.7-1-4.6-3.1-4.6-6V8.2z" fill="#fff"/><path d="M10.2 12.1l1.3 1.3 2.4-2.6" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
    var CUBE = '<path d="M12 6.2l5 2.9-5 2.9-5-2.9z" fill="#fff"/><path d="M7 9.1l5 2.9v5.8l-5-2.9z" fill="#fff" opacity=".78"/><path d="M17 9.1l-5 2.9v5.8l5-2.9z" fill="#fff" opacity=".56"/>';
    var SH = "M12 3.5l7 2.7v5.2c0 4.4-2.9 7.5-7 9-4.1-1.5-7-4.6-7-9V6.2z";
    var I = {
        /* --- rozetler (altıgen) --- */
        owner: badge("raGOwn", CROWN),
        mod: badge("raGMod", SHIELD),
        ra: badge("raGBrand", CUBE),
        trophy: badge("raGOwn", '<path d="M9 7h6v3.4a3 3 0 0 1-6 0z" fill="#fff"/><path d="M9 8H7.4a1.8 1.8 0 0 0 1.9 2.4M15 8h1.6a1.8 1.8 0 0 1-1.9 2.4" fill="none" stroke="#fff" stroke-width="1.2"/><rect x="11.2" y="13" width="1.6" height="2.4" fill="#fff"/><rect x="9" y="15.6" width="6" height="1.6" rx=".8" fill="#fff"/>'),
        party: badge("raGParty", '<path d="M7.5 17.5l2.6-7.6 5 5z" fill="#fff"/><circle cx="15.5" cy="7.5" r="1" fill="#fff"/><circle cx="17.5" cy="11" r=".9" fill="#fff"/><path d="M12.5 8.5c.3-1.4 1.4-2 2.6-1.9M14.8 12.4c1-.6 2.2-.4 2.9.4" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>'),
        star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="url(#raGOwn)" stroke="rgba(255,255,255,.5)" stroke-width=".8" stroke-linejoin="round"/></svg>',
        gold: medal("raGOwn", 1), silver: medal("raGSilver", 2), bronze: medal("raGBronze", 3),
        medal: medal("raGOwn", "★"),
        /* --- renkli durum --- */
        dGreen: dot("#22c55e"), dYellow: dot("#facc15"), dRed: dot("#ef4444"), dWhite: dot("#e5e7eb"), sqYellow: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="#facc15"/></svg>',
        ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#22c55e"/><path d="M7.5 12.3l3 3 6-6.4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2L22 20H2z" fill="#f59e0b" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 9.5v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.2" fill="#fff"/></svg>',
        noEntry: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#ef4444"/><rect x="6.5" y="10.6" width="11" height="2.8" rx="1.2" fill="#fff"/></svg>',
        fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.6 3.2 4.1 5 5.4 8.4 1.6 4.3-1.3 9.6-5.4 9.6s-7-3.3-6-7.6c.5-2.3 2-3.4 2.8-5 .3 1.8 1 2.9 2.2 3.4C10.7 8.6 11 5.2 12 2.5z" fill="#f97316"/><path d="M12 12.2c1.6 1.6 3 3 2.6 5-.3 1.6-1.4 2.3-2.6 2.3s-2.6-.9-2.6-2.6c0-1.8 1.5-2.6 2.6-4.7z" fill="#fde047"/></svg>',
        bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2L4.5 13.5h6.5L9.5 22l10-12.5H13z" fill="#facc15" stroke="#eab308" stroke-width="1" stroke-linejoin="round"/></svg>',
        tri: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l9.5 16.5h-19z" fill="#ef4444" stroke="#ef4444" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 9l-3.6 6.3h7.2z" fill="#fff" opacity=".35"/></svg>',
        diamond: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l9 9.5-9 9.5-9-9.5z" fill="#3b82f6"/><path d="M12 2.5l9 9.5H3z" fill="#fff" opacity=".22"/></svg>',
        bug: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="7" width="10" height="13" rx="5" fill="#ef4444" stroke="#ef4444"/><path d="M12 9v11" stroke="#fff" stroke-width="1.4"/><path d="M9 4.5l1.5 2.2M15 4.5l-1.5 2.2M3.5 11H7M17 11h3.5M4 17l3-1.5M20 17l-3-1.5"/></svg>',
        /* --- çizgi ikonlar --- */
        cube: line('<path d="M12 2.8l8.5 4.9v8.6L12 21.2l-8.5-4.9V7.7z"/><path d="M3.8 7.8L12 12.6l8.2-4.8M12 12.6v8.4"/>'),
        moon: line('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/>'),
        sun: line('<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'),
        globe: line('<circle cx="12" cy="12" r="9.2"/><path d="M2.8 12h18.4M12 2.8c2.6 2.6 3.8 5.7 3.8 9.2s-1.2 6.6-3.8 9.2c-2.6-2.6-3.8-5.7-3.8-9.2S9.4 5.4 12 2.8z"/>'),
        timer: line('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6.5 20 5"/>'),
        printer: line('<path d="M7 9V3.5h10V9"/><rect x="3" y="9" width="18" height="8" rx="2.5"/><path d="M7 14h10v6.5H7z"/><path d="M17.5 12h.01"/>'),
        target: line('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'),
        palette: line('<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.4-1.3-1.8-1.3-3 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.3 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1.2" fill="currentColor"/><circle cx="10" cy="7.5" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>'),
        eye: line('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
        brain: line('<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3.2 3.2 0 0 0 7.5 18 2.6 2.6 0 0 0 12 19.3V5.8A2.7 2.7 0 0 0 9 4.5z"/><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3.2 3.2 0 0 1-3.5 5.3 2.6 2.6 0 0 1-4.5 1.3"/><path d="M8.5 10.5c1 .3 1.8 1 2 2M15.5 10.5c-1 .3-1.8 1-2 2"/>'),
        trash: line('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>'),
        pencil: line('<path d="M15.5 4.5l4 4L9 19l-5 1 1-5z"/><path d="M13.5 6.5l4 4"/>'),
        sliders: line('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
        gear: line('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/><circle cx="12" cy="12" r="6.6"/>'),
        book: line('<path d="M4 4.5h6a2 2 0 0 1 2 2V20a1.6 1.6 0 0 0-1.6-1.5H4z"/><path d="M20 4.5h-6a2 2 0 0 0-2 2V20a1.6 1.6 0 0 1 1.6-1.5H20z"/>'),
        books: line('<rect x="3.5" y="4" width="4.5" height="16" rx="1"/><rect x="9.5" y="6" width="4.5" height="14" rx="1"/><path d="M15.3 7.2l4.2-1.3 3 13.3-4.2 1.3z"/>'),
        plus: line('<path d="M12 5v14M5 12h14"/>'),
        map: line('<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>'),
        help: line('<circle cx="12" cy="12" r="9.2"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.8"/><circle cx="12" cy="17" r=".7" fill="currentColor"/>'),
        user: line('<circle cx="12" cy="8" r="3.8"/><path d="M5 20.5a7 7 0 0 1 14 0"/>'),
        users: line('<circle cx="9" cy="8.5" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M15.5 5.3a3.4 3.4 0 0 1 0 6.4M17.5 14.2a6.2 6.2 0 0 1 3.7 5.8"/>'),
        camera: line('<path d="M3 8.5a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.8"/>'),
        compass: line('<circle cx="12" cy="12" r="9.2"/><path d="M15.8 8.2l-2 5.6-5.6 2 2-5.6z"/>'),
        letters: line('<path d="M3 18l4.5-12L12 18M4.7 13.5h5.6"/><path d="M14.5 11.2a3 3 0 0 1 5.5 1.3V18M20 15.2c-1.5-.7-5.5-.8-5.5 1.3 0 1.9 4.2 1.9 5.5-.3"/>'),
        home: line('<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h4.8v-5.5h3.4V20h4.8V9.5"/>'),
        install: line('<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M12 7v7M9 11.2l3 3 3-3M10.5 18.5h3"/>'),
        phone: line('<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M10.5 18.5h3"/>'),
        link: line('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
        chart: line('<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6.5" rx=".8"/><rect x="10.5" y="6.5" width="3" height="11" rx=".8"/><rect x="15.5" y="13" width="3" height="4.5" rx=".8"/>'),
        trend: line('<path d="M3.5 17.5l5.5-5.5 4 4 7.5-8"/><path d="M15.5 8h5v5"/>'),
        keyboard: line('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8"/>'),
        hourglass: line('<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>'),
        save: line('<path d="M5 3.5h11.5L20.5 7.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M8 3.5v5h7v-5M7.5 20.5v-6h9v6"/>'),
        calendar: line('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>'),
        bulb: line('<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
        lock: line('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
        key: line('<circle cx="8" cy="15" r="4.5"/><path d="M11.3 11.7L20 3M16.5 6.5l2.5 2.5M14 9l2 2"/>'),
        shuffle: line('<path d="M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.8 0 3-1.5 4.2-3.5M13.3 10.5C14.5 8.5 15.8 7 17.5 7H21"/><path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5"/>'),
        flag: line('<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>'),
        share: line('<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>'),
        download: line('<path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
        video: line('<rect x="2.5" y="6" width="13.5" height="12" rx="2.5"/><path d="M16 10.5l5.5-3.2v9.4L16 13.5"/>'),
        clapper: line('<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9l1.5-5 16.5 2.8L21 9M8.5 4.8l2 4.2M14 5.7l2 3.3"/>'),
        mail: line('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6.2L20.5 7"/>'),
        dice: line('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
        cart: line('<path d="M2.5 3.5h3l2.4 11.5h10.6l2-8H6.6"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>'),
        doc: line('<path d="M6 2.5h8l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5z"/><path d="M14 2.5v5h5M8.5 13h7M8.5 16.5h5"/>'),
        note: line('<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
        clipboard: line('<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><rect x="9" y="2.5" width="6" height="4" rx="1.2"/><path d="M8.5 11.5h7M8.5 15h5"/>'),
        search: line('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'),
        clock: line('<circle cx="12" cy="12" r="9.2"/><path d="M12 7v5l3.2 2"/>'),
        alarm: line('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M4 5.5l3-2.5M20 5.5l-3-2.5"/>'),
        refresh: line('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
        repeat: line('<path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3"/>'),
        magnet: line('<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z"/><path d="M6 8h4M14 8h4"/>'),
        chat: line('<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8.5 10.5h7"/>'),
        folder: line('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>'),
        exit: line('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 16l-4-4 4-4M5 12h10"/>'),
        bell: line('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
        play: line('<path d="M8 5.5v13l10.5-6.5z"/>', true),
        stop: line('<rect x="6" y="6" width="12" height="12" rx="2.5"/>', true),
        tools: line('<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2z"/><path d="M4 4l4.5 4.5M3 7l2.5 2.5"/>'),
        cap: line('<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2v-4.5M21.5 9.5v5"/>'),
        ticket: line('<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z" transform="translate(0 -1)"/><path d="M14 6v12" stroke-dasharray="2 2.4"/>'),
        thumb: line('<path d="M7.5 10.5V20H4.5V10.5z"/><path d="M7.5 10.5l3.5-7c1.6 0 2.6 1.2 2.3 2.8L12.8 9.5H19a1.8 1.8 0 0 1 1.8 2.2l-1.5 6.8A2 2 0 0 1 17.3 20H7.5"/>'),
        megaphone: line('<path d="M3.5 10v4h3l9 5V5l-9 5z"/><path d="M6.5 14l1.5 5.5h2.5L9.5 15M19 9.5a3.5 3.5 0 0 1 0 5"/>'),
        gamepad: line('<rect x="2.5" y="7" width="19" height="10.5" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11" r=".9" fill="currentColor"/><circle cx="17.5" cy="13.6" r=".9" fill="currentColor"/>'),
        music: line('<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
        laptop: line('<rect x="4" y="4.5" width="16" height="11" rx="1.8"/><path d="M2 19.5h20"/>'),
        monitor: line('<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>'),
        build: line('<rect x="3" y="7" width="18" height="7" rx="1.5"/><path d="M6.5 7l-3.5 7M12 7l-3.5 7M17.5 7L14 14M5 14v6M19 14v6"/>'),
        hand: line('<path d="M8 12.5V5.5a1.5 1.5 0 0 1 3 0v5.5M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.2 7-2.6 0-4.1-1.3-5.6-3.4L3.4 14.2a1.5 1.5 0 0 1 2.4-1.8L8 15"/>'),
        ruler: line('<path d="M3.5 15.5L15.5 3.5l5 5-12 12z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>'),
        signal: line('<path d="M4 20v-3M9 20v-7M14 20V9M19 20V4"/>'),
        battery: line('<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3"/><rect x="5" y="9.5" width="9" height="5" rx="1" fill="currentColor" stroke="none"/>'),
        image: line('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5.5-5.5L5 20"/>'),
        broom: line('<path d="M20 3.5l-8 8"/><path d="M12.5 10.5l2 2c-.4 3.6-2.8 6.6-7 8-1.6-1.4-3-3-4-5 1.6-3.8 4.6-5.6 9-5z"/><path d="M7.5 15.5l2.5 2.5"/>'),
        offline: line('<path d="M3 3l18 18"/><path d="M8.6 16.4a4.8 4.8 0 0 1 6.2-.5M5 12.8a10 10 0 0 1 4.6-2.5M19 12.8a10 10 0 0 0-2.4-1.7M2 9.2a14.5 14.5 0 0 1 4.4-2.7M22 9.2A14.5 14.5 0 0 0 12 5.5"/><circle cx="12" cy="19.6" r=".6" fill="currentColor"/>'),
        smile: line('<circle cx="12" cy="12" r="9.2"/><path d="M8.3 14.2a4.5 4.5 0 0 0 7.4 0"/><circle cx="9" cy="9.8" r=".9" fill="currentColor"/><circle cx="15" cy="9.8" r=".9" fill="currentColor"/>'),
        handshake: line('<path d="M2.5 11l4-4 4 1.5 3-1.5 4 1 4 3"/><path d="M6.5 7l-2 6.5 5 5c.8.8 2 .8 2.6 0M10 10.5l3 3c.8.8 2 .8 2.6 0l3.4-3.5"/><path d="M12.5 16l1.5 1.5M10.5 17.5l1.3 1.3"/>'),
        /* --- yazı işaretleri (ok, tik, çarpı…) --- */
        check: line('<path d="M4.5 12.5l5 5L19.5 7"/>'),
        close: line('<path d="M6 6l12 12M18 6L6 18"/>'),
        arrowL: line('<path d="M19.5 12H5M11 6l-6 6 6 6"/>'),
        arrowR: line('<path d="M4.5 12H19M13 6l6 6-6 6"/>'),
        swap: line('<path d="M3.5 12h17M8 7.5L3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5"/>'),
        cross: line('<path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z"/>'),
        undo: line('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
        reset: line('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>'),
        mega: line('<path d="M12 2.8l9 6.5-3.4 10.6H6.4L3 9.3z"/><path d="M12 7.2l4.8 3.5-1.8 5.6H9l-1.8-5.6z"/><path d="M12 2.8v4.4M21 9.3l-4.2 1.4M17.6 19.9l-2.6-3.6M6.4 19.9L9 16.3M3 9.3l4.2 1.4"/>'),
        sq1: line('<path d="M4 4h16v16H4z"/><path d="M4 12h16M12 4l-3 8 3 8M12 4l3 8-3 8"/>'),
        chevD: line('<path d="M6 9.5l6 6 6-6"/>'),
        chevU: line('<path d="M6 14.5l6-6 6 6"/>'),
        ext: line('<path d="M14 4.5h5.5V10M19.5 4.5L11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'),
        insta: line('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".9" fill="currentColor"/>'),
        modAdd: line('<path d="' + SH + '"/><path d="M12 9v6M9 12h6"/>'),
        modDel: line('<path d="' + SH + '"/><path d="M9 12h6"/>'),
        transfer: line('<path d="M4 14h11l1-7-3.5 2.6L9.5 5 6.6 9.6 3 7z" transform="translate(1 -1)"/><path d="M14 19h7M18.5 16.5 21 19l-2.5 2.5"/>'),
        kick: line('<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 8.5l4.5 4.5M21.5 8.5 17 13"/>')
    };
    // emoji → ikon (tek sözcüklük ok, tik, çarpı gibi yazı işaretleri olduğu gibi kalır)
    var MAP = {
        "👑": "owner", "🛡": "mod", "🧊": "ra", "🏆": "trophy", "🎉": "party", "⭐": "star", "🥇": "gold", "🥈": "silver", "🥉": "bronze", "🏅": "medal",
        "🟢": "dGreen", "🟡": "dYellow", "🔴": "dRed", "⚪": "dWhite", "🟨": "sqYellow", "✅": "ok", "⚠": "warn", "⛔": "noEntry", "🔥": "fire", "⚡": "bolt",
        "🔺": "tri", "🔷": "diamond", "🐞": "bug",
        "🧩": "cube", "🌙": "moon", "☀": "sun", "🌐": "globe", "⏱": "timer", "🖨": "printer", "🎯": "target", "🎨": "palette", "👁": "eye",
        "🧠": "brain", "🗑": "trash", "✏": "pencil", "⚙": "sliders", "📘": "book", "📚": "books", "➕": "plus", "🗺": "map", "❓": "help",
        "👤": "user", "👥": "users", "📷": "camera", "📸": "camera", "🧭": "compass", "🔤": "letters", "🏠": "home", "📲": "install", "📱": "phone",
        "🔗": "link", "📊": "chart", "📈": "trend", "⌨": "keyboard", "⏳": "hourglass", "💾": "save", "📅": "calendar", "💡": "bulb", "🔒": "lock",
        "🔑": "key", "🔀": "shuffle", "🏁": "flag", "📤": "share", "⬇": "download", "🎥": "video", "🎬": "clapper", "📧": "mail", "✉": "mail",
        "🎲": "dice", "🛒": "cart", "📄": "doc", "📜": "doc", "📝": "note", "📋": "clipboard", "🔍": "search", "🕐": "clock", "🕘": "clock",
        "⏰": "alarm", "🔄": "refresh", "🔁": "repeat", "🧲": "magnet", "💬": "chat", "📂": "folder", "🚪": "exit", "🔔": "bell", "▶": "play",
        "⏹": "stop", "🛠": "tools", "🎓": "cap", "🎟": "ticket", "👍": "thumb", "📢": "megaphone", "🕹": "gamepad", "💻": "laptop", "🖥": "monitor",
        "🚧": "build", "👋": "hand", "📏": "ruler", "📶": "signal", "🔋": "battery", "🖼": "image", "🧹": "broom", "📴": "offline", "🙂": "smile", "🤝": "handshake",
        "✓": "check", "✔": "check", "✕": "close", "✗": "close", "✖": "close", "←": "arrowL", "→": "arrowR", "↔": "swap", "✚": "cross", "↻": "refresh",
        "↩": "undo", "↶": "undo", "↺": "reset", "⬟": "mega", "◼": "sq1", "★": "star", "▾": "chevD", "▼": "chevD", "▴": "chevU", "▲": "chevU",
        "✎": "pencil", "↗": "ext", "◎": "insta", "♪": "music"
    };
    var RE = new RegExp("(" + Object.keys(MAP).join("|") + ")\\uFE0F?", "g");
    function svg(n) { return I[n] || ""; }
    function el(n, raw) {
        var s = document.createElement("span"); s.className = "ra-i ra-i-" + n; s.innerHTML = svg(n);
        var t = document.createElement("span"); t.className = "ra-t"; t.textContent = raw; s.appendChild(t); // görünmez: kopyalama ve textContent için
        return s;
    }
    var SKIP = ",INPUT,TEXTAREA,SELECT,OPTION,SCRIPT,STYLE,CANVAS,svg,CODE,PRE,TITLE,NOSCRIPT,";
    function skip(node) {
        for (var p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) {
            if (SKIP.indexOf("," + p.nodeName + ",") >= 0) return true;
            if (p.classList && (p.classList.contains("c-cx") || p.classList.contains("ra-i") || p.classList.contains("ra-noico"))) return true;
            if (p.isContentEditable) return true;
        }
        return false;
    }
    // <option> içine ikon konamaz: emoji kaldırılır, yazı kalır
    function cleanSelect(sel) {
        Array.prototype.forEach.call(sel.options || [], function (o) {
            RE.lastIndex = 0; if (!RE.test(o.text)) return;
            RE.lastIndex = 0; var t = o.text.replace(RE, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ");
            if (t) o.text = t;
        });
    }
    function paint(root) {
        if (!root || root.nodeType !== 1 || !document.createTreeWalker) return;
        if (root.nodeName === "SELECT") { cleanSelect(root); return; }
        if (root.nodeName === "OPTION" || root.nodeName === "OPTGROUP") { var ps = root.closest && root.closest("select"); if (ps) cleanSelect(ps); return; }
        if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll("select"), cleanSelect);
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
        while ((n = w.nextNode())) { RE.lastIndex = 0; if (RE.test(n.nodeValue) && !skip(n)) list.push(n); }
        list.forEach(function (t) {
            var s = t.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
            RE.lastIndex = 0;
            while ((m = RE.exec(s))) {
                if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
                frag.appendChild(el(MAP[m[1]], m[0]));
                last = m.index + m[0].length;
            }
            var rest = s.slice(last);
            if (rest.trim()) frag.appendChild(document.createTextNode(rest.replace(/^ /, "")));
            else if (!t.nextSibling && frag.lastChild && frag.lastChild.classList) frag.lastChild.classList.add("ra-end"); // yalnız ikon: sağ boşluk yok
            if (t.parentNode) t.parentNode.replaceChild(frag, t);
        });
    }
    var watched = [];
    function watch(roots) {
        roots = roots.filter(function (r) { return r && watched.indexOf(r) < 0 && !watched.some(function (w) { return w.contains(r); }); });
        if (!roots.length) return;
        watched = watched.concat(roots);
        roots.forEach(paint);
        if (!window.MutationObserver) return;
        var pend = [], q = false;
        var mo = new MutationObserver(function (ms) {
            ms.forEach(function (m) {
                if (m.type === "characterData") { pend.push(m.target.parentNode); return; }
                Array.prototype.forEach.call(m.addedNodes, function (n) { pend.push(n.nodeType === 3 ? n.parentNode : n); });
            });
            if (q) return; q = true;
            (window.requestAnimationFrame || setTimeout)(function () {
                q = false; var list = pend; pend = [];
                mo.disconnect();
                list.forEach(function (n) { if (n && n.isConnected) paint(n); });
                roots.forEach(obs);
            });
        });
        function obs(r) { mo.observe(r, { childList: true, subtree: true, characterData: true }); }
        roots.forEach(obs);
    }

    var css = document.createElement("style");
    css.textContent =
        ".ra-i{position:relative;display:inline-flex;width:1.15em;height:1.15em;vertical-align:-.2em;margin-inline-end:.35em;flex:none}" +
        ".ra-i.ra-end{margin-inline-end:0}" +
        ".ra-i svg{width:100%;height:100%;display:block}" +
        ".ra-t{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;opacity:0}" +
        ".ra-i-owner,.ra-i-mod,.ra-i-ra,.ra-i-trophy,.ra-i-party,.ra-i-gold,.ra-i-silver,.ra-i-bronze,.ra-i-medal{width:1.3em;height:1.3em;vertical-align:-.28em;filter:drop-shadow(0 1px 2px rgba(0,0,0,.22))}" +
        ".ra-i-arrowL,.ra-i-arrowR,.ra-i-check,.ra-i-close,.ra-i-chevD,.ra-i-chevU,.ra-i-ext{width:1em;height:1em;vertical-align:-.14em}" +
        ".ra-i-dGreen,.ra-i-dYellow,.ra-i-dRed,.ra-i-dWhite{width:.95em;height:.95em;vertical-align:-.1em}" +
        "@media print{.ra-i svg{filter:none}}";
    (document.head || document.documentElement).appendChild(css);
    function defs() {
        if (document.getElementById("raIconDefs")) return;
        var d = document.createElement("div");
        var g = function (id, a, b) { return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>'; };
        d.innerHTML = '<svg id="raIconDefs" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true" focusable="false"><defs>' +
            g("raGOwn", "#fbbf24", "#f97316") + g("raGMod", "#8b5cf6", "#3b82f6") + g("raGBrand", "#6c5ce7", "#22c55e") +
            g("raGParty", "#ec4899", "#8b5cf6") + g("raGSilver", "#e5e7eb", "#94a3b8") + g("raGBronze", "#f59e0b", "#b45309") +
            '</defs></svg>';
        document.body.appendChild(d.firstChild);
    }
    function boot() { defs(); if (!document.documentElement.hasAttribute("data-no-raicons")) watch([document.body]); }
    if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
    window.RAIcons = { svg: svg, paint: paint, watch: watch };
})();
