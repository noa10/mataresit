# Enhanced User Removal System

## Overview

The Enhanced User Removal System provides comprehensive functionality for removing team members with proper data cleanup, access revocation, and edge case handling. This system ensures data integrity while providing flexible options for handling user data during removal.

## Key Features

### 🔧 **Comprehensive Data Cleanup**
- Automatic cleanup of user's team-specific data (receipts, claims, API keys)
- Optional data transfer to another team member
- Cleanup of conversation data, user interactions, and preferences
- Invalidation of pending invitations and bulk operations

### 🛡️ **Edge Case Handling**
- Prevention of removing team owners without ownership transfer
- Protection against removing the last admin
- Validation of permissions and team membership
- Comprehensive error handling and rollback

### ⏰ **Scheduled Removal**
- Schedule member removal for future dates
- Cancel scheduled removals
- Automatic processing of scheduled removals
- Audit trail for all scheduling actions

### 📊 **Bulk Operations**
- Remove multiple team members in a single operation
- Progress tracking and detailed results
- Transaction-based processing with rollback support
- Comprehensive logging and audit trails

## Core Functions

### 1. `remove_team_member_enhanced()`

**Purpose**: Comprehensive team member removal with data cleanup options

**Parameters**:
- `_team_id`: Team UUID
- `_user_id`: User UUID to remove
- `_reason`: Optional removal reason
- `_transfer_data`: Whether to transfer user's data to another member
- `_transfer_to_user_id`: Target user for data transfer (if transferring)

**Returns**: JSONB with detailed removal results

**Example Usage**:
```sql
-- Remove member with data cleanup
SELECT remove_team_member_enhanced(
  'team-uuid',
  'user-uuid',
  'Inactive member cleanup',
  false,
  NULL
);

-- Remove member with data transfer
SELECT remove_team_member_enhanced(
  'team-uuid',
  'user-uuid',
  'Role transition',
  true,
  'new-owner-uuid'
);
```

**Data Cleanup Performed**:
- ✅ Receipts (deleted or transferred)
- ✅ Claims (deleted or transferred)
- ✅ API keys for the team
- ✅ Conversation messages
- ✅ User interactions
- ✅ Theme preferences
- ✅ Pending invitations (cancelled)
- ✅ Rate limiting data
- ✅ Bulk operations (cancelled)
- ✅ Alert assignments
- ✅ On-call schedule entries

### 2. `transfer_team_ownership()`

**Purpose**: Transfer team ownership to another team member

**Parameters**:
- `_team_id`: Team UUID
- `_new_owner_id`: New owner's user UUID
- `_reason`: Optional transfer reason

**Example Usage**:
```sql
SELECT transfer_team_ownership(
  'team-uuid',
  'new-owner-uuid',
  'Founder stepping down'
);
```

**Process**:
1. Validates current user is team owner
2. Verifies new owner is team member
3. Updates team owner_id
4. Changes old owner role to admin
5. Changes new owner role to owner
6. Logs ownership transfer

### 3. `schedule_member_removal()`

**Purpose**: Schedule a team member for future removal

**Parameters**:
- `_team_id`: Team UUID
- `_user_id`: User UUID to schedule for removal
- `_removal_date`: When to remove the member
- `_reason`: Optional scheduling reason

**Example Usage**:
```sql
SELECT schedule_member_removal(
  'team-uuid',
  'user-uuid',
  '2024-08-01 00:00:00+00',
  'Contract ending'
);
```

### 4. `bulk_remove_team_members()`

**Purpose**: Remove multiple team members in a single operation

**Parameters**:
- `_team_id`: Team UUID
- `_user_ids`: Array of user UUIDs to remove
- `_reason`: Optional removal reason
- `_transfer_data`: Whether to transfer data
- `_transfer_to_user_id`: Target for data transfer

**Example Usage**:
```sql
SELECT bulk_remove_team_members(
  'team-uuid',
  ARRAY['user1-uuid', 'user2-uuid', 'user3-uuid'],
  'Department restructuring',
  false,
  NULL
);
```

## Utility Functions

### `get_removal_candidates()`
Identifies inactive team members who could be candidates for removal.

**Parameters**:
- `_team_id`: Team UUID
- `_inactive_days`: Days of inactivity threshold (default: 90)

**Returns**: Table with candidate information including last activity and inactivity duration.

