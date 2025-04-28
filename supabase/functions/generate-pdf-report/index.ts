/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { format, startOfDay, endOfDay } from 'npm:date-fns'
// Import encodeBase64 from Deno Standard Library
import { encodeBase64 } from "jsr:@std/encoding/base64";
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

    // Extract date, mode, and includeImages from the request body
    const { date, mode = 'payer', includeImages = true } = requestBody; // Default includeImages to true

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

    console.log(`Processing request for date: ${date}, mode: ${mode}, includeImages: ${includeImages}`);

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

    // Fetch receipts for the selected day, including thumbnail_url
    console.log("Fetching receipts including thumbnail_url");
    const { data: receiptsData, error: receiptsError } = await supabaseClient
      .from('receipts')
      .select('*, thumbnail_url, line_items!line_items_receipt_id_fkey(*)') // Add thumbnail_url
      .gte('date', startTime)
      .lte('date', endTime)
      .order('date', { ascending: true });

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
      // Generate PDF, passing the mode and includeImages flag
      console.log(`Generating PDF in ${mode} mode...`);
      const pdfBytes = await generatePDF(receiptsWithLineItems, selectedDay, mode, includeImages);
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
async function generatePDF(receipts, selectedDay, mode, includeImages = true) {
  console.log(`Generating PDF for ${receipts.length} receipts on ${selectedDay} in ${mode} mode, includeImages: ${includeImages}`);

  // Precompute grandTotal
  const grandTotal = receipts.reduce((sum, r) => sum + (r?.total || 0), 0);

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
  pdf.text(`Total Amount: RM ${grandTotal.toFixed(2)}`, 20, yPosition)
  yPosition += 10

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text('This report contains detailed information for all receipts recorded on the selected date.', 20, yPosition)
  yPosition += 15

  // --- ADDITION: Handle case where there are no receipts ---
  if (receipts.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 100, 100);
    pdf.text('No receipts were found for this date.', 105, yPosition + 10, { align: 'center' });
    pdf.setTextColor(0, 0, 0); // Reset color
    pdf.setFont('helvetica', 'normal'); // Reset font style
    yPosition += 25; // Add space
  }
  // --- END OF ADDITION ---

  // Process each receipt
  for (const receipt of receipts) {
    // Check if we need a new page
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
    const merchantName = receipt.merchant
    const maxMerchantLength = 35
    const displayMerchant = merchantName.length > maxMerchantLength
      ? merchantName.substring(0, maxMerchantLength) + '...'
      : merchantName

    // Position merchant name with more space
    pdf.text(`Merchant: ${displayMerchant}`, 20, yPosition + 5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9) // Smaller font for receipt ID
    pdf.text(`Receipt ID: ${receipt.id.substring(0, 8)}...`, 170, yPosition + 5, { align: 'right' })
    yPosition += 20 // Increased spacing

    // Add receipt details
    pdf.setFontSize(11)
    pdf.text(`Date: ${format(new Date(receipt.date), 'MMMM d, yyyy h:mm a')}`, 20, yPosition)
    yPosition += 6
    pdf.text(`Payment Method: ${receipt.payment_method || 'Not specified'}`, 20, yPosition)
    yPosition += 6
    if (receipt.currency) {
      pdf.text(`Currency: ${receipt.currency}`, 20, yPosition)
      yPosition += 6
    }
    if (receipt.tax) {
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
      })

      yPosition = pdf.lastAutoTable.finalY + 10
    }

    // Add receipt total with highlighted box
    pdf.setFillColor(230, 230, 250) // Light purple background
    pdf.rect(120, yPosition - 5, 70, 10, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.text(`Total: RM ${receipt.total.toFixed(2)}`, 170, yPosition, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    yPosition += 15

    // --- MODIFIED IMAGE HANDLING --- 
    if (includeImages && receipt.thumbnail_url) {
      try {
        console.time('ImageProcessing');
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Receipt Thumbnail:', 20, yPosition); // Changed caption
        yPosition += 5;

        console.log(`Fetching thumbnail: ${receipt.thumbnail_url} for receipt ${receipt.id}`);
        
        // Fetch the thumbnail directly using its public URL
        const thumbResponse = await fetch(receipt.thumbnail_url);
        
        if (!thumbResponse.ok) {
          throw new Error(`Failed to fetch thumbnail: ${thumbResponse.status} ${thumbResponse.statusText}`);
        }
        
        const thumbContentType = thumbResponse.headers.get('content-type') || 'image/jpeg'; // Default to jpeg
        let imageFormat = 'JPEG';
        if (thumbContentType.includes('png')) {
          imageFormat = 'PNG';
        } else if (thumbContentType.includes('webp')) {
           imageFormat = 'WEBP'; // jsPDF supports WEBP
        } else if (thumbContentType.includes('gif')) {
           imageFormat = 'GIF';
        }

        const imageBytes = await thumbResponse.arrayBuffer(); // Get thumbnail bytes
        const base64Image = encodeBase64(imageBytes); // USE DENO STANDARD LIBRARY

        // Use reduced dimensions for thumbnail
        const fixedWidth = 80;
        const fixedHeight = 40;
        if (yPosition + fixedHeight > 260) { // Check page break
          pdf.addPage();
          addHeader();
          yPosition = 60;
        }
        
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(20, yPosition, fixedWidth, fixedHeight);
        
        // Add the thumbnail Base64 data to the PDF
        pdf.addImage(
          `data:${thumbContentType};base64,${base64Image}`,
          imageFormat,
          20,
          yPosition,
          fixedWidth, // Display width
          fixedHeight // Display height
        );
        yPosition += fixedHeight + 10;
        
        pdf.setTextColor(0, 0, 0);
        console.timeEnd('ImageProcessing');
      } catch (imgError) {
        console.warn(`Thumbnail processing skipped for ${receipt.id}:`, imgError);
        yPosition += 10; // Add space even if image fails
      }
    } else if (includeImages && receipt.image_url && !receipt.thumbnail_url) {
      // Optional: Add a placeholder or message if original image exists but thumbnail doesn't
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text('[Thumbnail not available]', 20, yPosition + 5);
      yPosition += 15;
      pdf.setTextColor(0, 0, 0);
    }
    // --- END MODIFIED IMAGE HANDLING ---

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
  const finalY = pdf.lastAutoTable.finalY + 10

  // Add a colored box for the grand total with dark background
  pdf.setFillColor(51, 51, 51) // Dark background
  pdf.rect(100, finalY - 5, 90, 10, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(255, 255, 255) // White text
  pdf.text(`Grand Total: RM ${grandTotal.toFixed(2)}`, 170, finalY, { align: 'right' })
  pdf.setTextColor(0, 0, 0) // Reset text color

  // Add footer with page numbers
  addFooter()

  // Return the PDF as a Uint8Array
  return pdf.output('arraybuffer')
}
