# Vercel Edge Functions Migration Plan

## Overview
If Supabase Edge Functions middleware issues cannot be resolved, this plan provides a migration path to Vercel Edge Functions while maintaining API compatibility.

## Migration Strategy

### Phase 1: Vercel Setup
```bash
# Install Vercel CLI
npm install -g vercel

# Initialize Vercel project
vercel init

# Configure environment variables
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENAI_API_KEY
```

### Phase 2: API Function Migration
Create `api/v1/[...path].ts` in your project root:

```typescript
// api/v1/[...path].ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export default async function handler(req: NextRequest) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  };

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Extract path segments
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Remove 'api/v1' from path
    const resource = pathSegments[2];
    
    // API key validation
    const apiKey = req.headers.get('X-API-Key') || 
                   req.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Route to appropriate handler
    switch (resource) {
      case 'health':
        return NextResponse.json({
          success: true,
          data: { status: 'healthy', platform: 'vercel' }
        }, { headers: corsHeaders });
      
      case 'receipts':
        // Import and use your existing receipt handlers
        return await handleReceiptsAPI(req, pathSegments, supabase);
      
      default:
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404, headers: corsHeaders }
        );
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
```

### Phase 3: Test Suite Adaptation
Update your test configuration:

```typescript
// Update API_BASE_URL in test suite
const API_BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/v1`
  : 'http://localhost:3000/api/v1';
```

## Benefits
- No JWT middleware interference
- Better performance (Vercel Edge Runtime)
- Easier debugging and logging
- Seamless integration with existing Supabase backend

## Migration Timeline
- **Day 1**: Set up Vercel project and basic API structure
- **Day 2**: Migrate core API handlers (receipts, claims)
- **Day 3**: Update test suite and validate functionality
- **Day 4**: Production deployment and DNS updates
