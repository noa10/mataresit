import { SupportedLanguage } from '@/lib/i18n';
import { markdownLoader } from './markdownLoader';

export interface DocumentationGuide {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  path: string;
  content?: string;
  lastUpdated: string;
  readingTime: number;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  userType: 'new-user' | 'regular-user' | 'team-admin' | 'power-user' | 'all';
}

export interface DocumentationCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
  guides: DocumentationGuide[];
}

export interface DocumentationStructure {
  categories: DocumentationCategory[];
  quickStart: DocumentationGuide[];
  featured: DocumentationGuide[];
}

class DocumentationService {
  private cache = new Map<string, DocumentationStructure>();
  private contentCache = new Map<string, string>();

  /**
   * Get the complete documentation structure for a language
   */
  async getDocumentationStructure(language: SupportedLanguage = 'en'): Promise<DocumentationStructure> {
    const cacheKey = `structure-${language}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const structure = await this.loadDocumentationStructure(language);
    this.cache.set(cacheKey, structure);
    
    return structure;
  }

  /**
   * Get a specific guide by ID
   */
  async getGuide(guideId: string, language: SupportedLanguage = 'en'): Promise<DocumentationGuide | null> {
    const structure = await this.getDocumentationStructure(language);
    
    for (const category of structure.categories) {
      const guide = category.guides.find(g => g.id === guideId);
      if (guide) {
        // Load content if not already loaded
        if (!guide.content) {
          guide.content = await this.loadGuideContent(guide.path);
        }
        return guide;
      }
    }
    
    return null;
  }

  /**
   * Search guides by query
   */
  async searchGuides(query: string, language: SupportedLanguage = 'en'): Promise<DocumentationGuide[]> {
    const structure = await this.getDocumentationStructure(language);
    const allGuides = structure.categories.flatMap(cat => cat.guides);
    
    const searchTerms = query.toLowerCase().split(' ');
    
    return allGuides.filter(guide => {
      const searchableText = `${guide.title} ${guide.description} ${guide.tags.join(' ')}`.toLowerCase();
      return searchTerms.some(term => searchableText.includes(term));
    }).sort((a, b) => {
      // Sort by relevance (simple scoring based on title matches)
      const aScore = searchTerms.reduce((score, term) => 
        score + (a.title.toLowerCase().includes(term) ? 2 : 0) +
        (a.description.toLowerCase().includes(term) ? 1 : 0), 0);
      const bScore = searchTerms.reduce((score, term) => 
        score + (b.title.toLowerCase().includes(term) ? 2 : 0) +
        (b.description.toLowerCase().includes(term) ? 1 : 0), 0);
      return bScore - aScore;
    });
  }

  /**
   * Get guides by category
   */
  async getGuidesByCategory(categoryId: string, language: SupportedLanguage = 'en'): Promise<DocumentationGuide[]> {
    const structure = await this.getDocumentationStructure(language);
    const category = structure.categories.find(cat => cat.id === categoryId);
    return category?.guides || [];
  }

  /**
   * Get guides by user type
   */
  async getGuidesByUserType(userType: DocumentationGuide['userType'], language: SupportedLanguage = 'en'): Promise<DocumentationGuide[]> {
    const structure = await this.getDocumentationStructure(language);
    const allGuides = structure.categories.flatMap(cat => cat.guides);
    
    return allGuides.filter(guide => guide.userType === userType || guide.userType === 'all');
  }

  /**
   * Load the documentation structure from our organized guides
   */
  private async loadDocumentationStructure(language: SupportedLanguage): Promise<DocumentationStructure> {
    // This would ideally load from a configuration file or API
    // For now, we'll define the structure based on our organized guides
    
    const categories: DocumentationCategory[] = [
      {
        id: 'getting-started',
        title: 'Getting Started',
        description: 'Essential guides for new users to set up and start using Mataresit effectively.',
        icon: 'Rocket',
        color: 'text-green-600',
        priority: 1,
        guides: [
          {
            id: 'quick-start-5min',
            title: '5-Minute Quick Start',
            description: 'Get started with Mataresit in just 5 minutes',
            category: 'getting-started',
            path: `/docs/user-guides/${language}/onboarding/quick-start-5min.md`,
            lastUpdated: '2025-08-02',
            readingTime: 5,
            tags: ['quick-start', 'onboarding', 'beginner'],
            difficulty: 'beginner',
            userType: 'new-user'
          },
          {
            id: 'new-user-guide',
            title: 'New User Onboarding',
            description: 'Complete setup walkthrough for first-time users',
            category: 'getting-started',
            path: `/docs/user-guides/${language}/onboarding/new-user-guide.md`,
            lastUpdated: '2025-08-02',
            readingTime: 15,
            tags: ['onboarding', 'setup', 'beginner'],
            difficulty: 'beginner',
            userType: 'new-user'
          },
          {
            id: 'account-setup',
            title: 'Account Setup & Verification',
            description: 'Account creation, verification, and configuration',
            category: 'getting-started',
            path: `/docs/user-guides/${language}/onboarding/account-setup.md`,
            lastUpdated: '2025-08-02',
            readingTime: 10,
            tags: ['account', 'setup', 'verification'],
            difficulty: 'beginner',
            userType: 'new-user'
          },
          {
            id: 'dashboard-navigation',
            title: 'Dashboard Navigation',
            description: 'Learn to navigate the Mataresit interface',
            category: 'getting-started',
            path: `/docs/user-guides/${language}/onboarding/dashboard-navigation.md`,
            lastUpdated: '2025-08-02',
            readingTime: 8,
            tags: ['navigation', 'interface', 'dashboard'],
            difficulty: 'beginner',
            userType: 'new-user'
          }
        ]
      },
      {
        id: 'core-features',
        title: 'Core Features',
        description: 'Master the essential receipt management and processing capabilities.',
        icon: 'Wrench',
        color: 'text-blue-600',
        priority: 2,
        guides: [
          {
            id: 'ai-vision-processing',
            title: 'AI Vision Processing',
            description: 'Smart receipt processing with advanced AI technology',
            category: 'core-features',
            path: `/docs/user-guides/${language}/core-features/ai-vision-processing.md`,
            lastUpdated: '2025-08-02',
            readingTime: 12,
            tags: ['ai', 'processing', 'vision', 'smart'],
            difficulty: 'intermediate',
            userType: 'regular-user'
          },
          {
            id: 'batch-processing',
            title: 'Batch Processing',
            description: 'Upload and process multiple receipts efficiently',
            category: 'core-features',
            path: `/docs/user-guides/${language}/core-features/batch-processing.md`,
            lastUpdated: '2025-08-02',
            readingTime: 10,
            tags: ['batch', 'upload', 'multiple', 'efficiency'],
            difficulty: 'intermediate',
            userType: 'regular-user'
          },
          {
            id: 'semantic-search',
            title: 'Semantic Search',
            description: 'Advanced search capabilities with natural language',
            category: 'core-features',
            path: `/docs/user-guides/${language}/core-features/semantic-search.md`,
            lastUpdated: '2025-08-02',
            readingTime: 8,
            tags: ['search', 'semantic', 'natural-language', 'ai'],
            difficulty: 'intermediate',
            userType: 'regular-user'
          },
          {
            id: 'export-reporting',
            title: 'Export & Reporting',
            description: 'Generate reports and export data in multiple formats',
            category: 'core-features',
            path: `/docs/user-guides/${language}/core-features/export-reporting.md`,
            lastUpdated: '2025-08-02',
            readingTime: 15,
            tags: ['export', 'reporting', 'analytics', 'data'],
            difficulty: 'intermediate',
            userType: 'regular-user'
          },
          {
            id: 'platform-features',
            title: 'Platform Features',
            description: 'Cross-platform capabilities and advanced features',
            category: 'core-features',
            path: `/docs/user-guides/${language}/core-features/platform-features.md`,
            lastUpdated: '2025-08-02',
            readingTime: 12,
            tags: ['platform', 'pwa', 'mobile', 'features'],
            difficulty: 'advanced',
            userType: 'power-user'
          }
        ]
      },
      {
        id: 'ai-intelligence',
        title: 'AI & Intelligence',
        description: 'Leverage advanced AI features and Malaysian business intelligence.',
        icon: 'Brain',
        color: 'text-purple-600',
        priority: 3,
        guides: [
          {
            id: 'advanced-analytics',
            title: 'Advanced Analytics',
            description: 'Business intelligence and comprehensive analytics',
            category: 'ai-intelligence',
            path: `/docs/user-guides/${language}/ai-intelligence/advanced-analytics.md`,
            lastUpdated: '2025-08-02',
            readingTime: 18,
            tags: ['analytics', 'business-intelligence', 'insights', 'advanced'],
            difficulty: 'advanced',
            userType: 'power-user'
          },
          {
            id: 'malaysian-business-intelligence',
            title: 'Malaysian Business Intelligence',
            description: 'Local business intelligence and cultural adaptations',
            category: 'ai-intelligence',
            path: `/docs/user-guides/${language}/ai-intelligence/malaysian-business-intelligence.md`,
            lastUpdated: '2025-08-02',
            readingTime: 15,
            tags: ['malaysia', 'local', 'business', 'intelligence', 'cultural'],
            difficulty: 'intermediate',
            userType: 'regular-user'
          },
          {
            id: 'personalization-features',
            title: 'Personalization Features',
            description: 'Customize your Mataresit experience',
            category: 'ai-intelligence',
            path: `/docs/user-guides/${language}/ai-intelligence/personalization-features.md`,
            lastUpdated: '2025-08-02',
            readingTime: 10,
            tags: ['personalization', 'customization', 'preferences', 'ai'],
            difficulty: 'intermediate',
            userType: 'regular-user'
          },
          {
            id: 'real-time-notifications',
            title: 'Real-time Notifications',
            description: 'Smart alerts and notification system',
            category: 'ai-intelligence',
            path: `/docs/user-guides/${language}/ai-intelligence/real-time-notifications.md`,
            lastUpdated: '2025-08-02',
            readingTime: 8,
            tags: ['notifications', 'alerts', 'real-time', 'smart'],
            difficulty: 'intermediate',
            userType: 'regular-user'
          }
        ]
      },
      {
        id: 'team-collaboration',
        title: 'Team Collaboration',
        description: 'Set up and manage multi-user environments and collaborative workflows.',
        icon: 'Users',
        color: 'text-orange-600',
        priority: 4,
        guides: [
          {
            id: 'team-setup',
            title: 'Team Setup',
            description: 'Create and configure team workspaces',
            category: 'team-collaboration',
            path: `/docs/user-guides/${language}/team-collaboration/team-setup.md`,
            lastUpdated: '2025-08-02',
            readingTime: 20,
            tags: ['team', 'setup', 'collaboration', 'workspace'],
            difficulty: 'intermediate',
            userType: 'team-admin'
          },
          {
            id: 'role-permissions',
            title: 'Role & Permissions',
            description: 'Manage access control and user permissions',
            category: 'team-collaboration',
            path: `/docs/user-guides/${language}/team-collaboration/role-permissions.md`,
            lastUpdated: '2025-08-02',
            readingTime: 15,
            tags: ['roles', 'permissions', 'access-control', 'security'],
            difficulty: 'advanced',
            userType: 'team-admin'
          },
          {
            id: 'claims-management',
            title: 'Claims Management',
            description: 'Expense workflow and approval management',
            category: 'team-collaboration',
            path: `/docs/user-guides/${language}/team-collaboration/claims-management.md`,
            lastUpdated: '2025-08-02',
            readingTime: 18,
            tags: ['claims', 'expenses', 'workflow', 'approval'],
            difficulty: 'intermediate',
            userType: 'team-admin'
          },
          {
            id: 'team-analytics',
            title: 'Team Analytics',
            description: 'Team performance insights and metrics',
            category: 'team-collaboration',
            path: `/docs/user-guides/${language}/team-collaboration/team-analytics.md`,
            lastUpdated: '2025-08-02',
            readingTime: 12,
            tags: ['analytics', 'team', 'performance', 'metrics'],
            difficulty: 'advanced',
            userType: 'team-admin'
          }
        ]
      }
    ];

    // Define quick start guides
    const quickStart = [
      categories[0].guides[0], // 5-minute quick start
      categories[1].guides[0], // AI Vision Processing
      categories[3].guides[0], // Team Setup
      categories[2].guides[0]  // Advanced Analytics
    ];

    // Define featured guides
    const featured = [
      categories[0].guides[1], // New User Guide
      categories[1].guides[1], // Batch Processing
      categories[2].guides[1], // Malaysian Business Intelligence
      categories[3].guides[2]  // Claims Management
    ];

    return {
      categories,
      quickStart,
      featured
    };
  }

  /**
   * Load guide content from markdown file
   */
  private async loadGuideContent(path: string): Promise<string> {
    if (this.contentCache.has(path)) {
      return this.contentCache.get(path)!;
    }

    try {
      const markdownContent = await markdownLoader.loadMarkdown(path);
      this.contentCache.set(path, markdownContent.content);
      return markdownContent.content;
    } catch (error) {
      console.error(`Failed to load guide content from ${path}:`, error);
      return `# Guide Not Found\n\nThe requested guide could not be loaded. Please check the path: ${path}`;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.contentCache.clear();
  }
}

export const documentationService = new DocumentationService();
