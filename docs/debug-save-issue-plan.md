# Debugging Plan: Fixing Receipt Save Issues

This plan outlines the steps to diagnose and fix the bug preventing edited receipt data from being saved to the database.

**Relevant Files:**

*   `src/pages/ViewReceipt.tsx`
*   `src/services/receiptService.ts`
*   `src/components/ReceiptViewer.tsx`

**Potential Problem Areas:**

1.  **Data Formatting/Type Issues:** Errors converting user input (strings) to expected database types (numbers, dates).
2.  **Supabase Update Logic (`updateReceipt`):** Issues with the update payload, hardcoded status, or line item update strategy (delete then insert).
3.  **`logCorrections` Function:** Errors during correction logging potentially halting the save process.
4.  **Database Schema/RLS:** Incorrect table definitions or restrictive Row Level Security policies in Supabase.
5.  **Confidence Score Handling:** Conflicts between frontend state and backend expectations for saving confidence scores.

**Debugging Steps:**

1.  **Trace Data Flow with Logging:**
    *   Add detailed `console.log` statements in `ReceiptViewer.tsx` (`handleSaveChanges`) and `receiptService.ts` (`updateReceipt`) to track data before sending and upon receiving, and right before database calls.
2.  **Isolate `logCorrections`:**
    *   Temporarily comment out the call to `logCorrections()` within `receiptService.ts`.
    *   Attempt to save again. If successful, the bug is likely within `logCorrections`.
3.  **Review `updateReceipt` Payload:**
    *   Compare editable UI fields with the `updateData` object in `receiptService.ts`. Ensure all necessary fields are included.
4.  **Examine Supabase Configuration:**
    *   Review Supabase table schemas (`receipts`, `line_items`, `corrections`) for type/constraint mismatches.
    *   Check RLS policies for `UPDATE` (`receipts`/`line_items`) and `INSERT` (`corrections`).
5.  **Clarify Confidence Score Logic:**
    *   Review how confidence scores are intended to be saved.
    *   Adjust or remove client-side confidence handling in `ReceiptViewer.tsx` if it conflicts with the backend.

**Update Flow Diagram:**

```mermaid
sequenceDiagram
    participant RV as ReceiptViewer.tsx
    participant RS as receiptService.ts
    participant DB as Supabase DB

    RV->>RV: User edits data (updates local state)
    RV->>RV: User clicks "Save Changes"
    RV->>RV: handleSaveChanges()
    RV->>RV: updateMutation.mutate()
    RV->>RS: updateReceipt(id, receiptData, lineItems)
    RS->>RS: logCorrections(id, receiptData) # Step 2: Temporarily disable this
    RS->>DB: SELECT original data (for logCorrections)
    DB-->>RS: Original data
    RS->>DB: INSERT INTO corrections # Potential failure point
    DB-->>RS: Insert result
    RS->>RS: Prepare updateData object # Step 3: Verify fields
    RS->>DB: UPDATE receipts SET ... # Step 4: Check Schema/RLS
    DB-->>RS: Update result
    alt lineItems provided
        RS->>DB: DELETE FROM line_items # Step 4: Check Schema/RLS
        DB-->>RS: Delete result
        RS->>DB: INSERT INTO line_items # Step 4: Check Schema/RLS
        DB-->>RS: Insert result
    end
    RS-->>RV: Update result (success/error)
    RV->>RV: Show toast / Handle error
    RV->>RV: Invalidate Cache
    RV->>RS: fixProcessingStatus() (on success)