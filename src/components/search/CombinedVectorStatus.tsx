
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCcw, Loader2, Database, BrainCircuit, RefreshCw, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { supabase } from '@/lib/supabase';
import { testGeminiConnection, checkGeminiApiKey, testEdgeFunctionCORS, testAllEdgeFunctionsCORS, SUPABASE_URL } from '@/lib/edge-function-utils';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import { generateEmbeddings, generateAllEmbeddings, checkLineItemEmbeddings, generateLineItemEmbeddings } from '@/lib/ai-search';
import { useAuth } from '@/contexts/AuthContext';
import { Session } from '@supabase/supabase-js';

export function CombinedVectorStatus() {
  // Vector status state
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // Get auth context
  const { user } = useAuth();

  // Gemini connection state
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiResult, setGeminiResult] = useState<{ success: boolean; message: string } | null>(null);

  // Embedding generation state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [processedReceipts, setProcessedReceipts] = useState(0);
  const [embeddingStats, setEmbeddingStats] = useState<{
    total: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
  } | null>({
    total: 0,
    withEmbeddings: 0,
    withoutEmbeddings: 0
  });

  // Line item embedding state
  const [isGeneratingLineItemEmbeddings, setIsGeneratingLineItemEmbeddings] = useState(false);
  const [lineItemEmbeddingProgress, setLineItemEmbeddingProgress] = useState(0);
  const [totalLineItems, setTotalLineItems] = useState(0);
  const [processedLineItems, setProcessedLineItems] = useState(0);
  const [lineItemEmbeddingStats, setLineItemEmbeddingStats] = useState<{
    total: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
  } | null>({
    total: 0,
    withEmbeddings: 0,
    withoutEmbeddings: 0
  });

  // CORS testing state
  const [isTestingCORS, setIsTestingCORS] = useState(false);
  const [corsResults, setCorsResults] = useState<Record<string, boolean> | null>(null);

  const checkPgvectorStatus = async () => {
    try {
      setIsChecking(true);
      setStatus('loading');

      // Call the PostgreSQL function
      const { data: rpcData, error: rpcError } = await supabase.rpc('check_pgvector_status');

      if (rpcError) {
        console.error('Error calling check_pgvector_status RPC:', rpcError);
        setStatus('error');
        setMessage(`Error checking status: ${rpcError.message}`);
        setIsChecking(false);
        return;
      }

      console.log('RPC check_pgvector_status result:', rpcData);

      const {
        extension_exists: pgvectorEnabled,
        vector_table_exists: tableExists,
      } = rpcData as { extension_exists: boolean; vector_table_exists: boolean; api_key_exists: boolean };

      // Check if the Gemini API key is set (client-side/edge function check)
      const keyCheckResult = await checkGeminiApiKey();
      console.log('Gemini API key check result:', keyCheckResult);
      const apiKeyExists = keyCheckResult.keyExists;

      // Check Gemini API connection
      const geminiTest = await testGeminiConnection();
      console.log('Gemini API test result:', geminiTest);
      setGeminiResult(geminiTest);

      if (!apiKeyExists) {
        setStatus('disabled');
        setMessage('Gemini API key is missing. Please set the GEMINI_API_KEY in your Supabase project environment variables.');
      } else if (!pgvectorEnabled) {
        setStatus('disabled');
        setMessage('pgvector extension is not enabled. Run the SQL migration to enable it.');
      } else if (!tableExists) {
        setStatus('disabled');
        setMessage('pgvector extension is installed but receipt_embeddings table is missing. Apply the database migration.');
      } else {
        setStatus('enabled');
        setMessage('Gemini API key, pgvector extension, and receipt_embeddings table are all properly set up!');
      }
    } catch (err) {
      console.error('Unexpected error checking pgvector status:', err);
      setStatus('error');
      setMessage(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleGeminiTest = async () => {
    setIsTestingGemini(true);
    setGeminiResult(null);

    try {
      console.log('Testing Gemini API connection using utility function...');

      // Use the utility function to test the Gemini connection
      const result = await testGeminiConnection();

      setGeminiResult({
        success: result.success,
        message: result.success
          ? `Successfully connected to Gemini API. Embedding dimension: ${result.dimensionCount}`
          : `Error: ${result.message}`
      });
    } catch (error) {
      console.error('Gemini test error:', error);
      setGeminiResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  // Function to check embedding statistics
  const checkEmbeddingStats = async () => {
    try {
      console.log('CVS: checkEmbeddingStats CALLED');

      // Log auth context user information
      console.log('CVS: Auth context user:', user ? `ID: ${user.id}, Email: ${user.email}` : 'Not authenticated');

      // Check if we have an authenticated user from context
      if (!user) {
        console.error('CVS: No authenticated user found in AuthContext. Stats will be empty.');
        setEmbeddingStats({
          total: 0,
          withEmbeddings: 0,
          withoutEmbeddings: 0
        });
        return {
          total: 0,
          withEmbeddings: 0,
          withoutEmbeddings: 0
        };
      }

      // Ensure we have a valid session before proceeding
      const session = await refreshSession();
      if (!session) {
        console.error('CVS: Failed to get or refresh Supabase session. Stats will be empty.');
        setEmbeddingStats({
          total: 0,
          withEmbeddings: 0,
          withoutEmbeddings: 0
        });
        return {
          total: 0,
          withEmbeddings: 0,
          withoutEmbeddings: 0
        };
      }

      console.log('CVS: Using validated session for queries. User ID:', session.user.id);

      // Get total number of receipts
      console.log('CVS: Querying total receipts count...');
      const { count: totalCount, error: totalError, data: totalData, status: totalStatus } = await supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true });

      console.log('CVS: Total receipts query DONE. Error:', totalError, 'Count:', totalCount, 'Data:', totalData, 'Status:', totalStatus);

      if (totalError) {
        console.error('CVS: Error getting total receipt count:', totalError);
      }

      console.log(`CVS: Raw totalCount from query: ${totalCount}`);

      // Get number of receipts with embeddings
      console.log('CVS: Querying receipts_embeddings count...');
      const { count: embeddingsCount, error: embeddingsError, data: embeddingsData, status: embeddingsStatus } = await supabase
        .from('receipt_embeddings')
        .select('receipt_id', { count: 'exact', head: true });

      console.log('CVS: Receipts_embeddings query DONE. Error:', embeddingsError, 'Count:', embeddingsCount, 'Data:', embeddingsData, 'Status:', embeddingsStatus);

      if (embeddingsError) {
        // If the table doesn't exist yet, just set count to 0
        if (embeddingsError.message.includes('does not exist')) {
          console.log('CVS: receipt_embeddings table does not exist yet');
          const stats = {
            total: totalCount || 0,
            withEmbeddings: 0,
            withoutEmbeddings: totalCount || 0
          };

          setEmbeddingStats(stats);
          return stats;
        }

        console.error('CVS: Error getting embeddings count:', embeddingsError);
      }
      console.log(`CVS: Raw embeddingsCount from query: ${embeddingsCount}`);

      // Calculate stats
      const total = totalCount || 0;
      const withEmbeddings = embeddingsCount || 0;
      const withoutEmbeddings = total - withEmbeddings;

      const stats = {
        total,
        withEmbeddings,
        withoutEmbeddings
      };

      console.log('CVS: Calculated stats:', stats);
      setEmbeddingStats(stats);

      return stats;
    } catch (error) {
      console.error('CVS: Error in checkEmbeddingStats general catch:', error);
      // Set default stats on error
      const defaultStats = {
        total: 0,
        withEmbeddings: 0,
        withoutEmbeddings: 0
      };
      setEmbeddingStats(defaultStats);
      return defaultStats;
    }
  };

  // Function to generate embeddings for all receipts
  const handleGenerateAllEmbeddings = async () => {
    setIsGeneratingEmbeddings(true);
    setEmbeddingProgress(0);
    setProcessedReceipts(0);

    try {
      // First ensure we have a valid session
      await refreshSession();
      
      // Test CORS headers to see if the edge function is accessible
      console.log('Testing CORS headers for generate-embeddings edge function...');
      const corsOk = await testEdgeFunctionCORS('generate-embeddings');
      
      if (!corsOk) {
        console.warn('CORS test failed for generate-embeddings. Will proceed but may fall back to database function.');
      } else {
        console.log('CORS test passed for generate-embeddings edge function.');
      }

      // Check current embedding stats before starting
      const stats = await checkEmbeddingStats();
      if (!stats) {
        throw new Error('Failed to get embedding statistics');
      }

      // Get receipts without embeddings
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('id')
        .order('created_at', { ascending: false });

      if (receiptsError) {
        throw receiptsError;
      }

      if (!receipts || receipts.length === 0) {
        console.log('No receipts found to process');
        setIsGeneratingEmbeddings(false);
        return;
      }

      console.log(`Found ${receipts.length} receipts to process`);
      setTotalReceipts(receipts.length);

      // Process receipts in batches to avoid overwhelming the system
      const batchSize = 5;
      const batches = [];

      for (let i = 0; i < receipts.length; i += batchSize) {
        batches.push(receipts.slice(i, i + batchSize));
      }

      console.log(`Processing receipts in ${batches.length} batches of ${batchSize}`);

      let processedCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i+1} of ${batches.length}`);

        // Process each receipt in the batch
        await Promise.all(
          batch.map(async (receipt) => {
            try {
              // Check if this receipt already has embeddings
              const { count, error: countError } = await supabase
                .from('receipt_embeddings')
                .select('id', { count: 'exact', head: true })
                .eq('receipt_id', receipt.id);

              if (countError) {
                console.error(`Error checking embeddings for receipt ${receipt.id}:`, countError);
                return;
              }

              // Only generate embeddings if none exist
              if (!count || count === 0) {
                console.log(`Generating embeddings for receipt ${receipt.id}`);
                await generateEmbeddings(receipt.id);
              } else {
                console.log(`Receipt ${receipt.id} already has embeddings`);
              }

              processedCount++;
              setProcessedReceipts(processedCount);
              const progress = (processedCount / receipts.length) * 100;
              setEmbeddingProgress(Math.min(progress, 100));
            } catch (error) {
              console.error(`Error processing receipt ${receipt.id}:`, error);
            }
          })
        );

        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          console.log('Waiting before processing next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log('Finished processing all receipts');

      // Update stats after completion
      await checkEmbeddingStats();
    } catch (error) {
      console.error('Error generating embeddings:', error);
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  // Function to refresh and validate the Supabase session
  const refreshSession = async (): Promise<Session | null> => {
    // Only attempt to refresh if we have a user from AuthContext
    if (!user) {
      console.warn('CVS: No user in AuthContext, not attempting to refresh session');
      return null;
    }

    try {
      console.log('CVS: Refreshing Supabase session...');
      
      // First check if we already have a valid session
      const { data: { session }, error: getSessionError } = await supabase.auth.getSession();
      
      if (getSessionError) {
        console.error('CVS: Error getting session:', getSessionError);
      }
      
      if (session && session.user.id === user.id) {
        console.log('CVS: Session already valid and matches AuthContext user');
        return session;
      }
      
      // If we reach here, there's no valid session or it doesn't match our user
      console.log('CVS: No valid session found. Attempting to manually set session from AuthContext user');

      // Get a fresh JWT from somewhere - this is a workaround
      // The following approach uses localStorage as many auth systems use it to store tokens
      try {
        // Try to find a JWT in localStorage
        const localStorageKeys = Object.keys(localStorage);
        let authData = null;
        
        // Look for likely Supabase auth storage keys
        for (const key of localStorageKeys) {
          if (key.includes('supabase.auth') || key.includes('auth')) {
            try {
              const value = localStorage.getItem(key);
              if (value) {
                const parsed = JSON.parse(value);
                if (parsed.access_token || parsed.token || parsed.session) {
                  console.log(`CVS: Found potential auth data in localStorage key: ${key}`);
                  authData = parsed;
                  break;
                }
              }
            } catch (e) {
              console.log(`CVS: Error parsing localStorage key ${key}:`, e);
            }
          }
        }
        
        // Use the auth data if found
        if (authData && (authData.access_token || (authData.session && authData.session.access_token))) {
          const accessToken = authData.access_token || authData.session.access_token;
          const refreshToken = authData.refresh_token || (authData.session && authData.session.refresh_token);
          
          if (accessToken && refreshToken) {
            console.log('CVS: Attempting to manually set session with tokens from localStorage');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('CVS: Error manually setting session:', error);
            } else if (data.session) {
              console.log('CVS: Successfully set session manually!', 'User ID:', data.session.user.id);
              return data.session;
            }
          }
        } else {
          console.log('CVS: No suitable auth data found in localStorage');
        }
      } catch (localStorageError) {
        console.error('CVS: Error accessing localStorage:', localStorageError);
      }
      
      console.error('CVS: Unable to establish a valid session. RLS queries will return empty results.');
      return null;
    } catch (error) {
      console.error('CVS: Unexpected error refreshing session:', error);
      return null;
    }
  };

  // Function to test CORS for all edge functions
  const handleTestCORS = async () => {
    setIsTestingCORS(true);
    setCorsResults(null);

    try {
      // Use the utility function to test CORS
      const results = await testAllEdgeFunctionsCORS();
      setCorsResults(results);
    } catch (error) {
      console.error('CORS test error:', error);
      setCorsResults({
        error: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      } as any);
    } finally {
      setIsTestingCORS(false);
    }
  };

  // Function to specifically test the generate-thumbnails function
  const testGenerateThumbnails = async () => {
    setIsTestingCORS(true);
    
    try {
      // First, test CORS with OPTIONS
      const corsResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-thumbnails`, {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('CORS Test Response:', corsResponse);
      
      if (!corsResponse.ok) {
        alert(`CORS Test Failed! Status: ${corsResponse.status}`);
        setIsTestingCORS(false);
        return;
      }
      
      // Then test a batch process call
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-thumbnails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          batchProcess: true,
          limit: 5
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`Generate Thumbnails Test Success!
Processed: ${result.processed}, Errors: ${result.errors}`);
      } else {
        alert(`Generate Thumbnails Test Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Generate Thumbnails Test Error:', error);
      alert(`Generate Thumbnails Test Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsTestingCORS(false);
    }
  };

  // Function to check line item embedding statistics
  const checkLineItemEmbeddingStats = async () => {
    try {
      console.log('CVS: checkLineItemEmbeddingStats CALLED');

      // Validate session first
      const session = await refreshSession();
      if (!session) {
        console.error('Failed to refresh session for line item embedding check');
        return;
      }

      const result = await checkLineItemEmbeddings();
      console.log('Line item embedding check result:', result);

      setLineItemEmbeddingStats({
        total: result.total || 0,
        withEmbeddings: result.withEmbeddings || 0,
        withoutEmbeddings: result.withoutEmbeddings || 0
      });
    } catch (error) {
      console.error('Error checking line item embedding stats:', error);
    }
  };

  // Refresh session before initial checks
  const initComponent = async () => {
    if (user) {
      await refreshSession();
    }
    checkPgvectorStatus();
    checkEmbeddingStats();
    checkLineItemEmbeddingStats();
  };

  useEffect(() => {
    initComponent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 text-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vector Database Status Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              <h3 className="font-medium">Vector Database</h3>
            </div>
            <Badge variant={status === 'enabled' ? "default" : "outline"}
              className={status === 'enabled' ? "bg-green-900 text-green-100" : "bg-yellow-900 text-yellow-100"}>
              {status === 'loading' ? 'Checking...' :
               status === 'enabled' ? 'Ready' :
               status === 'disabled' ? 'Needs Setup' : 'Error'}
            </Badge>
          </div>

          <div className="text-sm">
            {status === 'loading' ? (
              <div className="flex items-center text-gray-400">
                <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                Checking vector database status...
              </div>
            ) : (
              <p className={status === 'error' ? "text-red-400" :
                          status === 'disabled' ? "text-yellow-400" : "text-gray-300"}>
                {message}
              </p>
            )}

            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={checkPgvectorStatus}
                disabled={isChecking}
                className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700"
              >
                {isChecking ? (
                  <>
                    <RefreshCcw className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>Refresh Status</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Gemini API Connection Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <BrainCircuit className="h-5 w-5 mr-2" />
              <h3 className="font-medium">Gemini API</h3>
            </div>
            {geminiResult && (
              <Badge variant={geminiResult.success ? "default" : "destructive"}
                className={geminiResult.success ? "bg-green-900 text-green-100" : "bg-red-900 text-red-100"}>
                {geminiResult.success ? "Connected" : "Failed"}
              </Badge>
            )}
          </div>

          <div className="text-sm">
            {isTestingGemini ? (
              <div className="flex items-center text-gray-400">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing Gemini API connection...
              </div>
            ) : geminiResult ? (
              <p className={geminiResult.success ? "text-gray-300" : "text-red-400"}>
                {geminiResult.message}
              </p>
            ) : (
              <p className="text-gray-400">
                Click the button below to test the Gemini API connection.
              </p>
            )}

            <div className="mt-4">
              <Button
                variant="outline"
                onClick={handleGeminiTest}
                disabled={isTestingGemini}
                size="sm"
                className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700"
              >
                {isTestingGemini ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>Test Connection</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CORS Status Test Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            <h3 className="font-medium">Edge Function CORS</h3>
          </div>
          {corsResults && (
            <Badge 
              variant={Object.values(corsResults).every(Boolean) ? "default" : "destructive"}
              className={Object.values(corsResults).every(Boolean) ? "bg-green-900 text-green-100" : "bg-yellow-900 text-yellow-100"}
            >
              {Object.values(corsResults).every(Boolean) ? "All Passing" : "Issues Detected"}
            </Badge>
          )}
        </div>

        <div className="text-sm">
          {isTestingCORS ? (
            <div className="flex items-center text-gray-400">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing CORS configuration for edge functions...
            </div>
          ) : corsResults ? (
            <div className="space-y-2">
              {Object.entries(corsResults).map(([funcName, passing]) => (
                <div key={funcName} className="flex items-center justify-between">
                  <span>{funcName}</span>
                  {passing ? (
                    <Badge variant="default" className="bg-green-900 text-green-100">Passing</Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-900 text-red-100">Failed</Badge>
                  )}
                </div>
              ))}
              
              <p className="mt-2 text-gray-400">
                {Object.values(corsResults).every(Boolean) 
                  ? "All edge functions are configured correctly for CORS." 
                  : "Some edge functions have CORS issues. Consider redeploying them with the correct CORS headers."}
              </p>
            </div>
          ) : (
            <p className="text-gray-400">
              Test if edge functions are properly configured for CORS by clicking the button below.
            </p>
          )}

          <div className="mt-4">
            <Button
              variant="outline"
              onClick={handleTestCORS}
              disabled={isTestingCORS}
              size="sm"
              className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              {isTestingCORS ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Testing CORS...
                </>
              ) : (
                <>Test Edge Function CORS</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Embedding Generation Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="mb-4">
          <h3 className="font-medium">Embedding Generation</h3>
          <p className="text-sm text-gray-400 mt-1">
            Generate vector embeddings for your receipts to enable semantic search
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-sm text-gray-300">
            <div>
              <span className="font-medium">Total Receipts:</span> {embeddingStats?.total || 0}
            </div>
            <div>
              <span className="font-medium">With Embeddings:</span> {embeddingStats?.withEmbeddings || 0}
            </div>
            <div>
              <span className="font-medium">Without Embeddings:</span> {embeddingStats?.withoutEmbeddings || 0}
            </div>
          </div>

          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${(embeddingStats?.total || 0) > 0 ? ((embeddingStats?.withEmbeddings || 0) / (embeddingStats?.total || 1)) * 100 : 0}%` }}
            ></div>
          </div>

          {isGeneratingEmbeddings && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Generating embeddings...</span>
                <span>{processedReceipts} of {totalReceipts}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${embeddingProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                console.log('Refresh Stats button clicked');
                if (user) {
                  await refreshSession();
                }
                checkEmbeddingStats();
              }}
              disabled={isGeneratingEmbeddings}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Refresh Stats
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => {
                console.log('Generate Missing Embeddings button clicked');
                handleGenerateAllEmbeddings();
              }}
              disabled={isGeneratingEmbeddings || status !== 'enabled'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGeneratingEmbeddings ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate Missing Embeddings</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
