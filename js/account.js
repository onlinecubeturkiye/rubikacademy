/* =========================================================
   HESAP (account.js) — Firebase Authentication + ilerleme senkronu
   - Giriş: Google ya da e-posta + şifre (kayıt, şifremi unuttum)
   - Navbar'a giriş / profil butonu eklenir (tüm sayfalarda)
   - Senkron: aşağıdaki localStorage kayıtları users/{uid}/kv/{anahtar}
     belgelerine yazılır, başka cihazda giriş yapınca geri gelir.
   - Firebase SDK yalnızca gerektiğinde yüklenir (giriş yapılmışsa ya da
     giriş penceresi açılınca). Firestore'a REST API ile, giriş belirteciyle erişilir.
   Site girişsiz de eskisi gibi çalışır; veriler o cihazda kalır.
========================================================= */
(function () {
    var V = "20261107";
    var cfg = window.RA_FIREBASE || {};
    var SIGNED_KEY = "ra-auth-v1";      // bu cihazda giriş yapılmış mı (SDK'yı erken yüklemek için)
    var META_KEY = "ra-sync-meta-v1";   // { uid, h: {anahtar: özet}, t: {anahtar: zaman} }

    /* ---------- metinler ---------- */
    var TXT = {
        tr: { login: "Giriş", login_t: "Giriş yap", signup_t: "Kayıt ol", google: "Google ile devam et", or: "veya", name: "Adın", email: "E-posta", pass: "Şifre (en az 6 karakter)",
            do_login: "Giriş yap", do_signup: "Hesap oluştur", forgot: "Şifremi unuttum", reset_sent: "Şifre sıfırlama bağlantısı e-postana gönderildi.", need_email: "Önce e-posta adresini yaz.",
            why: "Hesapla ilerlemen (bildiğin case'ler, istatistikler, kendi algoritmaların) her cihazda seninle olur ve günün sıralamasına katılırsın.",
            privacy: "Giriş yaparak <a href=\"/gizlilik\">gizlilik metnini</a> kabul etmiş olursun.", close: "Kapat", profile: "Profilim",
            e_cred: "E-posta ya da şifre hatalı.", e_inuse: "Bu e-posta ile zaten bir hesap var. Giriş yap'ı dene.", e_weak: "Şifre en az 6 karakter olmalı.",
            e_email: "E-posta adresi geçersiz.", e_many: "Çok fazla deneme yapıldı. Biraz sonra tekrar dene.", e_net: "İnternet bağlantısı yok gibi görünüyor.",
            e_popup: "Açılır pencere engellendi. Tarayıcının açılır pencere iznini ver ve tekrar dene.", e_domain: "Bu adres için giriş henüz açılmamış (yetkili alan adı).",
            e_name: "Adın 2-20 karakter olmalı.", e_gen: "Giriş yapılamadı. Tekrar dene.", e_load: "Giriş sistemi yüklenemedi. İnternet bağlantını kontrol et." },
        en: { login: "Sign in", login_t: "Sign in", signup_t: "Sign up", google: "Continue with Google", or: "or", name: "Your name", email: "Email", pass: "Password (at least 6 characters)",
            do_login: "Sign in", do_signup: "Create account", forgot: "Forgot password", reset_sent: "A password reset link has been sent to your email.", need_email: "Type your email address first.",
            why: "With an account, your progress (known cases, stats, your own algorithms) follows you on every device and you can join the daily leaderboard.",
            privacy: "By signing in you accept the <a href=\"/gizlilik\">privacy notice</a>.", close: "Close", profile: "My profile",
            e_cred: "Wrong email or password.", e_inuse: "An account with this email already exists. Try signing in.", e_weak: "Password must be at least 6 characters.",
            e_email: "Invalid email address.", e_many: "Too many attempts. Try again a bit later.", e_net: "You seem to be offline.",
            e_popup: "The pop-up was blocked. Allow pop-ups in your browser and try again.", e_domain: "Sign-in is not enabled for this address yet (authorized domain).",
            e_name: "Name must be 2–20 characters.", e_gen: "Couldn't sign in. Please try again.", e_load: "Couldn't load sign-in. Check your internet connection." },
        fr: { login: "Connexion", login_t: "Se connecter", signup_t: "S'inscrire", google: "Continuer avec Google", or: "ou", name: "Ton nom", email: "E-mail", pass: "Mot de passe (6 caractères min.)",
            do_login: "Se connecter", do_signup: "Créer un compte", forgot: "Mot de passe oublié", reset_sent: "Un lien de réinitialisation a été envoyé à ton e-mail.", need_email: "Écris d'abord ton adresse e-mail.",
            why: "Avec un compte, ta progression (cas connus, statistiques, tes algorithmes) te suit sur tous tes appareils et tu participes au classement du jour.",
            privacy: "En te connectant, tu acceptes la <a href=\"/gizlilik\">politique de confidentialité</a>.", close: "Fermer", profile: "Mon profil",
            e_cred: "E-mail ou mot de passe incorrect.", e_inuse: "Un compte existe déjà avec cet e-mail. Essaie de te connecter.", e_weak: "Le mot de passe doit faire au moins 6 caractères.",
            e_email: "Adresse e-mail invalide.", e_many: "Trop de tentatives. Réessaie un peu plus tard.", e_net: "Tu sembles hors ligne.",
            e_popup: "La fenêtre a été bloquée. Autorise les pop-ups et réessaie.", e_domain: "La connexion n'est pas encore activée pour cette adresse.",
            e_name: "Le nom doit faire 2 à 20 caractères.", e_gen: "Connexion impossible. Réessaie.", e_load: "Impossible de charger la connexion. Vérifie ta connexion internet." },
        ru: { login: "Войти", login_t: "Вход", signup_t: "Регистрация", google: "Продолжить с Google", or: "или", name: "Твоё имя", email: "Эл. почта", pass: "Пароль (не менее 6 символов)",
            do_login: "Войти", do_signup: "Создать аккаунт", forgot: "Забыл пароль", reset_sent: "Ссылка для сброса пароля отправлена на почту.", need_email: "Сначала введи адрес почты.",
            why: "С аккаунтом твой прогресс (выученные случаи, статистика, свои алгоритмы) доступен на всех устройствах, и ты участвуешь в рейтинге дня.",
            privacy: "Входя, ты принимаешь <a href=\"/gizlilik\">политику конфиденциальности</a>.", close: "Закрыть", profile: "Мой профиль",
            e_cred: "Неверная почта или пароль.", e_inuse: "Аккаунт с этой почтой уже есть. Попробуй войти.", e_weak: "Пароль должен быть не короче 6 символов.",
            e_email: "Неверный адрес почты.", e_many: "Слишком много попыток. Попробуй позже.", e_net: "Похоже, нет подключения к интернету.",
            e_popup: "Всплывающее окно заблокировано. Разреши всплывающие окна и попробуй снова.", e_domain: "Вход для этого адреса ещё не включён.",
            e_name: "Имя должно быть от 2 до 20 символов.", e_gen: "Не удалось войти. Попробуй снова.", e_load: "Не удалось загрузить вход. Проверь интернет." },
        de: { login: "Anmelden", login_t: "Anmelden", signup_t: "Registrieren", google: "Mit Google fortfahren", or: "oder", name: "Dein Name", email: "E-Mail", pass: "Passwort (mind. 6 Zeichen)",
            do_login: "Anmelden", do_signup: "Konto erstellen", forgot: "Passwort vergessen", reset_sent: "Ein Link zum Zurücksetzen wurde an deine E-Mail gesendet.", need_email: "Gib zuerst deine E-Mail-Adresse ein.",
            why: "Mit einem Konto ist dein Fortschritt (gelernte Fälle, Statistiken, eigene Algorithmen) auf jedem Gerät dabei und du nimmst an der Tagesbestenliste teil.",
            privacy: "Mit der Anmeldung akzeptierst du den <a href=\"/gizlilik\">Datenschutzhinweis</a>.", close: "Schließen", profile: "Mein Profil",
            e_cred: "E-Mail oder Passwort falsch.", e_inuse: "Mit dieser E-Mail gibt es schon ein Konto. Versuch dich anzumelden.", e_weak: "Das Passwort muss mindestens 6 Zeichen lang sein.",
            e_email: "Ungültige E-Mail-Adresse.", e_many: "Zu viele Versuche. Versuch es etwas später.", e_net: "Du scheinst offline zu sein.",
            e_popup: "Das Pop-up wurde blockiert. Erlaube Pop-ups und versuch es erneut.", e_domain: "Die Anmeldung ist für diese Adresse noch nicht freigeschaltet.",
            e_name: "Der Name muss 2–20 Zeichen lang sein.", e_gen: "Anmeldung fehlgeschlagen. Versuch es erneut.", e_load: "Anmeldung konnte nicht geladen werden. Prüfe deine Internetverbindung." },
        ar: { login: "دخول", login_t: "تسجيل الدخول", signup_t: "إنشاء حساب", google: "المتابعة باستخدام Google", or: "أو", name: "اسمك", email: "البريد الإلكتروني", pass: "كلمة المرور (6 أحرف على الأقل)",
            do_login: "تسجيل الدخول", do_signup: "إنشاء الحساب", forgot: "نسيت كلمة المرور", reset_sent: "أُرسل رابط إعادة تعيين كلمة المرور إلى بريدك.", need_email: "اكتب بريدك الإلكتروني أولاً.",
            why: "مع الحساب يرافقك تقدّمك (الحالات التي تعرفها والإحصاءات وخوارزمياتك) على كل الأجهزة وتشارك في ترتيب اليوم.",
            privacy: "بتسجيل الدخول توافق على <a href=\"/gizlilik\">سياسة الخصوصية</a>.", close: "إغلاق", profile: "ملفي",
            e_cred: "البريد أو كلمة المرور غير صحيحة.", e_inuse: "يوجد حساب بهذا البريد بالفعل. جرّب تسجيل الدخول.", e_weak: "يجب أن تتكوّن كلمة المرور من 6 أحرف على الأقل.",
            e_email: "عنوان البريد غير صالح.", e_many: "محاولات كثيرة جداً. حاول لاحقاً.", e_net: "يبدو أنك غير متصل بالإنترنت.",
            e_popup: "تم حظر النافذة المنبثقة. اسمح بالنوافذ المنبثقة وحاول مجدداً.", e_domain: "تسجيل الدخول غير مفعّل لهذا العنوان بعد.",
            e_name: "يجب أن يكون الاسم من 2 إلى 20 حرفاً.", e_gen: "تعذّر تسجيل الدخول. حاول مجدداً.", e_load: "تعذّر تحميل تسجيل الدخول. تحقّق من اتصالك." }
    };
    function lang() { try { return localStorage.getItem("site-lang") || "tr"; } catch (e) { return "tr"; } }
    function t(k) { return (TXT[lang()] || TXT.tr)[k] || TXT.tr[k] || k; }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

    var enabled = !!(cfg.apiKey && cfg.projectId && cfg.authDomain);

    /* ---------- SDK ---------- */
    var fb = null, auth = null, sdkP = null, user = null, listeners = [];
    function loadSDK() {
        if (sdkP) return sdkP;
        sdkP = import("/js/vendor/firebase/firebase-auth.js?v=" + V).then(function (m) {
            fb = m;
            var app = m.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
            auth = m.getAuth(app);
            if (cfg.emulator && cfg.emulator.auth) m.connectAuthEmulator(auth, cfg.emulator.auth, { disableWarnings: true });
            try { auth.languageCode = lang(); } catch (e) {}
            m.onAuthStateChanged(auth, function (u) {
                user = u;
                lsSet(SIGNED_KEY, u ? "1" : null);
                renderNav();
                if (u) { closeModal(); startSync(); } else stopSync();
                listeners.forEach(function (f) { try { f(u); } catch (e) {} });
                try { document.dispatchEvent(new CustomEvent("account-change", { detail: u })); } catch (e) {}
            });
            return m;
        });
        sdkP.catch(function () { sdkP = null; });
        return sdkP;
    }

    /* ---------- navbar butonu ---------- */
    var navBtn = null;
    function renderNav() {
        if (!enabled) return;
        var right = document.querySelector(".nav-right");
        if (!right) return;
        if (!navBtn) {
            navBtn = document.createElement("a");
            navBtn.className = "acc-btn";
            navBtn.id = "accBtn";
            var lang = document.getElementById("langSwitcher");
            right.insertBefore(navBtn, lang || right.firstChild);
            navBtn.addEventListener("click", function (e) {
                if (!user) { e.preventDefault(); openLogin(); }
            });
        }
        if (user) {
            var nm = user.displayName || (user.email || "?").split("@")[0];
            navBtn.href = "/icerikler/profil";
            navBtn.title = t("profile") + " · " + nm;
            navBtn.setAttribute("aria-label", t("profile"));
            navBtn.classList.add("in");
            navBtn.innerHTML = user.photoURL
                ? '<img src="' + esc(user.photoURL) + '" alt="" referrerpolicy="no-referrer">'
                : '<span class="acc-ini">' + esc(nm.charAt(0).toUpperCase()) + '</span>';
        } else {
            navBtn.href = "#";
            navBtn.classList.remove("in");
            navBtn.title = t("login_t");
            navBtn.setAttribute("aria-label", t("login_t"));
            navBtn.innerHTML = '<span class="acc-ico" aria-hidden="true">👤</span><span class="acc-txt">' + esc(t("login")) + '</span>';
        }
    }

    /* ---------- giriş penceresi ---------- */
    var modal = null, tab = "login";
    function errMsg(err) {
        var c = (err && err.code) || "";
        if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return t("e_cred");
        if (/email-already-in-use/.test(c)) return t("e_inuse");
        if (/weak-password/.test(c)) return t("e_weak");
        if (/invalid-email|missing-email/.test(c)) return t("e_email");
        if (/too-many-requests/.test(c)) return t("e_many");
        if (/network-request-failed/.test(c)) return t("e_net");
        if (/popup-blocked/.test(c)) return t("e_popup");
        if (/unauthorized-domain/.test(c)) return t("e_domain");
        return t("e_gen") + (c ? " (" + c + ")" : "");
    }
    function buildModal() {
        modal = document.createElement("div");
        modal.className = "acc-modal";
        modal.innerHTML = '<div class="acc-box" role="dialog" aria-modal="true" aria-labelledby="accTitle">' +
            '<button type="button" class="acc-x" data-x>✕</button>' +
            '<div class="acc-tabs" role="tablist"><button type="button" class="acc-tab" data-tab="login"></button><button type="button" class="acc-tab" data-tab="signup"></button></div>' +
            '<h3 id="accTitle" class="sr"></h3><p class="acc-why"></p>' +
            '<button type="button" class="acc-google"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg><span></span></button>' +
            '<div class="acc-or"><span></span></div>' +
            '<form class="acc-form" novalidate>' +
            '<input type="text" name="name" autocomplete="nickname" maxlength="20" class="acc-in acc-name">' +
            '<input type="email" name="email" autocomplete="email" class="acc-in" required>' +
            '<input type="password" name="pass" autocomplete="current-password" class="acc-in" minlength="6" required>' +
            '<p class="acc-err" role="alert"></p>' +
            '<button type="submit" class="acc-submit"></button>' +
            '<button type="button" class="acc-forgot"></button>' +
            '</form><p class="acc-priv"></p></div>';
        document.body.appendChild(modal);
        modal.addEventListener("click", function (e) {
            if (e.target === modal || e.target.closest("[data-x]")) closeModal();
            var tb = e.target.closest(".acc-tab"); if (tb) { tab = tb.getAttribute("data-tab"); renderModal(); }
        });
        modal.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") closeModal(); });
        modal.addEventListener("keyup", function (e) { e.stopPropagation(); });
        modal.querySelector(".acc-google").addEventListener("click", google);
        modal.querySelector(".acc-form").addEventListener("submit", function (e) { e.preventDefault(); emailSubmit(); });
        modal.querySelector(".acc-forgot").addEventListener("click", forgot);
    }
    function renderModal() {
        var q = function (s) { return modal.querySelector(s); };
        Array.prototype.forEach.call(modal.querySelectorAll(".acc-tab"), function (b) {
            var k = b.getAttribute("data-tab"); b.textContent = t(k === "login" ? "login_t" : "signup_t");
            b.classList.toggle("on", k === tab); b.setAttribute("aria-selected", k === tab ? "true" : "false");
        });
        q("#accTitle").textContent = t(tab === "login" ? "login_t" : "signup_t");
        q(".acc-why").textContent = t("why");
        q(".acc-google span").textContent = t("google");
        q(".acc-or span").textContent = t("or");
        q(".acc-name").placeholder = t("name"); q(".acc-name").hidden = tab !== "signup";
        q("[name=email]").placeholder = t("email");
        q("[name=pass]").placeholder = t("pass");
        q("[name=pass]").autocomplete = tab === "signup" ? "new-password" : "current-password";
        q(".acc-submit").textContent = t(tab === "login" ? "do_login" : "do_signup");
        q(".acc-forgot").textContent = t("forgot"); q(".acc-forgot").hidden = tab !== "login";
        q(".acc-priv").innerHTML = t("privacy");
        q(".acc-x").setAttribute("aria-label", t("close"));
    }
    function setErr(m, ok) { var e = modal.querySelector(".acc-err"); e.textContent = m || ""; e.classList.toggle("ok", !!ok); }
    function busy(b) { Array.prototype.forEach.call(modal.querySelectorAll("button, input"), function (x) { if (!x.hasAttribute("data-x")) x.disabled = b; }); }
    function openLogin(which) {
        if (!enabled) return;
        if (!modal) buildModal();
        tab = which || "login";
        renderModal(); setErr("");
        modal.classList.add("open");
        loadSDK().catch(function () { setErr(t("e_load")); });
        setTimeout(function () { var i = modal.querySelector("[name=email]"); if (i && window.innerWidth > 700) i.focus(); }, 60);
    }
    function closeModal() { if (modal) modal.classList.remove("open"); }
    function google() {
        setErr(""); busy(true);
        loadSDK().then(function (m) {
            var p = new m.GoogleAuthProvider();
            p.setCustomParameters({ prompt: "select_account" });
            return m.signInWithPopup(auth, p).catch(function (err) {
                if (err && /popup-blocked|operation-not-supported/.test(err.code || "")) return m.signInWithRedirect(auth, p);
                throw err;
            });
        }).catch(function (err) {
            if (err && /popup-closed-by-user|cancelled-popup-request/.test(err.code || "")) return;
            setErr(err && err.code ? errMsg(err) : t("e_load"));
        }).then(function () { busy(false); });
    }
    function emailSubmit() {
        var f = modal.querySelector(".acc-form"), email = f.email.value.trim(), pass = f.pass.value, name = f.name.value.replace(/\s+/g, " ").trim();
        if (tab === "signup" && (name.length < 2 || name.length > 20)) { setErr(t("e_name")); return; }
        setErr(""); busy(true);
        loadSDK().then(function (m) {
            if (tab === "login") return m.signInWithEmailAndPassword(auth, email, pass);
            return m.createUserWithEmailAndPassword(auth, email, pass).then(function (cred) {
                return m.updateProfile(cred.user, { displayName: name }).then(function () { user = auth.currentUser; renderNav(); });
            });
        }).catch(function (err) { setErr(err && err.code ? errMsg(err) : t("e_load")); }).then(function () { busy(false); });
    }
    function forgot() {
        var email = modal.querySelector("[name=email]").value.trim();
        if (!email) { setErr(t("need_email")); modal.querySelector("[name=email]").focus(); return; }
        busy(true);
        loadSDK().then(function (m) { return m.sendPasswordResetEmail(auth, email); })
            .then(function () { setErr(t("reset_sent"), true); }, function (err) { setErr(errMsg(err)); })
            .then(function () { busy(false); });
    }

    /* ---------- Firestore REST (giriş belirteciyle) ---------- */
    function base() { return ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents"; }
    function docName(path) { return "projects/" + cfg.projectId + "/databases/(default)/documents/" + path; }
    function token() { return user ? user.getIdToken() : Promise.reject(new Error("signed-out")); }
    function api(path, opts) {
        return token().then(function (tk) {
            opts = opts || {};
            opts.headers = Object.assign({ "Authorization": "Bearer " + tk, "Content-Type": "application/json" }, opts.headers || {});
            return fetch(base() + path, opts);
        });
    }

    /* ---------- senkron ---------- */
    var SYNC_PREFIX = ["algo-progress-", "algo-set-", "recog-"];
    var SYNC_KEYS = ["custom-algs-v1", "trainer-stats-v1", "roadmap-done-v1", "roadmap-track-v1", "daily-results-v1", "daily-sent-v1"];
    function synced(k) { return SYNC_KEYS.indexOf(k) >= 0 || SYNC_PREFIX.some(function (p) { return k.indexOf(p) === 0; }); }
    function localKeys() { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && synced(k)) out.push(k); } } catch (e) {} return out; }
    function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ":" + s.length; }
    function loadMeta() { try { return JSON.parse(lsGet(META_KEY)) || {}; } catch (e) { return {}; } }
    function saveMeta(m) { lsSet(META_KEY, JSON.stringify(m)); }
    function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
    function isObj(o) { return o && typeof o === "object" && !Array.isArray(o); }
    // İki cihazda da değişmiş kayıtları birleştir
    function merge(k, loc, cl) {
        var a = parse(loc), b = parse(cl);
        if (!isObj(a) || !isObj(b)) return loc;
        var o = {}, x;
        if (k.indexOf("algo-progress-") === 0) { // "known" > "learning"
            for (x in b) o[x] = b[x];
            for (x in a) if (!(x in o) || a[x] === "known") o[x] = a[x];
            return JSON.stringify(o);
        }
        if (k === "trainer-stats-v1") { // case başına daha çok çözülmüş olanı al
            for (x in b) o[x] = b[x];
            for (x in a) {
                if (!isObj(a[x]) || !isObj(o[x])) { if (!(x in o)) o[x] = a[x]; continue; }
                var s = Object.assign({}, o[x]);
                for (var c in a[x]) if (!s[c] || ((a[x][c] && a[x][c].n) || 0) >= ((s[c] && s[c].n) || 0)) s[c] = a[x][c];
                o[x] = s;
            }
            return JSON.stringify(o);
        }
        if (k.indexOf("recog-") === 0) return ((a.n || 0) >= (b.n || 0)) ? loc : cl;
        // diğerleri: birleşim, çakışmada bu cihaz
        for (x in b) o[x] = b[x];
        for (x in a) o[x] = a[x];
        return JSON.stringify(o);
    }
    var syncing = false, pushTimer = 0, synced1 = false;
    function pull() {
        return api("/users/" + user.uid + "/kv?pageSize=300").then(function (r) {
            if (!r.ok) throw new Error("pull " + r.status);
            return r.json();
        }).then(function (j) {
            var cloud = {};
            (j.documents || []).forEach(function (d) {
                var k = decodeURIComponent(d.name.split("/").pop()), f = d.fields || {};
                if (f.v && typeof f.v.stringValue === "string") cloud[k] = { v: f.v.stringValue, t: +(f.t && f.t.integerValue || 0) };
            });
            return cloud;
        });
    }
    function push(keys, meta, keepalive) {
        if (!keys.length) return Promise.resolve();
        return token().then(function (tk) {
            var now = Date.now(), writes = keys.map(function (k) {
                var v = lsGet(k);
                return { update: { name: docName("users/" + user.uid + "/kv/" + encodeURIComponent(k)), fields: { v: { stringValue: v == null ? "" : v }, t: { integerValue: String(now) } } } };
            });
            return fetch(base() + ":commit", { method: "POST", keepalive: !!keepalive, headers: { "Authorization": "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify({ writes: writes }) })
                .then(function (r) {
                    if (!r.ok) throw new Error("push " + r.status);
                    keys.forEach(function (k) { meta.h[k] = hash(lsGet(k)); meta.t[k] = now; });
                    saveMeta(meta);
                });
        });
    }
    // Giriş yapınca / sayfa açılınca: buluttakini al, birleştir, değişenleri gönder
    function fullSync() {
        if (!user || syncing) return Promise.resolve();
        syncing = true;
        var meta = loadMeta();
        if (meta.uid !== user.uid) meta = { uid: user.uid, h: {}, t: {} }; // bu cihazda bu hesapla ilk senkron
        meta.h = meta.h || {}; meta.t = meta.t || {};
        var applied = 0;
        return pull().then(function (cloud) {
            var keys = {}, up = [];
            localKeys().forEach(function (k) { keys[k] = 1; });
            Object.keys(cloud).forEach(function (k) { if (synced(k)) keys[k] = 1; });
            Object.keys(keys).forEach(function (k) {
                var loc = lsGet(k), cl = cloud[k];
                var locChanged = loc !== null && hash(loc) !== meta.h[k];
                var clChanged = cl && cl.t > (meta.t[k] || 0);
                if (cl && loc === null) { lsSet(k, cl.v); applied++; meta.h[k] = hash(cl.v); meta.t[k] = cl.t; return; }
                if (!cl) { if (loc !== null) up.push(k); return; }
                if (loc === cl.v) { meta.h[k] = hash(loc); meta.t[k] = Math.max(cl.t, meta.t[k] || 0); return; }
                if (clChanged && !locChanged) { lsSet(k, cl.v); applied++; meta.h[k] = hash(cl.v); meta.t[k] = cl.t; return; }
                if (locChanged && !clChanged) { up.push(k); return; }
                // ikisi de değişmiş: birleştir
                var m = merge(k, loc, cl.v);
                if (m !== loc) { lsSet(k, m); applied++; }
                up.push(k);
            });
            saveMeta(meta);
            return push(up, meta);
        }).then(function () {
            syncing = false;
            synced1 = true;
            try { document.dispatchEvent(new CustomEvent("account-synced", { detail: { applied: applied } })); } catch (e) {}
            // Sayfa eski verilerle çizildiyse bir kez yenile (döngüye girmesin)
            if (applied && !window.RA_NO_SYNC_RELOAD) {
                var last = +(sessionStorage.getItem("ra-sync-reload") || 0);
                if (Date.now() - last > 15000) { sessionStorage.setItem("ra-sync-reload", String(Date.now())); location.reload(); }
            }
        }, function (e) { syncing = false; console.warn("Senkron başarısız:", e); });
    }
    // Bu cihazdaki değişiklikleri gönder (periyodik ve sayfadan çıkarken)
    function pushChanged(keepalive) {
        if (!user || syncing || !synced1) return Promise.resolve();
        var meta = loadMeta(); if (meta.uid !== user.uid) return Promise.resolve();
        meta.h = meta.h || {}; meta.t = meta.t || {};
        var ch = localKeys().filter(function (k) { return hash(lsGet(k)) !== meta.h[k]; });
        return push(ch, meta, keepalive).catch(function () {});
    }
    function startSync() {
        fullSync();
        clearInterval(pushTimer);
        pushTimer = setInterval(function () { pushChanged(false); }, 20000);
    }
    function stopSync() { clearInterval(pushTimer); synced1 = false; }
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") pushChanged(true); });
    window.addEventListener("pagehide", function () { pushChanged(true); });

    /* ---------- hesap işlemleri ---------- */
    function signOut() {
        return pushChanged(false).then(function () { return loadSDK(); }).then(function (m) { return m.signOut(auth); }).then(function () {
            lsSet(META_KEY, null);
        });
    }
    function setName(name) {
        return loadSDK().then(function (m) { return m.updateProfile(auth.currentUser, { displayName: name }); }).then(function () {
            user = auth.currentUser; renderNav();
            listeners.forEach(function (f) { try { f(user); } catch (e) {} });
        });
    }
    // Hesabı sil: buluttaki kayıtlar, sıralama girdileri ve hesap
    function deleteAccount() {
        var uid = user && user.uid;
        if (!uid) return Promise.reject(new Error("signed-out"));
        return pull().then(function (cloud) {
            var writes = Object.keys(cloud).map(function (k) { return { delete: docName("users/" + uid + "/kv/" + encodeURIComponent(k)) }; });
            var sent = parse(lsGet("daily-sent-v1")) || {};
            Object.keys(sent).forEach(function (d) {
                var p = d.split("-"); if (p.length !== 3) return;
                var dn = Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
                writes.push({ delete: docName("days/" + dn + "/times/" + uid) });
            });
            if (!writes.length) return;
            return token().then(function (tk) {
                return fetch(base() + ":commit", { method: "POST", headers: { "Authorization": "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify({ writes: writes }) });
            });
        }).then(function () { return loadSDK(); }).then(function (m) {
            return m.deleteUser(auth.currentUser).catch(function (err) {
                // Uzun süredir girişliyse Google/şifre ile yeniden doğrulama ister
                if (!err || !/requires-recent-login/.test(err.code || "")) throw err;
                var u = auth.currentUser, isG = u.providerData.some(function (p) { return p.providerId === "google.com"; });
                if (isG) return m.reauthenticateWithPopup(u, new m.GoogleAuthProvider()).then(function () { return m.deleteUser(auth.currentUser); });
                var pw = window.prompt(t("pass"));
                if (!pw) throw err;
                return m.reauthenticateWithCredential(u, m.EmailAuthProvider.credential(u.email, pw)).then(function () { return m.deleteUser(auth.currentUser); });
            });
        }).then(function () { lsSet(META_KEY, null); lsSet(SIGNED_KEY, null); });
    }

    /* ---------- herkese açık profil dokümanı + ziyaret kaydı ---------- */
    var ADMIN_EMAIL = "pikapikachuyt0@gmail.com";
    function isAdmin() { return !!(user && user.email === ADMIN_EMAIL && user.providerData && user.providerData.some(function (p) { return p.providerId === "google.com"; })); }
    var PROF_KEY = "ra-profile-v1"; // yerel profil tercihleri: { name, bio, joined }
    var STAT_SETS = [["oll", 57], ["pll", 21], ["2look-2lo", 10], ["2look-2lp", 6], ["f2l", 41], ["coll", 42], ["wv", 27], ["cll", 42], ["eg1", 42], ["eg2", 42], ["ortega-oll", 7], ["ortega-pbl", 5], ["roux-cmll", 42]];
    function computeStats() {
        var known = 0, learning = 0, sets = {};
        STAT_SETS.forEach(function (s) {
            var o = parse(lsGet("algo-progress-" + s[0])) || {}, kn = 0, ln = 0;
            if (isObj(o)) for (var c in o) { if (o[c] === "known") kn++; else if (o[c] === "learning") ln++; }
            if (kn || ln) sets[s[0]] = { k: kn, l: ln, t: s[1] };
            known += kn; learning += ln;
        });
        var tr = parse(lsGet("trainer-stats-v1")) || {}, solves = 0;
        if (isObj(tr)) for (var set in tr) { var cs = tr[set]; if (isObj(cs)) for (var cc in cs) { var n = cs[cc] && cs[cc].n; if (typeof n === "number") solves += n; } }
        var dr = parse(lsGet("daily-results-v1")) || {}, best = 0, dcount = 0;
        if (isObj(dr)) for (var d in dr) { var r = dr[d]; dcount++; var v = r && r.t; if (typeof v === "number" && r.pen !== "dnf" && (!best || v < best)) best = v; }
        return { known: known, learning: learning, sets: sets, solves: solves, best: best, daily: dcount };
    }
    function localProfile() { var p = parse(lsGet(PROF_KEY)); return isObj(p) ? p : {}; }
    function writeProfile() {
        if (!user) return Promise.resolve();
        var prof = localProfile();
        if (!prof.joined) { prof.joined = Date.now(); lsSet(PROF_KEY, JSON.stringify(prof)); }
        var name = (prof.name || user.displayName || (user.email || "?").split("@")[0] || "Cuber").slice(0, 24);
        var fields = {
            name: { stringValue: name },
            photo: { stringValue: String(user.photoURL || "").slice(0, 400) },
            bio: { stringValue: String(prof.bio || "").slice(0, 160) },
            joined: { integerValue: String(prof.joined) },
            seen: { integerValue: String(Date.now()) },
            stats: { stringValue: JSON.stringify(computeStats()).slice(0, 8000) }
        };
        var mask = "?updateMask.fieldPaths=name&updateMask.fieldPaths=photo&updateMask.fieldPaths=bio&updateMask.fieldPaths=joined&updateMask.fieldPaths=seen&updateMask.fieldPaths=stats";
        return api("/users/" + user.uid + mask, { method: "PATCH", body: JSON.stringify({ fields: fields }) }).catch(function () {});
    }
    function logVisit() {
        if (!user) return;
        var p = String(location.pathname || "/").slice(0, 120), sk = "ra-visit:" + p;
        try { if (sessionStorage.getItem(sk)) return; sessionStorage.setItem(sk, "1"); } catch (e) {}
        api("/users/" + user.uid + "/visits", { method: "POST", body: JSON.stringify({ fields: { p: { stringValue: p }, ts: { timestampValue: new Date().toISOString() } } }) }).catch(function () {});
    }
    document.addEventListener("account-synced", function () { writeProfile(); logVisit(); });

    window.Account = {
        enabled: function () { return enabled; },
        writeProfile: writeProfile,
        computeStats: computeStats,
        localProfile: localProfile,
        setProfile: function (o) { var p = localProfile(); for (var k in o) p[k] = o[k]; lsSet(PROF_KEY, JSON.stringify(p)); return writeProfile(); },
        getProfile: function (uid) {
            var u = ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents/users/" + encodeURIComponent(uid) + "?key=" + encodeURIComponent(cfg.apiKey);
            return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                if (!d || !d.fields) return null; var f = d.fields, g = function (x) { return f[x] && (f[x].stringValue != null ? f[x].stringValue : f[x].integerValue); };
                var st = {}; try { st = JSON.parse(g("stats") || "{}"); } catch (e) {}
                return { name: g("name") || "Cuber", photo: g("photo") || "", bio: g("bio") || "", joined: +(g("joined") || 0), seen: +(g("seen") || 0), stats: st };
            }).catch(function () { return null; });
        },
        user: function () { return user; },
        uid: function () { return user ? user.uid : null; },
        isAdmin: isAdmin,
        token: token,
        onChange: function (f) { listeners.push(f); if (sdkP) f(user); },
        openLogin: openLogin,
        signOut: signOut,
        setName: setName,
        deleteAccount: deleteAccount,
        syncNow: function () { return pushChanged(false); },
        load: loadSDK,
        isPending: function () { return lsGet(SIGNED_KEY) === "1" && !sdkP; }
    };

    function init() {
        if (!enabled) return;
        renderNav();
        // Daha önce giriş yapılmışsa oturumu geri yükle (yoksa SDK hiç yüklenmez)
        if (lsGet(SIGNED_KEY) === "1" || window.RA_ACCOUNT_EAGER) loadSDK().catch(function () {});
        document.addEventListener("site-lang-change", function () { renderNav(); if (modal && modal.classList.contains("open")) renderModal(); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
