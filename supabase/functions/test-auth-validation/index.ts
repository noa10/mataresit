/**
 * Test Authentication Validation Function
 * Simple edge function to test JWT token validation in isolation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders, addCorsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('🔍 Test Auth Validation: Starting authentication test');
    
    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('📝 Auth header present:', !!authHeader);
    console.log('📝 Auth header format:', authHeader ? `${authHeader.substring(0, 20)}...` : 'null');
    
    if (!authHeader) {
      const errorResponse = new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing Authorization header',
          step: 'header_check'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
      return addCorsHeaders(errorResponse);
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('📝 Environment variables check:');
    console.log('  - SUPABASE_URL:', !!supabaseUrl);
    console.log('  - SUPABASE_ANON_KEY:', !!supabaseAnonKey);
    console.log('  - SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorResponse = new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing Supabase environment variables',
          step: 'env_check',
          details: {
            hasUrl: !!supabaseUrl,
            hasAnonKey: !!supabaseAnonKey,
            hasServiceKey: !!supabaseServiceKey
          }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
      return addCorsHeaders(errorResponse);
    }

    // Test 1: Create Supabase client with anon key and user's JWT token (same as unified-search)
    console.log('🧪 Test 1: Creating Supabase client with anon key + user JWT');
    const supabaseWithUserToken = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    console.log('📝 Attempting to get user with JWT token...');
    const { data: { user }, error: userError } = await supabaseWithUserToken.auth.getUser();
    
    console.log('📝 User validation result:');
    console.log('  - Error:', userError ? userError.message : 'none');
    console.log('  - User ID:', user ? user.id : 'null');
    console.log('  - User email:', user ? user.email : 'null');

    // Test 2: Try with service role key for comparison
    console.log('🧪 Test 2: Creating Supabase client with service role key');
    const supabaseWithServiceKey = createClient(supabaseUrl, supabaseServiceKey);
    
    // Extract token from Bearer header for service role test
    const token = authHeader.replace('Bearer ', '');
    console.log('📝 Extracted token length:', token.length);
    
    const { data: { user: serviceUser }, error: serviceError } = await supabaseWithServiceKey.auth.getUser(token);
    
    console.log('📝 Service role validation result:');
    console.log('  - Error:', serviceError ? serviceError.message : 'none');
    console.log('  - User ID:', serviceUser ? serviceUser.id : 'null');
    console.log('  - User email:', serviceUser ? serviceUser.email : 'null');

    // Test 3: Try direct REST API call
    console.log('🧪 Test 3: Direct REST API call to /auth/v1/user');
    try {
      const restResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📝 REST API response status:', restResponse.status);
      
      if (restResponse.ok) {
        const restUser = await restResponse.json();
        console.log('📝 REST API user ID:', restUser.id);
        console.log('📝 REST API user email:', restUser.email);
      } else {
        const restError = await restResponse.text();
        console.log('📝 REST API error:', restError);
      }
    } catch (restError) {
      console.log('📝 REST API exception:', restError.message);
    }

    // Prepare response
    const response = {
      success: true,
      message: 'Authentication test completed',
      timestamp: new Date().toISOString(),
      tests: {
        anonKeyWithUserToken: {
          success: !userError && !!user,
          error: userError ? userError.message : null,
          userId: user ? user.id : null,
          userEmail: user ? user.email : null
        },
        serviceKeyWithToken: {
          success: !serviceError && !!serviceUser,
          error: serviceError ? serviceError.message : null,
          userId: serviceUser ? serviceUser.id : null,
          userEmail: serviceUser ? serviceUser.email : null
        }
      },
      environment: {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        hasServiceKey: !!supabaseServiceKey,
        url: supabaseUrl
      },
      authHeader: {
        present: !!authHeader,
        format: authHeader ? `${authHeader.substring(0, 20)}...` : null,
        tokenLength: token ? token.length : 0
      }
    };

    console.log('✅ Test completed successfully');

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });

  } catch (error) {
    console.error('❌ Test Auth Validation error:', error);
    
    const errorResponse = new Response(JSON.stringify({
      success: false,
      error: error.message,
      step: 'exception',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });
    
    return addCorsHeaders(errorResponse);
  }
});
