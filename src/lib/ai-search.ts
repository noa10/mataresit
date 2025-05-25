
import { supabase } from "@/integrations/supabase/client";

// Simplified SearchResult type to avoid deep recursion
export interface SearchResult {
  id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  similarity: number;
  created_at: string;
  payment_method?: string;
  predicted_category?: string;
  thumbnail_url?: string;
  image_url?: string;
}

export interface LineItemSearchResult {
  line_item_id: string;
  receipt_id: string;
  description: string;
  amount: number;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  similarity: number;
  thumbnail_url?: string;
  image_url?: string;
}

export interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  merchant?: string;
  category?: string;
  paymentMethod?: string;
}

// Add missing type exports
export interface ReceiptWithSimilarity extends SearchResult {
  similarity: number;
}

export interface SearchParams {
  query: string;
  filters?: SearchFilters;
  limit?: number;
}

/**
 * Searches for receipts based on a text query and optional filters.
 */
export async function searchReceipts(
  query: string,
  userId: string,
  filters?: SearchFilters,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const embedding = await generateEmbedding(query);
    
    const { data, error } = await supabase
      .rpc('search_receipts', {
        query_embedding: `[${embedding.join(',')}]`,
        similarity_threshold: 0.78,
        match_count: limit
      })
      .limit(limit);

    if (error) {
      console.error('Search error:', error);
      return [];
    }

    return (data as any[])?.map(result => ({
      id: result.id,
      merchant: result.merchant,
      date: result.date,
      total: result.total,
      currency: result.currency,
      similarity: result.similarity,
      created_at: result.created_at,
      payment_method: result.payment_method,
      predicted_category: result.predicted_category,
      thumbnail_url: result.thumbnail_url,
      image_url: result.image_url,
    })) || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Searches for line items within receipts based on a text query and optional filters.
 */
export async function searchLineItems(
  query: string,
  userId: string,
  filters?: SearchFilters,
  limit: number = 10
): Promise<LineItemSearchResult[]> => {
  try {
    const embedding = await generateEmbedding(query);
    
    const { data, error } = await supabase
      .rpc('search_line_items', {
        query_embedding: `[${embedding.join(',')}]`,
        similarity_threshold: 0.78,
        match_count: limit
      })
      .limit(limit);

    if (error) {
      console.error('Line item search error:', error);
      return [];
    }

    return (data as any[])?.map(result => ({
      line_item_id: result.line_item_id,
      receipt_id: result.receipt_id,
      description: result.description,
      amount: result.amount,
      merchant: result.merchant,
      date: result.date,
      total: result.total,
      currency: result.currency,
      similarity: result.similarity,
      thumbnail_url: result.thumbnail_url,
      image_url: result.image_url,
    })) || [];
  } catch (error) {
    console.error('Line item search error:', error);
    return [];
  }
}

// Add missing function exports
export async function semanticSearch(params: SearchParams): Promise<SearchResult[]> {
  return await searchReceipts(params.query, '', params.filters, params.limit);
}

export async function getSimilarReceipts(receiptId: string, limit: number = 5): Promise<ReceiptWithSimilarity[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_similar_receipts', {
        receipt_id: receiptId,
        similarity_threshold: 0.5,
        match_count: limit
      })
      .limit(limit);

    if (error) {
      console.error('Error getting similar receipts:', error);
      return [];
    }

    return (data as any[])?.map(result => ({
      id: result.id,
      merchant: result.merchant,
      date: result.date,
      total: result.total,
      currency: result.currency,
      similarity: result.similarity,
      created_at: result.created_at,
      payment_method: result.payment_method,
      predicted_category: result.predicted_category,
      thumbnail_url: result.thumbnail_url,
      image_url: result.image_url,
    })) || [];
  } catch (error) {
    console.error('Error getting similar receipts:', error);
    return [];
  }
}

export async function generateEmbeddings(text: string): Promise<number[]> {
  return await generateEmbedding(text);
}

export async function generateAllEmbeddings(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-all-embeddings');
    
    if (error) {
      console.error('Error generating all embeddings:', error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error('Error calling generate-all-embeddings function:', error);
    return false;
  }
}

export async function checkLineItemEmbeddings(): Promise<{ total: number; withEmbeddings: number }> {
  try {
    const { data, error } = await supabase
      .from('line_items')
      .select('id, embedding')
      .limit(1000);

    if (error) {
      console.error('Error checking line item embeddings:', error);
      return { total: 0, withEmbeddings: 0 };
    }

    const total = data?.length || 0;
    const withEmbeddings = data?.filter(item => item.embedding).length || 0;

    return { total, withEmbeddings };
  } catch (error) {
    console.error('Error checking line item embeddings:', error);
    return { total: 0, withEmbeddings: 0 };
  }
}

export async function generateLineItemEmbeddings(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-line-item-embeddings');
    
    if (error) {
      console.error('Error generating line item embeddings:', error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error('Error calling generate-line-item-embeddings function:', error);
    return false;
  }
}

export async function checkReceiptEmbeddings(): Promise<{ total: number; withEmbeddings: number }> {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('id, has_embeddings')
      .limit(1000);

    if (error) {
      console.error('Error checking receipt embeddings:', error);
      return { total: 0, withEmbeddings: 0 };
    }

    const total = data?.length || 0;
    const withEmbeddings = data?.filter(item => item.has_embeddings).length || 0;

    return { total, withEmbeddings };
  } catch (error) {
    console.error('Error checking receipt embeddings:', error);
    return { total: 0, withEmbeddings: 0 };
  }
}

export async function generateReceiptEmbeddings(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-receipt-embeddings');
    
    if (error) {
      console.error('Error generating receipt embeddings:', error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error('Error calling generate-receipt-embeddings function:', error);
    return false;
  }
}

/**
 * Generates an embedding for a given text using the OpenAI API.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.replace(/\n/g, " ");

  try {
    const response = await fetch(
      `https://api.openai.com/v1/embeddings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input,
          model: "text-embedding-ada-002",
        }),
      }
    );

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();
    return json.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
