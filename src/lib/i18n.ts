import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Import translation files directly for better bundling
import enCommon from '@/locales/en/common.json';
import enNavigation from '@/locales/en/navigation.json';
import enDashboard from '@/locales/en/dashboard.json';
import enReceipts from '@/locales/en/receipts.json';
import enAuth from '@/locales/en/auth.json';
import enSettings from '@/locales/en/settings.json';
import enAdmin from '@/locales/en/admin.json';
import enErrors from '@/locales/en/errors.json';
import enForms from '@/locales/en/forms.json';
import enAi from '@/locales/en/ai.json';
import enCategories from '@/locales/en/categories.json';
import enHomepage from '@/locales/en/homepage.json';
import enProfile from '@/locales/en/profile.json';
import enPricing from '@/locales/en/pricing.json';
import enFeatures from '@/locales/en/features.json';
import enTeam from '@/locales/en/team.json';
import enClaims from '@/locales/en/claims.json';
import enChat from '@/locales/en/chat.json';
import enDocumentation from '@/locales/en/documentation.json';

import msCommon from '@/locales/ms/common.json';
import msNavigation from '@/locales/ms/navigation.json';
import msDashboard from '@/locales/ms/dashboard.json';
import msReceipts from '@/locales/ms/receipts.json';
import msAuth from '@/locales/ms/auth.json';
import msSettings from '@/locales/ms/settings.json';
import msAdmin from '@/locales/ms/admin.json';
import msErrors from '@/locales/ms/errors.json';
import msForms from '@/locales/ms/forms.json';
import msAi from '@/locales/ms/ai.json';
import msCategories from '@/locales/ms/categories.json';
import msHomepage from '@/locales/ms/homepage.json';
import msProfile from '@/locales/ms/profile.json';
import msPricing from '@/locales/ms/pricing.json';
import msFeatures from '@/locales/ms/features.json';
import msTeam from '@/locales/ms/team.json';
import msClaims from '@/locales/ms/claims.json';
import msChat from '@/locales/ms/chat.json';
import msDocumentation from '@/locales/ms/documentation.json';

// Define supported languages
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  ms: 'Bahasa Malaysia'
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Define namespaces
export const NAMESPACES = [
  'common',
  'navigation',
  'dashboard',
  'receipts',
  'auth',
  'settings',
  'admin',
  'errors',
  'forms',
  'ai',
  'categories',
  'homepage',
  'profile',
  'pricing',
  'features',
  'team',
  'claims',
  'chat',
  'documentation'
] as const;

export type Namespace = typeof NAMESPACES[number];

// Translation resources
const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    dashboard: enDashboard,
    receipts: enReceipts,
    auth: enAuth,
    settings: enSettings,
    admin: enAdmin,
    errors: enErrors,
    forms: enForms,
    ai: enAi,
    categories: enCategories,
    homepage: enHomepage,
    profile: enProfile,
    pricing: enPricing,
    features: enFeatures,
    team: enTeam,
    claims: enClaims,
    chat: enChat,
    documentation: enDocumentation,
  },
  ms: {
    common: msCommon,
    navigation: msNavigation,
    dashboard: msDashboard,
    receipts: msReceipts,
    auth: msAuth,
    settings: msSettings,
    admin: msAdmin,
    errors: msErrors,
    forms: msForms,
    ai: msAi,
    categories: msCategories,
    homepage: msHomepage,
    profile: msProfile,
    pricing: msPricing,
    features: msFeatures,
    team: msTeam,
    claims: msClaims,
    chat: msChat,
    documentation: msDocumentation,
  }
};

// Language detection configuration
const detectionOptions = {
  // Order of language detection
  order: [
    'localStorage',      // Check localStorage first (user preference)
    'navigator',         // Browser language
    'htmlTag',          // HTML lang attribute
    'path',             // URL path
    'subdomain'         // Subdomain
  ],
  
  // Cache user language preference
  caches: ['localStorage'],
  
  // localStorage key
  lookupLocalStorage: 'mataresit_language',
  
  // Don't detect from query string or cookie for security
  excludeCacheFor: ['cimode'],
  
  // Check only supported languages
  checkWhitelist: true
};

// Advanced pluralization rules for Malay language
const malayPluralizationRule = (count: number): number => {
  // Malay doesn't have complex pluralization like English
  // Generally uses the same form for singular and plural
  // But we can distinguish between 0, 1, and many for better UX
  if (count === 0) return 0; // zero form
  if (count === 1) return 1; // singular form
  return 2; // plural form (same as singular in Malay, but allows for different phrasing)
};

// Context-aware translation function
export const getContextualTranslation = (
  key: string,
  context: 'admin' | 'user' | 'guest' | 'team_member' = 'user',
  options?: any
) => {
  const contextKey = `${key}_${context}`;
  const translation = i18n.t(contextKey, { ...options, defaultValue: null });

  // Fallback to base key if context-specific translation doesn't exist
  return translation || i18n.t(key, options);
};

