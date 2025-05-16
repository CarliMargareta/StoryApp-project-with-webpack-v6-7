// sw.js - Service Worker for StoryApp with push notifications and auth token handling
importScripts('https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.min.js');

const { createStore, set, get, keys, del } = idbKeyval;
const notificationStore = createStore('notifications-db', 'notifications');
const dataStore         = createStore('data-db', 'last-seen-item');
const settingsStore     = createStore('settings-db', 'notification-settings');

const API_BASE_URL = 'https://story-api.dicoding.dev/v1';

// Cache configuration
const isDev = ['localhost','127.0.0.1'].includes(self.location.hostname) || self.location.protocol === 'file:';
const CACHE_NAME = isDev ? 'storyapp-cache-dev' : 'storyapp-cache-v2';
const urlsToCache = [
  '/', '/index.html', '/app.css', '/app.bundle.js', '/app.bundle.js.LICENSE.txt',
  '/manifest.json', '/favicon.png',
  '/images/icons/android/android-launchericon-192-192.png',
  '/images/icons/android/android-launchericon-512-512.png',
  '/images/logo.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css',
  'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js'
];

// VAPID key helper
function urlB64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const str = (b64 + padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(str);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
const VAPID_PUBLIC = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';

// Retrieve auth token from IndexedDB or via client message
async function getAuthToken() {
  const stored = await get('authData', dataStore);
  if (stored?.token) return stored.token;

  const allClients = await clients.matchAll({ type: 'window' });
  if (allClients.length) {
    return new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ev => resolve(ev.data.token || null);
      allClients[0].postMessage({ type: 'GET_AUTH_TOKEN' }, [channel.port2]);
    });
  }
  return null;
}

// INSTALL: cache assets
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      urlsToCache.map(async url => {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) await cache.put(url, res.clone());
        } catch {}
      })
    );
    await self.skipWaiting();
  })());
});

// ACTIVATE: cleanup old caches & periodic sync
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => n.startsWith('storyapp-cache-') && n !== CACHE_NAME)
           .map(n => caches.delete(n))
    );
    if ('periodicSync' in self.registration) {
      try {
        await self.registration.periodicSync.register('fetch-new-stories', { minInterval:15*60*1000 });
        await self.registration.periodicSync.register('store-periodic-notifications', { minInterval:60*60*1000 });
      } catch {}
    }
    await initDummyNotificationSettings();
    await self.clients.claim();
  })());
});

// FETCH: network-first with cache fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request);
      if (res.ok && event.request.url.startsWith(self.location.origin)) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, res.clone());
      }
      return res;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('/index.html');
      return new Response('Offline', { status: 503 });
    }
  })());
});

// PUSH: store to IndexedDB, show notification, notify clients
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data.json(); } catch {}
  const title   = data.title || 'Notifikasi Baru';
  const options = data.options || { body:'Notifikasi dari StoryApp', icon:'/favicon.png' };
  const id      = Date.now().toString();

  event.waitUntil(
    set(id, { title, options, timestamp:Date.now(), read:false }, notificationStore)
      .then(() => self.registration.showNotification(title, options))
      .then(() => notifyClientsOfNewNotification(id, title, options))
  );
});

// Notification click: focus existing or open new window
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true })
      .then(list => list.find(c => c.url==='/' && c.focus)?.focus() || clients.openWindow('/'))
  );
});

// Push subscription change: re-subscribe & send to server
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
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  })());
});

// PERIODIC & BACKGROUND SYNC
self.addEventListener('periodicsync', event => {
  if (event.tag==='fetch-new-stories') event.waitUntil(checkForNewStories());
  if (event.tag==='store-periodic-notifications') event.waitUntil(storePeriodicNotification());
});
self.addEventListener('sync', event => {
  if (event.tag==='fetch-new-stories') event.waitUntil(checkForNewStories());
  if (event.tag==='store-periodic-notifications') event.waitUntil(storePeriodicNotification());
});

// MESSAGE handler
self.addEventListener('message', event => {
  const d = event.data;
  // Client requests auth token
  if (d?.type==='GET_AUTH_TOKEN' && event.ports?.[0]) {
    get('authData', dataStore).then(stored => {
      event.ports[0].postMessage({ token: stored?.token || null });
    });
    return;
  }
  // Client sends auth token
  if (d?.type==='AUTH_TOKEN' && d.token) {
    set('authData', { token:d.token }, dataStore);
    return;
  }
  // Other commands
  if (d==='FLUSH_NOTIFICATIONS') return flushNotifications(event.source.id);
  if (d==='GET_DUMMY_NOTIFICATIONS_STATUS') return getDummyNotificationStatus(event.source.id);
  if (d.type==='DELETE_NOTIFICATION') {
    return del(d.id, notificationStore)
      .then(() => event.source.postMessage({ type:'NOTIFICATION_DELETED', id:d.id }));
  }
  if (d.type==='MARK_AS_READ') {
    return get(d.id, notificationStore)
      .then(item => item && set(d.id, { ...item, read:true }, notificationStore))
      .then(() => event.source.postMessage({ type:'NOTIFICATION_MARKED_READ', id:d.id }));
  }
  if (d.type==='MARK_ALL_AS_READ') {
    return keys(notificationStore)
      .then(allKeys => Promise.all(allKeys.map(key =>
        get(key, notificationStore).then(item =>
          set(key, { ...item, read:true }, notificationStore)
        )
      )))
      .then(() => event.source.postMessage({ type:'NOTIFICATIONS_MARKED_READ' }));
  }
  if (d.command==='SET_DUMMY_NOTIFICATIONS') return setDummyNotificationSettings(d.enabled);
});

