# Feature Flag Management System

A comprehensive feature flag management system for Phase 5 production deployment with percentage-based rollout controls, admin interface, and automated rollout management.

## 🚀 Features

- **Percentage-based Rollout**: Gradual rollout with configurable percentages (0-100%)
- **Targeted Rollout**: Specific teams and users can be targeted
- **Conditional Evaluation**: Complex conditions based on user/team attributes
- **Phase 5 Integration**: Built-in support for Phase 5 deployment features
- **Admin Dashboard**: Comprehensive web interface for flag management
- **Analytics & Monitoring**: Usage statistics and audit logging
- **API Endpoints**: RESTful API for programmatic management
- **React Hooks**: Easy integration with React components
- **Environment Support**: Development, staging, and production configurations

## 📁 System Architecture

```
src/lib/feature-flags/
├── types.ts                    # TypeScript type definitions
├── manager.ts                  # Core feature flag service
├── phase5-flags.ts            # Phase 5 specific configurations
├── config.ts                  # Environment configuration
├── database-schema.sql        # Database schema and functions
└── README.md                  # This documentation

src/components/admin/
└── FeatureFlagDashboard.tsx   # Admin interface component

src/hooks/
└── useFeatureFlags.ts         # React hooks for feature flags

src/pages/api/admin/feature-flags/
├── index.ts                   # List/create flags API
├── [id].ts                    # Individual flag CRUD API
├── evaluate.ts                # Flag evaluation API
└── rollout.ts                 # Rollout management API
```

## 🔧 Installation & Setup

### 1. Database Setup

Run the database schema to create required tables:

```sql
-- Execute the schema file
\i src/lib/feature-flags/database-schema.sql
```

### 2. Environment Configuration

Add to your `.env` file:

```bash
# Feature Flag Configuration
FEATURE_FLAG_CACHE_ENABLED=true
FEATURE_FLAG_CACHE_TTL=300000
FEATURE_FLAG_ANALYTICS_ENABLED=true
FEATURE_FLAG_AUDIT_LOG_ENABLED=true
FEATURE_FLAG_MAX_ROLLOUT=100
FEATURE_FLAG_REQUIRE_APPROVAL=true
FEATURE_FLAG_AUTO_REFRESH_INTERVAL=300000

# Legacy support (will be migrated automatically)
ENABLE_EMBEDDING_MONITORING=true
EMBEDDING_MONITORING_ROLLOUT_PERCENTAGE=10
ENABLE_QUEUE_PROCESSING=false
QUEUE_PROCESSING_ROLLOUT_PERCENTAGE=0
ENABLE_BATCH_OPTIMIZATION=false
BATCH_OPTIMIZATION_ROLLOUT_PERCENTAGE=0
```

### 3. Initialize Feature Flags

```typescript
import { initializeFeatureFlags } from '@/lib/feature-flags/config';

// Initialize on application startup
await initializeFeatureFlags({
  userId: 'system',
  environment: 'production'
});
```

## 🎯 Usage Examples

### React Component Integration

```typescript
import { usePhase5Flags, useFeatureFlag } from '@/hooks/useFeatureFlags';

function MyComponent() {
  // Use Phase 5 specific flags
  const { embeddingMonitoring, queueBasedProcessing, batchOptimization } = usePhase5Flags({
    userId: user.id,
    teamId: team.id
  });

  // Use individual flag
  const { isEnabled: newUIEnabled } = useFeatureFlag('newUI', {
    userId: user.id,
    customAttributes: { betaTester: true }
  });

  return (
    <div>
      {embeddingMonitoring.isEnabled && <MonitoringDashboard />}
      {queueBasedProcessing.isEnabled && <QueueStatus />}
      {batchOptimization.isEnabled && <BatchUploader />}
      {newUIEnabled && <NewUserInterface />}
    </div>
  );
}
```

### Conditional Rendering with Guards

```typescript
import { useFeatureFlagGuard } from '@/hooks/useFeatureFlags';

function FeatureComponent() {
  const { FeatureGuard } = useFeatureFlagGuard('experimentalFeature', {
    userId: user.id,
    teamId: team.id
  });

  return (
    <FeatureGuard 
      fallback={<div>Feature not available</div>}
      showLoading={true}
    >
      <ExperimentalFeature />
    </FeatureGuard>
  );
}
```

### Programmatic Evaluation

```typescript
import { evaluateFeatureFlag, evaluateAllPhase5Flags } from '@/lib/feature-flags/config';

// Evaluate single flag
const isEnabled = await evaluateFeatureFlag('embeddingMonitoring', userId, teamId);

// Evaluate all Phase 5 flags
const phase5Status = await evaluateAllPhase5Flags(userId, teamId);
console.log(phase5Status); // { embeddingMonitoring: true, queueBasedProcessing: false, ... }
```

### Admin Management

```typescript
import { useFeatureFlagManagement } from '@/hooks/useFeatureFlags';

function AdminPanel() {
  const { 
    flags, 
    loading, 
    createFlag, 
    updateRollout, 
    toggleFlag 
  } = useFeatureFlagManagement();

  const handleCreateFlag = async () => {
    await createFlag({
      name: 'newFeature',
      description: 'A new experimental feature',
      enabled: false,
      rolloutPercentage: 0,
      metadata: {
        category: 'ui',
        priority: 'low'
      }
    });
  };

  const handleUpdateRollout = async (flagId: string, percentage: number) => {
    await updateRollout(flagId, percentage);
  };

  return (
    <div>
      {flags.map(flag => (
        <div key={flag.id}>
          <h3>{flag.name}</h3>
          <button onClick={() => toggleFlag(flag.id, !flag.enabled)}>
            {flag.enabled ? 'Disable' : 'Enable'}
          </button>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={flag.rolloutPercentage}
            onChange={(e) => handleUpdateRollout(flag.id, parseInt(e.target.value))}
          />
        </div>
      ))}
    </div>
  );
}
```

