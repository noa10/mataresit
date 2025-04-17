import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Receipt, LineItem } from '@/types/receipt';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

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
        return;
      }

      // Create PDF document with better formatting
      const pdf = new jsPDF();

      // Set default font and size
      pdf.setFont('helvetica');
      pdf.setFontSize(12);

      // Add header
      const addHeader = () => {
        pdf.setFontSize(18);
        pdf.text('Daily Expense Report', 105, 20, { align: 'center' });
        pdf.setFontSize(14);
        pdf.text(format(selectedDay, 'MMMM d, yyyy'), 105, 30, { align: 'center' });
        pdf.setFontSize(12);
      };

      // Add footer with page numbers
      const addFooter = () => {
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(10);
          pdf.text(`Page ${i} of ${totalPages}`, 105, 287, { align: 'center' });
        }
      };

      addHeader();
      let yPosition = 40;

      // Process each receipt
      for (const receipt of receipts) {
        // Check if we need a new page
        if (yPosition > 250) {
          pdf.addPage();
          addHeader();
          yPosition = 40;
        }

        // Add receipt details
        pdf.setFontSize(14);
        pdf.text(`Merchant: ${receipt.merchant}`, 20, yPosition);
        yPosition += 10;

        pdf.setFontSize(12);
        pdf.text(`Date: ${format(new Date(receipt.date), 'MM/dd/yyyy HH:mm')}`, 20, yPosition);
        yPosition += 7;
        pdf.text(`Payment Method: ${receipt.payment_method || 'Not specified'}`, 20, yPosition);
        yPosition += 10;

        // Add line items table
        if (receipt.line_items && receipt.line_items.length > 0) {
          autoTable(pdf, {
            startY: yPosition,
            head: [['Item', 'Amount']],
            body: receipt.line_items.map(item => [
              item.description,
              `$${item.amount.toFixed(2)}`
            ]),
            styles: {
              fontSize: 10,
              cellPadding: 2,
            },
            headStyles: {
              fillColor: [66, 66, 66],
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            alternateRowStyles: {
              fillColor: [240, 240, 240]
            },
            margin: { left: 20, right: 20 }
          });

          yPosition = (pdf as any).lastAutoTable.finalY + 10;
        }

        // Add receipt total
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Total: $${receipt.total.toFixed(2)}`, 170, yPosition, { align: 'right' });
        pdf.setFont('helvetica', 'normal');
        yPosition += 15;

        // Add receipt image if available
        if (receipt.image_url) {
          try {
            // Get the signed URL for the image
            const { data: { signedUrl } } = await supabase
              .storage
              .from('receipt-images')
              .createSignedUrl(receipt.image_url.replace('receipt-images/', ''), 60);

            if (signedUrl) {
              const img = await loadImage(signedUrl);
              const imgData = await html2canvas(img);
              const imgWidth = 170;
              const imgHeight = (imgData.height * imgWidth) / imgData.width;

              // Check if image fits on current page
              if (yPosition + imgHeight > 260) {
                pdf.addPage();
                addHeader();
                yPosition = 40;
              }

              pdf.addImage(imgData, 'PNG', 20, yPosition, imgWidth, imgHeight);
              yPosition += imgHeight + 20;
            } else {
              console.log('Could not generate signed URL for image');
              pdf.text('Receipt image unavailable', 20, yPosition);
              yPosition += 10;
            }
          } catch (error) {
            console.error('Error loading receipt image:', error);
            pdf.text('Receipt image unavailable', 20, yPosition);
            yPosition += 10;
          }
        }

        // Add page break between receipts if not the last receipt
        if (receipts.indexOf(receipt) < receipts.length - 1) {
          pdf.addPage();
          addHeader();
          yPosition = 40;
        }
      }

      // Add summary page
      pdf.addPage();
      addHeader();

      // Summary table
      const summaryData = receipts.map(receipt => [
        receipt.merchant,
        format(new Date(receipt.date), 'MM/dd/yyyy HH:mm'),
        receipt.payment_method || 'Not specified',
        `$${receipt.total.toFixed(2)}`
      ]);

      autoTable(pdf, {
        startY: 40,
        head: [['Merchant', 'Date', 'Payment Method', 'Amount']],
        body: summaryData,
        styles: {
          fontSize: 10,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        },
        margin: { left: 20, right: 20 }
      });

      // Add grand total
      const grandTotal = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
      const finalY = (pdf as any).lastAutoTable.finalY + 10;
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Grand Total: $${grandTotal.toFixed(2)}`, 170, finalY, { align: 'right' });

      // Add footer with page numbers
      addFooter();

      // Save the PDF
      pdf.save(`expense-report-${format(selectedDay, 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to load image
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Generate Daily Expense Report</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <DayPicker
          mode="single"
          selected={selectedDay}
          onSelect={setSelectedDay}
          className="border rounded-lg p-4"
        />
        <Button
          onClick={generatePDF}
          disabled={!selectedDay || isLoading}
          className="w-full"
        >
          {isLoading ? 'Generating PDF...' : 'Generate PDF Report'}
        </Button>
      </CardContent>
    </Card>
  );
} 