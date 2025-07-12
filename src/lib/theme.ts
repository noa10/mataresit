import type { ThemeConfig, ThemeMode, ThemeVariant } from '@/types/theme';

/**
 * Legacy theme utilities for backward compatibility
 * These functions are maintained for components that haven't migrated to the new ThemeContext
 * @deprecated Use ThemeContext and useTheme hook instead
 */

// Initialize theme based on user preference (legacy function)
export function initializeTheme() {
  // Check for new theme config first
  const themeConfig = getStoredThemeConfig();

  if (themeConfig) {
    applyThemeConfig(themeConfig);
    return;
  }

  // Fallback to legacy theme logic
  if (localStorage.theme === 'dark' ||
      (!('theme' in localStorage) &&
       window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Function to toggle between light and dark mode (legacy function)
export function toggleTheme() {
  const isDarkMode = document.documentElement.classList.contains('dark');
  if (isDarkMode) {
    document.documentElement.classList.remove('dark');
    localStorage.theme = 'light';
  } else {
    document.documentElement.classList.add('dark');
    localStorage.theme = 'dark';
  }
  // Dispatch custom event for components that listen to theme changes
  window.dispatchEvent(new CustomEvent('themeChanged', {
    detail: { isDarkMode: !isDarkMode }
  }));
}

/**
 * New theme system utilities
 */

// Get stored theme configuration
export function getStoredThemeConfig(): ThemeConfig | null {
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

// Apply theme configuration to document
export function applyThemeConfig(config: ThemeConfig): void {
  const isDark = shouldUseDarkMode(config.mode);

  // Apply dark mode class
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Apply theme variant class
  document.documentElement.classList.remove('theme-default', 'theme-ocean', 'theme-forest', 'theme-sunset');
  document.documentElement.classList.add(`theme-${config.variant}`);

  // Store configuration
  localStorage.setItem('theme-config', JSON.stringify(config));

  // Maintain backward compatibility
  localStorage.setItem('theme', config.mode === 'auto' ? (isDark ? 'dark' : 'light') : config.mode);

  // Dispatch theme change event
  window.dispatchEvent(new CustomEvent('themeConfigChanged', {
    detail: { config, isDark }
  }));
}

// Determine if dark mode should be active
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

// Get current theme mode from document
export function getCurrentThemeMode(): ThemeMode {
  const config = getStoredThemeConfig();
  if (config) {
    return config.mode;
  }

  // Fallback to legacy detection
  const legacyTheme = localStorage.getItem('theme');
  if (legacyTheme === 'dark' || legacyTheme === 'light') {
    return legacyTheme;
  }

  return 'auto';
}

// Get current theme variant from document
export function getCurrentThemeVariant(): ThemeVariant {
  const config = getStoredThemeConfig();
  if (config) {
    return config.variant;
  }

  return 'default';
}

// Check if dark mode is currently active
export function isDarkModeActive(): boolean {
  return document.documentElement.classList.contains('dark');
}

// Migrate legacy theme data to new format
export function migrateLegacyTheme(): ThemeConfig | null {
  const legacyTheme = localStorage.getItem('theme');
  const existingConfig = getStoredThemeConfig();

  // Don't migrate if new config already exists
  if (existingConfig) {
    return existingConfig;
  }

  // Create new config from legacy data
  if (legacyTheme === 'dark' || legacyTheme === 'light') {
    const newConfig: ThemeConfig = {
      mode: legacyTheme,
      variant: 'default'
    };

    // Store new config
    localStorage.setItem('theme-config', JSON.stringify(newConfig));

    return newConfig;
  }

  return null;
}
