/**
 * Test Authentication Validation Function - retired
 *
 * This endpoint reported environment configuration and token-validation
 * details to any caller. It has no client callers; return 410 instead.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { createRetiredDebugEndpointHandler } from '../_shared/retired-debug-endpoint.ts';

serve(createRetiredDebugEndpointHandler('test-auth-validation'));
