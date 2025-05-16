// sw.js – Service Worker for StoryApp

// Import pustaka yang dibutuhkan
importScripts('https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.min.js'); // Untuk IndexedDB
importScripts('https://cdn.jsdelivr.net/npm/workbox-sw@7.3.0/build/workbox-sw.min.js'); // Untuk Caching

const { createStore, get, set, del, keys, clear } = idbKeyval;

// Buat data store untuk notifikasi dan data otentikasi
const notificationStore = createStore('storyapp-notifications-db', 'notifications-store');
const authDataStore = createStore('storyapp-auth-db', 'auth-data-store');

const API_BASE_URL = 'https://story-api.dicoding.dev/v1'; // Pastikan ini URL API Anda
const VAPID_PUBLIC_KEY = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk'; // Ganti dengan VAPID public key Anda

// Konfigurasi Workbox
if (workbox) {
  console.log(`Workbox berhasil dimuat!`);
  workbox.setConfig({ debug: false }); // Set true untuk debugging di development

  // Skip waiting dan claim clients agar SW baru segera aktif
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Precache aset inti aplikasi
  const PRECACHE_ASSETS = [
    { url: '/', revision: 'app-shell-v1' }, // Revisi bisa diupdate saat ada perubahan besar
    { url: '/index.html', revision: 'index-html-v1' },
    { url: '/manifest.json', revision: 'manifest-json-v1' },
    { url: '/favicon.png', revision: 'favicon-v1' },
    { url: 'images/logo.png', revision: 'logo-v1' },
    { url: 'images/icons/ios/192.png', revision: 'icon-192-v1'}
    // Tambahkan aset penting lainnya seperti CSS utama, JS utama jika tidak di-load dari CDN
  ];
  workbox.precaching.precacheAndRoute(PRECACHE_ASSETS);

  // Strategi caching untuk permintaan navigasi (HTML) - NetworkFirst
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'storyapp-pages-cache',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200], // Cache response yang berhasil atau opaque
        }),
      ],
    })
  );

  // Strategi caching untuk aset statis lokal (CSS, JS, gambar) - StaleWhileRevalidate
  workbox.routing.registerRoute(
    ({ request, url }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'image' && url.origin === self.location.origin,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'storyapp-static-resources-cache',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [200],
        }),
      ],
    })
  );

  // Strategi caching untuk aset dari CDN (FontAwesome, Bootstrap, Leaflet, SweetAlert2) - CacheFirst atau StaleWhileRevalidate
  workbox.routing.registerRoute(
    ({ url }) => ['https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://unpkg.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin),
    new workbox.strategies.CacheFirst({ // CacheFirst lebih cocok untuk aset yang jarang berubah dari CDN
      cacheName: 'storyapp-cdn-cache',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50, // Batasi jumlah entri
          maxAgeSeconds: 30 * 24 * 60 * 60, // Cache selama 30 hari
        }),
      ],
    })
  );

  // Strategi caching untuk permintaan API (opsional, tergantung kebutuhan)
  // Contoh: NetworkFirst untuk data API agar selalu coba ambil yang terbaru
  workbox.routing.registerRoute(
    ({ url }) => url.href.startsWith(API_BASE_URL) && url.pathname.includes('/stories'), // Hanya untuk GET stories
    new workbox.strategies.NetworkFirst({
      cacheName: 'storyapp-api-data-cache',
      networkTimeoutSeconds: 5, // Timeout jika jaringan lambat, lalu fallback ke cache
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [200], // Hanya cache response sukses dari API
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 1 * 24 * 60 * 60, // Cache data API selama 1 hari
        }),
      ],
    })
  );

} else {
  console.error(`Workbox gagal dimuat! Fitur caching mungkin tidak berfungsi.`);
}

// --- Fungsi Helper ---

// Mengubah VAPID key dari base64 ke Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, char => char.charCodeAt(0));
}

// Mengambil token otentikasi dari IndexedDB
async function getAuthToken() {
  const authObject = await get('authToken', authDataStore);
  return authObject ? authObject.token : null;
}

// Mengirim pesan ke semua client yang terkontrol
async function notifyAllClients(type, payload) {
  console.log(`SW: Notifying clients - Type: ${type}`, payload);
  const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientsArr.forEach(client => client.postMessage({ type, ...payload }));
}

// Mengirim semua notifikasi yang tersimpan ke client
async function sendAllNotificationsToClients() {
  try {
    const notificationKeys = await keys(notificationStore);
    const allNotifications = [];
    for (const key of notificationKeys) {
      const notification = await get(key, notificationStore);
      if (notification) {
        // Pastikan formatnya konsisten dengan yang diharapkan client
        allNotifications.push({
          id: key, // ID adalah key dari DB
          title: notification.title,
          options: notification.options, // options sudah berisi body, icon, data, dll.
          timestamp: notification.timestamp,
          read: notification.read,
        });
      }
    }
    allNotifications.sort((a, b) => b.timestamp - a.timestamp); // Terbaru dulu
    notifyAllClients('ALL_NOTIFICATIONS', { notifications: allNotifications });
  } catch (error) {
    console.error('SW: Error sending all notifications to clients:', error);
  }
}

