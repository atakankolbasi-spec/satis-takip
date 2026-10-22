# Satış Takip

Firma cari hesapları, günlük satışlar, özel fiyatlar, ay sonu tahsilat ve yaşlandırma raporu.
Kurulum gerektirmeyen statik bir sitedir (GitHub Pages). Veriler ve hesaplar Supabase'de tutulur.

## Ekranlar

Özet · Satışlar · Hızlı Giriş · Firmalar · Menüler · Özel Fiyatlar · Cari Hesap · Ay Sonu · Tahsilatlar ·
Nakit Giderler · Firma Giderleri · Raporlar · Yedek · Kullanıcılar (yalnızca ana hesap)

**Giderler:** *Nakit Giderler* kasadan yapılan harcamaları (kategori, açıklama, tutar), *Firma Giderleri* tedarikçi firmalardan alınan mal ve hizmetlerin faturalarını ve onlara yapılan ödemeleri (tedarikçi bazında kalan borç ve ekstre) tutar. Raporlar sekmesinde aylık gelir-gider tablosu (net nakit) vardır.

Roller: **Ana hesap** (her şey, kullanıcı yönetimi), **Yönetici** (kayıt silme, firma ve fiyat düzenleme),
**Giriş yetkilisi** (satış ve tahsilat girer, silemez), **Görüntüleyen** (yalnızca görür).
Yetkiler tarayıcıda değil, veritabanı kurallarıyla (RLS) zorlanır: `supabase/kurulum.sql`.

## Kurulum (bir kez)

1. **Supabase projesi açın** (supabase.com, ücretsiz plan yeter). Bu proje yalnızca Satış Takip içindir.
2. **Authentication > Sign In / Providers > Email**: *Confirm email* seçeneğini **kapatın**.
   (Kayıt olma seçeneği açık kalmalı. Ana hesap, kullanıcıları siteden bu yolla açar. Profili olmayan bir hesap hiçbir veriyi göremez.)
3. **SQL Editor**'de sırayla `supabase/kurulum.sql`, `supabase/giderler.sql`, `supabase/yedekleme.sql` dosyalarının tamamını çalıştırın. (`supabase/guncelleme.sql` son ikisinin birleşimidir; kurulum.sql daha önce çalıştırıldıysa yalnızca onu çalıştırmanız yeter.)
4. **Authentication > Users > Add user**: ana hesabın e-postasını ve şifresini girin, *Auto Confirm User* işaretli olsun.
   E-posta, `config.js` içindeki `emailTemplate` şablonunun kullanıcı adınızla doldurulmuş halidir.
   Örnek: şablon `adiniz+{u}@gmail.com`, kullanıcı adı `ana` ise e-posta `adiniz+ana@gmail.com`.
5. SQL Editor'de dosyanın en altındaki `insert into public.st_profiles ...` satırını kendi bilgilerinizle çalıştırın.
6. `config.js` dosyasına Supabase **Project URL** ve **publishable (anon) key** değerlerini ve `emailTemplate`'i yazın, kaydedin.
7. GitHub'da **Settings > Pages > Build and deployment > Deploy from a branch > main / (root)** seçin.
   Site 1-2 dakika içinde `https://KULLANICI.github.io/satis-takip/` adresinde açılır.
8. Giriş yapın (kullanıcı adı + şifre), **Yedek > Yedekten yükle** ile eski yedek dosyanızı (`satis-cari-yedek-*.json`) yükleyin,
   **Kullanıcılar** sekmesinden ekibinizin hesaplarını açın.

## Notlar

- `config.js` içindeki anahtar herkese açık olacak şekilde tasarlanmıştır; veriyi koruyan şey RLS kurallarıdır. **service_role** anahtarını asla repoya koymayın.
- Kullanıcı adları Supabase'de e-postaya çevrilir; bu adreslere e-posta gönderilmez.
- Ana hesap, bir kullanıcının şifresini Kullanıcılar > Düzenle'den sıfırlayabilir. Herkes kendi şifresini "Şifremi değiştir" ile değiştirebilir.
- **Otomatik yedekleme:** `supabase/yedekleme.sql` dosyasını (ya da `guncelleme.sql`'i) SQL Editor'de bir kez çalıştırın. Her gece 05:00'te (Türkiye saati) tüm kayıtların kopyası alınır; son 35 günün yedekleri ile her ayın ilk günü alınanlar saklanır. Yedek sekmesinden listelenir, indirilir ve geri yüklenir (geri yükleme yalnızca ana hesapta; işlemden önce bugünün yedeği otomatik alınır). Zamanlayıcı için Supabase'de **Database > Extensions > pg_cron** açık olmalı; dosya bunu kendisi açmayı dener.
- Otomatik yedekler aynı Supabase projesinin içindedir. Proje silinirse onlar da gider; ayda bir **Yedek > Dosyayı indir** ile bilgisayarınıza da bir kopya alın.
- Yazı tipleri (Inter, Plus Jakarta Sans) SIL Open Font License ile dağıtılır; lisans metinleri `fonts/` içindedir. `vendor.js`, `@supabase/supabase-js` (MIT) paketinin derlenmiş halidir.
