import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { supabase } from '@/lib/supabase';

export function VectorStatusCheck() {
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const checkPgvectorStatus = async () => {
    try {
      setIsChecking(true);
      setStatus('loading');

      // Check if pgvector extension is enabled
      const { data: extensionData, error: extensionError } = await supabase
        .rpc('check_pgvector_status');

      // Check Gemini API key via edge function
      const { data: geminiKeyData, error: geminiKeyError } = await supabase
        .functions.invoke('check-gemini-key');

      if (extensionError) {
        setStatus('error');
        setMessage(`Error checking pgvector: ${extensionError.message}`);
        return;
      }

      if (geminiKeyError) {
        console.error('Error checking Gemini API key:', geminiKeyError);
        // Continue with pgvector check even if Gemini key check fails
      }

      // Combine the results
      const combinedData = {
        ...extensionData,
        api_key_exists: geminiKeyData?.keyExists ?? extensionData.api_key_exists
      };

      handleStatusResult(combinedData);
    } catch (err) {
      setStatus('error');
      setMessage(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleStatusResult = (data: any) => {
    if (data) {
      // Check API key first
      if (!data.api_key_exists) {
        setStatus('disabled');
        setMessage('Gemini API key is missing. Please set the GEMINI_API_KEY in your Supabase edge function environment variables.');
        return;
      }

      // Then check vector extension
      if (data.extension_exists) {
        if (data.vector_table_exists) {
          setStatus('enabled');
          setMessage('Gemini API key, pgvector extension, and receipt_embeddings table are all properly set up!');
        } else {
          setStatus('disabled');
          setMessage('pgvector extension is installed but receipt_embeddings table is missing. Apply the database migration.');
        }
      } else {
        setStatus('disabled');
        setMessage('pgvector extension is not enabled. Run the SQL migration to enable it.');
      }
    } else {
      setStatus('error');
      setMessage('Unable to determine vector database status.');
    }
  };

  useEffect(() => {
    checkPgvectorStatus();
  }, []);

  return (
    <Alert variant={status === 'enabled' ? 'default' : 'destructive'} className={status === 'disabled' ? 'border-yellow-500 bg-yellow-500/10' : ''}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {status === 'loading' ? (
            <RefreshCcw className="h-5 w-5 animate-spin" />
          ) : status === 'enabled' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : status === 'disabled' ? (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1">
          <AlertTitle>
            {status === 'loading' && 'Checking vector database status...'}
            {status === 'enabled' && 'Vector search is enabled'}
            {status === 'disabled' && 'Vector search is not fully configured'}
            {status === 'error' && 'Error checking vector status'}
          </AlertTitle>
          <AlertDescription className="mt-1">
            {message}
            {status !== 'loading' && (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkPgvectorStatus}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <>
                      <RefreshCcw className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    'Check Again'
                  )}
                </Button>
              </div>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
