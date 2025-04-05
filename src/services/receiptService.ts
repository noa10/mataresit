import { supabase } from "@/integrations/supabase/client";
import { Receipt, ReceiptLineItem, LineItem, ConfidenceScore, ReceiptWithDetails, OCRResult, ReceiptStatus } from "@/types/receipt";
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
      bucket: 'receipt-images'
    });
    
    // Upload the file directly to the receipt-images bucket
    const { data, error } = await supabase.storage
      .from('receipt-images')
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
      .from('receipt-images')
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

// Process a receipt with OCR using Supabase Edge Function
export const processReceiptWithOCR = async (receiptId: string): Promise<OCRResult | null> => {
  try {
    // Get the receipt to get the image URL
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("image_url")
      .eq("id", receiptId)
      .single();
    
    if (receiptError || !receipt) {
      console.error("Error fetching receipt:", receiptError);
      toast.error("Failed to find receipt for OCR processing");
      return null;
    }
    
    // Format the image URL to ensure it's publicly accessible
    let imageUrl = receipt.image_url;
    if (imageUrl && imageUrl.includes('supabase.co') && !imageUrl.includes('/public/')) {
      imageUrl = imageUrl.replace('/object/', '/object/public/');
    }
    
    console.log("Calling OCR process function with receipt:", { receiptId, imageUrl });
    
    // Call the process-receipt Edge Function with retry logic
    const maxRetries = 3;
    let retryCount = 0;
    let data;
    let error;
    
    while (retryCount < maxRetries) {
      try {
        const response = await supabase.functions.invoke('process-receipt', {
          body: { 
            receiptId, 
            imageUrl
          },
        });
        
        data = response.data;
        error = response.error;
        
        if (!error) {
          break;
        }
        
        // If we get a CORS error or network error, retry
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      } catch (invokeError) {
        console.error(`Attempt ${retryCount + 1} failed:`, invokeError);
        error = invokeError;
        retryCount++;
        
        if (retryCount >= maxRetries) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (error) {
      console.error("OCR processing error after retries:", error);
      toast.error("Failed to process receipt with OCR");
      return null;
    }
    
    console.log("OCR processing response:", data);
    
    if (!data || !data.success) {
      console.error("OCR processing failed:", data?.error || "Unknown error");
      toast.error(data?.error || "OCR processing failed");
      return null;
    }
    
    // Update the receipt with the extracted data
    const { merchant, date, total, tax, payment_method, line_items, confidence, fullText } = data.result;
    
    const updateData: Partial<Receipt> = {
      merchant,
      status: "unreviewed"
    };
    
    // Only update fields if they have values
    if (payment_method) {
      updateData.payment_method = payment_method;
    }
    
    if (date) {
      try {
        // Try different date formats
        let parsedDate: Date | null = null;
        
        // First check if it's in a standard format that Date can parse
        const dateObj = new Date(date);
        if (!isNaN(dateObj.getTime())) {
          parsedDate = dateObj;
        } 
        // Check if it's in format like "02 Apr 2025"
        else if (/^\d{1,2}\s+[a-zA-Z]{3}\s+\d{4}$/.test(date)) {
          const parts = date.split(' ');
          const monthMap: Record<string, number> = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
          };
          const day = parseInt(parts[0], 10);
          const month = monthMap[parts[1].toLowerCase()];
          const year = parseInt(parts[2], 10);
          
          if (!isNaN(day) && month !== undefined && !isNaN(year)) {
            parsedDate = new Date(year, month, day);
          }
        }
        // Check for MM/DD/YYYY or DD/MM/YYYY
        else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(date)) {
          // Use a regex to extract parts - this is a simplification
          const parts = date.split(/[\/\-\.]/);
          if (parts.length === 3) {
            // Try MM/DD/YYYY format first
            const month = parseInt(parts[0], 10) - 1;
            const day = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            
            // Adjust 2-digit year
            if (year < 100) {
              year += year < 50 ? 2000 : 1900;
            }
            
            parsedDate = new Date(year, month, day);
            
            // If invalid, try DD/MM/YYYY
            if (isNaN(parsedDate.getTime()) || parsedDate.getMonth() !== month) {
              const day2 = parseInt(parts[0], 10);
              const month2 = parseInt(parts[1], 10) - 1;
              parsedDate = new Date(year, month2, day2);
            }
          }
        }
        
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          // Format as YYYY-MM-DD for database
          const yyyy = parsedDate.getFullYear();
          const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const dd = String(parsedDate.getDate()).padStart(2, '0');
          updateData.date = `${yyyy}-${mm}-${dd}`;
        }
      } catch (e) {
        console.error("Error parsing date:", e);
        // Don't set the date if we can't parse it
      }
    }
    
    if (total !== undefined && total !== null) {
      updateData.total = typeof total === 'number' ? total : parseFloat(total);
    }
    
    if (tax !== undefined && tax !== null) {
      updateData.tax = typeof tax === 'number' ? tax : parseFloat(tax);
    }
    
    // Always include fullText if available - column should exist due to migration
    if (fullText) {
      updateData.fullText = fullText;
      console.log("Including fullText in update data, length:", fullText.length);
    }
    
    // Update receipt with extracted data
    await updateReceipt(receiptId, updateData, line_items);
    
    // Update confidence scores with schema validation check
    if (confidence) {
      try {
        // Check if payment_method column exists in confidence_scores
        const { error: confCheckError } = await supabase
          .from("confidence_scores")
          .select("payment_method")
          .limit(1);
        
        // Create properly typed object for confidence scores
        const confidenceData: {
          receipt_id: string;
          merchant: number;
          date: number;
          total: number;
          tax?: number;
          line_items?: number;
          payment_method?: number;
        } = {
          receipt_id: receiptId,
          merchant: confidence.merchant || 0,
          date: confidence.date || 0,
          total: confidence.total || 0
        };
        
        // Only add these fields if they exist in the schema
        if (!confCheckError && confidence.tax !== undefined) {
          confidenceData.tax = confidence.tax || 0;
        }
        
        if (!confCheckError && confidence.line_items !== undefined) {
          confidenceData.line_items = confidence.line_items || 0;
        }
        
        if (!confCheckError && confidence.payment_method !== undefined) {
          confidenceData.payment_method = confidence.payment_method || 0;
        }
        
        const { error: confidenceError } = await supabase
          .from("confidence_scores")
          .upsert(confidenceData);
        
        if (confidenceError) {
          console.error("Error updating confidence scores:", confidenceError);
          // Don't fail the whole operation
        }
      } catch (error) {
        console.error("Error checking confidence_scores schema:", error);
        // Continue with the operation
      }
    }
    
    toast.success("Receipt processed successfully!");
    return data.result;
  } catch (error: any) {
    console.error("Error in OCR processing:", error);
    toast.error("Failed to process receipt with OCR");
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
        if (imagePath.includes('receipt-images/')) {
          const pathParts = imagePath.split('receipt-images/');
          if (pathParts.length > 1) {
            imagePath = pathParts[1];
          }
        }
        
        const { error: storageError } = await supabase.storage
          .from('receipt-images')
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
