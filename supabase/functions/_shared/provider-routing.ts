export type ProviderName = 'gemini' | 'openrouter' | 'groq';
export type ModelInputType = 'text' | 'image';

export interface ProviderRequestErrorOptions {
  provider: ProviderName;
  modelId: string;
  status: number;
  statusText: string;
  errorBodySnippet: string;
  endpoint: string;
}

export class ProviderRequestError extends Error {
  provider: ProviderName;
  modelId: string;
  status: number;
  statusText: string;
  errorBodySnippet: string;
  endpoint: string;

  constructor(options: ProviderRequestErrorOptions) {
    super(
      `[${options.provider}] ${options.modelId} request failed: ${options.status} ${options.statusText}`
    );
    this.name = 'ProviderRequestError';
    this.provider = options.provider;
    this.modelId = options.modelId;
    this.status = options.status;
    this.statusText = options.statusText;
    this.errorBodySnippet = options.errorBodySnippet;
    this.endpoint = options.endpoint;
  }
}

export interface FallbackSelectableModel {
  id: string;
  provider: ProviderName;
  apiKeyEnvVar: string;
  supportsVision: boolean;
}

export interface FallbackSelectionOptions {
  requestedModelId: string;
  requestedProvider: ProviderName;
  attemptedModelIds: Set<string>;
  models: Record<string, FallbackSelectableModel>;
  hasApiKey: (apiKeyEnvVar: string) => boolean;
}

// Candidate order matters: each entry is tried in turn until one succeeds.
// Groq (qwen3.8-27b) is the primary; it is repeated here so it is still
// reachable when the request starts on another provider (Gemini/OpenRouter).
// The Gemini models follow as the accuracy/reliability fallback tier, and
// OpenRouter last as the cross-provider safety net.
// All IDs below were verified live against their provider.
const SAME_PROVIDER_FALLBACKS: Record<ProviderName, string[]> = {
  gemini: [
    'gemini-3.1-flash-lite'
  ],
  openrouter: [],
  groq: []
};

const CROSS_PROVIDER_IMAGE_FALLBACKS = [
  'groq/qwen/qwen3.8-27b',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'openrouter/google/gemma-4-26b-a4b-it'
];

export interface SizeCapSelectableModel {
  id: string;
  supportsVision: boolean;
  capabilities: {
    maxImageSize: number;
  };
}

export interface SizeCapSelectionOptions {
  modelId: string;
  fileSizeInBytes: number;
  models: Record<string, SizeCapSelectableModel>;
}

/**
 * Pick the highest-capacity vision model that can accept `fileSizeInBytes`.
 *
 * Models declare `capabilities.maxImageSize`, but nothing enforced it until
 * this helper existed — it was only logged. An image over the chosen model's
 * cap is rejected by the provider and rescued only by the fallback chain, so
 * every oversized file cost one guaranteed failed round-trip.
 *
 * This is the single implementation of the rule. Both call sites use it:
 *   - client: resolveModelForFileSize() in src/utils/processingOptimizer.ts
 *     (upload path, where the File is in hand)
 *   - server: SIZE PRE-ROUTE in supabase/functions/enhance-receipt-data/index.ts
 *     (reprocess paths, where the stored size is only known server-side)
 *
 * Returns the original model when it fits or when nothing in the registry can
 * accept the file — in that case the caller proceeds and lets the fallback
 * chain surface the failure, rather than failing at a less informative point.
 */
export function selectModelForImageSize(options: SizeCapSelectionOptions): {
  modelId: string;
  adjusted: boolean;
} {
  const { modelId, fileSizeInBytes, models } = options;
  const cap = models[modelId]?.capabilities.maxImageSize;

  if (!cap || fileSizeInBytes <= cap) {
    return { modelId, adjusted: false };
  }

  const replacement = Object.values(models)
    .filter((m) => m.supportsVision && m.capabilities.maxImageSize >= fileSizeInBytes)
    .sort((a, b) => b.capabilities.maxImageSize - a.capabilities.maxImageSize)[0];

  if (!replacement) {
    return { modelId, adjusted: false };
  }

  return { modelId: replacement.id, adjusted: true };
}

export function selectImageFallbackCandidates(options: FallbackSelectionOptions): string[] {
  const providerCandidates = SAME_PROVIDER_FALLBACKS[options.requestedProvider] || [];
  const ordered = [...providerCandidates, ...CROSS_PROVIDER_IMAGE_FALLBACKS];
  const unique = Array.from(new Set(ordered));

  return unique.filter((candidateId) => {
    if (candidateId === options.requestedModelId) return false;
    if (options.attemptedModelIds.has(candidateId)) return false;

    const model = options.models[candidateId];
    if (!model) return false;
    if (!model.supportsVision) return false;
    if (!options.hasApiKey(model.apiKeyEnvVar)) return false;

    return true;
  });
}

export interface ExecuteWithFallbackResult<T> {
  result: T;
  modelUsed: string;
  fallbackApplied: boolean;
  fallbackFrom: string | null;
  fallbackReason: string | null;
  attemptedModels: string[];
}

export interface ExecuteWithFallbackOptions<T> {
  primaryModelId: string;
  fallbackModelIds: string[];
  attempt: (modelId: string) => Promise<T>;
  onFallbackAttempt?: (modelId: string, reason: string, attemptNumber: number) => Promise<void> | void;
  onFallbackFailure?: (modelId: string, error: unknown, attemptNumber: number) => Promise<void> | void;
}

export async function executeWithFallback<T>(
  options: ExecuteWithFallbackOptions<T>
): Promise<ExecuteWithFallbackResult<T>> {
  const attemptedModels = new Set<string>();

  const tryModel = async (modelId: string) => {
    attemptedModels.add(modelId);
    return options.attempt(modelId);
  };

  try {
    const primaryResult = await tryModel(options.primaryModelId);
    return {
      result: primaryResult,
      modelUsed: options.primaryModelId,
      fallbackApplied: false,
      fallbackFrom: null,
      fallbackReason: null,
      attemptedModels: Array.from(attemptedModels)
    };
  } catch (primaryError) {
    let lastError: unknown = primaryError;
    const fallbackReason =
      primaryError instanceof Error ? primaryError.message : String(primaryError);

    let fallbackAttemptNumber = 0;
    for (const fallbackModelId of options.fallbackModelIds) {
      if (attemptedModels.has(fallbackModelId)) continue;
      fallbackAttemptNumber += 1;
      try {
        await options.onFallbackAttempt?.(fallbackModelId, fallbackReason, fallbackAttemptNumber);
        const fallbackResult = await tryModel(fallbackModelId);
        return {
          result: fallbackResult,
          modelUsed: fallbackModelId,
          fallbackApplied: true,
          fallbackFrom: options.primaryModelId,
          fallbackReason,
          attemptedModels: Array.from(attemptedModels)
        };
      } catch (fallbackError) {
        await options.onFallbackFailure?.(fallbackModelId, fallbackError, fallbackAttemptNumber);
        lastError = fallbackError;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
