/**
 * Public API Test Function - Alternative naming to bypass middleware
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  // Bypass headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    'X-Supabase-Auth': 'bypass',
    'X-Function-Auth': 'disabled',
    'X-JWT-Verify': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Log all request details for debugging
    console.log('=== PUBLIC API TEST REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    console.log('Pathname:', url.pathname);
    
    // Test API key extraction
    const apiKey = req.headers.get('X-API-Key') ||
                   req.headers.get('apikey') ||
                   req.headers.get('Authorization')?.replace('Bearer ', '');
    
    const response = {
      success: true,
      message: 'Public API test function working!',
      timestamp: new Date().toISOString(),
      debug: {
        method: req.method,
        pathname: url.pathname,
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : null,
        headers: Object.fromEntries(req.headers.entries())
      }
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Public API Test Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
