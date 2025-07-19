# Debug Tools

This directory contains debug scripts and utilities for troubleshooting the Mataresit application.

## Debug Scripts

### Content Synthesis Debug
- `debug-content-synthesis.ts` - Debug script for AI vision content synthesis testing

### Temporal Search Debug  
- `debug-exact-query.ts` - Debug script for exact temporal query testing
- `debug-pattern-matching.ts` - Debug script for temporal pattern matching analysis
- `debug-fallback-strategies.ts` - Debug script for search fallback strategies
- `debug-last-week-calculation.ts` - Debug script for date calculation verification

## Usage

These scripts are designed for development and debugging purposes. They help developers:

1. **Test AI Vision Processing** - Verify content synthesis from receipt data
2. **Debug Temporal Queries** - Analyze date range calculations and pattern matching
3. **Validate Search Logic** - Test search routing and fallback mechanisms

## Running Debug Scripts

Most scripts are designed to run with Deno:

```bash
# Example: Test content synthesis
deno run --allow-env --allow-net --allow-read tools/debug/debug-content-synthesis.ts

# Example: Debug temporal queries
deno run --allow-all tools/debug/debug-exact-query.ts

# Example: Debug pattern matching
deno run --allow-all tools/debug/debug-pattern-matching.ts
```

## Related Directories

- `tools/testing/` - Test scripts and validation utilities
- `debug/` - Additional debug utilities (existing)
- `scripts/` - Production utility scripts
