/**
 * OpenRouter API integration service
 * Provides access to multiple AI models through OpenRouter's unified API
 */

import { ModelConfig } from '@/config/modelProviders';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ProcessingInput {
  type: 'text' | 'image';
  textData?: {
    fullText: string;
    textractData?: any;
  };
  imageData?: {
    data: Uint8Array;
    mimeType: string;
  };
}

export interface ProgressCallback {
  (stepName: string, message: string, progress?: number): void;
}

/**
 * OpenRouter API service class
 */
export class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Call OpenRouter API with the specified model and input
   */
  async callModel(
    modelConfig: ModelConfig,
    input: ProcessingInput,
    receiptId: string,
    onProgress?: ProgressCallback
  ): Promise<any> {
    console.log(`Calling OpenRouter model: ${modelConfig.name} for receipt ${receiptId}`);

    // Emit initialization progress
    onProgress?.('START', 'Initializing OpenRouter processing');

    // Validate API key
    onProgress?.('START', 'Validating API key');
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Prepare the messages based on input type
    onProgress?.('START', 'Preparing image data');
    const messages = this.prepareMessages(input, modelConfig);

    // Prepare the request
    const request: OpenRouterRequest = {
      model: this.extractModelName(modelConfig.id),
      messages,
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    };

    try {
      // Emit API connection progress
      onProgress?.('AI', 'Connecting to OpenRouter API');

      // Send request to API
      onProgress?.('AI', 'Sending image to AI model');
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mataresit Receipt Processing'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      // Emit processing progress
      onProgress?.('AI', 'Processing with AI model');

      // Get response
      onProgress?.('AI', 'Receiving AI response');
      const result: OpenRouterResponse = await response.json();
      console.log(`OpenRouter API response for ${receiptId}:`, {
        model: result.model,
        usage: result.usage,
        finishReason: result.choices[0]?.finish_reason
      });

      // Extract and parse the response content
      const content = result.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenRouter response');
      }

      console.log('🔍 OpenRouter raw response content:', {
        contentType: typeof content,
        contentLength: content.length,
        contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        fullContent: content
      });

      // Emit parsing progress
      onProgress?.('AI', 'Parsing AI response');

      // Try to parse as JSON (expected format for receipt data)
      try {
        const parsedResult = JSON.parse(content);
        console.log('✅ Successfully parsed OpenRouter response as JSON:', parsedResult);

        // Emit processing completion for this stage
        onProgress?.('PROCESSING', 'Extracting receipt data');

        return parsedResult;
      } catch (parseError) {
        console.warn('❌ Failed to parse OpenRouter response as JSON:', {
          error: parseError.message,
          content: content,
          contentLength: content.length
        });

        // Try to extract JSON from the content if it's wrapped in text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully extracted JSON from response:', extractedJson);

            // Emit processing completion for this stage
            onProgress?.('PROCESSING', 'Extracting receipt data');

            return extractedJson;
          } catch (extractError) {
            console.warn('❌ Failed to parse extracted JSON:', extractError.message);
          }
        }

        // Return raw content as fallback
        console.warn('⚠️ Returning raw content as fallback');
        return { raw_content: content };
      }

    } catch (error) {
      console.error(`OpenRouter API call failed for ${modelConfig.name}:`, error);
      throw error;
    }
  }

  /**
   * Prepare messages for the OpenRouter API based on input type
   */
  private prepareMessages(input: ProcessingInput, modelConfig: ModelConfig): OpenRouterMessage[] {
    const systemPrompt = this.getSystemPrompt();
    
    if (input.type === 'text') {
      // Text-based processing (OCR + AI)
      const userPrompt = this.getTextPrompt(input.textData!);
      
      return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
    } else {
      // Image-based processing (AI Vision)
      if (!modelConfig.supportsVision) {
        throw new Error(`Model ${modelConfig.name} does not support vision input`);
      }

      const imageBase64 = this.arrayBufferToBase64(input.imageData!.data);
      const dataUrl = `data:${input.imageData!.mimeType};base64,${imageBase64}`;

      return [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.getVisionPrompt()
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high'
              }
            }
          ]
        }
      ];
    }
  }

  /**
   * Get system prompt for receipt processing
   */
  private getSystemPrompt(): string {
    return `You are an AI assistant specialized in analyzing receipt data. Your task is to extract structured information from receipts and return it in a specific JSON format.

CRITICAL INSTRUCTIONS:
1. You MUST respond with valid JSON only
2. Do NOT include any explanatory text, markdown formatting, or code blocks
3. Do NOT wrap the JSON in backticks or any other formatting
4. Return only the raw JSON object

Required JSON format:
{
  "merchant": "string - store/restaurant name",
  "total": "number - total amount paid",
  "tax": "number - tax amount, 0 if not found",
  "date": "string - date in YYYY-MM-DD format",
  "payment_method": "string - cash, card, etc.",
  "predicted_category": "string - food, shopping, gas, etc.",
  "line_items": [{"description": "string", "amount": "number"}],
  "confidence": {"merchant": "number 0-1", "total": "number 0-1", "date": "number 0-1"}
}

Be accurate and conservative with your confidence scores.`;
  }

  /**
   * Get prompt for text-based processing
   */
  private getTextPrompt(textData: { fullText: string; textractData?: any }): string {
    return `Please analyze this receipt text and extract the structured data:

RECEIPT TEXT:
${textData.fullText}

${textData.textractData ? `\nTEXTRACT DATA:\n${JSON.stringify(textData.textractData, null, 2)}` : ''}

Extract the information and return it as JSON with the required fields.`;
  }

  /**
   * Get prompt for vision-based processing
   */
  private getVisionPrompt(): string {
    return `Analyze this receipt image and extract the data. Return ONLY valid JSON with no additional text or formatting.

Extract these fields:
1. merchant: Store/restaurant name (usually at the top)
2. total: Final amount paid (as number)
3. tax: Tax amount if shown (as number, 0 if not found)
4. date: Purchase date (YYYY-MM-DD format)
5. payment_method: How payment was made (cash, card, etc.)
6. predicted_category: Type of purchase (food, shopping, gas, etc.)
7. line_items: Array of items with description and amount
8. confidence: Object with confidence scores (0-1) for each field

Return only the JSON object, no explanations or formatting.`;
  }

  /**
   * Extract model name from OpenRouter model ID
   */
  private extractModelName(modelId: string): string {
    // Remove 'openrouter/' prefix if present
    return modelId.replace(/^openrouter\//, '');
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Test API connection and model availability
   */
  async testConnection(modelId: string, onProgress?: ProgressCallback): Promise<boolean> {
    try {
      onProgress?.('START', 'Testing OpenRouter connection');

      const testRequest: OpenRouterRequest = {
        model: this.extractModelName(modelId),
        messages: [
          { role: 'user', content: 'Hello, this is a test message. Please respond with "OK".' }
        ],
        max_tokens: 10,
        temperature: 0
      };

      console.log('OpenRouter test request:', {
        model: testRequest.model,
        url: `${this.baseUrl}/chat/completions`,
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey?.length || 0
      });

      onProgress?.('AI', 'Connecting to OpenRouter API');

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mataresit Connection Test'
        },
        body: JSON.stringify(testRequest)
      });

      console.log('OpenRouter test response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });

        // Try to parse error details
        try {
          const errorData = JSON.parse(errorText);
          console.error('OpenRouter error details:', errorData);
        } catch (parseError) {
          console.error('Could not parse error response as JSON');
        }
      }

      return response.ok;
    } catch (error) {
      console.error('OpenRouter connection test failed with exception:', error);
      return false;
    }
  }

  /**
   * Get available models from OpenRouter
   */
  async getAvailableModels(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      return [];
    }
  }
}
