# StoryApp

Aplikasi web sederhana untuk berbagi cerita lengkap dengan lokasi menggunakan peta interaktif. Dibangun dengan arsitektur MVP (Model-View-Presenter).

## Daftar Isi

- [Deskripsi](#deskripsi)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Struktur Proyek](#struktur-proyek)
- [Arsitektur](#arsitektur)
- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Lisensi](#lisensi)
- [Dokumentasi File Publik](#dokumentasi-file-publik)

## Deskripsi

StoryApp adalah aplikasi frontend berbasis JavaScript yang memungkinkan pengguna untuk:

1. Melihat cerita dari pengguna lain pada daftar dan peta.
2. Menambahkan cerita baru dengan foto dan memilih lokasi di peta.
3. Melihat detail cerita lengkap dengan tanggal, deskripsi, gambar, dan peta lokasi.
4. Mendaftar dan masuk (login) untuk fitur tambah cerita.

## Prasyarat

Pastikan Anda telah menginstal:

- Node.js (versi 12+)
- npm (versi terbaru disarankan)

## Instalasi

1. **Clone** repositori:

   ```sh
   git clone <URL_REPO> storyapp
   cd storyapp
   ```

2. **Install** dependencies:

   ```sh
   npm install
   ```

## Konfigurasi

Sesuaikan berkas `src/utils/config.js` jika perlu:

```js
export default {
  BASE_URL: "https://story-api.dicoding.dev/v1",
  BASE_IMAGE_URL: "https://story-api.dicoding.dev/images",
  DEFAULT_LANGUAGE: "id-id",
  AUTH_KEY: "storyapp_auth",
  MAP_TILE_URL: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  MAP_ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  DEFAULT_MAP_CENTER: [-6.175, 106.8275],
  DEFAULT_MAP_ZOOM: 13,
};
```

## Menjalankan Aplikasi

- **Mode Development** (live reload):

  ```sh
  npm run start-dev
  ```

  Server lokal akan berjalan di `http://localhost:8080`.

- **Build Production**:

  ```sh
  npm run build
  ```

  Hasil bundling akan berada di direktori `dist/`.

- **Serve Production**:

  ```sh
  npm run serve
  ```

  Menyajikan konten dari `dist/` menggunakan `http-server`.

## Struktur Proyek

```text
project-root/
├── src/                                # Kode sumber aplikasi
│   ├── public/                         # File publik (static assets)
│   │   ├── images/                     # Gambar dan ikon
│   │   │   ├── logo.png
│   │   │   └── icons/                  # Folder yang menyimpan gambar dan icons.json untuk digunakan oleh ServiceWorker dan PWA
│   │   ├── favicon.png
│   │   ├── manifest.json               # Pengaturan Service Worker
|   |   └── sw.js                       # Service Worker untuk PWA yang mengimplementasikan WorkBox
|   |
│   ├── scripts/                        # Logika aplikasi (SPA)
│   │   ├── data/                       # Model - Akses data dan API
│   │   │   └── api.js                  # Implementasi fetch API
│   │   ├── pages/                      # Komponen halaman
│   │   │   ├── presenters/             # Presenter - Logic bisnis
│   │   │   │   ├── about-presenter.js  # Presenter halaman About
│   │   │   │   ├── add-presenter.js    # Presenter halaman Add
│   │   │   │   ├── detail-presenter.js # Presenter halaman Detail
│   │   │   │   ├── home-presenter.js   # Presenter halaman Home
│   │   │   │   ├── login-presenter.js  # Presenter halaman Login
│   │   │   │   ├── map-presenter.js    # Presenter halaman Map
│   │   │   │   └── register-presenter.js # Presenter halaman Register
│   │   │   ├── views/                  # View - Tampilan UI
│   │   │   │   ├── about-view.js       # View halaman About
│   │   │   │   ├── add-view.js         # View halaman Add
│   │   │   │   ├── detail-view.js      # View halaman Detail
│   │   │   │   ├── home-view.js        # View halaman Home
│   │   │   │   ├── login-view.js       # View halaman Login
│   │   │   │   ├── map-view.js         # View halaman Map
│   │   │   │   └── register-view.js    # View halaman Register
│   │   └── app.js                      # Inisialisasi SPA, navigasi, transisi
│   ├── routes/                         # Router dan parser URL
│   │   ├── routes.js                   # Definisi rute
│   │   └── url-parser.js               # Parser parameter URL
│   ├── utils/                          # Utilitas (formatDate, escapeHtml, dll.)
│   │   ├── config.js                   # Konfigurasi aplikasi
│   │   └── index.js                    # Fungsi-fungsi utilitas
│   └── styles/                         # File CSS utama
│       └── styles.css
├── index.html                          # Template HTML utama
├── package.json                        # Metadata dan dependensi proyek
├── package-lock.json                   # Metadata penguncian versi package
├── .gitignore                          # File yang diabaikan Git
├── STUDENT.txt                         # Informasi mahasiswa / peserta
├── webpack.common.js                   # Konfigurasi Webpack umum
├── webpack.dev.js                      # Konfigurasi Webpack untuk development
└── webpack.prod.js                     # Konfigurasi Webpack untuk production
```

## Arsitektur

Proyek ini menggunakan pola arsitektur **MVP (Model-View-Presenter)**:

- **Model** (`src/scripts/data/api.js`): Bertanggung jawab untuk komunikasi dengan API dan pengelolaan data.
- **View** (`src/scripts/pages/views/`): Bertanggung jawab untuk menampilkan UI dan menangkap interaksi pengguna.
- **Presenter** (`src/scripts/pages/presenters/`): Bertanggung jawab untuk logika bisnis, menghubungkan Model dan View.

Alur kerja MVP:

1. **View** menangkap aksi pengguna dan meneruskannya ke **Presenter**
2. **Presenter** memproses logika bisnis dan berinteraksi dengan **Model** untuk mendapatkan/memperbarui data
3. **Presenter** memperbarui **View** dengan data yang diperoleh dari **Model**
4. **View** merender tampilan yang diperbarui kepada pengguna

## Fitur

- **Autentikasi**: Registrasi dan Login menggunakan API.
- **Manajemen cerita**: Tambah, lihat daftar, lihat detail.
- **Peta interaktif**: Menampilkan lokasi cerita pada peta Leaflet.
- **Responsif dan aksesibel**: Skip-to-content, keyboard navigation.
- **View Transitions API**: Transisi halaman yang halus.

## Teknologi

- JavaScript (ES6+), HTML5, CSS3
- Webpack (module bundling)
- Babel (transpile ke ES5)
- Leaflet (peta interaktif)
- View Transitions API
- http-server (serve static files)
- Arsitektur MVP (Model-View-Presenter)

## Dokumentasi File Publik

### index.html
File utama yang merupakan entry point dari aplikasi web. Berisi:
- Struktur HTML dasar
- Link ke CSS dan JavaScript
- Komponen navigasi
- Panel notifikasi
- Konfigurasi awal untuk Service Worker
- Event listener untuk navigasi dan notifikasi

### sw.js
Service Worker yang menangani:
- **Caching**: Menyimpan aset statis untuk akses offline
- **Push Notifications**: Menangani notifikasi push dari server
- **IndexedDB**: Menyimpan notifikasi lokal
- **Event Listeners**: Menangani event push dan notificationclick
- **Komunikasi dengan Server**: Mengirim dan menerima data notifikasi

### manifest.json
File manifest untuk Progressive Web App (PWA) yang berisi:
- Metadata aplikasi
- Ikon untuk berbagai ukuran layar
- Konfigurasi tampilan (standalone, background color, theme color)
- Start URL untuk aplikasi

## Lisensi

Lisensi MIT © 2025