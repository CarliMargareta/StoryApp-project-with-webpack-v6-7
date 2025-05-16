// src/index.js (Tidak perlu diubah)

// Impor file CSS utama
import "../styles/styles.css";

// Impor kelas App (asumsikan app.js sudah dimodifikasi untuk MVP)
import App from "./pages/app"; // Sesuaikan path jika perlu


// Jalankan setelah seluruh dokumen dimuat
document.addEventListener("DOMContentLoaded", async () => {
  // Cek dukungan View Transitions (opsional)
  if (!document.startViewTransition) {
    console.log("View Transitions API tidak didukung oleh browser ini.");
  }

  // Inisialisasi aplikasi dengan elemen DOM
  const app = new App({
    content: document.querySelector("#main-content"),
    drawerButton: document.querySelector("#drawer-button"),
    navigationDrawer: document.querySelector("#navigation-drawer"),
    skipToContent: document.querySelector("#skip-to-content"),
  });

  // Render halaman awal saat aplikasi dimuat
  // App.renderPage() sekarang akan menggunakan getPageConfigForRoute
  await app.renderPage();

  // Render ulang halaman saat hash URL berubah
  window.addEventListener("hashchange", async () => {
    await app.renderPage();
  });

  // Daftarkan push subscription
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "ServiceWorker registration successful with scope: ",
            registration.scope
          );
          subscribeUserToPush(registration);
        })
        .catch((error) => {
          console.log("ServiceWorker registration failed: ", error);
        });
    });
  }
});

function subscribeUserToPush(registration) {
  const applicationServerPublicKey = "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk";
  const applicationServerKey = urlB64ToUint8Array(applicationServerPublicKey);
  const options = {
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey,
  };

  return registration.pushManager.subscribe(options)
    .then((subscription) => {
      console.log("User is subscribed:", subscription);
      // Kirim subscription ke server Anda
      return fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });
    })
    .catch((err) => {
      console.error("Failed to subscribe the user: ", err);
    });
}

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
