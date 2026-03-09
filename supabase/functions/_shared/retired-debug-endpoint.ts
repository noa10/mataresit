const retiredEndpointHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const retiredEndpointBody = {
  success: false,
  error: {
    code: 'ENDPOINT_RETIRED',
    message: 'This debug endpoint has been retired and is no longer available.',
    status: 410,
  },
};

export function createRetiredDebugEndpointHandler(_functionName: string) {
  return (_req: Request): Response => {
    if (_req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: retiredEndpointHeaders,
      });
    }

    return new Response(JSON.stringify(retiredEndpointBody), {
      status: 410,
      headers: {
        ...retiredEndpointHeaders,
        'Content-Type': 'application/json',
      },
    });
  };
}