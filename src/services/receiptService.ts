import { supabase } from "@/integrations/supabase/client";
import { Receipt, ReceiptLineItem, LineItem, ConfidenceScore, ReceiptWithDetails, AIResult, ReceiptStatus, Correction, AISuggestions, ProcessingStatus } from "@/types/receipt";
import { toast } from "sonner";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { normalizeMerchant } from '../lib/receipts/validation';
import { generateEmbeddingsForReceipt } from '@/lib/ai-search';
import { AVAILABLE_MODELS, getModelConfig } from '@/config/modelProviders';
import { OpenRouterService, ProcessingInput, ProgressCallback } from '@/services/openRouterService';
import { CacheInvalidationService } from '@/services/cacheInvalidationService';

/**
 * Client-side processing logger for OpenRouter models
 * Writes logs to the processing_logs table similar to server-side ProcessingLogger
 */
class ClientProcessingLogger {
  private receiptId: string;
  private loggingEnabled = true;

  constructor(receiptId: string) {
    this.receiptId = receiptId;
    console.log('🔧 ClientProcessingLogger: Initialized for receipt:', receiptId);
  }

  /**
   * Log a processing step to the database
   */
  async log(message: string, step?: string): Promise<void> {
    const logMessage = `[${step || 'LOG'}] (Receipt: ${this.receiptId}) ${message}`;
    console.log(logMessage);

    if (!this.loggingEnabled) {
      console.warn('🚫 ClientProcessingLogger: Logging disabled for this instance');
      return;
    }

    try {
      console.log('📝 ClientProcessingLogger: Attempting to insert log:', {
        receipt_id: this.receiptId,
        status_message: message,
        step_name: step || null
      });

      const { data, error } = await supabase
        .from('processing_logs')
        .insert({
          receipt_id: this.receiptId,
          status_message: message,
          step_name: step || null
        })
        .select();

      if (error) {
        console.error('❌ ClientProcessingLogger: DB insert failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        this.loggingEnabled = false; // Disable DB logging for subsequent calls on this instance
      } else {
        console.log('✅ ClientProcessingLogger: Successfully inserted log:', data);
      }
    } catch (e) {
      console.error('💥 ClientProcessingLogger: Critical error:', e);
      this.loggingEnabled = false;
    }
  }

  /**
   * Convenience methods for common logging scenarios
   */
  async start(): Promise<void> {
    await this.log("Starting OpenRouter receipt processing", "START");
  }

  async complete(): Promise<void> {
    await this.log("OpenRouter receipt processing completed", "COMPLETE");
  }

  async error(message: string): Promise<void> {
    await this.log(message, "ERROR");
  }

  async ai(message: string): Promise<void> {
    await this.log(message, "AI");
  }

  async processing(message: string): Promise<void> {
    await this.log(message, "PROCESSING");
  }
}
import { SubscriptionEnforcementService, handleActionResult } from '@/services/subscriptionEnforcementService';

// TEAM COLLABORATION FIX: Utility function to clear receipt caches
export const clearReceiptCaches = (queryClient: any, receiptId?: string, teamId?: string | null) => {
  console.log("🧹 Clearing receipt and category caches for team collaboration fix");

  if (receiptId) {
    // Clear specific receipt cache for all team contexts
    queryClient.invalidateQueries({ queryKey: ['receipt', receiptId] });
  } else {
    // Clear all receipt-related caches
    queryClient.invalidateQueries({ queryKey: ['receipt'] });
  }

  queryClient.invalidateQueries({ queryKey: ['receipts'] });
  queryClient.invalidateQueries({ queryKey: ['receiptsForDay'] });

  // TEAM COLLABORATION FIX: Clear team-aware categories cache
  if (teamId) {
    queryClient.invalidateQueries({ queryKey: ['categories', teamId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['categories', null] });
  }
  queryClient.invalidateQueries({ queryKey: ['categories'] }); // Fallback for safety
};

// TEAM COLLABORATION FIX: Test function to verify category access
export const testCategoryAccess = async (receiptId: string = '3a7a81c1-a8ca-4e91-8aba-950f146d8cc6') => {
  console.log("🧪 Testing category access for receipt:", receiptId);

  const { data: user } = await supabase.auth.getUser();
  console.log("Current user:", user.user?.email);

  // Test direct category query
  const { data: categoryData, error: categoryError } = await supabase
    .from("custom_categories")
    .select("id, name, color, icon")
    .eq("id", "4d91794b-3de2-49fa-8f55-2ac5523153c0")
    .single();

  console.log("Direct category query result:", { categoryData, categoryError });

  // Test receipt with category query
  const receiptResult = await fetchReceiptById(receiptId);
  console.log("Receipt with category result:", {
    hasReceipt: !!receiptResult,
    customCategoryId: receiptResult?.custom_category_id,
    categoryData: receiptResult?.custom_categories
  });

  return { categoryData, receiptResult };
};

// Ensure status is of type ReceiptStatus
const validateStatus = (status: string): ReceiptStatus => {
  if (status === "unreviewed" || status === "reviewed") {
    return status;
  }
  return "unreviewed"; // Default fallback
};

// Fetch all receipts for the current user or team
export const fetchReceipts = async (teamContext?: { currentTeam: { id: string } | null }): Promise<Receipt[]> => {
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) {
    return [];
  }

  let query = supabase
    .from("receipts")
    .select(`
      *,
      processing_time,
      custom_categories (
        id,
        name,
        color,
        icon
      )
    `);

  // Apply filtering based on team context
  if (teamContext?.currentTeam?.id) {
    // When in team context, fetch team receipts using RLS policies
    // RLS will automatically filter based on team membership
    console.log("🧾 Fetching team receipts for team:", teamContext.currentTeam.id, "user:", user.user.email);
    query = query.eq("team_id", teamContext.currentTeam.id);
  } else {
    // When not in team context, fetch personal receipts (team_id is null)
    console.log("🧾 Fetching personal receipts for user:", user.user.email);
    query = query.eq("user_id", user.user.id).is("team_id", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching receipts:", error);
    toast.error("Failed to load receipts");
    return [];
  }

  const receipts = data || [];
  console.log(`🧾 Successfully fetched ${receipts.length} receipts for ${teamContext?.currentTeam?.id ? 'team' : 'personal'} workspace`);

  // TEAM COLLABORATION FIX: Log category information for debugging
  const receiptsWithCategories = receipts.filter(r => r.custom_categories);
  console.log(`🏷️ ${receiptsWithCategories.length} receipts have category information`);

  // Convert Supabase JSON to our TypeScript types and validate status
  return receipts.map(item => {
    const receipt = item as unknown as Receipt;
    return {
      ...receipt,
      status: validateStatus(receipt.status || "unreviewed"),
    };
  });
};

// Fetch a single receipt by ID with line items
export const fetchReceiptById = async (id: string, teamContext?: { currentTeam: { id: string } | null }): Promise<ReceiptWithDetails | null> => {
  // Debug logging for team collaboration category access issue
  const { data: user } = await supabase.auth.getUser();
  console.log("🔍 fetchReceiptById debug:", {
    receiptId: id,
    userId: user.user?.id,
    userEmail: user.user?.email,
    teamContext: teamContext?.currentTeam?.id || 'personal',
    timestamp: new Date().toISOString()
  });

  if (!user.user) {
    console.error("No authenticated user found");
    return null;
  }

  // First, try to fetch the receipt with the current team context
  let receiptData = null;
  let receiptError = null;

  // Build query with team context filtering (same logic as fetchReceipts)
  let query = supabase
    .from("receipts")
    .select(`
      *,
      custom_categories (
        id,
        name,
        color,
        icon
      )
    `)
    .eq("id", id);

  // Apply filtering based on team context (same as fetchReceipts)
  if (teamContext?.currentTeam?.id) {
    // When in team context, fetch team receipts using RLS policies
    console.log("🧾 Fetching team receipt for team:", teamContext.currentTeam.id, "user:", user.user.email);
    query = query.eq("team_id", teamContext.currentTeam.id);
  } else {
    // When not in team context, fetch personal receipts (team_id is null)
    console.log("🧾 Fetching personal receipt for user:", user.user.email);
    query = query.eq("user_id", user.user.id).is("team_id", null);
  }

  const { data: primaryData, error: primaryError } = await query.single();
  receiptData = primaryData;
  receiptError = primaryError;

  // If the primary query failed and we were looking for personal receipts,
  // try looking for team receipts that the user has access to
  if (receiptError && !teamContext?.currentTeam?.id) {
    console.log("🔄 Primary query failed, trying to find receipt in user's teams...");

    // Try to find the receipt in any team the user belongs to
    const fallbackQuery = supabase
      .from("receipts")
      .select(`
        *,
        custom_categories (
          id,
          name,
          color,
          icon
        )
      `)
      .eq("id", id)
      .eq("user_id", user.user.id); // Still filter by user for security

    const { data: fallbackData, error: fallbackError } = await fallbackQuery.single();

    if (!fallbackError && fallbackData) {
      console.log("✅ Found receipt in fallback query");
      receiptData = fallbackData;
      receiptError = null;
    }
  }

  // Enhanced debug logging for category data
  console.log("🔍 Receipt query result:", {
    receiptId: id,
    hasData: !!receiptData,
    hasError: !!receiptError,
    customCategoryId: receiptData?.custom_category_id,
    categoryData: receiptData?.custom_categories,
    teamId: receiptData?.team_id,
    error: receiptError
  });

  if (receiptError || !receiptData) {
    console.error("Error fetching receipt:", receiptError);
    toast.error("Failed to load receipt details");
    return null;
  }

  // Explicitly cast to Receipt after error check
  const receipt = receiptData as unknown as Receipt;

  // TEAM COLLABORATION FIX: If category data is missing but custom_category_id exists,
  // try alternative query method using direct JOIN
  if (receipt.custom_category_id && !receiptData.custom_categories) {
    console.log("🔧 Category data missing, trying alternative query method...");

    try {
      const { data: categoryData, error: categoryError } = await supabase
        .from("custom_categories")
        .select("id, name, color, icon")
        .eq("id", receipt.custom_category_id)
        .single();

      if (!categoryError && categoryData) {
        console.log("✅ Alternative category query successful:", categoryData);
        // Manually attach category data to receipt
        (receipt as any).custom_categories = categoryData;
      } else {
        console.log("❌ Alternative category query failed:", categoryError);
      }
    } catch (error) {
      console.log("❌ Alternative category query exception:", error);
    }
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
    // Include custom category information
    custom_category: (receiptData as any).custom_categories || null,
    // Explicitly type cast ai_suggestions if needed (already casted here)
    ai_suggestions: receipt.ai_suggestions ? (receipt.ai_suggestions as unknown as AISuggestions) : undefined
  };
};

// Fetch multiple receipts by their IDs with line items
export const fetchReceiptsByIds = async (ids: string[], teamContext?: { currentTeam: { id: string } | null }): Promise<ReceiptWithDetails[]> => {
  if (!ids || ids.length === 0) {
    return [];
  }

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    console.error("No authenticated user found");
    return [];
  }

  // Build query with team context filtering (same logic as fetchReceipts)
  let query = supabase
    .from("receipts")
    .select("*")
    .in("id", ids);

  // Apply filtering based on team context (same as fetchReceipts)
  if (teamContext?.currentTeam?.id) {
    console.log("🧾 Fetching team receipts by IDs for team:", teamContext.currentTeam.id);
    query = query.eq("team_id", teamContext.currentTeam.id);
  } else {
    console.log("🧾 Fetching personal receipts by IDs for user:", user.user.email);
    query = query.eq("user_id", user.user.id).is("team_id", null);
  }

  const { data: receiptsData, error: receiptsError } = await query;

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
  confidenceScores: Omit<ConfidenceScore, "id" | "receipt_id" | "created_at" | "updated_at">,
  teamContext?: { currentTeam: { id: string } | null }
): Promise<string | null> => {
  try {
    // Get the current user
    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      console.error("Error creating receipt: User not authenticated");
      toast.error("You must be logged in to create a receipt.");
      return null;
    }

    // ENHANCED SECURITY: Check subscription limits before creating receipt
    console.log("Checking subscription limits before creating receipt...");
    const enforcementResult = await SubscriptionEnforcementService.canUploadReceipt();

    if (!enforcementResult.allowed) {
      console.warn("Receipt creation blocked by subscription limits:", enforcementResult.reason);
      handleActionResult(enforcementResult, "create this receipt");
      return null;
    }

    console.log("Subscription check passed, proceeding with receipt creation");

    // Determine team_id based on team context
    const teamId = teamContext?.currentTeam?.id || receipt.team_id || null;

    console.log("Creating receipt with team context:", {
      teamId,
      hasTeamContext: !!teamContext?.currentTeam,
      receiptTeamId: receipt.team_id
    });

    // Ensure the processing status is set, defaulting to 'uploading' if not provided
    const receiptWithStatus = {
      ...receipt,
      user_id: user.user.id, // Add user_id here
      team_id: teamId, // Add team_id based on context
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

    // Invalidate caches after successful receipt creation
    try {
      await CacheInvalidationService.onReceiptUploaded(user.user.id);
    } catch (cacheError) {
      console.warn('Cache invalidation failed:', cacheError);
      // Don't fail the receipt creation if cache invalidation fails
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
  receiptId: string,
  data: Partial<Receipt>,
  options?: { skipEmbeddings?: boolean }
): Promise<Receipt> => {
  try {
    const { data: responseData, error } = await supabase
      .from('receipts')
      .update(data)
      .eq('id', receiptId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!responseData) {
      throw new Error('Receipt not found after update');
    }

    // Cast the response data to Receipt type
    const receipt = responseData as unknown as Receipt;

    // Generate embeddings if not explicitly skipped and receipt is reviewed
    if (!options?.skipEmbeddings && receipt.status === 'reviewed') {
      try {
        await generateEmbeddingsForReceipt(receiptId);
      } catch (embeddingError) {
        console.error('Failed to generate embeddings:', embeddingError);
        // Continue with the update even if embedding fails
      }
    }

    // Invalidate caches after successful receipt update
    try {
      await CacheInvalidationService.onReceiptUpdated(receipt.user_id);
    } catch (cacheError) {
      console.warn('Cache invalidation failed:', cacheError);
      // Don't fail the update if cache invalidation fails
    }

    return receipt;
  } catch (error) {
    console.error('Error updating receipt:', error);
    throw error;
  }
};

// Update an existing receipt with line items
export const updateReceiptWithLineItems = async (
  receiptId: string,
  receiptData: Partial<Receipt>,
  lineItems?: ReceiptLineItem[],
  options?: { skipEmbeddings?: boolean }
): Promise<Receipt> => {
  try {
    console.log('updateReceiptWithLineItems called with:', {
      receiptId,
      receiptData,
      lineItemsCount: lineItems?.length || 0,
      options
    });

    // First update the receipt data
    const { data: responseData, error } = await supabase
      .from('receipts')
      .update(receiptData)
      .eq('id', receiptId)
      .select()
      .single();

    if (error) {
      console.error('Error updating receipt:', error);
      throw error;
    }

    if (!responseData) {
      throw new Error('Receipt not found after update');
    }

    // Cast the response data to Receipt type
    const receipt = responseData as unknown as Receipt;

    // Update line items if provided
    if (lineItems && lineItems.length > 0) {
      console.log('Updating line items for receipt:', receiptId);

      // Delete existing line items first
      const { error: deleteError } = await supabase
        .from("line_items")
        .delete()
        .eq("receipt_id", receiptId);

      if (deleteError) {
        console.error("Error deleting old line items:", deleteError);
        // Log but continue trying to insert - this is non-critical
      }

      // Filter out temporary IDs and format line items for insertion
      const formattedLineItems = lineItems
        .filter(item => item.description && item.description.trim() !== '') // Only include items with descriptions
        .map(item => ({
          description: item.description,
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0,
          receipt_id: receiptId
        }));

      if (formattedLineItems.length > 0) {
        const { error: insertError } = await supabase
          .from("line_items")
          .insert(formattedLineItems);

        if (insertError) {
          console.error("Error inserting line items:", insertError);
          // This is a critical error for line item updates, so we should throw
          throw new Error(`Failed to update line items: ${insertError.message}`);
        }

        console.log(`Successfully updated ${formattedLineItems.length} line items for receipt ${receiptId}`);
      }
    } else if (lineItems && lineItems.length === 0) {
      // If empty array is explicitly passed, delete all line items
      console.log('Deleting all line items for receipt:', receiptId);

      const { error: deleteError } = await supabase
        .from("line_items")
        .delete()
        .eq("receipt_id", receiptId);

      if (deleteError) {
        console.error("Error deleting line items:", deleteError);
        // Non-critical error, don't throw
      }
    }

    // Generate embeddings if not explicitly skipped and receipt is reviewed
    if (!options?.skipEmbeddings && receipt.status === 'reviewed') {
      try {
        await generateEmbeddingsForReceipt(receiptId);
      } catch (embeddingError) {
        console.error('Failed to generate embeddings:', embeddingError);
        // Continue with the update even if embedding fails
      }
    }

    return receipt;
  } catch (error) {
    console.error('Error updating receipt with line items:', error);
    throw error;
  }
};

// Interface for processing options
export interface ProcessingOptions {
  modelId?: string;
}

// Helper function to check if a model is an OpenRouter model
const isOpenRouterModel = (modelId: string): boolean => {
  return modelId.startsWith('openrouter/');
};

// Helper function to get user's OpenRouter API key from settings
const getOpenRouterApiKey = (): string | null => {
  try {
    const storedSettings = localStorage.getItem('receiptProcessingSettings');
    if (storedSettings) {
      const settings = JSON.parse(storedSettings);
      return settings.userApiKeys?.openrouter || null;
    }
  } catch (error) {
    console.error('Error reading OpenRouter API key from settings:', error);
  }
  return null;
};

// Process receipt using client-side OpenRouter service
const processReceiptWithOpenRouter = async (
  receiptId: string,
  imageUrl: string,
  options: ProcessingOptions,
  onProgress?: ProgressCallback
): Promise<AIResult> => {
  // Initialize client-side logger for database logging
  const logger = new ClientProcessingLogger(receiptId);

  // Start logging
  await logger.start();
  onProgress?.('START', 'Initializing OpenRouter processing');

  const modelConfig = getModelConfig(options.modelId!);
  if (!modelConfig) {
    const errorMsg = `Model configuration not found for ${options.modelId}`;
    await logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  await logger.log(`🤖 MODEL SELECTED: ${modelConfig.name} (${modelConfig.id})`, "AI");
  await logger.log(`📊 Provider: ${modelConfig.provider.toUpperCase()}`, "AI");

  onProgress?.('START', 'Validating API key');
  await logger.log('🔑 Validating OpenRouter API key', "START");
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    const errorMsg = 'OpenRouter API key not configured. Please set it in the settings.';
    await logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  await logger.log('✅ API key validated for OpenRouter', "START");

  const openRouterService = new OpenRouterService(apiKey);

  // Fetch the image data
  onProgress?.('START', 'Fetching image data');
  await logger.log('📥 Fetching image data from storage', "START");
  console.log('Fetching image for OpenRouter processing:', imageUrl);
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    const errorMsg = `Failed to fetch image: ${imageResponse.status}`;
    await logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  onProgress?.('START', 'Preparing image data');
  await logger.log('🔧 Preparing image data for processing', "START");
  const imageArrayBuffer = await imageResponse.arrayBuffer();
  const imageData = new Uint8Array(imageArrayBuffer);
  const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

  await logger.log(`🖼️ Image size: ${imageData.length} bytes (${mimeType})`, "AI");

  // Prepare input for AI vision processing
  const input: ProcessingInput = {
    type: 'image',
    imageData: {
      data: imageData,
      mimeType: mimeType
    }
  };

  // Enhanced progress callback that also logs to database
  const enhancedProgressCallback: ProgressCallback = async (step, message) => {
    // Call original progress callback for UI updates
    onProgress?.(step, message);

    // Also log to database
    await logger.log(message, step);
  };

  // Call OpenRouter service with enhanced progress callback
  console.log(`Processing receipt ${receiptId} with OpenRouter model ${modelConfig.name}`);
  await logger.log(`🚀 OPENROUTER API REQUEST: Initiating call to ${modelConfig.name}`, "AI");

  const result = await openRouterService.callModel(modelConfig, input, receiptId, enhancedProgressCallback);

  console.log('🔍 OpenRouter service result:', {
    resultType: typeof result,
    resultKeys: Object.keys(result || {}),
    hasRawContent: !!result?.raw_content,
    result: result
  });

  // Handle case where result contains raw_content (unparsed response)
  if (result?.raw_content && !result.merchant) {
    const errorMsg = `OpenRouter model returned unparsed response: ${result.raw_content.substring(0, 200)}...`;
    console.warn('⚠️ OpenRouter returned raw content, attempting to extract data');
    await logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Emit data processing progress
  onProgress?.('PROCESSING', 'Validating extracted fields');
  await logger.processing('✅ OpenRouter API response received successfully');
  await logger.processing('🔍 Validating extracted fields');

  // Transform the result to match AIResult interface
  onProgress?.('PROCESSING', 'Formatting receipt information');
  await logger.processing('📋 Formatting receipt information');
  const aiResult: AIResult = {
    merchant: result.merchant || result.store_name || '',
    date: result.date || result.purchase_date || new Date().toISOString().split('T')[0],
    total: parseFloat(result.total || result.total_amount || result.amount || '0') || 0,
    tax: parseFloat(result.tax || result.tax_amount || '0') || 0,
    currency: result.currency || 'MYR',
    payment_method: result.payment_method || result.payment_type || '',
    fullText: result.fullText || result.raw_text || '',
    line_items: result.line_items || result.items || [],
    confidence_scores: result.confidence || result.confidence_score || {},
    ai_suggestions: result.suggestions || result.ai_suggestions || {},
    predicted_category: result.predicted_category || result.category || null,
    modelUsed: modelConfig.id
  };

  onProgress?.('PROCESSING', 'Calculating confidence scores');
  await logger.processing('📊 Calculating confidence scores');
  console.log('✅ Transformed OpenRouter result to AIResult:', aiResult);

  await logger.complete();
  return aiResult;
};

// Process a receipt with AI Vision
export const processReceiptWithAI = async (
  receiptId: string,
  options?: ProcessingOptions & { uploadContext?: string; onProgress?: ProgressCallback }
): Promise<AIResult | null> => {
  try {
    // Use AI Vision as the processing method
    const processingOptions: ProcessingOptions = {
      modelId: options?.modelId || ''
    };

    // Check if this is an OpenRouter model and handle it client-side
    if (processingOptions.modelId && isOpenRouterModel(processingOptions.modelId)) {
      console.log(`Detected OpenRouter model: ${processingOptions.modelId}, processing client-side`);

      // Update status to start processing
      await updateReceiptProcessingStatus(receiptId, 'processing');

      const { data: receipt, error: receiptError } = await supabase
        .from("receipts")
        .select("image_url")
        .eq("id", receiptId)
        .single();

      if (receiptError || !receipt) {
        const errorMsg = "Receipt not found";
        console.error("Error fetching receipt to process:", receiptError);
        await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
        throw new Error(errorMsg);
      }

      let result: AIResult;
      try {
        // Process with OpenRouter client-side
        result = await processReceiptWithOpenRouter(receiptId, receipt.image_url, processingOptions, options?.onProgress);
      } catch (processingError) {
        // Log error to database using client logger
        const logger = new ClientProcessingLogger(receiptId);
        await logger.error(`OpenRouter processing failed: ${processingError.message}`);

        // Update status to failed
        await updateReceiptProcessingStatus(receiptId, 'failed', processingError.message);
        throw processingError;
      }

      // Update status to complete
      await updateReceiptProcessingStatus(receiptId, 'complete');

      // Update the receipt with the processed data
      const updateData: any = {
        merchant: result.merchant || '',
        date: result.date || new Date().toISOString().split('T')[0], // Use today's date as fallback
        total: result.total || 0,
        tax: result.tax || 0,
        currency: result.currency || 'MYR',
        payment_method: result.payment_method || '',
        fullText: result.fullText || '',
        ai_suggestions: result.ai_suggestions || {},
        predicted_category: result.predicted_category || null,
        status: 'unreviewed',
        processing_status: 'complete',
        model_used: result.modelUsed || processingOptions.modelId
      };

      // Update the receipt with the data
      const { error: updateError } = await supabase
        .from('receipts')
        .update(updateData)
        .eq('id', receiptId);

      if (updateError) {
        const errorMsg = `Failed to update receipt with processed data: ${updateError.message}`;
        console.error("Error updating receipt with processed data:", updateError);
        await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
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

    // Continue with server-side processing for non-OpenRouter models
    // Update status to start processing
    await updateReceiptProcessingStatus(receiptId, 'processing');

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("image_url")
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      const errorMsg = "Receipt not found";
      console.error("Error fetching receipt to process:", receiptError);
      await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
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
      await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
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
        await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
        throw new Error(errorMsg);
      }
    }

    // Send to processing function
    const processingUrl = `${supabaseUrl}/functions/v1/process-receipt`;

    console.log("Sending receipt for processing...");
    console.log("Processing URL:", processingUrl);
    console.log("Processing options:", processingOptions);

    // Enhanced logging for debugging consistency issues
    const uploadContext = options?.uploadContext || 'unknown';
    const requestPayload = {
      receiptId,
      imageUrl,
      modelId: processingOptions.modelId
    };
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey || supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    };

    // 🔍 ENHANCED DEBUG LOGGING FOR MODEL SELECTION
    console.log('🚀 RECEIPT SERVICE DEBUG - processReceiptWithAI called with:', {
      receiptId,
      imageUrl: imageUrl.substring(0, 50) + '...',
      'options?.modelId': options?.modelId,
      'processingOptions.modelId': processingOptions.modelId,
      'requestPayload.modelId': requestPayload.modelId,
      uploadContext,
      timestamp: new Date().toISOString()
    });

    console.log(`🔍 DETAILED REQUEST DEBUG [${uploadContext.toUpperCase()}]:`);
    console.log("Receipt ID:", receiptId);
    console.log("Image URL:", imageUrl);
    console.log("Model ID:", processingOptions.modelId);
    console.log("Upload Context:", uploadContext);
    console.log("Auth token length:", (supabaseKey || supabaseAnonKey)?.length);
    console.log("Request timestamp:", new Date().toISOString());
    console.log("Request payload:", JSON.stringify(requestPayload, null, 2));

    let processingResponse: Response;
    try {
      processingResponse = await fetch(processingUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestPayload)
      });
    } catch (fetchError) {
      const errorMsg = `Processing API request failed: ${fetchError.message}`;
      console.error("Processing fetch error:", fetchError);
      await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
      throw new Error(errorMsg);
    }

    if (!processingResponse.ok) {
      const errorText = await processingResponse.text();
      let errorMsg = `Processing failed: ${processingResponse.status} ${processingResponse.statusText}`;

      // Check for resource limit errors
      const isResourceLimitError = errorText.includes("WORKER_LIMIT") ||
                                  errorText.includes("compute resources");

      if (isResourceLimitError) {
        console.error("Resource limit error during processing:", errorText);
        errorMsg = "The receipt is too complex to process with the current resource limits. Try using a smaller image.";

        // Update status with more user-friendly message
        await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);

        // Throw a more user-friendly error
        throw new Error(errorMsg);
      }

      console.error("Processing error:", errorText);
      await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
      throw new Error(errorMsg);
    }

    const processingResult = await processingResponse.json();
    console.log("Processing result:", processingResult);

    // Enhanced logging for debugging consistency issues
    console.log(`🔍 DETAILED RESPONSE DEBUG [${uploadContext.toUpperCase()}]:`);
    console.log("Response timestamp:", new Date().toISOString());
    console.log("Response success:", processingResult.success);
    console.log("Response model used:", processingResult.model_used);
    if (processingResult.result) {
      console.log("Result merchant:", processingResult.result.merchant);
      console.log("Result total:", processingResult.result.total);
      console.log("Result line_items count:", processingResult.result.line_items?.length || 0);
      console.log("Result line_items:", JSON.stringify(processingResult.result.line_items, null, 2));
      console.log("Result confidence scores:", JSON.stringify(processingResult.result.confidence, null, 2));
    }

    if (!processingResult.success) {
      const errorMsg = processingResult.error || "Unknown processing error";
      await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
      throw new Error(errorMsg);
    }

    // Extract results
    const result = processingResult.result as AIResult;

    // AI Vision processing is complete
    await updateReceiptProcessingStatus(receiptId, 'complete');

    // Update the receipt with the processed data
    const updateData: any = {
        merchant: result.merchant || '',
        date: result.date || new Date().toISOString().split('T')[0], // Use today's date as fallback
        total: result.total || 0,
        tax: result.tax || 0,
        currency: result.currency || 'MYR',
        payment_method: result.payment_method || '',
        fullText: result.fullText || '',
        ai_suggestions: result.ai_suggestions || {},
        predicted_category: result.predicted_category || null,
        status: 'unreviewed',
        processing_status: 'complete',
        model_used: result.modelUsed || processingOptions.modelId
      };

    // Update the receipt with the data
    const { error: updateError } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('id', receiptId);

    if (updateError) {
      const errorMsg = `Failed to update receipt with processed data: ${updateError.message}`;
      console.error("Error updating receipt with processed data:", updateError);
      await updateReceiptProcessingStatus(receiptId, 'failed', errorMsg);
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
  } catch (error) {
    console.error("Error in processReceiptWithAI:", error);
    // Try to update status to failed if not already done
    try {
      await updateReceiptProcessingStatus(
        receiptId,
        'failed',
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
    // First get the receipt to get the image URL and user_id
    const { data: receipt, error: fetchError } = await supabase
      .from("receipts")
      .select("image_url, user_id")
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

    // Invalidate caches after successful receipt deletion
    if (receipt?.user_id) {
      try {
        await CacheInvalidationService.onReceiptDeleted(receipt.user_id);
      } catch (cacheError) {
        console.warn('Cache invalidation failed:', cacheError);
        // Don't fail the deletion if cache invalidation fails
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

// OPTIMIZATION: Rate limiting for receipt updates
interface ReceiptUpdateRateLimiter {
  lastUpdate: number;
  updateCount: number;
  windowStart: number;
}

const receiptRateLimiters = new Map<string, ReceiptUpdateRateLimiter>();

const canProcessReceiptUpdate = (receiptId: string): boolean => {
  const now = Date.now();
  const limiter = receiptRateLimiters.get(receiptId) || {
    lastUpdate: 0,
    updateCount: 0,
    windowStart: now
  };

  // Reset window every 5 seconds
  if (now - limiter.windowStart > 5000) {
    limiter.updateCount = 0;
    limiter.windowStart = now;
  }

  // Prevent more than 10 updates per 5-second window per receipt
  if (limiter.updateCount >= 10) {
    console.warn(`🚫 Rate limit exceeded for receipt ${receiptId} (${limiter.updateCount}/10 updates in 5s)`);
    return false;
  }

  // Prevent updates more frequent than every 100ms
  if (now - limiter.lastUpdate < 100) {
    console.warn(`🚫 Update too frequent for receipt ${receiptId} (${now - limiter.lastUpdate}ms < 100ms)`);
    return false;
  }

  limiter.lastUpdate = now;
  limiter.updateCount++;
  receiptRateLimiters.set(receiptId, limiter);
  return true;
};

// OPTIMIZATION: Unified receipt subscription system
interface ReceiptSubscriptionCallbacks {
  onReceiptUpdate?: (payload: RealtimePostgresChangesPayload<Receipt>) => void;
  onLogUpdate?: (payload: RealtimePostgresChangesPayload<ProcessingLog>) => void;
  onCommentUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
}

interface UnifiedReceiptSubscription {
  receiptChannel: RealtimeChannel;
  logChannel?: RealtimeChannel;
  commentChannel?: RealtimeChannel;
  callbacks: Map<string, ReceiptSubscriptionCallbacks>;
  createdAt: number;
  lastActivity: number;
  subscriptionTypes: Set<'receipt' | 'logs' | 'comments'>;
  isCleaningUp?: boolean; // Flag to prevent race conditions during cleanup
}

// OPTIMIZATION: Unified connection pooling for all receipt-related subscriptions
const unifiedReceiptSubscriptions = new Map<string, UnifiedReceiptSubscription>();

// Circuit breaker to prevent excessive subscription creation
const subscriptionCreationLimiter = new Map<string, { count: number; lastReset: number }>();
const MAX_SUBSCRIPTIONS_PER_RECEIPT = 5;
const LIMITER_RESET_INTERVAL = 60000; // 1 minute

const canCreateSubscription = (receiptId: string): boolean => {
  const now = Date.now();
  const limiter = subscriptionCreationLimiter.get(receiptId);

  if (!limiter) {
    subscriptionCreationLimiter.set(receiptId, { count: 1, lastReset: now });
    return true;
  }

  // Reset counter if enough time has passed
  if (now - limiter.lastReset > LIMITER_RESET_INTERVAL) {
    limiter.count = 1;
    limiter.lastReset = now;
    return true;
  }

  // Check if we've exceeded the limit
  if (limiter.count >= MAX_SUBSCRIPTIONS_PER_RECEIPT) {
    console.warn(`🚫 Subscription creation blocked for receipt ${receiptId} - too many attempts (${limiter.count})`);
    return false;
  }

  limiter.count++;
  return true;
};

// Legacy connection pooling for backward compatibility
const activeReceiptSubscriptions = new Map<string, {
  channel: RealtimeChannel;
  callbacks: Set<(payload: RealtimePostgresChangesPayload<Receipt>) => void>;
  createdAt: number;
  lastActivity: number;
}>();

// Subscribe to real-time updates for a receipt
// OPTIMIZATION: Enhanced with selective event filtering and connection pooling
export const subscribeToReceiptUpdates = (
  receiptId: string,
  callback: (payload: RealtimePostgresChangesPayload<Receipt>) => void,
  options?: {
    events?: ('INSERT' | 'UPDATE' | 'DELETE')[];
    statusFilter?: string[];
  }
): RealtimeChannel => {
  // OPTIMIZATION: Check if we already have an active subscription for this receipt
  const subscriptionKey = `receipt-${receiptId}`;
  const existing = activeReceiptSubscriptions.get(subscriptionKey);

  if (existing) {
    console.log(`🔄 Reusing existing subscription for receipt ${receiptId}`);
    existing.callbacks.add(callback);
    existing.lastActivity = Date.now();

    // Return a cleanup function that removes this callback
    return {
      unsubscribe: () => {
        existing.callbacks.delete(callback);
        // If no more callbacks, clean up the subscription
        if (existing.callbacks.size === 0) {
          console.log(`🧹 Cleaning up receipt subscription for ${receiptId} (no more callbacks)`);
          existing.channel.unsubscribe();
          activeReceiptSubscriptions.delete(subscriptionKey);
        }
      }
    } as RealtimeChannel;
  }

  // OPTIMIZATION: Default to only UPDATE events since receipts are rarely inserted/deleted in real-time
  const events = options?.events || ['UPDATE'];
  const eventFilter = events.length === 1 ? events[0] : events.join(',');

  // OPTIMIZATION: Add status filtering to reduce unnecessary updates
  let filter = `id=eq.${receiptId}`;
  if (options?.statusFilter && options.statusFilter.length > 0) {
    filter += `&processing_status=in.(${options.statusFilter.join(',')})`;
  }

  const callbacks = new Set<(payload: RealtimePostgresChangesPayload<Receipt>) => void>();
  callbacks.add(callback);

  const channel = supabase.channel(`receipt-updates-${receiptId}`)
    .on(
      'postgres_changes',
      {
        event: eventFilter as any,
        schema: 'public',
        table: 'receipts',
        filter
      },
      (payload) => {
        // OPTIMIZATION: Additional client-side filtering for status if specified
        if (options?.statusFilter && options.statusFilter.length > 0) {
          const receipt = payload.new as Receipt;
          if (receipt && !options.statusFilter.includes(receipt.processing_status)) {
            console.log(`🚫 Filtered out receipt status: ${receipt.processing_status}`);
            return;
          }
        }

        // OPTIMIZATION: Rate limiting for receipt updates
        if (!canProcessReceiptUpdate(receiptId)) {
          return; // Skip this update due to rate limiting
        }

        // OPTIMIZATION: Notify all callbacks for this receipt
        const subscription = activeReceiptSubscriptions.get(subscriptionKey);
        if (subscription) {
          subscription.lastActivity = Date.now();
          subscription.callbacks.forEach(cb => {
            try {
              cb(payload);
            } catch (error) {
              console.error('Error in receipt subscription callback:', error);
            }
          });
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Subscribed to receipt updates for ${receiptId} (events: ${events.join(', ')}, pooled)`);
      }
      if (err) {
        console.error('❌ Error subscribing to receipt updates:', err);
        toast.error('Failed to subscribe to receipt status updates');
        // Clean up on error
        activeReceiptSubscriptions.delete(subscriptionKey);
      }
    });

  // Store the subscription with metadata
  activeReceiptSubscriptions.set(subscriptionKey, {
    channel,
    callbacks,
    createdAt: Date.now(),
    lastActivity: Date.now()
  });

  // Return a channel-like object with cleanup
  return {
    unsubscribe: () => {
      callbacks.delete(callback);
      // If no more callbacks, clean up the subscription
      if (callbacks.size === 0) {
        console.log(`🧹 Cleaning up receipt subscription for ${receiptId} (no more callbacks)`);
        channel.unsubscribe();
        activeReceiptSubscriptions.delete(subscriptionKey);
      }
    }
  } as RealtimeChannel;
};

// OPTIMIZATION: Unified receipt subscription function
export const subscribeToReceiptAll = (
  receiptId: string,
  callbackId: string,
  callbacks: ReceiptSubscriptionCallbacks,
  options?: {
    subscribeToLogs?: boolean;
    subscribeToComments?: boolean;
    statusFilter?: string[];
  }
): (() => void) => {
  const subscriptionKey = `unified-receipt-${receiptId}`;
  const existing = unifiedReceiptSubscriptions.get(subscriptionKey);

  // Circuit breaker: prevent excessive subscription creation
  if (!existing && !canCreateSubscription(receiptId)) {
    // Return a no-op cleanup function
    return () => {};
  }

  if (existing && !existing.isCleaningUp) {
    // Only log in development
    if (import.meta.env.DEV) {
      console.log(`🔄 Adding callbacks to existing unified subscription for receipt ${receiptId}`);
    }
    existing.callbacks.set(callbackId, callbacks);
    existing.lastActivity = Date.now();
    existing.isCleaningUp = false; // Reset cleanup flag

    // Add new subscription types if needed
    if (options?.subscribeToLogs && !existing.subscriptionTypes.has('logs')) {
      setupLogSubscription(receiptId, existing);
    }
    if (options?.subscribeToComments && !existing.subscriptionTypes.has('comments')) {
      setupCommentSubscription(receiptId, existing);
    }

    return () => cleanupUnifiedCallback(receiptId, callbackId);
  }

  // Only log subscription creation in development
  if (import.meta.env.DEV) {
    console.log(`✅ Creating new unified subscription for receipt ${receiptId}`);
  }

  // Create the unified subscription
  const subscription: UnifiedReceiptSubscription = {
    receiptChannel: null as any, // Will be set below
    callbacks: new Map([[callbackId, callbacks]]),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    subscriptionTypes: new Set(['receipt']),
    isCleaningUp: false
  };

  // Set up receipt status subscription
  setupReceiptSubscription(receiptId, subscription, options?.statusFilter);

  // Set up optional subscriptions
  if (options?.subscribeToLogs) {
    setupLogSubscription(receiptId, subscription);
  }
  if (options?.subscribeToComments) {
    setupCommentSubscription(receiptId, subscription);
  }

  unifiedReceiptSubscriptions.set(subscriptionKey, subscription);

  return () => cleanupUnifiedCallback(receiptId, callbackId);
};

// Helper function to set up receipt status subscription
const setupReceiptSubscription = (
  receiptId: string,
  subscription: UnifiedReceiptSubscription,
  statusFilter?: string[]
): void => {
  // Keep server-side binding simple to avoid Realtime binding mismatches; do status filtering client-side
  const filter = `id=eq.${receiptId}`;

  subscription.receiptChannel = supabase.channel(`unified-receipt-${receiptId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'receipts',
        filter
      },
      (payload) => {
        if (!canProcessReceiptUpdate(receiptId)) {
          return; // Rate limiting
        }

        subscription.lastActivity = Date.now();
        subscription.callbacks.forEach(callbacks => {
          if (callbacks.onReceiptUpdate) {
            try {
              callbacks.onReceiptUpdate(payload);
            } catch (error) {
              console.error('Error in unified receipt callback:', error);
            }
          }
        });
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED' && import.meta.env.DEV) {
        console.log(`✅ Unified receipt subscription active for ${receiptId}`);
      }
      if (err) {
        console.error('❌ Error in unified receipt subscription:', err);
      }
    });
};

// Helper function to set up processing logs subscription
const setupLogSubscription = (
  receiptId: string,
  subscription: UnifiedReceiptSubscription
): void => {
  subscription.subscriptionTypes.add('logs');

  subscription.logChannel = supabase.channel(`unified-logs-${receiptId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'processing_logs',
        filter: `receipt_id=eq.${receiptId}`
      },
      (payload) => {
        subscription.lastActivity = Date.now();
        subscription.callbacks.forEach(callbacks => {
          if (callbacks.onLogUpdate) {
            try {
              callbacks.onLogUpdate(payload);
            } catch (error) {
              console.error('Error in unified log callback:', error);
            }
          }
        });
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED' && import.meta.env.DEV) {
        console.log(`✅ Unified log subscription active for ${receiptId}`);
      }
      if (err) {
        console.error('❌ Error in unified log subscription:', err);
      }
    });
};

// Helper function to set up comments subscription
const setupCommentSubscription = (
  receiptId: string,
  subscription: UnifiedReceiptSubscription
): void => {
  subscription.subscriptionTypes.add('comments');

  subscription.commentChannel = supabase.channel(`unified-comments-${receiptId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'receipt_comments',
        filter: `receipt_id=eq.${receiptId}`
      },
      (payload) => {
        subscription.lastActivity = Date.now();
        subscription.callbacks.forEach(callbacks => {
          if (callbacks.onCommentUpdate) {
            try {
              callbacks.onCommentUpdate(payload);
            } catch (error) {
              console.error('Error in unified comment callback:', error);
            }
          }
        });
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED' && import.meta.env.DEV) {
        console.log(`✅ Unified comment subscription active for ${receiptId}`);
      }
      if (err) {
        console.error('❌ Error in unified comment subscription:', err);
      }
    });
};

// Helper function to clean up a specific callback
const cleanupUnifiedCallback = (receiptId: string, callbackId: string): void => {
  const subscriptionKey = `unified-receipt-${receiptId}`;
  const subscription = unifiedReceiptSubscriptions.get(subscriptionKey);

  if (!subscription || subscription.isCleaningUp) return;

  subscription.callbacks.delete(callbackId);

  // If no more callbacks, clean up the entire subscription
  if (subscription.callbacks.size === 0) {
    // Set cleanup flag to prevent race conditions
    subscription.isCleaningUp = true;

    // Only log cleanup in development
    if (import.meta.env.DEV) {
      console.log(`🧹 Cleaning up unified subscription for receipt ${receiptId} (no more callbacks)`);
    }

    // Use setTimeout to debounce cleanup and prevent rapid create/destroy cycles
    setTimeout(() => {
      // Double-check that no new callbacks were added during the timeout
      if (subscription.callbacks.size === 0) {
        subscription.receiptChannel?.unsubscribe();
        subscription.logChannel?.unsubscribe();
        subscription.commentChannel?.unsubscribe();

        unifiedReceiptSubscriptions.delete(subscriptionKey);
      } else {
        // Reset cleanup flag if new callbacks were added
        subscription.isCleaningUp = false;
      }
    }, 100); // 100ms debounce
  }
};

// OPTIMIZATION: Enhanced cleanup functions for all receipt subscriptions
export const cleanupReceiptSubscriptions = (): void => {
  console.log(`🧹 Cleaning up ${activeReceiptSubscriptions.size} legacy receipt subscriptions`);

  for (const [key, subscription] of activeReceiptSubscriptions) {
    try {
      subscription.channel.unsubscribe();
      console.log(`✅ Cleaned up legacy receipt subscription: ${key}`);
    } catch (error) {
      console.error(`❌ Error cleaning up legacy receipt subscription ${key}:`, error);
    }
  }

  activeReceiptSubscriptions.clear();
};

export const cleanupUnifiedReceiptSubscriptions = (): void => {
  console.log(`🧹 Cleaning up ${unifiedReceiptSubscriptions.size} unified receipt subscriptions`);

  for (const [key, subscription] of unifiedReceiptSubscriptions) {
    try {
      subscription.receiptChannel?.unsubscribe();
      subscription.logChannel?.unsubscribe();
      subscription.commentChannel?.unsubscribe();
      console.log(`✅ Cleaned up unified receipt subscription: ${key}`);
    } catch (error) {
      console.error(`❌ Error cleaning up unified receipt subscription ${key}:`, error);
    }
  }

  unifiedReceiptSubscriptions.clear();
};

export const cleanupAllReceiptSubscriptions = (): void => {
  cleanupReceiptSubscriptions();
  cleanupUnifiedReceiptSubscriptions();
};

// OPTIMIZATION: Enhanced receipt subscription statistics
export const getReceiptSubscriptionStats = (): {
  legacy: {
    activeSubscriptions: number;
    subscriptions: Array<{
      receiptId: string;
      callbackCount: number;
      age: number;
      lastActivity: number;
    }>;
  };
  unified: {
    activeSubscriptions: number;
    subscriptions: Array<{
      receiptId: string;
      callbackCount: number;
      subscriptionTypes: string[];
      age: number;
      lastActivity: number;
    }>;
  };
  total: {
    activeSubscriptions: number;
    totalCallbacks: number;
  };
} => {
  const now = Date.now();

  const legacyStats = {
    activeSubscriptions: activeReceiptSubscriptions.size,
    subscriptions: Array.from(activeReceiptSubscriptions.entries()).map(([key, sub]) => ({
      receiptId: key.replace('receipt-', ''),
      callbackCount: sub.callbacks.size,
      age: now - sub.createdAt,
      lastActivity: now - sub.lastActivity
    }))
  };

  const unifiedStats = {
    activeSubscriptions: unifiedReceiptSubscriptions.size,
    subscriptions: Array.from(unifiedReceiptSubscriptions.entries()).map(([key, sub]) => ({
      receiptId: key.replace('unified-receipt-', ''),
      callbackCount: sub.callbacks.size,
      subscriptionTypes: Array.from(sub.subscriptionTypes),
      age: now - sub.createdAt,
      lastActivity: now - sub.lastActivity
    }))
  };

  const totalCallbacks = legacyStats.subscriptions.reduce((sum, sub) => sum + sub.callbackCount, 0) +
                        unifiedStats.subscriptions.reduce((sum, sub) => sum + sub.callbackCount, 0);

  return {
    legacy: legacyStats,
    unified: unifiedStats,
    total: {
      activeSubscriptions: legacyStats.activeSubscriptions + unifiedStats.activeSubscriptions,
      totalCallbacks
    }
  };
};

// OPTIMIZATION: Get detailed subscription health metrics
export const getReceiptSubscriptionHealth = (): {
  healthScore: number;
  issues: string[];
  recommendations: string[];
} => {
  const stats = getReceiptSubscriptionStats();
  const issues: string[] = [];
  const recommendations: string[] = [];
  let healthScore = 100;

  // Check for too many subscriptions
  if (stats.total.activeSubscriptions > 20) {
    issues.push(`High number of active subscriptions: ${stats.total.activeSubscriptions}`);
    recommendations.push('Consider implementing more aggressive cleanup or connection pooling');
    healthScore -= 20;
  }

  // Check for stale subscriptions
  const now = Date.now();
  const staleThreshold = 30 * 60 * 1000; // 30 minutes

  const staleUnified = stats.unified.subscriptions.filter(sub => now - sub.lastActivity > staleThreshold);
  const staleLegacy = stats.legacy.subscriptions.filter(sub => now - sub.lastActivity > staleThreshold);

  if (staleUnified.length > 0 || staleLegacy.length > 0) {
    issues.push(`Stale subscriptions detected: ${staleUnified.length + staleLegacy.length}`);
    recommendations.push('Implement automatic cleanup of inactive subscriptions');
    healthScore -= 15;
  }

  // Check for legacy vs unified usage
  if (stats.legacy.activeSubscriptions > stats.unified.activeSubscriptions) {
    issues.push('More legacy subscriptions than unified subscriptions');
    recommendations.push('Migrate components to use unified subscription system');
    healthScore -= 10;
  }

  return {
    healthScore: Math.max(0, healthScore),
    issues,
    recommendations
  };
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

    // Notifications are now handled by database trigger only
    // This prevents duplicate notifications and ensures consistent titles
    console.log(`📢 Notification will be handled by database trigger for receipt ${id} status: ${processingStatus}`);

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
    result: AIResult;
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
          const processedResult = await processReceiptWithAI(receiptId, options);
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
