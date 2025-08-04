# Export & Reporting Features - User Guide

## 📋 Overview

Mataresit provides comprehensive export and reporting capabilities that allow you to extract your receipt data in multiple formats and generate detailed expense reports. Whether you need data for accounting software, expense reimbursement, or financial analysis, our export features ensure you have the right format for your needs.

**Key Benefits:**
- Multiple export formats (CSV, Excel, PDF) for different use cases
- Advanced daily PDF reports with receipt images and categorized summaries
- Filtered exports that respect your current dashboard settings
- Professional formatting suitable for business and accounting purposes
- Analytics data export for deeper insights

## 🎯 Prerequisites

**Account Requirements:**
- Any subscription tier (Free/Pro/Max)
- Active Mataresit account with uploaded receipts
- No special permissions required

**Setup Requirements:**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Pop-up blocker disabled for download functionality

## 🚀 Getting Started

### Step 1: Access Export Options
Navigate to your Dashboard and locate the export functionality in the filters section.

![Export Button Location](../assets/screenshots/reporting/exports/export-button-location_desktop_en.png)

**What you'll see:**
- Export dropdown button in the dashboard toolbar
- Three format options: CSV, Excel, and PDF
- Export button state changes based on data availability

### Step 2: Apply Filters (Optional)
Before exporting, apply any filters to customize your data scope.

![Filter Application](../assets/screenshots/reporting/exports/filter-application_desktop_en.png)

**Available Filters:**
- Search by merchant name
- Date range selection
- Currency filtering
- Status filtering (All/Unreviewed/Reviewed)
- Category filtering

### Step 3: Select Export Format
Choose the format that best suits your needs.

![Format Selection](../assets/screenshots/reporting/exports/format-selection_desktop_en.png)

**Format Options:**
- **CSV**: Lightweight, spreadsheet-compatible
- **Excel**: Formatted with multiple worksheets and styling
- **PDF**: Professional report with summaries and charts

## 📊 Export Formats Detailed

### CSV Export
Perfect for importing into accounting software or spreadsheet applications.

**Features:**
- All receipt fields included
- Comma-separated values format
- Compatible with Excel, Google Sheets, QuickBooks
- Lightweight and fast processing
- Preserves current filter settings

**Use Cases:**
- Importing to accounting software
- Data analysis in spreadsheets
- Backup of receipt data
- Integration with third-party tools

### Excel Export
Comprehensive formatted spreadsheet with multiple worksheets.

![Excel Export Preview](../assets/screenshots/reporting/exports/excel-preview_desktop_en.png)

**Features:**
- **Receipts Worksheet**: Main data with professional formatting
- **Summary Worksheet**: Statistics and filter information
- Column width optimization
- Number formatting for currency amounts
- Header styling and data validation

**Included Data:**
- Receipt details (ID, Date, Merchant, Amount, Currency)
- Processing information (Status, Method, Model Used)
- Tax amounts and payment methods
- Categories and timestamps
- Summary statistics by currency and category

### PDF Export
Professional report format suitable for presentations and official documentation.

![PDF Export Preview](../assets/screenshots/reporting/exports/pdf-preview_desktop_en.png)

**Features:**
- Professional formatting with headers and footers
- Summary by currency with totals
- Status and category breakdowns
- Paginated table view with automatic page breaks
- Filter information included in header

## 📱 Mobile Usage

### Mobile Export Process
Export functionality is fully optimized for mobile devices.

![Mobile Export Interface](../assets/screenshots/reporting/exports/mobile-export_mobile_en.png)

**Mobile-Specific Features:**
- Touch-optimized dropdown interface
- Responsive format selection
- Mobile-friendly download handling
- Progress indicators for large exports

**Mobile Tips:**
- Ensure stable internet connection for large exports
- Downloads save to your device's default download folder
- Use "Share" functionality to send exports directly

## ⚙️ Advanced Reporting

### Daily PDF Reports
Generate comprehensive daily expense reports with receipt images and detailed summaries.

![Daily Report Generator](../assets/screenshots/reporting/pdf-generation/daily-report-generator_desktop_en.png)

**Features:**
- Calendar-based date selection
- Receipt images embedded in reports
- Two summary modes: Category-based or Payer-based
- Professional formatting with totals and breakdowns
- Automatic page management for multiple receipts

### Report Generation Process

**Step 1: Select Date**
Use the calendar picker to choose your report date.

![Date Selection](../assets/screenshots/reporting/pdf-generation/date-selection_desktop_en.png)

**Step 2: Choose Summary Mode**
Select between Category or Payer-based summaries.

![Summary Mode Selection](../assets/screenshots/reporting/pdf-generation/summary-mode_desktop_en.png)

**Step 3: Generate Report**
Click "Generate PDF Report" to create your comprehensive daily report.

![Report Generation](../assets/screenshots/reporting/pdf-generation/report-generation_desktop_en.png)

### Analytics Data Export
Export your usage analytics and insights data for external analysis.

![Analytics Export](../assets/screenshots/reporting/analytics/analytics-export_desktop_en.png)

