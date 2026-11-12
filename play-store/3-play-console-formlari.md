# 3. Play Console formları — cevaplar

Play Console → uygulaman → **Politika ve programlar → Uygulama içeriği**. Her bölüm aşağıda; cevaplar uygulamanın gerçek özelliklerine göre verildi.

## 1. App access (Uygulama erişimi)

- Seçim: **"Uygulamanın tamamı ya da bir kısmı kısıtlanmıştır"**
- Talimat (İngilizce yaz; Google ekibi okuyacak):

```
Most content is available without signing in. Some features (Algorithm Trainer, Cube Solver,
competitions, profile) require a free account. Test account:
  Email: <test hesabının e-postası>
  Password: <şifresi>
Sign in: bottom tab "Profil" -> "Giriş yap / Kayıt ol" -> e-posta ile giriş.
Creating competitions requires an organizer role and is not needed for review.
The admin panel is only for the site owner.
```

> Test hesabını **e-posta/şifre** ile aç (Google girişi kullanma), şifresini değiştirme, iki adımlı doğrulama açma.

## 2. Ads (Reklamlar)

- Seçim: **"Evet, uygulamamda reklam var"**
- Neden: Sitede bir küp mağazasının sponsor tanıtımı (banner) gösteriliyor. Reklam ağı / SDK kullanılmıyor, kişisel veri toplanmıyor. Uygulama içinde "Reklam içerir" etiketi görünür.

## 3. Content rating (İçerik derecelendirmesi — IARC anketi)

