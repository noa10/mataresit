/**
 * SEO and Accessibility Utilities for Multi-language Support
 * Handles language-specific meta tags, URL structure, and accessibility features
 */

import { SupportedLanguage } from './i18n';

// Language-specific SEO configuration
export interface LanguageSEOConfig {
  language: SupportedLanguage;
  locale: string;
  direction: 'ltr' | 'rtl';
  region: string;
  currency: string;
  dateFormat: string;
  timeZone: string;
}

// SEO configurations for supported languages
export const LANGUAGE_SEO_CONFIGS: Record<SupportedLanguage, LanguageSEOConfig> = {
  en: {
    language: 'en',
    locale: 'en-US',
    direction: 'ltr',
    region: 'US',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeZone: 'America/New_York'
  },
  ms: {
    language: 'ms',
    locale: 'ms-MY',
    direction: 'ltr',
    region: 'MY',
    currency: 'MYR',
    dateFormat: 'DD/MM/YYYY',
    timeZone: 'Asia/Kuala_Lumpur'
  }
};

// URL structure configuration
export interface URLStructureConfig {
  useLanguagePrefix: boolean;
  defaultLanguage: SupportedLanguage;
  languagePrefixes: Record<SupportedLanguage, string>;
}

export const URL_STRUCTURE_CONFIG: URLStructureConfig = {
  useLanguagePrefix: true,
  defaultLanguage: 'en',
  languagePrefixes: {
    en: 'en',
    ms: 'ms'
  }
};

/**
 * SEO Meta Tags Manager
 */
export class SEOMetaManager {
  private currentLanguage: SupportedLanguage = 'en';