### `get_team_member_stats()`
Provides comprehensive statistics about team membership.

**Returns**: JSONB with member counts by role, activity status, and recent changes.

## Security & Permissions

### **Permission Matrix**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Remove Members | ✅ | ✅ | Self Only | Self Only |
| Transfer Ownership | ✅ | ❌ | ❌ | ❌ |
| Schedule Removal | ✅ | ✅ | ❌ | ❌ |
| Bulk Remove | ✅ | ✅ | ❌ | ❌ |
| View Candidates | ✅ | ✅ | ❌ | ❌ |

### **Edge Case Protections**

1. **Owner Protection**: Cannot remove team owner without ownership transfer
2. **Last Admin Protection**: Cannot remove last admin if other members exist
3. **Self-Removal**: Members can always remove themselves
4. **Permission Validation**: All operations validate user permissions
5. **Data Integrity**: All operations are transaction-based with rollback

## Data Transfer Options

### **When to Transfer Data**
- Employee role transitions
- Temporary departures
- Maintaining project continuity
- Preserving historical records

### **When to Delete Data**
- Security breaches
- Policy violations
- Permanent departures
- Data minimization requirements

### **Transfer Process**
1. Validates transfer target is team member
2. Updates ownership of receipts and claims
3. Adds transfer metadata for audit trail
4. Logs transfer details in audit system

## Scheduled Removal System

### **Use Cases**
- Contract end dates
- Probationary periods
- Planned departures
- Automated cleanup

### **Process Flow**
1. **Schedule**: Admin schedules removal with future date
2. **Notification**: System can notify affected users (application-level)
3. **Processing**: Cron job processes scheduled removals
4. **Execution**: Automatic removal with full cleanup
5. **Logging**: Complete audit trail maintained

### **Cancellation**
Scheduled removals can be cancelled before execution:
```sql
SELECT cancel_scheduled_removal(
  'team-uuid',
  'user-uuid',
  'Contract extended'
);
```

## Audit Trail

Every removal operation creates comprehensive audit logs including:

- **Action Details**: What was done and when
- **Actor Information**: Who performed the action
- **Target Information**: Who was affected
- **Change Details**: Before/after values
- **Context**: Reason, transfer details, cleanup results
- **Metadata**: Additional context and error information

## Error Handling

### **Common Error Codes**
- `NOT_MEMBER`: User is not a team member
- `CANNOT_REMOVE_OWNER`: Cannot remove team owner
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `LAST_ADMIN`: Cannot remove last admin
- `REMOVAL_FAILED`: General removal failure
- `INVALID_TRANSFER_TARGET`: Transfer target invalid

### **Rollback Protection**
All operations use database transactions to ensure:
- Partial failures are rolled back
- Data consistency is maintained
- Error states are logged
- System remains stable

## Integration Points

### **Frontend Integration**
- Enhanced `teamService.ts` methods
- Confirmation dialogs for destructive actions
- Progress tracking for bulk operations
- Real-time updates for scheduled removals

### **Backend Integration**
- Cron job for scheduled removal processing
- Email notifications for affected users
- Session invalidation (application-level)
- API rate limiting updates

### **Monitoring Integration**
- Audit log analysis
- Removal pattern monitoring
- Error rate tracking
- Performance metrics

## Best Practices

### **Before Removal**
1. ✅ Verify user permissions
2. ✅ Check for data dependencies
3. ✅ Consider data transfer needs
4. ✅ Notify affected stakeholders
5. ✅ Document removal reason

### **During Removal**
1. ✅ Use appropriate function for use case
2. ✅ Provide clear removal reasons
3. ✅ Monitor for errors
4. ✅ Verify cleanup completion
5. ✅ Check audit logs

### **After Removal**
1. ✅ Verify user access revoked
2. ✅ Confirm data cleanup
3. ✅ Update team documentation
4. ✅ Notify remaining team members
5. ✅ Archive audit records

## Migration and Deployment

### **Backward Compatibility**
- Legacy `remove_team_member()` function maintained
- Existing code continues to work
- Enhanced features available through new functions
- Gradual migration path available

### **Deployment Steps**
1. Apply database migration
2. Update application code
3. Test removal scenarios
4. Configure cron jobs
5. Monitor audit logs

This enhanced system provides enterprise-grade team member management with comprehensive data protection and audit capabilities.
