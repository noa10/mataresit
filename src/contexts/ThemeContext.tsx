import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { applyTheme, shouldUseDarkMode, setupSystemThemeListener, validateThemeConfig } from '@/lib/themeManager';
import { getAvailableThemeVariants, getThemeVariantInfo } from '@/lib/themeManager';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemeVariant = 'default' | 'ocean' | 'forest' | 'sunset';

export interface ThemeConfig {
  mode: ThemeMode;
  variant: ThemeVariant;
}

interface ThemeContextType {
  theme: ThemeConfig;
  isDarkMode: boolean;
  isLoading: boolean;
  error: string | null;
  availableVariants: ThemeVariant[];
  setTheme: (config: Partial<ThemeConfig>) => Promise<boolean>;
  toggleMode: () => Promise<boolean>;
  setMode: (mode: ThemeMode) => Promise<boolean>;
  setVariant: (variant: ThemeVariant) => Promise<boolean>;
  resetToDefaults: () => Promise<boolean>;
  getVariantInfo: (variant: ThemeVariant) => any;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

// Default theme configuration
const DEFAULT_THEME: ThemeConfig = {
  mode: 'auto',
  variant: 'default'
};

// Get initial theme from localStorage or defaults
function getInitialTheme(): ThemeConfig {
  try {
    const stored = localStorage.getItem('theme-config');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        mode: parsed.mode || DEFAULT_THEME.mode,
        variant: parsed.variant || DEFAULT_THEME.variant
      };
    }
  } catch (error) {
    console.warn('Failed to parse stored theme config:', error);
  }
  
  // Fallback to legacy theme storage for backward compatibility
  const legacyTheme = localStorage.getItem('theme');
  if (legacyTheme === 'dark' || legacyTheme === 'light') {
    return {
      mode: legacyTheme,
      variant: DEFAULT_THEME.variant
    };
  }
  
  return DEFAULT_THEME;
}

// Store theme configuration in localStorage
function storeThemeConfig(config: ThemeConfig) {
  localStorage.setItem('theme-config', JSON.stringify(config));

  // Maintain backward compatibility with legacy theme storage
  const isDark = shouldUseDarkMode(config.mode);
  localStorage.setItem('theme', config.mode === 'auto' ? (isDark ? 'dark' : 'light') : config.mode);
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeConfig>(getInitialTheme);
  const [isDarkMode, setIsDarkMode] = useState(() => shouldUseDarkMode(getInitialTheme().mode));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableVariants] = useState<ThemeVariant[]>(getAvailableThemeVariants);

  // Load user's theme preference from database
  useEffect(() => {
    const loadUserThemePreference = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        const { data, error: dbError } = await supabase
          .from('theme_preferences')
          .select('theme_mode, theme_variant')
          .eq('user_id', user.id)
          .maybeSingle();

        // Handle any database errors
        if (dbError) {
          // This is an actual error (network, permission, etc.)
          throw dbError;
        }

        // Handle the case where no theme preferences exist yet (normal for new users)
        if (!data) {
          console.log('No theme preferences found for user, using defaults');
          return;
        }

        if (data) {
          const dbTheme: ThemeConfig = {
            mode: data.theme_mode as ThemeMode || DEFAULT_THEME.mode,
            variant: data.theme_variant as ThemeVariant || DEFAULT_THEME.variant
          };

          setThemeState(dbTheme);
          setIsDarkMode(shouldUseDarkMode(dbTheme.mode));
          applyTheme(dbTheme, { enableTransitions: true });
        }
      } catch (err) {
        console.error('Failed to load user theme preference:', err);
        setError(err instanceof Error ? err.message : 'Failed to load theme preference');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserThemePreference();
  }, [user]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme.mode !== 'auto') return;

    const cleanup = setupSystemThemeListener((isDark) => {
      setIsDarkMode(isDark);
      applyTheme(theme, { enableTransitions: true });
    });

    return cleanup;
  }, [theme]);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme, { enableTransitions: true });
    setIsDarkMode(shouldUseDarkMode(theme.mode));
  }, [theme]);

  // Save theme preference to database
  const saveThemePreference = async (config: ThemeConfig): Promise<void> => {
    if (!user) return;

    const { error: dbError } = await supabase
      .from('theme_preferences')
      .upsert({
        user_id: user.id,
        theme_mode: config.mode,
        theme_variant: config.variant,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      throw dbError;
    }
  };

  // Set theme configuration
  const setTheme = async (config: Partial<ThemeConfig>): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const newTheme = validateThemeConfig({
        ...theme,
        ...config
      });

      // Save to database if user is logged in
      if (user) {
        await saveThemePreference(newTheme);
      }

      // Store in localStorage
      storeThemeConfig(newTheme);

      setThemeState(newTheme);
      return true;
    } catch (err) {
      console.error('Failed to set theme:', err);
      setError(err instanceof Error ? err.message : 'Failed to set theme');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle between light and dark mode
  const toggleMode = async (): Promise<boolean> => {
    const newMode: ThemeMode = theme.mode === 'dark' ? 'light' : 'dark';
    return setTheme({ mode: newMode });
  };

  // Set theme mode
  const setMode = async (mode: ThemeMode): Promise<boolean> => {
    return setTheme({ mode });
  };

  // Set theme variant
  const setVariant = async (variant: ThemeVariant): Promise<boolean> => {
    return setTheme({ variant });
  };

  // Reset to default theme
  const resetToDefaults = async (): Promise<boolean> => {
    return setTheme(DEFAULT_THEME);
  };

  // Get theme variant information
  const getVariantInfo = (variant: ThemeVariant) => {
    return getThemeVariantInfo(variant);
  };

  const contextValue: ThemeContextType = {
    theme,
    isDarkMode,
    isLoading,
    error,
    availableVariants,
    setTheme,
    toggleMode,
    setMode,
    setVariant,
    resetToDefaults,
    getVariantInfo
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
