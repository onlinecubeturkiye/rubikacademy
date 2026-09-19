/* =========================================================
   RUBIK ACADEMY — ORTAK ÇEVİRİ DOSYASI (i18n.js)
   Tüm sayfalarda şu şekilde eklenir (common.js'den ÖNCE):

   <script>var PAGE_ID = "index";</script>   <!-- sayfa kimliği -->
   <script src="/js/i18n.js"></script>
   <script src="/js/common.js"></script>

   YENİ DİL EKLEMEK İÇİN (sadece bu dosya):
     1) aşağıdaki "languages" listesine bir satır ekle
        (örn. zh: { name: "中文", code: "ZH" })
     2) "common" ve her sayfa bloğuna aynı dil koduyla çeviriyi ekle
   Dil menüsü, common.js tarafından "languages" listesinden
   otomatik oluşturulur; HTML dosyalarına dokunmak gerekmez.
   YENİ SAYFA EKLEMEK İÇİN: SITE_I18N.pages altına yeni bir
   anahtar (örn. "cll") ekle, sayfada PAGE_ID = "cll" yaz.
========================================================= */

var SITE_I18N = {

    /* Desteklenen diller — dil menüsü bu listeden otomatik oluşturulur.
       name: menüde görünen ad | code: menü butonundaki kısa etiket
       dir: sadece sağdan sola yazılan diller için "rtl" (Arapça, Farsça...) */
    languages: {
        tr: { name: "Türkçe",   code: "TR" },
        en: { name: "English",  code: "EN" },
        fr: { name: "Français", code: "FR" },
        ru: { name: "Русский",  code: "RU" },
        de: { name: "Deutsch",  code: "DE" },
        ar: { name: "العربية",  code: "AR", dir: "rtl" }
    },

    /* Tüm sayfalarda ORTAK olan metinler (navbar, footer vb.) */
    common: {
        tr: {
            navHome: "Ana Sayfa",
            navContent: "İçerikler",
            footer: "© 2026 Rubik Academy. Tüm hakları saklıdır."
        },
        en: {
            navHome: "Home",
            navContent: "Content",
            footer: "© 2026 Rubik Academy. All rights reserved."
        },
        fr: {
            navHome: "Accueil",
            navContent: "Contenus",
            footer: "© 2026 Rubik Academy. Tous droits réservés."
        },
        ru: {
            navHome: "Главная",
            navContent: "Контент",
            footer: "© 2026 Rubik Academy. Все права защищены."
        },
        de: {
            navHome: "Startseite",
            navContent: "Inhalte",
            footer: "© 2026 Rubik Academy. Alle Rechte vorbehalten."
        },
        ar: {
            navHome: "الرئيسية",
            navContent: "المحتوى",
            footer: "© 2026 روبيك أكاديمي. جميع الحقوق محفوظة."
        }
    },

    /* Sayfaya özel metinler, PAGE_ID'ye göre */
    pages: {

        index: {
            tr: {
                badge: "Speedcubing'e Hoş Geldin",
                heroTitle1: "Rubik Küpü",
                heroTitleGradient: "öğren.",
                heroTitle2: "Hızını geliştir.",
                heroP: "Rubik Academy, Rubik küp çözmeyi öğrenmek ve çözüm sürelerini geliştirmek isteyenler için hazırlanmış modern ve sistemli bir eğitim platformudur.",
                heroBtn: "Öğrenmeye Başla →",
                academySpan: "Rubik Academy",
                academyH2: "Küp çözmeyi sistemli şekilde öğren.",
                academyP: "Temelden başlayıp speedcubing seviyesine kadar ilerleyebileceğin içerikler.",
                card1Title: "3x3 Rubik Küp",
                card1P: "3x3 Rubik küpü adım adım öğren. Temel hareketlerden ileri seviyeye kadar kendini geliştir.",
                card2Title: "Algoritmalar",
                card2P: "Daha hızlı çözüm yapabilmek için gerekli algoritmaları öğren ve pratik yap.",
                card3Title: "Speedcubing",
                card3P: "Çözüm sürelerini geliştir, kendi rekorlarını kır ve speedcubing dünyasında ilerle.",
                learningSpan: "Eğitim",
                learningH2: "Adım adım ilerle.",
                learningP: "Rubik küp öğrenme sürecini kolay ve anlaşılır hale getir.",
                l1num: "01 — BAŞLANGIÇ",
                l1title: "Küpü Tanı",
                l1p: "Rubik küpün yapısını, yüzlerini, merkez parçalarını, köşe ve kenar parçalarını öğren.",
                l2num: "02 — TEMEL",
                l2title: "İlk Çözümünü Yap",
                l2p: "Temel hareketleri öğrenerek Rubik küpünü baştan sona çözmeyi öğren.",
                l3num: "03 — GELİŞİM",
                l3title: "Algoritmaları Öğren",
                l3p: "Çözüm süreni azaltmak için gerekli algoritmaları çalışmaya başla.",
                l4num: "04 — SPEEDCUBING",
                l4title: "Hızını Geliştir",
                l4p: "Farklı teknikleri kullan, pratik yap ve kendi en iyi dereceni oluşturmaya çalış.",
                socialSpan: "Sosyal Medya",
                socialH2: "Rubik Academy'yi takip et.",
                socialP: "Yeni içerikleri ve speedcubing paylaşımlarını kaçırma.",
                contactH2: "Bir sorunuz mu var?",
                contactP: "Sorularınız, önerileriniz veya iş birlikleri için bizimle iletişime geçebilirsiniz."
            },
            en: {
                badge: "Welcome to Speedcubing",
                heroTitle1: "Learn the",
                heroTitleGradient: "Rubik's Cube.",
                heroTitle2: "Boost your speed.",
                heroP: "Rubik Academy is a modern, structured learning platform for anyone who wants to learn how to solve the Rubik's Cube and improve their solve times.",
                heroBtn: "Start Learning →",
                academySpan: "Rubik Academy",
                academyH2: "Learn to solve the cube, step by step.",
                academyP: "Content that takes you from the basics all the way to speedcubing level.",
                card1Title: "3x3 Rubik's Cube",
                card1P: "Learn the 3x3 Rubik's Cube step by step. Progress from basic moves to advanced techniques.",
                card2Title: "Algorithms",
                card2P: "Learn the algorithms you need for faster solves and put them into practice.",
                card3Title: "Speedcubing",
                card3P: "Improve your solve times, beat your own records, and advance in the world of speedcubing.",
                learningSpan: "Learning Path",
                learningH2: "Progress step by step.",
                learningP: "Make the process of learning the Rubik's Cube simple and clear.",
                l1num: "01 — GETTING STARTED",
                l1title: "Meet the Cube",
                l1p: "Learn the structure of the Rubik's Cube: its faces, center pieces, corner pieces, and edge pieces.",
                l2num: "02 — BASICS",
                l2title: "Solve It for the First Time",
                l2p: "Learn the basic moves and solve the Rubik's Cube from start to finish.",
                l3num: "03 — PROGRESS",
                l3title: "Learn the Algorithms",
                l3p: "Start practicing the algorithms you need to bring your solve time down.",
                l4num: "04 — SPEEDCUBING",
                l4title: "Boost Your Speed",
                l4p: "Use different techniques, practice consistently, and work toward your personal best.",
                socialSpan: "Social Media",
                socialH2: "Follow Rubik Academy.",
                socialP: "Don't miss new content and speedcubing updates.",
                contactH2: "Got a question?",
                contactP: "Feel free to reach out for questions, suggestions, or collaborations."
            },
            fr: {
                badge: "Bienvenue dans le Speedcubing",
                heroTitle1: "Apprends le",
                heroTitleGradient: "Rubik's Cube.",
                heroTitle2: "Améliore ta vitesse.",
                heroP: "Rubik Academy est une plateforme d'apprentissage moderne et structurée pour ceux qui veulent apprendre à résoudre le Rubik's Cube et améliorer leurs temps de résolution.",
                heroBtn: "Commencer →",
                academySpan: "Rubik Academy",
                academyH2: "Apprends à résoudre le cube de façon méthodique.",
                academyP: "Des contenus qui t'accompagnent des bases jusqu'au niveau speedcubing.",
                card1Title: "Rubik's Cube 3x3",
                card1P: "Apprends le Rubik's Cube 3x3 étape par étape. Progresse des mouvements de base jusqu'au niveau avancé.",
                card2Title: "Algorithmes",
                card2P: "Apprends les algorithmes nécessaires pour résoudre plus vite et mets-les en pratique.",
                card3Title: "Speedcubing",
                card3P: "Améliore tes temps, bats tes propres records et progresse dans le monde du speedcubing.",
                learningSpan: "Apprentissage",
                learningH2: "Progresse étape par étape.",
                learningP: "Rends l'apprentissage du Rubik's Cube simple et clair.",
                l1num: "01 — DÉBUT",
                l1title: "Découvre le cube",
                l1p: "Apprends la structure du Rubik's Cube : ses faces, centres, coins et arêtes.",
                l2num: "02 — BASES",
                l2title: "Résous-le pour la première fois",
                l2p: "Apprends les mouvements de base et résous le Rubik's Cube du début à la fin.",
                l3num: "03 — PROGRESSION",
                l3title: "Apprends les algorithmes",
                l3p: "Commence à pratiquer les algorithmes nécessaires pour réduire ton temps de résolution.",
                l4num: "04 — SPEEDCUBING",
                l4title: "Améliore ta vitesse",
                l4p: "Utilise différentes techniques, entraîne-toi et vise ton meilleur temps personnel.",
                socialSpan: "Réseaux sociaux",
                socialH2: "Suis Rubik Academy.",
                socialP: "Ne manque pas les nouveaux contenus et publications speedcubing.",
                contactH2: "Une question ?",
                contactP: "N'hésite pas à nous contacter pour toute question, suggestion ou collaboration."
            },
            ru: {
                badge: "Добро пожаловать в спидкубинг",
                heroTitle1: "Изучи",
                heroTitleGradient: "кубик Рубика.",
                heroTitle2: "Развивай скорость.",
                heroP: "Rubik Academy — современная и структурированная образовательная платформа для тех, кто хочет научиться собирать кубик Рубика и улучшить своё время сборки.",
                heroBtn: "Начать обучение →",
                academySpan: "Rubik Academy",
                academyH2: "Изучай сборку кубика системно.",
                academyP: "Контент, который проведёт тебя от основ до профессионального уровня.",
                card1Title: "Кубик Рубика 3x3",
                card1P: "Изучи кубик 3x3 шаг за шагом. Развивайся от базовых движений до продвинутого уровня.",
                card2Title: "Алгоритмы",
                card2P: "Изучи алгоритмы, необходимые для более быстрой сборки, и практикуйся.",
                card3Title: "Спидкубинг",
                card3P: "Улучшай время сборки, побеждай свои рекорды и развивайся в мире спидкубинга.",
                learningSpan: "Обучение",
                learningH2: "Двигайся шаг за шагом.",
                learningP: "Сделай процесс изучения кубика Рубика простым и понятным.",
                l1num: "01 — НАЧАЛО",
                l1title: "Познакомься с кубиком",
                l1p: "Изучи структуру кубика Рубика: грани, центральные, угловые и рёберные элементы.",
                l2num: "02 — ОСНОВЫ",
                l2title: "Собери его в первый раз",
                l2p: "Изучи базовые движения и собери кубик Рубика от начала до конца.",
                l3num: "03 — РАЗВИТИЕ",
                l3title: "Изучи алгоритмы",
                l3p: "Начни изучать алгоритмы, необходимые для сокращения времени сборки.",
                l4num: "04 — СПИДКУБИНГ",
                l4title: "Развивай скорость",
                l4p: "Используй разные техники, практикуйся и стремись установить свой личный рекорд.",
                socialSpan: "Социальные сети",
                socialH2: "Подпишись на Rubik Academy.",
                socialP: "Не пропускай новый контент и обновления по спидкубингу.",
                contactH2: "Есть вопрос?",
                contactP: "Свяжись с нами по любым вопросам, предложениям или сотрудничеству."
            },
            de: {
                badge: "Willkommen beim Speedcubing",
                heroTitle1: "Lerne den",
                heroTitleGradient: "Zauberwürfel.",
                heroTitle2: "Verbessere deine Geschwindigkeit.",
                heroP: "Rubik Academy ist eine moderne und strukturierte Lernplattform für alle, die lernen möchten, den Zauberwürfel zu lösen und ihre Lösungszeiten zu verbessern.",
                heroBtn: "Jetzt lernen →",
                academySpan: "Rubik Academy",
                academyH2: "Lerne systematisch, den Würfel zu lösen.",
                academyP: "Inhalte, die dich von den Grundlagen bis zum professionellen Speedcubing-Niveau begleiten.",
                card1Title: "3x3 Zauberwürfel",
                card1P: "Lerne den 3x3 Zauberwürfel Schritt für Schritt. Entwickle dich von den Grundbewegungen bis zum fortgeschrittenen Niveau.",
                card2Title: "Algorithmen",
                card2P: "Lerne die Algorithmen, die du für schnellere Lösungen brauchst, und übe sie.",
                card3Title: "Speedcubing",
                card3P: "Verbessere deine Lösungszeiten, breche deine eigenen Rekorde und entwickle dich in der Welt des Speedcubings weiter.",
                learningSpan: "Lernpfad",
                learningH2: "Schritt für Schritt vorankommen.",
                learningP: "Verpasse keine neuen Inhalte und Speedcubing-News.",
                l1num: "01 — EINSTIEG",
                l1title: "Lerne den Würfel kennen",
                l1p: "Lerne den Aufbau des Zauberwürfels kennen: Seiten, Mittelsteine, Eckensteine und Kantensteine.",
                l2num: "02 — GRUNDLAGEN",
                l2title: "Löse ihn zum ersten Mal",
                l2p: "Lerne die Grundbewegungen und löse den Zauberwürfel von Anfang bis Ende.",
                l3num: "03 — FORTSCHRITT",
                l3title: "Lerne die Algorithmen",
                l3p: "Beginne mit dem Üben der Algorithmen, die du brauchst, um deine Lösungszeit zu verkürzen.",
                l4num: "04 — SPEEDCUBING",
                l4title: "Verbessere deine Geschwindigkeit",
                l4p: "Nutze verschiedene Techniken, übe regelmäßig und arbeite an deiner persönlichen Bestzeit.",
                socialSpan: "Soziale Medien",
                socialH2: "Folge Rubik Academy.",
                socialP: "Verpasse keine neuen Inhalte und Speedcubing-Beiträge.",
                contactH2: "Hast du eine Frage?",
                contactP: "Kontaktiere uns gerne bei Fragen, Vorschlägen oder für Kooperationen."
            },
            ar: {
                badge: "مرحبًا بك في السبيدكيوبنج",
                heroTitle1: "تعلّم",
                heroTitleGradient: "مكعب روبيك.",
                heroTitle2: "طوّر سرعتك.",
                heroP: "روبيك أكاديمي هي منصة تعليمية حديثة ومنظمة لكل من يريد تعلّم حل مكعب روبيك وتحسين وقت الحل لديه.",
                heroBtn: "ابدأ التعلم ←",
                academySpan: "روبيك أكاديمي",
                academyH2: "تعلّم حل المكعب بطريقة منظمة.",
                academyP: "محتوى يأخذك من الأساسيات إلى مستوى احترافي في السبيدكيوبنج.",
                card1Title: "مكعب روبيك 3×3",
                card1P: "تعلّم مكعب روبيك 3×3 خطوة بخطوة. طوّر نفسك من الحركات الأساسية إلى المستوى المتقدم.",
                card2Title: "الخوارزميات",
                card2P: "تعلّم الخوارزميات اللازمة لحل أسرع ومارسها.",
                card3Title: "السبيدكيوبنج",
                card3P: "حسّن وقت حلك، اكسر أرقامك القياسية، وتقدّم في عالم السبيدكيوبنج.",
                learningSpan: "التعلّم",
                learningH2: "تقدّم خطوة بخطوة.",
                learningP: "اجعل عملية تعلّم مكعب روبيك بسيطة وواضحة.",
                l1num: "01 — البداية",
                l1title: "تعرّف على المكعب",
                l1p: "تعرّف على بنية مكعب روبيك: أوجهه، القطع المركزية، قطع الزوايا وقطع الحواف.",
                l2num: "02 — الأساسيات",
                l2title: "احلّه لأول مرة",
                l2p: "تعلّم الحركات الأساسية وحلّ مكعب روبيك من البداية إلى النهاية.",
                l3num: "03 — التطور",
                l3title: "تعلّم الخوارزميات",
                l3p: "ابدأ بممارسة الخوارزميات اللازمة لتقليل وقت حلّك.",
                l4num: "04 — السبيدكيوبنج",
                l4title: "طوّر سرعتك",
                l4p: "استخدم تقنيات مختلفة، مارس باستمرار، واسعَ لتحقيق أفضل وقت لك.",
                socialSpan: "وسائل التواصل",
                socialH2: "تابع روبيك أكاديمي.",
                socialP: "لا تفوّت المحتوى الجديد ومنشورات السبيدكيوبنج.",
                contactH2: "هل لديك سؤال؟",
                contactP: "لا تتردد في التواصل معنا للأسئلة أو الاقتراحات أو التعاون."
            }
        },

        icerikler: {
            tr: {
                ic_title: "Eğitim İçerikleri",
                ic_intro: "Küp çözmeyi öğrenmek için ihtiyacın olan her şey burada: adım adım video anlatımlar, ezberlemen gereken algoritmalar ve gelişimini takip edeceğin zamanlayıcı aracı.",
                tag_video: "VİDEO ANLATIM",
                item_videos: "Videolar",
                item_videos_p: "2×2'den 7×7'ye, Pyraminx'ten Megaminx'e kadar tüm küpler için adım adım video eğitimleri.",
                tag_algo: "REFERANS",
                item_algos: "Algoritmalar",
                item_algos_p: "OLL, PLL, F2L ve daha fazlası — hız geliştirmen için gereken tüm algoritma listeleri tek yerde.",
                tag_tool: "ARAÇ",
                item_zkt_p: "Çözüm sürelerini kaydet, ortalamanı takip et ve gelişimini zaman içinde karşılaştır.",
                cta_go: "İncele →"
            },
            en: {
                ic_title: "Learning Content",
                ic_intro: "Everything you need to learn to solve cubes: step-by-step video tutorials, the algorithms you'll need to memorize, and a timer to track your progress.",
                tag_video: "VIDEO TUTORIALS",
                item_videos: "Videos",
                item_videos_p: "From 2×2 to 7×7, Pyraminx to Megaminx — step-by-step video tutorials for every cube.",
                tag_algo: "REFERENCE",
                item_algos: "Algorithms",
                item_algos_p: "OLL, PLL, F2L and more — every algorithm list you need to build speed, in one place.",
                tag_tool: "TOOL",
                item_zkt_p: "Log your solve times, track your average, and compare your progress over time.",
                cta_go: "Explore →"
            },
            fr: {
                ic_title: "Contenus d'apprentissage",
                ic_intro: "Tout ce dont tu as besoin pour apprendre à résoudre les cubes : des vidéos explicatives étape par étape, les algorithmes à mémoriser et un chronomètre pour suivre ta progression.",
                tag_video: "TUTORIELS VIDÉO",
                item_videos: "Vidéos",
                item_videos_p: "Du 2×2 au 7×7, du Pyraminx au Megaminx — des tutoriels vidéo étape par étape pour chaque cube.",
                tag_algo: "RÉFÉRENCE",
                item_algos: "Algorithmes",
                item_algos_p: "OLL, PLL, F2L et bien plus — toutes les listes d'algorithmes dont tu as besoin pour gagner en vitesse, au même endroit.",
                tag_tool: "OUTIL",
                item_zkt_p: "Enregistre tes temps de résolution, suis ta moyenne et compare ta progression au fil du temps.",
                cta_go: "Découvrir →"
            },
            ru: {
                ic_title: "Учебные материалы",
                ic_intro: "Всё, что нужно для обучения сборке кубиков: пошаговые видеоуроки, алгоритмы для запоминания и таймер для отслеживания прогресса.",
                tag_video: "ВИДЕОУРОКИ",
                item_videos: "Видео",
                item_videos_p: "От 2×2 до 7×7, от Пирамидки до Мегаминкса — пошаговые видеоуроки для каждого кубика.",
                tag_algo: "СПРАВОЧНИК",
                item_algos: "Алгоритмы",
                item_algos_p: "OLL, PLL, F2L и многое другое — все списки алгоритмов для набора скорости в одном месте.",
                tag_tool: "ИНСТРУМЕНТ",
                item_zkt_p: "Записывай время сборки, отслеживай среднее значение и сравнивай прогресс со временем.",
                cta_go: "Открыть →"
            },
            de: {
                ic_title: "Lerninhalte",
                ic_intro: "Alles, was du zum Würfellösen brauchst: Schritt-für-Schritt-Videoanleitungen, die Algorithmen, die du auswendig lernen musst, und ein Timer, um deinen Fortschritt zu verfolgen.",
                tag_video: "VIDEOANLEITUNGEN",
                item_videos: "Videos",
                item_videos_p: "Von 2×2 bis 7×7, von Pyraminx bis Megaminx — Schritt-für-Schritt-Videoanleitungen für jeden Würfel.",
                tag_algo: "REFERENZ",
                item_algos: "Algorithmen",
                item_algos_p: "OLL, PLL, F2L und mehr — alle Algorithmuslisten, die du für mehr Geschwindigkeit brauchst, an einem Ort.",
                tag_tool: "TOOL",
                item_zkt_p: "Erfasse deine Lösungszeiten, verfolge deinen Durchschnitt und vergleiche deinen Fortschritt über die Zeit.",
                cta_go: "Entdecken →"
            },
            ar: {
                ic_title: "المحتوى التعليمي",
                ic_intro: "كل ما تحتاجه لتعلّم حل المكعبات: دروس فيديو خطوة بخطوة، الخوارزميات التي يجب حفظها، وأداة توقيت لتتبع تقدّمك.",
                tag_video: "دروس فيديو",
                item_videos: "الفيديوهات",
                item_videos_p: "من 2×2 إلى 7×7، ومن Pyraminx إلى Megaminx — دروس فيديو خطوة بخطوة لكل مكعب.",
                tag_algo: "مرجع",
                item_algos: "الخوارزميات",
                item_algos_p: "OLL وPLL وF2L والمزيد — جميع قوائم الخوارزميات التي تحتاجها لزيادة السرعة في مكان واحد.",
                tag_tool: "أداة",
                item_zkt_p: "سجّل أوقات حلك، وتتبّع متوسطك، وقارن تقدّمك عبر الزمن.",
                cta_go: "استكشف ←"
            }
        },

        notfound: {
            tr: {
                nf_pageTitle: "Rubik Academy - Sayfa Bulunamadı (404)",
                nf_badge: "HATA 404",
                nf_title: "Sayfa Bulunamadı",
                nf_desc: "Aradığın sayfa taşınmış, silinmiş veya hiç var olmamış olabilir. Küp çözmeye devam etmek için ana sayfaya dön.",
                nf_btn: "Ana Sayfaya Dön"
            },
            en: {
                nf_pageTitle: "Rubik Academy - Page Not Found (404)",
                nf_badge: "ERROR 404",
                nf_title: "Page Not Found",
                nf_desc: "The page you are looking for might have been moved, deleted, or never existed. Return to the homepage to keep solving cubes.",
                nf_btn: "Back to Home"
            },
            fr: {
                nf_pageTitle: "Rubik Academy - Page introuvable (404)",
                nf_badge: "ERREUR 404",
                nf_title: "Page introuvable",
                nf_desc: "La page que tu cherches a peut-être été déplacée, supprimée ou n'a jamais existé. Retourne à l'accueil pour continuer à résoudre des cubes.",
                nf_btn: "Retour à l'accueil"
            },
            ru: {
                nf_pageTitle: "Rubik Academy - Страница не найдена (404)",
                nf_badge: "ОШИБКА 404",
                nf_title: "Страница не найдена",
                nf_desc: "Страница, которую ты ищешь, возможно, была перемещена, удалена или никогда не существовала. Вернись на главную, чтобы продолжить собирать кубики.",
                nf_btn: "На главную"
            },
            de: {
                nf_pageTitle: "Rubik Academy - Seite nicht gefunden (404)",
                nf_badge: "FEHLER 404",
                nf_title: "Seite nicht gefunden",
                nf_desc: "Die Seite, die du suchst, wurde möglicherweise verschoben, gelöscht oder hat nie existiert. Kehre zur Startseite zurück, um weiter Würfel zu lösen.",
                nf_btn: "Zurück zur Startseite"
            },
            ar: {
                nf_pageTitle: "روبيك أكاديمي - الصفحة غير موجودة (404)",
                nf_badge: "خطأ 404",
                nf_title: "الصفحة غير موجودة",
                nf_desc: "ربما تم نقل الصفحة التي تبحث عنها أو حذفها أو لم تكن موجودة أصلًا. عد إلى الصفحة الرئيسية لمتابعة حل المكعبات.",
                nf_btn: "العودة إلى الرئيسية"
            }
        }

        /* Diğer sayfalar (örn. "cll", "3x3" vb.) buraya aynı şekilde eklenir.
           Bir önceki bloktan sonra virgül koymayı unutma:
        ,
        cll: {
            tr: { ... },
            en: { ... },
            fr: { ... },
            ru: { ... },
            de: { ... },
            ar: { ... }
        }
        */

    }
};
