/**
 * TypeScript type definitions for unified search functionality
 */

// Core search parameter types
export interface UnifiedSearchParams {
  query: string;
  sources?: string[]; // ['receipts', 'claims', 'team_members', 'custom_categories', 'business_directory', 'conversations']
  contentTypes?: string[]; // ['full_text', 'title', 'description', 'merchant', 'line_items', 'profile', 'keywords']
  limit?: number; // Max results per source
  offset?: number; // Pagination offset
  filters?: SearchFilters;
  similarityThreshold?: number; // Vector similarity threshold
  includeMetadata?: boolean; // Include rich metadata in results
  aggregationMode?: 'relevance' | 'diversity' | 'recency'; // Result ranking strategy
}

export interface SearchFilters {
  dateRange?: { start: string; end: string };
  amountRange?: { min: number; max: number };
  categories?: string[];
  merchants?: string[];
  teamId?: string;
  language?: 'en' | 'ms';
  priority?: 'low' | 'medium' | 'high'; // For claims
  status?: string[]; // For claims and receipts
  claimTypes?: string[]; // For claims
  paymentMethods?: string[]; // For receipts
  businessTypes?: string[]; // For business directory
  sortBy?: 'relevance' | 'date' | 'amount' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
}

// Search result types
export interface UnifiedSearchResult {
  id: string;
  sourceType: 'receipt' | 'claim' | 'team_member' | 'custom_category' | 'business_directory' | 'conversation';
  sourceId: string;
  contentType: string;
  title: string;
  description: string;
  similarity: number;
  metadata: Record<string, any>;
  accessLevel: 'user' | 'team' | 'public';
  createdAt: string;
  updatedAt?: string;
}

export interface UnifiedSearchResponse {
  success: boolean;
  results: UnifiedSearchResult[];
  totalResults: number;
  searchMetadata: SearchMetadata;
  pagination: PaginationInfo;
  error?: string;
}

export interface SearchMetadata {
  queryEmbedding?: number[];
  sourcesSearched: string[];
  searchDuration: number;
  subscriptionLimitsApplied: boolean;
  fallbacksUsed: string[];
  modelUsed?: string;
  embeddingDimensions?: number;
}

export interface PaginationInfo {
  hasMore: boolean;
  nextOffset?: number;
  totalPages: number;
  currentPage?: number;
  pageSize?: number;
}

// Subscription and access control types
export interface SubscriptionLimits {
  maxSearchResults: number;
  allowedSources: string[];
  maxConcurrentSearches: number;
  cachingEnabled: boolean;
  advancedFiltersEnabled: boolean;
  teamSearchEnabled: boolean;
  exportEnabled: boolean;
  searchHistoryEnabled: boolean;
  bulkOperationsEnabled?: boolean;
  apiAccessEnabled?: boolean;
}

export interface SubscriptionCheckResult {
  allowed: boolean;
  reason?: string;
  tier: 'free' | 'pro' | 'max';
  limits: SubscriptionLimits;
  filteredSources?: string[];
  filteredLimit?: number;
}

// Source-specific result types
export interface ReceiptSearchResult extends UnifiedSearchResult {
  sourceType: 'receipt';
  metadata: {
    merchant?: string;
    total?: number;
    currency?: string;
    date?: string;
    status?: string;
    category?: string;
    payment_method?: string;
    tax?: number;
    line_items_count?: number;
  };
}

export interface ClaimSearchResult extends UnifiedSearchResult {
  sourceType: 'claim';
  metadata: {
    title?: string;
    status?: string;
    priority?: string;
    amount?: number;
    currency?: string;
    created_by?: string;
    team_id?: string;
    attachments_count?: number;
  };
}

export interface TeamMemberSearchResult extends UnifiedSearchResult {
  sourceType: 'team_member';
  metadata: {
    role?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    status?: string;
    team_id?: string;
    permissions?: string[];
  };
}

export interface CustomCategorySearchResult extends UnifiedSearchResult {
  sourceType: 'custom_category';
  metadata: {
    name?: string;
    color?: string;
    icon?: string;
    user_id?: string;
    usage_count?: number;
  };
}

export interface BusinessDirectorySearchResult extends UnifiedSearchResult {
  sourceType: 'business_directory';
  metadata: {
    business_name?: string;
    business_name_malay?: string;
    business_type?: string;
    state?: string;
    city?: string;
    address?: string;
    postcode?: string;
    is_active?: boolean;
    keywords?: string[];
  };
}

// Database function parameter types
export interface DatabaseSearchParams {
  query_embedding: number[];
  source_types?: string[];
  content_types?: string[];
  similarity_threshold?: number;
  match_count?: number;
  user_filter?: string;
  team_filter?: string;
  language_filter?: string;
}

// Error handling types
export interface SearchError {
  code: string;
  message: string;
  details?: any;
  source?: string;
  timestamp: string;
}

export interface FallbackResult {
  method: 'text_search' | 'basic_filter' | 'cached_results';
  reason: string;
  resultsCount: number;
  performance: {
    duration: number;
    success: boolean;
  };
}

// Configuration types
export interface SearchTargetConfig {
  id: 'receipts' | 'claims' | 'team_members' | 'custom_categories' | 'business_directory' | 'conversations';
  label: string;
  description: string;
  subscriptionRequired: 'free' | 'pro' | 'max';
  enabled: boolean;
  color: string;
  contentTypes: string[];
  icon?: string;
  weight?: number; // For relevance scoring
}

export interface ModelConfig {
  name: string;
  provider: 'google' | 'openai' | 'anthropic';
  embeddingModel: string;
  dimensions: number;
  maxTokens?: number;
  isDefault?: boolean;
}

// Performance and analytics types
export interface SearchPerformanceMetrics {
  totalDuration: number;
  embeddingGenerationTime: number;
  databaseSearchTime: number;
  resultTransformationTime: number;
  subscriptionCheckTime: number;
  resultsReturned: number;
  sourcesQueried: string[];
  cacheHitRate?: number;
  errorRate?: number;
}

export interface SearchAnalytics {
  searchId: string;
  userId: string;
  query: string;
  sources: string[];
  resultsCount: number;
  clickedResults?: string[];
  searchDuration: number;
  subscriptionTier: string;
  timestamp: string;
  sessionId?: string;
  userAgent?: string;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedParams?: UnifiedSearchParams;
}

// Cache types
export interface CacheKey {
  query: string;
  sources: string[];
  filters: string; // Serialized filters
  userId: string;
  language?: string;
}

export interface CachedSearchResult {
  key: CacheKey;
  results: UnifiedSearchResult[];
  totalResults: number;
  metadata: SearchMetadata;
  cachedAt: string;
  expiresAt: string;
  hitCount: number;
}

// Export utility type for source type checking
export type SourceType = UnifiedSearchResult['sourceType'];
export type ContentType = 'full_text' | 'title' | 'description' | 'merchant' | 'line_items' | 'profile' | 'keywords' | 'address' | 'attachments_text';
export type AggregationMode = 'relevance' | 'diversity' | 'recency';
export type AccessLevel = 'user' | 'team' | 'public';
export type SubscriptionTier = 'free' | 'pro' | 'max';
