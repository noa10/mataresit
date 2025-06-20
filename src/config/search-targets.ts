import { SearchTargetConfig, SubscriptionLimits } from '@/types/unified-search';

// Search Target Configurations
export const searchTargets: SearchTargetConfig[] = [
  {
    id: 'receipts',
    label: 'Receipts',
    icon: 'Receipt',
    description: 'Financial receipts and transactions',
    subscriptionRequired: 'free',
    enabled: true,
    color: 'bg-blue-500',
    contentTypes: ['full_text', 'merchant', 'line_items', 'notes']
  },
  {
    id: 'claims',
    label: 'Claims',
    icon: 'FileText',
    description: 'Team expense claims and reimbursements',
    subscriptionRequired: 'pro',
    enabled: true, // Based on team membership
    color: 'bg-green-500',
    contentTypes: ['title', 'description', 'attachments_text']
  },
  {
    id: 'team_members',
    label: 'Team Members',
    icon: 'Users',
    description: 'Team directory and contact information',
    subscriptionRequired: 'max',
    enabled: true, // Based on team membership
    color: 'bg-purple-500',
    contentTypes: ['profile', 'contact']
  },
  {
    id: 'custom_categories',
    label: 'Categories',
    icon: 'Tag',
    description: 'Custom organization categories',
    subscriptionRequired: 'free',
    enabled: true,
    color: 'bg-orange-500',
    contentTypes: ['name', 'description']
  },
  {
    id: 'business_directory',
    label: 'Businesses',
    icon: 'Building',
    description: 'Malaysian business directory',
    subscriptionRequired: 'free',
    enabled: true,
    color: 'bg-teal-500',
    contentTypes: ['business_name', 'keywords', 'address']
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: 'MessageSquare',
    description: 'Chat history and conversations',
    subscriptionRequired: 'pro',
    enabled: false, // Future implementation
    color: 'bg-indigo-500',
    contentTypes: ['message_content']
  }
];

// Subscription Tier Limits
export const subscriptionLimits: Record<string, SubscriptionLimits> = {
  free: {
    tier: 'free',
    allowedSources: ['receipts', 'custom_categories', 'business_directory'],
    maxSearchResults: 20,
    advancedFilters: false,
    teamSearch: false,
    exportResults: false,
    searchHistory: 10
  },
  pro: {
    tier: 'pro',
    allowedSources: ['receipts', 'claims', 'custom_categories', 'business_directory', 'conversations'],
    maxSearchResults: 100,
    advancedFilters: true,
    teamSearch: true,
    exportResults: true,
    searchHistory: 50
  },
  max: {
    tier: 'max',
    allowedSources: ['receipts', 'claims', 'team_members', 'custom_categories', 'business_directory', 'conversations'],
    maxSearchResults: 500,
    advancedFilters: true,
    teamSearch: true,
    exportResults: true,
    searchHistory: 200
  }
};

// Responsive Configurations
export const responsiveConfigs: Record<string, any> = {
  mobile: {
    breakpoint: 'mobile',
    searchInput: { position: 'sticky', layout: 'compact' },
    filters: { display: 'bottom-sheet', defaultOpen: false },
    results: { columns: 1, cardSize: 'compact' },
    sidebar: { visibility: 'hidden', width: '0' }
  },
  tablet: {
    breakpoint: 'tablet',
    searchInput: { position: 'fixed', layout: 'expanded' },
    filters: { display: 'sidebar', defaultOpen: false },
    results: { columns: 2, cardSize: 'normal' },
    sidebar: { visibility: 'collapsible', width: '280px' }
  },
  desktop: {
    breakpoint: 'desktop',
    searchInput: { position: 'static', layout: 'expanded' },
    filters: { display: 'sidebar', defaultOpen: true },
    results: { columns: 3, cardSize: 'normal' },
    sidebar: { visibility: 'persistent', width: '320px' }
  }
};

// Default Search Filters
export const defaultSearchFilters = {
  language: 'en' as const,
  sortBy: 'relevance' as const,
  sortOrder: 'desc' as const,
  aggregationMode: 'relevance' as const
};

// Search Suggestions
export const defaultSearchSuggestions = [
  {
    id: 'recent-receipts',
    text: 'Show me recent receipts',
    type: 'suggested' as const
  },
  {
    id: 'grocery-expenses',
    text: 'Find grocery expenses',
    type: 'suggested' as const
  },
  {
    id: 'team-claims',
    text: 'Show pending team claims',
    type: 'suggested' as const
  },
  {
    id: 'restaurant-receipts',
    text: 'Find restaurant receipts',
    type: 'suggested' as const
  },
  {
    id: 'business-contacts',
    text: 'Search business directory',
    type: 'suggested' as const
  }
];

// Helper Functions
export function getAvailableTargets(subscriptionTier: 'free' | 'pro' | 'max', hasTeamAccess: boolean = false): SearchTargetConfig[] {
  const limits = subscriptionLimits[subscriptionTier];
  
  return searchTargets.filter(target => {
    // Check subscription requirement
    if (!limits.allowedSources.includes(target.id)) {
      return false;
    }
    
    // Check team access for team-specific sources
    if (['claims', 'team_members'].includes(target.id) && !hasTeamAccess) {
      return false;
    }
    
    // Check if target is enabled
    return target.enabled;
  });
}

export function getSubscriptionFeatures(subscriptionTier: 'free' | 'pro' | 'max'): string[] {
  const limits = subscriptionLimits[subscriptionTier];
  const features: string[] = [];
  
  if (limits.advancedFilters) features.push('advanced_filters');
  if (limits.teamSearch) features.push('team_search');
  if (limits.exportResults) features.push('export_results');
  if (limits.maxSearchResults > 50) features.push('bulk_search');
  
  return features;
}

export function validateSearchParams(params: any, subscriptionTier: 'free' | 'pro' | 'max'): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const limits = subscriptionLimits[subscriptionTier];
  
  // Check source access
  if (params.sources) {
    const invalidSources = params.sources.filter((source: string) => !limits.allowedSources.includes(source));
    if (invalidSources.length > 0) {
      errors.push(`Sources not available in ${subscriptionTier} plan: ${invalidSources.join(', ')}`);
    }
  }
  
  // Check result limit
  if (params.limit && params.limit > limits.maxSearchResults) {
    errors.push(`Result limit exceeds ${subscriptionTier} plan maximum of ${limits.maxSearchResults}`);
  }
  
  // Check advanced filters
  if (params.filters && Object.keys(params.filters).length > 2 && !limits.advancedFilters) {
    errors.push(`Advanced filters not available in ${subscriptionTier} plan`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Icon mapping for dynamic icon loading
export const iconMap = {
  Receipt: 'Receipt',
  FileText: 'FileText',
  Users: 'Users',
  Tag: 'Tag',
  Building: 'Building',
  MessageSquare: 'MessageSquare',
  Filter: 'Filter',
  Search: 'Search',
  ChevronDown: 'ChevronDown',
  MoreHorizontal: 'MoreHorizontal',
  Eye: 'Eye',
  Share: 'Share',
  ArrowDown: 'ArrowDown',
  ArrowUp: 'ArrowUp'
};
