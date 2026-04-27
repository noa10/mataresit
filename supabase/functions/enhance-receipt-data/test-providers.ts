/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

/**
 * Test suite for receipt processing providers (Groq and OpenRouter)
 *
 * Run with:
 *   cd /Users/khairulanwar/dev/mataresit/mataresit
 *   deno test --allow-env --allow-net supabase/functions/enhance-receipt-data/test-providers.ts
 *
 * Or to run only unit tests (no live API calls):
 *   deno test --allow-env supabase/functions/enhance-receipt-data/test-providers.ts
 *
 * To run live API tests, set env vars:
 *   GROQ_API_KEY=xxx OPENROUTER_API_KEY=xxx deno test --allow-env --allow-net supabase/functions/enhance-receipt-data/test-providers.ts
 */

import { assertEquals, assertExists, assertNotEquals } from 'jsr:@std/assert';
import { encodeBase64 } from "jsr:@std/encoding/base64";
import {
  executeWithFallback,
  ProviderRequestError,
  selectImageFallbackCandidates,
} from '../_shared/provider-routing.ts';
import {
  buildTextPrompt,
  buildVisionPrompt,
  TextInput,
  ImageInput,
} from '../_shared/receipt-prompts.ts';
import {
  parseOpenAICompatibleResponse,
  parseGeminiResponse,
  buildDefaultEmptyResponse,
} from '../_shared/ai-response-parsers.ts';
import { ProcessingLogger } from '../_shared/db-logger.ts';

// ============================================================================
// Test fixtures
// ============================================================================

const SAMPLE_RECEIPT_TEXT = `99 SPEEDMART
NO. 123, JALAN TEKNOLOGI
TAMAN TEKNOLOGI, 47000
SELANGOR
TEL: 03-8888 9999

RECEIPT: SM123456
DATE: 15/04/2026
TIME: 14:32

1 X SUGAR 1KG            3.50
1 X MILK POWDER          12.90
2 X INSTANT NOODLE        3.00

SUBTOTAL:                 19.40
SST 6%:                    1.16
TOTAL:                    20.56

PAYMENT: TOUCH N GO
THANK YOU PLEASE COME AGAIN`;

const SAMPLE_EXTRACTED_DATA = {
  merchant: '99 SPEEDMART',
  date: '2026-04-15',
  total: '20.56',
  tax: '1.16',
  currency: 'MYR',
};

function createTextInput(): TextInput {
  return {
    type: 'text',
    extractedData: SAMPLE_EXTRACTED_DATA,
    fullText: SAMPLE_RECEIPT_TEXT,
  };
}

function createImageInput(): ImageInput {
  // Create a minimal 1x1 JPEG for testing
  const minimalJpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
  ]);
  return {
    type: 'image',
    imageData: {
      data: minimalJpeg,
      mimeType: 'image/jpeg',
    },
  };
}

async function createImageInputFromFile(
  imagePath: string
): Promise<ImageInput> {
  const data = await Deno.readFile(imagePath);
  const mimeType = imagePath.endsWith('.png')
    ? 'image/png'
    : imagePath.endsWith('.webp')
    ? 'image/webp'
    : 'image/jpeg';
  return {
    type: 'image',
    imageData: { data, mimeType },
  };
}

class MockLogger {
  public logs: Array<{ message: string; step?: string }> = [];

  async log(message: string, step?: string): Promise<void> {
    this.logs.push({ message, step });
  }
}

// ============================================================================
// Unit Tests: Prompt Building
// ============================================================================

Deno.test('buildTextPrompt - minimal (Groq) includes required fields', () => {
  const input = createTextInput();
  const prompt = buildTextPrompt(input, 'minimal');

  assertEquals(prompt.includes('RECEIPT TEXT:'), true);
  assertEquals(prompt.includes('99 SPEEDMART'), true);
  assertEquals(prompt.includes('EXTRACTED DATA:'), true);
  assertEquals(prompt.includes('"merchant"'), true);
  assertEquals(prompt.includes('"date"'), true);
  assertEquals(prompt.includes('"total"'), true);
  assertEquals(prompt.includes('Malaysian'), true);
  assertEquals(prompt.includes('line_items'), true);
});

