/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { TextractClient, AnalyzeExpenseCommand } from 'npm:@aws-sdk/client-textract'
import { ProcessingLogger } from './shared/db-logger.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
async function processReceiptImage(
  imageBytes: Uint8Array, 
  imageUrl: string, 
  receiptId: string,
  primaryMethod: 'ocr-ai' | 'ai-vision' = 'ocr-ai',
  modelId: string = '',
  compareWithAlternative: boolean = false
) {
  const logger = new ProcessingLogger(receiptId);
  const startTime = performance.now(); // Record start time
  let processingTime = 0;
  
  try {
    // Initialize results for primary and alternative methods
    let primaryResult: any = null;
    let alternativeResult: any = null;
    let discrepancies: any[] = [];
    let modelUsed = '';
    
    // Process with primary method
    if (primaryMethod === 'ocr-ai') {
      // OCR + AI method
      await logger.log("Using OCR + AI as primary method", "METHOD");
      
      // Step 1: Perform OCR with Amazon Textract
    await logger.log("Starting OCR processing with Amazon Textract", "OCR");
    console.log("Calling Amazon Textract for OCR processing...");
    
    // Call Amazon Textract to analyze the expense document (receipt/invoice)
    const command = new AnalyzeExpenseCommand({
      Document: { Bytes: imageBytes },
      });
    
      const response = await textractClient.send(command);
    console.log("Received response from Amazon Textract");
    await logger.log("Amazon Textract analysis complete", "OCR");
    
      // Step 2: Extract structured data from Textract response
      const textractResult = extractTextractData(response, logger);
      
      // Step 3: Enhance with selected AI model
      await logger.log("Starting AI enhancement of OCR data", "AI");
      console.log("Calling AI to enhance OCR data...");
      
      try {
        const enhanceResponse = await fetch(
          "http://localhost:54321/functions/v1/enhance-receipt-data",
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              textractData: textractResult,
              fullText: textractResult.fullText,
              receiptId: receiptId,
              modelId: modelId
            }),
          }
        );
        
        if (enhanceResponse.ok) {
          const enhancedData = await enhanceResponse.json();
          console.log("Received enhanced data from AI:", enhancedData);
          await logger.log("AI enhancement complete", "AI");
          
          // Update results with AI enhanced data
          primaryResult = mergeTextractAndAIData(textractResult, enhancedData.result);
          modelUsed = enhancedData.model_used;
        } else {
          console.error("Error calling AI enhancement:", await enhanceResponse.text());
          await logger.log("AI enhancement failed", "AI");
          // Continue with Textract data only
          primaryResult = textractResult;
        }
      } catch (enhanceError) {
        console.error("Error during AI enhancement:", enhanceError);
        await logger.log(`AI error: ${enhanceError.message}`, "ERROR");
        // Continue with Textract data only
        primaryResult = textractResult;
      }
    } else {
      // AI Vision method - send image directly to AI
      await logger.log("Using AI Vision as primary method", "METHOD");
      console.log("Calling AI Vision for direct image processing...");
      
      try {
        const visionResponse = await fetch(
          "http://localhost:54321/functions/v1/enhance-receipt-data",
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageData: {
                data: Array.from(imageBytes),
                mimeType: 'image/jpeg' // Assuming JPEG format, could be determined from the URL
              },
              receiptId: receiptId,
              modelId: modelId
            }),
          }
        );
        
        if (visionResponse.ok) {
          const visionData = await visionResponse.json();
          console.log("Received data from AI Vision:", visionData);
          await logger.log("AI Vision processing complete", "AI");
          
          primaryResult = formatAIVisionResult(visionData.result);
          modelUsed = visionData.model_used;
        } else {
          console.error("Error calling AI Vision:", await visionResponse.text());
          await logger.log("AI Vision processing failed", "AI");
          throw new Error("AI Vision processing failed");
        }
      } catch (visionError) {
        console.error("Error during AI Vision processing:", visionError);
        await logger.log(`AI Vision error: ${visionError.message}`, "ERROR");
        throw visionError; // Rethrow since we don't have a fallback
      }
    }
    
    // If comparison is requested, process with alternative method
    if (compareWithAlternative) {
      await logger.log("Starting comparison with alternative method", "COMPARE");
      
      if (primaryMethod === 'ocr-ai') {
        // Primary was OCR+AI, alternative is AI Vision
        await logger.log("Using AI Vision as alternative method", "METHOD");
        
        try {
          const visionResponse = await fetch(
            "http://localhost:54321/functions/v1/enhance-receipt-data",
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                imageData: {
                  data: Array.from(imageBytes),
                  mimeType: 'image/jpeg'
                },
                receiptId: `${receiptId}-alt`, // Use different ID for logging
                modelId: '' // Use default vision model
              }),
            }
          );
          
          if (visionResponse.ok) {
            const visionData = await visionResponse.json();
            console.log("Received data from alternative AI Vision:", visionData);
            await logger.log("Alternative AI Vision processing complete", "AI");
            
            alternativeResult = formatAIVisionResult(visionData.result);
          }
        } catch (altError) {
          console.error("Error during alternative method:", altError);
          await logger.log(`Alternative method error: ${altError.message}`, "ERROR");
        }
      } else {
        // Primary was AI Vision, alternative is OCR+AI
        await logger.log("Using OCR + AI as alternative method", "METHOD");
        
        try {
          // Step 1: Perform OCR with Amazon Textract
          const command = new AnalyzeExpenseCommand({
            Document: { Bytes: imageBytes },
          });
          
          const response = await textractClient.send(command);
          
          // Step 2: Extract structured data from Textract response
          const textractResult = extractTextractData(response, logger);
          
          // Step 3: Enhance with default text model
          const enhanceResponse = await fetch(
            "http://localhost:54321/functions/v1/enhance-receipt-data",
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                textractData: textractResult,
                fullText: textractResult.fullText,
                receiptId: `${receiptId}-alt`, // Use different ID for logging
                modelId: '' // Use default text model
              }),
            }
          );
          
          if (enhanceResponse.ok) {
            const enhancedData = await enhanceResponse.json();
            await logger.log("Alternative OCR + AI processing complete", "AI");
            
            alternativeResult = mergeTextractAndAIData(textractResult, enhancedData.result);
          }
        } catch (altError) {
          console.error("Error during alternative method:", altError);
          await logger.log(`Alternative method error: ${altError.message}`, "ERROR");
        }
      }
      
      // Compare results and identify discrepancies if alternative method was successful
      if (alternativeResult) {
        discrepancies = findDiscrepancies(primaryResult, alternativeResult);
        await logger.log(`Found ${discrepancies.length} discrepancies between methods`, "COMPARE");
      }
    }
    
    const endTime = performance.now(); // Record end time
    processingTime = (endTime - startTime) / 1000; // Calculate duration in seconds
    
    await logger.log(`Processing complete in ${processingTime.toFixed(2)} seconds`, "COMPLETE");
    
    // Include processing time and comparison results in the result
    return { 
      ...primaryResult, 
      processing_time: processingTime,
      alternativeResult: alternativeResult,
      discrepancies: discrepancies,
      modelUsed: modelUsed,
      primaryMethod: primaryMethod
    };
  } catch (error) {
    console.error('Error processing receipt:', error);
    await logger.log(`Error processing receipt: ${error.message}`, "ERROR");
    throw new Error(`Failed to process receipt image: ${error.message}`);
  }
}

