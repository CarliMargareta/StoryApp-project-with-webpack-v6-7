// src/pages/app.js (Modifikasi untuk MVP)

// Import helper untuk mendapatkan konfigurasi rute (View & Presenter)
import { getPageConfigForRoute } from "../routes/routes.js"; // Sesuaikan path jika perlu

// Import helper URL parser (gunakan getActiveRoutePattern dan parseActivePathname)
import {
  getActiveRoutePattern,
  parseActivePathname,
} from "../routes/url-parser.js"; // Sesuaikan path jika perlu

// Import helper untuk cek token (atau Auth Service jika dibuat)
import { getToken } from "../data/api.js"; // Sesuaikan path jika perlu

class App {
  // Properti privat untuk elemen DOM
  #content = null;
  #drawerButton = null;
  #navigationDrawer = null;
  #skipToContent = null;

  // Properti privat untuk menyimpan presenter halaman saat ini
  #currentPagePresenter = null;

  constructor({ navigationDrawer, drawerButton, content, skipToContent }) {
    this.#content = content;
    this.#drawerButton = drawerButton;
    this.#navigationDrawer = navigationDrawer;
    this.#skipToContent = skipToContent;

    this._setupDrawer();
    this._setupSkipToContent();
    // _updateNavigation dipanggil di dalam renderPage sebelum merender konten
  }

