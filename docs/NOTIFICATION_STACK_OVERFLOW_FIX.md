# Notification Service Stack Overflow Fix

## Problem Summary

The Mataresit application was experiencing "Maximum call stack size exceeded" errors in the browser console, specifically originating from:

- **Primary Error Location**: `notificationService.ts:306:24`
- **Secondary Error**: Supabase RealtimeChannel `isEqual` method causing infinite recursion in the `_off` method

## Root Cause Analysis

The issue was caused by a circular reference pattern in the Supabase realtime channel cleanup process:

1. **Immediate Cleanup in Callbacks**: The `ensureConnection()` method was calling `supabase.removeChannel(testChannel)` directly within subscription status callbacks
2. **Supabase Internal Bug**: This triggered a bug in Supabase's internal `RealtimeChannel._off()` method where the `isEqual` comparison created infinite recursion
3. **Disabled Cleanup Methods**: The `cleanupSubscription()` and `disconnectAll()` methods were temporarily disabled, causing memory leaks and inconsistent state
4. **Multiple Cleanup Paths**: Various cleanup mechanisms could trigger each other recursively

## Solution Implemented

### 1. Deferred Channel Cleanup System

**Added new properties to NotificationService:**
```typescript
private deferredCleanupQueue: Set<string> = new Set();
private cleanupBatchTimer: NodeJS.Timeout | null = null;
```

**Created `safeRemoveChannel()` method:**
- Defers channel removal using `setTimeout` to prevent immediate recursion
- Batches cleanup operations to improve efficiency
- Prevents the Supabase internal recursion bug

### 2. Enhanced Cleanup Logic

**Fixed `cleanupSubscription()` method:**
- Re-enabled with safe cleanup using `safeRemoveChannel()`
- Added proper error handling and logging
- Maintains cleanup tracking to prevent recursive calls

**Fixed `disconnectAll()` method:**
- Re-enabled with batched safe cleanup
- Processes all channels without causing recursion

### 3. Improved Subscription Management

**Enhanced `registerSubscription()`:**
- Intelligent duplicate handling
- Updates activity timestamps for existing subscriptions
- Proper cleanup of conflicting subscriptions

**Enhanced `hasActiveSubscription()`:**
- Validates channel integrity
- Automatic cleanup of invalid subscriptions
- Updates activity timestamps

**Improved `cleanupUserSubscriptions()`:**
- Batched processing to prevent system overload
- Configurable batch sizes and delays

### 4. Intelligent Stale Cleanup

**Enhanced `cleanupStaleSubscriptions()`:**
- Two-tier stale detection (30min stale, 2hr very stale)
- Batched cleanup with different priorities
- Prevents overwhelming the system

**Added `validateSubscriptionRegistry()`:**
- Detects and repairs orphaned channels
- Removes duplicate subscriptions
- Maintains registry integrity

## Files Modified

1. **`src/services/notificationService.ts`**
   - Added deferred cleanup system
   - Fixed all direct `supabase.removeChannel()` calls
   - Enhanced subscription management
   - Added comprehensive cleanup methods

2. **`src/utils/notificationServiceTest.ts`** (New)
   - Test utilities for validation
   - Development mode testing functions
   - Stability and stress tests

3. **`src/main.tsx`**
   - Added development test imports

4. **`NOTIFICATION_STACK_OVERFLOW_FIX.md`** (This file)
   - Documentation and validation guide

## Testing and Validation

### Automatic Testing (Development Mode)

In development mode, test functions are automatically available:

```javascript
// Open browser console and run:
window.testNotificationService.runStabilityTests()

// Individual tests:
window.testNotificationService.quickTest()
window.testNotificationService.getConnectionState()
window.testNotificationService.cleanup()
```

### Manual Testing Steps

1. **Start the application** in development mode
2. **Open browser console** and check for errors
3. **Run stability tests**:
   ```javascript
   await window.testNotificationService.runStabilityTests()
   ```
4. **Verify no stack overflow errors** appear
5. **Test real-time functionality** by creating notifications
6. **Monitor connection health** using the monitoring dashboard

### Expected Results

✅ **Success Indicators:**
- No "Maximum call stack size exceeded" errors
- All stability tests pass
- Real-time notifications work properly
- Connection recovery functions correctly
- Proper cleanup without memory leaks

❌ **Failure Indicators:**
- Stack overflow errors still occur
- Tests fail with recursion errors
- Real-time functionality broken
- Memory leaks or orphaned channels

## Monitoring and Maintenance

### Health Monitoring

The notification service now includes comprehensive health monitoring:

- **Stale subscription cleanup**: Every 5 minutes
- **Connection health monitoring**: Every minute  
- **Registry validation**: Every 10 minutes

### Debug Tools (Development)

```javascript
// Available in browser console:
window.notificationServiceDebug.getMonitoringDashboard()
window.notificationServiceDebug.logMonitoringDashboard()
window.notificationServiceDebug.getConnectionState()
window.notificationServiceDebug.resetConnectionState()
```

## Performance Impact

### Improvements
- **Reduced Memory Usage**: Proper cleanup prevents memory leaks
- **Better Connection Stability**: Enhanced error recovery
- **Batched Operations**: More efficient cleanup processing
- **Intelligent Thresholds**: Optimized stale detection

### Minimal Overhead
- **Deferred Cleanup**: Adds ~0ms delay (next tick)
- **Batch Processing**: Reduces system load
- **Registry Validation**: Runs every 10 minutes

## Future Considerations

1. **Monitor Supabase Updates**: Watch for fixes to the internal `isEqual` recursion bug
2. **Performance Metrics**: Consider adding performance monitoring for large-scale deployments
3. **Configuration Options**: Make cleanup thresholds configurable if needed
4. **Error Reporting**: Consider adding error reporting for production monitoring

## Conclusion

This fix resolves the critical stack overflow issue while maintaining all real-time functionality and improving overall system stability. The deferred cleanup approach prevents the Supabase internal recursion bug while the enhanced subscription management ensures proper resource cleanup and prevents memory leaks.
