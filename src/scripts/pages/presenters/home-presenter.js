// src/presenters/home-presenter.js
import { getStories, getToken } from "../../data/api.js";

class HomePresenter {
  constructor(view) {
    this.view = view;
    this.api = { getStories }; // Inject API
    this.auth = { getToken }; // Inject Auth check
  }

  // Inisialisasi presenter
  async init() {
    if (!this.auth.getToken()) {
      // View sudah menampilkan pesan login melalui render()
      console.log("Home page: User not logged in.");
      return;
    }

    // Jika login, tampilkan loading dan muat cerita
    this.view.showLoading();
    await this.loadStories();
  }

  // Memuat data cerita dari API
  async loadStories() {
    try {
      const response = await this.api.getStories();

      // Periksa error dari respons API
      if (response.error) {
        throw new Error(response.message || "Gagal mengambil data cerita.");
      }

      // Periksa apakah listStory ada dan tidak kosong
      if (!response.listStory || response.listStory.length === 0) {
        this.view.showEmpty(); // Beritahu view untuk menampilkan pesan kosong
      } else {
        this.view.displayStories(response.listStory); // Beritahu view untuk menampilkan cerita
      }
    } catch (error) {
      console.error("Error loading stories for home page:", error);
      this.view.showError(error.message || "Tidak dapat memuat cerita."); // Beritahu view untuk menampilkan error
    } finally {
      // Hide loading biasanya tidak perlu karena konten sudah diganti
      // this.view.hideLoading();
    }
  }
}

export default HomePresenter;
