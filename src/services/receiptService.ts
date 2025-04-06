import { supabase } from "@/integrations/supabase/client";
import { Receipt, ReceiptLineItem, LineItem, ConfidenceScore, ReceiptWithDetails, OCRResult, ReceiptStatus, Correction, AISuggestions } from "@/types/receipt";
import { toast } from "sonner";

// Ensure status is of type ReceiptStatus
const validateStatus = (status: string): ReceiptStatus => {
  if (status === "unreviewed" || status === "reviewed" || status === "synced") {
    return status;
  }
  return "unreviewed"; // Default fallback
};

// Fetch all receipts for the current user
export const fetchReceipts = async (): Promise<Receipt[]> => {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user.user) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("user_id", user.user.id)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching receipts:", error);
    toast.error("Failed to load receipts");
    return [];
  }
  
  // Validate and convert status to ReceiptStatus type
  return (data || []).map(receipt => ({
    ...receipt,
    status: validateStatus(receipt.status || "unreviewed")
  }));
};

// Fetch a single receipt by ID with line items
export const fetchReceiptById = async (id: string): Promise<ReceiptWithDetails | null> => {
  // First get the receipt
  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", id)
    .single();
  
  if (receiptError || !receipt) {
    console.error("Error fetching receipt:", receiptError);
    toast.error("Failed to load receipt details");
    return null;
  }
  
  // Then get the line items
  const { data: lineItems, error: lineItemsError } = await supabase
    .from("line_items")
    .select("*")
    .eq("receipt_id", id);
  
  if (lineItemsError) {
    console.error("Error fetching line items:", lineItemsError);
    // Don't fail the whole operation, just log and continue
  }
  
  // Get confidence scores
  const { data: confidence, error: confidenceError } = await supabase
    .from("confidence_scores")
    .select("*")
    .eq("receipt_id", id)
    .single();
  
  if (confidenceError && confidenceError.code !== 'PGRST116') {
    console.error("Error fetching confidence scores:", confidenceError);
    // Don't fail the whole operation, just log and continue
  }
  
  return {
    ...receipt,
    status: validateStatus(receipt.status || "unreviewed"),
    lineItems: lineItems || [],
    confidence: confidence || {
      merchant: 0,
      date: 0,
      total: 0
    }
  };
};

