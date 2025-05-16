// src/views/about-view.js

class AboutView {
  constructor() {
    // Tidak ada elemen spesifik yang perlu disimpan referensinya untuk halaman ini
  }

  // Mengembalikan string HTML statis untuk halaman Tentang
  async render() {
    // Konten HTML ini sama persis dengan yang ada di about-page.js asli
    return `
        <section class="container">
          <div class="about-container">
            <h1 class="about-title" tabindex="0">Tentang StoryApp</h1>
  
            <div class="about-description">
              <p>StoryApp adalah platform di mana kamu bisa membagikan cerita lengkap dengan lokasi.</p>
  
              <p class="mt-2">Aplikasi ini dibuat sebagai proyek submission untuk kelas Pengembangan Web Intermediate di Dicoding.</p>
  
              <h2 class="mt-3">Fitur</h2>
              <ul>
                <li>Melihat cerita dari pengguna lain</li>
                <li>Melihat lokasi cerita di peta</li>
                <li>Membagikan ceritamu sendiri dengan gambar dan lokasi</li>
                <li>Memotret langsung menggunakan kamera</li>
              </ul>
  
              <h2 class="mt-3">Teknologi yang Digunakan</h2>
              <ul>
                <li>HTML, CSS, dan JavaScript</li>
                <li>Webpack untuk modul bundling</li>
                <li>Leaflet untuk integrasi peta</li>
                <li>MediaDevices API untuk akses kamera</li>
                <li>View Transitions API untuk transisi halaman yang halus</li>
              </ul>
            </div>
          </div>
        </section>
      `;
  }

  // Metode afterRender bisa kosong atau dihapus karena tidak ada aksi setelah render
  async afterRender() {
    // Tidak ada yang perlu dilakukan di sini
    console.log("AboutView afterRender called (no actions needed).");
  }
}

export default AboutView;
