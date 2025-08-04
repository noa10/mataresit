# Advanced Reporting - User Guide

## 📋 Overview

Advanced Reporting in Mataresit provides sophisticated analytics and reporting capabilities beyond basic data export. Generate comprehensive daily expense reports, analyze spending patterns, and create professional documentation with embedded receipt images and detailed summaries.

**Key Benefits:**
- Daily PDF reports with receipt images and categorized breakdowns
- Multiple summary modes (Category-based or Payer-based)
- Professional formatting suitable for business documentation
- Analytics data export for deeper insights
- Automated report generation with consistent formatting

## 🎯 Prerequisites

**Account Requirements:**
- Any subscription tier (Free/Pro/Max)
- Active receipts in your Mataresit account
- No special permissions required

**Setup Requirements:**
- Modern web browser with PDF support
- Stable internet connection for image processing
- Pop-up blocker disabled for downloads

## 🚀 Daily PDF Report Generation

### Step 1: Access Report Generator
Navigate to the Analysis page and locate the "Generate Daily Expense Report" section.

![Report Generator Access](../assets/screenshots/reporting/pdf-generation/report-generator-access_desktop_en.png)

**What you'll see:**
- Calendar interface for date selection
- Report mode selection options
- Generate button with loading states

### Step 2: Select Report Date
Use the calendar picker to choose the date for your expense report.

![Date Selection Calendar](../assets/screenshots/reporting/pdf-generation/calendar-selection_desktop_en.png)

**Calendar Features:**
- Visual indicators for dates with receipts
- Easy month/year navigation
- Today's date highlighted
- Disabled dates with no receipt data

**Tips:**
- Dates with receipts are visually highlighted
- Click on any highlighted date to select it
- Use navigation arrows to browse different months

### Step 3: Choose Summary Mode
Select how you want your report summarized and organized.

![Summary Mode Selection](../assets/screenshots/reporting/pdf-generation/summary-mode-selection_desktop_en.png)

**Available Modes:**

**Category Mode:**
- Groups expenses by category (Food, Transportation, etc.)
- Shows spending breakdown by expense type
- Ideal for business expense categorization
- Helps identify spending patterns by category

**Payer Mode:**
- Groups expenses by who paid (useful for shared expenses)
- Shows individual contribution breakdowns
- Perfect for family or team expense tracking
- Helps with expense reimbursement calculations

### Step 4: Generate Your Report
Click "Generate PDF Report" to create your comprehensive daily report.

![Report Generation Process](../assets/screenshots/reporting/pdf-generation/generation-process_desktop_en.png)

**Generation Process:**
- System fetches all receipts for selected date
- Processes receipt images for embedding
- Creates formatted PDF with summaries
- Automatically downloads completed report

## 📊 Report Structure and Content

### Report Header
Every generated report includes a professional header with:

![Report Header Example](../assets/screenshots/reporting/pdf-generation/report-header_desktop_en.png)

- Report title and generation date
- Selected date and summary mode
- Total number of receipts processed
- Grand total amount with currency

### Receipt Details Section
Each receipt is presented with complete information:

![Receipt Details Section](../assets/screenshots/reporting/pdf-generation/receipt-details_desktop_en.png)

**Included Information:**
- Merchant name and transaction date
- Total amount with currency
- Payment method and tax information
- Line items breakdown (when available)
- Receipt image embedded below details

### Summary Statistics
Comprehensive breakdown based on selected mode:

![Summary Statistics](../assets/screenshots/reporting/pdf-generation/summary-statistics_desktop_en.png)

**Category Mode Summary:**
- Total spending by category
- Percentage breakdown of expenses
- Number of transactions per category
- Average transaction amount by category

**Payer Mode Summary:**
- Total amount paid by each payer
- Percentage contribution by payer
- Number of transactions per payer
- Individual spending patterns

## 📱 Mobile Report Generation

### Mobile Interface
Generate reports seamlessly on mobile devices.

![Mobile Report Interface](../assets/screenshots/reporting/pdf-generation/mobile-interface_mobile_en.png)

**Mobile Features:**
- Touch-optimized calendar navigation
- Responsive mode selection
- Progress indicators for generation
- Mobile-friendly download handling

**Mobile Tips:**
- Ensure stable WiFi for image processing
- Reports may take longer on mobile networks
- Downloaded PDFs open in your default PDF viewer
- Use share functionality to send reports directly

## ⚙️ Advanced Configuration

### Report Customization Options
While generating reports, you can influence the output through various settings:

**Image Quality Settings:**
- High-quality images for professional reports
- Compressed images for faster generation
- Option to exclude images for data-only reports

