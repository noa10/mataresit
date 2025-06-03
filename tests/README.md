# Tests

This directory contains all test files for the Paperless Maverick project.

## Structure

- `integration/` - Integration tests that test multiple components working together
- `unit/` - Unit tests for individual functions and components
- `e2e/` - End-to-end tests for complete user workflows

## Running Tests

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run unit tests
npm run test:unit

# Run e2e tests
npm run test:e2e
```

## Test Files

### Integration Tests
- `stripe-integration.test.js` - Tests Stripe payment integration
- `gemini-function.test.js` - Tests Gemini AI function integration

### Unit Tests
- Add unit test files here following the pattern: `*.test.js` or `*.spec.js`

### E2E Tests
- Add end-to-end test files here
