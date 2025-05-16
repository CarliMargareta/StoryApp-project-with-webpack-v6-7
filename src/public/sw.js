// sw.js – Service Worker for StoryApp using Workbox (network-first caching)

importScripts('https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.min.js');
importScripts('https://cdn.jsdelivr.net/npm/workbox-sw@7.3.0/build/workbox-sw.min.js');

const { createStore, set, get, keys, del } = idbKeyval;
const notificationStore = createStore('notifications-db', 'notifications');
const dataStore         = createStore('data-db', 'last-seen-item');
const settingsStore     = createStore('settings-db', 'notification-settings');

const API_BASE_URL = 'https://story-api.dicoding.dev/v1';
const VAPID_PUBLIC = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';

// Workbox init
workbox.setConfig({ debug: false });
workbox.core.skipWaiting();
workbox.core.clientsClaim();

// 1) Precache same‐origin assets
const PRECACHE_URLS = [
  '/', '/index.html',
  '/manifest.json', '/favicon.png',
  '/images/icons/android/android-launchericon-192-192.png',
  '/images/icons/android/android-launchericon-512-512.png',
  '/images/logo.png'
];

workbox.precaching.precacheAndRoute(
  PRECACHE_URLS.map(url => ({ url, revision: null })),
  {
    directoryIndex: '/',
    cleanURLs: false,
  }
);

// 2) Runtime cache for CDN assets
workbox.routing.registerRoute(
  ({url}) =>
    url.origin === 'https://unpkg.com' ||
    url.origin === 'https://cdn.jsdelivr.net',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'cdn-assets',
    plugins: [
      new workbox.expiration.ExpirationPlugin({ maxEntries: 50, purgeOnQuotaError: true }),
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0,200] })
    ]
  })
);

// 3) Network-first for same-origin GET
const isDev = ['localhost','127.0.0.1'].includes(self.location.hostname) || self.location.protocol === 'file:';
const CACHE_NAME = isDev ? 'storyapp-cache-dev' : 'storyapp-cache-v2';

workbox.routing.registerRoute(
  ({request, url}) => request.method === 'GET' && url.origin === self.location.origin,
  new workbox.strategies.NetworkFirst({
    cacheName: CACHE_NAME,
    networkTimeoutSeconds: 10,
    plugins: [
      new workbox.expiration.ExpirationPlugin({ maxEntries: 100, purgeOnQuotaError: true }),
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0,200] })
    ]
  })
);

// 4) SPA navigation fallback
workbox.routing.setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    return caches.match('/index.html');
  }
  return Response.error();
});

// -- Helpers and event listeners below remain complete, uncut --

// Convert Base64 VAPID key to Uint8Array
function urlB64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const str = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(str);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// Get auth token from IDB or client
async function getAuthToken() {
  const stored = await get('authData', dataStore);
  if (stored?.token) return stored.token;
  const clientsList = await clients.matchAll({ type: 'window' });
  if (clientsList.length) {
    return new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ev => resolve(ev.data.token || null);
      clientsList[0].postMessage({ type: 'GET_AUTH_TOKEN' }, [channel.port2]);
    });
  }
  return null;
}

// Activate: clean old caches, register periodic sync, init settings
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => n.startsWith('storyapp-cache-') && n !== CACHE_NAME)
           .map(n => caches.delete(n))
    );
    if ('periodicSync' in self.registration) {
      try {
        await self.registration.periodicSync.register('fetch-new-stories', { minInterval: 15*60*1000 });
        await self.registration.periodicSync.register('store-periodic-notifications', { minInterval: 60*60*1000 });
      } catch {}
    }
    await initDummyNotificationSettings();
    await self.clients.claim();
  })());
});

// Push event: store + show + notify clients
self.addEventListener('push', event => {
  let data = {}; try { data = event.data.json(); } catch {}
  const title = data.title || 'Notifikasi Baru';
  const options = data.options || { body: 'Notifikasi dari StoryApp', icon: '/favicon.png' };
  const id = Date.now().toString();

  event.waitUntil(
    set(id, { title, options, timestamp: Date.now(), read: false }, notificationStore)
      .then(() => self.registration.showNotification(title, options))
      .then(() => notifyClientsOfNewNotification(id, title, options))
  );
});

