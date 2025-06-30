
/**
 * Comprehensive CORS headers for hybrid development
 * Supports localhost frontend connecting to production Supabase Edge Functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-requested-with, user-agent, accept, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  'Access-Control-Allow-Credentials': 'false', // Explicit for security
};

/**
 * Helper function to add CORS headers to any response
 * Ensures consistent CORS handling across all Edge Functions
 */
export function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);

  // Add all CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // Ensure Content-Type is set for JSON responses
  if (!newHeaders.has('Content-Type') && response.headers.get('Content-Type')?.includes('json')) {
    newHeaders.set('Content-Type', 'application/json');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Create a CORS preflight response
 * Used for handling OPTIONS requests
 */
export function createCorsPreflightResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}
