/**
 * CORS Test Panel Component
 * Provides UI for testing Edge Function CORS configuration
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TestTube, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  runCorsTestSuite,
  testUnifiedSearchCors,
  generateCorsTestReport,
  type CorsTestSuite
} from '@/utils/corsTestUtils';
import { toast } from 'sonner';

export function CorsTestPanel() {
  const { user } = useAuth();
  const [isTestingUnifiedSearch, setIsTestingUnifiedSearch] = useState(false);
  const [isTestingAllFunctions, setIsTestingAllFunctions] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, CorsTestSuite>>({});
  const [testReport, setTestReport] = useState<string>('');

  /**
   * Test unified-search Edge Function specifically
   */
  const handleTestUnifiedSearch = async () => {
    if (!user) {
      toast.error('Please log in to test authenticated requests');
      return;
    }

    setIsTestingUnifiedSearch(true);
    setTestReport('');

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        toast.error('No valid authentication token found');
        return;
      }

      console.log('🔍 Testing unified-search CORS configuration...');
      const testSuite = await testUnifiedSearchCors(authToken);
      
      setTestResults(prev => ({
        ...prev,
        'unified-search': testSuite
      }));

      const report = generateCorsTestReport(testSuite);
      setTestReport(report);
      console.log(report);

      // Show toast based on results
      const allPassed = testSuite.preflightTest.success && 
                       testSuite.actualRequestTest.success && 
                       testSuite.authenticationTest.success;
      
      if (allPassed) {
        toast.success('✅ All CORS tests passed for unified-search!');
      } else {
        toast.warning('⚠️ Some CORS tests failed. Check the report below.');
      }

    } catch (error) {
      console.error('CORS test error:', error);
      toast.error(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsTestingUnifiedSearch(false);
    }
  };

  /**
   * Test multiple Edge Functions
   */
  const handleTestAllFunctions = async () => {
    if (!user) {
      toast.error('Please log in to test authenticated requests');
      return;
    }

    setIsTestingAllFunctions(true);
    setTestReport('');

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        toast.error('No valid authentication token found');
        return;
      }

      const functionsToTest = [
        'unified-search',
        'semantic-search',
        'process-receipt',
        'generate-embeddings'
      ];

      const results: Record<string, CorsTestSuite> = {};
      let combinedReport = '\n🧪 Comprehensive CORS Test Report\n';
      combinedReport += '='.repeat(60) + '\n';

      for (const functionName of functionsToTest) {
        console.log(`Testing ${functionName}...`);
        
        try {
          const testSuite = functionName === 'unified-search' 
            ? await testUnifiedSearchCors(authToken)
            : await runCorsTestSuite(functionName, authToken);
          
          results[functionName] = testSuite;
          combinedReport += generateCorsTestReport(testSuite);
          combinedReport += '\n' + '-'.repeat(50) + '\n';
        } catch (error) {
          console.error(`Error testing ${functionName}:`, error);
          combinedReport += `\n❌ Error testing ${functionName}: ${error}\n\n`;
        }
      }

      setTestResults(results);
      setTestReport(combinedReport);
      console.log(combinedReport);

      // Count successful tests
      const totalTests = Object.values(results).length * 3; // 3 tests per function
      const passedTests = Object.values(results).reduce((count, suite) => {
        return count + 
          (suite.preflightTest.success ? 1 : 0) +
          (suite.actualRequestTest.success ? 1 : 0) +
          (suite.authenticationTest.success ? 1 : 0);
      }, 0);

      toast.success(`✅ CORS testing complete: ${passedTests}/${totalTests} tests passed`);

    } catch (error) {
      console.error('Comprehensive CORS test error:', error);
      toast.error(`Test suite failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsTestingAllFunctions(false);
    }
  };

  /**
   * Render test result badge
   */
  const renderTestBadge = (success: boolean, label: string) => (
    <Badge variant={success ? 'default' : 'destructive'} className="flex items-center gap-1">
      {success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            CORS Configuration Testing
          </CardTitle>
          <CardDescription>
            Test Edge Function CORS configuration for hybrid development (localhost frontend + production Supabase)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={handleTestUnifiedSearch}
              disabled={isTestingUnifiedSearch || !user}
              className="flex items-center gap-2"
            >
              {isTestingUnifiedSearch ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Test Unified Search
            </Button>

            <Button
              onClick={handleTestAllFunctions}
              disabled={isTestingAllFunctions || !user}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isTestingAllFunctions ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Test All Functions
            </Button>
          </div>

          {!user && (
            <Alert>
              <AlertDescription>
                Please log in to test authenticated Edge Function requests.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Results Summary */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(testResults).map(([functionName, suite]) => (
                <div key={functionName} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{functionName}</span>
                  <div className="flex gap-2">
                    {renderTestBadge(suite.preflightTest.success, 'Preflight')}
                    {renderTestBadge(suite.actualRequestTest.success, 'Request')}
                    {renderTestBadge(suite.authenticationTest.success, 'Auth')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Test Report */}
      {testReport && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Test Report</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96">
              {testReport}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