// Helper function to extract structured data from Textract response
function extractTextractData(response: any, logger: ProcessingLogger) {
  // Initialize the result structure
    const result = {
      merchant: '',
      date: '',
      total: 0,
      tax: 0,
      payment_method: '',
      currency: 'MYR', // Default to MYR instead of USD
      line_items: [] as { description: string; amount: number }[],
      fullText: '',
      predicted_category: '',
      ai_suggestions: {} as Record<string, any>,
      confidence: {
        merchant: 50, // Default to medium confidence instead of 0
        date: 50,     // Default to medium confidence instead of 0
        total: 50,     // Default to medium confidence instead of 0
        tax: 50,       // Default to medium confidence instead of 0
        payment_method: 50, // Default to medium confidence instead of 0
        line_items: 50,    // Default to medium confidence instead of 0
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
                // Adjust confidence based on field value quality
                result.confidence.merchant = calculateFieldConfidence(confidence, fieldValue, 'merchant');
                break;
              case 'INVOICE_RECEIPT_DATE':
                // Normalize date format - convert to YYYY-MM-DD
                let normalizedDate = fieldValue;
                
                // Try to parse different date formats
                // Check for DD-MM-YYYY format (e.g., 19-03-2025)
                const ddmmyyyyRegex = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
                const ddmmyyyyMatch = fieldValue.match(ddmmyyyyRegex);
                
                if (ddmmyyyyMatch) {
                  // Convert DD-MM-YYYY to YYYY-MM-DD
                  const day = ddmmyyyyMatch[1].padStart(2, '0');
                  const month = ddmmyyyyMatch[2].padStart(2, '0');
                  const year = ddmmyyyyMatch[3];
                  normalizedDate = `${year}-${month}-${day}`;
                  console.log(`Normalized date from ${fieldValue} to ${normalizedDate}`);
                } else {
                  // Try other formats - MM-DD-YYYY or MM/DD/YYYY
                  const mmddyyyyRegex = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
                  const mmddyyyyMatch = fieldValue.match(mmddyyyyRegex);
                  
                  if (mmddyyyyMatch) {
                    // For US format, assume it's MM-DD-YYYY
                    // Convert to YYYY-MM-DD
                    const month = mmddyyyyMatch[1].padStart(2, '0');
                    const day = mmddyyyyMatch[2].padStart(2, '0');
                    const year = mmddyyyyMatch[3];
                    
                    // Validate month/day values to avoid invalid dates
                    if (parseInt(month) <= 12 && parseInt(day) <= 31) {
                      normalizedDate = `${year}-${month}-${day}`;
                      console.log(`Normalized date from ${fieldValue} to ${normalizedDate}`);
                    }
                  }
                }
                
                // If already in YYYY-MM-DD format, keep as is
                const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!isoRegex.test(normalizedDate)) {
                  // As a fallback, try Date object parsing as a last resort
                  try {
                    const dateObj = new Date(fieldValue);
                    if (!isNaN(dateObj.getTime())) {
                      normalizedDate = dateObj.toISOString().split('T')[0];
                      console.log(`Date fallback parsing: ${fieldValue} -> ${normalizedDate}`);
                    }
                  } catch (e) {
                    console.error(`Failed to parse date: ${fieldValue}`, e);
                  }
                }
                
                // Save normalized date to result
                result.date = normalizedDate;
                
                // Adjust confidence based on date validation success
                const dateFormatConfidence = normalizedDate !== fieldValue ? 90 : confidence;
                result.confidence.date = calculateFieldConfidence(dateFormatConfidence, normalizedDate, 'date');
                break;
              case 'TOTAL':
                // Remove currency symbols and convert to number
                result.total = parseFloat(fieldValue.replace(/[$€£RM]/g, ''));
                // Adjust confidence based on parsed value
                result.confidence.total = calculateFieldConfidence(confidence, result.total.toString(), 'total');
                break;
              case 'TAX':
                result.tax = parseFloat(fieldValue.replace(/[$€£RM]/g, ''));
                result.confidence.tax = calculateFieldConfidence(confidence, result.tax.toString(), 'tax');
                break;
              case 'PAYMENT_TERMS':
                result.payment_method = fieldValue;
                result.confidence.payment_method = calculateFieldConfidence(confidence, fieldValue, 'payment_method');
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
          // Calculate confidence based on number of items detected
          const count = result.line_items.length;
          // More items = higher confidence in overall structure detection
          const lineItemConfidence = Math.min(75 + (count * 5), 95); 
          result.confidence.line_items = lineItemConfidence;
        }
      }
      
      result.fullText = fullText;
    }
    
  return result;
}

