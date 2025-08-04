# Documentation Navigation Structure Design

## 📋 Overview

This document outlines the comprehensive navigation structure for Mataresit's help center, designed to serve both new users and power users with intuitive, logical organization and progressive disclosure of information.

## 🎯 Design Principles

### User-Centric Organization
- **Task-oriented grouping** - Organize by what users want to accomplish
- **Progressive complexity** - Basic concepts first, advanced features later
- **Multiple entry points** - Support different user journeys and skill levels
- **Contextual relationships** - Connect related features and workflows

### Navigation Hierarchy
- **Primary Categories** - Major feature groups and user types
- **Secondary Categories** - Specific features within each group
- **Tertiary Content** - Detailed guides, quick starts, and troubleshooting
- **Cross-references** - Related content and next steps

## 🗂️ Primary Navigation Structure

### 1. 🚀 Getting Started
**Target Audience:** New users, first-time visitors  
**Goal:** Quick onboarding and essential setup

#### Subcategories:
- **New User Onboarding**
  - Account Setup & Verification
  - First Receipt Upload
  - Dashboard Navigation
  - Basic Settings Configuration

- **Quick Start Guides**
  - 5-Minute Setup
  - Upload Your First Receipt
  - Generate Your First Report
  - Install Mobile App (PWA)

- **Essential Concepts**
  - How Mataresit Works
  - AI Processing Explained
  - Subscription Tiers Overview
  - Security & Privacy Basics

### 2. 🔧 Core Features
**Target Audience:** Regular users learning main functionality  
**Goal:** Master essential receipt management capabilities

#### Subcategories:
- **Receipt Management**
  - Batch Processing & Upload
  - AI Vision Processing
  - Receipt Verification & Editing
  - Categorization & Tagging

- **Search & Discovery**
  - Semantic Search Guide
  - Natural Language Queries
  - Advanced Search Filters
  - Search Tips & Best Practices

- **Organization**
  - Categories & Tags
  - Custom Fields
  - Bulk Operations
  - Archive & Backup

### 3. 🤖 AI & Intelligence
**Target Audience:** Users wanting to leverage advanced AI features  
**Goal:** Understand and optimize AI-powered capabilities

#### Subcategories:
- **AI Processing**
  - Vision Processing vs OCR
  - Confidence Scoring
  - Manual Corrections
  - Processing Optimization

- **Malaysian Intelligence**
  - Business Directory (500+ businesses)
  - GST/SST Tax Recognition
  - Local Payment Methods
  - Currency & Format Handling

- **Smart Features**
  - Real-time Notifications
  - Advanced Analytics
  - Personalization Settings
  - Automated Workflows

### 4. 👥 Team Collaboration
**Target Audience:** Team administrators and collaborative users  
**Goal:** Set up and manage multi-user environments

#### Subcategories:
- **Team Setup**
  - Creating Teams
  - Inviting Members
  - Role Assignment
  - Permission Management

- **Collaboration Features**
  - Shared Workspaces
  - Claims Management
  - Approval Workflows
  - Team Analytics

- **Administration**
  - User Management
  - Access Control
  - Billing Management
  - Team Settings

### 5. 📊 Export & Reporting
**Target Audience:** Users needing data analysis and reporting  
**Goal:** Generate insights and export data effectively

#### Subcategories:
- **Export Options**
  - Format Selection (PDF, Excel, CSV)
  - Custom Templates
  - Scheduled Exports
  - Bulk Export Operations

- **Analytics & Reports**
  - Expense Analytics
  - Business Intelligence
  - Custom Dashboards
  - Trend Analysis

- **Integration**
  - API Access & Documentation
  - Third-party Integrations
  - Webhook Configuration
  - Data Synchronization

### 6. 📱 Platform Features
**Target Audience:** Users optimizing their experience across devices  
**Goal:** Maximize platform capabilities and accessibility

#### Subcategories:
- **Mobile & PWA**
  - Progressive Web App Installation
  - Mobile Optimization
  - Offline Capabilities
  - Camera Integration

- **Accessibility**
  - Multi-language Support (EN/MS)
  - Keyboard Navigation
  - Screen Reader Compatibility
  - Visual Accessibility

- **Security & Compliance**
  - Data Protection
  - Two-Factor Authentication
  - Compliance Standards
  - Privacy Controls

### 7. 🇲🇾 Malaysian Features
**Target Audience:** Malaysian users and businesses  
**Goal:** Leverage local business intelligence and cultural adaptations

#### Subcategories:
- **Local Business Intelligence**
  - Malaysian Business Directory
  - Chain Recognition (AEON, 99 Speedmart, etc.)
  - Local Service Providers
  - Regional Variations

- **Tax & Compliance**
  - GST/SST Integration
  - Malaysian Tax Categories
  - Compliance Reporting
  - Government Requirements

- **Cultural Adaptations**
  - Malay Language Support
  - Local Date/Time Formats
  - Malaysian Currency (MYR)
  - Cultural Business Practices

### 8. ⚙️ Advanced Features
**Target Audience:** Power users and system administrators  
**Goal:** Master complex workflows and system optimization

