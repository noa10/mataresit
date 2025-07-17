# Embedding Generation Plan for Temporal Search Fix

## Overview

This document outlines the comprehensive plan to generate embeddings for the 32 affected receipts in the date range 2025-07-07 to 2025-07-13, restoring full temporal search functionality while ensuring system stability and data integrity.

## Current System Analysis

### Embedding Generation Architecture

1. **Primary Edge Function**: `generate-embeddings`
   - Location: `supabase/functions/generate-embeddings/index.ts`
   - Uses Google Gemini API for embedding generation
   - Supports batch processing and individual receipt processing
   - Stores embeddings in `unified_embeddings` table

2. **Content Processing**:
   - **Full Text**: OCR-extracted text from receipt images
   - **Merchant**: Merchant name normalization and embedding
   - **Line Items**: Individual line item descriptions
   - **Notes**: User-added notes (if any)

3. **Storage System**:
   - **Primary Table**: `unified_embeddings`
   - **Status Tracking**: `receipts.has_embeddings` and `receipts.embedding_status`
   - **Content Types**: 'full_text', 'merchant', 'line_item', 'notes'

### Identified Mechanisms

1. **Direct API Call**: Edge function invocation via HTTP POST
2. **Batch Processing**: Built-in batch processing for multiple receipts
3. **Status Management**: Automatic status updates in receipts table
4. **Verification**: Cross-reference with unified_embeddings table

## Recommended Approach

### Method Selection: Direct Edge Function Invocation

**Chosen Method**: Direct HTTP calls to the `generate-embeddings` edge function

**Rationale**:
- ✅ Most reliable and tested approach
- ✅ Built-in error handling and retry logic
- ✅ Automatic status updates in receipts table
- ✅ Comprehensive logging and monitoring
- ✅ Supports verification and validation

**Alternative Methods Considered**:
- Admin API endpoints: Less direct control
- Database triggers: Not suitable for bulk operations
- Queue system: Overkill for 32 receipts

### Step-by-Step Execution Plan

#### Phase 1: Pre-Execution Validation (5 minutes)

1. **Environment Check**:
   ```bash
   # Verify environment variables
   echo $VITE_SUPABASE_URL
   echo $VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION
   ```

2. **Database Connection Test**:
   ```bash
   npx tsx scripts/test-db-connection.ts
   ```

3. **Edge Function Health Check**:
   ```bash
   curl -X POST "${SUPABASE_URL}/functions/v1/generate-embeddings" \
        -H "Authorization: Bearer ${SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"test": true}'
   ```

#### Phase 2: Affected Receipts Identification (2 minutes)

1. **Query Affected Receipts**:
   - Date range: 2025-07-07 to 2025-07-13
   - User ID: feecc208-3282-49d2-8e15-0c64b0ee4abb
   - Status: has_embeddings = false, embedding_status = 'pending'

2. **Validation**:
   - Confirm exactly 32 receipts
   - Verify no existing embeddings in unified_embeddings table
   - Check receipt content availability (fullText, merchant)

#### Phase 3: Batch Processing Execution (15-20 minutes)

1. **Batch Configuration**:
   - **Batch Size**: 3 receipts per batch
   - **Concurrency**: Process batches sequentially
   - **Rate Limiting**: 2-second delay between batches
   - **Total Batches**: 11 batches (32 ÷ 3 = 10.67)

2. **Processing Strategy**:
   ```typescript
   for each batch {
     // Process 3 receipts in parallel
     Promise.all([
       generateEmbeddings(receipt1),
       generateEmbeddings(receipt2), 
       generateEmbeddings(receipt3)
     ])
     
     // Update database status
     updateReceiptStatus(results)
     
     // Verify embeddings created
     verifyEmbeddings(receiptIds)
     
     // Wait before next batch
     await delay(2000)
   }
   ```

3. **Error Handling**:
   - Individual receipt failures don't stop batch processing
   - Failed receipts are retried once
   - Comprehensive error logging
   - Status updates reflect actual results

#### Phase 4: Verification and Validation (5 minutes)

1. **Embedding Verification**:
   - Query unified_embeddings table for all 32 receipts
   - Verify content_types include 'merchant' and 'full_text'
   - Check embedding dimensions (should be 1536)

