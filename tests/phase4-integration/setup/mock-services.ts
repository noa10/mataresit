/**
 * Mock Services for Phase 4 Integration Tests
 * 
 * This file provides mock implementations of external services (Gemini API, OpenRouter, etc.)
 * for reliable and controlled testing of the integration scenarios.
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { TestConfig } from './test-setup';

export interface MockServices {
  server: ReturnType<typeof setupServer>;
  geminiMock: GeminiMockService;
  openrouterMock: OpenRouterMockService;
  rateLimitSimulator: RateLimitSimulator;
}

/**
 * Gemini API Mock Service
 */
export class GeminiMockService {
  private requestCount = 0;
  private tokenUsage = 0;
  private failureRate = 0;
  private responseDelay = 0;
  private rateLimitEnabled = false;
  private rateLimitResetTime = 0;

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  setResponseDelay(delayMs: number): void {
    this.responseDelay = Math.max(0, delayMs);
  }

  enableRateLimit(durationMs: number): void {
    this.rateLimitEnabled = true;
    this.rateLimitResetTime = Date.now() + durationMs;
  }

  disableRateLimit(): void {
    this.rateLimitEnabled = false;
    this.rateLimitResetTime = 0;
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      tokenUsage: this.tokenUsage,
      failureRate: this.failureRate,
      responseDelay: this.responseDelay,
      rateLimitEnabled: this.rateLimitEnabled
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.tokenUsage = 0;
    this.failureRate = 0;
    this.responseDelay = 0;
    this.rateLimitEnabled = false;
    this.rateLimitResetTime = 0;
  }

  createHandler() {
    return http.post('https://generativelanguage.googleapis.com/v1beta/models/*', async ({ request }) => {
      this.requestCount++;

      // Simulate response delay
      if (this.responseDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.responseDelay));
      }

      // Check rate limit
      if (this.rateLimitEnabled && Date.now() < this.rateLimitResetTime) {
        return new HttpResponse(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Resource has been exhausted (e.g. check quota).',
              status: 'RESOURCE_EXHAUSTED'
            }
          }),
          { 
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((this.rateLimitResetTime - Date.now()) / 1000).toString()
            }
          }
        );
      }

      // Simulate random failures
      if (Math.random() < this.failureRate) {
        return new HttpResponse(
          JSON.stringify({
            error: {
              code: 500,
              message: 'Internal server error',
              status: 'INTERNAL'
            }
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Simulate successful response
      const tokensUsed = Math.floor(Math.random() * 3000) + 1000;
      this.tokenUsage += tokensUsed;

      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                merchant_name: `Test Merchant ${this.requestCount}`,
                total_amount: (Math.random() * 100).toFixed(2),
                currency: 'USD',
                date: new Date().toISOString().split('T')[0],
                items: [
                  {
                    description: `Test Item ${this.requestCount}`,
                    amount: (Math.random() * 50).toFixed(2),
                    quantity: 1
                  }
                ]
              })
            }]
          },
          finishReason: 'STOP'
        }],
        usageMetadata: {
          promptTokenCount: Math.floor(tokensUsed * 0.3),
          candidatesTokenCount: Math.floor(tokensUsed * 0.7),
          totalTokenCount: tokensUsed
        }
      };

      return HttpResponse.json(mockResponse);
    });
  }
}

/**
 * OpenRouter API Mock Service
 */
export class OpenRouterMockService {
  private requestCount = 0;
  private tokenUsage = 0;
  private failureRate = 0;
  private responseDelay = 0;

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  setResponseDelay(delayMs: number): void {
    this.responseDelay = Math.max(0, delayMs);
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      tokenUsage: this.tokenUsage,
      failureRate: this.failureRate,
      responseDelay: this.responseDelay
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.tokenUsage = 0;
    this.failureRate = 0;
    this.responseDelay = 0;
  }

