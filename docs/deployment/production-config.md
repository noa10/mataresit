# Production Deployment Configuration

This document outlines the production deployment configuration for the Mataresit External API, including security hardening, monitoring setup, and performance optimization.

## 1. Environment Configuration

### Required Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://mpmkbtsufihzdelrlszs.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# API Configuration
API_VERSION=v1
API_RATE_LIMIT_WINDOW=3600  # 1 hour in seconds
API_RATE_LIMIT_MAX_REQUESTS=1000  # Default for Pro tier

# Security Configuration
API_KEY_ENCRYPTION_KEY=your_32_byte_encryption_key_here
CORS_ALLOWED_ORIGINS=https://mataresit.com,https://app.mataresit.com
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=X-API-Key,Content-Type,Authorization

# AI/ML Configuration
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here  # Fallback

# Monitoring and Logging
LOG_LEVEL=info  # debug, info, warn, error
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_SECURITY_LOGGING=true
SENTRY_DSN=your_sentry_dsn_here  # Optional

# Email Configuration (for notifications)
RESEND_API_KEY=your_resend_api_key_here

# Cache Configuration
CACHE_TTL_SECONDS=300  # 5 minutes default
CACHE_MAX_SIZE=1000    # Maximum cache entries
```

### Security Hardening

```bash
# Additional security environment variables
ENABLE_API_KEY_ROTATION=true
API_KEY_MAX_AGE_DAYS=90
ENABLE_REQUEST_SIGNING=false  # For future enhancement
ENABLE_IP_WHITELIST=false     # For enterprise customers

# Rate Limiting Configuration
RATE_LIMIT_REDIS_URL=redis://your-redis-instance  # Optional for distributed rate limiting
ENABLE_ADAPTIVE_RATE_LIMITING=true
RATE_LIMIT_BURST_ALLOWANCE=20  # Burst requests allowed

# Audit Logging
AUDIT_LOG_RETENTION_DAYS=365
ENABLE_GDPR_COMPLIANCE_LOGGING=true
LOG_SENSITIVE_DATA=false  # Never log sensitive information
```

## 2. Database Configuration

### Production Database Settings

```sql
-- Enable additional security features
ALTER DATABASE postgres SET log_statement = 'mod';
ALTER DATABASE postgres SET log_min_duration_statement = 1000;

-- Optimize for API workload
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Enable query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### Database Monitoring Queries

```sql
-- Monitor API key usage
CREATE OR REPLACE VIEW api_key_usage_summary AS
SELECT 
  ak.name,
  ak.key_prefix,
  COUNT(aal.*) as total_requests,
  AVG(aal.response_time_ms) as avg_response_time,
  COUNT(CASE WHEN aal.status_code >= 400 THEN 1 END) as error_count,
  MAX(aal.timestamp) as last_used
FROM api_keys ak
LEFT JOIN api_access_logs aal ON ak.id = aal.api_key_id
WHERE ak.is_active = true
GROUP BY ak.id, ak.name, ak.key_prefix;

-- Monitor rate limiting effectiveness
CREATE OR REPLACE VIEW rate_limit_stats AS
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status_code = 429 THEN 1 END) as rate_limited_requests,
  ROUND(COUNT(CASE WHEN status_code = 429 THEN 1 END)::numeric / COUNT(*) * 100, 2) as rate_limit_percentage
FROM api_access_logs
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;
```

## 3. Supabase Edge Functions Deployment

### Deploy All Functions

```bash
# Deploy the main external API function
supabase functions deploy external-api --project-ref mpmkbtsufihzdelrlszs

# Deploy API key management function
supabase functions deploy manage-api-keys --project-ref mpmkbtsufihzdelrlszs

# Verify deployment
supabase functions list --project-ref mpmkbtsufihzdelrlszs
```

### Function Configuration

```bash
# Set environment variables for Edge Functions
supabase secrets set GEMINI_API_KEY=your_key_here --project-ref mpmkbtsufihzdelrlszs
supabase secrets set OPENAI_API_KEY=your_key_here --project-ref mpmkbtsufihzdelrlszs
supabase secrets set RESEND_API_KEY=your_key_here --project-ref mpmkbtsufihzdelrlszs

# Verify secrets
supabase secrets list --project-ref mpmkbtsufihzdelrlszs
```

## 4. Monitoring and Alerting

### Performance Monitoring

```javascript
// Add to Edge Functions for performance monitoring
const performanceMonitor = {
  trackRequest: (endpoint, method, duration, status) => {
    // Send metrics to monitoring service
    console.log(JSON.stringify({
      type: 'performance_metric',
      endpoint,
      method,
      duration,
      status,
      timestamp: new Date().toISOString()
    }));
  },

  trackError: (endpoint, error, context) => {
    console.error(JSON.stringify({
      type: 'error_metric',
      endpoint,
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    }));
  }
};
```

### Health Check Endpoints

```javascript
// Enhanced health check for monitoring
const healthCheck = {
  api: async () => {
    // Test database connectivity
    const { error: dbError } = await supabase.from('api_keys').select('count').limit(1);
    
    // Test AI service connectivity
    const aiHealthy = await testGeminiConnection();
    
    return {
      status: dbError || !aiHealthy ? 'degraded' : 'healthy',
      database: !dbError,
      ai_service: aiHealthy,
      timestamp: new Date().toISOString()
    };
  }
};
```

### Alerting Rules