2. **Status Verification**:
   - Confirm receipts.has_embeddings = true
   - Confirm receipts.embedding_status = 'complete'
   - Cross-reference with actual embeddings

3. **Functional Testing**:
   - Test temporal search queries for the date range
   - Verify receipts appear in search results
   - Confirm similarity scores are reasonable

## Performance and System Impact

### Resource Considerations

1. **API Rate Limits**:
   - Google Gemini API: 60 requests per minute
   - Our batch size (3) with 2-second delays = ~90 requests/hour
   - Well within limits for 32 receipts

2. **Database Load**:
   - Minimal impact: 32 receipt updates + 64-96 embedding inserts
   - Sequential processing prevents database overload

3. **Memory Usage**:
   - Each embedding: ~6KB (1536 dimensions × 4 bytes)
   - Total memory impact: ~200KB for all embeddings

### Optimal Timing Strategy

**Recommended Execution Time**: Off-peak hours (early morning or late evening)

**Rationale**:
- Minimal user impact during processing
- Better API response times
- Reduced system load competition

## Monitoring and Success Criteria

### Real-Time Monitoring

1. **Progress Tracking**:
   - Batch completion percentage
   - Individual receipt success/failure rates
   - Processing time per receipt
   - API response times

2. **Error Monitoring**:
   - API failures and retry attempts
   - Database update failures
   - Embedding verification failures

### Success Criteria

1. **Primary Success Metrics**:
   - ✅ 32/32 receipts have embeddings generated
   - ✅ All receipts marked as has_embeddings = true
   - ✅ All receipts have embedding_status = 'complete'
   - ✅ Embeddings exist in unified_embeddings table

2. **Functional Success Metrics**:
   - ✅ Temporal search returns results for 2025-07-07 to 2025-07-13
   - ✅ Search results include receipts from affected date range
   - ✅ Similarity scores are within expected ranges (0.3-1.0)

3. **Performance Success Metrics**:
   - ✅ Total processing time < 30 minutes
   - ✅ No API rate limit violations
   - ✅ No system performance degradation

## Risk Mitigation

### Identified Risks and Mitigations

1. **API Failures**:
   - **Risk**: Google Gemini API temporary unavailability
   - **Mitigation**: Retry logic with exponential backoff
   - **Fallback**: Manual retry of failed receipts

2. **Database Inconsistencies**:
   - **Risk**: Status updates fail while embeddings succeed
   - **Mitigation**: Verification step catches inconsistencies
   - **Fallback**: Manual status correction script

3. **Partial Failures**:
   - **Risk**: Some receipts fail embedding generation
   - **Mitigation**: Individual error handling and reporting
   - **Fallback**: Targeted retry for failed receipts

4. **System Overload**:
   - **Risk**: Processing impacts system performance
   - **Mitigation**: Conservative batch sizing and rate limiting
   - **Fallback**: Pause and resume capability

## Execution Commands

### Primary Execution Script

```bash
# Navigate to project directory
cd /path/to/paperless-maverick

# Run the embedding generation script
npx tsx scripts/generate-embeddings-for-affected-receipts.ts
```

### Verification Commands

```bash
# Verify embeddings were created
npx tsx scripts/verify-data-consistency-fix.ts

# Test temporal search functionality
# (Use the application's search interface with date filters)
```

## Post-Execution Steps

1. **Immediate Verification**:
   - Run verification script
   - Test temporal search functionality
   - Check system performance metrics

2. **Documentation Updates**:
   - Update this document with actual results
   - Document any issues encountered
   - Record lessons learned

3. **Monitoring Setup**:
   - Monitor temporal search usage
   - Track embedding system health
   - Set up alerts for future issues

## Rollback Plan

If critical issues arise during execution:

1. **Immediate Stop**: Terminate the embedding generation script
2. **Status Reset**: Reset affected receipts to embedding_status = 'pending'
3. **Cleanup**: Remove any partial embeddings from unified_embeddings
4. **Investigation**: Analyze logs and identify root cause
5. **Retry**: Execute with modified parameters after issue resolution

## Success Validation Checklist

- [ ] All 32 receipts processed successfully
- [ ] Database status correctly updated
- [ ] Embeddings verified in unified_embeddings table
- [ ] Temporal search functionality restored
- [ ] No system performance impact
- [ ] Documentation updated with results
