# Google OAuth Setup Guide

## Overview
This guide helps you set up and troubleshoot Google OAuth authentication in the Mataresit application.

## Quick Fix for Localhost Issues

### Problem
Google OAuth fails on localhost with redirect URL errors.

### Solution
1. Ensure your development server runs on port 5173:
   ```bash
   npm run dev
   # Should show: http://localhost:5173/
   ```

2. Verify redirect URL configuration in Supabase:
   - Go to your Supabase project dashboard
   - Navigate to Authentication > Settings
   - Check that `http://localhost:5173/auth` is in the allowed redirect URLs

## Debugging Tools

### Auth Debug Page
Visit `http://localhost:5173/auth/debug` to:
- Check current environment configuration
- Verify redirect URL generation
- Test Google OAuth flow
- Analyze URL hash for tokens/errors

### Console Logging
The application logs detailed auth information to the browser console:
```javascript
// Look for these log messages:
"Using local redirect URL: http://localhost:5173/auth"
"AuthContext: onAuthStateChange event: SIGNED_IN"
"Google sign-in error in Auth.tsx:"
```

## Configuration Checklist

### 1. Supabase Configuration
- [ ] Google OAuth provider enabled in Supabase Auth
- [ ] Correct Google Client ID and Secret configured
- [ ] Redirect URLs include:
  - `http://localhost:5173/auth`
  - `http://localhost:3000/auth`
  - `http://localhost:8080/auth`
  - `https://mataresit.co/auth`

### 2. Google Cloud Console
- [ ] OAuth 2.0 Client ID created
- [ ] Authorized redirect URIs include your Supabase auth callback URL
- [ ] OAuth consent screen configured

### 3. Environment Variables
```bash
# .env.local
VITE_SUPABASE_URL=https://mpmkbtsufihzdelrlszs.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Common Issues & Solutions

### Issue: "Redirect URL not allowed"
**Cause:** The redirect URL is not in Supabase's allowed list
**Solution:** Add your localhost URL to Supabase Auth settings

### Issue: "CORS error"
**Cause:** Cross-origin request blocked
**Solution:** Check Supabase project settings and ensure your domain is allowed

### Issue: "Invalid OAuth state"
**Cause:** Session state mismatch
**Solution:** Clear browser cache and cookies, try again

### Issue: "Access token not received"
**Cause:** OAuth flow interrupted or misconfigured
**Solution:** Check browser network tab for failed requests

## Testing Workflow

1. **Start Development Server**
   ```bash
   npm run dev
   # Verify it's running on port 5173
   ```

2. **Open Debug Page**
   ```
   http://localhost:5173/auth/debug
   ```

3. **Check Configuration**
   - Verify redirect URL shows as "allowed"
   - Check environment shows as "Development"

4. **Test OAuth Flow**
   - Click "Test Google OAuth"
   - Monitor browser console for errors
   - Check if redirect completes successfully

5. **Verify Token Handling**
   - After successful OAuth, check if access token is present
   - Verify user session is established

## Production Deployment

### Redirect URLs for Production
Ensure these URLs are configured in Supabase:
- `https://mataresit.co/auth`
- `https://paperless-maverick.vercel.app/auth`

### Environment Variables
Production should use:
```bash
VITE_SUPABASE_URL=https://mpmkbtsufihzdelrlszs.supabase.co
VITE_SUPABASE_ANON_KEY=production_anon_key
```

## Troubleshooting Commands

### Check Current Configuration
```bash
# View current environment
npm run env:status

# Switch to local development
npm run env:local

# Switch to production
npm run env:production
```

### Debug Network Requests
1. Open browser Developer Tools
2. Go to Network tab
3. Filter by "supabase" or "auth"
4. Attempt Google OAuth
5. Check for failed requests or error responses

## Support

If you continue experiencing issues:
1. Check the browser console for error messages
2. Use the debug page to verify configuration
3. Ensure all environment variables are set correctly
4. Verify Supabase and Google Cloud Console settings match

For additional help, refer to:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