// Upload a receipt image to Supabase Storage
export const uploadReceiptImage = async (file: File, userId: string): Promise<string | null> => {
  try {
    // Create a unique file name to avoid collisions
    const fileExt = file.name.split('.').pop();
    const timestamp = new Date().getTime();
    const fileId = Math.random().toString(36).substring(2, 15);
    const fileName = `${userId}/${timestamp}_${fileId}.${fileExt}`;
    
    console.log("Uploading file:", {
      name: fileName,
      type: file.type,
      size: file.size,
      bucket: 'receipt_images'
    });
    
    // Upload the file directly to the receipt_images bucket
    const { data, error } = await supabase.storage
      .from('receipt_images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error("Storage upload error:", error);
      
      // Provide a more specific error message based on the error type
      if (error.message.includes("bucket not found")) {
        throw new Error("Receipt storage is not properly configured. Please contact support.");
      } else if (error.message.includes("row-level security policy")) {
        throw new Error("You don't have permission to upload files. Please log in again.");
      } else {
        throw error;
      }
    }
    
    // Get the public URL for the file
    const { data: publicUrlData } = supabase.storage
      .from('receipt_images')
      .getPublicUrl(fileName);
      
    if (!publicUrlData?.publicUrl) {
      throw new Error("Upload successful but couldn't get public URL");
    }
    
    console.log("Upload successful:", publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    toast.error(error.message || "Failed to upload receipt image. Please try again.");
    return null;
  }
};

// Create a new receipt in the database
export const createReceipt = async (
  receipt: Omit<Receipt, "id" | "created_at" | "updated_at">,
  lineItems: Omit<ReceiptLineItem, "id" | "created_at" | "updated_at">[],
  confidenceScores: Omit<ConfidenceScore, "id" | "receipt_id" | "created_at" | "updated_at">
): Promise<string | null> => {
  try {
    // Insert the receipt
    const { data, error } = await supabase
      .from("receipts")
      .insert(receipt)
      .select("id")
      .single();
    
    if (error) {
      console.error("Error creating receipt:", error);
      throw error;
    }
    
    const receiptId = data.id;
    
    // Add receipt_id to line items and insert them if any
    if (lineItems && lineItems.length > 0) {
      const formattedLineItems = lineItems.map(item => ({
        ...item,
        receipt_id: receiptId
      }));
      
      const { error: lineItemsError } = await supabase
        .from("line_items")
        .insert(formattedLineItems);
      
      if (lineItemsError) {
        console.error("Error inserting line items:", lineItemsError);
        // Don't fail the whole operation, just log and continue
      }
    }
    
    // Insert confidence scores
    if (confidenceScores) {
      const { error: confidenceError } = await supabase
        .from("confidence_scores")
        .insert({
          receipt_id: receiptId,
          ...confidenceScores
        });
      
      if (confidenceError) {
        console.error("Error inserting confidence scores:", confidenceError);
        // Don't fail the whole operation, just log and continue
      }
    }
    
    return receiptId;
  } catch (error) {
    console.error("Error creating receipt:", error);
    toast.error("Failed to create receipt");
    return null;
  }
};

// Update an existing receipt
export const updateReceipt = async (
  id: string,
  receipt: Partial<Omit<Receipt, "id" | "created_at" | "updated_at" | "user_id">>,
  lineItems?: LineItem[]
): Promise<boolean> => {
  try {
    // Call logCorrections before updating the receipt
    await logCorrections(id, receipt);
    
    // Update the receipt
    const { error } = await supabase
      .from("receipts")
      .update(receipt)
      .eq("id", id);
    
    if (error) {
      throw error;
    }
    
    // If line items are provided, update them
    if (lineItems !== undefined) {
      // First delete existing line items
      const { error: deleteError } = await supabase
        .from("line_items")
        .delete()
        .eq("receipt_id", id);
      
      if (deleteError) {
        console.error("Error deleting line items:", deleteError);
        // Continue with insert
      }
      
      // Then insert new ones if there are any
      if (lineItems.length > 0) {
        const formattedLineItems = lineItems.map(item => ({
          description: item.description,
          amount: item.amount,
          receipt_id: id
        }));
        
        const { error: insertError } = await supabase
          .from("line_items")
          .insert(formattedLineItems);
        
        if (insertError) {
          console.error("Error inserting line items:", insertError);
          // Don't fail the whole operation, just log and continue
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error updating receipt:", error);
    toast.error("Failed to update receipt");
    return false;
  }
};

// Process a receipt with OCR
export const processReceiptWithOCR = async (receiptId: string): Promise<OCRResult | null> => {
  try {
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("image_url")
      .eq("id", receiptId)
      .single();
    
    if (receiptError || !receipt) {
      console.error("Error fetching receipt to process:", receiptError);
      throw new Error("Receipt not found");
    }
    
    const imageUrl = receipt.image_url;
    
    // Extract the Supabase URL from a storage URL - more reliable than env vars in browser
    let supabaseUrl = '';
    try {
      // This is a workaround to get the base URL by using the storage URL pattern
      const { data: urlData } = supabase.storage.from('receipt_images').getPublicUrl('test.txt');
      if (urlData?.publicUrl) {
        // Extract base URL (e.g., https://mpmkbtsufihzdelrlszs.supabase.co)
        const matches = urlData.publicUrl.match(/(https:\/\/[^\/]+)/);
        if (matches && matches[1]) {
          supabaseUrl = matches[1];
        }
      }
    } catch (e) {
      console.error("Error extracting Supabase URL:", e);
    }
    
    // Fallback to known project URL if extraction fails
    if (!supabaseUrl) {
      // This is the project URL based on the error logs
      supabaseUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co';
      console.log("Using fallback Supabase URL:", supabaseUrl);
    }
    
    const { data: anon } = await supabase.auth.getSession();
    const supabaseKey = anon.session?.access_token || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase configuration error:", { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseKey,
        sessionData: anon
      });
      throw new Error("Unable to get Supabase configuration");
    }
    
    // Send to OCR processing function
    const processingUrl = `${supabaseUrl}/functions/v1/process-receipt`;
    
    console.log("Sending receipt for OCR processing...");
    console.log("Processing URL:", processingUrl);
    const processingResponse = await fetch(processingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        receiptId,
        imageUrl
      })
    });
    
    if (!processingResponse.ok) {
      const errorText = await processingResponse.text();
      console.error("Processing error:", errorText);
      throw new Error(`Processing failed: ${processingResponse.status} ${processingResponse.statusText}`);
    }
    
    const processingResult = await processingResponse.json();
    console.log("Processing result:", processingResult);
    
    if (!processingResult.success) {
      throw new Error(processingResult.error || "Unknown processing error");
    }
    
    // Extract OCR results
    const ocrResult = processingResult.result as OCRResult;
    
    // Send to enhance-receipt-data function to get additional fields
    const enhancementUrl = `${supabaseUrl}/functions/v1/enhance-receipt-data`;
    
    console.log("Enhancing receipt data...");
    const enhanceResponse = await fetch(enhancementUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        textractData: ocrResult,
        fullText: ocrResult.fullText,
        receiptId: receiptId,
        imageUrl: imageUrl
      })
    });
    
    if (!enhanceResponse.ok) {
      const errorText = await enhanceResponse.text();
      console.error("Enhancement error:", errorText);
      throw new Error(`Enhancement failed: ${enhanceResponse.status} ${enhanceResponse.statusText}`);
    }
    
    const enhancementResult = await enhanceResponse.json();
    console.log("Enhancement result:", enhancementResult);
    
    if (enhancementResult.success && enhancementResult.result) {
      const enhancedData = enhancementResult.result;
      
      // Extract the enhanced data
      const currency = enhancedData.currency || 'MYR';
      const payment_method = enhancedData.payment_method || '';
      const ai_suggestions = enhancedData.suggestions || {};
      const predicted_category = enhancedData.predicted_category || null;
      
      // Prepare data for update
      const updateData: any = {
        currency,
        payment_method,
        ai_suggestions,
        predicted_category,
        status: 'unreviewed',
        fullText: ocrResult.fullText // Persist fullText
      };
      
      // Apply any better matches from Gemini if provided
      if (enhancedData.merchant) updateData.merchant = enhancedData.merchant;
      if (enhancedData.total) updateData.total = enhancedData.total;
      if (enhancedData.date) updateData.date = enhancedData.date; // Add date if Gemini suggests it
      
      // Update the receipt with enhanced data
      const { error: updateError } = await supabase
        .from('receipts')
        .update(updateData)
        .eq('id', receiptId);
      
      if (updateError) {
        console.error("Error updating receipt with enhanced data:", updateError);
        throw updateError;
      }
      
      // Update line items based on OCR results
      if (ocrResult.line_items && ocrResult.line_items.length > 0) {
        // Delete existing line items first
        const { error: deleteError } = await supabase
          .from("line_items")
          .delete()
          .eq("receipt_id", receiptId);

        if (deleteError) {
          console.error("Error deleting old line items during reprocessing:", deleteError);
          // Log but continue trying to insert
        }

        // Insert new line items from OCR result
        const formattedLineItems = ocrResult.line_items.map(item => ({
          description: item.description,
          amount: item.amount,
          receipt_id: receiptId
        }));

        const { error: insertError } = await supabase
          .from("line_items")
          .insert(formattedLineItems);

        if (insertError) {
          console.error("Error inserting new line items during reprocessing:", insertError);
          // Log but don't fail the whole operation
        }
      } else {
         // If OCR returned no line items, ensure any old ones are deleted
         const { error: deleteError } = await supabase
          .from("line_items")
          .delete()
          .eq("receipt_id", receiptId);
         if (deleteError) {
          console.error("Error deleting old line items when OCR returned none:", deleteError);
         }
      }
      
      // Update confidence scores if provided by Gemini
      if (enhancedData.confidence) {
        const { error: confidenceError } = await supabase
          .from('confidence_scores')
          .upsert({
            receipt_id: receiptId,
            merchant: ocrResult.confidence.merchant || 0,
            date: ocrResult.confidence.date || 0,
            total: ocrResult.confidence.total || 0,
            tax: ocrResult.confidence.tax || 0,
            line_items: ocrResult.confidence.line_items || 0,
            payment_method: enhancedData.confidence.payment_method || 0
          });
        
        if (confidenceError) {
          console.error("Error updating confidence scores:", confidenceError);
          // Don't fail the whole operation
        }
      }
      
      // Merge the OCR and enhanced data for return
      const combinedResult = {
        ...ocrResult,
        currency,
        payment_method,
        ai_suggestions,
        predicted_category
      };
      
      return combinedResult;
    }
    
    return ocrResult;
  } catch (error) {
    console.error("Error in processReceiptWithOCR:", error);
    toast.error("Failed to process receipt: " + (error.message || "Unknown error"));
    return null;
  }
};

