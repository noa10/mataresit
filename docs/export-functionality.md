# Export Functionality Documentation

## Overview

The dashboard now includes comprehensive export functionality that allows users to export their receipt data in three different formats: CSV, Excel, and PDF. The export feature respects all active filters and provides detailed, formatted output.

## Features

### Export Formats

1. **CSV Export**
   - Comma-separated values format
   - Includes all receipt fields
   - Compatible with spreadsheet applications
   - Lightweight and fast

2. **Excel Export**
   - Formatted spreadsheet with proper styling
   - Multiple worksheets (Receipts + Summary)
   - Column width optimization
   - Number formatting for amounts
   - Summary statistics and filter information

3. **PDF Export**
   - Professional formatted report
   - Summary by currency
   - Status and category breakdowns
   - Paginated table view
   - Filter information included

### Data Scope

The export functionality exports the **currently filtered/displayed receipt data** from the dashboard, which means:

- Respects search queries (merchant name filtering)
- Honors status tab selections (all/unreviewed/reviewed)
- Applies currency filters
- Includes date range filtering
- Follows current sort order

### File Naming

Files are automatically named with descriptive information:
- Timestamp: `yyyy-MM-dd_HH-mm-ss`
- Filter information (when applicable)
- Format: `receipts_export_2024-01-15_14-30-25_search-starbucks_status-reviewed.csv`

## Usage

### Accessing Export

1. Navigate to the Dashboard page
2. Apply any desired filters (search, date range, currency, status)
3. Locate the "Export" button in the filters section
4. Click the dropdown arrow to see format options

### Export Process

1. **Select Format**: Choose from CSV, Excel, or PDF
2. **Processing**: The system processes your filtered data
3. **Download**: File automatically downloads to your default download folder
4. **Notification**: Success/error toast notification appears

### Export Button States

- **Enabled**: When receipts are available for export
- **Disabled**: When loading data or no receipts available
- **Loading**: Shows spinner and "Exporting [FORMAT]..." during processing

## Technical Implementation

### File Structure

```
src/
├── lib/export/
│   ├── csvExport.ts      # CSV export logic
│   ├── excelExport.ts    # Excel export with formatting
│   ├── pdfExport.ts      # PDF report generation
│   └── index.ts          # Export utilities barrel file
├── components/export/
│   └── ExportDropdown.tsx # Export UI component
└── pages/
    └── Dashboard.tsx     # Integration point
```

### Dependencies

- **xlsx**: Excel file generation
- **jspdf**: PDF document creation
- **jspdf-autotable**: PDF table formatting
- **date-fns**: Date formatting
- **sonner**: Toast notifications

### Data Fields Exported

All export formats include these receipt fields:
- ID
- Date
- Merchant
- Total Amount
- Currency
- Tax Amount
- Payment Method
- Status
- Category
- Processing Status
- Model Used
- Processing Method
- Processing Time
- Created At
- Updated At

### Excel-Specific Features

- **Receipts Worksheet**: Main data with formatting
- **Summary Worksheet**: Statistics and filter information
- **Styling**: Header formatting, number formatting, column widths
- **Data Types**: Proper number formatting for amounts

### PDF-Specific Features

- **Header Section**: Title, export date, total receipts
- **Filter Information**: Applied filters summary
- **Currency Totals**: Breakdown by currency
- **Data Table**: Paginated receipt information
- **Summary Section**: Status and category breakdowns
- **Page Numbers**: Automatic pagination

## Error Handling

### Common Scenarios

1. **No Data**: "No receipts to export" error message
2. **Processing Errors**: Detailed error messages in toast notifications
3. **Large Datasets**: Efficient processing with progress indicators

### User Feedback

- **Loading States**: Visual indicators during export processing
- **Success Messages**: Confirmation with receipt count
- **Error Messages**: Specific error details for troubleshooting

## Performance Considerations

### Optimization Features

- **Client-Side Processing**: No server round-trips required
- **Efficient Data Handling**: Optimized for large datasets
- **Memory Management**: Proper cleanup of blob URLs
- **Chunked Processing**: Handles large exports efficiently

### Recommended Limits

- **CSV**: Handles thousands of receipts efficiently
- **Excel**: Optimized for up to 10,000 receipts
- **PDF**: Best for up to 1,000 receipts (readability)

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Download Support**: Automatic file download
- **Blob Support**: Required for file generation

## Future Enhancements

### Potential Improvements

1. **Custom Field Selection**: Choose which fields to export
2. **Template Options**: Different PDF report templates
3. **Scheduled Exports**: Automated export scheduling
4. **Cloud Storage**: Direct export to cloud services
5. **Email Integration**: Send exports via email

### Advanced Features

1. **Batch Processing**: Export multiple date ranges
2. **Format Customization**: User-defined export formats
3. **Data Validation**: Pre-export data quality checks
4. **Compression**: ZIP archives for large exports
