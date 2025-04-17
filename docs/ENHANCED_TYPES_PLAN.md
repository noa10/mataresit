# Plan: Enhance Receipt Type Definitions and Features (Simplified Thumbnails)

This plan outlines the steps to enhance receipt type definitions and implement related features, simplifying thumbnail generation to be frontend-only or skipped.

## 1. Define/Update Types (`src/types/receipt.ts`)

*   **Create `ReceiptUpload` Interface:** Define this new interface to manage the state of a file during the upload and initial processing phases.
    ```typescript
    export interface ReceiptUpload {
      id: string; // Unique ID for tracking the upload instance
      file: File; // The actual file object
      status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
      uploadProgress: number; // Percentage 0-100
      processingStage?: 'queueing' | 'ocr' | 'ai_enhancement' | 'categorization' | string;
      error?: {
        code: 'FILE_TYPE' | 'SIZE_LIMIT' | 'UPLOAD_FAILED' | 'PROCESSING_FAILED' | string;
        message: string;
      } | null;
    }
    ```
*   **Enhance `Receipt` Interface:** Add the new field for processing time.
    ```typescript
    export interface Receipt {
      // --- Existing Fields ---
      id: string;
      user_id: string;
      // ... other fields ...
      image_url: string; // Existing field, can be used for frontend thumbnail
      processing_status?: ProcessingStatus;
      processing_error?: string | null;
      // --- New Field ---
      processing_time?: number; // Time taken for backend processing (e.g., in seconds)
    }
    ```
*   **Enhance `ReceiptWithDetails` Interface:** Ensure consistency.
    ```typescript
    export interface ReceiptWithDetails extends Omit<Receipt, 'confidence_scores'> {
      // ... existing fields ...
      processing_time?: number; // Added
    }
    ```

## 2. Database Schema Changes (Supabase)

*   Modify the `receipts` table.
*   Add new column:
    *   `processing_time` (type: `float` or `integer`, nullable)
*   Create a new SQL migration file in `supabase/migrations/`.

## 3. Backend Processing Updates (Supabase Function: `process-receipt`)

*   **Target Function:** `supabase/functions/process-receipt/index.ts`.
*   **Calculate `processing_time`:** Record start/end time and calculate duration.
*   **Save Data:** Update the Supabase database record to include the calculated `processing_time`.

## 4. Frontend Upload Logic Updates (`useFileUpload.ts` / `UploadZone.tsx`)

*   **State Management:** Manage a list/map of `ReceiptUpload` objects.
*   **Update State:** Update `status`, `uploadProgress`, `processingStage`, `error` based on upload events and backend feedback (real-time/polling).

## 5. Frontend Data Fetching Updates (`receiptService.ts`)

*   Modify functions fetching receipts to include `processing_time` in the `select()` statement.

## 6. Frontend UI Display Updates

*   **Upload Zone (`src/components/UploadZone.tsx`):** Display detailed status/progress/stage/errors using `ReceiptUpload` state.
*   **Receipt Lists/Cards (`src/components/ReceiptCard.tsx`, `src/pages/Dashboard.tsx`):** *Optional:* Add logic to display a thumbnail generated client-side from the `image_url`.
*   **Receipt Detail View (`src/components/ReceiptViewer.tsx`, `src/pages/ViewReceipt.tsx`):** Display the `processing_time`. *Optional:* Add logic for client-side thumbnail display from `image_url`.

## 7. Type Safety Check

*   Run `tsc --noEmit` or use IDE checks to resolve TypeScript errors.

## Diagram: Simplified Flow

```mermaid
sequenceDiagram
    participant User
    participant FE (UploadZone/Hook)
    participant Supabase Storage
    participant Supabase DB
    participant Supabase Func (process-receipt)

    User->>FE (UploadZone/Hook): Selects file
    FE (UploadZone/Hook)->>FE (UploadZone/Hook): Create ReceiptUpload state (status: pending)
    FE (UploadZone/Hook)->>Supabase Storage: Start upload
    activate Supabase Storage
    Supabase Storage-->>FE (UploadZone/Hook): Progress update
    FE (UploadZone/Hook)-->>FE (UploadZone/Hook): Update ReceiptUpload state (status: uploading, progress: X%)
    Supabase Storage-->>FE (UploadZone/Hook): Upload complete (image_url)
    deactivate Supabase Storage
    FE (UploadZone/Hook)-->>FE (UploadZone/Hook): Update ReceiptUpload state (status: processing, stage: queueing?)
    FE (UploadZone/Hook)->>Supabase DB: Create/update receipt record (initial data, processing_status: uploading/processing_ocr)
    activate Supabase DB
    Supabase DB-->>Supabase Func (process-receipt): Trigger function
    deactivate Supabase DB
    activate Supabase Func (process-receipt)
    Note over Supabase Func (process-receipt): Start timer, process data (OCR, AI)
    Note over Supabase Func (process-receipt): Stop timer, calculate processing_time
    Supabase Func (process-receipt)->>Supabase DB: Update receipt record (full data, status: complete, processing_time)
    activate Supabase DB
    Supabase DB-->>Supabase Func (process-receipt): Confirm update
    deactivate Supabase DB
    deactivate Supabase Func (process-receipt)
    alt Real-time
        Supabase DB-->>FE (UploadZone/Hook): Push update via subscription
        FE (UploadZone/Hook)-->>FE (UploadZone/Hook): Update ReceiptUpload state (status: completed)
    else Polling
        FE (UploadZone/Hook)->>Supabase DB: Poll for final status
        Supabase DB-->>FE (UploadZone/Hook): Return final data
        FE (UploadZone/Hook)-->>FE (UploadZone/Hook): Update ReceiptUpload state (status: completed)
    end
    FE (UploadZone/Hook)-->>User: Show final status/receipt details