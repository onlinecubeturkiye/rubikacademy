# Google Play tanıtım videosu

36 sn · 1920×1080 · 30 fps · H.264 + AAC. Videonun kendisi repoda değil (büyük dosya); bu klasör onu üreten kod.

**Yeniden üretmek için** (repo kökünden):

```bash
node play-store/video/uret.mjs ~/rubik-academy-tanitim.mp4
```

Ekranlar yeniden kaydedilmesin istersen başına `KAYIT=0` ekle (`klipler/` içindeki kayıtlar kullanılır).

| Dosya | İş |
|---|---|
| `sunucu.py` | Siteyi yerelde sunar, uzantısız adresleri `.html`'e yönlendirir |
| `kaydet.mjs` | Gerçek sayfaları kaydeder: `?source=app`, açık tema, 360×640 @3x; kaydırma, dokunma, oynatıcı, süre tutma, küp çevirme |
| `sahne.html` | Sahneler, yazılar, telefon çerçevesi, geçişler (her kare `render(t)` ile çizilir) |
| `muzik.py` | Özgün müzik: kodla sentezlenir (120 BPM), telif hakkı sorunu yok |
| `uret.mjs` | Hepsini çalıştırır, kareleri çizer, ffmpeg ile MP4 yapar |
| `kucuk-resim.mjs` | YouTube küçük resmi (1280×720 JPG): `node play-store/video/kucuk-resim.mjs ~/kucuk-resim.jpg` |

Kayıt kuralları (`kaydet.mjs`): rekor tablosunun Firestore yanıtı hayali adlarla taklit edilir; antrenördeki "Akıllı küp bağla" (Bluetooth) gizlenir; ana sayfada Bluetooth'tan söz eden "Çözüm Analizi" kartına kaydırılmaz. Antrenör sayfası, giriş bilgisi kullanılmadan üye görünümüyle açılır.

## Sahneler (120 BPM, geçişler vuruşa denk gelir)

| # | Süre | Arka plan | Yazı | Telefondaki kayıt | Geçiş |
|---|---|---|---|---|---|
| 1 | 0–4,5 sn | mor | Rubik Academy · "Küpü çöz. **Hızlan.**" | Ana sayfa, hafif kaydırma | küp |
| 2 | 4,5–9,5 | turuncu | "**1.400+** algoritma tek yerde" | PLL listesi → ⋯ → ▶ İzle, 3D oynatıcı | kayma |
| 3 | 9,5–14,5 | yeşil | "Antrenörle **ezberle**, hızlan" | PLL seçimi, karıştırma, süre tutma, case gösterimi | küp |
| 4 | 14,5–20 | pembe | "Evden **canlı** yarışmalara katıl" | Ev yarışması kodu yazma → rekor tablosu (Tekil → Ao5 → 2×2) | daire açılımı |
| 5 | 20–24,5 | mavi | "Sırada ne var, **hep bil**" | Yol haritası kaydırma | küp |
| 6 | 24,5–29,5 | sarı | "Sanal **3D küple** pratik yap" | Karıştır, küpü sürükleyerek döndürme | dikey küp |
| 7 | 29,5–36 | renk geçişli | Logo · "Rubik Academy: Küp Öğren" · "Ücretsiz · Türkçe" · "Şimdi Google Play'de" | iki telefon | — |
