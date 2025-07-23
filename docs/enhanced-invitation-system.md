# Enhanced Invitation System

## Overview

The Enhanced Invitation System provides comprehensive functionality for managing team invitations with advanced features including role assignment, expiration handling, resend capabilities, duplicate prevention, and bulk operations. This system ensures secure and efficient team member onboarding with complete audit trails.

## Key Features

### 🎯 **Advanced Role Assignment**
- Granular role assignment during invitation (owner, admin, member, viewer)
- Custom permissions assignment for fine-grained access control
- Role-based invitation permissions (only owners can invite admins)
- Validation of role assignment permissions

### 📧 **Enhanced Invitation Management**
- Custom invitation messages for personalized onboarding
- Flexible expiration periods (configurable days)
- Resend capabilities with optional expiration extension
- Invitation cancellation with reason tracking
- Comprehensive duplicate prevention

### 🚀 **Bulk Operations**
- Send multiple invitations in a single operation
- Progress tracking and detailed results
- Rate limiting for bulk operations
- Transaction-based processing with rollback support

### 🔒 **Security & Rate Limiting**
- Comprehensive rate limiting (50/hour, 200/day, 1000/week)
- Email format validation and security checks
- Token-based invitation system with secure generation
- Permission validation for all operations

## Core Functions

### 1. `invite_team_member_enhanced()`

**Purpose**: Send enhanced team invitations with advanced features

**Parameters**:
- `_team_id`: Team UUID
- `_email`: Invitee email address
- `_role`: Role to assign (default: 'member')
- `_custom_message`: Optional personalized message
- `_permissions`: Custom permissions JSONB (default: '{}')
- `_expires_in_days`: Expiration period in days (default: 7)
- `_send_email`: Whether to send email notification (default: true)

**Returns**: JSONB with detailed invitation results

**Example Usage**:
```sql
-- Basic invitation
SELECT invite_team_member_enhanced(
  'team-uuid',
  'user@example.com',
  'member'
);

-- Advanced invitation with custom message and permissions
SELECT invite_team_member_enhanced(
  'team-uuid',
  'admin@example.com',
  'admin',
  'Welcome to our team! Looking forward to working with you.',
  '{"can_manage_billing": true}',
  14,  -- 14 days expiration
  true
);
```

**Features**:
- ✅ Email format validation
- ✅ Rate limit checking
- ✅ Duplicate prevention
- ✅ Role permission validation
- ✅ Custom message support
- ✅ Flexible expiration periods
- ✅ Comprehensive audit logging

### 2. `resend_team_invitation()`

**Purpose**: Resend an existing invitation with optional enhancements

**Parameters**:
- `_invitation_id`: UUID of invitation to resend
- `_custom_message`: Optional new custom message
- `_extend_expiration`: Whether to extend expiration (default: true)
- `_new_expiration_days`: New expiration period (default: 7)

**Example Usage**:
```sql
-- Simple resend
SELECT resend_team_invitation('invitation-uuid');

-- Resend with extended expiration and new message
SELECT resend_team_invitation(
  'invitation-uuid',
  'Following up on your team invitation - we would love to have you join us!',
  true,
  14
);
```

**Features**:
- ✅ Automatic token regeneration
- ✅ Expiration extension options
- ✅ Custom message updates
- ✅ Attempt tracking
- ✅ Rate limit compliance

### 3. `cancel_team_invitation()`

**Purpose**: Cancel pending or expired invitations

**Parameters**:
- `_invitation_id`: UUID of invitation to cancel
- `_reason`: Optional cancellation reason

**Example Usage**:
```sql
SELECT cancel_team_invitation(
  'invitation-uuid',
  'Position filled by another candidate'
);
```

**Features**:
- ✅ Permission validation (admin/owner or original inviter)
- ✅ Status validation (only pending/expired can be cancelled)
- ✅ Reason tracking for audit purposes
- ✅ Comprehensive logging

### 4. `bulk_invite_team_members()`

**Purpose**: Send multiple invitations in a single operation

**Parameters**:
- `_team_id`: Team UUID
- `_invitations`: JSONB array of invitation objects
- `_default_role`: Default role if not specified (default: 'member')
- `_expires_in_days`: Expiration period (default: 7)
- `_send_emails`: Whether to send email notifications (default: true)

**Example Usage**:
```sql
SELECT bulk_invite_team_members(
  'team-uuid',
  '[
    {
      "email": "user1@example.com",
      "role": "member",
      "custom_message": "Welcome to the development team!"
    },
    {
      "email": "user2@example.com",
      "role": "admin",
      "permissions": {"can_manage_billing": true}
    },
    {
      "email": "user3@example.com"
    }
  ]'::jsonb,
  'member',
  7,
  true
);
```

**Features**:
- ✅ Bulk rate limit validation
- ✅ Individual invitation processing
- ✅ Progress tracking and detailed results
- ✅ Transaction safety with rollback
- ✅ Bulk operation audit logging

### 5. `accept_team_invitation_enhanced()`

**Purpose**: Accept team invitations with comprehensive validation

**Parameters**:
- `_token`: Invitation token from email

**Example Usage**:
```sql
SELECT accept_team_invitation_enhanced('invitation-token-here');
```

