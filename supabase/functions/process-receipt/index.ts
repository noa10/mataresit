/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// AI Vision processing for receipt data extraction
import { ProcessingLogger } from '../_shared/db-logger.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encodeBase64 } from "jsr:@std/encoding/base64"
// Import deno-image for resizing
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";
// Import notification helper for Edge Functions
import { EdgeNotificationHelper } from '../_shared/notification-helper.ts';

// Maximum image size for processing (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB - increased for AI Vision processing

// Maximum image dimensions for AI processing
const MAX_IMAGE_DIMENSION = 1500; // 1500px - optimized for AI Vision

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

// AI Vision processing configuration

// Main function to process receipt image and extract data using AI Vision only
async function processReceiptImage(
  imageBytes: Uint8Array,
  imageUrl: string,
  receiptId: string,
  modelId: string = '',
  requestHeaders: { Authorization?: string | null; apikey?: string | null } = { Authorization: null, apikey: null }
) {
  const logger = new ProcessingLogger(receiptId);
  const startTime = performance.now(); // Record start time
  let processingTime = 0;

  try {
    // Initialize results for AI Vision processing
    let result: any = null;
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

    // Process with AI Vision only
    // AI Vision method - send image directly to AI
    await logger.log("Using AI Vision for processing", "METHOD");
    console.log("Calling AI Vision for direct image processing...");

    // Log the target URL
    console.log(`Attempting to call enhance-receipt-data at: ${enhanceFunctionUrl}`);
    await logger.log(`Calling enhance-receipt-data at: ${enhanceFunctionUrl}`, "DEBUG");

    // Enhanced debugging for consistency investigation
    const requestStartTime = Date.now();
    console.log(`🔍 EDGE FUNCTION DEBUG - Starting AI Vision processing at ${new Date().toISOString()}`);
    console.log(`🔍 Receipt ID: ${receiptId}`);
    console.log(`🔍 Model ID: ${modelId}`);

      try {
        // Validate image bytes before encoding
        if (!imageBytes || imageBytes.length === 0) {
          await logger.log(`Invalid image bytes: length=${imageBytes?.length || 0}`, "ERROR");
          throw new Error("No image data available for processing");
        }

        // Ensure image is optimized for AI Vision to reduce resource usage
        console.log(`🔍 Encoding image bytes: ${imageBytes.length} bytes`);
        const encodedImage = encodeBase64(imageBytes);

        // Validate encoding result
        if (!encodedImage || typeof encodedImage !== 'string') {
          await logger.log(`Base64 encoding failed: result type=${typeof encodedImage}`, "ERROR");
          throw new Error("Failed to encode image as base64");
        }

        console.log(`🔍 Encoded image size: ${encodedImage.length} characters`);
        const imageSize = encodedImage.length;

        // Log image size for debugging
        await logger.log(`Encoded image size for AI Vision: ${imageSize} bytes`, "DEBUG");

        // Check if image is too large for AI Vision
        if (imageSize > 1.5 * 1024 * 1024) { // 1.5MB limit for base64 encoded image
          await logger.log(`Image too large for AI Vision (${imageSize} bytes)`, "ERROR");
          throw new Error(`Image too large for processing. Please use a smaller image (max 1.5MB when encoded).`);
        }

        // Validate encoded image before creating payload
        if (!encodedImage || typeof encodedImage !== 'string' || encodedImage.length === 0) {
          await logger.log(`Invalid encoded image: type=${typeof encodedImage}, length=${encodedImage?.length || 0}`, "ERROR");
          throw new Error(`Failed to encode image properly for AI processing`);
        }

        // Proceed with AI Vision if image is not too large
        const enhanceRequestPayload = {
          imageData: {
            data: encodedImage,
            mimeType: 'image/jpeg',
            isBase64: true
          },
          receiptId: receiptId,
          modelId: modelId
        };

        // Enhanced payload validation before sending
        console.log(`🔍 PROCESS-RECEIPT PAYLOAD VALIDATION:`);
        console.log(`🔍 receiptId: ${receiptId} (type: ${typeof receiptId})`);
        console.log(`🔍 modelId: ${modelId} (type: ${typeof modelId})`);
        console.log(`🔍 imageData.data: ${encodedImage ? 'present' : 'missing'} (type: ${typeof encodedImage}, length: ${encodedImage?.length || 0})`);
        console.log(`🔍 imageData.mimeType: ${enhanceRequestPayload.imageData.mimeType}`);
        console.log(`🔍 imageData.isBase64: ${enhanceRequestPayload.imageData.isBase64}`);

        // Validate payload structure
        if (!enhanceRequestPayload.imageData || !enhanceRequestPayload.imageData.data) {
          await logger.log("Payload validation failed: imageData.data is missing", "ERROR");
          throw new Error("Failed to construct valid payload for AI processing");
        }

        console.log(`🔍 Calling enhance-receipt-data with payload:`, {
          receiptId,
          modelId,
          imageDataSize: encodedImage.length,
          mimeType: 'image/jpeg',
          isBase64: true
        });

        const visionResponse = await fetch(
          enhanceFunctionUrl,
          {
            method: 'POST',
            headers: internalFetchHeaders,
            body: JSON.stringify(enhanceRequestPayload),
          }
        );

        if (visionResponse.ok) {
          const visionData = await visionResponse.json();
          const requestEndTime = Date.now();
          const requestDuration = (requestEndTime - requestStartTime) / 1000;

          console.log("Received data from AI Vision:", visionData);
          console.log(`🔍 AI Vision request completed in ${requestDuration.toFixed(2)} seconds`);
          console.log(`🔍 AI Vision response:`, {
            success: visionData.success,
            model_used: visionData.model_used,
            result_merchant: visionData.result?.merchant,
            result_total: visionData.result?.total,
            result_line_items_count: visionData.result?.line_items?.length || 0,
            result_line_items: visionData.result?.line_items
          });

          await logger.log("AI Vision processing complete", "AI");

          result = formatAIVisionResult(visionData.result);
          modelUsed = visionData.model_used;
        } else {
          // Check for resource limit errors
          const errorText = await visionResponse.text();
          console.error(`Error calling AI Vision: Status ${visionResponse.status} ${visionResponse.statusText}, Response: ${errorText}`);
          await logger.log(`AI Vision fetch failed: Status ${visionResponse.status}, Error: ${errorText}`, "ERROR");

          // Check if this is a resource limit error
          if (errorText.includes("WORKER_LIMIT") || errorText.includes("compute resources")) {
            await logger.log("Detected resource limit error", "ERROR");
            throw new Error(`Processing failed due to resource limits. Please try again later or use a smaller image.`);
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
          await logger.log("Detected resource limit error in exception", "ERROR");
          throw new Error(`Processing failed due to resource limits. Please try again later or use a smaller image.`);
        } else {
          // For other errors, rethrow
          throw visionError;
        }
      }

    const endTime = performance.now(); // Record end time
    processingTime = (endTime - startTime) / 1000; // Calculate duration in seconds

    await logger.log(`Processing complete in ${processingTime.toFixed(2)} seconds`, "COMPLETE");

    // Include processing time in the result
    return {
      ...result,
      processing_time: processingTime,
      modelUsed: modelUsed
    };
  } catch (error) {
    console.error('Error processing receipt:', error);
    await logger.log(`Error processing receipt: ${error.message}`, "ERROR");
    throw new Error(`Failed to process receipt image: ${error.message}`);
  }
}

// DEPRECATED: Legacy function for structured data extraction - no longer used with AI-only processing
// TODO: Remove this function in future cleanup as it's not called anywhere
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

// DEPRECATED: Legacy function for merging OCR and AI data - no longer used with AI-only processing
// TODO: Remove this function in future cleanup
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

  // Merge line items if provided by AI and better than existing data
  if (enhancedData.line_items && Array.isArray(enhancedData.line_items) &&
      (result.line_items.length === 0 || enhancedData.line_items.length > result.line_items.length)) {

    // If AI provides more line items, use those but try to preserve geometry from existing data where possible
    const aiLineItems = enhancedData.line_items.map((aiItem: any) => {
      // Try to find a matching existing line item to preserve geometry
      const matchingOcrItem = result.line_items.find((ocrItem: any) =>
        ocrItem.description.toLowerCase().includes(aiItem.description.toLowerCase()) ||
        aiItem.description.toLowerCase().includes(ocrItem.description.toLowerCase())
      );

      return {
        description: aiItem.description,
        amount: aiItem.amount,
        // Preserve geometry from existing data if available, otherwise null
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

  // Preserve document structure from existing data if enabled
  if (ENABLE_GEOMETRY_COLUMNS && 'document_structure' in result && !result.document_structure && textractData.document_structure) {
    result.document_structure = textractData.document_structure;
  }

  return result;
}

// Import content synthesis utilities
import { generateSyntheticFullText } from '../_shared/content-synthesis.ts';

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
    fullText: generateSyntheticFullText(visionData), // Generate rich fullText from structured data
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

// DEPRECATED: Legacy function for finding discrepancies between processing methods - no longer used with AI-only processing
// TODO: Remove this function in future cleanup
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

// Helper function to optimize image for AI processing
async function optimizeImageForProcessing(imageBytes: Uint8Array, logger: ProcessingLogger): Promise<Uint8Array> {
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
  // Start with the base confidence from processing
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

// ============================================================================
// HELPER FUNCTIONS FOR MODULAR PIPELINE
// ============================================================================

/**
 * Validates and extracts request parameters
 */
async function validateAndExtractParams(req: Request) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    throw new Error('Method not allowed');
  }

  // Parse request body
  const requestData = await req.json();
  console.log("Request data received:", JSON.stringify(requestData).substring(0, 200) + "...");

  // Extract and validate required parameters
  const {
    imageUrl,
    receiptId,
    modelId = '' // Use default model
  } = requestData;

  if (!imageUrl) {
    throw new Error('Missing required parameter: imageUrl');
  }

  if (!receiptId) {
    throw new Error('Missing required parameter: receiptId');
  }

  return { imageUrl, receiptId, modelId };
}

/**
 * Fetches and optimizes image for processing
 */
async function fetchAndOptimizeImage(imageUrl: string, logger: ProcessingLogger): Promise<Uint8Array> {
  await logger.log("Fetching receipt image", "FETCH");
  console.log("Fetching image from URL:", imageUrl);

  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    const errorMsg = `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`;
    console.error(errorMsg);
    await logger.log(errorMsg, "ERROR");
    throw new Error(`Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  // Convert image to binary data
  const imageArrayBuffer = await imageResponse.arrayBuffer();
  const imageBytes = new Uint8Array(imageArrayBuffer);
  await logger.log(`Image fetched successfully, size: ${imageBytes.length} bytes`, "FETCH");

  // Optimize image for AI processing
  await logger.log("Starting image optimization for AI processing", "OPTIMIZE");
  const optimizedImageBytes = await optimizeImageForProcessing(imageBytes, logger);

  return optimizedImageBytes;
}

/**
 * Generates and uploads thumbnail for the receipt
 */
async function generateThumbnail(
  imageBytes: Uint8Array,
  receiptId: string,
  supabase: any,
  logger: ProcessingLogger
): Promise<string | null> {
  try {
    await logger.log("Starting thumbnail generation", "THUMBNAIL");
    console.log("Decoding image for thumbnail...");

    const image = await Image.decode(imageBytes);
    console.log(`Original dimensions: ${image.width}x${image.height}`);

    // Use a smaller target width for thumbnails
    const targetWidth = 300;
    image.resize(targetWidth, Image.RESIZE_AUTO);
    console.log(`Resized dimensions: ${image.width}x${image.height}`);

    // Encode as JPEG with lower quality to save memory
    const quality = 70;
    const thumbnailBytes = await image.encodeJPEG(quality);
    console.log(`Thumbnail encoded as JPEG, size: ${thumbnailBytes.length} bytes`);

    const thumbnailPath = `thumbnails/${receiptId}_thumb.jpg`;

    await logger.log(`Uploading thumbnail to ${thumbnailPath}`, "THUMBNAIL");
    console.log(`Uploading thumbnail to storage path: ${thumbnailPath}`);

    const { error: thumbUploadError } = await supabase.storage
      .from('receipt_images')
      .upload(thumbnailPath, thumbnailBytes, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
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
      await logger.log(`Thumbnail uploaded: ${publicUrlData.publicUrl}`, "THUMBNAIL");
      return publicUrlData.publicUrl;
    } else {
      console.warn("Could not get public URL for thumbnail:", thumbnailPath);
      await logger.log("Could not get public URL for thumbnail", "WARNING");
      return null;
    }
  } catch (thumbError) {
    console.error("Error generating thumbnail:", thumbError);
    await logger.log(`Thumbnail generation error: ${thumbError.message}`, "ERROR");
    return null;
  }
}

/**
 * Normalizes and validates date format
 */
function normalizeDate(dateValue: string, logger: ProcessingLogger): string {
  console.log(`Date before validation: ${dateValue}`);

  // Check if the date is already in YYYY-MM-DD format
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRegex.test(dateValue)) {
    console.log(`Date is already in correct format: ${dateValue}`);
    return dateValue;
  }

  // Try to extract components from the date string (DD-MM-YYYY format)
  const ddmmyyyyRegex = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
  const ddmmyyyyMatch = dateValue.match(ddmmyyyyRegex);

  if (ddmmyyyyMatch) {
    // Convert DD-MM-YYYY to YYYY-MM-DD
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    const normalizedDate = `${year}-${month}-${day}`;
    console.log(`Fixed date format from ${dateValue} to ${normalizedDate}`);
    return normalizedDate;
  }

  // As a last resort, try standard Date parsing
  try {
    const dateObj = new Date(dateValue);
    if (!isNaN(dateObj.getTime())) {
      const normalizedDate = dateObj.toISOString().split('T')[0];
      console.log(`Date object parsing: ${dateValue} -> ${normalizedDate}`);
      return normalizedDate;
    }
  } catch (e) {
    // Fall through to default
  }

  // If everything fails, use current date as fallback
  const fallbackDate = new Date().toISOString().split('T')[0];
  console.log(`Using current date as fallback: ${fallbackDate}`);
  return fallbackDate;
}

/**
 * Saves processing results to the database
 */
async function saveResultsToDatabase(
  receiptId: string,
  extractedData: any,
  thumbnailUrl: string | null,
  supabase: any,
  logger: ProcessingLogger
): Promise<void> {
  await logger.log("Saving processing results to database", "SAVE");

  // Prepare data for saving to Supabase `receipts` table
  const updateData: Record<string, any> = {
    merchant: extractedData.merchant,
    date: extractedData.date ? normalizeDate(extractedData.date, logger) : new Date().toISOString().split('T')[0],
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
    // Add new fields for AI processing
    model_used: extractedData.modelUsed,
    // Save confidence scores directly to receipts table
    confidence_scores: extractedData.confidence,
    thumbnail_url: thumbnailUrl
  };

  // Add enhanced structured data fields if available
  if (extractedData.structured_data) {
    const structuredData = extractedData.structured_data;

    // Map structured data to database columns
    if (structuredData.merchant_normalized) updateData.merchant_normalized = structuredData.merchant_normalized;
    if (structuredData.merchant_category) updateData.merchant_category = structuredData.merchant_category;
    if (structuredData.business_type) updateData.business_type = structuredData.business_type;
    if (structuredData.location_city) updateData.location_city = structuredData.location_city;
    if (structuredData.location_state) updateData.location_state = structuredData.location_state;
    if (structuredData.receipt_type) updateData.receipt_type = structuredData.receipt_type;
    if (structuredData.transaction_time) updateData.transaction_time = structuredData.transaction_time;
    if (structuredData.item_count) updateData.item_count = parseInt(structuredData.item_count) || 0;
    if (structuredData.discount_amount) updateData.discount_amount = parseFloat(structuredData.discount_amount) || 0;
    if (structuredData.service_charge) updateData.service_charge = parseFloat(structuredData.service_charge) || 0;
    if (structuredData.tip_amount) updateData.tip_amount = parseFloat(structuredData.tip_amount) || 0;
    if (structuredData.subtotal) updateData.subtotal = parseFloat(structuredData.subtotal) || 0;
    if (structuredData.total_before_tax) updateData.total_before_tax = parseFloat(structuredData.total_before_tax) || 0;
    if (structuredData.cashier_name) updateData.cashier_name = structuredData.cashier_name;
    if (structuredData.receipt_number) updateData.receipt_number = structuredData.receipt_number;
    if (structuredData.transaction_id) updateData.transaction_id = structuredData.transaction_id;
    if (structuredData.loyalty_program) updateData.loyalty_program = structuredData.loyalty_program;
    if (structuredData.loyalty_points) updateData.loyalty_points = parseInt(structuredData.loyalty_points) || 0;
    if (structuredData.payment_card_last4) updateData.payment_card_last4 = structuredData.payment_card_last4;
    if (structuredData.payment_approval_code) updateData.payment_approval_code = structuredData.payment_approval_code;
    if (structuredData.is_business_expense) updateData.is_business_expense = structuredData.is_business_expense === 'true' || structuredData.is_business_expense === true;
    if (structuredData.expense_type) updateData.expense_type = structuredData.expense_type;
    if (structuredData.vendor_registration_number) updateData.vendor_registration_number = structuredData.vendor_registration_number;
    if (structuredData.invoice_number) updateData.invoice_number = structuredData.invoice_number;
    if (structuredData.purchase_order_number) updateData.purchase_order_number = structuredData.purchase_order_number;

    await logger.log(`Enhanced structured data extracted: ${Object.keys(structuredData).length} fields`, "STRUCTURED");
  }

  // Add enhanced analysis fields
  if (extractedData.line_items_analysis) {
    updateData.line_items_analysis = extractedData.line_items_analysis;
    await logger.log("Line items analysis data saved", "ANALYSIS");
  }

  if (extractedData.spending_patterns) {
    updateData.spending_patterns = extractedData.spending_patterns;
    await logger.log("Spending patterns analysis saved", "ANALYSIS");
  }

  // Add anomaly detection flags if present
  if (extractedData.anomaly_flags) {
    updateData.anomaly_flags = extractedData.anomaly_flags;
    await logger.log("Anomaly flags detected and saved", "ANOMALY");
  }

  // Add extraction metadata for debugging and quality tracking
  updateData.extraction_metadata = {
    model_used: extractedData.modelUsed,
    extraction_timestamp: new Date().toISOString(),
    confidence_scores: extractedData.confidence,
    structured_fields_count: extractedData.structured_data ? Object.keys(extractedData.structured_data).length : 0,
    has_line_items_analysis: !!extractedData.line_items_analysis,
    has_spending_patterns: !!extractedData.spending_patterns,
    processing_version: '2.2' // Track which version of extraction was used
  };

  // Feature flag to control whether to use the new columns
  const ENABLE_GEOMETRY_COLUMNS = true;

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
      console.log("Note: Skipping geometry and document structure fields - they may not exist in the database yet");
    }
  }

  // Remove null/undefined fields before updating
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === null || updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Save to Supabase `receipts` table
  const { error: updateError } = await supabase
    .from('receipts')
    .update(updateData)
    .eq('id', receiptId);

  if (updateError) {
    console.error("Error updating receipt in database:", updateError);
    await logger.log(`Error saving results: ${updateError.message}`, "ERROR");
    throw new Error(`Failed to update receipt record: ${updateError.message}`);
  }

  // Handle line items storage
  console.log(`DEBUG: Checking line items - extractedData.line_items exists: ${!!extractedData.line_items}, length: ${extractedData.line_items?.length || 0}`);
  await logger.log(`DEBUG: Line items check - exists: ${!!extractedData.line_items}, length: ${extractedData.line_items?.length || 0}`, "DEBUG");

  if (extractedData.line_items && extractedData.line_items.length > 0) {
    try {
      await logger.log(`Storing ${extractedData.line_items.length} line items in database`, "SAVE");

      // Delete existing line items first to avoid duplicates
      const { error: deleteError } = await supabase
        .from("line_items")
        .delete()
        .eq("receipt_id", receiptId);

      if (deleteError) {
        console.error("Error deleting old line items:", deleteError);
        await logger.log(`Warning: Could not delete old line items: ${deleteError.message}`, "WARNING");
        // Continue with insertion anyway
      }

      // Format line items for database insertion
      console.log(`DEBUG: Raw line items:`, extractedData.line_items);
      const formattedLineItems = extractedData.line_items.map(item => ({
        description: item.description || '',
        amount: parseFloat(item.amount) || 0,
        receipt_id: receiptId
      }));
      console.log(`DEBUG: Formatted line items:`, formattedLineItems);

      // Filter out invalid line items (empty description or zero amount)
      const validLineItems = formattedLineItems.filter(item =>
        item.description.trim() !== '' && item.amount > 0
      );
      console.log(`DEBUG: Valid line items after filtering:`, validLineItems);

      if (validLineItems.length > 0) {
        // Insert new line items
        const { error: insertError } = await supabase
          .from("line_items")
          .insert(validLineItems);

        if (insertError) {
          console.error("Error inserting line items:", insertError);
          await logger.log(`Line item insertion error: ${insertError.message}`, "ERROR");
          await logger.log(`Full insert error details: ${JSON.stringify(insertError)}`, "ERROR");
          // Don't throw - this shouldn't fail the entire receipt processing
        } else {
          await logger.log(`Successfully saved ${validLineItems.length} line items to database`, "SAVE");
          console.log(`Stored ${validLineItems.length} line items for receipt ${receiptId}`);

          // Double-check that items were actually inserted
          try {
            const { data: checkItems, error: checkError } = await supabase
              .from("line_items")
              .select("count")
              .eq("receipt_id", receiptId);

            if (!checkError) {
              await logger.log(`Verification: Found ${checkItems?.length || 0} line items in database after insert`, "DEBUG");
            }
          } catch (verifyError) {
            await logger.log(`Verification error: ${verifyError.message}`, "DEBUG");
          }
        }
      } else {
        await logger.log("No valid line items to store (all items had empty descriptions or zero amounts)", "SAVE");
      }
    } catch (lineItemError) {
      console.error("Unexpected error handling line items:", lineItemError);
      await logger.log(`Unexpected line item error: ${lineItemError.message}`, "ERROR");
      // Don't throw - this shouldn't fail the entire receipt processing
    }
  } else {
    await logger.log("No line items extracted to store", "SAVE");
  }

  await logger.log("Processing results saved successfully", "SAVE");
}

/**
 * Triggers post-processing tasks (embeddings) asynchronously
 * Phase 2: Enhanced with queue-based processing and fallback to direct processing
 */
async function triggerPostProcessing(receiptId: string, supabase: any, logger: ProcessingLogger): Promise<void> {
  try {
    await logger.log("Triggering embedding generation", "EMBEDDING");
    console.log("Determining embedding processing method...");

    // Check if GEMINI_API_KEY is set in environment variables
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn("GEMINI_API_KEY is not set in environment variables. Embeddings will not be generated.");
      await logger.log("GEMINI_API_KEY is not set. Embeddings cannot be generated.", "WARNING");
      return;
    }

    // Check if queue-based processing is enabled
    const { data: queueConfig } = await supabase
      .from('embedding_queue_config')
      .select('config_value')
      .eq('config_key', 'queue_enabled')
      .single();

    const useQueue = queueConfig?.config_value === true || queueConfig?.config_value === 'true';

    if (useQueue) {
      // Use queue-based processing
      await queueBasedEmbeddingProcessing(receiptId, supabase, logger);
    } else {
      // Use direct processing (existing behavior)
      await directEmbeddingProcessing(receiptId, supabase, logger);
    }
  } catch (embeddingError) {
    console.error("Error in triggerPostProcessing:", embeddingError);
    await logger.log(`Embedding processing error: ${embeddingError.message}`, "WARNING");
    // Continue processing even if embedding generation fails
  }
}

/**
 * Queue-based embedding processing (Phase 2)
 */
async function queueBasedEmbeddingProcessing(receiptId: string, supabase: any, logger: ProcessingLogger): Promise<void> {
  try {
    await logger.log("Adding embedding generation to queue", "EMBEDDING");

    const { error } = await supabase
      .from('embedding_queue')
      .insert({
        source_type: 'receipts',
        source_id: receiptId,
        operation: 'INSERT',
        priority: 'high', // Receipt processing gets high priority
        metadata: {
          triggered_by: 'process_receipt',
          upload_context: 'direct_processing',
          timestamp: new Date().toISOString()
        }
      });

    if (error) {
      await logger.log(`Queue insertion error: ${error.message}`, "WARNING");
      // Fallback to direct processing
      await logger.log("Falling back to direct embedding processing", "EMBEDDING");
      await directEmbeddingProcessing(receiptId, supabase, logger);
    } else {
      await logger.log("Successfully queued for embedding generation", "EMBEDDING");

      // Update receipt status to indicate queued for embeddings
      try {
        await supabase
          .from('receipts')
          .update({
            embedding_status: 'queued'
          })
          .eq('id', receiptId);
      } catch (updateError) {
        console.error("Error updating receipt embedding status to queued:", updateError);
        await logger.log(`Error updating embedding status: ${updateError.message}`, "WARNING");
      }
    }
  } catch (queueError) {
    console.error("Error in queue-based processing:", queueError);
    await logger.log(`Queue processing error: ${queueError.message}`, "WARNING");
    // Fallback to direct processing
    await directEmbeddingProcessing(receiptId, supabase, logger);
  }
}

/**
 * Direct embedding processing (existing behavior, extracted for reuse)
 */
async function directEmbeddingProcessing(receiptId: string, supabase: any, logger: ProcessingLogger): Promise<void> {
  try {
    await logger.log("Using direct embedding processing", "EMBEDDING");

    // Use service role key for authorization
    const authorization = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
    const apikey = Deno.env.get('SUPABASE_ANON_KEY');

    // Function to call the generate-embeddings endpoint with retry logic
    const callEmbeddingsFunction = async (retryCount = 0): Promise<any> => {
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
              processLineItems: true,
              useImprovedDimensionHandling: true
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

    // 1. Validate and extract parameters
    const { imageUrl, receiptId, modelId } =
      await validateAndExtractParams(req);

    // 2. Initialize logger and Supabase client
    const logger = new ProcessingLogger(receiptId);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await logger.log("Starting receipt processing", "START");

    // 2.1. Skip processing started notification (filtered out for noise reduction)
    await logger.log("Skipping processing started notification - filtered out for noise reduction", "NOTIFICATION");

    // 3. Fetch and optimize image
    const optimizedImageBytes = await fetchAndOptimizeImage(imageUrl, logger);

    // 4. Generate thumbnail (fire-and-forget, don't block main processing)
    let thumbnailUrl: string | null = null;
    try {
      thumbnailUrl = await generateThumbnail(optimizedImageBytes, receiptId, supabase, logger);
    } catch (thumbError) {
      console.error("Unhandled error in thumbnail generation:", thumbError);
      await logger.log(`Unhandled thumbnail error: ${thumbError.message}`, "ERROR");
      // Continue processing even if thumbnail fails
      thumbnailUrl = null;
    }

    // 5. Process the receipt data
    let extractedData;
    try {
      await logger.log("Starting data processing with optimized image", "AI");
      extractedData = await processReceiptImage(
        optimizedImageBytes,
        imageUrl,
        receiptId,
        modelId,
        { Authorization: authorization, apikey: apikey }
      );

      console.log("Data extraction complete");
      await logger.log("Data extraction completed successfully", "AI");
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

      // Mark this receipt as needing review due to processing issues
      // We'll send a "ready for review" notification instead of "completed" later
    }

    // 6. Save results to database
    await saveResultsToDatabase(receiptId, extractedData, thumbnailUrl, supabase, logger);

    // 7. Trigger post-processing (embeddings) asynchronously
    await triggerPostProcessing(receiptId, supabase, logger);

    // 7.1. Notifications are now handled by database trigger only
    // This prevents duplicate notifications and ensures consistent titles
    await logger.log("Notifications will be handled by database trigger when status changes", "NOTIFICATION");

    // 8. Return success response
    await logger.log("Receipt processing completed successfully", "COMPLETE");
    return new Response(
      JSON.stringify({
        success: true,
        receiptId,
        result: extractedData,
        // Include additional information for the client
        model_used: extractedData.modelUsed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-receipt function:', error);

    // Try to log the error and send failure notification
    let receiptId: string | null = null;
    try {
      if (error.message && error.message.includes('Missing required parameter')) {
        // For validation errors, return 400
        return new Response(
          JSON.stringify({ error: error.message, success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For other errors, try to log and return 500
      const params = await req.json().catch(() => ({}));
      receiptId = params.receiptId;

      if (receiptId) {
        const logger = new ProcessingLogger(receiptId);
        await logger.log(`Server error: ${error.message}`, "ERROR");

        // Processing failed notifications are now handled by database trigger only
        await logger.log("Processing failed notification will be handled by database trigger", "NOTIFICATION");
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
