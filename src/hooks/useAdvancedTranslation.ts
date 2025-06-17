/**
 * Advanced Translation Hooks
 * Provides context-aware, role-based, and performance-optimized translation hooks
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { translationUtils, getContextualTranslation } from '@/lib/i18n';
import { lazyTranslationLoader } from '@/lib/i18n-lazy';
import { performanceUtils } from '@/lib/i18n-performance';
import type { SupportedLanguage, Namespace } from '@/lib/i18n';

// User role type
type UserRole = 'admin' | 'user' | 'guest' | 'team_member';

// Translation context interface
interface TranslationContext {
  userRole?: UserRole;
  feature?: string;
  action?: string;
  page?: string;
}

// Advanced translation options
interface AdvancedTranslationOptions {
  context?: TranslationContext;
  fallbacks?: string[];
  interpolation?: Record<string, any>;
  pluralization?: {
    count: number;
    key?: string;
  };
  lazy?: boolean;
  namespace?: Namespace;
}

/**
 * Advanced translation hook with context awareness and performance optimization
 */
export function useAdvancedTranslation(namespace?: Namespace) {
  const { t: baseT, i18n, ready } = useTranslation(namespace);
  const { user } = useAuth();
  const { language, isLoading } = useLanguage();
  const [lazyLoadingStates, setLazyLoadingStates] = useState<Record<string, boolean>>({});

  // Determine user role
  const userRole: UserRole = useMemo(() => {
    if (!user) return 'guest';
    
    // Check if user is admin (you might have a different way to determine this)
    if (user.email?.includes('admin') || user.user_metadata?.role === 'admin') {
      return 'admin';
    }
    
    // Check if user is team member
    if (user.user_metadata?.role === 'team_member') {
      return 'team_member';
    }
    
    return 'user';
  }, [user]);

  /**
   * Advanced translation function with context awareness
   */
  const t = useCallback((
    key: string, 
    options: AdvancedTranslationOptions = {}
  ): string => {
    const {
      context = {},
      fallbacks = [],
      interpolation = {},
      pluralization,
      lazy = false,
      namespace: optionNamespace
    } = options;

    // Handle lazy loading
    if (lazy && optionNamespace) {
      const lazyKey = `${language}:${optionNamespace}`;
      
      if (!lazyLoadingStates[lazyKey]) {
        setLazyLoadingStates(prev => ({ ...prev, [lazyKey]: true }));
        
        lazyTranslationLoader.loadNamespace(language, optionNamespace)
          .then(() => {
            setLazyLoadingStates(prev => ({ ...prev, [lazyKey]: false }));
          })
          .catch(error => {
            console.error(`Failed to lazy load ${lazyKey}:`, error);
            setLazyLoadingStates(prev => ({ ...prev, [lazyKey]: false }));
          });
        
        return key; // Return key while loading
      }
    }

    // Build context with user role
    const fullContext = {
      userRole,
      ...context
    };

    // Handle pluralization
    if (pluralization) {
      const pluralKey = pluralization.key || `${key}_plural`;
      const count = pluralization.count;
      
      if (language === 'ms') {
        // Malay pluralization
        return translationUtils.getMalayPlural(
          count,
          baseT(key, { ...interpolation, count }),
          baseT(pluralKey, { ...interpolation, count, defaultValue: null })
        );
      } else {
        // English pluralization (handled by i18next)
        return baseT(key, { 
          ...interpolation, 
          count,
          defaultValue: key
        });
      }
    }

    // Try contextual translation first
    const contextualTranslation = translationUtils.getContextualTranslation(
      key,
      fullContext,
      { ...interpolation, ns: optionNamespace }
    );

    if (contextualTranslation !== key) {
      return contextualTranslation;
    }

    // Try fallback translations
    if (fallbacks.length > 0) {
      return translationUtils.getTranslationWithFallback(
        key,
        fallbacks,
        { ...interpolation, ns: optionNamespace }
      );
    }

    // Default translation
    return baseT(key, { 
      ...interpolation, 
      ns: optionNamespace,
      defaultValue: key
    });
  }, [baseT, language, userRole, lazyLoadingStates]);

  /**
   * Pluralization helper
   */
  const tPlural = useCallback((
    key: string,
    count: number,
    options: Omit<AdvancedTranslationOptions, 'pluralization'> = {}
  ): string => {
    return t(key, {
      ...options,
      pluralization: { count }
    });
  }, [t]);

  /**
   * Context-aware translation
   */
  const tContext = useCallback((
    key: string,
    context: TranslationContext,
    options: Omit<AdvancedTranslationOptions, 'context'> = {}
  ): string => {
    return t(key, {
      ...options,
      context
    });
  }, [t]);

  /**
   * Role-based translation
   */
  const tRole = useCallback((
    key: string,
    role?: UserRole,
    options: Omit<AdvancedTranslationOptions, 'context'> = {}
  ): string => {
    return t(key, {
      ...options,
      context: { userRole: role || userRole }
    });
  }, [t, userRole]);

  /**
   * Lazy translation with namespace loading
   */
  const tLazy = useCallback((
    key: string,
    namespace: Namespace,
    options: Omit<AdvancedTranslationOptions, 'lazy' | 'namespace'> = {}
  ): string => {
    return t(key, {
      ...options,
      lazy: true,
      namespace
    });
  }, [t]);

  /**
   * Format currency with proper localization
   */
  const tCurrency = useCallback((
    amount: number,
    options: { showSymbol?: boolean; precision?: number } = {}
  ): string => {
    const { showSymbol = true, precision = 2 } = options;
    
    if (language === 'ms') {
      const formatted = amount.toLocaleString('ms-MY', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      });
      return showSymbol ? `RM ${formatted}` : formatted;
    } else {
      const formatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      });
      return showSymbol ? `$${formatted}` : formatted;
    }
  }, [language]);

  /**
   * Format date with proper localization
   */
  const tDate = useCallback((
    date: Date | string,
    format: 'short' | 'medium' | 'long' = 'medium'
  ): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    const formatOptions: Intl.DateTimeFormatOptions = {
      short: { day: '2-digit', month: '2-digit', year: 'numeric' },
      medium: { day: '2-digit', month: 'short', year: 'numeric' },
      long: { day: '2-digit', month: 'long', year: 'numeric' }
    }[format];

    if (language === 'ms') {
      return dateObj.toLocaleDateString('ms-MY', formatOptions);
    } else {
      return dateObj.toLocaleDateString('en-US', formatOptions);
    }
  }, [language]);

  /**
   * Format time with proper localization
   */
  const tTime = useCallback((
    time: Date | string,
    format: '12h' | '24h' = '24h'
  ): string => {
    const timeObj = typeof time === 'string' ? new Date(time) : time;
    
    const formatOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: format === '12h'
    };

    if (language === 'ms') {
      return timeObj.toLocaleTimeString('ms-MY', formatOptions);
    } else {
      return timeObj.toLocaleTimeString('en-US', formatOptions);
    }
  }, [language]);

  /**
   * Get Malaysian business term translation
   */
  const tBusiness = useCallback((term: string): string => {
    return translationUtils.formatMalaysianBusinessTerm(term, language);
  }, [language]);

  // Performance monitoring
  useEffect(() => {
    if (ready && !isLoading) {
      const loadTime = performance.now();
      console.log(`🚀 Advanced translation hook ready for ${language} in ${loadTime.toFixed(2)}ms`);
    }
  }, [ready, isLoading, language]);

  return {
    // Basic translation functions
    t,
    tPlural,
    tContext,
    tRole,
    tLazy,
    
    // Formatting functions
    tCurrency,
    tDate,
    tTime,
    tBusiness,
    
    // State and utilities
    language,
    userRole,
    ready: ready && !isLoading,
    isLoading: isLoading || Object.values(lazyLoadingStates).some(Boolean),
    i18n,
    
    // Advanced utilities
    hasTranslation: (key: string, ns?: Namespace) => 
      translationUtils.hasTranslation(key, ns),
    
    getMissingKeys: () => translationUtils.getMissingKeys(),
    
    validateCompleteness: (ns: Namespace) => 
      translationUtils.validateTranslationCompleteness(ns)
  };
}

