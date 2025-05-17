// sw.js – Service Worker for StoryApp

// Import pustaka yang dibutuhkan
importScripts('https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.min.js'); // Untuk IndexedDB
importScripts('https://cdn.jsdelivr.net/npm/workbox-sw@7.3.0/build/workbox-sw.min.js'); // Untuk Caching

const { createStore, get, set, del, keys, clear } = idbKeyval;

// Buat data store untuk notifikasi dan data otentikasi
const notificationStore = createStore('storyapp-notifications-db', 'notifications-store');
const authDataStore = createStore('storyapp-auth-db', 'auth-data-store');

const API_BASE_URL = 'https://story-api.dicoding.dev/v1'; // Pastikan ini URL API Anda
const VAPID_PUBLIC_KEY = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk'; // VAPID public key Anda

// Konfigurasi Workbox
if (workbox) {
  console.log(`Workbox berhasil dimuat!`);
  workbox.setConfig({ debug: false }); // Set true untuk debugging di development

  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  const PRECACHE_ASSETS = [
    { url: '/', revision: 'app-shell-v1' },
    { url: '/index.html', revision: 'index-html-v1' },
    { url: '/manifest.json', revision: 'manifest-json-v1' },
    { url: '/favicon.png', revision: 'favicon-v1' },
    { url: 'images/logo.png', revision: 'logo-v1' },
    { url: 'images/icons/ios/192.png', revision: 'icon-192-v1'}
  ];
  workbox.precaching.precacheAndRoute(PRECACHE_ASSETS);

  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'storyapp-pages-cache',
      plugins: [ new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }) ],
    })
  );

  workbox.routing.registerRoute(
    ({ request, url }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'image' && url.origin === self.location.origin,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'storyapp-static-resources-cache',
      plugins: [ new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }) ],
    })
  );

  workbox.routing.registerRoute(
    ({ url }) => ['https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://unpkg.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin),
    new workbox.strategies.CacheFirst({
      cacheName: 'storyapp-cdn-cache',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
        new workbox.expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    })
  );

  workbox.routing.registerRoute(
    ({ url }) => url.href.startsWith(API_BASE_URL) && url.pathname.includes('/stories'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'storyapp-api-data-cache',
      networkTimeoutSeconds: 5,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
        new workbox.expiration.ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 1 * 24 * 60 * 60 }),
      ],
    })
  );

} else {
  console.error(`Workbox gagal dimuat! Fitur caching mungkin tidak berfungsi.`);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, char => char.charCodeAt(0));
}

async function getAuthToken() {
  const authObject = await get('authToken', authDataStore);
  return authObject ? authObject.token : null;
}

async function notifyAllClients(type, payload) {
  console.log(`SW: Notifying clients - Type: ${type}`, payload ? JSON.stringify(payload).substring(0, 200) + '...' : ''); // Log payload singkat
  const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientsArr.forEach(client => client.postMessage({ type, ...payload }));
}

async function sendAllNotificationsToClients() {
  try {
    const notificationKeys = await keys(notificationStore);
    const allNotifications = [];
    for (const key of notificationKeys) {
      const notification = await get(key, notificationStore);
      if (notification) {
        allNotifications.push({
          id: key,
          title: notification.title,
          options: notification.options,
          timestamp: notification.timestamp,
          read: notification.read,
        });
      }
    }
    allNotifications.sort((a, b) => b.timestamp - a.timestamp);
    notifyAllClients('ALL_NOTIFICATIONS', { notifications: allNotifications });
  } catch (error) {
    console.error('SW: Error sending all notifications to clients:', error);
  }
}

