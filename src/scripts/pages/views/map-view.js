// src/views/map-view.js
import { getToken } from "../../data/api.js";
import CONFIG from "../../config.js";

// Pastikan Leaflet (L) dan L.Control.Geocoder sudah dimuat global
// dari <script> di index.html

class MapView {
  constructor() {
    this.map = null; // Simpan instance peta Leaflet
    this.geocoderControl = null; // Referensi untuk kontrol geocoder
    this.mapContainerId = "map-view";
    this.loadingElement = null;
    this.containerElement = null; // Elemen utama section <section>
  }

  // Render HTML dasar
  async render() {
    const isLoggedIn = !!getToken();
    return `
      <section class="container" id="map-page-container">
        <h1 tabindex="0">Lokasi Cerita</h1>
         ${
           /* Komentar: Tempat untuk search bar bisa di sini jika di luar peta,
             tapi L.Control.Geocoder biasanya menambahkan dirinya ke dalam peta */ ""
         }
        ${
          !isLoggedIn
            ? `
          <div class="text-center mt-4" id="login-prompt">
            <p>Silakan login untuk melihat lokasi cerita</p>
            <a href="#/login" class="btn btn-accent mt-2">Login Sekarang</a>
          </div>
        `
            : `
          <div id="${this.mapContainerId}" class="map-view-container mt-3">
             ${
               /* Komentar: Search bar akan ditambahkan oleh Leaflet di sini saat addGeocoder dipanggil */ ""
             }
          </div>
          <div id="map-loading" class="loading" style="display: none;">
              <div class="loading-spinner"></div>
          </div>
          <div id="map-error" class="error-container" style="display: none;"></div>
        `
        }
      </section>
    `;
  }

  // Metode untuk mendapatkan ID kontainer peta
  getMapContainerId() {
    return this.mapContainerId;
  }

  // Inisialisasi peta Leaflet (dipanggil oleh Presenter)
  initializeMap(center, initialZoom) {
    const mapContainer = document.getElementById(this.mapContainerId);
    if (!mapContainer || this.map) {
      // Jangan inisialisasi jika kontainer tidak ada atau peta sudah ada
      console.warn("Map container not found or map already initialized.");
      return false;
    }

    // Hapus konten sebelumnya jika ada (misal: pesan error atau peta lama)
    mapContainer.innerHTML = "";

    // Cek ketersediaan Leaflet global (L)
    if (typeof L === "undefined") {
      console.error(
        "Leaflet (L) is not defined. Make sure it's loaded before initializing the map."
      );
      this.showError("Komponen peta gagal dimuat.");
      return false;
    }

    try {
      this.map = L.map(mapContainer).setView(center, initialZoom);
      L.tileLayer(CONFIG.MAP_TILE_URL, {
        attribution: CONFIG.MAP_ATTRIBUTION,
        maxZoom: 19, // Atau ambil dari CONFIG jika ada
      }).addTo(this.map);

      // Geocoder tidak ditambahkan di sini, tapi melalui metode addGeocoder
      console.log("MapView: Leaflet map initialized successfully.");
      return true; // Sukses inisialisasi peta dasar
    } catch (error) {
      console.error("Error initializing Leaflet map:", error);
      this.showError("Gagal menginisialisasi peta.");
      return false; // Gagal inisialisasi
    }
  }

  /**
   * Menambahkan kontrol pencarian geocoder ke peta.
   * @param {function} onLocationFoundCallback - Callback yang dipanggil saat lokasi ditemukan. Menerima event object geocoder.
   */
  addGeocoder(onLocationFoundCallback) {
    // Cek dependensi
    if (!this.map) {
      console.error("Cannot add geocoder: Map not initialized.");
      return;
    }
    if (typeof L.Control.Geocoder === "undefined") {
      console.error(
        "L.Control.Geocoder is not defined. Make sure the plugin is loaded."
      );
      // Pertimbangkan untuk menampilkan pesan ke pengguna
      // this.showError("Fitur pencarian lokasi tidak dapat dimuat.");
      return;
    }

    // Hapus kontrol geocoder lama jika ada (mencegah duplikasi)
    if (this.geocoderControl) {
      try {
        this.map.removeControl(this.geocoderControl);
        console.log("MapView: Removed existing geocoder control.");
      } catch (e) {
        console.warn("Could not remove previous geocoder control:", e);
      }
      this.geocoderControl = null;
    }

    try {
      this.geocoderControl = L.Control.geocoder({
        defaultMarkGeocode: true, // Tampilkan marker bawaan di hasil pencarian
        collapsed: false, // Jangan ciutkan search bar
        placeholder: "Cari lokasi atau alamat...",
        errorMessage: "Lokasi tidak ditemukan.",
        // Untuk opsi lebih lanjut: https://github.com/perliedman/leaflet-control-geocoder
      }).addTo(this.map);
      console.log("MapView: Geocoder control added to map.");

      // Tambahkan event listener jika callback valid
      if (
        onLocationFoundCallback &&
        typeof onLocationFoundCallback === "function"
      ) {
        this.geocoderControl.on("markgeocode", (event) => {
          console.log("MapView: markgeocode event triggered", event);
          onLocationFoundCallback(event); // Panggil callback dari presenter
        });
        console.log("MapView: Event listener attached to geocoder.");
      } else {
        console.warn(
          "MapView: No valid callback provided for geocoder results. Search will center map but presenter won't be notified."
        );
      }
    } catch (error) {
      console.error("Error adding Geocoder control:", error);
      // Bisa tampilkan pesan error di UI jika perlu
    }
  }

