// src/routes/url-parser.js (Tidak perlu diubah)

// Fungsi untuk mengekstrak segmen-segmen dari pathname (bagian setelah #)
function extractPathnameSegments(path) {
  // Hapus slash di awal/akhir jika ada, lalu split
  const cleanPath = path.replace(/^\/|\/$/g, "");
  const splitUrl = cleanPath.split("/");

  // Handle kasus root '/' dimana splitUrl akan jadi ['']
  if (splitUrl.length === 1 && splitUrl[0] === "") {
    return { resource: null, id: null };
  }

  return {
    resource: splitUrl[0] || null, // Segmen pertama sebagai resource
    id: splitUrl[1] || null, // Segmen kedua sebagai ID
    // Bisa ditambahkan segmen lain jika perlu
  };
}

// Fungsi untuk membangun pola rute (seperti '/resource/:id') dari segmen
function constructRouteFromSegments(pathSegments) {
  let routePattern = "";

  // Tambahkan resource ke pola jika ada
  if (pathSegments.resource) {
    routePattern = routePattern.concat(`/${pathSegments.resource}`);
  }

  // Tambahkan placeholder ID ke pola jika ada ID
  if (pathSegments.id) {
    // Cek apakah ID adalah angka atau string lain (meskipun di sini kita selalu anggap ':id')
    // Bisa dibuat lebih canggih jika perlu membedakan tipe parameter
    routePattern = routePattern.concat("/:id");
  }

  // Kembalikan pola rute, atau '/' jika tidak ada resource
  return routePattern || "/";
}

// Mengambil pathname aktif dari hash URL
export function getActivePathname() {
  // Hapus '#' dan pastikan ada '/' di awal jika bukan root
  const hashPath = location.hash.replace("#", "");
  return hashPath === ""
    ? "/"
    : hashPath.startsWith("/")
    ? hashPath
    : `/${hashPath}`;
}

// Mengambil *pola* rute aktif berdasarkan pathname saat ini
// Ini yang akan digunakan untuk mencari di routeMap
export function getActiveRoutePattern() {
  const pathname = getActivePathname();
  const urlSegments = extractPathnameSegments(pathname);
  return constructRouteFromSegments(urlSegments);
}

// Menguraikan pathname aktif menjadi objek { resource, id }
// Ini yang akan dikirim sebagai parameter ke presenter.init()
export function parseActivePathname() {
  const pathname = getActivePathname();
  return extractPathnameSegments(pathname);
}

// ---- Fungsi tambahan (jika masih diperlukan di tempat lain) ----

// Mendapatkan pola rute berdasarkan pathname tertentu
export function getRoutePattern(pathname) {
  const urlSegments = extractPathnameSegments(pathname);
  return constructRouteFromSegments(urlSegments);
}

// Menguraikan pathname tertentu menjadi segmen-segmen
export function parsePathname(pathname) {
  return extractPathnameSegments(pathname);
}
