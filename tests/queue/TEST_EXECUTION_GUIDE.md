# Queue System Test Execution Guide

This guide provides comprehensive instructions for executing the queue system test suite that we just implemented.

## 🚀 Quick Start

### 1. Run All Queue Tests
```bash
npm run test:queue
```

### 2. Run Specific Test Categories
```bash
# Unit tests only
npm run test:queue:unit

# Integration tests only
npm run test:queue:integration

# Performance tests only
npm run test:queue:performance
```

## 📋 Detailed Test Execution

### Environment Setup

1. **Ensure dependencies are installed:**
```bash
npm install
```

2. **Verify environment variables:**
```bash
# Check if .env.local exists and contains required variables
cat .env.local | grep -E "(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)"
```

3. **Set test environment:**
```bash
export NODE_ENV=test
export VITE_SUPABASE_URL="http://127.0.0.1:54331"
export VITE_SUPABASE_ANON_KEY="test-key"
```

### Individual Test File Execution

#### Real-time Functionality Tests
```bash
npx vitest run tests/queue/unit/real-time-functionality.test.ts --reporter=verbose
npx vitest run tests/queue/unit/websocket-connections.test.ts --reporter=verbose
npx vitest run tests/queue/unit/live-metrics-streaming.test.ts --reporter=verbose
```

#### Error Handling Tests
```bash
npx vitest run tests/queue/unit/error-handling.test.ts --reporter=verbose
npx vitest run tests/queue/unit/retry-mechanisms.test.ts --reporter=verbose
npx vitest run tests/queue/unit/error-monitoring.test.ts --reporter=verbose
```

#### Security Tests
```bash
npx vitest run tests/queue/unit/security-access-controls.test.ts --reporter=verbose
npx vitest run tests/queue/unit/security-data-protection.test.ts --reporter=verbose
npx vitest run tests/queue/unit/security-api-validation.test.ts --reporter=verbose
```

#### Enhanced Component Tests
```bash
npx vitest run tests/queue/unit/useQueueMetrics-hook.test.ts --reporter=verbose
npx vitest run tests/queue/unit/queue-service-functions.test.ts --reporter=verbose
npx vitest run tests/queue/unit/EmbeddingQueueMetrics-component.test.tsx --reporter=verbose
```

### Test Categories

#### 1. **Unit Tests** (tests/queue/unit/)
- ✅ Real-time functionality (auto-refresh, WebSocket, live streaming)
- ✅ Error handling (retry mechanisms, recovery, monitoring)
- ✅ Security (access controls, data protection, API validation)
- ✅ Enhanced components (hooks, services, React components)
- ✅ Existing queue functions and admin interface

#### 2. **Integration Tests** (tests/queue/integration/)
- ✅ Worker processing integration
- ✅ Database integration
- ✅ API integration

#### 3. **Performance Tests** (tests/queue/performance/)
- ✅ Load testing
- ✅ Stress testing
- ✅ Performance benchmarks

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. **Module Resolution Errors**
```bash
# Error: Cannot resolve module '@/...'
# Solution: Ensure TypeScript paths are configured
npx tsc --noEmit --skipLibCheck
```

#### 2. **Mock Setup Issues**
```bash
# Error: vi is not defined
# Solution: Ensure vitest globals are enabled
export NODE_OPTIONS="--loader=tsx"
```

#### 3. **Environment Variable Issues**
```bash
# Error: VITE_SUPABASE_URL is undefined
# Solution: Set test environment variables
export VITE_SUPABASE_URL="http://127.0.0.1:54331"
export VITE_SUPABASE_ANON_KEY="test-key"
```

#### 4. **Timeout Issues**
```bash
# Error: Test timeout
# Solution: Increase timeout in vitest.config.ts or use --timeout flag
npx vitest run --timeout=60000 tests/queue/unit/
```

### Debug Mode
```bash
# Run tests in debug mode
npx vitest run tests/queue/unit/ --reporter=verbose --no-coverage

# Run specific test with debugging
npx vitest run tests/queue/unit/real-time-functionality.test.ts --reporter=verbose --no-coverage
```

### Coverage Reports
```bash
# Generate coverage report
npx vitest run tests/queue/unit/ --coverage

# View coverage report
open test-results/coverage/index.html
```

## 📊 Expected Test Results

### Success Criteria
- ✅ All unit tests pass (>95% success rate expected)
- ✅ Integration tests pass (>90% success rate expected)
- ✅ Performance tests meet benchmarks
- ✅ No critical security vulnerabilities detected
- ✅ Code coverage >80% for queue system components

### Performance Benchmarks
- Real-time updates: <100ms response time
- Queue operations: <500ms processing time
- Memory usage: <200MB during tests
- Error recovery: <1s recovery time

## 🎯 Focus Areas for Review

### 1. **New Test Files** (Priority: High)
- `real-time-functionality.test.ts`
- `websocket-connections.test.ts`
- `live-metrics-streaming.test.ts`
- `error-handling.test.ts`
- `retry-mechanisms.test.ts`
- `error-monitoring.test.ts`
- `security-access-controls.test.ts`
- `security-data-protection.test.ts`
- `security-api-validation.test.ts`
- `useQueueMetrics-hook.test.ts`
- `queue-service-functions.test.ts`

### 2. **Integration Points** (Priority: Medium)
- Mock implementations vs actual services
- Database connection handling
- API endpoint testing
- WebSocket connection management

### 3. **Performance Thresholds** (Priority: Medium)
- Response time benchmarks
- Memory usage limits
- Concurrent operation handling
- Error rate thresholds

## 📝 Test Results Interpretation

### Log Files Location
- Test results: `tests/queue/results/`
- Summary: `tests/queue/results/summary_[timestamp].txt`
- Individual logs: `tests/queue/results/[test_type]_[timestamp].log`

### Success Indicators
- ✅ Green checkmarks for passed tests
- ⚡ Performance metrics within thresholds
- 🔒 Security tests all passing
- 📊 Coverage reports showing adequate coverage

### Failure Indicators
- ❌ Red X marks for failed tests
- ⚠️ Yellow warnings for performance issues
- 🚨 Security vulnerabilities detected
- 📉 Coverage below thresholds

## 🔄 Continuous Integration

### GitHub Actions Integration
The test suite is designed to integrate with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Queue Tests
  run: |
    npm install
    npm run test:queue
```

### Pre-commit Hooks
```bash
# Add to .husky/pre-commit
npm run test:queue:unit
```

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review test logs in `tests/queue/results/`
3. Ensure all dependencies are installed
4. Verify environment variables are set correctly
5. Check that mock implementations match actual service interfaces
