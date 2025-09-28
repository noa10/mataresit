import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { 
  backgroundSaveService, 
  SaveOperation, 
  SaveQueueStatus, 
  SaveStatusEvent,
  SaveStatusListener 
} from '@/services/backgroundSaveService';
import { ReceiptWithDetails, ReceiptLineItem } from '@/types/receipt';

// Context state interface
interface SaveStatusState {
  operations: Map<string, SaveOperation>;
  queueStatus: SaveQueueStatus;
  isProcessing: boolean;
}

// Context actions
type SaveStatusAction =
  | { type: 'SET_OPERATIONS'; operations: Map<string, SaveOperation> }
  | { type: 'UPDATE_OPERATION'; operation: SaveOperation }
  | { type: 'REMOVE_OPERATION'; operationId: string }
  | { type: 'SET_QUEUE_STATUS'; status: SaveQueueStatus }
  | { type: 'SET_PROCESSING'; isProcessing: boolean };

// Context interface
interface SaveStatusContextType {
  state: SaveStatusState;
  // Actions
  saveReceipt: (
    receiptId: string,
    receiptData: Partial<ReceiptWithDetails>,
    lineItems?: ReceiptLineItem[],
    options?: {
      maxRetries?: number;
      onSuccess?: (result: any) => void;
      onError?: (error: Error) => void;
    }
  ) => string;
  retryOperation: (operationId: string) => boolean;
  cancelOperation: (operationId: string) => boolean;
  clearCompletedOperations: () => void;
  getOperationForReceipt: (receiptId: string) => SaveOperation | null;
  // Status queries
  isReceiptSaving: (receiptId: string) => boolean;
  getReceiptSaveStatus: (receiptId: string) => 'idle' | 'saving' | 'saved' | 'failed';
  hasFailedOperations: () => boolean;
  hasPendingOperations: () => boolean;
}

// Initial state
const initialState: SaveStatusState = {
  operations: new Map(),
  queueStatus: {
    totalOperations: 0,
    pendingOperations: 0,
    processingOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
  },
  isProcessing: false,
};

// Reducer
function saveStatusReducer(state: SaveStatusState, action: SaveStatusAction): SaveStatusState {
  switch (action.type) {
    case 'SET_OPERATIONS':
      return {
        ...state,
        operations: action.operations,
      };

    case 'UPDATE_OPERATION':
      const newOperations = new Map(state.operations);
      newOperations.set(action.operation.id, action.operation);
      return {
        ...state,
        operations: newOperations,
      };

    case 'REMOVE_OPERATION':
      const updatedOperations = new Map(state.operations);
      updatedOperations.delete(action.operationId);
      return {
        ...state,
        operations: updatedOperations,
      };

    case 'SET_QUEUE_STATUS':
      return {
        ...state,
        queueStatus: action.status,
        isProcessing: action.status.processingOperations > 0,
      };

    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.isProcessing,
      };

    default:
      return state;
  }
}

// Create context
const SaveStatusContext = createContext<SaveStatusContextType | null>(null);

