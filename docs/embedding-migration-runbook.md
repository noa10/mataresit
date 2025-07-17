# Embedding Migration Runbook

## Overview

This runbook provides step-by-step instructions for migrating receipt embeddings after the transition from OCR to AI vision processing. The migration addresses the issue where receipts processed with AI vision have empty `fullText` fields, resulting in 0% fullText content and failed embedding generation.

## Problem Statement

- **Root Cause**: AI vision processing pipeline hardcoded `fullText` to empty string
- **Impact**: 0% fullText content across AI vision processed receipts
- **Result**: Failed embedding generation and degraded search functionality

## Solution Architecture

The migration implements:
1. **Synthetic fullText Generation**: Convert structured AI vision data to searchable text
2. **Multi-Source Embeddings**: Generate embeddings from multiple content types
3. **Quality Metrics**: Track embedding quality and effectiveness
4. **Fallback Mechanisms**: Ensure robust processing under various conditions

## Pre-Migration Checklist

### 1. Environment Setup
- [ ] Verify environment variables are set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
- [ ] Ensure database migrations are applied:
  - `20250715000000_create_embedding_quality_metrics.sql`
- [ ] Test enhanced embedding generation on sample receipts

### 2. Analysis Phase
```bash
# Run analysis to understand migration scope
deno run --allow-env --allow-net --allow-read scripts/analyze-embedding-migration-needs.ts
```

Expected output:
- Total receipts count
- Receipts with empty fullText
- Current embedding coverage
- Migration priority breakdown

