import { describe, expect, it } from 'vitest';
import { AVAILABLE_MODELS, getModelConfig } from '../config/modelProviders';

describe('modelProviders registry', () => {
  it('includes groq llama 4 scout model in available models', () => {
    const model = AVAILABLE_MODELS['groq/meta-llama/llama-4-scout-17b-16e-instruct'];
    expect(model).toBeDefined();
    expect(model.provider).toBe('groq');
    expect(model.endpoint).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(model.apiKeyEnvVar).toBe('GROQ_API_KEY');
    expect(model.supportsVision).toBe(true);
  });

  it('resolves raw groq model id via alias mapping', () => {
    const model = getModelConfig('meta-llama/llama-4-scout-17b-16e-instruct');
    expect(model?.id).toBe('groq/meta-llama/llama-4-scout-17b-16e-instruct');
    expect(model?.provider).toBe('groq');
  });
});