  // Fungsi setup drawer (sama seperti sebelumnya)
  _setupDrawer() {
    this.#drawerButton?.addEventListener("click", (event) => {
      event.stopPropagation(); // Hindari penutupan langsung oleh body listener
      this.#navigationDrawer?.classList.toggle("open");
    });

    document.body.addEventListener("click", (event) => {
      if (
        this.#navigationDrawer?.classList.contains("open") &&
        !this.#navigationDrawer.contains(event.target) &&
        !this.#drawerButton?.contains(event.target)
      ) {
        this.#navigationDrawer.classList.remove("open");
      }
    });

    // Tutup drawer saat link di dalamnya diklik
    this.#navigationDrawer?.addEventListener("click", (event) => {
      if (event.target.tagName === "A" || event.target.tagName === "BUTTON") {
        this.#navigationDrawer.classList.remove("open");
      }
    });
  }

  // Fungsi setup skip-to-content (sama seperti sebelumnya)
  _setupSkipToContent() {
    this.#skipToContent?.addEventListener("click", (event) => {
      event.preventDefault();
      // Pastikan #main-content bisa difokus (memiliki tabindex="-1")
      this.#content?.focus();
    });
  }

  // Perbarui tampilan navigasi (user/auth links) - Tetap di sini untuk sementara
  // Bisa dipindahkan ke NavigationView jika diinginkan
  _updateNavigation() {
    const isLoggedIn = !!getToken();
    // Pastikan elemen ini ada di index.html
    const authNav = document.getElementById("auth-nav");
    const userNav = document.getElementById("user-nav");
    const userNav2 = document.getElementById("user-nav-2"); // Logout button etc.

    if (authNav) authNav.classList.toggle("hidden", isLoggedIn);
    if (userNav) userNav.classList.toggle("hidden", !isLoggedIn);
    if (userNav2) userNav2.classList.toggle("hidden", !isLoggedIn);

    // Pastikan listener logout hanya ditambahkan sekali atau di-handle di index.html
    // Jika belum ada di index.html:
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn && !logoutBtn.listenerAttached) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("storyapp_auth"); // Gunakan CONFIG.AUTH_KEY
        window.location.hash = "#/";
        window.location.reload(); // Reload untuk update state
      });
      logoutBtn.listenerAttached = true; // Flag sederhana agar tidak dobel listener
    }
  }

  // Fungsi utama untuk merender halaman dengan arsitektur MVP
  async renderPage() {
    // 1. Panggil cleanup/destroy pada presenter halaman sebelumnya (jika ada)
    if (
      this.#currentPagePresenter &&
      typeof this.#currentPagePresenter.destroy === "function"
    ) {
      console.log(
        "Destroying previous presenter:",
        this.#currentPagePresenter.constructor.name
      );
      this.#currentPagePresenter.destroy();
      this.#currentPagePresenter = null; // Reset
    }

    // 2. Perbarui tampilan navigasi global (atas/samping)
    this._updateNavigation();

    // 3. Dapatkan pola rute dan parameter dari URL
    const routePattern = getActiveRoutePattern(); // Misal: '/detail/:id'
    const urlParams = parseActivePathname(); // Misal: { resource: 'detail', id: 'story-123' }

    // 4. Dapatkan konfigurasi View dan Presenter untuk rute ini
    const pageConfig = getPageConfigForRoute(routePattern);

    try {
      if (!pageConfig) {
        // Handle Halaman Tidak Ditemukan (404)
        this.#content.innerHTML =
          '<h2>404 - Halaman Tidak Ditemukan</h2> <a href="#/">Kembali ke Beranda</a>';
        console.warn(`No page config found for route pattern: ${routePattern}`);
        return;
      }

      // 5. Cek Rute Terproteksi (sebelum instansiasi View/Presenter)
      const protectedRoutes = ["/add", "/detail/:id", "/map"]; // Sesuaikan daftar rute
      // Cek apakah pola rute saat ini ada di daftar atau dimulai dengan prefix tertentu
      const isProtectedRoute = protectedRoutes.some(
        (p) =>
          routePattern === p ||
          (p.endsWith("/:id") && routePattern.startsWith(p.split("/:id")[0]))
      );

      if (isProtectedRoute && !getToken()) {
        console.log(`Access denied to ${routePattern}. Redirecting to login.`);
        window.location.hash = "#/login";
        return; // Hentikan proses render
      }

      // 6. Instansiasi View dan Presenter
      const { View, Presenter } = pageConfig;
      const viewInstance = new View();
      const presenterInstance = new Presenter(
        viewInstance /*, inject dependencies lain jika perlu */
      );
      this.#currentPagePresenter = presenterInstance; // Simpan presenter aktif

      // 7. Definisikan fungsi untuk memuat dan menginisialisasi halaman
      const loadAndInitPage = async () => {
        if (!this.#content) return; // Pastikan elemen konten ada
        // a. Render HTML awal dari View
        this.#content.innerHTML = await viewInstance.render(urlParams);
        // b. Panggil afterRender View (jika ada logic DOM setup tambahan)
        await viewInstance.afterRender(urlParams);
        // c. Inisialisasi Presenter (mulai ambil data, ikat event view, dll.)
        await presenterInstance.init(urlParams);
      };

      // 8. Gunakan View Transitions API jika didukung
      if (document.startViewTransition) {
        const transition = document.startViewTransition(loadAndInitPage);
        try {
          await transition.finished; // Tunggu transisi selesai
        } catch (transitionError) {
          console.error("View Transition error:", transitionError);
          // Mungkin perlu fallback atau penanganan error transisi
        }
      } else {
        // Jika tidak didukung, langsung panggil loadAndInitPage
        await loadAndInitPage();
      }

      // 9. Fokus ke konten utama setelah render dan inisialisasi
      this.#content?.focus(); // Pastikan #main-content punya tabindex="-1"
    } catch (error) {
      console.error(`Error rendering page for route ${routePattern}:`, error);
      // Tampilkan pesan error yang lebih informatif jika memungkinkan
      this.#content.innerHTML = `<div class="error-container">
        <h2>Oops! Terjadi Kesalahan</h2>
        <p>Gagal memuat halaman. Coba beberapa saat lagi.</p>
        <p style="font-size: 0.8em; color: grey;">Detail: ${
          error.message || "Tidak ada detail"
        }</p>
        <a href="#/" class="btn mt-2">&larr; Kembali ke Beranda</a>
      </div>`;
      this.#currentPagePresenter = null; // Reset presenter jika error saat init/render
    }
  }
}

export default App;
