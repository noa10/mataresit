/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { ProcessingLogger } from './db-logger.ts';

/**
 * Shared response-parsing utilities for receipt-data enhancement.
 *
 * Covers:
 *   - Gemini-specific parsing (bounding-box detection, preview-model fallback)
 *   - OpenAI-compatible parsing (OpenRouter + Groq)
 *   - JSON-extraction heuristics (code fences, regex, flexible regex, direct parse)
 *   - Normalisation, MYR default, and empty-data fallback signalling
 */

// ============================================================================
// Types
// ============================================================================

export interface GeminiParseResult {
  data: any | null;
  needsModelFallback: boolean;
  fallbackModelId?: string;
  fallbackReason?: string;
  parseMethod: string;
}

export interface OpenAIParseResult {
  data: any;
  parseMethod: string;
}

/** Confidence skeleton used when a provider omits the field. */
export const DEFAULT_CONFIDENCE = {
  merchant: 0,
  date: 0,
  total: 0,
  tax: 0,
  currency: 50,
  payment_method: 0,
  predicted_category: 0,
  line_items: 0,
};

// ============================================================================
// Gemini-specific parsing
// ============================================================================

/**
 * Parse a Gemini response text.
 *
 * Returns `needsModelFallback: true` when the preview model emits a
 * bounding-box response or extracts no meaningful data.  The **caller**
 * (e.g. `callGeminiAPI`) is responsible for re-invoking the provider
 * with the suggested fallback model.
 */
export async function parseGeminiResponse(
  responseText: string,
  modelId: string,
  logger: ProcessingLogger
): Promise<GeminiParseResult> {
  await logger.log('Parsing Gemini response', 'AI');
  await logger.log(`📝 Response length: ${responseText.length} characters`, 'AI');

  // ── Strategy 1: bounding-box preview-model guard ──
  const previewModelId = 'gemini-2.5-flash-lite-preview-06-17';
  await logger.log(`🔍 DEBUG: Model ID: ${modelId}`, 'AI');
  await logger.log(
    `🔍 DEBUG: Response text preview (first 500 chars): ${responseText.substring(0, 500)}`,
    'AI'
  );

  try {
    const firstPass = JSON.parse(responseText.trim());
    await logger.log(
      `🔍 DEBUG: Parsed response type: ${Array.isArray(firstPass) ? 'Array' : typeof firstPass}`,
      'AI'
    );

    if (Array.isArray(firstPass)) {
      await logger.log(`🔍 DEBUG: Array length: ${firstPass.length}`, 'AI');
      if (firstPass.length > 0) {
        await logger.log(`🔍 DEBUG: First element keys: ${Object.keys(firstPass[0])}`, 'AI');
      }
    } else {
      await logger.log(`🔍 DEBUG: Object keys: ${Object.keys(firstPass)}`, 'AI');
    }

    // Bounding-box format for the preview model → signal caller to fall back
    if (
      modelId === previewModelId &&
      Array.isArray(firstPass) &&
      firstPass.length > 0 &&
      firstPass[0].box_2d &&
      firstPass[0].label
    ) {
      await logger.log(
        '🎯 CRITICAL: Detected bounding box format from Gemini 2.5 Flash Lite Preview',
        'ERROR'
      );
      await logger.log(
        '🔄 FALLBACK REQUIRED: This format lacks text content needed for data extraction',
        'ERROR'
      );
      return {
        data: null,
        needsModelFallback: true,
        fallbackModelId: 'gemini-2.5-flash',
        fallbackReason: 'bounding-box-format-incompatible',
        parseMethod: 'bounding-box-triggered-fallback',
      };
    }

    // Normal gemini-2.5-flash-lite → treat as direct JSON
    if (modelId === 'gemini-2.5-flash-lite') {
      await logger.log(
        '✅ DEBUG: gemini-2.5-flash-lite detected - treating as normal JSON response',
        'AI'
      );
      const validated = await validateAndNormalize(firstPass, logger);
      if (shouldTriggerEmptyFallback(validated, modelId)) {
        return {
          data: null,
          needsModelFallback: true,
          fallbackModelId: 'gemini-2.5-flash',
          fallbackReason: 'empty-data-from-preview-model',
          parseMethod: 'direct-parse-2.5-lite-empty',
        };
      }
      await logExtractionSummary(validated, logger);
      return {
        data: validated,
        needsModelFallback: false,
        parseMethod: 'direct-parse-2.5-lite',
      };
    }
  } catch (_e) {
    await logger.log(`🔍 DEBUG: JSON parse failed: ${_e}`, 'AI');
    // Not bounding-box format, continue to normal strategies
  }

  // ── Strategies 2-5: generic JSON extraction ──
  const extractResult = extractJSONFromText(responseText, logger);
  if (!extractResult.data) {
    await logger.log(
      '❌ CRITICAL: No valid JSON found after all parsing strategies',
      'ERROR'
    );
    await logger.log(
      `📄 Raw response preview: ${responseText.substring(0, 500)}...`,
      'ERROR'
    );
    return {
      data: buildDefaultEmptyResponse('Failed to extract JSON from model response'),
      needsModelFallback: false,
      parseMethod: 'all-strategies-failed',
    };
  }

  const validated = await validateAndNormalize(extractResult.data, logger);

  if (shouldTriggerEmptyFallback(validated, modelId)) {
    return {
      data: null,
      needsModelFallback: true,
      fallbackModelId: 'gemini-2.5-flash',
      fallbackReason: 'empty-data-from-preview-model',
      parseMethod: `${extractResult.parseMethod}-empty`,
    };
  }

  await logExtractionSummary(validated, logger);
  return {
    data: validated,
    needsModelFallback: false,
    parseMethod: extractResult.parseMethod,
  };
}