// Merge Textract and AI enhanced data
function mergeTextractAndAIData(textractData: any, enhancedData: any) {
  const result = { ...textractData };
  
          // Currency enhancement
  if (enhancedData.currency) {
    result.currency = enhancedData.currency;
          }
          
          // Payment method enhancement
  if (enhancedData.payment_method) {
    result.payment_method = enhancedData.payment_method;
            
            // Update confidence score for payment method
    if (enhancedData.confidence?.payment_method) {
      result.confidence.payment_method = enhancedData.confidence.payment_method;
            } else {
      result.confidence.payment_method = 85; // Default high confidence for AI results
            }
          }
          
          // Category prediction
  if (enhancedData.predicted_category) {
    result.predicted_category = enhancedData.predicted_category;
          }
          
          // AI Suggestions
  if (enhancedData.suggestions) {
    result.ai_suggestions = enhancedData.suggestions;
  }
  
  // Other field enhancements if provided by AI
  if (enhancedData.merchant && (!result.merchant || enhancedData.confidence?.merchant > result.confidence.merchant)) {
    result.merchant = enhancedData.merchant;
    if (enhancedData.confidence?.merchant) {
      result.confidence.merchant = enhancedData.confidence.merchant;
    }
  }
  
  if (enhancedData.total && (!result.total || enhancedData.confidence?.total > result.confidence.total)) {
    result.total = enhancedData.total;
    if (enhancedData.confidence?.total) {
      result.confidence.total = enhancedData.confidence.total;
    }
  }
  
  return result;
}

