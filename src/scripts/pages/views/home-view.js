// src/views/home-view.js
import { getToken } from "../../data/api.js"; // Untuk render kondisional awal
import { formatDate } from "../../utils/index.js"; // Untuk format tanggal di kartu cerita

class HomeView {
  constructor() {
    this.storiesContainerId = "stories-container";
    this.storiesContainer = null; // Referensi ke elemen DOM setelah render
  }

  // Render struktur HTML dasar
  async render() {
    const isLoggedIn = !!getToken();
    return `
      <section class="container">
        <h1 tabindex="0">Cerita Dari Seluruh Dunia</h1>

        ${
          !isLoggedIn
            ? `
          <div class="text-center mt-4" id="login-prompt">
            <p>Silakan login untuk melihat dan membagikan cerita</p>
            <a href="#/login" class="btn btn-accent mt-2">Login Sekarang</a>
          </div>
        `
            : `
          <div id="${this.storiesContainerId}" class="stories-container">
            </div>
        `
        }
      </section>
    `;
  }

  // Dipanggil setelah render untuk mendapatkan referensi elemen
  _getStoriesContainer() {
    if (!this.storiesContainer) {
      this.storiesContainer = document.getElementById(this.storiesContainerId);
    }
    return this.storiesContainer;
  }

  // Tampilkan indikator loading
  showLoading() {
    const container = this._getStoriesContainer();
    if (container) {
      container.innerHTML = `
        <div class="loading" style="display: flex; justify-content: center; align-items: center; min-height: 200px;">
          <div class="loading-spinner"></div>
        </div>
      `;
    }
  }

  // Sembunyikan loading (biasanya dengan mengganti konten)
  hideLoading() {
    // Tidak perlu tindakan eksplisit jika konten akan diganti oleh displayStories, showError, atau showEmpty
  }

  // Tampilkan daftar cerita
  displayStories(stories) {
    const container = this._getStoriesContainer();
    if (!container) return;

    container.innerHTML = ""; // Kosongkan kontainer

    if (!stories || stories.length === 0) {
      this.showEmpty(); // Tampilkan pesan kosong jika array kosong
      return;
    }

    stories.forEach((story) => {
      const storyElement = this._createStoryCardElement(story);
      container.appendChild(storyElement);
    });
  }

  // Helper untuk membuat satu elemen kartu cerita
  _createStoryCardElement(story) {
    const storyElement = document.createElement("article");
    storyElement.className = "story-card";
    storyElement.innerHTML = `
      <div class="story-image-container">
        <img
          src="${story.photoUrl}"
          alt="Gambar cerita oleh ${story.name || "Anonim"}"
          class="story-image"
          loading="lazy"
        />
      </div>
      <div class="story-content">
        <h2 class="story-name" tabindex="0">${story.name || "Tanpa Nama"}</h2>
        <p class="story-date">${formatDate(story.createdAt)}</p>
        <p class="story-desc">${story.description || "Tanpa Deskripsi"}</p>
        ${
          story.lat != null && story.lon != null // Periksa null/undefined juga
            ? `
          <div class="story-location">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Lokasi: ${Number(story.lat).toFixed(4)}, ${Number(
                story.lon
              ).toFixed(4)}
          </div>
        `
            : ""
        }
        <a href="#/detail/${story.id}" class="read-more">Baca selengkapnya</a>
      </div>
    `;
    return storyElement;
  }

  // Tampilkan pesan error
  showError(message) {
    const container = this._getStoriesContainer();
    if (container) {
      container.innerHTML = `
        <div class="error-container" style="padding: 20px; text-align: center;">
          <h2>Gagal Memuat Cerita</h2>
          <p>${message || "Terjadi kesalahan tidak diketahui."}</p>
        </div>
      `;
    }
  }

  // Tampilkan pesan jika tidak ada cerita
  showEmpty() {
    const container = this._getStoriesContainer();
    if (container) {
      container.innerHTML = `
        <div class="text-center" style="padding: 20px;">
          <p>Tidak ada cerita ditemukan. Jadilah yang pertama membagikan cerita!</p>
          <a href="#/add" class="btn btn-accent mt-2">Tambah Cerita</a>
        </div>
      `;
    }
  }

  // Dipanggil setelah HTML dirender ke DOM (opsional)
  afterRender() {
    // Mendapatkan referensi container bisa dilakukan di sini atau saat pertama kali dibutuhkan (_getStoriesContainer)
    this.storiesContainer = document.getElementById(this.storiesContainerId);
  }
}

export default HomeView;
