import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
      
      console.warn("Edge function failed, falling back to client-side PDF:", errorMessage);
      await generateClientDailyReport(date, { includeImages });
      return { success: true };
    }

    // Validate content type to ensure we got a PDF
    const contentType = response.headers.get('Content-Type');
    if (!contentType || !contentType.includes("application/pdf")) {
      console.warn("Edge PDF failed, falling back to client-side PDF");
      await generateClientDailyReport(date, { includeImages });
      return { success: true };
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

/**
 * Helper function to convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Client-side PDF generation as fallback when Edge function fails
 */
async function generateClientDailyReport(
  date: Date, 
  options: { includeImages: boolean }
): Promise<void> {
  const { includeImages } = options;
  
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    // Format date range for query
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Fetch receipts for the selected day
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select(`
        *,
        line_items(*),
        custom_categories (
          id,
          name,
          color,
          icon
        )
      `)
      .eq('user_id', session.user.id)
      .gte('date', dateStr)
      .lte('date', dateStr)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch receipts: ${error.message}`);
    }

    const receiptList = receipts || [];
    console.log(`Client-side PDF: Found ${receiptList.length} receipts for ${dateStr}`);

    // Create PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Add header
    pdf.setFillColor(41, 98, 255);
    pdf.rect(0, 0, 210, 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Daily Expense Report', 105, 15, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(14);
    pdf.text(format(date, 'MMMM d, yyyy'), 105, 40, { align: 'center' });

    let yPosition = 60;

    // Add summary
    const grandTotal = receiptList.reduce((sum, r) => sum + (r?.total || 0), 0);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Total Receipts: ${receiptList.length}`, 20, yPosition);
    yPosition += 7;
    pdf.text(`Total Amount: RM ${grandTotal.toFixed(2)}`, 20, yPosition);
    yPosition += 15;

    // Process each receipt
    for (const receipt of receiptList) {
      // Check page break
      if (yPosition > 240) {
        pdf.addPage();
        yPosition = 30;
      }

      // Receipt header
      pdf.setFillColor(240, 240, 250);
      pdf.rect(15, yPosition - 5, 180, 15, 'F');
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Merchant: ${receipt.merchant}`, 20, yPosition + 5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`Receipt ID: ${receipt.id.substring(0, 8)}...`, 170, yPosition + 5, { align: 'right' });
      yPosition += 20;

      // Receipt details
      pdf.setFontSize(11);
      pdf.text(`Date: ${format(new Date(receipt.date), 'MMMM d, yyyy')}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Payment Method: ${receipt.payment_method || 'Not specified'}`, 20, yPosition);
      yPosition += 6;
      if (receipt.currency) {
        pdf.text(`Currency: ${receipt.currency}`, 20, yPosition);
        yPosition += 6;
      }
      yPosition += 5;

      // Line items table
      if (receipt.line_items && receipt.line_items.length > 0) {
        autoTable(pdf, {
          startY: yPosition,
          head: [['Item Description', 'Amount (RM)']],
          body: receipt.line_items.map((item: any) => [
            item.description,
            item.amount.toFixed(2)
          ]),
          styles: { fontSize: 10, cellPadding: 3 },
          headStyles: { fillColor: [41, 98, 255], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 250] },
          margin: { left: 20, right: 20 }
        });
        yPosition = (pdf as any).lastAutoTable.finalY + 10;
      }

      // Add receipt image if available and requested
      if (includeImages) {
        const imageUrl = receipt.image_url || receipt.thumbnail_url;
        if (imageUrl) {
          try {
            console.log(`Client-side PDF: Fetching image for receipt ${receipt.id}`);
            const imageResponse = await fetch(imageUrl);
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
              const base64Image = arrayBufferToBase64(imageBuffer);
              const dataUri = `data:${contentType};base64,${base64Image}`;
              
              // Check page break for image
              if (yPosition > 180) {
                pdf.addPage();
                yPosition = 30;
              }
              
              // Add image with full width and preserved aspect ratio
              const imageFormat = contentType.includes('png') ? 'PNG' : 'JPEG';
              pdf.addImage(dataUri, imageFormat, 20, yPosition, 170, 0); // 0 height preserves aspect ratio
              yPosition += 110; // Estimated space for image
              console.log(`Client-side PDF: Added image for receipt ${receipt.id}`);
            } else {
              console.warn(`Client-side PDF: Failed to fetch image for receipt ${receipt.id}`);
            }
          } catch (imageError) {
            console.error(`Client-side PDF: Error processing image for receipt ${receipt.id}:`, imageError);
          }
        }
      }

      // Receipt total
      pdf.setFillColor(230, 230, 250);
      pdf.rect(120, yPosition - 5, 70, 10, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Total: RM ${receipt.total.toFixed(2)}`, 170, yPosition, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      yPosition += 15;

      // Add divider
      if (receiptList.indexOf(receipt) < receiptList.length - 1) {
        pdf.setDrawColor(200, 200, 200);
        pdf.line(20, yPosition, 190, yPosition);
        yPosition += 10;
      }
    }

    // Generate filename and save
    const filename = `expense-report-${dateStr}-client-generated.pdf`;
    pdf.save(filename);

    console.log(`Client-side PDF generated successfully: ${filename}`);
  } catch (error) {
    console.error('Client-side PDF generation failed:', error);
    throw error;
  }
}
