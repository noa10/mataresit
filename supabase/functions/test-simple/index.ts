/**
 * Simple test function to verify basic Edge Function deployment
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  // Explicitly bypass Supabase JWT middleware
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    'X-Supabase-Auth': 'bypass',
    'X-Function-Auth': 'disabled'
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    const url = new URL(req.url);
    const fullPath = url.pathname;

    console.log('Request received:', {
      method: req.method,
      url: req.url,
      pathname: url.pathname,
      headers: Object.fromEntries(req.headers.entries())
    });

    // Extract the API path after the function name
    let endpoint = fullPath;
    if (fullPath.startsWith('/test-simple')) {
      endpoint = fullPath.substring('/test-simple'.length);
    }

    // Extract API key from headers
    const apiKey = req.headers.get('X-API-Key') ||
                   req.headers.get('apikey') ||
                   req.headers.get('Authorization')?.replace('Bearer ', '');

    // Handle API endpoints
    if (endpoint === '/api/v1/health') {
      if (!apiKey) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'Missing API key. Please provide X-API-Key header.',
            status: 401
          },
          timestamp: new Date().toISOString()
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (!apiKey.startsWith('mk_test_')) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid API key format',
            status: 401
          },
          timestamp: new Date().toISOString()
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          status: 'healthy',
          version: '1.0.0',
          user: {
            id: 'test-user-id',
            apiKey: apiKey.substring(0, 20) + '...',
            scopes: ['receipts:read', 'receipts:write', 'claims:read', 'claims:write', 'search:read', 'analytics:read', 'teams:read']
          }
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'x-ratelimit-limit': '1000',
          'x-ratelimit-remaining': '999',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
        },
      });
    }

    // Default response for debugging
    const response = {
      success: true,
      message: 'Simple test function is working!',
      timestamp: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
      endpoint: endpoint,
      headers: Object.fromEntries(req.headers.entries())
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
      },
    });

  } catch (error) {
    console.error('Error in test function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
