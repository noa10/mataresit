# Phase 3: Batch Upload Optimization

## Technical Specifications & Architecture

### 3.1 Intelligent Rate Limiting System

The current batch upload system processes files in parallel without sophisticated rate limiting. We need to implement intelligent API management to prevent overwhelming the Gemini API while maintaining optimal processing speed.

```typescript
// Rate limiting configuration interface
interface RateLimitConfig {
  maxConcurrentRequests: number
  requestsPerMinute: number
  tokensPerMinute: number
  burstAllowance: number
  backoffMultiplier: number
  maxBackoffMs: number
  adaptiveScaling: boolean
}

// API quota tracking interface
interface APIQuotaTracker {
  currentRequests: number
  requestsInLastMinute: number
  tokensInLastMinute: number
  lastResetTime: number
  consecutiveErrors: number
  currentBackoffMs: number
}
```

### 3.2 Database Schema Enhancements

```sql
-- Migration: 20250717000003_batch_upload_optimization.sql

-- Batch upload session tracking
CREATE TABLE IF NOT EXISTS public.batch_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Session metadata
  session_name TEXT,
  total_files INTEGER NOT NULL,
  files_completed INTEGER DEFAULT 0,
  files_failed INTEGER DEFAULT 0,
  files_pending INTEGER DEFAULT 0,
  
  -- Processing configuration
  max_concurrent INTEGER DEFAULT 2,
  rate_limit_config JSONB DEFAULT '{}',
  processing_strategy TEXT DEFAULT 'adaptive' CHECK (processing_strategy IN ('conservative', 'balanced', 'aggressive', 'adaptive')),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'paused')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  
  -- Performance metrics
  total_processing_time_ms BIGINT DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,
  avg_file_processing_time_ms NUMERIC(10,2),
  
  -- Error tracking
  error_message TEXT,
  last_error_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual file tracking within batch sessions
CREATE TABLE IF NOT EXISTS public.batch_upload_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_session_id UUID REFERENCES public.batch_upload_sessions(id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
  
  -- File metadata
  original_filename TEXT NOT NULL,
  file_size_bytes INTEGER,
  file_type TEXT,
  upload_order INTEGER, -- Order in the batch
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed', 'skipped')),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,
  
  -- API usage tracking
  api_calls_made INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  rate_limited BOOLEAN DEFAULT FALSE,
  retry_count INTEGER DEFAULT 0,
  
  -- Error tracking
  error_type TEXT, -- 'upload_failed', 'processing_failed', 'rate_limited', 'timeout'
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API quota tracking table
CREATE TABLE IF NOT EXISTS public.api_quota_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_provider TEXT NOT NULL, -- 'gemini', 'openai', etc.
  quota_type TEXT NOT NULL, -- 'requests', 'tokens'
  time_window TIMESTAMPTZ NOT NULL, -- Truncated to minute
  
  -- Usage metrics
  quota_used INTEGER DEFAULT 0,
  quota_limit INTEGER NOT NULL,
  quota_remaining INTEGER GENERATED ALWAYS AS (quota_limit - quota_used) STORED,
  
  -- Rate limiting status
  is_rate_limited BOOLEAN DEFAULT FALSE,
  rate_limit_reset_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(api_provider, quota_type, time_window)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_sessions_user_status ON public.batch_upload_sessions(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_team_status ON public.batch_upload_sessions(team_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_batch_files_session_status ON public.batch_upload_files(batch_session_id, status, upload_order);
CREATE INDEX IF NOT EXISTS idx_batch_files_receipt ON public.batch_upload_files(receipt_id);
CREATE INDEX IF NOT EXISTS idx_api_quota_provider_window ON public.api_quota_tracking(api_provider, quota_type, time_window);

-- Enable RLS
ALTER TABLE public.batch_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_upload_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_quota_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY batch_sessions_team_access ON public.batch_upload_sessions
FOR ALL USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY batch_files_team_access ON public.batch_upload_files
FOR ALL USING (
  batch_session_id IN (
    SELECT id FROM public.batch_upload_sessions
    WHERE team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Admin-only access for API quota tracking
CREATE POLICY api_quota_admin_access ON public.api_quota_tracking
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);
```

### 3.3 Adaptive Rate Limiting Algorithm