// Format the AI Vision result to match our expected structure
function formatAIVisionResult(visionData: any) {
  const result = {
    merchant: visionData.merchant || '',
    date: visionData.date || '',
    total: parseFloat(visionData.total) || 0,
    tax: parseFloat(visionData.tax) || 0,
    payment_method: visionData.payment_method || '',
    currency: visionData.currency || 'MYR',
    line_items: [] as { description: string; amount: number }[],
    fullText: '', // Vision doesn't have full text
    predicted_category: visionData.predicted_category || '',
    ai_suggestions: {},
    confidence: {
      merchant: visionData.confidence?.merchant || 75,
      date: visionData.confidence?.date || 75,
      total: visionData.confidence?.total || 75,
      tax: visionData.confidence?.tax || 75,
      payment_method: visionData.confidence?.payment_method || 75,
      line_items: visionData.confidence?.line_items || 75,
    },
  };
  
  // Convert line items format if present
  if (visionData.line_items && Array.isArray(visionData.line_items)) {
    result.line_items = visionData.line_items.map((item: any) => ({
      description: item.description || '',
      amount: parseFloat(item.amount) || 0
    }));
  }
  
  return result;
}

// Find discrepancies between primary and alternative results
function findDiscrepancies(primaryResult: any, alternativeResult: any) {
  const discrepancies: any[] = [];
  
  // Compare key fields
  const fieldsToCompare = [
    'merchant', 
    'date', 
    'total', 
    'tax', 
    'currency', 
    'payment_method', 
    'predicted_category'
  ];
  
  for (const field of fieldsToCompare) {
    // Skip if either value is missing
    if (!primaryResult[field] && !alternativeResult[field]) continue;
    
    // For numeric fields, compare with tolerance
    if (field === 'total' || field === 'tax') {
      const numPrimary = parseFloat(primaryResult[field]) || 0;
      const numAlternative = parseFloat(alternativeResult[field]) || 0;
      const diff = Math.abs(numPrimary - numAlternative);
      
      // If difference is more than 1% of the larger value and more than 0.1
      const tolerance = Math.max(Math.max(numPrimary, numAlternative) * 0.01, 0.1);
      if (diff > tolerance) {
        discrepancies.push({
          field,
          primaryValue: numPrimary,
          alternativeValue: numAlternative
        });
      }
    } 
    // String comparison for other fields
    else if (primaryResult[field]?.toString() !== alternativeResult[field]?.toString()) {
      discrepancies.push({
        field,
        primaryValue: primaryResult[field],
        alternativeValue: alternativeResult[field]
      });
    }
  }
  
  // Compare line items count as a basic check
  if (primaryResult.line_items?.length !== alternativeResult.line_items?.length) {
    discrepancies.push({
      field: 'line_items_count',
      primaryValue: primaryResult.line_items?.length || 0,
      alternativeValue: alternativeResult.line_items?.length || 0
    });
  }
  
  return discrepancies;
}

