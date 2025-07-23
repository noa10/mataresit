# Comprehensive Team Management Audit System

## Overview

The Comprehensive Team Management Audit System provides enterprise-grade audit trails, analytics, and compliance capabilities for all team management activities in Mataresit. This system ensures complete visibility, accountability, and regulatory compliance for team operations.

## Key Features

### 🔍 **Complete Audit Coverage**
- Automatic logging of all team management actions
- Enhanced context capture (IP addresses, user agents, session IDs)
- Before/after value tracking for all changes
- Comprehensive metadata support for extensibility

### 📊 **Advanced Analytics & Reporting**
- Real-time audit analytics with statistical insights
- Advanced search capabilities with relevance scoring
- User-specific audit trails and activity patterns
- Customizable reporting periods and filters

### 🗄️ **Retention & Archival**
- Configurable retention policies (default: 3 years)
- Automatic archival to separate tables (default: 1 year)
- Compliance-ready export functionality
- Efficient cleanup and maintenance operations

### 🔒 **Security & Compliance**
- Role-based access to audit data (admin/owner only)
- Compliance export for regulatory requirements
- Tamper-evident audit trails with cryptographic integrity
- Comprehensive permission validation

## Core Functions

### 1. Enhanced Audit Logging

#### `log_team_audit_event_enhanced()`
**Purpose**: Enhanced audit logging with comprehensive context capture

**Parameters**:
- `p_team_id`: Team UUID
- `p_action`: Action type (enum)
- `p_action_description`: Human-readable description
- `p_target_user_id`: Target user (optional)
- `p_old_values`/`p_new_values`: Change tracking (JSONB)
- `p_metadata`: Additional context (JSONB)
- `p_ip_address`: Client IP address (optional)
- `p_user_agent`: Client user agent (optional)
- `p_session_id`: Session identifier (optional)

**Example Usage**:
```sql
SELECT log_team_audit_event_enhanced(
  'team-uuid',
  'member_role_changed'::team_audit_action,
  'Member promoted from viewer to admin',
  'user-uuid',
  '{"role": "viewer"}'::jsonb,
  '{"role": "admin"}'::jsonb,
  '{"promotion_reason": "excellent performance"}'::jsonb,
  '192.168.1.100'::inet,
  'Mozilla/5.0...',
  'session-123'
);
```

#### `log_bulk_audit_events()`
**Purpose**: Batch audit logging for bulk operations

**Parameters**:
- `p_events`: JSONB array of audit event objects

**Example Usage**:
```sql
SELECT log_bulk_audit_events('[
  {
    "team_id": "team-uuid",
    "action": "member_added",
    "action_description": "Bulk invitation accepted",
    "target_user_id": "user1-uuid",
    "new_values": {"role": "member"}
  },
  {
    "team_id": "team-uuid", 
    "action": "member_added",
    "action_description": "Bulk invitation accepted",
    "target_user_id": "user2-uuid",
    "new_values": {"role": "viewer"}
  }
]'::jsonb);
```

### 2. Audit Reporting & Analytics

#### `get_team_audit_logs()`
**Purpose**: Retrieve audit logs with comprehensive filtering

**Parameters**:
- `p_team_id`: Team UUID
- `p_actions`: Array of action types to filter (optional)
- `p_user_id`: Filter by actor user ID (optional)
- `p_target_user_id`: Filter by target user ID (optional)
- `p_start_date`/`p_end_date`: Date range filter (optional)
- `p_limit`/`p_offset`: Pagination parameters

**Example Usage**:
```sql
-- Get recent member-related actions
SELECT * FROM get_team_audit_logs(
  'team-uuid',
  ARRAY['member_added', 'member_removed', 'member_role_changed']::team_audit_action[],
  NULL,
  NULL,
  NOW() - INTERVAL '30 days',
  NOW(),
  50,
  0
);
```

#### `get_audit_analytics()`
**Purpose**: Generate comprehensive audit analytics

**Parameters**:
- `p_team_id`: Team UUID
- `p_start_date`: Analysis start date (default: 30 days ago)
- `p_end_date`: Analysis end date (default: now)

**Returns**: JSONB with detailed analytics including:
- Total events and unique actors
- Actions breakdown by type
- Top actors by activity
- Hourly and daily activity patterns
- Summary statistics

**Example Usage**:
```sql
-- Get last 90 days analytics
SELECT get_audit_analytics(
  'team-uuid',
  NOW() - INTERVAL '90 days',
  NOW()
);
```

### 3. Advanced Search & Investigation

#### `search_audit_logs()`
**Purpose**: Advanced search with relevance scoring

**Parameters**:
- `p_team_id`: Team UUID
- `p_search_params`: JSONB search parameters

**Search Parameters**:
```json
{
  "text_search": "promotion",
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-12-31T23:59:59Z",
  "actions": ["member_role_changed", "member_permissions_updated"],
  "user_id": "user-uuid",
  "limit": 100
}
```

#### `get_user_audit_trail()`
**Purpose**: Complete audit trail for a specific user

**Parameters**:
- `p_team_id`: Team UUID
- `p_user_id`: User UUID
- `p_limit`: Maximum records to return

**Returns**: Complete activity history showing both actions performed by the user and actions performed on the user.

### 4. Retention & Maintenance

#### `archive_old_audit_logs()`
**Purpose**: Archive old audit logs to separate tables

**Parameters**:
- `p_retention_days`: Days to keep in main table (default: 365)
- `p_archive_table_suffix`: Custom archive table suffix (optional)

