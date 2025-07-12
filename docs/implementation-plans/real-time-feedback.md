
Architectural plan for implementing real-time status updates for receipt processing:

**Goal:** Provide users with real-time feedback during receipt upload and backend processing (OCR, data enhancement).

**Core Concepts:**

1.  **Granular Status:** Introduce a detailed status field that tracks the receipt's journey beyond just `unreviewed`/`reviewed`/`synced`.
2.  **Client-Side Progress:** Track file upload progress directly in the browser.
3.  **Backend Status Updates:** Modify backend functions (Edge Functions) to report their stage of processing by updating the database.
4.  **Real-time Subscription:** Use Supabase Realtime to listen for database changes and update the UI accordingly.

**Implementation Plan:**

1.  **Database Schema Modification:**
    *   **Table:** `receipts`
    *   **Add Column:** `processing_status` (type: `text`, nullable: `true`). This will hold statuses like `uploading`, `uploaded`, `processing`, `processing_ai`, `failed`, `failed_ai`, `complete`.
    *   **Add Column:** `processing_error` (type: `text`, nullable: `true`). Stores error messages if processing fails at any step.
    *   *(Optional)* **Add Column:** `upload_progress` (type: `integer`, nullable: `true`). Could store upload percentage (0-100), though often managed transiently in the UI state.

2.  **Type Definitions (`src/types/receipt.ts`):**
    *   Define a `ProcessingStatus` enum or string literal union type:
        ```typescript
        export type ProcessingStatus =
          | 'uploading'
          | 'uploaded'
          | 'processing'
          | 'processing_ai'
          | 'failed'
          | 'failed_ai'
          | 'complete'
          | null; // Represents not started or finished old flow
        ```
    *   Update `Receipt`, `ReceiptWithDetails` interfaces to include:
        ```typescript
        processing_status?: ProcessingStatus;
        processing_error?: string | null;
        // Optional: upload_progress?: number | null; 
        ```

3.  **Receipt Service (`src/services/receiptService.ts`):**
    *   **`uploadReceiptImage`:**
        *   Modify the function signature to accept an optional progress callback: `(progress: number) => void`.
        *   Use the Supabase storage client's progress events (if available/suitable) or implement chunking to calculate and invoke the callback during upload.
        *   *Note:* Direct progress reporting from the standard `upload` might require adjustments or alternative upload strategies if the library doesn't expose it easily.
    *   **`createReceipt` (or a new initiating function):**
        *   When a receipt *starts* the upload process (before `uploadReceiptImage` is called), create the initial receipt record in the database with `processing_status: 'uploading'`. This ensures there's a record to update and subscribe to immediately.
        *   Return the `receiptId` early so the UI can start subscribing.
    *   **`processReceiptWithOCR`:**
        *   **Before calling `process-receipt` function:** Update the receipt's `processing_status` to `'processing_ocr'`.
        *   **Before calling `enhance-receipt-data` function:** Update the receipt's `processing_status` to `'processing_ai'`.
        *   **On final success:** Update the receipt's `processing_status` to `'complete'` and `status` to `'unreviewed'` (as it currently does).
        *   **On Error:** Catch errors from the Edge Function calls. Update `processing_status` to the relevant failure state (`'failed_ocr'`, `'failed_ai'`) and populate `processing_error` with details from the caught error.
    *   **New Function: `subscribeToReceiptUpdates`:**
        *   Create a function: `subscribeToReceiptUpdates(receiptId: string, callback: (payload: RealtimePostgresChangesPayload<Receipt>) => void): RealtimeChannel`.
        *   This function will use `supabase.channel(...)` and `.on('postgres_changes', ...)` to subscribe to updates on the `receipts` table for the specific `receiptId`.
        *   The callback will be invoked whenever the subscribed receipt row changes in the database.
        *   Return the channel instance so the UI can unsubscribe later.

4.  **Supabase Edge Functions (`process-receipt`, `enhance-receipt-data`):**
    *   *Modify both functions.*
    *   Accept the `receiptId` as input.
    *   **Crucially:** These functions *themselves* should **not** update the status *during* their execution (like "starting OCR"). That state transition should be handled by the *caller* (`processReceiptWithOCR` in the frontend service) *before* invoking the function. This simplifies the functions and centralizes status logic.
    *   **Error Handling:** Ensure functions throw meaningful errors upon failure, which will be caught by `processReceiptWithOCR` to update the status.

5.  **UI Components (e.g., React):**
    *   **Upload Component:**
        *   On file selection:
            *   Immediately call `createReceipt` (or the initiating function) to get a `receiptId` and set `processing_status: 'uploading'`.
            *   Use the `receiptId` to call `subscribeToReceiptUpdates`, passing a callback function (`handleStatusUpdate`).
            *   Call `uploadReceiptImage`, providing a progress callback (`handleUploadProgress`) that updates the local UI state (e.g., progress bar percentage).
        *   `handleUploadProgress(progress: number)`: Updates component state for the progress bar.
        *   `handleStatusUpdate(payload: RealtimePostgresChangesPayload<Receipt>)`: Updates component state based on `payload.new.processing_status` and `payload.new.processing_error`. Display appropriate messages ("Uploading...", "AI Processing...", "AI Analysis...", "Error: ...", "Complete").
        *   When `processing_status` becomes `'complete'` or a `'failed_*'` state, potentially update the UI permanently and consider unsubscribing from the channel.
        *   Implement cleanup: Unsubscribe from the Supabase channel when the component unmounts or the process is definitively finished/failed.
    *   **Receipt List/Details View:**
        *   Display the current `processing_status` or final `status` appropriately.
        *   Show error messages from `processing_error` if relevant.

**Workflow Summary:**

1.  **UI:** User selects file.
2.  **UI:** Calls service to create initial DB record (`processing_status: 'uploading'`), gets `receiptId`.
3.  **UI:** Starts subscription for `receiptId`.
4.  **UI:** Calls `uploadReceiptImage` with progress callback.
5.  **Service/UI:** Upload progresses, UI updates progress bar.
6.  **Service:** Upload completes, calls `processReceiptWithAI`.
7.  **Service:** Updates DB `processing_status: 'processing'`. (UI receives update via subscription).
8.  **Service:** Invokes `process-receipt` function.
9.  **(If successful) Service:** Updates DB `processing_status: 'processing_ai'`. (UI receives update).
10. **Service:** Invokes `enhance-receipt-data` function.
11. **(If successful) Service:** Updates DB `processing_status: 'complete'`, `status: 'unreviewed'`, etc. (UI receives update).
12. **(If error at any step) Service:** Catches error, updates DB `processing_status: 'failed_...'`, `processing_error: '...'`. (UI receives update).
13. **UI:** Unsubscribes when process finishes or component unmounts.

This architecture provides clear status updates by leveraging database changes and real-time subscriptions, while keeping the core processing logic relatively clean.
