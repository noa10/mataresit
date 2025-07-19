# Alerting System Testing Suite

This directory contains comprehensive tests for the Phase 1 alerting system implementation, covering all 6 major components: database schema, real-time alert engine, multi-channel notifications, escalation management, configurable rules interface, and alert suppression/rate limiting.

## Quick Start

```bash
# Install dependencies
npm install

# Run all alerting tests (except E2E and performance)
npm run test:alerting

# Run specific test types
npm run test:alerting:unit        # Unit tests only
npm run test:alerting:integration # Integration tests only
npm run test:alerting:e2e        # End-to-end tests only
npm run test:alerting:performance # Performance tests only

# Run all tests including E2E and performance
npm run test:alerting:all
```

## Test Structure

```
tests/alerting/
├── unit/                    # Unit tests for individual components
│   ├── alertingService.test.ts
│   ├── notificationChannelService.test.ts
│   ├── alertSuppressionManager.test.ts
│   └── hooks/
├── integration/             # Integration tests for complete flows
│   ├── alert-flow-integration.test.ts
│   ├── notification-delivery.test.ts
│   └── escalation-policies.test.ts
├── e2e/                    # End-to-end tests using Playwright
│   ├── critical-alert-flow.spec.ts
│   ├── admin-interface.spec.ts
│   └── maintenance-windows.spec.ts
├── performance/            # Performance and load tests
│   ├── alert-volume-performance.test.js
│   └── notification-throughput.test.js
├── database/              # Database-specific tests
│   ├── schema-validation.sql
│   ├── rls-policies.test.ts
│   └── stored-functions.test.ts
├── setup/                 # Test configuration and utilities
│   ├── test-setup.ts
│   ├── vitest-setup.ts
│   ├── playwright-global-setup.ts
│   └── playwright-global-teardown.ts
└── run-tests.sh          # Comprehensive test runner script
```

## Testing Frameworks

### Unit & Integration Tests
- **Framework**: Vitest (modern, fast, TypeScript-first)
- **Utilities**: @testing-library/react for component testing
- **Mocking**: MSW (Mock Service Worker) for API mocking
- **Coverage**: V8 coverage with detailed reporting

### End-to-End Tests
- **Framework**: Playwright (cross-browser, reliable)
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome/Safari
- **Features**: Screenshots, videos, traces on failure

### Performance Tests
- **Framework**: Custom Node.js scripts with Artillery.js
- **Metrics**: Throughput, latency, error rates, resource usage
- **Thresholds**: Configurable performance benchmarks

### Database Tests
- **Framework**: Vitest for TypeScript tests, pgTAP for SQL tests
- **Coverage**: Schema validation, RLS policies, stored functions

## Test Categories

### 1. Unit Tests (`unit/`)

Test individual components in isolation:

- **AlertingService**: Rule creation, evaluation, alert management
- **NotificationChannelService**: Channel configuration, message delivery
- **AlertSuppressionManager**: Suppression logic, rate limiting
- **React Hooks**: useAlertEngine, useNotificationChannels, useAlertEscalation
- **React Components**: AlertRulesInterface, AlertDashboard

**Example:**
```bash
npm run test:alerting:unit
```

### 2. Integration Tests (`integration/`)

Test complete workflows across multiple components:

- **Alert Flow**: Database trigger → evaluation → notification delivery
- **Escalation Policies**: Multi-level escalation with timing
- **Cross-Service Communication**: Supabase Edge Functions integration
- **Real-time Processing**: WebSocket updates, concurrent operations

**Example:**
```bash
npm run test:alerting:integration
```

### 3. End-to-End Tests (`e2e/`)

Test complete user workflows in the browser:

- **Critical Alert Flow**: Create rule → trigger → notify → acknowledge → resolve
- **Admin Interface**: Rule management, channel configuration
- **Escalation Scenarios**: Multi-level escalation with user interaction
- **Maintenance Windows**: Suppression during maintenance

**Example:**
```bash
npm run test:alerting:e2e
```

### 4. Performance Tests (`performance/`)

Validate system performance under load:

- **Alert Volume**: Process 1000+ alerts efficiently
- **Notification Throughput**: Deliver notifications within SLA
- **Concurrent Users**: Handle multiple simultaneous operations
- **Stress Testing**: System behavior under extreme load

