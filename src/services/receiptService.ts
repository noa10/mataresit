import { supabase } from "@/integrations/supabase/client";
import { Receipt, ReceiptLineItem, LineItem, ConfidenceScore, ReceiptWithDetails, OCRResult, ReceiptStatus, Correction, AISuggestions, ProcessingStatus } from "@/types/receipt";
import { toast } from "sonner";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { normalizeMerchant } from '../lib/receipts/validation';

// Ensure status is of type ReceiptStatus
const validateStatus = (status: string): ReceiptStatus => {
  if (status === "unreviewed" || status === "reviewed") {
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
    .select("*, processing_time")
    .eq("user_id", user.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching receipts:", error);
    toast.error("Failed to load receipts");
    return [];
  }

  // Convert Supabase JSON to our TypeScript types and validate status
  return (data || []).map(item => {
    const receipt = item as unknown as Receipt;
    return {
      ...receipt,
      status: validateStatus(receipt.status || "unreviewed"),
    };
  });
};

// Fetch a single receipt by ID with line items
export const fetchReceiptById = async (id: string): Promise<ReceiptWithDetails | null> => {
  // First get the receipt
  const { data: receiptData, error: receiptError } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", id)
    .single();

  if (receiptError || !receiptData) {
    console.error("Error fetching receipt:", receiptError);
    toast.error("Failed to load receipt details");
    return null;
  }

  // Explicitly cast to Receipt after error check
  const receipt = receiptData as unknown as Receipt;

  // Then get the line items
  const { data: lineItems, error: lineItemsError } = await supabase
    .from("line_items")
    .select("*")
    .eq("receipt_id", id);

  if (lineItemsError) {
    console.error("Error fetching line items:", lineItemsError);
    // Don't fail the whole operation, just log and continue
  }

  // REMOVED: Confidence scores are now fetched directly with the receipt object
  // const { data: confidence, error: confidenceError } = await supabase
  //   .from("confidence_scores")
  //   .select("*")
  //   .eq("receipt_id", id)
  //   .single();
  //
  // if (confidenceError && confidenceError.code !== 'PGRST116') {
  //   console.error("Error fetching confidence scores:", confidenceError);
  //   // Don't fail the whole operation, just log and continue
  // }

  return {
    ...receipt,
    status: validateStatus(receipt.status || "unreviewed"),
    lineItems: lineItems || [],
    // Use confidence_scores directly from the receipt object
    confidence_scores: receipt.confidence_scores || {
      merchant: 0,
      date: 0,
      total: 0
    }, // Provide default if missing
    // Explicitly type cast ai_suggestions if needed (already casted here)
    ai_suggestions: receipt.ai_suggestions ? (receipt.ai_suggestions as unknown as AISuggestions) : undefined
  };
};

// Fetch multiple receipts by their IDs with line items
export const fetchReceiptsByIds = async (ids: string[]): Promise<ReceiptWithDetails[]> => {
  if (!ids || ids.length === 0) {
    return [];
  }

  // First get all the receipts
  const { data: receiptsData, error: receiptsError } = await supabase
    .from("receipts")
    .select("*")
    .in("id", ids);

  if (receiptsError || !receiptsData) {
    console.error("Error fetching receipts by IDs:", receiptsError);
    throw new Error('Failed to load receipts');
  }

  // Explicitly cast to Receipt[] after error check
  const receipts = receiptsData as unknown as Receipt[];

  // Then get all line items for these receipts in a single query
  const { data: allLineItems, error: lineItemsError } = await supabase
    .from("line_items")
    .select("*")
    .in("receipt_id", ids);

  if (lineItemsError) {
    console.error("Error fetching line items for receipts:", lineItemsError);
    // Don't fail the whole operation, just log and continue
  }

  // Group line items by receipt_id for easier lookup
  const lineItemsByReceiptId = (allLineItems || []).reduce((acc, item) => {
    if (!acc[item.receipt_id]) {
      acc[item.receipt_id] = [];
    }
    acc[item.receipt_id].push(item);
    return acc;
  }, {} as Record<string, ReceiptLineItem[]>);

  // Combine receipts with their line items
  return receipts.map(receipt => {
    return {
      ...receipt,
      status: validateStatus(receipt.status || "unreviewed"),
      lineItems: lineItemsByReceiptId[receipt.id] || [],
      confidence_scores: receipt.confidence_scores || {
        merchant: 0,
        date: 0,
        total: 0
      },
      ai_suggestions: receipt.ai_suggestions ? (receipt.ai_suggestions as unknown as AISuggestions) : undefined
    };
  });
};

// Upload a receipt image to Supabase Storage
export const uploadReceiptImage = async (
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<string | null> => {
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

    // If we have a progress callback, we need to use the more manual XHR approach
    if (onProgress) {
      return await uploadWithProgress(file, userId, fileName, onProgress);
    }

    // Default upload without progress tracking
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

// Helper function to upload with progress tracking using XMLHttpRequest
const uploadWithProgress = async (
  file: File,
  userId: string,
  fileName: string,
  onProgress: (progress: number) => void
): Promise<string | null> => {
  try {
    // Start by getting an upload URL from Supabase
    const { data: uploadData, error: urlError } = await supabase.storage
      .from('receipt_images')
      .createSignedUploadUrl(fileName);

    if (urlError || !uploadData) {
      throw new Error(urlError?.message || "Failed to get upload URL");
    }

    // We now have the signed URL for direct upload
    const { signedUrl, token } = uploadData;

    // Create a promise that will resolve when the upload is complete
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Set up progress tracking
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      // Handle completion
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Get the public URL
          const { data: publicUrlData } = supabase.storage
            .from('receipt_images')
            .getPublicUrl(fileName);

          if (!publicUrlData?.publicUrl) {
            reject(new Error("Upload successful but couldn't get public URL"));
          } else {
            resolve(publicUrlData.publicUrl);
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      // Handle errors
      xhr.onerror = () => {
        reject(new Error("Network error during upload"));
      };

      // Start the upload
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  } catch (error) {
    console.error("Error in uploadWithProgress:", error);
    throw error;
  }
};

// Create a new receipt in the database
export const createReceipt = async (
  receipt: Omit<Receipt, "id" | "created_at" | "updated_at">,
  lineItems: Omit<ReceiptLineItem, "id" | "created_at" | "updated_at">[],
  confidenceScores: Omit<ConfidenceScore, "id" | "receipt_id" | "created_at" | "updated_at">
): Promise<string | null> => {
  try {
    // Get the current user
    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      console.error("Error creating receipt: User not authenticated");
      toast.error("You must be logged in to create a receipt.");
      return null;
    }

    // Ensure the processing status is set, defaulting to 'uploading' if not provided
    const receiptWithStatus = {
      ...receipt,
      user_id: user.user.id, // Add user_id here
      processing_status: receipt.processing_status || 'uploading' as ProcessingStatus
    };

    // Insert the receipt
    const { data, error } = await supabase
      .from("receipts")
      .insert(receiptWithStatus)
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

    // Insert confidence scores - DISABLED due to table not existing
    if (confidenceScores) {
      console.log("[DISABLED] Would insert confidence scores:", confidenceScores);
      // Feature disabled to avoid 404 errors
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

// Interface for processing options
export interface ProcessingOptions {
  primaryMethod?: 'ocr-ai' | 'ai-vision';
  modelId?: string;
  compareWithAlternative?: boolean;
}

// Process a receipt with OCR
export const processReceiptWithOCR = async (
  receiptId: string,
  options?: ProcessingOptions
): Promise<OCRResult | null> => {
  try {
    // Use default options if not provided
    const processingOptions: ProcessingOptions = {
      primaryMethod: options?.primaryMethod || 'ocr-ai',
      modelId: options?.modelId || '',
      compareWithAlternative: options?.compareWithAlternative || false
    };

    // Update status to start processing
    await updateReceiptProcessingStatus(receiptId, 'processing_ocr');

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("image_url")
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      const errorMsg = "Receipt not found";
      console.error("Error fetching receipt to process:", receiptError);
      await updateReceiptProcessingStatus(receiptId, 'failed_ocr', errorMsg);
      throw new Error(errorMsg);
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

    // Get the current session for authentication
    const { data: anon } = await supabase.auth.getSession();
    const supabaseKey = anon.session?.access_token || '';

    // Get the API key as a fallback - use only import.meta.env for Vite projects
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl) {
      const errorMsg = "Unable to get Supabase URL";
      console.error("Supabase URL error:", {
        hasUrl: !!supabaseUrl,
        sessionData: anon
      });
      await updateReceiptProcessingStatus(receiptId, 'failed_ocr', errorMsg);
      throw new Error(errorMsg);
    }

    // If we don't have a session token, log a warning but continue with the anon key
    if (!supabaseKey) {
      console.warn("No session token available, falling back to anon key");
      if (!supabaseAnonKey) {
        const errorMsg = "No authentication available for Supabase functions";
        console.error("Supabase auth error:", {
          hasKey: !!supabaseKey,
          hasAnonKey: !!supabaseAnonKey,
          sessionData: anon
        });
        await updateReceiptProcessingStatus(receiptId, 'failed_ocr', errorMsg);
        throw new Error(errorMsg);
      }
    }

    // Send to processing function
    const processingUrl = `${supabaseUrl}/functions/v1/process-receipt`;

    console.log("Sending receipt for processing...");
    console.log("Processing URL:", processingUrl);
    console.log("Processing options:", processingOptions);

    let processingResponse: Response;
    try {
      processingResponse = await fetch(processingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey || supabaseAnonKey}`,
          'apikey': supabaseAnonKey, // Add the apikey header as a fallback
        },
        body: JSON.stringify({
          receiptId,
          imageUrl,
          primaryMethod: processingOptions.primaryMethod,
          modelId: processingOptions.modelId,
          compareWithAlternative: processingOptions.compareWithAlternative
        })
      });
    } catch (fetchError) {
      const errorMsg = `Processing API request failed: ${fetchError.message}`;
      console.error("Processing fetch error:", fetchError);
      await updateReceiptProcessingStatus(receiptId, 'failed_ocr', errorMsg);
      throw new Error(errorMsg);
    }

    if (!processingResponse.ok) {
      const errorText = await processingResponse.text();
      const errorMsg = `Processing failed: ${processingResponse.status} ${processingResponse.statusText}`;
      console.error("Processing error:", errorText);
      await updateReceiptProcessingStatus(receiptId, 'failed_ocr', errorMsg);
      throw new Error(errorMsg);
    }

    const processingResult = await processingResponse.json();
    console.log("Processing result:", processingResult);

    if (!processingResult.success) {
      const errorMsg = processingResult.error || "Unknown processing error";
      await updateReceiptProcessingStatus(receiptId, 'failed_ocr', errorMsg);
      throw new Error(errorMsg);
    }

    // Extract results
    const result = processingResult.result as OCRResult;

    // If processing is complete (direct vision processing might not need enhancement)
    if (processingOptions.primaryMethod === 'ai-vision') {
      // For vision processing, we're done
      await updateReceiptProcessingStatus(receiptId, 'complete');

      // Update the receipt with the processed data
      const updateData: any = {
        merchant: result.merchant || '',
        date: result.date || '',
        total: result.total || 0,
        tax: result.tax || 0,
        currency: result.currency || 'MYR',
        payment_method: result.payment_method || '',
        fullText: result.fullText || '',
        ai_suggestions: result.ai_suggestions || {},
        predicted_category: result.predicted_category || null,
        status: 'unreviewed',
        processing_status: 'complete',
        has_alternative_data: !!result.alternativeResult,
        discrepancies: result.discrepancies || [],
        model_used: result.modelUsed || processingOptions.modelId,
        primary_method: processingOptions.primaryMethod
      };

      // Update the receipt with the data
      const { error: updateError } = await supabase
        .from('receipts')
        .update(updateData)
        .eq('id', receiptId);

      if (updateError) {
        const errorMsg = `Failed to update receipt with processed data: ${updateError.message}`;
        console.error("Error updating receipt with processed data:", updateError);
        await updateReceiptProcessingStatus(receiptId, 'failed_ocr', errorMsg);
        throw updateError;
      }

      // Update line items if available
      if (result.line_items && result.line_items.length > 0) {
        // Delete existing line items first
        const { error: deleteError } = await supabase
          .from("line_items")
          .delete()
          .eq("receipt_id", receiptId);

        if (deleteError) {
          console.error("Error deleting old line items:", deleteError);
          // Log but continue trying to insert
        }

        // Insert new line items
        const formattedLineItems = result.line_items.map(item => ({
          description: item.description,
          amount: item.amount,
          receipt_id: receiptId
        }));

        const { error: insertError } = await supabase
          .from("line_items")
          .insert(formattedLineItems);

        if (insertError) {
          console.error("Error inserting line items:", insertError);
          // Non-critical error, don't throw
        }
      }

      return result;
    }

    // For OCR+AI, we need to update status for the AI enhancement step
    await updateReceiptProcessingStatus(receiptId, 'processing_ai');

    // No need to send to enhance-receipt-data again as it's already done in process-receipt

    // Update the receipt with the processed data
    // Format the date to ensure it's in YYYY-MM-DD format
    let formattedDate = result.date || '';

    try {
      // First, try to detect the format based on the value
      console.log(`Attempting to format date: ${formattedDate}`);

      // Check if date is already in YYYY-MM-DD format
      if (formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log(`Date is already in correct format: ${formattedDate}`);
        // No conversion needed
      }
      // Check if date is in DD/MM/YYYY format
      else if (formattedDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = formattedDate.split('/');
        formattedDate = `${year}-${month}-${day}`;
        console.log(`Converted date from DD/MM/YYYY format: ${result.date} to ${formattedDate}`);
      }
      // Check if date is in DD/MM/YY format
      else if (formattedDate.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
        // Try to determine if it's DD/MM/YY or MM/DD/YY based on values
        const parts = formattedDate.split('/');
        const firstNum = parseInt(parts[0], 10);
        const secondNum = parseInt(parts[1], 10);

        // If first number is > 12, it's likely a day (DD/MM/YY)
        if (firstNum > 12) {
          const [day, month, year] = parts;
          formattedDate = `20${year}-${month}-${day}`;
          console.log(`Converted date from DD/MM/YY format: ${result.date} to ${formattedDate}`);
        }
        // If second number is > 12, it's likely MM/DD/YY
        else if (secondNum > 12) {
          const [month, day, year] = parts;
          formattedDate = `20${year}-${month}-${day}`;
          console.log(`Converted date from MM/DD/YY format: ${result.date} to ${formattedDate}`);
        }
        // If both are <= 12, default to DD/MM/YY format
        else {
          const [day, month, year] = parts;
          formattedDate = `20${year}-${month}-${day}`;
          console.log(`Defaulting to DD/MM/YY format: ${result.date} to ${formattedDate}`);
        }
      }
      // If date is in any other format, use today's date as a fallback
      else if (formattedDate && !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.warn(`Unrecognized date format: ${formattedDate}, using today's date as fallback`);
        const today = new Date();
        formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
      }
    } catch (dateError) {
      console.error("Error formatting date:", dateError);
      // Use today's date as a fallback
      const today = new Date();
      formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log(`Using today's date as fallback: ${formattedDate}`);
    }

    const updateData: any = {
      merchant: result.merchant || '',
      date: formattedDate,
      total: result.total || 0,
      tax: result.tax || 0,
      currency: result.currency || 'MYR',
      payment_method: result.payment_method || '',
      fullText: result.fullText || '',
      ai_suggestions: result.ai_suggestions || {},
      predicted_category: result.predicted_category || null,
      status: 'unreviewed',
      processing_status: 'complete',
      has_alternative_data: !!result.alternativeResult,
      discrepancies: result.discrepancies || [],
      model_used: result.modelUsed || processingOptions.modelId,
      primary_method: processingOptions.primaryMethod
    };

    // Update the receipt with enhanced data
    const { error: updateError } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('id', receiptId);

    if (updateError) {
      const errorMsg = `Failed to update receipt with enhanced data: ${updateError.message}`;
      console.error("Error updating receipt with enhanced data:", updateError);
      await updateReceiptProcessingStatus(receiptId, 'failed_ai', errorMsg);
      throw updateError;
    }

    // Update line items based on results
    if (result.line_items && result.line_items.length > 0) {
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
      const formattedLineItems = result.line_items.map(item => ({
        description: item.description,
        amount: item.amount,
        receipt_id: receiptId
      }));

      const { error: insertError } = await supabase
        .from("line_items")
        .insert(formattedLineItems);

      if (insertError) {
        console.error("Error inserting line items during reprocessing:", insertError);
        // Non-critical error, don't throw
      }
    }

    return result;
  } catch (error) {
    console.error("Error in processReceiptWithOCR:", error);
    // Try to update status to failed if not already done
    try {
      await updateReceiptProcessingStatus(
        receiptId,
        'failed_ocr',
        error.message || "Unknown error during receipt processing"
      );
    } catch (statusError) {
      console.error("Failed to update error status:", statusError);
    }

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

    // Delete confidence scores - DISABLED due to table not existing
    console.log("[DISABLED] Would delete confidence scores for receipt:", id);
    // Feature disabled to avoid 404 errors

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
    const aiSuggestions = (currentReceipt.ai_suggestions as unknown as AISuggestions | null) || {};
    console.log("📊 AI Suggestions:", aiSuggestions);

    const correctionsToLog: Omit<Correction, "id" | "created_at">[] = [];

    // Define the fields we want to track corrections for
    const fieldsToTrack = ['merchant', 'date', 'total', 'tax', 'payment_method', 'predicted_category'];

    console.log("📊 Checking fields for changes:", fieldsToTrack);

    for (const field of fieldsToTrack) {
      // Check if the field exists in the current receipt before proceeding
      if (!(field in currentReceipt)) {
        console.log(`📊 Field ${field} not found in current receipt, skipping`);
        continue;
      }

      // Cast to any to avoid TypeScript errors with dynamic property access
      const originalValue = (currentReceipt as any)[field];
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
        // Use custom SQL query or REST API call to insert corrections
        // since the corrections table might not be in the TypeScript types yet
        for (const correction of correctionsToLog) {
          const { error: insertError } = await supabase
            .from('corrections')
            .insert(correction);

          if (insertError) {
            console.error(`Error logging correction for ${correction.field_name}:`, insertError);
          } else {
            console.log(`📊 Successfully logged correction for ${correction.field_name}`);
          }
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

// Fetch correction history for a specific receipt
export const fetchCorrections = async (receiptId: string): Promise<Correction[]> => {
  try {
    const { data, error } = await supabase
      .from("corrections")
      .select("*")
      .eq("receipt_id", receiptId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching corrections:", error);
      toast.error("Failed to load correction history.");
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error fetching corrections:", error);
    toast.error("An unexpected error occurred while fetching correction history.");
    return [];
  }
};

// Subscribe to real-time updates for a receipt
export const subscribeToReceiptUpdates = (
  receiptId: string,
  callback: (payload: RealtimePostgresChangesPayload<Receipt>) => void
): RealtimeChannel => {
  const channel = supabase.channel(`receipt-updates-${receiptId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'receipts',
        filter: `id=eq.${receiptId}`
      },
      callback
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to updates for receipt ${receiptId}`);
      }
      if (err) {
        console.error('Error subscribing to receipt updates:', err);
        toast.error('Failed to subscribe to receipt status updates');
      }
    });

  return channel;
};

// Log processing status changes - completely disabled due to schema issues
export const logProcessingStatus = async (
  receiptId: string,
  status: ProcessingStatus,
  message?: string
): Promise<boolean> => {
  // Just return true without doing anything - this feature is disabled
  // to avoid errors with the processing_logs table
  console.log(`[DISABLED] Would log processing status: ${status} for receipt ${receiptId}${message ? ': ' + message : ''}`);
  return true;
};

// Update receipt processing status
export const updateReceiptProcessingStatus = async (
  id: string,
  processingStatus: ProcessingStatus,
  processingError?: string | null
): Promise<boolean> => {
  try {
    // Using a more permissive type cast to avoid TypeScript errors until database types are updated
    const updateData: any = {
      processing_status: processingStatus
    };

    // Only include processing_error if it's provided
    if (processingError !== undefined) {
      updateData.processing_error = processingError;
    }

    const { error } = await supabase
      .from("receipts")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("Error updating processing status:", error);
      throw error;
    }

    // Try to log the status change, but don't fail if it doesn't work
    try {
      await logProcessingStatus(id, processingStatus, processingError || undefined);
    } catch (logError) {
      console.error("Failed to log processing status change:", logError);
      // Non-critical, continue
    }

    return true;
  } catch (error) {
    console.error("Error in updateReceiptProcessingStatus:", error);
    return false;
  }
};

// Fix processing status from failed to complete when a receipt is manually edited
export const fixProcessingStatus = async (id: string): Promise<boolean> => {
  try {
    // Use any to bypass TypeScript until the database types are updated
    const supabaseAny = supabase as any;
    if (supabaseAny.rpc) {
      try {
        await supabaseAny.rpc('update_processing_status_if_failed', {
          receipt_id: id
        });
      } catch (rpcError) {
        // Ignore errors - likely the function doesn't exist yet
        console.log('Note: Function to fix processing status not available yet');
      }
    }

    return true;
  } catch (error) {
    console.error("Error fixing processing status:", error);
    return false;
  }
};

// Update the receipt's processing status to 'uploaded' after image upload
export const markReceiptUploaded = async (id: string): Promise<boolean> => {
  return await updateReceiptProcessingStatus(id, 'uploaded');
};

// Interface for batch processing result
interface BatchProcessingResult {
  successes: Array<{
    receiptId: string;
    result: OCRResult;
  }>;
  failures: Array<{
    receiptId: string;
    error: string;
  }>;
  totalProcessed: number;
  processingTime: number;
}

// Process multiple receipts in parallel
export const processBatchReceipts = async (
  receiptIds: string[],
  options?: ProcessingOptions
): Promise<BatchProcessingResult> => {
  const startTime = performance.now();

  // Initialize results
  const result: BatchProcessingResult = {
    successes: [],
    failures: [],
    totalProcessed: 0,
    processingTime: 0
  };

  try {
    // Process receipts in parallel with Promise.all
    const results = await Promise.all(
      receiptIds.map(async (receiptId) => {
        try {
          const processedResult = await processReceiptWithOCR(receiptId, options);
          if (processedResult) {
            return {
              success: true,
              receiptId,
              result: processedResult
            };
          } else {
            return {
              success: false,
              receiptId,
              error: "Processing failed with null result"
            };
          }
        } catch (error) {
          console.error(`Error processing receipt ${receiptId}:`, error);
          return {
            success: false,
            receiptId,
            error: error.message || "Unknown error during processing"
          };
        }
      })
    );

    // Categorize results
    results.forEach((item) => {
      if (item.success) {
        result.successes.push({
          receiptId: item.receiptId,
          result: item.result
        });
      } else {
        result.failures.push({
          receiptId: item.receiptId,
          error: item.error
        });
      }
    });

    result.totalProcessed = results.length;
    result.processingTime = (performance.now() - startTime) / 1000; // Convert to seconds

    return result;
  } catch (error) {
    console.error("Batch processing error:", error);
    throw new Error(`Batch processing failed: ${error.message}`);
  }
};

// Cache for merchant name mappings
const merchantCache = new Map<string, string>();

// Function to get normalized merchant name with caching
export const getNormalizedMerchant = (merchant: string): string => {
  const key = merchant.toLowerCase();
  if (!merchantCache.has(key)) {
    merchantCache.set(key, normalizeMerchant(merchant));
  }
  return merchantCache.get(key)!;
};
