// src/views/login-view.js

class LoginView {
  constructor() {
    this.form = null;
    this.emailInput = null;
    this.passwordInput = null;
    this.submitButton = null;
    this.errorElement = null; // Tambahkan elemen untuk menampilkan error
  }

  // Mengembalikan string HTML untuk form login
  async render() {
    return `
        <section class="container">
          <div class="form-container">
            <h1 class="form-title" tabindex="0">Masuk</h1>
  
            <form id="login-form">
              <div class="form-group">
                <label for="email" class="form-label">Email</label>
                <input
                  type="email"
                  id="email"
                  class="form-input"
                  placeholder="Masukkan email Anda"
                  required
                  aria-required="true"
                />
              </div>
  
              <div class="form-group">
                <label for="password" class="form-label">Kata Sandi</label>
                <input
                  type="password"
                  id="password"
                  class="form-input"
                  placeholder="Masukkan kata sandi Anda"
                  required
                  aria-required="true"
                />
              </div>
  
              <div id="error-message" class="form-group" style="color: red; display: none;">
                </div>
  
              <div class="form-group">
                <button type="submit" id="submit-button" class="btn btn-block">Masuk</button>
              </div>
  
              <p class="text-center mt-2">
                Belum punya akun? <a href="#/register">Daftar di sini</a>
              </p>
            </form>
          </div>
        </section>
      `;
  }

  // Ikat event listener ke form dan delegasikan ke presenter
  bindEvents(presenter) {
    this.form = document.getElementById("login-form");
    this.emailInput = document.getElementById("email");
    this.passwordInput = document.getElementById("password");
    this.submitButton = document.getElementById("submit-button");
    this.errorElement = document.getElementById("error-message");

    if (this.form) {
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        presenter.onLoginSubmit(); // Panggil metode presenter
      });
    }
  }

  // Dapatkan data dari input form
  getFormData() {
    return {
      email: this.emailInput ? this.emailInput.value : "",
      password: this.passwordInput ? this.passwordInput.value : "",
    };
  }

  // Tampilkan status loading pada tombol
  showLoading() {
    if (this.submitButton) {
      this.submitButton.disabled = true;
      this.submitButton.textContent = "Sedang masuk...";
    }
  }

  // Sembunyikan status loading pada tombol
  hideLoading() {
    if (this.submitButton) {
      this.submitButton.disabled = false;
      this.submitButton.textContent = "Masuk";
    }
  }

  // Tampilkan pesan error di UI
  showError(message) {
    if (this.errorElement) {
      this.errorElement.textContent = message;
      this.errorElement.style.display = "block";
    }
    // Alternatif: alert(message);
  }

  // Bersihkan pesan error dari UI
  clearError() {
    if (this.errorElement) {
      this.errorElement.textContent = "";
      this.errorElement.style.display = "none";
    }
  }

  // Navigasi ke halaman utama (setelah login sukses)
  navigateToHome() {
    window.location.hash = "#/";
    // Reload diperlukan agar state navigasi (di index.html atau app.js) diperbarui
    window.location.reload();
  }

  // Dipanggil setelah HTML dirender (opsional, bisa kosong)
  afterRender() {
    // Tidak banyak yang perlu dilakukan di sini karena binding event
    // sudah dihandle oleh bindEvents yang dipanggil presenter.
  }
}

export default LoginView;
