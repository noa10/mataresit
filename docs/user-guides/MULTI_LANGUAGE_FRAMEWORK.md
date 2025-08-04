# Multi-Language Documentation Framework

## 🌐 Overview

This framework establishes the structure and processes for maintaining Mataresit documentation in multiple languages, with primary support for English and Malay, and extensibility for future languages.

## 🎯 Language Strategy

### Primary Languages
- **English (en)** - Primary language, complete documentation
- **Malay (ms)** - Secondary language, culturally adapted content

### Future Expansion
- **Chinese (zh)** - Planned for Malaysian Chinese community
- **Tamil (ta)** - Planned for Malaysian Indian community
- **Indonesian (id)** - Planned for regional expansion

## 📁 File Structure

### Directory Organization
```
docs/user-guides/
├── en/                          # English documentation
│   ├── onboarding/
│   │   ├── new-user-guide.md
│   │   ├── team-admin-guide.md
│   │   └── power-user-guide.md
│   ├── core-features/
│   │   ├── batch-processing.md
│   │   ├── ai-vision-processing.md
│   │   └── semantic-search.md
│   ├── collaboration/
│   │   ├── team-management.md
│   │   ├── claims-management.md
│   │   └── role-permissions.md
│   ├── reporting/
│   │   ├── export-options.md
│   │   ├── advanced-analytics.md
│   │   └── pdf-generation.md
│   ├── platform/
│   │   ├── pwa-installation.md
│   │   ├── mobile-optimization.md
│   │   └── security-compliance.md
│   └── malaysian-features/
│       ├── business-intelligence.md
│       ├── tax-integration.md
│       └── local-payments.md
├── ms/                          # Malay documentation
│   ├── onboarding/
│   │   ├── panduan-pengguna-baru.md
│   │   ├── panduan-admin-pasukan.md
│   │   └── panduan-pengguna-mahir.md
│   ├── ciri-teras/
│   │   ├── pemprosesan-kelompok.md
│   │   ├── pemprosesan-visi-ai.md
│   │   └── carian-semantik.md
│   ├── kerjasama/
│   │   ├── pengurusan-pasukan.md
│   │   ├── pengurusan-tuntutan.md
│   │   └── peranan-kebenaran.md
│   ├── pelaporan/
│   │   ├── pilihan-eksport.md
│   │   ├── analitik-lanjutan.md
│   │   └── penjanaan-pdf.md
│   ├── platform/
│   │   ├── pemasangan-pwa.md
│   │   ├── pengoptimuman-mudah-alih.md
│   │   └── keselamatan-pematuhan.md
│   └── ciri-malaysia/
│       ├── kecerdasan-perniagaan.md
│       ├── integrasi-cukai.md
│       └── pembayaran-tempatan.md
└── assets/                      # Shared assets
    └── screenshots/
        ├── en/                  # English screenshots
        └── ms/                  # Malay screenshots
```

### Naming Conventions

**English Files:**
- Use kebab-case: `feature-name.md`
- Descriptive names: `batch-processing-guide.md`
- Consistent terminology across files

**Malay Files:**
- Use kebab-case with Malay terms: `ciri-nama.md`
- Direct translation when possible: `panduan-pemprosesan-kelompok.md`
- Cultural adaptation when needed: `ciri-malaysia.md`

## 🔄 Translation Workflow

### Content Creation Process

1. **English First Approach**
   - Create complete English documentation
   - Include all screenshots and examples
   - Review and approve English version
   - Prepare for translation

2. **Professional Translation**
   - Use qualified Malaysian translators
   - Maintain technical accuracy
   - Preserve formatting and structure
   - Include cultural adaptations

3. **Cultural Localization**
   - Adapt examples for Malaysian context
   - Use local business names and scenarios
   - Adjust currency, dates, and formats
   - Consider cultural communication styles

4. **Review and Quality Assurance**
   - Native speaker review
   - Technical accuracy verification
   - Consistency check across documents
   - User testing with target audience

### Translation Standards

**Technical Terms:**
- Maintain English terms for UI elements
- Translate conceptual explanations
- Use consistent terminology across documents
- Maintain glossary of translated terms

