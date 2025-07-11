/**
 * Navigation utilities for handling receipt navigation in same window or new window/tab
 */

/**
 * Opens a receipt in a new window/tab
 * @param receiptId - The receipt ID to navigate to
 * @param options - Additional options for navigation
 */
export function openReceiptInNewWindow(
  receiptId: string, 
  options: {
    from?: string;
    itemType?: string;
    openEditMode?: boolean;
    focusCategory?: boolean;
  } = {}
) {
  if (!receiptId || receiptId.trim() === '') {
    console.error('Cannot open receipt in new window: ID is undefined or empty', { receiptId });
    return;
  }

  // Validate that the ID looks like a valid UUID or receipt ID
  if (receiptId.length < 10) {
    console.error('Cannot open receipt in new window: ID appears invalid', { receiptId });
    return;
  }

  try {
    // Build the URL with state parameters as query params for new window
    const url = new URL(`/receipt/${receiptId}`, window.location.origin);
    
    // Add state information as query parameters since new windows can't receive React Router state
    if (options.from) {
      url.searchParams.set('from', options.from);
    }
    if (options.itemType) {
      url.searchParams.set('itemType', options.itemType);
    }
    if (options.openEditMode) {
      url.searchParams.set('openEditMode', 'true');
    }
    if (options.focusCategory) {
      url.searchParams.set('focusCategory', 'true');
    }

    console.log(`Opening receipt in new window: ${receiptId} (from ${options.from || 'unknown'})`);
    
    // Open in new window/tab
    const newWindow = window.open(url.toString(), '_blank', 'noopener,noreferrer');

    if (!newWindow) {
      console.warn('Failed to open new window - popup might be blocked');
      // Don't fallback to same-window navigation to preserve search context
      throw new Error('Unable to open new tab. Please check if popups are blocked and try again.');
    }
  } catch (error) {
    console.error('Error opening receipt in new window:', error);
  }
}

/**
 * Handles click events for receipt navigation with support for new window opening
 * @param event - The mouse event
 * @param receiptId - The receipt ID to navigate to
 * @param navigate - React Router navigate function for same-window navigation
 * @param options - Additional options for navigation
 */
export function handleReceiptClick(
  event: React.MouseEvent,
  receiptId: string,
  navigate: (path: string, options?: any) => void,
  options: {
    from?: string;
    itemType?: string;
    openEditMode?: boolean;
    focusCategory?: boolean;
  } = {}
) {
  // Check if user wants to open in new window/tab
  const shouldOpenInNewWindow = event.ctrlKey || event.metaKey || event.button === 1; // Ctrl/Cmd+click or middle click
  
  if (shouldOpenInNewWindow) {
    event.preventDefault();
    openReceiptInNewWindow(receiptId, options);
    return;
  }

  // Default behavior: navigate in same window
  if (!receiptId || receiptId.trim() === '') {
    console.error('Cannot navigate to receipt: ID is undefined or empty', { receiptId });
    return;
  }

  if (receiptId.length < 10) {
    console.error('Cannot navigate to receipt: ID appears invalid', { receiptId });
    return;
  }

  try {
    console.log(`Navigating to receipt: ${receiptId} (from ${options.from || 'unknown'})`);
    navigate(`/receipt/${receiptId}`, {
      state: {
        from: options.from || 'chat',
        itemType: options.itemType,
        openEditMode: options.openEditMode,
        focusCategory: options.focusCategory
      }
    });
  } catch (error) {
    console.error('Error navigating to receipt:', error);
  }
}

/**
 * Creates a context menu for receipt actions
 * @param receiptId - The receipt ID
 * @param merchantName - The merchant name for display
 * @param options - Navigation options
 * @returns Context menu items
 */
export function createReceiptContextMenu(
  receiptId: string,
  merchantName: string,
  navigate: (path: string, options?: any) => void,
  options: {
    from?: string;
    itemType?: string;
  } = {}
) {
  return [
    {
      label: 'Open in Same Window',
      action: () => {
        navigate(`/receipts/${receiptId}`, {
          state: {
            from: options.from || 'chat',
            itemType: options.itemType
          }
        });
      }
    },
    {
      label: 'Open in New Window',
      action: () => {
        openReceiptInNewWindow(receiptId, options);
      }
    },
    {
      label: 'Open in New Tab',
      action: () => {
        openReceiptInNewWindow(receiptId, options);
      }
    }
  ];
}