// Helpers

async function flushNotifications(clientId) {
  const allKeys = await keys(notificationStore);
  const notes = await Promise.all(allKeys.map(async key => ({ id:key, ...(await get(key, notificationStore)) })));
  notes.sort((a,b) => b.timestamp - a.timestamp);
  const client = await clients.get(clientId);
  if (client) client.postMessage({ type:'PENDING_NOTIFICATIONS', notifications:notes });
}

async function notifyClientsOfNewNotification(id, title, options) {
  const list = await clients.matchAll({ type:'window' });
  list.forEach(c => c.postMessage({
    type:'NEW_NOTIFICATION',
    notification:{ id, title, options, timestamp:Date.now(), read:false }
  }));
}

async function checkForNewStories() {
  const token = await getAuthToken();
  if (!token) return;
  const res = await fetch(`${API_BASE_URL}/stories?page=1&size=10`, {
    headers:{ Authorization:`Bearer ${token}` }
  });
  if (!res.ok) return;
  const data = await res.json();
  const lastSeen = await get('lastId', dataStore);
  const stories = data.listStory || [];
  for (const story of stories) {
    if (story.id === lastSeen) break;
    const ts = Date.now();
    const title = `Story baru dari ${story.name}`;
    const options = {
      body: story.description,
      icon:'/favicon.png',
      data:{ url:story.photoUrl },
      image:story.photoUrl
    };
    const nid = `story-${story.id}-${ts}`;
    await set(nid, { title, options, timestamp:ts, read:false, storyId:story.id }, notificationStore);
    await self.registration.showNotification(title, options);
    await notifyClientsOfNewNotification(nid, title, options);
  }
  if (stories.length) await set('lastId', stories[0].id, dataStore);
}

async function storePeriodicNotification() {
  const ts = Date.now();
  const id = `periodic-${ts}`;
  const title = 'Kembali ke StoryApp';
  const options = {
    body: 'Jangan lewatkan story baru dari teman-teman!',
    icon:'/favicon.png',
    tag:'periodic-reminder',
    timestamp:ts
  };
  await set(id, { title, options, timestamp:ts, read:false, type:'periodic' }, notificationStore);
  await self.registration.showNotification(title, options);
  (await clients.matchAll({ type:'window' })).forEach(c =>
    c.postMessage({
      type:'NEW_NOTIFICATION',
      notification:{ id, title, options, timestamp:ts, read:false, type:'periodic' }
    })
  );
}

async function initDummyNotificationSettings() {
  const s = await get('dummyNotifications', settingsStore);
  if (s===undefined) {
    await set('dummyNotifications', { enabled:false, timerId:null }, settingsStore);
  } else if (s.enabled && !s.timerId) {
    const id = startDummyNotificationTimer();
    await set('dummyNotifications', { enabled:true, timerId:id }, settingsStore);
  }
}

async function setDummyNotificationSettings(enabled) {
  const s = await get('dummyNotifications', settingsStore) || { enabled:false };
  if (enabled && !s.enabled) {
    const id = startDummyNotificationTimer();
    await set('dummyNotifications', { enabled:true, timerId:id }, settingsStore);
    (await clients.matchAll({ type:'window' })).forEach(c => c.postMessage({ type:'DUMMY_NOTIFICATIONS_STATUS', enabled:true }));
  } else if (!enabled && s.enabled) {
    if (s.timerId) clearInterval(s.timerId);
    await set('dummyNotifications', { enabled:false, timerId:null }, settingsStore);
    (await clients.matchAll({ type:'window' })).forEach(c => c.postMessage({ type:'DUMMY_NOTIFICATIONS_STATUS', enabled:false }));
  }
}

async function getDummyNotificationStatus(clientId) {
  const s = await get('dummyNotifications', settingsStore) || { enabled:false };
  const client = await clients.get(clientId);
  if (client) client.postMessage({ type:'DUMMY_NOTIFICATIONS_STATUS', enabled:s.enabled });
}

function startDummyNotificationTimer() {
  return setInterval(async () => {
    const s = await get('dummyNotifications', settingsStore);
    if (!s?.enabled) return;
    const ts = Date.now();
    const id = `dummy-${ts}`;
    const title = 'Notifikasi Dummy';
    const options = {
      body: `Dummy at ${new Date(ts).toLocaleString('id-ID')}`,
      icon:'/favicon.png',
      tag:'dummy-notification',
      timestamp:ts
    };
    await set(id, { title, options, timestamp:ts, read:false, isDummy:true }, notificationStore);
    await self.registration.showNotification(title, options);
    (await clients.matchAll({ type:'window' })).forEach(c =>
      c.postMessage({ type:'NEW_NOTIFICATION', notification:{ id, title, options, timestamp:ts, read:false, isDummy:true } })
    );
  }, 60000);
}

// Cleanup old notifications every 6 hours
setInterval(async () => {
  const now = Date.now();
  const dummyCutoff = now - 3600 * 1000;
  const regularCutoff = now - 7 * 24 * 3600 * 1000;
  const allKeys = await keys(notificationStore);
  for (const key of allKeys) {
    const note = await get(key, notificationStore);
    if (note && ((note.isDummy && note.timestamp < dummyCutoff) ||
                 (!note.isDummy && note.timestamp < regularCutoff))) {
      await del(key, notificationStore);
    }
  }
}, 6 * 3600 * 1000);