Deno.test('buildTextPrompt - standard (OpenRouter) includes required fields', () => {
  const input = createTextInput();
  const prompt = buildTextPrompt(input, 'standard');

  assertEquals(prompt.includes('RECEIPT TEXT:'), true);
  assertEquals(prompt.includes('EXTRACTED DATA:'), true);
  assertEquals(prompt.includes('PAYMENT METHOD'), true);
  assertEquals(prompt.includes('suggestions'), true);
  assertEquals(prompt.includes('confidence'), true);
});

Deno.test('buildTextPrompt - full (Gemini) includes extended fields', () => {
  const input = createTextInput();
  const prompt = buildTextPrompt(input, 'full');

  assertEquals(prompt.includes('structured_data'), true);
  assertEquals(prompt.includes('line_items_analysis'), true);
  assertEquals(prompt.includes('spending_patterns'), true);
  assertEquals(prompt.includes('malaysian_tax_info'), true);
});

Deno.test('buildVisionPrompt - minimal (Groq) is concise', () => {
  const prompt = buildVisionPrompt('minimal');

  assertEquals(prompt.includes('MERCHANT'), true);
  assertEquals(prompt.includes('DATE'), true);
  assertEquals(prompt.includes('TOTAL'), true);
  assertEquals(prompt.includes('LINE_ITEMS'), true);
  assertEquals(prompt.length < 1500, true, 'Groq vision prompt should be concise');
});

Deno.test('buildVisionPrompt - standard (OpenRouter) includes all fields', () => {
  const prompt = buildVisionPrompt('standard');

  assertEquals(prompt.includes('MERCHANT'), true);
  assertEquals(prompt.includes('PAYMENT METHOD'), true);
  assertEquals(prompt.includes('confidence'), true);
  assertEquals(prompt.includes('line_items'), true);
});

// ============================================================================
// Unit Tests: Response Parsing (OpenAI-compatible - Groq + OpenRouter)
// ============================================================================

Deno.test('parseOpenAICompatibleResponse - parses valid Groq JSON response', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  const responseText = `{"merchant":"99 Speedmart","date":"2026-04-15","total":20.56,"tax":1.16,"currency":"MYR","payment_method":"Touch 'n Go eWallet","predicted_category":"Groceries","line_items":[{"description":"Sugar 1KG","amount":3.50},{"description":"Milk Powder","amount":12.90}],"confidence":{"merchant":95,"date":90,"total":95,"tax":85,"currency":95,"payment_method":90,"predicted_category":90,"line_items":80}}`;

  const result = await parseOpenAICompatibleResponse(responseText, logger, 'Groq');

  assertExists(result.data);
  assertEquals(result.data.merchant, '99 Speedmart');
  assertEquals(result.data.total, 20.56);
  assertEquals(result.data.currency, 'MYR');
  assertEquals(result.data.payment_method, "Touch 'n Go eWallet");
  assertEquals(result.data.predicted_category, 'Groceries');
  assertEquals(result.data.line_items.length, 2);
  assertEquals(result.parseMethod, 'regex-match');
});

Deno.test('parseOpenAICompatibleResponse - parses OpenRouter JSON with markdown', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  const responseText = `Here is the extracted receipt data:

\`\`\`json
{"merchant":"KK Super Mart","date":"2026-04-14","total":15.80,"tax":0.95,"currency":"MYR","payment_method":"Cash","predicted_category":"Groceries","line_items":[{"description":"Mineral Water","amount":1.50},{"description":"Bread","amount":3.80}],"confidence":{"merchant":88,"date":85,"total":92,"tax":75,"currency":95,"payment_method":80,"predicted_category":85,"line_items":70}}
\`\`\``;

  const result = await parseOpenAICompatibleResponse(responseText, logger, 'OpenRouter');

  assertExists(result.data);
  assertEquals(result.data.merchant, 'KK Super Mart');
  assertEquals(result.data.total, 15.80);
  assertEquals(result.data.currency, 'MYR');
});

