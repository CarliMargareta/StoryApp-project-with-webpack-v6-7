// src/views/add-view.js
import CONFIG from "../../config.js"; // Untuk default map view

class AddView {
  constructor() {
    // Elemen IDs
    this.formId = "add-story-form";
    this.descId = "description";
    this.previewId = "camera-preview";
    this.startCamId = "camera-start";
    this.captureCamId = "camera-capture";
    this.retakeCamId = "camera-retake";
    this.fileInputId = "file-input";
    this.mapId = "map-add";
    this.locationDisplayId = "location-display";
    this.latInputId = "lat-input";
    this.lonInputId = "lon-input";
    this.submitBtnId = "submit-button";
    this.errorMsgId = "add-error-message"; // ID untuk elemen error

    // Referensi DOM (akan diisi setelah render)
    this.form = null;
    this.descriptionInput = null;
    this.previewElement = null;
    this.startCamButton = null;
    this.captureCamButton = null;
    this.retakeCamButton = null;
    this.fileInput = null;
    this.locationDisplay = null;
    this.latInput = null;
    this.lonInput = null;
    this.submitButton = null;
    this.errorElement = null;

    // Referensi Leaflet
    this.map = null;
    this.marker = null;
    this.geocoder = null;
  }

  // Render HTML form
  async render() {
    // Kode render HTML tidak berubah, salin dari kode asli Anda
    return `
          <section class="container">
            <div class="form-container">
              <h1 class="form-title" tabindex="0">Tambah Cerita Baru</h1>
              <form id="${this.formId}">
                <div class="form-group">
                  <label for="${this.descId}" class="form-label">Deskripsi *</label>
                  <textarea id="${this.descId}" class="form-textarea" placeholder="Tulis cerita Anda..." required></textarea>
                </div>

                <div class="form-group">
                  <label class="form-label">Foto *</label>
                  <div class="camera-container">
                    <div class="camera-preview" id="${this.previewId}">
                      <p>Pratinjau kamera/gambar akan muncul di sini</p>
                    </div>
                    <div class="camera-controls">
                      <button type="button" id="${this.startCamId}" class="btn">Mulai Kamera</button>
                      <button type="button" id="${this.captureCamId}" class="btn" disabled>Ambil Foto</button>
                      <button type="button" id="${this.retakeCamId}" class="btn" disabled>Ulangi/Hapus</button>
                    </div>
                  </div>
                  <div class="mt-2">
                    <label for="${this.fileInputId}" class="form-label">Atau pilih file foto</label>
                    <input type="file" id="${this.fileInputId}" accept="image/*" class="form-input"/>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Pilih Lokasi (Klik peta / Cari)</label>
                  <div id="${this.mapId}" class="map-container" style="height: 300px;"></div>
                  <p id="${this.locationDisplayId}" class="mt-1">Belum ada lokasi yang dipilih</p>
                </div>

                <div class="form-group">
                  <label class="form-label">Koordinat Manual</label>
                  <div class="coord-inputs" style="display: flex; gap: 10px;">
                    <input type="number" id="${this.latInputId}" class="form-input" placeholder="Lintang" step="any" style="flex: 1;"/>
                    <input type="number" id="${this.lonInputId}" class="form-input" placeholder="Bujur" step="any" style="flex: 1;"/>
                  </div>
                </div>

                <div id="${this.errorMsgId}" class="form-group" style="color: red; display: none;">
                </div>


                <div class="form-group">
                  <button type="submit" id="${this.submitBtnId}" class="btn btn-block btn-accent">Unggah Cerita</button>
                </div>
              </form>
            </div>
          </section>
        `;
  }

  // Ambil referensi DOM setelah render
  _getElements() {
    this.form = document.getElementById(this.formId);
    this.descriptionInput = document.getElementById(this.descId);
    this.previewElement = document.getElementById(this.previewId);
    this.startCamButton = document.getElementById(this.startCamId);
    this.captureCamButton = document.getElementById(this.captureCamId);
    this.retakeCamButton = document.getElementById(this.retakeCamId);
    this.fileInput = document.getElementById(this.fileInputId);
    this.locationDisplay = document.getElementById(this.locationDisplayId);
    this.latInput = document.getElementById(this.latInputId);
    this.lonInput = document.getElementById(this.lonInputId);
    this.submitButton = document.getElementById(this.submitBtnId);
    this.errorElement = document.getElementById(this.errorMsgId);
  }