// ============================================================================
// OpenAI-compatible parsing (OpenRouter + Groq)
// ============================================================================

/**
 * Parse an OpenAI-compatible chat-completion response.
 *
 * Shared by OpenRouter and Groq because both return
 * `choices[0].message.content` with the same JSON-in-text convention.
 */
/**
 * Sanitize a JSON string by removing comments and fixing common issues
 * that AI models might generate.
 */
function sanitizeJsonString(jsonStr: string): string {
  // Remove single-line comments (// ...)
  let cleaned = jsonStr.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments (/* ... */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  return cleaned;
}

export async function parseOpenAICompatibleResponse(
  responseText: string,
  logger: ProcessingLogger,
  providerName: string
): Promise<OpenAIParseResult> {
  await logger.log(`Parsing ${providerName} response`, 'AI');

  if (!responseText) {
    throw new Error(`No content in ${providerName} response`);
  }

  // Try multiple strategies to extract valid JSON
  let jsonStr: string | null = null;
  let parseMethod = 'regex-match';

  // Strategy 1: Look for JSON code blocks
  const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      jsonStr = candidate;
      parseMethod = 'code-block';
    }
  }

  // Strategy 2: Match balanced braces more carefully
  if (!jsonStr) {
    const firstBrace = responseText.indexOf('{');
    if (firstBrace !== -1) {
      let depth = 0;
      let endIndex = -1;
      for (let i = firstBrace; i < responseText.length; i++) {
        if (responseText[i] === '{') depth++;
        else if (responseText[i] === '}') {
          depth--;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
      }
      if (endIndex !== -1) {
        jsonStr = responseText.substring(firstBrace, endIndex + 1);
      }
    }
  }

  // Strategy 3: Fallback to greedy regex (original behavior)
  if (!jsonStr) {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    jsonStr = jsonMatch ? jsonMatch[0] : null;
  }

  if (!jsonStr) {
    console.error(`No valid JSON found in ${providerName} response`);
    await logger.log(
      `No valid JSON found in ${providerName} response`,
      'ERROR'
    );
    throw new Error(`No valid JSON found in ${providerName} response`);
  }

  let enhancedData: any;
  try {
    enhancedData = JSON.parse(sanitizeJsonString(jsonStr));
  } catch (parseError) {
    console.error(`Failed to parse JSON from ${providerName} response:`, parseError);
    console.error(`Extracted JSON string (first 500 chars):`, jsonStr.substring(0, 500));
    await logger.log(
      `JSON parse error from ${providerName}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      'ERROR'
    );
    throw new Error(`Invalid JSON in ${providerName} response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  // Ensure confidence skeleton exists (Groq-specific tweak)
  if (!enhancedData.confidence || typeof enhancedData.confidence !== 'object') {
    enhancedData.confidence = {};
  }
  enhancedData.confidence = { ...DEFAULT_CONFIDENCE, ...enhancedData.confidence };

  await applyMYRDefault(enhancedData, logger);
  enhancedData.date = normalizeDate(enhancedData.date);
  await logExtractionSummary(enhancedData, logger);

  return { data: enhancedData, parseMethod };
}

// ============================================================================
// Bounding-box fallback (Gemini preview model)
// ============================================================================

/**
 * Produce a placeholder result when a Gemini preview model returns
 * bounding-box metadata instead of extracted text.
 */
export async function parseBoundingBoxFormat(
  boundingBoxData: any[],
  logger: ProcessingLogger
): Promise<any> {
  await logger.log(
    `📦 Processing ${boundingBoxData.length} bounding box elements`,
    'AI'
  );
  await logger.log(
    '⚠️ LIMITATION: Bounding box format detected - structure available but text content missing',
    'ERROR'
  );

  // Group elements by label for analysis
  const elementsByLabel: { [key: string]: any[] } = {};
  boundingBoxData.forEach((element) => {
    if (!elementsByLabel[element.label]) {
      elementsByLabel[element.label] = [];
    }
    elementsByLabel[element.label].push(element);
  });

  const detectedLabels = Object.keys(elementsByLabel);
  await logger.log(
    `🏷️ Detected ${detectedLabels.length} unique labels: ${detectedLabels.join(', ')}`,
    'AI'
  );

  const result = {
    merchant: elementsByLabel.store_name ? 'Store detected (text extraction needed)' : '',
    date: elementsByLabel.date ? new Date().toISOString().split('T')[0] : '',
    total: 0,
    tax: 0,
    currency: 'MYR',
    payment_method: elementsByLabel.payment_method ? 'Payment method detected' : '',
    predicted_category: 'Other',
    line_items: [] as any[],
    confidence: {
      merchant: elementsByLabel.store_name ? 50 : 0,
      date: elementsByLabel.date ? 50 : 0,
      total: 0,
      tax: 0,
      currency: 50,
      payment_method: elementsByLabel.payment_method ? 50 : 0,
      predicted_category: 30,
      line_items: 0,
    },
    bounding_box_metadata: {
      format_detected: 'gemini_2.5_bounding_box',
      total_elements: boundingBoxData.length,
      unique_labels: detectedLabels.length,
      detected_labels: detectedLabels,
      requires_text_extraction: true,
    },
  };

  if (elementsByLabel.item_description) {
    const itemCount = elementsByLabel.item_description.length;
    for (let i = 0; i < Math.min(itemCount, 3); i++) {
      result.line_items.push({
        description: `Item ${i + 1} (structure detected)`,
        amount: 0,
      });
    }
    await logger.log(
      `📦 Created ${result.line_items.length} placeholder line items`,
      'AI'
    );
  }

  if (elementsByLabel.item_description && elementsByLabel.item_description.length > 3) {
    result.predicted_category = 'Groceries';
    result.confidence.predicted_category = 60;
  }

  await logger.log(
    '✅ Bounding box analysis complete - structure detected but text extraction needed',
    'AI'
  );
  await logger.log(
    '💡 RECOMMENDATION: Use traditional JSON format for better data extraction',
    'AI'
  );

  return result;
}

// ============================================================================
// Shared helpers
// ============================================================================

/** Validate and normalize a date string to YYYY-MM-DD. Returns '' for invalid input. */
function normalizeDate(dateInput: any): string {
  if (!dateInput || typeof dateInput !== 'string') return '';
  const trimmed = dateInput.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const daysInMonth = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  if (day > daysInMonth[month - 1]) return '';
  return trimmed;
}

/** Build a structured empty result when every parsing strategy fails. */
export function buildDefaultEmptyResponse(parsingError?: string): any {
  return {
    merchant: '',
    date: '',
    total: 0,
    tax: 0,
    currency: 'MYR',
    payment_method: '',
    predicted_category: 'Other',
    line_items: [],
    confidence: { ...DEFAULT_CONFIDENCE },
    parsing_error: parsingError || 'Failed to extract JSON from model response',
  };
}

/** Normalise raw parsed data into a validated shape. */
export async function validateAndNormalize(rawData: any, logger: ProcessingLogger): Promise<any> {
  await logger.log('🔍 Validating extracted data', 'AI');

  const validated = {
    merchant: rawData.merchant || '',
    date: normalizeDate(rawData.date),
    total: parseFloat(rawData.total) || 0,
    tax: parseFloat(rawData.tax) || 0,
    currency: rawData.currency || 'MYR',
    payment_method: rawData.payment_method || '',
    predicted_category: rawData.predicted_category || 'Other',
    line_items: Array.isArray(rawData.line_items) ? rawData.line_items : [],
    confidence: rawData.confidence || {},
  };

  // Ensure confidence object has all required fields
  if (!validated.confidence || typeof validated.confidence !== 'object') {
    validated.confidence = {};
  }
  validated.confidence = { ...DEFAULT_CONFIDENCE, ...validated.confidence };

  await applyMYRDefault(validated, logger);

  return validated;
}

/** Apply MYR default when no currency was detected. */
export async function applyMYRDefault(data: any, logger: ProcessingLogger): Promise<void> {
  if (!data.currency) {
    data.currency = 'MYR';
    data.confidence.currency = 50; // medium confidence for default
    logger.log('Using default currency: MYR', 'AI');
  } else {
    logger.log(`Detected currency: ${data.currency}`, 'AI');
  }
}

/** Decide whether a preview model produced effectively empty data. */
function shouldTriggerEmptyFallback(data: any, modelId: string): boolean {
  if (modelId !== 'gemini-2.5-flash-lite-preview-06-17') return false;

  const hasData =
    data.merchant ||
    data.total > 0 ||
    data.date ||
    (data.line_items && data.line_items.length > 0);

  return !hasData;
}

/** Log a concise summary of extracted fields and average confidence. */
async function logExtractionSummary(data: any, logger: ProcessingLogger): Promise<void> {
  const dataFields = Object.keys(data);
  await logger.log(`📋 Extracted fields: ${dataFields.join(', ')}`, 'AI');

  if (data.confidence) {
    const numericScores = Object.values(data.confidence).filter(
      (v) => typeof v === 'number'
    ) as number[];
    if (numericScores.length > 0) {
      const avg =
        numericScores.reduce((sum, v) => sum + v, 0) / numericScores.length;
      await logger.log(`📊 Average confidence: ${avg.toFixed(1)}%`, 'AI');
    }
  }
}

// ============================================================================
// JSON extraction strategies (shared across all providers)
// ============================================================================

interface JSONExtractResult {
  data: any | null;
  parseMethod: string;
}

function extractJSONFromText(
  responseText: string,
  logger: ProcessingLogger
): JSONExtractResult {
  let data: any = null;
  let parseMethod = '';

  // Strategy 1: code fences ```json … ```
  const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      data = JSON.parse(codeBlockMatch[1].trim());
      parseMethod = 'code-block';
      logger.log('Found JSON in code block', 'AI');
      return { data, parseMethod };
    } catch {
      // continue
    }
  }

  // Strategy 2: greedy regex for outermost { … }
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      data = JSON.parse(jsonMatch[0]);
      parseMethod = 'regex-match';
      logger.log('Found JSON using regex', 'AI');
      return { data, parseMethod };
    } catch {
      // continue
    }
  }

  // Strategy 3: direct parse of the whole response
  try {
    data = JSON.parse(responseText.trim());
    parseMethod = 'direct-parse';
    logger.log('Parsed entire response as JSON', 'AI');
    return { data, parseMethod };
  } catch {
    // continue
  }

  // Strategy 4: flexible regex (nested objects)
  const flexibleMatch = responseText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
  if (flexibleMatch) {
    try {
      data = JSON.parse(flexibleMatch[0]);
      parseMethod = 'flexible-regex';
      logger.log('Found JSON using flexible regex', 'AI');
      return { data, parseMethod };
    } catch {
      // continue
    }
  }

  return { data: null, parseMethod: 'all-failed' };
}
