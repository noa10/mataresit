# Enhanced Team Management Database Schema

## Overview

This document describes the enhanced database schema for the comprehensive team management system in Mataresit. The enhancements provide audit trails, improved invitation management, bulk operations support, and security improvements.

## New Tables

### 1. `team_audit_logs`
**Purpose**: Comprehensive audit trail for all team management actions

**Key Features**:
- Tracks all team management actions with full context
- Records actor and target user information
- Stores before/after values for changes
- Includes IP address and user agent for security
- Supports metadata for extensibility

**Important Columns**:
- `action`: Enum of all possible team actions
- `performed_by`: User who performed the action
- `target_user_id`: User affected by the action (for member operations)
- `old_values`/`new_values`: JSONB fields for change tracking
- `metadata`: Extensible JSONB for additional context

### 2. `team_invitation_attempts`
**Purpose**: Track individual invitation sending attempts and delivery status

**Key Features**:
- Tracks multiple sending attempts per invitation
- Records delivery status from email providers
- Monitors email engagement (opens, clicks)
- Supports debugging failed deliveries

**Important Columns**:
- `attempt_number`: Sequential attempt counter
- `delivery_status`: pending, delivered, failed, bounced, spam
- `email_provider_id`: External email service tracking ID
- `opened_at`/`clicked_at`: Email engagement tracking

### 3. `team_bulk_operations`
**Purpose**: Manage and track bulk team management operations

**Key Features**:
- Supports bulk invitations, removals, and role updates
- Tracks operation progress and results
- Provides detailed error reporting
- Enables operation cancellation and retry

**Important Columns**:
- `operation_type`: Type of bulk operation
- `target_data`: JSONB array of operation targets
- `total_items`/`processed_items`: Progress tracking
- `results`: Detailed results for each item
- `operation_status`: pending, in_progress, completed, failed, cancelled

### 4. `team_invitation_rate_limits`
**Purpose**: Rate limiting for invitation sending to prevent abuse

**Key Features**:
- Multiple time windows (hour, day, week)
- Automatic window reset
- Per-team, per-user tracking
- Configurable limits

**Rate Limits**:
- **Hourly**: 50 invitations
- **Daily**: 200 invitations  
- **Weekly**: 1000 invitations

## Enhanced Existing Tables

### `team_invitations` Enhancements
**New Columns**:
- `invitation_attempts`: Counter for resend attempts
- `last_sent_at`: Timestamp of last sending attempt
- `cancelled_at`/`cancelled_by`: Cancellation tracking
- `custom_message`: Personalized invitation message
- `permissions`: JSONB for granular permissions
- `metadata`: Extensible JSONB for additional data

### `team_members` Enhancements
**New Columns**:
- `last_active_at`: Track member activity
- `invitation_accepted_at`: When invitation was accepted
- `added_by`: Who added this member
- `removal_scheduled_at`: Scheduled removal timestamp
- `member_metadata`: Extensible JSONB for member data

## New Functions

### 1. `log_team_audit_event()`
**Purpose**: Log team management actions with full context

**Parameters**:
- `p_team_id`: Team ID
- `p_action`: Action type (enum)
- `p_action_description`: Human-readable description
- `p_target_user_id`: Target user (optional)
- `p_old_values`/`p_new_values`: Change tracking
- `p_metadata`: Additional context

**Usage**:
```sql
SELECT log_team_audit_event(
  'team-uuid',
  'member_removed'::team_audit_action,
  'Removed inactive member',
  'user-uuid',
  '{"role": "member"}'::jsonb,
  '{}'::jsonb,
  '{"reason": "inactive"}'::jsonb
);
```

### 2. `check_invitation_rate_limit()`
**Purpose**: Check if user can send invitations within rate limits

**Parameters**:
- `p_team_id`: Team ID
- `p_user_id`: User ID (defaults to current user)
- `p_requested_count`: Number of invitations to send

