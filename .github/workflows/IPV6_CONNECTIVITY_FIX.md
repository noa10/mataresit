# 🌐 IPv6 Connectivity Issue Fix

## 🚨 **Problem Identified**

The Supabase deployment workflow is failing due to IPv6 connectivity issues in GitHub Actions runners. Despite previous fixes, the Supabase CLI is still attempting IPv6 connections and failing.

## 📊 **Log Analysis**

### **Key Error Pattern**:
```
Connect Error: tcp [2406:da18:243:740a:1977:959f:b06c:dd89]:6543 dial tcp [IPv6]:6543: connect: network is unreachable
Connect Error: tcp [2406:da18:243:740a:1977:959f:b06c:dd89]:5432 dial tcp [IPv6]:5432: connect: network is unreachable
```

### **Root Cause**:
1. **GitHub Actions IPv6 Limitation**: Runners have limited/unreliable IPv6 connectivity
2. **Supabase CLI Behavior**: Despite `GODEBUG=netdns=go+1`, CLI still attempts IPv6 first
3. **DNS Resolution**: CLI resolves both IPv4 and IPv6 addresses but tries IPv6 first

## ✅ **Comprehensive Solution Implemented**

### **Fix 1: System-Level IPv6 Disable**
```bash
# Force IPv4 by disabling IPv6 temporarily
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.lo.disable_ipv6=1
```

### **Fix 2: DNS Resolution Override**
```bash
# Resolve and cache IPv4 addresses
DB_IPV4=$(dig +short A "db.${PROJECT_REF}.supabase.co" | head -1)
API_IPV4=$(dig +short A "api.supabase.com" | head -1)

# Add to /etc/hosts to force IPv4 resolution
echo "$DB_IPV4 db.${PROJECT_REF}.supabase.co" | sudo tee -a /etc/hosts
echo "$API_IPV4 api.supabase.com" | sudo tee -a /etc/hosts
```

### **Fix 3: Direct IPv4 Connection**
```bash
# Use IPv4 address directly in connection string
DB_URL_DIRECT="postgresql://postgres:${SUPABASE_DB_PASSWORD}@${DB_IPV4}:5432/postgres?connect_timeout=30"
```

### **Fix 4: Connection Timeouts**
```bash
# Configure PostgreSQL client timeouts
export PGCONNECT_TIMEOUT=30
export PGCOMMAND_TIMEOUT=300

# Use timeout command for CLI operations
timeout 300 supabase db push --db-url "$DB_URL_DIRECT" --debug
```

### **Fix 5: Multiple Connection Methods**
1. **Primary**: Direct PostgreSQL connection (port 5432)
2. **Fallback**: PgBouncer connection (port 6543)
3. **Both**: Using IPv4 addresses with timeouts

## 🧪 **Testing the Fix**

### **Expected Success Indicators**:
```bash
✅ IPv6 disabled successfully
✅ IPv4 addresses resolved and cached
✅ Database IPv4: 104.18.38.10
✅ API IPv4: 172.66.149.246
✅ Using IPv4 address: 104.18.38.10
✅ Database migrations completed successfully with direct connection
```

### **What Should NOT Appear**:
```bash
❌ Connect Error: tcp [IPv6]:5432: connect: network is unreachable
❌ Connect Error: tcp [IPv6]:6543: connect: network is unreachable
❌ failed to connect to postgres
```

## 🔧 **Manual Testing Commands**

If you need to test connectivity manually:

```bash
# Test IPv4 resolution
dig +short A db.mpmkbtsufihzdelrlszs.supabase.co

# Test IPv4 connection
nc -4 -v db.mpmkbtsufihzdelrlszs.supabase.co 5432

# Test with timeout
timeout 30 nc -4 -v db.mpmkbtsufihzdelrlszs.supabase.co 5432
```

## 📋 **Verification Steps**

1. **Check IPv6 Status**:
   ```bash
   cat /proc/sys/net/ipv6/conf/all/disable_ipv6
   # Should return: 1 (disabled)
   ```

2. **Check /etc/hosts**:
   ```bash
   tail -5 /etc/hosts
   # Should show IPv4 mappings for Supabase hosts
   ```

3. **Test DNS Resolution**:
   ```bash
   nslookup db.mpmkbtsufihzdelrlszs.supabase.co
   # Should return IPv4 address only
   ```

## 🚀 **Deployment Process**

The workflow now follows this sequence:

1. **Network Configuration**:
   - Disable IPv6 system-wide
   - Configure DNS preferences
   - Resolve and cache IPv4 addresses

2. **Connection Attempts**:
   - Try linking with IPv4-only resolution
   - If linking fails, use direct database URL
   - Try direct PostgreSQL connection (port 5432)
   - Fallback to PgBouncer connection (port 6543)

3. **Timeout Protection**:
   - 30-second connection timeout
   - 300-second command timeout
   - Graceful failure handling

## 🔍 **Troubleshooting**

### **If IPv4 Resolution Fails**:
```bash
# Check DNS servers
cat /etc/resolv.conf

# Try alternative DNS
dig @8.8.8.8 +short A db.mpmkbtsufihzdelrlszs.supabase.co
```

### **If Connection Still Fails**:
1. Check if Supabase is experiencing outages
2. Verify database password is correct
3. Confirm project ID matches
4. Test from different network/location

## 📞 **Support**

If issues persist after this fix:
1. Check GitHub Actions logs for new error patterns
2. Verify all environment secrets are configured
3. Test with a minimal migration first
4. Contact Supabase support if infrastructure issues are suspected

---

**⚡ This fix addresses the core IPv6 connectivity issue that was preventing database migrations and Edge Functions deployment in GitHub Actions.**