- E-posta: muhammederenyalcin@gmail.com
- Kategori: **"Referans, Haber veya Eğitim"** (Reference, News, or Educational)
- Sorular:
  - Şiddet, korku, cinsellik, küfür, uyuşturucu/alkol/tütün: **Hayır**
  - Kumar / gerçek para ile kumar / simüle kumar: **Hayır** (çekiliş ücretsizdir, para ya da satın alma yok)
  - **Kullanıcılar birbiriyle etkileşebilir mi / iletişim kurabilir mi: Evet** (yarışma sohbeti, herkese açık profil, sıralamalar)
  - Kullanıcı içeriği paylaşılıyor mu: **Evet** (ad, profil fotoğrafı, bio, sohbet mesajı)
  - Kullanıcının konumunu paylaşıyor mu: **Hayır**
  - Dijital ürün satın alımı: **Hayır**
  - Sınırsız internet erişimi (tarayıcı gibi): **Hayır** (yalnız kendi sitemiz; dış bağlantılar Chrome'da açılır)
- Beklenen sonuç: düşük yaş derecesi, "Kullanıcılar etkileşir" uyarısıyla.

## 4. Target audience and content (Hedef kitle)

- Hedef yaş grupları: **13–15, 16–17, 18 ve üzeri**
- **13 yaş altını seçme.** Seçersen Aileler politikası devreye girer (Google Analytics, sponsor banner ve sohbet sorun olur).
- "Uygulama çocukların ilgisini çekebilir mi?": **Hayır** — dürüst cevap: içerik ve dil gençlere/yetişkinlere yönelik. (Google buna itiraz ederse uygulama içinde yaş kapısı gerekebilir.)
- Gizlilik politikasında "13 yaş altına yönelik değildir" yazıyor ✓

## 5. Data safety (Veri güvenliği)

**Genel sorular**

| Soru | Cevap |
|---|---|
| Uygulama kullanıcı verisi topluyor ya da paylaşıyor mu? | **Evet** |
| Bütün veriler aktarım sırasında şifreleniyor mu? | **Evet** (HTTPS) |
| Kullanıcılar verilerinin silinmesini isteyebilir mi? | **Evet** — https://rubikacademy.fun/hesap-silme |
| Bağımsız güvenlik incelemesi | Hayır (zorunlu değil) |

**Paylaşım:** Hiçbir veri türü için "paylaşılıyor" işaretleme. Google (Firebase, Analytics) ve kargo firması **hizmet sağlayıcı** sayılır; Google'ın tanımına göre bu "paylaşım" değildir. Veri satılmaz.

**Toplanan veri türleri** (her biri için: _Toplanıyor_, _Paylaşılmıyor_, _Geçici değil_):

| Kategori → Tür | Zorunlu / İsteğe bağlı | Amaç |
|---|---|---|
| Kişisel bilgiler → **Ad** | İsteğe bağlı | Uygulama işlevi, Hesap yönetimi |
| Kişisel bilgiler → **E-posta adresi** | İsteğe bağlı | Hesap yönetimi, Uygulama işlevi |
| Kişisel bilgiler → **Kullanıcı kimlikleri** | İsteğe bağlı | Hesap yönetimi, Uygulama işlevi |
| Kişisel bilgiler → **Adres** | İsteğe bağlı | Uygulama işlevi (çekiliş ödülü gönderimi) |
| Kişisel bilgiler → **Telefon numarası** | İsteğe bağlı | Uygulama işlevi (çekiliş ödülü gönderimi) |
| Fotoğraflar ve videolar → **Fotoğraflar** | İsteğe bağlı | Uygulama işlevi (profil fotoğrafı) |
| Mesajlar → **Diğer uygulama içi mesajlar** | İsteğe bağlı | Uygulama işlevi (yarışma sohbeti) |
| Uygulama etkinliği → **Uygulama etkileşimleri** | İsteğe bağlı* | Analiz, Uygulama işlevi (sayfa ziyaretleri, Google Analytics) |
| Uygulama etkinliği → **Diğer kullanıcı içeriği** | İsteğe bağlı | Uygulama işlevi (bio, algoritma önerileri, puan ve yorumlar, şikayetler, yarışma süreleri) |
| Uygulama bilgileri ve performans → **Kilitlenme günlükleri** | Zorunlu* | Analiz, Uygulama işlevi (hata kayıtları) |
| Uygulama bilgileri ve performans → **Diğer uygulama performans verileri / Tanılama** | Zorunlu* | Analiz |
| Cihaz veya diğer kimlikler → **Cihaz veya diğer kimlikler** | Zorunlu* | Analiz (Google Analytics çerezi, hesapsız cihaz sayacı) |
| Konum → **Yaklaşık konum** | Zorunlu* | Analiz (Google Analytics IP'den ülke/şehir çıkarır) |

\* Google Analytics ve hata kayıtları kullanıcı seçimi olmadan çalıştığı için "zorunlu" işaretle.

**Toplanmayanlar** (işaretleme): Kesin konum, kişi listesi, takvim, SMS, finansal bilgi, sağlık, **ses** (mikrofon sinyali cihazda çözülür, gönderilmez), **kamera görüntüsü** (cihazda işlenir), dosyalar, web tarama geçmişi.

## 6. Privacy policy (Gizlilik politikası)

```
https://rubikacademy.fun/gizlilik
```

## 7. Permissions declaration (İzin beyanı)

Hassas izin yok (`INTERNET`, `POST_NOTIFICATIONS`). Ek form çıkmaz. Çıkarsa: bildirimler yarışma duyuruları ve hatırlatmalar içindir.

## 8. App category (Kategori)

**Uygulama → Eğitim**

## 9. Store listing (Mağaza girişi)

→ [2-magaza-metinleri.md](2-magaza-metinleri.md)

## 10. Pricing and distribution (Fiyat ve dağıtım)

- Fiyat: **Ücretsiz** (ücretsiz uygulama sonradan ücretliye çevrilemez)
- Ülkeler: önerim **Türkiye** ile başlamak (uygulama Türkçe); sonra istersen tüm ülkeler
- Uygulama içi satın alma: yok
- Cihazlar: Telefon ve tablet

## 11. Diğer beyanlar

| Beyan | Cevap |
|---|---|
| **Hesap silme** (Data deletion) | Uygulama hesap oluşturmaya izin veriyor: **Evet**. Silme bağlantısı: https://rubikacademy.fun/hesap-silme. Uygulama içi yol: Profil → Hesabı sil |
| **Haber uygulaması** | Hayır |
| **COVID-19 / sağlık** | Hayır |
| **Devlet uygulaması** | Hayır |
| **Finansal özellikler** | Hiçbiri |
| **Reklam kimliği (Advertising ID)** | Uygulama reklam kimliğini kullanmıyor: **Hayır** (manifestte `AD_ID` izni yok) |
| **Aileler / çocuklar** | Hedef kitlede 13 yaş altı yok |
| **Kullanıcı içeriği (UGC)** | Var: kullanım koşulları (/kosullar), uygulama içi şikayet (⚑), engelleme, yönetici moderasyonu ve hesap askıya alma mevcut |