**Example:**
```bash
npm run test:alerting:performance
```

### 5. Database Tests (`database/`)

Ensure database integrity and performance:

- **Schema Validation**: Table structure, constraints, indexes
- **RLS Policies**: Row-level security enforcement
- **Stored Functions**: Alert evaluation, statistics calculation
- **Migration Testing**: Schema changes, data migration

**Example:**
```bash
npm run test:alerting:database
```

## Configuration

### Environment Variables

```bash
# Test Database (use local Supabase for testing)
VITE_SUPABASE_URL=http://127.0.0.1:54331
VITE_SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_KEY=your-test-service-key

# Test Environment
NODE_ENV=test
TEST_ENV=development

# E2E Testing
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### Test Data

Tests use isolated test data with prefixed identifiers:
- Teams: `test-team-{timestamp}-{counter}`
- Users: `test-user-{timestamp}-{counter}`
- Rules: `test-rule-{timestamp}-{counter}`

All test data is automatically cleaned up after tests complete.

## Performance Thresholds

The test suite enforces these performance requirements:

- **Alert Processing**: < 5 seconds per alert
- **Notification Delivery**: < 30 seconds per notification
- **Throughput**: > 100 alerts per second
- **Error Rate**: < 1%
- **Memory Usage**: < 512MB during normal operation
- **Test Coverage**: > 90% for critical paths

## Running Tests

### Quick Commands

```bash
# Run unit tests with coverage
npm run test:alerting:unit -- --coverage

# Run integration tests with verbose output
npm run test:alerting:integration -- --verbose

# Run E2E tests in headed mode (see browser)
npm run test:alerting:e2e -- --headed

# Run performance tests with custom duration
TEST_DURATION=120000 npm run test:alerting:performance
```

### Advanced Usage

```bash
# Use the comprehensive test runner
./tests/alerting/run-tests.sh --help

# Run specific test types
./tests/alerting/run-tests.sh --unit --coverage
./tests/alerting/run-tests.sh --integration --verbose
./tests/alerting/run-tests.sh --e2e
./tests/alerting/run-tests.sh --performance
./tests/alerting/run-tests.sh --all --parallel

# Run with custom environment
TEST_ENV=staging ./tests/alerting/run-tests.sh --integration
```

## Test Reports

Tests generate comprehensive reports:

- **Coverage Report**: `coverage/lcov-report/index.html`
- **Vitest Report**: `test-results/vitest-report.html`
- **Playwright Report**: `test-results/playwright-report/index.html`
- **Performance Report**: `test-results/performance-report.json`
- **Combined Report**: `test-results/alerting-test-report-{timestamp}.md`

## Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Alerting Tests
  run: |
    npm install
    npm run test:alerting:unit -- --coverage --reporter=junit
    npm run test:alerting:integration -- --reporter=junit
    npm run test:alerting:database
  env:
    VITE_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}

- name: Run E2E Tests
  run: npm run test:alerting:e2e
  if: github.event_name == 'pull_request'
```

## Debugging Tests

### Common Issues

1. **Database Connection**: Ensure local Supabase is running
2. **Test Timeouts**: Increase timeout for slow operations
3. **Flaky E2E Tests**: Use `test.retry()` for unstable tests
4. **Memory Leaks**: Check for unclosed connections in tests

### Debug Commands

```bash
# Run tests in debug mode
npm run test:alerting:unit -- --inspect-brk

# Run single test file
npm run test:alerting:unit -- alertingService.test.ts

# Run E2E tests with debug info
npm run test:alerting:e2e -- --debug
```

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Use the test utilities in `setup/test-setup.ts`
3. Clean up test data in `afterEach` hooks
4. Add performance assertions for critical paths
5. Update this README with new test categories

## Troubleshooting

### Common Solutions

- **Tests hanging**: Check for unclosed database connections
- **Permission errors**: Verify RLS policies allow test operations
- **Flaky tests**: Add proper wait conditions and retries
- **Performance failures**: Check system resources and thresholds

For more help, see the [main testing strategy document](../../docs/testing/ALERTING_SYSTEM_TESTING_STRATEGY.md).