```typescript
class AdaptiveRateLimiter {
  private config: RateLimitConfig
  private quotaTracker: APIQuotaTracker
  private requestQueue: Array<{ timestamp: number; tokens: number }>
  private lastApiCall: number = 0

  constructor(config: RateLimitConfig) {
    this.config = config
    this.quotaTracker = {
      currentRequests: 0,
      requestsInLastMinute: 0,
      tokensInLastMinute: 0,
      lastResetTime: Date.now(),
      consecutiveErrors: 0,
      currentBackoffMs: 0
    }
    this.requestQueue = []
  }

  async acquirePermission(estimatedTokens: number = 1000): Promise<{ allowed: boolean; delayMs: number }> {
    const now = Date.now()
    
    // Clean old requests from tracking
    this.cleanOldRequests(now)
    
    // Check if we're in backoff period
    if (this.quotaTracker.currentBackoffMs > 0) {
      const backoffRemaining = this.quotaTracker.currentBackoffMs - (now - this.lastApiCall)
      if (backoffRemaining > 0) {
        return { allowed: false, delayMs: backoffRemaining }
      } else {
        this.quotaTracker.currentBackoffMs = 0
      }
    }

    // Check concurrent request limit
    if (this.quotaTracker.currentRequests >= this.config.maxConcurrentRequests) {
      return { allowed: false, delayMs: 1000 }
    }

    // Check rate limits
    const requestsCheck = this.quotaTracker.requestsInLastMinute < this.config.requestsPerMinute
    const tokensCheck = this.quotaTracker.tokensInLastMinute + estimatedTokens <= this.config.tokensPerMinute
    
    if (!requestsCheck || !tokensCheck) {
      // Calculate delay until next minute window
      const nextWindowMs = 60000 - (now % 60000)
      return { allowed: false, delayMs: nextWindowMs }
    }

    // Check burst allowance
    const timeSinceLastCall = now - this.lastApiCall
    const minInterval = 60000 / this.config.requestsPerMinute
    
    if (timeSinceLastCall < minInterval && this.quotaTracker.requestsInLastMinute > this.config.burstAllowance) {
      const requiredDelay = minInterval - timeSinceLastCall
      return { allowed: false, delayMs: requiredDelay }
    }

    // Permission granted
    this.recordRequest(now, estimatedTokens)
    return { allowed: true, delayMs: 0 }
  }

  recordSuccess(actualTokens: number) {
    this.quotaTracker.currentRequests--
    this.quotaTracker.consecutiveErrors = 0
    this.lastApiCall = Date.now()
    
    // Update token usage if different from estimate
    const lastRequest = this.requestQueue[this.requestQueue.length - 1]
    if (lastRequest && actualTokens !== lastRequest.tokens) {
      this.quotaTracker.tokensInLastMinute += (actualTokens - lastRequest.tokens)
      lastRequest.tokens = actualTokens
    }
  }

  recordError(errorType: 'rate_limit' | 'timeout' | 'server_error') {
    this.quotaTracker.currentRequests--
    this.quotaTracker.consecutiveErrors++
    this.lastApiCall = Date.now()

    if (errorType === 'rate_limit') {
      // Exponential backoff for rate limiting
      this.quotaTracker.currentBackoffMs = Math.min(
        1000 * Math.pow(this.config.backoffMultiplier, this.quotaTracker.consecutiveErrors),
        this.config.maxBackoffMs
      )
    }
  }

  private recordRequest(timestamp: number, tokens: number) {
    this.quotaTracker.currentRequests++
    this.quotaTracker.requestsInLastMinute++
    this.quotaTracker.tokensInLastMinute += tokens
    this.requestQueue.push({ timestamp, tokens })
  }

  private cleanOldRequests(now: number) {
    const oneMinuteAgo = now - 60000
    
    // Remove requests older than 1 minute
    while (this.requestQueue.length > 0 && this.requestQueue[0].timestamp < oneMinuteAgo) {
      const oldRequest = this.requestQueue.shift()!
      this.quotaTracker.requestsInLastMinute--
      this.quotaTracker.tokensInLastMinute -= oldRequest.tokens
    }

    // Reset counters if needed
    if (now - this.quotaTracker.lastResetTime > 60000) {
      this.quotaTracker.requestsInLastMinute = this.requestQueue.length
      this.quotaTracker.tokensInLastMinute = this.requestQueue.reduce((sum, req) => sum + req.tokens, 0)
      this.quotaTracker.lastResetTime = now
    }
  }

  getStatus(): APIQuotaTracker {
    return { ...this.quotaTracker }
  }
}
```

