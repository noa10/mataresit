# Getting Started with Mataresit API

Welcome to the Mataresit API! This guide will help you get up and running with our comprehensive receipt management and expense analytics API.

## Quick Start

### 1. Get Your API Key

1. Sign up at [mataresit.com](https://mataresit.com)
2. Navigate to **Dashboard → API Keys**
3. Click **"Create API Key"**
4. Choose appropriate scopes for your use case
5. Copy your API key (it starts with `mk_live_`)

### 2. Make Your First Request

```bash
curl -X GET \
  'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1/health' \
  -H 'X-API-Key: mk_live_your_api_key_here'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "v1",
    "user": {
      "id": "user-uuid",
      "scopes": ["receipts:read", "receipts:write"]
    }
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### 3. Create Your First Receipt

```bash
curl -X POST \
  'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1/receipts' \
  -H 'X-API-Key: mk_live_your_api_key_here' \
  -H 'Content-Type: application/json' \
  -d '{
    "merchant": "Starbucks Coffee",
    "date": "2025-01-15",
    "total": 15.50,
    "currency": "USD",
    "paymentMethod": "Credit Card",
    "category": "Food & Dining"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "merchant": "Starbucks Coffee",
    "date": "2025-01-15",
    "total": 15.50,
    "currency": "USD",
    "paymentMethod": "Credit Card",
    "predictedCategory": "Food & Dining",
    "status": "unreviewed",
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Authentication

All API requests require authentication using API keys. Include your API key in the `X-API-Key` header:

```
X-API-Key: mk_live_your_api_key_here
```

### API Key Types

- **Live Keys** (`mk_live_`): For production use
- **Test Keys** (`mk_test_`): For development and testing

### Scopes and Permissions

API keys use scope-based permissions:

| Scope | Description |
|-------|-------------|
| `receipts:read` | View and list receipts |
| `receipts:write` | Create and update receipts |
| `receipts:delete` | Delete receipts |
| `claims:read` | View and list claims |
| `claims:write` | Create and update claims |
| `claims:delete` | Delete claims |
| `search:read` | Perform semantic searches |
| `analytics:read` | Access analytics and reports |
| `teams:read` | Access team information |
| `admin:all` | Full administrative access |

## Rate Limits

API requests are rate-limited based on your subscription tier:

| Tier | Requests/Hour | Burst Allowance | Features |
|------|---------------|-----------------|----------|
| **Free** | 100 | 15 | Basic receipts |
| **Pro** | 1,000 | 80 | Claims, Analytics |
| **Max** | 5,000 | 400 | All features |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
X-RateLimit-Tier: pro
```

When rate limited, you'll receive a `429` response:

```json
{
  "error": true,
  "message": "Rate limit exceeded",
  "retryAfter": 60,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Error Handling

The API uses conventional HTTP response codes and returns detailed error information:

### Success Codes
- `200` - OK
- `201` - Created
- `204` - No Content

### Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

### Error Response Format

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "validationErrors": [
      {
        "field": "merchant",
        "message": "merchant is required",
        "value": null
      }
    ]
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Pagination

List endpoints support pagination with these parameters:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

### Pagination Response

```json
{
  "success": true,
  "data": {
    "receipts": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

## Filtering and Sorting

Most list endpoints support filtering and sorting:

### Common Filters
- `start_date` / `end_date` - Date range filtering
- `min_amount` / `max_amount` - Amount range filtering
- `currency` - Currency code filtering
- `status` - Status filtering
- `team_id` - Team filtering (requires team access)

### Sorting
- `sort_by` - Field to sort by
- `sort_order` - `asc` or `desc` (default: `desc`)

### Example: Filtered Receipt List

```bash
curl -X GET \
  'https://api.mataresit.com/v1/receipts?start_date=2025-01-01&end_date=2025-01-31&min_amount=10&sort_by=total&sort_order=desc&limit=25' \
  -H 'X-API-Key: mk_live_your_api_key_here'
```

## Webhooks (Coming Soon)

Webhooks allow you to receive real-time notifications when events occur in your account:

- `receipt.created` - New receipt uploaded
- `receipt.processed` - Receipt processing completed
- `claim.submitted` - Claim submitted for review
- `claim.approved` - Claim approved
- `claim.rejected` - Claim rejected

## SDKs and Libraries

### Official SDKs

- **JavaScript/Node.js** - `npm install @mataresit/api`
- **Python** - `pip install mataresit-api`
- **PHP** - `composer require mataresit/api`

### Community SDKs

- **Ruby** - `gem install mataresit-ruby`
- **Go** - `go get github.com/mataresit/go-sdk`

## Best Practices

### 1. Secure API Key Storage

```javascript
// ✅ Good - Use environment variables
const apiKey = process.env.MATARESIT_API_KEY;

// ❌ Bad - Hardcoded in source code
const apiKey = 'mk_live_abc123...';
```

### 2. Handle Rate Limits Gracefully

```javascript
async function makeApiRequest(url, options) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return makeApiRequest(url, options); // Retry
  }
  
  return response;
}
```

### 3. Use Appropriate Scopes

Only request the minimum scopes needed for your application:

```javascript
// ✅ Good - Minimal scopes
const scopes = ['receipts:read', 'receipts:write'];

// ❌ Bad - Excessive permissions
const scopes = ['admin:all'];
```

### 4. Implement Proper Error Handling

```javascript
try {
  const response = await mataresit.receipts.create(receiptData);
  console.log('Receipt created:', response.data);
} catch (error) {
  if (error.code === 'SUBSCRIPTION_LIMIT_EXCEEDED') {
    // Handle subscription limit
    showUpgradePrompt();
  } else if (error.code === 'VALIDATION_ERROR') {
    // Handle validation errors
    showValidationErrors(error.details.validationErrors);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

## Next Steps

- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Code Examples](./examples/)** - Language-specific examples
- **[Webhooks Guide](./webhooks.md)** - Real-time event notifications
- **[SDKs Documentation](./sdks/)** - Official SDK documentation
- **[Migration Guide](./migration.md)** - Upgrading from v0 to v1

## Support

- **Documentation**: [docs.mataresit.com](https://docs.mataresit.com)
- **API Status**: [status.mataresit.com](https://status.mataresit.com)
- **Support Email**: [api-support@mataresit.com](mailto:api-support@mataresit.com)
- **Community**: [Discord](https://discord.gg/mataresit)

## Rate Limiting Best Practices

### Exponential Backoff

```javascript
async function apiRequestWithBackoff(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
}
```

### Batch Operations

Use batch endpoints when possible to reduce API calls:

```javascript
// ✅ Good - Batch upload
const receipts = await mataresit.receipts.createBatch([
  { merchant: 'Store A', total: 10.50, date: '2025-01-15' },
  { merchant: 'Store B', total: 25.00, date: '2025-01-15' },
  { merchant: 'Store C', total: 8.75, date: '2025-01-15' }
]);

// ❌ Less efficient - Individual requests
for (const receiptData of receiptsData) {
  await mataresit.receipts.create(receiptData);
}
```
