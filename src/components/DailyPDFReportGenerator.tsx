import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export function DailyPDFReportGenerator() {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);

  const generatePDF = async () => {
    if (!selectedDay) return;

    try {
      setIsLoading(true);

      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: 'Authentication Error',
          description: 'You must be logged in to generate reports',
          variant: 'destructive'
        });
        return;
      }

      // Use direct URL to the function
      const functionUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/generate-pdf-report';
      
      // Use fetch directly for binary data
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ date: selectedDay.toISOString() })
      });

      if (!response.ok) {
        // Try to get error message
        let errorMessage = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        
        throw new Error(errorMessage);
      }

      // Check content type to confirm we got a PDF
      const contentType = response.headers.get('Content-Type');
      if (!contentType || !contentType.includes('application/pdf')) {
        console.warn('Response is not a PDF:', contentType);
        const text = await response.text();
        console.error('Response content:', text);
        throw new Error('Server did not return a PDF file');
      }
      
      // Get PDF as ArrayBuffer
      const pdfData = await response.arrayBuffer();
      console.log(`Received PDF data, size: ${pdfData.byteLength} bytes`);
      
      // Create a Blob from the returned PDF ArrayBuffer data
      const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
      
      // Create a URL for the blob
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Create a link element and trigger download
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `expense-report-${format(selectedDay, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(pdfUrl);

      toast({
        title: 'Success',
        description: 'PDF report generated successfully',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate PDF report. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="bg-primary/5">
        <CardTitle className="text-center">Generate Daily Expense Report</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-muted-foreground text-center mb-2">
          Select a day to generate a detailed PDF report of all expenses for that day.
        </p>
        <DayPicker
          mode="single"
          selected={selectedDay}
          onSelect={setSelectedDay}
          className="border rounded-lg p-4 shadow-sm"
        />
        <Button
          onClick={generatePDF}
          disabled={!selectedDay || isLoading}
          className="w-full mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate PDF Report
            </>
          )}
        </Button>
        {selectedDay && (
          <p className="text-xs text-muted-foreground mt-2">
            Report will include all receipts from {format(selectedDay, 'MMMM d, yyyy')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}