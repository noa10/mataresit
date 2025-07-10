# Admin Pages Testing Checklist

This checklist will help you verify that all admin functionality works correctly after applying the fixes.

## Pre-Testing Setup

1. **Apply the fixes first**:
   - Run `scripts/fix-admin-access.sql` in Supabase dashboard
   - OR run `node scripts/fix-admin-access.js`
   - Verify admin role is assigned to your user

2. **Clear browser cache and refresh**:
   - Clear browser cache and cookies
   - Sign out and sign back in
   - Refresh the application

## Testing Checklist

### ✅ 1. Basic Admin Access

- [ ] Navigate to `/admin` - page should load without errors
- [ ] Check browser console - no "Access denied" errors
- [ ] Check browser console - no infinite loop errors
- [ ] Verify admin navigation menu is visible

### ✅ 2. Notification Service (Fixed Infinite Loop)

- [ ] Open browser console and check for notification service logs
- [ ] Look for "📝 Registered subscription" messages
- [ ] Verify no "Maximum call stack size exceeded" errors
- [ ] Check that cleanup operations complete successfully
- [ ] Monitor for any recursive cleanup warnings

### ✅ 3. WebSocket Connection (Enhanced Debugging)

- [ ] Check browser console for WebSocket connection logs
- [ ] Look for "✅ Real-time connection established" messages
- [ ] If connection fails, check for detailed diagnostic information
- [ ] Verify enhanced error logging provides useful information
- [ ] Test real-time notifications (if applicable)

### ✅ 4. Admin Role Authentication

- [ ] **Feedback Analytics**: Navigate to admin feedback analytics
- [ ] Verify `get_feedback_analytics` function works without "Access denied" error
- [ ] Check that feedback data loads correctly
- [ ] Test date range filtering

### ✅ 5. Admin Functions Testing

Test each admin function to ensure proper role verification:

- [ ] **User Management**: 
  - Access user list
  - View user details
  - Test role assignment (if available)

- [ ] **Analytics Dashboard**:
  - Load analytics data
  - Test different time ranges
  - Verify charts and graphs display

- [ ] **System Settings**:
  - Access system configuration
  - Test any admin-only settings

- [ ] **Database Functions**:
  - Test any RPC functions that require admin access
  - Verify proper error handling for non-admin users

### ✅ 6. Error Handling

- [ ] Test with non-admin user (if available):
  - Should get proper "Access denied" messages
  - Should not see admin navigation
  - Should be redirected appropriately

- [ ] Test edge cases:
  - Network disconnection
  - Invalid requests
  - Malformed data

## Browser Console Checks

### Expected Logs (Good Signs):

```
✅ Real-time connection established
📝 Registered subscription: user-notifications-[user-id]
🧹 Cleaned up subscription: [channel-name]
✅ Admin function test passed
```

### Warning Signs (Need Investigation):

```
❌ Maximum call stack size exceeded
❌ Access denied. Admin role required
⚠️ Cleanup already in progress for [channel], skipping
⏰ Real-time quick test timeout
```

## Network Tab Checks

1. **WebSocket Connection**:
   - Look for WebSocket connection to `wss://mpmkbtsufihzdelrlszs.supabase.co/realtime/v1/websocket`
   - Status should be "101 Switching Protocols" (successful)
   - Connection should remain open

2. **API Calls**:
   - Admin API calls should return 200 status
   - No 403 "Forbidden" responses for admin functions
   - Proper authentication headers present

## Performance Checks

- [ ] Admin pages load within reasonable time (< 3 seconds)
- [ ] No memory leaks from notification service
- [ ] WebSocket connection is stable
- [ ] No excessive API calls or polling

## Troubleshooting Guide

### If admin pages still don't work:

1. **Check admin role assignment**:
   ```sql
   SELECT * FROM public.user_roles WHERE role = 'admin';
   ```

2. **Verify user authentication**:
   ```sql
   SELECT auth.uid(), auth.email();
   ```

3. **Test admin function directly**:
   ```sql
   SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
   ```

### If WebSocket connection fails:

1. Check network connectivity
2. Verify Supabase project settings
3. Check firewall/proxy settings
4. Review enhanced diagnostic logs

### If notification service has issues:

1. Clear browser storage
2. Check for any remaining recursive calls
3. Monitor cleanup operations
4. Restart the application

## Success Criteria

✅ **All fixes successful if**:
- Admin pages load without console errors
- No infinite loops in notification service
- WebSocket connection works or provides clear diagnostic info
- Admin functions work with proper role verification
- Enhanced logging provides useful debugging information

## Reporting Issues

If any tests fail, please provide:
1. Browser console logs
2. Network tab information
3. Specific error messages
4. Steps to reproduce
5. Browser and OS information

The enhanced logging should now provide much more detailed information to help diagnose any remaining issues.
