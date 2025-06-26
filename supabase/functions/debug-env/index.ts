/**
 * Debug Environment Variables Function
 * Helps understand what environment variables are available in Supabase Edge Functions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
      },
    });
  }

  try {
    // Get all environment variables
    const envVars: Record<string, string> = {};
    
    // Common Supabase environment variables to check
    const supabaseVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_JWT_SECRET',
      'SUPABASE_PROJECT_REF'
    ];
    
    // Check each variable
    for (const varName of supabaseVars) {
      const value = Deno.env.get(varName);
      if (value) {
        // Mask sensitive values
        if (varName.includes('KEY') || varName.includes('SECRET')) {
          envVars[varName] = `${value.substring(0, 20)}...${value.substring(value.length - 10)}`;
        } else {
          envVars[varName] = value;
        }
      } else {
        envVars[varName] = 'NOT_SET';
      }
    }
    
    // Get all environment variables (for debugging)
    const allEnvKeys = [];
    for (const key in Deno.env.toObject()) {
      allEnvKeys.push(key);
    }
    
    const response = {
      success: true,
      message: 'Environment variables debug info',
      timestamp: new Date().toISOString(),
      data: {
        supabaseVars: envVars,
        allEnvKeys: allEnvKeys.sort(),
        totalEnvVars: allEnvKeys.length
      }
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in debug-env function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
