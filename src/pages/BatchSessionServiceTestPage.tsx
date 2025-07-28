/**
 * Test page for BatchSessionService fix verification
 */

import React from 'react';
import { BatchSessionServiceTest } from '@/components/test/BatchSessionServiceTest';
import { BatchUploadZoneTest } from '@/components/test/BatchUploadZoneTest';

export default function BatchSessionServiceTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            BatchSessionService Fix Verification
          </h1>
          <p className="text-gray-600">
            Test page to verify that the BatchSessionService error has been resolved
          </p>
        </div>
        
        <BatchSessionServiceTest />

        <div className="mt-8">
          <BatchUploadZoneTest />
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This test page verifies that the "BatchSessionService is not defined" error has been fixed.
            <br />
            If all tests pass, the batch upload modal should work correctly.
          </p>
        </div>
      </div>
    </div>
  );
}
