/**
 * Theme Manager
 * 
 * This module provides utilities for applying theme configurations
 * to the document and managing theme transitions.
 */

import type { ThemeConfig, ThemeMode, ThemeVariant } from '@/types/theme';
import { getThemePalette, generateCSSCustomProperties, themeRegistry } from './themeConfig';

// Theme application options
interface ThemeApplicationOptions {
  enableTransitions?: boolean;
  transitionDuration?: number;
  preserveUserPreferences?: boolean;
}

// Default options
const DEFAULT_OPTIONS: ThemeApplicationOptions = {
  enableTransitions: true,
  transitionDuration: 200,
  preserveUserPreferences: true
};

/**
 * Apply a theme configuration to the document
 */
export function applyTheme(
  config: ThemeConfig,
  options: ThemeApplicationOptions = DEFAULT_OPTIONS
): void {
  const { enableTransitions, transitionDuration } = { ...DEFAULT_OPTIONS, ...options };
  
  // Determine if dark mode should be active
  const isDark = shouldUseDarkMode(config.mode);
  
  // Get the theme palette
  const palette = getThemePalette(config.variant, isDark);
  
  // Generate CSS custom properties
  const cssProperties = generateCSSCustomProperties(palette);
  
  // Apply transitions if enabled
  if (enableTransitions) {
    enableThemeTransitions(transitionDuration!);
  }
  
  // Apply CSS custom properties to document root
  const root = document.documentElement;
  
  Object.entries(cssProperties).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
  // Apply theme variant class
  applyThemeVariantClass(config.variant);
  
  // Apply dark mode class
  applyDarkModeClass(isDark);
  
  // Disable transitions after a short delay to prevent interference with user interactions
  if (enableTransitions) {
    setTimeout(() => disableThemeTransitions(), transitionDuration! + 50);
  }
  
  // Dispatch theme change event
  dispatchThemeChangeEvent(config, isDark);
}

/**
 * Determine if dark mode should be active based on theme mode
 */
export function shouldUseDarkMode(mode: ThemeMode): boolean {
  switch (mode) {
    case 'dark':
      return true;
    case 'light':
      return false;
    case 'auto':
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    default:
      return false;
  }
}

/**
 * Apply theme variant class to document
 */
function applyThemeVariantClass(variant: ThemeVariant): void {
  const root = document.documentElement;
  
  // Remove all existing theme variant classes
  Object.keys(themeRegistry.variants).forEach(v => {
    root.classList.remove(`theme-${v}`);
  });
  
  // Add the new theme variant class
  root.classList.add(`theme-${variant}`);
}

/**
 * Apply dark mode class to document
 */