## Implementation Steps

### Priority 1: Rate Limiting Infrastructure (Week 1)

1. **Database Schema Deployment**
   - Deploy batch tracking tables
   - Create API quota tracking system
   - Set up monitoring indexes

2. **Rate Limiter Implementation**
   - Create adaptive rate limiting class
   - Implement quota tracking mechanisms
   - Add configuration management

3. **Batch Session Management**
   - Create batch session tracking
   - Implement progress monitoring
   - Add pause/resume functionality

### Priority 2: Batch Upload Enhancement (Week 2)

1. **Enhanced Batch Processing**
   - Modify `useBatchFileUpload` hook
   - Implement intelligent concurrency control
   - Add adaptive processing strategies

2. **API Integration**
   - Integrate rate limiter with embedding generation
   - Add quota monitoring to Edge Functions
   - Implement backoff and retry logic

3. **Progress Tracking**
   - Real-time batch progress updates
   - ETA calculations
   - Performance metrics collection

### Priority 3: User Experience Optimization (Week 3)

1. **Batch Upload UI Enhancements**
   - Advanced progress indicators
   - Processing strategy selection
   - Pause/resume controls

2. **Performance Monitoring**
   - Real-time rate limit status
   - API quota usage displays
   - Processing efficiency metrics

## Code Changes Required

### 1. Enhanced Batch Upload Hook

File: `src/hooks/useBatchFileUpload.ts` (major modifications)
```typescript
// Add rate limiting integration
import { AdaptiveRateLimiter } from '@/lib/rate-limiting'

interface BatchUploadConfig {
  maxConcurrent: number
  processingStrategy: 'conservative' | 'balanced' | 'aggressive' | 'adaptive'
  rateLimitConfig: RateLimitConfig
}

export function useBatchFileUpload(config: BatchUploadConfig) {
  const [rateLimiter] = useState(() => new AdaptiveRateLimiter(config.rateLimitConfig))
  const [batchSession, setBatchSession] = useState<BatchSession | null>(null)
  
  // Enhanced processing function with rate limiting
  const processFile = useCallback(async (upload: UploadItem) => {
    // Check rate limit before processing
    const permission = await rateLimiter.acquirePermission(upload.estimatedTokens)
    
    if (!permission.allowed) {
      // Schedule retry after delay
      setTimeout(() => processFile(upload), permission.delayMs)
      return
    }

    try {
      // Existing processing logic with rate limit tracking
      const result = await processReceiptWithAI(upload.receiptId, {
        modelId: settings.selectedModel,
        uploadContext: 'batch',
        batchSessionId: batchSession?.id
      })
      
      rateLimiter.recordSuccess(result.tokensUsed)
      
      // Update batch session progress
      await updateBatchProgress(upload.id, 'completed', result.tokensUsed)
      
    } catch (error) {
      const errorType = classifyError(error)
      rateLimiter.recordError(errorType)
      
      // Update batch session with error
      await updateBatchProgress(upload.id, 'failed', 0, error.message)
      
      // Retry logic based on error type
      if (errorType === 'rate_limit' && upload.retryCount < 3) {
        setTimeout(() => processFile(upload), rateLimiter.getStatus().currentBackoffMs)
      }
    }
  }, [rateLimiter, batchSession, settings])

  // Create batch session
  const createBatchSession = useCallback(async (files: File[]) => {
    const session = await supabase
      .from('batch_upload_sessions')
      .insert({
        user_id: user.id,
        team_id: currentTeam?.id,
        total_files: files.length,
        processing_strategy: config.processingStrategy,
        rate_limit_config: config.rateLimitConfig
      })
      .select()
      .single()
    
    setBatchSession(session.data)
    return session.data
  }, [user, currentTeam, config])

  return {
    // Existing returns plus new functionality
    rateLimiter,
    batchSession,
    createBatchSession,
    // ... other existing returns
  }
}
```

### 2. Enhanced Generate Embeddings Function

