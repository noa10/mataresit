/**
 * Test component to verify BatchUploadZone can be imported without ProgressTrackingService errors
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function BatchUploadZoneTest() {
  const [testStatus, setTestStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const testBatchUploadZoneImport = async () => {
    try {
      setTestStatus('pending');
      
      // Test importing BatchUploadZone component
      console.log('Testing BatchUploadZone import...');
      const { BatchUploadZone } = await import('@/components/BatchUploadZone');
      
      console.log('✅ BatchUploadZone imported successfully!');
      setTestStatus('success');
      
    } catch (error) {
      console.error('❌ BatchUploadZone import failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      setTestStatus('error');
    }
  };

  const getStatusIcon = () => {
    switch (testStatus) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (testStatus) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          BatchUploadZone Import Test
          {getStatusIcon()}
        </CardTitle>
        <CardDescription>
          This test verifies that BatchUploadZone can be imported without ProgressTrackingService errors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testBatchUploadZoneImport} 
          disabled={testStatus === 'pending'}
          className="w-full"
        >
          Test BatchUploadZone Import
        </Button>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">BatchUploadZone Component Import</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
          </div>
        </div>

        {testStatus === 'success' && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-medium text-green-800">🎉 Import Test Passed!</h4>
            <p className="text-sm text-green-700 mt-1">
              BatchUploadZone can be imported successfully. The ProgressTrackingService error has been resolved!
            </p>
          </div>
        )}

        {testStatus === 'error' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-800">❌ Import Test Failed</h4>
            <p className="text-sm text-red-700 mt-1">
              <strong>Error:</strong> {errorMessage}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
