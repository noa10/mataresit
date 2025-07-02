/**
 * API Key Management Edge Function
 * Handles creation, listing, updating, and deletion of API keys
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  generateApiKey, 
  getApiKeyPrefix, 
  isValidScope, 
  getDefaultScopes 
} from '../_shared/api-auth.ts';

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('Missing authorization header', 401);
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('Creating Supabase admin client for user validation...');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    console.log('JWT token preview:', token.substring(0, 50) + '...');

    // Verify the JWT token using the admin client
    console.log('Attempting to validate user with JWT token...');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    console.log('Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message
    });

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return createErrorResponse(`Invalid authentication token: ${authError?.message || 'No user found'}`, 401);
    }

    // Create regular Supabase client for database operations
    console.log('Creating Supabase client for database operations...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        persistSession: false
      }
    });

    // Route based on HTTP method and path
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const keyId = pathSegments[pathSegments.length - 1];

    switch (req.method) {
      case 'GET':
        if (keyId && keyId !== 'manage-api-keys') {
          return await getApiKey(supabase, user.id, keyId);
        } else {
          return await listApiKeys(supabase, user.id);
        }
      
      case 'POST':
        return await createApiKey(supabase, user.id, req);
      
      case 'PUT':
      case 'PATCH':
        return await updateApiKey(supabase, user.id, keyId, req);
      
      case 'DELETE':
        return await deleteApiKey(supabase, user.id, req);
      
      default:
        return createErrorResponse('Method not allowed', 405);
    }

  } catch (error) {
    console.error('API Key Management Error:', error);
    return createErrorResponse('Internal server error', 500);
  }
});

/**
 * Creates a new API key
 */
async function createApiKey(supabase: any, userId: string, req: Request) {
  try {
    const body = await req.json();
    const { name, description, scopes, teamId, expiresAt } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return createErrorResponse('Name is required and must be at least 3 characters', 400);
    }

    // Validate scopes
    const validatedScopes = scopes || getDefaultScopes('read');
    if (!Array.isArray(validatedScopes) || !validatedScopes.every(isValidScope)) {
      return createErrorResponse('Invalid scopes provided', 400);
    }

    // Validate expiration date
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return createErrorResponse('Expiration date must be in the future', 400);
    }

    // Generate new API key
    const apiKey = generateApiKey('live');
    const keyPrefix = getApiKeyPrefix(apiKey);
    
    // Hash the API key for storage
    const keyHash = await hashApiKey(apiKey);

    // Insert into database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        team_id: teamId || null,
        name: name.trim(),
        description: description?.trim() || null,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: validatedScopes,
        expires_at: expiresAt || null,
        created_by: userId
      })
      .select('id, name, description, scopes, expires_at, created_at')
      .single();

    if (error) {
      console.error('Database error creating API key:', error);
      return createErrorResponse('Failed to create API key', 500);
    }

    return createSuccessResponse({
      ...data,
      apiKey, // Only returned once during creation
      keyPrefix,
      message: 'API key created successfully. Store this key securely - it will not be shown again.'
    }, 201);

  } catch (error) {
    console.error('Error creating API key:', error);
    return createErrorResponse('Invalid request body', 400);
  }
}

/**
 * Lists all API keys for a user
 */
async function listApiKeys(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        id,
        name,
        description,
        key_prefix,
        scopes,
        is_active,
        expires_at,
        last_used_at,
        usage_count,
        created_at,
        team_id,
        teams (name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error listing API keys:', error);
      return createErrorResponse('Failed to retrieve API keys', 500);
    }

    return createSuccessResponse({
      apiKeys: data || [],
      total: data?.length || 0
    });

  } catch (error) {
    console.error('Error listing API keys:', error);
    return createErrorResponse('Failed to retrieve API keys', 500);
  }
}

/**
 * Gets a specific API key
 */
async function getApiKey(supabase: any, userId: string, keyId: string) {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        id,
        name,
        description,
        key_prefix,
        scopes,
        is_active,
        expires_at,
        last_used_at,
        usage_count,
        created_at,
        team_id,
        teams (name)
      `)
      .eq('id', keyId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return createErrorResponse('API key not found', 404);
    }

    return createSuccessResponse(data);

  } catch (error) {
    console.error('Error getting API key:', error);
    return createErrorResponse('Failed to retrieve API key', 500);
  }
}

/**
 * Updates an API key
 */
async function updateApiKey(supabase: any, userId: string, keyId: string, req: Request) {
  try {
    const body = await req.json();
    const { keyId: bodyKeyId, name, description, scopes, isActive, expiresAt } = body;

    // Use keyId from body if provided, otherwise use keyId from URL path
    const actualKeyId = bodyKeyId || keyId;

    console.log('Update API key request:', { userId, urlKeyId: keyId, bodyKeyId, actualKeyId });

    if (!actualKeyId) {
      return createErrorResponse('API key ID is required for update', 400);
    }

    // Validate keyId format (should be a UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(actualKeyId)) {
      return createErrorResponse('Invalid API key ID format', 400);
    }

    const updates: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 3) {
        return createErrorResponse('Name must be at least 3 characters', 400);
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (scopes !== undefined) {
      if (!Array.isArray(scopes) || !scopes.every(isValidScope)) {
        return createErrorResponse('Invalid scopes provided', 400);
      }
      updates.scopes = scopes;
    }

    if (isActive !== undefined) {
      updates.is_active = Boolean(isActive);
    }

    if (expiresAt !== undefined) {
      if (expiresAt && new Date(expiresAt) <= new Date()) {
        return createErrorResponse('Expiration date must be in the future', 400);
      }
      updates.expires_at = expiresAt;
    }

    if (Object.keys(updates).length === 0) {
      return createErrorResponse('No valid fields to update', 400);
    }

    console.log('Updating API key with:', { actualKeyId, updates });

    const { data, error } = await supabase
      .from('api_keys')
      .update(updates)
      .eq('id', actualKeyId)
      .eq('user_id', userId)
      .select('id, name, description, scopes, is_active, expires_at')
      .single();

    if (error) {
      console.error('Database error updating API key:', error);
      return createErrorResponse('Failed to update API key', 500);
    }

    if (!data) {
      return createErrorResponse('API key not found', 404);
    }

    console.log('API key updated successfully:', data);
    return createSuccessResponse(data);

  } catch (error) {
    console.error('Error updating API key:', error);
    return createErrorResponse('Invalid request body', 400);
  }
}

/**
 * Deletes an API key
 */
async function deleteApiKey(supabase: any, userId: string, req: Request) {
  try {
    // Extract keyId from request body
    const body = await req.json();
    const { keyId } = body;

    console.log('Delete API key request:', { userId, keyId });

    if (!keyId) {
      return createErrorResponse('API key ID is required for deletion', 400);
    }

    // Validate keyId format (should be a UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(keyId)) {
      return createErrorResponse('Invalid API key ID format', 400);
    }

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', userId);

    if (error) {
      console.error('Database error deleting API key:', error);
      return createErrorResponse('Failed to delete API key', 500);
    }

    console.log('API key deleted successfully:', keyId);
    return createSuccessResponse({ message: 'API key deleted successfully' });

  } catch (error) {
    console.error('Error deleting API key:', error);
    return createErrorResponse('Failed to delete API key', 500);
  }
}

/**
 * Hash API key for secure storage
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
 * Creates a standardized error response
 */
function createErrorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      error: true,
      message,
      status,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Creates a standardized success response
 */
function createSuccessResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}