File: `supabase/functions/generate-embeddings/index.ts` (modifications)
```typescript
// Add rate limiting integration
async function generateEmbeddingWithRateLimit(
  text: string, 
  rateLimiter: AdaptiveRateLimiter,
  retryCount = 0
): Promise<number[]> {
  // Check rate limit before API call
  const permission = await rateLimiter.acquirePermission(text.length / 4) // Rough token estimate
  
  if (!permission.allowed) {
    // Wait for permission
    await new Promise(resolve => setTimeout(resolve, permission.delayMs))
    return generateEmbeddingWithRateLimit(text, rateLimiter, retryCount)
  }

  try {
    const embedding = await generateEmbedding(text)
    rateLimiter.recordSuccess(text.length / 4) // Update with actual usage
    return embedding
  } catch (error) {
    if (error.message.includes('rate limit') || error.message.includes('quota')) {
      rateLimiter.recordError('rate_limit')
      
      if (retryCount < 3) {
        const backoffMs = rateLimiter.getStatus().currentBackoffMs
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        return generateEmbeddingWithRateLimit(text, rateLimiter, retryCount + 1)
      }
    } else {
      rateLimiter.recordError('server_error')
    }
    throw error
  }
}
```

### 3. Batch Upload UI Enhancements

File: `src/components/BatchUploadZone.tsx` (enhancements)
```typescript
// Add processing strategy selector
const ProcessingStrategySelector = () => (
  <div className="mb-4">
    <label className="block text-sm font-medium mb-2">Processing Strategy</label>
    <select 
      value={processingStrategy} 
      onChange={(e) => setProcessingStrategy(e.target.value)}
      className="w-full p-2 border rounded"
    >
      <option value="conservative">Conservative (Slower, More Reliable)</option>
      <option value="balanced">Balanced (Recommended)</option>
      <option value="aggressive">Aggressive (Faster, Higher Risk)</option>
      <option value="adaptive">Adaptive (AI-Optimized)</option>
    </select>
  </div>
)

// Enhanced progress display with rate limiting info
const EnhancedProgressDisplay = () => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <span>Overall Progress</span>
      <span>{Math.round(totalProgress)}%</span>
    </div>
    
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${totalProgress}%` }}
      />
    </div>
    
    {/* Rate limiting status */}
    <div className="text-sm text-gray-600">
      <div>API Quota: {quotaStatus.requestsInLastMinute}/{quotaStatus.requestsPerMinute} requests/min</div>
      <div>Tokens Used: {quotaStatus.tokensInLastMinute}/{quotaStatus.tokensPerMinute} tokens/min</div>
      {quotaStatus.currentBackoffMs > 0 && (
        <div className="text-orange-600">
          Rate limited - resuming in {Math.ceil(quotaStatus.currentBackoffMs / 1000)}s
        </div>
      )}
    </div>
    
    {/* ETA calculation */}
    {estimatedCompletion && (
      <div className="text-sm text-gray-600">
        Estimated completion: {estimatedCompletion.toLocaleTimeString()}
      </div>
    )}
  </div>
)
```

## Testing Strategy

### Unit Tests
- Rate limiting algorithm validation
- Quota tracking accuracy
- Backoff calculation correctness
- Error classification logic

### Integration Tests
- Batch upload with rate limiting
- API quota enforcement
- Progress tracking accuracy
- Error recovery mechanisms

### Load Tests
- High-volume batch uploads
- Rate limit compliance under load
- Performance with different strategies
- Concurrent batch processing

### User Experience Tests
- Progress indicator accuracy
- Pause/resume functionality
- Error message clarity
- Processing strategy effectiveness

## Performance Impact Analysis

### Expected Improvements
- **API Reliability**: 95%+ success rate for batch uploads
- **Cost Optimization**: 20-30% reduction in API costs through intelligent batching
- **User Experience**: Real-time progress with accurate ETAs
- **System Stability**: Elimination of API quota exhaustion

### Resource Requirements
- **Database**: Additional 15-20% storage for batch tracking
- **Memory**: Rate limiter state management (~1MB per active batch)
- **CPU**: Minimal overhead for rate limiting calculations

## Rollback Plan

1. **Feature Flags**: Disable rate limiting and revert to simple batching
2. **Database Rollback**: Drop new tables if necessary
3. **UI Rollback**: Revert to basic progress indicators
4. **Configuration Reset**: Restore original batch processing settings

## Timeline Estimate

- **Week 1**: Rate limiting infrastructure and database schema
- **Week 2**: Batch processing enhancements and API integration
- **Week 3**: UI improvements and user experience optimization

**Total Duration**: 3 weeks
**Team Size**: 2-3 developers
**Dependencies**: Database migration capabilities, UI/UX design resources
