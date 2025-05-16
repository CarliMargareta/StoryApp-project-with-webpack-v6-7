// src/views/detail-view.js
import { formatDate } from "../../utils/index.js";
import CONFIG from "../../config.js"; // Diperlukan untuk tile layer map

class DetailView {
  constructor() {
    this.containerId = "detail-container";
    this.mapContainerId = "map-detail";
    this.containerElement = null; // Referensi ke elemen DOM
  }

  // Render struktur HTML dasar (kontainer utama)
  async render() {
    return `
      <section class="container">
        <div id="${this.containerId}" class="detail-container">
          </div>
      </section>
    `;
  }

  // Dipanggil setelah render untuk mendapatkan referensi elemen
  _getContainer() {
    if (!this.containerElement) {
      this.containerElement = document.getElementById(this.containerId);
    }
    return this.containerElement;
  }

  // Tampilkan indikator loading
  showLoading() {
    const container = this._getContainer();
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
    // Tidak perlu tindakan eksplisit jika displayStoryDetail atau showError mengganti konten.
  }

  // Tampilkan detail cerita (tanpa peta)
  displayStoryDetail(story) {
    const container = this._getContainer();
    if (!container || !story) {
      this.showError("Data cerita tidak valid.");
      return false; // Indikasikan gagal / tidak ada lokasi
    }

    // Bangun HTML untuk detail dasar
    const detailHtml = `
      <div class="detail-header">
        <h1 class="detail-name" tabindex="0">${story.name || "Tanpa Nama"}</h1>
        <p class="detail-date">${formatDate(story.createdAt)}</p>
      </div>

      <img
        src="${story.photoUrl}"
        alt="Gambar cerita oleh ${story.name || "Anonim"}"
        class="detail-image"
        loading="lazy"
      />

      <div class="detail-description">
        <p>${story.description || "Tanpa Deskripsi"}</p>
      </div>

      ${
        // Tambahkan div untuk peta jika ada lokasi
        story.lat != null && story.lon != null
          ? `<div class="map-container mt-3" id="${this.mapContainerId}"></div>`
          : ""
      }

      <div class="mt-3">
        <a href="#/" class="btn">&larr; Kembali ke Daftar Cerita</a>
      </div>
    `;

    container.innerHTML = detailHtml;

    // Kembalikan boolean yang menandakan apakah peta perlu ditampilkan
    return story.lat != null && story.lon != null;
  }

  // Tampilkan peta Leaflet (dipanggil oleh Presenter jika lokasi ada)
  displayMap(story) {
    if (typeof L === "undefined") {
      console.error("Leaflet (L) is not defined. Make sure it's loaded.");
      return; // Tidak bisa menampilkan peta jika Leaflet tidak ada
    }
    if (story.lat == null || story.lon == null) return; // Pastikan ada koordinat

    // Elemen map harus sudah ada di DOM dari displayStoryDetail
    const mapElement = document.getElementById(this.mapContainerId);

    if (!mapElement) {
      console.warn(`Map container #${this.mapContainerId} not found in DOM.`);
      return;
    }

    try {
      const map = L.map(this.mapContainerId).setView(
        [story.lat, story.lon],
        13
      ); // Zoom default

      L.tileLayer(CONFIG.MAP_TILE_URL, {
        attribution: CONFIG.MAP_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([story.lat, story.lon]).addTo(map);

      // Popup sederhana untuk marker
      marker
        .bindPopup(
          `<b>${
            story.name || "Lokasi Cerita"
          }</b><br>${story.description.substring(0, 50)}...`
        )
        .openPopup(); // Langsung buka popup
    } catch (error) {
      console.error("Error initializing detail map:", error);
      // Bisa tambahkan pesan error di area peta
      mapElement.innerHTML =
        "<p style='color:red;'>Gagal memuat peta lokasi.</p>";
    }
  }

  // Tampilkan pesan error
  showError(message) {
    const container = this._getContainer();
    if (container) {
      container.innerHTML = `
        <div class="error-container" style="padding: 20px; text-align: center;">
          <h2>Gagal Memuat Detail Cerita</h2>
          <p>${message || "Terjadi kesalahan tidak diketahui."}</p>
          <a href="#/" class="btn mt-2">&larr; Kembali</a>
        </div>
      `;
    }
  }

  // Dipanggil setelah HTML dirender (opsional)
  afterRender() {
    // Bisa digunakan untuk mendapatkan referensi awal container
    this.containerElement = document.getElementById(this.containerId);
  }
}

export default DetailView;
