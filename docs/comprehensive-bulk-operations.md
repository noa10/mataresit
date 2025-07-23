# Comprehensive Bulk Operations System

## Overview

The Comprehensive Bulk Operations System provides enterprise-grade bulk management capabilities for team operations in Mataresit. This system enables efficient processing of multiple team management actions with comprehensive transaction handling, progress tracking, error recovery, and audit trails.

## Key Features

### 🚀 **Complete Bulk Operation Coverage**
- Bulk invitations with role assignment and custom messages
- Bulk member removal with data transfer options
- Bulk role updates with permission validation
- Bulk permission updates with merge/replace modes
- Comprehensive transaction safety and rollback protection

### 📊 **Advanced Progress Tracking**
- Real-time progress monitoring with percentage completion
- Detailed success/failure tracking for each item
- Comprehensive error reporting and categorization
- Operation duration and performance metrics

### 🔄 **Error Recovery & Retry**
- Automatic retry capabilities for failed operations
- Selective retry of failed items only
- Comprehensive error analysis and reporting
- Operation cancellation and cleanup

### 🔍 **Monitoring & Analytics**
- Detailed operation statistics and trends
- Performance analytics and success rates
- Historical operation tracking
- Team-specific operation insights

## Core Functions

### 1. Bulk Role Updates

#### `bulk_update_member_roles()`
**Purpose**: Update roles for multiple team members in a single operation

**Parameters**:
- `p_team_id`: Team UUID
- `p_role_updates`: JSONB array of role update objects
- `p_reason`: Optional reason for the updates

**Role Update Object Structure**:
```json
{
  "user_id": "user-uuid",
  "new_role": "admin",
  "reason": "Promotion due to excellent performance"
}
```

**Example Usage**:
```sql
SELECT bulk_update_member_roles(
  'team-uuid',
  '[
    {
      "user_id": "user1-uuid",
      "new_role": "admin",
      "reason": "Promoted to team lead"
    },
    {
      "user_id": "user2-uuid", 
      "new_role": "member",
      "reason": "Role adjustment"
    }
  ]'::jsonb,
  'Quarterly role review updates'
);
```

**Features**:
- ✅ Permission validation (only owners can assign admin roles)
- ✅ Prevents owner role assignment through bulk operations
- ✅ Skips updates where role is already correct
- ✅ Comprehensive audit logging for each change
- ✅ Transaction safety with rollback on errors

### 2. Bulk Permission Updates

#### `bulk_update_member_permissions()`
**Purpose**: Update permissions for multiple team members

**Parameters**:
- `p_team_id`: Team UUID
- `p_permission_updates`: JSONB array of permission update objects
- `p_reason`: Optional reason for the updates

**Permission Update Object Structure**:
```json
{
  "user_id": "user-uuid",
  "permissions": {
    "can_manage_billing": true,
    "can_export_data": false,
    "project_access": ["project-1", "project-2"]
  },
  "merge_mode": "merge"
}
```

**Merge Modes**:
- **`merge`**: Merge new permissions with existing ones
- **`replace`**: Replace all permissions entirely

**Example Usage**:
```sql
SELECT bulk_update_member_permissions(
  'team-uuid',
  '[
    {
      "user_id": "user1-uuid",
      "permissions": {"can_manage_billing": true},
      "merge_mode": "merge"
    },
    {
      "user_id": "user2-uuid",
      "permissions": {"project_access": ["project-3"]},
      "merge_mode": "replace"
    }
  ]'::jsonb,
  'Updated project access permissions'
);
```

### 3. Bulk Operation Management

#### `get_bulk_operations()`
**Purpose**: Retrieve bulk operations with comprehensive filtering

**Parameters**:
- `p_team_id`: Team UUID
- `p_operation_types`: Filter by operation types (optional)
- `p_statuses`: Filter by operation statuses (optional)
- `p_performed_by`: Filter by performer (optional)
- `p_start_date`/`p_end_date`: Date range filter (optional)
- `p_limit`/`p_offset`: Pagination parameters

