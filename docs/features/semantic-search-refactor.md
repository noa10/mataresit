# Semantic Search Refactoring

## Overview

We've unified the embedding storage model for semantic search to improve consistency and performance. All embeddings (for both receipts and line items) are now stored in the `receipt_embeddings` table with proper source type and source ID references.

## Database Changes

1. **Schema Consolidation**
   - Added `source_type` and `source_id` columns to the `receipt_embeddings` table
   - Created appropriate indexes for optimized lookups
   - Created a unified search function `search_embeddings` that works with all embedding types
   - Created a hybrid search function `hybrid_search_embeddings` that combines embedding search with text search
   - Created an `add_embedding` function to standardize embedding storage

2. **Data Migration**
   - Migrated existing receipt embeddings to use the new source columns
   - Migrated all line item embeddings from the `line_items.embedding` column to the `receipt_embeddings` table
   - Created a view `line_item_embeddings_view` for easier querying of line item embeddings

3. **Cleanup**
   - Dropped the old embedding column from the `line_items` table
   - Dropped the old search functions that operated directly on line item embeddings
   - Added a trigger to ensure embedding cleanup when line items are deleted

## Edge Function Changes

1. **Updated Semantic Search Function**
   - Modified to use the new unified embedding model
   - Updated both receipt and line item search paths to use the consolidated table
   - Added support for filtering by source type

2. **Updated Embedding Generation**
   - Enhanced the existing embedding generation function to support the new unified model
   - Added dedicated functions for line item embedding generation
   - Created higher-level functions to generate both types of embeddings in a single call

## Client-Side Changes

Updated the AI search library to:
   - Check for and generate embeddings using the new unified model
   - Properly handle both receipt and line item embedding types
   - Provide better status reporting and error handling

## Benefits

1. **Consistency**: All embeddings are now stored in a dedicated, properly indexed table
2. **Performance**: Better query optimization with proper vector indexes
3. **Maintainability**: Single source of truth for embeddings with clear relationship modeling
4. **Scalability**: Better support for future embedding types (e.g., images, categories)
5. **Reduced Complexity**: Simplified search functions and code paths

## Migration Path

The migration is designed to work seamlessly with existing data:
1. First, the existing receipt embeddings are updated to use the new source fields
2. Next, line item embeddings are copied to the consolidated table
3. Finally, after confirming successful migration, the old embedding column is removed

This ensures no data is lost during the transition to the new model.

## Future Improvements

1. Add support for more embedding types (e.g., receipt images, categories)
2. Implement bulk embedding operations for better performance
3. Add support for custom embedding models and dimensions
4. Improve relevance ranking by fine-tuning the hybrid search weights 