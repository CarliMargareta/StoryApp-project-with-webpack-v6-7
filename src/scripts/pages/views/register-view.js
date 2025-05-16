// Fokus HANYA pada rendering dan interaksi DOM minimal

class RegisterView {
  constructor() {
    // Referensi ke elemen DOM penting bisa disimpan di sini setelah render
    this.form = null;
    this.nameInput = null;
    this.emailInput = null;
    this.passwordInput = null;
    this.submitButton = null;
  }

  // Hanya mengembalikan string HTML
  async render() {
    return `
      <section class="container">
        <div class="form-container">
          <h1 class="form-title" tabindex="0">Daftar Akun</h1>
          <form id="register-form">
            <div class="form-group">
              <label for="name" class="form-label">Nama Lengkap</label>
              <input type="text" id="name" class="form-input" placeholder="Masukkan nama lengkap Anda" required />
            </div>
            <div class="form-group">
              <label for="email" class="form-label">Email</label>
              <input type="email" id="email" class="form-input" placeholder="Masukkan email Anda" required />
            </div>
            <div class="form-group">
              <label for="password" class="form-label">Kata Sandi</label>
              <input type="password" id="password" class="form-input" placeholder="Masukkan kata sandi (min. 8 karakter)" required minlength="8" />
            </div>
            <div class="form-group">
              <button type="submit" id="submit-button" class="btn btn-block">Daftar</button>
            </div>
            <p class="text-center mt-2">
              Sudah punya akun? <a href="#/login">Masuk di sini</a>
            </p>
          </form>
          <div id="error-message" style="color: red; margin-top: 10px;"></div>
        </div>
      </section>
    `;
  }

  // Ikat event listener dan delegasikan ke presenter
  bindEvents(presenter) {
    this.form = document.getElementById("register-form");
    this.nameInput = document.getElementById("name");
    this.emailInput = document.getElementById("email");
    this.passwordInput = document.getElementById("password");
    this.submitButton = document.getElementById("submit-button");

    if (this.form) {
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        presenter.onRegisterSubmit(); // Delegasikan ke presenter
      });
    }
  }

  // Metode untuk mendapatkan nilai input (dipanggil oleh presenter)
  getFormData() {
    return {
      name: this.nameInput ? this.nameInput.value : "",
      email: this.emailInput ? this.emailInput.value : "",
      password: this.passwordInput ? this.passwordInput.value : "",
    };
  }

  // Metode untuk memperbarui UI (dipanggil oleh presenter)
  showLoading() {
    if (this.submitButton) {
      this.submitButton.disabled = true;
      this.submitButton.textContent = "Mendaftarkan...";
    }
  }

  hideLoading() {
    if (this.submitButton) {
      this.submitButton.disabled = false;
      this.submitButton.textContent = "Daftar";
    }
  }

  showError(message) {
    const errorElement = document.getElementById("error-message");
    if (errorElement) {
      errorElement.textContent = message;
    }
    // Anda bisa menggunakan alert jika mau, tapi menampilkan di DOM lebih baik
    // alert(message);
  }

  clearError() {
    const errorElement = document.getElementById("error-message");
    if (errorElement) {
      errorElement.textContent = "";
    }
  }

  showSuccess(message) {
    alert(message); // Atau tampilkan pesan sukses di DOM
  }

  navigateToLogin() {
    window.location.hash = "#/login";
  }

  // Dipanggil setelah HTML dirender ke DOM
  afterRender() {
    // Dulu digunakan untuk event listener, sekarang pindah ke bindEvents
    // Bisa digunakan untuk inisialisasi library pihak ketiga yang butuh DOM (jika ada)
  }
}

export default RegisterView;
