import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

/**
 * Interface for the download result
 */
export interface DownloadResult {
  success: boolean;
  error?: string;
}

/**
 * Options for daily expense report download
 */
export interface DailyExpenseReportOptions {
  includeImages?: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
}

/**
 * Downloads a daily expense report for a specific date
 * This function replicates the PDF generation logic from DailyPDFReportGenerator
 * but as a reusable utility that can be called from anywhere
 * 
 * @param date - The date for which to generate the report
 * @param options - Optional configuration for the download
 * @returns Promise<DownloadResult> - Result of the download operation
 */
export const downloadDailyExpenseReport = async (
  date: Date,
  options: DailyExpenseReportOptions = {}
): Promise<DownloadResult> => {
  const { includeImages = true, onLoadingChange } = options;

  try {
    // Set loading state
    onLoadingChange?.(true);

    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const errorMessage = 'You must be logged in to generate reports';
      toast({
        title: 'Authentication Error',
        description: errorMessage,
        variant: 'destructive'
      });
      return { success: false, error: errorMessage };
    }

    // Format date for API call
    const dateStr = format(date, 'yyyy-MM-dd');

    // Use direct URL to the Supabase function
    const functionUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/generate-pdf-report';
    
    // Make API call to generate PDF
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ date: dateStr, includeImages })
    });

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Ignore JSON parsing errors for error response
      }
      
      throw new Error(errorMessage);
    }

    // Validate content type to ensure we got a PDF
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
    link.download = `expense-report-${dateStr}-category-mode.pdf`;
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(pdfUrl);

    // Show success message
    toast({
      title: 'Success',
      description: 'PDF report generated successfully',
      variant: 'default'
    });

    return { success: true };

  } catch (error) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF report. Please try again.';
    
    toast({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive'
    });

    return { success: false, error: errorMessage };
  } finally {
    // Clear loading state
    onLoadingChange?.(false);
  }
};

/**
 * Utility function to check if a date has receipts
 * This can be used to conditionally show/hide download buttons
 * 
 * @param date - The date to check
 * @returns Promise<boolean> - Whether the date has receipts
 */
export const hasReceiptsForDate = async (date: Date): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return false;
    }

    const dateStr = format(date, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('receipts')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('date', dateStr)
      .limit(1);

    if (error) {
      console.error('Error checking receipts for date:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error in hasReceiptsForDate:', error);
    return false;
  }
};

/**
 * Utility function to format date for display in download buttons
 * 
 * @param date - The date to format
 * @returns string - Formatted date string
 */
export const formatDateForDownload = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};
