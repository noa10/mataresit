const API_VERSION = 'v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface ExternalApiValidation {
  valid: boolean;
  userId?: string;
  teamId?: string;
  scopes?: string[];
  keyId?: string;
  error?: string;
}

interface ExternalApiContext {
  userId: string;
  teamId?: string;
  scopes: string[];
  keyId: string;
  supabase: unknown;
  userSupabase: unknown;
  authHeader: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
  errorMessage?: string;
}

interface ExternalApiHandlerDependencies {
  validateApiKey: (apiKey: string | null) => Promise<ExternalApiValidation>;
  createApiContext: (
    validation: ExternalApiValidation,
    authHeader: string | null,
  ) => Promise<ExternalApiContext | null>;
  hasScope: (context: ExternalApiContext, requiredScope: string) => boolean;
  checkRateLimit: (context: ExternalApiContext, endpoint: string) => Promise<RateLimitResult>;
  recordRequest: (
    context: ExternalApiContext,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    metadata: RequestMetadata,
  ) => Promise<void>;
  getRateLimitHeaders: (result: RateLimitResult) => Record<string, string>;
  handleReceiptsAPI: (req: Request, pathSegments: string[], context: ExternalApiContext) => Promise<Response>;
  handleClaimsAPI: (req: Request, pathSegments: string[], context: ExternalApiContext) => Promise<Response>;
  handleSearchAPI: (req: Request, pathSegments: string[], context: ExternalApiContext) => Promise<Response>;
  handleAnalyticsAPI: (req: Request, pathSegments: string[], context: ExternalApiContext) => Promise<Response>;
  handleTeamsAPI: (req: Request, pathSegments: string[], context: ExternalApiContext) => Promise<Response>;
  handleMeAPI: (req: Request, pathSegments: string[], context: ExternalApiContext) => Promise<Response>;
  handleCategoriesAPI: (req: Request, pathSegments: string[], context: ExternalApiContext) => Promise<Response>;
  handleGamificationAPI: (req: Request, pathSegments: string[], context: ExternalApiContext) => Promise<Response>;
  withPerformanceMonitoring: (
    endpoint: string,
    method: string,
    callback: (monitor: unknown) => Promise<Response>,
  ) => () => Promise<Response>;
  getCacheStats: () => unknown;
  getPerformanceHealth: () => unknown;
  validateUUID: (value: string, fieldName: string) => Response | null;
}

interface ExternalApiHandlerOptions {
  useMockContext: boolean;
  bypassMode: boolean;
  logger?: Pick<Console, 'log' | 'error'>;
}

