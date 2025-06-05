# Manual Tests

This directory contains manual test files that require human interaction or verification.

## Test Files

### HTML Test Pages
- `simple-test.html` - Simple authentication test page
- `test-downgrade.html` - Subscription downgrade test page (main version)
- `test-downgrade-public.html` - Public subscription test page (alternative version)

### Test Scripts
- `test-downgrade.js` - Subscription test script

### Documentation
- `test-subscription-flow.md` - Manual subscription testing guide

## Running Manual Tests

### Authentication Test
1. Open `simple-test.html` in a web browser
2. Click "Test Authentication" button
3. Verify authentication flow works correctly

### Subscription Tests
1. Open `test-downgrade.html` in a web browser
2. Follow the on-screen instructions
3. Test various subscription scenarios:
   - Downgrade from Max to Pro
   - Downgrade from Max to Free
   - Upgrade from Free to Pro
   - Upgrade from Free to Max

### Using Test Scripts
```bash
# Run subscription test script
node tests/manual/test-downgrade.js
```

## Test Environment Setup

These tests require:
1. Valid Supabase connection
2. Proper authentication setup
3. Stripe test environment configured
4. Test user accounts with appropriate permissions

## Notes

- These tests use real API endpoints but in test mode
- Ensure you're using test Stripe keys, not production keys
- Some tests may require specific user roles or subscription states
- Always verify test results manually

## Adding New Manual Tests

1. Create HTML files for interactive tests
2. Add JavaScript files for automated manual tests
3. Include documentation for test procedures
4. Update this README with new test descriptions
