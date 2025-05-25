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

/**
 * Searches for receipts based on a text query and optional filters.
 *
 * @param {string} query - The text query to search for in receipt data.
 * @param {string} userId - The ID of the user performing the search.
 * @param {SearchFilters} [filters] - Optional filters to apply to the search.
 * @param {number} [limit=10] - The maximum number of results to return.
 * @returns {Promise<SearchResult[]>} - A promise that resolves to an array of search results.
 */
export async function searchReceipts(
  query: string,
  userId: string,
  filters?: SearchFilters,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    let supabaseQuery = supabase
      .rpc('search_receipts', {
        query_embedding: `[${await generateEmbedding(query)}]`,
        similarity_threshold: 0.78,
        match_count: limit,
        user_id: userId
      })
      .limit(limit);

    if (filters) {
      if (filters.dateFrom) {
        supabaseQuery = supabaseQuery.gte('date', filters.dateFrom);
      }
      if (filters.dateTo) {
        supabaseQuery = supabaseQuery.lte('date', filters.dateTo);
      }
      if (filters.minAmount) {
        supabaseQuery = supabaseQuery.gte('total', filters.minAmount);
      }
      if (filters.maxAmount) {
        supabaseQuery = supabaseQuery.lte('total', filters.maxAmount);
      }
      if (filters.merchant) {
        supabaseQuery = supabaseQuery.ilike('merchant', `%${filters.merchant}%`);
      }
      if (filters.category) {
        supabaseQuery = supabaseQuery.eq('predicted_category', filters.category);
      }
      if (filters.paymentMethod) {
        supabaseQuery = supabaseQuery.eq('payment_method', filters.paymentMethod);
      }
    }

    const { data, error } = await supabaseQuery;

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
 *
 * @param {string} query - The text query to search for in line item descriptions.
 * @param {string} userId - The ID of the user performing the search.
 * @param {SearchFilters} [filters] - Optional filters to apply to the search.
 * @param {number} [limit=10] - The maximum number of results to return.
 * @returns {Promise<LineItemSearchResult[]>} - A promise that resolves to an array of line item search results.
 */
export async function searchLineItems(
  query: string,
  userId: string,
  filters?: SearchFilters,
  limit: number = 10
): Promise<LineItemSearchResult[]> {
  try {
    let supabaseQuery = supabase
      .rpc('search_line_items', {
        query_embedding: `[${await generateEmbedding(query)}]`,
        similarity_threshold: 0.78,
        match_count: limit,
        user_id: userId
      })
      .limit(limit)

    if (filters) {
      if (filters.dateFrom) {
        supabaseQuery = supabaseQuery.gte('date', filters.dateFrom);
      }
      if (filters.dateTo) {
        supabaseQuery = supabaseQuery.lte('date', filters.dateTo);
      }
      if (filters.minAmount) {
        supabaseQuery = supabaseQuery.gte('total', filters.minAmount);
      }
      if (filters.maxAmount) {
        supabaseQuery = supabaseQuery.lte('total', filters.maxAmount);
      }
      if (filters.merchant) {
        supabaseQuery = supabaseQuery.ilike('merchant', `%${filters.merchant}%`);
      }
      if (filters.category) {
        supabaseQuery = supabaseQuery.eq('predicted_category', filters.category);
      }
      if (filters.paymentMethod) {
        supabaseQuery = supabaseQuery.eq('payment_method', filters.paymentMethod);
      }
    }

    const { data, error } = await supabaseQuery;

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

/**
 * Generates an embedding for a given text using the OpenAI API.
 *
 * @param {string} text - The text to generate an embedding for.
 * @returns {Promise<number[]>} - A promise that resolves to an array of numbers representing the embedding.
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