**Example Usage**:
```sql
-- Get recent bulk operations
SELECT * FROM get_bulk_operations(
  'team-uuid',
  ARRAY['bulk_role_update', 'bulk_permission_update'],
  ARRAY['completed', 'failed'],
  NULL,
  NOW() - INTERVAL '7 days',
  NOW(),
  20,
  0
);
```

**Returns**:
- Operation details with performer information
- Progress tracking (percentage completion)
- Duration and performance metrics
- Detailed results and error summaries

#### `get_bulk_operation_stats()`
**Purpose**: Generate comprehensive bulk operation analytics

**Parameters**:
- `p_team_id`: Team UUID
- `p_start_date`: Analysis start date (default: 30 days ago)
- `p_end_date`: Analysis end date (default: now)

**Returns**: JSONB with detailed statistics:
```json
{
  "period": {
    "start_date": "2024-06-22T00:00:00Z",
    "end_date": "2024-07-22T00:00:00Z",
    "days": 30
  },
  "summary": {
    "total_operations": 45,
    "total_items_processed": 1250,
    "total_successful_items": 1180,
    "total_failed_items": 70,
    "overall_success_rate": 94.4,
    "avg_operation_duration": 12.5
  },
  "by_operation_type": {
    "bulk_invite": {
      "total_operations": 20,
      "total_items": 600,
      "success_rate": 96.2,
      "avg_duration": 8.3
    },
    "bulk_role_update": {
      "total_operations": 15,
      "total_items": 400,
      "success_rate": 92.5,
      "avg_duration": 15.7
    }
  },
  "by_status": {
    "completed": {"count": 40, "percentage": 88.9},
    "failed": {"count": 3, "percentage": 6.7},
    "cancelled": {"count": 2, "percentage": 4.4}
  }
}
```

### 4. Error Recovery & Retry

#### `cancel_bulk_operation()`
**Purpose**: Cancel pending or in-progress bulk operations

**Parameters**:
- `p_operation_id`: Operation UUID to cancel
- `p_reason`: Optional cancellation reason

**Example Usage**:
```sql
SELECT cancel_bulk_operation(
  'operation-uuid',
  'Operation taking too long, will retry later'
);
```

#### `retry_bulk_operation_failures()`
**Purpose**: Retry only the failed items from a completed operation

**Parameters**:
- `p_operation_id`: Original operation UUID
- `p_retry_reason`: Optional retry reason

**Features**:
- ✅ Extracts only failed items from original operation
- ✅ Creates new operation with same parameters
- ✅ Links retry to original operation for tracking
- ✅ Supports all bulk operation types

**Example Usage**:
```sql
SELECT retry_bulk_operation_failures(
  'original-operation-uuid',
  'Retrying failed invitations after email service issue resolved'
);
```

### 5. Maintenance & Cleanup

#### `cleanup_old_bulk_operations()`
**Purpose**: Clean up old bulk operation records

**Parameters**:
- `p_retention_days`: Days to retain (default: 90)
- `p_team_id`: Specific team cleanup (optional)

**Features**:
- Only removes completed, failed, or cancelled operations
- Preserves in-progress operations
- Team-specific or system-wide cleanup
- Comprehensive reporting of cleanup results

## Operation Status Lifecycle

### **Status Flow**
```
pending → in_progress → completed
                    ↘ failed
                    ↘ cancelled
```

### **Status Descriptions**
- **`pending`**: Operation created but not yet started
- **`in_progress`**: Operation currently being processed
- **`completed`**: Operation finished successfully (may have some failures)
- **`failed`**: Operation failed completely due to system error
- **`cancelled`**: Operation cancelled by user or system

## Transaction Safety & Error Handling

### **Transaction Management**
- Each bulk operation runs in a single database transaction
- Individual item failures don't rollback the entire operation
- Comprehensive error capture and reporting
- Graceful degradation with partial success handling

