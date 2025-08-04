# Export & Reporting Documentation Screenshots

## 📸 Required Screenshot Structure

This document outlines the screenshot directory structure and naming conventions needed for the Export & Reporting documentation guides.

## 📁 Directory Structure

The following directories should be created under `docs/assets/screenshots/`:

```
docs/assets/screenshots/
└── reporting/
    ├── exports/
    │   ├── export-button-location_desktop_en.png
    │   ├── filter-application_desktop_en.png
    │   ├── format-selection_desktop_en.png
    │   ├── excel-preview_desktop_en.png
    │   ├── pdf-preview_desktop_en.png
    │   └── mobile-export_mobile_en.png
    ├── pdf-generation/
    │   ├── report-generator-access_desktop_en.png
    │   ├── calendar-selection_desktop_en.png
    │   ├── summary-mode-selection_desktop_en.png
    │   ├── generation-process_desktop_en.png
    │   ├── report-header_desktop_en.png
    │   ├── receipt-details_desktop_en.png
    │   ├── summary-statistics_desktop_en.png
    │   ├── mobile-interface_mobile_en.png
    │   ├── daily-report-generator_desktop_en.png
    │   ├── date-selection_desktop_en.png
    │   ├── summary-mode_desktop_en.png
    │   ├── report-generation_desktop_en.png
    │   ├── daily-report-example_desktop_en.png
    │   ├── pdf-header-design_desktop_en.png
    │   ├── receipt-detail-layout_desktop_en.png
    │   ├── summary-layout_desktop_en.png
    │   ├── data-collection_desktop_en.png
    │   ├── image-processing_desktop_en.png
    │   ├── pdf-assembly_desktop_en.png
    │   └── mobile-pdf-interface_mobile_en.png
    ├── analytics/
    │   ├── analytics-export-access_desktop_en.png
    │   ├── export-process_desktop_en.png
    │   └── analytics-export_desktop_en.png
    ├── custom-reports/
    │   ├── report-builder-access_desktop_en.png
    │   ├── template-selection_desktop_en.png
    │   ├── report-configuration_desktop_en.png
    │   ├── data-selection_desktop_en.png
    │   ├── grouping-options_desktop_en.png
    │   ├── summary-calculations_desktop_en.png
    │   ├── layout-customization_desktop_en.png
    │   ├── visual-elements_desktop_en.png
    │   ├── report-scheduling_desktop_en.png
    │   ├── template-management_desktop_en.png
    │   └── mobile-builder_mobile_en.png
    └── quick-start/
        ├── dashboard-access_desktop_en.png
        ├── quick-filters_desktop_en.png
        ├── export-selection_desktop_en.png
        ├── analysis-navigation_desktop_en.png
        ├── date-selection_desktop_en.png
        ├── mode-selection_desktop_en.png
        ├── report-generation_desktop_en.png
        └── mobile-export_mobile_en.png
```

## 📋 Screenshot Requirements

### Technical Specifications
- **Resolution**: Minimum 1920x1080 for desktop, 375x812 for mobile
- **Browser**: Chrome latest version, clean profile
- **Zoom Level**: 100% browser zoom
- **Theme**: Light theme for consistency
- **Language**: English screenshots as primary

### Content Guidelines
- **Clean State**: Remove personal data, use demo receipts
- **Consistent Demo Data**: Use standardized business names and amounts
- **UI State**: Show relevant UI states (loading, success, error)
- **Annotations**: Use red circles/arrows for important elements

### Naming Convention
```
{feature-name}_{step-description}_{device}_{language}.png
```

Examples:
- `export-button-location_desktop_en.png`
- `mobile-export_mobile_en.png`
- `report-generation_desktop_en.png`

## 📊 Screenshot Content Descriptions

### Export Features Screenshots

**export-button-location_desktop_en.png**
- Dashboard view with export button highlighted
- Show filters section and export dropdown
- Include sample receipt data in background

**filter-application_desktop_en.png**
- Dashboard with various filters applied
- Show search, date range, currency filters
- Display filtered results

**format-selection_desktop_en.png**
- Export dropdown menu open
- Show CSV, Excel, PDF options
- Highlight selection process

**excel-preview_desktop_en.png**
- Excel file open showing formatted data
- Display both Receipts and Summary worksheets
- Show professional formatting

**pdf-preview_desktop_en.png**
- PDF report open in browser/viewer
- Show professional layout with summaries
- Include receipt data and totals

### PDF Generation Screenshots

**daily-report-generator_desktop_en.png**
- Analysis page with report generator section
- Show calendar interface and mode selection
- Display generate button

**calendar-selection_desktop_en.png**
- Calendar picker with highlighted dates
- Show dates with receipt data
- Display month navigation

**summary-mode-selection_desktop_en.png**
- Radio button selection for Category/Payer modes
- Show mode descriptions
- Highlight selection state

**report-generation_desktop_en.png**
- Loading state during PDF generation
- Show progress indicator
- Display processing message

### Custom Reports Screenshots

**report-builder-access_desktop_en.png**
- Reports section with custom report builder
- Show template options
- Display builder interface

**template-selection_desktop_en.png**
- Template gallery with various options
- Show business, tax, project templates
- Highlight selection process

**report-configuration_desktop_en.png**
- Configuration interface with filters and options
- Show date range, category, user filters
- Display preview functionality

### Mobile Screenshots

**mobile-export_mobile_en.png**
- Mobile dashboard with export functionality
- Show touch-optimized interface
- Display format selection on mobile

**mobile-pdf-interface_mobile_en.png**
- Mobile PDF generation interface
- Show responsive calendar and controls
- Display mobile-optimized layout

## 🎯 Priority Screenshots

### High Priority (Core Functionality)
1. export-button-location_desktop_en.png
2. format-selection_desktop_en.png
3. daily-report-generator_desktop_en.png
4. calendar-selection_desktop_en.png
5. summary-mode-selection_desktop_en.png

### Medium Priority (Enhanced Features)
1. excel-preview_desktop_en.png
2. pdf-preview_desktop_en.png
3. report-configuration_desktop_en.png
4. mobile-export_mobile_en.png

### Low Priority (Advanced Features)
1. template-selection_desktop_en.png
2. visual-elements_desktop_en.png
3. report-scheduling_desktop_en.png

## 📝 Screenshot Creation Workflow

1. **Setup Environment**
   - Clean browser profile
   - Demo data loaded
   - Light theme enabled
   - Proper resolution set

2. **Capture Process**
   - Navigate to feature
   - Set up demo scenario
   - Capture clean screenshot
   - Add annotations if needed

3. **Post-Processing**
   - Crop to relevant area
   - Add callouts/highlights
   - Optimize file size
   - Save with correct naming

4. **Quality Check**
   - Verify image quality
   - Check naming convention
   - Ensure demo data consistency
   - Test in documentation

## 🔄 Update Schedule

- **Initial Creation**: All high-priority screenshots
- **Feature Updates**: Update within 1 week of UI changes
- **Quarterly Review**: Check all screenshots for accuracy
- **Language Versions**: Create Malay versions for localized docs

---

**Note**: This structure follows the Mataresit Documentation Style Guide and ensures consistent, professional documentation across all export and reporting features.
