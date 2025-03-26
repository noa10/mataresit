
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // Get Zoho credentials from environment variables
    const clientId = Deno.env.get('ZOHO_CLIENT_ID')
    const redirectUri = Deno.env.get('ZOHO_REDIRECT_URI')
    
    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'Zoho API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Parse the request URL to get the user ID (from the query parameter)
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Generate a random state value for CSRF protection
    const state = crypto.randomUUID()
    
    // Store the state and user ID in Supabase temporarily
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { error: stateError } = await supabase
      .from('zoho_auth_states')
      .insert({
        state,
        user_id: userId,
        created_at: new Date().toISOString(),
      })
    
    if (stateError) {
      console.error('Error storing auth state:', stateError)
      return new Response(
        JSON.stringify({ error: 'Failed to initialize OAuth flow' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Construct the Zoho OAuth URL
    const scope = encodeURIComponent('ZohoExpense.fullaccess.all')
    const authUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
    
    // Return the authorization URL
    return new Response(
      JSON.stringify({
        success: true,
        authUrl,
        state,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in zoho-connect function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