/**
 * Hook for namespace-specific translations with lazy loading
 */
export function useNamespaceTranslation(namespace: Namespace) {
  const { language } = useLanguage();
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadNamespace = async () => {
      try {
        setError(null);
        await lazyTranslationLoader.loadNamespace(language, namespace);
        
        if (mounted) {
          setIsLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load namespace');
        }
      }
    };

    loadNamespace();

    return () => {
      mounted = false;
    };
  }, [language, namespace]);

  const translation = useAdvancedTranslation(namespace);

  return {
    ...translation,
    isLoaded,
    error
  };
}

/**
 * Hook for performance-optimized translations on mobile
 */
export function useMobileOptimizedTranslation(namespace?: Namespace) {
  const isMobile = useMemo(() => performanceUtils.isMobile(), []);
  const connectionSpeed = useMemo(() => performanceUtils.getConnectionSpeed(), []);
  
  const translation = useAdvancedTranslation(namespace);

  // Optimize for mobile and slow connections
  const optimizedT = useCallback((
    key: string,
    options: AdvancedTranslationOptions = {}
  ) => {
    // Use lazy loading for non-critical translations on mobile
    if (isMobile && connectionSpeed === 'slow' && namespace) {
      return translation.tLazy(key, namespace, options);
    }
    
    return translation.t(key, options);
  }, [translation, isMobile, connectionSpeed, namespace]);

  return {
    ...translation,
    t: optimizedT,
    isMobile,
    connectionSpeed
  };
}