**Features**:
- Creates monthly archive tables automatically
- Processes teams separately for performance
- Maintains referential integrity
- Logs archival operations

#### `cleanup_audit_logs()`
**Purpose**: Hard delete old audit logs

**Parameters**:
- `p_retention_days`: Days to retain (default: 1095 = 3 years)
- `p_team_id`: Specific team cleanup (optional)

**Use Cases**:
- Regulatory compliance cleanup
- Storage optimization
- GDPR "right to be forgotten" requests

### 5. Compliance & Export

#### `export_audit_logs_for_compliance()`
**Purpose**: Export audit logs in compliance-ready format

**Parameters**:
- `p_team_id`: Team UUID
- `p_start_date`/`p_end_date`: Export date range
- `p_format`: Export format (default: 'json')

**Features**:
- Only team owners can export
- Includes complete metadata and context
- Structured for regulatory compliance
- Logs export activities

**Export Format**:
```json
{
  "export_metadata": {
    "team_id": "team-uuid",
    "export_date": "2024-07-22T10:30:00Z",
    "exported_by": "user-uuid",
    "period_start": "2024-01-01T00:00:00Z",
    "period_end": "2024-12-31T23:59:59Z",
    "record_count": 1250
  },
  "audit_records": [
    {
      "id": "audit-uuid",
      "action": "member_added",
      "description": "New team member joined",
      "actor": {
        "id": "user-uuid",
        "email": "admin@example.com",
        "name": "Admin User"
      },
      "target": {
        "id": "target-uuid",
        "email": "member@example.com", 
        "name": "New Member"
      },
      "changes": {
        "old_values": {},
        "new_values": {"role": "member"}
      },
      "context": {
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "session_id": "session-123",
        "metadata": {"invitation_id": "inv-uuid"}
      },
      "timestamp": "2024-07-22T10:15:00Z"
    }
  ]
}
```

## Automatic Audit Triggers

### Team Member Changes
Automatically logs:
- ✅ Member additions with role and permissions
- ✅ Role changes with before/after values
- ✅ Permission updates with detailed changes
- ✅ Member removals with context

### Team Changes
Automatically logs:
- ✅ Team creation with initial settings
- ✅ Name and description changes
- ✅ Settings modifications
- ✅ Ownership transfers
- ✅ Team deletion

## Audit System Configuration

### `audit_system_config` Table
Team-specific audit configuration:

```sql
-- Get or create audit configuration
SELECT * FROM get_audit_config('team-uuid');
```

**Configuration Options**:
- **Retention Settings**: `retention_days`, `archive_after_days`
- **Logging Settings**: `log_ip_addresses`, `log_user_agents`, `log_session_ids`
- **Export Settings**: `allow_compliance_export`, `export_format`
- **Notifications**: `notify_on_sensitive_actions`, `sensitive_actions`

## Security & Permissions

### **Access Control Matrix**

| Function | Owner | Admin | Member | Viewer |
|----------|-------|-------|--------|--------|
| View Audit Logs | ✅ | ✅ | ❌ | ❌ |
| Search Audit Logs | ✅ | ✅ | ❌ | ❌ |
| Audit Analytics | ✅ | ✅ | ❌ | ❌ |
| Export for Compliance | ✅ | ❌ | ❌ | ❌ |
| Configure Audit Settings | ✅ | ❌ | ❌ | ❌ |
| Archive/Cleanup | System | System | System | System |

### **Data Protection**
- Row Level Security (RLS) on all audit tables
- Encrypted storage of sensitive audit data
- IP address and user agent logging (configurable)
- Session tracking for security investigations

## Performance Optimizations

### **Indexing Strategy**
- **Primary Indexes**: `team_id`, `created_at`, `action`, `performed_by`
- **Composite Indexes**: Common query patterns optimized
- **GIN Indexes**: Full-text search on descriptions and metadata
- **Partial Indexes**: Frequently filtered data

### **Query Optimization**
- Efficient pagination with cursor-based navigation
- Optimized analytics queries with materialized views
- Batch processing for bulk operations
- Connection pooling for high-volume logging

## Integration Points

### **Application Integration**
```typescript
// Enhanced audit logging in application code
await auditService.logEvent({
  teamId: 'team-uuid',
  action: 'member_role_changed',
  description: 'Member promoted to admin',
  targetUserId: 'user-uuid',
  oldValues: { role: 'member' },
  newValues: { role: 'admin' },
  metadata: { promotionReason: 'excellent performance' },
  context: {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    sessionId: req.sessionID
  }
});
```

### **Monitoring Integration**
- Real-time audit event streaming
- Anomaly detection for suspicious activities
- Alert generation for sensitive actions
- Dashboard integration for audit metrics

## Best Practices

### **Audit Logging**
1. ✅ Always include meaningful descriptions
2. ✅ Capture relevant before/after values
3. ✅ Include sufficient context in metadata
4. ✅ Use appropriate action types
5. ✅ Log both successful and failed operations

### **Data Retention**
1. ✅ Configure appropriate retention periods
2. ✅ Regular archival of old data
3. ✅ Monitor storage usage and performance
4. ✅ Implement compliance-driven cleanup
5. ✅ Test restore procedures regularly

### **Security**
1. ✅ Restrict audit access to authorized users
2. ✅ Monitor audit system usage
3. ✅ Protect audit data integrity
4. ✅ Regular security reviews
5. ✅ Incident response procedures

This comprehensive audit system provides enterprise-grade visibility, accountability, and compliance capabilities for all team management operations in Mataresit.
