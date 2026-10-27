/**
 * Theme Configuration System
 *
 * This module defines all available theme palettes and provides utilities
 * for managing theme configurations using CSS custom properties.
 *
 * Since the ledger redesign the app has one design language — the "modern
 * ledger" paper/emerald system in src/index.css. The theme manager applies
 * these palettes as inline <html> styles, so they MUST match the ledger
 * tokens in index.css or every legacy component reverts to the old look.
 * The legacy variant names are kept (users may have them saved in
 * theme_preferences) but they all resolve to the ledger palette.
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

// Ledger light palette (paper #F1F2EE, emerald #0B6B4D) — mirrors the
// :root shadcn-token block in src/index.css.
const ledgerLight: ThemePalette = {
  background: '75 13% 94%',
  foreground: '156 12% 8%',
  card: '0 0% 100%',
  cardForeground: '156 12% 8%',
  popover: '0 0% 100%',
  popoverForeground: '156 12% 8%',
  primary: '161 81% 23%',
  primaryForeground: '0 0% 100%',
  secondary: '75 20% 96%',
  secondaryForeground: '156 12% 8%',
  muted: '75 20% 96%',
  mutedForeground: '133 5% 37%',
  accent: '75 20% 96%',
  accentForeground: '156 12% 8%',
  destructive: '0 56% 39%',
  destructiveForeground: '0 0% 100%',
  border: '90 11% 86%',
  input: '96 8% 76%',
  ring: '161 81% 23%',
  sidebarBackground: '75 20% 96%',
  sidebarForeground: '133 5% 37%',
  sidebarPrimary: '161 81% 23%',
  sidebarPrimaryForeground: '0 0% 100%',
  sidebarAccent: '146 33% 91%',
  sidebarAccentForeground: '156 12% 8%',
  sidebarBorder: '90 11% 86%',
  sidebarRing: '161 81% 23%'
};

// Ledger dark palette — mirrors the .dark shadcn-token block in src/index.css.
const ledgerDark: ThemePalette = {
  background: '168 17% 6%',
  foreground: '75 13% 94%',
  card: '154 15% 9%',
  cardForeground: '75 13% 94%',
  popover: '154 15% 9%',
  popoverForeground: '75 13% 94%',
  primary: '157 50% 50%',
  primaryForeground: '168 17% 5%',
  secondary: '153 16% 11%',
  secondaryForeground: '75 13% 94%',
  muted: '153 16% 11%',
  mutedForeground: '142 7% 68%',
  accent: '153 16% 11%',
  accentForeground: '75 13% 94%',
  destructive: '3 59% 70%',
  destructiveForeground: '168 17% 5%',
  border: '150 12% 17%',
  input: '150 9% 25%',
  ring: '157 50% 50%',
  sidebarBackground: '154 15% 9%',
  sidebarForeground: '142 7% 68%',
  sidebarPrimary: '157 50% 50%',
  sidebarPrimaryForeground: '168 17% 5%',
  sidebarAccent: '159 41% 15%',
  sidebarAccentForeground: '75 13% 94%',
  sidebarBorder: '150 12% 17%',
  sidebarRing: '157 50% 50%'
};

const defaultLight = ledgerLight;
const defaultDark = ledgerDark;

// Legacy variant names all resolve to the ledger palette so saved
// preferences keep working without re-introducing pre-redesign colors.
const oceanLight = ledgerLight;
const oceanDark = ledgerDark;
const forestLight = ledgerLight;
const forestDark = ledgerDark;
const sunsetLight = ledgerLight;
const sunsetDark = ledgerDark;

// Theme variant definitions
export const themeVariants: Record<ThemeVariant, ThemeVariantDefinition> = {
  default: {
    name: 'default',
    displayName: 'Ledger',
    description: 'The Mataresit ledger theme — paper, ink and emerald',
    light: defaultLight,
    dark: defaultDark,
    preview: {
      primaryColor: 'hsl(161, 81%, 23%)',
      secondaryColor: 'hsl(75, 20%, 96%)',
      accentColor: 'hsl(146, 33%, 91%)'
    }
  },
  ocean: {
    name: 'ocean',
    displayName: 'Ledger',
    description: 'The Mataresit ledger theme — paper, ink and emerald',
    light: oceanLight,
    dark: oceanDark,
    preview: {
      primaryColor: 'hsl(161, 81%, 23%)',
      secondaryColor: 'hsl(75, 20%, 96%)',
      accentColor: 'hsl(146, 33%, 91%)'
    }
  },
  forest: {
    name: 'forest',
    displayName: 'Ledger',
    description: 'The Mataresit ledger theme — paper, ink and emerald',
    light: forestLight,
    dark: forestDark,
    preview: {
      primaryColor: 'hsl(161, 81%, 23%)',
      secondaryColor: 'hsl(75, 20%, 96%)',
      accentColor: 'hsl(146, 33%, 91%)'
    }
  },
  sunset: {
    name: 'sunset',
    displayName: 'Ledger',
    description: 'The Mataresit ledger theme — paper, ink and emerald',
    light: sunsetLight,
    dark: sunsetDark,
    preview: {
      primaryColor: 'hsl(161, 81%, 23%)',
      secondaryColor: 'hsl(75, 20%, 96%)',
      accentColor: 'hsl(146, 33%, 91%)'
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