  // Tambahkan marker cerita ke peta (dipanggil oleh Presenter)
  addMarkers(groupedStories) {
    if (!this.map) {
      console.warn("Cannot add markers: Map not initialized.");
      return;
    }

    // Hapus marker cerita lama (jika ada) sebelum menambahkan yang baru
    // Cara lebih baik: gunakan L.LayerGroup untuk mengelola marker cerita
    this.map.eachLayer((layer) => {
      // Hati-hati: defaultMarkGeocode dari geocoder juga L.Marker
      // Kita mungkin hanya ingin menghapus marker cerita (butuh cara identifikasi)
      // Untuk sekarang, hapus semua marker:
      if (layer instanceof L.Marker) {
        this.map.removeLayer(layer);
      }
      // Hapus juga popup yang mungkin terbuka
      if (layer instanceof L.Popup) {
        this.map.closePopup(layer);
      }
    });
    console.log(
      `MapView: Adding markers for ${
        Object.keys(groupedStories).length
      } locations.`
    );

    const defaultIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    Object.values(groupedStories).forEach((stories) => {
      if (stories.length === 0) return;
      const { lat, lon } = stories[0];
      if (typeof lat !== "number" || typeof lon !== "number") {
        console.warn("Invalid coordinates for story group:", stories[0]);
        return;
      }

      const marker = L.marker([lat, lon], { icon: defaultIcon }).addTo(
        this.map
      );

      const slidesHtml = stories
        .map(
          (s) =>
            `<div class="popup-slide">
                 <img src="${s.photoUrl}" alt="${
              s.name || "Story Image"
            }" loading="lazy" />
                 <h4>${s.name || "Tanpa Nama"}</h4>
                 <p>${s.description || "Tanpa Deskripsi"}</p>
               </div>`
        )
        .join("");

      const popupContent = `
         <div class="popup-detail">
           <div class="popup-header">
             <p class="popup-coords">Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(
        5
      )}</p>
           </div>
           <div class="carousel-detail">
             ${slidesHtml}
             ${
               stories.length > 1
                 ? '<button class="carousel-prev">‹</button><button class="carousel-next">›</button>'
                 : ""
             }
           </div>
         </div>
       `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: "story-popup",
        autoPanPadding: [20, 20],
      });

      marker.on("popupopen", (e) => {
        this._setupCarousel(e.popup.getElement());
      });
    });
  }

  // Helper private untuk setup carousel dalam popup
  _setupCarousel(popupElement) {
    const carousel = popupElement?.querySelector(".carousel-detail");
    if (!carousel) return;
    const slides = carousel.querySelectorAll(".popup-slide");
    const prevBtn = carousel.querySelector(".carousel-prev");
    const nextBtn = carousel.querySelector(".carousel-next");
    let currentIndex = 0;

    if (slides.length <= 1) {
      // Sembunyikan tombol jika hanya 1 slide
      if (prevBtn) prevBtn.style.display = "none";
      if (nextBtn) nextBtn.style.display = "none";
      // Tampilkan slide pertama
      if (slides.length === 1) slides[0].style.display = "block";
      return;
    } else {
      // Pastikan tombol terlihat jika > 1 slide
      if (prevBtn) prevBtn.style.display = "block";
      if (nextBtn) nextBtn.style.display = "block";
    }

    const showSlide = (index) => {
      slides.forEach((slide, i) => {
        slide.style.display = i === index ? "block" : "none";
      });
    };

    showSlide(currentIndex); // Tampilkan slide pertama

    // Pastikan listener hanya ditambahkan sekali (meskipun event popupopen bisa berulang)
    // Cara sederhana: Hapus listener lama sebelum menambah baru (kurang ideal)
    // Cara lebih baik: Gunakan flag atau struktur data untuk melacak listener

    // Contoh sederhana (mungkin tidak ideal untuk performa tinggi):
    const newPrevBtn = prevBtn.cloneNode(true); // Clone untuk hapus listener lama
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    newPrevBtn.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      showSlide(currentIndex);
    });

    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    newNextBtn.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % slides.length;
      showSlide(currentIndex);
    });
  }

  // Sesuaikan view peta agar semua marker (cerita) terlihat
  fitMapToBounds(bounds) {
    if (!this.map || !Array.isArray(bounds) || bounds.length === 0) {
      console.warn(
        "Cannot fit map to bounds: Map not ready or bounds invalid/empty.",
        bounds
      );
      // Set view default jika bounds tidak valid
      if (this.map) this.map.setView(CONFIG.DEFAULT_MAP_CENTER, 5);
      return;
    }
    try {
      console.log("MapView: Fitting map to bounds:", bounds);
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 }); // Batasi maxZoom
    } catch (error) {
      console.error("Error fitting map bounds:", error);
      // Fallback ke default view jika error
      this.map.setView(CONFIG.DEFAULT_MAP_CENTER, 5);
    }
  }

  /**
   * Memindahkan pusat peta ke koordinat tertentu dengan tingkat zoom tertentu.
   * @param {number} lat Lintang
   * @param {number} lon Bujur
   * @param {number} zoom Tingkat zoom (opsional, default 15 untuk hasil pencarian)
   */
  centerMapAt(lat, lon, zoom = 15) {
    if (this.map && typeof lat === "number" && typeof lon === "number") {
      console.log(
        `MapView: Centering map at [${lat}, ${lon}] with zoom ${zoom}`
      );
      this.map.setView([lat, lon], zoom);
      // Opsi: Hapus marker geocoder default jika ada dan tampilkan popup sendiri
      // Atau biarkan marker default dari `defaultMarkGeocode: true`
    } else {
      console.warn("Cannot center map: Map not ready or coordinates invalid.");
    }
  }

  // Tampilkan indikator loading
  showLoading() {
    this.loadingElement =
      this.loadingElement || document.getElementById("map-loading");
    if (this.loadingElement) this.loadingElement.style.display = "flex";
    const mapContainer = document.getElementById(this.mapContainerId);
    const errorContainer = document.getElementById("map-error");
    if (mapContainer) mapContainer.style.display = "none";
    if (errorContainer) errorContainer.style.display = "none";
  }

  // Sembunyikan indikator loading
  hideLoading() {
    this.loadingElement =
      this.loadingElement || document.getElementById("map-loading");
    if (this.loadingElement) this.loadingElement.style.display = "none";
    const mapContainer = document.getElementById(this.mapContainerId);
    // Tampilkan kembali map container HANYA jika map sudah diinisialisasi
    if (mapContainer && this.map) mapContainer.style.display = "block";
  }

  // Tampilkan pesan error
  showError(message) {
    const errorContainer = document.getElementById("map-error");
    const mapContainer = document.getElementById(this.mapContainerId);
    const loadingContainer = document.getElementById("map-loading");

    if (errorContainer) {
      errorContainer.innerHTML = `<h2>Gagal Memuat Peta</h2><p>${
        message || "Terjadi kesalahan tidak diketahui."
      }</p> <a href="#/" class="btn mt-2">Kembali</a>`;
      errorContainer.style.display = "block";
    }
    // Sembunyikan map container dan loading
    if (mapContainer) mapContainer.style.display = "none";
    if (loadingContainer) loadingContainer.style.display = "none"; // Pastikan loading juga hilang
  }

  // Dipanggil setelah HTML dirender ke DOM (opsional)
  afterRender() {
    // Bisa digunakan untuk mengambil referensi elemen utama jika perlu
    this.containerElement = document.getElementById("map-page-container");
  }

  /**
   * Membersihkan listener dan referensi peta saat halaman dinavigasi keluar.
   * Dipanggil oleh Presenter.destroy().
   */
  cleanup() {
    if (this.map) {
      console.log("Cleaning up MapView...");
      // Hapus kontrol geocoder jika ada
      if (this.geocoderControl) {
        try {
          this.map.removeControl(this.geocoderControl);
          // Jika geocoder punya listener internal, coba hapus juga (tergantung plugin)
          // this.geocoderControl.off(); // Mungkin? Cek dokumentasi plugin
        } catch (e) {
          console.warn("Could not properly remove geocoder control:", e);
        }
        this.geocoderControl = null;
      }
      // Hapus semua listener dari map instance
      this.map.off();
      // Hapus map instance dari DOM dan memori Leaflet
      this.map.remove();
      this.map = null;
      console.log("MapView cleanup finished.");
    } else {
      console.log("MapView cleanup: Map instance not found.");
    }
  }
}

export default MapView;
