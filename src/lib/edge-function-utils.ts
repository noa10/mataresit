/**
 * Utility functions for calling Supabase Edge Functions
 */

import { supabase } from '@/lib/supabase';

// The Supabase anon key - hardcoded for reliability
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

// The Supabase URL - for hybrid development setup (local frontend + production backend)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mpmkbtsufihzdelrlszs.supabase.co";

/**
 * Call a Supabase Edge Function with proper error handling
 *
 * @param functionName The name of the edge function to call
 * @param method The HTTP method to use (GET, POST, etc.)
 * @param body The request body (for POST, PUT, etc.)
 * @param queryParams Optional query parameters
 * @returns The response data
 */
export async function callEdgeFunction<T = any>(
  functionName: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: any,
  queryParams?: Record<string, string>,
  retries: number = 2, // Add retries parameter with default of 2 retries
  timeout: number = 60000 // Increased timeout to 60 seconds for complex search operations
): Promise<T> {
  try {
    // Get the session for the current user to include the auth token
    console.log(`🔍 DEBUG: Getting auth session for ${functionName}...`);

    // 🔧 FIX: Try to refresh the session first to ensure we have a valid token
    let { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // If no session or session error, try to refresh
    if (!session || sessionError) {
      console.log(`🔍 DEBUG: No session or session error, attempting refresh for ${functionName}...`);
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.warn(`🔍 DEBUG: Session refresh failed for ${functionName}:`, refreshError);
      } else if (refreshData.session) {
        console.log(`🔍 DEBUG: Session refreshed successfully for ${functionName}`);
        session = refreshData.session;
        sessionError = null;
      }
    }

    console.log(`🔍 DEBUG: Auth session for ${functionName}:`, {
      hasSession: !!session,
      sessionError: sessionError?.message,
      sessionKeys: session ? Object.keys(session) : [],
      tokenExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'unknown'
    });

    if (sessionError) {
      console.warn(`🔍 DEBUG: Session error for ${functionName}:`, sessionError);
    }

    const authToken = session?.access_token;

    console.log(`🔍 DEBUG: Auth token for ${functionName}:`, {
      hasToken: !!authToken,
      tokenType: typeof authToken,
      tokenLength: authToken?.length,
      tokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'null',
      isValidString: authToken && typeof authToken === 'string' && authToken.trim() !== ''
    });

    if (!authToken || typeof authToken !== 'string' || authToken.trim() === '') {
      console.warn(`🔍 DEBUG: No valid access token in session for ${functionName}, this may cause authentication issues`);
      // Don't throw an error, let the Edge Function handle the authentication
    } else {
      console.log(`🔍 DEBUG: Using user access token for ${functionName} Edge Function call`);
    }

    // Build the query string
    let queryString = '';
    if (queryParams) {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        params.append(key, value);
      });
      // Always add a timestamp to prevent caching
      params.append('t', Date.now().toString());
      queryString = `?${params.toString()}`;
    } else {
      // Just add a timestamp if no other query params
      queryString = `?t=${Date.now()}`;
    }

    // Build the URL
    const url = `${SUPABASE_URL}/functions/v1/${functionName}${queryString}`;

    console.log(`Calling edge function: ${functionName} (${method})`, { url, body });

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Make the request with timeout
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      // Add authorization header if we have a valid token
      if (authToken && typeof authToken === 'string' && authToken.trim() !== '') {
        headers['Authorization'] = `Bearer ${authToken}`;
      } else {
        // Fallback to anon key if no user token available
        headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        credentials: 'omit', // Don't send credentials with the request to avoid CORS issues
        signal: controller.signal,
        mode: 'cors', // Explicitly set CORS mode
        ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {})
      });

      // Clear the timeout since we got a response
      clearTimeout(timeoutId);

      // Check for HTTP errors
      if (!response.ok) {
        let errorMessage = `HTTP error ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // If we can't parse the error as JSON, try to get the text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = `${errorMessage}: ${errorText}`;
            }
          } catch (textError) {
            // If we can't get the text either, just use the status
          }
        }
        throw new Error(errorMessage);
      }

      // Parse the response with enhanced debugging
      console.log(`🔍 DEBUG: Response status for ${functionName}:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Get response text first for debugging
      const responseText = await response.text();
      console.log(`🔍 DEBUG: Raw response text for ${functionName}:`, {
        length: responseText.length,
        preview: responseText.substring(0, 200),
        isEmpty: responseText.trim() === ''
      });

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log(`🔍 DEBUG: Parsed JSON for ${functionName}:`, {
          hasData: !!data,
          dataType: typeof data,
          keys: data && typeof data === 'object' ? Object.keys(data) : [],
          success: data?.success,
          resultsLength: data?.results?.length
        });
      } catch (parseError) {
        console.error(`❌ JSON parse error for ${functionName}:`, parseError);
        console.error(`❌ Raw response that failed to parse:`, responseText);
        throw new Error(`Failed to parse JSON response from ${functionName}: ${parseError.message}`);
      }

      return data as T;
    } finally {
      // Ensure timeout is cleared in all cases
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Check if this was a timeout
    if (error.name === 'AbortError') {
      console.error(`Edge function ${functionName} call timed out after ${timeout}ms`);

      // If we have retries left, try again
      if (retries > 0) {
        console.log(`Retrying edge function ${functionName} call (${retries} retries left)...`);
        return callEdgeFunction(functionName, method, body, queryParams, retries - 1, timeout);
      }

      throw new Error(`Edge function ${functionName} call timed out after ${timeout}ms and ${2 - retries} retries`);
    }

    // Check for CORS errors or network errors (which often appear as 'TypeError: Failed to fetch')
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      const possibleCauses = [
        'CORS issue: The edge function doesn\'t allow requests from this origin',
        'Network error: Check your internet connection',
        'Edge function errors: The function might be failing to start or crashing',
        'Auth issues: Check that the auth token is valid'
      ];

      console.error(`Likely CORS or network error when calling function ${functionName}:`, {
        errorType: error.name,
        errorMessage: error.message,
        possibleCauses,
        requestDetails: {
          url: `${SUPABASE_URL}/functions/v1/${functionName}`,
          method,
          hasBody: !!body
        }
      });

      // If we have retries left, try again
      if (retries > 0) {
        console.log(`Retrying after network error for ${functionName} (${retries} retries left)...`);
        // Add a short delay before retrying to allow any temporary network issues to resolve
        await new Promise(resolve => setTimeout(resolve, 1000));
        return callEdgeFunction(functionName, method, body, queryParams, retries - 1, timeout);
      }

      // Create a more informative error
      throw new Error(`Network error calling ${functionName}: ${error.message}. Possible causes: CORS restrictions, network connectivity, or function errors.`);
    }

    // Log detailed error information for debugging
    console.error(`Error calling edge function ${functionName}:`, {
      errorType: error.name || typeof error,
      errorMessage: error.message || String(error),
      stack: error.stack,
      url: `${SUPABASE_URL}/functions/v1/${functionName}`,
      method,
      bodySize: body ? JSON.stringify(body).length : 0
    });

    throw error;
  }
}

