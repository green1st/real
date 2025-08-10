# Research Notes: Enhancing AI Service for Adaptive Web Automation

## 1. Dynamic Planning and Self-Correction in AI Agents




### 1.1. Konsep Perencanaan Dinamis

Perencanaan dinamis dalam konteks agen AI berarti kemampuan agen untuk tidak hanya membuat rencana awal, tetapi juga untuk memodifikasi, memperbarui, atau bahkan membuat ulang rencana tersebut secara real-time berdasarkan perubahan lingkungan atau hasil eksekusi yang tidak terduga. Ini berbeda dengan perencanaan statis di mana rencana dibuat sekali di awal dan dieksekusi tanpa banyak penyesuaian.

Dalam otomasi web, perencanaan dinamis sangat penting karena lingkungan web sangat fluktuatif. Elemen HTML bisa berubah, alur kerja bisa berbeda antar situs, dan validasi form bisa bervariasi. Agen AI yang mampu merencanakan secara dinamis dapat:

*   **Menguraikan Tugas Kompleks:** Mampu memecah perintah tingkat tinggi (misalnya, "daftar akun baru") menjadi sub-tugas yang lebih kecil dan terkelola (misalnya, "navigasi ke halaman pendaftaran", "isi form", "klik tombol submit").
*   **Generasi Logika Real-time:** Menghasilkan langkah-langkah atau bahkan kode/logika baru secara *on-the-fly* untuk mengatasi masalah yang muncul atau beradaptasi dengan struktur halaman yang tidak dikenal.
*   **Adaptasi Lingkungan:** Menyesuaikan urutan tindakan atau memilih tindakan alternatif jika kondisi halaman web tidak sesuai dengan yang diharapkan oleh rencana awal.

### 1.2. Mekanisme Koreksi Diri (Self-Correction)

Koreksi diri adalah kemampuan agen AI untuk mendeteksi kesalahan atau penyimpangan dari hasil yang diharapkan selama eksekusi, menganalisis penyebabnya, dan kemudian mengambil tindakan korektif untuk kembali ke jalur yang benar atau mencapai tujuan. Tiga pilar utama koreksi diri adalah:

1.  **Deteksi Kesalahan (Error Detection):** Mengidentifikasi kapan sesuatu berjalan tidak sesuai rencana. Ini bisa berupa:
    *   Elemen tidak ditemukan (selector gagal).
    *   Respons halaman tidak sesuai (misalnya, pesan error validasi form).
    *   Waktu tunggu habis (timeout).
    *   Halaman dialihkan ke URL yang tidak diharapkan.
2.  **Refleksi (Reflection):** Menganalisis mengapa kesalahan terjadi. Ini melibatkan penggunaan model AI untuk memahami konteks kesalahan, membandingkan status aktual dengan status yang diharapkan, dan mengidentifikasi akar masalah. Misalnya, apakah selector salah? Apakah ada captcha yang tidak terdeteksi? Apakah ada perubahan UI?
3.  **Logika Coba Ulang (Retry Logic):** Berdasarkan refleksi, agen mencoba strategi alternatif atau memodifikasi rencana untuk mengatasi kesalahan. Ini bisa berarti:
    *   Mencoba selector alternatif untuk elemen yang sama.
    *   Mengisi ulang form dengan data yang berbeda jika ada kesalahan validasi.
    *   Memecahkan captcha jika terdeteksi.
    *   Menavigasi ulang ke halaman sebelumnya atau halaman yang berbeda.
    *   Meminta klarifikasi dari pengguna jika AI tidak dapat menyelesaikan masalah secara mandiri.

Dalam konteks Dyoraireal, `AIService.js` sudah memiliki fungsi `improveExecutionPlan` yang merupakan bentuk dasar dari refleksi dan logika coba ulang. Namun, ini bisa diperluas untuk menjadi lebih canggih, misalnya dengan:

*   **Analisis Halaman yang Lebih Mendalam:** Menggunakan AI untuk menganalisis *seluruh* konten halaman (tidak hanya sebagian kecil) saat terjadi kesalahan untuk mendapatkan pemahaman yang lebih baik tentang masalah.
*   **Strategi Perbaikan Berbasis Pengetahuan:** AI dapat dilatih atau diprogram dengan pengetahuan tentang pola-pola kesalahan umum dalam otomasi web dan strategi perbaikannya.
*   **Iterasi Perbaikan:** Memungkinkan beberapa putaran perbaikan rencana jika upaya pertama tidak berhasil.

### 1.3. Adaptasi Agen Cerdas

