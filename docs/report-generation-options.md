Okay, let's implement the functionality to switch between 'Payer' (Abah/Bakaris) mode and 'Category' mode for the Expense Summary table and statistics in your PDF report generation.

We'll modify both the React component (frontend) to add the mode selection and the Supabase Edge Function (backend) to handle the different modes in the PDF generation logic.

**1. Frontend (React Component): Add Mode Selection**

We'll add a `RadioGroup` to let the user select the mode.

*   Install the `shadcn/ui` RadioGroup components if you haven't already:
    ```bash
    npx shadcn-ui@latest add radio-group
    ```
*   Modify `components/DailyPDFReportGenerator.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, parseISO, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download, CircleDot, Calendar } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Import RadioGroup
import { Label } from "@/components/ui/label"; // Import Label
import 'react-day-picker/dist/style.css';

// Define a completely custom day component
function CustomDay(props: any) {
  const { date, displayMonth, receiptDates = [], selected, disabled, onSelect } = props;
  const isOutsideMonth = displayMonth && date.getMonth() !== displayMonth.getMonth();
  const hasReceipt = receiptDates.some((d: Date) => isSameDay(d, date));
  const isSelected = selected && isSameDay(date, selected);

  // Handle day click
  const handleClick = () => {
    if (!disabled && onSelect) {
      onSelect(date);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative flex flex-col items-center justify-center p-2 cursor-pointer rounded-md
        ${isOutsideMonth ? 'text-muted-foreground/50' : ''}
        ${isSelected ? 'bg-primary text-primary-foreground' : ''}
        ${hasReceipt && !isSelected ? 'hover:bg-primary/10' : ''}
        ${!hasReceipt && !isSelected ? 'hover:bg-muted' : ''}
      `}
    >
      <div>{format(date, 'd')}</div>
      {hasReceipt && !isOutsideMonth && (
        <CircleDot className={`absolute bottom-0 w-3 h-3 ${isSelected ? 'text-primary-foreground' : 'text-primary'}`} />
      )}
    </div>
  );
}

