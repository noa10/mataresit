// Push Notification Service Worker for Mataresit
// This service worker handles push notifications and background sync

const CACHE_NAME = 'mataresit-push-v1';
const NOTIFICATION_ICON = '/mataresit-icon.png';
const NOTIFICATION_BADGE = '/mataresit-icon.png';

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing push notification service worker');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use Set to ensure unique URLs and prevent duplicate cache errors
      const urlsToCache = new Set([
        NOTIFICATION_ICON,
        NOTIFICATION_BADGE,
        '/',
        '/dashboard',
        '/receipts'
      ]);

      console.log('[SW] Caching URLs:', Array.from(urlsToCache));
      return cache.addAll(Array.from(urlsToCache));
    }).catch((error) => {
      console.error('[SW] Failed to cache resources during install:', error);
      // Don't throw - allow service worker to install even if caching fails
    })
  );

  // Take control immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating push notification service worker');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Only delete caches that belong to this service worker (push-related)
          if (cacheName.startsWith('mataresit-push-') && cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old push cache:', cacheName);
            return caches.delete(cacheName);
          }
          // Don't delete other service worker caches (like translations)
        }).filter(Boolean) // Remove undefined values
      );
    }).catch((error) => {
      console.error('[SW] Failed to clean up old caches:', error);
    })
  );

  // Take control of all clients
  self.clients.claim();
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let notificationData = {
    title: 'Mataresit Notification',
    body: 'You have a new notification',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    tag: 'default',
    data: {}
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData
      };
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // Enhance notification based on type
  notificationData = enhanceNotificationData(notificationData);

  const notificationPromise = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      actions: notificationData.actions || [],
      requireInteraction: notificationData.requireInteraction || false,
      silent: notificationData.silent || false,
      image: notificationData.image,
      timestamp: Date.now()
    }
  );

  event.waitUntil(notificationPromise);
});

// Notification click event - handle user interactions
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  // Handle different actions
  let urlToOpen = '/dashboard'; // Default URL

  if (action === 'view' && data.actionUrl) {
    urlToOpen = data.actionUrl;
  } else if (action === 'retry' && data.receiptId) {
    urlToOpen = `/receipts/${data.receiptId}?retry=true`;
  } else if (data.actionUrl) {
    urlToOpen = data.actionUrl;
  }

  // Focus existing window or open new one
  const clientPromise = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clientList) => {
    // Check if there's already a window open
    for (let i = 0; i < clientList.length; i++) {
      const client = clientList[i];
      if (client.url.includes(self.location.origin) && 'focus' in client) {
        // Navigate to the desired URL and focus
        client.navigate(urlToOpen);
        return client.focus();
      }
    }
    
    // No existing window found, open a new one
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(clientPromise);
});

// Notification close event - track dismissals
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
  
  const notification = event.notification;
  const data = notification.data || {};

  // Track notification dismissal (optional analytics)
  if (data.notificationId) {
    // Could send analytics data here
    console.log('[SW] Notification dismissed:', data.notificationId);
  }
});

// Background sync event - handle offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

// Helper function to enhance notification data based on type
function enhanceNotificationData(data) {
  const enhanced = { ...data };
  
  // Set default actions based on notification type
  if (data.data && data.data.type) {
    switch (data.data.type) {
      case 'receipt_processing_completed':
        enhanced.actions = [
          { action: 'view', title: 'View Receipt', icon: '/icons/view.png' }
        ];
        enhanced.requireInteraction = false;
        break;
        
      case 'receipt_processing_failed':
        enhanced.actions = [
          { action: 'retry', title: 'Retry', icon: '/icons/retry.png' },
          { action: 'view', title: 'View Details', icon: '/icons/view.png' }
        ];
        enhanced.requireInteraction = true;
        break;
        
      case 'receipt_batch_completed':
        enhanced.actions = [
          { action: 'view', title: 'View Dashboard', icon: '/icons/dashboard.png' }
        ];
        break;
        
      case 'receipt_shared':
      case 'receipt_comment_added':
        enhanced.actions = [
          { action: 'view', title: 'View Receipt', icon: '/icons/view.png' }
        ];
        break;
        
      case 'team_invitation_sent':
        enhanced.actions = [
          { action: 'view', title: 'View Invitation', icon: '/icons/team.png' }
        ];
        enhanced.requireInteraction = true;
        break;
        
      default:
        enhanced.actions = [
          { action: 'view', title: 'View', icon: '/icons/view.png' }
        ];
    }
  }
  
  // Set priority-based styling
  if (data.data && data.data.priority === 'high') {
    enhanced.requireInteraction = true;
    enhanced.silent = false;
  }
  
  return enhanced;
}

// Background sync for notifications
async function syncNotifications() {
  try {
    console.log('[SW] Syncing notifications...');
    
    // This could fetch pending notifications from the server
    // and display them when the user comes back online
    
    // For now, just log that sync completed
    console.log('[SW] Notification sync completed');
  } catch (error) {
    console.error('[SW] Notification sync failed:', error);
  }
}

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Error event - handle service worker errors
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

// Unhandled rejection event
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);

  // Prevent the default behavior (which would log to console)
  // since we're already logging it
  event.preventDefault();
});

console.log('[SW] Push notification service worker loaded');