Adaptasi adalah kemampuan agen untuk menyesuaikan perilakunya seiring waktu berdasarkan pengalaman. Ini melampaui koreksi diri sesaat dan menuju pembelajaran jangka panjang. Untuk Dyoraireal, adaptasi dapat berarti:

*   **Pembelajaran Selector:** Jika agen menemukan selector yang lebih andal untuk situs web tertentu, ia dapat "mempelajari" dan memprioritaskan selector tersebut di masa mendatang.
*   **Pola Interaksi:** Mengenali pola interaksi umum pada berbagai situs web (misalnya, alur pendaftaran standar) dan menggunakannya untuk mempercepat perencanaan.
*   **Manajemen Kesalahan yang Ditingkatkan:** Mengklasifikasikan jenis kesalahan dan mengasosiasikannya dengan strategi perbaikan yang paling efektif, sehingga agen menjadi lebih efisien dalam menangani masalah yang berulang.

Konsep-konsep ini akan menjadi dasar untuk merancang peningkatan pada `AIService` Dyoraireal agar lebih "live" dan otonom.


## 2. Desain Peningkatan AIService untuk Otomasi Pendaftaran Akun

Untuk membuat AI Dyoraireal lebih "live" dan adaptif dalam skenario pendaftaran akun, kita perlu memperluas kemampuan `AIService` dan bagaimana ia berinteraksi dengan `BrowserService`. Fokus utamanya adalah pada pemahaman yang lebih mendalam tentang formulir, penanganan kesalahan yang cerdas, dan adaptasi terhadap variasi situs web.

### 2.1. Alur Kerja Pendaftaran Akun yang Ditingkatkan

Alur kerja saat ini mungkin hanya berupa serangkaian langkah `type` dan `click`. Kita akan mengubahnya menjadi alur yang lebih iteratif dan adaptif:

1.  **Perintah Awal**: Pengguna memberikan perintah seperti "Daftar akun baru di website example.com dengan email test@example.com".
2.  **Pembuatan Rencana Awal**: `AIService` membuat rencana awal yang mencakup navigasi ke halaman pendaftaran, identifikasi formulir, dan langkah-langkah pengisian dasar.
3.  **Eksekusi Iteratif**: `TaskController` akan menjalankan rencana langkah demi langkah. Setelah setiap langkah penting (misalnya, setelah mengisi formulir dan menekan submit), `BrowserService` akan memberikan umpan balik ke `AIService`.
4.  **Analisis Umpan Balik & Koreksi Diri**: `AIService` akan menganalisis status halaman saat ini (konten, URL, pesan error) dan membandingkannya dengan `expectedOutcome` dari rencana. Jika ada penyimpangan atau error, `AIService` akan merefleksikan dan memodifikasi rencana secara dinamis.
5.  **Pembelajaran (Opsional/Jangka Panjang)**: Informasi dari eksekusi yang berhasil atau pola kesalahan yang berulang dapat disimpan dan digunakan untuk meningkatkan model atau heuristik AI di masa mendatang.

### 2.2. Peningkatan pada `AIService.js`

Kita perlu menambahkan atau memodifikasi beberapa fungsi di `AIService.js`:

#### a. `createExecutionPlan` yang Lebih Cerdas

*   **Identifikasi Tujuan Akhir**: Prompt untuk Gemini harus lebih menekankan pada tujuan akhir (misalnya, "akun berhasil terdaftar") daripada hanya serangkaian tindakan.
*   **Prediksi Elemen Form**: AI harus mampu memprediksi selector umum untuk field pendaftaran (username, email, password, confirm password, captcha, submit button) bahkan sebelum navigasi, berdasarkan perintah.
*   **Penanganan Variasi Form**: Rencana awal harus mencakup fleksibilitas untuk menangani variasi umum dalam formulir pendaftaran (misalnya, field opsional, urutan field yang berbeda).

#### b. Fungsi `analyzePageForForm` (Baru)

Fungsi ini akan dipanggil oleh `BrowserService` atau `TaskController` setelah navigasi ke halaman yang diduga berisi formulir pendaftaran. Tujuannya adalah untuk:

*   **Mengekstrak Struktur Form**: Mengidentifikasi semua elemen `<input>`, `<textarea>`, `<select>`, dan `<button>` dalam formulir.
*   **Menganalisis Atribut**: Membaca atribut seperti `name`, `id`, `placeholder`, `type` (text, email, password), dan `aria-label` untuk memahami tujuan setiap field.
*   **Mendeteksi Validasi**: Mencari pola validasi dasar (misalnya, `required`, `minlength`, `maxlength`, `pattern`) atau pesan error yang sudah ada di halaman.
*   **Mengidentifikasi Captcha**: Memanfaatkan `CaptchaService` untuk mendeteksi keberadaan captcha dan jenisnya.

