/**
 * Simple test function to verify basic Edge Function deployment - retired
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { createRetiredDebugEndpointHandler } from '../_shared/retired-debug-endpoint.ts';

serve(createRetiredDebugEndpointHandler('test-simple'));