### 3. Backup Considerations
- [ ] Backup `unified_embeddings` table (optional - new embeddings won't conflict)
- [ ] Document current embedding statistics for comparison

## Migration Execution

### Phase 1: Test Migration (Dry Run)

```bash
# Test high-priority receipts
deno run --allow-env --allow-net scripts/migrate-receipt-embeddings.ts \
  --priority high \
  --batch-size 10 \
  --dry-run

# Review output for any issues
```

### Phase 2: High-Priority Migration

```bash
# Migrate recent, valuable receipts first
deno run --allow-env --allow-net scripts/migrate-receipt-embeddings.ts \
  --priority high \
  --batch-size 25 \
  --max-retries 3
```

**Expected Results:**
- Recent receipts with merchant info and substantial totals
- Typically 50-200 receipts depending on data
- High success rate (>90%)

### Phase 3: Medium-Priority Migration

```bash
# Migrate receipts with merchant or substantial amounts
deno run --allow-env --allow-net scripts/migrate-receipt-embeddings.ts \
  --priority medium \
  --batch-size 50 \
  --delay 2000
```

### Phase 4: Complete Migration

```bash
# Migrate all remaining receipts
deno run --allow-env --allow-net scripts/migrate-receipt-embeddings.ts \
  --priority all \
  --batch-size 100 \
  --delay 1000
```

## Monitoring and Validation

### Real-Time Monitoring

```bash
# Monitor migration progress
deno run --allow-env --allow-net scripts/monitor-migration-progress.ts

# Generate one-time report
deno run --allow-env --allow-net scripts/monitor-migration-progress.ts --report
```

### Key Metrics to Monitor

1. **Embedding Coverage**: Target >95%
2. **Quality Score**: Target >70/100
3. **Success Rate**: Target >90%
4. **Synthetic Content Rate**: Expected 80-100% for AI vision receipts

### Validation Queries

```sql
-- Check embedding coverage
SELECT 
  COUNT(DISTINCT r.id) as total_receipts,
  COUNT(DISTINCT ue.source_id) as receipts_with_embeddings,
  ROUND(COUNT(DISTINCT ue.source_id)::numeric / COUNT(DISTINCT r.id) * 100, 2) as coverage_percentage
FROM receipts r
LEFT JOIN unified_embeddings ue ON r.id = ue.source_id AND ue.source_type = 'receipt';

-- Check quality metrics
SELECT 
  AVG(overall_quality_score) as avg_quality,
  COUNT(*) as total_metrics,
  SUM(CASE WHEN synthetic_content_used THEN 1 ELSE 0 END) as synthetic_count
FROM embedding_quality_metrics
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Find receipts still needing migration
SELECT r.id, r.merchant, r.date, r.total
FROM receipts r
LEFT JOIN unified_embeddings ue ON r.id = ue.source_id AND ue.source_type = 'receipt'
WHERE (r.fullText IS NULL OR r.fullText = '') 
  AND ue.source_id IS NULL
LIMIT 10;
```

## Troubleshooting

### Common Issues

#### 1. Low Success Rate (<80%)
**Symptoms**: Many receipts failing to generate embeddings
**Causes**: 
- API rate limiting
- Insufficient receipt data
- Network issues

**Solutions**:
```bash
# Reduce batch size and increase delays
deno run --allow-env --allow-net scripts/migrate-receipt-embeddings.ts \
  --batch-size 10 \
  --delay 5000 \
  --max-retries 5
```

#### 2. Low Quality Scores (<50)
**Symptoms**: Embeddings generated but quality metrics are poor
**Causes**:
- Insufficient structured data in receipts
- Content synthesis issues

**Solutions**:
- Review content synthesis logic
- Check sample receipts for data quality
- Consider manual data cleanup for critical receipts

#### 3. High Failure Rate for Specific Receipts
**Symptoms**: Consistent failures for certain receipt types
**Investigation**:
```sql
-- Analyze failed receipts
SELECT r.merchant, r.date, r.total, r.model_used, COUNT(*)
FROM receipts r
LEFT JOIN unified_embeddings ue ON r.id = ue.source_id
WHERE (r.fullText IS NULL OR r.fullText = '') 
  AND ue.source_id IS NULL
GROUP BY r.merchant, r.date, r.total, r.model_used
ORDER BY COUNT(*) DESC;
```

### Recovery Procedures

#### Restart Failed Migration
```bash
# Force regenerate embeddings for all receipts
deno run --allow-env --allow-net scripts/migrate-receipt-embeddings.ts \
  --force \
  --batch-size 25
```

#### Selective Re-migration
```bash
# Re-migrate only high-priority receipts
deno run --allow-env --allow-net scripts/migrate-receipt-embeddings.ts \
  --priority high \
  --force \
  --batch-size 10
```

## Post-Migration Tasks

### 1. Validation
- [ ] Verify embedding coverage >95%
- [ ] Test search functionality with migrated receipts
- [ ] Compare search quality before/after migration

### 2. Performance Testing
```bash
# Test enhanced content extraction
deno run --allow-env --allow-net scripts/test-enhanced-content-extraction.ts
```

### 3. Monitoring Setup
- [ ] Set up alerts for embedding quality metrics
- [ ] Monitor search performance metrics
- [ ] Track user feedback on search improvements

### 4. Documentation Updates
- [ ] Update API documentation with new embedding types
- [ ] Document quality metrics for future reference
- [ ] Create user-facing documentation about search improvements

## Success Criteria

### Technical Metrics
- ✅ Embedding coverage: >95%
- ✅ Average quality score: >70/100
- ✅ Migration success rate: >90%
- ✅ Search functionality: Fully operational

### Business Metrics
- ✅ Search result relevance: Improved
- ✅ User search satisfaction: Maintained or improved
- ✅ System performance: No degradation

## Rollback Plan

If migration causes issues:

1. **Immediate**: Disable new embedding generation
2. **Short-term**: Revert to basic merchant-only search
3. **Long-term**: Investigate and fix issues, then re-migrate

### Rollback Commands
```sql
-- Disable new embeddings (if needed)
UPDATE receipts SET processing_status = 'paused' 
WHERE processing_status = 'complete';

-- Remove problematic embeddings (if needed)
DELETE FROM unified_embeddings 
WHERE source_type = 'receipt' 
  AND created_at >= 'MIGRATION_START_DATE';
```

## Contact and Support

- **Technical Issues**: Check logs in embedding generation functions
- **Data Issues**: Review quality metrics and validation queries
- **Performance Issues**: Monitor database performance and API limits

## Appendix

### Migration Script Options
```
--batch-size <number>    Number of receipts per batch (default: 25)
--priority <level>       Priority level: high, medium, low, all (default: all)
--dry-run               Preview changes without executing
--max-retries <number>   Maximum retries per receipt (default: 2)
--delay <ms>            Delay between batches in milliseconds (default: 1000)
--force                 Force regenerate existing embeddings
```

### Quality Metrics Explanation
- **Overall Quality Score**: 0-100 based on content quality and success rate
- **Synthetic Content Rate**: Percentage using generated vs original fullText
- **Enhanced Processing Rate**: Percentage using new vs legacy processing