#### c. Fungsi `handleFormSubmissionResult` (Baru)

Fungsi ini akan dipanggil setelah formulir disubmit. Tujuannya adalah untuk menganalisis respons halaman dan menentukan langkah selanjutnya:

*   **Deteksi Keberhasilan**: Mencari indikator keberhasilan (misalnya, "Pendaftaran Berhasil", "Selamat Datang", redirect ke halaman dashboard).
*   **Deteksi Pesan Error**: Mengidentifikasi pesan error spesifik (misalnya, "Email sudah terdaftar", "Password terlalu pendek", "Captcha salah").
*   **Refleksi & Modifikasi Rencana**: Berdasarkan pesan error, AI akan memodifikasi rencana:
    *   Jika email sudah terdaftar: Menyarankan email lain atau opsi login.
    *   Jika password tidak memenuhi syarat: Menyarankan password yang lebih kuat atau sesuai aturan.
    *   Jika captcha salah: Mencoba memecahkan captcha lagi atau mencoba strategi lain.
    *   Jika ada field yang terlewat: Menambahkan langkah untuk mengisi field tersebut.
*   **Prioritas Perbaikan**: AI harus memprioritaskan perbaikan yang paling mungkin berhasil berdasarkan jenis error.

#### d. Peningkatan `improveExecutionPlan`

Fungsi ini akan menjadi lebih canggih, tidak hanya memperbaiki selector, tetapi juga mengubah alur logika berdasarkan analisis formulir dan hasil submission. Ini akan menjadi orkestrator utama untuk koreksi diri.

### 2.3. Peningkatan pada `BrowserService.js`

`BrowserService` perlu menyediakan lebih banyak informasi kontekstual kepada `AIService`:

*   **Ekstraksi Konten Halaman yang Lebih Kaya**: Selain `textContent('body')`, tambahkan fungsi untuk mengekstrak struktur DOM yang relevan (misalnya, semua form, input fields, error messages) dalam format terstruktur (JSON).
*   **Deteksi Perubahan URL/Redirect**: Memberikan informasi tentang perubahan URL setelah tindakan (misalnya, submit form) untuk membantu `AIService` memahami alur navigasi.
*   **Screenshot pada Kegagalan**: Secara otomatis mengambil screenshot saat terjadi kegagalan untuk membantu debugging dan analisis oleh AI (dan manusia).

### 2.4. Peningkatan pada `TaskController.js`

`TaskController` akan menjadi orkestrator yang lebih cerdas, mengelola loop eksekusi-umpan balik-perbaikan:

*   **Loop Eksekusi Adaptif**: Setelah setiap langkah, `TaskController` akan memanggil `AIService` untuk menganalisis status halaman dan mendapatkan langkah berikutnya atau rencana yang diperbarui.
*   **Manajemen State Tugas**: Menyimpan state yang lebih detail tentang proses pendaftaran (misalnya, data yang sudah diisi, field yang belum diisi, error yang ditemukan).

### 2.5. Contoh Skenario Pendaftaran Akun dengan Peningkatan

1.  **Perintah**: "Daftar akun di situs X dengan nama John Doe, email john.doe@example.com, password SecureP@ss123!"
2.  **AIService (createExecutionPlan)**: Membuat rencana awal: navigate -> find form -> type name -> type email -> type password -> click submit.
3.  **BrowserService (executeStep)**: Menjalankan langkah-langkah.
4.  **BrowserService (setelah submit)**: Mengirimkan konten halaman pasca-submit ke `AIService`.
5.  **AIService (handleFormSubmissionResult)**: Menganalisis konten halaman.
    *   **Skenario A (Berhasil)**: Mendeteksi "Pendaftaran Berhasil". `AIService` menandai tugas selesai.
    *   **Skenario B (Gagal - Email Sudah Terdaftar)**: Mendeteksi pesan "Email sudah terdaftar". `AIService` memodifikasi rencana: "Coba email lain: john.doe.2@example.com" atau "Saran: coba login dengan email ini".
    *   **Skenario C (Gagal - Password Tidak Memenuhi Syarat)**: Mendeteksi pesan "Password harus mengandung angka dan simbol". `AIService` memodifikasi rencana: "Coba password baru: StrongP@ss456!" dan mengulang langkah `type` untuk password.
    *   **Skenario D (Gagal - Captcha)**: Mendeteksi captcha. `AIService` memanggil `CaptchaService` untuk memecahkan, lalu melanjutkan rencana.

Dengan pendekatan ini, Dyoraireal akan menjadi jauh lebih adaptif dan mampu menangani skenario pendaftaran akun yang bervariasi dan kompleks secara lebih otonom.

