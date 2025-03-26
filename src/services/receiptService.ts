
import { supabase } from "@/integrations/supabase/client";
import { Receipt, LineItem, ConfidenceScore, ReceiptWithDetails } from "@/types/receipt";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export async function fetchReceipts(): Promise<Receipt[]> {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Receipt[] || [];
  } catch (error: any) {
    console.error("Error fetching receipts:", error.message);
    toast.error("Failed to load receipts");
    return [];
  }
}

export async function fetchReceiptById(id: string): Promise<ReceiptWithDetails | null> {
  try {
    // Fetch the receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', id)
      .single();

    if (receiptError) throw receiptError;
    if (!receipt) return null;

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('line_items')
      .select('*')
      .eq('receipt_id', id);

    if (lineItemsError) throw lineItemsError;

    // Fetch confidence scores
    const { data: confidence, error: confidenceError } = await supabase
      .from('confidence_scores')
      .select('*')
      .eq('receipt_id', id)
      .single();

    if (confidenceError && confidenceError.code !== 'PGRST116') {
      // PGRST116 is "Results contain 0 rows" - this is OK as confidence might not exist
      throw confidenceError;
    }

    return {
      ...(receipt as Receipt),
      lineItems: lineItems || [],
      confidence: confidence || null
    };
  } catch (error: any) {
    console.error("Error fetching receipt:", error.message);
    toast.error("Failed to load receipt details");
    return null;
  }
}

export async function createReceipt(
  receipt: Omit<Receipt, 'id' | 'created_at' | 'updated_at'>,
  lineItems?: Omit<LineItem, 'id' | 'receipt_id' | 'created_at' | 'updated_at'>[],
  confidenceScore?: Omit<ConfidenceScore, 'id' | 'receipt_id' | 'created_at' | 'updated_at'>
): Promise<string | null> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Insert receipt with user_id
    const { data: receiptData, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        ...receipt,
        user_id: user.id
      })
      .select('id')
      .single();

    if (receiptError) throw receiptError;
    const receiptId = receiptData.id;

    // Insert line items if provided
    if (lineItems && lineItems.length > 0) {
      const formattedLineItems = lineItems.map(item => ({
        ...item,
        receipt_id: receiptId
      }));

      const { error: lineItemsError } = await supabase
        .from('line_items')
        .insert(formattedLineItems);

      if (lineItemsError) throw lineItemsError;
    }

    // Insert confidence score if provided
    if (confidenceScore) {
      const { error: confidenceError } = await supabase
        .from('confidence_scores')
        .insert({
          ...confidenceScore,
          receipt_id: receiptId
        });

      if (confidenceError) throw confidenceError;
    }

    toast.success("Receipt saved successfully");
    return receiptId;
  } catch (error: any) {
    console.error("Error creating receipt:", error.message);
    toast.error("Failed to save receipt");
    return null;
  }
}

export async function updateReceipt(
  id: string,
  receipt: Partial<Omit<Receipt, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
  lineItems?: Omit<LineItem, 'id' | 'receipt_id' | 'created_at' | 'updated_at'>[],
  confidenceScore?: Partial<Omit<ConfidenceScore, 'id' | 'receipt_id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
  try {
    // Update receipt
    const { error: receiptError } = await supabase
      .from('receipts')
      .update({
        ...receipt,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (receiptError) throw receiptError;

    // Handle line items if provided
    if (lineItems) {
      // First delete existing line items
      const { error: deleteError } = await supabase
        .from('line_items')
        .delete()
        .eq('receipt_id', id);

      if (deleteError) throw deleteError;

      // Then insert new ones
      if (lineItems.length > 0) {
        const formattedLineItems = lineItems.map(item => ({
          ...item,
          receipt_id: id
        }));

        const { error: lineItemsError } = await supabase
          .from('line_items')
          .insert(formattedLineItems);

        if (lineItemsError) throw lineItemsError;
      }
    }

    // Update confidence score if provided
    if (confidenceScore) {
      const { error: confidenceError } = await supabase
        .from('confidence_scores')
        .upsert({
          receipt_id: id,
          ...confidenceScore,
          updated_at: new Date().toISOString()
        });

      if (confidenceError) throw confidenceError;
    }

    toast.success("Receipt updated successfully");
    return true;
  } catch (error: any) {
    console.error("Error updating receipt:", error.message);
    toast.error("Failed to update receipt");
    return false;
  }
}

export async function deleteReceipt(id: string): Promise<boolean> {
  try {
    // Delete receipt (cascade will handle line items and confidence scores)
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    toast.success("Receipt deleted successfully");
    return true;
  } catch (error: any) {
    console.error("Error deleting receipt:", error.message);
    toast.error("Failed to delete receipt");
    return false;
  }
}

export async function uploadReceiptImage(file: File, userId: string): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError, data } = await supabase.storage
      .from('receipt_images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipt_images')
      .getPublicUrl(fileName);
    
    return publicUrl;
  } catch (error: any) {
    console.error("Error uploading receipt image:", error.message);
    toast.error("Failed to upload receipt image");
    return null;
  }
}
