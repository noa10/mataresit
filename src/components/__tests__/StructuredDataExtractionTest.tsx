import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StructuredDataResult {
  receiptId: string;
  extractedData: any;
  structuredFields: any;
  timestamp: string;
}

export function StructuredDataExtractionTest() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResults, setTestResults] = useState<StructuredDataResult[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast.success(`Selected: ${file.name}`);
    }
  };

  const processReceipt = async () => {
    if (!selectedFile) {
      toast.error('Please select a receipt image first');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('Starting receipt processing with enhanced structured data extraction...');

      // Step 1: Upload the file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `test-${Date.now()}.${fileExt}`;
      const filePath = `Receipt Images/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('Receipt Images')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData.path);

      // Step 2: Create a receipt record
      const { data: receiptData, error: receiptError } = await supabase
        .from('receipts')
        .insert({
          merchant: 'Processing...',
          date: new Date().toISOString().split('T')[0],
          total: 0,
          currency: 'MYR',
          payment_method: '',
          image_url: uploadData.path,
          processing_status: 'uploading'
        })
        .select()
        .single();

      if (receiptError) {
        throw new Error(`Receipt creation failed: ${receiptError.message}`);
      }

      const receiptId = receiptData.id;
      console.log('Receipt record created:', receiptId);
      toast.info('Receipt uploaded, starting AI processing...');

      // Step 3: Process the receipt with enhanced structured data extraction
      const { data: processResult, error: processError } = await supabase.functions.invoke('process-receipt', {
        body: {
          receiptId,
          modelId: 'gemini-2.0-flash-lite' // Use the latest model for best results
        }
      });

      if (processError) {
        throw new Error(`Processing failed: ${processError.message}`);
      }

      console.log('Processing completed:', processResult);
      toast.success('Receipt processed successfully!');

      // Step 4: Fetch the updated receipt with structured data
      const { data: updatedReceipt, error: fetchError } = await supabase
        .from('receipts')
        .select(`
          *,
          merchant_normalized,
          merchant_category,
          business_type,
          location_city,
          location_state,
          receipt_type,
          transaction_time,
          item_count,
          discount_amount,
          service_charge,
          tip_amount,
          subtotal,
          total_before_tax,
          cashier_name,
          receipt_number,
          transaction_id,
          loyalty_program,
          loyalty_points,
          payment_card_last4,
          payment_approval_code,
          is_business_expense,
          expense_type,
          vendor_registration_number,
          invoice_number,
          purchase_order_number,
          line_items_analysis,
          spending_patterns,
          anomaly_flags,
          extraction_metadata
        `)
        .eq('id', receiptId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch updated receipt: ${fetchError.message}`);
      }

      console.log('Updated receipt with structured data:', updatedReceipt);

      // Analyze the structured data
      const structuredFields = {
        basic_info: {
          merchant: updatedReceipt.merchant,
          merchant_normalized: updatedReceipt.merchant_normalized,
          merchant_category: updatedReceipt.merchant_category,
          business_type: updatedReceipt.business_type,
          total: updatedReceipt.total,
          currency: updatedReceipt.currency,
          date: updatedReceipt.date
        },
        location: {
          city: updatedReceipt.location_city,
          state: updatedReceipt.location_state
        },
        transaction_details: {
          receipt_type: updatedReceipt.receipt_type,
          transaction_time: updatedReceipt.transaction_time,
          item_count: updatedReceipt.item_count,
          subtotal: updatedReceipt.subtotal,
          total_before_tax: updatedReceipt.total_before_tax,
          discount_amount: updatedReceipt.discount_amount,
          service_charge: updatedReceipt.service_charge,
          tip_amount: updatedReceipt.tip_amount
        },
        payment_info: {
          payment_method: updatedReceipt.payment_method,
          payment_card_last4: updatedReceipt.payment_card_last4,
          payment_approval_code: updatedReceipt.payment_approval_code
        },
        business_data: {
          receipt_number: updatedReceipt.receipt_number,
          transaction_id: updatedReceipt.transaction_id,
          cashier_name: updatedReceipt.cashier_name,
          vendor_registration_number: updatedReceipt.vendor_registration_number,
          invoice_number: updatedReceipt.invoice_number,
          purchase_order_number: updatedReceipt.purchase_order_number
        },
        expense_classification: {
          is_business_expense: updatedReceipt.is_business_expense,
          expense_type: updatedReceipt.expense_type,
          predicted_category: updatedReceipt.predicted_category
        },
        loyalty_program: {
          program: updatedReceipt.loyalty_program,
          points: updatedReceipt.loyalty_points
        },
        analysis: {
          line_items_analysis: updatedReceipt.line_items_analysis,
          spending_patterns: updatedReceipt.spending_patterns,
          anomaly_flags: updatedReceipt.anomaly_flags,
          extraction_metadata: updatedReceipt.extraction_metadata
        }
      };

      const result: StructuredDataResult = {
        receiptId,
        extractedData: processResult.result,
        structuredFields,
        timestamp: new Date().toISOString()
      };

      setTestResults(prev => [result, ...prev]);

      // Count non-null structured fields
      const nonNullFields = Object.values(structuredFields).reduce((count, section) => {
        return count + Object.values(section).filter(value => 
          value !== null && value !== undefined && value !== '' && value !== 0
        ).length;
      }, 0);

      toast.success(`Structured data extraction completed! ${nonNullFields} fields extracted.`);

    } catch (error) {
      console.error('Test error:', error);
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('receipt-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const renderStructuredData = (structuredFields: any) => {
    return Object.entries(structuredFields).map(([sectionName, sectionData]: [string, any]) => {
      const nonNullFields = Object.entries(sectionData).filter(([_, value]) => 
        value !== null && value !== undefined && value !== '' && value !== 0
      );

      if (nonNullFields.length === 0) return null;

      return (
        <div key={sectionName} className="mb-4">
          <h4 className="font-medium text-sm mb-2 capitalize">
            {sectionName.replace(/_/g, ' ')}
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {nonNullFields.map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="font-mono">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Structured Data Extraction Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test the enhanced LLM-based structured data extraction for receipts (Phase 2.2)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <Input
              id="receipt-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="flex-1"
            />
            <Button 
              onClick={processReceipt}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Process Receipt'}
            </Button>
          </div>
          
          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.map((result, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Receipt: {result.receiptId}</CardTitle>
              <Badge variant="outline">
                {new Date(result.timestamp).toLocaleString()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Extraction Results */}
              <div>
                <h3 className="font-medium mb-3">Basic Extraction Results</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Merchant:</strong> {result.extractedData?.merchant || 'N/A'}</div>
                  <div><strong>Total:</strong> {result.extractedData?.total || 'N/A'}</div>
                  <div><strong>Date:</strong> {result.extractedData?.date || 'N/A'}</div>
                  <div><strong>Currency:</strong> {result.extractedData?.currency || 'N/A'}</div>
                  <div><strong>Payment Method:</strong> {result.extractedData?.payment_method || 'N/A'}</div>
                  <div><strong>Category:</strong> {result.extractedData?.predicted_category || 'N/A'}</div>
                </div>
              </div>

              {/* Enhanced Structured Data */}
              <div>
                <h3 className="font-medium mb-3">Enhanced Structured Data</h3>
                <div className="max-h-96 overflow-y-auto">
                  {renderStructuredData(result.structuredFields)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {testResults.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No test results yet. Upload a receipt image to test the enhanced structured data extraction.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
