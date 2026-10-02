import { describe, expect, it, vi } from 'vitest';
import {
  resolveModelForFileSize,
  getProcessingRecommendation,
  analyzeFile,
} from '../processingOptimizer';
import { getModelConfig, resolveModelId, DEFAULT_MODELS } from '@/config/modelProviders';

const MB = 1024 * 1024;
const GROQ = 'groq/qwen/qwen3.8-27b';

const makeFile = (sizeInBytes: number) =>
  ({ size: sizeInBytes, type: 'image/jpeg' }) as unknown as File;

describe('resolveModelForFileSize', () => {
  it('keeps the primary model when the file fits its cap', () => {
    const result = resolveModelForFileSize(GROQ, 2 * MB);
    expect(result).toEqual({ modelId: GROQ, adjusted: false });
  });

  it('keeps the primary model at exactly its cap (boundary is inclusive)', () => {
    const cap = getModelConfig(GROQ)!.capabilities.maxImageSize;
    expect(resolveModelForFileSize(GROQ, cap)).toEqual({ modelId: GROQ, adjusted: false });
  });

  it('reroutes a file that exceeds the primary cap to a model that fits', () => {
    const result = resolveModelForFileSize(GROQ, 4.5 * MB);
    expect(result.adjusted).toBe(true);
    expect(result.modelId).not.toBe(GROQ);

    // The replacement must genuinely accept this file.
    const cap = getModelConfig(result.modelId)!.capabilities.maxImageSize;
    expect(cap).toBeGreaterThanOrEqual(4.5 * MB);
  });

  it('leaves the model unchanged when a 6MB file exceeds every registered cap', () => {
    // Max cap in the registry is 5MB, so nothing can take 6MB. The guard must
    // degrade gracefully and let the server-side fallback chain act as backstop.
    const result = resolveModelForFileSize(GROQ, 6 * MB);
    expect(result.adjusted).toBe(false);
    expect(result.modelId).toBe(GROQ);
  });

  it('passes through models that are not in the registry', () => {
    const result = resolveModelForFileSize('some/retired-model', 5 * MB);
    expect(result).toEqual({ modelId: 'some/retired-model', adjusted: false });
  });

  it('resolves a legacy model id before applying the cap (round-4 nit)', () => {
    // resolveModelForFileSize must resolve retired IDs before the size check.
    // selectModelForImageSize() does a direct registry lookup, so without this
    // a legacy ID would miss its cap and pass through unadjusted — a behavior
    // regression versus the pre-extraction code, which went through
    // getModelConfig() (resolves aliases).
    // 'gemini-2.0-flash-lite' -> 'gemini-2.5-flash-lite' (5MB cap).
    const legacy = 'gemini-2.0-flash-lite';
    expect(resolveModelId(legacy)).not.toBe(legacy);

    const cap = getModelConfig(resolveModelId(legacy))!.capabilities.maxImageSize;
    const result = resolveModelForFileSize(legacy, 4.5 * MB);

    // With alias resolution the 4.5MB file fits the resolved model's 5MB cap,
    // so no reroute should occur and the resolved ID is returned.
    expect(4.5 * MB).toBeLessThanOrEqual(cap);
    expect(result.adjusted).toBe(false);
    expect(result.modelId).toBe(resolveModelId(legacy));
  });

  it('regression: a 4-5MB receipt with default settings is not sent to Groq', () => {
    // This is the exact gap from PR review: `preferredModel` short-circuits
    // the size branches, so 4-5MB files used to reach Groq and get rejected.
    const guarded = resolveModelForFileSize(DEFAULT_MODELS.vision, 4.5 * MB);
    expect(guarded.modelId).not.toBe(DEFAULT_MODELS.vision);
    expect(getModelConfig(guarded.modelId)!.capabilities.maxImageSize)
      .toBeGreaterThanOrEqual(4.5 * MB);
  });
});

describe('getProcessingRecommendation size routing', () => {
  it('short-circuits on preferredModel even for an oversized file', () => {
    // Documents WHY the guard must live at the selection site: this function
    // alone cannot protect an oversized file once a preference is supplied.
    const rec = getProcessingRecommendation(
      analyzeFile(makeFile(4.5 * MB)),
      { preferredModel: GROQ }
    );
    expect(rec.recommendedModel).toBe(GROQ);

    const guarded = resolveModelForFileSize(rec.recommendedModel, 4.5 * MB);
    expect(guarded.modelId).not.toBe(GROQ);
  });

  it('routes oversized files to a Gemini model when no preference is supplied', () => {
    // A >3MB file is classified 'high' complexity, which routes to
    // gemini-3.1-flash-lite before the >4MB branch is reached. Either way the
    // result must be a Gemini model, since Groq cannot accept >4MB.
    const rec = getProcessingRecommendation(analyzeFile(makeFile(4.5 * MB)));
    expect(rec.recommendedModel.startsWith('gemini-')).toBe(true);
    expect(getModelConfig(rec.recommendedModel)!.capabilities.maxImageSize)
      .toBeGreaterThanOrEqual(4.5 * MB);
  });

  it('defaults to the shared primary when no preference is supplied', () => {
    const rec = getProcessingRecommendation(analyzeFile(makeFile(1 * MB)));
    expect(rec.recommendedModel).toBe(DEFAULT_MODELS.vision);
  });

  it('prioritizeSpeed does not reintroduce the oversized-file bug', () => {
    const rec = getProcessingRecommendation(
      analyzeFile(makeFile(4.5 * MB)),
      { prioritizeSpeed: true }
    );
    const guarded = resolveModelForFileSize(rec.recommendedModel, 4.5 * MB);
    expect(getModelConfig(guarded.modelId)!.capabilities.maxImageSize)
      .toBeGreaterThanOrEqual(4.5 * MB);
  });
});
