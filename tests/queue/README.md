# Queue System Test Suite

Comprehensive testing suite for the Phase 2 embedding queue-based processing system.

## Overview

This test suite validates all aspects of the queue system implementation including:

- **Database Functions** - Core queue management functions
- **Worker Processing** - Edge Function worker lifecycle and processing
- **Admin Interface** - React components for queue management
- **Performance** - Load testing and performance validation
- **Integration** - End-to-end workflow testing

## Test Structure

```
tests/queue/
├── unit/                           # Unit tests for individual components
│   ├── queue-functions.test.ts     # Database function unit tests
│   └── queue-admin-interface.test.tsx # Admin interface component tests
├── integration/                    # Integration tests for complete workflows
│   └── worker-processing.test.ts   # Worker lifecycle and processing tests
├── performance/                    # Performance and load tests
│   └── queue-load-test.js         # Load testing with multiple scenarios
├── results/                       # Test execution results and logs
├── run-queue-tests.sh            # Main test runner script
└── README.md                     # This file
```

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Vitest testing framework
- Supabase CLI (for database testing)
- Valid environment variables configured

## Environment Setup

### Required Environment Variables

```bash
# Test environment
NODE_ENV=test

# Supabase configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Gemini API for integration tests
GEMINI_API_KEY=your_gemini_api_key
```

### Test Database Setup

For integration tests, ensure your test database has the required migrations:

```bash
# Apply queue system migrations
supabase db push

# Or run specific migrations
supabase migration up --to 20250719000002
```

## Running Tests

### Quick Start

```bash
# Run all tests
./tests/queue/run-queue-tests.sh

# Or using npm script (add to package.json)
npm run test:queue
```

### Individual Test Categories

```bash
# Unit tests only
./tests/queue/run-queue-tests.sh unit

# Integration tests only
./tests/queue/run-queue-tests.sh integration

# Performance tests only
./tests/queue/run-queue-tests.sh performance

# Migration validation only
./tests/queue/run-queue-tests.sh migrations
```

### Using Vitest Directly

```bash
# Run specific test file
npx vitest run tests/queue/unit/queue-functions.test.ts

# Run with watch mode
npx vitest tests/queue/unit/ --watch

# Run with coverage
npx vitest run tests/queue/ --coverage
```

## Test Categories

### 1. Unit Tests

#### Queue Functions (`queue-functions.test.ts`)
Tests core database functions:
- `get_next_embedding_batch()` - Batch retrieval with priority
- `complete_embedding_queue_item()` - Item completion handling
- `handle_rate_limit()` - Rate limiting management
- `get_queue_statistics()` - Statistics aggregation
- Configuration management functions
- Worker heartbeat functions

#### Admin Interface (`queue-admin-interface.test.tsx`)
Tests React components:
- Queue statistics display
- Worker control interface
- Configuration management
- Maintenance operations
- Error handling
- Real-time updates

### 2. Integration Tests

#### Worker Processing (`worker-processing.test.ts`)
Tests complete workflows:
- Worker lifecycle (start/stop/status)
- Queue item processing flow
- Embedding generation integration
- Rate limiting handling
- Error recovery mechanisms
- Performance tracking

### 3. Performance Tests

#### Load Testing (`queue-load-test.js`)
Tests system performance under load:

**Test Scenarios:**
- **Light**: 1 worker, 50 items, 2 minutes
- **Moderate**: 2 workers, 200 items, 5 minutes  
- **Heavy**: 3 workers, 500 items, 10 minutes
- **Stress**: 5 workers, 1000 items, 15 minutes

**Performance Thresholds:**
- Max queue processing time: 5000ms
- Max batch retrieval time: 1000ms
- Max item completion time: 500ms
- Min throughput: 10 items/minute
- Max error rate: 5%

## Test Results

### Result Files

Test execution generates detailed results:

```
tests/queue/results/
├── unit_functions_YYYYMMDD_HHMMSS.log
├── integration_worker_YYYYMMDD_HHMMSS.log
├── performance_YYYYMMDD_HHMMSS.log
└── summary_YYYYMMDD_HHMMSS.txt
```

### Success Criteria

Tests pass when:
- All unit tests pass (100% success rate)
- Integration workflows complete successfully
- Performance meets defined thresholds
- No critical errors in logs
- Database migrations apply cleanly

## Continuous Integration

### GitHub Actions Integration

Add to `.github/workflows/queue-tests.yml`:

```yaml
name: Queue System Tests

on:
  push:
    paths:
      - 'supabase/migrations/*queue*'
      - 'supabase/functions/embedding-queue-worker/**'
      - 'src/components/admin/EmbeddingQueue*'
      - 'tests/queue/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: ./tests/queue/run-queue-tests.sh
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

### Pre-commit Hooks

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
# Run queue tests before commit
./tests/queue/run-queue-tests.sh unit
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check Supabase connection
   supabase status
   
   # Verify environment variables
   echo $VITE_SUPABASE_URL
   ```

2. **Migration Failures**
   ```bash
   # Reset and reapply migrations
   supabase db reset
   supabase migration up
   ```

3. **Worker API Errors**
   ```bash
   # Check Edge Function deployment
   supabase functions list
   supabase functions logs embedding-queue-worker
   ```

4. **Performance Test Failures**
   - Adjust thresholds in `queue-load-test.js`
   - Check system resources during testing
   - Verify network connectivity

### Debug Mode

Enable verbose logging:

```bash
# Set debug environment
export DEBUG=queue:*
export LOG_LEVEL=debug

# Run tests with detailed output
./tests/queue/run-queue-tests.sh
```

## Contributing

### Adding New Tests

1. **Unit Tests**: Add to appropriate file in `unit/`
2. **Integration Tests**: Add to `integration/`
3. **Performance Tests**: Extend scenarios in `performance/`

### Test Naming Conventions

- Test files: `*.test.ts` or `*.test.tsx`
- Test descriptions: Use descriptive names
- Test groups: Use `describe()` blocks for organization

### Mock Guidelines

- Mock external dependencies (Supabase, fetch)
- Use realistic test data
- Test both success and error scenarios
- Verify function calls and parameters

## Performance Benchmarks

### Expected Performance

Based on testing with the mock system:

| Metric | Light Load | Heavy Load | Stress Test |
|--------|------------|------------|-------------|
| Throughput | 25 items/min | 45 items/min | 65 items/min |
| Avg Processing | 2.5s | 3.2s | 4.1s |
| Error Rate | <1% | <3% | <5% |
| Memory Usage | <128MB | <256MB | <512MB |

### Optimization Targets

- Batch processing efficiency
- Database query optimization
- Worker resource utilization
- Rate limiting effectiveness
- Error recovery speed

## Support

For issues with the test suite:

1. Check the troubleshooting section
2. Review test logs in `results/` directory
3. Verify environment configuration
4. Check database migration status
5. Validate Edge Function deployment

## License

This test suite is part of the Paperless Maverick project and follows the same license terms.
