/**
 * Retired alias for the external API.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { createRetiredApiAliasHandler } from '../_shared/retired-api-alias.ts';

serve(createRetiredApiAliasHandler('mataresit-api'));
