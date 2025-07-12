# Theme Configuration System

This document describes the comprehensive theme configuration system implemented in the application.

## Overview

The theme system provides:
- Multiple theme variants (default, ocean, forest, sunset)
- Light/dark/auto mode support
- Dynamic theme switching without page reload
- Theme persistence across sessions
- CSS custom properties for consistent styling
- TypeScript support with full type safety

## Architecture

### Core Components

1. **Theme Configuration** (`src/lib/themeConfig.ts`)
   - Defines all available theme palettes
   - Provides theme variant definitions
   - Exports theme registry and utilities

2. **Theme Manager** (`src/lib/themeManager.ts`)
   - Handles theme application to the document
   - Manages theme transitions and animations
   - Provides system theme detection

3. **Theme Context** (`src/contexts/ThemeContext.tsx`)
   - React Context for theme state management
   - Database integration for user preferences
   - Theme switching and persistence logic

4. **Theme Types** (`src/types/theme.ts`)
   - TypeScript interfaces and types
   - Theme configuration definitions
   - Type safety for theme operations

## Available Themes

### Default Theme
- **Description**: Clean and professional default theme
- **Colors**: Neutral grays with blue accents
- **Use Case**: General purpose, professional applications

### Ocean Theme
- **Description**: Cool blues and teals inspired by the ocean
- **Colors**: Various shades of blue and teal
- **Use Case**: Calming, water-themed applications

### Forest Theme
- **Description**: Natural greens and earth tones
- **Colors**: Green palette with earth accents
- **Use Case**: Nature-themed, eco-friendly applications

### Sunset Theme
- **Description**: Warm oranges and golden hues
- **Colors**: Orange, yellow, and warm color palette
- **Use Case**: Energetic, warm-themed applications

## Usage

### Basic Theme Usage

```typescript
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { theme, isDarkMode, setVariant, toggleMode } = useTheme();
  
  return (
    <div>
      <p>Current theme: {theme.variant}</p>
      <p>Dark mode: {isDarkMode ? 'Yes' : 'No'}</p>
      
      <button onClick={() => setVariant('ocean')}>
        Switch to Ocean Theme
      </button>
      
      <button onClick={toggleMode}>
        Toggle Dark Mode
      </button>
    </div>
  );
}
```

### Theme Configuration

```typescript
import { useTheme } from '@/contexts/ThemeContext';

function ThemeSelector() {
  const { theme, setTheme, availableVariants } = useTheme();
  
  const handleThemeChange = async (variant: ThemeVariant) => {
    const success = await setTheme({ variant });
    if (success) {
      console.log('Theme changed successfully');
    }
  };
  
  return (
    <div>
      {availableVariants.map(variant => (
        <button
          key={variant}
          onClick={() => handleThemeChange(variant)}
          className={theme.variant === variant ? 'active' : ''}
        >
          {variant}
        </button>
      ))}
    </div>
  );
}
```

### CSS Custom Properties

The theme system uses CSS custom properties that can be used in your styles:

```css
.my-component {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
}

.my-button {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.my-card {
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
}
```

### Available CSS Variables

- `--background` - Main background color
- `--foreground` - Main text color
- `--card` - Card background color
- `--card-foreground` - Card text color
- `--primary` - Primary brand color
- `--primary-foreground` - Primary text color
- `--secondary` - Secondary color
- `--secondary-foreground` - Secondary text color
- `--muted` - Muted background color
- `--muted-foreground` - Muted text color
- `--accent` - Accent color
- `--accent-foreground` - Accent text color
- `--destructive` - Error/danger color
- `--destructive-foreground` - Error text color
- `--border` - Border color
- `--input` - Input border color
- `--ring` - Focus ring color

## Adding New Themes

To add a new theme variant:

1. **Define the color palette** in `src/lib/themeConfig.ts`:

```typescript
const myThemeLight: ThemePalette = {
  background: '0 0% 100%',
  foreground: '222.2 84% 4.9%',
  // ... other colors
};

const myThemeDark: ThemePalette = {
  background: '222.2 84% 4.9%',
  foreground: '210 40% 98%',
  // ... other colors
};
```

2. **Add to theme registry**:

```typescript
export const themeVariants: Record<ThemeVariant, ThemeVariantDefinition> = {
  // ... existing themes
  myTheme: {
    name: 'myTheme',
    displayName: 'My Theme',
    description: 'Description of my custom theme',
    light: myThemeLight,
    dark: myThemeDark,
    preview: {
      primaryColor: 'hsl(222.2, 47.4%, 11.2%)',
      secondaryColor: 'hsl(210, 40%, 96.1%)',
      accentColor: 'hsl(210, 40%, 96.1%)'
    }
  }
};
```

3. **Update TypeScript types** in `src/types/theme.ts`:

```typescript
export type ThemeVariant = 'default' | 'ocean' | 'forest' | 'sunset' | 'myTheme';
```

4. **Add CSS class** in `src/index.css`:

```css
.theme-myTheme {
  /* Will be dynamically updated by theme manager */
}
```

## Theme Persistence

Themes are automatically persisted:
- **localStorage**: For immediate persistence across browser sessions
- **Database**: For logged-in users, synced across devices
- **System preference**: Auto mode respects system dark/light preference

## Development Tools

### Theme Test Page
Visit `/test/theme` to access the theme testing interface with:
- Live theme switching
- Theme variant previews
- Current theme status
- Error handling testing

### Debug Utilities

```typescript
import { debugTheme } from '@/lib/themeUtils';

// Get current theme debug information
const debugInfo = debugTheme();
console.log('Current theme:', debugInfo.currentTheme);
console.log('Applied classes:', debugInfo.appliedClasses);
console.log('CSS variables:', debugInfo.cssVariables);
```

### Theme Export

```typescript
import { exportThemeAsCSS } from '@/lib/themeUtils';

// Export current theme as CSS
const css = exportThemeAsCSS({ mode: 'dark', variant: 'ocean' });
console.log(css);
```

## Best Practices

1. **Use CSS custom properties** instead of hardcoded colors
2. **Test themes** in both light and dark modes
3. **Check accessibility** with sufficient contrast ratios
4. **Provide fallbacks** for unsupported theme variants
5. **Use semantic color names** (primary, secondary, etc.) instead of specific colors
6. **Test theme switching** to ensure smooth transitions

## Migration Guide

### From Legacy Theme System

The new theme system is backward compatible with the legacy system:

```typescript
// Old way (still works)
localStorage.setItem('theme', 'dark');

// New way (recommended)
const { setTheme } = useTheme();
setTheme({ mode: 'dark', variant: 'ocean' });
```

### Updating Components

Replace hardcoded colors with CSS custom properties:

```css
/* Before */
.component {
  background-color: #ffffff;
  color: #000000;
}

/* After */
.component {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

## Troubleshooting

### Theme Not Applying
1. Check if ThemeProvider is properly wrapped around your app
2. Verify theme configuration is valid
3. Check browser console for errors

### CSS Variables Not Working
1. Ensure you're using `hsl(var(--variable-name))` syntax
2. Check if the CSS variable is defined in the current theme
3. Verify the theme manager is applying styles correctly

### Performance Issues
1. Disable theme transitions if experiencing lag
2. Check for CSS conflicts or overly complex selectors
3. Use theme preloading for better performance
