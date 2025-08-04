# Help Center Categories Configuration

## 📋 Overview

This document defines the complete category structure for the Mataresit help center, including category definitions, content organization, and implementation specifications for both English and Malay versions.

## 🗂️ Category Definitions

### English Categories

```javascript
const helpCategories = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Essential guides for new users to set up and start using Mataresit effectively.",
    icon: "Rocket",
    color: "text-green-600",
    priority: 1,
    guides: [
      "new-user-onboarding",
      "account-setup",
      "first-receipt-upload",
      "dashboard-navigation",
      "quick-start-5min"
    ]
  },
  {
    id: "core-features",
    title: "Core Features",
    description: "Master the essential receipt management and processing capabilities.",
    icon: "Wrench",
    color: "text-blue-600",
    priority: 2,
    guides: [
      "batch-processing",
      "ai-vision-processing",
      "semantic-search",
      "receipt-verification",
      "categorization-tagging"
    ]
  },
  {
    id: "ai-intelligence",
    title: "AI & Intelligence",
    description: "Leverage advanced AI features and Malaysian business intelligence.",
    icon: "Brain",
    color: "text-purple-600",
    priority: 3,
    guides: [
      "ai-processing-guide",
      "malaysian-business-intelligence",
      "confidence-scoring",
      "smart-notifications",
      "personalization-features"
    ]
  },
  {
    id: "team-collaboration",
    title: "Team Collaboration",
    description: "Set up and manage multi-user environments and collaborative workflows.",
    icon: "Users",
    color: "text-orange-600",
    priority: 4,
    guides: [
      "team-setup",
      "member-management",
      "role-permissions",
      "claims-management",
      "collaborative-workflows"
    ]
  },
  {
    id: "export-reporting",
    title: "Export & Reporting",
    description: "Generate insights, create reports, and export data in multiple formats.",
    icon: "FileText",
    color: "text-indigo-600",
    priority: 5,
    guides: [
      "export-options",
      "advanced-analytics",
      "pdf-generation",
      "custom-reports",
      "scheduled-exports"
    ]
  },
  {
    id: "platform-features",
    title: "Platform Features",
    description: "Optimize your experience across devices with PWA, mobile, and accessibility features.",
    icon: "Smartphone",
    color: "text-pink-600",
    priority: 6,
    guides: [
      "pwa-installation",
      "mobile-optimization",
      "offline-capabilities",
      "multi-language-support",
      "security-compliance"
    ]
  },
  {
    id: "malaysian-features",
    title: "Malaysian Features",
    description: "Specialized features for Malaysian businesses including local intelligence and compliance.",
    icon: "MapPin",
    color: "text-red-600",
    priority: 7,
    guides: [
      "business-directory",
      "gst-sst-integration",
      "local-payment-methods",
      "malaysian-compliance",
      "cultural-adaptations"
    ]
  },
  {
    id: "advanced-features",
    title: "Advanced Features",
    description: "Power user tools, API access, and system administration capabilities.",
    icon: "Settings",
    color: "text-gray-600",
    priority: 8,
    guides: [
      "power-user-tools",
      "api-documentation",
      "custom-automation",
      "system-administration",
      "performance-optimization"
    ]
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting & FAQ",
    description: "Resolve common issues and find answers to frequently asked questions.",
    icon: "HelpCircle",
    color: "text-yellow-600",
    priority: 9,
    guides: [
      "common-issues",
      "error-messages",
      "performance-problems",
      "frequently-asked-questions",
      "contact-support"
    ]
  }
];
```

### Malay Categories

```javascript
const helpCategoriesMs = [
  {
    id: "bermula",
    title: "Bermula",
    description: "Panduan penting untuk pengguna baru menyediakan dan mula menggunakan Mataresit dengan berkesan.",
    icon: "Rocket",
    color: "text-green-600",
    priority: 1,
    guides: [
      "panduan-pengguna-baru",
      "persediaan-akaun",
      "muat-naik-resit-pertama",
      "navigasi-papan-pemuka",
      "mula-pantas-5minit"
    ]
  },
  {
    id: "ciri-teras",
    title: "Ciri Teras",
    description: "Kuasai keupayaan pengurusan dan pemprosesan resit yang penting.",
    icon: "Wrench",
    color: "text-blue-600",
    priority: 2,
    guides: [
      "pemprosesan-kelompok",
      "pemprosesan-visi-ai",
      "carian-semantik",
      "pengesahan-resit",
      "pengkategorian-penandaan"
    ]
  },
  {
    id: "ai-kecerdasan",
    title: "AI & Kecerdasan",
    description: "Manfaatkan ciri AI lanjutan dan kecerdasan perniagaan Malaysia.",
    icon: "Brain",
    color: "text-purple-600",
    priority: 3,
    guides: [
      "panduan-pemprosesan-ai",
      "kecerdasan-perniagaan-malaysia",
      "pemarkahan-keyakinan",
      "pemberitahuan-pintar",
      "ciri-personalisasi"
    ]
  },
  {
    id: "kerjasama-pasukan",
    title: "Kerjasama Pasukan",
    description: "Sediakan dan uruskan persekitaran berbilang pengguna dan aliran kerja kolaboratif.",
    icon: "Users",
    color: "text-orange-600",
    priority: 4,
    guides: [
      "persediaan-pasukan",
      "pengurusan-ahli",
      "peranan-kebenaran",
      "pengurusan-tuntutan",
      "aliran-kerja-kolaboratif"
    ]
  },
  {
    id: "eksport-pelaporan",
    title: "Eksport & Pelaporan",
    description: "Jana wawasan, cipta laporan, dan eksport data dalam pelbagai format.",
    icon: "FileText",
    color: "text-indigo-600",
    priority: 5,
    guides: [
      "pilihan-eksport",
      "analitik-lanjutan",
      "penjanaan-pdf",
      "laporan-tersuai",
      "eksport-berjadual"
    ]
  },
  {
    id: "ciri-platform",
    title: "Ciri Platform",
    description: "Optimumkan pengalaman anda merentas peranti dengan PWA, mudah alih, dan ciri kebolehcapaian.",
    icon: "Smartphone",
    color: "text-pink-600",
    priority: 6,
    guides: [
      "pemasangan-pwa",
      "pengoptimuman-mudah-alih",
      "keupayaan-luar-talian",
      "sokongan-berbilang-bahasa",
      "keselamatan-pematuhan"
    ]
  },
  {
    id: "ciri-malaysia",
    title: "Ciri Malaysia",
    description: "Ciri khusus untuk perniagaan Malaysia termasuk kecerdasan tempatan dan pematuhan.",
    icon: "MapPin",
    color: "text-red-600",
    priority: 7,
    guides: [
      "direktori-perniagaan",
      "integrasi-gst-sst",
      "kaedah-pembayaran-tempatan",
      "pematuhan-malaysia",
      "adaptasi-budaya"
    ]
  },
  {
    id: "ciri-lanjutan",
    title: "Ciri Lanjutan",
    description: "Alat pengguna mahir, akses API, dan keupayaan pentadbiran sistem.",
    icon: "Settings",
    color: "text-gray-600",
    priority: 8,
    guides: [
      "alat-pengguna-mahir",
      "dokumentasi-api",
      "automasi-tersuai",
      "pentadbiran-sistem",
      "pengoptimuman-prestasi"
    ]
  },
  {
    id: "penyelesaian-masalah",
    title: "Penyelesaian Masalah & FAQ",
    description: "Selesaikan isu biasa dan cari jawapan kepada soalan yang kerap ditanya.",
    icon: "HelpCircle",
    color: "text-yellow-600",
    priority: 9,
    guides: [
      "isu-biasa",
      "mesej-ralat",
      "masalah-prestasi",
      "soalan-lazim",
      "hubungi-sokongan"
    ]
  }
];
```

