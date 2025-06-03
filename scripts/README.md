# Scripts

This directory contains utility scripts for the Paperless Maverick project.

## Structure

- `build/` - Build-related scripts and tools
- `database/` - Database management scripts
- `utils/` - General utility scripts

## Database Scripts

### `database/create_admin_functions.sql`
SQL script to create admin-related database functions.

### `database/make_user_admin.sql`
SQL script to grant admin privileges to a user.

## Utility Scripts

### `utils/backfill-confidence-scores.ts`
TypeScript script to backfill confidence scores for existing receipts.

### `utils/backfill-thumbnails.ts`
TypeScript script to generate thumbnails for existing receipt images.

### `utils/local-backfill-thumbnails.ts`
Local version of the thumbnail backfill script for development.

### `utils/switch-env.js`
Utility to switch between different environment configurations.

## Usage

Most scripts can be run using npm scripts defined in package.json:

```bash
# Generate thumbnails
npm run generate-thumbnails

# Switch environments
npm run env:local
npm run env:production
npm run env:status
```

For database scripts, run them directly in your database management tool or via Supabase CLI.
