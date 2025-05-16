// src/presenters/login-presenter.js
import { login } from "../../data/api"; // Impor fungsi login dari API
import CONFIG from "../../config"; // Impor CONFIG untuk AUTH_KEY

// Service untuk mengelola kredensial di localStorage
const AuthService = {
  saveCredentials: (loginResult) => {
    try {
      const authData = {
        token: loginResult.token,
        name: loginResult.name,
        userId: loginResult.userId,
      };
      localStorage.setItem(
        CONFIG.AUTH_KEY,
        JSON.stringify(authData)
      );
      return authData;
    } catch (error) {
      console.error("Error saving credentials to localStorage:", error);
      return null;
    }
  },
  getCredentials: () => {
    try {
      const data = localStorage.getItem(CONFIG.AUTH_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  clearCredentials: () => {
    localStorage.removeItem(CONFIG.AUTH_KEY);
  }
};

class LoginPresenter {
  constructor(view) {
    this.view = view;
    this.api = { login }; // Inject API login
    this.authService = AuthService; // Inject Auth Service
  }

  // Inisialisasi presenter
  async init() {
    // Ikat event dari view setelah view dirender
    this.view.bindEvents(this);
  }

  // Dipanggil oleh View saat form disubmit
  async onLoginSubmit() {
    const formData = this.view.getFormData();
    this.view.clearError();

    // Validasi sederhana
    if (!formData.email || !formData.password) {
      this.view.showError("Email dan kata sandi tidak boleh kosong.");
      return;
    }

    this.view.showLoading();

    try {
      // Panggil API login
      const response = await this.api.login({
        email: formData.email,
        password: formData.password,
      });

      if (response.error) {
        throw new Error(response.message || "Login gagal.");
      }

      // Jika sukses, simpan kredensial menggunakan AuthService
      const authData = this.authService.saveCredentials(response.loginResult);
      if (!authData) {
        throw new Error("Gagal menyimpan sesi login.");
      }

      // Kirim token ke Service Worker agar SW dapat menyimpannya juga
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'AUTH_TOKEN',
          token: authData.token,
          name: authData.name,
          userId: authData.userId,
        });
      }

      // Navigasi ke halaman beranda setelah login
      this.view.navigateToHome();
    } catch (error) {
      console.error("Kesalahan saat login:", error);
      this.view.showError(
        error.message || "Terjadi kesalahan saat mencoba masuk."
      );
    } finally {
      this.view.hideLoading();
    }
  }
}

export default LoginPresenter;
