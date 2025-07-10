# Admin Access Fix Guide

This guide will help you fix the admin access issues in your Mataresit application.

## Issues Fixed

1. **Infinite Loop in Notification Service** ✅ Fixed
   - Added `cleanupInProgress` tracking to prevent recursive cleanup calls
   - Enhanced error handling and logging

2. **WebSocket Connection Debugging** ✅ Enhanced
   - Added detailed logging and diagnostics
   - Enabled `VITE_REALTIME_DEBUG=true` for better debugging

3. **Admin Role Authentication** ✅ Fixed
   - Fixed `get_feedback_analytics` function to use proper admin role check
   - Updated all admin policies to use `user_roles` table instead of `auth.users.raw_user_meta_data`

## How to Apply the Fixes

### Option 1: Run SQL Script in Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/mpmkbtsufihzdelrlszs
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `scripts/fix-admin-access.sql`
4. Click **Run** to execute the script

### Option 2: Use the JavaScript Fix Script

1. Make sure you're signed in to your application
2. Run the fix script:
   ```bash
   node scripts/fix-admin-access.js
   ```

### Option 3: Manual Admin Role Assignment

If the above methods don't work, you can manually assign admin role:

1. Go to Supabase dashboard → SQL Editor
2. Run this query (replace with your email):
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'admin'::public.app_role
   FROM auth.users
   WHERE email = 'your-email@example.com'
   AND NOT EXISTS (
     SELECT 1 FROM public.user_roles 
     WHERE user_id = auth.users.id AND role = 'admin'
   );
   ```

## Verification

After applying the fixes:

1. **Check Admin Role Assignment**:
   ```sql
   SELECT 
     au.email,
     ur.role,
     ur.created_at
   FROM auth.users au
   JOIN public.user_roles ur ON au.id = ur.user_id
   WHERE ur.role = 'admin';
   ```

2. **Test Admin Function**:
   ```sql
   SELECT * FROM get_feedback_analytics();
   ```

3. **Access Admin Pages**:
   - Navigate to `/admin` in your application
   - The pages should now load without errors

## Troubleshooting

### If you still get "Access denied. Admin role required":

1. **Clear browser cache and cookies**
2. **Sign out and sign back in**
3. **Check if the user_roles table has your admin entry**:
   ```sql
   SELECT * FROM public.user_roles WHERE role = 'admin';
   ```

### If WebSocket connection still fails:

1. **Check browser console** for detailed error messages (now with enhanced logging)
2. **Verify network connectivity** to Supabase
3. **Check if real-time is enabled** in your Supabase project settings

### If notification service still has issues:

1. **Check browser console** for any remaining recursive errors
2. **Clear application data** and refresh
3. **Monitor the enhanced logging** for cleanup operations

## Files Modified

- `src/services/notificationService.ts` - Fixed infinite loop
- `.env.local` - Added debug logging
- `supabase/migrations/20250710000000_fix_feedback_analytics_admin_check.sql` - Fixed admin functions
- `supabase/migrations/20250710000001_assign_admin_role_to_first_user.sql` - Admin role assignment

## Next Steps

1. Apply the fixes using one of the methods above
2. Test admin page access
3. Verify all admin functionality works correctly
4. Monitor the enhanced logging for any remaining issues

If you continue to experience issues, the enhanced logging will provide more detailed information to help diagnose the problems.
