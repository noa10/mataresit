
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase-client.ts";
import { createClient } from "https://esm.sh/@aws-sdk/client-textract@3.370.0";

// Load environment variables
const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";

// Create an AWS Textract client
const textractClient = new createClient.TextractClient({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId || "",
    secretAccessKey: awsSecretAccessKey || "",
  },
});

console.log("AWS Textract client created for region:", awsRegion);

// Function to process a receipt image with Textract
async function processReceiptWithTextract(imageUrl: string) {
  try {
    console.log("Processing receipt image:", imageUrl);
    
    // Download the receipt image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }
    
    // Convert the image to bytes
    const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
    
    // Use AWS Textract to analyze the receipt
    const command = new createClient.AnalyzeExpenseCommand({
      Document: {
        Bytes: imageBytes,
      },
    });
    
    const textractResponse = await textractClient.send(command);
    console.log("Textract response received");
    
    // Process the Textract response to extract receipt data
    const result = extractReceiptData(textractResponse);
    
    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error("Error processing receipt with Textract:", error);
    return {
      success: false,
      error: `OCR processing failed: ${error.message}`,
    };
  }
}

// Extract relevant data from the Textract response
function extractReceiptData(textractResponse: any) {
  try {
    console.log("Extracting receipt data from Textract response");
    
    // Default values with confidence scores
    const result = {
      merchant: "Unknown Merchant",
      date: new Date().toISOString().split("T")[0],
      total: 0,
      tax: 0,
      line_items: [],
      confidence: {
        merchant: 0,
        date: 0,
        total: 0,
        tax: 0,
        line_items: 0,
      },
    };
    
    // Extract expense documents
    const documents = textractResponse.ExpenseDocuments || [];
    if (documents.length === 0) {
      console.warn("No expense documents found in Textract response");
      return result;
    }
    
    const document = documents[0];
    const summaryFields = document.SummaryFields || [];
    
    // Process summary fields (merchant, date, total, tax)
    for (const field of summaryFields) {
      const type = field.Type?.Text;
      const value = field.ValueDetection?.Text;
      const confidence = field.ValueDetection?.Confidence || 0;
      
      if (!type || !value) continue;
      
      if (type.toLowerCase().includes("vendor") || type.toLowerCase().includes("merchant")) {
        result.merchant = value;
        result.confidence.merchant = confidence / 100;
      } else if (type.toLowerCase().includes("date") || type.toLowerCase().includes("invoice date")) {
        // Try to parse the date
        try {
          const dateObj = new Date(value);
          if (!isNaN(dateObj.getTime())) {
            result.date = dateObj.toISOString().split("T")[0];
            result.confidence.date = confidence / 100;
          }
        } catch (e) {
          console.warn("Failed to parse date:", value);
        }
      } else if (type.toLowerCase().includes("total")) {
        // Extract numeric value from total
        const totalValue = parseFloat(value.replace(/[^0-9.]/g, ""));
        if (!isNaN(totalValue)) {
          result.total = totalValue;
          result.confidence.total = confidence / 100;
        }
      } else if (type.toLowerCase().includes("tax") || type.toLowerCase().includes("vat")) {
        // Extract numeric value from tax
        const taxValue = parseFloat(value.replace(/[^0-9.]/g, ""));
        if (!isNaN(taxValue)) {
          result.tax = taxValue;
          result.confidence.tax = confidence / 100;
        }
      }
    }
    
    // Process line items
    const lineItemGroups = document.LineItemGroups || [];
    let lineItemConfidence = 0;
    
    for (const group of lineItemGroups) {
      const lineItems = group.LineItems || [];
      
      for (const item of lineItems) {
        const lineItemFields = item.LineItemExpenseFields || [];
        let description = "";
        let amount = 0;
        let itemConfidence = 0;
        let fieldsFound = 0;
        
        for (const field of lineItemFields) {
          const type = field.Type?.Text;
          const value = field.ValueDetection?.Text;
          const confidence = field.ValueDetection?.Confidence || 0;
          
          if (!type || !value) continue;
          
          if (type.toLowerCase().includes("item") || 
              type.toLowerCase().includes("description") || 
              type.toLowerCase().includes("product")) {
            description = value;
            itemConfidence += confidence;
            fieldsFound++;
          } else if (type.toLowerCase().includes("price") || 
                    type.toLowerCase().includes("amount") ||
                    type.toLowerCase().includes("total")) {
            const amountValue = parseFloat(value.replace(/[^0-9.]/g, ""));
            if (!isNaN(amountValue)) {
              amount = amountValue;
              itemConfidence += confidence;
              fieldsFound++;
            }
          }
        }
        
        // Calculate average confidence for this line item
        if (fieldsFound > 0) {
          itemConfidence = itemConfidence / (fieldsFound * 100);
          lineItemConfidence += itemConfidence;
        }
        
        // Add valid line items (must have both description and amount)
        if (description && amount > 0) {
          result.line_items.push({
            description,
            amount,
          });
        }
      }
    }
    
    // Calculate average line item confidence
    if (result.line_items.length > 0) {
      result.confidence.line_items = lineItemConfidence / result.line_items.length;
    }
    
    console.log("Extracted receipt data:", {
      merchant: result.merchant,
      date: result.date,
      totalItems: result.line_items.length,
      confidenceScores: result.confidence
    });
    
    return result;
  } catch (error) {
    console.error("Error extracting receipt data:", error);
    // Return default result with error info
    return {
      merchant: "Error Processing",
      date: new Date().toISOString().split("T")[0],
      total: 0,
      tax: 0,
      line_items: [],
      confidence: {
        merchant: 0,
        date: 0,
        total: 0,
        tax: 0,
        line_items: 0,
      },
      error: error.message,
    };
  }
}

// Main serve function for the Edge Function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header for Supabase client
    const authHeader = req.headers.get("Authorization") || "";
    
    // Create a Supabase client with the user's auth context
    const supabase = supabaseClient(authHeader);
    
    // Parse the request body to get the receipt ID
    const { receiptId } = await req.json();
    
    if (!receiptId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Receipt ID is required" 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }
    
    console.log("Processing receipt with ID:", receiptId);
    
    // Get the receipt details from the database
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", receiptId)
      .single();
    
    if (receiptError || !receipt) {
      console.error("Error fetching receipt:", receiptError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Receipt not found" 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404 
        }
      );
    }
    
    // Make sure we have an image URL
    if (!receipt.image_url) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Receipt image URL is missing" 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }
    
    // Process the receipt image with Textract
    const processResult = await processReceiptWithTextract(receipt.image_url);
    
    return new Response(
      JSON.stringify(processResult),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in receipt processing endpoint:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Internal server error: ${error.message}` 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
