import { useState, useEffect, useCallback } from 'react';

export interface UserApiKeys {
  openrouter?: string;
  // Future API keys can be added here
}

export interface ProcessingSettings {
  selectedModel: string;
  batchModel?: string; // Optional separate model for batch processing
  batchUpload: {
    maxConcurrent: number;
    autoStart: boolean;
    timeoutSeconds: number;
    maxRetries: number;
  };
  userApiKeys: UserApiKeys;
  skipUploadOptimization: boolean;
}

const defaultSettings: ProcessingSettings = {
  selectedModel: 'gemini-2.5-flash-lite',
  batchModel: 'gemini-2.5-flash-lite', // Default to same model for batch
  batchUpload: {
    maxConcurrent: 2,
    autoStart: false,
    timeoutSeconds: 120, // 2 minutes timeout
    maxRetries: 2,
  },
  userApiKeys: {},
  skipUploadOptimization: true, // Default to preserving original image quality
};

const SETTINGS_STORAGE_KEY = 'receiptProcessingSettings';

export function useSettings() {
  const [settings, setSettings] = useState<ProcessingSettings>(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        // Parse stored settings
        const parsed = JSON.parse(storedSettings);

        // Basic validation to ensure stored data has required fields
        if (parsed.processingMethod && parsed.selectedModel && typeof parsed.compareWithAlternative === 'boolean') {
          // Merge with default settings to ensure all properties exist
          // This handles cases where new properties were added to the settings structure
          return {
            ...defaultSettings,
            ...parsed,
            // If batchUpload exists in parsed, use it, otherwise use default
            batchUpload: parsed.batchUpload || defaultSettings.batchUpload,
            // If userApiKeys exists in parsed, use it, otherwise use default
            userApiKeys: parsed.userApiKeys || defaultSettings.userApiKeys
          };
        }
      }
    } catch (error) {
      console.error("Error reading settings from localStorage:", error);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving settings to localStorage:", error);
    }
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<ProcessingSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return { settings, updateSettings, resetSettings };
}