// src/presenters/add-presenter.js
import { addStory } from "../../data/api.js";
import CONFIG from "../../config.js";

class AddPresenter {
  constructor(view, apiService = { addStory }) {
    // Inject dependency
    if (!view) {
      throw new Error("AddPresenter requires a view instance.");
    }
    this.view = view;
    this.api = apiService; // Gunakan service yang diinject
    this.config = CONFIG;

    // State internal presenter
    this.mediaStream = null;
    this.photoBlob = null; // Berisi Blob dari kamera atau File dari input
    this.locationCoords = null; // { lat: number, lon: number }

    console.log("AddPresenter created");
  }

  // Inisialisasi view dan state
  async init() {
    console.log("AddPresenter init started");
    try {
      // Panggil afterRender view untuk memastikan elemen DOM siap
      if (typeof this.view.afterRender === "function") {
        this.view.afterRender();
      } else {
        console.warn("View does not have an afterRender method.");
        // Jika afterRender tidak ada, pastikan elemen diambil di constructor view atau cara lain
        // atau panggil _getElements secara eksplisit jika visibility memungkinkan (tidak disarankan)
      }

      this.view.initializeMap(
        this.config.DEFAULT_MAP_CENTER,
        this.config.DEFAULT_MAP_ZOOM,
        this.config.MAP_TILE_URL,
        this.config.MAP_ATTRIBUTION
      );

      // Ikat event map HANYA setelah map diinisialisasi
      // Pastikan initializeMap sudah selesai atau async
      // Kita anggap initializeMap sinkron atau view menangani internalnya
      this.view.addMapClickListener(this.onMapClicked.bind(this));
      this.view.addGeocoder(this.onLocationGeocoded.bind(this));

      // Ikat event UI lainnya
      this.view.bindEvents(this);

      // Set state awal tombol kamera
      this.view.setCameraButtonsState({
        start: true,
        capture: false, // Capture dinonaktifkan awal, diaktifkan oleh view via loadedmetadata
        retake: false,
      });

      // Bersihkan error sebelumnya
      this.view.clearError();

      console.log("AddPresenter init finished successfully");
    } catch (error) {
      console.error("Error during AddPresenter initialization:", error);
      this.view.showError(
        `Gagal menginisialisasi halaman tambah cerita: ${error.message}`
      );
      // Mungkin disable form jika init gagal parah
      if (this.view.form) this.view.form.style.display = "none";
    }
  }

  // --- Handler untuk Event dari View ---

