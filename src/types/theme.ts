/**
 * Theme System Types
 * 
 * This module defines the type system for the extensible theme architecture
 * supporting multiple color themes and modes.
 */

// Theme modes
export type ThemeMode = 'light' | 'dark' | 'auto';

// Theme variants (color schemes)
export type ThemeVariant = 'default' | 'ocean' | 'forest' | 'sunset';

// Complete theme configuration
export interface ThemeConfig {
  mode: ThemeMode;
  variant: ThemeVariant;
}

// CSS custom property definition
export interface CSSCustomProperty {
  property: string;
  value: string;
  description?: string;
}

// Color palette for a theme variant
export interface ColorPalette {
  // Base colors
  background: string;
  foreground: string;
  
  // Component colors
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  
  // Semantic colors
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  
  // Interactive elements
  border: string;
  input: string;
  ring: string;
  
  // Sidebar specific colors
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

// Theme variant definition
export interface ThemeVariantDefinition {
  name: string;
  displayName: string;
  description: string;
  light: ColorPalette;
  dark: ColorPalette;
  preview?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
}

// Theme registry for managing available themes
export interface ThemeRegistry {
  variants: Record<ThemeVariant, ThemeVariantDefinition>;
  defaultVariant: ThemeVariant;
  defaultMode: ThemeMode;
}

// Theme change event
export interface ThemeChangeEvent {
  previousTheme: ThemeConfig;
  newTheme: ThemeConfig;
  timestamp: Date;
  source: 'user' | 'system' | 'auto';
}

// Theme persistence options
export interface ThemePersistenceOptions {
  localStorage: boolean;
  database: boolean;
  syncAcrossDevices: boolean;
}

// Theme context state
export interface ThemeContextState {
  theme: ThemeConfig;
  isDarkMode: boolean;
  isLoading: boolean;
  error: string | null;
  availableVariants: ThemeVariant[];
  supportedModes: ThemeMode[];
}

// Theme hook options
export interface UseThemeOptions {
  persistToDatabase?: boolean;
  syncWithSystem?: boolean;
  enableTransitions?: boolean;
  transitionDuration?: number;
}

// Theme validation result
export interface ThemeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Theme migration data for upgrading from legacy theme system
export interface ThemeMigrationData {
  legacyTheme?: 'light' | 'dark';
  hasLegacyData: boolean;
  migrationRequired: boolean;
  migratedConfig?: ThemeConfig;
}

// Theme analytics data
export interface ThemeAnalytics {
  mostUsedVariant: ThemeVariant;
  mostUsedMode: ThemeMode;
  switchFrequency: number;
  userPreferences: {
    prefersSystemTheme: boolean;
    favoriteVariant: ThemeVariant;
    switchesPerDay: number;
  };
}

// Theme component props for theme-aware components
export interface ThemeAwareComponentProps {
  themeVariant?: ThemeVariant;
  respectSystemTheme?: boolean;
  className?: string;
}

// Database schema for user theme preferences
export interface UserThemePreference {
  user_id: string;
  theme_config: ThemeConfig;
  created_at: string;
  updated_at: string;
  sync_enabled: boolean;
  analytics_enabled: boolean;
}

// Theme system configuration
export interface ThemeSystemConfig {
  enableAnalytics: boolean;
  enableTransitions: boolean;
  transitionDuration: number;
  persistenceOptions: ThemePersistenceOptions;
  defaultTheme: ThemeConfig;
  availableVariants: ThemeVariant[];
  supportedModes: ThemeMode[];
}

// Export utility types
export type ThemeProperty = keyof ColorPalette;
export type ThemeEventHandler = (event: ThemeChangeEvent) => void;
export type ThemeValidator = (config: ThemeConfig) => ThemeValidationResult;
