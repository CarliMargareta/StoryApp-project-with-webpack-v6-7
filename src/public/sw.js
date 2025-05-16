// sw.js - Fixed implementation for Dicoding Story API notifications

importScripts('https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.min.js');

const { createStore, set, get, keys, del } = idbKeyval;
const notificationStore = createStore('notifications-db', 'notifications');
const dataStore         = createStore('data-db', 'last-seen-item');
const settingsStore     = createStore('settings-db', 'notification-settings');

// API Configuration
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

// Get Authentication Token
async function getAuthToken() {
  try {
    const authData = await get('authData', dataStore);
    if (!authData) {
      // Try to read from localStorage via client
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length > 0) {
        // Ask a client for the token from localStorage
        const client = clients[0];
        return new Promise(resolve => {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = event => {
            if (event.data && event.data.token) {
              // Save token for future use
              set('authData', { token: event.data.token }, dataStore);
              resolve(event.data.token);
            } else {
              resolve(null);
            }
          };
          client.postMessage({ type: 'GET_AUTH_TOKEN' }, [messageChannel.port2]);
        });
      }
    } else {
      return authData.token;
    }
  } catch (e) {
    console.error('Error retrieving auth token:', e);
    return null;
  }
}

// INSTALL: cache assets individually, skip failures
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of urlsToCache) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) await cache.put(url, res.clone());
      } catch (e) {
        console.warn('Skip asset:', url, e);
      }
    }
    await self.skipWaiting();
  })());
});

// ACTIVATE: remove old caches, register periodicSync, init dummy settings
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // delete old caches
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => n.startsWith('storyapp-cache-') && n !== CACHE_NAME)
           .map(n => caches.delete(n))
    );
    // register periodicSync
    try {
      if ('periodicSync' in self.registration) {
        await self.registration.periodicSync.register('fetch-new-stories', { minInterval: 15*60*1000 }); // Check every 15 minutes
        await self.registration.periodicSync.register('store-periodic-notifications', { minInterval: 60*60*1000 }); // Every hour
      }
    } catch (e) {
      console.warn('PeriodicSync unavailable', e);
    }
    await initDummyNotificationSettings();
    await self.clients.claim();
  })());
});

// FETCH: network-first, fallback to cache, offline fallback for navigation
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && event.request.url.startsWith(self.location.origin)) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('/index.html');
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});

// PUSH: save to IndexedDB with read=false, then show
self.addEventListener('push', event => {
  let data = {};
  try { 
    data = event.data.json(); 
  } catch (e) {
    console.warn('Could not parse push data:', e);
  }
  
  const title = data.title || 'Notifikasi Baru';
  const options = data.options || {
    body: 'Notifikasi dari StoryApp',
    icon: '/favicon.png'
  };
  const id = Date.now().toString();

  event.waitUntil(
    set(id, { title, options, timestamp: Date.now(), read: false }, notificationStore)
      .then(() => self.registration.showNotification(title, options))
      .then(() => notifyClientsOfNewNotification(id, title, options))
  );
});

// Helper function to notify all clients of a new notification
async function notifyClientsOfNewNotification(id, title, options) {
  const clientsList = await clients.matchAll({ type: 'window' });
  clientsList.forEach(client => {
    client.postMessage({ 
      type: 'NEW_NOTIFICATION', 
      notification: { 
        id, 
        title, 
        options, 
        timestamp: Date.now(), 
        read: false 
      } 
    });
  });
}

// Notification click: focus or open root
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        for (const c of list) {
          if (c.url === '/' && c.focus) return c.focus();
        }
        return clients.openWindow('/');
      })
  );
});

