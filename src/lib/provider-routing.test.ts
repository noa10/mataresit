import { describe, expect, it, vi } from 'vitest';
import {
  executeWithFallback,
  getOpenCodeRetryEndpoint,
  ProviderRequestError,
  resolveKiloGatewayChatEndpoint,
  selectImageFallbackCandidates,
  shouldRetryOpenCodeImageRequest
} from '../../supabase/functions/_shared/provider-routing';
import { AVAILABLE_MODELS } from '../config/modelProviders';

describe('provider routing helpers', () => {
  it('resolves Kilo endpoint to /chat/completions exactly once', () => {
    expect(resolveKiloGatewayChatEndpoint('https://api.kilo.ai/api/gateway'))
      .toBe('https://api.kilo.ai/api/gateway/chat/completions');
    expect(resolveKiloGatewayChatEndpoint('https://api.kilo.ai/api/gateway/chat/completions'))
      .toBe('https://api.kilo.ai/api/gateway/chat/completions');
    expect(resolveKiloGatewayChatEndpoint('https://api.kilo.ai/api/gateway/chat/completions/'))
      .toBe('https://api.kilo.ai/api/gateway/chat/completions');
  });

  it('keeps all Kilo model endpoints on /chat/completions in model registry', () => {
    const kiloModels = Object.values(AVAILABLE_MODELS).filter((model) => model.provider === 'kilo');
    expect(kiloModels.length).toBeGreaterThan(0);
    for (const model of kiloModels) {
      expect(model.endpoint.endsWith('/chat/completions')).toBe(true);
    }
  });

  it('captures structured details in ProviderRequestError', () => {
    const error = new ProviderRequestError({
      provider: 'opencode',
      modelId: 'opencode/minimax-m2.5-free',
      status: 500,
      statusText: 'Internal Server Error',
      errorBodySnippet: '{"message":"Cannot read properties of undefined (reading prompt_tokens)"}',
      endpoint: 'https://opencode.ai/zen/v1/chat/completions'
    });

    expect(error.name).toBe('ProviderRequestError');
    expect(error.provider).toBe('opencode');
    expect(error.modelId).toBe('opencode/minimax-m2.5-free');
    expect(error.status).toBe(500);
    expect(error.statusText).toBe('Internal Server Error');
    expect(error.errorBodySnippet).toContain('prompt_tokens');
    expect(error.endpoint).toContain('/chat/completions');
  });

  it('selects fallback models while skipping attempted and missing-api-key models', () => {
    const attempted = new Set<string>(['opencode/minimax-m2.5-free']);
    const candidates = selectImageFallbackCandidates({
      requestedModelId: 'opencode/minimax-m2.5-free',
      requestedProvider: 'opencode',
      attemptedModelIds: attempted,
      models: AVAILABLE_MODELS,
      hasApiKey: (envVar: string) => envVar !== 'OPENROUTER_API_KEY'
    });

    expect(candidates).toContain('opencode/kimi-k2.5-free');
    expect(candidates).toContain('opencode/glm-5-free');
    expect(candidates).toContain('opencode/big-pickle');
    expect(candidates).toContain('gemini-2.5-flash-lite');
    expect(candidates).not.toContain('openrouter/google/gemini-2.0-flash-exp:free');
    expect(candidates).not.toContain('opencode/minimax-m2.5-free');
  });

  it('supports groq provider in fallback selection without same-provider fallbacks', () => {
    const candidates = selectImageFallbackCandidates({
      requestedModelId: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
      requestedProvider: 'groq',
      attemptedModelIds: new Set<string>(['groq/meta-llama/llama-4-scout-17b-16e-instruct']),
      models: AVAILABLE_MODELS,
      hasApiKey: () => true
    });

    expect(candidates).toContain('gemini-2.5-flash-lite');
    expect(candidates).toContain('openrouter/google/gemini-2.0-flash-exp:free');
    expect(candidates).not.toContain('groq/meta-llama/llama-4-scout-17b-16e-instruct');
  });

  it('detects OpenCode retry conditions for image failures', () => {
    expect(shouldRetryOpenCodeImageRequest('image', 500, 'Internal Server Error')).toBe(true);
    expect(shouldRetryOpenCodeImageRequest('image', 404, '{"message":"not found"}')).toBe(true);
    expect(
      shouldRetryOpenCodeImageRequest(
        'image',
        400,
        '{"message":"Cannot read properties of undefined (reading prompt_tokens)"}'
      )
    ).toBe(true);
    expect(shouldRetryOpenCodeImageRequest('image', 400, '{"message":"bad request"}')).toBe(false);
    expect(
      shouldRetryOpenCodeImageRequest(
        'text',
        500,
        '{"message":"Cannot read properties of undefined (reading prompt_tokens)"}'
      )
    ).toBe(false);
  });

  it('keeps OpenCode retry endpoint on /zen/v1 chat completions', () => {
    expect(getOpenCodeRetryEndpoint('https://opencode.ai/zen/v1/chat/completions'))
      .toBe('https://opencode.ai/zen/v1/chat/completions');
  });
});

describe('provider fallback integration behavior', () => {
  it('uses corrected Kilo endpoint so POST would target chat/completions', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    const resolvedEndpoint = resolveKiloGatewayChatEndpoint('https://api.kilo.ai/api/gateway');

    await fetchMock(resolvedEndpoint, { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.kilo.ai/api/gateway/chat/completions');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('allows OpenCode retry path for 500 prompt_tokens-class failures', () => {
    const shouldRetry = shouldRetryOpenCodeImageRequest(
      'image',
      500,
      '{"type":"error","error":{"message":"Cannot read properties of undefined (reading prompt_tokens)"}}'
    );
    expect(shouldRetry).toBe(true);
  });

  it('falls back to Gemini when OpenCode attempts fail and updates modelUsed', async () => {
    const result = await executeWithFallback({
      primaryModelId: 'opencode/minimax-m2.5-free',
      fallbackModelIds: ['opencode/kimi-k2.5-free', 'gemini-2.5-flash-lite'],
      attempt: async (modelId: string) => {
        if (modelId.startsWith('opencode/')) {
          throw new Error(`provider failed for ${modelId}`);
        }
        return { extracted: true, from: modelId };
      }
    });

    expect(result.fallbackApplied).toBe(true);
    expect(result.fallbackFrom).toBe('opencode/minimax-m2.5-free');
    expect(result.modelUsed).toBe('gemini-2.5-flash-lite');
    expect(result.result).toEqual({ extracted: true, from: 'gemini-2.5-flash-lite' });
  });

  it('throws non-success when all provider attempts fail', async () => {
    await expect(
      executeWithFallback({
        primaryModelId: 'opencode/minimax-m2.5-free',
        fallbackModelIds: ['opencode/kimi-k2.5-free', 'gemini-2.5-flash-lite'],
        attempt: async () => {
          throw new Error('all attempts failed');
        }
      })
    ).rejects.toThrow('all attempts failed');
  });
});
