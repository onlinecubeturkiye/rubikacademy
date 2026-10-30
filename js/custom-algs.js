/* =========================================================
   KENDİ ALGORİTMAN (custom-algs.js)
   Kullanıcı her case için kendi algoritmasını yazabilir.
   - Sadece bu tarayıcıda saklanır (localStorage, "custom-algs-v1")
   - Anahtar: PAGE_ID : set : case adı  (set yalnızca çok setli sayfalarda)
   - Algoritma sayfaları, antrenör ve yazdır sayfası aynı kaydı kullanır
========================================================= */
(function () {
    var KEY = "custom-algs-v1";

    var TXT = {
        tr: { btn: "Düzenle", edit: "Algoritmayı düzenle", mine: "Senin algoritman", orig: "Orijinal:", save: "Kaydet", reset: "Orijinale dön", cancel: "İptal", ph: "Kendi algoritmanı yaz (ör. R U R' U')", bad: "Geçersiz karakter var. Sadece hamle harfleri, ', 2, parantez ve boşluk kullan." },
        en: { btn: "Edit", edit: "Edit algorithm", mine: "Your algorithm", orig: "Original:", save: "Save", reset: "Back to original", cancel: "Cancel", ph: "Write your own algorithm (e.g. R U R' U')", bad: "Invalid characters. Use only move letters, ', 2, brackets and spaces." },
        fr: { btn: "Modifier", edit: "Modifier l'algorithme", mine: "Ton algorithme", orig: "Original :", save: "Enregistrer", reset: "Revenir à l'original", cancel: "Annuler", ph: "Écris ton algorithme (ex. R U R' U')", bad: "Caractères invalides. Utilise seulement les lettres de mouvement, ', 2, parenthèses et espaces." },
        ru: { btn: "Изменить", edit: "Изменить алгоритм", mine: "Твой алгоритм", orig: "Исходный:", save: "Сохранить", reset: "Вернуть исходный", cancel: "Отмена", ph: "Напиши свой алгоритм (напр. R U R' U')", bad: "Недопустимые символы. Используй только буквы ходов, ', 2, скобки и пробелы." },
        de: { btn: "Bearbeiten", edit: "Algorithmus bearbeiten", mine: "Dein Algorithmus", orig: "Original:", save: "Speichern", reset: "Zum Original", cancel: "Abbrechen", ph: "Schreib deinen eigenen Algorithmus (z. B. R U R' U')", bad: "Ungültige Zeichen. Nur Zugbuchstaben, ', 2, Klammern und Leerzeichen." },
        ar: { btn: "تعديل", edit: "تعديل الخوارزمية", mine: "خوارزميتك", orig: "الأصلية:", save: "حفظ", reset: "العودة إلى الأصلية", cancel: "إلغاء", ph: "اكتب خوارزميتك (مثل R U R' U')", bad: "أحرف غير صالحة. استخدم أحرف الحركات و' و2 والأقواس والمسافات فقط." }
    };
    function t(k) {
        var l = "tr";
        try { l = localStorage.getItem("site-lang") || "tr"; } catch (e) {}
        return (TXT[l] || TXT.tr)[k] || TXT.tr[k];
    }

    function loadAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
    function saveAll(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
    function key(page, set, name) { return page + ":" + (set || "") + ":" + name; }

    function clean(a) {
        return String(a).replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();
    }
    // Hamle harfleri (3x3, büyük küpler, pyraminx, skewb), sayı, ', w, parantez, + ve boşluk
    function valid(a) { return /^[A-Za-z0-9'()\[\]+\s\-↔]+$/.test(a); }

    window.CustomAlgs = {
        get: function (page, set, name) { return loadAll()[key(page, set, name)] || null; },
        set: function (page, set, name, alg) {
            var o = loadAll(), k = key(page, set, name);
            if (alg) o[k] = alg; else delete o[k];
            saveAll(o);
        }
    };

    /* ---------- algoritma sayfalarındaki case kartları ---------- */
    function scope() {
        var page = window.PAGE_ID || "";
        var set = (typeof window.currentSet === "string") ? window.currentSet : "";
        return { page: page, set: set };
    }
    // PLL gibi sayfalarda data-case "alt grup::isim" biçiminde; kayıt yalnızca isimle tutulur (antrenörle aynı)
    function caseName(card) { return String(card.getAttribute("data-case") || "").split("::").pop(); }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

    function render(card) {
        var algEl = card.querySelector(".case-alg");
        if (!algEl) return;
        var sc = scope(), name = caseName(card);
        if (!card.hasAttribute("data-orig")) card.setAttribute("data-orig", algEl.textContent);
        var orig = card.getAttribute("data-orig");
        var mine = window.CustomAlgs.get(sc.page, sc.set, name);
        var old = card.querySelector(".case-mine");
        if (old) old.parentNode.removeChild(old);
        if (mine) {
            algEl.textContent = mine;
            card.classList.add("has-custom");
            var tag = document.createElement("div");
            tag.className = "case-mine";
            tag.innerHTML = '<span class="mine-label">✏️ ' + esc(t("mine")) + '</span> <span class="mine-orig" dir="ltr">' + esc(t("orig")) + " " + esc(orig) + "</span>";
            algEl.parentNode.insertBefore(tag, algEl.nextSibling);
        } else {
            algEl.textContent = orig;
            card.classList.remove("has-custom");
        }
    }

    function decorate(root) {
        Array.prototype.forEach.call((root || document).querySelectorAll(".case-card"), function (card) {
            if (card.getAttribute("data-ca") === "1") { render(card); return; }
            card.setAttribute("data-ca", "1");
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "alg-edit-btn";
            btn.setAttribute("aria-label", t("edit"));
            btn.title = t("edit");
            btn.textContent = "✏️ " + t("btn");
            (card.querySelector(".case-body") || card).appendChild(btn);
            render(card);
        });
    }

    /* Genel düzenleme kutusu: algoritma kartlarında ve antrenörde kullanılır */
    function makeEditor(host, current, hasCustom, onSave, onReset, onClose) {
        var box = document.createElement("div");
        box.className = "alg-editor";
        box.innerHTML =
            '<textarea rows="2" dir="ltr" spellcheck="false" autocomplete="off" placeholder="' + esc(t("ph")) + '"></textarea>' +
            '<div class="alg-editor-err"></div>' +
            '<div class="alg-editor-actions">' +
            '<button type="button" class="ae-save">' + esc(t("save")) + '</button>' +
            (hasCustom ? '<button type="button" class="ae-reset">' + esc(t("reset")) + '</button>' : '') +
            '<button type="button" class="ae-cancel">' + esc(t("cancel")) + '</button></div>';
        // Kutudaki tıklama ve tuşlar dışarı (kart döngüsü, antrenör kısayolları) ulaşmasın
        box.addEventListener("click", function (e) { e.stopPropagation(); });
        box.addEventListener("keydown", function (e) { e.stopPropagation(); });
        box.addEventListener("keyup", function (e) { e.stopPropagation(); });
        host.appendChild(box);
        var ta = box.querySelector("textarea");
        ta.value = current || "";
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        function close() { if (box.parentNode) box.parentNode.removeChild(box); if (onClose) onClose(); }
        function save() {
            var v = clean(ta.value);
            if (v && !valid(v)) { box.querySelector(".alg-editor-err").textContent = t("bad"); return; }
            onSave(v); close();
        }
        box.querySelector(".ae-save").onclick = save;
        box.querySelector(".ae-cancel").onclick = close;
        var r = box.querySelector(".ae-reset");
        if (r) r.onclick = function () { onReset(); close(); };
        ta.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
            else if (e.key === "Escape") close();
        });
        return box;
    }
    window.CustomAlgs.makeEditor = makeEditor;
    window.CustomAlgs.refresh = render; // topluluk önerisi "Bunu kullan" sonrası kartı yenile
    window.CustomAlgs.label = function () { return "✏️ " + t("btn"); };
    window.CustomAlgs.t = t;

    function openEditor(card) {
        if (card.querySelector(".alg-editor")) return;
        var sc = scope(), name = caseName(card);
        var mine = window.CustomAlgs.get(sc.page, sc.set, name);
        var orig = card.getAttribute("data-orig") || "";
        card.classList.add("editing");
        makeEditor(card.querySelector(".case-body") || card, mine || orig, !!mine,
            function (v) { window.CustomAlgs.set(sc.page, sc.set, name, v && v !== orig ? v : null); render(card); },
            function () { window.CustomAlgs.set(sc.page, sc.set, name, null); render(card); },
            function () { card.classList.remove("editing"); });
    }

    function init() {
        var wrap = document.getElementById("subsetsWrap");
        if (!wrap) return;
        // Düzenleme kutusundaki tıklama/tuşlar kartın "öğreniyorum/biliyorum" döngüsünü tetiklemesin
        wrap.addEventListener("click", function (e) {
            var b = e.target.closest(".alg-edit-btn");
            if (b) { e.stopPropagation(); e.preventDefault(); openEditor(b.closest(".case-card")); }
        }, true);
        wrap.addEventListener("keydown", function (e) {
            if (e.target.closest(".alg-edit-btn") && (e.key === "Enter" || e.key === " ")) {
                e.stopPropagation(); e.preventDefault(); openEditor(e.target.closest(".case-card"));
            }
        }, true);
        decorate(wrap);
        new MutationObserver(function () { decorate(wrap); }).observe(wrap, { childList: true });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
