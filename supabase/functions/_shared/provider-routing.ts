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

const SAME_PROVIDER_FALLBACKS: Record<ProviderName, string[]> = {
  gemini: [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite'
  ],
  openrouter: [
    'openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free',
    'openrouter/google/gemma-3-12b-it:free',
    'openrouter/google/gemma-4-26b-a4b-it:free'
  ],
  groq: []
};

const CROSS_PROVIDER_IMAGE_FALLBACKS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'groq/meta-llama/llama-4-scout-17b-16e-instruct',
  'openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free',
  'openrouter/google/gemma-3-12b-it:free',
  'openrouter/google/gemma-4-26b-a4b-it:free'
];

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