// Push subscription change: re-subscribe & send minimal payload
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      // Get new subscription
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC)
      });
      
      // Format payload
      const p256dh = newSub.getKey('p256dh');
      const auth = newSub.getKey('auth');
      const payload = {
        endpoint: newSub.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
          auth:   btoa(String.fromCharCode(...new Uint8Array(auth)))
        }
      };

      // Get token
      const token = await getAuthToken();
      if (!token) {
        console.warn('No auth token available for push subscription update');
        return;
      }

      // Send to server
      const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to update subscription: ${response.status}`);
      }
      
      console.log('Push subscription updated successfully');
    } catch (error) {
      console.error('Error updating push subscription:', error);
    }
  })());
});

// PERIODIC & BACKGROUND SYNC
self.addEventListener('periodicsync', event => {
  if (event.tag === 'fetch-new-stories') event.waitUntil(checkForNewStories());
  if (event.tag === 'store-periodic-notifications') event.waitUntil(storePeriodicNotification());
});

self.addEventListener('sync', event => {
  if (event.tag === 'fetch-new-stories') event.waitUntil(checkForNewStories());
  if (event.tag === 'store-periodic-notifications') event.waitUntil(storePeriodicNotification());
});

// MESSAGE handler: flush, delete, mark-all-read, dummy toggles, auth token
self.addEventListener('message', event => {
  const d = event.data;
  
  // Handle string messages
  if (d === 'FLUSH_NOTIFICATIONS') {
    return flushNotifications(event.source.id);
  }
  
  if (d === 'GET_DUMMY_NOTIFICATIONS_STATUS') {
    return getDummyNotificationStatus(event.source.id);
  }
  
  // Handle object messages
  if (!d || typeof d !== 'object') return;
  
  if (d.type === 'AUTH_TOKEN') {
    // Store auth token for API calls
    return set('authData', { token: d.token }, dataStore)
      .then(() => console.log('Auth token stored in service worker'));
  }
  
  if (d.type === 'TOKEN_RESPONSE') {
    // Response from a token request - should be handled by the promise in getAuthToken()
    return;
  }
  
  if (d.type === 'MANUAL_CHECK_NEW_STORIES') {
    return checkForNewStories()
      .then(() => event.source.postMessage({ type: 'STORIES_CHECK_COMPLETE' }));
  }
  
  if (d.type === 'DELETE_NOTIFICATION' && d.id) {
    return del(d.id, notificationStore).then(() => {
      event.source.postMessage({ type: 'NOTIFICATION_DELETED', id: d.id });
    });
  }
  
  if (d.type === 'MARK_AS_READ' && d.id) {
    return get(d.id, notificationStore)
      .then(item => {
        if (item) {
          return set(d.id, { ...item, read: true }, notificationStore);
        }
      })
      .then(() => {
        event.source.postMessage({ type: 'NOTIFICATION_MARKED_READ', id: d.id });
      });
  }
  
  if (d.type === 'MARK_ALL_AS_READ') {
    return keys(notificationStore)
      .then(allKeys => Promise.all(allKeys.map(key =>
        get(key, notificationStore).then(item =>
          set(key, { ...item, read: true }, notificationStore)
        )
      )))
      .then(() => {
        event.source.postMessage({ type: 'NOTIFICATIONS_MARKED_READ' });
      });
  }
  
  if (d.command === 'SET_DUMMY_NOTIFICATIONS') {
    return setDummyNotificationSettings(d.enabled);
  }
});

// Helper: send all stored notifications to client
async function flushNotifications(clientId) {
  try {
    const allKeys = await keys(notificationStore);
    const notifications = await Promise.all(allKeys.map(async key => {
      const val = await get(key, notificationStore);
      return { id: key, ...val };
    }));
    
    // Sort by timestamp, newest first
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    
    const client = await clients.get(clientId);
    if (client) {
      client.postMessage({ 
        type: 'PENDING_NOTIFICATIONS', 
        notifications 
      });
    }
  } catch (error) {
    console.error('Error flushing notifications:', error);
  }
}

// Helper: fetch new stories and notify
async function checkForNewStories() {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.warn('No auth token available for fetching stories');
      return;
    }

    // Fetch latest stories
    const response = await fetch(`${API_BASE_URL}/stories?page=1&size=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stories: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.listStory || !Array.isArray(data.listStory) || data.listStory.length === 0) {
      console.log('No stories found or empty response');
      return;
    }

    // Get last seen story ID
    const lastSeen = await get('lastId', dataStore);
    let newStoriesFound = false;

    // Process stories and create notifications for new ones
    for (const story of data.listStory) {
      // Break if we've seen this story already
      if (story.id === lastSeen) break;
      
      newStoriesFound = true;
      const ts = Date.now();
      const title = `Story baru dari ${story.name}`;
      const options = {
        body: story.description,
        icon: '/favicon.png',
        data: { url: story.photoUrl },
        timestamp: ts,
        image: story.photoUrl // Include story image if available
      };
      
      const nid = `story-${story.id}-${ts}`;
      
      // Store notification
      await set(nid, { 
        title, 
        options, 
        timestamp: ts, 
        read: false, 
        storyId: story.id 
      }, notificationStore);
      
      // Show notification
      await self.registration.showNotification(title, options);
      
      // Notify clients
      await notifyClientsOfNewNotification(nid, title, options);
    }

    // Update last seen ID if we found new stories
    if (data.listStory.length > 0) {
      await set('lastId', data.listStory[0].id, dataStore);
      
      // If this is first run and we have no lastSeen yet, don't notify for all stories
      if (!lastSeen && newStoriesFound) {
        console.log('First run - setting initial lastId without notifications');
      }
    }
  } catch (error) {
    console.error('Error checking for new stories:', error);
  }
}