  createHandler() {
    return http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
      this.requestCount++;

      // Simulate response delay
      if (this.responseDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.responseDelay));
      }

      // Simulate random failures
      if (Math.random() < this.failureRate) {
        return new HttpResponse(
          JSON.stringify({
            error: {
              message: 'Internal server error',
              type: 'server_error',
              code: 500
            }
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Simulate successful response
      const tokensUsed = Math.floor(Math.random() * 2500) + 800;
      this.tokenUsage += tokensUsed;

      const mockResponse = {
        id: `chatcmpl-test-${this.requestCount}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'anthropic/claude-3-sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              merchant_name: `Test Merchant ${this.requestCount}`,
              total_amount: (Math.random() * 100).toFixed(2),
              currency: 'USD',
              date: new Date().toISOString().split('T')[0],
              items: [
                {
                  description: `Test Item ${this.requestCount}`,
                  amount: (Math.random() * 50).toFixed(2),
                  quantity: 1
                }
              ]
            })
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: Math.floor(tokensUsed * 0.4),
          completion_tokens: Math.floor(tokensUsed * 0.6),
          total_tokens: tokensUsed
        }
      };

      return HttpResponse.json(mockResponse);
    });
  }
}

/**
 * Rate Limit Simulator
 */
export class RateLimitSimulator {
  private activeSimulations = new Map<string, number>();

  simulateRateLimit(service: 'gemini' | 'openrouter', durationMs: number): void {
    this.activeSimulations.set(service, Date.now() + durationMs);
  }

  isRateLimited(service: 'gemini' | 'openrouter'): boolean {
    const resetTime = this.activeSimulations.get(service);
    if (!resetTime) return false;
    
    if (Date.now() >= resetTime) {
      this.activeSimulations.delete(service);
      return false;
    }
    
    return true;
  }

  clearSimulations(): void {
    this.activeSimulations.clear();
  }

  getActiveSimulations(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [service, resetTime] of this.activeSimulations.entries()) {
      if (Date.now() < resetTime) {
        result[service] = resetTime - Date.now();
      }
    }
    return result;
  }
}

/**
 * Setup mock services for testing
 */
export async function setupMockServices(config: TestConfig): Promise<MockServices> {
  const geminiMock = new GeminiMockService();
  const openrouterMock = new OpenRouterMockService();
  const rateLimitSimulator = new RateLimitSimulator();

  // Create MSW server with handlers
  const server = setupServer(
    geminiMock.createHandler(),
    openrouterMock.createHandler(),
    
    // Mock Supabase Edge Functions
    http.post('*/functions/v1/generate-embeddings', async ({ request }) => {
      const body = await request.json() as any;
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return HttpResponse.json({
        success: true,
        embedding: Array.from({ length: 1536 }, () => Math.random()),
        tokensUsed: Math.floor(Math.random() * 1000) + 500,
        processingTimeMs: Math.floor(Math.random() * 5000) + 1000
      });
    }),

    // Mock other Edge Functions as needed
    http.post('*/functions/v1/process-receipt', async ({ request }) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      return HttpResponse.json({
        success: true,
        receiptData: {
          merchant_name: 'Test Merchant',
          total_amount: '25.99',
          currency: 'USD',
          date: new Date().toISOString().split('T')[0]
        },
        processingTimeMs: Math.floor(Math.random() * 3000) + 1000
      });
    })
  );

  // Start the server
  server.listen({
    onUnhandledRequest: 'warn'
  });

  return {
    server,
    geminiMock,
    openrouterMock,
    rateLimitSimulator
  };
}

/**
 * Teardown mock services
 */
export async function teardownMockServices(mockServices: MockServices): Promise<void> {
  mockServices.server.close();
  mockServices.geminiMock.reset();
  mockServices.openrouterMock.reset();
  mockServices.rateLimitSimulator.clearSimulations();
}

/**
 * Simulate API rate limiting for testing
 */
export async function simulateAPIRateLimit(
  mockServices: MockServices,
  service: 'gemini' | 'openrouter',
  durationMs: number
): Promise<void> {
  if (service === 'gemini') {
    mockServices.geminiMock.enableRateLimit(durationMs);
  }
  mockServices.rateLimitSimulator.simulateRateLimit(service, durationMs);
}

/**
 * Simulate random API failures for testing
 */
export function simulateRandomFailures(
  mockServices: MockServices,
  failureRate: number
): void {
  mockServices.geminiMock.setFailureRate(failureRate);
  mockServices.openrouterMock.setFailureRate(failureRate);
}

/**
 * Set response delays for performance testing
 */
export function setResponseDelays(
  mockServices: MockServices,
  delayMs: number
): void {
  mockServices.geminiMock.setResponseDelay(delayMs);
  mockServices.openrouterMock.setResponseDelay(delayMs);
}
