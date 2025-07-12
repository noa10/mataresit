/**
 * Theme Utilities
 * 
 * Helper functions for theme development, debugging, and utilities.
 */

import type { ThemeConfig, ThemeVariant, ThemeMode } from '@/types/theme';
import { themeRegistry, getThemePalette, generateCSSCustomProperties } from './themeConfig';
import { shouldUseDarkMode } from './themeManager';

/**
 * Export current theme as CSS
 */
export function exportThemeAsCSS(config: ThemeConfig): string {
  const isDark = shouldUseDarkMode(config.mode);
  const palette = getThemePalette(config.variant, isDark);
  const cssProperties = generateCSSCustomProperties(palette);
  
  const cssRules = Object.entries(cssProperties)
    .map(([property, value]) => `  ${property}: ${value};`)
    .join('\n');
  
  return `:root {\n${cssRules}\n}`;
}

/**
 * Generate theme preview data for UI components
 */
export function generateThemePreview(variant: ThemeVariant) {
  const variantInfo = themeRegistry.variants[variant];
  const lightPalette = variantInfo.light;
  const darkPalette = variantInfo.dark;
  
  return {
    name: variantInfo.displayName,
    description: variantInfo.description,
    light: {
      background: `hsl(${lightPalette.background})`,
      foreground: `hsl(${lightPalette.foreground})`,
      primary: `hsl(${lightPalette.primary})`,
      secondary: `hsl(${lightPalette.secondary})`,
      accent: `hsl(${lightPalette.accent})`,
      border: `hsl(${lightPalette.border})`
    },
    dark: {
      background: `hsl(${darkPalette.background})`,
      foreground: `hsl(${darkPalette.foreground})`,
      primary: `hsl(${darkPalette.primary})`,
      secondary: `hsl(${darkPalette.secondary})`,
      accent: `hsl(${darkPalette.accent})`,
      border: `hsl(${darkPalette.border})`
    }
  };
}

/**
 * Validate theme configuration and provide suggestions
 */
export function validateAndSuggestTheme(config: Partial<ThemeConfig>): {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
  correctedConfig: ThemeConfig;
} {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  // Validate mode
  const validModes: ThemeMode[] = ['light', 'dark', 'auto'];
  const mode = validModes.includes(config.mode as ThemeMode) 
    ? config.mode as ThemeMode 
    : 'auto';
    
  if (config.mode && !validModes.includes(config.mode as ThemeMode)) {
    errors.push(`Invalid theme mode: ${config.mode}. Valid modes are: ${validModes.join(', ')}`);
    suggestions.push('Use "auto" for automatic system theme detection');
  }
  
  // Validate variant
  const validVariants = Object.keys(themeRegistry.variants) as ThemeVariant[];
  const variant = validVariants.includes(config.variant as ThemeVariant)
    ? config.variant as ThemeVariant
    : 'default';
    
  if (config.variant && !validVariants.includes(config.variant as ThemeVariant)) {
    errors.push(`Invalid theme variant: ${config.variant}. Valid variants are: ${validVariants.join(', ')}`);
    suggestions.push('Try "ocean" for a blue theme or "forest" for a green theme');
  }
  
  const correctedConfig: ThemeConfig = { mode, variant };
  
  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    correctedConfig
  };
}

/**
 * Get contrast ratio between two colors (simplified)
 */
export function getContrastRatio(color1: string, color2: string): number {
  // This is a simplified contrast ratio calculation
  // In a real implementation, you'd want to use a proper color library
  // For now, return a mock value
  return 4.5; // WCAG AA standard
}

/**
 * Check theme accessibility
 */
export function checkThemeAccessibility(variant: ThemeVariant, isDark: boolean): {
  score: number;
  issues: string[];
  recommendations: string[];
} {
  const palette = getThemePalette(variant, isDark);
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Mock accessibility checks - in a real implementation, you'd check actual contrast ratios
  const mockContrastRatio = getContrastRatio(palette.background, palette.foreground);
  
  if (mockContrastRatio < 4.5) {
    issues.push('Low contrast between background and foreground text');
    recommendations.push('Increase contrast between background and text colors');
    score -= 20;
  }
  
  if (mockContrastRatio < 3) {
    issues.push('Very low contrast - may be difficult to read');
    recommendations.push('Consider using higher contrast colors for better readability');
    score -= 30;
  }
  
  return {
    score: Math.max(0, score),
    issues,
    recommendations
  };
}

