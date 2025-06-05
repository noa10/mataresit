# Pricing Structure Update 2025

## Overview

This document outlines the updated pricing structure implemented in January 2025, featuring enhanced tiers with new features and improved value propositions.

## New Pricing Tiers

### Free Tier ($0/month)
- **Target Audience**: Individuals getting started
- **Monthly Receipts**: 25
- **Storage**: 1GB
- **Data Retention**: 7 days
- **Batch Upload**: 1 concurrent upload
- **Users**: Single user access
- **Features**:
  - Basic search functionality
  - Basic OCR with AI enhancement
  - Simple monthly overview
- **Limitations**:
  - No batch processing
  - No version control
  - No integrations
  - Basic support only

### Pro Tier ($10/month, $108/year)
- **Target Audience**: Small teams and advanced users
- **Monthly Receipts**: 200
- **Storage**: 10GB
- **Data Retention**: 90 days
- **Batch Upload**: 5 concurrent uploads
- **Users**: Up to 5 users
- **Features**:
  - Advanced search with filters and tags
  - Version control
  - Basic integrations (QuickBooks, Xero, Google Drive)
  - Custom branding
  - Standard support
  - Advanced analytics
- **Annual Savings**: 10% ($12 savings)

### Max Tier ($20/month, $216/year)
- **Target Audience**: Growing businesses and power users
- **Monthly Receipts**: Unlimited
- **Storage**: Unlimited
- **Data Retention**: 365 days
- **Batch Upload**: 20 concurrent uploads
- **Users**: Unlimited
- **Features**:
  - All Pro features
  - Advanced integrations (Slack, Zapier, Custom API)
  - Priority support
  - API access
  - Advanced version control
  - Custom dashboards
- **Annual Savings**: 10% ($24 savings)

## Key Changes from Previous Structure

### Storage Increases
- **Free**: 100MB → 1GB (10x increase)
- **Pro**: 2GB → 10GB (5x increase)
- **Max**: 10GB → Unlimited

### New Features Added

#### Version Control
- Track changes to receipt data
- Revert to previous versions
- Change history and audit trail
- Available: Pro and Max tiers

#### Integrations
- **Basic Level (Pro)**: QuickBooks, Xero, Google Drive
- **Advanced Level (Max)**: All basic + Slack, Zapier, Custom API
- Automated data sync and workflow automation

#### Custom Branding
- Company logo upload
- Custom color schemes
- Branded interface
- Available: Pro and Max tiers

#### Enhanced User Management
- **Free**: Single user
- **Pro**: Up to 5 users
- **Max**: Unlimited users

#### Support Levels
- **Free**: Basic email support
- **Pro**: Standard support with priority response
- **Max**: Priority support with dedicated agent and phone support

## Technical Implementation

### Database Schema Updates
- Added new columns to `subscription_limits` table:
  - `version_control_enabled`
  - `integrations_level`
  - `custom_branding_enabled`
  - `max_users`
  - `support_level`
  - `api_access_enabled`

### Feature Flag System
- Enhanced `useSubscription` hook with new feature checks
- Dynamic feature availability based on subscription tier
- Graceful degradation for unsupported features

### UI Components
- New feature showcase components
- Enhanced subscription status display
- Feature-specific placeholder components for future implementation

## Migration Strategy

### Existing Users
- All existing users maintain their current benefits
- Storage limits automatically upgraded
- New features become available immediately upon tier qualification

### Database Migration
- Run migration `20250116000000_update_subscription_limits.sql`
- Updates existing subscription limits
- Adds new feature columns with appropriate defaults

## Future Implementation Roadmap

### Phase 1: Core Features (Q1 2025)
- Version control system implementation
- Basic integrations (QuickBooks, Xero)
- Custom branding system

### Phase 2: Advanced Features (Q2 2025)
- Advanced integrations (Slack, Zapier)
- API development and documentation
- Enhanced analytics dashboard

### Phase 3: Enterprise Features (Q3 2025)
- Advanced user management
- Custom workflows
- Enterprise security features

## Testing Checklist

### Subscription Management
- [ ] Upgrade/downgrade between tiers
- [ ] Feature availability checks
- [ ] Usage limit enforcement
- [ ] Billing integration

### UI/UX
- [ ] Pricing page displays correctly
- [ ] Feature components show appropriate states
- [ ] Navigation includes Features page
- [ ] Subscription status shows new features

### Database
- [ ] Migration runs successfully
- [ ] New columns populated correctly
- [ ] Feature flags work as expected
- [ ] Usage tracking includes new metrics

## Support Documentation

### User Guides
- Feature comparison chart
- Upgrade/downgrade instructions
- New feature tutorials
- FAQ updates

### Developer Documentation
- API documentation for new features
- Integration guides
- Feature flag usage
- Database schema reference

## Monitoring and Analytics

### Key Metrics to Track
- Conversion rates between tiers
- Feature adoption rates
- User engagement with new features
- Support ticket volume by tier

### Success Criteria
- Increased Pro tier adoption
- Reduced churn rate
- Higher customer satisfaction scores
- Improved feature utilization

## Rollback Plan

### Emergency Rollback
1. Revert database migration
2. Restore previous pricing page
3. Remove new feature components
4. Update Stripe configuration

### Partial Rollback
- Disable specific features via feature flags
- Adjust pricing without full rollback
- Maintain database schema for future re-enable
