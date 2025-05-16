// sw.js – Service Worker for StoryApp with Web Push Notifications and Workbox caching

importScripts('https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.min.js');
importScripts('https://cdn.jsdelivr.net/npm/workbox-sw@7.3.0/build/workbox-sw.min.js');

const { createStore, set, get, del } = idbKeyval;
const notificationStore = createStore('notifications-db', 'notifications');
const dataStore         = createStore('data-db', 'authData');

const API_BASE_URL = 'https://story-api.dicoding.dev/v1';
const VAPID_PUBLIC = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';

// Workbox configuration
workbox.setConfig({ debug: false });
workbox.core.skipWaiting();
workbox.core.clientsClaim();

// Precache application shell
const PRECACHE = ['/', '/index.html', '/manifest.json', '/favicon.png', '/images/logo.png'];
workbox.precaching.precacheAndRoute(PRECACHE.map(url => ({ url, revision: null })));

// Network-first strategy for app resources
workbox.routing.registerRoute(
  ({request, url}) => request.method === 'GET' && url.origin === self.location.origin,
  new workbox.strategies.NetworkFirst({
    cacheName: 'app-cache',
    plugins: [ new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0,200] }) ]
  })
);

// Stale-while-revalidate for CDN
workbox.routing.registerRoute(
  ({url}) => ['https://unpkg.com', 'https://cdn.jsdelivr.net'].includes(url.origin),
  new workbox.strategies.StaleWhileRevalidate({ cacheName: 'cdn-cache' })
);

// Helper: base64 to Uint8Array
function urlB64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const str = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(str);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// Helper: get stored auth token
async function getToken() {
  const stored = await get('token', dataStore);
  return stored?.token || null;
}

// Listen for messages from client
self.addEventListener('message', event => {
  const { type, token, endpoint } = event.data;
  if (type === 'AUTH_TOKEN') {
    // Store token and subscribe
    set('token', { token }, dataStore).then(() => subscribePush(token));
  }
  if (type === 'UNSUBSCRIBE') {
    // Unsubscribe and inform server
    unsubscribePush(endpoint);
  }
});

// Subscribe to push
async function subscribePush(token) {
  try {
    const sub = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC)
    });
    const p256 = sub.getKey('p256dh');
    const auth = sub.getKey('auth');
    const body = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(p256))),
        auth: btoa(String.fromCharCode(...new Uint8Array(auth)))
      }
    };
    await fetch(`${API_BASE_URL}/notifications/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('Push subscribe failed:', err);
  }
}

// Unsubscribe from push
async function unsubscribePush(endpoint) {
  try {
    const token = await getToken();
    if (!token) return;
    await fetch(`${API_BASE_URL}/notifications/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ endpoint })
    });
    const subscription = await self.registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
  }
}

// Handle incoming push events
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data.json(); } catch {}
  const title = data.title || 'StoryApp Notification';
  const options = data.options || { body: 'Kamu memiliki notifikasi baru.', icon: '/favicon.png' };
  const id = `notif-${Date.now()}`;
  event.waitUntil(
    set(id, { title, options, timestamp: Date.now(), read: false }, notificationStore)
      .then(() => self.registration.showNotification(title, options))
      .then(() => notifyClients(id, title, options))
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Notify open clients of new notification
async function notifyClients(id, title, options) {
  const all = await clients.matchAll({ type: 'window' });
  all.forEach(c => c.postMessage({
    type: 'NEW_NOTIFICATION',
    notification: { id, title, options, timestamp: Date.now(), read: false }
  }));
}
