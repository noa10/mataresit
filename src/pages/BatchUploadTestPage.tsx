/**
 * Test page for batch upload functionality
 * This page directly renders the BatchUploadZone component for testing
 */

import React from 'react';
import { BatchUploadZone } from '@/components/BatchUploadZone';
import { BatchUploadWorkflowTest } from '@/components/test/BatchUploadWorkflowTest';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BatchUploadTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Batch Upload Test Page
          </h1>
          <p className="text-gray-600">
            Direct testing of BatchUploadZone component functionality
          </p>
        </div>
        
        {/* Workflow Test Component */}
        <div className="mb-8">
          <BatchUploadWorkflowTest />
        </div>

        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Batch Upload Zone</CardTitle>
            <CardDescription>
              Test the batch upload functionality directly. This component should load without JavaScript errors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-[600px]">
              <BatchUploadZone
                onUploadComplete={() => {
                  console.log('Batch upload completed successfully!');
                }}
              />
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This page tests the BatchUploadZone component directly to identify any JavaScript errors
            <br />
            or issues with the batch upload functionality.
          </p>
        </div>
      </div>
    </div>
  );
}