Deno.test('parseOpenAICompatibleResponse - applies default confidence for missing fields', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  // Response with no confidence object at all
  const responseText = `{"merchant":"Test Store","date":"2026-04-15","total":10.00,"currency":"MYR"}`;

  const result = await parseOpenAICompatibleResponse(responseText, logger, 'Groq');

  assertExists(result.data.confidence);
  assertEquals(result.data.confidence.currency, 50); // Default from DEFAULT_CONFIDENCE
  assertEquals(result.data.confidence.merchant, 0);
});

Deno.test('parseOpenAICompatibleResponse - throws on empty response', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;

  try {
    await parseOpenAICompatibleResponse('', logger, 'Groq');
    throw new Error('Should have thrown');
  } catch (error) {
    assertEquals((error as Error).message.includes('No content'), true);
  }
});

Deno.test('parseOpenAICompatibleResponse - throws on invalid JSON', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;

  try {
    await parseOpenAICompatibleResponse('This is just plain text with no JSON', logger, 'OpenRouter');
    throw new Error('Should have thrown');
  } catch (error) {
    assertEquals((error as Error).message.includes('No valid JSON'), true);
  }
});

Deno.test('parseOpenAICompatibleResponse - normalizes invalid date to empty string', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  const responseText = `{"merchant":"Test Store","date":"2016.00","total":10.00,"currency":"MYR"}`;

  const result = await parseOpenAICompatibleResponse(responseText, logger, 'Groq');

  assertExists(result.data);
  assertEquals(result.data.date, '');
});

Deno.test('parseOpenAICompatibleResponse - preserves valid date', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  const responseText = `{"merchant":"Test Store","date":"2026-04-28","total":10.00,"currency":"MYR"}`;

  const result = await parseOpenAICompatibleResponse(responseText, logger, 'Groq');

  assertExists(result.data);
  assertEquals(result.data.date, '2026-04-28');
});

// ============================================================================
// Unit Tests: Provider Routing / Fallback
// ============================================================================

Deno.test('selectImageFallbackCandidates - returns candidates excluding requested model', () => {
  const mockModels = {
    'groq/meta-llama/llama-4-scout-17b-16e-instruct': {
      id: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
      provider: 'groq' as const,
      apiKeyEnvVar: 'GROQ_API_KEY',
      supportsVision: true,
    },
    'gemini-2.0-flash-lite': {
      id: 'gemini-2.0-flash-lite',
      provider: 'gemini' as const,
      apiKeyEnvVar: 'GEMINI_API_KEY',
      supportsVision: true,
    },
    'openrouter/google/gemma-3-12b-it:free': {
      id: 'openrouter/google/gemma-3-12b-it:free',
      provider: 'openrouter' as const,
      apiKeyEnvVar: 'OPENROUTER_API_KEY',
      supportsVision: true,
    },
  };

  const candidates = selectImageFallbackCandidates({
    requestedModelId: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
    requestedProvider: 'groq',
    attemptedModelIds: new Set(),
    models: mockModels,
    hasApiKey: (envVar: string) => envVar === 'GEMINI_API_KEY' || envVar === 'OPENROUTER_API_KEY',
  });

  assertEquals(candidates.includes('groq/meta-llama/llama-4-scout-17b-16e-instruct'), false);
  assertEquals(candidates.includes('gemini-2.0-flash-lite'), true);
  assertEquals(candidates.includes('openrouter/google/gemma-3-12b-it:free'), true);
});

Deno.test('executeWithFallback - succeeds on primary without fallback', async () => {
  const result = await executeWithFallback({
    primaryModelId: 'model-a',
    fallbackModelIds: ['model-b', 'model-c'],
    attempt: async (modelId: string) => {
      if (modelId === 'model-a') return { success: true, data: 'primary' };
      throw new Error('Unexpected model');
    },
  });

  assertEquals(result.result.success, true);
  assertEquals(result.modelUsed, 'model-a');
  assertEquals(result.fallbackApplied, false);
  assertEquals(result.fallbackFrom, null);
});