// Provider component
export function SaveStatusProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(saveStatusReducer, initialState);

  // Handle save service events
  const handleSaveEvent: SaveStatusListener = useCallback((event: SaveStatusEvent) => {
    switch (event.type) {
      case 'OPERATION_ADDED':
      case 'OPERATION_STARTED':
      case 'OPERATION_COMPLETED':
      case 'OPERATION_FAILED':
      case 'OPERATION_RETRYING':
        // For all operation events, get the updated operation from the service
        const operation = backgroundSaveService.getOperation(
          'operationId' in event ? event.operationId : event.operation.id
        );
        if (operation) {
          dispatch({ type: 'UPDATE_OPERATION', operation });
        }
        break;

      case 'QUEUE_STATUS_CHANGED':
        dispatch({ type: 'SET_QUEUE_STATUS', status: event.status });
        break;
    }
  }, []);

  // Set up event listener
  useEffect(() => {
    backgroundSaveService.addListener(handleSaveEvent);
    
    // Initialize with current queue status
    const currentStatus = backgroundSaveService.getQueueStatus();
    dispatch({ type: 'SET_QUEUE_STATUS', status: currentStatus });

    return () => {
      backgroundSaveService.removeListener(handleSaveEvent);
    };
  }, [handleSaveEvent]);

  // Context actions
  const saveReceipt = useCallback((
    receiptId: string,
    receiptData: Partial<ReceiptWithDetails>,
    lineItems?: ReceiptLineItem[],
    options?: {
      maxRetries?: number;
      onSuccess?: (result: any) => void;
      onError?: (error: Error) => void;
    }
  ): string => {
    return backgroundSaveService.addSaveOperation(receiptId, receiptData, lineItems, options);
  }, []);

  const retryOperation = useCallback((operationId: string): boolean => {
    return backgroundSaveService.retryOperation(operationId);
  }, []);

  const cancelOperation = useCallback((operationId: string): boolean => {
    const success = backgroundSaveService.cancelOperation(operationId);
    if (success) {
      dispatch({ type: 'REMOVE_OPERATION', operationId });
    }
    return success;
  }, []);

  const clearCompletedOperations = useCallback(() => {
    backgroundSaveService.clearCompletedOperations();
    // Update local state by removing completed/failed operations
    const newOperations = new Map();
    for (const [id, operation] of state.operations) {
      if (operation.status !== 'completed' && operation.status !== 'failed') {
        newOperations.set(id, operation);
      }
    }
    dispatch({ type: 'SET_OPERATIONS', operations: newOperations });
  }, [state.operations]);

  const getOperationForReceipt = useCallback((receiptId: string): SaveOperation | null => {
    // Find the most recent operation for this receipt
    let latestOperation: SaveOperation | null = null;
    let latestTimestamp = 0;

    for (const operation of state.operations.values()) {
      if (operation.receiptId === receiptId && operation.timestamp > latestTimestamp) {
        latestOperation = operation;
        latestTimestamp = operation.timestamp;
      }
    }

    return latestOperation;
  }, [state.operations]);

  const isReceiptSaving = useCallback((receiptId: string): boolean => {
    const operation = getOperationForReceipt(receiptId);
    return operation ? (operation.status === 'pending' || operation.status === 'processing') : false;
  }, [getOperationForReceipt]);

  const getReceiptSaveStatus = useCallback((receiptId: string): 'idle' | 'saving' | 'saved' | 'failed' => {
    const operation = getOperationForReceipt(receiptId);
    if (!operation) return 'idle';

    switch (operation.status) {
      case 'pending':
      case 'processing':
        return 'saving';
      case 'completed':
        return 'saved';
      case 'failed':
        return 'failed';
      default:
        return 'idle';
    }
  }, [getOperationForReceipt]);

  const hasFailedOperations = useCallback((): boolean => {
    return state.queueStatus.failedOperations > 0;
  }, [state.queueStatus.failedOperations]);

  const hasPendingOperations = useCallback((): boolean => {
    return state.queueStatus.pendingOperations > 0 || state.queueStatus.processingOperations > 0;
  }, [state.queueStatus.pendingOperations, state.queueStatus.processingOperations]);

  const contextValue: SaveStatusContextType = {
    state,
    saveReceipt,
    retryOperation,
    cancelOperation,
    clearCompletedOperations,
    getOperationForReceipt,
    isReceiptSaving,
    getReceiptSaveStatus,
    hasFailedOperations,
    hasPendingOperations,
  };

  return (
    <SaveStatusContext.Provider value={contextValue}>
      {children}
    </SaveStatusContext.Provider>
  );
}

// Hook to use the save status context
export function useSaveStatus(): SaveStatusContextType {
  const context = useContext(SaveStatusContext);
  if (!context) {
    throw new Error('useSaveStatus must be used within a SaveStatusProvider');
  }
  return context;
}

// Convenience hooks for common use cases
export function useReceiptSaveStatus(receiptId: string) {
  const { isReceiptSaving, getReceiptSaveStatus, getOperationForReceipt } = useSaveStatus();
  
  return {
    isSaving: isReceiptSaving(receiptId),
    status: getReceiptSaveStatus(receiptId),
    operation: getOperationForReceipt(receiptId),
  };
}

export function useQueueStatus() {
  const { state } = useSaveStatus();
  return {
    queueStatus: state.queueStatus,
    isProcessing: state.isProcessing,
  };
}
