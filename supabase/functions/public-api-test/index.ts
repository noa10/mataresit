/**
 * Public API Test Function - retired debug endpoint
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { createRetiredDebugEndpointHandler } from '../_shared/retired-debug-endpoint.ts';

serve(createRetiredDebugEndpointHandler('public-api-test'));
