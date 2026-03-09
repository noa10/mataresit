const retiredApiAliasHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  Deprecation: 'true',
  Link: '</functions/v1/external-api/api/v1>; rel="successor-version"',
};

const canonicalEndpoint = '/functions/v1/external-api/api/v1';

export function createRetiredApiAliasHandler(functionName: string) {
  return (_req: Request): Response => {
    if (_req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: retiredApiAliasHeaders,
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'ENDPOINT_DEPRECATED',
        message: `The ${functionName} alias has been retired. Use external-api instead.`,
        status: 410,
      },
      replacement: {
        function: 'external-api',
        path: canonicalEndpoint,
      },
    }), {
      status: 410,
      headers: {
        ...retiredApiAliasHeaders,
        'Content-Type': 'application/json',
      },
    });
  };
}