Deno.test('executeWithFallback - falls back when primary fails', async () => {
  const result = await executeWithFallback({
    primaryModelId: 'model-a',
    fallbackModelIds: ['model-b', 'model-c'],
    attempt: async (modelId: string) => {
      if (modelId === 'model-a') throw new Error('Primary failed');
      if (modelId === 'model-b') return { success: true, data: 'fallback-b' };
      throw new Error('Unexpected model');
    },
  });

  assertEquals(result.result.success, true);
  assertEquals(result.modelUsed, 'model-b');
  assertEquals(result.fallbackApplied, true);
  assertEquals(result.fallbackFrom, 'model-a');
});

Deno.test('executeWithFallback - throws when all models fail', async () => {
  try {
    await executeWithFallback({
      primaryModelId: 'model-a',
      fallbackModelIds: ['model-b'],
      attempt: async () => {
        throw new Error('All models failed');
      },
    });
    throw new Error('Should have thrown');
  } catch (error) {
    assertEquals((error as Error).message, 'All models failed');
  }
});

// ============================================================================
// Integration Tests: Live API Calls (only run when API keys are available)
// ============================================================================

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

async function callGroqAPI(
  input: TextInput | ImageInput,
  logger: ProcessingLogger
): Promise<any> {
  const modelName = 'meta-llama/llama-4-scout-17b-16e-instruct';

  let messages: any[];
  if (input.type === 'text') {
    const prompt = buildTextPrompt(input, 'minimal');
    messages = [{ role: 'user', content: prompt }];
  } else {
    const base64Image = encodeBase64(input.imageData.data);
    const dataUrl = `data:${input.imageData.mimeType};base64,${base64Image}`;
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildVisionPrompt('minimal') },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.2,
      max_completion_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ProviderRequestError({
      provider: 'groq',
      modelId: `groq/${modelName}`,
      status: response.status,
      statusText: response.statusText,
      errorBodySnippet: errorText.substring(0, 500),
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    });
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content;
  if (!responseText) {
    throw new Error('No content in Groq response');
  }

  return await parseOpenAICompatibleResponse(responseText, logger, 'Groq');
}

async function callOpenRouterAPI(
  input: TextInput | ImageInput,
  logger: ProcessingLogger
): Promise<any> {
  const modelName = 'baidu/qianfan-ocr-fast:free';

  let messages: any[];
  if (input.type === 'text') {
    const prompt = buildTextPrompt(input, 'standard');
    messages = [{ role: 'user', content: prompt }];
  } else {
    const base64Image = encodeBase64(input.imageData.data);
    const dataUrl = `data:${input.imageData.mimeType};base64,${base64Image}`;
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildVisionPrompt('standard') },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ];
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mataresit.app',
      'X-Title': 'Mataresit Receipt Processing Test',
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ProviderRequestError({
      provider: 'openrouter',
      modelId: `openrouter/${modelName}`,
      status: response.status,
      statusText: response.statusText,
      errorBodySnippet: errorText.substring(0, 500),
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    });
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content;
  if (!responseText) {
    throw new Error('No content in OpenRouter response');
  }

  return await parseOpenAICompatibleResponse(responseText, logger, 'OpenRouter');
}

// --- Groq Live Tests ---

Deno.test({
  name: 'LIVE: Groq text processing returns valid receipt data',
  ignore: !GROQ_API_KEY,
}, async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  const input = createTextInput();

  const result = await callGroqAPI(input, logger);

  assertExists(result.data);
  assertExists(result.data.merchant);
  assertExists(result.data.currency);
  assertEquals(result.data.currency, 'MYR');
  console.log('Groq text result:', JSON.stringify(result.data, null, 2));
});

