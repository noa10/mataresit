import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreateClaimDialog } from './CreateClaimDialog';
import { Receipt } from '@/types/receipt';
import { toast } from 'sonner';

// Mock receipt data for testing
const mockReceipts: Receipt[] = [
  {
    id: '1',
    merchant: 'Test Restaurant',
    date: '2024-01-15',
    total: 25.50,
    currency: 'MYR',
    image_url: '/placeholder.svg',
    status: 'reviewed',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    payment_method: 'Credit Card',
  },
  {
    id: '2',
    merchant: 'Office Supplies Store',
    date: '2024-01-14',
    total: 45.75,
    currency: 'MYR',
    image_url: '/placeholder.svg',
    status: 'approved',
    created_at: '2024-01-14T14:30:00Z',
    updated_at: '2024-01-14T14:30:00Z',
    payment_method: 'Cash',
  },
];

export function CreateClaimDialogTest() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefilledData, setPrefilledData] = useState<any>(undefined);
  const [errorCount, setErrorCount] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Track renders to detect infinite loops
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  });

  // Monitor console errors and logs
  useEffect(() => {
    const originalError = console.error;
    const originalLog = console.log;

    console.error = (...args) => {
      if (args[0]?.includes?.('Maximum update depth exceeded')) {
        setErrorCount(prev => prev + 1);
        toast.error('Infinite loop detected!');
      }
      originalError(...args);
    };

    console.log = (...args) => {
      // Capture debug logs from our components
      if (args[0]?.includes?.('🔄') || args[0]?.includes?.('🖱️') || args[0]?.includes?.('🎯')) {
        setDebugLogs(prev => [...prev.slice(-9), args.join(' ')]);
      }
      originalLog(...args);
    };

    return () => {
      console.error = originalError;
      console.log = originalLog;
    };
  }, []);

  const handleOpenBasicDialog = () => {
    setPrefilledData(undefined);
    setDialogOpen(true);
  };

  const handleOpenPrefilledDialog = () => {
    setPrefilledData({
      title: 'Test Expense Claim',
      description: 'This is a test claim with prefilled data',
      amount: 25.50,
      currency: 'MYR',
      category: 'Meals',
      priority: 'medium',
      attachedReceipts: [mockReceipts[0]],
    });
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    toast.success('Test claim created successfully!');
    console.log('Claim creation successful');
  };

  const resetCounters = () => {
    setErrorCount(0);
    setRenderCount(0);
    setDebugLogs([]);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CreateClaimDialog Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicators */}
          <div className="flex gap-2 mb-4">
            <Badge variant={errorCount === 0 ? "default" : "destructive"}>
              Errors: {errorCount}
            </Badge>
            <Badge variant="secondary">
              Renders: {renderCount}
            </Badge>
            <Button variant="ghost" size="sm" onClick={resetCounters}>
              Reset Counters
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button onClick={handleOpenBasicDialog} variant="outline">
              Test Basic Dialog
            </Button>
            <Button onClick={handleOpenPrefilledDialog}>
              Test Prefilled Dialog
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Test Instructions:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Click "Test Basic Dialog" to open an empty claim creation dialog</li>
              <li>Click "Test Prefilled Dialog" to open with sample data and receipt</li>
              <li>Try selecting receipts in the "Receipts" tab</li>
              <li>Verify no infinite loops or console errors occur</li>
              <li>Test on both desktop and mobile screen sizes</li>
              <li>Ensure touch interactions work properly on mobile</li>
              <li>Watch the error counter - it should stay at 0</li>
              <li>Render count should stabilize after initial load</li>
            </ul>
          </div>

          {/* Debug logs */}
          {debugLogs.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Debug Logs (Last 10):</p>
              <div className="text-xs font-mono space-y-1 max-h-32 overflow-y-auto">
                {debugLogs.map((log, index) => (
                  <div key={index} className="text-muted-foreground">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateClaimDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        prefilledData={prefilledData}
      />
    </div>
  );
}
