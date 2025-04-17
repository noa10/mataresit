# Plan to Address UI/UX Issues (Revision 3 - Updated)

This plan outlines the steps taken to fix several UI/UX issues in the `paperless-maverick` application, primarily within the `ReceiptViewer` component.

## 1. Date Picker & Other Input Icon Colors (`ReceiptViewer.tsx`) - DONE

*   **Issue:** Icons (Calendar, DollarSign, CreditCard) inside input fields were hard to see in dark mode.
*   **Applied Fix:** Modified the `className` for the `Calendar`, `DollarSign`, and `CreditCard` icons. Added `dark:text-blue-200` to set a specific, brighter text color for dark mode, while keeping the default `text-muted-foreground` for light mode.

## 2. Confidence Score Display Issue (`ReceiptViewer.tsx`) - DONE (Client-side Update)

*   **Issue:** Confidence scores consistently displayed as 0%, even after OCR processing. Scores did not update when fields were manually edited.
*   **Applied Fix:**
    *   Corrected the `getConfidenceColor` function to properly handle potential decimal values (0.0-1.0) and convert them to percentages for display.
    *   Modified the `handleInputChange` function: when a user manually edits a field (e.g., Merchant, Date, Total), the confidence score for that specific field is now set to 100% in the UI state to reflect user verification.
    *   *Note: This addresses the UI display. The initial 0% might still indicate an issue with scores coming from the backend/OCR process, which may require further investigation if initial non-zero scores are desired.*

## 3. Field Alignment (`ReceiptViewer.tsx`) - DONE

*   **Issue:** Payment Method field didn't align horizontally with the Currency field.
*   **Applied Fix:** Adjusted the grid layout for the Currency and Payment Method fields. Removed the non-existent confidence score display from the Currency field, ensuring consistent structure and alignment between the two columns.

## 4. Image Viewer Zoom/Rotation (`ReceiptViewer.tsx`) - DONE

*   **Issue:** The previous image viewer had problems with scrolling when zoomed/rotated, and the full image wasn't always viewable.
*   **Applied Fix:**
    *   Replaced the custom image viewer implementation with the `react-image-pan-zoom-rotate` library.
    *   Installed the necessary package (`npm install react-image-pan-zoom-rotate`).
    *   Integrated the `<ReactPanZoom>` component into the `ReceiptViewer`, passing the image URL.
    *   Implemented error handling using a `useEffect` hook and the native `Image` object's `onerror` event to detect image loading failures and display an appropriate error message, as the library didn't expose a direct `onError` prop.
    *   Ensured the component container uses the full height available (`h-full`) for proper display within its parent.