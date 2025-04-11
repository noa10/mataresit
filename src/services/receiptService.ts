import { supabase } from "@/integrations/supabase/client";
import { Receipt, ReceiptLineItem, LineItem, ReceiptWithDetails, OCRResult, ReceiptStatus, Correction, AISuggestions, ProcessingStatus } from "@/types/receipt";
import { toast } from "sonner";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const validateStatus = (status: string): ReceiptStatus => {
  if (status === "unreviewed" || status === "reviewed" || status === "synced") {
    return status;
  }
  return "unreviewed"; // Default fallback
};

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
  
  return (data || []).map(item => {
    const receipt = item as unknown as Receipt;
    return {
      ...receipt,
      status: validateStatus(receipt.status || "unreviewed"),
    };
  });
};

export const fetchReceiptById = async (id: string): Promise<ReceiptWithDetails | null> => {
  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .select("*, processing_time")
    .eq("id", id)
    .single();
  
  if (receiptError || !receipt) {
    console.error("Error fetching receipt:", receiptError);
    toast.error("Failed to load receipt details");
    return null;
  }
  
  const { data: lineItems, error: lineItemsError } = await supabase
    .from("line_items")
    .select("*")
    .eq("receipt_id", id);
  
  if (lineItemsError) {
    console.error("Error fetching line items:", lineItemsError);
  }
  
  return {
    ...receipt,
    status: validateStatus(receipt.status || "unreviewed"),
    lineItems: lineItems || [],
    ai_suggestions: receipt.ai_suggestions ? (receipt.ai_suggestions as unknown as AISuggestions) : undefined
  } as ReceiptWithDetails;
};

export const uploadReceiptImage = async (
  file: File, 
  userId: string,
  onProgress?: (progress: number) => void
): Promise<string | null> => {
  try {
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
    
    if (onProgress) {
      return await uploadWithProgress(file, userId, fileName, onProgress);
    }
    
    const { data, error } = await supabase.storage
      .from('receipt_images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error("Storage upload error:", error);
      
      if (error.message.includes("bucket not found")) {
        throw new Error("Receipt storage is not properly configured. Please contact support.");
      } else if (error.message.includes("row-level security policy")) {
        throw new Error("You don't have permission to upload files. Please log in again.");
      } else {
        throw error;
      }
    }
    
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

const uploadWithProgress = async (
  file: File,
  userId: string,
  fileName: string,
  onProgress: (progress: number) => void
): Promise<string | null> => {
  try {
    const { data: uploadData, error: urlError } = await supabase.storage
      .from('receipt_images')
      .createSignedUploadUrl(fileName);
    
    if (urlError || !uploadData) {
      throw new Error(urlError?.message || "Failed to get upload URL");
    }
    
    const { signedUrl, token } = uploadData;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
      
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
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
      
      xhr.onerror = () => {
        reject(new Error("Network error during upload"));
      };
      
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  } catch (error) {
    console.error("Error in uploadWithProgress:", error);
    throw error;
  }
};

export const createReceipt = async (
  receipt: Omit<Receipt, "id" | "created_at" | "updated_at">,
  lineItems: Omit<ReceiptLineItem, "id" | "created_at" | "updated_at">[],
  confidenceScores: Record<string, number>
): Promise<string | null> => {
  try {
    const receiptWithStatus = {
      ...receipt,
      processing_status: receipt.processing_status || 'uploading' as ProcessingStatus
    };
    
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
      }
    }
    
    if (confidenceScores) {
      const { error: updateError } = await supabase
        .from("receipts")
        .update({ confidence_scores: confidenceScores })
        .eq("id", receiptId);
      
      if (updateError) {
        console.error("Error updating confidence scores:", updateError);
      }
    }
    
    return receiptId;
  } catch (error) {
    console.error("Error creating receipt:", error);
    toast.error("Failed to create receipt");
    return null;
  }
};

