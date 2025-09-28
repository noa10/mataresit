import React from 'react';
import { AsyncSaveTestComponent } from '@/components/testing/AsyncSaveTestComponent';

export default function AsyncSaveTestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Async Save Test Page</h1>
        <p className="text-muted-foreground mt-2">
          Test the asynchronous receipt saving functionality with background processing and real-time notifications.
        </p>
      </div>
      
      <AsyncSaveTestComponent />
    </div>
  );
}
