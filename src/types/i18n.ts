// Type definitions for i18n translations

// Import the actual translation files to infer types
import type enCommon from '@/locales/en/common.json';
import type enNavigation from '@/locales/en/navigation.json';
import type enDashboard from '@/locales/en/dashboard.json';
import type enReceipts from '@/locales/en/receipts.json';
import type enAuth from '@/locales/en/auth.json';
import type enSettings from '@/locales/en/settings.json';
import type enAdmin from '@/locales/en/admin.json';
import type enErrors from '@/locales/en/errors.json';
import type enForms from '@/locales/en/forms.json';
import type enAi from '@/locales/en/ai.json';
import type enCategories from '@/locales/en/categories.json';
import type enHomepage from '@/locales/en/homepage.json';
import type enProfile from '@/locales/en/profile.json';
import type enPricing from '@/locales/en/pricing.json';
import type enFeatures from '@/locales/en/features.json';
import type enTeam from '@/locales/en/team.json';
import type enClaims from '@/locales/en/claims.json';
import type enChat from '@/locales/en/chat.json';
import type enDocumentation from '@/locales/en/documentation.json';

// Define the structure of our translation resources
export interface TranslationResources {
  common: typeof enCommon;
  navigation: typeof enNavigation;
  dashboard: typeof enDashboard;
  receipts: typeof enReceipts;
  auth: typeof enAuth;
  settings: typeof enSettings;
  admin: typeof enAdmin;
  errors: typeof enErrors;
  forms: typeof enForms;
  ai: typeof enAi;
  categories: typeof enCategories;
  homepage: typeof enHomepage;
  profile: typeof enProfile;
  pricing: typeof enPricing;
  features: typeof enFeatures;
  team: typeof enTeam;
  claims: typeof enClaims;
  chat: typeof enChat;
  documentation: typeof enDocumentation;
}

// Helper type to get nested keys from an object
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

// Translation key types for each namespace
export type CommonKeys = NestedKeyOf<typeof enCommon>;
export type NavigationKeys = NestedKeyOf<typeof enNavigation>;
export type DashboardKeys = NestedKeyOf<typeof enDashboard>;
export type ReceiptsKeys = NestedKeyOf<typeof enReceipts>;
export type AuthKeys = NestedKeyOf<typeof enAuth>;
export type SettingsKeys = NestedKeyOf<typeof enSettings>;
export type AdminKeys = NestedKeyOf<typeof enAdmin>;
export type ErrorsKeys = NestedKeyOf<typeof enErrors>;
export type FormsKeys = NestedKeyOf<typeof enForms>;
export type AiKeys = NestedKeyOf<typeof enAi>;
export type CategoriesKeys = NestedKeyOf<typeof enCategories>;
export type HomepageKeys = NestedKeyOf<typeof enHomepage>;
export type ProfileKeys = NestedKeyOf<typeof enProfile>;
export type PricingKeys = NestedKeyOf<typeof enPricing>;
export type FeaturesKeys = NestedKeyOf<typeof enFeatures>;
export type TeamKeys = NestedKeyOf<typeof enTeam>;
export type ClaimsKeys = NestedKeyOf<typeof enClaims>;
export type ChatKeys = NestedKeyOf<typeof enChat>;
export type DocumentationKeys = NestedKeyOf<typeof enDocumentation>;

// Union type of all translation keys
export type TranslationKey =
  | `common:${CommonKeys}`
  | `navigation:${NavigationKeys}`
  | `dashboard:${DashboardKeys}`
  | `receipts:${ReceiptsKeys}`
  | `auth:${AuthKeys}`
  | `settings:${SettingsKeys}`
  | `admin:${AdminKeys}`
  | `errors:${ErrorsKeys}`
  | `forms:${FormsKeys}`
  | `ai:${AiKeys}`
  | `categories:${CategoriesKeys}`
  | `homepage:${HomepageKeys}`
  | `profile:${ProfileKeys}`
  | `pricing:${PricingKeys}`
  | `features:${FeaturesKeys}`
  | `team:${TeamKeys}`
  | `claims:${ClaimsKeys}`
  | `chat:${ChatKeys}`
  | `documentation:${DocumentationKeys}`;

// Supported languages
export type SupportedLanguage = 'en' | 'ms';

// Translation function options
export interface TranslationOptions {
  lng?: SupportedLanguage;
  fallbackLng?: SupportedLanguage;
  ns?: string;
  defaultValue?: string;
  count?: number;
  context?: string;
  replace?: Record<string, any>;
  interpolation?: {
    escapeValue?: boolean;
    prefix?: string;
    suffix?: string;
  };
}

// Language detection options
export interface LanguageDetectionOptions {
  order: string[];
  caches: string[];
  lookupLocalStorage: string;
  excludeCacheFor: string[];
  checkWhitelist: boolean;
}

// i18n configuration interface
export interface I18nConfig {
  lng: SupportedLanguage;
  fallbackLng: SupportedLanguage;
  whitelist: SupportedLanguage[];
  defaultNS: string;
  ns: string[];
  detection: LanguageDetectionOptions;
  resources: Record<SupportedLanguage, TranslationResources>;
  interpolation: {
    escapeValue: boolean;
    formatSeparator: string;
    format?: (value: any, format: string, lng: string) => string;
  };
  react: {
    useSuspense: boolean;
    bindI18n: string;
    bindI18nStore: string;
    transEmptyNodeValue: string;
    transSupportBasicHtmlNodes: boolean;
    transKeepBasicHtmlNodesFor: string[];
  };
  debug: boolean;
  backend?: {
    loadPath: string;
    addPath: string;
  };
  saveMissing: boolean;
  missingKeyHandler?: (lng: string, ns: string, key: string, fallbackValue: string) => void;
  pluralSeparator: string;
  contextSeparator: string;
  load: string;
  preload: SupportedLanguage[];
  keySeparator: string;
  nsSeparator: string;
}

// Language change event
export interface LanguageChangeEvent {
  language: SupportedLanguage;
  previousLanguage: SupportedLanguage;
  timestamp: Date;
}

// Translation context
export interface TranslationContext {
  language: SupportedLanguage;
  isLoading: boolean;
  error: string | null;
  changeLanguage: (language: SupportedLanguage) => Promise<boolean>;
  t: (key: string, options?: TranslationOptions) => string;
}

// Declare module augmentation for react-i18next
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: TranslationResources;
  }
}
