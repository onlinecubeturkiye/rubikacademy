# Rubik Academy — Google Play yayın paketi

Bu klasör, uygulamayı Google Play'de yayınlamak için gereken her şeyi toplar. Sırayla ilerle.

| Dosya | İçerik |
|---|---|
| [1-teknik-durum.md](1-teknik-durum.md) | Proje denetimi, yapılanlar, **senin yapman gerekenler** |
| [2-magaza-metinleri.md](2-magaza-metinleri.md) | Uygulama adı, kısa/uzun açıklama, kategori, etiketler, iletişim |
| [3-play-console-formlari.md](3-play-console-formlari.md) | Play Console'daki bütün formların cevapları (App access, Ads, Content rating, Target audience, Data safety…) |
| [4-test-ve-yayin-rehberi.md](4-test-ve-yayin-rehberi.md) | Dahili test, kapalı test (12 kişi / 14 gün), üretim başvurusu, yayın öncesi ve sonrası kontrol listeleri |
| `gorseller/uygulama-simgesi-512.png` | 512×512 uygulama simgesi |
| `gorseller/one-cikan-grafik-1024x500.png` | 1024×500 öne çıkan grafik |
| `gorseller/ekran-goruntuleri/*.png` | 7 telefon ekran görüntüsü (1080×1920) |

**Herkese açık sayfalar** (Play Console'a girilecek bağlantılar):

- Gizlilik politikası: https://rubikacademy.fun/gizlilik
- Hesap ve veri silme: https://rubikacademy.fun/hesap-silme
- Kullanım koşulları: https://rubikacademy.fun/kosullar

**Uygulama dosyası:** `android/` klasöründen GitHub Actions ("Android derlemesi") ile derlenir; imzalama yükleme anahtarıyla yapılır (anahtar bu depoda **yok**, güvenli yerde saklanmalı).

> Google'ın uygulamayı onaylayacağı garanti edilemez. Bu paket bilinen gereksinimleri karşılamak için hazırlandı; Play Console'un o günkü uyarılarını her zaman esas al.
