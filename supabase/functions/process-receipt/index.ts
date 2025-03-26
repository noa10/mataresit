
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { TextractClient, AnalyzeDocumentCommand } from 'npm:@aws-sdk/client-textract'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configure AWS Textract client
const textractClient = new TextractClient({
  region: Deno.env.get('AWS_REGION') || 'us-east-1',
  credentials: {
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') || '',
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') || '',
  },
})

// Helper to extract date from OCR text
function extractDate(text: string): { value: string; confidence: number } {
  // Common date formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
  const dateRegexes = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
  ]
  
  for (const regex of dateRegexes) {
    const match = text.match(regex)
    if (match) {
      // Basic validation would go here
      return { value: match[0], confidence: 85 }
    }
  }
  
  return { value: '', confidence: 0 }
}

// Helper to extract total amount from OCR text
function extractTotal(text: string): { value: number; confidence: number } {
  // Look for common patterns like "Total: $123.45"
  const totalRegexes = [
    /total[^0-9$€£]*[$€£]?\s*(\d+[.,]\d{2})/i,
    /sum[^0-9$€£]*[$€£]?\s*(\d+[.,]\d{2})/i,
    /amount[^0-9$€£]*[$€£]?\s*(\d+[.,]\d{2})/i,
    /[$€£]\s*(\d+[.,]\d{2})/i,
  ]
  
  for (const regex of totalRegexes) {
    const match = text.match(regex)
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'))
      return { value: amount, confidence: 80 }
    }
  }
  
  return { value: 0, confidence: 0 }
}

// Helper to extract merchant name from OCR text
function extractMerchant(text: string): { value: string; confidence: number } {
  // Usually the merchant name is at the top of the receipt
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  
  if (lines.length > 0) {
    // Take the first non-empty line as the merchant name
    return { value: lines[0].trim(), confidence: 70 }
  }
  
  return { value: '', confidence: 0 }
}

// Helper to extract tax amount from OCR text
function extractTax(text: string): { value: number; confidence: number } {
  // Look for common patterns like "Tax: $12.34" or "VAT: $12.34"
  const taxRegexes = [
    /tax[^0-9$€£]*[$€£]?\s*(\d+[.,]\d{2})/i,
    /vat[^0-9$€£]*[$€£]?\s*(\d+[.,]\d{2})/i,
    /gst[^0-9$€£]*[$€£]?\s*(\d+[.,]\d{2})/i,
  ]
  
  for (const regex of taxRegexes) {
    const match = text.match(regex)
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'))
      return { value: amount, confidence: 75 }
    }
  }
  
  return { value: 0, confidence: 0 }
}

// Helper to extract line items from OCR text
function extractLineItems(text: string): { items: { description: string; amount: number }[]; confidence: number } {
  const lines = text.split('\n')
  const items: { description: string; amount: number }[] = []
  let confidence = 0
  
  // Simple regex to find lines with a product and price
  const itemRegex = /(.+?)[$€£]?\s*(\d+[.,]\d{2})\s*$/
  
  for (const line of lines) {
    const match = line.match(itemRegex)
    if (match) {
      const description = match[1].trim()
      const amount = parseFloat(match[2].replace(',', '.'))
      
      // Basic validation to filter out invalid items
      if (description.length > 2 && amount > 0) {
        items.push({ description, amount })
      }
    }
  }
  
  // Assign confidence based on number of items found
  if (items.length > 0) {
    confidence = 65
  }
  
  return { items, confidence }
}

// Main function to process receipt image and extract data
async function processReceiptImage(imageBytes: Uint8Array) {
  try {
    // Call Amazon Textract to analyze the document
    const command = new AnalyzeDocumentCommand({
      Document: { Bytes: imageBytes },
      FeatureTypes: ['FORMS', 'TABLES'],
    })
    
    const response = await textractClient.send(command)
    
    // Extract the full text from Textract response
    let fullText = ''
    if (response.Blocks) {
      for (const block of response.Blocks) {
        if (block.BlockType === 'LINE' && block.Text) {
          fullText += block.Text + '\n'
        }
      }
    }
    
    // Extract key fields from the text
    const merchant = extractMerchant(fullText)
    const date = extractDate(fullText)
    const total = extractTotal(fullText)
    const tax = extractTax(fullText)
    const lineItems = extractLineItems(fullText)
    
    // Return the extracted data with confidence scores
    return {
      merchant: {
        value: merchant.value,
        confidence: merchant.confidence,
      },
      date: {
        value: date.value,
        confidence: date.confidence,
      },
      total: {
        value: total.value,
        confidence: total.confidence,
      },
      tax: {
        value: tax.value,
        confidence: tax.confidence,
      },
      lineItems: {
        items: lineItems.items,
        confidence: lineItems.confidence,
      },
      fullText,
    }
  } catch (error) {
    console.error('Error processing receipt with Textract:', error)
    throw new Error('Failed to process receipt image')
  }
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
    const { imageUrl, receiptId } = requestData
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: imageUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!receiptId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: receiptId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Fetch the image from the provided URL
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch image from URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Convert image to binary data
    const imageArrayBuffer = await imageResponse.arrayBuffer()
    const imageBytes = new Uint8Array(imageArrayBuffer)
    
    // Process the receipt image with OCR
    const extractedData = await processReceiptImage(imageBytes)
    
    // Return the extracted data
    return new Response(
      JSON.stringify({
        success: true,
        receiptId,
        data: extractedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in process-receipt function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
