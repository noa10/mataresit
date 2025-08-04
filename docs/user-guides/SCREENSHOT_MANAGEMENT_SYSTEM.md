# Screenshot Management System

## 📸 Overview

This document outlines the systematic approach for capturing, organizing, and maintaining screenshots for Mataresit documentation. Consistent visual documentation is crucial for user understanding and professional presentation.

## 🎯 Capture Standards

### Technical Requirements

**Desktop Screenshots:**
- **Resolution:** 1920x1080 minimum
- **Browser:** Chrome latest version, clean profile
- **Zoom Level:** 100% browser zoom
- **Window:** Full screen capture
- **Theme:** Light theme for consistency
- **Language:** English primary, Malay secondary

**Mobile Screenshots:**
- **Devices:** iPhone 14 Pro (393x852), Samsung Galaxy S23 (360x800)
- **Orientation:** Portrait primary, landscape when relevant
- **OS:** Latest iOS and Android versions
- **Browser:** Native browsers and PWA views

### Environment Setup

**Demo Data Standards:**
```
Business Names: AEON, 99 Speedmart, McDonald's Malaysia
Amounts: RM25.50, RM156.80, RM89.90
Dates: Recent dates within last 30 days
Categories: Food & Beverage, Groceries, Transportation
```

**User Account:**
- Name: "Demo User"
- Email: "demo@mataresit.com"
- Team: "Mataresit Demo Team"
- Clean notification state
- Consistent profile picture

## 📁 File Organization

### Directory Structure
```
docs/assets/screenshots/
├── core-features/
│   ├── batch-processing/
│   │   ├── 01_upload-interface_desktop_en.png
│   │   ├── 02_file-selection_desktop_en.png
│   │   ├── 03_processing-status_desktop_en.png
│   │   └── mobile/
│   │       ├── 01_upload-interface_mobile_en.png
│   │       └── 02_processing-status_mobile_en.png
│   ├── ai-vision/
│   │   ├── 01_upload-analysis_desktop_en.png
│   │   ├── 02_confidence-scoring_desktop_en.png
│   │   └── 03_verification-interface_desktop_en.png
│   └── semantic-search/
│       ├── 01_search-interface_desktop_en.png
│       ├── 02_natural-language-query_desktop_en.png
│       └── 03_search-results_desktop_en.png
├── collaboration/
│   ├── team-management/
│   ├── claims/
│   └── permissions/
├── reporting/
│   ├── exports/
│   ├── analytics/
│   └── pdf-generation/
├── platform/
│   ├── pwa/
│   ├── mobile/
│   └── security/
├── onboarding/
│   ├── signup/
│   ├── first-upload/
│   └── navigation/
└── malaysian-features/
    ├── business-directory/
    ├── tax-integration/
    └── local-payments/
```

### Naming Convention

**Format:**
```
{step-number}_{descriptive-name}_{device}_{language}.{extension}
```

**Examples:**
- `01_dashboard-overview_desktop_en.png`
- `03_receipt-upload_mobile_ms.png`
- `overview_team-workspace_desktop_en.png`

**Special Prefixes:**
- `overview_` - Feature overview screenshots
- `quick_` - Quick start guide screenshots
- `advanced_` - Advanced feature screenshots
- `error_` - Error state screenshots
- `success_` - Success state screenshots

## 🛠️ Capture Process

### Pre-Capture Checklist
- [ ] Browser cache cleared
- [ ] Demo data loaded
- [ ] Notifications cleared
- [ ] Correct theme selected
- [ ] Language set appropriately
- [ ] Window size standardized

### Capture Workflow

1. **Setup Environment**
   - Load demo data
   - Clear browser cache
   - Set appropriate zoom level
   - Position windows correctly

2. **Capture Screenshot**
   - Use consistent capture tool (Snagit, CloudApp, or built-in)
   - Ensure full UI visibility
   - Check for cut-off elements
   - Verify image quality

3. **Post-Processing**
   - Crop to relevant area if needed
   - Add annotations (red circles, arrows)
   - Optimize file size (PNG for UI, JPG for photos)
   - Apply consistent styling

4. **Quality Check**
   - Verify text readability
   - Check for personal data exposure
   - Confirm consistent styling
   - Test on different screen sizes

### Annotation Standards

**Callout Elements:**
- **Red circles:** Highlight clickable elements
- **Red arrows:** Show direction or flow
- **Yellow highlights:** Emphasize important text
- **Blue boxes:** Group related elements

**Annotation Tools:**
- Circle thickness: 3px
- Arrow thickness: 2px
- Colors: Red (#FF0000), Yellow (#FFFF00), Blue (#0066CC)
- Font: System default, 14px for labels

## 🔄 Maintenance Process

### Regular Updates

**Monthly Reviews:**
- Check for UI changes
- Update outdated screenshots
- Verify demo data consistency
- Test mobile responsiveness

**Feature Release Updates:**
- Capture new feature screenshots within 48 hours
- Update affected workflow screenshots
- Maintain version consistency
- Update related documentation

### Version Control

**File Versioning:**
- Keep previous versions in `archive/` folder
- Use date stamps for major updates
- Maintain changelog for significant changes
- Track which documentation uses each screenshot

**Change Management:**
```
archive/
├── 2024-01/
│   ├── old-dashboard_desktop_en.png
│   └── old-upload-flow_mobile_en.png
├── 2024-02/
└── changelog.md
```

## 📱 Device-Specific Guidelines

### Desktop Captures
- **Full Interface:** Show complete application context
- **Navigation:** Include sidebar and top navigation
- **Content Area:** Focus on main content with context
- **Modals:** Capture with background overlay

### Mobile Captures
- **Device Frames:** Use actual device screenshots when possible
- **Touch Targets:** Ensure buttons appear touchable
- **Scrolling:** Show scroll indicators when relevant
- **Gestures:** Indicate swipe directions with arrows

### PWA Captures
- **Installation:** Show browser installation prompts
- **Home Screen:** Capture app icon on device home screen
- **Offline States:** Document offline functionality
- **Native Features:** Show push notifications, camera access

## 🌐 Localization Guidelines

### Multi-Language Screenshots

**English (Primary):**
- Complete screenshot sets for all features
- High-quality annotations
- Consistent demo data
- Professional presentation

**Malay (Secondary):**
- Key workflow screenshots
- Malaysian business examples
- Local currency and formats
- Cultural context appropriate

### Cultural Adaptations

**Malaysian Context:**
- Use local business names (AEON, 99 Speedmart)
- MYR currency formatting
- Malaysian date formats (DD/MM/YYYY)
- Local time zones and business hours

## 🔍 Quality Assurance

### Review Checklist
- [ ] Screenshot clarity and resolution
- [ ] Consistent styling and annotations
- [ ] No personal or sensitive data visible
- [ ] Proper file naming and organization
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility checked

### Common Issues to Avoid
- **Inconsistent UI states** - Different themes or layouts
- **Personal data exposure** - Real user information visible
- **Poor image quality** - Blurry or pixelated screenshots
- **Inconsistent annotations** - Different styles or colors
- **Outdated content** - Old UI or deprecated features

## 📊 Metrics and Tracking

### Screenshot Inventory
- Total screenshots by category
- Last update dates
- Usage in documentation
- Quality scores

### Update Frequency
- Feature-based updates: Within 48 hours of release
- Quarterly reviews: Complete inventory check
- Annual overhaul: Full screenshot refresh

### Performance Metrics
- Documentation page load times
- Image optimization ratios
- User engagement with visual content
- Support ticket reduction from better visuals

This screenshot management system ensures consistent, professional, and maintainable visual documentation across all Mataresit user guides.
