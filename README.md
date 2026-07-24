# Gemini Asistan Frontend

Şirket içi operasyonları doğal dil komutlarıyla yönetmek için geliştirilen web tabanlı asistanın kullanıcı arayüzüdür. Kullanıcı mesajlarını backend servisine iletir, asistan yanıtlarını sohbet ekranında gösterir ve geçmiş oturumların incelenmesini sağlar.

Proje React, TypeScript ve Vite kullanılarak geliştirilmiştir.

## Özellikler

- Metin veya sesli komut girişi
- Oturum bazlı asistan sohbetleri
- Devam eden isteği iptal etme
- Geçmiş sohbetleri listeleme ve görüntüleme
- Sohbetleri ilk kullanıcı komutuna göre adlandırma
- Uzun mesajlar için detay modalı
- JSON yanıtlarını okunabilir alan–değer görünümüne dönüştürme
- JSON içeriklerinde arama ve tarih filtresi
- Gemini, OpenAI ve yerel Ollama provider desteği
- Ollama kurulum ve çalışma durumu kontrolü
- Redmine bağlantı ayarları
- Ayarları PostgreSQL üzerindeki backend yapılandırmasıyla eşitleme

## Kullanılan Teknolojiler

| Teknoloji | Kullanım amacı |
|---|---|
| React 19 | Kullanıcı arayüzü |
| TypeScript | Tip güvenliği |
| Vite | Geliştirme sunucusu ve production build |
| Axios | Backend API istekleri |
| React Router | İstemci tarafı yönlendirme altyapısı |

## Sistem Yapısı

```text
Kullanıcı
   │
   ▼
React Frontend (localhost:5173)
   │
   ▼
GeminiAsistanBackend API (localhost:5131)
   ├── PostgreSQL
   ├── Python asistan servisi
   ├── Redmine
   └── Gemini / OpenAI / Ollama
```

Bu repository yalnızca frontend uygulamasını içerir. Sohbetlerin çalışması ve ayarların veritabanından yüklenebilmesi için `GeminiAsistanBackend` servisinin de çalışıyor olması gerekir.

## Gereksinimler

- [Node.js](https://nodejs.org/) 20.19 veya üzeri
- npm
- Çalışır durumda `GeminiAsistanBackend`
- Backend özelliklerine göre PostgreSQL ve Python asistan servisi
- Yerel model kullanılacaksa [Ollama](https://ollama.com/)

## Kurulum

Repository'yi klonlayın:

```bash
git clone <repository-url>
cd asistan-frontend
```

Bağımlılıkları yükleyin:

```bash
npm install
```

Backend servisinin aşağıdaki adreste çalıştığından emin olun:

```text
http://localhost:5131
```

Frontend geliştirme sunucusunu başlatın:

```bash
npm run dev
```

Tarayıcıdan aşağıdaki adresi açın:

```text
http://localhost:5173
```

Windows PowerShell script çalıştırma kısıtlaması nedeniyle `npm` komutu çalışmazsa:

```powershell
npm.cmd install
npm.cmd run dev
```

## Production Build

Production çıktısı oluşturmak için:

```bash
npm run build
```

Oluşturulan `dist` klasörünü yerel olarak kontrol etmek için:

```bash
npm run preview
```

Kod kalitesi kontrolü:

```bash
npm run lint
```

## Backend Bağlantısı

API istemcisinin varsayılan adresi:

```text
http://localhost:5131/Api
```

Bu değer şu dosyada tanımlıdır:

```text
src/api/apiClient.ts
```

Vite geliştirme sunucusu `/Api` isteklerini aynı backend adresine yönlendirecek şekilde yapılandırılmıştır.

> Backend farklı bir portta çalışacaksa `src/api/apiClient.ts`, `vite.config.ts` ve doğrudan URL kullanılan servis dosyaları birlikte güncellenmelidir.

## Ayarlar

Ayarlar ekranı aşağıdaki yapılandırmaları yönetir:

| Alan | Açıklama | Varsayılan |
|---|---|---|
| Redmine token | Redmine API erişim anahtarı | Boş |
| Uyandırma kelimesi | Sesli asistanı etkinleştiren kelime | `asistan` |
| Kapatma kelimesi | Sesli asistanı kapatan kelime | `kapat` |
| Sesli komut girişi | Mikrofon özelliğini açar veya kapatır | Kapalı |
| Aktif provider | Kullanılacak yapay zekâ sağlayıcısı | Gemini |
| Gemini model | Gemini model adı | `gemini-2.5-flash` |
| OpenAI model | OpenAI model adı | `gpt-4o-mini` |
| Ollama model | Yerel Ollama model adı | `llama3.1:8b` |
| Fallback provider | Ana provider kullanılamazsa alternatif | Ollama |

“Ayarları doğrula” işlemi veritabanında kayıt yoksa yeni kayıt oluşturur, kayıt varsa mevcut kaydı günceller. “Varsayılanlara dön” yalnızca formu varsayılan değerlere çevirir; veritabanındaki kaydı silmez.

## Proje Yapısı

```text
src/
├── api/                       # Axios istemcisi ve API servisleri
├── screens/
│   ├── AsistanSessionsScreen.tsx
│   └── SettingsScreen.tsx
├── style/                     # Ekranlara ait CSS dosyaları
├── App.tsx                    # Ana sohbet ekranı ve uygulama durumu
├── App.css
└── main.tsx                   # Uygulama başlangıç noktası
```

## Temel Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusunu başlatır |
| `npm run build` | TypeScript kontrolü ve production build çalıştırır |
| `npm run preview` | Production çıktısını yerel olarak sunar |
| `npm run lint` | ESLint kontrolünü çalıştırır |

## Sorun Giderme

### Backend'e ulaşılamıyor

- Backend'in `http://localhost:5131` adresinde çalıştığını kontrol edin.
- Backend CORS yapılandırmasında `http://localhost:5173` adresine izin verildiğini doğrulayın.
- Tarayıcının Network sekmesindeki başarısız isteği inceleyin.

### Ayarlar yenilemeden sonra yüklenmiyor

- `GET /Api/AssistanSettings/Get-All` endpoint'ini kontrol edin.
- PostgreSQL bağlantısının ve `asistan_settings` kaydının mevcut olduğundan emin olun.

### Ollama kullanılamıyor

- Ollama'nın kurulu ve servisinin çalışıyor olduğunu kontrol edin.
- Ayarlardaki model adının yerel model adıyla aynı olduğundan emin olun.
- Gerekirse terminalde `ollama list` komutunu çalıştırın.

### PowerShell npm çalıştırmıyor

PowerShell execution policy nedeniyle `npm.ps1` engellenirse komutları `npm.cmd` ile çalıştırın:

```powershell
npm.cmd run dev
```

## Güvenlik Notları

- API anahtarlarını ve Redmine token'ını repository'ye eklemeyin.
- Production ortamında backend URL'sini ortam değişkenleri üzerinden yönetmek önerilir.
- Gizli ayarların loglara veya ekran görüntülerine dahil edilmediğinden emin olun.

## Lisans

Bu repository için henüz bir lisans dosyası tanımlanmamıştır. Proje herkese açık yayınlanacaksa uygun bir `LICENSE` dosyası eklenmelidir.
