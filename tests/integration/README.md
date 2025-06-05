# Integration Tests

This directory contains integration tests that verify the interaction between multiple components.

## Test Files

### Payment Integration
- `stripe-integration.test.js` - Tests Stripe payment integration with Supabase Edge Functions
- `test-payment-flow.js` - Tests complete payment flow functionality

### AI Integration
- `gemini-function.test.js` - Tests Gemini AI function integration

### Subscription Management
- `debug-subscription.js` - Debug and test subscription functionality

## Running Integration Tests

### Individual Tests
```bash
# Run Stripe integration test
npm run test:integration

# Run specific integration test
node tests/integration/stripe-integration.test.js
node tests/integration/gemini-function.test.js
node tests/integration/test-payment-flow.js
```

### All Integration Tests
```bash
# Run all integration tests
npm run test:integration:all
```

## Test Environment Requirements

### Environment Variables
Ensure the following environment variables are set:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- Stripe test keys (configured in Supabase)

### Dependencies
- Node.js with fetch support (or node-fetch for older versions)
- Access to Supabase Edge Functions
- Stripe test environment

## Test Categories

### Payment Tests
- Checkout session creation
- Webhook handling
- Subscription management
- Payment flow validation

### AI Tests
- Gemini API connectivity
- Function response validation
- Error handling

### Authentication Tests
- User authentication flow
- Session management
- Permission validation

## Adding New Integration Tests

1. Create test files with `.test.js` extension
2. Follow the existing test patterns
3. Include proper error handling and logging
4. Add test descriptions to this README
5. Update package.json scripts if needed

## Test Data

Use test data that:
- Doesn't affect production systems
- Uses Stripe test cards and webhooks
- Includes edge cases and error scenarios
- Is easily reproducible
