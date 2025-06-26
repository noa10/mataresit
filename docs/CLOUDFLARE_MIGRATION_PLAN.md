# Cloudflare Workers Migration Plan

## Overview
Alternative migration path using Cloudflare Workers for API hosting.

## Setup
```bash
# Install Wrangler CLI
npm install -g wrangler

# Initialize project
wrangler init mataresit-api

# Configure secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Worker Implementation
```typescript
// src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      
      // API key validation
      const apiKey = request.headers.get('X-API-Key');
      if (!apiKey) {
        return Response.json(
          { error: 'Missing API key' },
          { status: 401, headers: corsHeaders }
        );
      }

      // Route handling
      const resource = pathSegments[2]; // /api/v1/[resource]
      
      switch (resource) {
        case 'health':
          return Response.json({
            success: true,
            data: { status: 'healthy', platform: 'cloudflare' }
          }, { headers: corsHeaders });
        
        default:
          return Response.json(
            { error: 'Resource not found' },
            { status: 404, headers: corsHeaders }
          );
      }

    } catch (error) {
      return Response.json(
        { error: 'Internal server error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
```

## Benefits
- Zero cold starts
- Global edge deployment
- No middleware interference
- Cost-effective for API workloads
