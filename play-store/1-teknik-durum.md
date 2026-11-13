# 1. Teknik durum ve eksik listesi

_Son denetim: 12 Kasım 2026 · Uygulama sürümü 1.2.0 (versionCode 3)_

## Uygulamanın yapısı

Uygulama bir **Trusted Web Activity (TWA)**: telefondaki Chrome motoruyla https://rubikacademy.fun sitesini tam ekran açan bir Android kabuğu. Bütün özellikler sitededir; site güncellenince uygulama da güncellenir (mağazaya yeni sürüm yüklemeden).

| Konu | Değer | Durum |
|---|---|---|
| Paket adı | `fun.rubikacademy.app` | ✓ |
| Kütüphane | `com.google.androidbrowserhelper:androidbrowserhelper:2.5.0` | ✓ |
| Android Gradle Plugin | 8.10.1, Java 17 | ✓ |
| compileSdk / targetSdk | 36 / 36 (Google Play şartı: API 36) | ✓ |
| minSdk | 23 (Android 6.0) | ✓ |
| Mimari | Yerel (native) kod yok → bütün ABI'ler | ✓ |
| Ekran yönü | Dikey (portrait) | ✓ (bilgi) |
| İzinler | `INTERNET`, `POST_NOTIFICATIONS` | ✓ gereksiz izin yok |
| Bildirimler | Site bildirimleri Android bildirimi olarak gelir (bildirim aktarımı, Android 13+ izin penceresi, tek renk simge) | ✓ 1.2.0'da eklendi |
| Chrome yoksa | Uygulama içi tarayıcı (WebView) yedeği | ✓ |
| Sürüm | versionName 1.2.0, versionCode 3 | ✓ |
| İmza | Yükleme anahtarı (upload key, 13 Kasım 2026'da yenilendi), SHA-256 `A1:99:0F:…:ED:B0` — anahtar dosyası depoda YOK, sende saklanmalı | ✓ |
| Çıktı | İmzalı `.aab` (Play) ve `.apk` (deneme) | ✓ |

**Kamera, mikrofon, Bluetooth, sensörler:** Bu izinler uygulamanın değil, Chrome'un izinleridir; site ilgili özelliği açınca Chrome sorar. Bu yüzden Android manifestinde yoklar ve Play'de izin beyanı gerektirmezler.

## Bu çalışmada yapılanlar

1. **Bildirimler (Android 13+):** `POST_NOTIFICATIONS` izni, izin isteme ekranı ve bildirim simgesi eklendi.
2. **Gizlilik politikası** baştan yazıldı; sitenin gerçekte topladığı her veri koddan çıkarılıp yazıldı (bildirim aboneliği, ev yarışması, çekiliş teslimat bilgileri, kamera/mikrofon/Bluetooth/sensörler, hata kayıtları, şikayetler, Google Analytics, sponsor alanı, saklama ve silme). → `/gizlilik`
3. **Kullanım koşulları** sayfası (içerik kuralları, yarışma/hile kuralları, şikayet ve yaptırımlar). → `/kosullar`
4. **Hesap ve veri silme** sayfası (uygulamadan, siteden ve e-postayla; neler silinir/kalır). → `/hesap-silme`
5. **Şikayet ve engelleme:** Yarışma sohbetinde her mesajda ⚑ düğmesi, herkese açık profillerde "Bu profili şikayet et"; şikayet penceresinden kişi engellenebilir (mesajları gizlenir). Şikayetler `reports` koleksiyonuna gider; admin paneli → Kullanıcılar → 🚩 Şikayetler.
6. **Uygulama içi bağlantılar:** Profil sekmesinin altında Ayarlar · Gizlilik politikası · Kullanım koşulları · Hesap ve veri silme · İletişim (uygulama modunda alt bilgi gizli olduğu için).
7. **Uygulama görünümü:** alt sekme çubuğu, sade üst menü, güvenli alan boşlukları (1.1.0).
8. **Mağaza görselleri ve metinleri** hazırlandı (bu klasör).

## Senin yapman gerekenler (sırayla)

| # | İş | Neden | Zorunlu mu |
|---|---|---|---|
| 1 | **Firebase kurallarını yayınla** (`firestore.rules`'in tamamı) | Şikayet özelliği için yeni `reports` kuralı | Zorunlu |
| 2 | Play Console'da uygulamayı oluştur, **Play App Signing**'i aç, **Uygulama imzalama anahtarı SHA-256**'yı bana gönder | `.well-known/assetlinks.json`'a eklenmezse Play'den inen uygulamada üstte adres çubuğu çıkar | Zorunlu |
| 3 | ~~İletişim e-postası~~ → `rubikacademy.iletisim@gmail.com` (onaylandı) | Mağaza ve gizlilik sayfasında görünür | ✓ Tamam |
| 4 | Reviewer için **test hesabı** aç (e-posta/şifre) | Antrenör, küp çözücü gibi bazı özellikler üyelere özel | Zorunlu |
| 5 | Kapalı test için **12 test kullanıcısı** bul | Hesap **kişisel**: 13 Kasım 2023'ten sonra açıldıysa üretime geçmeden önce 12 kişiyle 14 gün kapalı test şart (Play Console Gösterge panelinde yazar) | Zorunlu (kişisel hesap) |
| 6 | `VAPID_PRIVATE_KEY` gizli anahtarını GitHub'a ekle | Telefon bildirimleri bu anahtar olmadan gitmiyor | Önerilir |

## Bilinen riskler

- **Marka adı:** "Rubik" kelimesi Rubik's Cube'ün tescilli markasıdır. Google Play, marka sahibinden şikayet gelirse uygulamayı kaldırabilir. Uzun açıklamaya "bağımsız eğitim projesi, marka sahibiyle bağlantısı yok" notu eklendi; yine de risk tamamen ortadan kalkmaz. Uygulama adında "Rubik" yerine başka bir ad (ör. "Küp Akademi") daha güvenli olur — karar senin.
- **Web sarmalayıcı (minimum işlevsellik):** Google, yalnız bir siteyi açan uygulamaları reddedebilir. Rubik Academy'nin uygulamaya özel değeri: bildirimler, tam ekran uygulama arayüzü, akıllı küp/timer Bluetooth, çevrimdışı açılan algoritma sayfaları. Bunları mağaza açıklamasında öne çıkardık.
- **Kullanıcı içeriği:** Sohbet ve profiller kullanıcı içeriğidir; şikayetleri düzenli kontrol etmen gerekir.

## İleride (zorunlu değil)

- İnternet yokken hiç açılmamış bir sayfa için özel "bağlantı yok" ekranı (şu an önbellekteki sayfalar açılıyor).
- Tablet için yatay ekran desteği.