export const updateReceipt = async (
  id: string,
  receipt: Partial<Omit<Receipt, "id" | "created_at" | "updated_at" | "user_id">>,
  lineItems?: LineItem[]
): Promise<boolean> => {
  try {
    await logCorrections(id, receipt);

    const { error } = await supabase
      .from("receipts")
      .update(receipt)
      .eq("id", id);
    
    if (error) {
      throw error;
    }
    
    if (lineItems !== undefined) {
      const { error: deleteError } = await supabase
        .from("line_items")
        .delete()
        .eq("receipt_id", id);
      
      if (deleteError) {
        console.error("Error deleting line items:", deleteError);
      }
      
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

export interface ProcessingOptions {
  primaryMethod?: 'ocr-ai' | 'ai-vision';
  modelId?: string;
  compareWithAlternative?: boolean;
}

export const processReceiptWithOCR = async (
  receiptId: string, 
  options?: ProcessingOptions
): Promise<OCRResult | null> => {
  try {
    const processingOptions: ProcessingOptions = {
      primaryMethod: options?.primaryMethod || 'ocr-ai',
      modelId: options?.modelId || '',
      compareWithAlternative: options?.compareWithAlternative || false
    };
    
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
    
    let supabaseUrl = '';
    try {
      const { data: urlData } = supabase.storage.from('receipt_images').getPublicUrl('test.txt');
      if (urlData?.publicUrl) {
        const matches = urlData.publicUrl.match(/(https:\/\/[^\/]+)/);
        if (matches && matches[1]) {
          supabaseUrl = matches[1];
        }
      }
    } catch (e) {
      console.error("Error extracting Supabase URL:", e);
    }
    
    if (!supabaseUrl) {
      supabaseUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co';
      console.log("Using fallback Supabase URL:", supabaseUrl);
    }
    
    const { data: anon } = await supabase.auth.getSession();
    const supabaseKey = anon.session?.access_token || '';
    
    if (!supabaseUrl || !supabaseKey) {
      const errorMsg = "Unable to get Supabase configuration";
      console.error("Supabase configuration error:", { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseKey,
        sessionData: anon
      });
      await updateReceiptProcessingStatus(receiptId, 'failed_ocr', errorMsg);
      throw new Error(errorMsg);
    }
    
    const processingUrl = `${supabaseUrl}/functions/v1/process-receipt`;
    
    console.log("Sending receipt for processing...");
    console.log("Processing URL:", processingUrl);
    console.log("Processing options:", processingOptions);
    
    let processingResponse;
    try {
      processingResponse = await fetch(processingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
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
    
    const ocrResult = processingResult.data;
    
    if (processingOptions.primaryMethod === 'ai-vision') {
      await updateReceiptProcessingStatus(receiptId, 'complete');
      
      const updateData: any = {
        merchant: ocrResult.merchant || '',
        date: ocrResult.date || '',
        total: ocrResult.total || 0,
        tax: ocrResult.tax || 0,
        currency: ocrResult.currency || 'MYR',
        payment_method: ocrResult.payment_method || '',
        fullText: ocrResult.fullText || '',
        ai_suggestions: ocrResult.ai_suggestions || {},
        predicted_category: ocrResult.predicted_category || null,
        status: 'unreviewed',
        processing_status: 'complete',
        has_alternative_data: !!ocrResult.alternativeResult,
        discrepancies: ocrResult.discrepancies || [],
        model_used: ocrResult.modelUsed || processingOptions.modelId,
        primary_method: processingOptions.primaryMethod
      };
      
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
      
      if (ocrResult.line_items && ocrResult.line_items.length > 0) {
        const formattedLineItems = ocrResult.line_items.map(item => ({
          description: item.description,
          amount: item.amount,
          receipt_id: receiptId
        }));
        
        const { error: insertError } = await supabase
          .from("line_items")
          .insert(formattedLineItems);
        
        if (insertError) {
          console.error("Error inserting line items:", insertError);
        }
      }
      
      return ocrResult;
    }
    
    await updateReceiptProcessingStatus(receiptId, 'processing_ai');
    
    const updateData: any = {
      merchant: ocrResult.merchant || '',
      date: ocrResult.date || '',
      total: ocrResult.total || 0,
      tax: ocrResult.tax || 0,
      currency: ocrResult.currency || 'MYR',
      payment_method: ocrResult.payment_method || '',
      fullText: ocrResult.fullText || '',
      ai_suggestions: ocrResult.ai_suggestions || {},
      predicted_category: ocrResult.predicted_category || null,
      status: 'unreviewed',
      processing_status: 'complete',
      has_alternative_data: !!ocrResult.alternativeResult,
      discrepancies: ocrResult.discrepancies || [],
      model_used: ocrResult.modelUsed || processingOptions.modelId,
      primary_method: processingOptions.primaryMethod
    };
    
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
    
    if (ocrResult.line_items && ocrResult.line_items.length > 0) {
      const formattedLineItems = ocrResult.line_items.map(item => ({
        description: item.description,
        amount: item.amount,
        receipt_id: receiptId
      }));
      
      const { error: insertError } = await supabase
        .from("line_items")
        .insert(formattedLineItems);
      
      if (insertError) {
        console.error("Error inserting line items:", insertError);
      }
    }
    
    return ocrResult;
  } catch (error) {
    console.error("Error in processReceiptWithOCR:", error);
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

export const fixProcessingStatus = async (receiptId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("receipts")
      .update({ 
        processing_status: 'complete',
        processing_error: null 
      })
      .eq("id", receiptId);
    
    if (error) {
      console.error("Error fixing processing status:", error);
      toast.error("Failed to update processing status");
      return false;
    }
    
    toast.success("Receipt processing status updated");
    return true;
  } catch (error) {
    console.error("Error in fixProcessingStatus:", error);
    toast.error("Failed to update receipt status");
    return false;
  }
};

export const markReceiptUploaded = async (receiptId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("receipts")
      .update({ processing_status: 'uploaded' })
      .eq("id", receiptId);
    
    if (error) {
      console.error("Error marking receipt as uploaded:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error in markReceiptUploaded:", error);
    return false;
  }
};

export const deleteReceipt = async (id: string): Promise<boolean> => {
  try {
    const { data: receipt, error: fetchError } = await supabase
      .from("receipts")
      .select("image_url")
      .eq("id", id)
      .single();
    
    if (fetchError) {
      console.error("Error fetching receipt for deletion:", fetchError);
    }
    
    const { error: lineItemsError } = await supabase
      .from("line_items")
      .delete()
      .eq("receipt_id", id);
    
    if (lineItemsError) {
      console.error("Error deleting line items:", lineItemsError);
    }
    
    const { error } = await supabase
      .from("receipts")
      .delete()
      .eq("id", id);
    
    if (error) {
      throw error;
    }
    
    if (receipt?.image_url) {
      try {
        let imagePath = receipt.image_url;
        
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
        }
      } catch (extractError) {
        console.error("Error extracting image path:", extractError);
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
    
    await updateReceiptStatus(id, "synced");
    
    toast.success("Receipt synced to Zoho successfully");
    return true;
  } catch (error) {
    console.error("Error syncing to Zoho:", error);
    toast.error("Failed to sync receipt to Zoho");
    return false;
  }
};

export const logCorrections = async (
  receiptId: string,
  updatedFields: Partial<Omit<Receipt, "id" | "created_at" | "updated_at" | "user_id">>
): Promise<void> => {
  try {
    const { data: currentReceipt, error: fetchError } = await supabase
      .from("receipts")
      .select("merchant, date, total, tax, payment_method, predicted_category, ai_suggestions")
      .eq("id", receiptId)
      .maybeSingle();
    
    if (fetchError) {
      console.error("Error fetching original receipt data for correction logging:", fetchError);
      return;
    }

    if (!currentReceipt) {
      console.warn(`Receipt with ID ${receiptId} not found for correction logging.`);
      return;
    }

    const aiSuggestions = (currentReceipt.ai_suggestions as unknown as AISuggestions | null) || {};
    
    const correctionsToLog: Omit<Correction, "id" | "created_at">[] = [];

    const fieldsToTrack = ['merchant', 'date', 'total', 'tax', 'payment_method', 'predicted_category'];

    for (const field of fieldsToTrack) {
      if (!(field in currentReceipt)) {
        console.log(`Field ${field} not found in current receipt, skipping`);
        continue;
      }
      
      const originalValue = (currentReceipt as any)[field];
      const correctedValue = updatedFields[field];
      const aiSuggestion = aiSuggestions[field];

      console.log(`Field: ${field}`, {
        originalValue,
        correctedValue,
        aiSuggestion,
        wasUpdated: correctedValue !== undefined,
        valueChanged: originalValue !== correctedValue,
        hasSuggestion: aiSuggestion !== undefined && aiSuggestion !== null
      });

      if (correctedValue !== undefined) {
        const originalValueStr = originalValue === null || originalValue === undefined ? null : String(originalValue);
        const correctedValueStr = String(correctedValue);
        const aiSuggestionStr = aiSuggestion === null || aiSuggestion === undefined ? null : String(aiSuggestion);
        
        console.log(`Field: ${field} (as strings)`, {
          originalValueStr,
          correctedValueStr,
          aiSuggestionStr,
          valueChanged: originalValueStr !== correctedValueStr,
          hasSuggestion: aiSuggestionStr !== null
        });

        if (originalValueStr !== correctedValueStr) {
          correctionsToLog.push({
            receipt_id: receiptId,
            field_name: field,
            original_value: originalValueStr,
            ai_suggestion: aiSuggestionStr,
            corrected_value: correctedValueStr,
          });
          console.log(`Added correction for ${field}`);
        } else {
          console.log(`No correction for ${field}: Value not changed`);
        }
      }
    }

    if (correctionsToLog.length > 0) {
      console.log(`Attempting to log ${correctionsToLog.length} corrections for receipt ${receiptId}:`, correctionsToLog);
      try {
        for (const correction of correctionsToLog) {
          const { error: insertError } = await supabase
            .from('corrections')
            .insert(correction);
            
          if (insertError) {
            console.error(`Error logging correction for ${correction.field_name}:`, insertError);
          } else {
            console.log(`Successfully logged correction for ${correction.field_name}`);
          }
        }
      } catch (insertException) {
        console.error("Exception during corrections insert:", insertException);
      }
    } else {
      console.log(`No corrections to log for receipt ${receiptId} - no values were changed.`);
    }
  } catch (error) {
    console.error("Error in logCorrections function:", error);
  }
};

export const subscribeToReceiptUpdates = (
  receiptId: string, 
  callback: (payload: RealtimePostgresChangesPayload<Receipt>) => void
): RealtimeChannel => {
  const channel = supabase.channel(`receipt-updates-${receiptId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
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

export const updateReceiptProcessingStatus = async (
  id: string, 
  processingStatus: ProcessingStatus, 
  processingError?: string | null
): Promise<boolean> => {
  try {
    const updateData: any = {
      processing_status: processingStatus
    };
    
    if (processingError !== undefined) {
      updateData.processing_error = processingError;
    }
    
    const { error } = await supabase
      .from("receipts")
      .update(updateData)
      .eq("id", id);
    
    if (error) {
      console.error("Error updating receipt processing status:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error updating receipt processing status:", error);
    return false;
  }
};
