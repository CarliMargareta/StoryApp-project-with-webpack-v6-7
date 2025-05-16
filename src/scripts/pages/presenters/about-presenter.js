// src/presenters/about-presenter.js

class AboutPresenter {
  constructor(view) {
    this.view = view;
    // Tidak ada dependensi lain (seperti API) yang diperlukan
  }

  // Inisialisasi presenter
  async init() {
    // Tidak ada logika khusus yang perlu dijalankan setelah view dirender
    // View sudah menampilkan konten statis melalui metode render()-nya.
    console.log("AboutPresenter init called (no actions needed).");
  }

  // Metode destroy bisa ditambahkan untuk konsistensi, meskipun tidak melakukan apa-apa
  destroy() {
    console.log("AboutPresenter destroy called (no actions needed).");
  }
}

export default AboutPresenter;
