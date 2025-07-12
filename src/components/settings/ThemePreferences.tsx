import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, Moon, Palette, Settings, Monitor } from 'lucide-react';
import { useSettingsTranslation } from '@/contexts/LanguageContext';

/**
 * Theme Preferences Component
 * 
 * Integrated theme controls for the main settings page.
 * Provides theme mode switching and variant selection with previews.
 */
export function ThemePreferences() {
  const {
    theme,
    isDarkMode,
    isLoading,
    error,
    availableVariants,
    setMode,
    setVariant,
    getVariantInfo
  } = useTheme();
  
  const { t } = useSettingsTranslation();

  const handleModeChange = async (mode: 'light' | 'dark' | 'auto') => {
    const success = await setMode(mode);
    if (!success) {
      console.error(`Failed to change theme mode to ${mode}`);
    }
  };

  const handleVariantChange = async (variant: 'default' | 'ocean' | 'forest' | 'sunset') => {
    const success = await setVariant(variant);
    if (!success) {
      console.error(`Failed to change theme variant to ${variant}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Theme Mode Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Monitor className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Theme Mode</CardTitle>
              <CardDescription>
                Choose how the interface appears - light, dark, or automatically based on your system preference
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Current Mode:</span>
              <Badge variant={isDarkMode ? "default" : "secondary"}>
                {theme.mode}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Active:</span>
              <Badge variant="outline">
                {isDarkMode ? "Dark" : "Light"}
              </Badge>
            </div>
          </div>

          {/* Mode Controls */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant={theme.mode === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeChange('light')}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme.mode === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeChange('dark')}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme.mode === 'auto' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeChange('auto')}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Auto
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">Error: {error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Theme Variant Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Palette className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle>Color Theme</CardTitle>
              <CardDescription>
                Select a color scheme that matches your style and preferences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Variant */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Current Theme:</span>
            <Badge variant="outline">{getVariantInfo(theme.variant).displayName}</Badge>
          </div>

          {/* Variant Selection Buttons */}
          <div className="flex flex-wrap gap-3">
            {availableVariants.map((variant) => {
              const variantInfo = getVariantInfo(variant);
              return (
                <Button
                  key={variant}
                  variant={theme.variant === variant ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleVariantChange(variant)}
                  disabled={isLoading}
                  title={variantInfo.description}
                >
                  {variantInfo.displayName}
                </Button>
              );
            })}
          </div>

          {/* Theme Variant Previews */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {availableVariants.map((variant) => {
              const variantInfo = getVariantInfo(variant);
              return (
                <div
                  key={variant}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    theme.variant === variant
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleVariantChange(variant)}
                >
                  <div className="text-sm font-medium mb-3">{variantInfo.displayName}</div>
                  <div className="flex gap-2 mb-3">
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: variantInfo.preview.primaryColor }}
                      title="Primary Color"
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: variantInfo.preview.secondaryColor }}
                      title="Secondary Color"
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: variantInfo.preview.accentColor }}
                      title="Accent Color"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {variantInfo.description}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
