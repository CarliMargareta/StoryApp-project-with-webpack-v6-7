/**
 * Format tanggal ke format yang mudah dibaca
 * @param {string} dateString - String tanggal dari API
 * @returns {string} - Tanggal yang sudah diformat
 */
export function formatDate(dateString) {
  const options = {
    weekday: "long", // Hari dalam seminggu
    year: "numeric", // Tahun
    month: "long", // Bulan (nama panjang)
    day: "numeric", // Tanggal
    hour: "2-digit", // Jam (2 digit)
    minute: "2-digit", // Menit (2 digit)
  };

  // Mengubah tanggal ke format lokal Indonesia
  return new Date(dateString).toLocaleDateString("id-ID", options);
}

/**
 * Escape HTML untuk mencegah serangan XSS
 * @param {string} html - String HTML mentah
 * @returns {string} - String HTML yang telah diamankan
 */
export function escapeHtml(html) {
  const div = document.createElement("div");
  div.textContent = html; // Mengubah text menjadi aman
  return div.innerHTML;
}

/**
 * Validasi format email
 * @param {string} email - Email yang ingin divalidasi
 * @returns {boolean} - Apakah email valid atau tidak
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Mengambil data dari parameter query URL
 * @param {string} param - Nama parameter
 * @returns {string|null} - Nilai dari parameter (jika ada)
 */
export function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Format ukuran file ke string yang mudah dibaca
 * @param {number} bytes - Ukuran file dalam byte
 * @returns {string} - Ukuran file yang diformat
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 Byte";

  const k = 1024;
  const sizes = ["Byte", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Konversi blob ke base64
 * @param {Blob} blob - Blob yang ingin dikonversi
 * @returns {Promise<string>} - String base64
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // Setelah selesai membaca
    reader.onerror = reject; // Jika terjadi kesalahan
    reader.readAsDataURL(blob);
  });
}

/**
 * Konversi file ke blob
 * @param {File} file - File yang ingin dikonversi
 * @returns {Promise<Blob>} - Objek blob
 */
export function fileToBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const blob = new Blob([e.target.result], { type: file.type });
      resolve(blob);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file); // Membaca isi file sebagai buffer
  });
}

/**
 * Menunggu dalam waktu tertentu
 * @param {number} ms - Waktu dalam milidetik
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