**Available Data:**
- User interaction trends
- Feature usage statistics
- Processing performance metrics
- Personalized insights and recommendations
- Time-based activity patterns

## 🔧 Customization Options

### File Naming Conventions
Exported files follow a consistent naming pattern for easy organization.

**Naming Format:**
```
receipts_export_YYYY-MM-DD_HH-mm-ss_[filters].extension
```

**Examples:**
- `receipts_export_2024-01-15_14-30-25_search-starbucks.csv`
- `receipts_export_2024-01-15_14-30-25_status-reviewed_currency-MYR.xlsx`
- `expense-report-2024-01-15-category-mode.pdf`

### Export Scope Control
Control exactly what data gets exported through filtering.

**Filter Options:**
- **Search Query**: Export only receipts matching merchant search
- **Date Range**: Limit exports to specific time periods
- **Status Filter**: Include only reviewed or unreviewed receipts
- **Currency Filter**: Export receipts in specific currencies only
- **Category Filter**: Focus on specific expense categories

## 🚨 Troubleshooting

### Common Issues

**Issue 1: Export Button Disabled**
- **Symptoms:** Export button appears grayed out
- **Cause:** No receipts available with current filters
- **Solution:** Adjust filters or ensure receipts exist for the selected criteria
- **Prevention:** Verify receipt data before attempting export

**Issue 2: Large File Download Fails**
- **Symptoms:** Download starts but fails to complete
- **Cause:** Network timeout or browser limitations
- **Solution:** Try exporting smaller date ranges or use CSV format for large datasets
- **Prevention:** Export data in smaller chunks for better reliability

**Issue 3: PDF Generation Takes Too Long**
- **Symptoms:** PDF report generation appears stuck
- **Cause:** Large number of receipts with images for selected date
- **Solution:** Wait for processing to complete or try a date with fewer receipts
- **Prevention:** Consider using exports without images for dates with many receipts

### Error Messages

**"No receipts to export"**
- **Meaning:** Current filters return no receipt data
- **Solution:** Adjust your filters or check if receipts exist for the selected criteria
- **When to Contact Support:** If you believe receipts should be available but aren't showing

**"Export failed - please try again"**
- **Meaning:** Server error during export processing
- **Solution:** Wait a moment and retry the export
- **When to Contact Support:** If error persists after multiple attempts

## 💡 Best Practices

### Optimization Tips
- **Filter First**: Apply filters before exporting to reduce file size and processing time
- **Choose Appropriate Format**: Use CSV for data import, Excel for analysis, PDF for presentations
- **Regular Exports**: Export data regularly for backup and compliance purposes
- **Organize Downloads**: Use consistent naming and folder structure for exported files

### Workflow Recommendations
- **Monthly Exports**: Export monthly data for accounting and tax purposes
- **Project-Based Exports**: Use search filters to export receipts for specific projects
- **Backup Strategy**: Regular CSV exports provide reliable data backup
- **Compliance Documentation**: PDF reports provide professional documentation for audits

## 🔗 Related Features

### Complementary Features
- **[Semantic Search](semantic-search.md)** - Find specific receipts before exporting
- **[Batch Processing](batch-processing.md)** - Upload multiple receipts for comprehensive reports
- **[AI Vision Processing](ai-vision-processing.md)** - Ensure accurate data extraction before export

### Next Steps
Suggested features to explore after mastering exports:
1. [Team Collaboration](../team-collaboration/team-setup.md) - Share reports with team members
2. [Advanced Analytics](../ai-intelligence/analytics-dashboard.md) - Deeper insights into spending patterns
3. [API Integration](../../api-reference/export-endpoints.md) - Automated export workflows

## ❓ Frequently Asked Questions

**Q: Can I export data from multiple months at once?**
A: Yes, use the date range filter to select multiple months before exporting. For very large ranges, consider using CSV format for better performance.

**Q: Are receipt images included in all export formats?**
A: Receipt images are only included in PDF exports and daily PDF reports. CSV and Excel exports contain data only.

**Q: Can I schedule automatic exports?**
A: Currently, exports are manual. Automatic scheduling is planned for future releases. Use our API for automated workflows.

**Q: What's the maximum number of receipts I can export?**
A: There's no hard limit, but very large exports (1000+ receipts) may take longer to process. Consider breaking large exports into smaller chunks.

## 📞 Need Help?

### Self-Service Resources
- [Help Center](../../help-center.md) - Browse all documentation
- [Video Tutorials](../../tutorials/export-reporting.md) - Visual learning resources
- [API Documentation](../../api-reference/export-endpoints.md) - Integration guides

### Contact Support
- **Email Support:** support@mataresit.com
- **Live Chat:** Available in-app during business hours
- **Priority Support:** Available for Pro and Max tier users

### Feedback
Help us improve this documentation:
- [Suggest Improvements](../../feedback/documentation.md) - Documentation feedback
- [Feature Requests](../../feedback/features.md) - Request new export capabilities
- [Bug Reports](../../feedback/bugs.md) - Report export issues

---

**Last Updated:** January 2025  
**Version:** 2.1.0  
**Applies to:** All subscription tiers
