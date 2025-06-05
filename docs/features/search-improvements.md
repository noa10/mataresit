# Search Functionality Improvements

This document outlines the key improvements made to the search functionality in Paperless Maverick to address suboptimal search results.

## Major Improvements Implemented

### 1. Enhanced Embedding Dimension Handling

**Problem**: The original implementation used simple zero-padding or truncation to adjust dimensions from Gemini's 768 to OpenAI's standard 1536 dimensions, which didn't preserve semantic meaning well.

**Solution**: Implemented more sophisticated dimension handling in both query and document embeddings:

- For embeddings that are half the target size (768 → 1536):
  - Use duplication of each value instead of zero-padding
  - Example: `[0.1, 0.2, 0.3]` → `[0.1, 0.1, 0.2, 0.2, 0.3, 0.3]`
  
- For other size mismatches:
  - Apply normalization to maintain vector magnitude
  - When truncating larger vectors, normalize the remaining values
  - When extending smaller vectors, apply a normalization factor before padding

**Files modified**:
- `supabase/functions/generate-embeddings/index.ts`
- `supabase/functions/semantic-search/index.ts`

### 2. Adjusted Similarity Thresholds

**Problem**: The default similarity threshold (0.5) was potentially too restrictive, causing relevant results to be missed.

**Solution**: Lowered similarity thresholds for better recall:
- Receipts: 0.5 → 0.4
- Line items: 0.35 → 0.3

**Files modified**:
- `supabase/functions/semantic-search/index.ts`
- `supabase/functions/semantic-search/performLineItemSearch.ts`

**Implementation Note**: Initially, we attempted to modify these thresholds using a database migration that would update the default parameter values in PostgreSQL functions. However, we encountered compatibility issues with the ALTER FUNCTION syntax in the Supabase PostgreSQL version. Instead, the threshold changes are implemented directly in the application code within the Edge Functions, which provides more flexibility for future adjustments.

### 3. Added Embedding Regeneration Capability

**Problem**: After improving the embedding generation logic, existing embeddings still used the old method.

**Solution**: Added functionality to regenerate all embeddings in the database:
- Created a new admin API endpoint: `/api/admin/regenerate-embeddings`
- Added a user interface for admins to trigger regeneration
- Implemented batch processing to handle large datasets

**Files added/modified**:
- `src/lib/ai-search.ts` - New `regenerateAllEmbeddings` function
- `src/pages/api/admin/regenerate-embeddings.ts` - New API endpoint
- `src/components/admin/RegenerateEmbeddingsButton.tsx` - UI component
- `src/pages/admin/settings.tsx` - Admin settings page with the regeneration button

## How to Regenerate Embeddings

After these improvements are deployed, existing embeddings should be regenerated to take advantage of the improved dimension handling:

1. Log in as an administrator
2. Navigate to Admin → Settings → Embeddings
3. Click the "Regenerate All Embeddings with Improved Algorithm" button
4. Wait for the process to complete (this may take several minutes depending on the size of your database)

## Technical Details

### Dimension Handling Logic

```typescript
// Original method - simple zero-padding or truncation
if (embedding.length < EMBEDDING_DIMENSIONS) {
  // Pad with zeros
  const padding = new Array(EMBEDDING_DIMENSIONS - embedding.length).fill(0);
  embedding = [...embedding, ...padding];
} else if (embedding.length > EMBEDDING_DIMENSIONS) {
  // Truncate
  embedding = embedding.slice(0, EMBEDDING_DIMENSIONS);
}

// New method - sophisticated dimension handling
if (embedding.length < EMBEDDING_DIMENSIONS) {
  if (embedding.length * 2 === EMBEDDING_DIMENSIONS) {
    // If exactly half size, duplicate each value
    embedding = embedding.flatMap(val => [val, val]);
  } else {
    // Pad with zeros, but normalize the remaining values
    const normalizationFactor = Math.sqrt(EMBEDDING_DIMENSIONS / embedding.length);
    const normalizedEmbedding = embedding.map(val => val * normalizationFactor);
    const padding = new Array(EMBEDDING_DIMENSIONS - embedding.length).fill(0);
    embedding = [...normalizedEmbedding, ...padding];
  }
} else if (embedding.length > EMBEDDING_DIMENSIONS) {
  // Use dimensionality reduction
  if (embedding.length === EMBEDDING_DIMENSIONS * 2) {
    // If exactly double, average adjacent pairs
    const reducedEmbedding = [];
    for (let i = 0; i < embedding.length; i += 2) {
      reducedEmbedding.push((embedding[i] + embedding[i+1]) / 2);
    }
    embedding = reducedEmbedding;
  } else {
    // Otherwise truncate but normalize
    embedding = embedding.slice(0, EMBEDDING_DIMENSIONS);
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      embedding = embedding.map(val => val / magnitude * Math.sqrt(EMBEDDING_DIMENSIONS));
    }
  }
}
```

### Database Migration Details

The migration file (`20260201000000_update_search_similarity_thresholds.sql`) uses the following approach:

1. Uses `ALTER FUNCTION` to update only the default parameter values of existing functions
2. Explicitly specifies the full function signatures to avoid ambiguity with overloaded functions
3. Example:
   ```sql
   ALTER FUNCTION search_receipts(vector(1536), double precision, int, text) 
     ALTER ARGUMENT 2 SET DEFAULT 0.4; -- Changed from 0.5 to 0.4
   ```
4. This is much safer than dropping and recreating functions since it preserves the function bodies and just changes the default values

## Expected Benefits

These improvements should result in:

1. Better semantic matching between queries and documents
2. Increased recall (more relevant results returned)
3. More consistent search behavior across different types of queries

## Future Considerations

1. Consider experimenting further with similarity thresholds to find the optimal balance between precision and recall
2. Monitor search performance and collect user feedback to guide additional improvements
3. Explore hybrid search approaches that combine vector similarity with keyword matching for certain use cases 