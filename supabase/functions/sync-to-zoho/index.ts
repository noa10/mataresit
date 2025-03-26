
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to refresh the Zoho access token if needed
async function ensureValidAccessToken(supabase, userId) {
  // Get the stored tokens for the user
  const { data: credentials, error } = await supabase
    .from('zoho_credentials')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error || !credentials) {
    throw new Error('User has not connected to Zoho')
  }
  
  // Check if the token is expired or about to expire (within 5 minutes)
  const isExpired = new Date(credentials.expires_at) <= new Date(Date.now() + 5 * 60 * 1000)
  
  if (!isExpired) {
    // Token is still valid
    return credentials.access_token
  }
  
  // Need to refresh the token
  const clientId = Deno.env.get('ZOHO_CLIENT_ID')
  const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET')
  
  const refreshResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refresh_token,
    }),
  })
  
  if (!refreshResponse.ok) {
    throw new Error('Failed to refresh access token')
  }
  
  const tokens = await refreshResponse.json()
  
  // Update the stored token
  await supabase
    .from('zoho_credentials')
    .update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  
  return tokens.access_token
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Parse request body
    const requestData = await req.json()
    
    // Extract and validate required parameters
    const { receiptId, userId } = requestData
    
    if (!receiptId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Retrieve the receipt data
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*, line_items(*)')
      .eq('id', receiptId)
      .eq('user_id', userId)
      .single()
    
    if (receiptError || !receipt) {
      console.error('Error fetching receipt:', receiptError)
      return new Response(
        JSON.stringify({ error: 'Receipt not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Ensure valid Zoho access token
    let accessToken
    try {
      accessToken = await ensureValidAccessToken(supabase, userId)
    } catch (error) {
      console.error('Error with Zoho authentication:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Format date for Zoho (YYYY-MM-DD)
    const receiptDate = new Date(receipt.date).toISOString().split('T')[0]
    
    // Prepare expense data for Zoho
    const expenseData = {
      description: `Receipt from ${receipt.merchant}`,
      amount: receipt.total,
      currency_id: receipt.currency || 'USD',
      expense_date: receiptDate,
      merchant: receipt.merchant,
      tax_amount: receipt.tax || 0,
      is_billable: true,
      payment_mode: receipt.payment_method || 'Cash',
    }
    
    // Send the expense to Zoho
    const zohoResponse = await fetch('https://expense.zoho.com/api/v1/expenses', {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expenseData),
    })
    
    if (!zohoResponse.ok) {
      const errorText = await zohoResponse.text()
      console.error('Error creating Zoho expense:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create expense in Zoho' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const zohoData = await zohoResponse.json()
    
    // Upload the receipt image to Zoho if available
    if (receipt.image_url) {
      try {
        // Fetch the image from Supabase Storage
        const imageResponse = await fetch(receipt.image_url)
        if (imageResponse.ok) {
          const imageArrayBuffer = await imageResponse.arrayBuffer()
          
          // Upload to Zoho
          const expenseId = zohoData.expense_id
          const formData = new FormData()
          formData.append('receipt', new Blob([imageArrayBuffer]), 'receipt.jpg')
          
          const uploadResponse = await fetch(`https://expense.zoho.com/api/v1/expenses/${expenseId}/receipts`, {
            method: 'POST',
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
            },
            body: formData,
          })
          
          if (!uploadResponse.ok) {
            console.error('Error uploading receipt to Zoho:', await uploadResponse.text())
          }
        }
      } catch (uploadError) {
        console.error('Error uploading receipt image to Zoho:', uploadError)
        // Continue execution, as this is not a critical error
      }
    }
    
    // Update the receipt status in our database
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        status: 'synced',
        updated_at: new Date().toISOString(),
      })
      .eq('id', receiptId)
    
    if (updateError) {
      console.error('Error updating receipt status:', updateError)
    }
    
    // Return success response with Zoho expense ID
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Receipt successfully synced to Zoho',
        data: {
          expense_id: zohoData.expense_id,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in sync-to-zoho function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
