# Tests

This directory contains all test files for the Paperless Maverick project.

## Structure

- `integration/` - Integration tests that test multiple components working together
- `unit/` - Unit tests for individual functions and components
- `e2e/` - End-to-end tests for complete user workflows
- `manual/` - Manual test files including HTML test pages and documentation
- `fixtures/` - Test data and fixtures
- `mocks/` - Mock data and services for testing

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

# Run manual tests
npm run test:manual
```

## Test Files

### Integration Tests
- `stripe-integration.test.js` - Tests Stripe payment integration
- `gemini-function.test.js` - Tests Gemini AI function integration
- `test-payment-flow.js` - Tests payment flow functionality
- `debug-subscription.js` - Debug and test subscription functionality

### Unit Tests
- Add unit test files here following the pattern: `*.test.js` or `*.spec.js`

### E2E Tests
- Add end-to-end test files here

### Manual Tests
- `simple-test.html` - Simple authentication test page
- `test-downgrade.html` - Subscription downgrade test page
- `test-downgrade.js` - Subscription test script
- `test-downgrade-public.html` - Public subscription test page
- `test-subscription-flow.md` - Manual subscription testing guide

## Test Guidelines

1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test interactions between multiple components
3. **E2E Tests**: Test complete user workflows from start to finish
4. **Manual Tests**: Interactive tests that require human verification

## Adding New Tests

- Place unit tests in `unit/` directory
- Place integration tests in `integration/` directory
- Place end-to-end tests in `e2e/` directory
- Place manual test files in `manual/` directory
- Use descriptive filenames with `.test.js` or `.spec.js` extensions
- Include test fixtures in `fixtures/` directory
- Place mock services in `mocks/` directory
