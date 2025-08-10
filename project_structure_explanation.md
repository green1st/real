# Penjelasan Struktur Proyek Dyoraireal

Proyek Dyoraireal terdiri dari dua bagian utama: **Backend** dan **Frontend**. Keduanya bekerja sama untuk menyediakan fungsionalitas AI Web Agent.

## 1. Backend

Backend adalah inti dari aplikasi Dyoraireal yang bertanggung jawab untuk logika bisnis, manajemen tugas, interaksi dengan browser (melalui Playwright), integrasi AI, dan penyimpanan data. Backend dibangun menggunakan **Node.js**.

### Lokasi File Backend:

Sebagian besar file backend berada di dalam direktori `Dyoraireal/` (setelah Anda mengkloning repositori, ini adalah direktori root proyek).

-   **`Dyoraireal/index.js`**: Ini adalah titik masuk utama aplikasi backend. File ini menginisialisasi server Express, mengatur rute API, dan memulai aplikasi.

-   **`Dyoraireal/src/controllers/`**: Direktori ini berisi logika penanganan permintaan HTTP (controllers) untuk berbagai fitur:
    -   `dataController.js`: Mengelola operasi terkait data.
    -   `settingsController.js`: Mengelola pengaturan aplikasi.
    -   `taskController.js`: Mengelola pembuatan, eksekusi, dan pemantauan tugas AI Web Agent.

-   **`Dyoraireal/src/services/`**: Direktori ini berisi modul-modul yang menyediakan layanan inti untuk aplikasi:
    -   `aiService.js`: Berinteraksi dengan model AI (misalnya, Gemini) untuk menghasilkan rencana eksekusi tugas.
    -   `browserService.js`: Mengelola interaksi dengan browser (membuka halaman, mengambil screenshot, dll.) menggunakan Playwright.
    -   `captchaService.js`: Menangani solusi CAPTCHA.
    -   `proxyService.js`: Mengelola konfigurasi dan penggunaan proxy.
    -   `stealthService.js`: Menerapkan teknik stealth untuk menghindari deteksi bot oleh situs web.

-   **`Dyoraireal/src/models/database.js`**: Berisi logika untuk berinteraksi dengan database (SQLite) untuk menyimpan informasi tugas, log, dan pengaturan.

-   **`Dyoraireal/src/routes/api.js`**: Mendefinisikan semua endpoint API yang diekspos oleh backend.

-   **`Dyoraireal/package.json` dan `package-lock.json`**: Berisi metadata proyek dan daftar dependensi Node.js yang diperlukan untuk backend.

-   **`.env`**: File konfigurasi lingkungan (tidak di-commit ke Git) yang menyimpan kunci API dan pengaturan sensitif lainnya.

## 2. Frontend

Frontend adalah antarmuka pengguna grafis (GUI) yang memungkinkan pengguna berinteraksi dengan Dyoraireal. Ini adalah dashboard web tempat pengguna dapat membuat tugas, memantau eksekusi, melihat analitik, dan mengelola pengaturan. Frontend dibangun menggunakan **HTML, CSS, dan JavaScript murni** (tanpa framework seperti React atau Vue.js untuk kesederhanaan).

### Lokasi File Frontend:

File-file frontend berada di dalam direktori `Dyoraireal/public/`.

-   **`Dyoraireal/public/enhanced-index.html`**: Ini adalah file HTML utama untuk dashboard frontend yang ditingkatkan. Ini adalah halaman yang Anda akses di browser (`http://localhost:3000/enhanced-index.html`).

-   **`Dyoraireal/public/enhanced-app.js`**: Ini adalah file JavaScript utama yang berisi semua logika frontend, termasuk:
    -   Interaksi DOM (Document Object Model).
    -   Pengambilan data dari backend melalui API.
    -   Pembaruan UI secara real-time.
    -   Logika untuk chart (menggunakan Chart.js).
    -   Penanganan event pengguna (klik tombol, input teks, dll.).

-   **`Dyoraireal/public/app.js` dan `Dyoraireal/public/index.html`**: Ini adalah versi frontend yang lebih lama/dasar. `enhanced-index.html` dan `enhanced-app.js` adalah versi yang telah ditingkatkan dan direkomendasikan untuk digunakan.

## Bagaimana Mereka Bekerja Sama

1.  **Pengguna berinteraksi dengan Frontend**: Pengguna membuka `enhanced-index.html` di browser mereka. Melalui antarmuka ini, mereka memasukkan perintah untuk tugas, melihat status tugas, atau mengubah pengaturan.

2.  **Frontend Berkomunikasi dengan Backend**: Ketika pengguna melakukan tindakan (misalnya, mengklik tombol 

