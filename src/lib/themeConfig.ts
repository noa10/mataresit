/**
 * Theme Configuration System
 * 
 * This module defines all available theme palettes and provides utilities
 * for managing theme configurations using CSS custom properties.
 */

import type { ThemeVariant, ColorPalette, ThemeVariantDefinition, ThemeRegistry } from '@/types/theme';

// Base color palette interface for theme definitions
interface ThemePalette {
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

// Default theme (current shadcn/ui theme)
const defaultLight: ThemePalette = {
  background: '0 0% 100%',
  foreground: '222.2 84% 4.9%',
  card: '0 0% 100%',
  cardForeground: '222.2 84% 4.9%',
  popover: '0 0% 100%',
  popoverForeground: '222.2 84% 4.9%',
  primary: '222.2 47.4% 11.2%',
  primaryForeground: '210 40% 98%',
  secondary: '210 40% 96.1%',
  secondaryForeground: '222.2 47.4% 11.2%',
  muted: '210 40% 96.1%',
  mutedForeground: '215.4 16.3% 46.9%',
  accent: '210 40% 96.1%',
  accentForeground: '222.2 47.4% 11.2%',
  destructive: '0 84.2% 60.2%',
  destructiveForeground: '210 40% 98%',
  border: '214.3 31.8% 91.4%',
  input: '214.3 31.8% 91.4%',
  ring: '222.2 84% 4.9%',
  sidebarBackground: '0 0% 98%',
  sidebarForeground: '240 5.3% 26.1%',
  sidebarPrimary: '240 5.9% 10%',
  sidebarPrimaryForeground: '0 0% 98%',
  sidebarAccent: '240 4.8% 95.9%',
  sidebarAccentForeground: '240 5.9% 10%',
  sidebarBorder: '220 13% 91%',
  sidebarRing: '217.2 91.2% 59.8%'
};

const defaultDark: ThemePalette = {
  background: '222.2 84% 4.9%',
  foreground: '210 40% 98%',
  card: '222.2 84% 4.9%',
  cardForeground: '210 40% 98%',
  popover: '222.2 84% 4.9%',
  popoverForeground: '210 40% 98%',
  primary: '210 40% 98%',
  primaryForeground: '222.2 47.4% 11.2%',
  secondary: '217.2 32.6% 17.5%',
  secondaryForeground: '210 40% 98%',
  muted: '217.2 32.6% 17.5%',
  mutedForeground: '215 20.2% 65.1%',
  accent: '217.2 32.6% 17.5%',
  accentForeground: '210 40% 98%',
  destructive: '0 62.8% 30.6%',
  destructiveForeground: '210 40% 98%',
  border: '217.2 32.6% 17.5%',
  input: '217.2 32.6% 17.5%',
  ring: '212.7 26.8% 83.9%',
  sidebarBackground: '240 5.9% 10%',
  sidebarForeground: '240 4.8% 95.9%',
  sidebarPrimary: '224.3 76.3% 94.1%',
  sidebarPrimaryForeground: '240 5.9% 10%',
  sidebarAccent: '240 3.7% 15.9%',
  sidebarAccentForeground: '240 4.8% 95.9%',
  sidebarBorder: '240 3.7% 15.9%',
  sidebarRing: '217.2 91.2% 59.8%'
};

// Ocean theme - Blue and teal inspired
const oceanLight: ThemePalette = {
  background: '210 100% 98%',
  foreground: '210 100% 8%',
  card: '210 100% 97%',
  cardForeground: '210 100% 10%',
  popover: '210 100% 97%',
  popoverForeground: '210 100% 10%',
  primary: '200 100% 28%',
  primaryForeground: '210 100% 98%',
  secondary: '210 60% 92%',
  secondaryForeground: '210 100% 15%',
  muted: '210 60% 92%',
  mutedForeground: '210 30% 45%',
  accent: '195 100% 85%',
  accentForeground: '200 100% 20%',
  destructive: '0 84.2% 60.2%',
  destructiveForeground: '210 40% 98%',
  border: '210 40% 85%',
  input: '210 40% 85%',
  ring: '200 100% 28%',
  sidebarBackground: '210 100% 96%',
  sidebarForeground: '210 100% 15%',
  sidebarPrimary: '200 100% 25%',
  sidebarPrimaryForeground: '210 100% 98%',
  sidebarAccent: '210 60% 90%',
  sidebarAccentForeground: '210 100% 15%',
  sidebarBorder: '210 40% 80%',
  sidebarRing: '200 100% 50%'
};

const oceanDark: ThemePalette = {
  background: '210 100% 6%',
  foreground: '210 100% 95%',
  card: '210 100% 8%',
  cardForeground: '210 100% 92%',
  popover: '210 100% 8%',
  popoverForeground: '210 100% 92%',
  primary: '195 100% 70%',
  primaryForeground: '210 100% 8%',
  secondary: '210 50% 15%',
  secondaryForeground: '210 100% 90%',
  muted: '210 50% 15%',
  mutedForeground: '210 30% 65%',
  accent: '195 100% 25%',
  accentForeground: '195 100% 90%',
  destructive: '0 62.8% 50%',
  destructiveForeground: '210 40% 98%',
  border: '210 50% 18%',
  input: '210 50% 18%',
  ring: '195 100% 70%',
  sidebarBackground: '210 100% 4%',
  sidebarForeground: '210 100% 90%',
  sidebarPrimary: '195 100% 65%',
  sidebarPrimaryForeground: '210 100% 8%',
  sidebarAccent: '210 50% 12%',
  sidebarAccentForeground: '210 100% 85%',
  sidebarBorder: '210 50% 15%',
  sidebarRing: '195 100% 60%'
};

// Forest theme - Green and earth tones
const forestLight: ThemePalette = {
  background: '120 25% 97%',
  foreground: '120 100% 8%',
  card: '120 25% 95%',
  cardForeground: '120 100% 10%',
  popover: '120 25% 95%',
  popoverForeground: '120 100% 10%',
  primary: '120 60% 25%',
  primaryForeground: '120 25% 98%',
  secondary: '120 20% 88%',
  secondaryForeground: '120 60% 15%',
  muted: '120 20% 88%',
  mutedForeground: '120 15% 45%',
  accent: '90 40% 80%',
  accentForeground: '120 60% 20%',
  destructive: '0 84.2% 60.2%',
  destructiveForeground: '120 25% 98%',
  border: '120 20% 82%',
  input: '120 20% 82%',
  ring: '120 60% 25%',
  sidebarBackground: '120 25% 94%',
  sidebarForeground: '120 60% 15%',
  sidebarPrimary: '120 60% 22%',
  sidebarPrimaryForeground: '120 25% 98%',
  sidebarAccent: '120 20% 85%',
  sidebarAccentForeground: '120 60% 15%',
  sidebarBorder: '120 20% 78%',
  sidebarRing: '120 60% 45%'
};

const forestDark: ThemePalette = {
  background: '120 25% 6%',
  foreground: '120 25% 95%',
  card: '120 25% 8%',
  cardForeground: '120 25% 92%',
  popover: '120 25% 8%',
  popoverForeground: '120 25% 92%',
  primary: '120 60% 65%',
  primaryForeground: '120 25% 8%',
  secondary: '120 15% 15%',
  secondaryForeground: '120 25% 90%',
  muted: '120 15% 15%',
  mutedForeground: '120 15% 65%',
  accent: '90 40% 25%',
  accentForeground: '90 40% 90%',
  destructive: '0 62.8% 50%',
  destructiveForeground: '120 25% 98%',
  border: '120 15% 18%',
  input: '120 15% 18%',
  ring: '120 60% 65%',
  sidebarBackground: '120 25% 4%',
  sidebarForeground: '120 25% 90%',
  sidebarPrimary: '120 60% 60%',
  sidebarPrimaryForeground: '120 25% 8%',
  sidebarAccent: '120 15% 12%',
  sidebarAccentForeground: '120 25% 85%',
  sidebarBorder: '120 15% 15%',
  sidebarRing: '120 60% 55%'
};

// Sunset theme - Warm oranges and purples
const sunsetLight: ThemePalette = {
  background: '30 100% 98%',
  foreground: '15 100% 8%',
  card: '30 100% 96%',
  cardForeground: '15 100% 10%',
  popover: '30 100% 96%',
  popoverForeground: '15 100% 10%',
  primary: '15 100% 45%',
  primaryForeground: '30 100% 98%',
  secondary: '30 60% 90%',
  secondaryForeground: '15 100% 15%',
  muted: '30 60% 90%',
  mutedForeground: '30 30% 45%',
  accent: '45 100% 85%',
  accentForeground: '15 100% 20%',
  destructive: '0 84.2% 60.2%',
  destructiveForeground: '30 100% 98%',
  border: '30 40% 85%',
  input: '30 40% 85%',
  ring: '15 100% 45%',
  sidebarBackground: '30 100% 95%',
  sidebarForeground: '15 100% 15%',
  sidebarPrimary: '15 100% 40%',
  sidebarPrimaryForeground: '30 100% 98%',
  sidebarAccent: '30 60% 87%',
  sidebarAccentForeground: '15 100% 15%',
  sidebarBorder: '30 40% 80%',
  sidebarRing: '15 100% 60%'
};

const sunsetDark: ThemePalette = {
  background: '15 25% 6%',
  foreground: '30 100% 95%',
  card: '15 25% 8%',
  cardForeground: '30 100% 92%',
  popover: '15 25% 8%',
  popoverForeground: '30 100% 92%',
  primary: '30 100% 70%',
  primaryForeground: '15 25% 8%',
  secondary: '15 20% 15%',
  secondaryForeground: '30 100% 90%',
  muted: '15 20% 15%',
  mutedForeground: '30 30% 65%',
  accent: '45 80% 25%',
  accentForeground: '45 80% 90%',
  destructive: '0 62.8% 50%',
  destructiveForeground: '30 100% 98%',
  border: '15 20% 18%',
  input: '15 20% 18%',
  ring: '30 100% 70%',
  sidebarBackground: '15 25% 4%',
  sidebarForeground: '30 100% 90%',
  sidebarPrimary: '30 100% 65%',
  sidebarPrimaryForeground: '15 25% 8%',
  sidebarAccent: '15 20% 12%',
  sidebarAccentForeground: '30 100% 85%',
  sidebarBorder: '15 20% 15%',
  sidebarRing: '30 100% 60%'
};

// Theme variant definitions
export const themeVariants: Record<ThemeVariant, ThemeVariantDefinition> = {
  default: {
    name: 'default',
    displayName: 'Default',
    description: 'Clean and professional default theme',
    light: defaultLight,
    dark: defaultDark,
    preview: {
      primaryColor: 'hsl(222.2, 47.4%, 11.2%)',
      secondaryColor: 'hsl(210, 40%, 96.1%)',
      accentColor: 'hsl(210, 40%, 96.1%)'
    }
  },
  ocean: {
    name: 'ocean',
    displayName: 'Ocean',
    description: 'Cool blues and teals inspired by the ocean',
    light: oceanLight,
    dark: oceanDark,
    preview: {
      primaryColor: 'hsl(200, 100%, 28%)',
      secondaryColor: 'hsl(210, 60%, 92%)',
      accentColor: 'hsl(195, 100%, 85%)'
    }
  },
  forest: {
    name: 'forest',
    displayName: 'Forest',
    description: 'Natural greens and earth tones',
    light: forestLight,
    dark: forestDark,
    preview: {
      primaryColor: 'hsl(120, 60%, 25%)',
      secondaryColor: 'hsl(120, 20%, 88%)',
      accentColor: 'hsl(90, 40%, 80%)'
    }
  },
  sunset: {
    name: 'sunset',
    displayName: 'Sunset',
    description: 'Warm oranges and golden hues',
    light: sunsetLight,
    dark: sunsetDark,
    preview: {
      primaryColor: 'hsl(15, 100%, 45%)',
      secondaryColor: 'hsl(30, 60%, 90%)',
      accentColor: 'hsl(45, 100%, 85%)'
    }
  }
};

// Theme registry
export const themeRegistry: ThemeRegistry = {
  variants: themeVariants,
  defaultVariant: 'default',
  defaultMode: 'auto'
};

// Get theme palette for a specific variant and mode
export function getThemePalette(variant: ThemeVariant, isDark: boolean): ThemePalette {
  const themeVariant = themeVariants[variant];
  return isDark ? themeVariant.dark : themeVariant.light;
}

// Convert theme palette to CSS custom properties
export function generateCSSCustomProperties(palette: ThemePalette): Record<string, string> {
  return {
    '--background': palette.background,
    '--foreground': palette.foreground,
    '--card': palette.card,
    '--card-foreground': palette.cardForeground,
    '--popover': palette.popover,
    '--popover-foreground': palette.popoverForeground,
    '--primary': palette.primary,
    '--primary-foreground': palette.primaryForeground,
    '--secondary': palette.secondary,
    '--secondary-foreground': palette.secondaryForeground,
    '--muted': palette.muted,
    '--muted-foreground': palette.mutedForeground,
    '--accent': palette.accent,
    '--accent-foreground': palette.accentForeground,
    '--destructive': palette.destructive,
    '--destructive-foreground': palette.destructiveForeground,
    '--border': palette.border,
    '--input': palette.input,
    '--ring': palette.ring,
    '--sidebar-background': palette.sidebarBackground,
    '--sidebar-foreground': palette.sidebarForeground,
    '--sidebar-primary': palette.sidebarPrimary,
    '--sidebar-primary-foreground': palette.sidebarPrimaryForeground,
    '--sidebar-accent': palette.sidebarAccent,
    '--sidebar-accent-foreground': palette.sidebarAccentForeground,
    '--sidebar-border': palette.sidebarBorder,
    '--sidebar-ring': palette.sidebarRing
  };
}
