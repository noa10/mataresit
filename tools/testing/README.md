# Testing Tools

This directory contains test scripts and validation utilities for the Mataresit application.

## Test Scripts

### Temporal Search Testing
- `test-date-calculation.ts` - Test date calculation logic
- `test-last-week-search.ts` - Test last week search functionality  
- `test-last-week-temporal.ts` - Test temporal parsing for last week queries
- `test-temporal-*.ts/js` - Various temporal search test scripts
- `validate-temporal-search-complete.ts` - Complete temporal search validation

### Database Testing
- `test-db-temporal.sql` - SQL tests for temporal database queries

### Integration Testing  
- `test-live-system-fixes.ts` - Test fixes against live system
- `test-search-with-curl.ts` - Test search API with curl commands
- `test-smart-suggestions.js` - Test smart suggestion functionality

## Test Logs

The `logs/` subdirectory contains test execution logs:
- `test-results-*.log` - Timestamped test execution results

## Usage

These scripts help validate:

1. **Temporal Search Logic** - Date calculations and query parsing
2. **API Integration** - Search endpoints and responses  
3. **Database Queries** - SQL temporal filtering
4. **System Fixes** - Verification of bug fixes and improvements

## Running Tests

```bash
# Example: Test temporal search
tsx tools/testing/test-last-week-search.ts

# Example: Validate complete temporal functionality
tsx tools/testing/validate-temporal-search-complete.ts

# Example: Run database temporal tests
psql -f tools/testing/test-db-temporal.sql
```

## Related Directories

- `tools/debug/` - Debug scripts and utilities
- `tests/` - Main test suite (unit, integration, e2e)
- `scripts/` - Production utility scripts