// Delete a receipt
export const deleteReceipt = async (id: string): Promise<boolean> => {
  try {
    // First get the receipt to get the image URL
    const { data: receipt, error: fetchError } = await supabase
      .from("receipts")
      .select("image_url")
      .eq("id", id)
      .single();
    
    if (fetchError) {
      console.error("Error fetching receipt for deletion:", fetchError);
      // Continue with delete anyway
    }
    
    // Delete line items (use cascade delete in DB schema ideally)
    const { error: lineItemsError } = await supabase
      .from("line_items")
      .delete()
      .eq("receipt_id", id);
    
    if (lineItemsError) {
      console.error("Error deleting line items:", lineItemsError);
      // Continue with delete
    }
    
    // Delete confidence scores
    const { error: confidenceError } = await supabase
      .from("confidence_scores")
      .delete()
      .eq("receipt_id", id);
    
    if (confidenceError) {
      console.error("Error deleting confidence scores:", confidenceError);
      // Continue with delete
    }
    
    // Delete the receipt
    const { error } = await supabase
      .from("receipts")
      .delete()
      .eq("id", id);
    
    if (error) {
      throw error;
    }
    
    // Delete the image from storage if it exists
    if (receipt?.image_url) {
      try {
        // Extract path from URL if needed
        let imagePath = receipt.image_url;
        
        // If it's a full URL, extract the path
        if (imagePath.includes('receipt_images/')) {
          const pathParts = imagePath.split('receipt_images/');
          if (pathParts.length > 1) {
            imagePath = pathParts[1];
          }
        }
        
        const { error: storageError } = await supabase.storage
          .from('receipt_images')
          .remove([imagePath]);
        
        if (storageError) {
          console.error("Error deleting receipt image:", storageError);
          // Don't fail the operation, just log it
        }
      } catch (extractError) {
        console.error("Error extracting image path:", extractError);
        // Continue with the operation
      }
    }
    
    toast.success("Receipt deleted successfully");
    return true;
  } catch (error) {
    console.error("Error deleting receipt:", error);
    toast.error("Failed to delete receipt");
    return false;
  }
};

