# UI/UX Improvement Plan (Refined)

Based on a review of the codebase (`README.md`, `ReceiptViewer.tsx`, `Index.tsx`, `SettingsPage.tsx`, `ReceiptProcessingOptions.tsx`, `receiptService.ts`, `Navbar.tsx`, `main.tsx`, `lib/theme.ts`), the proposed UI/UX improvements are highly feasible within the current project structure (React, TypeScript, shadcn/ui, Supabase).

## Detailed Assessment & Implementation Steps

### 1. Enable "History" Button in ReceiptViewer

*   **Assessment:** Feasible. `processing_logs` fetching exists. `corrections` table and `logCorrections` function exist. Needs a function to fetch corrections.
*   **Implementation:**
    *   Add a "View History" `<Button>` with the `History` icon to `ReceiptViewer.tsx`.
    *   Add state to `ReceiptViewer.tsx` to manage the visibility of a history modal/drawer (e.g., `isHistoryModalOpen`).
    *   Create a new component `ReceiptHistoryModal.tsx` (using `Dialog` or `Sheet` from `shadcn/ui`).
    *   **Add a new function `fetchCorrections(receiptId)` to `src/services/receiptService.ts`** to retrieve data from the `corrections` table for the given receipt.
    *   Inside `ReceiptHistoryModal`, fetch and display both `processing_logs` (passed as props or fetched) and the newly fetched `corrections` data in a timeline format (potentially using a sub-component like `HistoryTimeline`).
*   **Diagram:**
    ```mermaid
    graph TD
        A[ReceiptViewer] -- Click History Button --> B{handleViewHistory};
        B -- Set State --> C[Show ReceiptHistoryModal];
        C -- Fetch Data --> D(receiptService.fetchCorrections);
        D -- Corrections Data --> C;
        C -- Display --> E[Timeline View (Logs + Corrections)];
    ```

### 2. Update Frontpage Content (`Index.tsx`)

*   **Assessment:** Feasible. The page structure is straightforward.
*   **Implementation:**
    *   Modify text content in the hero section (`h1`, `p`).
    *   Update text in the three existing feature cards.
    *   Add two new feature card sections (copying the structure) for "AI Enhancement" and "Confidence Scoring", updating icons and text.
    *   Add a new "How It Works" section with text and icons.
    *   Add a new "Sample Receipt Demo" section using static `shadcn/ui` components to illustrate the UI features.

### 3. Fix Settings Page (`SettingsPage.tsx`)

*   **Assessment:** Feasible. The current page is basic and easily modifiable.
*   **Implementation:**
    *   Import and add the `Navbar` component.
    *   Restructure the UI, potentially using `Tabs` ("Processing", "Usage Statistics").
    *   Expand descriptions for processing methods either by adding text directly to `SettingsPage.tsx` or enhancing the tooltips in `ReceiptProcessingOptions.tsx`.
    *   Implement a confirmation dialog (`AlertDialog`) for the "Reset to Defaults" button.
    *   Integrate the `UsageStatsPanel` component (see item 4).

### 4. Add Usage Statistics for Processing Methods

*   **Assessment:** Feasible. Requires data aggregation.
*   **Implementation:**
    *   Create a new component `UsageStatsPanel.tsx`.
    *   **Add new data aggregation functions to `src/services/receiptService.ts`** (e.g., `fetchUsageStats()` that queries `receipts` and potentially `processing_logs` tables, possibly using Supabase RPC for efficiency).
    *   Use chart components (e.g., `Chart` from `shadcn/ui` wrapping `recharts`) within `UsageStatsPanel` to display the fetched statistics.
    *   Include `UsageStatsPanel` in the restructured `SettingsPage.tsx` (e.g., in a dedicated tab).
*   **Diagram:**
    ```mermaid
    graph TD
        A[SettingsPage] -- Renders --> B[UsageStatsPanel];
        B -- Fetch Data --> C(receiptService.fetchUsageStats);
        C -- Query --> D[(Supabase DB: receipts, processing_logs)];
        D -- Aggregated Stats --> C;
        C -- Stats Data --> B;
        B -- Display --> E[Charts & Stats];
    ```

### 5. Dark Mode Toggle Enhancement

*   **Assessment:** Feasible. Basic theme logic exists in `lib/theme.ts`.
*   **Implementation:**
    *   **Add a `toggleTheme()` function to `src/lib/theme.ts`** that adds/removes the 'dark' class on `document.documentElement` and updates `localStorage.theme`.
    *   Add a theme toggle `<Button>` (using `Sun`/`Moon` icons) to `Navbar.tsx` in both desktop (near user avatar) and mobile views (within the slide-out menu).
    *   Call the new `toggleTheme()` function on button click.
    *   Thoroughly test all components in both light and dark modes for visual consistency and contrast.

## Refined Implementation Timeline

*   **Week 1:**
    *   Implement `ReceiptHistoryModal` & `fetchCorrections` service function.
    *   Integrate History button into `ReceiptViewer`.
    *   Add `Navbar` to `SettingsPage`.
    *   Restructure `SettingsPage` UI & add descriptions/reset confirmation.
    *   Implement `toggleTheme` function & add toggle button to `Navbar`.
*   **Week 2:**
    *   Implement `UsageStatsPanel` & `fetchUsageStats` service function.
    *   Integrate `UsageStatsPanel` into `SettingsPage`.
    *   Update `Index.tsx` content.
    *   Test dark/light mode consistency.