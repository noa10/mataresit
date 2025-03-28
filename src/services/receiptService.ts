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
      bucket: 'receipt_images'
    });
    
    // Skip bucket checks and creation - the bucket should be created via SQL migration
    // Upload the file directly - this will fail if the bucket doesn't exist
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
    const { data, error } = await supabase.functions.invoke('process-receipt-endpoint', {
      body: { receiptId },
    });
    
    if (error) {
      console.error("OCR processing error:", error);
      toast.error("Failed to process receipt with OCR");
      return null;
    }
    
    if (!data || !data.success) {
      console.error("OCR processing failed:", data?.error || "Unknown error");
      toast.error(data?.error || "OCR processing failed");
      return null;
    }
    
    // Update the receipt with the extracted data
    const { merchant, date, total, tax, line_items, confidence } = data.result;
    
    const updateData: Partial<Receipt> = {
      merchant,
      date: date || new Date().toISOString().split('T')[0],
      total: total || 0,
      status: "unreviewed"
    };
    
    if (tax !== undefined) {
      updateData.tax = tax;
    }
    
    // Update receipt with extracted data
    await updateReceipt(receiptId, updateData, line_items);
    
    // Update confidence scores
    if (confidence) {
      const { error: confidenceError } = await supabase
        .from("confidence_scores")
        .upsert({
          receipt_id: receiptId,
          merchant: confidence.merchant || 0,
          date: confidence.date || 0,
          total: confidence.total || 0,
          tax: confidence.tax,
          line_items: confidence.line_items
        });
      
      if (confidenceError) {
        console.error("Error updating confidence scores:", confidenceError);
      }
    }
    
    toast.success("Receipt processed successfully!");
    return data.result;
  } catch (error) {
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
