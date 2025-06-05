# Batch Upload Implementation Plan

## Overview

This document outlines the implementation plan for adding batch upload functionality to the receipt processing application. Batch upload will allow users to upload multiple receipt files at once, track their processing status individually, and efficiently manage large numbers of receipts.

## Current System Analysis

The current upload system:
- Allows uploading a single receipt at a time
- Uses a drag-and-drop interface via `UploadZone.tsx`
- Processes receipts through Supabase Edge Functions
- Tracks processing status in real-time
- Provides visual feedback on upload and processing progress

## Implementation Goals

1. Enable users to select and upload multiple files simultaneously
2. Display a queue of files with individual status tracking
3. Process multiple receipts in parallel
4. Provide clear visual feedback on batch progress
5. Allow cancellation of pending uploads
6. Maintain compatibility with existing receipt processing workflow

## Technical Implementation Plan

### 1. Frontend Components

#### 1.1 Enhance `useFileUpload` Hook

Modify the existing hook to:
- Support multiple file selection and tracking
- Maintain a queue of files to be uploaded
- Track individual file status and progress
- Add methods for queue management (remove, reorder, etc.)

```typescript
// Enhanced hook functionality
const {
  receiptUploads,          // Array of all uploads with status
  queuedUploads,           // Files waiting to be processed
  activeUploads,           // Files currently being processed
  completedUploads,        // Successfully processed files
  failedUploads,           // Failed uploads
  addToQueue,              // Add files to the queue
  removeFromQueue,         // Remove a file from the queue
  clearQueue,              // Clear all pending uploads
  startBatchUpload,        // Start processing the queue
  cancelUpload,            // Cancel a specific upload
  pauseBatchProcessing,    // Pause the batch processing
  resumeBatchProcessing,   // Resume the batch processing
} = useBatchFileUpload(options);
```

#### 1.2 Create New `BatchUploadZone` Component

Create a new component that extends the current `UploadZone` functionality:

```typescript
// src/components/BatchUploadZone.tsx
import { useBatchFileUpload } from "@/hooks/useBatchFileUpload";

export default function BatchUploadZone({ onUploadComplete }) {
  // Implementation details...
}
```

Key features:
- File queue display with individual status indicators
- Batch progress summary (e.g., "3/10 complete")
- Controls for queue management (remove, cancel, retry)
- Settings for batch processing (concurrency, etc.)

#### 1.3 Create `UploadQueueItem` Component

A component to display individual files in the queue:

```typescript
// src/components/upload/UploadQueueItem.tsx
export function UploadQueueItem({ 
  upload, 
  onRemove, 
  onCancel, 
  onRetry 
}) {
  // Implementation details...
}
```

#### 1.4 Create `BatchProcessingControls` Component

Controls for managing the batch upload process:

```typescript
// src/components/upload/BatchProcessingControls.tsx
export function BatchProcessingControls({
  totalFiles,
  completedFiles,
  failedFiles,
  isProcessing,
  onStartProcessing,
  onPauseProcessing,
  onClearQueue
}) {
  // Implementation details...
}
```

### 2. Backend Services

#### 2.1 Enhance `receiptService.ts`

Extend the existing service to support batch operations:

```typescript
// Enhanced receipt service functions
export const uploadMultipleReceiptImages = async (
  files: File[],
  userId: string,
  onProgress?: (fileId: string, progress: number) => void
): Promise<Array<{ fileId: string, imageUrl: string | null, error?: string }>> => {
  // Implementation details...
};

export const createMultipleReceipts = async (
  receipts: Array<Omit<Receipt, "id" | "created_at" | "updated_at">>
): Promise<Array<{ receiptData: Receipt | null, error?: string }>> => {
  // Implementation details...
};

// Use existing processBatchReceipts function
```

#### 2.2 Optimize Supabase Edge Functions

Ensure the Supabase functions can handle concurrent requests efficiently:

- Add rate limiting and queuing in the Edge Functions
- Optimize resource usage for parallel processing
- Implement proper error handling for batch operations

### 3. State Management

#### 3.1 Create `useBatchUpload` Hook

A specialized hook for managing batch upload state:

```typescript
// src/hooks/useBatchUpload.ts
export function useBatchUpload(options?: {
  maxConcurrent?: number;
  autoStart?: boolean;
}) {
  // Implementation details...
}
```

#### 3.2 Batch Processing Logic

Implement the core logic for processing multiple files:

```typescript
// Process files in batches with controlled concurrency
const processBatch = async (files: ReceiptUpload[], maxConcurrent: number) => {
  // Process up to maxConcurrent files at a time
  // Track progress for each file
  // Handle success/failure for each file
  // Continue until queue is empty
};
```

### 4. User Interface Enhancements

#### 4.1 Batch Upload Modal

Create a modal for batch upload operations:

```typescript
// src/components/modals/BatchUploadModal.tsx
export function BatchUploadModal({ isOpen, onClose }) {
  // Implementation details...
}
```

#### 4.2 Dashboard Integration

Add batch upload functionality to the dashboard:

- Add a "Batch Upload" button next to the existing upload button
- Show batch progress indicator when a batch is being processed
- Display recently uploaded batch items

### 5. Notifications and Feedback

Enhance the notification system to support batch operations:

- Summary notifications (e.g., "5/10 receipts processed successfully")
- Grouped notifications for similar errors
- Batch completion notification with success/failure counts

## Implementation Phases

### Phase 1: Core Functionality

1. Create the enhanced file upload hook
2. Implement the basic batch upload UI
3. Extend receipt service for multiple file uploads
4. Add basic queue management

### Phase 2: User Experience Improvements

1. Add detailed progress tracking
2. Implement pause/resume functionality
3. Create error recovery mechanisms
4. Add batch settings (concurrency, etc.)

### Phase 3: Optimization and Polish

1. Optimize parallel processing
2. Add advanced queue management
3. Implement batch analytics
4. Polish UI animations and transitions

## Technical Considerations

### Concurrency Management

- Default to processing 3 receipts concurrently
- Allow users to adjust concurrency based on their needs
- Implement backoff strategy for API rate limits

### Error Handling

- Categorize errors (network, validation, processing)
- Provide retry mechanisms for transient errors
- Preserve queue state on page refresh/navigation

### Performance Optimization

- Use web workers for client-side queue management
- Implement efficient progress tracking
- Optimize memory usage for large batches

## API Changes

No changes to the database schema are required, as the existing tables and fields can support batch operations. The implementation will leverage the existing `processBatchReceipts` function in the receipt service.

## Testing Strategy

1. Unit tests for batch processing logic
2. Integration tests for queue management
3. End-to-end tests for complete batch upload flow
4. Performance tests with various batch sizes

## Conclusion

The batch upload functionality will significantly improve the efficiency of receipt processing for users who need to upload multiple receipts regularly. By implementing a robust queue management system and optimizing parallel processing, we can provide a smooth and reliable experience even for large batches of receipts.
