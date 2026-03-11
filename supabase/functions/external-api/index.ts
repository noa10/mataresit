/**
 * Mataresit External API - Enhanced with Middleware Bypass
 * Secure REST API for external integrations with receipt and claims management
 * Incorporates proven middleware-compatible request handling patterns
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { validateApiKey, createApiContext, hasScope } from '../_shared/api-auth.ts';
import { checkRateLimit, recordRequest, getRateLimitHeaders } from '../_shared/api-rate-limiting.ts';
import { handleReceiptsAPI } from '../_shared/api-receipts.ts';
import { handleClaimsAPI } from '../_shared/api-claims.ts';
import { handleMeAPI } from '../_shared/api-me.ts';
import { handleCategoriesAPI } from '../_shared/api-categories.ts';
import { handleGamificationAPI } from '../_shared/api-gamification.ts';
import { handleSearchAPI } from '../_shared/api-search.ts';
import { handleAnalyticsAPI } from '../_shared/api-analytics.ts';
import { handleTeamsAPI } from '../_shared/api-teams.ts';
import { withPerformanceMonitoring, getCacheStats, getPerformanceHealth } from '../_shared/api-performance.ts';
import { validateUUID } from '../_shared/api-error-handling.ts';
import { createExternalApiHandler } from '../_shared/external-api-handler.ts';

serve(createExternalApiHandler(
  {
    validateApiKey,
    createApiContext,
    hasScope,
    checkRateLimit,
    recordRequest,
    getRateLimitHeaders,
    handleReceiptsAPI,
    handleClaimsAPI,
    handleMeAPI,
    handleCategoriesAPI,
    handleGamificationAPI,
    handleSearchAPI,
    handleAnalyticsAPI,
    handleTeamsAPI,
    withPerformanceMonitoring,
    getCacheStats,
    getPerformanceHealth,
    validateUUID,
  },
  {
    useMockContext: Deno.env.get('USE_MOCK_CONTEXT') === 'true',
    bypassMode: Deno.env.get('BYPASS_MODE') === 'true',
  },
));

/**
 * All advanced API handlers are now implemented in their respective modules
 * - handleSearchAPI: Semantic search across receipts, claims, and business directory
 * - handleAnalyticsAPI: Comprehensive analytics and reporting
 * - handleTeamsAPI: Team management and collaboration features
 */