// Helper: store periodic notification
async function storePeriodicNotification() {
  try {
    const ts = Date.now();
    const id = `periodic-${ts}`;
    const title = 'Kembali ke StoryApp';
    const options = {
      body: `Jangan lewatkan story baru dari teman-teman! Cek StoryApp sekarang.`,
      icon: '/favicon.png',
      tag: 'periodic-reminder',
      timestamp: ts
    };
    
    // Store notification
    await set(id, { 
      title, 
      options, 
      timestamp: ts, 
      read: false, 
      type: 'periodic' 
    }, notificationStore);
    
    // Show notification
    await self.registration.showNotification(title, options);
    
    // Notify all clients
    const clientsList = await clients.matchAll({ type: 'window' });
    clientsList.forEach(client => {
      client.postMessage({ 
        type: 'NEW_NOTIFICATION', 
        notification: { 
          id, 
          title, 
          options, 
          timestamp: ts, 
          read: false, 
          type: 'periodic' 
        } 
      });
    });
  } catch (error) {
    console.error('Error creating periodic notification:', error);
  }
}

// Dummy notifications init & handling
async function initDummyNotificationSettings() {
  try {
    const s = await get('dummyNotifications', settingsStore);
    if (s === undefined) {
      await set('dummyNotifications', { enabled: false, timerId: null }, settingsStore);
    } else if (s.enabled && s.timerId === null) {
      const id = startDummyNotificationTimer();
      await set('dummyNotifications', { enabled: true, timerId: id }, settingsStore);
    }
  } catch (error) {
    console.error('Error initializing dummy notification settings:', error);
    // Set default in case of error
    await set('dummyNotifications', { enabled: false, timerId: null }, settingsStore);
  }
}

async function setDummyNotificationSettings(enabled) {
  try {
    const s = await get('dummyNotifications', settingsStore) || { enabled: false, timerId: null };
    
    if (enabled && !s.enabled) {
      const id = startDummyNotificationTimer();
      await set('dummyNotifications', { enabled: true, timerId: id }, settingsStore);
      
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'DUMMY_NOTIFICATIONS_STATUS', enabled: true });
      });
    } else if (!enabled && s.enabled) {
      if (s.timerId) clearInterval(s.timerId);
      await set('dummyNotifications', { enabled: false, timerId: null }, settingsStore);
      
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'DUMMY_NOTIFICATIONS_STATUS', enabled: false });
      });
    }
  } catch (error) {
    console.error('Error setting dummy notification settings:', error);
  }
}

async function getDummyNotificationStatus(clientId) {
  try {
    const s = await get('dummyNotifications', settingsStore) || { enabled: false };
    const client = await clients.get(clientId);
    if (client) {
      client.postMessage({ 
        type: 'DUMMY_NOTIFICATIONS_STATUS', 
        enabled: s.enabled 
      });
    }
  } catch (error) {
    console.error('Error getting dummy notification status:', error);
  }
}

function startDummyNotificationTimer() {
  return setInterval(async () => {
    try {
      const s = await get('dummyNotifications', settingsStore);
      if (!s || !s.enabled) {
        if (s && s.timerId) clearInterval(s.timerId);
        return;
      }
      
      const ts = Date.now();
      const id = `dummy-${ts}`;
      const title = 'Notifikasi Dummy';
      const options = {
        body: `Ini adalah dummy notification pada ${new Date(ts).toLocaleString('id-ID')}`,
        icon: '/favicon.png',
        tag: 'dummy-notification',
        timestamp: ts
      };
      
      // Store notification
      await set(id, { 
        title, 
        options, 
        timestamp: ts, 
        read: false, 
        isDummy: true 
      }, notificationStore);
      
      // Show notification
      await self.registration.showNotification(title, options);
      
      // Notify all clients
      const clientsList = await clients.matchAll({ type: 'window' });
      clientsList.forEach(client => {
        client.postMessage({ 
          type: 'NEW_NOTIFICATION', 
          notification: { 
            id, 
            title, 
            options, 
            timestamp: ts, 
            read: false, 
            isDummy: true 
          } 
        });
      });
    } catch (error) {
      console.error('Error creating dummy notification:', error);
    }
  }, 60000); // Change to longer interval like 60000 (1 minute) for production
}

// Cleanup old notifications: dummy > 1h, regular > 7 days
setInterval(async () => {
  try {
    const now = Date.now();
    const dummyCutoff = now - 3600 * 1000; // 1 hour
    const regularCutoff = now - 7 * 24 * 3600 * 1000; // 7 days
    
    const allKeys = await keys(notificationStore);
    for (const key of allKeys) {
      const note = await get(key, notificationStore);
      if (!note) continue;
      
      if ((note.isDummy && note.timestamp < dummyCutoff) || 
          (!note.isDummy && note.timestamp < regularCutoff)) {
        await del(key, notificationStore);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old notifications:', error);
  }
}, 6 * 3600 * 1000); // Run cleanup every 6 hours