export function createExternalApiHandler(
  deps: ExternalApiHandlerDependencies,
  options: ExternalApiHandlerOptions,
) {
  const logger = options.logger ?? console;

  function getMockRateLimitHeaders() {
    return {
      'x-ratelimit-limit': '1000',
      'x-ratelimit-remaining': '999',
      'x-ratelimit-reset': Math.floor(Date.now() / 1000 + 3600).toString(),
    };
  }

  function createErrorResponse(message: string, status: number, details?: unknown): Response {
    return new Response(
      JSON.stringify({
        error: true,
        message,
        code: status,
        details,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...getMockRateLimitHeaders(),
        },
      },
    );
  }

  function createSuccessResponse(data: unknown, status: number = 200): Response {
    return new Response(
      JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...getMockRateLimitHeaders(),
        },
      },
    );
  }

  function validatePathUUIDs(pathSegments: string[], resource: string): Response | null {
    const uuidPositions: Record<string, number[]> = {
      receipts: [1],
      claims: [1],
      teams: [1],
    };
    const reservedSegments: Record<string, Set<string>> = {
      receipts: new Set(['batch', 'quick']),
    };

    const positions = uuidPositions[resource];
    if (!positions) return null;

    for (const position of positions) {
      const id = pathSegments[position];
      if (id && !reservedSegments[resource]?.has(id)) {
        const validationError = deps.validateUUID(id, `${resource.slice(0, -1)}Id`);
        if (validationError) {
          return validationError;
        }
      }
    }

    return null;
  }

  function isBearerAuthorizationHeader(authHeader: string): boolean {
    return /^Bearer\s+\S+$/i.test(authHeader);
  }

  async function handlePerformanceCheck(context: ExternalApiContext): Promise<Response> {
    if (!options.bypassMode && !deps.hasScope(context, 'admin:all')) {
      return createErrorResponse('Insufficient permissions for performance monitoring', 403);
    }

    if (options.bypassMode) {
      return createSuccessResponse({
        cache: { hits: 100, misses: 10, ratio: 90.9 },
        health: { status: 'healthy', uptime: '1h 30m' },
        endpoints: {
          receipts: 'operational',
          claims: 'operational',
          me: 'groundwork',
          categories: 'groundwork',
          gamification: 'groundwork',
          search: 'operational',
          analytics: 'operational',
          teams: 'operational',
        },
        mode: 'bypass',
        timestamp: new Date().toISOString(),
      });
    }

    return createSuccessResponse({
      cache: deps.getCacheStats(),
      health: deps.getPerformanceHealth(),
      endpoints: {
        receipts: 'operational',
        claims: 'operational',
        me: 'groundwork',
        categories: 'groundwork',
        gamification: 'groundwork',
        search: 'operational',
        analytics: 'operational',
        teams: 'operational',
      },
      mode: 'production',
      timestamp: new Date().toISOString(),
    });
  }

  return async (req: Request): Promise<Response> => {
    const startTime = Date.now();
    let apiContext: ExternalApiContext | null = null;
    let endpoint = '';
    let statusCode = 200;
    let errorMessage: string | undefined;

    try {
      logger.log('=== EXTERNAL API REQUEST ===');
      logger.log('Method:', req.method);
      logger.log('URL:', req.url);
      logger.log('Headers:', Object.fromEntries(req.headers.entries()));

      if (req.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders,
          status: 204,
        });
      }

      const url = new URL(req.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);

      if (pathSegments[0] === 'external-api') {
        pathSegments.shift();
      }

      logger.log('Path segments:', pathSegments);

      if (pathSegments[0] !== 'api' || pathSegments[1] !== API_VERSION) {
        statusCode = 404;
        return createErrorResponse('Invalid API path. Expected /api/v1/...', 404, {
          received: `/${pathSegments.join('/')}`,
        });
      }

      endpoint = `/${pathSegments.join('/')}`;
      logger.log('Final endpoint:', endpoint);

      const authHeader = req.headers.get('Authorization');
      const apiKey = req.headers.get('X-API-Key') || req.headers.get('apikey');

      logger.log('Auth header present:', !!authHeader);
      logger.log('API key present:', !!apiKey);
      logger.log('Bypass mode:', options.bypassMode);
      logger.log('Mock context mode:', options.useMockContext);

      const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
      if (!allowedMethods.includes(req.method)) {
        statusCode = 405;
        errorMessage = `Method ${req.method} not allowed`;
        return new Response(
          JSON.stringify({
            error: true,
            code: 405,
            message: `Method ${req.method} not allowed`,
            allowedMethods: allowedMethods.filter((method) => method !== 'OPTIONS'),
            timestamp: new Date().toISOString(),
          }),
          {
            status: 405,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              Allow: allowedMethods.filter((method) => method !== 'OPTIONS').join(', '),
            },
          },
        );
      }

      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          await req.clone().json();
        } catch {
          statusCode = 400;
          errorMessage = 'Invalid JSON in request body';
          return createErrorResponse('Invalid JSON in request body', 400);
        }
      }

      if (!authHeader || !apiKey) {
        statusCode = 401;
        errorMessage = 'Missing required headers';
        return createErrorResponse(
          'Missing required authentication headers. Include both Authorization: Bearer <token> and X-API-Key: <key>',
          401,
        );
      }

      if (!isBearerAuthorizationHeader(authHeader)) {
        statusCode = 401;
        errorMessage = 'Invalid Authorization header format';
        return createErrorResponse(
          'Invalid Authorization header format. Expected Authorization: Bearer <token>',
          401,
        );
      }

      if (!apiKey.startsWith('mk_test_') && !apiKey.startsWith('mk_live_')) {
        statusCode = 401;
        errorMessage = 'Invalid API key format';
        return createErrorResponse('Invalid API key format', 401);
      }

      if (options.useMockContext || options.bypassMode) {
        apiContext = {
          userId: 'test-user-id',
          teamId: 'test-team-id',
          scopes: [
            'receipts:read',
            'receipts:write',
            'claims:read',
            'claims:write',
            'profile:read',
            'categories:read',
            'gamification:read',
            'search:read',
            'analytics:read',
            'teams:read',
          ],
          keyId: 'test-key-id',
          supabase: null,
          userSupabase: null,
          authHeader,
        };
        logger.log('Using mock API context');
      } else {
        const validation = await deps.validateApiKey(apiKey);
        if (!validation.valid) {
          statusCode = 401;
          errorMessage = validation.error;
          return createErrorResponse(validation.error || 'Invalid API key', 401);
        }

        apiContext = await deps.createApiContext(validation, authHeader);
        if (!apiContext) {
          statusCode = 401;
          errorMessage = 'Failed to create API context';
          return createErrorResponse('Authentication failed', 401);
        }
        logger.log('Using production API context');
      }

      if (!options.bypassMode) {
        const rateLimitResult = await deps.checkRateLimit(apiContext, endpoint);
        if (!rateLimitResult.allowed) {
          statusCode = 429;
          errorMessage = 'Rate limit exceeded';
          return new Response(
            JSON.stringify({
              error: 'Rate limit exceeded',
              message: `Too many requests. Limit: ${rateLimitResult.remaining} requests remaining.`,
              retryAfter: rateLimitResult.retryAfter,
            }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                ...deps.getRateLimitHeaders(rateLimitResult),
                'Content-Type': 'application/json',
              },
            },
          );
        }
      }

      const resource = pathSegments[2];
      const handlerPathSegments = pathSegments.slice(2);
      logger.log('Resource:', resource);
      logger.log('Handler path segments:', handlerPathSegments);

      const uuidValidationError = validatePathUUIDs(handlerPathSegments, resource);
      if (uuidValidationError) {
        statusCode = 400;
        errorMessage = 'Invalid UUID format';
        return uuidValidationError;
      }

      let response: Response;
      switch (resource) {
        case 'health':
          response = createSuccessResponse({
            status: 'healthy',
            version: API_VERSION,
            function: 'external-api',
            timestamp: new Date().toISOString(),
            user: {
              id: apiContext.userId,
              scopes: apiContext.scopes,
            },
            mode: options.useMockContext || options.bypassMode ? 'test' : 'production',
            features: {
              receipts: true,
              claims: true,
              me: true,
              categories: true,
              gamification: true,
              search: true,
              analytics: true,
              teams: true,
            },
          });
          break;
        case 'receipts':
          response = await deps.handleReceiptsAPI(req, handlerPathSegments, apiContext);
          break;
        case 'claims':
          response = await deps.handleClaimsAPI(req, handlerPathSegments, apiContext);
          break;
        case 'me':
          response = await deps.handleMeAPI(req, handlerPathSegments, apiContext);
          break;
        case 'categories':
          response = await deps.handleCategoriesAPI(req, handlerPathSegments, apiContext);
          break;
        case 'gamification':
          response = await deps.handleGamificationAPI(req, handlerPathSegments, apiContext);
          break;
        case 'search':
          response = options.bypassMode
            ? await deps.handleSearchAPI(req, handlerPathSegments, apiContext)
            : await deps.withPerformanceMonitoring('/api/v1/search', req.method, async () =>
                deps.handleSearchAPI(req, handlerPathSegments, apiContext),
              )();
          break;
        case 'analytics':
          response = options.bypassMode
            ? await deps.handleAnalyticsAPI(req, handlerPathSegments, apiContext)
            : await deps.withPerformanceMonitoring('/api/v1/analytics', req.method, async () =>
                deps.handleAnalyticsAPI(req, handlerPathSegments, apiContext),
              )();
          break;
        case 'teams':
          response = options.bypassMode
            ? await deps.handleTeamsAPI(req, handlerPathSegments, apiContext)
            : await deps.withPerformanceMonitoring('/api/v1/teams', req.method, async () =>
                deps.handleTeamsAPI(req, handlerPathSegments, apiContext),
              )();
          break;
        case 'performance':
          response = await handlePerformanceCheck(apiContext);
          break;
        default:
          statusCode = 404;
          response = createErrorResponse(`Resource '${resource}' not found`, 404, {
            available: [
              'health',
              'receipts',
              'claims',
              'me',
              'categories',
              'gamification',
              'search',
              'analytics',
              'teams',
              'performance',
            ],
            received: resource,
          });
      }

      statusCode = response.status;
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('External API Error:', error);
      statusCode = 500;
      errorMessage = message;
      return createErrorResponse('Internal server error', 500, message);
    } finally {
      if (apiContext && !options.bypassMode) {
        const responseTime = Date.now() - startTime;
        const clientIP =
          req.headers.get('CF-Connecting-IP') ||
          req.headers.get('X-Forwarded-For') ||
          req.headers.get('X-Real-IP');

        await deps.recordRequest(apiContext, endpoint, req.method, statusCode, responseTime, {
          ipAddress: clientIP,
          userAgent: req.headers.get('User-Agent'),
          errorMessage,
        }).catch((recordError) => logger.error('Failed to record request:', recordError));
      }
    }
  };
}