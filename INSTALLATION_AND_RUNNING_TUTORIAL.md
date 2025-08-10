# Dyoraireal - Tutorial Instalasi dan Menjalankan Frontend & Backend

Tutorial ini akan memandu Anda langkah demi langkah untuk menginstal dan menjalankan aplikasi Dyoraireal, baik bagian backend maupun frontend-nya.

## Prasyarat

Sebelum memulai, pastikan Anda telah menginstal perangkat lunak berikut di sistem Anda:

-   **Node.js**: Versi 18 atau yang lebih tinggi (disarankan versi LTS).
-   **npm** (Node Package Manager): Biasanya sudah terinstal bersama Node.js.
-   **Git**: Untuk mengkloning repositori proyek.

## Langkah 1: Mengkloning Repositori

Buka terminal atau command prompt Anda dan jalankan perintah berikut untuk mengkloning repositori Dyoraireal dari GitHub:

```bash
git clone https://github.com/green1st/real.git
```

Setelah proses kloning selesai, masuk ke direktori proyek:

```bash
cd real
```

## Langkah 2: Instalasi Dependensi Backend

Direktori utama proyek Dyoraireal berisi folder `Dyoraireal/` yang merupakan root dari aplikasi Node.js (backend). Masuk ke direktori tersebut dan instal semua dependensi yang diperlukan:

```bash
cd Dyoraireal
npm install
```

Proses ini akan mengunduh dan menginstal semua paket Node.js yang dibutuhkan oleh backend, termasuk Playwright untuk otomasi browser.

## Langkah 3: Konfigurasi Lingkungan (.env)

Dyoraireal menggunakan variabel lingkungan untuk konfigurasi, seperti kunci API untuk layanan Gemini (AI) dan Captcha. Anda perlu membuat file `.env` di dalam direktori `Dyoraireal/` (di mana `index.js` berada) dan menambahkan konfigurasi Anda.

Buat file bernama `.env` dan isi dengan format berikut (ganti placeholder dengan kunci API Anda yang sebenarnya):

```
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
CAPTCHA_API_KEY=YOUR_CAPTCHA_API_KEY_HERE
```

-   **`GEMINI_API_KEY`**: Ganti dengan kunci API Google Gemini Anda. Ini diperlukan agar AI dapat memproses perintah dan membuat rencana eksekusi.
-   **`CAPTCHA_API_KEY`**: Ganti dengan kunci API layanan Captcha Anda (misalnya, dari 2Captcha atau sejenisnya). Ini opsional, tetapi direkomendasikan jika Anda berencana untuk berinteraksi dengan situs yang memiliki CAPTCHA.

**Penting**: File `.env` tidak boleh di-commit ke repositori publik karena berisi informasi sensitif.

## Langkah 4: Menjalankan Backend Server

Setelah semua dependensi terinstal dan file `.env` dikonfigurasi, Anda dapat menjalankan server backend Dyoraireal. Pastikan Anda masih berada di direktori `Dyoraireal/` (yang berisi `index.js`).

Jalankan perintah berikut:

```bash
node index.js
```

Anda akan melihat pesan di terminal yang menunjukkan bahwa backend sedang berjalan, biasanya di `http://localhost:3000`.

```
AI Web Agent backend listening at http://localhost:3000
Environment: development
```

Biarkan terminal ini tetap terbuka karena ini adalah server backend Anda.

## Langkah 5: Mengakses Frontend Dashboard

Frontend Dyoraireal adalah antarmuka web yang dapat Anda akses melalui browser. Karena backend berjalan di `localhost:3000`, frontend juga akan disajikan dari sana.

Buka browser web Anda (Chrome, Firefox, Edge, dll.) dan navigasikan ke URL berikut:

```
http://localhost:3000/enhanced-index.html
```

Ini akan membuka dashboard Dyoraireal yang telah ditingkatkan, tempat Anda dapat membuat tugas, memantau eksekusi, melihat analitik, dan mengelola pengaturan.

## Langkah 6: Memantau Otomasi Browser (Mode Non-Headless)

Salah satu peningkatan utama Dyoraireal adalah konfigurasi default untuk menjalankan browser dalam mode **non-headless**. Ini berarti ketika AI menjalankan tugas otomasi web, Anda akan melihat jendela browser yang sebenarnya muncul di layar Anda dan melakukan tindakan sesuai perintah AI.

Ini sangat berguna untuk:
-   **Pemantauan Visual**: Anda dapat melihat secara langsung apa yang dilakukan AI di browser.
-   **Debugging**: Membantu Anda memahami mengapa suatu tugas mungkin gagal atau berperilaku tidak terduga.
-   **Demonstrasi**: Menunjukkan kemampuan Dyoraireal secara interaktif.

## Catatan Penting

-   **API Keys**: Pastikan kunci API Anda valid dan memiliki izin yang diperlukan untuk layanan yang relevan.
-   **Proxy Configuration**: Anda dapat mengelola daftar proxy dan mengaktifkannya melalui bagian "Settings" di dashboard frontend.
-   **Penyelesaian Tugas**: Setelah tugas selesai, browser akan otomatis ditutup.
-   **Troubleshooting**: Jika Anda mengalami masalah, periksa terminal tempat server backend berjalan untuk pesan kesalahan. Anda juga dapat membuka konsol pengembang di browser (biasanya dengan F12) untuk melihat kesalahan terkait frontend.

Selamat menggunakan Dyoraireal untuk otomasi web Anda!