#### Subcategories:
- **Power User Tools**
  - Advanced Search Techniques
  - Bulk Operations
  - Custom Automation
  - System Optimization

- **API & Development**
  - REST API Documentation
  - Authentication & Security
  - Rate Limits & Quotas
  - Integration Examples

- **System Administration**
  - User Management
  - System Configuration
  - Performance Monitoring
  - Troubleshooting Tools

### 9. ❓ Troubleshooting & FAQ
**Target Audience:** Users experiencing issues or seeking quick answers  
**Goal:** Resolve problems quickly and efficiently

#### Subcategories:
- **Common Issues**
  - Upload Problems
  - Processing Errors
  - Search Issues
  - Performance Problems

- **Error Messages**
  - Error Code Reference
  - Solution Guides
  - Escalation Procedures
  - Prevention Tips

- **Frequently Asked Questions**
  - General Questions
  - Feature-Specific FAQ
  - Billing & Subscription
  - Technical Support

## 🧭 Navigation Implementation

### URL Structure
```
/help/{language}/{category}/{subcategory}/{guide-name}

Examples:
/help/en/getting-started/new-user-onboarding/account-setup
/help/ms/ciri-teras/pemprosesan-kelompok/panduan-muat-naik
/help/en/team-collaboration/team-setup/creating-teams
/help/en/advanced-features/api-development/authentication
```

### Breadcrumb Navigation
```
Help Center > Getting Started > New User Onboarding > Account Setup
Pusat Bantuan > Bermula > Panduan Pengguna Baru > Persediaan Akaun
```

### Category Icons & Visual Identity
- 🚀 Getting Started - Rocket (launch/beginning)
- 🔧 Core Features - Wrench (tools/functionality)
- 🤖 AI & Intelligence - Robot (artificial intelligence)
- 👥 Team Collaboration - Users (teamwork)
- 📊 Export & Reporting - Chart (analytics)
- 📱 Platform Features - Smartphone (cross-platform)
- 🇲🇾 Malaysian Features - Flag (localization)
- ⚙️ Advanced Features - Gear (configuration)
- ❓ Troubleshooting & FAQ - Question mark (help)

## 🔍 Search & Discovery

### Search Categories
- **All Documentation** - Global search across all content
- **Getting Started** - Onboarding and basic setup
- **Feature Guides** - Specific functionality documentation
- **Troubleshooting** - Problem-solving content
- **API Documentation** - Technical integration guides

### Search Filters
- **Content Type:** Guide, Quick Start, FAQ, Troubleshooting
- **User Level:** Beginner, Intermediate, Advanced
- **Feature Category:** Core, AI, Collaboration, Reporting, etc.
- **Language:** English, Malay
- **Last Updated:** Recent, This Month, This Quarter

### Related Content Suggestions
- **Next Steps** - Logical progression after current content
- **Related Features** - Connected functionality
- **Prerequisites** - Required knowledge or setup
- **Advanced Topics** - Deeper exploration of concepts

## 👤 User Journey Mapping

### New User Journey
1. **Landing** → Getting Started > New User Onboarding
2. **Setup** → Account Setup & Verification
3. **First Use** → Upload Your First Receipt
4. **Exploration** → Core Features > Receipt Management
5. **Growth** → AI & Intelligence > Smart Features

### Team Administrator Journey
1. **Planning** → Team Collaboration > Team Setup
2. **Implementation** → Creating Teams & Inviting Members
3. **Configuration** → Role Assignment & Permission Management
4. **Optimization** → Advanced Features > System Administration
5. **Maintenance** → Troubleshooting & FAQ > Common Issues

### Power User Journey
1. **Mastery** → Advanced Features > Power User Tools
2. **Integration** → Export & Reporting > API Access
3. **Automation** → Custom Automation & Workflows
4. **Optimization** → System Configuration & Performance
5. **Innovation** → API & Development > Integration Examples

### Malaysian Business User Journey
1. **Localization** → Malaysian Features > Local Business Intelligence
2. **Compliance** → Tax & Compliance > GST/SST Integration
3. **Cultural Adaptation** → Cultural Adaptations > Malay Language Support
4. **Business Intelligence** → Malaysian Business Directory
5. **Optimization** → Advanced Analytics with Local Context

## 🔄 Cross-Navigation Patterns

### Feature Interconnections
- **Receipt Upload** ↔ **AI Processing** ↔ **Search & Discovery**
- **Team Setup** ↔ **Permission Management** ↔ **Collaboration Features**
- **Export Options** ↔ **Analytics** ↔ **API Integration**
- **Malaysian Features** ↔ **Tax Compliance** ↔ **Business Intelligence**

### Progressive Disclosure
- **Quick Start** → **Full Guide** → **Advanced Configuration** → **Troubleshooting**
- **Basic Concepts** → **Feature Details** → **Best Practices** → **Expert Tips**

This navigation structure provides intuitive organization while supporting both casual browsing and targeted search, ensuring users can find relevant information regardless of their experience level or specific needs.
