# Plan: Fix Confidence Score Display on Dashboard

## 1. Problem Statement

The confidence score indicator on the receipt cards in the dashboard currently displays zero ("0%"). This is because the backend (`supabase/functions/process-receipt/index.ts`) saves the calculated confidence scores for individual fields into a separate database table (`confidence_scores`), while the frontend (`src/pages/Dashboard.tsx`) expects these scores to be available within a `confidence_scores` JSONB field directly on the main `Receipt` object fetched from the `receipts` table. This data location mismatch causes the frontend calculation to fail and default to zero.

## 2. Proposed Solution

Modify the backend data storage mechanism to align with the frontend's expectation. Store the calculated confidence scores directly within the `receipts` table as a JSONB column.

## 3. Implementation Steps

### 3.1. Database Schema Change
   - **Action:** Add a new column named `confidence_scores` to the `receipts` table. The column type must be `JSONB`.
   - **Rationale:** Aligns the database structure with the `Receipt` type definition used by the frontend.
   - **Optional Cleanup:** After confirming the fix and data integrity, consider creating a database migration script to remove the now-redundant `confidence_scores` table.

### 3.2. Backend Function Modification (`supabase/functions/process-receipt/index.ts`)
   - **Action 1:** Locate the preparation of the `updateData` object within the main `serve` function (around line 755). Add the `extractedData.confidence` object (which holds the scores calculated by `calculateFieldConfidence`) as a new field within `updateData`.
     ```typescript
     // Example modification within the serve function:
     const updateData: Record<string, any> = {
       // ... other fields like merchant, date, total ...
       processing_status: 'complete',
       processing_time: extractedData.processing_time,
       updated_at: new Date().toISOString(),
       model_used: extractedData.modelUsed,
       primary_method: extractedData.primaryMethod,
       has_alternative_data: !!extractedData.alternativeResult,
       discrepancies: extractedData.discrepancies || [],
       // ADD THIS LINE:
       confidence_scores: extractedData.confidence
     };
     ```
   - **Action 2:** Remove or comment out the entire code block responsible for inserting or updating records in the separate `confidence_scores` table (approximately lines 846-895).
   - **Rationale:** Ensures scores are saved directly to the `receipts` table and eliminates redundant database operations.

### 3.3. Frontend Verification (`src/services/receiptService.ts`)
   - **Action:** Review the `fetchReceipts` function. Confirm that it selects the `confidence_scores` column when querying the `receipts` table. If it uses `select('*')`, no change is needed. If it specifies columns, add `confidence_scores` to the selection list.
   - **Rationale:** Ensures the frontend service retrieves the necessary data column.

## 4. Confidence Calculation Logic

The existing `calculateFieldConfidence` function (lines 570-639 in `process-receipt/index.ts`), which applies custom heuristics and adjustments to the base Textract confidence scores, will be kept as is per the discussion. The frontend's `calculateAggregateConfidence` function will continue to calculate the overall displayed score based on the individual field scores now correctly provided in `receipt.confidence_scores`.

## 5. Diagram of Proposed Flow

```mermaid
graph TD
    subgraph Backend (process-receipt/index.ts)
        A[Receive Image] --> B(Call Textract AnalyzeExpense);
        B --> C{Extract Fields &amp; Base Confidence};
        C --> D(Call calculateFieldConfidence - Kept As Is);
        D --> E{Merge with AI Data (Optional)};
        E --> F[Prepare updateData for 'receipts' table];
        F --> G[Add confidence object to updateData];
        G --> H[Update 'receipts' table (incl. confidence_scores JSONB)];
        H --> I[Processing Complete];
        J(Remove Save to 'confidence_scores' table);
        H --> J;
    end

    subgraph Frontend
        K[Dashboard Mounts] --> L(Call fetchReceipts);
        L --> M[Fetch from 'receipts' table (selecting confidence_scores column)];
        M --> N[Receive Receipt[] data with confidence_scores];
        N --> O[Call calculateAggregateConfidence(receipt)];
        O --> P[Display Score in ReceiptCard];
    end

    style H fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#ccf,stroke:#333,stroke-width:2px
    style M fill:#ccf,stroke:#333,stroke-width:2px
    style J fill:#f9f,stroke:#333,stroke-width:2px