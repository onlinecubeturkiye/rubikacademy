/* =========================================================
   RA İKONLARI (ra-icons.js)
   Rubik Academy'ye özel ikon seti: logodaki altıgen biçiminde rozetler
   (oda sahibi, moderatör, RA) ve sade çizgi ikonlar.
   - RAIcons.svg(ad): ikonun SVG metni
   - RAIcons.paint(kök): kökteki emojileri RA ikonlarıyla değiştirir
   - RAIcons.watch(kökler): sonradan eklenen içerikte de değiştirir
   Kullanıcı yazısı (.c-cx), giriş kutuları ve canvas'a dokunulmaz.
========================================================= */
(function () {
    var HEX = "M12 1.6 21.2 6.8v10.4L12 22.4 2.8 17.2V6.8z";
    // altıgen rozet: gradyan dolgu + beyaz sembol
    function badge(grad, inner) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" class="ra-hex"><path d="' + HEX + '" fill="url(#' + grad + ')" stroke="rgba(255,255,255,.55)" stroke-width="1" stroke-linejoin="round"/>' + inner + '</svg>';
    }
    function line(inner, fill) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="' + (fill ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
    }
    var CROWN = '<path d="M7 15.6h10l.9-6.4-3 2.3L12 7.4l-2.9 4.1-3-2.3z" fill="#fff"/><rect x="7" y="16.6" width="10" height="1.5" rx=".7" fill="#fff"/>';
    var SHIELD = '<path d="M12 6.4l4.6 1.8v3.4c0 2.9-1.9 5-4.6 6-2.7-1-4.6-3.1-4.6-6V8.2z" fill="#fff"/><path d="M10.2 12.1l1.3 1.3 2.4-2.6" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
    // RA küp: logodaki gibi üç yüzlü küp
    var CUBE = '<path d="M12 6.2l5 2.9-5 2.9-5-2.9z" fill="#fff"/><path d="M7 9.1l5 2.9v5.8l-5-2.9z" fill="#fff" opacity=".78"/><path d="M17 9.1l-5 2.9v5.8l5-2.9z" fill="#fff" opacity=".56"/>';
    var SH = "M12 3.5l7 2.7v5.2c0 4.4-2.9 7.5-7 9-4.1-1.5-7-4.6-7-9V6.2z";
    var I = {
        owner: badge("raGOwn", CROWN),
        mod: badge("raGMod", SHIELD),
        ra: badge("raGBrand", CUBE),
        trophy: badge("raGOwn", '<path d="M9 7h6v3.4a3 3 0 0 1-6 0z" fill="#fff"/><path d="M9 8H7.4a1.8 1.8 0 0 0 1.9 2.4M15 8h1.6a1.8 1.8 0 0 1-1.9 2.4" fill="none" stroke="#fff" stroke-width="1.2"/><rect x="11.2" y="13" width="1.6" height="2.4" fill="#fff"/><rect x="9" y="15.6" width="6" height="1.6" rx=".8" fill="#fff"/>'),
        modAdd: line('<path d="' + SH + '"/><path d="M12 9v6M9 12h6"/>'),
        modDel: line('<path d="' + SH + '"/><path d="M9 12h6"/>'),
        transfer: line('<path d="M4 14h11l1-7-3.5 2.6L9.5 5 6.6 9.6 3 7z" transform="translate(1 -1)"/><path d="M14 19h7M18.5 16.5 21 19l-2.5 2.5"/>'),
        kick: line('<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 8.5l4.5 4.5M21.5 8.5 17 13"/>'),
        offline: line('<path d="M3 3l18 18"/><path d="M8.6 16.4a4.8 4.8 0 0 1 6.2-.5M5 12.8a10 10 0 0 1 4.6-2.5M19 12.8a10 10 0 0 0-2.4-1.7M2 9.2a14.5 14.5 0 0 1 4.4-2.7M22 9.2A14.5 14.5 0 0 0 12 5.5"/><circle cx="12" cy="19.6" r=".6" fill="currentColor"/>'),
        eye: line('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
        refresh: line('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
        link: line('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
        exit: line('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 16l-4-4 4-4M5 12h10"/>'),
        play: line('<path d="M8 5.5v13l10.5-6.5z"/>', true),
        stop: line('<rect x="6" y="6" width="12" height="12" rx="2.5"/>', true),
        flag: line('<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>'),
        trash: line('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>'),
        chat: line('<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8.5 10.5h7"/>'),
        sliders: line('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
        magnet: line('<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z"/><path d="M6 8h4M14 8h4"/>'),
        keyboard: line('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8"/>'),
        timer: line('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6.5 20 5"/>'),
        hourglass: line('<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>'),
        lock: line('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
        plus: line('<path d="M12 5v14M5 12h14"/>'),
        ticket: line('<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z" transform="translate(0 -1)"/><path d="M14 6v12" stroke-dasharray="2 2.4"/>'),
        repeat: line('<path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3"/>'),
        user: line('<circle cx="12" cy="8" r="3.8"/><path d="M5 20.5a7 7 0 0 1 14 0"/>')
    };
    // emoji → ikon
    var MAP = {
        "👑": "owner", "🛡": "mod", "🧊": "ra", "🏆": "trophy", "👁": "eye", "🔄": "refresh", "🔗": "link",
        "▶": "play", "⏹": "stop", "🏁": "flag", "🗑": "trash", "💬": "chat", "⚙": "sliders", "🧲": "magnet",
        "⌨": "keyboard", "⏱": "timer", "📴": "offline", "⏳": "hourglass", "🔒": "lock", "➕": "plus",
        "🎟": "ticket", "🔁": "repeat", "👤": "user", "🚪": "exit"
    };
    var RE = new RegExp("(" + Object.keys(MAP).join("|") + ")\\uFE0F?", "g");
    function svg(n) { return I[n] || ""; }
    function el(n) { var s = document.createElement("span"); s.className = "ra-i ra-i-" + n; s.innerHTML = svg(n); return s; }
    var SKIP = "INPUT,TEXTAREA,SELECT,OPTION,SCRIPT,STYLE,CANVAS,svg,CODE";
    function skip(node) {
        for (var p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) {
            if (("," + SKIP + ",").indexOf("," + p.nodeName + ",") >= 0) return true;
            if (p.classList && (p.classList.contains("c-cx") || p.classList.contains("ra-i") || p.classList.contains("ra-noico"))) return true;
        }
        return false;
    }
    function paint(root) {
        if (!root) return;
        if (root.nodeType !== 1) return;
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
        while ((n = w.nextNode())) { RE.lastIndex = 0; if (RE.test(n.nodeValue) && !skip(n)) list.push(n); }
        list.forEach(function (t) {
            var s = t.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
            RE.lastIndex = 0;
            while ((m = RE.exec(s))) {
                if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
                frag.appendChild(el(MAP[m[1]]));
                last = m.index + m[0].length;
            }
            // ikonla yazı arasındaki boşluk CSS boşluğuyla verilir
            var rest = s.slice(last); if (rest) frag.appendChild(document.createTextNode(rest.replace(/^ /, "")));
            if (t.parentNode) t.parentNode.replaceChild(frag, t);
        });
    }
    function watch(roots) {
        roots = roots.filter(Boolean);
        roots.forEach(paint);
        if (!window.MutationObserver) return;
        var pend = [], q = false;
        var mo = new MutationObserver(function (ms) {
            ms.forEach(function (m) {
                if (m.type === "characterData") { pend.push(m.target.parentNode); return; }
                Array.prototype.forEach.call(m.addedNodes, function (n) { pend.push(n.nodeType === 3 ? n.parentNode : n); });
            });
            if (q) return; q = true;
            // aynı karede yapılan değişiklikleri tek seferde işle (yalnız değişen kısımlar taranır)
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
        ".ra-i{display:inline-flex;width:1.15em;height:1.15em;vertical-align:-.2em;margin-inline-end:.35em;flex:none}" +
        ".ra-i:last-child{margin-inline-end:0}" +
        ".ra-i svg{width:100%;height:100%;display:block}" +
        ".ra-i-owner,.ra-i-mod,.ra-i-ra,.ra-i-trophy{width:1.3em;height:1.3em;vertical-align:-.28em;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))}";
    (document.head || document.documentElement).appendChild(css);
    function defs() {
        if (document.getElementById("raIconDefs")) return;
        var d = document.createElement("div");
        d.innerHTML = '<svg id="raIconDefs" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true" focusable="false"><defs>' +
            '<linearGradient id="raGOwn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient>' +
            '<linearGradient id="raGMod" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>' +
            '<linearGradient id="raGBrand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#22c55e"/></linearGradient>' +
            '</defs></svg>';
        document.body.appendChild(d.firstChild);
    }
    if (document.body) defs(); else document.addEventListener("DOMContentLoaded", defs);
    window.RAIcons = { svg: svg, paint: paint, watch: watch };
})();
