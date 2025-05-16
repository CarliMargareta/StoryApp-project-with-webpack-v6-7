// src/routes/routes.js

// Import View classes
import HomeView from "../pages/views/home-view.js";
import DetailView from "../pages/views/detail-view.js";
import AddView from "../pages/views/add-view.js";
import LoginView from "../pages/views/login-view.js";
import RegisterView from "../pages/views/register-view.js";
import AboutView from "../pages/views/about-view.js";
import MapView from "../pages/views/map-view.js";

// Import Presenter classes
import HomePresenter from "../pages/presenters/home-presenter.js";
import DetailPresenter from "../pages/presenters/detail-presenter.js";
import AddPresenter from "../pages/presenters/add-presenter.js";
import LoginPresenter from "../pages/presenters/login-presenter.js";
import RegisterPresenter from "../pages/presenters/register-presenter.js";
import AboutPresenter from "../pages/presenters/about-presenter.js";
import MapPresenter from "../pages/presenters/map-presenter.js";

// Struktur baru: Pemetaan pola rute ke pasangan View dan Presenter
const routeMap = {
  "/": { View: HomeView, Presenter: HomePresenter },
  "/detail/:id": { View: DetailView, Presenter: DetailPresenter },
  "/add": { View: AddView, Presenter: AddPresenter },
  "/login": { View: LoginView, Presenter: LoginPresenter },
  "/register": { View: RegisterView, Presenter: RegisterPresenter },
  "/about": { View: AboutView, Presenter: AboutPresenter },
  "/map": { View: MapView, Presenter: MapPresenter },
  // Tambahkan rute lain jika ada
};

// Fungsi untuk mendapatkan konfigurasi (View & Presenter) berdasarkan pola rute
// Pola rute ini didapat dari url-parser.js (misal: '/detail/:id')
const getPageConfigForRoute = (routePattern) => {
  return routeMap[routePattern] || null; // Kembalikan null jika tidak ditemukan
};

// Ekspor fungsi ini untuk digunakan oleh App.js
export { getPageConfigForRoute };

// Kita tidak lagi mengekspor objek 'routes' yang lama
// export default routes;