// Update receipt status
export const updateReceiptStatus = async (id: string, status: ReceiptStatus): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("receipts")
      .update({ status })
      .eq("id", id);
    
    if (error) {
      throw error;
    }
    
    toast.success(`Receipt marked as ${status}`);
    return true;
  } catch (error) {
    console.error("Error updating receipt status:", error);
    toast.error("Failed to update receipt status");
    return false;
  }
};

// Sync receipt to Zoho
export const syncReceiptToZoho = async (id: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('sync-to-zoho', {
      body: { receiptId: id }
    });
    
    if (error) {
      throw error;
    }
    
    if (!data.success) {
      toast.error(data.error || "Failed to sync to Zoho");
      return false;
    }
    
    // Update receipt status to synced
    await updateReceiptStatus(id, "synced");
    
    toast.success("Receipt synced to Zoho successfully");
    return true;
  } catch (error) {
    console.error("Error syncing to Zoho:", error);
    toast.error("Failed to sync receipt to Zoho");
    return false;
  }
};

// Log corrections when user edits receipt data
export const logCorrections = async (
  receiptId: string,
  updatedFields: Partial<Omit<Receipt, "id" | "created_at" | "updated_at" | "user_id">>
): Promise<void> => {
  try {
    console.log("📊 logCorrections called with:", { receiptId, updatedFields });
    
    // Fetch the original receipt including potentially relevant fields and AI suggestions
    const { data: currentReceipt, error: fetchError } = await supabase
      .from("receipts")
      .select("merchant, date, total, tax, payment_method, predicted_category, ai_suggestions")
      .eq("id", receiptId)
      .maybeSingle(); // Use maybeSingle to handle potential null return without error

    if (fetchError) {
      console.error("Error fetching original receipt data for correction logging:", fetchError);
      return; // Exit if we can't fetch the original receipt
    }

    if (!currentReceipt) {
      console.warn(`Receipt with ID ${receiptId} not found for correction logging.`);
      return; // Exit if the receipt doesn't exist
    }

    console.log("📊 Original receipt data:", currentReceipt);
    
    // Ensure ai_suggestions is treated as an object, even if null/undefined in DB
    const aiSuggestions = (currentReceipt.ai_suggestions as AISuggestions | null) || {};
    console.log("📊 AI Suggestions:", aiSuggestions);
    
    const correctionsToLog: Omit<Correction, "id" | "created_at">[] = [];

    // Define the fields we want to track corrections for
    const fieldsToTrack = ['merchant', 'date', 'total', 'tax', 'payment_method', 'predicted_category'];

    console.log("📊 Checking fields for changes:", fieldsToTrack);
    
    for (const field of fieldsToTrack) {
      const originalValue = currentReceipt[field];
      const correctedValue = updatedFields[field];
      const aiSuggestion = aiSuggestions[field];

      console.log(`📊 Field: ${field}`, {
        originalValue,
        correctedValue,
        aiSuggestion,
        wasUpdated: correctedValue !== undefined,
        valueChanged: originalValue !== correctedValue,
        hasSuggestion: aiSuggestion !== undefined && aiSuggestion !== null
      });

      // Check if the field was included in the update payload
      if (correctedValue !== undefined) {
        // Convert values to string for consistent comparison, handle null/undefined
        const originalValueStr = originalValue === null || originalValue === undefined ? null : String(originalValue);
        const correctedValueStr = String(correctedValue); // correctedValue is already checked for undefined
        const aiSuggestionStr = aiSuggestion === null || aiSuggestion === undefined ? null : String(aiSuggestion);
        
        console.log(`📊 Field: ${field} (as strings)`, {
          originalValueStr,
          correctedValueStr,
          aiSuggestionStr,
          valueChanged: originalValueStr !== correctedValueStr,
          hasSuggestion: aiSuggestionStr !== null
        });

        // Log any change the user made, regardless of whether there was an AI suggestion
        if (originalValueStr !== correctedValueStr) {
          correctionsToLog.push({
            receipt_id: receiptId,
            field_name: field,
            original_value: originalValueStr,
            ai_suggestion: aiSuggestionStr, // This can be null if no AI suggestion existed
            corrected_value: correctedValueStr,
          });
          console.log(`📊 Added correction for ${field}`);
        } else {
          console.log(`📊 No correction for ${field}: Value not changed`);
        }
      }
    }

    // Insert corrections if any were generated
    if (correctionsToLog.length > 0) {
      console.log(`📊 Attempting to log ${correctionsToLog.length} corrections for receipt ${receiptId}:`, correctionsToLog);
      try {
        const { error: insertError } = await supabase
          .from("corrections")
          .insert(correctionsToLog);

        if (insertError) {
          console.error("Error logging corrections:", insertError);
          console.error("Error details:", JSON.stringify(insertError));
        } else {
          console.log(`📊 Successfully logged ${correctionsToLog.length} corrections for receipt ${receiptId}`);
        }
      } catch (insertException) {
        console.error("Exception during corrections insert:", insertException);
      }
    } else {
      console.log(`📊 No corrections to log for receipt ${receiptId} - no values were changed.`);
    }
  } catch (error) {
    console.error("Error in logCorrections function:", error);
    // Prevent this function from crashing the parent operation (updateReceipt)
  }
};
