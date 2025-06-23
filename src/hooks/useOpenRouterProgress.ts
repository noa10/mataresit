import { useState, useCallback, useRef } from 'react';
import { ProcessingLog } from '@/types/receipt';

export interface OpenRouterProgressState {
  logs: ProcessingLog[];
  currentStage: string | null;
  progress: number;
  isProcessing: boolean;
  startTime: number | null;
}

export interface OpenRouterProgressActions {
  startProcessing: (receiptId: string) => void;
  addLog: (stepName: string, message: string, progress?: number) => void;
  completeProcessing: () => void;
  failProcessing: (error: string) => void;
  reset: () => void;
}

// Progress mapping for OpenRouter processing stages
const OPENROUTER_PROGRESS_MAP: Record<string, Record<string, number>> = {
  'START': {
    'Initializing OpenRouter processing': 5,
    'Validating API key': 10,
    'Preparing image data': 15,
  },
  'AI': {
    'Connecting to OpenRouter API': 20,
    'Sending image to AI model': 25,
    'Processing with AI model': 40,
    'Receiving AI response': 60,
    'Parsing AI response': 70,
  },
  'PROCESSING': {
    'Extracting receipt data': 75,
    'Validating extracted fields': 80,
    'Formatting receipt information': 85,
    'Calculating confidence scores': 90,
  },
  'SAVE': {
    'Saving processed data': 95,
    'Updating receipt record': 98,
  },
  'COMPLETE': {
    'Processing completed successfully': 100,
  },
  'ERROR': {
    'Processing failed': 100,
  },
};

const initialState: OpenRouterProgressState = {
  logs: [],
  currentStage: null,
  progress: 0,
  isProcessing: false,
  startTime: null,
};

export function useOpenRouterProgress(): [OpenRouterProgressState, OpenRouterProgressActions] {
  const [state, setState] = useState<OpenRouterProgressState>(initialState);
  const receiptIdRef = useRef<string | null>(null);

  const generateLogId = useCallback(() => {
    return `openrouter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const updateProgress = useCallback((stepName: string, message: string, forceProgress?: number) => {
    if (forceProgress !== undefined) {
      return forceProgress;
    }

    const stageMap = OPENROUTER_PROGRESS_MAP[stepName];
    if (!stageMap) return undefined;

    // Find the best matching message
    let bestMatch = '';
    let bestScore = 0;

    Object.keys(stageMap).forEach(logKey => {
      if (message.toLowerCase().includes(logKey.toLowerCase())) {
        const score = logKey.length; // Longer matches are more specific
        if (score > bestScore) {
          bestMatch = logKey;
          bestScore = score;
        }
      }
    });

    return bestMatch && stageMap[bestMatch] ? stageMap[bestMatch] : undefined;
  }, []);

  const startProcessing = useCallback((receiptId: string) => {
    receiptIdRef.current = receiptId;
    setState({
      logs: [],
      currentStage: 'START',
      progress: 0,
      isProcessing: true,
      startTime: Date.now(),
    });
  }, []);

  const addLog = useCallback((stepName: string, message: string, forceProgress?: number) => {
    const newLog: ProcessingLog = {
      id: generateLogId(),
      receipt_id: receiptIdRef.current || 'pending',
      created_at: new Date().toISOString(),
      status_message: message,
      step_name: stepName,
    };

    const progressValue = updateProgress(stepName, message, forceProgress);

    setState(prev => ({
      ...prev,
      logs: [...prev.logs, newLog],
      currentStage: stepName,
      progress: progressValue !== undefined ? progressValue : prev.progress,
    }));
  }, [generateLogId, updateProgress]);

  const completeProcessing = useCallback(() => {
    const completionLog: ProcessingLog = {
      id: generateLogId(),
      receipt_id: receiptIdRef.current || 'pending',
      created_at: new Date().toISOString(),
      status_message: 'Processing completed successfully',
      step_name: 'COMPLETE',
    };

    setState(prev => ({
      ...prev,
      logs: [...prev.logs, completionLog],
      currentStage: 'COMPLETE',
      progress: 100,
      isProcessing: false,
    }));
  }, [generateLogId]);

  const failProcessing = useCallback((error: string) => {
    const errorLog: ProcessingLog = {
      id: generateLogId(),
      receipt_id: receiptIdRef.current || 'pending',
      created_at: new Date().toISOString(),
      status_message: `Processing failed: ${error}`,
      step_name: 'ERROR',
    };

    setState(prev => ({
      ...prev,
      logs: [...prev.logs, errorLog],
      currentStage: 'ERROR',
      progress: 100,
      isProcessing: false,
    }));
  }, [generateLogId]);

  const reset = useCallback(() => {
    receiptIdRef.current = null;
    setState(initialState);
  }, []);

  const actions: OpenRouterProgressActions = {
    startProcessing,
    addLog,
    completeProcessing,
    failProcessing,
    reset,
  };

  return [state, actions];
}

// Helper function to get stage-appropriate step names for OpenRouter processing
export const getOpenRouterStepName = (stage: 'init' | 'api' | 'processing' | 'save' | 'complete' | 'error'): string => {
  const stageMap = {
    init: 'START',
    api: 'AI',
    processing: 'PROCESSING',
    save: 'SAVE',
    complete: 'COMPLETE',
    error: 'ERROR',
  };
  return stageMap[stage];
};

// Helper function to get common messages for OpenRouter processing stages
export const getOpenRouterMessage = (stage: 'init' | 'api' | 'processing' | 'save' | 'complete' | 'error', detail?: string): string => {
  const messageMap = {
    init: detail || 'Initializing OpenRouter processing',
    api: detail || 'Processing with AI model',
    processing: detail || 'Extracting receipt data',
    save: detail || 'Saving processed data',
    complete: detail || 'Processing completed successfully',
    error: detail || 'Processing failed',
  };
  return messageMap[stage];
};
