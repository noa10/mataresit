# Mataresit Documentation Style Guide

## 📋 Overview

This style guide establishes consistent standards for creating professional, user-friendly documentation across the Mataresit platform. All documentation should follow these guidelines to ensure consistency, accessibility, and maintainability.

## 🎯 Documentation Principles

### User-Centric Approach
- **Start with user goals** - What is the user trying to accomplish?
- **Progressive disclosure** - Basic concepts first, advanced features later
- **Task-oriented** - Focus on workflows and outcomes, not just features
- **Accessible language** - Clear, concise, jargon-free explanations

### Visual-First Documentation
- **Screenshot-driven** - Every major step should have a visual reference
- **Consistent UI representation** - Screenshots should reflect current interface
- **Annotated visuals** - Highlight important elements with callouts
- **Mobile-responsive** - Consider both desktop and mobile experiences

## 📸 Screenshot Standards

### Capture Requirements
- **Resolution**: Minimum 1920x1080 for desktop, 375x812 for mobile
- **Browser**: Chrome latest version, clean profile (no extensions visible)
- **Zoom Level**: 100% browser zoom
- **Window Size**: Full screen for desktop, actual device size for mobile
- **Clean State**: Remove personal data, use consistent demo data

### Visual Consistency
- **Theme**: Use light theme for consistency
- **Language**: English screenshots as primary, Malay as secondary
- **Demo Data**: Use standardized demo receipts and business names
- **Cursor**: Hide cursor in final screenshots
- **Annotations**: Use consistent callout style (red circles, arrows)

### File Naming Convention
```
{feature-name}_{step-number}_{device}_{language}.{format}
```

Examples:
- `batch-upload_01_desktop_en.png`
- `team-collaboration_03_mobile_ms.png`
- `ai-processing_overview_desktop_en.png`

### Storage Structure
```
docs/
└── assets/
    └── screenshots/
        ├── core-features/
        │   ├── batch-processing/
        │   ├── ai-vision/
        │   └── semantic-search/
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
        └── onboarding/
            ├── signup/
            ├── first-upload/
            └── navigation/
```

## 📝 Content Structure Templates

### Feature Guide Template
```markdown
# {Feature Name} - User Guide

## Overview
Brief description of what the feature does and why it's valuable.

## Prerequisites
- Account requirements
- Subscription tier needed
- Setup requirements

## Getting Started
### Step 1: {Action}
Description with screenshot
![Screenshot](path/to/screenshot.png)

### Step 2: {Action}
Description with screenshot
![Screenshot](path/to/screenshot.png)

## Advanced Usage
### {Advanced Feature}
Detailed explanation for power users

## Troubleshooting
### Common Issues
- Issue 1: Solution
- Issue 2: Solution

## Related Features
Links to related documentation

## Need Help?
Contact information and support resources
```

### Quick Start Template
```markdown
# Quick Start: {Feature Name}

⏱️ **Time Required**: X minutes
🎯 **Goal**: What you'll accomplish
📋 **Prerequisites**: What you need

## Steps
1. **{Action}** - Brief description
2. **{Action}** - Brief description
3. **{Action}** - Brief description

## Next Steps
- Link to full guide
- Related features to explore
```

## 🌐 Multi-Language Guidelines

### Translation Standards
- **Primary Language**: English (en)
- **Secondary Language**: Malay (ms)
- **File Structure**: Separate files for each language
- **Naming**: Add language suffix (`_en.md`, `_ms.md`)

### Cultural Considerations
- **Malaysian Context**: Use local business examples in Malay docs
- **Currency**: MYR for Malaysian examples, USD for international
- **Date Format**: DD/MM/YYYY for Malaysian context
- **Business Hours**: Local time zones and cultural practices

### Translation Workflow
1. Create English version first
2. Professional translation to Malay
3. Cultural adaptation for Malaysian users
4. Screenshot localization where needed
5. Review by native speakers

## 📱 Device-Specific Guidelines

### Desktop Documentation
- **Focus**: Full feature capabilities
- **Screenshots**: Full interface with context
- **Navigation**: Keyboard shortcuts included
- **Layout**: Multi-column layouts acceptable

### Mobile Documentation
- **Focus**: Touch interactions and mobile-specific features
- **Screenshots**: Actual device screenshots preferred
- **Navigation**: Gesture-based interactions
- **Layout**: Single-column, thumb-friendly

### PWA Documentation
- **Installation**: Step-by-step installation guides
- **Offline Features**: Highlight offline capabilities
- **Native Features**: Push notifications, home screen access
- **Cross-Platform**: iOS and Android differences

## ✍️ Writing Style Guidelines

### Tone and Voice
- **Professional but friendly** - Approachable expertise
- **Action-oriented** - Use active voice and imperative mood
- **Concise** - Respect user's time
- **Inclusive** - Avoid assumptions about user knowledge

### Formatting Standards
- **Headers**: Use descriptive, scannable headers
- **Lists**: Bullet points for features, numbered for steps
- **Code**: Inline code for UI elements, blocks for examples
- **Emphasis**: Bold for important terms, italics for emphasis
- **Links**: Descriptive link text, not "click here"

### Technical Terms
- **Consistency**: Use the same term throughout documentation
- **Glossary**: Define technical terms on first use
- **Acronyms**: Spell out on first use, then use acronym
- **UI Elements**: Match exact text from interface

## 🔍 SEO and Discoverability

### Search Optimization
- **Keywords**: Include relevant search terms naturally
- **Meta Descriptions**: Compelling summaries for each guide
- **Headers**: Use H1-H6 hierarchy properly
- **Internal Links**: Connect related documentation

### Help Center Integration
- **Categories**: Align with help center structure
- **Tags**: Consistent tagging for filtering
- **Search**: Optimize for internal search functionality
- **Related Articles**: Suggest relevant content

## 📊 Quality Assurance

### Review Checklist
- [ ] Screenshots are current and consistent
- [ ] All steps tested and verified
- [ ] Links work and point to correct destinations
- [ ] Grammar and spelling checked
- [ ] Mobile responsiveness verified
- [ ] Multi-language consistency maintained

### Update Process
- **Regular Reviews**: Quarterly screenshot updates
- **Feature Changes**: Update within 1 week of UI changes
- **User Feedback**: Incorporate feedback within 2 weeks
- **Version Control**: Track changes and maintain history

## 🔧 Implementation Guidelines

### Directory Structure for Documentation
```
docs/user-guides/
├── templates/                    # Documentation templates
│   ├── FEATURE_GUIDE_TEMPLATE.md
│   ├── QUICK_START_TEMPLATE.md
│   └── ONBOARDING_GUIDE_TEMPLATE.md
├── en/                          # English documentation
│   ├── core-features/
│   ├── collaboration/
│   ├── reporting/
│   ├── platform/
│   └── onboarding/
├── ms/                          # Malay documentation
│   ├── core-features/
│   ├── collaboration/
│   ├── reporting/
│   ├── platform/
│   └── onboarding/
├── assets/                      # Shared assets
│   └── screenshots/
└── shared/                      # Shared components
    ├── DOCUMENTATION_STYLE_GUIDE.md
    └── SCREENSHOT_MANAGEMENT_SYSTEM.md
```

### Help Center Integration
- **Route Structure**: `/help/{category}/{guide-name}`
- **Search Integration**: Full-text search across all guides
- **Category Navigation**: Hierarchical organization
- **Language Switching**: Seamless language toggle
- **Mobile Optimization**: Responsive design for all devices

This style guide ensures all Mataresit documentation maintains professional quality and provides exceptional user experience across all features and languages.
