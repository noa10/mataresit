import { supabase } from '@/integrations/supabase/client';
import { Receipt, ReceiptWithDetails, ProcessingLog, Correction } from '@/types/receipt';
import { OCRResult } from '@/types/ocr';

// Function to fetch all receipts for a user
export const fetchAllReceipts = async (userId: string): Promise<Receipt[]> => {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching receipts:', error);
      throw new Error(error.message);
    }

    return data || [];
  } catch (error: any) {
    console.error('Unexpected error fetching receipts:', error);
    throw new Error(error.message);
  }
};

// Function to fetch a limited number of receipts with offset for pagination
export const fetchReceiptsWithPagination = async (
  userId: string,
  page: number,
  pageSize: number
): Promise<Receipt[]> => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) {
      console.error('Error fetching paginated receipts:', error);
      throw new Error(error.message);
    }

    return data || [];
  } catch (error: any) {
    console.error('Unexpected error fetching paginated receipts:', error);
    throw new Error(error.message);
  }
};

// Function to count total receipts for a user
export const getTotalReceiptsCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('receipts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching receipts count:', error);
      throw new Error(error.message);
    }

    return count || 0;
  } catch (error: any) {
    console.error('Unexpected error fetching receipts count:', error);
    throw new Error(error.message);
  }
};

// Function to fetch a receipt by ID
export const fetchReceiptById = async (id: string): Promise<ReceiptWithDetails | null> => {
  try {
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', id)
      .single();

    if (receiptError) {
      console.error('Error fetching receipt:', receiptError);
      return null;
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from('receipt_line_items')
      .select('*')
      .eq('receipt_id', id);

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError);
      // Consider whether to return the receipt without line items or throw an error
    }

    // Fetch field geometry
    const { data: fieldGeometry, error: fieldGeometryError } = await supabase
      .from('field_geometry')
      .select('*')
      .eq('receipt_id', id)
      .single();

    if (fieldGeometryError && fieldGeometryError.code !== '404') {
      console.error('Error fetching field geometry:', fieldGeometryError);
    }

    // Fetch document structure
    const { data: documentStructure, error: documentStructureError } = await supabase
      .from('document_structure')
      .select('*')
      .eq('receipt_id', id)
      .single();

    if (documentStructureError && documentStructureError.code !== '404') {
      console.error('Error fetching document structure:', documentStructureError);
    }

    return {
      ...receipt,
      lineItems: lineItems || [],
      field_geometry: fieldGeometry || undefined,
      document_structure: documentStructure || undefined,
    } as ReceiptWithDetails;

  } catch (error: any) {
    console.error('Unexpected error fetching receipt:', error);
    return null;
  }
};

// Function to fetch receipts by IDs
export const fetchReceiptsByIds = async (ids: string[]): Promise<ReceiptWithDetails[]> => {
  try {
    if (!ids || ids.length === 0) {
      return [];
    }

    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .in('id', ids);

    if (receiptsError) {
      console.error('Error fetching receipts:', receiptsError);
      throw new Error(receiptsError.message);
    }

    // Fetch line items for all receipts
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('receipt_line_items')
      .select('*')
      .in('receipt_id', ids);

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError);
      // Consider whether to return the receipts without line items or throw an error
    }

    // Group line items by receipt ID
    const groupedLineItems = lineItems?.reduce((acc: { [key: string]: any }, item: { receipt_id: any; }) => {
      if (!acc[item.receipt_id]) {
        acc[item.receipt_id] = [];
      }
      acc[item.receipt_id].push(item);
      return acc;
    }, {});

    // Fetch field geometries for all receipts
    const { data: fieldGeometries, error: fieldGeometriesError } = await supabase
      .from('field_geometry')
      .select('*')
      .in('receipt_id', ids);

    if (fieldGeometriesError) {
      console.error('Error fetching field geometries:', fieldGeometriesError);
    }

    // Convert field geometries to a map for easy access
    const fieldGeometryMap = fieldGeometries?.reduce((acc: { [key: string]: any }, geometry: { receipt_id: any; }) => {
      acc[geometry.receipt_id] = geometry;
      return acc;
    }, {});

    // Fetch document structures for all receipts
    const { data: documentStructures, error: documentStructuresError } = await supabase
      .from('document_structure')
      .select('*')
      .in('receipt_id', ids);

    if (documentStructuresError) {
      console.error('Error fetching document structures:', documentStructuresError);
    }

    // Convert document structures to a map for easy access
    const documentStructureMap = documentStructures?.reduce((acc: { [key: string]: any }, structure: { receipt_id: any; }) => {
      acc[structure.receipt_id] = structure;
      return acc;
    }, {});

    // Combine receipts with their line items, field geometries, and document structures
    return receipts.map(receipt => ({
      ...receipt,
      lineItems: groupedLineItems?.[receipt.id] || [],
      field_geometry: fieldGeometryMap?.[receipt.id] || undefined,
      document_structure: documentStructureMap?.[receipt.id] || undefined,
    })) as ReceiptWithDetails[];

  } catch (error: any) {
    console.error('Unexpected error fetching receipts:', error);
    throw new Error(error.message);
  }
};