// Enhanced interpolation with Malaysian cultural formatting
const enhancedInterpolation = {
  escapeValue: false, // React already escapes values
  formatSeparator: ',',
  format: (value: any, format: string, lng: string, options?: any) => {
    const language = lng as SupportedLanguage;

    // Currency formatting
    if (format === 'currency') {
      if (language === 'ms') {
        const amount = typeof value === 'number' ? value : parseFloat(value);
        return `RM ${amount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return `$${value}`;
    }

    // Date formatting
    if (format === 'date') {
      const date = new Date(value);
      if (language === 'ms') {
        return date.toLocaleDateString('ms-MY', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      return date.toLocaleDateString('en-US');
    }

    // Time formatting
    if (format === 'time') {
      const date = new Date(value);
      if (language === 'ms') {
        return date.toLocaleTimeString('ms-MY', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
      return date.toLocaleTimeString('en-US');
    }

    // Number formatting
    if (format === 'number') {
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (language === 'ms') {
        return num.toLocaleString('ms-MY');
      }
      return num.toLocaleString('en-US');
    }

    // Percentage formatting
    if (format === 'percentage') {
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (language === 'ms') {
        return `${num.toLocaleString('ms-MY')}%`;
      }
      return `${num}%`;
    }

    // Text case formatting
    if (format === 'uppercase') return value.toUpperCase();
    if (format === 'lowercase') return value.toLowerCase();
    if (format === 'capitalize') {
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    }

    return value;
  }
};

// Initialize i18next with advanced features
i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Language settings
    lng: 'en', // Default language
    fallbackLng: 'en', // Fallback language
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES), // Updated from whitelist

    // Namespace settings
    defaultNS: 'common',
    ns: NAMESPACES,

    // Detection settings
    detection: detectionOptions,

    // Resources
    resources,

    // Enhanced interpolation settings
    interpolation: enhancedInterpolation,

    // React settings
    react: {
      useSuspense: false, // Disable suspense for SSR compatibility
      bindI18n: 'languageChanged',
      bindI18nStore: '',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span', 'p', 'div']
    },

    // Development settings
    debug: process.env.NODE_ENV === 'development',

    // Backend settings (for dynamic loading if needed)
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      addPath: '/locales/{{lng}}/{{ns}}.json',
      allowMultiLoading: false,
      crossDomain: false
    },

    // Enhanced missing key handling
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lng, ns, key, fallbackValue) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`🔍 Missing translation key: ${ns}:${key} for language: ${lng}`);

        // Store missing keys for development analysis
        const missingKeys = JSON.parse(localStorage.getItem('mataresit_missing_keys') || '[]');
        const missingKey = { lng, ns, key, fallbackValue, timestamp: new Date().toISOString() };

        if (!missingKeys.find((mk: any) => mk.lng === lng && mk.ns === ns && mk.key === key)) {
          missingKeys.push(missingKey);
          localStorage.setItem('mataresit_missing_keys', JSON.stringify(missingKeys));
        }
      }
    },

    // Pluralization settings
    pluralSeparator: '_',
    contextSeparator: '_',

    // Performance optimizations
    load: 'languageOnly', // Load only language, not region variants
    preload: ['en'], // Preload default language
    cleanCode: true, // Clean language codes

    // Key separators
    keySeparator: '.',
    nsSeparator: ':',

    // Fallback settings
    fallbackOnNull: true,
    fallbackOnEmpty: true,

    // Caching
    updateMissing: false,

    // Custom pluralization rules
    pluralResolver: {
      addRule: (lng: string, obj: any) => {
        if (lng === 'ms') {
          obj.numbers = [0, 1, 2];
          obj.plurals = malayPluralizationRule;
        }
      }
    }
  });

// Helper function to change language
export const changeLanguage = async (language: SupportedLanguage) => {
  try {
    await i18n.changeLanguage(language);
    
    // Update localStorage
    localStorage.setItem('mataresit_language', language);
    
    // Update HTML lang attribute
    document.documentElement.lang = language;
    
    // Update document direction for RTL languages (if needed in future)
    document.documentElement.dir = 'ltr'; // Both English and Malay are LTR
    
    return true;
  } catch (error) {
    console.error('Failed to change language:', error);
    return false;
  }
};

// Helper function to get current language
export const getCurrentLanguage = (): SupportedLanguage => {
  return i18n.language as SupportedLanguage || 'en';
};

// Helper function to check if language is supported
export const isLanguageSupported = (language: string): language is SupportedLanguage => {
  return Object.keys(SUPPORTED_LANGUAGES).includes(language);
};

// Helper function to get language display name
export const getLanguageDisplayName = (language: SupportedLanguage): string => {
  return SUPPORTED_LANGUAGES[language];
};

// Advanced translation utilities
export const translationUtils = {
  // Get missing translation keys for development
  getMissingKeys: (): Array<{lng: string, ns: string, key: string, fallbackValue: string, timestamp: string}> => {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('mataresit_missing_keys') || '[]');
  },

  // Clear missing keys cache
  clearMissingKeys: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mataresit_missing_keys');
    }
  },

  // Export missing keys for translation team
  exportMissingKeys: (): string => {
    const missingKeys = translationUtils.getMissingKeys();
    const grouped = missingKeys.reduce((acc, key) => {
      const nsKey = `${key.lng}:${key.ns}`;
      if (!acc[nsKey]) acc[nsKey] = [];
      acc[nsKey].push(key);
      return acc;
    }, {} as Record<string, any[]>);

    return JSON.stringify(grouped, null, 2);
  },

  // Check if translation exists
  hasTranslation: (key: string, namespace?: string): boolean => {
    return i18n.exists(key, { ns: namespace });
  },

  // Get translation with fallback chain
  getTranslationWithFallback: (
    key: string,
    fallbacks: string[] = [],
    options?: any
  ): string => {
    // Try main key first
    if (translationUtils.hasTranslation(key, options?.ns)) {
      return i18n.t(key, options);
    }

    // Try fallback keys
    for (const fallbackKey of fallbacks) {
      if (translationUtils.hasTranslation(fallbackKey, options?.ns)) {
        return i18n.t(fallbackKey, options);
      }
    }

    // Return key as last resort
    return key;
  },

  // Pluralization helper for Malay
  getMalayPlural: (count: number, singular: string, plural?: string): string => {
    const pluralForm = plural || singular; // Malay often uses same form

    if (count === 0) {
      return i18n.t('common.noItems', { defaultValue: `Tiada ${pluralForm}` });
    } else if (count === 1) {
      return `1 ${singular}`;
    } else {
      return `${count} ${pluralForm}`;
    }
  },

  // Context-aware translation with role-based content
  getContextualTranslation: (
    key: string,
    context: {
      userRole?: 'admin' | 'user' | 'guest' | 'team_member';
      feature?: string;
      action?: string;
    } = {},
    options?: any
  ): string => {
    const { userRole = 'user', feature, action } = context;

    // Build context keys in order of specificity
    const contextKeys = [
      feature && action ? `${key}_${userRole}_${feature}_${action}` : null,
      feature ? `${key}_${userRole}_${feature}` : null,
      `${key}_${userRole}`,
      key
    ].filter(Boolean) as string[];

    return translationUtils.getTranslationWithFallback(key, contextKeys, options);
  },

  // Format Malaysian business terms
  formatMalaysianBusinessTerm: (term: string, language: SupportedLanguage): string => {
    if (language !== 'ms') return term;

    const businessTerms: Record<string, string> = {
      'receipt': 'resit',
      'invoice': 'invois',
      'tax': 'cukai',
      'gst': 'GST',
      'sst': 'SST',
      'total': 'jumlah',
      'subtotal': 'subjumlah',
      'discount': 'diskaun',
      'amount': 'amaun',
      'date': 'tarikh',
      'vendor': 'vendor',
      'customer': 'pelanggan',
      'business': 'perniagaan',
      'company': 'syarikat'
    };

    return businessTerms[term.toLowerCase()] || term;
  },

  // Validate translation completeness
  validateTranslationCompleteness: (namespace: string): {
    complete: boolean;
    missing: string[];
    coverage: number;
  } => {
    const enKeys = Object.keys(resources.en[namespace as keyof typeof resources.en] || {});
    const msKeys = Object.keys(resources.ms[namespace as keyof typeof resources.ms] || {});

    const missing = enKeys.filter(key => !msKeys.includes(key));
    const coverage = enKeys.length > 0 ? ((enKeys.length - missing.length) / enKeys.length) * 100 : 100;

    return {
      complete: missing.length === 0,
      missing,
      coverage: Math.round(coverage * 100) / 100
    };
  }
};

// Performance monitoring for translations
export const translationPerformance = {
  // Track translation loading times
  trackLoadTime: (namespace: string, startTime: number): void => {
    const loadTime = performance.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Translation namespace '${namespace}' loaded in ${loadTime.toFixed(2)}ms`);
    }
  },

  // Get translation cache size
  getCacheSize: (): number => {
    return Object.keys(i18n.store.data).length;
  },

  // Clear translation cache
  clearCache: (): void => {
    i18n.store.data = {};
  }
};

// Initialize advanced features after i18n is ready
i18n.on('initialized', () => {
  console.log('🌐 Advanced i18n system initialized');

  // Initialize performance monitoring
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Performance monitoring enabled');
  }

  // Set up language change listeners for SEO
  i18n.on('languageChanged', (lng) => {
    // Update document language attributes
    document.documentElement.lang = lng;

    // Update meta tags for SEO
    if (typeof window !== 'undefined') {
      import('./i18n-seo').then(({ seoUtils }) => {
        seoUtils.initializeSEO(lng as SupportedLanguage);
      });
    }
  });
});

// Error handling for translation loading
i18n.on('failedLoading', (lng, ns, msg) => {
  console.error(`❌ Failed to load translation: ${lng}:${ns} - ${msg}`);

  // Track failed loading for development
  if (process.env.NODE_ENV === 'development') {
    const failedLoads = JSON.parse(localStorage.getItem('mataresit_failed_loads') || '[]');
    failedLoads.push({
      language: lng,
      namespace: ns,
      message: msg,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('mataresit_failed_loads', JSON.stringify(failedLoads));
  }
});

// Resource loading success tracking
i18n.on('loaded', (loaded) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Translation resources loaded:', loaded);
  }
});

export default i18n;
