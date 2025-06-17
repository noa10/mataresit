Detailed plan for integrating multi-language support, specifically for Malay:

Comprehensive Multi-Language Integration Plan for Mataresit
Phase 1: Foundation Setup (Days 1-3)
1.1 Install i18n Dependencies
Add react-i18next for React integration
Add i18next for core internationalization
Add i18next-browser-languagedetector for automatic language detection
Add i18next-http-backend for loading translations dynamically
1.2 Create Translation Infrastructure
src/
├── locales/
│   ├── en/
│   │   ├── common.json          # UI elements, buttons, labels
│   │   ├── navigation.json      # Navbar, sidebar menu items
│   │   ├── dashboard.json       # Dashboard-specific content
│   │   ├── receipts.json        # Receipt processing terminology
│   │   ├── auth.json           # Authentication forms
│   │   ├── settings.json       # Settings page content
│   │   ├── admin.json          # Admin panel content
│   │   ├── errors.json         # Error messages
│   │   ├── forms.json          # Form validation messages
│   │   └── ai.json             # AI processing messages
│   └── ms/                     # Malay translations
│       ├── common.json
│       ├── navigation.json
│       └── ... (same structure)
1.3 Configure i18n System
Set up i18n configuration with namespace loading
Configure language detection (user preference → localStorage → browser → default)
Add TypeScript support for translation keys
Set up fallback mechanisms
1.4 Create Language Context & Components
LanguageProvider context for state management
useTranslation hook wrapper
LanguageSelector component for the navbar
Language persistence in user profiles table
Phase 2: Core UI Translation (Days 4-8)
2.1 Navigation & Layout Components
Navbar.tsx: Translate all menu items, dropdowns, user actions
MainNavigationSidebar.tsx: Translate navigation items
AppLayout.tsx: Translate layout-specific text
2.2 Main Pages Translation
Dashboard.tsx: Translate filters, buttons, stats, view modes
Index.tsx: Landing page hero, features, testimonials
Auth.tsx: Login/signup forms and validation messages
SettingsPage.tsx: All settings categories and options
Profile.tsx: Profile fields and actions
2.3 Receipt Components
ReceiptCard.tsx: Status badges, confidence scores, actions
ReceiptViewer.tsx: Processing status, metadata labels
UploadZone.tsx: Upload instructions and messages
CategoryManager.tsx: Category management interface
2.4 Admin Panel
All admin dashboard components
User management interface
Analytics and reporting labels
Phase 3: Dynamic Content & Database (Days 9-12)
3.1 Database Schema Updates

-- Add language columns to relevant tables
ALTER TABLE categories ADD COLUMN name_ms TEXT;
ALTER TABLE posts ADD COLUMN title_ms TEXT, content_ms TEXT;
ALTER TABLE profiles ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'en';

-- Create translation management tables
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(50) NOT NULL,
  key VARCHAR(200) NOT NULL,
  language VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(namespace, key, language)
);
3.2 Edge Functions Updates
process-receipt: Add Malay OCR support and field extraction
enhance-receipt-data: Support Malaysian business names and categories
semantic-search: Implement multilingual search capabilities
send-email: Add Malay email templates
3.3 AI Processing Enhancements
Malaysian business terminology recognition
Malay text confidence scoring improvements
Currency formatting for MYR
Malaysian tax categories (GST/SST)
Phase 4: Malay-Specific Optimizations (Days 13-16)
4.1 Malaysian Business Features
Common Malaysian merchant categories
Malaysian business registration number formats
GST/SST tax handling
Malaysian address formats
Local business hours and time zones
4.2 Cultural Adaptations
Date format preferences (DD/MM/YYYY for Malaysia)
Currency display (RM prefix for MYR)
Number formatting conventions
Malaysian public holidays recognition
4.3 Content Localization
Translate all marketing content for Malaysian market
Adapt feature descriptions for local business practices
Create Malay help documentation
Localize blog content templates
Phase 5: Advanced Features & Polish (Days 17-20) ✅ COMPLETED
5.1 Advanced Translation Features ✅ COMPLETED
✅ Pluralization rules for English and Malay languages
✅ Context-aware translations based on user roles (admin, user, guest, team_member)
✅ Translation interpolation for dynamic content with count support
✅ Role-based translation suffixes (_admin, _user, _guest, _team_member)
✅ Malaysian business terminology and cultural adaptations
✅ Enhanced translation files with advanced features
5.2 Performance Optimizations ✅ COMPLETED
✅ Advanced translation hook with lazy loading support
✅ Context-aware translation caching
✅ Efficient pluralization handling
✅ Optimized translation key resolution
5.3 Malaysian Business Context ✅ COMPLETED
✅ GST/SST tax system support
✅ Malaysian Ringgit (RM) currency formatting
✅ Malaysian business types and categories
✅ Business registration number formats
✅ Cultural time/date formats (DD/MM/YYYY)
✅ Malaysian business hours and compliance terminology
Implementation Technical Details
Translation Key Structure

