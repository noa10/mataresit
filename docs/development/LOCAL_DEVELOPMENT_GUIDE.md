# 🚀 Local Development Guide - Paperless Maverick

## 🔍 Understanding the Setup

### **Current Configuration**
- **Production Mode**: Currently active (real data, existing users)
- **Local Mode**: Available (empty database, for testing)

### **Why Authentication Failed**
✅ **This is expected behavior!** Here's why:
- Local Supabase = Separate database from production
- No existing users in local environment
- Different JWT keys (demo vs production)
- Completely isolated for development safety

## 🎯 Three Development Approaches

### **Approach 1: Quick Toggle (Recommended)**
Switch between local and production easily:

```bash
# Check current environment
node scripts/switch-env.js status

# Switch to production (real data, existing users)
node scripts/switch-env.js production

# Switch to local (empty database, testing)
node scripts/switch-env.js local

# Restart dev server after switching
npm run dev
```

### **Approach 2: Manual Environment Switching**
Edit `.env.local` directly:

```bash
# For PRODUCTION (real data):
VITE_SUPABASE_URL=https://mpmkbtsufihzdelrlszs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# For LOCAL (testing):
# VITE_SUPABASE_URL=http://127.0.0.1:54331
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Approach 3: Data Migration (Advanced)**
Copy production data to local for testing:

```bash
# Export from production
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.mpmkbtsufihzdelrlszs.supabase.co:5432/postgres" > backup.sql

# Import to local
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54332/postgres" < backup.sql
```

## 🛠️ Recommended Workflow

### **For Regular Development**
1. **Use Production Mode** (current setting)
   - Access your real data and users
   - Test with actual receipts and content
   - Safe for UI/UX changes

### **For Testing New Features**
1. **Switch to Local Mode**
   ```bash
   node scripts/switch-env.js local
   npm run dev
   ```
2. **Create test users** in local environment
3. **Test dangerous operations** safely
4. **Switch back to production** when done

### **For Database Changes**
1. **Always test locally first**
2. **Run migrations on local**
3. **Verify everything works**
4. **Then apply to production**

## 🔐 Authentication in Local Mode

When using local mode, you'll need to:

1. **Create new test accounts**:
   - Go to http://localhost:8080/auth
   - Sign up with test email (e.g., test@example.com)
   - No email verification required in local mode

2. **Access local Supabase Studio**:
   - URL: http://127.0.0.1:54334
   - View/edit users in Authentication tab
   - Manually set user roles if needed

## 📊 Environment Status

### **Production Environment**
- ✅ Real user data
- ✅ Existing receipts and content
- ✅ Production API keys
- ⚠️ Changes affect real users

### **Local Environment**
- ✅ Safe for testing
- ✅ Fast development cycle
- ✅ No risk to production data
- ❌ Empty database (no existing users/data)

## 🚨 Important Notes

1. **Edge Functions**: Currently point to production Supabase for API keys
2. **File Storage**: Local uses separate storage bucket
3. **Database Schema**: Automatically synced via migrations
4. **Environment Variables**: Some (like Gemini API) are shared

## 🔧 Troubleshooting

### **Can't Login in Local Mode**
- ✅ Expected! Create new test account
- Check you're in local mode: `node scripts/switch-env.js status`

### **No Data in Local Mode**
- ✅ Expected! Local starts empty
- Import data or create test content

### **Edge Functions Not Working**
- Check Supabase local status: `supabase status`
- Verify functions are deployed: `supabase functions list`

### **Environment Not Switching**
- Restart dev server after switching
- Clear browser cache/localStorage
- Check .env.local file was updated

## 🎯 Quick Commands

### **Using npm scripts (Recommended):**
```bash
# Check current environment
npm run env:status

# Switch to production and start dev server
npm run dev:production

# Switch to local and start dev server
npm run dev:local

# Just switch environment (without starting dev server)
npm run env:production
npm run env:local
```

### **Using node scripts directly:**
```bash
# Check current environment
node scripts/switch-env.js status

# Switch to production (real data)
node scripts/switch-env.js production

# Switch to local (testing)
node scripts/switch-env.js local

# Check Supabase status
supabase status

# View local database
open http://127.0.0.1:54334
```
