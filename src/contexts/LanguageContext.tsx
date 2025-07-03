import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  changeLanguage, 
  getCurrentLanguage, 
  isLanguageSupported,
  type SupportedLanguage 
} from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LanguageContextType {
  language: SupportedLanguage;
  isLoading: boolean;
  error: string | null;
  changeLanguage: (language: SupportedLanguage) => Promise<boolean>;
  t: (key: string, options?: any) => string;
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { t, i18n, ready } = useTranslation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    return getCurrentLanguage();
  });

  // Load user's preferred language from database
  useEffect(() => {
    const loadUserLanguagePreference = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.warn('Failed to load user language preference:', profileError);
          return;
        }

        if (profile?.preferred_language && isLanguageSupported(profile.preferred_language)) {
          const success = await handleLanguageChange(profile.preferred_language as SupportedLanguage);
          if (!success) {
            console.warn('Failed to apply user language preference');
          }
        }
      } catch (err) {
        console.error('Error loading user language preference:', err);
        setError('Failed to load language preference');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserLanguagePreference();
  }, [user]);

  // Listen for language changes from i18n
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      if (isLanguageSupported(lng)) {
        setLanguage(lng as SupportedLanguage);
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  // Save language preference to database
  const saveLanguagePreference = async (newLanguage: SupportedLanguage) => {
    if (!user) return;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ preferred_language: newLanguage })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to save language preference:', updateError);
        throw updateError;
      }
    } catch (err) {
      console.error('Error saving language preference:', err);
      throw err;
    }
  };

  // Handle language change
  const handleLanguageChange = async (newLanguage: SupportedLanguage): Promise<boolean> => {
    if (newLanguage === language) return true;

    try {
      setIsLoading(true);
      setError(null);

      // Change language in i18n
      const success = await changeLanguage(newLanguage);
      
      if (!success) {
        throw new Error('Failed to change language');
      }

      // Save to database if user is logged in
      if (user) {
        await saveLanguagePreference(newLanguage);
      }

      setLanguage(newLanguage);
      return true;
    } catch (err) {
      console.error('Failed to change language:', err);
      setError(err instanceof Error ? err.message : 'Failed to change language');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: LanguageContextType = {
    language,
    isLoading,
    error,
    changeLanguage: handleLanguageChange,
    t,
    ready
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Custom hook for translation with better TypeScript support
export function useTranslationWithNamespace(namespace?: string) {
  const { t: originalT, i18n, ready } = useTranslation(namespace);
  const { language, isLoading, error } = useLanguage();

  const t = (key: string, options?: any) => {
    try {
      return originalT(key, options);
    } catch (err) {
      console.warn(`Translation error for key "${key}":`, err);
      return key; // Return the key as fallback
    }
  };

  return {
    t,
    language,
    isLoading,
    error,
    ready,
    i18n
  };
}

// Helper hook for common translations
export function useCommonTranslation() {
  return useTranslationWithNamespace('common');
}

// Helper hook for navigation translations
export function useNavigationTranslation() {
  return useTranslationWithNamespace('navigation');
}

// Helper hook for dashboard translations
export function useDashboardTranslation() {
  return useTranslationWithNamespace('dashboard');
}

// Helper hook for receipts translations
export function useReceiptsTranslation() {
  return useTranslationWithNamespace('receipts');
}

// Helper hook for auth translations
export function useAuthTranslation() {
  return useTranslationWithNamespace('auth');
}

// Helper hook for settings translations
export function useSettingsTranslation() {
  return useTranslationWithNamespace('settings');
}

// Helper hook for admin translations
export function useAdminTranslation() {
  return useTranslationWithNamespace('admin');
}

// Helper hook for error translations
export function useErrorTranslation() {
  return useTranslationWithNamespace('errors');
}

// Helper hook for form translations
export function useFormTranslation() {
  return useTranslationWithNamespace('forms');
}

// Helper hook for AI translations
export function useAiTranslation() {
  return useTranslationWithNamespace('ai');
}

// Helper hook for categories translations
export function useCategoriesTranslation() {
  return useTranslationWithNamespace('categories');
}

// Helper hook for homepage translations
export function useHomepageTranslation() {
  return useTranslationWithNamespace('homepage');
}

// Helper hook for profile translations
export function useProfileTranslation() {
  return useTranslationWithNamespace('profile');
}

// Helper hook for pricing translations
export function usePricingTranslation() {
  return useTranslationWithNamespace('pricing');
}

// Helper hook for features translations
export function useFeaturesTranslation() {
  return useTranslationWithNamespace('features');
}

// Helper hook for team translations
export function useTeamTranslation() {
  return useTranslationWithNamespace('team');
}

// Helper hook for claims translations
export function useClaimsTranslation() {
  return useTranslationWithNamespace('claims');
}

// Helper hook for chat translations
export function useChatTranslation() {
  return useTranslationWithNamespace('chat');
}

// Helper hook for documentation translations
export function useDocumentationTranslation() {
  return useTranslationWithNamespace('documentation');
}
