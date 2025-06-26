/**
 * Minimal External API for testing
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
    if (fullPath.startsWith('/external-api-minimal')) {
      endpoint = fullPath.substring('/external-api-minimal'.length);
    }
    
    console.log('Extracted endpoint:', endpoint);
    
    // Extract API key from headers
    const apiKey = req.headers.get('X-API-Key') || 
                   req.headers.get('apikey') || 
                   req.headers.get('Authorization')?.replace('Bearer ', '');
    
    console.log('API Key received:', apiKey ? `${apiKey.substring(0, 20)}...` : 'None');
    
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: true,
        message: 'Missing API key',
        status: 401,
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
        error: true,
        message: `API endpoint not found. Expected path starting with ${API_BASE_PATH}, got: ${endpoint}`,
        status: 404,
        timestamp: new Date().toISOString()
      }), {
        status: 404,
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
        message: 'Minimal External API is healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoint: endpoint,
        apiKey: apiKey.substring(0, 20) + '...'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    // Default response for other endpoints
    return new Response(JSON.stringify({
      error: true,
      message: 'Endpoint not implemented in minimal version',
      status: 404,
      timestamp: new Date().toISOString()
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in minimal external API:', error);
    
    return new Response(JSON.stringify({
      error: true,
      message: 'Internal server error',
      status: 500,
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