**Date Range Extensions:**
- Single-day reports (current functionality)
- Weekly summary reports (planned feature)
- Monthly comprehensive reports (planned feature)

### File Naming and Organization
Reports follow a consistent naming convention:

**Naming Pattern:**
```
expense-report-YYYY-MM-DD-[mode]-mode.pdf
```

**Examples:**
- `expense-report-2024-01-15-category-mode.pdf`
- `expense-report-2024-01-15-payer-mode.pdf`

## 📈 Analytics Data Export

### Accessing Analytics Export
Export your usage analytics for external analysis.

![Analytics Export Access](../assets/screenshots/reporting/analytics/analytics-export-access_desktop_en.png)

**Available Analytics Data:**
- User interaction trends over time
- Feature usage statistics
- Processing performance metrics
- Personalized insights and recommendations
- Search query patterns and results

### Export Process
Generate comprehensive analytics reports:

![Analytics Export Process](../assets/screenshots/reporting/analytics/export-process_desktop_en.png)

**Export Options:**
- JSON format for technical analysis
- Time range selection
- Specific metric filtering
- Aggregated or detailed data views

## 🚨 Troubleshooting

### Common Issues

**Issue 1: PDF Generation Fails**
- **Symptoms:** Generation starts but fails to complete
- **Cause:** Network issues or corrupted receipt images
- **Solution:** Check internet connection and retry
- **Prevention:** Ensure stable connection before starting

**Issue 2: Missing Receipt Images**
- **Symptoms:** PDF generates but some images are missing
- **Cause:** Image processing timeout or corrupted image files
- **Solution:** Try generating report again or contact support
- **Prevention:** Verify receipt images display properly in dashboard

**Issue 3: Large File Size**
- **Symptoms:** PDF file is very large and slow to download
- **Cause:** Many high-resolution receipt images
- **Solution:** Consider generating reports for dates with fewer receipts
- **Prevention:** Use image compression options when available

### Error Messages

**"No receipts found for selected date"**
- **Meaning:** No receipt data exists for the chosen date
- **Solution:** Select a different date with receipt data
- **When to Contact Support:** If you believe receipts should exist

**"Report generation timeout"**
- **Meaning:** Processing took too long and was cancelled
- **Solution:** Try a date with fewer receipts or retry later
- **When to Contact Support:** If timeouts persist with small datasets

## 💡 Best Practices

### Optimization Tips
- **Select Appropriate Dates**: Choose dates with manageable numbers of receipts
- **Use Consistent Modes**: Stick to one summary mode for comparable reports
- **Regular Generation**: Generate reports regularly for consistent documentation
- **Organize Downloads**: Create folders for different time periods or purposes

### Business Use Cases
- **Expense Reimbursement**: Generate daily reports for business trip expenses
- **Tax Documentation**: Create monthly summaries for tax preparation
- **Budget Analysis**: Use category mode to analyze spending patterns
- **Team Expense Tracking**: Use payer mode for shared expense management

## 🔗 Related Features

### Complementary Features
- **[Export & Reporting](export-reporting.md)** - Basic export functionality
- **[Analytics Dashboard](../ai-intelligence/analytics-dashboard.md)** - Interactive analytics
- **[Team Collaboration](../team-collaboration/team-setup.md)** - Share reports with team

### Integration Opportunities
- **API Access**: Automate report generation through API calls
- **Cloud Storage**: Direct upload to cloud storage services
- **Email Integration**: Automated report delivery via email

## ❓ Frequently Asked Questions

**Q: Can I generate reports for multiple days at once?**
A: Currently, reports are generated for single days. Multi-day reporting is planned for future releases.

**Q: How long does report generation typically take?**
A: Generation time depends on the number of receipts and images. Typically 30 seconds to 2 minutes for a full day.

**Q: Can I customize the report layout or branding?**
A: Custom layouts and branding are planned features for Pro and Max tier users.

**Q: Are there limits on report generation?**
A: No limits on report generation frequency. Large reports may take longer to process.

## 📞 Need Help?

### Self-Service Resources
- [Help Center](../../help-center.md) - Complete documentation
- [Video Tutorials](../../tutorials/advanced-reporting.md) - Step-by-step guides
- [API Documentation](../../api-reference/reporting-endpoints.md) - Integration guides

### Contact Support
- **Email Support:** support@mataresit.com
- **Live Chat:** Available in-app during business hours
- **Priority Support:** Available for Pro and Max tier users

---

**Last Updated:** January 2025  
**Version:** 2.1.0  
**Applies to:** All subscription tiers