**Returns**: JSONB with rate limit status
```json
{
  "allowed": true,
  "remaining_hour": 45,
  "remaining_day": 195,
  "remaining_week": 995
}
```

### 3. `update_invitation_rate_limit()`
**Purpose**: Update rate limiting counters after sending invitations

**Usage**: Called automatically after successful invitation sending

### 4. `cleanup_expired_invitations()`
**Purpose**: System function to cleanup expired invitations

**Features**:
- Automatically marks expired invitations
- Logs cleanup activity in audit trail
- Returns count of expired invitations

## Security Features

### Row Level Security (RLS)
All new tables have comprehensive RLS policies:

- **Audit Logs**: Team members can view, admins can insert
- **Invitation Attempts**: Team admins can view and manage
- **Bulk Operations**: Team admins have full access
- **Rate Limits**: Users can view their own, system manages all

### Permission Checks
- All functions include proper permission validation
- Rate limiting prevents abuse
- Audit trails provide security monitoring
- Proper cascading deletes maintain data integrity

## Performance Optimizations

### Indexes
Comprehensive indexing strategy for optimal performance:

- **Audit Logs**: team_id, performed_by, action, created_at
- **Invitation Attempts**: invitation_id, sent_at, delivery_status
- **Bulk Operations**: team_id, performed_by, status, started_at
- **Rate Limits**: (team_id, user_id), last_invitation_at
- **Enhanced Tables**: last_active_at, added_by, removal_scheduled_at

### Query Optimization
- Efficient RLS policies using EXISTS clauses
- Proper JOIN strategies for related data
- Pagination support for large datasets
- Optimized bulk operation queries

## Data Integrity

### Constraints
- **Check Constraints**: Validate enum values, positive counters, JSON structure
- **Foreign Key Constraints**: Maintain referential integrity with CASCADE options
- **Unique Constraints**: Prevent duplicate rate limit records
- **Logic Constraints**: Ensure consistent state (e.g., cancellation logic)

### Validation
- Email format validation on invitations
- Positive counter validation
- JSON structure validation
- Completion logic validation for bulk operations

## Migration Safety

### Backward Compatibility
- All new columns have DEFAULT values
- Existing functionality remains unchanged
- New features are additive only
- No breaking changes to existing APIs

### Rollback Support
- All changes are reversible
- No data loss during migration
- Proper error handling
- Transaction-based migration

## Usage Examples

### Logging a Member Removal
```sql
SELECT log_team_audit_event(
  team_id,
  'member_removed'::team_audit_action,
  'Member removed for policy violation',
  removed_user_id,
  jsonb_build_object('role', old_role, 'permissions', old_permissions),
  '{}',
  jsonb_build_object('reason', 'policy_violation', 'policy_id', 'P001')
);
```

### Checking Rate Limits Before Bulk Invite
```sql
SELECT check_invitation_rate_limit(team_id, auth.uid(), 25);
```

### Creating a Bulk Operation
```sql
INSERT INTO team_bulk_operations (
  team_id,
  operation_type,
  performed_by,
  target_data,
  operation_params,
  total_items
) VALUES (
  'team-uuid',
  'bulk_invite',
  auth.uid(),
  '[{"email": "user1@example.com", "role": "member"}, {"email": "user2@example.com", "role": "viewer"}]'::jsonb,
  '{"send_welcome_email": true, "custom_message": "Welcome to our team!"}'::jsonb,
  2
);
```

## Next Steps

1. **Deploy Migration**: Apply the migration to development environment
2. **Update Backend Functions**: Implement enhanced RPC functions
3. **Update Frontend Services**: Enhance teamService.ts with new capabilities
4. **Create UI Components**: Build interfaces for new functionality
5. **Add Testing**: Comprehensive test coverage for new features
6. **Documentation**: Update API documentation and user guides

This enhanced schema provides a solid foundation for comprehensive team management with proper security, auditing, and performance considerations.
