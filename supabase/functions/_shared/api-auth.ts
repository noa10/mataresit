/**
 * External API Authentication Utilities
 * Provides secure API key validation and user context extraction
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export interface ApiKeyValidation {
  valid: boolean;
  userId?: string;
  teamId?: string;
  scopes?: string[];
  keyId?: string;
  error?: string;
}

export interface ApiContext {
  userId: string;
  teamId?: string;
  scopes: string[];
  keyId: string;
  supabase: any;
}

/**
 * Validates an API key and returns user context
 */
export async function validateApiKey(apiKey: string | null): Promise<ApiKeyValidation> {
  if (!apiKey) {
    return { valid: false, error: 'Missing API key' };
  }

  // Validate API key format (should start with mk_live_ or mk_test_)
  if (!apiKey.match(/^mk_(live|test)_[a-zA-Z0-9]{32,}$/)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  try {
    // Initialize Supabase admin client
    // Environment variables are automatically available in Supabase Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      });
      return { valid: false, error: 'Server configuration error' };
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the API key for lookup
    const keyHash = await hashApiKey(apiKey);

    // Verify API key against database
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select(`
        id,
        user_id,
        team_id,
        scopes,
        expires_at,
        is_active,
        name
      `)
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check if key is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    // Update last used timestamp and usage count
    await supabaseAdmin
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: data.usage_count + 1
      })
      .eq('id', data.id);

    return {
      valid: true,
      userId: data.user_id,
      teamId: data.team_id,
      scopes: data.scopes || [],
      keyId: data.id
    };

  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'Internal validation error' };
  }
}

/**
 * Creates an authenticated Supabase client for API operations
 */
export function createApiContext(validation: ApiKeyValidation): ApiContext | null {
  if (!validation.valid || !validation.userId) {
    return null;
  }

  // Create Supabase client with service role for API operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  return {
    userId: validation.userId,
    teamId: validation.teamId,
    scopes: validation.scopes || [],
    keyId: validation.keyId!,
    supabase
  };
}

/**
 * Checks if an API key has a specific scope
 */
export function hasScope(context: ApiContext, requiredScope: string): boolean {
  // Admin scope grants all permissions
  if (context.scopes.includes('admin:all')) {
    return true;
  }

  // Check for exact scope match
  return context.scopes.includes(requiredScope);
}

/**
 * Checks if an API key has any of the specified scopes
 */
export function hasAnyScope(context: ApiContext, requiredScopes: string[]): boolean {
  // Admin scope grants all permissions
  if (context.scopes.includes('admin:all')) {
    return true;
  }

  // Check if any required scope is present
  return requiredScopes.some(scope => context.scopes.includes(scope));
}

/**
 * Hash API key for secure storage using SHA-256
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a new API key with proper format
 */
export function generateApiKey(environment: 'live' | 'test' = 'live'): string {
  const prefix = `mk_${environment}_`;
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const randomString = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return prefix + randomString;
}

/**
 * Extracts API key prefix for identification
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 12); // e.g., "mk_live_abc1"
}

/**
 * Validates scope format
 */
export function isValidScope(scope: string): boolean {
  const validScopes = [
    'receipts:read',
    'receipts:write', 
    'receipts:delete',
    'claims:read',
    'claims:write',
    'claims:delete',
    'search:read',
    'analytics:read',
    'teams:read',
    'admin:all'
  ];
  
  return validScopes.includes(scope);
}

/**
 * Gets default scopes for different access levels
 */
export function getDefaultScopes(level: 'read' | 'write' | 'admin'): string[] {
  switch (level) {
    case 'read':
      return ['receipts:read', 'claims:read', 'search:read', 'analytics:read', 'teams:read'];
    case 'write':
      return ['receipts:read', 'receipts:write', 'claims:read', 'claims:write', 'search:read', 'analytics:read', 'teams:read'];
    case 'admin':
      return ['admin:all'];
    default:
      return ['receipts:read'];
  }
}
