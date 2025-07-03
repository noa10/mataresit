# Performance Testing & Validation

This document describes the comprehensive performance testing system implemented for the Mataresit usage statistics optimization.

## Overview

The performance testing suite validates that our optimizations meet the target of **loading usage statistics in under 3 seconds** while maintaining **100% data accuracy**.

## Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| **Loading Time** | < 3 seconds | Primary performance target |
| **Cache Hit Rate** | 90%+ | For repeated requests |
| **Data Accuracy** | 100% | Validation pass rate |
| **Consistency** | 100% | Between optimized and legacy queries |

## Test Suite Components

### 1. RPC Function Performance Test
- Tests the optimized `get_my_usage_stats_optimized` function
- Measures execution time and data completeness
- Validates response structure and required fields

### 2. React Query Cache Performance Test
- Tests caching mechanism efficiency
- Measures cache hit vs fresh fetch performance
- Validates cache invalidation behavior

### 3. Data Accuracy Validation
- Validates all required fields are present
- Checks data types and value ranges
- Ensures logical consistency (e.g., monthly receipts ≤ total receipts)

### 4. Data Consistency Test
- Cross-validates optimized vs legacy query results
- Ensures optimization doesn't introduce data discrepancies
- Allows for minor timing differences (±1 receipt)

### 5. Realistic Data Volume Test
- Tests performance with actual user data volumes
- Categorizes data volume (minimal, light, moderate, heavy, very heavy)
- Ensures performance scales with data size

## Running Tests

### Via UI (Recommended)
1. Navigate to `/performance-test` in the application
2. Click "Run Performance Tests"
3. Review detailed results and recommendations

### Programmatically
```typescript
import { PerformanceTestSuite } from '@/utils/performanceTestSuite';

const testSuite = new PerformanceTestSuite();
const results = await testSuite.runCompleteTestSuite();
```

### Via Script
```typescript
import { runPerformanceTests } from '@/scripts/runPerformanceTests';

const results = await runPerformanceTests();
```

## Test Results Interpretation

### Success Criteria
- ✅ All tests pass (no failures)
- ✅ Average duration < 3000ms
- ✅ Data validation passes
- ✅ Data consistency maintained

### Performance Categories
- **Excellent**: < 1000ms
- **Good**: 1000-2000ms  
- **Acceptable**: 2000-3000ms
- **Needs Optimization**: > 3000ms

### Common Issues & Solutions

#### Slow Performance (> 3000ms)
- Check database indexes are properly created
- Verify RPC function is using optimized queries
- Consider additional caching strategies

#### Cache Misses
- Verify React Query is properly configured
- Check cache invalidation isn't too aggressive
- Ensure cache keys are stable

#### Data Inconsistency
- Check for race conditions in data updates
- Verify RPC function logic matches legacy queries
- Consider timing differences in concurrent operations

## Optimization History

### Before Optimization
- ❌ 2-3 minute loading times
- ❌ Multiple separate database queries
- ❌ No caching mechanism
- ❌ Basic loading states

### After Optimization
- ✅ Under 3 second loading times
- ✅ Single optimized RPC function
- ✅ React Query caching (5-10 min)
- ✅ Progressive loading UI
- ✅ Automatic cache invalidation

## Performance Monitoring

### Key Metrics to Monitor
1. **Average Load Time**: Should remain < 3 seconds
2. **Cache Hit Rate**: Should be > 90% for repeated requests
3. **Error Rate**: Should be < 1%
4. **Data Freshness**: Cache should invalidate on data changes

### Alerts & Thresholds
- **Critical**: Average load time > 5 seconds
- **Warning**: Average load time > 3 seconds
- **Info**: Cache hit rate < 90%

## Continuous Testing

### When to Run Tests
- Before deploying performance changes
- After database schema modifications
- When adding new usage statistics features
- During performance regression investigations

### Automated Testing
The test suite can be integrated into CI/CD pipelines:

```bash
# Example CI command
npm run test:performance
```

## Troubleshooting

### Test Failures
1. Check browser console for errors
2. Verify database connectivity
3. Ensure user has sufficient test data
4. Check for authentication issues

### Performance Degradation
1. Run individual tests to isolate issues
2. Check database query performance
3. Verify cache configuration
4. Monitor network conditions

## Future Enhancements

### Planned Improvements
- [ ] Automated performance regression detection
- [ ] Real-time performance monitoring dashboard
- [ ] Load testing with simulated high traffic
- [ ] Performance budgets and alerts
- [ ] Cross-browser performance testing

### Metrics to Add
- [ ] Memory usage during loading
- [ ] Network request count and size
- [ ] Time to first meaningful paint
- [ ] Progressive loading stage timings

## Related Documentation

- [Database Optimization](./database-optimization.md)
- [Caching Strategy](./caching-strategy.md)
- [Progressive Loading](./progressive-loading.md)
- [Performance Guidelines](../PROJECT_GUIDELINES.md#performance-optimization)
