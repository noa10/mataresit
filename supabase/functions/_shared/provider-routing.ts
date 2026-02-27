export type ProviderName = 'gemini' | 'openrouter' | 'kilo' | 'opencode';
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
  gemini: [],
  openrouter: [],
  kilo: [
    'kilo/qwen/qwen2.5-vl-72b-instruct',
    'kilo/moonshotai/kimi-k2.5'
  ],
  opencode: [
    'opencode/kimi-k2.5-free',
    'opencode/glm-5-free',
    'opencode/big-pickle'
  ]
};

const CROSS_PROVIDER_IMAGE_FALLBACKS = [
  'gemini-2.5-flash-lite',
  'openrouter/google/gemini-2.0-flash-exp:free'
];

export function resolveKiloGatewayChatEndpoint(endpoint: string): string {
  const normalized = endpoint.replace(/\/+$/, '');
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

export function shouldRetryOpenCodeImageRequest(
  inputType: ModelInputType,
  status: number,
  errorDetails: string
): boolean {
  if (inputType !== 'image') return false;
  if (status === 404) return true;
  if (status >= 500) return true;
  return /prompt_tokens/i.test(errorDetails);
}

export function getOpenCodeRetryEndpoint(endpoint: string): string {
  // OpenCode currently routes chat completions via /zen/v1/chat/completions.
  // Do not rewrite to /api/v1 because that path may resolve to HTML app routes.
  return endpoint;
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
