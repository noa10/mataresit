-- Feature Flag Management System Database Schema
-- Creates tables and functions for comprehensive feature flag management

-- ============================================================================
-- FEATURE FLAGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    target_teams TEXT[] DEFAULT '{}',
    target_users TEXT[] DEFAULT '{}',
    conditions JSONB DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,
    last_modified_by TEXT NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON public.feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_rollout ON public.feature_flags(rollout_percentage);
CREATE INDEX IF NOT EXISTS idx_feature_flags_updated_at ON public.feature_flags(updated_at);
CREATE INDEX IF NOT EXISTS idx_feature_flags_metadata_category ON public.feature_flags USING GIN ((metadata->>'category'));
CREATE INDEX IF NOT EXISTS idx_feature_flags_metadata_priority ON public.feature_flags USING GIN ((metadata->>'priority'));

-- ============================================================================
-- FEATURE FLAG EVALUATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
    user_id UUID,
    team_id UUID,
    enabled BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    context JSONB DEFAULT '{}'
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_flag_id ON public.feature_flag_evaluations(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_user_id ON public.feature_flag_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_team_id ON public.feature_flag_evaluations(team_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_evaluated_at ON public.feature_flag_evaluations(evaluated_at);
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_enabled ON public.feature_flag_evaluations(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flag_evaluations_flag_time ON public.feature_flag_evaluations(flag_id, evaluated_at);

-- ============================================================================
-- FEATURE FLAG AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'enabled', 'disabled', 'rollout_changed')),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changes JSONB DEFAULT '{}',
    reason TEXT,
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_flag_id ON public.feature_flag_audit_log(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_user_id ON public.feature_flag_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_timestamp ON public.feature_flag_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_action ON public.feature_flag_audit_log(action);

-- ============================================================================
-- FEATURE FLAG ENVIRONMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    is_production BOOLEAN NOT NULL DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default environments
INSERT INTO public.feature_flag_environments (name, description, is_production) VALUES
    ('development', 'Development environment', false),
    ('staging', 'Staging environment', false),
    ('production', 'Production environment', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_update_feature_flags_updated_at
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_feature_flag_environments_updated_at
    BEFORE UPDATE ON public.feature_flag_environments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FEATURE FLAG MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to get feature flag usage statistics
CREATE OR REPLACE FUNCTION public.get_feature_flag_usage_stats(
    flag_id UUID,
    start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_evaluations BIGINT,
    enabled_evaluations BIGINT,
    disabled_evaluations BIGINT,
    unique_users BIGINT,
    unique_teams BIGINT,
    error_rate NUMERIC,
    average_evaluation_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_evaluations,
        COUNT(*) FILTER (WHERE enabled = true) as enabled_evaluations,
        COUNT(*) FILTER (WHERE enabled = false) as disabled_evaluations,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT team_id) as unique_teams,
        ROUND(
            (COUNT(*) FILTER (WHERE reason LIKE '%error%' OR reason LIKE '%failed%'))::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100, 2
        ) as error_rate,
        0.0 as average_evaluation_time -- Placeholder for now
    FROM public.feature_flag_evaluations
    WHERE feature_flag_evaluations.flag_id = get_feature_flag_usage_stats.flag_id
    AND evaluated_at BETWEEN start_time AND end_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get hourly evaluation counts
CREATE OR REPLACE FUNCTION public.get_feature_flag_hourly_stats(
    flag_id UUID,
    hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    hour TIMESTAMPTZ,
    evaluation_count BIGINT,
    enabled_count BIGINT,
    disabled_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('hour', evaluated_at) as hour,
        COUNT(*) as evaluation_count,
        COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
        COUNT(*) FILTER (WHERE enabled = false) as disabled_count
    FROM public.feature_flag_evaluations
    WHERE feature_flag_evaluations.flag_id = get_feature_flag_hourly_stats.flag_id
    AND evaluated_at >= NOW() - (hours_back || ' hours')::INTERVAL
    GROUP BY date_trunc('hour', evaluated_at)
    ORDER BY hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top users for a feature flag
CREATE OR REPLACE FUNCTION public.get_feature_flag_top_users(
    flag_id UUID,
    limit_count INTEGER DEFAULT 10,
    hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    user_id UUID,
    evaluation_count BIGINT,
    enabled_count BIGINT,
    last_evaluation TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        feature_flag_evaluations.user_id,
        COUNT(*) as evaluation_count,
        COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
        MAX(evaluated_at) as last_evaluation
    FROM public.feature_flag_evaluations
    WHERE feature_flag_evaluations.flag_id = get_feature_flag_top_users.flag_id
    AND feature_flag_evaluations.user_id IS NOT NULL
    AND evaluated_at >= NOW() - (hours_back || ' hours')::INTERVAL
    GROUP BY feature_flag_evaluations.user_id
    ORDER BY evaluation_count DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old evaluation data
CREATE OR REPLACE FUNCTION public.cleanup_feature_flag_evaluations(
    retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.feature_flag_evaluations
    WHERE evaluated_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup action
    INSERT INTO public.feature_flag_audit_log (
        flag_id, action, user_id, user_name, reason
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::UUID,
        'cleanup',
        'system',
        'System Cleanup',
        'Cleaned up ' || deleted_count || ' evaluation records older than ' || retention_days || ' days'
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on feature flag tables
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_environments ENABLE ROW LEVEL SECURITY;

-- Policies for feature_flags table
CREATE POLICY "Users can view all feature flags" ON public.feature_flags
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage feature flags" ON public.feature_flags
    FOR ALL USING (auth.role() = 'authenticated');

-- Policies for feature_flag_evaluations table
CREATE POLICY "Users can view their own evaluations" ON public.feature_flag_evaluations
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.role() = 'service_role'
    );

CREATE POLICY "System can insert evaluations" ON public.feature_flag_evaluations
    FOR INSERT WITH CHECK (true);

-- Policies for feature_flag_audit_log table
CREATE POLICY "Authenticated users can view audit log" ON public.feature_flag_audit_log
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert audit log entries" ON public.feature_flag_audit_log
    FOR INSERT WITH CHECK (true);

-- Policies for feature_flag_environments table
CREATE POLICY "Users can view environments" ON public.feature_flag_environments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage environments" ON public.feature_flag_environments
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- INITIAL PHASE 5 FEATURE FLAGS
-- ============================================================================

-- Insert Phase 5 feature flags
INSERT INTO public.feature_flags (
    id, name, description, enabled, rollout_percentage, metadata, created_by, last_modified_by
) VALUES 
(
    'embedding-monitoring-001'::UUID,
    'embeddingMonitoring',
    'Enable comprehensive embedding performance monitoring and analytics',
    true,
    10,
    '{
        "category": "monitoring",
        "priority": "high",
        "tags": ["phase5", "monitoring", "analytics", "performance"],
        "rolloutStrategy": "percentage",
        "dependencies": [],
        "conflicts": [],
        "rollbackPlan": "Disable monitoring collection, keep existing data",
        "monitoringMetrics": ["embedding_success_rate", "embedding_latency", "embedding_cost", "error_rate"],
        "estimatedImpact": "low",
        "testingStatus": "tested"
    }'::JSONB,
    'system',
    'system'
),
(
    'queue-processing-001'::UUID,
    'queueBasedProcessing',
    'Enable queue-based embedding processing with worker coordination',
    false,
    0,
    '{
        "category": "processing",
        "priority": "critical",
        "tags": ["phase5", "queue", "processing", "workers", "scalability"],
        "rolloutStrategy": "conditional",
        "dependencies": ["embedding-monitoring-001"],
        "conflicts": [],
        "rollbackPlan": "Fallback to direct processing, drain queue gracefully",
        "monitoringMetrics": ["queue_depth", "processing_rate", "worker_utilization", "queue_latency"],
        "estimatedImpact": "high",
        "testingStatus": "testing"
    }'::JSONB,
    'system',
    'system'
),
(
    'batch-optimization-001'::UUID,
    'batchOptimization',
    'Enable batch upload optimization with rate limiting and quota management',
    false,
    0,
    '{
        "category": "optimization",
        "priority": "medium",
        "tags": ["phase5", "batch", "optimization", "rate-limiting", "quota"],
        "rolloutStrategy": "conditional",
        "dependencies": ["embedding-monitoring-001", "queue-processing-001"],
        "conflicts": [],
        "rollbackPlan": "Disable batch processing, process uploads individually",
        "monitoringMetrics": ["batch_success_rate", "batch_processing_time", "api_quota_usage", "cost_optimization"],
        "estimatedImpact": "medium",
        "testingStatus": "not_tested"
    }'::JSONB,
    'system',
    'system'
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.feature_flags IS 'Feature flag definitions with rollout configuration';
COMMENT ON TABLE public.feature_flag_evaluations IS 'Log of feature flag evaluations for analytics';
COMMENT ON TABLE public.feature_flag_audit_log IS 'Audit trail of feature flag changes';
COMMENT ON TABLE public.feature_flag_environments IS 'Environment definitions for feature flag management';

COMMENT ON COLUMN public.feature_flags.rollout_percentage IS 'Percentage of users/teams that should see this feature (0-100)';
COMMENT ON COLUMN public.feature_flags.target_teams IS 'Specific team IDs that should always see this feature';
COMMENT ON COLUMN public.feature_flags.target_users IS 'Specific user IDs that should always see this feature';
COMMENT ON COLUMN public.feature_flags.conditions IS 'JSON array of conditions for feature flag evaluation';
COMMENT ON COLUMN public.feature_flags.metadata IS 'Additional metadata including category, priority, dependencies, etc.';

COMMENT ON FUNCTION public.get_feature_flag_usage_stats IS 'Get comprehensive usage statistics for a feature flag';
COMMENT ON FUNCTION public.get_feature_flag_hourly_stats IS 'Get hourly evaluation counts for a feature flag';
COMMENT ON FUNCTION public.get_feature_flag_top_users IS 'Get top users by evaluation count for a feature flag';
COMMENT ON FUNCTION public.cleanup_feature_flag_evaluations IS 'Clean up old evaluation data based on retention policy';