## 🌐 API Endpoints

### List Feature Flags
```bash
GET /api/admin/feature-flags
GET /api/admin/feature-flags?enabled=true&category=monitoring
```

### Create Feature Flag
```bash
POST /api/admin/feature-flags
Content-Type: application/json

{
  "name": "newFeature",
  "description": "A new feature",
  "enabled": false,
  "rolloutPercentage": 0,
  "metadata": {
    "category": "ui",
    "priority": "medium"
  }
}
```

### Update Feature Flag
```bash
PUT /api/admin/feature-flags/[id]
Content-Type: application/json

{
  "enabled": true,
  "rolloutPercentage": 25
}
```

### Evaluate Feature Flags
```bash
POST /api/admin/feature-flags/evaluate
Content-Type: application/json

{
  "flagName": "embeddingMonitoring",
  "userId": "user-123",
  "teamId": "team-456"
}
```

### Rollout Management
```bash
POST /api/admin/feature-flags/rollout
Content-Type: application/json

{
  "action": "updatePercentage",
  "flagId": "flag-123",
  "percentage": 50
}
```

## 📊 Phase 5 Rollout Strategy

The system includes built-in Phase 5 rollout automation:

### Week 1-2: Embedding Monitoring
- Week 1: 10% rollout
- Week 2: 25% rollout
- Week 3: 50% rollout
- Week 4: 100% rollout

### Week 3-7: Queue Processing (depends on monitoring)
- Week 3: 5% rollout
- Week 4: 15% rollout
- Week 5: 35% rollout
- Week 6: 75% rollout
- Week 7: 100% rollout

### Week 5-9: Batch Optimization (depends on queue)
- Week 5: 5% rollout
- Week 6: 10% rollout
- Week 7: 25% rollout
- Week 8: 50% rollout
- Week 9: 100% rollout

### Automated Rollout Execution

```typescript
import { Phase5RolloutManager } from '@/lib/feature-flags/phase5-flags';

const rolloutManager = new Phase5RolloutManager(flagService);

// Execute weekly rollout
await rolloutManager.executeWeeklyRollout(3); // Week 3 rollout

// Emergency disable all
await rolloutManager.emergencyDisableAll();

// Get current status
const status = await rolloutManager.getPhase5Status();
```

## 🔒 Security & Permissions

- **Row Level Security (RLS)**: Database-level access control
- **API Authentication**: Secure API endpoints (implement as needed)
- **Audit Logging**: Complete audit trail of all changes
- **Environment Isolation**: Separate configurations per environment

## 📈 Analytics & Monitoring

### Usage Statistics
- Total evaluations
- Enabled/disabled counts
- Unique users/teams
- Success rates
- Performance metrics

### Audit Trail
- All flag changes logged
- User attribution
- Timestamp tracking
- Change details

### Performance Monitoring
- Evaluation latency
- Cache hit rates
- Error rates
- System health

## 🚨 Emergency Procedures

### Emergency Disable
```typescript
// Disable all Phase 5 features immediately
await rolloutManager.emergencyDisableAll();

// Or via API
POST /api/admin/feature-flags/rollout
{
  "action": "emergencyDisable"
}
```

### Rollback to Previous State
```typescript
// Rollback specific flag
await flagService.updateFlag(flagId, { 
  enabled: false, 
  rolloutPercentage: 0 
});
```

## 🔧 Configuration Options

### Feature Flag Metadata
- **category**: monitoring, processing, optimization, ui, api, security
- **priority**: low, medium, high, critical
- **rolloutStrategy**: percentage, targeted, conditional, kill_switch
- **dependencies**: Other flags this depends on
- **conflicts**: Conflicting flags
- **rollbackPlan**: Emergency rollback procedure
- **monitoringMetrics**: Metrics to track
- **estimatedImpact**: Expected system impact
- **testingStatus**: Testing completion status

### Evaluation Conditions
- **user_attribute**: Based on user properties
- **team_attribute**: Based on team properties
- **environment**: Environment-specific
- **time_window**: Time-based conditions
- **custom**: Custom logic conditions

## 🧪 Testing

### Unit Tests
```typescript
import { FeatureFlagService } from '@/lib/feature-flags/manager';

describe('FeatureFlagService', () => {
  it('should evaluate percentage rollout correctly', async () => {
    const service = new FeatureFlagService(url, key, 'test-user');
    // Test implementation
  });
});
```

### Integration Tests
```typescript
// Test API endpoints
const response = await fetch('/api/admin/feature-flags/evaluate', {
  method: 'POST',
  body: JSON.stringify({
    flagName: 'testFlag',
    userId: 'test-user'
  })
});
```

## 📚 Best Practices

1. **Start Small**: Begin with low rollout percentages
2. **Monitor Closely**: Watch metrics during rollout
3. **Have Rollback Plans**: Always prepare for quick rollback
4. **Test Thoroughly**: Validate in staging first
5. **Document Changes**: Use clear descriptions and audit logs
6. **Use Dependencies**: Ensure proper feature dependencies
7. **Regular Cleanup**: Remove unused flags periodically

## 🔗 Integration Points

- **Supabase**: Database and authentication
- **React**: Component integration via hooks
- **Next.js**: API routes and SSR support
- **TypeScript**: Full type safety
- **Phase 5 System**: Built-in Phase 5 deployment support

This feature flag system provides comprehensive control over feature rollouts with safety mechanisms, monitoring, and automation specifically designed for Phase 5 production deployment.