  async onStartCamera() {
    if (this.mediaStream) {
      console.warn("Camera already started.");
      return;
    }
    // Hentikan stream lama jika ada (seharusnya tidak terjadi tapi sbg pengaman)
    this._stopMediaStream();
    // Hapus blob foto lama & bersihkan preview
    this.photoBlob = null;
    this.view.clearPreview(); // Akan revoke URL jika ada

    console.log("Attempting to start camera...");
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Prioritaskan kamera belakang jika ada
        audio: false,
      });
      console.log("Camera stream obtained.");

      // Set state tombol: mulai nonaktif, capture nonaktif (menunggu view), retake nonaktif
      this.view.setCameraButtonsState({
        start: false,
        capture: false, // View akan enable via loadedmetadata
        retake: false,
      });

      // Tampilkan preview kamera di view
      this.view.showCameraPreview(this.mediaStream);
    } catch (err) {
      console.error("Error accessing camera:", err);
      let message = "Gagal mengakses kamera.";
      if (err.name === "NotAllowedError") {
        message =
          "Izin akses kamera ditolak. Silakan izinkan di pengaturan browser.";
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        message = "Tidak ada kamera yang ditemukan di perangkat ini.";
      } else if (err.name === "NotReadableError") {
        message =
          "Kamera sedang digunakan oleh aplikasi lain atau terjadi error hardware.";
      } else {
        message = `Gagal memulai kamera: ${err.message || err.name}`;
      }
      this.view.showError(message);
      this._stopMediaStream(); // Pastikan stream berhenti jika error start
      // Reset tombol ke state awal jika gagal
      this.view.setCameraButtonsState({
        start: true,
        capture: false,
        retake: false,
      });
    }
  }

  onCapturePhoto() {
    const videoElement = this.view.previewElement?.querySelector("video");
    if (!videoElement) {
      console.error("Capture failed: Video element not found in preview.");
      this.view.showError(
        "Gagal mengambil foto: Pratinjau video tidak ditemukan."
      );
      return;
    }
    if (videoElement.readyState < videoElement.HAVE_METADATA) {
      console.warn("Capture attempted before video metadata was ready.");
      this.view.showError("Pratinjau kamera belum siap, coba lagi sesaat.");
      return; // Belum siap
    }
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      console.error("Capture failed: Video dimensions are zero.");
      this.view.showError("Gagal mengambil foto: Dimensi video tidak valid.");
      return;
    }

    console.log("Capturing photo...");
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const context = canvas.getContext("2d");

    try {
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log("Photo captured successfully, blob created.");
            this.photoBlob = blob;
            const imageUrl = URL.createObjectURL(blob);

            // Tampilkan preview gambar (view akan revoke URL lama jika ada)
            this.view.showImagePreview(imageUrl);

            // Hentikan stream video setelah capture berhasil
            this._stopMediaStream();

            // Update state tombol: start nonaktif, capture nonaktif, retake aktif
            this.view.setCameraButtonsState({
              start: false,
              capture: false,
              retake: true,
            });
          } else {
            console.error("Failed to create blob from canvas.");
            this.view.showError("Gagal memproses gambar setelah diambil.");
            // Mungkin reset ke state kamera aktif?
            this.view.setCameraButtonsState({
              start: false,
              capture: true,
              retake: false,
            });
          }
        },
        "image/jpeg", // Format
        0.9 // Kualitas (0.0 - 1.0)
      );
    } catch (error) {
      console.error("Error drawing video to canvas or creating blob:", error);
      this.view.showError(
        `Terjadi kesalahan saat memproses gambar: ${error.message}`
      );
      this._stopMediaStream(); // Hentikan stream jika error parah
      this.view.setCameraButtonsState({
        start: true,
        capture: false,
        retake: false,
      }); // Reset
    }
  }

  onRetakePhoto() {
    console.log("Retake/delete photo requested.");
    this._stopMediaStream(); // Hentikan stream jika masih berjalan
    this.photoBlob = null; // Hapus referensi blob/file
    this.view.clearPreview(); // Bersihkan preview (akan revoke URL blob jika ada)
    // Reset state tombol ke awal
    this.view.setCameraButtonsState({
      start: true,
      capture: false,
      retake: false,
    });
    console.log("Preview cleared and buttons reset.");
  }

  onFileSelected(file) {
    console.log("File selected:", file.name, file.type);
    // Validasi tipe file (opsional tapi bagus)
    if (!file.type.startsWith("image/")) {
      console.warn("Invalid file type selected:", file.type);
      this.view.showError(
        "File yang dipilih bukan gambar. Silakan pilih file JPG, PNG, GIF, dll."
      );
      this.view.clearPreview(); // Hapus preview jika ada
      this.photoBlob = null; // Hapus blob/file jika ada
      // Reset tombol mungkin tidak perlu, biarkan user memilih lagi
      // Tapi pastikan retake dinonaktifkan jika tidak ada gambar valid
      this.view.setCameraButtonsState({
        start: true,
        capture: false,
        retake: false,
      });
      return;
    }

    this._stopMediaStream(); // Hentikan kamera jika sedang aktif
    this.photoBlob = file; // Simpan objek File (yang juga merupakan Blob)
    const imageUrl = URL.createObjectURL(file);

    // Tampilkan preview (view akan revoke URL lama)
    this.view.showImagePreview(imageUrl);

    // Update state tombol: start nonaktif, capture nonaktif, retake aktif
    this.view.setCameraButtonsState({
      start: false,
      capture: false,
      retake: true,
    });
    console.log("Image preview shown for selected file.");
  }

  onMapClicked(lat, lon) {
    console.log(`Map clicked at: Lat ${lat}, Lon ${lon}`);
    this._updateLocation(lat, lon);
  }

  onLocationGeocoded(lat, lon) {
    console.log(`Location geocoded to: Lat ${lat}, Lon ${lon}`);
    // Perbarui peta dan input, mungkin dengan zoom lebih dekat
    this._updateLocation(lat, lon, 16); // Zoom ke level 16 setelah geocode
  }

  onCoordsChanged(lat, lon) {
    console.log(`Coordinates manually changed to: Lat ${lat}, Lon ${lon}`);
    // Hanya update jika berbeda dari state saat ini untuk menghindari loop tak terbatas
    if (
      !this.locationCoords ||
      this.locationCoords.lat.toFixed(7) !== lat.toFixed(7) || // Bandingkan dengan presisi yang sama
      this.locationCoords.lon.toFixed(7) !== lon.toFixed(7)
    ) {
      console.log(
        "Manual coordinates differ from current state, updating map."
      );
      // Perbarui peta tanpa mengubah zoom secara eksplisit
      this._updateLocation(lat, lon);
    } else {
      console.log(
        "Manual coordinates match current state, no map update needed."
      );
    }
  }

  // Handler utama untuk submit form
  async onFormSubmit() {
    console.log("Form submission initiated.");
    this.view.clearError(); // Bersihkan error lama
    const description = this.view.getDescription();

    // --- Validasi Input ---
    const errors = [];
    if (!description) {
      errors.push("Deskripsi tidak boleh kosong.");
    }
    if (!this.photoBlob) {
      errors.push("Foto belum dipilih atau diambil.");
    } else if (this.photoBlob.size > 1000000) {
      // Contoh: Batas 1MB
      console.warn(`Photo size exceeds limit: ${this.photoBlob.size} bytes`);
      errors.push(
        `Ukuran foto terlalu besar (Maks: ${
          1000000 / 1000000
        }MB). Harap kompres atau pilih foto lain.`
      );
      // Jangan kirim jika terlalu besar
    }

    if (!this.locationCoords) {
      errors.push("Lokasi belum dipilih dari peta atau pencarian.");
    } else if (
      isNaN(this.locationCoords.lat) ||
      isNaN(this.locationCoords.lon)
    ) {
      errors.push("Koordinat lokasi tidak valid.");
      // Reset lokasi jika tidak valid?
      // this.locationCoords = null;
      // this.view.updateLocationDisplay("Lokasi tidak valid, pilih ulang.");
      // this.view.updateCoordInputs(null, null);
    }

    if (errors.length > 0) {
      console.error("Form validation failed:", errors);
      this.view.showError(errors.join("\n"));
      return; // Hentikan proses submit
    }

    console.log("Form validation passed. Proceeding with submission.");
    this.view.showLoading();

    try {
      const storyData = {
        description: description,
        photo: this.photoBlob, // Kirim Blob atau File
        lat: this.locationCoords.lat,
        lon: this.locationCoords.lon,
      };
      console.log("Submitting story data:", {
        description: storyData.description,
        photo_size: storyData.photo.size,
        lat: storyData.lat,
        lon: storyData.lon,
      }); // Jangan log seluruh blob

      const response = await this.api.addStory(storyData);
      console.log("API addStory response:", response);

      // Cek jika response memiliki struktur error yang diharapkan
      if (response && response.error) {
        // Asumsi API mengembalikan { error: boolean, message: string }
        throw new Error(
          response.message || "Gagal mengunggah cerita dari server."
        );
      }

      // Cek status HTTP jika API menggunakan fetch standar (misal tidak dalam library khusus)
      // Contoh: if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      // Jika tidak ada error di response atau response tidak punya property error, anggap sukses
      // this.view.showSuccess("Cerita berhasil diunggah!");
      // Mungkin reset form di sini sebelum navigasi? Tergantung kebutuhan.
      this.view.navigateToHome();
    } catch (error) {
      console.error("Error submitting story:", error);
      this.view.showError(
        error.message || "Terjadi kesalahan saat mengunggah cerita."
      );
    } finally {
      // Selalu pastikan loading state dihentikan
      this.view.hideLoading();
      console.log("Submission process finished (success or failure).");
    }
  }

  // --- Logika Internal ---

  _updateLocation(lat, lon, zoom = null) {
    // Terima zoom opsional
    // Validasi sederhana
    if (isNaN(lat) || isNaN(lon)) {
      console.error(
        "Invalid coordinates provided to _updateLocation:",
        lat,
        lon
      );
      this.view.showError("Koordinat yang diterima tidak valid.");
      return;
    }

    this.locationCoords = { lat, lon };
    console.log("Internal location state updated:", this.locationCoords);

    // Instruksikan view untuk update UI
    // Kirim zoom jika ada, biarkan view gunakan zoom terakhir jika null
    this.view.updateMapLocation(lat, lon, zoom);
    this.view.updateLocationDisplay(
      `Lokasi dipilih: ${lat.toFixed(5)}, ${lon.toFixed(5)}` // Tampilkan 5 desimal
    );
    this.view.updateCoordInputs(lat, lon); // View akan memformat ke presisi yang sesuai
  }

  _stopMediaStream() {
    if (this.mediaStream) {
      console.log("Stopping media stream tracks.");
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
        console.log(`Track stopped: ${track.kind} (${track.label})`);
      });
      this.mediaStream = null;
      console.log("Media stream stopped and cleared.");

      // Setelah stream berhenti, nonaktifkan tombol capture jika belum
      // dan pastikan tombol start aktif kembali JIKA tidak ada gambar/blob
      if (!this.photoBlob) {
        this.view.setCameraButtonsState({
          start: true,
          capture: false,
          retake: false,
        });
      } else {
        // Jika ada blob (misal setelah capture), state harusnya start=false, capture=false, retake=true
        this.view.setCameraButtonsState({
          start: false,
          capture: false,
          retake: true,
        });
      }
    } else {
      // console.log("No active media stream to stop.");
    }
  }

  // Dipanggil oleh App/Router saat navigasi keluar dari halaman ini
  destroy() {
    console.log("AddPresenter destroy initiated.");
    this._stopMediaStream(); // Pastikan stream kamera berhenti
    // Beritahu view untuk membersihkan resources (listener peta, dll.)
    if (typeof this.view.cleanup === "function") {
      this.view.cleanup();
    } else {
      console.warn("View does not have a cleanup method.");
    }
    // Reset state internal presenter
    this.photoBlob = null;
    this.locationCoords = null;

    console.log("AddPresenter destroy finished.");
  }
}

export default AddPresenter;