### **Error Categories**
- **`INSUFFICIENT_PERMISSIONS`**: User lacks required permissions
- **`INVALID_INPUT`**: Malformed input data or parameters
- **`NOT_MEMBER`**: Target user is not a team member
- **`INVALID_ROLE`**: Invalid role assignment attempt
- **`UPDATE_FAILED`**: Individual item update failure
- **`BULK_UPDATE_FAILED`**: Complete operation failure

### **Recovery Strategies**
1. **Automatic Retry**: System can automatically retry transient failures
2. **Manual Retry**: Users can retry failed items from completed operations
3. **Partial Success**: Operations continue processing despite individual failures
4. **Rollback Protection**: Database constraints prevent invalid state changes

## Performance Optimizations

### **Batch Processing**
- Efficient batch updates using single transactions
- Optimized queries for bulk data retrieval
- Minimal database round trips
- Progress tracking without performance impact

### **Resource Management**
- Configurable batch sizes for large operations
- Memory-efficient processing of large datasets
- Connection pooling for concurrent operations
- Rate limiting integration for external services

## Security & Permissions

### **Permission Matrix**

| Operation | Owner | Admin | Member | Viewer |
|-----------|-------|-------|--------|--------|
| Bulk Role Updates | ✅ | ✅* | ❌ | ❌ |
| Bulk Permission Updates | ✅ | ✅ | ❌ | ❌ |
| Bulk Invitations | ✅ | ✅ | ❌ | ❌ |
| Bulk Removals | ✅ | ✅ | ❌ | ❌ |
| View Operations | ✅ | ✅ | ❌ | ❌ |
| Cancel Operations | ✅ | ✅ | Own Only | ❌ |
| Retry Operations | ✅ | ✅ | ❌ | ❌ |

*Admins cannot assign admin roles (owner-only)

### **Audit Integration**
- Complete audit trails for all bulk operations
- Individual item change logging
- Operation lifecycle tracking
- Performance and error metrics

## Integration Examples

### **Frontend Integration**
```typescript
// Bulk role update with progress tracking
const result = await teamService.bulkUpdateRoles(teamId, [
  { userId: 'user1', newRole: 'admin', reason: 'Promotion' },
  { userId: 'user2', newRole: 'member', reason: 'Role adjustment' }
], 'Quarterly review updates');

// Monitor operation progress
const operation = await teamService.getBulkOperation(result.bulk_operation_id);
console.log(`Progress: ${operation.progress_percentage}%`);
```

### **Error Handling**
```typescript
// Handle bulk operation results
if (result.failed_updates > 0) {
  // Show failed items to user
  const failedItems = result.results.filter(r => !r.result.success);
  
  // Offer retry option
  const retryResult = await teamService.retryBulkOperationFailures(
    result.bulk_operation_id,
    'Retrying failed updates'
  );
}
```

## Best Practices

### **Operation Design**
1. ✅ Use appropriate batch sizes (50-100 items recommended)
2. ✅ Provide meaningful reasons for bulk changes
3. ✅ Validate permissions before starting operations
4. ✅ Monitor operation progress and handle failures
5. ✅ Use retry functionality for transient failures

### **Error Management**
1. ✅ Always check operation results for failures
2. ✅ Provide user feedback for failed items
3. ✅ Implement retry logic for recoverable errors
4. ✅ Log detailed error information for debugging
5. ✅ Handle partial success scenarios gracefully

### **Performance**
1. ✅ Use bulk operations instead of individual API calls
2. ✅ Monitor operation duration and optimize as needed
3. ✅ Implement proper pagination for large result sets
4. ✅ Clean up old operations regularly
5. ✅ Use appropriate indexes for bulk operation queries

This comprehensive bulk operations system provides enterprise-grade capabilities for efficient team management with complete transaction safety, error recovery, and comprehensive monitoring.
