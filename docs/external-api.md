# External API for Mataresit Integration

Based on your codebase, here's how to create a secure external API for Mataresit:

## 1. Recommended Approach

Leverage Supabase Edge Functions to create a secure REST API layer:

````typescript path=supabase/functions/api/index.ts mode=EDIT
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';
import { validateApiKey } from '../_shared/auth.ts';

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Validate API key
  const apiKey = req.headers.get('X-API-Key');
  const validationResult = await validateApiKey(apiKey);
  
  if (!validationResult.valid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), 
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  
  // Route to appropriate handler
  const url = new URL(req.url);
  const path = url.pathname.split('/').filter(Boolean);
  
  if (path[1] === 'receipts') {
    return handleReceiptRequests(req, path, validationResult.userId);
  } else if (path[1] === 'claims') {
    return handleClaimRequests(req, path, validationResult.userId);
  }
  
  return new Response(JSON.stringify({ error: 'Not found' }), 
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
````

## 2. Authentication Mechanism

Implement API key authentication with scoped permissions:

````typescript path=supabase/functions/_shared/auth.ts mode=EDIT
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export interface ApiKeyValidation {
  valid: boolean;
  userId?: string;
  teamId?: string;
  scopes?: string[];
}

export async function validateApiKey(apiKey: string | null): Promise<ApiKeyValidation> {
  if (!apiKey) {
    return { valid: false };
  }
  
  // Initialize Supabase admin client
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  // Verify API key against api_keys table
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('user_id, team_id, scopes, expires_at')
    .eq('key_hash', await hashApiKey(apiKey))
    .single();
  
  if (error || !data) {
    return { valid: false };
  }
  
  // Check if key is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false };
  }
  
  return {
    valid: true,
    userId: data.user_id,
    teamId: data.team_id,
    scopes: data.scopes
  };
}

// Hash API key for secure storage
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
````

## 3. Valuable Endpoints to Create First

Based on your codebase, these endpoints would be most valuable:

````typescript path=supabase/functions/api/receipts.ts mode=EDIT
import { corsHeaders } from '../_shared/cors.ts';

export async function handleReceiptRequests(req: Request, path: string[], userId: string) {
  const supabase = createClientWithAuth(req);
  
  // GET /api/receipts - List receipts with filtering
  if (req.method === 'GET' && path.length === 2) {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams);
    
    // Apply filters (date range, merchant, category, etc.)
    let query = supabase
      .from('receipts')
      .select(`
        id, merchant, date, total, tax, currency, 
        payment_method, status, predicted_category, 
        created_at, updated_at
      `)
      .eq('user_id', userId);
    
    // Apply date filters if provided
    if (params.start_date) {
      query = query.gte('date', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('date', params.end_date);
    }
    
    const { data, error } = await query.order('date', { ascending: false });
    
    if (error) {
      return errorResponse(error.message);
    }
    
    return jsonResponse(data);
  }
  
  // GET /api/receipts/:id - Get receipt details
  if (req.method === 'GET' && path.length === 3) {
    const receiptId = path[2];
    
    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *, 
        line_items (*)
      `)
      .eq('id', receiptId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      return errorResponse(error.message);
    }
    
    return jsonResponse(data);
  }
  
  return errorResponse('Not found', 404);
}
````

````typescript path=supabase/functions/api/claims.ts mode=EDIT
import { corsHeaders } from '../_shared/cors.ts';

export async function handleClaimRequests(req: Request, path: string[], userId: string) {
  const supabase = createClientWithAuth(req);
  
  // GET /api/claims - List claims with filtering
  if (req.method === 'GET' && path.length === 2) {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams);
    
    let query = supabase
      .from('claims')
      .select(`
        id, title, description, amount, status, 
        created_at, updated_at, attachments
      `)
      .eq('user_id', userId);
    
    // Apply status filter if provided
    if (params.status) {
      query = query.eq('status', params.status);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      return errorResponse(error.message);
    }
    
    return jsonResponse(data);
  }
  
  // GET /api/claims/:id - Get claim details
  if (req.method === 'GET' && path.length === 3) {
    const claimId = path[2];
    
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      return errorResponse(error.message);
    }
    
    // Get associated receipts if claim has receipt attachments
    if (data.attachments && data.attachments.length > 0) {
      const receiptIds = data.attachments
        .filter(a => a.type === 'receipt')
        .map(a => a.receiptId);
      
      if (receiptIds.length > 0) {
        const { data: receipts } = await supabase
          .from('receipts')
          .select('id, merchant, date, total, currency, image_url')
          .in('id', receiptIds);
        
        data.receipts = receipts || [];
      }
    }
    
    return jsonResponse(data);
  }
  
  return errorResponse('Not found', 404);
}
````

## 4. Business Benefits

Creating this API offers several benefits:

1. **Accounting System Integration**: Enable direct export to accounting software like QuickBooks or Xero
2. **ERP Integration**: Connect with enterprise resource planning systems for expense management
3. **Custom Reporting**: Allow third-party tools to generate specialized reports
4. **Mobile App Ecosystem**: Enable development of companion mobile apps or integrations
5. **Workflow Automation**: Connect with tools like Zapier or Make for automated workflows

## 5. Security Considerations

Based on your codebase architecture:

1. **Row-Level Security**: Maintain RLS policies when exposing data
2. **API Rate Limiting**: Implement to prevent abuse
3. **Scoped Permissions**: Limit API keys to specific operations
4. **Audit Logging**: Track all API access for security monitoring
5. **Data Minimization**: Only expose necessary fields, not full database records

````sql path=supabase/migrations/20240615000000_create_api_keys_table.sql mode=EDIT
-- Create API keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own API keys
CREATE POLICY "Users can view their own API keys" 
ON public.api_keys FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Create policy for users to create their own API keys
CREATE POLICY "Users can create their own API keys" 
ON public.api_keys FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Create policy for users to delete their own API keys
CREATE POLICY "Users can delete their own API keys" 
ON public.api_keys FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Create API access log table for audit purposes
CREATE TABLE public.api_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);
````

This approach leverages your existing architecture while adding a secure API layer that respects your RLS policies and authentication model.