// Notification click: focus or open
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const client = list.find(c => c.url.includes('/') && c.focus);
        return client ? client.focus() : clients.openWindow('/');
      })
  );
});

// Push subscription change: re-subscribe and inform server
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const newSub = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC)
    });
    const p256 = newSub.getKey('p256dh');
    const auth = newSub.getKey('auth');
    const payload = {
      endpoint: newSub.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(p256))),
        auth:   btoa(String.fromCharCode(...new Uint8Array(auth)))
      }
    };
    const token = await getAuthToken();
    if (!token) return;
    await fetch(`${API_BASE_URL}/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  })());
});

// PeriodicSync & Background Sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'fetch-new-stories') event.waitUntil(checkForNewStories());
  if (event.tag === 'store-periodic-notifications') event.waitUntil(storePeriodicNotification());
});
self.addEventListener('sync', event => {
  if (event.tag === 'fetch-new-stories') event.waitUntil(checkForNewStories());
  if (event.tag === 'store-periodic-notifications') event.waitUntil(storePeriodicNotification());
});

// Message handler: auth token, notification actions, dummy settings
self.addEventListener('message', event => {
  const d = event.data;
  if (d?.type === 'GET_AUTH_TOKEN' && event.ports?.[0]) {
    get('authData', dataStore).then(stored =>
      event.ports[0].postMessage({ token: stored?.token || null })
    );
    return;
  }
  if (d?.type === 'AUTH_TOKEN' && d.token) {
    set('authData', { token: d.token }, dataStore);
    return;
  }
  if (d === 'FLUSH_NOTIFICATIONS') {
    return flushNotifications(event.source.id);
  }
  if (d === 'GET_DUMMY_NOTIFICATIONS_STATUS') {
    return getDummyNotificationStatus(event.source.id);
  }
  if (d.type === 'DELETE_NOTIFICATION') {
    return del(d.id, notificationStore)
      .then(() => event.source.postMessage({ type:'NOTIFICATION_DELETED', id: d.id }));
  }
  if (d.type === 'MARK_AS_READ') {
    return get(d.id, notificationStore)
      .then(item => item && set(d.id, { ...item, read: true }, notificationStore))
      .then(() => event.source.postMessage({ type:'NOTIFICATION_MARKED_READ', id: d.id }));
  }
  if (d.type === 'MARK_ALL_AS_READ') {
    return keys(notificationStore)
      .then(allKeys => Promise.all(allKeys.map(key =>
        get(key, notificationStore).then(item =>
          set(key, { ...item, read: true }, notificationStore)
        )
      )))
      .then(() => event.source.postMessage({ type:'NOTIFICATIONS_MARKED_READ' }));
  }
  if (d.command === 'SET_DUMMY_NOTIFICATIONS') {
    return setDummyNotificationSettings(d.enabled);
  }
});

// Helper: send all notifications to client
async function flushNotifications(clientId) {
  const allKeys = await keys(notificationStore);
  const notes = await Promise.all(allKeys.map(async key => ({
    id: key, ...(await get(key, notificationStore))
  })));
  notes.sort((a,b) => b.timestamp - a.timestamp);
  const client = await clients.get(clientId);
  if (client) client.postMessage({ type:'PENDING_NOTIFICATIONS', notifications: notes });
}

// Helper: notify clients of new notification
async function notifyClientsOfNewNotification(id, title, options) {
  const list = await clients.matchAll({ type:'window' });
  list.forEach(c => c.postMessage({
    type:'NEW_NOTIFICATION',
    notification: { id, title, options, timestamp: Date.now(), read: false }
  }));
}

// Check for new stories & notify
async function checkForNewStories() {
  const token = await getAuthToken();
  if (!token) return;
  const res = await fetch(`${API_BASE_URL}/stories?page=1&size=10`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return;
  const data = await res.json();
  const lastSeen = await get('lastId', dataStore);
  const stories = data.listStory || [];
  for (const story of stories) {
    if (story.id === lastSeen) break;
    const ts = Date.now();
    const title = `Story baru dari ${story.name}`;
    const options = { body: story.description, icon: '/favicon.png', data:{url:story.photoUrl}, image: story.photoUrl };
    const nid = `story-${story.id}-${ts}`;
    await set(nid, { title, options, timestamp: ts, read:false, storyId: story.id }, notificationStore);
    await self.registration.showNotification(title, options);
    await notifyClientsOfNewNotification(nid, title, options);
  }
  if (stories.length) await set('lastId', stories[0].id, dataStore);
}

// Store periodic reminder notifications
async function storePeriodicNotification() {
  const ts = Date.now();
  const id = `periodic-${ts}`;
  const title = 'Kembali ke StoryApp';
  const options = { body:'Jangan lewatkan story baru dari teman-teman!', icon:'/favicon.png', tag:'periodic-reminder', timestamp:ts };
  await set(id, { title, options, timestamp: ts, read:false, type:'periodic' }, notificationStore);
  await self.registration.showNotification(title, options);
  (await clients.matchAll({ type:'window' })).forEach(c =>
    c.postMessage({ type:'NEW_NOTIFICATION', notification:{ id,title,options,timestamp:ts,read:false,type:'periodic'} })
  );
}

// Initialize dummy notification timer/settings
async function initDummyNotificationSettings() {
  const s = await get('dummyNotifications', settingsStore);
  if (s === undefined) {
    await set('dummyNotifications',{ enabled:false, timerId:null }, settingsStore);
  } else if (s.enabled && !s.timerId) {
    const id = startDummyNotificationTimer();
    await set('dummyNotifications',{ enabled:true, timerId:id }, settingsStore);
  }
}

// Enable/disable dummy notifications
async function setDummyNotificationSettings(enabled) {
  const s = await get('dummyNotifications', settingsStore) || { enabled:false, timerId:null };
  if (enabled && !s.enabled) {
    const id = startDummyNotificationTimer();
    await set('dummyNotifications',{ enabled:true, timerId:id }, settingsStore);
    (await clients.matchAll({ type:'window' })).forEach(c => c.postMessage({ type:'DUMMY_NOTIFICATIONS_STATUS', enabled:true }));
  } else if (!enabled && s.enabled) {
    if (s.timerId) clearInterval(s.timerId);
    await set('dummyNotifications',{ enabled:false, timerId:null }, settingsStore);
    (await clients.matchAll({ type:'window' })).forEach(c => c.postMessage({ type:'DUMMY_NOTIFICATIONS_STATUS', enabled:false }));
  }
}

// Send dummy status to client
async function getDummyNotificationStatus(clientId) {
  const s = await get('dummyNotifications', settingsStore) || { enabled:false };
  const client = await clients.get(clientId);
  if (client) client.postMessage({ type:'DUMMY_NOTIFICATIONS_STATUS', enabled:s.enabled });
}

// Timer for dummy notifications every minute
function startDummyNotificationTimer() {
  return setInterval(async () => {
    const s = await get('dummyNotifications', settingsStore);
    if (!s?.enabled) return;
    const ts = Date.now();
    const id = `dummy-${ts}`;
    const title = 'Notifikasi Dummy';
    const options = { body:`Dummy at ${new Date(ts).toLocaleString('id-ID')}`, icon:'/favicon.png', tag:'dummy-notification', timestamp:ts };
    await set(id, { title, options, timestamp:ts, read:false, isDummy:true }, notificationStore);
    await self.registration.showNotification(title, options);
    (await clients.matchAll({ type:'window' })).forEach(c =>
      c.postMessage({ type:'NEW_NOTIFICATION', notification:{ id,title,options,timestamp:ts,read:false,isDummy:true } })
    );
  }, 60*1000);
}

// Cleanup old notifications every 6 hours
setInterval(async () => {
  const now = Date.now();
  const dummyCutoff = now - 1*60*60*1000;      // 1h
  const regularCutoff = now - 7*24*60*60*1000; // 7d
  const allKeys = await keys(notificationStore);
  for (const key of allKeys) {
    const note = await get(key, notificationStore);
    if (!note) continue;
    if ((note.isDummy && note.timestamp < dummyCutoff) ||
        (!note.isDummy && note.timestamp < regularCutoff)) {
      await del(key, notificationStore);
    }
  }
}, 6*60*60*1000); // every 6h