// Function to create a new receipt
export const createReceipt = async (receipt: Omit<Receipt, 'id' | 'created_at' | 'updated_at'>): Promise<Receipt | null> => {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .insert([receipt])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating receipt:', error);
      throw new Error(error.message);
    }

    return data as Receipt;
  } catch (error: any) {
    console.error('Unexpected error creating receipt:', error);
    throw new Error(error.message);
  }
};

// Function to update an existing receipt
export const updateReceipt = async (id: string, updates: Partial<Receipt>): Promise<Receipt | null> => {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating receipt:', error);
      throw new Error(error.message);
    }

    return data as Receipt;
  } catch (error: any) {
    console.error('Unexpected error updating receipt:', error);
    throw new Error(error.message);
  }
};

// Function to delete a receipt by ID
export const deleteReceipt = async (id: string): Promise<boolean> => {
  try {
    // First, delete related line items
    const { error: lineItemsError } = await supabase
      .from('receipt_line_items')
      .delete()
      .eq('receipt_id', id);

    if (lineItemsError) {
      console.error('Error deleting line items:', lineItemsError);
      throw new Error(lineItemsError.message);
    }

    // Then, delete the receipt
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting receipt:', error);
      throw new Error(error.message);
    }

    return true;
  } catch (error: any) {
    console.error('Unexpected error deleting receipt:', error);
    throw new Error(error.message);
  }
};

// Function to upload an image to Supabase storage
export const uploadImage = async (file: File, userId: string): Promise<{ imageUrl: string; thumbnailUrl: string } | null> => {
  try {
    const timestamp = Date.now();
    const imageName = `receipts/${userId}/${timestamp}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('images')
      .upload(imageName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw new Error(error.message);
    }

    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${data.Key}`;
    const thumbnailUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${data.Key}?transform=thumbnail,width=200`;

    return { imageUrl, thumbnailUrl };
  } catch (error: any) {
    console.error('Unexpected error uploading image:', error);
    throw new Error(error.message);
  }
};

// Function to extract receipt data using OCR
export const extractReceiptData = async (imageUrl: string): Promise<OCRResult | null> => {
  try {
    // Replace with your actual OCR API endpoint and API key
    const ocrApiKey = process.env.OCR_API_KEY;
    const ocrApiUrl = process.env.OCR_API_URL;

    if (!ocrApiKey || !ocrApiUrl) {
      throw new Error('OCR API key or URL not configured.');
    }

    const response = await fetch(ocrApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': ocrApiKey,
      },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (!response.ok) {
      console.error('OCR API responded with an error:', response.status, response.statusText);
      throw new Error(`OCR API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result || !result.data) {
      console.error('Invalid OCR API response:', result);
      throw new Error('Invalid OCR API response');
    }

    // Map the OCR API response to your OCRResult type
    const ocrResult: OCRResult = {
      merchant: result.data.merchant || 'N/A',
      date: result.data.date || 'N/A',
      total: result.data.total || 0,
      tax: result.data.tax || 0,
      paymentMethod: result.data.payment_method || 'N/A',
      confidence_scores: result.data.confidence_scores || {
        overall: 0,
        merchant: 0,
        date: 0,
        total: 0,
        tax: 0,
      },
    };

    return ocrResult;
  } catch (error: any) {
    console.error('Error extracting receipt data with OCR:', error);
    throw new Error(error.message);
  }
};

// Function to log processing steps
export const logProcessingStep = async (
  receiptId: string,
  stepName: string,
  statusMessage: string
): Promise<ProcessingLog | null> => {
  try {
    const { data, error } = await supabase
      .from('processing_logs')
      .insert([{ receipt_id: receiptId, step_name: stepName, status_message: statusMessage }])
      .select('*')
      .single();

    if (error) {
      console.error('Error logging processing step:', error);
      return null;
    }

    return data as ProcessingLog;
  } catch (error: any) {
    console.error('Unexpected error logging processing step:', error);
    return null;
  }
};

// Function to record a correction
export const recordCorrection = async (
  receiptId: string,
  fieldName: string,
  originalValue: string | null,
  aiSuggestion: string | null,
  correctedValue: string
): Promise<Correction | null> => {
  try {
    const { data, error } = await supabase
      .from('corrections')
      .insert([
        {
          receipt_id: receiptId,
          field_name: fieldName,
          original_value: originalValue,
          ai_suggestion: aiSuggestion,
          corrected_value: correctedValue,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error recording correction:', error);
      return null;
    }

    return data as Correction;
  } catch (error: any) {
    console.error('Unexpected error recording correction:', error);
    return null;
  }
};

export async function generateEmbeddingsForReceipt(receiptId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-embeddings', {
      body: { receiptId }
    });

    if (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }

    return data?.success || false;
  } catch (error) {
    console.error('Error calling generate-embeddings function:', error);
    throw error;
  }
}