// Add this helper function below the processReceiptImage function
// Helper function to calculate more meaningful confidence scores
function calculateFieldConfidence(baseConfidence: number, value: string, fieldType: string): number {
  // Start with the base confidence from OCR
  let adjustedConfidence = baseConfidence || 50;
  
  // Don't allow very low confidence - minimum of 30%
  adjustedConfidence = Math.max(adjustedConfidence, 30);
  
  if (!value || value.trim() === '') {
    return 30; // Very low confidence for empty values
  }
  
  // Add field-specific confidence boost based on format and content
  switch (fieldType) {
    case 'merchant':
      // Longer merchant names are usually more reliable
      if (value.length > 5) {
        adjustedConfidence += 10;
      }
      // All caps is likely a header/company name
      if (value === value.toUpperCase() && value.length > 3) {
        adjustedConfidence += 5;
      }
      break;
      
    case 'date':
      // If it's a valid ISO date, high confidence
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        adjustedConfidence += 15;
      }
      
      // Check if date is reasonable (not in the far future)
      try {
        const dateObj = new Date(value);
        const now = new Date();
        // Date should be within last 2 years or next 1 year
        if (dateObj <= new Date(now.getFullYear() + 1, 11, 31) && 
            dateObj >= new Date(now.getFullYear() - 2, 0, 1)) {
          adjustedConfidence += 10;
        }
      } catch (e) {
        // Invalid date reduces confidence
        adjustedConfidence -= 10;
      }
      break;
      
    case 'total':
      // If it's a valid number with 2 decimal places, very likely correct
      if (/^\d+\.\d{2}$/.test(value)) {
        adjustedConfidence += 15;
      }
      
      // Reasonable total amount (not extreme values)
      const totalAmount = parseFloat(value);
      if (!isNaN(totalAmount) && totalAmount > 0 && totalAmount < 10000) {
        adjustedConfidence += 10;
      }
      break;
      
    case 'payment_method':
      // Common payment methods get higher confidence
      const commonMethods = ['cash', 'credit', 'credit card', 'debit', 'debit card', 'visa', 'mastercard'];
      if (commonMethods.some(method => value.toLowerCase().includes(method))) {
        adjustedConfidence += 20;
      }
      break;
  }
  
  // Ensure confidence is within 0-100 range
  return Math.min(Math.max(adjustedConfidence, 30), 100);
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
    const { 
      imageUrl, 
      receiptId, 
      primaryMethod = 'ocr-ai', // Default to OCR + AI
      modelId = '', // Use default model based on method 
      compareWithAlternative = false // Don't compare by default
    } = requestData;
    
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
    
    // Validate primaryMethod
    if (primaryMethod !== 'ocr-ai' && primaryMethod !== 'ai-vision') {
      return new Response(
        JSON.stringify({ error: 'Invalid primaryMethod. Use "ocr-ai" or "ai-vision"' }),
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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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
      const extractedData = await processReceiptImage(
        imageBytes, 
        imageUrl, 
        receiptId,
        primaryMethod,
        modelId,
        compareWithAlternative
      );
      
      console.log("Data extraction complete");
      
      await logger.log("Saving processing results to database", "SAVE");

      // Prepare data for saving to Supabase `receipts` table
      const updateData: Record<string, any> = {
        merchant: extractedData.merchant,
        date: extractedData.date,
        total: extractedData.total,
        tax: extractedData.tax,
        currency: extractedData.currency,
        payment_method: extractedData.payment_method,
        fullText: extractedData.fullText,
        ai_suggestions: extractedData.ai_suggestions,
        predicted_category: extractedData.predicted_category,
        processing_status: 'complete',
        processing_time: extractedData.processing_time,
        updated_at: new Date().toISOString(),
        // Add new fields for AI enhancement features
        model_used: extractedData.modelUsed,
        primary_method: extractedData.primaryMethod,
        has_alternative_data: !!extractedData.alternativeResult,
        discrepancies: extractedData.discrepancies || [],
        // ADDED: Save confidence scores directly to receipts table
        confidence_scores: extractedData.confidence
      };

      // CRITICAL: Double-check and fix date format before saving to database
      // This ensures dates like "19-03-2025" are converted to "2025-03-19"
      if (updateData.date && typeof updateData.date === 'string') {
        const dateValue = updateData.date;
        console.log(`Date before validation: ${dateValue}`);
        
        // Check if the date is already in YYYY-MM-DD format
        const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoRegex.test(dateValue)) {
          // Try to extract components from the date string (DD-MM-YYYY format)
          const ddmmyyyyRegex = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
          const ddmmyyyyMatch = dateValue.match(ddmmyyyyRegex);
          
          if (ddmmyyyyMatch) {
            // Convert DD-MM-YYYY to YYYY-MM-DD
            const day = ddmmyyyyMatch[1].padStart(2, '0');
            const month = ddmmyyyyMatch[2].padStart(2, '0');
            const year = ddmmyyyyMatch[3];
            updateData.date = `${year}-${month}-${day}`;
            console.log(`Fixed date format from ${dateValue} to ${updateData.date}`);
            await logger.log(`Fixed date format from ${dateValue} to ${updateData.date}`, "DATE_FIX");
          } else {
            // As a last resort, try standard Date parsing
            try {
              const dateObj = new Date(dateValue);
              if (!isNaN(dateObj.getTime())) {
                updateData.date = dateObj.toISOString().split('T')[0];
                console.log(`Date object parsing: ${dateValue} -> ${updateData.date}`);
                await logger.log(`Date object parsing: ${dateValue} -> ${updateData.date}`, "DATE_FIX");
              } else {
                // If everything fails, use current date as fallback
                updateData.date = new Date().toISOString().split('T')[0];
                console.log(`Using current date as fallback: ${updateData.date}`);
                await logger.log(`Failed to parse date '${dateValue}', using current date`, "WARNING");
              }
            } catch (e) {
              // If date parsing fails entirely, use current date
              updateData.date = new Date().toISOString().split('T')[0];
              console.log(`Date parsing exception, using current date: ${updateData.date}`);
              await logger.log(`Exception parsing date '${dateValue}', using current date`, "WARNING");
            }
          }
        } else {
          console.log(`Date is already in correct format: ${dateValue}`);
        }
      } else if (!updateData.date) {
        // If date is missing, use current date
        updateData.date = new Date().toISOString().split('T')[0];
        console.log(`No date found, using current date: ${updateData.date}`);
        await logger.log("No date found, using current date", "WARNING");
      }

      // Remove null/undefined fields before updating
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === null || updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // --- Save to Supabase `receipts` table ---
      const { error: updateError } = await supabase
        .from('receipts')
        .update(updateData)
        .eq('id', receiptId);

      if (updateError) {
        console.error("Error updating receipt in database:", updateError);
        await logger.log(`Error saving results: ${updateError.message}`, "ERROR");
        throw new Error(`Failed to update receipt record: ${updateError.message}`);
      }
      
      // --- COMMENTED OUT: Saving confidence scores to separate table is no longer needed ---
      // const confidenceData = {
      //   receipt_id: receiptId,
      //   merchant: extractedData.confidence.merchant || 0,
      //   date: extractedData.confidence.date || 0,
      //   total: extractedData.confidence.total || 0,
      //   tax: extractedData.confidence.tax || 0,
      //   line_items: extractedData.confidence.line_items || 0,
      //   payment_method: extractedData.confidence.payment_method || 0
      // };
      //
      // // Check if confidence record already exists
      // const { data: existingConfidence, error: fetchError } = await supabase
      //   .from('confidence_scores')
      //   .select('id')
      //   .eq('receipt_id', receiptId)
      //   .single();
      //
      // if (fetchError && fetchError.code !== 'PGRST116') { // Not Found error code
      //   console.error("Error checking for existing confidence scores:", fetchError);
      //   await logger.log(`Error checking confidence scores: ${fetchError.message}`, "ERROR");
      //   // Continue processing - non-critical error
      // }
      //
      // let confidenceError;
      //
      // if (existingConfidence?.id) {
      //   // Update existing confidence scores
      //   const { error } = await supabase
      //     .from('confidence_scores')
      //     .update(confidenceData)
      //     .eq('id', existingConfidence.id);
      //
      //   confidenceError = error;
      // } else {
      //   // Insert new confidence scores
      //   const { error } = await supabase
      //     .from('confidence_scores')
      //     .insert(confidenceData);
      //
      //   confidenceError = error;
      // }
      //
      // if (confidenceError) {
      //   console.error("Error saving confidence scores:", confidenceError);
      //   await logger.log(`Error saving confidence scores: ${confidenceError.message}`, "WARNING");
      //   // Don't fail the process for confidence score errors
      // } else {
      //   await logger.log("Confidence scores saved successfully", "SAVE");
      // }
      // --- END COMMENTED OUT BLOCK ---

      // --- Handle line items (Optional: Assuming separate handling or basic logging for now) ---
      if (extractedData.line_items && extractedData.line_items.length > 0) {
        await logger.log(`Extracted ${extractedData.line_items.length} line items (saving not implemented in this function)`, "SAVE_LINE_ITEMS");
        // TODO: Implement line item saving if necessary within this function
        // This might involve deleting existing items and inserting new ones
      }

      await logger.log("Processing results saved successfully", "SAVE");

      // Return the extracted data (including processing time)
      await logger.log("Receipt processing completed successfully", "COMPLETE");
      return new Response(
        JSON.stringify({
          success: true,
          receiptId,
          result: extractedData, // Return the full result including processing time
          // Include additional information for the client
          model_used: extractedData.modelUsed,
          primary_method: extractedData.primaryMethod,
          has_alternative_data: !!extractedData.alternativeResult,
          discrepancies: extractedData.discrepancies || []
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