**Features**:
- ✅ Token validation and expiration checking
- ✅ Email address verification
- ✅ Existing membership handling
- ✅ Role assignment with permissions
- ✅ Comprehensive audit logging

## Utility Functions

### `get_team_invitations()`
Retrieve team invitations with filtering and detailed information.

**Parameters**:
- `_team_id`: Team UUID
- `_status`: Optional status filter
- `_include_expired`: Include expired invitations (default: false)

**Returns**: Table with invitation details including inviter information, attempts, and metadata.

### `get_invitation_stats()`
Get comprehensive statistics about team invitations.

**Returns**: JSONB with invitation counts by status, role distribution, and activity metrics.

## Security Features

### **Permission Matrix**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Invite Members | ✅ | ✅ | ❌ | ❌ |
| Invite Admins | ✅ | ❌ | ❌ | ❌ |
| Resend Invitations | ✅ | ✅ | ❌ | ❌ |
| Cancel Invitations | ✅ | ✅ | Own Only | ❌ |
| Bulk Invitations | ✅ | ✅ | ❌ | ❌ |
| View Invitations | ✅ | ✅ | ❌ | ❌ |

### **Rate Limiting**

- **Hourly Limit**: 50 invitations per user per team
- **Daily Limit**: 200 invitations per user per team
- **Weekly Limit**: 1000 invitations per user per team
- **Bulk Operations**: Rate limits apply to total invitation count

### **Validation & Security**

1. **Email Validation**: RFC-compliant email format checking
2. **Token Security**: Cryptographically secure token generation
3. **Permission Checks**: Comprehensive role-based access control
4. **Duplicate Prevention**: Multiple layers of duplicate detection
5. **Expiration Handling**: Automatic expiration and cleanup

## Advanced Features

### **Custom Messages**
Personalize invitations with custom messages for better user experience:

```sql
SELECT invite_team_member_enhanced(
  'team-uuid',
  'developer@example.com',
  'member',
  'Hi! We were impressed by your portfolio and would love to have you join our development team. Looking forward to collaborating!'
);
```

### **Custom Permissions**
Assign granular permissions beyond standard roles:

```sql
SELECT invite_team_member_enhanced(
  'team-uuid',
  'contractor@example.com',
  'member',
  NULL,
  '{"can_view_analytics": true, "can_export_data": false, "project_access": ["project-1", "project-2"]}'
);
```

### **Flexible Expiration**
Set custom expiration periods based on invitation type:

```sql
-- Short-term contractor (3 days)
SELECT invite_team_member_enhanced('team-uuid', 'contractor@example.com', 'member', NULL, '{}', 3);

-- Executive invitation (30 days)
SELECT invite_team_member_enhanced('team-uuid', 'executive@example.com', 'admin', NULL, '{}', 30);
```

## Integration Points

### **Email System Integration**
- Automatic email sending via existing trigger system
- Custom message inclusion in email templates
- Delivery tracking and engagement monitoring
- Resend notifications with attempt tracking

### **Frontend Integration**
- Enhanced invitation forms with role selection
- Bulk invitation interfaces with progress tracking
- Invitation management dashboards
- Real-time status updates

### **Audit System Integration**
- Complete audit trails for all invitation actions
- Detailed metadata tracking
- Performance metrics and analytics
- Compliance reporting capabilities

## Error Handling

### **Common Error Codes**
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `INVALID_EMAIL`: Email format validation failed
- `RATE_LIMIT_EXCEEDED`: Rate limit threshold reached
- `ALREADY_MEMBER`: User is already a team member
- `INVITATION_EXISTS`: Active invitation already exists
- `INVALID_TOKEN`: Token is invalid or expired
- `EMAIL_MISMATCH`: Email doesn't match invitation

### **Graceful Degradation**
- Partial success handling in bulk operations
- Detailed error reporting with specific failure reasons
- Automatic retry mechanisms for transient failures
- Comprehensive logging for debugging

## Best Practices

### **Invitation Management**
1. ✅ Use custom messages for better user experience
2. ✅ Set appropriate expiration periods based on urgency
3. ✅ Monitor rate limits to avoid hitting thresholds
4. ✅ Regularly clean up expired invitations
5. ✅ Use bulk operations for efficiency

### **Security Considerations**
1. ✅ Validate email addresses before sending invitations
2. ✅ Use appropriate roles and permissions
3. ✅ Monitor invitation patterns for abuse
4. ✅ Implement proper access controls
5. ✅ Audit invitation activities regularly

### **Performance Optimization**
1. ✅ Use bulk operations for multiple invitations
2. ✅ Implement proper indexing for invitation queries
3. ✅ Monitor rate limiting effectiveness
4. ✅ Cache frequently accessed invitation data
5. ✅ Optimize email delivery processes

## Migration and Deployment

### **Backward Compatibility**
- Legacy `invite_team_member()` function maintained
- Legacy `accept_team_invitation()` function maintained
- Existing code continues to work without changes
- Enhanced features available through new functions

### **Deployment Checklist**
1. ✅ Apply database migration
2. ✅ Update application code to use enhanced functions
3. ✅ Configure rate limiting parameters
4. ✅ Test invitation workflows
5. ✅ Monitor audit logs and performance metrics

This enhanced invitation system provides enterprise-grade team member onboarding with comprehensive security, audit trails, and user experience improvements.