Deno.test({
  name: 'LIVE: Groq image processing returns valid receipt data',
  ignore: !GROQ_API_KEY,
}, async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  // Use the project's receipt-scanner.png (real receipt image)
  const imagePath = new URL('../../../public/test-receipt.jpeg', import.meta.url).pathname;
  const input = await createImageInputFromFile(imagePath);
  console.log(`Sending ${input.imageData.data.length} bytes to Groq`);

  const result = await callGroqAPI(input, logger);
  assertExists(result.data);
  console.log('Groq image result:', JSON.stringify(result.data, null, 2));
});

// --- OpenRouter Live Tests ---

Deno.test({
  name: 'LIVE: OpenRouter text processing returns valid receipt data',
  ignore: !OPENROUTER_API_KEY,
}, async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  const input = createTextInput();

  const result = await callOpenRouterAPI(input, logger);

  assertExists(result.data);
  assertExists(result.data.merchant);
  assertExists(result.data.currency);
  assertEquals(result.data.currency, 'MYR');
  console.log('OpenRouter text result:', JSON.stringify(result.data, null, 2));
});

Deno.test({
  name: 'LIVE: OpenRouter image processing returns valid receipt data',
  ignore: !OPENROUTER_API_KEY,
}, async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  // Use the project's receipt-scanner.png (real receipt image)
  const imagePath = new URL('../../../public/test-receipt.jpeg', import.meta.url).pathname;
  const input = await createImageInputFromFile(imagePath);
  console.log(`Sending ${input.imageData.data.length} bytes to OpenRouter (baidu/qianfan-ocr-fast)`);

  const result = await callOpenRouterAPI(input, logger);
  assertExists(result.data);
  console.log('OpenRouter image result:', JSON.stringify(result.data, null, 2));
});

// ============================================================================
// End-to-end: Test full enhancement pipeline with mock AI responses
// ============================================================================

Deno.test('end-to-end: buildDefaultEmptyResponse returns valid structure', () => {
  const empty = buildDefaultEmptyResponse('Test error');

  assertEquals(empty.merchant, '');
  assertEquals(empty.date, '');
  assertEquals(empty.total, 0);
  assertEquals(empty.tax, 0);
  assertEquals(empty.currency, 'MYR');
  assertEquals(empty.payment_method, '');
  assertEquals(empty.predicted_category, 'Other');
  assertEquals(Array.isArray(empty.line_items), true);
  assertEquals(empty.parsing_error, 'Test error');
  assertExists(empty.confidence);
});

Deno.test('end-to-end: parseGeminiResponse handles normal JSON', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  const responseText = `{"merchant":"AEON Big","date":"2026-04-10","total":45.60,"tax":2.74,"currency":"MYR","payment_method":"Credit Card","predicted_category":"Groceries","line_items":[{"description":"Rice 5KG","amount":18.50},{"description":"Cooking Oil","amount":8.90}],"confidence":{"merchant":90,"date":85,"total":92,"tax":80,"currency":95,"payment_method":88,"predicted_category":90,"line_items":75}}`;

  const result = await parseGeminiResponse(responseText, 'gemini-2.0-flash-lite', logger);

  assertExists(result.data);
  assertEquals(result.data.merchant, 'AEON Big');
  assertEquals(result.needsModelFallback, false);
});

Deno.test('end-to-end: parseGeminiResponse normalizes invalid date to empty string', async () => {
  const logger = new MockLogger() as unknown as ProcessingLogger;
  const responseText = `{"merchant":"AEON Big","date":"2016.00","total":45.60,"currency":"MYR"}`;

  const result = await parseGeminiResponse(responseText, 'gemini-2.0-flash-lite', logger);

  assertExists(result.data);
  assertEquals(result.data.date, '');
});

console.log(`\n========================================`);
console.log(`Receipt Processing Provider Test Suite`);
console.log(`========================================`);
console.log(`Unit tests: Always run`);
console.log(`Live API tests: Only run when API keys are set`);
console.log(`  - GROQ_API_KEY: ${GROQ_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  - OPENROUTER_API_KEY: ${OPENROUTER_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`Run unit tests only: deno test --allow-env test-providers.ts`);
console.log(`Run all tests:      deno test --allow-env --allow-net test-providers.ts`);
console.log(`========================================\n`);
