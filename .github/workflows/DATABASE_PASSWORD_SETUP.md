# 🔑 Database Password Setup Guide

## 🚨 **URGENT: Required for Deployment Fix**

The Supabase deployment workflow needs the PostgreSQL database password to resolve the current connectivity issues.

## 📋 **Step-by-Step Instructions**

### **Step 1: Get Database Password from Supabase**

1. **Open Supabase Dashboard**:
   ```
   https://supabase.com/dashboard/project/mpmkbtsufihzdelrlszs
   ```

2. **Navigate to Database Settings**:
   - Click **Settings** (gear icon in sidebar)
   - Click **Database**
   - Scroll to **Connection parameters** section

3. **Copy the Password**:
   - Look for the **Password** field
   - Click the **Copy** button or **Show** to reveal
   - **Important**: This is NOT the same as:
     - Service Role Key
     - Anonymous Key
     - Access Token

### **Step 2: Add to GitHub Environment Secrets**

1. **Go to Repository Settings**:
   ```
   https://github.com/[your-username]/mataresit/settings/environments
   ```

2. **Select Production Environment**:
   - Click on **Production** environment
   - Scroll to **Environment secrets**

3. **Add New Secret**:
   - Click **Add secret**
   - **Name**: `SUPABASE_DB_PASSWORD`
   - **Value**: [paste the password from Step 1]
   - Click **Add secret**

### **Step 3: Verify Configuration**

After adding the secret, your Production environment should have:

```
✅ SUPABASE_ACCESS_TOKEN
✅ SUPABASE_URL
✅ SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ SUPABASE_PROJECT_ID
✅ SUPABASE_DB_PASSWORD  ← NEW
```

## 🔍 **What This Fixes**

### **Before (Failing)**:
```
failed to connect to postgres: failed to connect to `host=db.***.supabase.co user=postgres database=postgres`: dial error (dial tcp [IPv6]:5432: connect: network is unreachable)
```

### **After (Working)**:
```
✅ Successfully linked to project
✅ Database migrations completed successfully
✅ Edge Functions deployed successfully
```

## 🧪 **Testing the Fix**

1. **Trigger Manual Deployment**:
   - Go to Actions → Supabase Deployment
   - Click **Run workflow**
   - Select **production** environment
   - Click **Run workflow**

2. **Monitor Logs for Success**:
   - Look for: `DB password configured: YES`
   - Look for: `✅ Successfully linked to project`
   - Look for: `✅ Database migrations completed successfully`

## 🔒 **Security Notes**

- **Database password is sensitive**: Only add to Environment secrets, not Repository secrets
- **Environment protection**: Production environment should have protection rules
- **Access control**: Only authorized team members should have access to Production environment

## 🆘 **If You Can't Find the Password**

### **Option 1: Reset Database Password**
1. Go to Supabase Dashboard → Settings → Database
2. Click **Reset database password**
3. Copy the new password
4. Update the GitHub secret

### **Option 2: Contact Team Admin**
If you don't have access to reset the password:
1. Ask a team admin to get the password
2. Or ask them to add the secret to GitHub
3. Or ask them to reset the password and share it securely

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting guide in `SUPABASE_DEPLOYMENT_FIXES.md`
2. Verify all environment secrets are configured
3. Test with a simple migration first
4. Check GitHub Actions logs for specific error messages

---

**⚡ Quick Action**: Add `SUPABASE_DB_PASSWORD` to Production environment secrets to fix the deployment immediately.