/**
 * Tests the connection to the Gemini API via the semantic search edge function
 */
export async function testGeminiConnection() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/semantic-search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          testGeminiConnection: true
        })
      }
    );

    // Handle non-successful responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error testing Gemini connection:', errorText);
      return {
        success: false,
        message: `Error response: ${response.status} ${response.statusText}`,
        errorData: errorText
      };
    }

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        message: data.testResult || 'Connection successful',
        modelInfo: data.modelInfo || '',
        dimensionCount: 1536 // Default value for Gemini embedding dimensions
      };
    } else {
      return {
        success: false,
        message: data.error || 'Unknown error'
      };
    }
  } catch (error) {
    console.error('Error in testGeminiConnection:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Checks if the Gemini API key is set in the Supabase environment
 */
export async function checkGeminiApiKey() {
  try {
    // This requires a server-side or Edge Function call
    // We'll use our semantic-search endpoint with a test parameter
    const result = await testGeminiConnection();

    return {
      keyExists: result.success,
      message: result.message
    };
  } catch (error) {
    console.error('Error checking Gemini API key:', error);
    return {
      keyExists: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Tests CORS for a specific edge function
 */
export async function testEdgeFunctionCORS(functionName: string) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`CORS test error for ${functionName}:`, error);
    return false;
  }
}

/**
 * Tests CORS for all relevant edge functions
 */
export async function testAllEdgeFunctionsCORS() {
  const functions = [
    'semantic-search',
    'generate-embeddings',
    'generate-thumbnails',
    'process-receipt',
    'enhance-receipt-data',
    'generate-pdf-report',
    'audit-embeddings',
    'unified-search'
  ];

  const results: Record<string, boolean> = {};

  await Promise.all(
    functions.map(async (funcName) => {
      results[funcName] = await testEdgeFunctionCORS(funcName);
    })
  );

  return results;
}

// ===== EMBEDDING REPAIR FUNCTIONS =====

/**
 * Call the audit-embeddings function
 */
export async function auditEmbeddings(): Promise<any> {
  return callEdgeFunction('audit-embeddings', 'POST', { action: 'audit' });
}

/**
 * Migrate embeddings to unified format
 */
export async function migrateEmbeddings(): Promise<any> {
  return callEdgeFunction('audit-embeddings', 'POST', { action: 'migrate' });
}

/**
 * Fix embedding content issues
 */
export async function fixEmbeddingContent(): Promise<any> {
  return callEdgeFunction('audit-embeddings', 'POST', { action: 'fix_content' });
}

/**
 * Generate missing embeddings
 */
export async function generateMissingEmbeddings(): Promise<any> {
  return callEdgeFunction('audit-embeddings', 'POST', { action: 'generate_missing' });
}

/**
 * Process a batch of missing embeddings
 */
export async function processMissingEmbeddingsBatch(batchSize: number = 10): Promise<any> {
  return callEdgeFunction('generate-embeddings', 'POST', {
    processMissingBatch: true,
    batchSize
  }, undefined, 2, 60000); // Longer timeout for batch processing
}

/**
 * Generate embeddings for a specific receipt
 */
export async function generateReceiptEmbeddings(
  receiptId: string,
  options?: {
    processAllFields?: boolean;
    forceRegenerate?: boolean;
    contentTypes?: string[];
  }
): Promise<any> {
  const { processAllFields = true, forceRegenerate = false, contentTypes } = options || {};

  return callEdgeFunction('generate-embeddings', 'POST', {
    receiptId,
    processAllFields,
    forceRegenerate,
    contentTypes
  }, undefined, 2, 30000);
}

/**
 * Check embedding status for a receipt
 */
export async function checkEmbeddingStatus(receiptId: string): Promise<any> {
  return callEdgeFunction('generate-embeddings', 'GET', undefined, { receiptId });
}

/**
 * Map frontend source names (plural) to backend source names (singular)
 */
function mapFrontendSourcesToBackend(frontendSources: string[]): string[] {
  const sourceMapping: Record<string, string> = {
    'receipts': 'receipt',
    'claims': 'claim',
    'team_members': 'team_member',
    'custom_categories': 'custom_category',
    'business_directory': 'business_directory', // Same
    'conversations': 'conversation'
  };

  return frontendSources.map(source => sourceMapping[source] || source);
}

/**
 * Perform unified search
 */
export async function performUnifiedSearch(
  query: string,
  options?: {
    sources?: string[]; // Changed from sourceTypes to sources for consistency
    contentTypes?: string[];
    similarityThreshold?: number;
    limit?: number; // Changed from matchCount to limit for consistency
    userFilter?: string;
    teamFilter?: string;
  }
): Promise<any> {
  // Map frontend source names to backend source names if sources are provided
  const mappedSources = options?.sources ? mapFrontendSourcesToBackend(options.sources) : undefined;

  // Build the request payload with proper parameter names
  const requestPayload = {
    query,
    sources: mappedSources, // Use mapped sources
    contentTypes: options?.contentTypes,
    similarityThreshold: options?.similarityThreshold,
    limit: options?.limit, // Use limit instead of matchCount
    filters: {
      userFilter: options?.userFilter,
      teamFilter: options?.teamFilter
    }
  };

  // Remove undefined values to avoid sending them to the edge function
  Object.keys(requestPayload).forEach(key => {
    if (requestPayload[key as keyof typeof requestPayload] === undefined) {
      delete requestPayload[key as keyof typeof requestPayload];
    }
  });

  return callEdgeFunction('unified-search', 'POST', requestPayload, undefined, 2, 15000);
}

/**
 * Perform semantic search (fallback)
 */
export async function performSemanticSearch(
  query: string,
  options?: {
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    merchants?: string[];
    categories?: string[];
  }
): Promise<any> {
  return callEdgeFunction('semantic-search', 'POST', {
    query,
    ...options
  }, undefined, 2, 15000);
}
