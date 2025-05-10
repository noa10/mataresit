import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { testGeminiConnection } from '../../lib/edge-function-utils';

interface PgVectorStatusResponse {
  extension_exists: boolean;
  vector_table_exists: boolean;
  api_key_exists?: boolean; // Make this optional or ensure it's always returned by your RPC
}

export function ApiConnectionTest() {
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isTestingPgVector, setIsTestingPgVector] = useState(false);
  const [geminiResult, setGeminiResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pgVectorResult, setPgVectorResult] = useState<{ success: boolean; message: string } | null>(null);

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

  const testPgVectorSetup = async () => {
    setIsTestingPgVector(true);
    setPgVectorResult(null);

    try {
      // Test if pgvector is properly set up
      const { data: pgStatusJson, error: pgError } = await supabase.rpc('check_pgvector_status');

      if (pgError) {
        setPgVectorResult({
          success: false,
          message: `Error checking pgVector status: ${pgError.message}`
        });
        return;
      }

      // Check if pgStatusJson is a non-null object and not an array
      if (pgStatusJson && typeof pgStatusJson === 'object' && !Array.isArray(pgStatusJson)) {
        // Cast to unknown first, then to our specific interface
        const pgStatus = pgStatusJson as unknown as PgVectorStatusResponse;

        // It's a good idea to also check for the existence of the properties 
        // if their presence is not absolutely guaranteed by the RPC.
        if (typeof pgStatus.extension_exists === 'boolean' && typeof pgStatus.vector_table_exists === 'boolean') {
          if (pgStatus.extension_exists && pgStatus.vector_table_exists) {
            setPgVectorResult({
              success: true,
              message: 'pgvector extension and tables are properly set up!'
            });
          } else if (pgStatus.extension_exists) {
            setPgVectorResult({
              success: false,
              message: 'pgvector extension is installed but receipt_embeddings table is missing'
            });
          } else {
            setPgVectorResult({
              success: false,
              message: 'pgvector extension is not enabled in the database'
            });
          }
        } else {
          // This case handles if the object doesn't have the expected boolean properties
          setPgVectorResult({
            success: false,
            message: 'pgvector status response did not have the expected structure (missing boolean flags).'
          });
        }
      } else {
        setPgVectorResult({
          success: false,
          message: 'Unable to determine pgvector status or response was not a valid object.'
        });
      }
    } catch (error) {
      setPgVectorResult({
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setIsTestingPgVector(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Test</CardTitle>
        <CardDescription>Test your Gemini API and pgvector setup</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Gemini API Connection</h3>
            {geminiResult && (
              <Badge variant={geminiResult.success ? "default" : "destructive"} className={geminiResult.success ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                {geminiResult.success ? "Connected" : "Failed"}
              </Badge>
            )}
          </div>
          {geminiResult && (
            <Alert variant={geminiResult.success ? "default" : "destructive"}>
              <AlertTitle>{geminiResult.success ? "Success" : "Error"}</AlertTitle>
              <AlertDescription>{geminiResult.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">pgvector Setup</h3>
            {pgVectorResult && (
              <Badge variant={pgVectorResult.success ? "default" : "destructive"} className={pgVectorResult.success ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                {pgVectorResult.success ? "Enabled" : "Issue Detected"}
              </Badge>
            )}
          </div>
          {pgVectorResult && (
            <Alert variant={pgVectorResult.success ? "default" : "destructive"}>
              <AlertTitle>{pgVectorResult.success ? "Success" : "Error"}</AlertTitle>
              <AlertDescription>{pgVectorResult.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleGeminiTest}
          disabled={isTestingGemini}
        >
          {isTestingGemini ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Gemini...
            </>
          ) : (
            <>Test Gemini Connection</>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={testPgVectorSetup}
          disabled={isTestingPgVector}
        >
          {isTestingPgVector ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing pgvector...
            </>
          ) : (
            <>Test pgvector Setup</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
