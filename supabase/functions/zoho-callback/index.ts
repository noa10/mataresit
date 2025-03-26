
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
    // Parse the request URL to get the authorization code and state
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    
    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get Zoho credentials from environment variables
    const clientId = Deno.env.get('ZOHO_CLIENT_ID')
    const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET')
    const redirectUri = Deno.env.get('ZOHO_REDIRECT_URI')
    
    if (!clientId || !clientSecret || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'Zoho API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Verify the state parameter to prevent CSRF attacks
    const { data: stateData, error: stateError } = await supabase
      .from('zoho_auth_states')
      .select('user_id')
      .eq('state', state)
      .single()
    
    if (stateError || !stateData) {
      console.error('Error verifying state:', stateError)
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const userId = stateData.user_id
    
    // Exchange the authorization code for tokens
    const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    })
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Error exchanging code for tokens:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code for tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const tokens = await tokenResponse.json()
    
    // Store the tokens in Supabase
    const { error: tokenError } = await supabase
      .from('zoho_credentials')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    
    if (tokenError) {
      console.error('Error storing tokens:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Failed to store OAuth tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Clean up the state entry
    await supabase
      .from('zoho_auth_states')
      .delete()
      .eq('state', state)
    
    // Construct a success response with a redirect URL
    const frontendUrl = Deno.env.get('FRONTEND_URL') || ''
    const redirectUrl = `${frontendUrl}/dashboard?zoho_connected=true`
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Zoho successfully connected',
        redirectUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in zoho-callback function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