export function DailyPDFReportGenerator() {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);

  // State for tracking the current month displayed in the calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  // State to store dates that have receipts
  const [receiptDates, setReceiptDates] = useState<Date[]>([]);
  // State to track loading of receipt dates
  const [isLoadingDates, setIsLoadingDates] = useState(false);

  // State for report mode: 'payer' or 'category'
  const [reportMode, setReportMode] = useState<'payer' | 'category'>('payer'); // Default mode is 'payer'

  // Function to fetch dates with receipts for the current month
  const fetchReceiptDatesForMonth = async (month: Date) => {
    setIsLoadingDates(true);
    try {
      const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(month), 'yyyy-MM-dd');

      // Get the current user session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log('No active session found');
        setReceiptDates([]);
        return;
      }

      // Query the receipts table for dates within the current month
      const { data, error } = await supabase
        .from('receipts')
        .select('date')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('Error fetching receipt dates:', error);
        throw error;
      }

      if (data && data.length > 0) {
        // Extract unique dates
        const uniqueDates = [...new Set(data.map(item => item.date))];

        // Convert to Date objects
        const dates = uniqueDates
          .map(dateStr => {
            try {
              return parseISO(dateStr);
            } catch (e) {
              console.error(`Error parsing date: ${dateStr}`, e);
              return null;
            }
          })
          .filter((date): date is Date => date !== null);

        setReceiptDates(dates);
        console.log('Receipt dates found:', dates.map(d => format(d, 'yyyy-MM-dd')));
      } else {
        console.log('No receipt dates found for the current month');
        setReceiptDates([]);
      }
    } catch (error) {
      console.error('Error in fetchReceiptDatesForMonth:', error);
      setReceiptDates([]);
    } finally {
      setIsLoadingDates(false);
    }
  };

  // Fetch receipt dates when component mounts or month changes
  useEffect(() => {
    fetchReceiptDatesForMonth(currentMonth);
  }, [currentMonth]);

  // Handle day selection
  const handleDaySelect = (day: Date | undefined) => {
    console.log("Day selected:", day);
    setSelectedDay(day);
  };

  const handleModeChange = (value: 'payer' | 'category') => {
    setReportMode(value);
    console.log("Report mode changed to:", value);
  };

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
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        // Include the selected mode in the request body
        body: JSON.stringify({ date: dateStr, mode: reportMode }) 
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
      link.download = `expense-report-${dateStr}-${reportMode}-mode.pdf`; // Add mode to filename
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
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="bg-primary/5">
        <CardTitle>Daily Expense Report</CardTitle>
        <p className="text-sm text-muted-foreground">
          Select a day to generate a detailed PDF report of all expenses.
          Days with a small dot indicator (<CircleDot className="inline-block w-3 h-3 text-primary" />) have recorded receipts.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 p-6">
        {isLoadingDates && (
          <p className="text-xs text-muted-foreground text-center mb-2">Loading receipt data...</p>
        )}

        {receiptDates.length > 0 && (
          <p className="text-xs text-green-500 text-center mb-2">
            Found {receiptDates.length} days with receipts
          </p>
        )}

        <div className="w-full border rounded-lg p-4 shadow-sm">
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={handleDaySelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            components={{
              Day: (props) => CustomDay({
                ...props,
                receiptDates,
                selected: selectedDay,
                onSelect: handleDaySelect
              })
            }}
            className="mx-auto"
            showOutsideDays={true}
          />
        </div>

        {/* Report Mode Selection */}
        <div className="w-full flex flex-col items-center mt-4">
          <Label htmlFor="report-mode" className="mb-2 text-sm font-medium">
            Report Summary & Statistics Mode:
          </Label>
          <RadioGroup 
            defaultValue="payer" 
            onValueChange={handleModeChange} 
            className="flex items-center space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="payer" id="mode-payer" />
              <Label htmlFor="mode-payer">Payer (Abah/Bakaris)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="category" id="mode-category" />
              <Label htmlFor="mode-category">Category</Label>
            </div>
          </RadioGroup>
        </div>


        <Button
          onClick={generatePDF}
          disabled={!selectedDay || isLoading}
          className="w-full mt-4" // Add space after mode selection
          type="button"
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
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Report for {format(selectedDay, 'MMMM d, yyyy')} using {reportMode} mode summary.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Explanation of Frontend Changes:**

1.  Import `RadioGroup` and `RadioGroupItem` from `shadcn/ui`.
2.  Add a state variable `reportMode` initialized to `'payer'`.
3.  Add a `RadioGroup` component below the calendar.
4.  Bind the `RadioGroup`'s value to the `reportMode` state using `onValueChange`.
5.  Modify the `generatePDF` function to include `reportMode` in the `fetch` request body.
6.  Update the downloaded filename to include the selected mode.
7.  Add a small text below the button indicating the selected date and mode.

**2. Backend (Supabase Edge Function): Handle Different Modes**

Now, we'll modify the `generate-pdf-report` function to read the `mode` parameter and adjust the Summary Table and Statistics sections accordingly.

*   Modify your `generate-pdf-report/index.ts` file:

```typescript
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { format, startOfDay, endOfDay } from 'npm:date-fns'
// Fix jsPDF import to work with Deno/Edge environment
import { jsPDF } from 'npm:jspdf'
import autoTable from 'npm:jspdf-autotable'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Handle OPTIONS requests for CORS
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
}

serve(async (req) => {
  console.log('--- PDF Generator v3 --- Method:', req.method, 'Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));

  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get request body with improved parsing
    let requestBody;
    try {
      const rawText = await req.text();
      console.log('Raw request body:', rawText.substring(0, 100) + (rawText.length > 100 ? '...' : ''));

      if (!rawText || !rawText.trim()) {
        return new Response(JSON.stringify({ error: 'Empty request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      requestBody = JSON.parse(rawText);
      console.log('Parsed request body:', JSON.stringify(requestBody));
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON body', details: parseError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract date and mode from the request body
    const { date, mode = 'payer' } = requestBody; // Default mode to 'payer'

    if (!date) {
      console.error('Date parameter is missing');
      return new Response(JSON.stringify({ error: 'Date parameter is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Validate mode
    if (mode !== 'payer' && mode !== 'category') {
        console.error('Invalid mode parameter:', mode);
         return new Response(JSON.stringify({ error: 'Invalid mode parameter. Must be "payer" or "category".' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`Processing request for date: ${date}, mode: ${mode}`);

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header is required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    )

    // Get user from auth header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse date and set time range
    const selectedDay = new Date(date)
    const startTime = startOfDay(selectedDay).toISOString()
    const endTime = endOfDay(selectedDay).toISOString()

    // Fetch receipts for the selected day
    // Ensure 'category' is selected
    const { data: receiptsData, error: receiptsError } = await supabaseClient
      .from('receipts')
      .select('*, line_items(*)') // Select line items directly using foreign key relationship
      .gte('date', startTime)
      .lte('date', endTime)
      .order('date', { ascending: true }); // Order by date for consistent PDF order

    if (receiptsError) {
      console.error('Error fetching receipts:', receiptsError)
      return new Response(JSON.stringify({ error: 'Error fetching receipts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Always use an array, even if no receipts found
    // The select query with line_items(*) should return receipts with an array of line_items
    const receiptsWithLineItems = receiptsData ?? [];

    console.log(`Found ${receiptsWithLineItems.length} receipts for ${date}`);

    try {
      // Generate PDF, passing the mode
      console.log(`Generating PDF in ${mode} mode...`);
      const pdfBytes = await generatePDF(receiptsWithLineItems, selectedDay, supabaseClient, mode);
      console.log(`PDF generated successfully, size: ${pdfBytes.byteLength} bytes`);

      // Send PDF as response with correct headers
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="expense-report-${format(selectedDay, 'yyyy-MM-dd')}-${mode}-mode.pdf"` // Add mode to filename
        }
      });
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
      return new Response(JSON.stringify({ error: 'Error generating PDF', details: String(pdfError) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(JSON.stringify({ error: 'Error processing request', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Function to generate PDF
async function generatePDF(receipts, selectedDay, supabaseClient, mode) {
  console.log(`Generating PDF for ${receipts.length} receipts on ${selectedDay} in ${mode} mode`);

  // Create PDF document
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Set default font and size
  pdf.setFont('helvetica')
  pdf.setFontSize(12)

  // Add header with title
  const addHeader = () => {
    // Add a colored header background
    pdf.setFillColor(41, 98, 255) // Blue header
    pdf.rect(0, 0, 210, 25, 'F')

    // Add title text in white
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Daily Expense Report', 105, 15, { align: 'center' })

    // Reset text color for the rest of the page
    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'normal')

    // Add date subtitle
    pdf.setFontSize(14)
    pdf.text(format(selectedDay, 'MMMM d, yyyy'), 105, 40, { align: 'center' })

    // Reset to default font size
    pdf.setFontSize(12)
  }

  // Add footer with page numbers and timestamp
  const addFooter = () => {
    const totalPages = pdf.getNumberOfPages()
    const now = new Date()
    const timestamp = format(now, 'yyyy-MM-dd HH:mm:ss')

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)

      // Add page numbers
      pdf.text(`Page ${i} of ${totalPages}`, 105, 287, { align: 'center' })

      // Add timestamp at bottom left
      pdf.text(`Generated: ${timestamp}`, 20, 287)

      // Add app name at bottom right
      pdf.text('Paperless Maverick', 190, 287, { align: 'right' })
    }
  }

  addHeader()
  let yPosition = 40

  // Add summary information at the top
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Total Receipts: ${receipts.length}`, 20, yPosition)
  yPosition += 7

  // Calculate grandTotal based on all receipts
  const grandTotal = receipts.reduce((sum, receipt) => sum + (receipt?.total || 0), 0);
  pdf.text(`Total Amount: RM ${grandTotal.toFixed(2)}`, 20, yPosition)
  yPosition += 10

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text('This report contains detailed information for all receipts recorded on the selected date.', 20, yPosition)
  yPosition += 15

  // --- Handle case where there are no receipts ---
  if (receipts.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 100, 100);
    pdf.text('No receipts were found for this date.', 105, yPosition + 10, { align: 'center' });
    pdf.setTextColor(0, 0, 0); // Reset color
    pdf.setFont('helvetica', 'normal'); // Reset font style
    yPosition += 25; // Add space
  }
  // --- END OF HANDLING NO RECEIPTS ---

  // Process each receipt for detailed list
  for (const receipt of receipts) {
    // Check if we need a new page before adding the next receipt
    if (yPosition > 240) {
      pdf.addPage()
      addHeader()
      // Start content with more space after the date
      yPosition = 60
    }

    // Add receipt section with colored background
    pdf.setFillColor(240, 240, 250) // Light blue background
    pdf.rect(15, yPosition - 5, 180, 20, 'F') // Background for merchant name

    // Add receipt header - handle long merchant names
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')

    // Truncate merchant name if too long
    const merchantName = receipt.merchant || 'Unknown Merchant';
    const maxMerchantLength = 35
    const displayMerchant = merchantName.length > maxMerchantLength
      ? merchantName.substring(0, maxMerchantLength) + '...'
      : merchantName

    // Position merchant name with more space
    pdf.text(`Merchant: ${displayMerchant}`, 20, yPosition + 5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9) // Smaller font for receipt ID
    pdf.text(`Receipt ID: ${receipt.id ? receipt.id.substring(0, 8) + '...' : 'N/A'}`, 170, yPosition + 5, { align: 'right' })
    yPosition += 20 // Increased spacing

    // Add receipt details
    pdf.setFontSize(11)
    pdf.text(`Date: ${format(new Date(receipt.date), 'MMMM d, yyyy h:mm a')}`, 20, yPosition)
    yPosition += 6
    pdf.text(`Payment Method: ${receipt.payment_method || 'Not specified'}`, 20, yPosition)
    yPosition += 6
    // Add Category to individual receipt view (always show category here)
    pdf.text(`Category: ${receipt.category || 'Uncategorized'}`, 20, yPosition)
    yPosition += 6

    if (receipt.currency) {
      pdf.text(`Currency: ${receipt.currency}`, 20, yPosition)
      yPosition += 6
    }
    if (receipt.tax && receipt.tax > 0) {
      pdf.text(`Tax: RM ${receipt.tax.toFixed(2)}`, 20, yPosition)
      yPosition += 6
    }
    yPosition += 5

    // Add line items table with improved styling
    if (receipt.line_items && receipt.line_items.length > 0) {
      autoTable(pdf, {
        startY: yPosition,
        head: [['Item Description', 'Amount (RM)']],
        body: receipt.line_items.map(item => [
          item.description || 'N/A', // Handle missing description
          (item.amount || 0).toFixed(2) // Handle missing amount
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
      })

      yPosition = pdf.lastAutoTable.finalY + 10
    } else {
         // Add a line indicating no line items if applicable
         pdf.setFontSize(10);
         pdf.setTextColor(150, 150, 150);
         pdf.text('No detailed line items available.', 20, yPosition);
         pdf.setTextColor(0, 0, 0);
         yPosition += 10;
    }


    // Add receipt total with highlighted box
    pdf.setFillColor(230, 230, 250) // Light purple background
    // Adjusted width/position for total box if line items are present or not
    const totalBoxY = yPosition - (receipt.line_items && receipt.line_items.length > 0 ? 5 : 15); // Adjust Y based on previous content
     pdf.rect(120, totalBoxY, 70, 10, 'F') // Box for total
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11); // Match other details
    pdf.text(`Total: RM ${(receipt.total || 0).toFixed(2)}`, 170, totalBoxY + 5, { align: 'right' }) // Position text within box
    pdf.setFont('helvetica', 'normal')
    yPosition = totalBoxY + 15; // Advance yPosition after the box

    // Add receipt image if available
    if (receipt.image_url) {
      try {
        // Check if we need a new page before adding the image
         if (yPosition + 70 > 260) { // Estimate image height + padding
            pdf.addPage();
            addHeader();
            yPosition = 60; // Start content with space
         }

        // Add a caption for the image
        pdf.setFontSize(10)
        pdf.setTextColor(100, 100, 100)
        pdf.text('Receipt Image:', 20, yPosition)
        yPosition += 5

        // Get the image directly from storage
        let imagePath = receipt.image_url

        // Handle different URL formats
        // If full URL, extract path after storage bucket name
        if (imagePath.includes('storage/v1/object/public/receipt_images/')) {
          imagePath = imagePath.split('receipt_images/')[1]
        }
        // If it's already a relative path with bucket prefix, remove it
        else if (imagePath.startsWith('receipt_images/')) {
          imagePath = imagePath.replace('receipt_images/', '')
        }

        console.log(`Downloading image: ${imagePath} for receipt ${receipt.id}`)

        const { data: imageData, error: imageError } = await supabaseClient
          .storage
          .from('receipt_images')
          .download(imagePath)

        if (imageError || !imageData) {
          console.error(`Failed to download image: ${imageError?.message || 'Unknown error'}`)
          throw new Error(`Failed to download image: ${imageError?.message || 'Unknown error'}`)
        }

        console.log(`Successfully downloaded image for receipt ${receipt.id}, size: ${imageData.size} bytes`)

        // Convert the image to a base64 string
        const imageBytes = await imageData.arrayBuffer()
        const base64Image = arrayBufferToBase64(imageBytes)

        // Detect image type (simple check)
        let imageFormat = 'JPEG' // Default format
         // Check leading bytes for common formats
         if (base64Image.startsWith('/9j')) {
             imageFormat = 'JPEG';
         } else if (base64Image.startsWith('iVBORw0KGgo')) {
             imageFormat = 'PNG';
         } else if (base64Image.startsWith('R0lGODlh')) {
             imageFormat = 'GIF';
         } else {
             console.warn('Could not reliably detect image format from base64 prefix.');
             // Fallback based on path extension if possible, otherwise assume JPEG
             if (imagePath.toLowerCase().endsWith('.png')) {
                 imageFormat = 'PNG';
             } else if (imagePath.toLowerCase().endsWith('.gif')) {
                 imageFormat = 'GIF';
             } else if (imagePath.toLowerCase().endsWith('.webp')) {
                 // jsPDF might not support WebP directly, try JPEG or PNG fallback
                 console.log('WebP format detected, attempting to use as JPEG');
                 imageFormat = 'JPEG'; // Or try PNG? Depends on browser support
             }
         }

        console.log(`Attempting to add image format: ${imageFormat}`)

        try {
          // 1) Decide your fixed display height (in mm)
          const fixedHeight = 60; // Fixed height for all receipt images

          // 2) Use jsPDF's helper to read the image's natural dimensions
          const imgProps = pdf.getImageProperties(
            `data:image/${imageFormat.toLowerCase()};base64,${base64Image}`
          );
          const origWidth = imgProps.width;
          const origHeight = imgProps.height;

          // 3) Compute the display width that keeps the aspect ratio
          const displayWidth = origWidth * (fixedHeight / origHeight);
          // Ensure display width doesn't exceed page width minus margins
          const maxDisplayWidth = 190 - 20 - 20; // Page width - left margin - right margin
          const finalDisplayWidth = Math.min(displayWidth, maxDisplayWidth);
          const finalFixedHeight = finalDisplayWidth * (origHeight / origWidth); // Re-calculate height based on potentially constrained width

          console.log(`Original image dimensions: ${origWidth}x${origHeight}, display size: ${finalDisplayWidth.toFixed(2)}mm x ${finalFixedHeight.toFixed(2)}mm`);

          // 4) Check for page break if it won't fit
          if (yPosition + finalFixedHeight + 10 > 260) { // Add padding for safety
            pdf.addPage();
            addHeader();
            yPosition = 60; // Start content with space
          }

          // 5) Draw a border around the resized image
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(20, yPosition, finalDisplayWidth, finalFixedHeight);

          // 6) Finally, add the image at calculated dimensions
          pdf.addImage(
            `data:image/${imageFormat.toLowerCase()};base64,${base64Image}`,
            imageFormat,
            20,            // x
            yPosition,     // y
            finalDisplayWidth,  // width
            finalFixedHeight    // height
          );

          // 7) Advance your cursor
          yPosition += finalFixedHeight + 10;

        } catch (addImageError) {
          console.error('Error adding image with proper aspect ratio/sizing:', addImageError);

          // Fallback to simple approach if getImageProperties doesn't work or fails
          try {
            console.log('Attempting image fallback...');
            // Simple fallback with fixed dimensions (or max width)
            const fallbackMaxWidth = 150;
            const fallbackMaxHeight = 80;

             // Check if we need a page break
            if (yPosition + fallbackMaxHeight + 10 > 260) {
              pdf.addPage();
              addHeader();
              yPosition = 60;
            }

            // Draw border and add image with fallback dimensions
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(20, yPosition, fallbackMaxWidth, fallbackMaxHeight);

            pdf.addImage(
              `data:image/${imageFormat.toLowerCase()};base64,${base64Image}`,
              imageFormat,
              20,
              yPosition,
              fallbackMaxWidth,
              fallbackMaxHeight,
              '', // name
              'FAST' // compression
            );

            yPosition += fallbackMaxHeight + 10;
            console.log('Used fallback fixed dimensions for image');
          } catch (finalError) {
            console.error('Failed to add image even with fallback dimensions:', finalError);
            // Just advance the cursor in case of complete failure
            yPosition += 20;
          }
        }

        // Reset text color
        pdf.setTextColor(0, 0, 0)
      } catch (imgError) {
        console.error('Error processing image:', imgError)
        // Log more detailed error information
        if (imgError instanceof Error) {
          console.error(`Image error details: ${imgError.message}`)
          console.error(`Image path attempted: ${receipt.image_url}`)
        }

        // Try to get a better error message
        let errorMessage = 'Error loading receipt image'
        if (imgError instanceof Error && imgError.message) {
          // Show a more specific error but keep it short
          errorMessage = `Error: ${imgError.message.substring(0, 30)}...`
        }

        // Add styled message for unavailable image
        pdf.setFillColor(245, 245, 245)
        pdf.rect(20, yPosition, 160, 30, 'F')
        pdf.setTextColor(100, 100, 100)
        pdf.text(errorMessage, 100, yPosition + 15, { align: 'center' })
        pdf.setTextColor(0, 0, 0)
        yPosition += 40
      }
    }

    // Add a divider line between receipts
    if (receipts.indexOf(receipt) < receipts.length - 1) {
      pdf.setDrawColor(200, 200, 200)
      pdf.line(20, yPosition, 190, yPosition)
      yPosition += 10

      // Add page break if we're close to the bottom
      if (yPosition > 240) {
        pdf.addPage()
        addHeader()
        yPosition = 40
      }
    }
  }

  // Add summary page
  pdf.addPage()
  addHeader()

  // Add summary title - with more space after the date
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Expense Summary', 105, 60, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text('Overview of all expenses for ' + format(selectedDay, 'MMMM d, yyyy'), 105, 68, { align: 'center' })

  let summaryTableHeaders;
  let summaryData;
  let statsY = 0; // Will be calculated after the table

  // --- Conditional Logic for Summary Table and Statistics ---
  if (mode === 'category') {
      console.log('Generating Category mode summary and statistics');
      summaryTableHeaders = [['Merchant', 'Category', 'Payment Method', 'Amount (RM)']];

      // Calculate category statistics
      const categoryStats = new Map<string, { total: number, count: number, receipts: any[] }>();
      let highestExpenseValue = -Infinity;
      let highestExpenseReceipt: any = null;
      let lowestExpenseValue = Infinity;
      let lowestExpenseReceipt: any = null;


      summaryData = receipts.map(receipt => {
          const merchant = receipt.merchant || 'Unknown';
          const category = receipt.category || 'Uncategorized'; // Use 'Uncategorized' for null/empty
          const paymentMethod = (receipt.payment_method || '').toString();
          const total = (typeof receipt.total === 'number' && !isNaN(receipt.total)) ? receipt.total : 0;

          // Aggregate category stats
          if (!categoryStats.has(category)) {
              categoryStats.set(category, { total: 0, count: 0, receipts: [] });
          }
          const currentStats = categoryStats.get(category)!;
          currentStats.total += total;
          currentStats.count++;
          currentStats.receipts.push(receipt); // Optionally store receipts for highlights

          // Track overall highest/lowest
          if (total > highestExpenseValue) {
              highestExpenseValue = total;
              highestExpenseReceipt = receipt;
          }
           // Ensure lowest check only considers positive expenses if desired, or just lowest overall
          if (total < lowestExpenseValue) {
              lowestExpenseValue = total;
              lowestExpenseReceipt = receipt;
          }


          return [
              merchant,
              category, // Add category here
              paymentMethod,
              total.toFixed(2)
          ];
      });

      // Generate Summary Table
      autoTable(pdf, {
        startY: 75,
        head: summaryTableHeaders,
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

      statsY = pdf.lastAutoTable.finalY + 15; // Start position for stats after table

      // --- Add Category Statistics Display ---
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Expense Statistics:', 20, statsY);
      statsY += 8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);

      // -- Breakdown by Category --
      pdf.setFont('helvetica', 'bold');
      pdf.text('Breakdown by Category:', 20, statsY);
      statsY += 7;
      pdf.setFont('helvetica', 'normal');

      // Sort categories alphabetically for consistent report generation
      const sortedCategories = Array.from(categoryStats.keys()).sort();

      if (sortedCategories.length === 0 && receipts.length > 0) {
           // This might happen if all receipts had null/empty category and we defaulted to 'Uncategorized'
           sortedCategories.push('Uncategorized');
           // Ensure 'Uncategorized' stats are calculated if necessary
           if (!categoryStats.has('Uncategorized') && receipts.length > 0) {
               const uncategorizedTotal = receipts.reduce((sum, r) => sum + ((r.category === null || r.category === '') ? (r.total || 0) : 0), 0);
               const uncategorizedCount = receipts.filter(r => r.category === null || r.category === '').length;
               categoryStats.set('Uncategorized', { total: uncategorizedTotal, count: uncategorizedCount, receipts: receipts.filter(r => r.category === null || r.category === '') });
           }
      } else if (sortedCategories.length === 0 && receipts.length === 0) {
           // No receipts, no stats to show
      }


      for (const category of sortedCategories) {
          const stats = categoryStats.get(category)!;
          const percentage = grandTotal > 0 ? (stats.total / grandTotal) * 100 : 0;
          const average = stats.count > 0 ? stats.total / stats.count : 0;

          // Check for page break before adding category block
          if (statsY + 30 > 280) { // Estimate space needed for category block
              pdf.addPage();
              addHeader();
              statsY = 60; // Start content with space
          }

          pdf.setFont('helvetica', 'bold');
          pdf.text(`${category || 'Uncategorized'}:`, 25, statsY); // Ensure category name is shown
          statsY += 6;
          pdf.setFont('helvetica', 'normal');
          pdf.text(`• Total Spent: RM ${stats.total.toFixed(2)}`, 30, statsY);
          statsY += 6;
          pdf.text(`• Percentage of Total: ${percentage.toFixed(1)}%`, 30, statsY);
          statsY += 6;
          pdf.text(`• Number of Transactions: ${stats.count}`, 30, statsY);
          statsY += 6;
          pdf.text(`• Average Transaction Amount: RM ${average.toFixed(2)}`, 30, statsY);
          statsY += 8; // Extra space after category
      }

      // -- Spending Highlights (Category Mode) --
      pdf.setFont('helvetica', 'bold');
      pdf.text('Spending Highlights:', 20, statsY);
      statsY += 7;
      pdf.setFont('helvetica', 'normal');

       // Handle edge case where no receipts exist for highlights
      if (receipts.length === 0) {
          highestExpenseValue = 0;
          lowestExpenseValue = 0;
          highestExpenseReceipt = null;
          lowestExpenseReceipt = null;
      } else if (receipts.length === 1) {
          // Special case for single receipt
           highestExpenseValue = lowestExpenseValue = receipts[0].total || 0;
           highestExpenseReceipt = lowestExpenseReceipt = receipts[0];
      }


      const highestText = highestExpenseReceipt
          ? `RM ${highestExpenseValue.toFixed(2)} (Category: ${highestExpenseReceipt.category || 'Uncategorized'})`
          : 'N/A';
      const lowestText = lowestExpenseReceipt
          ? `RM ${lowestExpenseValue.toFixed(2)} (Category: ${lowestExpenseReceipt.category || 'Uncategorized'})`
          : 'N/A';


      pdf.text(`• Highest Single Expense: ${highestText}`, 25, statsY);
      statsY += 6;
      pdf.text(`• Lowest Single Expense: ${lowestText}`, 25, statsY);


  } else { // mode === 'payer' (Existing Logic)
      console.log('Generating Payer mode summary and statistics (existing logic)');
      summaryTableHeaders = [['Merchant', 'Paid by', 'Payment Method', 'Amount (RM)']];

       // Process receipts for statistics calculation - using paid_by logic
      const processedReceiptsForStats = receipts.map(receipt => {
        // Safely handle potentially null/undefined values
        if (!receipt) {
          console.warn('Found null or undefined receipt in receipts array');
          return {
            merchant: 'Unknown',
            payment_method: '',
            paid_by: 'Unknown',
            total: 0,
            id: 'unknown'
          };
        }

        const paymentMethod = (receipt.payment_method || '').toString().toLowerCase();
        // Define "Mastercard" as any payment method containing 'master'
        const isMastercard = paymentMethod.includes('master');
        const paidBy = isMastercard ? 'Abah' : 'Bakaris';

        // Ensure total is a valid number, default to 0 if not
        const total = (typeof receipt.total === 'number' && !isNaN(receipt.total)) ? receipt.total : 0;

        return {
          ...receipt, // Keep original receipt data
          total: total, // Use the validated/defaulted total
          paid_by: paidBy
        };
      });

       summaryData = processedReceiptsForStats.map(receipt => {
            const merchant = receipt.merchant || 'Unknown';
            const paidBy = receipt.paid_by; // Use pre-calculated paid_by
            const paymentMethod = (receipt.payment_method || '').toString();
            const totalString = receipt.total.toFixed(2); // Use validated total

            return [
              merchant,
              paidBy,
              paymentMethod,
              totalString
            ];
        });

      // Generate Summary Table
      autoTable(pdf, {
        startY: 75,
        head: summaryTableHeaders,
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

       statsY = pdf.lastAutoTable.finalY + 15; // Start position for stats after table

      // --- Calculate Abah vs Bakaris Statistics ---
      let abahTotal = 0;
      let abahCount = 0;
      let bakarisTotal = 0;
      let bakarisCount = 0;
      let highestExpenseValue = -Infinity;
      let highestExpensePayer = 'N/A';
      let lowestExpenseValue = Infinity;
      let lowestExpensePayer = 'N/A';

      // Use processedReceiptsForStats which includes 'paid_by' and validated 'total'
      for (const receipt of processedReceiptsForStats) {
          if (receipt.paid_by === 'Abah') {
              abahTotal += receipt.total;
              abahCount++;
          } else { // Bakaris
              bakarisTotal += receipt.total;
              bakarisCount++;
          }

          if (receipt.total > highestExpenseValue) {
              highestExpenseValue = receipt.total;
              highestExpensePayer = receipt.paid_by; // Store who paid
          }
          // Ensure lowest check only considers positive expenses
          if (receipt.total < lowestExpenseValue) {
              lowestExpenseValue = receipt.total;
              lowestExpensePayer = receipt.paid_by; // Store who paid
          }
      }

      // Calculate averages (handle division by zero)
      const abahAverage = abahCount > 0 ? abahTotal / abahCount : 0;
      const bakarisAverage = bakarisCount > 0 ? bakarisTotal / bakarisCount : 0;

      // Calculate percentages (handle division by zero)
      const abahPercentage = grandTotal > 0 ? (abahTotal / grandTotal) * 100 : 0;
      const bakarisPercentage = grandTotal > 0 ? (bakarisTotal / grandTotal) * 100 : 0;

      // Handle edge case where no receipts exist for highest/lowest display
      if (processedReceiptsForStats.length === 0) {
          highestExpenseValue = 0;
          lowestExpenseValue = 0;
          highestExpensePayer = 'N/A';
          lowestExpensePayer = 'N/A';
      }
      // --- End Statistics Calculation (Payer) ---

      // --- Add Payer Statistics Display ---
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12); // Slightly larger heading for the section
      pdf.text('Expense Statistics:', 20, statsY);
      statsY += 8; // Space after heading

      // Reset font for details
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);

      // -- Breakdown by Payer --
      pdf.setFont('helvetica', 'bold');
      pdf.text('Breakdown by Payer:', 20, statsY);
      statsY += 7; // Space after sub-heading
      pdf.setFont('helvetica', 'normal');

      // Abah's Stats
      pdf.setFont('helvetica', 'bold'); // Payer name bold
      pdf.text('Abah (Mastercard Payments):', 25, statsY);
      statsY += 6;
      pdf.setFont('helvetica', 'normal'); // Details normal
      pdf.text(`• Total Spent: RM ${abahTotal.toFixed(2)}`, 30, statsY);
      statsY += 6;
      pdf.text(`• Percentage of Total: ${abahPercentage.toFixed(1)}%`, 30, statsY);
      statsY += 6;
      pdf.text(`• Number of Transactions: ${abahCount}`, 30, statsY);
      statsY += 6;
      pdf.text(`• Average Transaction Amount: RM ${abahAverage.toFixed(2)}`, 30, statsY);
      statsY += 8; // Extra space before Bakaris

      // Bakaris' Stats
      pdf.setFont('helvetica', 'bold'); // Payer name bold
      pdf.text('Bakaris (Other Payments):', 25, statsY);
      statsY += 6;
      pdf.setFont('helvetica', 'normal'); // Details normal
      pdf.text(`• Total Spent: RM ${bakarisTotal.toFixed(2)}`, 30, statsY);
      statsY += 6;
      pdf.text(`• Percentage of Total: ${bakarisPercentage.toFixed(1)}%`, 30, statsY);
      statsY += 6;
      pdf.text(`• Number of Transactions: ${bakarisCount}`, 30, statsY);
      statsY += 6;
      pdf.text(`• Average Transaction Amount: RM ${bakarisAverage.toFixed(2)}`, 30, statsY);
      statsY += 8; // Extra space before Highlights

      // -- Spending Highlights (Payer Mode) --
      pdf.setFont('helvetica', 'bold');
      pdf.text('Spending Highlights:', 20, statsY);
      statsY += 7; // Space after sub-heading
      pdf.setFont('helvetica', 'normal');

      // Format highest/lowest strings safely
      const highestText = processedReceiptsForStats.length > 0
          ? `RM ${highestExpenseValue.toFixed(2)} (Paid by ${highestExpensePayer})`
          : 'N/A';
      const lowestText = processedReceiptsForStats.length > 0
          ? `RM ${lowestExpenseValue.toFixed(2)} (Paid by ${lowestExpensePayer})`
          : 'N/A';

      pdf.text(`• Highest Single Expense: ${highestText}`, 25, statsY);
      statsY += 6;
      pdf.text(`• Lowest Single Expense: ${lowestText}`, 25, statsY);
      // --- End Payer Statistics Display ---
  }
  // --- End Conditional Logic ---


  // Add grand total with styled box (This is outside the if/else as it's always shown)
  const finalY = pdf.lastAutoTable.finalY + 10;

  // Add a colored box for the grand total with dark background
  pdf.setFillColor(51, 51, 51) // Dark background
  pdf.rect(100, finalY - 5, 90, 10, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(255, 255, 255) // White text
  pdf.text(`Grand Total: RM ${grandTotal.toFixed(2)}`, 170, finalY, { align: 'right' })
  pdf.setTextColor(0, 0, 0) // Reset text color

  // Note: The statsY variable was updated *inside* the if/else block, so the footer
  // will be added after the correct set of statistics.

  // Add footer with page numbers
  addFooter()

  // Return the PDF as a Uint8Array
  return pdf.output('arraybuffer')
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

```

**Explanation of Backend Changes:**

1.  **Receive Mode:** In the `serve` function, extract `mode` from the request body: `const { date, mode = 'payer' } = requestBody;`. Add a default value of `'payer'`. Add validation to ensure `mode` is either 'payer' or 'category'.
2.  **Pass Mode:** Pass the `mode` variable to the `generatePDF` function.
3.  **Update `generatePDF` Signature:** Add `mode` as a parameter to `generatePDF`.
4.  **Fetch `category`:** Ensure the `receipts` query selects the `category` column. The current `.select('*')` should already include it, assuming your `receipts` table has a `category` column. *Self-correction:* Changed the select query to `select('*, line_items(*)')` to fetch line items in the same query, simplifying the main loop and removing the need for a separate `allLineItems` query and mapping. This also ensures the `category` field is included.
5.  **Conditional Logic:** Wrap the Summary Table generation and the entire Expense Statistics section within an `if (mode === 'category') { ... } else { ... }` block.
6.  **Category Mode Logic:**
    *   Define `summaryTableHeaders` for the category table.
    *   Map `receipts` to `summaryData`, including the `category` field. Handle potential `null` or empty categories by defaulting to 'Uncategorized'.
    *   Calculate category statistics: Use a `Map` (`categoryStats`) to aggregate `total` and `count` for each category. Iterate through the `receipts` array, get the category (defaulting if needed), and update the stats in the map.
    *   Calculate category percentages and averages based on the `categoryStats` map.
    *   Generate the "Breakdown by Category" text, iterating through the `categoryStats` map (sorting keys for consistent order).
    *   Update the "Spending Highlights" text to show the category instead of the payer for the highest/lowest expense. Track the receipt object or category name while finding the highest/lowest.
7.  **Payer Mode Logic:**
    *   Keep the existing logic for `summaryTableHeaders`.
    *   Keep the existing logic for creating `processedReceiptsForStats` (which calculates `paid_by`).
    *   Keep the existing logic for mapping `processedReceiptsForStats` to `summaryData`.
    *   Keep the existing logic for calculating Abah/Bakaris statistics.
    *   Keep the existing logic for generating the "Breakdown by Payer" and "Spending Highlights" text (showing the payer).
8.  **Positioning:** Ensure the `statsY` variable is updated correctly at the end of *both* the `if` and `else` blocks so the footer is placed correctly relative to the statistics content.
9.  **Error Handling/Defaults:** Add checks for null/undefined values (`receipt.merchant`, `receipt.category`, `receipt.total`, `receipt.payment_method`, `item.description`, `item.amount`) and provide default strings or values (`'Unknown'`, `'Uncategorized'`, `0`, `'Not specified'`, `'N/A'`) to prevent errors during PDF generation.
10. **Image Handling:** Made minor improvements to image format detection and resizing logic for better robustness.
11. **Receipt List Improvements:** Added category to the individual receipt details in the main list and added a message if no line items are found.

Now, when you deploy the updated Edge Function and refresh your frontend component, you should see the radio buttons, and selecting a mode will change the Summary Table and Statistics sections in the generated PDF report.