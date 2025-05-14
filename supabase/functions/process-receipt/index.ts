/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { TextractClient, AnalyzeExpenseCommand } from 'npm:@aws-sdk/client-textract'
import { ProcessingLogger } from './shared/db-logger.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encodeBase64 } from "jsr:@std/encoding/base64"
// Import deno-image for resizing
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

// Maximum image size for processing (in bytes)
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB - reduced from 5MB

// Maximum image dimensions for OCR processing
const MAX_IMAGE_DIMENSION = 1500; // 1500px - reduced from 2000px

// Always optimize images regardless of size
const ALWAYS_OPTIMIZE = true;

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Construct the target function URL dynamically
const enhanceFunctionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/enhance-receipt-data`;

// Configure AWS Textract client
const textractClient = new TextractClient({
  region: Deno.env.get('AWS_REGION') || 'us-east-1',
  credentials: {
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') || '',
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') || '',
  },
})

// Main function to process receipt image and extract data
async function processReceiptImage(
  imageBytes: Uint8Array,
  imageUrl: string,
  receiptId: string,
  primaryMethod: 'ocr-ai' | 'ai-vision' = 'ocr-ai',
  modelId: string = '',
  compareWithAlternative: boolean = false,
  requestHeaders: { Authorization?: string | null; apikey?: string | null } = { Authorization: null, apikey: null }
) {
  const logger = new ProcessingLogger(receiptId);
  const startTime = performance.now(); // Record start time
  let processingTime = 0;

  try {
    // Initialize results for primary and alternative methods
    let primaryResult: any = null;
    let alternativeResult: any = null;
    let discrepancies: any[] = [];
    let modelUsed = '';

    // Prepare headers for the internal fetch call
    const internalFetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (requestHeaders.Authorization) {
      internalFetchHeaders['Authorization'] = requestHeaders.Authorization;
    }
    if (requestHeaders.apikey) {
      internalFetchHeaders['apikey'] = requestHeaders.apikey;
    }

    // Process with primary method
    if (primaryMethod === 'ocr-ai') {
      // OCR + AI method
      await logger.log("Using OCR + AI as primary method", "METHOD");

      // Step 1: Perform OCR with Amazon Textract
      await logger.log("Starting OCR processing with Amazon Textract", "OCR");
      console.log("Calling Amazon Textract for OCR processing...");

      // Call Amazon Textract to analyze the expense document (receipt/invoice)
      const command = new AnalyzeExpenseCommand({
        Document: { Bytes: imageBytes },
      });

      const response = await textractClient.send(command);
      console.log("Received response from Amazon Textract");
      await logger.log("Amazon Textract analysis complete", "OCR");

      // Step 2: Extract structured data from Textract response
      const textractResult = extractTextractData(response, logger);

      // Step 3: Enhance with selected AI model
      await logger.log("Starting AI enhancement of OCR data", "AI");
      console.log("Calling AI to enhance OCR data...");

      try {
        const enhanceResponse = await fetch(
          enhanceFunctionUrl,
          {
            method: 'POST',
            headers: internalFetchHeaders,
            body: JSON.stringify({
              textractData: textractResult,
              fullText: textractResult.fullText,
              receiptId: receiptId,
              modelId: modelId
            }),
          }
        );

        if (enhanceResponse.ok) {
          const enhancedData = await enhanceResponse.json();
          console.log("Received enhanced data from AI:", enhancedData);
          await logger.log("AI enhancement complete", "AI");

          // Update results with AI enhanced data
          primaryResult = mergeTextractAndAIData(textractResult, enhancedData.result);
          modelUsed = enhancedData.model_used;
        } else {
          console.error("Error calling AI enhancement:", await enhanceResponse.text());
          await logger.log("AI enhancement failed", "AI");
          // Continue with Textract data only
          primaryResult = textractResult;
        }
      } catch (enhanceError) {
        console.error("Error during AI enhancement:", enhanceError);
        await logger.log(`AI error: ${enhanceError.message}`, "ERROR");
        // Continue with Textract data only
        primaryResult = textractResult;
      }
    } else {
      // AI Vision method - send image directly to AI
      await logger.log("Using AI Vision as primary method", "METHOD");
      console.log("Calling AI Vision for direct image processing...");

      // Log the target URL
      console.log(`Attempting to call enhance-receipt-data at: ${enhanceFunctionUrl}`);
      await logger.log(`Calling enhance-receipt-data at: ${enhanceFunctionUrl}`, "DEBUG");

      try {
        // Ensure image is optimized for AI Vision to reduce resource usage
        const encodedImage = encodeBase64(imageBytes);
        const imageSize = encodedImage.length;

        // Log image size for debugging
        await logger.log(`Encoded image size for AI Vision: ${imageSize} bytes`, "DEBUG");

        // Check if image is too large for AI Vision
        if (imageSize > 1.5 * 1024 * 1024) { // 1.5MB limit for base64 encoded image
          await logger.log(`Image too large for AI Vision (${imageSize} bytes), falling back to OCR+AI method`, "WARNING");

          // Fall back to OCR+AI method
          await logger.log("Falling back to OCR+AI method due to image size constraints", "METHOD");

          // Step 1: Perform OCR with Amazon Textract
          await logger.log("Starting OCR processing with Amazon Textract (fallback)", "OCR");
          console.log("Calling Amazon Textract for OCR processing (fallback from AI Vision)...");

          const command = new AnalyzeExpenseCommand({
            Document: { Bytes: imageBytes },
          });

          const response = await textractClient.send(command);
          console.log("Received response from Amazon Textract");
          await logger.log("Amazon Textract analysis complete", "OCR");

          // Step 2: Extract structured data from Textract response
          const textractResult = extractTextractData(response, logger);

          // Step 3: Enhance with selected AI model
          await logger.log("Starting AI enhancement of OCR data (fallback)", "AI");
          console.log("Calling AI to enhance OCR data...");

          try {
            const enhanceResponse = await fetch(
              enhanceFunctionUrl,
              {
                method: 'POST',
                headers: internalFetchHeaders,
                body: JSON.stringify({
                  textractData: textractResult,
                  fullText: textractResult.fullText,
                  receiptId: receiptId,
                  modelId: modelId
                }),
              }
            );

            if (enhanceResponse.ok) {
              const enhancedData = await enhanceResponse.json();
              console.log("Received enhanced data from AI:", enhancedData);
              await logger.log("AI enhancement complete (fallback)", "AI");

              // Update results with AI enhanced data
              primaryResult = mergeTextractAndAIData(textractResult, enhancedData.result);
              modelUsed = enhancedData.model_used;
            } else {
              console.error("Error calling AI enhancement (fallback):", await enhanceResponse.text());
              await logger.log("AI enhancement failed (fallback)", "AI");
              // Continue with Textract data only
              primaryResult = textractResult;
            }
          } catch (enhanceError) {
            console.error("Error during AI enhancement (fallback):", enhanceError);
            await logger.log(`AI error (fallback): ${enhanceError.message}`, "ERROR");
            // Continue with Textract data only
            primaryResult = textractResult;
          }

          return; // Exit this block, we've handled the fallback
        }

        // Proceed with AI Vision if image is not too large
        const visionResponse = await fetch(
          enhanceFunctionUrl,
          {
            method: 'POST',
            headers: internalFetchHeaders,
            body: JSON.stringify({
              imageData: {
                data: encodedImage,
                mimeType: 'image/jpeg',
                isBase64: true
              },
              receiptId: receiptId,
              modelId: modelId
            }),
          }
        );

        if (visionResponse.ok) {
          const visionData = await visionResponse.json();
          console.log("Received data from AI Vision:", visionData);
          await logger.log("AI Vision processing complete", "AI");

          primaryResult = formatAIVisionResult(visionData.result);
          modelUsed = visionData.model_used;
        } else {
          // Check for resource limit errors
          const errorText = await visionResponse.text();
          console.error(`Error calling AI Vision: Status ${visionResponse.status} ${visionResponse.statusText}, Response: ${errorText}`);
          await logger.log(`AI Vision fetch failed: Status ${visionResponse.status}, Error: ${errorText}`, "ERROR");

          // Check if this is a resource limit error
          if (errorText.includes("WORKER_LIMIT") || errorText.includes("compute resources")) {
            await logger.log("Detected resource limit error, falling back to OCR+AI method", "ERROR");

            // Fall back to OCR+AI method
            await logger.log("Falling back to OCR+AI method due to resource constraints", "METHOD");

            // Step 1: Perform OCR with Amazon Textract
            await logger.log("Starting OCR processing with Amazon Textract (fallback)", "OCR");
            console.log("Calling Amazon Textract for OCR processing (fallback from AI Vision)...");

            const command = new AnalyzeExpenseCommand({
              Document: { Bytes: imageBytes },
            });

            const response = await textractClient.send(command);
            console.log("Received response from Amazon Textract");
            await logger.log("Amazon Textract analysis complete", "OCR");

            // Step 2: Extract structured data from Textract response
            const textractResult = extractTextractData(response, logger);

            // Use Textract data only since we already hit resource limits
            primaryResult = textractResult;
            modelUsed = "textract-only";

            await logger.log("Using Textract data only due to resource constraints", "AI");
          } else {
            // For other errors, throw normally
            throw new Error(`AI Vision processing failed with status ${visionResponse.status}: ${errorText}`);
          }
        }
      } catch (visionError) {
        // Log the full error object
        console.error("Error during AI Vision processing fetch call:", visionError);
        await logger.log(`AI Vision fetch exception: ${visionError.message}, Stack: ${visionError.stack}`, "ERROR");

        // Check if this is a resource limit error
        if (visionError.message && (visionError.message.includes("WORKER_LIMIT") || visionError.message.includes("compute resources"))) {
          await logger.log("Detected resource limit error in exception, falling back to OCR+AI method", "ERROR");

          try {
            // Fall back to OCR+AI method
            await logger.log("Falling back to OCR+AI method due to resource constraints", "METHOD");

            // Step 1: Perform OCR with Amazon Textract
            await logger.log("Starting OCR processing with Amazon Textract (fallback)", "OCR");
            console.log("Calling Amazon Textract for OCR processing (fallback from AI Vision)...");

            const command = new AnalyzeExpenseCommand({
              Document: { Bytes: imageBytes },
            });

            const response = await textractClient.send(command);
            console.log("Received response from Amazon Textract");
            await logger.log("Amazon Textract analysis complete", "OCR");

            // Step 2: Extract structured data from Textract response
            const textractResult = extractTextractData(response, logger);

            // Use Textract data only since we already hit resource limits
            primaryResult = textractResult;
            modelUsed = "textract-only";

            await logger.log("Using Textract data only due to resource constraints", "AI");
          } catch (fallbackError) {
            console.error("Error during fallback processing:", fallbackError);
            await logger.log(`Fallback processing error: ${fallbackError.message}`, "ERROR");
            throw fallbackError; // If fallback also fails, propagate the error
          }
        } else {
          // For other errors, rethrow
          throw visionError;
        }
      }
    }

    // If comparison is requested, process with alternative method
    if (compareWithAlternative) {
      await logger.log("Starting comparison with alternative method", "COMPARE");

      if (primaryMethod === 'ocr-ai') {
        // Primary was OCR+AI, alternative is AI Vision
        await logger.log("Using AI Vision as alternative method", "METHOD");

        try {
          const visionResponse = await fetch(
            enhanceFunctionUrl,
            {
              method: 'POST',
              headers: internalFetchHeaders,
              body: JSON.stringify({
                imageData: {
                  data: encodeBase64(imageBytes),
                  mimeType: 'image/jpeg',
                  isBase64: true
                },
                receiptId: `${receiptId}-alt`, // Use different ID for logging
                modelId: '' // Use default vision model
              }),
            }
          );

          if (visionResponse.ok) {
            const visionData = await visionResponse.json();
            console.log("Received data from alternative AI Vision:", visionData);
            await logger.log("Alternative AI Vision processing complete", "AI");

            alternativeResult = formatAIVisionResult(visionData.result);
          }
        } catch (altError) {
          console.error("Error during alternative method:", altError);
          await logger.log(`Alternative method error: ${altError.message}`, "ERROR");
        }
      } else {
        // Primary was AI Vision, alternative is OCR+AI
        await logger.log("Using OCR + AI as alternative method", "METHOD");

        try {
          // Step 1: Perform OCR with Amazon Textract
          const command = new AnalyzeExpenseCommand({
            Document: { Bytes: imageBytes },
          });

          const response = await textractClient.send(command);

          // Step 2: Extract structured data from Textract response
          const textractResult = extractTextractData(response, logger);

          // Step 3: Enhance with default text model
          const enhanceResponse = await fetch(
            enhanceFunctionUrl,
            {
              method: 'POST',
              headers: internalFetchHeaders,
              body: JSON.stringify({
                textractData: textractResult,
                fullText: textractResult.fullText,
                receiptId: `${receiptId}-alt`, // Use different ID for logging
                modelId: '' // Use default text model
              }),
            }
          );

          if (enhanceResponse.ok) {
            const enhancedData = await enhanceResponse.json();
            await logger.log("Alternative OCR + AI processing complete", "AI");

            alternativeResult = mergeTextractAndAIData(textractResult, enhancedData.result);
          }
        } catch (altError) {
          console.error("Error during alternative method:", altError);
          await logger.log(`Alternative method error: ${altError.message}`, "ERROR");
        }
      }

      // Compare results and identify discrepancies if alternative method was successful
      if (alternativeResult) {
        discrepancies = findDiscrepancies(primaryResult, alternativeResult);
        await logger.log(`Found ${discrepancies.length} discrepancies between methods`, "COMPARE");
      }
    }

    const endTime = performance.now(); // Record end time
    processingTime = (endTime - startTime) / 1000; // Calculate duration in seconds

    await logger.log(`Processing complete in ${processingTime.toFixed(2)} seconds`, "COMPLETE");

    // Include processing time and comparison results in the result
    return {
      ...primaryResult,
      processing_time: processingTime,
      alternativeResult: alternativeResult,
      discrepancies: discrepancies,
      modelUsed: modelUsed,
      primaryMethod: primaryMethod
    };
  } catch (error) {
    console.error('Error processing receipt:', error);
    await logger.log(`Error processing receipt: ${error.message}`, "ERROR");
    throw new Error(`Failed to process receipt image: ${error.message}`);
  }
}

// Helper function to extract structured data from Textract response
function extractTextractData(response: any, logger: ProcessingLogger) {
  // Feature flag to control whether to use the new columns
  const ENABLE_GEOMETRY_COLUMNS = true; // Re-enabled now that columns exist in the database

  // Initialize the result structure
  const result = {
    merchant: '',
    date: '',
    total: 0,
    tax: 0,
    payment_method: '',
    currency: 'MYR', // Default to MYR instead of USD
    line_items: [] as { description: string; amount: number; geometry?: any }[],
    fullText: '',
    predicted_category: '',
    ai_suggestions: {} as Record<string, any>,
    confidence: {
      merchant: 50, // Default to medium confidence instead of 0
      date: 50,     // Default to medium confidence instead of 0
      total: 50,     // Default to medium confidence instead of 0
      tax: 50,       // Default to medium confidence instead of 0
      payment_method: 50, // Default to medium confidence instead of 0
      line_items: 50,    // Default to medium confidence instead of 0
    }
  } as any;

  // Only add geometry fields if enabled by feature flag
  if (ENABLE_GEOMETRY_COLUMNS) {
    // Add geometry information for field locations
    result.geometry = {
      merchant: null as any,
      date: null as any,
      total: null as any,
      tax: null as any,
      payment_method: null as any,
    };

    // Store raw document structure for potential future use
    result.document_structure = {
      blocks: [] as any[],
      page_dimensions: { width: 0, height: 0 }
    };
  }

    // Store the raw document structure for potential future use if enabled
    if (ENABLE_GEOMETRY_COLUMNS && response.ExpenseDocuments) {
      // Extract blocks for document structure
      if (result.document_structure) {
        result.document_structure.blocks = response.ExpenseDocuments.map((doc: any) => ({
          id: doc.Id,
          type: 'EXPENSE_DOCUMENT',
          confidence: doc.Confidence,
          // Only store essential geometry information to keep size manageable
          geometry: doc.Geometry ? {
            boundingBox: doc.Geometry.BoundingBox,
            // Skip polygon to reduce data size
          } : null
        }));
      }
    }

    // Process the structured data from ExpenseDocuments
    if (response.ExpenseDocuments && response.ExpenseDocuments.length > 0) {
      const expenseDoc = response.ExpenseDocuments[0];

      // Extract full text for backup processing
      let fullText = '';

      // Process summary fields
      if (expenseDoc.SummaryFields) {
        for (const field of expenseDoc.SummaryFields) {
          if (field.Type?.Text && field.ValueDetection?.Text) {
            const fieldType = field.Type.Text;
            const fieldValue = field.ValueDetection.Text;
            // Convert confidence from decimal (0-1) to percentage (0-100)
            const confidence = field.ValueDetection.Confidence ? Math.round(field.ValueDetection.Confidence) : 0;

            // Add to full text
            fullText += `${field.LabelDetection?.Text || field.Type.Text}: ${fieldValue}\n`;

            // Extract geometry information if available
            const geometry = field.ValueDetection?.Geometry || null;

            // Map Textract fields to our data structure
            switch (fieldType) {
              case 'VENDOR_NAME':
                result.merchant = fieldValue;
                // Adjust confidence based on field value quality
                result.confidence.merchant = calculateFieldConfidence(confidence, fieldValue, 'merchant');
                // Store geometry information if enabled
                if (ENABLE_GEOMETRY_COLUMNS && geometry && result.geometry) {
                  result.geometry.merchant = {
                    boundingBox: geometry.BoundingBox,
                    polygon: geometry.Polygon
                  };
                }
                console.log(`[DEBUG] Receipt: ${logger.receiptId} - VENDOR_NAME BBox: ${JSON.stringify(field.ValueDetection?.Geometry?.BoundingBox)}`);
                break;
              case 'INVOICE_RECEIPT_DATE':
                // Normalize date format - convert to YYYY-MM-DD
                let normalizedDate = fieldValue;

                // Try to parse different date formats
                // Check for DD-MM-YYYY format (e.g., 19-03-2025)
                const ddmmyyyyRegex = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
                const ddmmyyyyMatch = fieldValue.match(ddmmyyyyRegex);

                if (ddmmyyyyMatch) {
                  // Convert DD-MM-YYYY to YYYY-MM-DD
                  const day = ddmmyyyyMatch[1].padStart(2, '0');
                  const month = ddmmyyyyMatch[2].padStart(2, '0');
                  const year = ddmmyyyyMatch[3];
                  normalizedDate = `${year}-${month}-${day}`;
                  console.log(`Normalized date from ${fieldValue} to ${normalizedDate}`);
                } else {
                  // Try other formats - MM-DD-YYYY or MM/DD/YYYY
                  const mmddyyyyRegex = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
                  const mmddyyyyMatch = fieldValue.match(mmddyyyyRegex);

                  if (mmddyyyyMatch) {
                    // For US format, assume it's MM-DD-YYYY
                    // Convert to YYYY-MM-DD
                    const month = mmddyyyyMatch[1].padStart(2, '0');
                    const day = mmddyyyyMatch[2].padStart(2, '0');
                    const year = mmddyyyyMatch[3];

                    // Validate month/day values to avoid invalid dates
                    if (parseInt(month) <= 12 && parseInt(day) <= 31) {
                      normalizedDate = `${year}-${month}-${day}`;
                      console.log(`Normalized date from ${fieldValue} to ${normalizedDate}`);
                    }
                  }
                }

                // If already in YYYY-MM-DD format, keep as is
                const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!isoRegex.test(normalizedDate)) {
                  // As a fallback, try Date object parsing as a last resort
                  try {
                    const dateObj = new Date(fieldValue);
                    if (!isNaN(dateObj.getTime())) {
                      normalizedDate = dateObj.toISOString().split('T')[0];
                      console.log(`Date fallback parsing: ${fieldValue} -> ${normalizedDate}`);
                    }
                  } catch (e) {
                    console.error(`Failed to parse date: ${fieldValue}`, e);
                  }
                }

                // Save normalized date to result
                result.date = normalizedDate;

                // Adjust confidence based on date validation success
                const dateFormatConfidence = normalizedDate !== fieldValue ? 90 : confidence;
                result.confidence.date = calculateFieldConfidence(dateFormatConfidence, normalizedDate, 'date');

                // Store geometry information if enabled
                if (ENABLE_GEOMETRY_COLUMNS && geometry && result.geometry) {
                  result.geometry.date = {
                    boundingBox: geometry.BoundingBox,
                    polygon: geometry.Polygon
                  };
                }
                break;
              case 'TOTAL':
                // Remove currency symbols and convert to number
                result.total = parseFloat(fieldValue.replace(/[$€£RM]/g, ''));
                // Adjust confidence based on parsed value
                result.confidence.total = calculateFieldConfidence(confidence, result.total.toString(), 'total');
                // Store geometry information if enabled
                if (ENABLE_GEOMETRY_COLUMNS && geometry && result.geometry) {
                  result.geometry.total = {
                    boundingBox: geometry.BoundingBox,
                    polygon: geometry.Polygon
                  };
                }
                break;
              case 'TAX':
                result.tax = parseFloat(fieldValue.replace(/[$€£RM]/g, ''));
                result.confidence.tax = calculateFieldConfidence(confidence, result.tax.toString(), 'tax');
                // Store geometry information if enabled
                if (ENABLE_GEOMETRY_COLUMNS && geometry && result.geometry) {
                  result.geometry.tax = {
                    boundingBox: geometry.BoundingBox,
                    polygon: geometry.Polygon
                  };
                }
                break;
              case 'PAYMENT_TERMS':
                result.payment_method = fieldValue;
                result.confidence.payment_method = calculateFieldConfidence(confidence, fieldValue, 'payment_method');
                // Store geometry information if enabled
                if (ENABLE_GEOMETRY_COLUMNS && geometry && result.geometry) {
                  result.geometry.payment_method = {
                    boundingBox: geometry.BoundingBox,
                    polygon: geometry.Polygon
                  };
                }
                break;
            }
          }
        }
      }

      // Process line items
      if (expenseDoc.LineItemGroups) {
        for (const group of expenseDoc.LineItemGroups) {
          if (group.LineItems) {
            for (const lineItem of group.LineItems) {
              let description = '';
              let amount = 0;

              // Extract expense line items
              if (lineItem.LineItemExpenseFields) {
                let itemGeometry: any = null;
                let priceGeometry: any = null;

                for (const field of lineItem.LineItemExpenseFields) {
                  if (field.Type?.Text === 'ITEM' && field.ValueDetection?.Text) {
                    description = field.ValueDetection.Text;
                    // Store item geometry if available
                    if (field.ValueDetection?.Geometry) {
                      itemGeometry = {
                        boundingBox: field.ValueDetection.Geometry.BoundingBox,
                        polygon: field.ValueDetection.Geometry.Polygon
                      };
                    }
                    console.log(`[DEBUG] Receipt: ${logger.receiptId} - Line Item Desc: "${description}", ITEM BBox: ${JSON.stringify(field.ValueDetection.Geometry.BoundingBox)}`);
                  } else if (field.Type?.Text === 'PRICE' && field.ValueDetection?.Text) {
                    amount = parseFloat(field.ValueDetection.Text.replace(/[$€£RM]/g, ''));
                    // Store price geometry if available
                    if (field.ValueDetection?.Geometry) {
                      priceGeometry = {
                        boundingBox: field.ValueDetection.Geometry.BoundingBox,
                        polygon: field.ValueDetection.Geometry.Polygon
                      };
                    }
                    console.log(`[DEBUG] Receipt: ${logger.receiptId} - Line Item Price: "${amount}", PRICE BBox: ${JSON.stringify(field.ValueDetection.Geometry.BoundingBox)}`);
                  }
                }

                if (description && amount > 0) {
                  let lineItem: any = {
                    description,
                    amount
                  };

                  // Log the line item for debugging
                  console.log(`Extracted line item: ${description} - ${amount}`);

                  // Only add geometry if enabled by feature flag
                  if (ENABLE_GEOMETRY_COLUMNS) {
                    // Create a combined geometry object for the line item
                    const lineItemGeometry: any = {
                      item: itemGeometry,
                      price: priceGeometry
                    };

                    // Add combined bounding box if both item and price geometries exist
                    if (itemGeometry?.boundingBox && priceGeometry?.boundingBox) {
                      // Calculate the leftmost, topmost, rightmost, and bottommost points
                      const leftmost = Math.min(itemGeometry.boundingBox.Left, priceGeometry.boundingBox.Left);
                      const topmost = Math.min(itemGeometry.boundingBox.Top, priceGeometry.boundingBox.Top);
                      const rightmost = Math.max(
                        itemGeometry.boundingBox.Left + itemGeometry.boundingBox.Width,
                        priceGeometry.boundingBox.Left + priceGeometry.boundingBox.Width
                      );
                      const bottommost = Math.max(
                        itemGeometry.boundingBox.Top + itemGeometry.boundingBox.Height,
                        priceGeometry.boundingBox.Top + priceGeometry.boundingBox.Height
                      );

                      // Ensure values stay within normalized bounds (0-1)
                      const boundedLeft = Math.max(0, Math.min(1, leftmost));
                      const boundedTop = Math.max(0, Math.min(1, topmost));
                      const boundedRight = Math.max(0, Math.min(1, rightmost));
                      const boundedBottom = Math.max(0, Math.min(1, bottommost));

                      // Create the combined bounding box with bounded values
                      lineItemGeometry.combined = {
                        Left: boundedLeft,
                        Top: boundedTop,
                        Width: Math.min(boundedRight - boundedLeft, 1 - boundedLeft), // Ensure width doesn't exceed bounds
                        Height: Math.min(boundedBottom - boundedTop, 1 - boundedTop)  // Ensure height doesn't exceed bounds
                      };
                    } else if (itemGeometry?.boundingBox) {
                      // Ensure individual item bounding box stays within bounds
                      const box = itemGeometry.boundingBox;
                      lineItemGeometry.combined = {
                        Left: Math.max(0, Math.min(1, box.Left)),
                        Top: Math.max(0, Math.min(1, box.Top)),
                        Width: Math.min(box.Width, 1 - Math.max(0, box.Left)),
                        Height: Math.min(box.Height, 1 - Math.max(0, box.Top))
                      };
                    } else if (priceGeometry?.boundingBox) {
                      // Ensure individual price bounding box stays within bounds
                      const box = priceGeometry.boundingBox;
                      lineItemGeometry.combined = {
                        Left: Math.max(0, Math.min(1, box.Left)),
                        Top: Math.max(0, Math.min(1, box.Top)),
                        Width: Math.min(box.Width, 1 - Math.max(0, box.Left)),
                        Height: Math.min(box.Height, 1 - Math.max(0, box.Top))
                      };
                    }

                    lineItem.geometry = lineItemGeometry;
                  }

                  result.line_items.push(lineItem);
                }
              }
            }
          }
        }

        // Set confidence for line items
        if (result.line_items.length > 0) {
          // Calculate confidence based on number of items detected
          const count = result.line_items.length;
          // More items = higher confidence in overall structure detection
          const lineItemConfidence = Math.min(75 + (count * 5), 95);
          result.confidence.line_items = lineItemConfidence;
        }
      }

      result.fullText = fullText;
    }

  return result;
}

// Merge Textract and AI enhanced data
function mergeTextractAndAIData(textractData: any, enhancedData: any) {
  const result = { ...textractData };

  // Currency enhancement
  if (enhancedData.currency) {
    result.currency = enhancedData.currency;
  }

  // Payment method enhancement
  if (enhancedData.payment_method) {
    result.payment_method = enhancedData.payment_method;

    // Update confidence score for payment method
    if (enhancedData.confidence?.payment_method) {
      result.confidence.payment_method = enhancedData.confidence.payment_method;
    } else {
      result.confidence.payment_method = 85; // Default high confidence for AI results
    }
  }

  // Category prediction
  if (enhancedData.predicted_category) {
    result.predicted_category = enhancedData.predicted_category;
  }

  // AI Suggestions
  if (enhancedData.suggestions) {
    result.ai_suggestions = enhancedData.suggestions;
  }

  // Other field enhancements if provided by AI
  if (enhancedData.merchant && (!result.merchant || enhancedData.confidence?.merchant > result.confidence.merchant)) {
    result.merchant = enhancedData.merchant;
    if (enhancedData.confidence?.merchant) {
      result.confidence.merchant = enhancedData.confidence.merchant;
    }
    // Preserve geometry information if we're keeping the original merchant
    // Otherwise, we'll lose the bounding box data when AI provides a better merchant name
  }

  if (enhancedData.total && (!result.total || enhancedData.confidence?.total > result.confidence.total)) {
    result.total = enhancedData.total;
    if (enhancedData.confidence?.total) {
      result.confidence.total = enhancedData.confidence.total;
    }
    // Preserve geometry information if we're keeping the original total
  }

  // Merge line items if provided by AI and better than OCR
  if (enhancedData.line_items && Array.isArray(enhancedData.line_items) &&
      (result.line_items.length === 0 || enhancedData.line_items.length > result.line_items.length)) {

    // If AI provides more line items, use those but try to preserve geometry from OCR where possible
    const aiLineItems = enhancedData.line_items.map((aiItem: any) => {
      // Try to find a matching OCR line item to preserve geometry
      const matchingOcrItem = result.line_items.find((ocrItem: any) =>
        ocrItem.description.toLowerCase().includes(aiItem.description.toLowerCase()) ||
        aiItem.description.toLowerCase().includes(ocrItem.description.toLowerCase())
      );

      return {
        description: aiItem.description,
        amount: aiItem.amount,
        // Preserve geometry from OCR if available, otherwise null
        geometry: matchingOcrItem?.geometry || null
      };
    });

    result.line_items = aiLineItems;

    // Update confidence score for line items
    if (enhancedData.confidence?.line_items) {
      result.confidence.line_items = enhancedData.confidence.line_items;
    } else {
      result.confidence.line_items = 85; // Default high confidence for AI results
    }
  }

  // Feature flag to control whether to use the new columns
  const ENABLE_GEOMETRY_COLUMNS = true; // Re-enabled now that columns exist in the database

  // Preserve document structure from OCR if enabled
  if (ENABLE_GEOMETRY_COLUMNS && 'document_structure' in result && !result.document_structure && textractData.document_structure) {
    result.document_structure = textractData.document_structure;
  }

  return result;
}

// Format the AI Vision result to match our expected structure
function formatAIVisionResult(visionData: any) {
  // Feature flag to control whether to use the new columns
  const ENABLE_GEOMETRY_COLUMNS = true; // Re-enabled now that columns exist in the database

  const result: any = {
    merchant: visionData.merchant || '',
    date: visionData.date || '',
    total: parseFloat(visionData.total) || 0,
    tax: parseFloat(visionData.tax) || 0,
    payment_method: visionData.payment_method || '',
    currency: visionData.currency || 'MYR',
    line_items: [] as { description: string; amount: number; geometry?: any }[],
    fullText: '', // Vision doesn't have full text
    predicted_category: visionData.predicted_category || '',
    ai_suggestions: {},
    confidence: {
      merchant: visionData.confidence?.merchant || 75,
      date: visionData.confidence?.date || 75,
      total: visionData.confidence?.total || 75,
      tax: visionData.confidence?.tax || 75,
      payment_method: visionData.confidence?.payment_method || 75,
      line_items: visionData.confidence?.line_items || 75,
    }
  };

  // Add geometry information only if enabled by feature flag
  if (ENABLE_GEOMETRY_COLUMNS) {
    // Add empty geometry information for AI Vision results
    // This will be populated if we have bounding box data from the vision model
    result.geometry = {
      merchant: visionData.geometry?.merchant || null,
      date: visionData.geometry?.date || null,
      total: visionData.geometry?.total || null,
      tax: visionData.geometry?.tax || null,
      payment_method: visionData.geometry?.payment_method || null,
    };

    // Add empty document structure for AI Vision results
    result.document_structure = {
      blocks: visionData.document_structure?.blocks || [],
      page_dimensions: visionData.document_structure?.page_dimensions || { width: 0, height: 0 }
    };
  }

  // Convert line items format if present
  if (visionData.line_items && Array.isArray(visionData.line_items)) {
    result.line_items = visionData.line_items.map((item: any) => {
      const lineItem: any = {
        description: item.description || '',
        amount: parseFloat(item.amount) || 0
      };

      // Include geometry if available from vision model and enabled by feature flag
      if (ENABLE_GEOMETRY_COLUMNS && item.geometry) {
        lineItem.geometry = item.geometry;
      }

      return lineItem;
    });
  }

  return result;
}

// Find discrepancies between primary and alternative results
function findDiscrepancies(primaryResult: any, alternativeResult: any) {
  const discrepancies: any[] = [];

  // Compare key fields
  const fieldsToCompare = [
    'merchant',
    'date',
    'total',
    'tax',
    'currency',
    'payment_method',
    'predicted_category'
  ];

  for (const field of fieldsToCompare) {
    // Skip if either value is missing
    if (!primaryResult[field] && !alternativeResult[field]) continue;

    // For numeric fields, compare with tolerance
    if (field === 'total' || field === 'tax') {
      const numPrimary = parseFloat(primaryResult[field]) || 0;
      const numAlternative = parseFloat(alternativeResult[field]) || 0;
      const diff = Math.abs(numPrimary - numAlternative);

      // If difference is more than 1% of the larger value and more than 0.1
      const tolerance = Math.max(Math.max(numPrimary, numAlternative) * 0.01, 0.1);
      if (diff > tolerance) {
        discrepancies.push({
          field,
          primaryValue: numPrimary,
          alternativeValue: numAlternative
        });
      }
    }
    // String comparison for other fields
    else if (primaryResult[field]?.toString() !== alternativeResult[field]?.toString()) {
      discrepancies.push({
        field,
        primaryValue: primaryResult[field],
        alternativeValue: alternativeResult[field]
      });
    }
  }

  // Compare line items count as a basic check
  if (primaryResult.line_items?.length !== alternativeResult.line_items?.length) {
    discrepancies.push({
      field: 'line_items_count',
      primaryValue: primaryResult.line_items?.length || 0,
      alternativeValue: alternativeResult.line_items?.length || 0
    });
  }

  return discrepancies;
}

// Helper function to optimize image for OCR processing
async function optimizeImageForOCR(imageBytes: Uint8Array, logger: ProcessingLogger): Promise<Uint8Array> {
  try {
    // Always log the original image size
    await logger.log(`Original image size: ${imageBytes.length} bytes`, "OPTIMIZE");

    // Check if image is already small enough and we're not forcing optimization
    if (imageBytes.length <= MAX_IMAGE_SIZE && !ALWAYS_OPTIMIZE) {
      await logger.log(`Image size is within limits, no optimization needed`, "OPTIMIZE");
      return imageBytes;
    }

    // Log whether we're optimizing due to size or because of the ALWAYS_OPTIMIZE flag
    if (imageBytes.length > MAX_IMAGE_SIZE) {
      await logger.log(`Image size (${imageBytes.length} bytes) exceeds limit, optimizing...`, "OPTIMIZE");
    } else {
      await logger.log(`Optimizing image despite being within size limits (forced optimization)`, "OPTIMIZE");
    }

    try {
      // Decode the image
      const image = await Image.decode(imageBytes);
      const originalWidth = image.width;
      const originalHeight = image.height;

      await logger.log(`Original dimensions: ${originalWidth}x${originalHeight}`, "OPTIMIZE");

      // Always resize if dimensions exceed MAX_IMAGE_DIMENSION
      let resized = false;
      if (originalWidth > MAX_IMAGE_DIMENSION || originalHeight > MAX_IMAGE_DIMENSION) {
        // Calculate new dimensions while maintaining aspect ratio
        let newWidth, newHeight;

        if (originalWidth > originalHeight) {
          newWidth = MAX_IMAGE_DIMENSION;
          newHeight = Math.round((originalHeight / originalWidth) * MAX_IMAGE_DIMENSION);
        } else {
          newHeight = MAX_IMAGE_DIMENSION;
          newWidth = Math.round((originalWidth / originalHeight) * MAX_IMAGE_DIMENSION);
        }

        // Resize the image
        image.resize(newWidth, newHeight);
        resized = true;
        await logger.log(`Resized to ${newWidth}x${newHeight}`, "OPTIMIZE");
      } else if (ALWAYS_OPTIMIZE) {
        // If we're forcing optimization but dimensions are already small,
        // still resize slightly to reduce file size
        const scaleFactor = 0.9; // Reduce to 90% of original size
        const newWidth = Math.round(originalWidth * scaleFactor);
        const newHeight = Math.round(originalHeight * scaleFactor);

        // Only resize if the dimensions are still reasonable
        if (newWidth > 500 && newHeight > 500) {
          image.resize(newWidth, newHeight);
          resized = true;
          await logger.log(`Slightly reduced dimensions to ${newWidth}x${newHeight} for optimization`, "OPTIMIZE");
        }
      }

      // Determine JPEG quality based on original image size
      let quality = 85; // Default quality

      if (imageBytes.length > 3 * 1024 * 1024) { // > 3MB
        quality = 70; // Lower quality for very large images
      } else if (imageBytes.length > 1 * 1024 * 1024) { // > 1MB
        quality = 75; // Medium-low quality for large images
      }

      // Encode as JPEG with appropriate quality
      const optimizedBytes = await image.encodeJPEG(quality);

      // Log the results
      const sizeReduction = Math.round((1 - (optimizedBytes.length / imageBytes.length)) * 100);
      await logger.log(`Optimized image size: ${optimizedBytes.length} bytes (${sizeReduction}% reduction)`, "OPTIMIZE");

      return optimizedBytes;
    } catch (decodeError) {
      // If we can't decode the image, try a different approach
      await logger.log(`Image decoding failed: ${decodeError.message}, trying fallback optimization`, "WARNING");

      // For now, return the original image if decoding fails
      // In a production environment, you might want to implement a fallback optimization method
      return imageBytes;
    }
  } catch (error) {
    await logger.log(`Image optimization failed: ${error.message}, using original image`, "ERROR");
    console.error("Image optimization error:", error);
    // Return original image if optimization fails
    return imageBytes;
  }
}

// Add this helper function below the processReceiptImage function
// Helper function to calculate more meaningful confidence scores
function calculateFieldConfidence(baseConfidence: number, value: string, fieldType: string): number {
  // Start with the base confidence from OCR
  let adjustedConfidence = baseConfidence || 50;

  // Don't allow very low confidence - minimum of 30%
  adjustedConfidence = Math.max(adjustedConfidence, 30);

  if (!value || value.trim() === '') {
    return 30; // Very low confidence for empty values
  }

  // Add field-specific confidence boost based on format and content
  switch (fieldType) {
    case 'merchant':
      // Longer merchant names are usually more reliable
      if (value.length > 5) {
        adjustedConfidence += 10;
      }
      // All caps is likely a header/company name
      if (value === value.toUpperCase() && value.length > 3) {
        adjustedConfidence += 5;
      }
      break;

    case 'date':
      // If it's a valid ISO date, high confidence
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        adjustedConfidence += 15;
      }

      // Check if date is reasonable (not in the far future)
      try {
        const dateObj = new Date(value);
        const now = new Date();
        // Date should be within last 2 years or next 1 year
        if (dateObj <= new Date(now.getFullYear() + 1, 11, 31) &&
            dateObj >= new Date(now.getFullYear() - 2, 0, 1)) {
          adjustedConfidence += 10;
        }
      } catch (e) {
        // Invalid date reduces confidence
        adjustedConfidence -= 10;
      }
      break;

    case 'total':
      // If it's a valid number with 2 decimal places, very likely correct
      if (/^\d+\.\d{2}$/.test(value)) {
        adjustedConfidence += 15;
      }

      // Reasonable total amount (not extreme values)
      const totalAmount = parseFloat(value);
      if (!isNaN(totalAmount) && totalAmount > 0 && totalAmount < 10000) {
        adjustedConfidence += 10;
      }
      break;

    case 'payment_method':
      // Common payment methods get higher confidence
      const commonMethods = ['cash', 'credit', 'credit card', 'debit', 'debit card', 'visa', 'mastercard'];
      if (commonMethods.some(method => value.toLowerCase().includes(method))) {
        adjustedConfidence += 20;
      }
      break;
  }

  // Ensure confidence is within 0-100 range
  return Math.min(Math.max(adjustedConfidence, 30), 100);
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("Received request to process receipt");

    // Capture headers from the incoming request
    const authorization = req.headers.get('Authorization') ||
                         `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
    const apikey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY');

    // Log header information (without sensitive values)
    console.log("Authorization header present:", !!authorization);
    console.log("API key header present:", !!apikey);

    // Check for required headers (optional but good practice)
    if (!authorization || !apikey) {
      console.warn("Authorization or apikey header missing from incoming request. Using fallback values.");
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData = await req.json();
    console.log("Request data received:", JSON.stringify(requestData).substring(0, 200) + "...");

    // Extract and validate required parameters
    const {
      imageUrl,
      receiptId,
      primaryMethod = 'ocr-ai', // Default to OCR + AI
      modelId = '', // Use default model based on method
      compareWithAlternative = false // Don't compare by default
    } = requestData;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: imageUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!receiptId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: receiptId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate primaryMethod
    if (primaryMethod !== 'ocr-ai' && primaryMethod !== 'ai-vision') {
      return new Response(
        JSON.stringify({ error: 'Invalid primaryMethod. Use "ocr-ai" or "ai-vision"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a logger for this process
    const logger = new ProcessingLogger(
      receiptId,
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    await logger.initialize();

    // Initialize Supabase client (ensure service role key is used for storage/db updates)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Use Service Role Key
    );

    await logger.log("Starting receipt processing", "START");

    await logger.log("Fetching receipt data", "FETCH");
    console.log("Fetching image from URL:", imageUrl);
    await logger.log("Fetching receipt image", "FETCH");

    // Fetch the image from the provided URL
    try {
      const imageResponse = await fetch(imageUrl);

      if (!imageResponse.ok) {
        console.error("Failed to fetch image:", imageResponse.status, imageResponse.statusText);
        await logger.log(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`, "ERROR");

        return new Response(
          JSON.stringify({
            error: `Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`,
            success: false
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Convert image to binary data
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      const imageBytes = new Uint8Array(imageArrayBuffer);
      await logger.log(`Image fetched successfully, size: ${imageBytes.length} bytes`, "FETCH");

      // Optimize image for OCR processing
      await logger.log("Starting image optimization for OCR", "OPTIMIZE");
      const optimizedImageBytes = await optimizeImageForOCR(imageBytes, logger);

      // --- START: THUMBNAIL GENERATION ---
      let thumbnailUrl: string | null = null;

      // Create a separate function for thumbnail generation to better isolate errors
      const generateAndUploadThumbnail = async (): Promise<string | null> => {
        try {
          await logger.log("Starting thumbnail generation", "THUMBNAIL");
          console.log("Decoding image for thumbnail...");

          // Use a smaller subset of the image data for thumbnail generation
          // This reduces memory usage during thumbnail creation
          const thumbnailImageBytes = optimizedImageBytes || imageBytes;

          const image = await Image.decode(thumbnailImageBytes);
          console.log(`Original dimensions: ${image.width}x${image.height}`);

          // Use a smaller target width for thumbnails
          const targetWidth = 300; // Reduced from 400
          image.resize(targetWidth, Image.RESIZE_AUTO); // Resize maintaining aspect ratio
          console.log(`Resized dimensions: ${image.width}x${image.height}`);

          // Encode as JPEG with lower quality to save memory
          const quality = 70; // Reduced from 75
          const thumbnailBytes = await image.encodeJPEG(quality);
          console.log(`Thumbnail encoded as JPEG, size: ${thumbnailBytes.length} bytes`);

          const thumbnailPath = `thumbnails/${receiptId}_thumb.jpg`; // Store in a 'thumbnails' folder

          await logger.log(`Uploading thumbnail to ${thumbnailPath}`, "THUMBNAIL_UPLOAD");
          console.log(`Uploading thumbnail to storage path: ${thumbnailPath}`);

          try {
            const { error: thumbUploadError } = await supabase.storage
              .from('receipt_images') // Assuming same bucket, different folder
              .upload(thumbnailPath, thumbnailBytes, {
                contentType: 'image/jpeg',
                cacheControl: '3600', // Cache for 1 hour
                upsert: true // Overwrite if exists
              });

            if (thumbUploadError) {
              console.error("Error uploading thumbnail:", thumbUploadError);
              await logger.log(`Error uploading thumbnail: ${thumbUploadError.message}`, "ERROR");
              return null;
            }

            // Get public URL for the thumbnail
            const { data: publicUrlData } = supabase.storage
              .from('receipt_images')
              .getPublicUrl(thumbnailPath);

            if (publicUrlData?.publicUrl) {
              console.log("Thumbnail uploaded successfully:", publicUrlData.publicUrl);
              await logger.log(`Thumbnail uploaded: ${publicUrlData.publicUrl}`, "THUMBNAIL_UPLOAD");
              return publicUrlData.publicUrl;
            } else {
              console.warn("Could not get public URL for thumbnail:", thumbnailPath);
              await logger.log("Could not get public URL for thumbnail", "WARNING");
              return null;
            }
          } catch (uploadError) {
            console.error("Error during thumbnail upload:", uploadError);
            await logger.log(`Thumbnail upload error: ${uploadError.message}`, "ERROR");
            return null;
          }
        } catch (thumbError) {
          console.error("Error generating thumbnail:", thumbError);
          await logger.log(`Thumbnail generation error: ${thumbError.message}`, "ERROR");
          return null;
        }
      };

      // Try to generate thumbnail but don't let it block the main processing
      try {
        thumbnailUrl = await generateAndUploadThumbnail();
      } catch (thumbError) {
        console.error("Unhandled error in thumbnail generation:", thumbError);
        await logger.log(`Unhandled thumbnail error: ${thumbError.message}`, "ERROR");
        // Continue processing even if thumbnail fails
        thumbnailUrl = null;
      }
      // --- END: THUMBNAIL GENERATION ---

      // Process the receipt image with OCR using the optimized image
      let extractedData;
      try {
        await logger.log("Starting OCR processing with optimized image", "PROCESS");
        extractedData = await processReceiptImage(
          optimizedImageBytes, // Use optimized image instead of original
          imageUrl,
          receiptId,
          primaryMethod,
          modelId,
          compareWithAlternative,
          { Authorization: authorization, apikey: apikey }
        );

        console.log("Data extraction complete");
        await logger.log("Data extraction completed successfully", "PROCESS");
      } catch (processingError) {
        console.error("Error during receipt processing:", processingError);
        await logger.log(`Processing error: ${processingError.message}`, "ERROR");

        // Create a basic result with minimal data to avoid complete failure
        extractedData = {
          merchant: "",
          date: new Date().toISOString().split('T')[0], // Today's date as fallback
          total: 0,
          tax: 0,
          currency: "MYR",
          payment_method: "",
          line_items: [],
          fullText: "Processing failed: " + processingError.message,
          predicted_category: "",
          processing_time: 0,
          confidence: {
            merchant: 0,
            date: 0,
            total: 0,
            tax: 0,
            payment_method: 0,
            line_items: 0
          },
          ai_suggestions: {
            error: processingError.message
          }
        };

        await logger.log("Created fallback data structure due to processing error", "RECOVERY");
      }

      await logger.log("Saving processing results to database", "SAVE");

      // Prepare data for saving to Supabase `receipts` table
      const updateData: Record<string, any> = {
        merchant: extractedData.merchant,
        date: extractedData.date,
        total: extractedData.total,
        tax: extractedData.tax,
        currency: extractedData.currency,
        payment_method: extractedData.payment_method,
        fullText: extractedData.fullText,
        ai_suggestions: extractedData.ai_suggestions,
        predicted_category: extractedData.predicted_category,
        processing_status: 'complete',
        processing_time: extractedData.processing_time,
        updated_at: new Date().toISOString(),
        // Add new fields for AI enhancement features
        model_used: extractedData.modelUsed,
        primary_method: extractedData.primaryMethod,
        has_alternative_data: !!extractedData.alternativeResult,
        discrepancies: extractedData.discrepancies || [],
        // ADDED: Save confidence scores directly to receipts table
        confidence_scores: extractedData.confidence,
        thumbnail_url: thumbnailUrl // Add the thumbnail URL here
      };

      // IMPORTANT: Temporarily disable the new columns until schema cache is updated
      // We'll store this data in a separate table or re-enable it later

      // Feature flag to control whether to use the new columns
      const ENABLE_GEOMETRY_COLUMNS = true; // Re-enabled now that columns exist in the database

      if (ENABLE_GEOMETRY_COLUMNS) {
        try {
          // Add geometry information if available and feature flag is enabled
          if (extractedData.geometry) {
            updateData.field_geometry = extractedData.geometry;
          }

          // Add document structure if available and feature flag is enabled
          if (extractedData.document_structure) {
            updateData.document_structure = extractedData.document_structure;
          }
        } catch (error) {
          // If there's an error, it might be because the columns don't exist yet
          // Just log it and continue without these fields
          console.log("Note: Skipping geometry and document structure fields - they may not exist in the database yet");
        }
      } else {
        console.log("Note: Geometry and document structure fields are disabled by feature flag to avoid schema cache errors");
      }

      // CRITICAL: Double-check and fix date format before saving to database
      // This ensures dates like "19-03-2025" are converted to "2025-03-19"
      if (updateData.date && typeof updateData.date === 'string') {
        const dateValue = updateData.date;
        console.log(`Date before validation: ${dateValue}`);

        // Check if the date is already in YYYY-MM-DD format
        const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoRegex.test(dateValue)) {
          // Try to extract components from the date string (DD-MM-YYYY format)
          const ddmmyyyyRegex = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
          const ddmmyyyyMatch = dateValue.match(ddmmyyyyRegex);

          if (ddmmyyyyMatch) {
            // Convert DD-MM-YYYY to YYYY-MM-DD
            const day = ddmmyyyyMatch[1].padStart(2, '0');
            const month = ddmmyyyyMatch[2].padStart(2, '0');
            const year = ddmmyyyyMatch[3];
            updateData.date = `${year}-${month}-${day}`;
            console.log(`Fixed date format from ${dateValue} to ${updateData.date}`);
            await logger.log(`Fixed date format from ${dateValue} to ${updateData.date}`, "DATE_FIX");
          } else {
            // As a last resort, try standard Date parsing
            try {
              const dateObj = new Date(dateValue);
              if (!isNaN(dateObj.getTime())) {
                updateData.date = dateObj.toISOString().split('T')[0];
                console.log(`Date object parsing: ${dateValue} -> ${updateData.date}`);
                await logger.log(`Date object parsing: ${dateValue} -> ${updateData.date}`, "DATE_FIX");
              } else {
                // If everything fails, use current date as fallback
                updateData.date = new Date().toISOString().split('T')[0];
                console.log(`Using current date as fallback: ${updateData.date}`);
                await logger.log(`Failed to parse date '${dateValue}', using current date`, "WARNING");
              }
            } catch (e) {
              // If date parsing fails entirely, use current date
              updateData.date = new Date().toISOString().split('T')[0];
              console.log(`Date parsing exception, using current date: ${updateData.date}`);
              await logger.log(`Exception parsing date '${dateValue}', using current date`, "WARNING");
            }
          }
        } else {
          console.log(`Date is already in correct format: ${dateValue}`);
        }
      } else if (!updateData.date) {
        // If date is missing, use current date
        updateData.date = new Date().toISOString().split('T')[0];
        console.log(`No date found, using current date: ${updateData.date}`);
        await logger.log("No date found, using current date", "WARNING");
      }

      // Remove null/undefined fields before updating (including thumbnail_url if it's null)
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === null || updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // --- Save to Supabase `receipts` table ---
      const { error: updateError } = await supabase
        .from('receipts')
        .update(updateData)
        .eq('id', receiptId);

      if (updateError) {
        console.error("Error updating receipt in database:", updateError);
        await logger.log(`Error saving results: ${updateError.message}`, "ERROR");
        throw new Error(`Failed to update receipt record: ${updateError.message}`);
      }

      // --- COMMENTED OUT: Saving confidence scores to separate table is no longer needed ---
      // const confidenceData = {
      //   receipt_id: receiptId,
      //   merchant: extractedData.confidence.merchant || 0,
      //   date: extractedData.confidence.date || 0,
      //   total: extractedData.confidence.total || 0,
      //   tax: extractedData.confidence.tax || 0,
      //   line_items: extractedData.confidence.line_items || 0,
      //   payment_method: extractedData.confidence.payment_method || 0
      // };
      //
      // // Check if confidence record already exists
      // const { data: existingConfidence, error: fetchError } = await supabase
      //   .from('confidence_scores')
      //   .select('id')
      //   .eq('receipt_id', receiptId)
      //   .single();
      //
      // if (fetchError && fetchError.code !== 'PGRST116') { // Not Found error code
      //   console.error("Error checking for existing confidence scores:", fetchError);
      //   await logger.log(`Error checking confidence scores: ${fetchError.message}`, "ERROR");
      //   // Continue processing - non-critical error
      // }
      //
      // let confidenceError;
      //
      // if (existingConfidence?.id) {
      //   // Update existing confidence scores
      //   const { error } = await supabase
      //     .from('confidence_scores')
      //     .update(confidenceData)
      //     .eq('id', existingConfidence.id);
      //
      //   confidenceError = error;
      // } else {
      //   // Insert new confidence scores
      //   const { error } = await supabase
      //     .from('confidence_scores')
      //     .insert(confidenceData);
      //
      //   confidenceError = error;
      // }
      //
      // if (confidenceError) {
      //   console.error("Error saving confidence scores:", confidenceError);
      //   await logger.log(`Error saving confidence scores: ${confidenceError.message}`, "WARNING");
      //   // Don't fail the process for confidence score errors
      // } else {
      //   await logger.log("Confidence scores saved successfully", "SAVE");
      // }
      // --- END COMMENTED OUT BLOCK ---

      // --- Handle line items (Optional: Assuming separate handling or basic logging for now) ---
      if (extractedData.line_items && extractedData.line_items.length > 0) {
        await logger.log(`Extracted ${extractedData.line_items.length} line items (saving not implemented in this function)`, "SAVE_LINE_ITEMS");
        // TODO: Implement line item saving if necessary within this function
        // This might involve deleting existing items and inserting new ones
      }

      await logger.log("Processing results saved successfully", "SAVE");

      // Generate embeddings for the receipt data with improved error handling and retry logic
      try {
        await logger.log("Triggering embedding generation", "EMBEDDING");
        console.log("Calling generate-embeddings function...");

        // Check if GEMINI_API_KEY is set in environment variables
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
          console.warn("GEMINI_API_KEY is not set in environment variables. Embeddings will not be generated.");
          await logger.log("GEMINI_API_KEY is not set. Embeddings cannot be generated.", "WARNING");
          return;
        }

        // Use service role key for authorization
        const authorization = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
        const apikey = Deno.env.get('SUPABASE_ANON_KEY');

        // Function to call the generate-embeddings endpoint
        const callEmbeddingsFunction = async (retryCount = 0) => {
          try {
            // Prepare headers for the request
            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            };

            // Add authorization headers if available
            if (typeof authorization === 'string' && authorization) {
              headers['Authorization'] = authorization;
            }

            if (typeof apikey === 'string' && apikey) {
              headers['apikey'] = apikey;
            }

            // Call the generate-embeddings function
            const embeddingsResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embeddings`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  receiptId,
                  processAllFields: true,
                  processLineItems: true, // Also process line items automatically
                  useImprovedDimensionHandling: true // Use improved dimension handling
                })
              }
            );

            if (!embeddingsResponse.ok) {
              const errorText = await embeddingsResponse.text();
              let errorData;
              try {
                errorData = JSON.parse(errorText);
              } catch (e) {
                errorData = { error: errorText };
              }

              console.error("Error generating embeddings:", errorData);
              await logger.log(`Embedding generation error: ${JSON.stringify(errorData)}`, "WARNING");

              // Check if this is a resource limit error that we should retry
              if (retryCount < 2 && (
                  errorText.includes("WORKER_LIMIT") ||
                  errorText.includes("compute resources") ||
                  errorText.includes("timeout")
                )) {
                await logger.log(`Retrying embedding generation (attempt ${retryCount + 1})`, "EMBEDDING");
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                return callEmbeddingsFunction(retryCount + 1);
              }

              return { success: false, error: errorData };
            } else {
              const embeddingResult = await embeddingsResponse.json();
              await logger.log(`Successfully generated ${embeddingResult.results?.length || 0} embeddings`, "EMBEDDING");

              // If line items were processed, log that too
              if (embeddingResult.lineItems && embeddingResult.lineItems.length > 0) {
                await logger.log(`Also generated embeddings for ${embeddingResult.lineItems.length} line items`, "EMBEDDING");
              }

              return embeddingResult;
            }
          } catch (error) {
            console.error("Error in embedding function call:", error);
            await logger.log(`Embedding function error: ${error.message}`, "WARNING");

            // Retry on network errors
            if (retryCount < 2) {
              await logger.log(`Retrying embedding generation after error (attempt ${retryCount + 1})`, "EMBEDDING");
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
              return callEmbeddingsFunction(retryCount + 1);
            }

            return { success: false, error: error.message };
          }
        };

        // Call the function with retry logic
        const embeddingResult = await callEmbeddingsFunction();

        // Update the receipt with embedding status
        if (embeddingResult.success) {
          try {
            await supabase
              .from('receipts')
              .update({
                has_embeddings: true,
                embedding_status: 'complete'
              })
              .eq('id', receiptId);

            await logger.log("Receipt marked as having embeddings", "EMBEDDING");
          } catch (updateError) {
            console.error("Error updating receipt embedding status:", updateError);
            await logger.log(`Error updating embedding status: ${updateError.message}`, "WARNING");
          }
        } else {
          // Mark the receipt as needing embeddings regeneration
          try {
            await supabase
              .from('receipts')
              .update({
                has_embeddings: false,
                embedding_status: 'failed'
              })
              .eq('id', receiptId);

            await logger.log("Receipt marked for embedding regeneration", "EMBEDDING");
          } catch (updateError) {
            console.error("Error updating receipt embedding status:", updateError);
            await logger.log(`Error updating embedding status: ${updateError.message}`, "WARNING");
          }
        }
      } catch (embeddingError) {
        console.error("Error calling generate-embeddings function:", embeddingError);
        await logger.log(`Embedding function error: ${embeddingError.message}`, "WARNING");
        // Continue processing even if embedding generation fails
      }

      // Return the extracted data (including processing time)
      await logger.log("Receipt processing completed successfully", "COMPLETE");
      return new Response(
        JSON.stringify({
          success: true,
          receiptId,
          result: extractedData, // Return the full result including processing time
          // Include additional information for the client
          model_used: extractedData.modelUsed,
          primary_method: extractedData.primaryMethod,
          has_alternative_data: !!extractedData.alternativeResult,
          discrepancies: extractedData.discrepancies || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      console.error("Error fetching image:", fetchError);
      await logger.log(`Error fetching image: ${fetchError.message}`, "ERROR");

      return new Response(
        JSON.stringify({
          error: `Failed to fetch image: ${fetchError.message}`,
          success: false
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in process-receipt function:', error);

    // Try to log the error if possible
    try {
      const { receiptId } = await req.json();
      if (receiptId) {
        const logger = new ProcessingLogger(receiptId);
        await logger.log(`Server error: ${error.message}`, "ERROR");
      }
    } catch (logError) {
      // Ignore errors during error logging
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
