/**
 * Bypass Test Function - Minimal implementation to test middleware bypass
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Import your existing API handlers
import { handleReceiptsAPI } from '../_shared/api-receipts.ts';
import { handleClaimsAPI } from '../_shared/api-claims.ts';
import { handleSearchAPI } from '../_shared/api-search.ts';
import { handleAnalyticsAPI } from '../_shared/api-analytics.ts';
import { handleTeamsAPI } from '../_shared/api-teams.ts';

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log('=== BYPASS TEST REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Remove function name from path
    if (pathSegments[0] === 'bypass-test') {
      pathSegments.shift();
    }

    // Check for API base path
    if (pathSegments[0] !== 'api' || pathSegments[1] !== 'v1') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid API path. Expected /api/v1/...',
        received: '/' + pathSegments.join('/'),
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract API key
    const apiKey = req.headers.get('X-API-Key') ||
                   req.headers.get('apikey') ||
                   req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing API key',
        timestamp: new Date().toISOString()
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Basic API key validation (format check only for testing)
    if (!apiKey.startsWith('mk_test_') && !apiKey.startsWith('mk_live_')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid API key format',
        timestamp: new Date().toISOString()
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create mock API context for testing
    const mockApiContext = {
      userId: 'test-user-id',
      teamId: 'test-team-id',
      scopes: ['receipts:read', 'receipts:write', 'claims:read', 'claims:write', 'search:read', 'analytics:read', 'teams:read'],
      keyId: 'test-key-id',
      supabase: null // Will be created by handlers if needed
    };

    const resource = pathSegments[2]; // api/v1/[resource]

    // Route to appropriate handler
    switch (resource) {
      case 'health':
        return new Response(JSON.stringify({
          success: true,
          data: {
            status: 'healthy',
            version: '1.0.0',
            function: 'bypass-test',
            timestamp: new Date().toISOString()
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'receipts':
        return await handleReceiptsAPI(req, pathSegments, mockApiContext);
      
      case 'claims':
        return await handleClaimsAPI(req, pathSegments, mockApiContext);
      
      case 'search':
        return await handleSearchAPI(req, pathSegments, mockApiContext);

      case 'analytics':
        return await handleAnalyticsAPI(req, pathSegments, mockApiContext);

      case 'teams':
        return await handleTeamsAPI(req, pathSegments, mockApiContext);
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Resource '${resource}' not found`,
          available: ['health', 'receipts', 'claims', 'search', 'analytics', 'teams'],
          timestamp: new Date().toISOString()
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Bypass Test Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