```yaml
# Example alerting configuration (for monitoring service)
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    duration: "5m"
    severity: "warning"
    
  - name: "API Response Time"
    condition: "avg_response_time > 2000ms"
    duration: "10m"
    severity: "warning"
    
  - name: "Rate Limit Threshold"
    condition: "rate_limit_hits > 100/hour"
    duration: "1h"
    severity: "info"
    
  - name: "Database Connection Issues"
    condition: "database_errors > 0"
    duration: "1m"
    severity: "critical"
```

## 5. Security Configuration

### API Key Security

```sql
-- Rotate API keys regularly
CREATE OR REPLACE FUNCTION rotate_expired_api_keys()
RETURNS void AS $$
BEGIN
  -- Mark expired keys as inactive
  UPDATE api_keys 
  SET is_active = false, 
      updated_at = NOW()
  WHERE expires_at < NOW() 
    AND is_active = true;
    
  -- Log rotation events
  INSERT INTO audit_logs (event_type, details, timestamp)
  SELECT 
    'api_key_expired',
    jsonb_build_object('key_id', id, 'name', name),
    NOW()
  FROM api_keys 
  WHERE expires_at < NOW() 
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Schedule key rotation check
SELECT cron.schedule('rotate-api-keys', '0 0 * * *', 'SELECT rotate_expired_api_keys();');
```

### Request Validation

```javascript
// Enhanced request validation
const securityValidation = {
  validateRequest: (req) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /<script>/i,
      /javascript:/i
    ];
    
    const requestStr = JSON.stringify(req.body) + req.url;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestStr)) {
        throw new Error('Suspicious request pattern detected');
      }
    }
    
    return true;
  },
  
  logSecurityEvent: (event, details) => {
    console.warn(JSON.stringify({
      type: 'security_event',
      event,
      details,
      timestamp: new Date().toISOString()
    }));
  }
};
```

## 6. Performance Optimization

### Caching Strategy

```javascript
// Production caching configuration
const cacheConfig = {
  // Cache user profiles for 5 minutes
  userProfile: { ttl: 300, tags: ['user'] },
  
  // Cache team data for 10 minutes
  teamData: { ttl: 600, tags: ['team'] },
  
  // Cache analytics for 1 hour
  analytics: { ttl: 3600, tags: ['analytics'] },
  
  // Cache search results for 15 minutes
  searchResults: { ttl: 900, tags: ['search'] }
};
```

### Database Query Optimization

```sql
-- Create indexes for API performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_access_logs_timestamp 
ON api_access_logs (timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_access_logs_user_id 
ON api_access_logs (user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_user_date 
ON receipts (user_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_team_date 
ON receipts (team_id, date DESC) WHERE team_id IS NOT NULL;

-- Optimize for search queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_search 
ON receipts USING gin(to_tsvector('english', merchant || ' ' || COALESCE(full_text, '')));
```

## 7. Backup and Recovery

### Database Backup Strategy

```bash
# Automated daily backups (configured in Supabase dashboard)
# - Point-in-time recovery enabled
# - Daily automated backups retained for 7 days
# - Weekly backups retained for 4 weeks
# - Monthly backups retained for 12 months

# Manual backup for critical deployments
pg_dump -h db.mpmkbtsufihzdelrlszs.supabase.co \
        -U postgres \
        -d postgres \
        --no-password \
        --verbose \
        --clean \
        --no-owner \
        --no-privileges \
        > mataresit_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Disaster Recovery Plan

```markdown
## Recovery Procedures

### 1. Database Recovery
- Use Supabase point-in-time recovery for data corruption
- Restore from automated backups for complete failures
- Maximum data loss: 15 minutes (based on backup frequency)

### 2. Edge Function Recovery
- Redeploy functions from source control
- Restore environment variables from secure storage
- Estimated recovery time: 15 minutes

### 3. API Key Recovery
- API keys are stored in database (recovered with database)
- Users may need to regenerate keys if encryption keys are lost
- Provide emergency access through dashboard

### 4. Communication Plan
- Update status page: status.mataresit.com
- Notify users via email and dashboard notifications
- Provide regular updates during recovery
```

## 8. Deployment Checklist

### Pre-Deployment

- [ ] Run comprehensive test suite
- [ ] Execute security audit
- [ ] Perform load testing
- [ ] Verify all environment variables
- [ ] Check database migrations
- [ ] Validate API documentation
- [ ] Test monitoring and alerting

### Deployment

- [ ] Deploy Edge Functions
- [ ] Apply database migrations
- [ ] Update environment variables
- [ ] Verify health checks
- [ ] Test critical API endpoints
- [ ] Monitor error rates
- [ ] Validate performance metrics

### Post-Deployment

- [ ] Monitor system for 24 hours
- [ ] Verify all integrations working
- [ ] Check audit logs for anomalies
- [ ] Validate rate limiting
- [ ] Test disaster recovery procedures
- [ ] Update documentation
- [ ] Notify stakeholders of successful deployment

## 9. Maintenance Procedures

### Regular Maintenance Tasks

```bash
# Weekly tasks
- Review API usage analytics
- Check for expired API keys
- Monitor error rates and performance
- Review security logs
- Update dependencies if needed

# Monthly tasks
- Analyze performance trends
- Review and optimize database queries
- Update security configurations
- Test backup and recovery procedures
- Review and update documentation

# Quarterly tasks
- Conduct security audit
- Review and update rate limits
- Analyze user feedback and feature requests
- Plan capacity upgrades if needed
- Review disaster recovery plan
```

### Performance Tuning

```sql
-- Monthly performance review queries
-- Check slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
ORDER BY n_distinct DESC;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

This production configuration ensures your Mataresit External API is secure, performant, and maintainable in a production environment.