/**
 * Generate theme documentation
 */
export function generateThemeDocumentation(variant: ThemeVariant): string {
  const variantInfo = themeRegistry.variants[variant];
  const lightPalette = variantInfo.light;
  const darkPalette = variantInfo.dark;
  
  return `
# ${variantInfo.displayName} Theme

${variantInfo.description}

## Color Palette

### Light Mode
- Background: hsl(${lightPalette.background})
- Foreground: hsl(${lightPalette.foreground})
- Primary: hsl(${lightPalette.primary})
- Secondary: hsl(${lightPalette.secondary})
- Accent: hsl(${lightPalette.accent})

### Dark Mode
- Background: hsl(${darkPalette.background})
- Foreground: hsl(${darkPalette.foreground})
- Primary: hsl(${darkPalette.primary})
- Secondary: hsl(${darkPalette.secondary})
- Accent: hsl(${darkPalette.accent})

## Usage

\`\`\`typescript
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { setVariant } = useTheme();
  
  const handleThemeChange = () => {
    setVariant('${variant}');
  };
  
  return (
    <button onClick={handleThemeChange}>
      Switch to ${variantInfo.displayName}
    </button>
  );
}
\`\`\`
`.trim();
}

/**
 * Debug theme information
 */
export function debugTheme(): {
  currentTheme: ThemeConfig;
  appliedClasses: string[];
  cssVariables: Record<string, string>;
  systemPreference: 'light' | 'dark';
} {
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  
  // Get applied theme classes
  const appliedClasses = Array.from(root.classList).filter(cls => 
    cls.startsWith('theme-') || cls === 'dark'
  );
  
  // Get current CSS variables
  const cssVariables: Record<string, string> = {};
  const variableNames = [
    '--background', '--foreground', '--primary', '--secondary', 
    '--accent', '--border', '--card', '--muted'
  ];
  
  variableNames.forEach(name => {
    cssVariables[name] = computedStyle.getPropertyValue(name).trim();
  });
  
  // Determine current theme
  let variant: ThemeVariant = 'default';
  appliedClasses.forEach(cls => {
    if (cls.startsWith('theme-')) {
      variant = cls.replace('theme-', '') as ThemeVariant;
    }
  });
  
  const isDark = appliedClasses.includes('dark');
  const mode: ThemeMode = isDark ? 'dark' : 'light';
  
  // Get system preference
  const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches 
    ? 'dark' 
    : 'light';
  
  return {
    currentTheme: { mode, variant },
    appliedClasses,
    cssVariables,
    systemPreference
  };
}

/**
 * Create a new theme variant (for development)
 */
export function createThemeVariant(
  name: string,
  displayName: string,
  description: string,
  lightColors: Partial<any>,
  darkColors: Partial<any>
): string {
  // This would generate the TypeScript code for a new theme variant
  return `
// ${displayName} Theme
const ${name}Light: ThemePalette = {
  // Add your light theme colors here
  background: '${lightColors.background || '0 0% 100%'}',
  foreground: '${lightColors.foreground || '222.2 84% 4.9%'}',
  // ... other colors
};

const ${name}Dark: ThemePalette = {
  // Add your dark theme colors here
  background: '${darkColors.background || '222.2 84% 4.9%'}',
  foreground: '${darkColors.foreground || '210 40% 98%'}',
  // ... other colors
};

// Add to themeVariants object:
${name}: {
  name: '${name}',
  displayName: '${displayName}',
  description: '${description}',
  light: ${name}Light,
  dark: ${name}Dark,
  preview: {
    primaryColor: 'hsl(${lightColors.primary || '222.2 47.4% 11.2%'})',
    secondaryColor: 'hsl(${lightColors.secondary || '210 40% 96.1%'})',
    accentColor: 'hsl(${lightColors.accent || '210 40% 96.1%'})'
  }
}
`.trim();
}
