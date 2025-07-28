/**
 * Notification System Test Utilities
 * 
 * This file contains utilities to test the notification system fixes
 * and validate that both test notifications and realtime notifications work correctly.
 */

import { toast } from 'sonner';

export interface NotificationTestResult {
  testName: string;
  success: boolean;
  error?: string;
  details?: any;
}

/**
 * Test if the browser supports notifications
 */
export function testBrowserNotificationSupport(): NotificationTestResult {
  try {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    
    return {
      testName: 'Browser Notification Support',
      success: isSupported,
      error: isSupported ? undefined : 'Browser does not support notifications or service workers',
      details: {
        hasNotification: 'Notification' in window,
        hasServiceWorker: 'serviceWorker' in navigator,
        permission: Notification.permission
      }
    };
  } catch (error) {
    return {
      testName: 'Browser Notification Support',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test notification permission status
 */
export function testNotificationPermission(): NotificationTestResult {
  try {
    const permission = Notification.permission;
    const isGranted = permission === 'granted';
    
    return {
      testName: 'Notification Permission',
      success: isGranted,
      error: isGranted ? undefined : `Permission is ${permission}. Please grant notification permission.`,
      details: {
        permission,
        canRequest: permission === 'default'
      }
    };
  } catch (error) {
    return {
      testName: 'Notification Permission',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test service worker registration
 */
export async function testServiceWorkerRegistration(): Promise<NotificationTestResult> {
  try {
    if (!('serviceWorker' in navigator)) {
      return {
        testName: 'Service Worker Registration',
        success: false,
        error: 'Service workers not supported'
      };
    }

    const registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
    const isRegistered = !!registration;
    
    return {
      testName: 'Service Worker Registration',
      success: isRegistered,
      error: isRegistered ? undefined : 'Push notification service worker not registered',
      details: {
        isRegistered,
        scope: registration?.scope,
        state: registration?.active?.state
      }
    };
  } catch (error) {
    return {
      testName: 'Service Worker Registration',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test basic browser notification display
 */
export async function testBasicNotification(): Promise<NotificationTestResult> {
  try {
    if (Notification.permission !== 'granted') {
      return {
        testName: 'Basic Notification Display',
        success: false,
        error: 'Notification permission not granted'
      };
    }

    const notification = new Notification('Test Notification', {
      body: 'This is a test notification from Mataresit',
      icon: '/mataresit-icon.png',
      tag: 'test-notification'
    });

    // Auto-close after 3 seconds
    setTimeout(() => {
      notification.close();
    }, 3000);

    return {
      testName: 'Basic Notification Display',
      success: true,
      details: {
        title: notification.title,
        body: notification.body,
        tag: notification.tag
      }
    };
  } catch (error) {
    return {
      testName: 'Basic Notification Display',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test push notification context availability
 */
export function testPushNotificationContext(pushContext: any): NotificationTestResult {
  try {
    const hasRequiredMethods = !!(
      pushContext &&
      typeof pushContext.showTestNotification === 'function' &&
      typeof pushContext.sendReceiptNotification === 'function' &&
      typeof pushContext.isSubscribed !== 'undefined'
    );

    return {
      testName: 'Push Notification Context',
      success: hasRequiredMethods,
      error: hasRequiredMethods ? undefined : 'Push notification context missing required methods',
      details: {
        hasContext: !!pushContext,
        hasShowTestNotification: typeof pushContext?.showTestNotification === 'function',
        hasSendReceiptNotification: typeof pushContext?.sendReceiptNotification === 'function',
        isSubscribed: pushContext?.isSubscribed,
        permission: pushContext?.permission
      }
    };
  } catch (error) {
    return {
      testName: 'Push Notification Context',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test notification context availability
 */
export function testNotificationContext(notificationContext: any): NotificationTestResult {
  try {
    const hasRequiredMethods = !!(
      notificationContext &&
      typeof notificationContext.loadNotifications === 'function' &&
      typeof notificationContext.markAsRead === 'function' &&
      notificationContext.preferences !== undefined
    );

    return {
      testName: 'Notification Context',
      success: hasRequiredMethods,
      error: hasRequiredMethods ? undefined : 'Notification context missing required methods',
      details: {
        hasContext: !!notificationContext,
        hasLoadNotifications: typeof notificationContext?.loadNotifications === 'function',
        hasMarkAsRead: typeof notificationContext?.markAsRead === 'function',
        hasPreferences: notificationContext?.preferences !== undefined,
        isConnected: notificationContext?.isConnected,
        notificationCount: notificationContext?.notifications?.length || 0
      }
    };
  } catch (error) {
    return {
      testName: 'Notification Context',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run all notification tests
 */
export async function runAllNotificationTests(
  pushContext?: any,
  notificationContext?: any
): Promise<NotificationTestResult[]> {
  const results: NotificationTestResult[] = [];

  // Basic browser tests
  results.push(testBrowserNotificationSupport());
  results.push(testNotificationPermission());
  results.push(await testServiceWorkerRegistration());

  // Context tests
  if (pushContext) {
    results.push(testPushNotificationContext(pushContext));
  }
  
  if (notificationContext) {
    results.push(testNotificationContext(notificationContext));
  }

  // Only test basic notification if permission is granted
  if (Notification.permission === 'granted') {
    results.push(await testBasicNotification());
  }

  return results;
}

/**
 * Display test results as toast notifications
 */
export function displayTestResults(results: NotificationTestResult[]): void {
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  if (passed === total) {
    toast.success(`All notification tests passed! (${passed}/${total})`, {
      description: 'Notification system is working correctly'
    });
  } else {
    toast.error(`Some notification tests failed (${passed}/${total})`, {
      description: 'Check console for details'
    });
  }

  // Log detailed results to console
  console.group('🔔 Notification Test Results');
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.testName}`);
    } else {
      console.error(`❌ ${result.testName}: ${result.error}`);
      if (result.details) {
        console.log('Details:', result.details);
      }
    }
  });
  console.groupEnd();
}