  /**
   * Set the current language for SEO
   */
  setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
    this.updateDocumentLanguage();
  }

  /**
   * Update document language attributes
   */
  private updateDocumentLanguage(): void {
    const config = LANGUAGE_SEO_CONFIGS[this.currentLanguage];
    
    // Update HTML lang attribute
    document.documentElement.lang = config.locale;
    
    // Update HTML dir attribute
    document.documentElement.dir = config.direction;
    
    // Update meta tags
    this.updateMetaTags(config);
  }

  /**
   * Update language-specific meta tags
   */
  private updateMetaTags(config: LanguageSEOConfig): void {
    // Update or create language meta tag
    this.setMetaTag('language', config.language);
    
    // Update or create locale meta tag
    this.setMetaTag('locale', config.locale);
    
    // Update Open Graph locale
    this.setMetaProperty('og:locale', config.locale);
    
    // Add alternate language links
    this.updateAlternateLanguageLinks();
  }

  /**
   * Set meta tag value
   */
  private setMetaTag(name: string, content: string): void {
    let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    
    meta.content = content;
  }

  /**
   * Set meta property value (for Open Graph)
   */
  private setMetaProperty(property: string, content: string): void {
    let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      document.head.appendChild(meta);
    }
    
    meta.content = content;
  }

  /**
   * Update alternate language links for SEO
   */
  private updateAlternateLanguageLinks(): void {
    // Remove existing alternate links
    const existingLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingLinks.forEach(link => link.remove());

    // Get current path without language prefix
    const currentPath = this.getCurrentPathWithoutLanguage();

    // Add alternate links for all supported languages
    Object.keys(LANGUAGE_SEO_CONFIGS).forEach(lang => {
      const language = lang as SupportedLanguage;
      const config = LANGUAGE_SEO_CONFIGS[language];
      
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = config.locale;
      link.href = this.buildLanguageURL(language, currentPath);
      
      document.head.appendChild(link);
    });

    // Add x-default link (points to default language)
    const defaultLink = document.createElement('link');
    defaultLink.rel = 'alternate';
    defaultLink.hreflang = 'x-default';
    defaultLink.href = this.buildLanguageURL(URL_STRUCTURE_CONFIG.defaultLanguage, currentPath);
    
    document.head.appendChild(defaultLink);
  }

  /**
   * Get current path without language prefix
   */
  private getCurrentPathWithoutLanguage(): string {
    const path = window.location.pathname;
    
    // Check if path starts with language prefix
    for (const [lang, prefix] of Object.entries(URL_STRUCTURE_CONFIG.languagePrefixes)) {
      if (path.startsWith(`/${prefix}/`) || path === `/${prefix}`) {
        return path.replace(`/${prefix}`, '') || '/';
      }
    }
    
    return path;
  }

  /**
   * Build URL with language prefix
   */
  private buildLanguageURL(language: SupportedLanguage, path: string): string {
    const baseURL = window.location.origin;
    const prefix = URL_STRUCTURE_CONFIG.languagePrefixes[language];
    
    // Don't add prefix for default language if configured
    if (language === URL_STRUCTURE_CONFIG.defaultLanguage && !URL_STRUCTURE_CONFIG.useLanguagePrefix) {
      return `${baseURL}${path}`;
    }
    
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseURL}/${prefix}${cleanPath}`;
  }

  /**
   * Generate structured data for current language
   */
  generateStructuredData(pageData: {
    type: 'WebPage' | 'Article' | 'Organization';
    title: string;
    description: string;
    url?: string;
    image?: string;
    datePublished?: string;
    dateModified?: string;
    author?: string;
  }): object {
    const config = LANGUAGE_SEO_CONFIGS[this.currentLanguage];
    const baseURL = window.location.origin;
    
    const structuredData: any = {
      '@context': 'https://schema.org',
      '@type': pageData.type,
      name: pageData.title,
      description: pageData.description,
      url: pageData.url || window.location.href,
      inLanguage: config.locale,
    };

    if (pageData.image) {
      structuredData.image = pageData.image;
    }

    if (pageData.type === 'Article') {
      structuredData.headline = pageData.title;
      structuredData.datePublished = pageData.datePublished;
      structuredData.dateModified = pageData.dateModified || pageData.datePublished;
      
      if (pageData.author) {
        structuredData.author = {
          '@type': 'Person',
          name: pageData.author
        };
      }

      structuredData.publisher = {
        '@type': 'Organization',
        name: 'Mataresit',
        url: baseURL,
        logo: {
          '@type': 'ImageObject',
          url: `${baseURL}/mataresit-icon.png`
        }
      };
    }

    if (pageData.type === 'Organization') {
      structuredData.url = baseURL;
      structuredData.logo = `${baseURL}/mataresit-icon.png`;
      structuredData.contactPoint = {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: Object.values(LANGUAGE_SEO_CONFIGS).map(c => c.locale)
      };
    }

    return structuredData;
  }
}

/**
 * URL Language Router
 */
export class LanguageRouter {
  /**
   * Get language from URL
   */
  static getLanguageFromURL(): SupportedLanguage | null {
    const path = window.location.pathname;
    
    for (const [lang, prefix] of Object.entries(URL_STRUCTURE_CONFIG.languagePrefixes)) {
      if (path.startsWith(`/${prefix}/`) || path === `/${prefix}`) {
        return lang as SupportedLanguage;
      }
    }
    
    return null;
  }

  /**
   * Navigate to language-specific URL
   */
  static navigateToLanguage(language: SupportedLanguage, path?: string): void {
    const currentPath = path || this.getCurrentPathWithoutLanguage();
    const newURL = this.buildLanguageURL(language, currentPath);
    
    window.history.pushState({}, '', newURL);
  }

  /**
   * Get current path without language prefix
   */
  private static getCurrentPathWithoutLanguage(): string {
    const path = window.location.pathname;
    
    for (const [lang, prefix] of Object.entries(URL_STRUCTURE_CONFIG.languagePrefixes)) {
      if (path.startsWith(`/${prefix}/`) || path === `/${prefix}`) {
        return path.replace(`/${prefix}`, '') || '/';
      }
    }
    
    return path;
  }

  /**
   * Build URL with language prefix
   */
  private static buildLanguageURL(language: SupportedLanguage, path: string): string {
    const prefix = URL_STRUCTURE_CONFIG.languagePrefixes[language];
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    // Don't add prefix for default language if configured
    if (language === URL_STRUCTURE_CONFIG.defaultLanguage && !URL_STRUCTURE_CONFIG.useLanguagePrefix) {
      return cleanPath;
    }
    
    return `/${prefix}${cleanPath}`;
  }
}

/**
 * Accessibility Manager for Multi-language
 */
export class AccessibilityManager {
  /**
   * Update accessibility attributes for language change
   */
  static updateAccessibilityAttributes(language: SupportedLanguage): void {
    const config = LANGUAGE_SEO_CONFIGS[language];
    
    // Update screen reader announcements
    this.announceLanguageChange(language);
    
    // Update form labels and ARIA attributes
    this.updateARIAAttributes(config);
  }

  /**
   * Announce language change to screen readers
   */
  private static announceLanguageChange(language: SupportedLanguage): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    
    const languageName = language === 'ms' ? 'Bahasa Malaysia' : 'English';
    announcement.textContent = `Language changed to ${languageName}`;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /**
   * Update ARIA attributes for current language
   */
  private static updateARIAAttributes(config: LanguageSEOConfig): void {
    // Update main content language
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('lang', config.locale);
    }

    // Update navigation language
    const nav = document.querySelector('nav');
    if (nav) {
      nav.setAttribute('lang', config.locale);
    }
  }
}

// Global instances
export const seoMetaManager = new SEOMetaManager();

// Utility functions
export const seoUtils = {
  // Initialize SEO for current language
  initializeSEO: (language: SupportedLanguage) => {
    seoMetaManager.setLanguage(language);
    AccessibilityManager.updateAccessibilityAttributes(language);
  },

  // Get language from URL
  getLanguageFromURL: () => LanguageRouter.getLanguageFromURL(),

  // Navigate to language
  navigateToLanguage: (language: SupportedLanguage, path?: string) => {
    LanguageRouter.navigateToLanguage(language, path);
  },

  // Generate structured data
  generateStructuredData: (pageData: any) => {
    return seoMetaManager.generateStructuredData(pageData);
  }
};