**Cultural Adaptations:**
- Use Malaysian business examples
- Reference local regulations (GST/SST)
- Include Malaysian holidays and business hours
- Adapt communication style for local audience

## 📝 Content Guidelines

### English Documentation Standards

**Writing Style:**
- Clear, concise, professional tone
- Active voice and imperative mood
- Scannable headers and bullet points
- Consistent terminology throughout

**Technical Content:**
- Step-by-step instructions
- Screenshot annotations in English
- Code examples with English comments
- Error messages in original English

### Malay Documentation Standards

**Writing Style:**
- Formal but approachable Malay
- Respect for cultural communication norms
- Clear instructions with polite language
- Consistent use of technical terms

**Cultural Considerations:**
- Use "Anda" for formal address
- Include Islamic calendar references when relevant
- Consider Malaysian business practices
- Respect for hierarchy in team features

**Technical Adaptations:**
- UI elements remain in English with Malay explanations
- Currency in MYR format
- Date format: DD/MM/YYYY
- Time format: 24-hour with Malaysian timezone

## 🖼️ Screenshot Localization

### Language-Specific Screenshots

**English Screenshots:**
- Complete UI in English
- Demo data in English
- International business examples
- USD currency for international examples

**Malay Screenshots:**
- UI remains in English (as per application)
- Demo data with Malaysian context
- Local business names (AEON, 99 Speedmart)
- MYR currency formatting
- Malaysian date/time formats

### Annotation Strategy

**Bilingual Annotations:**
- Primary language for UI elements
- Explanatory text in document language
- Consistent color coding across languages
- Cultural context in annotations

## 🔧 Technical Implementation

### Help Center Integration

**URL Structure:**
```
/help/en/{category}/{guide-name}
/help/ms/{category}/{guide-name}
```

**Language Detection:**
- Browser language preference
- User account language setting
- Manual language selection
- Fallback to English

**Navigation Structure:**
```javascript
const helpCategories = {
  en: {
    'getting-started': 'Getting Started',
    'core-features': 'Core Features',
    'collaboration': 'Team Collaboration',
    'reporting': 'Export & Reporting',
    'platform': 'Platform Features',
    'malaysian-features': 'Malaysian Features'
  },
  ms: {
    'bermula': 'Bermula',
    'ciri-teras': 'Ciri Teras',
    'kerjasama': 'Kerjasama Pasukan',
    'pelaporan': 'Eksport & Pelaporan',
    'platform': 'Ciri Platform',
    'ciri-malaysia': 'Ciri Malaysia'
  }
};
```

### Search Implementation

**Multi-Language Search:**
- Index content in both languages
- Language-specific search results
- Cross-language search suggestions
- Fallback to English results

**Search Optimization:**
- Language-specific keywords
- Cultural search patterns
- Local business terminology
- Technical term variations

## 📊 Quality Assurance

### Review Process

**English Content:**
- Technical accuracy review
- Grammar and style check
- Screenshot verification
- User experience testing

**Malay Content:**
- Native speaker review
- Cultural appropriateness check
- Technical term consistency
- Local user testing

### Maintenance Schedule

**Regular Updates:**
- Monthly content review
- Quarterly screenshot updates
- Annual comprehensive review
- Feature release translations

**Quality Metrics:**
- Translation accuracy scores
- User feedback ratings
- Support ticket reduction
- Content usage analytics

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- Set up directory structure
- Create translation templates
- Establish workflow processes
- Train content team

### Phase 2: Core Content (Week 3-6)
- Translate essential guides
- Create Malay screenshots
- Implement help center integration
- Test language switching

### Phase 3: Enhancement (Week 7-8)
- Add advanced features documentation
- Implement search functionality
- Conduct user testing
- Optimize performance

### Phase 4: Launch (Week 9-10)
- Final quality assurance
- Soft launch with beta users
- Gather feedback and iterate
- Full public launch

This multi-language framework ensures consistent, culturally appropriate, and technically accurate documentation across all supported languages while maintaining scalability for future expansion.
