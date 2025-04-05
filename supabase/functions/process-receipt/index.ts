/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { TextractClient, AnalyzeExpenseCommand } from 'npm:@aws-sdk/client-textract'
import { ProcessingLogger } from './shared/db-logger.ts'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Configure AWS Textract client
const textractClient = new TextractClient({
  region: Deno.env.get('AWS_REGION') || 'us-east-1',
  credentials: {
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') || '',
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') || '',
  },
})

// Main function to process receipt image and extract data
async function processReceiptImage(imageBytes: Uint8Array, imageUrl: string, receiptId: string) {
  const logger = new ProcessingLogger(receiptId);
  
  try {
    await logger.log("Starting OCR processing with Amazon Textract", "OCR");
    console.log("Calling Amazon Textract for OCR processing...");
    
    // Call Amazon Textract to analyze the expense document (receipt/invoice)
    const command = new AnalyzeExpenseCommand({
      Document: { Bytes: imageBytes },
    })
    
    const response = await textractClient.send(command)
    console.log("Received response from Amazon Textract");
    await logger.log("Amazon Textract analysis complete", "OCR");
    
    // Extract structured data from the Textract response
    const result = {
      merchant: '',
      date: '',
      total: 0,
      tax: 0,
      payment_method: '',
      currency: 'MYR', // Default to MYR instead of USD
      line_items: [] as { description: string; amount: number }[],
      fullText: '',
      confidence: {
        merchant: 0,
        date: 0,
        total: 0,
        tax: 0,
        payment_method: 0,
        line_items: 0,
      },
    };
    
    // Process the structured data from ExpenseDocuments
    if (response.ExpenseDocuments && response.ExpenseDocuments.length > 0) {
      const expenseDoc = response.ExpenseDocuments[0];
      
      // Extract full text for backup processing
      let fullText = '';
      
      // Process summary fields
      if (expenseDoc.SummaryFields) {
        for (const field of expenseDoc.SummaryFields) {
          if (field.Type?.Text && field.ValueDetection?.Text) {
            const fieldType = field.Type.Text;
            const fieldValue = field.ValueDetection.Text;
            // Convert confidence from decimal (0-1) to percentage (0-100)
            const confidence = field.ValueDetection.Confidence ? Math.round(field.ValueDetection.Confidence) : 0;
            
            // Add to full text
            fullText += `${field.LabelDetection?.Text || field.Type.Text}: ${fieldValue}\n`;
            
            // Map Textract fields to our data structure
            switch (fieldType) {
              case 'VENDOR_NAME':
                result.merchant = fieldValue;
                result.confidence.merchant = confidence;
                break;
              case 'INVOICE_RECEIPT_DATE':
                result.date = fieldValue;
                result.confidence.date = confidence;
                break;
              case 'TOTAL':
                // Remove currency symbols and convert to number
                result.total = parseFloat(fieldValue.replace(/[$€£RM]/g, ''));
                result.confidence.total = confidence;
                break;
              case 'TAX':
                result.tax = parseFloat(fieldValue.replace(/[$€£RM]/g, ''));
                result.confidence.tax = confidence;
                break;
              case 'PAYMENT_TERMS':
                result.payment_method = fieldValue;
                result.confidence.payment_method = confidence;
                break;
            }
          }
        }
      }
      
      // Process line items
      if (expenseDoc.LineItemGroups) {
        for (const group of expenseDoc.LineItemGroups) {
          if (group.LineItems) {
            for (const lineItem of group.LineItems) {
              let description = '';
              let amount = 0;
              
              // Extract expense line items
              if (lineItem.LineItemExpenseFields) {
                for (const field of lineItem.LineItemExpenseFields) {
                  if (field.Type?.Text === 'ITEM' && field.ValueDetection?.Text) {
                    description = field.ValueDetection.Text;
                  } else if (field.Type?.Text === 'PRICE' && field.ValueDetection?.Text) {
                    amount = parseFloat(field.ValueDetection.Text.replace(/[$€£RM]/g, ''));
                  }
                }
                
                if (description && amount > 0) {
                  result.line_items.push({ description, amount });
                }
              }
            }
          }
        }
        
        // Set confidence for line items
        if (result.line_items.length > 0) {
          result.confidence.line_items = 90; // High confidence if line items were detected
        }
      }
      
      result.fullText = fullText;
    }
    
    await logger.log(`Extracted data: Merchant=${result.merchant}, Total=${result.total}, Items=${result.line_items.length}`, "EXTRACT");
    
    // NEW: Call Gemini AI to enhance the data
    try {
      await logger.log("Starting Gemini AI enhancement", "GEMINI");
      console.log("Calling Gemini AI to enhance receipt data...");
      
      // Call the enhance-receipt-data function
      const enhanceResponse = await fetch(
        "http://localhost:54321/functions/v1/enhance-receipt-data",
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            textractData: result,
            fullText: result.fullText,
            receiptId: receiptId
          }),
        }
      );
      
      if (enhanceResponse.ok) {
        const enhancedData = await enhanceResponse.json();
        console.log("Received enhanced data from Gemini:", enhancedData);
        await logger.log("Gemini AI enhancement complete", "GEMINI");
        
        // Merge enhanced data with Textract data if enhancement was successful
        if (enhancedData.success && enhancedData.result) {
          // Currency enhancement
          if (enhancedData.result.currency) {
            result.currency = enhancedData.result.currency;
            await logger.log(`Currency detected: ${enhancedData.result.currency}`, "GEMINI");
          }
          
          // Payment method enhancement
          if (enhancedData.result.payment_method) {
            result.payment_method = enhancedData.result.payment_method;
            await logger.log(`Payment method detected: ${enhancedData.result.payment_method}`, "GEMINI");
            
            // Update confidence score for payment method
            if (enhancedData.result.confidence?.payment_method) {
              result.confidence.payment_method = enhancedData.result.confidence.payment_method;
            } else {
              result.confidence.payment_method = 85; // Default high confidence for Gemini results
            }
          }
          
          // Other field enhancements if provided by Gemini
          if (enhancedData.result.merchant && (!result.merchant || enhancedData.result.confidence?.merchant > result.confidence.merchant)) {
            result.merchant = enhancedData.result.merchant;
            await logger.log(`Merchant enhanced to: ${enhancedData.result.merchant}`, "GEMINI");
            if (enhancedData.result.confidence?.merchant) {
              result.confidence.merchant = enhancedData.result.confidence.merchant;
            }
          }
          
          if (enhancedData.result.total && (!result.total || enhancedData.result.confidence?.total > result.confidence.total)) {
            result.total = enhancedData.result.total;
            await logger.log(`Total enhanced to: ${enhancedData.result.total}`, "GEMINI");
            if (enhancedData.result.confidence?.total) {
              result.confidence.total = enhancedData.result.confidence.total;
            }
          }
        }
      } else {
        console.error("Error calling Gemini enhancement:", await enhanceResponse.text());
        await logger.log("Gemini AI enhancement failed", "GEMINI");
        // Continue with Textract data only
      }
    } catch (enhanceError) {
      console.error("Error during Gemini enhancement:", enhanceError);
      await logger.log(`Gemini AI error: ${enhanceError.message}`, "ERROR");
      // Continue with Textract data only
    }
    
    await logger.log("Processing complete", "COMPLETE");
    return result;
  } catch (error) {
    console.error('Error processing receipt with Textract:', error);
    await logger.log(`Error processing receipt: ${error.message}`, "ERROR");
    throw new Error(`Failed to process receipt image: ${error.message}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  try {
    console.log("Received request to process receipt");
    
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    const requestData = await req.json();
    console.log("Request data received:", JSON.stringify(requestData).substring(0, 200) + "...");
    
    // Extract and validate required parameters
    const { imageUrl, receiptId } = requestData;
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: imageUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!receiptId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: receiptId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create a logger for this process
    const logger = new ProcessingLogger(
      receiptId, 
      Deno.env.get('SUPABASE_URL') || '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );
    
    await logger.initialize();
    await logger.log("Starting receipt processing", "START");
    
    await logger.log("Fetching receipt data", "FETCH");
    console.log("Fetching image from URL:", imageUrl);
    await logger.log("Fetching receipt image", "FETCH");
    
    // Format URL properly to ensure it's accessible
    const urlObj = new URL(imageUrl);
    
    // Fetch the image from the provided URL
    try {
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        console.error("Failed to fetch image:", imageResponse.status, imageResponse.statusText);
        await logger.log(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`, "ERROR");
        
        return new Response(
          JSON.stringify({ 
            error: `Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`,
            success: false
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Convert image to binary data
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      const imageBytes = new Uint8Array(imageArrayBuffer);
      console.log(`Image fetched successfully, size: ${imageBytes.length} bytes`);
      await logger.log(`Image fetched successfully, size: ${imageBytes.length} bytes`, "FETCH");
      
      // Process the receipt image with OCR
      const extractedData = await processReceiptImage(imageBytes, imageUrl, receiptId);
      console.log("Data extraction complete");
      
      await logger.log("Extracting receipt data", "EXTRACT");
      await logger.log(`Extracted data: Merchant=${extractedData.merchant}, Total=${extractedData.total}, Items=${extractedData.line_items.length}`, "EXTRACT");
      
      await logger.log("Saving processing results", "SAVE");
      
      // Return the extracted data
      await logger.log("Receipt processing completed", "COMPLETE");
      return new Response(
        JSON.stringify({
          success: true,
          receiptId,
          result: extractedData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      console.error("Error fetching image:", fetchError);
      await logger.log(`Error fetching image: ${fetchError.message}`, "ERROR");
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch image: ${fetchError.message}`,
          success: false 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in process-receipt function:', error);
    
    // Try to log the error if possible
    try {
      const { receiptId } = await req.json();
      if (receiptId) {
        const logger = new ProcessingLogger(receiptId);
        await logger.log(`Server error: ${error.message}`, "ERROR");
      }
    } catch (logError) {
      // Ignore errors during error logging
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