function applyDarkModeClass(isDark: boolean): void {
  const root = document.documentElement;
  
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Enable smooth transitions for theme changes
 */
function enableThemeTransitions(duration: number): void {
  const root = document.documentElement;
  
  // Add transition styles
  root.style.setProperty('--theme-transition-duration', `${duration}ms`);
  root.classList.add('theme-transitioning');
  
  // Add CSS for transitions if not already present
  if (!document.getElementById('theme-transitions')) {
    const style = document.createElement('style');
    style.id = 'theme-transitions';
    style.textContent = `
      .theme-transitioning,
      .theme-transitioning *,
      .theme-transitioning *:before,
      .theme-transitioning *:after {
        transition: 
          background-color var(--theme-transition-duration, 200ms) ease-in-out,
          border-color var(--theme-transition-duration, 200ms) ease-in-out,
          color var(--theme-transition-duration, 200ms) ease-in-out,
          fill var(--theme-transition-duration, 200ms) ease-in-out,
          stroke var(--theme-transition-duration, 200ms) ease-in-out,
          box-shadow var(--theme-transition-duration, 200ms) ease-in-out !important;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Disable theme transitions
 */
function disableThemeTransitions(): void {
  const root = document.documentElement;
  root.classList.remove('theme-transitioning');
}

/**
 * Dispatch theme change event
 */
function dispatchThemeChangeEvent(config: ThemeConfig, isDark: boolean): void {
  const event = new CustomEvent('themeChange', {
    detail: {
      config,
      isDark,
      timestamp: new Date()
    }
  });
  
  window.dispatchEvent(event);
}

/**
 * Get current theme configuration from document
 */
export function getCurrentThemeFromDocument(): ThemeConfig {
  const root = document.documentElement;
  
  // Determine variant from class
  let variant: ThemeVariant = 'default';
  Object.keys(themeRegistry.variants).forEach(v => {
    if (root.classList.contains(`theme-${v}`)) {
      variant = v as ThemeVariant;
    }
  });
  
  // Determine mode from dark class and stored preferences
  const isDark = root.classList.contains('dark');
  const storedConfig = getStoredThemeConfig();
  
  let mode: ThemeMode = 'auto';
  if (storedConfig) {
    mode = storedConfig.mode;
  } else {
    // Fallback logic
    mode = isDark ? 'dark' : 'light';
  }
  
  return { mode, variant };
}

/**
 * Get stored theme configuration from localStorage
 */
function getStoredThemeConfig(): ThemeConfig | null {
  try {
    const stored = localStorage.getItem('theme-config');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to parse stored theme config:', error);
  }
  return null;
}

/**
 * Validate theme configuration
 */
export function validateThemeConfig(config: Partial<ThemeConfig>): ThemeConfig {
  const validModes: ThemeMode[] = ['light', 'dark', 'auto'];
  const validVariants = Object.keys(themeRegistry.variants) as ThemeVariant[];
  
  const mode = validModes.includes(config.mode as ThemeMode) 
    ? config.mode as ThemeMode 
    : themeRegistry.defaultMode;
    
  const variant = validVariants.includes(config.variant as ThemeVariant)
    ? config.variant as ThemeVariant
    : themeRegistry.defaultVariant;
  
  return { mode, variant };
}

/**
 * Get available theme variants
 */
export function getAvailableThemeVariants(): ThemeVariant[] {
  return Object.keys(themeRegistry.variants) as ThemeVariant[];
}

/**
 * Get theme variant display information
 */
export function getThemeVariantInfo(variant: ThemeVariant) {
  return themeRegistry.variants[variant];
}

/**
 * Initialize theme system with stored or default configuration
 */
export function initializeThemeSystem(): ThemeConfig {
  // Try to get stored configuration
  let config = getStoredThemeConfig();
  
  // If no stored config, try to migrate from legacy theme
  if (!config) {
    config = migrateLegacyTheme();
  }
  
  // If still no config, use defaults
  if (!config) {
    config = {
      mode: themeRegistry.defaultMode,
      variant: themeRegistry.defaultVariant
    };
  }
  
  // Validate and apply the configuration
  const validConfig = validateThemeConfig(config);
  applyTheme(validConfig, { enableTransitions: false });
  
  return validConfig;
}

/**
 * Migrate legacy theme data to new format
 */
function migrateLegacyTheme(): ThemeConfig | null {
  const legacyTheme = localStorage.getItem('theme');
  
  if (legacyTheme === 'dark' || legacyTheme === 'light') {
    const newConfig: ThemeConfig = {
      mode: legacyTheme,
      variant: themeRegistry.defaultVariant
    };
    
    // Store new config
    localStorage.setItem('theme-config', JSON.stringify(newConfig));
    
    return newConfig;
  }
  
  return null;
}

/**
 * Listen for system theme changes
 */
export function setupSystemThemeListener(
  callback: (isDark: boolean) => void
): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = (e: MediaQueryListEvent) => {
    callback(e.matches);
  };
  
  mediaQuery.addEventListener('change', handleChange);
  
  // Return cleanup function
  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}

/**
 * Preload theme assets (if any)
 */
export function preloadThemeAssets(variant: ThemeVariant): Promise<void> {
  // This function can be extended to preload theme-specific assets
  // like custom fonts, images, or additional CSS files
  return Promise.resolve();
}
