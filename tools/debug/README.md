# Debug Utilities

This directory contains debug scripts and utilities for troubleshooting the Mataresit application.

## Cache Clearing Scripts

### PowerCat Search Debug Scripts
- `clear-powercat-cache.js` - Clear PowerCat search cache
- `clear-powercat-cache-fix.js` - Enhanced cache clearing for PowerCat
- `force-clear-cache.js` - Force clear all cache layers
- `nuclear-cache-clear.js` - Aggressive cache clearing utility
- `debug-powercat.html` - Interactive PowerCat debug interface

### PowerCat Test Scripts
- `test-powercat-direct.js` - Direct PowerCat search testing
- `test-powercat-final-fix.js` - Final PowerCat fix verification
- `test-powercat-fix-verification.js` - PowerCat fix verification
- `test-powercat-fix.js` - PowerCat fix testing
- `fix-powercat-search.js` - PowerCat search fix utility

## General Test Scripts
- `test-auth-simple.js` - Simple authentication testing
- `test-background-search-context.js` - Background search context testing
- `test-intent-classification.js` - Intent classification testing
- `test-temporal-query.js` - Temporal query testing
- `test-upload-fix.html` - Upload functionality testing
- `check-receipts.js` - Receipt checking utility

## Usage

Most scripts are designed to be run in the browser console on the appropriate page:

```javascript
// Example: Clear PowerCat cache
// 1. Open the search page
// 2. Open browser console (F12)
// 3. Copy and paste the script content
// 4. Press Enter to execute
```

For HTML files, open them directly in a browser for interactive debugging.

## Safety Note

These are debug utilities and should only be used in development or testing environments. Some scripts clear browser cache and localStorage data.
