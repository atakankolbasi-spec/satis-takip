# Satış Takip

Firma cari hesapları, günlük satışlar, özel fiyatlar, ay sonu tahsilat ve yaşlandırma raporu.
Kurulum gerektirmeyen statik bir sitedir (GitHub Pages). Veriler ve hesaplar Supabase'de tutulur.

## Ekranlar

Özet · Satışlar · Hızlı Giriş · Firmalar · Menüler · Özel Fiyatlar · Cari Hesap · Ay Sonu · Tahsilatlar ·
Raporlar · Yedek · Kullanıcılar (yalnızca ana hesap)

Roller: **Ana hesap** (her şey, kullanıcı yönetimi), **Yönetici** (kayıt silme, firma ve fiyat düzenleme),
**Giriş yetkilisi** (satış ve tahsilat girer, silemez), **Görüntüleyen** (yalnızca görür).
Yetkiler tarayıcıda değil, veritabanı kurallarıyla (RLS) zorlanır: `supabase/kurulum.sql`.

## Kurulum (bir kez)

1. **Supabase projesi açın** (supabase.com, ücretsiz plan yeter). Bu proje yalnızca Satış Takip içindir.
2. **Authentication > Sign In / Providers > Email**: *Confirm email* seçeneğini **kapatın**.
   (Kayıt olma seçeneği açık kalmalı. Ana hesap, kullanıcıları siteden bu yolla açar. Profili olmayan bir hesap hiçbir veriyi göremez.)
3. **SQL Editor**'de `supabase/kurulum.sql` dosyasının tamamını çalıştırın.
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
- Düzenli **Yedek > Yedeği indir** almanız önerilir.
- Yazı tipleri (Inter, Plus Jakarta Sans) SIL Open Font License ile dağıtılır; lisans metinleri `fonts/` içindedir. `vendor.js`, `@supabase/supabase-js` (MIT) paketinin derlenmiş halidir.
