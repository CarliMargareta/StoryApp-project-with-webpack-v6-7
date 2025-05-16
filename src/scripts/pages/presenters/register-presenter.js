// Berisi logika presentasi, interaksi dengan API dan update View
import { register } from "../../data/api"; // Sesuaikan path jika perlu

class RegisterPresenter {
  constructor(view) {
    this.view = view;
    // Anda bisa inject 'register' function atau seluruh 'api' module jika perlu lebih banyak
    this.registerApiCall = register;
  }

  // Inisialisasi presenter
  async init() {
    // View sudah dirender, sekarang ikat eventnya
    this.view.bindEvents(this);
  }

  // Dipanggil oleh View saat form disubmit
  async onRegisterSubmit() {
    const formData = this.view.getFormData();
    this.view.clearError(); // Bersihkan error sebelumnya
    this.view.showLoading();

    // Validasi sederhana (bisa lebih kompleks)
    if (!formData.name || !formData.email || !formData.password) {
      this.view.showError("Semua field harus diisi.");
      this.view.hideLoading();
      return;
    }
    if (formData.password.length < 8) {
      this.view.showError("Kata sandi minimal 8 karakter.");
      this.view.hideLoading();
      return;
    }

    try {
      const response = await this.registerApiCall({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      if (response.error) {
        // API mengembalikan error dalam response body
        throw new Error(response.message);
      }

      // Sukses
      this.view.showSuccess("Pendaftaran berhasil! Silakan login.");
      this.view.navigateToLogin();
    } catch (error) {
      // Error jaringan atau error dari API
      console.error("Kesalahan saat mendaftar:", error);
      this.view.showError(error.message || "Terjadi kesalahan saat mendaftar.");
    } finally {
      this.view.hideLoading();
    }
  }
}

export default RegisterPresenter;
