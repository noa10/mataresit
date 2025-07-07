// Unified Search Types and Interfaces for Phase 3 Implementation

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
  dateRange?: {
    start: string;
    end: string;
    preset?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  };
  amountRange?: {
    min: number;
    max: number;
    currency: string;
  };
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
  aggregationMode?: 'relevance' | 'diversity' | 'recency';
}

export interface UnifiedSearchResponse {
  success: boolean;
  results: UnifiedSearchResult[];
  totalResults: number;
  searchMetadata: {
    queryEmbedding?: number[];
    sourcesSearched: string[];
    searchDuration: number;
    subscriptionLimitsApplied: boolean;
    fallbacksUsed: string[];
    modelUsed?: string;
    embeddingDimensions?: number;
  };
  pagination: {
    hasMore: boolean;
    nextOffset?: number;
    totalPages: number;
  };
  error?: string;
  // Enhanced response fields from Edge Function
  content?: string;
  uiComponents?: any[];
  followUpSuggestions?: string[];
  confidence?: number;
  responseType?: 'success' | 'partial' | 'empty' | 'error';
  // Enhanced response structure for advanced search features
  enhancedResponse?: {
    content: string;
    uiComponents: any[];
    followUpSuggestions: string[];
    confidence: number;
    responseType: 'success' | 'partial' | 'empty' | 'error';
  };
}

export interface UnifiedSearchResult {
  id: string;
  sourceType: 'receipt' | 'claim' | 'team_member' | 'custom_category' | 'business_directory' | 'conversation';
  sourceId: string;
  contentType: string;
  title: string;
  description: string;
  similarity: number;
  metadata: {
    // Source-specific metadata
    [key: string]: any;
  };
  accessLevel: 'user' | 'team' | 'public';
  createdAt: string;
  updatedAt?: string;
}

export interface SearchTargetConfig {
  id: 'receipts' | 'claims' | 'team_members' | 'custom_categories' | 'business_directory' | 'conversations';
  label: string;
  icon: string; // Icon name for Lucide React
  description: string;
  subscriptionRequired: 'free' | 'pro' | 'max';
  enabled: boolean;
  color: string;
  contentTypes: string[];
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'suggested';
  metadata?: {
    resultCount?: number;
    lastUsed?: string;
  };
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  filters: SearchFilters;
  targets: string[];
  timestamp: Date;
  resultCount: number;
}

export interface SearchContext {
  currentQuery: string;
  activeFilters: SearchFilters;
  selectedTargets: string[];
  searchHistory: SearchHistoryItem[];
  conversationContext: Record<string, any>;
}

// Component Props Interfaces
export interface UnifiedSearchInputProps {
  onSearch: (params: UnifiedSearchParams) => Promise<void>;
  searchTargets: SearchTargetConfig[];
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  isLoading: boolean;
  placeholder?: string;
  showAdvancedFilters?: boolean;
  suggestions?: SearchSuggestion[];
  className?: string;
}

export interface SearchTargetSelectorProps {
  targets: SearchTargetConfig[];
  selectedTargets: string[];
  onSelectionChange: (targets: string[]) => void;
  subscriptionTier: 'free' | 'pro' | 'max';
  disabled?: boolean;
  layout: 'horizontal' | 'vertical' | 'grid';
  className?: string;
}

export interface AdvancedFilterPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  availableCategories: Array<{ id: string; name: string; color?: string }>;
  availableTeams: Array<{ id: string; name: string }>;
  isOpen: boolean;
  onToggle: () => void;
  subscriptionFeatures: string[];
  className?: string;
}

export interface UnifiedSearchResultsProps {
  results: UnifiedSearchResult[];
  groupBy: 'source' | 'relevance' | 'date';
  onResultAction: (action: string, result: UnifiedSearchResult) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  searchQuery: string;
  totalResults: number;
  className?: string;
}

export interface ResultCardProps {
  result: UnifiedSearchResult;
  onAction: (action: string, result: UnifiedSearchResult) => void;
  compact?: boolean;
  className?: string;
}

// Responsive Configuration
export interface ResponsiveConfig {
  breakpoint: 'mobile' | 'tablet' | 'desktop';
  searchInput: {
    position: 'sticky' | 'fixed' | 'static';
    layout: 'compact' | 'expanded';
  };
  filters: {
    display: 'bottom-sheet' | 'sidebar' | 'inline';
    defaultOpen: boolean;
  };
  results: {
    columns: number;
    cardSize: 'compact' | 'normal' | 'expanded';
  };
  sidebar: {
    visibility: 'hidden' | 'collapsible' | 'persistent';
    width: string;
  };
}

// Subscription Tier Limits
export interface SubscriptionLimits {
  tier: 'free' | 'pro' | 'max';
  allowedSources: string[];
  maxSearchResults: number;
  advancedFilters: boolean;
  teamSearch: boolean;
  exportResults: boolean;
  searchHistory: number; // Number of searches to keep in history
}

// Error Types
export interface SearchError {
  code: string;
  message: string;
  source?: string;
  retryable: boolean;
  fallbackAvailable: boolean;
}
