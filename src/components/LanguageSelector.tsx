import React from 'react';
import { Check, ChevronDown, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LANGUAGES, getLanguageDisplayName, type SupportedLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  variant?: 'default' | 'compact' | 'icon-only';
  className?: string;
  showFlag?: boolean;
  disabled?: boolean;
}

// Language flag emojis
const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: '🇺🇸',
  ms: '🇲🇾'
};

// Language codes for display
const LANGUAGE_CODES: Record<SupportedLanguage, string> = {
  en: 'EN',
  ms: 'MS'
};

export function LanguageSelector({ 
  variant = 'default', 
  className,
  showFlag = true,
  disabled = false
}: LanguageSelectorProps) {
  const { language, changeLanguage, isLoading, error } = useLanguage();

  const handleLanguageChange = async (newLanguage: SupportedLanguage) => {
    if (newLanguage === language || isLoading || disabled) return;

    const success = await changeLanguage(newLanguage);
    if (!success && error) {
      console.error('Failed to change language:', error);
      // You could show a toast notification here
    }
  };

  const renderTriggerContent = () => {
    const flag = showFlag ? LANGUAGE_FLAGS[language] : null;
    const code = LANGUAGE_CODES[language];
    const displayName = getLanguageDisplayName(language);

    switch (variant) {
      case 'icon-only':
        return (
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", className)}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
          </Button>
        );

      case 'compact':
        return (
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 px-2 gap-1", className)}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                {flag && <span className="text-sm">{flag}</span>}
                <span className="text-xs font-medium">{code}</span>
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </Button>
        );

      default:
        return (
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-9 px-3 gap-2", className)}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Globe className="h-4 w-4" />
                {flag && <span>{flag}</span>}
                <span className="font-medium">{displayName}</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTriggerContent()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {Object.entries(SUPPORTED_LANGUAGES).map(([langCode, langName]) => {
          const lang = langCode as SupportedLanguage;
          const isSelected = lang === language;
          const flag = showFlag ? LANGUAGE_FLAGS[lang] : null;

          return (
            <DropdownMenuItem
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              disabled={isLoading || disabled}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                isSelected && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2">
                {flag && <span>{flag}</span>}
                <span>{langName}</span>
                {lang === 'ms' && (
                  <Badge variant="secondary" className="text-xs">
                    Bahasa
                  </Badge>
                )}
              </div>
              {isSelected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
        
        {error && (
          <div className="px-2 py-1 text-xs text-destructive border-t">
            Failed to change language
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Compact version for mobile/small spaces
export function CompactLanguageSelector(props: Omit<LanguageSelectorProps, 'variant'>) {
  return <LanguageSelector {...props} variant="compact" />;
}

// Icon-only version for minimal UI
export function IconLanguageSelector(props: Omit<LanguageSelectorProps, 'variant'>) {
  return <LanguageSelector {...props} variant="icon-only" />;
}

// Language selector with status indicator
export function LanguageSelectorWithStatus(props: LanguageSelectorProps) {
  const { isLoading, error } = useLanguage();

  return (
    <div className="relative">
      <LanguageSelector {...props} />
      {isLoading && (
        <div className="absolute -top-1 -right-1">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
        </div>
      )}
      {error && (
        <div className="absolute -top-1 -right-1">
          <div className="h-2 w-2 bg-red-500 rounded-full" />
        </div>
      )}
    </div>
  );
}
