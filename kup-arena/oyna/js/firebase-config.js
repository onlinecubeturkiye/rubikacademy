// RA ID (Rubik Academy) Firebase ayarları — rubikacademy.fun ile aynı proje (rubikacademydb).
// Bu değerler gizli değildir; güvenlik Rubik Academy'nin firestore.rules dosyasıyla sağlanır.
// Küp Arena kaydı users/{uid}/kv/kup-arena belgesinde durur (mevcut kurallara uyar, kural değişikliği gerekmez).
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: 'AIzaSyC5veIMb1gZLo4c36HlyCPLn2SeoJy2spI',
  authDomain: 'rubikacademydb.firebaseapp.com',
  projectId: 'rubikacademydb',
  appId: '1:724519357215:web:1f51fb763b681c8ef1be2a',
};
// Telefonda Google ile giriş, siteye gidip geri dönerek yapılır.
window.RA_SITE = 'https://rubikacademy.fun';
window.RA_LINK_PAGE = 'https://rubikacademy.fun/kup-arena/baglan';