// --- Event Listener Service Worker ---

self.addEventListener('install', (event) => {
  console.log('SW: Install event');
  // SW akan skip waiting di 'activate' jika workbox.core.skipWaiting() dipanggil
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activate event');
  event.waitUntil(self.clients.claim()); // Klaim kontrol atas client yang terbuka
});

// Menerima pesan dari client
self.addEventListener('message', async (event) => {
  if (!event.data || !event.data.type) return;
  const { type, token, id, endpoint } = event.data;
  console.log(`SW: Received message - Type: ${type}`, event.data);

  switch (type) {
    case 'AUTH_TOKEN':
      if (token) {
        await set('authToken', { token }, authDataStore);
        console.log('SW: Auth token stored. Attempting to subscribe for push notifications.');
        await subscribeToPushNotifications(); // Coba subscribe setelah token disimpan
      }
      break;
    case 'UNSUBSCRIBE_PUSH': // Jika client meminta unsubscribe
      await unsubscribeFromPushNotifications(endpoint); // Anda mungkin perlu endpoint dari client
      break;
    case 'GET_ALL_NOTIFICATIONS':
      await sendAllNotificationsToClients();
      break;
    case 'MARK_AS_READ':
      if (id) {
        const notification = await get(id, notificationStore);
        if (notification && !notification.read) {
          notification.read = true;
          await set(id, notification, notificationStore);
          await sendAllNotificationsToClients(); // Kirim update ke semua client
        }
      }
      break;
    case 'MARK_ALL_AS_READ':
      const notifKeysReadAll = await keys(notificationStore);
      let markedAnyAsRead = false;
      for (const key of notifKeysReadAll) {
        const notification = await get(key, notificationStore);
        if (notification && !notification.read) {
          notification.read = true;
          await set(key, notification, notificationStore);
          markedAnyAsRead = true;
        }
      }
      if (markedAnyAsRead) await sendAllNotificationsToClients();
      break;
    case 'DELETE_NOTIFICATION':
      if (id) {
        await del(id, notificationStore);
        await sendAllNotificationsToClients();
      }
      break;
    case 'CLEAR_NOTIFICATIONS':
      await clear(notificationStore);
      await sendAllNotificationsToClients();
      break;
    default:
      console.warn(`SW: Unknown message type received: ${type}`);
  }
});

// --- Push Notification Handling ---

async function subscribeToPushNotifications() {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.log('SW: No auth token, cannot subscribe to push.');
      return;
    }

    const existingSubscription = await self.registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('SW: User is already subscribed.', existingSubscription);
      // Anda bisa mengirim ulang subscription ke server jika perlu validasi ulang
      // await sendSubscriptionToServer(existingSubscription, token, 'update');
      return;
    }

    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    console.log('SW: User subscribed successfully:', subscription);
    await sendSubscriptionToServer(subscription, token, 'subscribe');
  } catch (error) {
    console.error('SW: Failed to subscribe the user: ', error);
    if (error.name === 'NotAllowedError') {
        console.warn('SW: Push permission denied by user.');
        // Beri tahu client agar bisa menampilkan UI yang sesuai
        notifyAllClients('PUSH_PERMISSION_DENIED');
    }
  }
}

async function unsubscribeFromPushNotifications(currentEndpoint) {
  try {
    const token = await getAuthToken();
    // Tidak perlu token untuk unsubscribe dari PushManager, tapi mungkin perlu untuk server
    
    const subscription = await self.registration.pushManager.getSubscription();
    if (subscription) {
      const endpointToDelete = subscription.endpoint;
      const success = await subscription.unsubscribe();
      if (success) {
        console.log('SW: User unsubscribed successfully.');
        // Beritahu server untuk menghapus subscription
        if (token && endpointToDelete) {
          await sendSubscriptionToServer({ endpoint: endpointToDelete }, token, 'unsubscribe');
        }
      } else {
        console.error('SW: Failed to unsubscribe user.');
      }
    } else {
      console.log('SW: No active subscription to unsubscribe.');
      // Jika ada endpoint dari client, coba hapus dari server
      if (token && currentEndpoint) {
          await sendSubscriptionToServer({ endpoint: currentEndpoint }, token, 'unsubscribe');
      }
    }
  } catch (error) {
    console.error('SW: Error unsubscribing user: ', error);
  }
}

