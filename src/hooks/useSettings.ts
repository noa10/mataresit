import { useState, useEffect, useCallback } from 'react';

export interface ProcessingSettings {
  processingMethod: 'ocr-ai' | 'ai-vision';
  selectedModel: string;
  compareWithAlternative: boolean;
}

const defaultSettings: ProcessingSettings = {
  processingMethod: 'ocr-ai',
  selectedModel: 'gemini-1.5-flash-latest',
  compareWithAlternative: false,
};

const SETTINGS_STORAGE_KEY = 'receiptProcessingSettings';

export function useSettings() {
  const [settings, setSettings] = useState<ProcessingSettings>(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        // Basic validation to ensure stored data matches expected structure
        const parsed = JSON.parse(storedSettings);
        if (parsed.processingMethod && parsed.selectedModel && typeof parsed.compareWithAlternative === 'boolean') {
          return parsed;
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