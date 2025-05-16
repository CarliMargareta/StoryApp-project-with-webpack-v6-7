// Konstanta konfigurasi aplikasi
const CONFIG = {
  BASE_URL: "https://story-api.dicoding.dev/v1", // URL dasar untuk API utama
  BASE_IMAGE_URL: "https://story-api.dicoding.dev/images", // URL dasar untuk gambar
  DEFAULT_LANGUAGE: "id-id", // Bahasa default aplikasi
  AUTH_KEY: "storyapp_auth", // Kunci penyimpanan token autentikasi
  MAP_TILE_URL: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", // URL ubin peta dari OpenStreetMap
  MAP_ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> kontributor', // Kredit sumber peta
  DEFAULT_MAP_CENTER: [-6.175, 106.8275], // Titik tengah peta default (Jakarta)
  DEFAULT_MAP_ZOOM: 13, // Zoom peta default
};

export default CONFIG;
