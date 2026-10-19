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
    var V = "20261123";
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
                if (u) { closeModal(); startSync(); logSession(); checkLogoutAll(); checkSuspended(); ensurePush(); } else stopSync();
                listeners.forEach(function (f) { try { f(u); } catch (e) {} });
                try { document.dispatchEvent(new CustomEvent("account-change", { detail: u })); } catch (e) {}
            });
            return m;
        });
        sdkP.catch(function () { sdkP = null; });
        return sdkP;
    }

    /* ---------- navbar butonu + hesap menüsü ---------- */
    var MENU_TXT = {
        tr: { profile: "Profilim", settings: "Ayarlar", help: "Yardım", logout: "Çıkış yap" },
        en: { profile: "My profile", settings: "Settings", help: "Help", logout: "Sign out" },
        fr: { profile: "Mon profil", settings: "Paramètres", help: "Aide", logout: "Déconnexion" },
        ru: { profile: "Мой профиль", settings: "Настройки", help: "Помощь", logout: "Выйти" },
        de: { profile: "Mein Profil", settings: "Einstellungen", help: "Hilfe", logout: "Abmelden" },
        ar: { profile: "ملفي", settings: "الإعدادات", help: "مساعدة", logout: "تسجيل الخروج" }
    };
    function mt(k) { return (MENU_TXT[lang()] || MENU_TXT.tr)[k] || MENU_TXT.tr[k]; }
    var navBtn = null, navWrap = null, navMenu = null;
    function accMenuHtml() {
        return '<a class="acc-mi" href="/icerikler/profil">👤 ' + esc(mt("profile")) + '</a>' +
            '<a class="acc-mi" href="/ayarlar">⚙️ ' + esc(mt("settings")) + '</a>' +
            '<a class="acc-mi" href="/icerikler/sss">❓ ' + esc(mt("help")) + '</a>' +
            '<button type="button" class="acc-mi danger" data-act="logout">🚪 ' + esc(mt("logout")) + '</button>';
    }
    function bindAccMenu() {
        var o = navMenu.querySelector('[data-act="logout"]');
        if (o) o.onclick = function () { navWrap.classList.remove("open"); signOut(); };
    }
    function renderNav() {
        if (!enabled) return;
        var right = document.querySelector(".nav-right");
        if (!right) return;
        if (!navWrap) {
            navWrap = document.createElement("div"); navWrap.className = "acc-wrap"; navWrap.id = "accWrap";
            navBtn = document.createElement("a"); navBtn.className = "acc-btn"; navBtn.id = "accBtn";
            navMenu = document.createElement("div"); navMenu.className = "acc-menu"; navMenu.id = "accMenu"; navMenu.setAttribute("role", "menu");
            navWrap.appendChild(navBtn); navWrap.appendChild(navMenu);
            var lang0 = document.getElementById("langSwitcher");
            right.insertBefore(navWrap, lang0 || right.firstChild);
            navBtn.addEventListener("click", function (e) {
                e.preventDefault();
                if (user || lsGet(SIGNED_KEY) === "1") navWrap.classList.toggle("open");
                else openLogin();
            });
            document.addEventListener("click", function (e) { if (navWrap && !navWrap.contains(e.target)) navWrap.classList.remove("open"); });
        }
        // Daha önce giriş yapılmışsa, oturum geri yüklenene kadar "giriş yap" GÖSTERME (flicker önlenir)
        var restoring = !user && lsGet(SIGNED_KEY) === "1";
        if (user || restoring) {
            var prof = (function () { try { return JSON.parse(lsGet(PROF_KEY)) || {}; } catch (e) { return {}; } })();
            var nm = (user && (user.displayName || (user.email || "?").split("@")[0])) || prof.name || "·";
            navBtn.href = "/icerikler/profil";
            navBtn.title = t("profile") + (user ? " · " + nm : "");
            navBtn.setAttribute("aria-label", t("profile"));
            navBtn.classList.add("in");
            navBtn.innerHTML = (user && user.photoURL)
                ? '<img src="' + esc(user.photoURL) + '" alt="" referrerpolicy="no-referrer">'
                : '<span class="acc-ini">' + esc((nm.charAt(0) || "·").toUpperCase()) + '</span>';
            navMenu.innerHTML = accMenuHtml(); bindAccMenu();
        } else {
            navBtn.href = LOGIN_URL;
            navBtn.classList.remove("in");
            navBtn.title = t("login_t");
            navBtn.setAttribute("aria-label", t("login_t"));
            navBtn.innerHTML = '<span class="acc-ico" aria-hidden="true">👤</span><span class="acc-txt">' + esc(t("login")) + '</span>';
            navWrap.classList.remove("open"); navMenu.innerHTML = "";
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
    var LOGIN_URL = "/giris";
    // Giriş artık ayrı sayfada (panel değil): mevcut sayfaya dönebilmek için ?return eklenir
    function openLogin(which) {
        if (!enabled) return;
        if (user) return;
        var here = location.pathname + location.search;
        if (location.pathname.replace(/\.html$/, "") === LOGIN_URL) return;
        var ret = /\/giris/.test(here) ? "" : "?return=" + encodeURIComponent(here) + (which === "signup" ? "&mod=signup" : "");
        location.href = LOGIN_URL + ret;
    }
    function closeModal() { if (modal) modal.classList.remove("open"); }
    /* ---------- giriş sayfası (giris.html) için genel API ---------- */
    function doGoogle() {
        return loadSDK().then(function (m) {
            var p = new m.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
            return m.signInWithPopup(auth, p).catch(function (err) {
                if (err && /popup-blocked|operation-not-supported/.test(err.code || "")) return m.signInWithRedirect(auth, p);
                throw err;
            });
        });
    }
    function doEmail(mode, email, pass, name) {
        return loadSDK().then(function (m) {
            if (mode === "signup") return m.createUserWithEmailAndPassword(auth, email, pass).then(function (cred) {
                return m.updateProfile(cred.user, { displayName: name }).then(function () { user = auth.currentUser; renderNav(); });
            });
            return m.signInWithEmailAndPassword(auth, email, pass);
        });
    }
    function doReset(email) { return loadSDK().then(function (m) { return m.sendPasswordResetEmail(auth, email); }); }
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
    var SYNC_KEYS = ["custom-algs-v1", "trainer-stats-v1", "roadmap-done-v1", "roadmap-track-v1", "daily-results-v1", "daily-sent-v1", "timer-solves-v1"];
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
        var dr = parse(lsGet("daily-results-v1")) || {}, best = 0, dcount = 0, dlist = [];
        if (isObj(dr)) for (var d in dr) {
            var r = dr[d]; dcount++; var v = r && r.t;
            if (typeof v === "number" && r.pen !== "dnf" && (!best || v < best)) best = v;
            if (r && typeof r.t === "number") dlist.push({ d: d.split(":")[0], t: r.t, pen: r.pen || "" });
        }
        dlist.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
        // Zamanlayıcı kişisel rekorları (küp başına en iyi tek çözüm)
        var ts = parse(lsGet("timer-solves-v1")) || {}, pbs = {};
        if (isObj(ts)) for (var cb in ts) {
            var list = ts[cb]; if (!Array.isArray(list)) continue; var bst = 0;
            list.forEach(function (r) { if (r && typeof r.t === "number" && r.pen !== "dnf") { var v = r.t + (r.pen === "+2" ? 2000 : 0); if (!bst || v < bst) bst = v; } });
            if (bst) pbs[cb] = bst;
        }
        return { known: known, learning: learning, sets: sets, solves: solves, best: best, daily: dcount, dlist: dlist.slice(0, 20), pbs: pbs };
    }
    function localProfile() { var p = parse(lsGet(PROF_KEY)); return isObj(p) ? p : {}; }
    function writeProfile() {
        if (!user) return Promise.resolve();
        var prof = localProfile();
        if (!prof.joined) { prof.joined = Date.now(); lsSet(PROF_KEY, JSON.stringify(prof)); }
        var name = (prof.name || user.displayName || (user.email || "?").split("@")[0] || "Cuber").slice(0, 24);
        var st = computeStats();
        // Profil özelleştirme (renk vurgusu + favori küp) stats içine gömülür — kural değişikliği gerektirmez
        if (prof.accent) st.accent = String(prof.accent).slice(0, 12);
        if (prof.fav) st.fav = String(prof.fav).slice(0, 24);
        var fields = {
            name: { stringValue: name },
            photo: { stringValue: String(prof.photo || user.photoURL || "").slice(0, 40000) },
            bio: { stringValue: String(prof.bio || "").slice(0, 160) },
            joined: { integerValue: String(prof.joined) },
            seen: { integerValue: String(Date.now()) },
            stats: { stringValue: JSON.stringify(st).slice(0, 8000) }
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
    // İşaretlenen tüm case'ler (bildiklerim/öğreniyorum) — admin paneli için
    function allMarks() {
        var out = {};
        STAT_SETS.forEach(function (s) { var o = parse(lsGet("algo-progress-" + s[0])); if (isObj(o)) { var kept = {}, any = false; for (var c in o) { if (o[c] === "known" || o[c] === "learning") { kept[c] = o[c] === "known" ? "k" : "l"; any = true; } } if (any) out[s[0]] = kept; } });
        return out;
    }
    // Özel üye bilgisi (yalnızca sahibi + admin okur): e-posta, giriş türü, tema, dil, işaretler
    function writeMeta() {
        if (!user) return Promise.resolve();
        var prov = (user.providerData && user.providerData[0] && user.providerData[0].providerId) || "password";
        var fields = {
            email: { stringValue: String(user.email || "").slice(0, 120) },
            provider: { stringValue: String(prov).slice(0, 40) },
            name: { stringValue: String(user.displayName || (localProfile().name) || "").slice(0, 60) },
            theme: { stringValue: (lsGet("theme") === "dark" ? "dark" : "light") },
            cvd: { stringValue: String(lsGet("cvd-theme") || "").slice(0, 24) },
            lang: { stringValue: String(lsGet("site-lang") || "tr").slice(0, 8) },
            seen: { integerValue: String(Date.now()) },
            dev: { stringValue: deviceStr().slice(0, 40) },
            marks: { stringValue: JSON.stringify(allMarks()).slice(0, 40000) }
        };
        var mask = "?" + ["email", "provider", "name", "theme", "cvd", "lang", "seen", "dev", "marks"].map(function (k) { return "updateMask.fieldPaths=" + k; }).join("&");
        return api("/users/" + user.uid + "/meta/self" + mask, { method: "PATCH", body: JSON.stringify({ fields: fields }) }).catch(function () {});
    }
    document.addEventListener("account-synced", function () { writeProfile(); writeMeta(); logVisit(); });

    /* ---------- sosyal: takip, beğeni, bildirim ---------- */
    function pubUrl(path) { return base() + path + (path.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(cfg.apiKey); }
    function pubList(path) { return fetch(pubUrl(path + (path.indexOf("?") < 0 ? "?" : "&") + "pageSize=300")).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return (d && d.documents) || []; }).catch(function () { return []; }); }
    // Bildirim gönder (admin)
    // at: planlı gönderim zamanı (ms) — yoksa hemen. pushed:false → Web Push göndericisi alır
    function noteFields(text, at) {
        var f = { text: { stringValue: String(text).slice(0, 500) }, ts: { timestampValue: new Date().toISOString() }, pushed: { booleanValue: false } };
        if (at && at > Date.now()) f.at = { timestampValue: new Date(at).toISOString() };
        return JSON.stringify({ fields: f });
    }
    function sendNotif(tid, text, at) { if (!isAdmin()) return Promise.resolve(false); return api("/users/" + tid + "/notifications", { method: "POST", body: noteFields(text, at) }).then(function (r) { return r.ok; }); }
    function sendBroadcast(text, at) { if (!isAdmin()) return Promise.resolve(false); return api("/broadcasts", { method: "POST", body: noteFields(text, at) }).then(function (r) { return r.ok; }); }
    function effTs(f) { return Date.parse((f.at && f.at.timestampValue) || (f.ts && f.ts.timestampValue) || "") || 0; }
    function listBroadcasts() { return pubList("/broadcasts").then(function (docs) { return docs.map(function (d) { var f = d.fields || {}; return { id: d.name.split("/").pop(), text: (f.text && f.text.stringValue) || "", ts: Date.parse((f.ts && f.ts.timestampValue) || "") || 0, at: Date.parse((f.at && f.at.timestampValue) || "") || 0, pushed: !!(f.pushed && f.pushed.booleanValue) }; }).sort(function (a, b) { return (b.at || b.ts) - (a.at || a.ts); }); }); }
    function deleteBroadcast(id) { if (!isAdmin()) return Promise.resolve(false); return api("/broadcasts/" + id, { method: "DELETE" }).then(function (r) { return r.ok; }); }
    // Bakım modu (config/site): herkes okur, admin yazar
    function getConfig() { return fetch(pubUrl("/config/site")).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { var f = (d && d.fields) || {}; return { maintenance: !!(f.maintenance && f.maintenance.booleanValue), msg: (f.msg && f.msg.stringValue) || "" }; }).catch(function () { return { maintenance: false, msg: "" }; }); }
    function setMaintenance(on, msg) { if (!isAdmin()) return Promise.resolve(false); return api("/config/site?updateMask.fieldPaths=maintenance&updateMask.fieldPaths=msg", { method: "PATCH", body: JSON.stringify({ fields: { maintenance: { booleanValue: !!on }, msg: { stringValue: String(msg || "").slice(0, 300) } } }) }).then(function (r) { return r.ok; }); }
    // Bildirim oku (yeni broadcast + kendi okunmamış bildirimlerim)
    function fetchNotes() {
        var out = [], seenB = 0; try { seenB = +(lsGet("ra-bcast-seen") || 0); } catch (e) {}
        var pB = pubList("/broadcasts").then(function (docs) { docs.forEach(function (d) { var f = d.fields || {}, ts = effTs(f), txt = (f.text && f.text.stringValue) || ""; if (ts > seenB && ts <= Date.now() && txt) out.push({ id: "b:" + ts, text: txt, ts: ts }); }); });
        var pN = user ? api("/users/" + user.uid + "/notifications?pageSize=50", { method: "GET" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var seen = {}; try { (JSON.parse(lsGet("ra-note-seen")) || []).forEach(function (x) { seen[x] = 1; }); } catch (e) {}
            ((d && d.documents) || []).forEach(function (x) { var id = x.name.split("/").pop(), f = x.fields || {}, txt = (f.text && f.text.stringValue) || "", ts = effTs(f); if (!seen[id] && txt && ts <= Date.now()) out.push({ id: "n:" + id, text: txt, ts: ts }); });
        }).catch(function () {}) : Promise.resolve();
        return Promise.all([pB, pN]).then(function () { return out.sort(function (a, b) { return b.ts - a.ts; }); });
    }
    function markNotesSeen(notes) {
        var maxB = 0, ids = [];
        notes.forEach(function (n) { if (n.id.indexOf("b:") === 0) maxB = Math.max(maxB, n.ts); else if (n.id.indexOf("n:") === 0) ids.push(n.id.slice(2)); });
        if (maxB) try { lsSet("ra-bcast-seen", String(Math.max(maxB, +(lsGet("ra-bcast-seen") || 0)))); } catch (e) {}
        if (ids.length) try { var cur = JSON.parse(lsGet("ra-note-seen")) || []; lsSet("ra-note-seen", JSON.stringify(cur.concat(ids).slice(-300))); } catch (e) {}
        // Sitede görüldüyse telefona ayrıca gönderilmesin
        if (ids.length && user) ids.forEach(function (id) { api("/users/" + user.uid + "/notifications/" + id + "?updateMask.fieldPaths=pushed", { method: "PATCH", body: JSON.stringify({ fields: { pushed: { booleanValue: true } } }) }).catch(function () {}); });
    }
    // Site içi banner + (izin varsa) sistem/telefon bildirimi
    function showToast(text) {
        var host = document.getElementById("raToasts");
        if (!host) { host = document.createElement("div"); host.id = "raToasts"; host.className = "ra-toasts"; (document.body || document.documentElement).appendChild(host); }
        var el = document.createElement("div"); el.className = "ra-toast";
        el.innerHTML = '<span class="ra-toast-ic">🔔</span><div class="ra-toast-tx"></div><button class="ra-toast-x" aria-label="Kapat">✕</button>';
        el.querySelector(".ra-toast-tx").textContent = text;
        el.querySelector(".ra-toast-x").onclick = function () { el.remove(); };
        host.appendChild(el); setTimeout(function () { el.classList.add("go"); }, 12000);
    }
    function showNotes() {
        if (!enabled) return;
        fetchNotes().then(function (notes) {
            if (!notes.length) return;
            notes.slice(0, 5).forEach(function (n) { showToast(n.text); });
            if ("Notification" in window && Notification.permission === "granted" && navigator.serviceWorker) {
                // Push aboneliği varsa sistem bildirimini gönderici yapar (çift bildirim olmasın)
                navigator.serviceWorker.ready.then(function (reg) {
                    return (reg.pushManager ? reg.pushManager.getSubscription() : Promise.resolve(null)).then(function (sub) {
                        if (sub || document.hasFocus()) return;
                        notes.slice(0, 5).forEach(function (n) { try { reg.showNotification("Rubik Academy", { body: n.text, icon: "/icons/icon-192.png", tag: n.id, data: { url: "/" } }); } catch (e) {} });
                    });
                }).catch(function () {});
            }
            markNotesSeen(notes);
        });
    }

    /* ---------- güvenlik: e-posta doğrulama, şifre değiştir ---------- */
    function isPasswordUser() { return !!(user && user.providerData && user.providerData.some(function (p) { return p.providerId === "password"; })); }
    function emailVerified() { return !!(user && user.emailVerified); }
    function verifyEmail() { if (!user) return Promise.reject(new Error("signed-out")); return loadSDK().then(function (m) { return m.sendEmailVerification(auth.currentUser); }); }
    function changePassword(newPass, curPass) {
        if (!user) return Promise.reject(new Error("signed-out"));
        return loadSDK().then(function (m) {
            return m.updatePassword(auth.currentUser, newPass).catch(function (err) {
                if (!err || !/requires-recent-login/.test(err.code || "")) throw err;
                if (!curPass) { var e = new Error("reauth"); e.code = "need-current"; throw e; }
                return m.reauthenticateWithCredential(auth.currentUser, m.EmailAuthProvider.credential(user.email, curPass)).then(function () { return m.updatePassword(auth.currentUser, newPass); });
            });
        });
    }

    /* ---------- oturum geçmişi + tüm cihazlardan çıkış ---------- */
    function sessId() { var id = lsGet("ra-sess-id"); if (!id || !/^[a-z0-9]{16}$/.test(id)) { var a = "abcdefghijklmnopqrstuvwxyz0123456789", r = ""; for (var i = 0; i < 16; i++) r += a.charAt(Math.floor(Math.random() * a.length)); id = r; lsSet("ra-sess-id", id); } return id; }
    function deviceStr() {
        var ua = navigator.userAgent || "", os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "?";
        var br = /Edg/.test(ua) ? "Edge" : /OPR|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Tarayıcı";
        return br + " · " + os;
    }
    function logSession() {
        if (!user) return;
        try { if (sessionStorage.getItem("ra-sess-logged")) { return; } sessionStorage.setItem("ra-sess-logged", "1"); } catch (e) {}
        lsSet("ra-login-ts", String(Date.now()));
        api("/users/" + user.uid + "/sessions/" + sessId() + "?updateMask.fieldPaths=device&updateMask.fieldPaths=ts", { method: "PATCH", body: JSON.stringify({ fields: { device: { stringValue: deviceStr() }, ts: { integerValue: String(Date.now()) } } }) }).catch(function () {});
    }
    function listSessions() {
        if (!user) return Promise.resolve([]);
        return api("/users/" + user.uid + "/sessions?pageSize=100", { method: "GET" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var me = sessId();
            return ((d && d.documents) || []).filter(function (x) { return x.name.split("/").pop() !== "control"; }).map(function (x) {
                var f = x.fields || {}; return { sid: x.name.split("/").pop(), device: (f.device && f.device.stringValue) || "?", ts: +((f.ts && f.ts.integerValue) || 0), me: x.name.split("/").pop() === me };
            }).sort(function (a, b) { return b.ts - a.ts; });
        }).catch(function () { return []; });
    }
    function logoutOthers() {
        if (!user) return Promise.resolve(false);
        return api("/users/" + user.uid + "/sessions/control?updateMask.fieldPaths=before", { method: "PATCH", body: JSON.stringify({ fields: { before: { integerValue: String(Date.now()) } } }) })
            .then(function (r) { lsSet("ra-login-ts", String(Date.now())); try { sessionStorage.setItem("ra-sess-logged", "1"); } catch (e) {} return r.ok; });
    }
    function checkLogoutAll() {
        if (!user) return;
        api("/users/" + user.uid + "/sessions/control", { method: "GET" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            var before = d && d.fields && d.fields.before && +d.fields.before.integerValue;
            var mine = +(lsGet("ra-login-ts") || 0);
            if (before && mine && mine < before) signOut();
        }).catch(function () {});
    }
    /* ---------- Web Push aboneliği (arka plan / telefon bildirimi) ---------- */
    var VAPID_PUBLIC = "BMpaJpKyVf1rBuvqAtht6TAvoDqLokvcjkMvjB5-XZNG_ptzEqBV9xwaJTOr0Q-QX-qRo3eZ5DqxK5EvEB4wAfo";
    function pushSupported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
    function b64ToBytes(b) { b = b.replace(/-/g, "+").replace(/_/g, "/"); while (b.length % 4) b += "="; var raw = atob(b), out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
    function subId(endpoint) {
        return crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)).then(function (h) {
            return Array.prototype.map.call(new Uint8Array(h), function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("").slice(0, 32);
        });
    }
    // Aboneliği pushsubs/{id} belgesine yaz (giriş yapılmışsa kullanıcıya bağlı)
    function saveSub(sub) {
        var json = JSON.stringify(sub), uid = user ? user.uid : "", key = uid + "|" + sub.endpoint;
        if (lsGet("ra-push-saved") === key) return Promise.resolve(true);
        return subId(sub.endpoint).then(function (id) {
            var body = JSON.stringify({ fields: { sub: { stringValue: json }, uid: { stringValue: uid }, ts: { timestampValue: new Date().toISOString() } } });
            var path = "/pushsubs/" + id + "?updateMask.fieldPaths=sub&updateMask.fieldPaths=uid&updateMask.fieldPaths=ts";
            var p = user ? api(path, { method: "PATCH", body: body }) : fetch(pubUrl(path), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: body });
            return p.then(function (r) { if (r.ok) lsSet("ra-push-saved", key); return r.ok; });
        }).catch(function () { return false; });
    }
    function ensurePush() {
        if (!enabled || !pushSupported() || Notification.permission !== "granted") return Promise.resolve(false);
        return navigator.serviceWorker.ready.then(function (reg) {
            return reg.pushManager.getSubscription().then(function (sub) {
                return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
            });
        }).then(saveSub).catch(function () { return false; });
    }
    function enablePush() {
        if (!("Notification" in window)) return Promise.resolve("unsupported");
        return Notification.requestPermission().then(function (perm) { if (perm === "granted") return ensurePush().then(function () { return perm; }); return perm; });
    }
    // Siteye girene bildirim izni sor (kibar banner; "Sonra" derse 7 gün sormaz)
    function askPushBanner() {
        if (!enabled || !pushSupported() || Notification.permission !== "default") return;
        if (+(lsGet("ra-push-ask") || 0) > Date.now() || document.getElementById("raPushAsk") || document.getElementById("raMaint")) return;
        var el = document.createElement("div"); el.id = "raPushAsk"; el.className = "ra-pushask";
        el.innerHTML = '<span class="ra-pushask-ic">🔔</span><div class="ra-pushask-tx"><b>Bildirimleri aç</b><span>Duyuruları ve sana özel mesajları site kapalıyken de al.</span></div>' +
            '<button class="ra-pushask-ok">Aç</button><button class="ra-pushask-no" aria-label="Sonra">Sonra</button>';
        el.querySelector(".ra-pushask-ok").onclick = function () { el.remove(); enablePush().then(function (p) { if (p === "granted") showToast("Bildirimler açıldı ✓"); }); };
        el.querySelector(".ra-pushask-no").onclick = function () { el.remove(); lsSet("ra-push-ask", String(Date.now() + 7 * 86400000)); };
        (document.body || document.documentElement).appendChild(el);
    }
    // Site öndeyken gelen push → site içi bildirim
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", function (e) {
        var d = e.data || {}; if (d.type !== "ra-push" || !d.body) return;
        var tag = String(d.tag || ""), n = +tag.slice(2) || 0;
        try { if (tag.indexOf("n:") === 0 ? (JSON.parse(lsGet("ra-note-seen")) || []).indexOf(tag.slice(2)) >= 0 : n <= +(lsGet("ra-bcast-seen") || 0)) return; } catch (x) {}
        showToast(d.body);
        markNotesSeen([{ id: d.tag && d.tag.indexOf("n:") === 0 ? d.tag : "b:" + (+String(d.tag || "").slice(2) || 0), ts: +String(d.tag || "").slice(2) || 0 }]);
    });

    /* ---------- askıya alınmış hesap ---------- */
    function checkSuspended() {
        if (!user || isAdmin()) return;
        window.Account.getRole(user.uid).then(function (r) {
            if (r !== "askida") return;
            signOut();
            setTimeout(function () { alert("Hesabın yönetici tarafından askıya alındı. Bir hata olduğunu düşünüyorsan bizimle iletişime geç."); }, 300);
        });
    }

    // Bakım modu: açıksa admin olmayan herkese tam ekran "bakımda" göster
    function checkMaintenance() {
        if (!enabled) return;
        getConfig().then(function (c) {
            var o = document.getElementById("raMaint");
            if (!c.maintenance || isAdmin()) { if (o) o.remove(); return; }
            if (o) return;
            o = document.createElement("div"); o.id = "raMaint"; o.className = "ra-maint";
            o.innerHTML = '<div class="ra-maint-box"><div class="ra-maint-ic">🛠️</div><h1>Bakımdayız</h1><p></p><a class="ra-maint-a" href="/giris">Yönetici girişi</a></div>';
            o.querySelector("p").textContent = c.msg || "Site kısa süreliğine bakımda. Birazdan tekrar dene.";
            (document.body || document.documentElement).appendChild(o);
        });
    }

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
        getRole: function (uid) {
            var u = ((cfg.emulator && cfg.emulator.firestore) || "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents/roles/" + encodeURIComponent(uid) + "?key=" + encodeURIComponent(cfg.apiKey);
            return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                return (d && d.fields && d.fields.role && d.fields.role.stringValue) || "uye";
            }).catch(function () { return "uye"; });
        },
        token: token,
        onChange: function (f) { listeners.push(f); if (sdkP) f(user); },
        openLogin: openLogin,
        googleSignIn: doGoogle,
        emailAuth: doEmail,
        resetPassword: doReset,
        errText: function (err) { return errMsg(err); },
        txt: function (k) { return t(k); },
        signOut: signOut,
        setName: setName,
        deleteAccount: deleteAccount,
        syncNow: function () { return pushChanged(false); },
        load: loadSDK,
        isPending: function () { return lsGet(SIGNED_KEY) === "1" && !sdkP; },
        sendNotif: sendNotif, sendBroadcast: sendBroadcast, showNotes: showNotes,
        listBroadcasts: listBroadcasts, deleteBroadcast: deleteBroadcast, getConfig: getConfig, setMaintenance: setMaintenance,
        notifyPermission: enablePush, enablePush: enablePush, pushSupported: pushSupported,
        isPasswordUser: isPasswordUser, emailVerified: emailVerified, verifyEmail: verifyEmail, changePassword: changePassword,
        listSessions: listSessions, logoutOthers: logoutOthers, sessId: sessId
    };

    function init() {
        if (!enabled) return;
        renderNav();
        // Daha önce giriş yapılmışsa oturumu geri yükle (yoksa SDK hiç yüklenmez)
        if (lsGet(SIGNED_KEY) === "1" || window.RA_ACCOUNT_EAGER) loadSDK().catch(function () {});
        document.addEventListener("site-lang-change", function () { renderNav(); if (modal && modal.classList.contains("open")) renderModal(); });
        // Duyurular/bildirimler: herkese açık broadcast'leri her sayfada, kişisel bildirimleri girişten sonra göster
        setTimeout(showNotes, 1800);
        document.addEventListener("account-synced", function () { setTimeout(showNotes, 400); });
        // Bakım modu kontrolü (admin oturumu çözülsün diye kısa gecikme) + giriş/çıkışta yeniden
        setTimeout(checkMaintenance, 2200);
        // Bildirim izni: verilmişse aboneliği tazele, verilmemişse sor
        setTimeout(function () { ensurePush(); askPushBanner(); }, 4000);
        document.addEventListener("account-change", function () { checkMaintenance(); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
