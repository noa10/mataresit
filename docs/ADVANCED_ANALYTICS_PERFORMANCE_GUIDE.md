# Advanced Analytics Performance Optimization Guide

## Overview

This guide provides comprehensive performance optimization strategies for the Advanced Analytics system in the Mataresit application.

## Database Performance

### Materialized View Optimization

```sql
-- Refresh materialized views efficiently
SELECT public.refresh_advanced_analytics_views();

-- Check view freshness
SELECT 
  schemaname,
  matviewname,
  last_refresh
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
AND relname LIKE 'mv_%analytics%';
```

### Index Optimization

```sql
-- Key indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_user_created 
ON receipts(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_active 
ON team_members(team_id, user_id) 
WHERE removal_scheduled_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_summary_performance 
ON mv_advanced_analytics_summary(team_id, performance_category, engagement_score DESC);
```

### Query Performance Best Practices

1. **Use Materialized Views**: Always query from materialized views for aggregated data
2. **Limit Result Sets**: Use LIMIT and pagination for large datasets
3. **Filter Early**: Apply WHERE clauses on indexed columns
4. **Avoid N+1 Queries**: Batch related queries together

## Frontend Performance

### Component Optimization

```typescript
// Use React.memo for expensive components
export const AdvancedAnalyticsDashboard = React.memo(({ 
  teamId, 
  userRole, 
  selectedMemberId 
}: AdvancedAnalyticsDashboardProps) => {
  // Component implementation
});

// Optimize chart rendering with useMemo
const chartData = useMemo(() => {
  return generateChartData(analyticsData);
}, [analyticsData]);
```

### Caching Strategy

```typescript
import { analyticsCache, QueryOptimizer } from '@/utils/analyticsPerformance';

// Cache analytics data with TTL
const getCachedAnalytics = async (teamId: string) => {
  return QueryOptimizer.optimizedQuery(
    'get_team_analytics',
    () => advancedAnalyticsService.getTeamAdvancedAnalytics(teamId),
    `team_analytics_${teamId}`,
    5 * 60 * 1000 // 5 minutes TTL
  );
};
```

### Real-time Optimization

```typescript
// Debounce real-time updates
const debouncedUpdate = ComponentPerformanceUtils.debounce(
  (payload) => {
    loadAnalyticsData();
  },
  1000 // 1 second debounce
);

// Throttle frequent operations
const throttledRefresh = ComponentPerformanceUtils.throttle(
  () => refreshAnalyticsViews(),
  30000 // 30 seconds throttle
);
```

## Chart Performance

### Recharts Optimization

```typescript
// Optimize large datasets
const optimizedData = useMemo(() => {
  if (rawData.length > 1000) {
    // Sample data for better performance
    return rawData.filter((_, index) => index % 10 === 0);
  }
  return rawData;
}, [rawData]);

// Use ResponsiveContainer efficiently
<ResponsiveContainer width="100%" height={400} debounce={100}>
  <LineChart data={optimizedData}>
    {/* Chart components */}
  </LineChart>
</ResponsiveContainer>
```

### Lazy Loading Charts

```typescript
// Lazy load chart components
const PredictiveAnalyticsChart = lazy(() => 
  import('./PredictiveAnalyticsChart').then(module => ({
    default: module.PredictiveAnalyticsChart
  }))
);

// Use with Suspense
<Suspense fallback={<ChartSkeleton />}>
  <PredictiveAnalyticsChart data={predictiveData} />
</Suspense>
```

## Memory Management

### Subscription Cleanup

```typescript
useEffect(() => {
  if (!realTimeEnabled) return;

  const unsubscribe = advancedAnalyticsService.subscribeToAnalyticsUpdates(
    teamId,
    handleUpdate
  );

  // Always cleanup subscriptions
  return () => {
    unsubscribe();
  };
}, [teamId, realTimeEnabled]);
```

### Cache Management

```typescript
// Automatic cache cleanup
useEffect(() => {
  const cleanup = setInterval(() => {
    analyticsCache.cleanup();
  }, 10 * 60 * 1000); // 10 minutes

  return () => clearInterval(cleanup);
}, []);
```

## Performance Monitoring

### Track Performance Metrics

```typescript
import { usePerformanceMonitoring } from '@/utils/analyticsPerformance';

const { trackOperation, getPerformanceStats } = usePerformanceMonitoring();

const loadData = async () => {
  const timer = trackOperation('load_analytics_data');
  
  try {
    const result = await advancedAnalyticsService.getTeamAdvancedAnalytics(teamId);
    timer(true); // Success
    return result;
  } catch (error) {
    timer(false); // Failure
    throw error;
  }
};
```

### Monitor Database Performance

```typescript
// Check database health
const checkDatabaseHealth = async () => {
  const stats = await DatabasePerformanceUtils.getDatabaseStats();
  
  if (stats.avgQueryTime > 1000) {
    console.warn('Database queries are slow:', stats);
  }
  
  if (stats.cacheHitRatio < 0.8) {
    console.warn('Low cache hit ratio:', stats.cacheHitRatio);
  }
};
```

## Optimization Checklist

### Database Level
- [ ] Materialized views are refreshed regularly
- [ ] Proper indexes are in place
- [ ] Query performance is monitored
- [ ] Connection pooling is configured

### Application Level
- [ ] Caching is implemented for expensive operations
- [ ] Real-time updates are debounced/throttled
- [ ] Components are memoized appropriately
- [ ] Subscriptions are cleaned up properly

### Chart Level
- [ ] Large datasets are sampled or paginated
- [ ] Charts are lazy-loaded when appropriate
- [ ] ResponsiveContainer debounce is set
- [ ] Unnecessary re-renders are prevented

### Monitoring
- [ ] Performance metrics are tracked
- [ ] Slow operations are identified
- [ ] Memory usage is monitored
- [ ] Error rates are tracked

## Performance Targets

### Response Times
- **Analytics Dashboard Load**: < 2 seconds
- **Chart Rendering**: < 500ms
- **Real-time Updates**: < 100ms
- **Data Export**: < 5 seconds

### Resource Usage
- **Memory Usage**: < 100MB for dashboard
- **Database Connections**: < 10 concurrent
- **Cache Hit Ratio**: > 80%
- **Query Time**: < 500ms average

## Troubleshooting

### Slow Dashboard Loading
1. Check materialized view freshness
2. Verify database indexes
3. Monitor network requests
4. Check for memory leaks

### High Memory Usage
1. Verify subscription cleanup
2. Check cache size limits
3. Monitor component re-renders
4. Profile memory usage

### Poor Chart Performance
1. Reduce data points
2. Implement data sampling
3. Use chart virtualization
4. Optimize re-render cycles

## Best Practices Summary

1. **Cache Aggressively**: Use caching for expensive operations
2. **Monitor Performance**: Track metrics and identify bottlenecks
3. **Optimize Queries**: Use materialized views and proper indexing
4. **Manage Memory**: Clean up subscriptions and limit cache size
5. **Lazy Load**: Load components and data only when needed
6. **Debounce Updates**: Prevent excessive real-time updates
7. **Sample Data**: Reduce large datasets for visualization
8. **Profile Regularly**: Use performance tools to identify issues

## Tools and Resources

- **React DevTools Profiler**: Identify component performance issues
- **Chrome DevTools**: Monitor memory usage and network requests
- **Supabase Dashboard**: Monitor database performance
- **Custom Performance Monitor**: Track application-specific metrics

## Conclusion

Following these optimization strategies will ensure the Advanced Analytics system performs efficiently even with large datasets and high user activity. Regular monitoring and profiling are essential for maintaining optimal performance.
