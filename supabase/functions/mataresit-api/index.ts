/**
 * Mataresit API Function
 * Simple working API for testing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const API_BASE_PATH = '/api/v1';

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
      },
    });
  }

  try {
    // Parse request URL and extract endpoint
    const url = new URL(req.url);
    const fullPath = url.pathname;
    
    console.log('Full path received:', fullPath);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    // Extract the API path after the function name
    let endpoint = fullPath;
    if (fullPath.startsWith('/mataresit-api')) {
      endpoint = fullPath.substring('/mataresit-api'.length);
    }
    
    console.log('Extracted endpoint:', endpoint);
    
    // Extract API key from headers
    const apiKey = req.headers.get('X-API-Key') || 
                   req.headers.get('apikey') || 
                   req.headers.get('Authorization')?.replace('Bearer ', '');
    
    console.log('API Key received:', apiKey ? `${apiKey.substring(0, 20)}...` : 'None');
    
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
    
    // Validate API base path
    if (!endpoint.startsWith(API_BASE_PATH)) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'ENDPOINT_NOT_FOUND',
          message: `API endpoint not found. Expected path starting with ${API_BASE_PATH}, got: ${endpoint}`,
          status: 404
        },
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    // For now, let's validate the API key format (basic validation)
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
    
    // Handle health check
    if (endpoint === '/api/v1/health') {
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
    
    // Default response for other endpoints
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'ENDPOINT_NOT_IMPLEMENTED',
        message: 'Endpoint not implemented yet',
        status: 404
      },
      timestamp: new Date().toISOString()
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in mataresit-api function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        status: 500
      },
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
