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
    receiptId: string
  ): Promise<any> {
    console.log(`Calling OpenRouter model: ${modelConfig.name} for receipt ${receiptId}`);

    // Prepare the messages based on input type
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
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Paperless Maverick Receipt Processing'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

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

      // Try to parse as JSON (expected format for receipt data)
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.warn('Failed to parse OpenRouter response as JSON, returning raw content');
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

IMPORTANT: You must respond with valid JSON only. Do not include any explanatory text before or after the JSON.

The JSON response must include these fields:
- merchant: string (store/restaurant name)
- total_amount: number (total amount paid)
- tax_amount: number (tax amount, 0 if not found)
- date: string (date in YYYY-MM-DD format)
- payment_method: string (cash, card, etc.)
- predicted_category: string (food, shopping, gas, etc.)
- line_items: array of objects with name, quantity, price
- confidence_score: number (0-1, your confidence in the extraction)

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
    return `Please analyze this receipt image and extract the structured data. Look for:

1. Merchant/store name (usually at the top)
2. Total amount (the final amount paid)
3. Tax amount (if shown separately)
4. Date of purchase
5. Payment method (cash, card, etc.)
6. Individual line items with names, quantities, and prices
7. Category (food, shopping, gas, etc.)

Return the extracted information as JSON with the required fields.`;
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
  async testConnection(modelId: string): Promise<boolean> {
    try {
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

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Paperless Maverick Connection Test'
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
