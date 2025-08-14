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

    // Extract date and includeImages from the request body
    const { date, includeImages = true } = requestBody; // Default includeImages to true

    if (!date) {
      console.error('Date parameter is missing');
      return new Response(JSON.stringify({ error: 'Date parameter is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log(`Processing request for date: ${date}, includeImages: ${includeImages}`);

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

    // Fetch receipts for the selected day, including thumbnail_url and custom categories
    console.log("Fetching receipts including thumbnail_url and custom categories");
    const { data: receiptsData, error: receiptsError } = await supabaseClient
      .from('receipts')
      .select(`
        *,
    image_url,
        thumbnail_url,
        line_items!line_items_receipt_id_fkey(*),
        custom_categories (
          id,
          name,
          color,
          icon
        )
      `)
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
      // Generate PDF with category mode and includeImages flag
      console.log(`Generating PDF in category mode...`);
      const pdfBytes = await generatePDF(receiptsWithLineItems, selectedDay, includeImages);
      console.log(`PDF generated successfully, size: ${pdfBytes.byteLength} bytes`);

      // Send PDF as response with correct headers
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="expense-report-${format(selectedDay, 'yyyy-MM-dd')}-category-mode.pdf"`
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

// Helper function to extract category from receipt data
function getReceiptCategory(receipt) {
  // Priority: custom category name → predicted category → 'Uncategorized'
  if (receipt.custom_categories && receipt.custom_categories.name) {
    return receipt.custom_categories.name;
  }
  if (receipt.predicted_category && receipt.predicted_category.trim()) {
    return receipt.predicted_category;
  }
  return 'Uncategorized';
}

// Function to generate PDF
async function generatePDF(receipts, selectedDay, includeImages = true) {
  console.log(`Generating PDF for ${receipts.length} receipts on ${selectedDay} in category mode, includeImages: ${includeImages}`);

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
      pdf.text('Mataresit', 190, 287, { align: 'right' })
    }
  }

  // Helper function to check if we need a page break
  const checkPageBreak = (currentY: number, requiredSpace: number = 20) => {
    // Leave at least 25mm from footer (287 - 25 = 262)
    if (currentY + requiredSpace > 262) {
      pdf.addPage()
      addHeader()
      return 60 // Return new Y position after header
    }
    return currentY
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

  // Fetch images in parallel with timeout and error handling
  console.time("TotalImageProcessing");
  const imageCache = new Map();
  const MAX_IMAGES = includeImages ? 20 : 0; // Increased limit for better reports
  let imageCount = 0;

  console.log(`=== IMAGE PROCESSING DEBUG START ===`);
  console.log(`includeImages parameter: ${includeImages}`);
  console.log(`Total receipts to process: ${receipts.length}`);
  console.log(`MAX_IMAGES limit: ${MAX_IMAGES}`);

  // Log receipt details for debugging
  receipts.forEach((receipt, index) => {
    console.log(`Receipt ${index + 1}: ${receipt.id}`);
    console.log(`  - merchant: ${receipt.merchant}`);
    console.log(`  - image_url: ${receipt.image_url}`);
    console.log(`  - thumbnail_url: ${receipt.thumbnail_url}`);
    console.log(`  - has thumbnail: ${!!receipt.thumbnail_url}`);
    console.log(`  - custom_category_id: ${receipt.custom_category_id}`);
    console.log(`  - custom_categories: ${JSON.stringify(receipt.custom_categories)}`);
    console.log(`  - predicted_category: ${receipt.predicted_category}`);
  });
  console.log(`=== END RECEIPT DETAILS ===`);

  async function getCachedImage(url) {
    if (imageCache.has(url)) {
      console.log(`Using cached image for: ${url}`);
      return imageCache.get(url);
    }

    console.log(`Fetching image from: ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout for full-size images

      console.log(`Starting fetch for: ${url}`);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      console.log(`Fetch response for ${url}: status=${response.status}, ok=${response.ok}, headers=${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status} for ${url}: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const buffer = await response.arrayBuffer();
      console.log(`Successfully fetched image from ${url}, size: ${buffer.byteLength} bytes`);
      imageCache.set(url, buffer);
      return buffer;
    } catch (error) {
      console.error(`Failed to fetch image from ${url}:`, error.message);
      console.error(`Error details:`, error);
      return null;
    }
  }

  // Helper function to choose the best available image URL (prefer original image_url)
  function getPreferredImageUrl(receipt) {
    if (receipt.image_url && receipt.image_url.trim() !== "") {
      return receipt.image_url;
    }
    if (receipt.thumbnail_url && receipt.thumbnail_url.trim() !== "") {
      return receipt.thumbnail_url;
    }
    return null;
  }

  const imageFetchPromises = receipts.map(async (receipt, index) => {
    console.log(`Processing receipt ${index + 1}/${receipts.length}: ${receipt.id}`);
    console.log(`  - includeImages: ${includeImages}`);
    console.log(`  - thumbnail_url: ${receipt.thumbnail_url}`);
    console.log(`  - image_url: ${receipt.image_url}`);
    console.log(`  - imageCount: ${imageCount}/${MAX_IMAGES}`);

    if (!includeImages) {
      console.log(`  - Skipping: includeImages is false`);
      return { index, imageData: null };
    }

    const preferredUrl = getPreferredImageUrl(receipt);
    if (!preferredUrl) {
      console.log(`  - Skipping: no image_url or thumbnail_url available`);
      return { index, imageData: null };
    }

    if (imageCount >= MAX_IMAGES) {
      console.log(`  - Skipping: reached MAX_IMAGES limit`);
      return { index, imageData: null };
    }

    imageCount++;
    try {
      // Try preferred URL first (original image when available), then fallback to thumbnail
      console.log(`  - Trying preferred URL: ${preferredUrl}`);
      let buffer = await getCachedImage(preferredUrl);

      if (!buffer && receipt.thumbnail_url && preferredUrl !== receipt.thumbnail_url) {
        console.log(`  - Preferred URL failed, trying thumbnail URL for receipt ${receipt.id}`);
        buffer = await getCachedImage(receipt.thumbnail_url);
      }

      if (!buffer) {
        console.log(`  - Failed to fetch any image for receipt ${receipt.id}`);
        return { index, imageData: null };
      }

      console.log(`  - Successfully fetched image, buffer size: ${buffer.byteLength} bytes`);

      // Detect content type from URL
      const urlForType = buffer ? (preferredUrl || receipt.thumbnail_url || "") : "";
      let contentType = "image/jpeg"; // Default
      const lower = (urlForType || "").toLowerCase();
      if (lower.includes(".png")) {
        contentType = "image/png";
      } else if (lower.includes(".webp")) {
        contentType = "image/webp";
      }

      const base64Image = encodeBase64(buffer); // From Deno std
      const format = contentType.includes("png") ? "PNG" : "JPEG";

      console.log(`  - Image processed successfully: ${format}, base64 length: ${base64Image.length}`);

      return {
        index,
        imageData: { base64Image, contentType, format }
      };
    } catch (error) {
      console.error(`  - Failed to process image for receipt ${receipt.id}:`, error.message);
      return { index, imageData: null };
    }
  });

  // Resolve all image promises
  const imageResults = await Promise.all(imageFetchPromises);
  const imageMap = new Map(imageResults.map(({ index, imageData }) => [index, imageData]));
  console.timeEnd("TotalImageProcessing");

  // Debug image results
  console.log(`Image processing complete:`);
  console.log(`  - Total receipts: ${receipts.length}`);
  console.log(`  - Image results: ${imageResults.length}`);
  console.log(`  - Successful images: ${imageResults.filter(r => r.imageData !== null).length}`);
  console.log(`  - Failed images: ${imageResults.filter(r => r.imageData === null).length}`);

  imageResults.forEach(({ index, imageData }) => {
    const receipt = receipts[index];
    console.log(`  - Receipt ${index} (${receipt?.id}): ${imageData ? 'SUCCESS' : 'FAILED'}`);
  });

  // Define image dimensions for maximum readability (use full width, preserve aspect ratio)
  const imageWidth = 170; // mm - near full page width for maximum readability
  // Height will be calculated automatically to preserve aspect ratio

  // Process each receipt
  for (const receipt of receipts) {
    // Check if we need a new page using the helper function
    yPosition = checkPageBreak(yPosition, 140); // Increased space estimate for larger images

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

    // Add receipt image if available
    if (includeImages) {
      const receiptIndex = receipts.indexOf(receipt);
      const imageData = imageMap.get(receiptIndex);
      console.log(`Adding image for receipt ${receipt.id} (index ${receiptIndex}):`, {
        hasImageData: !!imageData,
        imageMapSize: imageMap.size,
        includeImages
      });

      if (imageData) {
        try {
          // Check if we need a page break for the image
          yPosition = checkPageBreak(yPosition, 120); // Estimate space needed for image

          const dataUri = `data:${imageData.contentType};base64,${imageData.base64Image}`;
          console.log(`Adding image to PDF: format=${imageData.format}, position=(20, ${yPosition}), width=${imageWidth}mm (height auto)`);
          pdf.addImage(dataUri, imageData.format, 20, yPosition, imageWidth, 0); // 0 height preserves aspect ratio
          yPosition += 110; // Estimated space for image + margin
          console.log(`Image added successfully for receipt ${receipt.id}`);
        } catch (e) {
          console.error(`Error adding image to PDF for receipt ${receipt.id}:`, e.message);
        }
      } else {
        console.log(`No image data available for receipt ${receipt.id} (index ${receiptIndex})`);
      }
    } else {
      console.log(`Images disabled for receipt ${receipt.id}`);
    }

    // Add receipt total with highlighted box
    pdf.setFillColor(230, 230, 250) // Light purple background
    pdf.rect(120, yPosition - 5, 70, 10, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.text(`Total: RM ${receipt.total.toFixed(2)}`, 170, yPosition, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    yPosition += 15

    // Add a divider line between receipts
    if (receipts.indexOf(receipt) < receipts.length - 1) {
      pdf.setDrawColor(200, 200, 200)
      pdf.line(20, yPosition, 190, yPosition)
      yPosition += 10

      // Check if we need a page break using the helper function
      yPosition = checkPageBreak(yPosition, 40);
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

  // --- Generate Category Mode Summary and Statistics ---
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
      // Extract category with proper fallback logic
      const category = getReceiptCategory(receipt);
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

      // Debug logging for category extraction
      console.log(`Receipt ${receipt.id}: category="${category}", custom_category_id=${receipt.custom_category_id}, predicted_category="${receipt.predicted_category}"`);

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
  // Check if we need a page break before starting statistics
  statsY = checkPageBreak(statsY, 50);

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
      statsY = checkPageBreak(statsY, 35); // Use helper function with proper spacing

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
  // Check for page break before spending highlights
  statsY = checkPageBreak(statsY, 25);

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
      ? `RM ${highestExpenseValue.toFixed(2)} (Category: ${getReceiptCategory(highestExpenseReceipt)})`
      : 'N/A';
  const lowestText = lowestExpenseReceipt
      ? `RM ${lowestExpenseValue.toFixed(2)} (Category: ${getReceiptCategory(lowestExpenseReceipt)})`
      : 'N/A';


  pdf.text(`• Highest Single Expense: ${highestText}`, 25, statsY);
  statsY += 6;
  pdf.text(`• Lowest Single Expense: ${lowestText}`, 25, statsY);

  // Add grand total with styled box (This is outside the if/else as it's always shown)
  let finalY = pdf.lastAutoTable.finalY + 10

  // Check for page break before grand total
  if (finalY > 252) { // Ensure grand total doesn't overlap with footer
    pdf.addPage()
    addHeader()
    finalY = 60
  }

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
