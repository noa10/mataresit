-- Migration: 20250720000003_batch_upload_optimization.sql
-- Phase 3: Batch Upload Optimization - Database Schema

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

-- Read access for authenticated users, admin access for modifications
CREATE POLICY api_quota_read_access ON public.api_quota_tracking
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY api_quota_admin_write_access ON public.api_quota_tracking
FOR INSERT, UPDATE, DELETE USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_batch_sessions_updated_at BEFORE UPDATE ON public.batch_upload_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batch_files_updated_at BEFORE UPDATE ON public.batch_upload_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_quota_updated_at BEFORE UPDATE ON public.api_quota_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update batch session progress
CREATE OR REPLACE FUNCTION update_batch_session_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the batch session counters when file status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Decrement old status counter
    CASE OLD.status
      WHEN 'pending' THEN
        UPDATE public.batch_upload_sessions 
        SET files_pending = files_pending - 1 
        WHERE id = NEW.batch_session_id;
      WHEN 'completed' THEN
        UPDATE public.batch_upload_sessions 
        SET files_completed = files_completed - 1 
        WHERE id = NEW.batch_session_id;
      WHEN 'failed' THEN
        UPDATE public.batch_upload_sessions 
        SET files_failed = files_failed - 1 
        WHERE id = NEW.batch_session_id;
    END CASE;
    
    -- Increment new status counter
    CASE NEW.status
      WHEN 'pending' THEN
        UPDATE public.batch_upload_sessions 
        SET files_pending = files_pending + 1 
        WHERE id = NEW.batch_session_id;
      WHEN 'completed' THEN
        UPDATE public.batch_upload_sessions 
        SET files_completed = files_completed + 1 
        WHERE id = NEW.batch_session_id;
      WHEN 'failed' THEN
        UPDATE public.batch_upload_sessions 
        SET files_failed = files_failed + 1 
        WHERE id = NEW.batch_session_id;
    END CASE;
  END IF;
  
  -- Update session status based on file completion
  UPDATE public.batch_upload_sessions 
  SET 
    status = CASE 
      WHEN files_completed + files_failed = total_files THEN 'completed'
      WHEN files_failed > 0 AND files_completed + files_failed < total_files THEN 'processing'
      WHEN files_completed > 0 THEN 'processing'
      ELSE status
    END,
    completed_at = CASE 
      WHEN files_completed + files_failed = total_files THEN NOW()
      ELSE completed_at
    END
  WHERE id = NEW.batch_session_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_batch_progress_trigger 
  AFTER UPDATE ON public.batch_upload_files
  FOR EACH ROW EXECUTE FUNCTION update_batch_session_progress();

-- Function to initialize batch session file counters
CREATE OR REPLACE FUNCTION initialize_batch_session_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- Set initial pending count to total files
  NEW.files_pending = NEW.total_files;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER initialize_batch_counters_trigger 
  BEFORE INSERT ON public.batch_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION initialize_batch_session_counters();

-- Comments for documentation
COMMENT ON TABLE public.batch_upload_sessions IS 'Tracks batch upload sessions with progress and performance metrics';
COMMENT ON TABLE public.batch_upload_files IS 'Individual file tracking within batch upload sessions';
COMMENT ON TABLE public.api_quota_tracking IS 'API quota usage tracking for rate limiting';
