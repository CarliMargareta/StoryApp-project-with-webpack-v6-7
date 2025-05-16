// src/presenters/map-presenter.js
import { getStories, getToken } from "../../data/api.js";
import CONFIG from "../../config.js";

class MapPresenter {
  constructor(view) {
    this.view = view;
    this.api = { getStories };
    this.config = CONFIG;
    this.auth = { getToken };
  }

  // Inisialisasi Presenter
  async init() {
    if (!this.auth.getToken()) {
      console.log("Map page: User not logged in.");
      // View sudah menampilkan pesan login via render()
      return;
    }

    this.view.showLoading();

    const mapInitialized = this.view.initializeMap(
      this.config.DEFAULT_MAP_CENTER,
      5 // Zoom awal sebelum fitBounds
    );

    if (mapInitialized) {
      // --- Tambahkan Geocoder SETELAH map diinisialisasi ---
      this.view.addGeocoder(this.handleLocationFound.bind(this)); // Panggil metode view dan berikan handler
      // --- End Tambah Geocoder ---

      await this.loadStoriesAndPopulateMap();
    } else {
      // View sudah menampilkan error jika map gagal inisialisasi
      this.view.hideLoading();
    }
  }

  // Memuat data cerita dan mengisi peta
  async loadStoriesAndPopulateMap() {
    try {
      const response = await this.api.getStories();

      if (response.error) {
        throw new Error(response.message || "Gagal mengambil data cerita.");
      }
      if (!response.listStory || response.listStory.length === 0) {
        console.log("Tidak ada cerita dengan lokasi ditemukan.");
        this.view.hideLoading();
        // Tampilkan map kosong saja atau tambahkan pesan
        return;
      }

      const groupedStories = this._groupStoriesByLocation(response.listStory);
      const bounds = this._calculateBounds(groupedStories);

      this.view.addMarkers(groupedStories);
      this.view.fitMapToBounds(bounds);
    } catch (error) {
      console.error("Error loading stories for map:", error);
      this.view.showError(
        error.message || "Tidak dapat memuat data lokasi cerita."
      );
    } finally {
      this.view.hideLoading();
    }
  }

  // --- Handler Baru: Untuk Hasil Geocoder ---
  /**
   * Dipanggil oleh MapView ketika lokasi ditemukan oleh Geocoder.
   * @param {object} event - Objek event dari Leaflet Control Geocoder ('markgeocode')
   */
  handleLocationFound(event) {
    if (event && event.geocode && event.geocode.center) {
      const { lat, lng } = event.geocode.center;
      const locationName = event.geocode.name; // Nama lokasi yang ditemukan
      console.log(`Geocoder found: ${locationName} at [${lat}, ${lng}]`);

      // Instruksikan View untuk memusatkan peta ke lokasi hasil pencarian
      // Gunakan zoom level yang lebih tinggi, misal 15
      this.view.centerMapAt(lat, lng, 15);

      // Opsional: Tampilkan popup sementara di lokasi hasil pencarian
      // Bisa dibuat lebih canggih jika diperlukan
      if (this.view.map) {
        // Pastikan peta ada
        L.popup()
          .setLatLng([lat, lng])
          .setContent(locationName || "Hasil Pencarian")
          .openOn(this.view.map);
      }
    } else {
      console.warn("Geocoder event received without valid coordinates:", event);
    }
  }
  // --- End Handler Baru ---

  // Helper untuk mengelompokkan cerita
  _groupStoriesByLocation(stories) {
    const groups = {};
    stories.forEach((story) => {
      if (
        story.lat != null &&
        story.lon != null &&
        typeof story.lat === "number" &&
        typeof story.lon === "number"
      ) {
        const key = `${story.lat.toFixed(5)},${story.lon.toFixed(5)}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(story);
      }
    });
    return groups;
  }

  // Helper untuk menghitung batas peta
  _calculateBounds(groupedStories) {
    const bounds = [];
    Object.values(groupedStories).forEach((group) => {
      if (group.length > 0 && group[0].lat != null && group[0].lon != null) {
        bounds.push([group[0].lat, group[0].lon]);
      }
    });
    return bounds;
  }

  // --- Metode Destroy untuk Cleanup ---
  /**
   * Dipanggil oleh App.js saat navigasi keluar dari halaman peta.
   */
  destroy() {
    console.log("Destroying MapPresenter...");
    // Panggil cleanup pada view untuk membersihkan map dan listener-nya
    if (this.view && typeof this.view.cleanup === "function") {
      this.view.cleanup();
    }
  }
  // --- End Metode Destroy ---
}

export default MapPresenter;
