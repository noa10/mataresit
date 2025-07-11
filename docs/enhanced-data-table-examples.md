# Enhanced Data Table Component Examples

This document demonstrates the enhanced capabilities of the DataTableComponent in the Mataresit chatbot interface.

## Features Added

### 1. Advanced Filtering
- **Global Search**: Search across all columns
- **Column-specific Filters**: Filter individual columns
- **Filter Toggle**: Show/hide filter controls
- **Clear Filters**: Reset all filters at once

### 2. Column Management
- **Column Visibility**: Show/hide specific columns
- **Responsive Design**: Horizontal scrolling on mobile
- **Column Alignment**: Left, center, right alignment support

### 3. Enhanced Styling
- **Improved Typography**: Better font weights and sizes
- **Zebra Striping**: Alternating row colors for better readability
- **Hover Effects**: Interactive row highlighting
- **Better Spacing**: Improved padding and margins

### 4. Mobile Responsiveness
- **Horizontal Scrolling**: Tables scroll horizontally on small screens
- **Responsive Controls**: Buttons adapt to screen size
- **Touch-friendly**: Larger touch targets on mobile

### 5. Enhanced Pagination
- **Page Numbers**: Visual page number buttons
- **First/Last**: Quick navigation to first/last page
- **Results Summary**: Clear indication of current view
- **Filter Awareness**: Shows filtered vs total results

## Example Data Structure

```json
{
  "type": "ui_component",
  "component": "data_table",
  "data": {
    "title": "Recent Receipts",
    "subtitle": "Your latest transactions",
    "columns": [
      {
        "key": "merchant",
        "label": "Merchant",
        "type": "text",
        "sortable": true,
        "filterable": true,
        "align": "left"
      },
      {
        "key": "date",
        "label": "Date",
        "type": "date",
        "sortable": true,
        "align": "left"
      },
      {
        "key": "amount",
        "label": "Amount",
        "type": "currency",
        "sortable": true,
        "align": "right"
      },
      {
        "key": "category",
        "label": "Category",
        "type": "badge",
        "sortable": false,
        "align": "center"
      }
    ],
    "rows": [
      {
        "id": "1",
        "merchant": "SUPER SEVEN CASH & CARRY",
        "date": "2024-01-15",
        "amount": 17.90,
        "category": "Groceries"
      },
      {
        "id": "2",
        "merchant": "TESCO EXTRA",
        "date": "2024-01-16",
        "amount": 45.60,
        "category": "Groceries"
      },
      {
        "id": "3",
        "merchant": "SHELL STATION",
        "date": "2024-01-17",
        "amount": 80.00,
        "category": "Fuel"
      }
    ],
    "searchable": true,
    "sortable": true,
    "pagination": true,
    "filterable": true,
    "currency": "MYR"
  },
  "metadata": {
    "title": "Receipt Summary Table",
    "interactive": true
  }
}
```

## Cell Type Formatting

### Currency
- Displays with proper currency symbol
- Monospace font for alignment
- Right-aligned by default

### Date
- Formatted as DD/MM/YYYY for Malaysian context
- Tooltip shows full date/time
- Sortable chronologically

### Badge
- Styled as colored badges
- Good for categories and status
- Compact display

### Number
- Formatted with thousand separators
- Monospace font for alignment
- Handles both integers and decimals

### Text
- Truncated with ellipsis if too long
- Tooltip shows full text on hover
- Searchable and filterable

## Performance Optimizations

- **Memoized Filtering**: Efficient filtering with useMemo
- **Memoized Sorting**: Optimized sorting operations
- **Virtual Scrolling**: Ready for large datasets
- **Lazy Loading**: Pagination reduces initial render time

## Accessibility Features

- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: Proper ARIA labels
- **High Contrast**: Works with dark/light themes
- **Focus Management**: Clear focus indicators

## Usage in Chat Responses

The enhanced data table automatically renders when the backend generates markdown tables or structured data. The LLM can now create more sophisticated data presentations that will be automatically converted to interactive tables.

Example LLM response that generates a data table:

```
I found 7 receipts matching "powercat":

| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| SUPER SEVEN CASH & CARRY | 16/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| SUPER SEVEN CASH & CARRY | 17/01/2024 | MYR 17.90 | POWERCAT 1.3KG |

All receipts are for the same product at the same price.
```

This markdown table will be automatically converted to an interactive DataTableComponent with sorting, filtering, and pagination capabilities.
