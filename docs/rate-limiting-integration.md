# Rate Limiting Integration for Generate Embeddings Function

## Overview

The enhanced `generate-embeddings` Supabase Edge Function now includes comprehensive rate limiting capabilities as part of Phase 3 batch upload optimization. This integration provides intelligent API quota management, adaptive backoff handling, and persistent tracking across sessions.

## Features

### 🚀 **Intelligent Rate Limiting**
- **Adaptive rate limiting** with multiple processing strategies
- **Token-aware quota management** based on content type and size
- **Exponential backoff** for rate limit recovery
- **Concurrent request limiting** to prevent API overload

### 📊 **Processing Strategies**
- **Conservative**: 1 concurrent, 30 req/min, 50k tokens/min
- **Balanced**: 2 concurrent, 60 req/min, 100k tokens/min (default)
- **Aggressive**: 4 concurrent, 120 req/min, 200k tokens/min
- **Adaptive**: 3 concurrent, 90 req/min, 150k tokens/min (AI-optimized)

### 🔍 **Monitoring & Analytics**
- **Real-time rate limit status** via API endpoints
- **Persistent quota tracking** in database
- **Performance metrics collection** for optimization
- **Runtime strategy switching** for dynamic adjustment

## Architecture

### Core Components

1. **EdgeRateLimitingManager** - Main rate limiting logic
2. **Rate Limiting Utils** - Helper functions and integrations
3. **Enhanced Generate Embeddings** - Updated function with rate limiting
4. **Database Integration** - Persistent quota tracking

### Database Tables

- `api_quota_tracking` - API usage tracking per provider/time window
- `batch_upload_sessions` - Session-level rate limiting metrics
- `batch_upload_files` - File-level processing status and rate limiting

## Configuration

### Environment Variables

```bash
# Rate limiting strategy (conservative|balanced|aggressive|adaptive)
RATE_LIMIT_STRATEGY=balanced

# Enable/disable rate limiting
ENABLE_RATE_LIMITING=true

# Required for persistent tracking
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

### Processing Strategy Configuration

```typescript
const strategies = {
  conservative: {
    maxConcurrentRequests: 1,
    requestsPerMinute: 30,
    tokensPerMinute: 50000,
    burstAllowance: 5,
    backoffMultiplier: 2.0
  },
  balanced: {
    maxConcurrentRequests: 2,
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    burstAllowance: 10,
    backoffMultiplier: 1.5
  },
  // ... other strategies
};
```

## API Endpoints

### Rate Limiting Status

```bash
GET /functions/v1/generate-embeddings?action=rate_limit_status
```

**Response:**
```json
{
  "success": true,
  "rateLimitStatus": {
    "enabled": true,
    "isRateLimited": false,
    "requestsRemaining": 45,
    "tokensRemaining": 85000,
    "resetTime": 1640995200000,
    "backoffMs": 0,
    "consecutiveErrors": 0,
    "activeRequests": 2
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Update Processing Strategy

```bash
PUT /functions/v1/generate-embeddings
Content-Type: application/json

{
  "action": "update_strategy",
  "strategy": "aggressive"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processing strategy updated to aggressive",
  "rateLimitStatus": { /* updated status */ },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Usage Examples

### Basic Embedding Generation

The function automatically applies rate limiting when enabled:

```typescript
// POST /functions/v1/generate-embeddings
{
  "receiptId": "receipt-123",
  "contentType": "receipt_full"
}
```

Rate limiting is applied transparently:
- Permission requested before API call
- Intelligent delays when rate limited
- Success/error tracking for adaptive optimization

### Batch Processing

For batch operations, the function coordinates rate limiting across multiple requests:

```typescript
// POST /functions/v1/generate-embeddings
{
  "receiptIds": ["receipt-1", "receipt-2", "receipt-3"],
  "batchSize": 2,
  "strategy": "balanced"
}
```

## Monitoring

### Database Queries

**Check API quota usage:**
```sql
SELECT 
  api_provider,
  quota_type,
  quota_used,
  quota_limit,
  quota_remaining,
  is_rate_limited
FROM api_quota_tracking 
WHERE time_window >= NOW() - INTERVAL '1 hour'
ORDER BY time_window DESC;
```

**Monitor batch session performance:**
```sql
SELECT 
  id,
  processing_strategy,
  total_files,
  files_completed,
  rate_limit_hits,
  avg_file_processing_time_ms
FROM batch_upload_sessions 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Application Integration

```typescript
// Check rate limiting status
const response = await fetch('/functions/v1/generate-embeddings?action=rate_limit_status');
const status = await response.json();

if (status.rateLimitStatus.isRateLimited) {
  console.log(`Rate limited, retry in ${status.rateLimitStatus.backoffMs}ms`);
}

// Update strategy based on performance
if (status.rateLimitStatus.consecutiveErrors > 5) {
  await fetch('/functions/v1/generate-embeddings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_strategy',
      strategy: 'conservative'
    })
  });
}
```

## Deployment

### Using the Deployment Script

```bash
# Set environment variables
export SUPABASE_PROJECT_REF=your_project_ref
export SUPABASE_ANON_KEY=your_anon_key

# Run deployment script
./scripts/deploy-enhanced-embeddings.sh
```

### Manual Deployment

```bash
# Deploy function
supabase functions deploy generate-embeddings

# Set environment variables
supabase secrets set RATE_LIMIT_STRATEGY=balanced
supabase secrets set ENABLE_RATE_LIMITING=true
```

## Testing

### Run Rate Limiting Tests

```bash
# Navigate to function directory
cd supabase/functions/generate-embeddings

# Run tests
deno run --allow-net --allow-env test-rate-limiting.ts
```

### Test Scenarios

1. **Basic Rate Limiting** - Permission requests and denials
2. **Token Estimation** - Content-type aware token calculation
3. **Batch Processing** - Coordinated rate limiting across multiple requests
4. **Strategy Switching** - Runtime configuration changes
5. **Load Testing** - Behavior under high concurrent load

## Performance Impact

### Expected Improvements

- **95%+ Success Rate** through intelligent rate limiting
- **20-30% Cost Reduction** via adaptive token management
- **Reduced API Errors** through proactive quota management
- **Better Resource Utilization** with concurrent request optimization

### Monitoring Metrics

- API call success/failure rates
- Token usage efficiency
- Rate limiting hit frequency
- Processing time improvements
- Cost per embedding generation

## Troubleshooting

### Common Issues

**Rate limiting not working:**
- Check `ENABLE_RATE_LIMITING` environment variable
- Verify Supabase connection for persistent tracking
- Review function logs for initialization errors

**High rate limiting frequency:**
- Consider switching to more conservative strategy
- Check API quota limits with provider
- Review token estimation accuracy

**Performance degradation:**
- Monitor concurrent request limits
- Adjust strategy based on error rates
- Check database performance for quota tracking

### Debug Endpoints

```bash
# Get detailed rate limiting status
curl -X GET "your-function-url?action=rate_limit_status" | jq '.'

# Check function logs
supabase functions logs generate-embeddings --project-ref your-project-ref
```

## Future Enhancements

- **Machine learning-based adaptive strategies**
- **Cross-function rate limiting coordination**
- **Advanced quota prediction algorithms**
- **Real-time strategy optimization**
- **Enhanced monitoring dashboards**
