// src/presenters/detail-presenter.js
import { getDetailStory } from "../../data/api.js";

class DetailPresenter {
  constructor(view) {
    this.view = view;
    this.api = { getDetailStory }; // Inject API
  }

  // Inisialisasi presenter, menerima parameter dari URL (termasuk ID)
  async init(params = {}) {
    const storyId = params.id; // Ambil ID dari parameter

    if (!storyId) {
      this.view.showError("ID Cerita tidak valid atau tidak ditemukan.");
      return;
    }

    this.view.showLoading(); // Tampilkan loading awal
    await this.loadStoryDetail(storyId);
  }

  // Memuat detail cerita dari API
  async loadStoryDetail(id) {
    try {
      const response = await this.api.getDetailStory(id);

      // Tangani error dari API response
      if (response.error) {
        throw new Error(response.message || "Gagal mengambil detail cerita.");
      }

      const story = response.story;

      // Pastikan data cerita ada
      if (!story) {
        throw new Error(
          "Data cerita tidak ditemukan setelah request berhasil."
        );
      }

      // Beritahu View untuk menampilkan detail cerita
      // Simpan status apakah peta perlu ditampilkan
      const shouldDisplayMap = this.view.displayStoryDetail(story);

      // Jika view mengindikasikan lokasi ada, beritahu view untuk menampilkan peta
      if (shouldDisplayMap) {
        this.view.displayMap(story);
      }
    } catch (error) {
      console.error("Error loading story detail:", error);
      this.view.showError(error.message || "Tidak dapat memuat detail cerita.");
    } finally {
      // Loading sudah digantikan konten atau error, jadi hideLoading() tidak wajib
      // this.view.hideLoading();
    }
  }
}

export default DetailPresenter;
