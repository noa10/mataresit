import { describe, expect, it } from 'vitest';
import {
  executeWithFallback,
  ProviderRequestError,
  selectImageFallbackCandidates
} from '../../supabase/functions/_shared/provider-routing';
import { AVAILABLE_MODELS, resolveModelId, getModelConfig } from '../config/modelProviders';

const hasAllKeys = () => true;

describe('provider routing helpers', () => {
  it('captures structured details in ProviderRequestError', () => {
    const error = new ProviderRequestError({
      provider: 'openrouter',
      modelId: 'openrouter/google/gemma-4-26b-a4b-it',
      status: 500,
      statusText: 'Internal Server Error',
      errorBodySnippet: '{"message":"upstream failure"}',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    });

    expect(error.name).toBe('ProviderRequestError');
    expect(error.provider).toBe('openrouter');
    expect(error.modelId).toBe('openrouter/google/gemma-4-26b-a4b-it');
    expect(error.status).toBe(500);
    expect(error.statusText).toBe('Internal Server Error');
    expect(error.errorBodySnippet).toContain('upstream failure');
    expect(error.endpoint).toContain('/chat/completions');
  });

  it('every registered model points at its provider host and supports vision', () => {
    for (const model of Object.values(AVAILABLE_MODELS)) {
      expect(model.supportsVision).toBe(true);
      expect(model.maxTokens).toBeGreaterThanOrEqual(4096);

      switch (model.provider) {
        case 'gemini':
          expect(model.endpoint).toContain('generativelanguage.googleapis.com');
          expect(model.apiKeyEnvVar).toBe('GEMINI_API_KEY');
          break;
        case 'groq':
          expect(model.endpoint).toBe('https://api.groq.com/openai/v1/chat/completions');
          expect(model.apiKeyEnvVar).toBe('GROQ_API_KEY');
          break;
        case 'openrouter':
          expect(model.endpoint).toBe('https://openrouter.ai/api/v1/chat/completions');
          expect(model.apiKeyEnvVar).toBe('OPENROUTER_API_KEY');
          break;
      }
    }
  });

  it('keeps retired model IDs resolvable to a live registry entry', () => {
    const retiredIds = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'groq/meta-llama/llama-4-scout-17b-16e-instruct',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-flash-lite-preview-06-17',
      'openrouter/google/gemma-3-12b-it:free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free'
    ];

    for (const retiredId of retiredIds) {
      expect(resolveModelId(retiredId)).not.toBe(retiredId);
      expect(getModelConfig(retiredId)).toBeDefined();
    }
  });

  it('never selects the requested model or an already-attempted model as fallback', () => {
    const requested = 'gemini-2.5-flash-lite';
    const candidates = selectImageFallbackCandidates({
      requestedModelId: requested,
      requestedProvider: 'gemini',
      attemptedModelIds: new Set<string>([requested]),
      models: AVAILABLE_MODELS,
      hasApiKey: hasAllKeys
    });

    expect(candidates).not.toContain(requested);
    for (const candidate of candidates) {
      expect(AVAILABLE_MODELS[candidate]).toBeDefined();
      expect(AVAILABLE_MODELS[candidate].supportsVision).toBe(true);
    }
  });

  it('excludes fallbacks whose API key is missing', () => {
    const candidates = selectImageFallbackCandidates({
      requestedModelId: 'gemini-2.5-flash-lite',
      requestedProvider: 'gemini',
      attemptedModelIds: new Set<string>(['gemini-2.5-flash-lite']),
      models: AVAILABLE_MODELS,
      hasApiKey: (envVar: string) => envVar === 'GEMINI_API_KEY'
    });

    expect(candidates).not.toContain('groq/qwen/qwen3.8-27b');
    expect(candidates).not.toContain('openrouter/google/gemma-4-26b-a4b-it');
  });

  it('falls back to another provider when the primary groq model fails', () => {
    const candidates = selectImageFallbackCandidates({
      requestedModelId: 'groq/qwen/qwen3.8-27b',
      requestedProvider: 'groq',
      attemptedModelIds: new Set<string>(['groq/qwen/qwen3.8-27b']),
      models: AVAILABLE_MODELS,
      hasApiKey: hasAllKeys
    });

    expect(candidates).toContain('gemini-2.5-flash-lite');
    expect(candidates).not.toContain('groq/qwen/qwen3.8-27b');
  });
});
describe('provider fallback integration behavior', () => {
  it('reports the primary model when it succeeds', async () => {
    const result = await executeWithFallback({
      primaryModelId: 'gemini-2.5-flash-lite',
      fallbackModelIds: ['groq/qwen/qwen3.8-27b'],
      attempt: async () => ({ merchant: 'Test Store' })
    });

    expect(result.fallbackApplied).toBe(false);
    expect(result.modelUsed).toBe('gemini-2.5-flash-lite');
  });

  it('falls back to groq when gemini attempts fail and updates modelUsed', async () => {
    const result = await executeWithFallback({
      primaryModelId: 'gemini-2.5-flash-lite',
      fallbackModelIds: ['gemini-3.1-flash-lite', 'groq/qwen/qwen3.8-27b'],
      attempt: async (modelId: string) => {
        if (modelId.startsWith('gemini-')) {
          throw new Error(`provider failed for ${modelId}`);
        }
        return { extracted: true, from: modelId };
      }
    });

    expect(result.fallbackApplied).toBe(true);
    expect(result.fallbackFrom).toBe('gemini-2.5-flash-lite');
    expect(result.modelUsed).toBe('groq/qwen/qwen3.8-27b');
    expect(result.result).toEqual({ extracted: true, from: 'groq/qwen/qwen3.8-27b' });
  });

  it('reaches the openrouter last resort when gemini and groq both fail', async () => {
    const result = await executeWithFallback({
      primaryModelId: 'gemini-2.5-flash-lite',
      fallbackModelIds: ['groq/qwen/qwen3.8-27b', 'openrouter/google/gemma-4-26b-a4b-it'],
      attempt: async (modelId: string) => {
        if (!modelId.startsWith('openrouter/')) {
          throw new Error(`provider failed for ${modelId}`);
        }
        return { extracted: true, from: modelId };
      }
    });

    expect(result.modelUsed).toBe('openrouter/google/gemma-4-26b-a4b-it');
    expect(result.attemptedModels).toEqual([
      'gemini-2.5-flash-lite',
      'groq/qwen/qwen3.8-27b',
      'openrouter/google/gemma-4-26b-a4b-it'
    ]);
  });

  it('throws when all provider attempts fail', async () => {
    await expect(
      executeWithFallback({
        primaryModelId: 'gemini-2.5-flash-lite',
        fallbackModelIds: ['groq/qwen/qwen3.8-27b'],
        attempt: async () => {
          throw new Error('all attempts failed');
        }
      })
    ).rejects.toThrow('all attempts failed');
  });

  it('does not retry an already-attempted model', async () => {
    const seen: string[] = [];
    await expect(
      executeWithFallback({
        primaryModelId: 'gemini-2.5-flash-lite',
        fallbackModelIds: ['gemini-2.5-flash-lite', 'groq/qwen/qwen3.8-27b'],
        attempt: async (modelId: string) => {
          seen.push(modelId);
          throw new Error('boom');
        }
      })
    ).rejects.toThrow('boom');

    expect(seen).toEqual(['gemini-2.5-flash-lite', 'groq/qwen/qwen3.8-27b']);
  });
});