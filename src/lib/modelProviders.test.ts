import { describe, expect, it } from 'vitest';
import { AVAILABLE_MODELS, getModelConfig, resolveModelId, isModelAvailable } from '../config/modelProviders';

describe('modelProviders registry', () => {
  it('includes groq qwen vision model in available models', () => {
    const model = AVAILABLE_MODELS['groq/qwen/qwen3.8-27b'];
    expect(model).toBeDefined();
    expect(model.provider).toBe('groq');
    expect(model.endpoint).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(model.apiKeyEnvVar).toBe('GROQ_API_KEY');
    expect(model.supportsVision).toBe(true);
  });

  it('resolves the retired groq llama 4 scout id to its live replacement', () => {
    const model = getModelConfig('meta-llama/llama-4-scout-17b-16e-instruct');
    expect(model?.id).toBe('groq/qwen/qwen3.8-27b');
    expect(model?.provider).toBe('groq');
  });

  it('keeps every retired model id resolvable to a live entry', () => {
    const retiredIds = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-flash-lite-preview-06-17',
      'openrouter/google/gemma-3-12b-it:free',
      'openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free'
    ];

    for (const id of retiredIds) {
      expect(getModelConfig(id)).toBeDefined();
      expect(isModelAvailable(id)).toBe(true);
    }
  });

  it('no longer exposes retired models in the registry itself', () => {
    const registryIds = Object.keys(AVAILABLE_MODELS);
    expect(registryIds).not.toContain('gemini-2.0-flash');
    expect(registryIds).not.toContain('gemini-2.0-flash-lite');
    expect(registryIds).not.toContain('groq/meta-llama/llama-4-scout-17b-16e-instruct');
    expect(registryIds).not.toContain('openrouter/google/gemma-3-12b-it:free');
    expect(registryIds).not.toContain('openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free');
  });

  it('resolveModelId passes through current ids unchanged', () => {
    expect(resolveModelId('gemini-2.5-flash-lite')).toBe('gemini-2.5-flash-lite');
    expect(resolveModelId('groq/qwen/qwen3.8-27b')).toBe('groq/qwen/qwen3.8-27b');
  });

  it('gives vision models enough maxTokens for the full receipt schema', () => {
    for (const model of Object.values(AVAILABLE_MODELS)) {
      expect(model.supportsVision).toBe(true);
      expect(model.maxTokens).toBeGreaterThanOrEqual(4096);
    }
  });
});