{
  "dashboard": {
    "title": "Dashboard",
    "upload": {
      "button": "Upload Receipt",
      "dragDrop": "Drag and drop files here"
    },
    "filters": {
      "all": "All Receipts",
      "processing": "Processing",
      "completed": "Completed"
    },
    "stats": {
      "totalReceipts": "Total Receipts",
      "thisMonth": "This Month",
      "avgConfidence": "Average Confidence"
    }
  }
}
Language Detection Priority
User's saved preference in database (profiles.preferred_language)
localStorage setting (mataresit_language)
Browser language detection
Default to English
Required Dependencies
react-i18next: ^13.5.0
i18next: ^23.7.0
i18next-browser-languagedetector: ^7.2.0
i18next-http-backend: ^2.4.0
File Updates Required
App.tsx: Wrap with i18n provider
package.json: Add new dependencies
vite.config.ts: Configure translation file loading
All component files: Replace hardcoded strings with translation keys
Database migrations: Add language columns and translation tables
Testing Strategy
Translation key coverage testing
Language switching functionality
PDF generation with Malay content
Export functionality with localized headers
Search functionality with Malay text
Mobile responsiveness with longer Malay text
This plan provides a comprehensive approach to adding Malay language support while maintaining existing functionality and preparing for future language additions.

## Phase 5 Implementation Summary ✅ COMPLETED

### Advanced Translation Features Implemented
- **Pluralization System**: Complete i18next-compatible pluralization for English and Malay
- **Context-Aware Translations**: Role-based content with _admin, _user, _guest, _team_member suffixes
- **Malaysian Business Context**: GST/SST support, RM currency formatting, business types
- **Enhanced Translation Files**: Updated common.json, dashboard.json, receipts.json, admin.json, errors.json
- **Cultural Adaptations**: Malaysian date formats, business hours, compliance terminology

### Files Enhanced
- ✅ `src/locales/en/common.json` - Added plurals, contextual, and Malaysian sections
- ✅ `src/locales/ms/common.json` - Complete Malay translations with cultural context
- ✅ `src/locales/en/dashboard.json` - Role-based stats and Malaysian business context
- ✅ `src/locales/ms/dashboard.json` - Malay dashboard translations with pluralization
- ✅ `src/locales/en/receipts.json` - Receipt processing with Malaysian tax types
- ✅ `src/locales/ms/receipts.json` - Malay receipt terminology and business types
- ✅ `src/locales/en/admin.json` - Admin panel with role-based access levels
- ✅ `src/locales/ms/admin.json` - Complete Malay admin translations
- ✅ `src/locales/en/errors.json` - Context-aware error messages
- ✅ `src/locales/ms/errors.json` - Malay error messages with business context

### Demo & Documentation
- ✅ `src/components/demo/AdvancedTranslationDemo.tsx` - Interactive demo component
- ✅ `docs/phase5-advanced-translations.md` - Comprehensive documentation

### Production-Ready Features
- **Pluralization**: Handles zero, one, and multiple item counts correctly
- **Role-Based Content**: Different messages for admin, user, guest, team member roles
- **Malaysian Business**: GST/SST tax types, RM currency, business registration
- **Cultural Accuracy**: Proper Malay translations with Malaysian business context
- **Performance**: Efficient translation loading and caching
- **Backward Compatibility**: All existing translations continue to work

The multi-language support system is now production-ready with advanced features that provide an authentic Malaysian business experience while maintaining excellent performance and scalability.