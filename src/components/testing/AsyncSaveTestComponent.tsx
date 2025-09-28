import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSaveStatus, useReceiptSaveStatus, useQueueStatus } from '@/contexts/SaveStatusContext';
import { SaveStatusIndicator, QueueStatusIndicator } from '@/components/SaveStatusToastManager';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { EmbeddingServiceStatus } from '@/components/EmbeddingServiceStatus';

export function AsyncSaveTestComponent() {
  const { saveReceipt, clearCompletedOperations } = useSaveStatus();
  const { queueStatus } = useQueueStatus();
  const [testReceiptId, setTestReceiptId] = useState('test-receipt-1');
  const [merchant, setMerchant] = useState('Test Merchant');
  const [total, setTotal] = useState(25.99);
  
  const { isSaving, status } = useReceiptSaveStatus(testReceiptId);

  const handleTestSave = () => {
    const receiptData = {
      merchant,
      total,
      date: new Date().toISOString().split('T')[0],
      currency: 'MYR',
      status: 'reviewed' as const,
    };

    const lineItems = [
      { description: 'Test Item 1', amount: 15.99 },
      { description: 'Test Item 2', amount: 10.00 },
    ];

    console.log('Testing async save with data:', { testReceiptId, receiptData, lineItems });
    
    saveReceipt(testReceiptId, receiptData, lineItems, {
      maxRetries: 2,
      onSuccess: (result) => {
        console.log('Test save succeeded:', result);
      },
      onError: (error) => {
        console.error('Test save failed:', error);
      }
    });
  };

  const handleMultipleSaves = () => {
    // Test rapid successive saves
    for (let i = 1; i <= 3; i++) {
      const receiptId = `test-receipt-${i}`;
      const receiptData = {
        merchant: `Test Merchant ${i}`,
        total: 10 * i,
        date: new Date().toISOString().split('T')[0],
        currency: 'MYR',
        status: 'reviewed' as const,
      };

      saveReceipt(receiptId, receiptData, [], {
        maxRetries: 1,
        onSuccess: (result) => {
          console.log(`Test save ${i} succeeded:`, result);
        },
        onError: (error) => {
          console.error(`Test save ${i} failed:`, error);
        }
      });
    }
  };

  const handleFailureTest = () => {
    // Test with invalid data to trigger failure
    const receiptData = {
      merchant: '', // Invalid - empty merchant
      total: -1, // Invalid - negative total
      date: 'invalid-date',
      currency: 'INVALID',
      status: 'reviewed' as const,
    };

    saveReceipt('test-failure-receipt', receiptData, [], {
      maxRetries: 1,
      onSuccess: (result) => {
        console.log('Unexpected success:', result);
      },
      onError: (error) => {
        console.log('Expected failure:', error.message);
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Async Save Test Component</CardTitle>
          <CardDescription>
            Test the asynchronous receipt saving functionality with background processing and real-time notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Queue Status */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Queue Status</h3>
            <QueueStatusIndicator />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{queueStatus.pendingOperations}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{queueStatus.processingOperations}</div>
              <div className="text-sm text-muted-foreground">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{queueStatus.completedOperations}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{queueStatus.failedOperations}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>

          <Separator />

          {/* Test Receipt Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Test Receipt Data</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="receiptId">Receipt ID</Label>
                <Input
                  id="receiptId"
                  value={testReceiptId}
                  onChange={(e) => setTestReceiptId(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="merchant">Merchant</Label>
                <Input
                  id="merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="total">Total</Label>
                <Input
                  id="total"
                  type="number"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Current Receipt Status */}
            <div className="flex items-center gap-4">
              <Badge variant={
                status === 'saving' ? 'default' :
                status === 'saved' ? 'secondary' :
                status === 'failed' ? 'destructive' : 'outline'
              }>
                {status}
              </Badge>
              <SaveStatusIndicator receiptId={testReceiptId} />
            </div>
          </div>

          <Separator />

          {/* Test Buttons */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Test Actions</h3>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleTestSave}
                disabled={isSaving}
              >
                Test Single Save
              </Button>
              
              <Button 
                onClick={handleMultipleSaves}
                variant="outline"
              >
                Test Multiple Saves (Queue)
              </Button>
              
              <Button 
                onClick={handleFailureTest}
                variant="destructive"
              >
                Test Failure Scenario
              </Button>
              
              <Button 
                onClick={clearCompletedOperations}
                variant="secondary"
              >
                Clear Completed
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Test Instructions:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li><strong>Single Save:</strong> Tests basic async save functionality with toast notifications</li>
              <li><strong>Multiple Saves:</strong> Tests queue management with rapid successive saves</li>
              <li><strong>Failure Scenario:</strong> Tests error handling and retry mechanisms</li>
              <li><strong>Clear Completed:</strong> Cleans up completed/failed operations from the queue</li>
            </ul>
            <p className="text-sm mt-2 text-muted-foreground">
              Watch the toast notifications and queue status indicators to see the async behavior in action.
              The UI should remain responsive during all operations.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Embedding Service Status */}
      <EmbeddingServiceStatus />
    </div>
  );
}