async function sendSubscriptionToServer(subscription, authToken, action = 'subscribe') {
  const endpointUrl = `${API_BASE_URL}/notifications/${action}`; // Sesuaikan endpoint API Anda
  let bodyPayload;

  if (action === 'subscribe') {
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh'))));
      const auth = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))));
      bodyPayload = {
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
      };
  } else if (action === 'unsubscribe') {
      bodyPayload = { endpoint: subscription.endpoint }; // Hanya perlu endpoint untuk unsubscribe
  } else {
      console.warn('SW: Invalid action for sendSubscriptionToServer');
      return;
  }
  
  try {
    const response = await fetch(endpointUrl, {
      method: action === 'unsubscribe' ? 'DELETE' : 'POST', // DELETE untuk unsubscribe, POST untuk subscribe
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (response.ok) {
      console.log(`SW: Subscription ${action}d successfully on server.`);
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown server error' }));
      console.error(`SW: Failed to ${action} subscription on server. Status: ${response.status}`, errorData.message);
    }
  } catch (error) {
    console.error(`SW: Error sending subscription to server (${action}):`, error);
  }
}


// Menerima push event dari server
self.addEventListener('push', (event) => {
  console.log('SW: Push event received.');
  let pushData = {
    title: 'StoryApp Notification',
    options: {
      body: 'Anda memiliki notifikasi baru!',
      icon: '/favicon.png', // Ikon default
      badge: 'images/icons/ios/72.png', // Ikon untuk status bar Android
      tag: `storyapp-notif-${Date.now()}`, // Tag unik agar notifikasi bisa di-update/replace
      data: { // Data tambahan, misal URL untuk dibuka saat klik
        url: '/', // URL default
        idForDB: `notif-id-${Date.now()}`, // ID unik untuk disimpan di DB
      },
      renotify: true, // Getarkan/bunyikan lagi jika notifikasi dengan tag sama di-update
      actions: [ // Contoh action button
        // { action: 'explore', title: 'Jelajahi', icon: 'images/icons/actions/explore.png' },
        // { action: 'close', title: 'Tutup', icon: 'images/icons/actions/close.png' },
      ]
    }
  };

  if (event.data) {
    try {
      const parsedData = event.data.json();
      pushData.title = parsedData.title || pushData.title;
      // Gabungkan options dari push dengan default,utamakan dari push
      pushData.options = { ...pushData.options, ...parsedData.options }; 
      // Pastikan data.idForDB selalu unik jika tidak disediakan
      if (!pushData.options.data.idForDB && parsedData.options?.data?.id) {
        pushData.options.data.idForDB = parsedData.options.data.id; // Gunakan ID dari server jika ada
      } else if (!pushData.options.data.idForDB) {
        pushData.options.data.idForDB = `notif-id-${Date.now()}`;
      }
       // Pastikan ada URL
      pushData.options.data.url = parsedData.options?.data?.url || '/';

    } catch (e) {
      console.error('SW: Error parsing push data JSON. Using default.', e);
      // Jika parsing gagal, pushData default akan digunakan
    }
  }

  // Data notifikasi untuk disimpan di IndexedDB
  const notificationToStore = {
    id: pushData.options.data.idForDB, // Gunakan ID unik ini sebagai key
    title: pushData.title,
    options: pushData.options, // options sudah termasuk body, icon, data, dll.
    timestamp: Date.now(),
    read: false,
  };

  const showNotificationPromise = self.registration.showNotification(pushData.title, pushData.options);
  const storeNotificationPromise = set(notificationToStore.id, notificationToStore, notificationStore)
    .then(() => {
      // Kirim notifikasi baru ke client yang aktif
      notifyAllClients('NEW_NOTIFICATION', { notification: notificationToStore });
    });

  event.waitUntil(Promise.all([showNotificationPromise, storeNotificationPromise]));
});


// Ketika notifikasi diklik oleh pengguna
self.addEventListener('notificationclick', (event) => {
  const clickedNotification = event.notification;
  const action = event.action; // Jika ada action button yang diklik

  clickedNotification.close(); // Selalu tutup notifikasi setelah diklik

  console.log('SW: Notification clicked:', clickedNotification);
  console.log('SW: Action clicked:', action);

  const notificationIdInDB = clickedNotification.data?.idForDB;
  const urlToOpen = clickedNotification.data?.url || '/';

  // Tandai sebagai dibaca di DB dan update client
  const markReadAndUpdatePromise = notificationIdInDB ? (async () => {
      const notification = await get(notificationIdInDB, notificationStore);
      if (notification) {
          notification.read = true;
          await set(notificationIdInDB, notification, notificationStore);
          await sendAllNotificationsToClients(); // Update semua client
      }
  })() : Promise.resolve();


  // Penanganan action button (jika ada)
  if (action === 'close') {
    // Tidak melakukan apa-apa, notifikasi sudah ditutup
  } else if (action === 'explore') {
    // Buka URL spesifik untuk explore
    event.waitUntil(Promise.all([markReadAndUpdatePromise, self.clients.openWindow('/explore')])); // Contoh URL
  } else {
    // Default action: buka URL dari data notifikasi
    event.waitUntil(
      Promise.all([
        markReadAndUpdatePromise,
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          // Cek apakah ada window yang sudah terbuka dengan URL yang sama
          for (const client of windowClients) {
            // Perlu perbandingan URL yang lebih cermat jika ada query params atau hash
            if (new URL(client.url, self.location.origin).pathname === new URL(urlToOpen, self.location.origin).pathname && 'focus' in client) {
              return client.focus();
            }
          }
          // Jika tidak ada, buka window baru
          return self.clients.openWindow(urlToOpen);
        })
      ])
    );
  }
});

console.log('SW: Service Worker script parsed and executed.');