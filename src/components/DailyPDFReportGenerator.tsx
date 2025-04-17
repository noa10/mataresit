import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Receipt, LineItem } from '@/types/receipt';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loader2 } from 'lucide-react';

interface ReceiptWithLineItems extends Receipt {
  line_items: LineItem[];
}

export function DailyPDFReportGenerator() {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);

  const fetchReceiptsForDay = async (date: Date): Promise<ReceiptWithLineItems[]> => {
    const startTime = startOfDay(date).toISOString();
    const endTime = endOfDay(date).toISOString();

    try {
      // Fetch receipts for the selected day
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('*')
        .gte('date', startTime)
        .lte('date', endTime);

      if (receiptsError) {
        console.error('Error fetching receipts:', receiptsError);
        throw receiptsError;
      }

      if (!receipts || receipts.length === 0) {
        return [];
      }

      // Fetch line items for all receipts in a single query
      const { data: allLineItems, error: lineItemsError } = await supabase
        .from('line_items')
        .select('*')
        .in('receipt_id', receipts.map(r => r.id));

      if (lineItemsError) {
        console.error('Error fetching line items:', lineItemsError);
        throw lineItemsError;
      }

      // Map line items to their respective receipts
      const receiptsWithLineItems = receipts.map((receipt: Receipt) => ({
        ...receipt,
        line_items: (allLineItems || []).filter(item => item.receipt_id === receipt.id)
      }));

      return receiptsWithLineItems;
    } catch (error) {
      console.error('Error in fetchReceiptsForDay:', error);
      throw error;
    }
  };

  const generatePDF = async () => {
    if (!selectedDay) return;

    try {
      setIsLoading(true);
      const receipts = await fetchReceiptsForDay(selectedDay);

      if (receipts.length === 0) {
        console.log('No receipts found for selected day');
        alert('No receipts found for the selected day');
        setIsLoading(false);
        return;
      }

      // Create PDF document with better formatting
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set default font and size
      pdf.setFont('helvetica');
      pdf.setFontSize(12);

      // Add header with logo and title
      const addHeader = () => {
        // Add a colored header background
        pdf.setFillColor(41, 98, 255); // Blue header
        pdf.rect(0, 0, 210, 25, 'F');

        // Add title text in white
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Daily Expense Report', 105, 15, { align: 'center' });

        // Reset text color for the rest of the page
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');

        // Add date subtitle with more gap (moved from 30 to 35)
        pdf.setFontSize(14);
        pdf.text(format(selectedDay, 'MMMM d, yyyy'), 105, 40, { align: 'center' });

        // Reset to default font size
        pdf.setFontSize(12);
      };

      // Add footer with page numbers and timestamp
      const addFooter = () => {
        const totalPages = pdf.getNumberOfPages();
        const now = new Date();
        const timestamp = format(now, 'yyyy-MM-dd HH:mm:ss');

        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);

          // Add page numbers
          pdf.text(`Page ${i} of ${totalPages}`, 105, 287, { align: 'center' });

          // Add timestamp at bottom left
          pdf.text(`Generated: ${timestamp}`, 20, 287);

          // Add app name at bottom right
          pdf.text('Paperless Maverick', 190, 287, { align: 'right' });
        }
      };

      addHeader();
      let yPosition = 40;

      // Add summary information at the top
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Total Receipts: ${receipts.length}`, 20, yPosition);
      yPosition += 7;

      const grandTotal = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
      pdf.text(`Total Amount: $${grandTotal.toFixed(2)}`, 20, yPosition);
      yPosition += 10;

      pdf.setFont('helvetica', 'normal');
      pdf.text('This report contains detailed information for all receipts recorded on the selected date.', 20, yPosition);
      yPosition += 15;

      // Process each receipt
      for (const receipt of receipts) {
        // Check if we need a new page
        if (yPosition > 240) {
          pdf.addPage();
          addHeader();
          // Start content with more space after the date (moved from 40 to 60)
          yPosition = 60;
        }

        // Add receipt section with colored background
        pdf.setFillColor(240, 240, 250); // Light blue background
        pdf.rect(15, yPosition - 5, 180, 20, 'F'); // Increased height for longer merchant names

        // Add receipt header - handle long merchant names
        pdf.setFontSize(12); // Reduced font size from 14 to 12
        pdf.setFont('helvetica', 'bold');

        // Truncate merchant name if too long
        const merchantName = receipt.merchant;
        const maxMerchantLength = 35; // Reduced maximum characters to display
        const displayMerchant = merchantName.length > maxMerchantLength
          ? merchantName.substring(0, maxMerchantLength) + '...'
          : merchantName;

        // Position merchant name with more space
        pdf.text(`Merchant: ${displayMerchant}`, 20, yPosition + 5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9); // Smaller font for receipt ID
        pdf.text(`Receipt ID: ${receipt.id.substring(0, 8)}...`, 170, yPosition + 5, { align: 'right' });
        yPosition += 20; // Increased spacing

        // Add receipt details
        pdf.setFontSize(11);
        pdf.text(`Date: ${format(new Date(receipt.date), 'MMMM d, yyyy h:mm a')}`, 20, yPosition);
        yPosition += 6;
        pdf.text(`Payment Method: ${receipt.payment_method || 'Not specified'}`, 20, yPosition);
        yPosition += 6;
        if (receipt.currency) {
          pdf.text(`Currency: ${receipt.currency}`, 20, yPosition);
          yPosition += 6;
        }
        if (receipt.tax) {
          pdf.text(`Tax: $${receipt.tax.toFixed(2)}`, 20, yPosition);
          yPosition += 6;
        }
        yPosition += 5;

        // Add line items table with improved styling
        if (receipt.line_items && receipt.line_items.length > 0) {
          autoTable(pdf, {
            startY: yPosition,
            head: [['Item Description', 'Amount ($)']],
            body: receipt.line_items.map(item => [
              item.description,
              item.amount.toFixed(2)
            ]),
            styles: {
              fontSize: 10,
              cellPadding: 3,
            },
            headStyles: {
              fillColor: [41, 98, 255], // Match header blue
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            alternateRowStyles: {
              fillColor: [245, 245, 250]
            },
            margin: { left: 20, right: 20 }
          });

          yPosition = (pdf as any).lastAutoTable.finalY + 10;
        }

        // Add receipt total with highlighted box
        pdf.setFillColor(230, 230, 250); // Light purple background
        pdf.rect(120, yPosition - 5, 70, 10, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Total: $${receipt.total.toFixed(2)}`, 170, yPosition, { align: 'right' });
        pdf.setFont('helvetica', 'normal');
        yPosition += 15;

        // Add receipt image if available
        if (receipt.image_url) {
          try {
            // Get the signed URL for the image
            const { data } = await supabase
              .storage
              .from('receipt-images')
              .createSignedUrl(receipt.image_url.replace('receipt-images/', ''), 60);

            const signedUrl = data?.signedUrl;

            if (signedUrl) {
              // Add a caption for the image
              pdf.setFontSize(10);
              pdf.setTextColor(100, 100, 100);
              pdf.text('Receipt Image:', 20, yPosition);
              yPosition += 5;

              try {
                console.log('Loading image from URL:', signedUrl);
                // Fetch the image directly as a blob
                const response = await fetch(signedUrl, {
                  method: 'GET',
                  headers: {
                    'Cache-Control': 'no-cache',
                  },
                  credentials: 'same-origin',
                });

                if (!response.ok) {
                  throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
                }

                // Get the image as a blob
                const blob = await response.blob();
                console.log('Image blob received, size:', blob.size);

                // Create an object URL from the blob
                const objectUrl = URL.createObjectURL(blob);

                // Load the image from the object URL
                const img = await loadImage(objectUrl);
                console.log('Image dimensions:', img.width, 'x', img.height);

                // Calculate image dimensions to fit nicely on the page
                // with a maximum width and maintaining aspect ratio
                const maxImgWidth = 160; // mm
                const imgWidth = Math.min(maxImgWidth, 160);
                const imgHeight = (img.height * imgWidth) / img.width;

                // Check if image fits on current page
                if (yPosition + imgHeight > 260) {
                  pdf.addPage();
                  addHeader();
                  yPosition = 60; // Increased from 40 to 60
                }

                // Create a canvas element
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                  // Draw the image on the canvas
                  ctx.drawImage(img, 0, 0);

                  // Add a border around the image
                  pdf.setDrawColor(200, 200, 200);
                  pdf.rect(20, yPosition, imgWidth, imgHeight);

                  // Get the image data as base64
                  const imageData = canvas.toDataURL('image/jpeg', 0.95);

                  // Add the image to the PDF
                  pdf.addImage(imageData, 'JPEG', 20, yPosition, imgWidth, imgHeight);
                  yPosition += imgHeight + 20;

                  // Clean up the object URL
                  URL.revokeObjectURL(objectUrl);
                } else {
                  throw new Error('Could not create canvas context');
                }

                // Reset text color
                pdf.setTextColor(0, 0, 0);
              } catch (imgError) {
                console.error('Error processing image:', imgError);
                // Add styled message for unavailable image
                pdf.setFillColor(245, 245, 245);
                pdf.rect(20, yPosition, 160, 30, 'F');
                pdf.setTextColor(100, 100, 100);
                pdf.text('Error loading receipt image', 100, yPosition + 15, { align: 'center' });
                pdf.setTextColor(0, 0, 0);
                yPosition += 40;
              }
            } else {
              console.log('Could not generate signed URL for image');
              // Add styled message for unavailable image
              pdf.setFillColor(245, 245, 245);
              pdf.rect(20, yPosition, 160, 30, 'F');
              pdf.setTextColor(100, 100, 100);
              pdf.text('Receipt image unavailable', 100, yPosition + 15, { align: 'center' });
              pdf.setTextColor(0, 0, 0);
              yPosition += 40;
            }
          } catch (error) {
            console.error('Error loading receipt image:', error);
            // Add styled message for unavailable image
            pdf.setFillColor(245, 245, 245);
            pdf.rect(20, yPosition, 160, 30, 'F');
            pdf.setTextColor(100, 100, 100);
            pdf.text('Receipt image unavailable', 100, yPosition + 15, { align: 'center' });
            pdf.setTextColor(0, 0, 0);
            yPosition += 40;
          }
        }

        // Add a divider line between receipts
        if (receipts.indexOf(receipt) < receipts.length - 1) {
          pdf.setDrawColor(200, 200, 200);
          pdf.line(20, yPosition, 190, yPosition);
          yPosition += 10;

          // Add page break if we're close to the bottom
          if (yPosition > 240) {
            pdf.addPage();
            addHeader();
            yPosition = 40;
          }
        }
      }

      // Add summary page
      pdf.addPage();
      addHeader();

      // Add summary title - with more space after the date
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Expense Summary', 105, 60, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text('Overview of all expenses for ' + format(selectedDay, 'MMMM d, yyyy'), 105, 68, { align: 'center' });

      // Summary table with improved styling
      const summaryData = receipts.map(receipt => [
        receipt.merchant,
        format(new Date(receipt.date), 'h:mm a'),
        receipt.payment_method || 'Not specified',
        receipt.total.toFixed(2)
      ]);

      autoTable(pdf, {
        startY: 75, // Increased from 55 to 75 for more space
        head: [['Merchant', 'Time', 'Payment Method', 'Amount ($)']],
        body: summaryData,
        styles: {
          fontSize: 10,
          cellPadding: 4
        },
        headStyles: {
          fillColor: [41, 98, 255],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 250]
        },
        margin: { left: 20, right: 20 }
      });

      // Add grand total with styled box
      const finalY = (pdf as any).lastAutoTable.finalY + 10;

      // Add a colored box for the grand total with dark background
      pdf.setFillColor(51, 51, 51); // Dark background
      pdf.rect(100, finalY - 5, 90, 10, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255); // White text
      pdf.text(`Grand Total: $${grandTotal.toFixed(2)}`, 170, finalY, { align: 'right' });
      pdf.setTextColor(0, 0, 0); // Reset text color

      // Add some statistics
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text('Expense Statistics:', 20, finalY + 15);

      const avgExpense = grandTotal / receipts.length;
      pdf.text(`• Average expense per receipt: $${avgExpense.toFixed(2)}`, 25, finalY + 25);

      // Find highest and lowest expenses
      const highestExpense = Math.max(...receipts.map(r => r.total));
      const lowestExpense = Math.min(...receipts.map(r => r.total));
      const highestMerchant = receipts.find(r => r.total === highestExpense)?.merchant || 'Unknown';

      pdf.text(`• Highest expense: $${highestExpense.toFixed(2)} (${highestMerchant})`, 25, finalY + 35);
      pdf.text(`• Lowest expense: $${lowestExpense.toFixed(2)}`, 25, finalY + 45);

      // Add footer with page numbers
      addFooter();

      // Save the PDF with a descriptive filename
      pdf.save(`expense-report-${format(selectedDay, 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to load image with better error handling
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      // Add a timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.warn('Image loading timed out:', url);
        reject(new Error('Image loading timed out'));
      }, 10000); // 10 second timeout

      img.onload = () => {
        clearTimeout(timeout);
        console.log('Image loaded successfully:', url);
        resolve(img);
      };

      img.onerror = (e) => {
        clearTimeout(timeout);
        console.error('Image loading error:', e);
        reject(new Error('Failed to load image'));
      };

      // Set src after setting up event handlers
      img.src = url;

      // For some browsers, if the image is cached, onload may not fire
      // Check if image is complete and has a valid natural size
      if (img.complete && img.naturalWidth > 0) {
        clearTimeout(timeout);
        console.log('Image loaded from cache:', url);
        resolve(img);
      }
    });
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
            'Generate PDF Report'
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