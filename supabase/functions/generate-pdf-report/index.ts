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
  console.log('--- PDF Generator v2 --- Method:', req.method, 'Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
  
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

    const { date } = requestBody;

    if (!date) {
      console.error('Date parameter is missing');
      return new Response(JSON.stringify({ error: 'Date parameter is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Processing request for date: ${date}`);

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
    const { data: receipts, error: receiptsError } = await supabaseClient
      .from('receipts')
      .select('*')
      .gte('date', startTime)
      .lte('date', endTime)

    if (receiptsError) {
      console.error('Error fetching receipts:', receiptsError)
      return new Response(JSON.stringify({ error: 'Error fetching receipts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!receipts || receipts.length === 0) {
      return new Response(JSON.stringify({ error: 'No receipts found for the selected day' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Found ${receipts.length} receipts for ${date}`);

    // Fetch line items for all receipts in a single query
    const { data: allLineItems, error: lineItemsError } = await supabaseClient
      .from('line_items')
      .select('*')
      .in('receipt_id', receipts.map(r => r.id))

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError)
      return new Response(JSON.stringify({ error: 'Error fetching line items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Map line items to their respective receipts
    const receiptsWithLineItems = receipts.map((receipt) => ({
      ...receipt,
      line_items: (allLineItems || []).filter(item => item.receipt_id === receipt.id)
    }))

    try {
      // Generate PDF
      console.log('Generating PDF...');
      const pdfBytes = await generatePDF(receiptsWithLineItems, selectedDay, supabaseClient);
      console.log(`PDF generated successfully, size: ${pdfBytes.byteLength} bytes`);

      // Send PDF as response with correct headers
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="expense-report-${format(selectedDay, 'yyyy-MM-dd')}.pdf"`
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
async function generatePDF(receipts, selectedDay, supabaseClient) {
  console.log(`Generating PDF for ${receipts.length} receipts on ${selectedDay}`);

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

  const grandTotal = receipts.reduce((sum, receipt) => sum + receipt.total, 0)
  pdf.text(`Total Amount: RM ${grandTotal.toFixed(2)}`, 20, yPosition)
  yPosition += 10

  pdf.setFont('helvetica', 'normal')
  pdf.text('This report contains detailed information for all receipts recorded on the selected date.', 20, yPosition)
  yPosition += 15

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

    // Add receipt image if available
    if (receipt.image_url) {
      try {
        // Add a caption for the image
        pdf.setFontSize(10)
        pdf.setTextColor(100, 100, 100)
        pdf.text('Receipt Image:', 20, yPosition)
        yPosition += 5

        // Get the image directly from storage
        const imagePath = receipt.image_url.replace('receipt-images/', '')
        console.log(`Downloading image: ${imagePath} for receipt ${receipt.id}`)

        const { data: imageData, error: imageError } = await supabaseClient
          .storage
          .from('receipt-images')
          .download(imagePath)

        if (imageError || !imageData) {
          console.error(`Failed to download image: ${imageError?.message || 'Unknown error'}`)
          throw new Error(`Failed to download image: ${imageError?.message || 'Unknown error'}`)
        }

        console.log(`Successfully downloaded image for receipt ${receipt.id}, size: ${imageData.size} bytes`)

        // Convert the image to a base64 string
        const imageBytes = await imageData.arrayBuffer()
        const base64Image = arrayBufferToBase64(imageBytes)

        // Calculate image dimensions to fit nicely on the page
        // with a maximum width and maintaining aspect ratio
        const maxImgWidth = 160 // mm
        const imgWidth = Math.min(maxImgWidth, 160)
        const imgHeight = 120 // Approximate height, will be adjusted by jsPDF

        // Check if image fits on current page
        if (yPosition + imgHeight > 260) {
          pdf.addPage()
          addHeader()
          yPosition = 60
        }

        // Add a border around the image
        pdf.setDrawColor(200, 200, 200)
        pdf.rect(20, yPosition, imgWidth, imgHeight)

        // Add the image to the PDF
        pdf.addImage(`data:image/jpeg;base64,${base64Image}`, 'JPEG', 20, yPosition, imgWidth, imgHeight)
        yPosition += imgHeight + 20

        // Reset text color
        pdf.setTextColor(0, 0, 0)
      } catch (imgError) {
        console.error('Error processing image:', imgError)
        // Add styled message for unavailable image
        pdf.setFillColor(245, 245, 245)
        pdf.rect(20, yPosition, 160, 30, 'F')
        pdf.setTextColor(100, 100, 100)
        pdf.text('Error loading receipt image', 100, yPosition + 15, { align: 'center' })
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

  // Summary table with improved styling
  const summaryData = receipts.map(receipt => [
    receipt.merchant,
    format(new Date(receipt.date), 'h:mm a'),
    receipt.payment_method || 'Not specified',
    receipt.total.toFixed(2)
  ])

  autoTable(pdf, {
    startY: 75, // Increased from 55 to 75 for more space
    head: [['Merchant', 'Time', 'Payment Method', 'Amount (RM)']],
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
  })

  // Add grand total with styled box
  const finalY = pdf.lastAutoTable.finalY + 10

  // Add a colored box for the grand total with dark background
  pdf.setFillColor(51, 51, 51) // Dark background
  pdf.rect(100, finalY - 5, 90, 10, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(255, 255, 255) // White text
  pdf.text(`Grand Total: RM ${grandTotal.toFixed(2)}`, 170, finalY, { align: 'right' })
  pdf.setTextColor(0, 0, 0) // Reset text color

  // Add some statistics
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text('Expense Statistics:', 20, finalY + 15)

  const avgExpense = grandTotal / receipts.length
  pdf.text(`• Average expense per receipt: RM ${avgExpense.toFixed(2)}`, 25, finalY + 25)

  // Find highest and lowest expenses
  const highestExpense = Math.max(...receipts.map(r => r.total))
  const lowestExpense = Math.min(...receipts.map(r => r.total))
  const highestMerchant = receipts.find(r => r.total === highestExpense)?.merchant || 'Unknown'

  pdf.text(`• Highest expense: RM ${highestExpense.toFixed(2)} (${highestMerchant})`, 25, finalY + 35)
  pdf.text(`• Lowest expense: RM ${lowestExpense.toFixed(2)}`, 25, finalY + 45)

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
