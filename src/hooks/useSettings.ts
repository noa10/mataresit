import { useState, useEffect, useCallback } from 'react';

export interface ProcessingSettings {
  processingMethod: 'ocr-ai' | 'ai-vision';
  selectedModel: string;
  compareWithAlternative: boolean;
  batchUpload: {
    maxConcurrent: number;
    autoStart: boolean;
  };
}

const defaultSettings: ProcessingSettings = {
  processingMethod: 'ai-vision',
  selectedModel: 'gemini-1.5-flash-latest',
  compareWithAlternative: false,
  batchUpload: {
    maxConcurrent: 2,
    autoStart: false,
  },
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
            batchUpload: parsed.batchUpload || defaultSettings.batchUpload
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