  // Ikat event ke metode presenter
  bindEvents(presenter) {
    this._getElements(); // Pastikan elemen sudah ada

    this.startCamButton?.addEventListener("click", () =>
      presenter.onStartCamera()
    );
    this.captureCamButton?.addEventListener("click", () =>
      presenter.onCapturePhoto()
    );
    this.retakeCamButton?.addEventListener("click", () =>
      presenter.onRetakePhoto()
    );
    this.fileInput?.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        presenter.onFileSelected(e.target.files[0]);
      }
    });
    this.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      presenter.onFormSubmit();
    });
    this.latInput?.addEventListener("change", () =>
      this._notifyCoordsChanged(presenter)
    );
    this.lonInput?.addEventListener("change", () =>
      this._notifyCoordsChanged(presenter)
    );
  }

  _notifyCoordsChanged(presenter) {
    const lat = parseFloat(this.latInput.value);
    const lon = parseFloat(this.lonInput.value);
    if (!isNaN(lat) && !isNaN(lon)) {
      presenter.onCoordsChanged(lat, lon);
    }
  }

  // --- Metode untuk update UI oleh Presenter ---

  showCameraPreview(stream) {
    if (!this.previewElement || !this.captureCamButton) {
      console.error(
        "Preview element or capture button not found in showCameraPreview"
      );
      return;
    }

    // Hapus preview lama & revoke URL jika ada sebelum menampilkan video
    this._revokePreviewURL();

    const video = document.createElement("video");
    video.srcObject = stream;
    video.setAttribute("playsinline", "true"); // Penting untuk iOS
    video.muted = true; // Mute video agar tidak ada audio feedback

    // Event listener untuk mengaktifkan tombol capture setelah metadata siap
    video.addEventListener("loadedmetadata", () => {
      console.log("Video metadata loaded. Enabling capture button.");
      this.captureCamButton.disabled = false; // Aktifkan tombol capture
      video.play().catch((err) => console.error("Error playing video:", err)); // Mainkan video
    });

    // Tangani error pemutaran video
    video.addEventListener("error", (e) => {
      console.error("Error playing video:", e);
      this.showError("Gagal memutar pratinjau kamera.");
      // Mungkin nonaktifkan tombol capture lagi atau berikan feedback lain
      this.captureCamButton.disabled = true;
    });

    this.previewElement.innerHTML = ""; // Bersihkan sebelum menambah
    this.previewElement.appendChild(video);

    // Coba play() di luar listener juga sebagai fallback
    // Jika metadata sudah ada, ini akan langsung jalan. Jika belum, akan menunggu.
    video.play().catch((err) => {
      // Tangani error jika play dipanggil sebelum interaksi pengguna di beberapa browser
      console.warn(
        "Initial video play failed (may need user interaction):",
        err
      );
      // Tombol capture akan diaktifkan oleh loadedmetadata listener
    });
  }

  showImagePreview(imageUrl) {
    if (!this.previewElement) return;

    // Hapus preview lama & revoke URL sebelum menampilkan gambar baru
    this._revokePreviewURL();

    const img = document.createElement("img");
    img.src = imageUrl;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "100%";
    img.alt = "Pratinjau Gambar"; // Tambahkan alt text

    this.previewElement.innerHTML = ""; // Bersihkan sebelum menambah
    this.previewElement.appendChild(img);
  }

  // Helper untuk revoke URL pada preview (jika ada gambar)
  _revokePreviewURL() {
    if (!this.previewElement) return;
    const currentPreview = this.previewElement.querySelector("img, video"); // Cari img atau video
    if (
      currentPreview &&
      currentPreview.src &&
      currentPreview.src.startsWith("blob:")
    ) {
      console.log("Revoking old preview URL:", currentPreview.src);
      URL.revokeObjectURL(currentPreview.src);
    }
    // Jika video, srcObject yang perlu di-handle (tapi track dihentikan oleh presenter)
    if (currentPreview && currentPreview.srcObject) {
      // Stream dihentikan oleh presenter, jadi tidak perlu revoke di sini
    }
  }

  clearPreview() {
    if (this.previewElement) {
      this._revokePreviewURL(); // Revoke URL sebelum membersihkan
      this.previewElement.innerHTML = `<p>Pratinjau kamera/gambar akan muncul di sini</p>`;
    }
    // Juga reset nilai file input
    if (this.fileInput) this.fileInput.value = "";
  }

  setCameraButtonsState({ start, capture, retake }) {
    if (this.startCamButton) this.startCamButton.disabled = !start;
    if (this.captureCamButton) this.captureCamButton.disabled = !capture;
    if (this.retakeCamButton) this.retakeCamButton.disabled = !retake;

    // Ubah teks Retake menjadi Hapus jika gambar dari file input atau hasil capture
    const hasVideo = this.previewElement?.querySelector("video");
    const hasImage = this.previewElement?.querySelector("img");

    if (this.retakeCamButton) {
      if (!hasVideo && hasImage) {
        // Hanya ada gambar (dari file atau capture)
        this.retakeCamButton.textContent = "Hapus Gambar";
      } else if (hasVideo) {
        // Kamera sedang aktif (video tampil) - ini seharusnya tidak terjadi jika capture/retake di state ini
        // Jika state capture=false, retake=true, tapi masih ada video, itu anomali
        // Mungkin lebih aman set default ke Ulangi/Hapus
        this.retakeCamButton.textContent = "Ulangi/Hapus";
      } else {
        // Default atau state awal
        this.retakeCamButton.textContent = "Ulangi/Hapus";
      }
    }
  }

  initializeMap(center, zoom, tileUrl, attribution) {
    if (typeof L === "undefined") {
      console.error("Leaflet (L) not defined.");
      this.showError("Gagal memuat Peta (Leaflet tidak ditemukan).");
      return;
    }
    const mapContainer = document.getElementById(this.mapId);
    if (!mapContainer) {
      console.error("Map container not found");
      return;
    }
    if (this.map) {
      console.log("Removing previous map instance.");
      this.map.off();
      this.map.remove();
      this.map = null; // Pastikan instance lama dihapus
    }
    try {
      console.log("Initializing map in container:", this.mapId);
      this.map = L.map(mapContainer).setView(center, zoom);
      L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(this.map);
      console.log("Map initialized successfully.");

      // Re-bind listener setelah map baru dibuat
      // Ini akan ditangani oleh presenter yang memanggil addMapClickListener lagi jika perlu
    } catch (e) {
      console.error("Failed to initialize map:", e);
      mapContainer.innerHTML = "<p style='color: red'>Gagal memuat peta.</p>";
      this.showError(`Gagal memuat peta: ${e.message}`);
    }
  }

  addMapClickListener(callback) {
    if (!this.map) {
      console.warn(
        "Attempted to add map click listener before map was initialized."
      );
      // Coba lagi setelah sedikit delay? Atau pastikan init dipanggil dulu.
      // Untuk sekarang, kita log saja. Presenter harus memastikan init selesai.
      return;
    }
    // Hapus listener lama dulu untuk mencegah duplikasi jika dipanggil lagi
    this.map.off("click");
    this.map.on("click", (e) => callback(e.latlng.lat, e.latlng.lng));
    console.log("Map click listener added.");
  }

  addGeocoder(onGeocodeCallback) {
    if (!this.map) {
      console.warn("Attempted to add geocoder before map was initialized.");
      return;
    }
    if (typeof L.Control.Geocoder === "undefined") {
      console.error("Leaflet Geocoder plugin not found.");
      this.showError("Fitur pencarian lokasi tidak tersedia.");
      return;
    }

    // Hapus geocoder lama jika ada
    if (this.geocoder && this.map.removeControl) {
      try {
        this.map.removeControl(this.geocoder);
        console.log("Removed old geocoder control.");
      } catch (e) {
        console.warn("Could not remove old geocoder control:", e);
      }
      this.geocoder = null;
    }

    try {
      this.geocoder = L.Control.geocoder({
        collapsed: false,
        placeholder: "Cari nama tempat...",
        defaultMarkGeocode: false, // Kita akan handle marker sendiri
        errorMessage: "Pencarian tidak ditemukan.",
      }).addTo(this.map);

      // Hapus listener lama dulu jika ada (meskipun instance baru)
      this.geocoder.off("markgeocode");
      this.geocoder.on("markgeocode", (e) => {
        if (e.geocode && e.geocode.center) {
          const { lat, lng } = e.geocode.center;
          onGeocodeCallback(lat, lng);
        } else {
          console.warn("Geocode event did not contain center coordinates:", e);
        }
      });
      console.log("Geocoder added successfully.");
    } catch (e) {
      console.error("Failed to add Geocoder:", e);
      this.showError(`Gagal menambahkan fitur pencarian: ${e.message}`);
    }
  }

  updateMapLocation(lat, lon, zoom) {
    if (!this.map) {
      console.warn(
        "Attempted to update map location before map was initialized."
      );
      return;
    }
    const latlng = L.latLng(lat, lon);
    // Gunakan zoom saat ini jika tidak disediakan ATAU jika zoom null/undefined
    const targetZoom = zoom != null ? zoom : this.map.getZoom();
    this.map.setView(latlng, targetZoom);

    if (this.marker) {
      this.marker.setLatLng(latlng);
    } else {
      this.marker = L.marker(latlng).addTo(this.map);
    }
  }

  updateLocationDisplay(text) {
    if (this.locationDisplay) this.locationDisplay.textContent = text;
  }

  updateCoordInputs(lat, lon) {
    // Gunakan toFixed(7) untuk presisi yang lebih umum untuk lat/lon
    if (this.latInput) this.latInput.value = lat != null ? lat.toFixed(7) : "";
    if (this.lonInput) this.lonInput.value = lon != null ? lon.toFixed(7) : "";
  }

  getDescription() {
    return this.descriptionInput ? this.descriptionInput.value.trim() : "";
  }

  showLoading() {
    if (this.submitButton) {
      this.submitButton.disabled = true;
      // Tambahkan indikator visual loading jika ada (misal, spinner)
      this.submitButton.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Mengunggah...`;
    }
  }

  hideLoading() {
    if (this.submitButton) {
      this.submitButton.disabled = false;
      this.submitButton.textContent = "Unggah Cerita";
      // Hapus spinner jika ditambahkan
      this.submitButton.innerHTML = "Unggah Cerita";
    }
  }

  showError(message) {
    if (this.errorElement) {
      this.errorElement.textContent = message;
      this.errorElement.style.display = "block";
      // Scroll ke pesan error agar terlihat
      this.errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      console.error("Error element not found, falling back to alert:", message);
      alert(message); // Fallback ke alert jika elemen error tidak ada
    }
  }

  clearError() {
    if (this.errorElement) {
      this.errorElement.textContent = "";
      this.errorElement.style.display = "none";
    }
  }

  // showSuccess(message) {
  //   // Gunakan alert atau modal yang lebih baik jika ada library UI
  //   alert(message);
  // }

  navigateToHome() {
    console.log("Navigating to home (#/)");
    window.location.hash = "#/";
    // Umumnya reload tidak diperlukan jika menggunakan SPA router yang baik
    // window.location.reload();
  }

  // Dipanggil presenter sebelum navigasi keluar
  cleanup() {
    console.log("AddView cleanup initiated.");
    // Hapus listener peta
    if (this.map) {
      console.log("Cleaning up map listeners and controls.");
      this.map.off(); // Hapus semua listener dari map instance
      // Hapus geocoder jika ada
      if (this.geocoder && this.map.removeControl) {
        try {
          this.map.removeControl(this.geocoder);
          console.log("Geocoder control removed during cleanup.");
          this.geocoder = null; // Hapus referensi
        } catch (e) {
          console.warn("Could not remove geocoder during cleanup:", e);
        }
      }
      // Hapus marker
      if (this.marker) {
        this.marker.remove();
        this.marker = null;
        console.log("Marker removed during cleanup.");
      }

      // Hapus map instance itu sendiri
      // Hati-hati jika elemen kontainer akan digunakan lagi
      // this.map.remove(); // Mungkin tidak perlu jika halaman di-unload
      // this.map = null;
    }

    // Hapus URL blob jika masih ada di preview
    this._revokePreviewURL();

    console.log("AddView cleanup finished.");
  }

  // Dipanggil setelah HTML dirender dan dimasukkan ke DOM
  afterRender() {
    console.log("AddView afterRender: getting elements.");
    this._getElements(); // Ambil referensi DOM
    // Mungkin inisialisasi map bisa dipindah ke sini jika render selalu diikuti afterRender
    // Tapi lebih aman di presenter init() setelah view siap.
  }
}

export default AddView;