self.addEventListener('install', (event) => {
  console.log('SW: Install event');
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activate event');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', async (event) => {
  if (!event.data || !event.data.type) return;
  const { type, token, id, endpoint } = event.data;
  console.log(`SW: Received message - Type: ${type}`, event.data);

  switch (type) {
    case 'AUTH_TOKEN':
      if (token) {
        await set('authToken', { token }, authDataStore);
        console.log('SW: Auth token stored. Attempting to subscribe for push notifications.');
        await subscribeToPushNotifications();
      }
      break;
    case 'UNSUBSCRIBE_PUSH':
      await unsubscribeFromPushNotifications(endpoint);
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
          await sendAllNotificationsToClients();
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
        notifyAllClients('PUSH_PERMISSION_DENIED');
    }
  }
}

async function unsubscribeFromPushNotifications(currentEndpoint) {
  try {
    const token = await getAuthToken();
    const subscription = await self.registration.pushManager.getSubscription();
    if (subscription) {
      const endpointToDelete = subscription.endpoint;
      const success = await subscription.unsubscribe();
      if (success) {
        console.log('SW: User unsubscribed successfully.');
        if (token && endpointToDelete) {
          await sendSubscriptionToServer({ endpoint: endpointToDelete }, token, 'unsubscribe');
        }
      } else {
        console.error('SW: Failed to unsubscribe user.');
      }
    } else {
      console.log('SW: No active subscription to unsubscribe.');
      if (token && currentEndpoint) {
        await sendSubscriptionToServer({ endpoint: currentEndpoint }, token, 'unsubscribe');
      }
    }
  } catch (error) {
    console.error('SW: Error unsubscribing user: ', error);
  }
}

async function sendSubscriptionToServer(subscription, authToken, action = 'subscribe') {
  // Sesuai dokumentasi API Anda, endpoint untuk subscribe dan unsubscribe berbeda method tapi URL sama
  // Namun, di kode Anda sebelumnya, Anda menggunakan /notifications/subscribe dan /notifications/unsubscribe
  // Saya akan mengikuti logika API yang /notifications/subscribe untuk POST dan DELETE
  const endpointUrl = `${API_BASE_URL}/notifications/subscribe`;
  let bodyPayload;

  if (action === 'subscribe') {
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh'))));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))); // "auth" adalah nama field di PushSubscription
      bodyPayload = {
        endpoint: subscription.endpoint,
        // Sesuai dokumentasi API, server mengharapkan "keys" sebagai objek dengan "p256dh" dan "auth"
        // Namun request body subscribe di API Anda adalah: endpoint, keys, p256dh, auth. Ini sedikit ambigu.
        // Saya akan mengikuti struktur yang paling umum dimana p256dh dan auth ada di dalam objek keys.
        // Jika server Anda mengharapkannya di root, sesuaikan.
        // Berdasarkan contoh response subscribe, sepertinya keys adalah string, bukan objek. Mari sesuaikan.
        // JUGA, API docs Anda untuk subscribe meminta: endpoint, keys, p256dh, auth.
        // Ini berarti "keys" mungkin field lain, atau p256dh dan auth adalah top-level.
        // Mari kita coba kirim p256dh dan auth sebagai top-level sesuai API docs.
        p256dh: p256dh, // Mengikuti API docs
        auth: authKey    // Mengikuti API docs
        // "keys" field di API docs tidak jelas apa isinya, mungkin ini adalah nama field yang salah di docs
        // atau merujuk ke keseluruhan objek subscription keys. Untuk sekarang kita abaikan field "keys" ini.
      };
  } else if (action === 'unsubscribe') {
      bodyPayload = { endpoint: subscription.endpoint }; // Sesuai API docs untuk unsubscribe
  } else {
      console.warn('SW: Invalid action for sendSubscriptionToServer');
      return;
  }
  
  try {
    const response = await fetch(endpointUrl, {
      method: action === 'subscribe' ? 'POST' : 'DELETE', // Sesuai API docs
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (response.ok) {
      console.log(`SW: Subscription ${action}d successfully on server.`);
    } else {
      const errorText = await response.text();
      console.error(`SW: Failed to ${action} subscription on server. Status: ${response.status}`, errorText);
    }
  } catch (error) {
    console.error(`SW: Error sending subscription to server (${action}):`, error);
  }
}


// --- BAGIAN PENTING: Event listener untuk 'push' ---
self.addEventListener('push', (event) => {
  console.log('SW: Push event received.');
  // Default data jika tidak ada payload atau parsing gagal
  const defaultNotificationId = `notif-id-default-${Date.now()}`;
  let pushData = {
    title: 'StoryApp Notification', // Default title
    options: {
      body: 'Anda memiliki notifikasi baru!', // Default body
      icon: '/favicon.png',
      badge: 'images/icons/ios/72.png',
      tag: `storyapp-notif-${Date.now()}`, // Tag untuk notifikasi sistem (bisa di-update)
      data: {
        url: '/', // URL default jika notifikasi diklik
        idForDB: defaultNotificationId // ID unik default untuk IndexedDB
      },
      renotify: true,
      actions: []
    }
  };

  console.log('SW: Initial pushData.options.data:', JSON.stringify(pushData.options.data));

  if (event.data) {
    try {
      const parsedDataFromServer = event.data.json();
      console.log('SW: Parsed push data from server:', JSON.stringify(parsedDataFromServer));

      // Update title dari server jika ada
      pushData.title = parsedDataFromServer.title || pushData.title;

      // Simpan referensi ke data default sebelum di-override
      const originalDefaultData = { ...pushData.options.data };

      // Gabungkan options dari server. Hati-hati, ini bisa menimpa seluruh `pushData.options.data`
      // jika `parsedDataFromServer.options` tidak memiliki struktur `data` di dalamnya.
      if (parsedDataFromServer.options) {
        pushData.options = { ...pushData.options, ...parsedDataFromServer.options };
      }
      
      // Pastikan `pushData.options.data` adalah objek setelah penggabungan.
      // Jika `parsedDataFromServer.options` tidak punya field `data`, maka `pushData.options.data` bisa jadi undefined.
      if (typeof pushData.options.data !== 'object' || pushData.options.data === null) {
        console.warn('SW: pushData.options.data is not an object after merging with server options. Resetting to original default data.');
        pushData.options.data = originalDefaultData; // Kembalikan ke struktur data default
      } else {
        // Jika server mengirim options.data, pastikan field penting kita (idForDB, url) terjaga atau diupdate.
        // Berdasarkan API docs, server TIDAK mengirim id. Jadi kita akan selalu pakai ID default yang kita generate.
        // Jika server mengirim URL, kita gunakan itu.
        pushData.options.data = {
          ...originalDefaultData, // Ambil default (terutama idForDB)
          ...pushData.options.data, // Timpa dengan data dari server jika ada (misal, server kirim URL atau field lain)
          idForDB: originalDefaultData.idForDB // PAKSA penggunaan ID yang kita generate, karena server tidak mengirimnya.
        };
      }
      
      // Khusus untuk URL, jika server mengirimnya di dalam `parsedDataFromServer.options.data.url`
      if (parsedDataFromServer.options && parsedDataFromServer.options.data && parsedDataFromServer.options.data.url) {
        pushData.options.data.url = parsedDataFromServer.options.data.url;
      } else if (!pushData.options.data.url) { // Jika setelah merge, URL tidak ada, gunakan default.
        pushData.options.data.url = originalDefaultData.url;
      }


      console.log('SW: Final pushData.options.data after processing server data:', JSON.stringify(pushData.options.data));

    } catch (e) {
      console.error('SW: Error parsing push data JSON from server. Using default data structure. Error:', e);
      // Jika parsing gagal, pushData sudah memiliki struktur default termasuk idForDB
      console.log('SW: Using default pushData.options.data due to parse error:', JSON.stringify(pushData.options.data));
    }
  } else {
    console.log('SW: No event.data in push event. Using default data structure.');
    // pushData sudah memiliki idForDB default
    console.log('SW: Using default pushData.options.data as no event.data received:', JSON.stringify(pushData.options.data));
  }

  // Data final yang akan disimpan ke IndexedDB
  const notificationToStore = {
    id: pushData.options.data.idForDB, // Ini akan menjadi KEY di IndexedDB
    title: pushData.title,
    options: pushData.options, // Seluruh objek options, termasuk options.data di dalamnya
    timestamp: Date.now(),
    read: false,
  };

  console.log('SW: Attempting to store notification in IndexedDB. Key:', notificationToStore.id, 'Full object:', JSON.stringify(notificationToStore, null, 2));

  // Validasi PENTING: Pastikan ID untuk IndexedDB adalah string yang valid dan tidak kosong
  if (!notificationToStore.id || typeof notificationToStore.id !== 'string' || notificationToStore.id.trim() === '') {
    console.error('SW: CRITICAL - notificationToStore.id (key for IndexedDB) is invalid or empty. Current value:', notificationToStore.id);
    const fallbackId = `fallback-notif-id-${Date.now()}`; // Buat ID fallback jika ID utama bermasalah
    console.warn(`SW: Using fallback ID for IndexedDB: ${fallbackId}`);
    notificationToStore.id = fallbackId;
    // Update juga idForDB di dalam options.data untuk konsistensi
    if (pushData.options.data) {
        pushData.options.data.idForDB = fallbackId;
    } else { // Jika options.data tidak ada (seharusnya tidak terjadi dengan logika di atas)
        pushData.options.data = { idForDB: fallbackId, url: '/' };
    }
    // Pastikan perubahan ini tercermin di notificationToStore.options.data juga
     notificationToStore.options.data.idForDB = fallbackId;

  }

  const showNotificationPromise = self.registration.showNotification(pushData.title, pushData.options);

  const storeNotificationPromise = set(notificationToStore.id, notificationToStore, notificationStore)
    .then(() => {
      console.log('SW: Notification stored successfully in IndexedDB! Key:', notificationToStore.id);
      notifyAllClients('NEW_NOTIFICATION', { notification: notificationToStore });
    })
    .catch(error => {
      // Ini adalah logging error yang sangat penting
      console.error('SW: FAILED to store notification in IndexedDB. Key tried:', notificationToStore.id, 'Error:', error);
    });

  event.waitUntil(Promise.all([showNotificationPromise, storeNotificationPromise]));
});
// --- AKHIR BAGIAN PENTING ---


self.addEventListener('notificationclick', (event) => {
  const clickedNotification = event.notification;
  const action = event.action;

  clickedNotification.close();

  console.log('SW: Notification clicked:', clickedNotification);
  console.log('SW: Action clicked:', action);

  const notificationIdInDB = clickedNotification.data?.idForDB; // Pastikan ini adalah ID yang sama dengan yang disimpan
  const urlToOpen = clickedNotification.data?.url || '/';

  console.log(`SW: Clicked notification's idForDB: ${notificationIdInDB}, URL to open: ${urlToOpen}`);

  const markReadAndUpdatePromise = notificationIdInDB ? (async () => {
      console.log(`SW: Attempting to mark as read notification with DB key: ${notificationIdInDB}`);
      try {
        const notification = await get(notificationIdInDB, notificationStore);
        if (notification) {
          console.log(`SW: Found notification in DB for key ${notificationIdInDB}. Marking as read.`);
          notification.read = true;
          await set(notificationIdInDB, notification, notificationStore);
          await sendAllNotificationsToClients();
        } else {
          console.warn(`SW: Notification with DB key ${notificationIdInDB} not found in DB for marking as read.`);
        }
      } catch (dbError) {
        console.error(`SW: Error accessing DB for key ${notificationIdInDB} to mark as read:`, dbError);
      }
  })() : Promise.resolve();


  if (action === 'close') {
    // No specific action needed
  } else if (action === 'explore') {
    event.waitUntil(Promise.all([markReadAndUpdatePromise, self.clients.openWindow('/explore')]));
  } else {
    event.waitUntil(
      Promise.all([
        markReadAndUpdatePromise,
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          for (const client of windowClients) {
            if (new URL(client.url, self.location.origin).pathname === new URL(urlToOpen, self.location.origin).pathname && 'focus' in client) {
              return client.focus();
            }
          }
          return self.clients.openWindow(urlToOpen);
        })
      ])
    );
  }
});

console.log('SW: Service Worker script parsed and executed.');