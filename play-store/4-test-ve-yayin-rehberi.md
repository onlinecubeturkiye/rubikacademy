# 4. Test ve yayın rehberi

## A. Yayın öncesi test planı

Telefonda test için `rubikacademy-1.2.0.apk`'yı kur ya da dahili testten yükle. Her maddeyi işaretle:

**Kurulum ve açılış**
- [ ] Uygulama açılıyor, üstte **adres çubuğu yok** (varsa assetlinks eksik — bkz. 1-teknik-durum, madde 2)
- [ ] Alttaki 5 sekme çalışıyor; geri tuşu bir önceki sayfaya dönüyor
- [ ] Koyu/açık tema, yazılar ve düğmeler ekrana sığıyor (küçük telefon + büyük telefon)

**Hesap**
- [ ] E-postayla kayıt, giriş, çıkış
- [ ] Google ile giriş
- [ ] Profil → Hesabı sil: hesap ve veriler siliniyor, tekrar girişte hesap yok

**Özellikler**
- [ ] Algoritma sayfaları, antrenör, öğrenme yolu, dersler
- [ ] Günün karıştırması ve sıralama
- [ ] Ev yarışması: odaya katıl, süre gir, sohbet, ⚑ şikayet et → admin panelinde görünüyor
- [ ] Bildirim izni (Android 13+): izin penceresi çıkıyor; yönetici duyurusu telefona bildirim olarak geliyor
- [ ] Bluetooth akıllı küp / timer (varsa)
- [ ] Kamera ile küp tarama (izin penceresi)

**Bağlantılar ve dayanıklılık**
- [ ] Profil → Gizlilik, Kullanım koşulları, Hesap silme, İletişim açılıyor
- [ ] Uçak modunda: daha önce açılan sayfalar açılıyor, uygulama çökmüyor
- [ ] Play Console → Test ve yayınlama → **Ön lansman raporu**: çökme ve uyarı yok

## B. Dahili test (Internal testing)

1. Play Console → **Test ve yayınlama → Test → Dahili test → Yeni sürüm oluştur**
2. **Play App Signing**'i kabul et (ilk sürümde sorulur).
3. `rubikacademy-1.2.0.aab` dosyasını yükle, sürüm notu yaz, kaydet ve yayınla.
4. **Test kullanıcıları** sekmesinde bir e-posta listesi oluştur (kendin dahil), bağlantıyı kopyala.
5. Bağlantıdan katılıp uygulamayı Play'den kur.
6. **Uygulama bütünlüğü → Uygulama imzalama** sayfasındaki **SHA-256**'yı bana gönder → assetlinks güncellenecek → Play'den kurulan uygulamada adres çubuğu kaybolacak.

Dahili test incelemesi yoktur, dakikalar içinde açılır; en fazla 100 test kullanıcısı.

## C. Kapalı test (Closed testing) — 12 kişi, 14 gün

13 Kasım 2023'ten sonra açılmış **kişisel** geliştirici hesaplarında üretime geçmeden önce zorunludur. Kuruluş hesaplarında zorunlu değildir.

1. **Test → Kapalı test → Kanal oluştur** (ör. "Beta").
2. Test kullanıcıları: en az **12 kişinin** Gmail adresini ekle (öneri: 15–20 kişi, ayrılanlar olabilir).
3. Aynı `.aab`'yi (ya da daha yeni sürümü) bu kanala yükle → incelemeye gönder (birkaç gün sürebilir).
4. Test kullanıcıları katılım bağlantısından **"Test kullanıcısı ol"**a basıp uygulamayı Play'den kurmalı.
5. **14 gün aralıksız** katılımda kalmalılar (ayrılıp geri gelen sayılmaz). Bu sürede uygulamayı gerçekten kullanmaları ve geri bildirim vermeleri incelemede değerlendirilir.
6. Bu sürede en az bir güncelleme yayınlaman olumlu görülür.

## D. Üretim erişimi başvurusu (Production access)

14 gün dolunca **Gösterge paneli → Üretim erişimi için başvur**. Sorulan sorular (dürüst ve somut cevapla):

- Test kullanıcılarını nasıl buldun? (ör. küp topluluğu, okul kulübü, arkadaşlar)
- Testte ne öğrendin, neyi değiştirdin? (sürüm notlarından örnek ver)
- Uygulama üretime hazır mı, neden?

İnceleme genelde birkaç gün ile bir hafta sürer. Reddedilirse belirtilen eksikleri tamamlayıp yeniden başvurulur.

## E. Üretim yayını

1. **Test ve yayınlama → Üretim → Yeni sürüm** → `.aab` yükle (versionCode her yüklemede bir artmalı).
2. Ülkeleri seç → **İncelemeye gönder**.
3. İlk yayında **aşamalı dağıtım** (%20 → %50 → %100) önerilir.

## F. Son yayın öncesi kontrol listesi

- [ ] Firebase kuralları yayınlandı (`reports` dahil)
- [ ] assetlinks.json'da Play imzalama anahtarı SHA-256'sı var; Play'den kurulan uygulamada adres çubuğu yok
- [ ] Gizlilik politikası, kullanım koşulları ve hesap silme sayfaları açılıyor
- [ ] Mağaza girişi: ad, kısa/uzun açıklama, simge, öne çıkan grafik, en az 2 ekran görüntüsü, kategori, e-posta
- [ ] Uygulama içeriği formları: App access (test hesabı), Ads, Content rating, Target audience, Data safety, Hesap silme, Reklam kimliği — hepsi ✓
- [ ] Test hesabı çalışıyor
- [ ] Kapalı test: 12+ kişi, 14 gün (kişisel hesapsa)
- [ ] Fiyat: ücretsiz; ülkeler seçildi
- [ ] versionCode bir öncekinden büyük

## G. Yayın sonrası kontrol listesi

- [ ] Play Store sayfası doğru görünüyor (ad, görseller, açıklama)
- [ ] Play'den kurulan uygulama açılıyor, adres çubuğu yok, bildirimler geliyor
- [ ] Play Console → **Android vitals**: çökme ve ANR oranı (ilk hafta her gün)
- [ ] Kullanıcı yorumlarını yanıtla
- [ ] Admin paneli → Kullanıcılar → **Şikayetler**'i düzenli kontrol et (kullanıcı içeriği politikası)
- [ ] Her yıl **hedef API** şartını takip et (Ağustos sonu); Android sürümünü yükseltip yeni versionCode ile yayınla
- [ ] Gizlilik politikası değişirse Data safety formunu da güncelle
