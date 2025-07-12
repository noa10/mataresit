/**
 * Theme Hook
 * 
 * Re-export the useTheme hook from ThemeContext for easier imports
 * and provide additional theme-related utilities.
 */

export { useTheme } from '@/contexts/ThemeContext';
export type { ThemeConfig, ThemeMode, ThemeVariant } from '@/types/theme';

// Additional theme utilities can be added here in the future
// For example: useThemeTransition, useSystemTheme, etc.
