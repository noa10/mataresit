# Dashboard Selection Fix Test Plan

## Issue Description
The dashboard's filtered period functionality prevents users from selecting receipts for deletion. When users apply date/period filters, the multi-select functionality becomes non-functional.

## Root Cause Analysis
1. **Selection state persistence**: `selectedReceiptIds` contained receipt IDs that were no longer visible after filtering
2. **Invalid "Select All" logic**: The checkbox state calculation `selectedReceiptIds.length === processedReceipts.length` became invalid when some selected receipts were filtered out
3. **No cleanup mechanism**: There was no useEffect to clean up selections when filters changed

## Fix Implementation

### 1. Added useEffect for Selection Cleanup
```typescript
// Clean up selected receipt IDs when filters change
// Remove any selected receipts that are no longer visible in the filtered results
useEffect(() => {
  if (selectedReceiptIds.length > 0) {
    const visibleReceiptIds = new Set(processedReceipts.map(receipt => receipt.id));
    const validSelectedIds = selectedReceiptIds.filter(id => visibleReceiptIds.has(id));
    
    // Only update if there's a difference to avoid unnecessary re-renders
    if (validSelectedIds.length !== selectedReceiptIds.length) {
      setSelectedReceiptIds(validSelectedIds);
    }
  }
}, [processedReceipts, selectedReceiptIds, setSelectedReceiptIds]);
```

### 2. Fixed "Select All" Checkbox Logic
```typescript
// Before (incorrect):
checked={selectedReceiptIds.length === processedReceipts.length && processedReceipts.length > 0}

// After (correct):
checked={processedReceipts.length > 0 && processedReceipts.every(receipt => selectedReceiptIds.includes(receipt.id))}
```

## Test Scenarios

### Test 1: Basic Selection with No Filters
1. Navigate to dashboard
2. Enable selection mode
3. Select multiple receipts
4. Verify checkboxes are checked and receipts show selection ring
5. Verify bulk actions are available

### Test 2: Selection with Date Filter Applied
1. Navigate to dashboard
2. Enable selection mode
3. Select multiple receipts (e.g., 5 receipts)
4. Apply a date filter that excludes some selected receipts
5. **Expected**: Only receipts still visible should remain selected
6. **Expected**: Selection count should update correctly
7. **Expected**: "Select All" checkbox should work correctly

### Test 3: Selection with Search Filter
1. Navigate to dashboard
2. Enable selection mode
3. Select multiple receipts from different merchants
4. Apply a search filter that excludes some selected receipts
5. **Expected**: Only matching receipts should remain selected
6. **Expected**: Bulk operations should work only on visible receipts

### Test 4: Selection with Category Filter
1. Navigate to dashboard
2. Enable selection mode
3. Select receipts from different categories
4. Apply a category filter
5. **Expected**: Only receipts in the selected category should remain selected

### Test 5: "Select All" Functionality
1. Navigate to dashboard
2. Apply any filter (date, search, category)
3. Enable selection mode
4. Click "Select All" checkbox
5. **Expected**: All visible (filtered) receipts should be selected
6. **Expected**: Checkbox should show checked state
7. Click "Select All" again to deselect
8. **Expected**: All receipts should be deselected

### Test 6: Bulk Delete with Filters
1. Navigate to dashboard
2. Apply a date filter
3. Enable selection mode
4. Select multiple visible receipts
5. Perform bulk delete
6. **Expected**: Only selected visible receipts should be deleted
7. **Expected**: No hidden/filtered receipts should be affected

## Expected Behavior After Fix
- ✅ Selection state is automatically cleaned when filters change
- ✅ Only visible receipts can be selected
- ✅ "Select All" works correctly with filtered results
- ✅ Bulk operations only affect visible selected receipts
- ✅ Selection UI accurately reflects current state
- ✅ No phantom selections of hidden receipts

## Files Modified
- `src/pages/Dashboard.tsx`: Added useEffect for selection cleanup and fixed "Select All" logic
