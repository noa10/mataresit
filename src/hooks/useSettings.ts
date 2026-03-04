import { useState, useEffect, useCallback } from 'react';

export interface UserApiKeys {
  openrouter?: string;
  gemini?: string;
  kilo?: string;
  opencode?: string;
  groq?: string;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeStoredSettings = (rawSettings: unknown): ProcessingSettings | null => {
  if (!isRecord(rawSettings)) {
    return null;
  }

  const selectedModel = rawSettings.selectedModel;
  if (typeof selectedModel !== 'string' || !selectedModel.trim()) {
    return null;
  }

  const batchModel = rawSettings.batchModel;
  const batchUpload = isRecord(rawSettings.batchUpload) ? rawSettings.batchUpload : {};
  const userApiKeys = isRecord(rawSettings.userApiKeys) ? rawSettings.userApiKeys : {};

  return {
    ...defaultSettings,
    selectedModel: selectedModel.trim(),
    batchModel: typeof batchModel === 'string' && batchModel.trim()
      ? batchModel.trim()
      : defaultSettings.batchModel,
    batchUpload: {
      ...defaultSettings.batchUpload,
      ...batchUpload
    },
    userApiKeys: {
      ...defaultSettings.userApiKeys,
      ...userApiKeys
    },
    skipUploadOptimization: typeof rawSettings.skipUploadOptimization === 'boolean'
      ? rawSettings.skipUploadOptimization
      : defaultSettings.skipUploadOptimization
  };
};

export const mergeProcessingSettings = (
  base: ProcessingSettings,
  newSettings: Partial<ProcessingSettings>
): ProcessingSettings => ({
  ...base,
  ...newSettings,
  batchUpload: {
    ...base.batchUpload,
    ...(newSettings.batchUpload || {})
  },
  userApiKeys: {
    ...base.userApiKeys,
    ...(newSettings.userApiKeys || {})
  }
});

export function getStoredProcessingSettings(): ProcessingSettings | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!storedSettings) {
      return null;
    }

    return normalizeStoredSettings(JSON.parse(storedSettings));
  } catch (error) {
    console.error("Error reading settings from localStorage:", error);
    return null;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<ProcessingSettings>(() => getStoredProcessingSettings() || defaultSettings);

  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving settings to localStorage:", error);
    }
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<ProcessingSettings>) => {
    setSettings((prev) => {
      // Re-read persisted settings to avoid stale hook instances clobbering newer changes.
      const persisted = getStoredProcessingSettings();
      const base = persisted || prev;
      return mergeProcessingSettings(base, newSettings);
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return { settings, updateSettings, resetSettings };
}