## 📊 Content Organization Matrix

### Guide Distribution by Category

| Category | New User | Regular User | Power User | Team Admin | Total Guides |
|----------|----------|--------------|------------|------------|--------------|
| Getting Started | 5 | 2 | 1 | 2 | 10 |
| Core Features | 3 | 5 | 3 | 2 | 13 |
| AI & Intelligence | 2 | 4 | 4 | 1 | 11 |
| Team Collaboration | 1 | 2 | 3 | 6 | 12 |
| Export & Reporting | 2 | 3 | 4 | 3 | 12 |
| Platform Features | 3 | 3 | 2 | 2 | 10 |
| Malaysian Features | 2 | 4 | 2 | 2 | 10 |
| Advanced Features | 0 | 2 | 6 | 4 | 12 |
| Troubleshooting | 4 | 4 | 3 | 3 | 14 |

### Content Types by Category

| Category | Quick Start | Full Guide | FAQ | Troubleshooting | API Docs |
|----------|-------------|------------|-----|-----------------|----------|
| Getting Started | 5 | 3 | 8 | 2 | 0 |
| Core Features | 4 | 6 | 6 | 4 | 0 |
| AI & Intelligence | 2 | 5 | 4 | 3 | 0 |
| Team Collaboration | 3 | 5 | 5 | 2 | 0 |
| Export & Reporting | 2 | 4 | 3 | 2 | 3 |
| Platform Features | 4 | 4 | 4 | 3 | 0 |
| Malaysian Features | 2 | 6 | 6 | 2 | 0 |
| Advanced Features | 1 | 4 | 2 | 3 | 8 |
| Troubleshooting | 0 | 2 | 12 | 8 | 0 |

## 🔍 Search and Filtering

### Search Tags by Category
```javascript
const categoryTags = {
  "getting-started": ["onboarding", "setup", "basics", "new-user", "quick-start"],
  "core-features": ["upload", "processing", "search", "categorization", "batch"],
  "ai-intelligence": ["artificial-intelligence", "vision", "malaysian", "smart", "automation"],
  "team-collaboration": ["team", "collaboration", "permissions", "claims", "workflow"],
  "export-reporting": ["export", "reports", "analytics", "pdf", "data"],
  "platform-features": ["mobile", "pwa", "accessibility", "security", "multi-language"],
  "malaysian-features": ["malaysia", "local", "gst", "sst", "compliance"],
  "advanced-features": ["api", "power-user", "automation", "administration", "integration"],
  "troubleshooting": ["problems", "errors", "issues", "faq", "support"]
};
```

### Filter Options
- **User Level:** Beginner, Intermediate, Advanced, Expert
- **Content Type:** Guide, Quick Start, FAQ, Troubleshooting, API
- **Feature Area:** Core, AI, Collaboration, Reporting, Platform
- **Language:** English, Malay
- **Update Status:** Recently Updated, This Month, This Quarter

## 🎨 Visual Design Specifications

### Category Cards
- **Card Size:** 320px width, auto height
- **Icon Size:** 24px (h-6 w-6)
- **Title Font:** font-semibold text-lg
- **Description Font:** text-sm text-muted-foreground
- **Hover Effect:** shadow-lg transition-all duration-200
- **Active State:** ring-2 ring-primary bg-primary/5

### Color Scheme
- **Primary Colors:** Consistent with Mataresit brand
- **Category Colors:** Distinct colors for visual differentiation
- **Accessibility:** WCAG 2.1 AA compliant contrast ratios
- **Dark Mode:** Automatic adaptation for dark theme

This category structure provides comprehensive organization while maintaining intuitive navigation and supporting both casual browsing and targeted search across all user types and experience levels.
