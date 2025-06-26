-- External API Infrastructure Migration
-- Creates the foundational database schema for secure external API access

-- Create API key scopes enum
CREATE TYPE public.api_scope AS ENUM (
  'receipts:read',
  'receipts:write', 
  'receipts:delete',
  'claims:read',
  'claims:write',
  'claims:delete',
  'search:read',
  'analytics:read',
  'teams:read',
  'admin:all'
);

-- Create API keys table for external authentication
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for identification (e.g., "mk_live_")
  scopes public.api_scope[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT api_keys_name_length CHECK (char_length(name) >= 3 AND char_length(name) <= 255),
  CONSTRAINT api_keys_valid_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Create API access logs table for audit and security monitoring
CREATE TABLE public.api_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT api_logs_valid_status CHECK (status_code >= 100 AND status_code < 600),
  CONSTRAINT api_logs_valid_response_time CHECK (response_time_ms >= 0)
);

-- Create API rate limits table for subscription-based limiting
CREATE TABLE public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for rate limiting windows
  UNIQUE(user_id, api_key_id, window_start),
  
  -- Constraints
  CONSTRAINT rate_limits_valid_window CHECK (window_end > window_start),
  CONSTRAINT rate_limits_valid_count CHECK (request_count >= 0)
);

-- Enable RLS on all new tables
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for API keys
CREATE POLICY "Users can view their own API keys" 
ON public.api_keys FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" 
ON public.api_keys FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id AND auth.uid() = created_by);

CREATE POLICY "Users can update their own API keys" 
ON public.api_keys FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" 
ON public.api_keys FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Team members can view team API keys
CREATE POLICY "Team members can view team API keys"
ON public.api_keys FOR SELECT
TO authenticated
USING (
  team_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_id = api_keys.team_id 
    AND user_id = auth.uid()
    AND role IN ('admin', 'member')
  )
);

-- Create RLS policies for API access logs
CREATE POLICY "Users can view their own API logs" 
ON public.api_access_logs FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert API logs"
ON public.api_access_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Create RLS policies for rate limits
CREATE POLICY "Users can view their own rate limits" 
ON public.api_rate_limits FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage rate limits"
ON public.api_rate_limits FOR ALL
TO service_role
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_api_keys_user_id ON public.api_keys (user_id);
CREATE INDEX idx_api_keys_team_id ON public.api_keys (team_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys (key_hash);
CREATE INDEX idx_api_keys_active ON public.api_keys (is_active) WHERE is_active = true;
CREATE INDEX idx_api_keys_expires ON public.api_keys (expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_api_logs_api_key_id ON public.api_access_logs (api_key_id);
CREATE INDEX idx_api_logs_user_id ON public.api_access_logs (user_id);
CREATE INDEX idx_api_logs_timestamp ON public.api_access_logs (timestamp);
CREATE INDEX idx_api_logs_endpoint ON public.api_access_logs (endpoint);
CREATE INDEX idx_api_logs_status ON public.api_access_logs (status_code);

CREATE INDEX idx_rate_limits_user_key ON public.api_rate_limits (user_id, api_key_id);
CREATE INDEX idx_rate_limits_window ON public.api_rate_limits (window_start, window_end);

-- Add comments for documentation
COMMENT ON TABLE public.api_keys IS 'Stores API keys for external API access with scoped permissions';
COMMENT ON TABLE public.api_access_logs IS 'Audit log for all external API requests for security monitoring';
COMMENT ON TABLE public.api_rate_limits IS 'Rate limiting tracking per user/API key for subscription enforcement';

COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the API key for secure storage';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8 characters of API key for identification (e.g., mk_live_)';
COMMENT ON COLUMN public.api_keys.scopes IS 'Array of permissions granted to this API key';
COMMENT ON COLUMN public.api_access_logs.response_time_ms IS 'API response time in milliseconds for performance monitoring';

-- Database functions for API operations

-- Function to get API usage statistics
CREATE OR REPLACE FUNCTION get_api_usage_stats(
  _user_id UUID DEFAULT auth.uid(),
  _days INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_requests', COUNT(*),
    'successful_requests', COUNT(*) FILTER (WHERE status_code < 400),
    'error_requests', COUNT(*) FILTER (WHERE status_code >= 400),
    'avg_response_time_ms', ROUND(AVG(response_time_ms), 2),
    'requests_by_day', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', date_trunc('day', timestamp),
          'count', count
        ) ORDER BY date_trunc('day', timestamp)
      )
      FROM (
        SELECT
          date_trunc('day', timestamp) as day,
          COUNT(*) as count
        FROM api_access_logs
        WHERE user_id = _user_id
        AND timestamp >= NOW() - INTERVAL '1 day' * _days
        GROUP BY date_trunc('day', timestamp)
      ) daily_stats
    ),
    'top_endpoints', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'endpoint', endpoint,
          'count', count
        ) ORDER BY count DESC
      )
      FROM (
        SELECT endpoint, COUNT(*) as count
        FROM api_access_logs
        WHERE user_id = _user_id
        AND timestamp >= NOW() - INTERVAL '1 day' * _days
        GROUP BY endpoint
        ORDER BY count DESC
        LIMIT 10
      ) endpoint_stats
    )
  ) INTO result
  FROM api_access_logs
  WHERE user_id = _user_id
  AND timestamp >= NOW() - INTERVAL '1 day' * _days;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check API rate limits
CREATE OR REPLACE FUNCTION check_api_rate_limit(
  _user_id UUID,
  _api_key_id UUID,
  _window_type TEXT DEFAULT 'minute'
) RETURNS JSONB AS $$
DECLARE
  window_start TIMESTAMP WITH TIME ZONE;
  window_end TIMESTAMP WITH TIME ZONE;
  current_count INTEGER;
  tier_limits JSONB;
  max_requests INTEGER;
  result JSONB;
BEGIN
  -- Calculate window boundaries
  CASE _window_type
    WHEN 'minute' THEN
      window_start := date_trunc('minute', NOW());
      window_end := window_start + INTERVAL '1 minute';
    WHEN 'hour' THEN
      window_start := date_trunc('hour', NOW());
      window_end := window_start + INTERVAL '1 hour';
    WHEN 'day' THEN
      window_start := date_trunc('day', NOW());
      window_end := window_start + INTERVAL '1 day';
    ELSE
      RAISE EXCEPTION 'Invalid window type: %', _window_type;
  END CASE;

  -- Get current usage
  SELECT COALESCE(request_count, 0) INTO current_count
  FROM api_rate_limits
  WHERE user_id = _user_id
  AND api_key_id = _api_key_id
  AND window_start = check_api_rate_limit.window_start;

  -- Get user's tier limits
  SELECT
    CASE
      WHEN p.subscription_tier = 'free' THEN
        CASE _window_type
          WHEN 'minute' THEN 15  -- 10 + 5 burst
          WHEN 'hour' THEN 100
          WHEN 'day' THEN 1000
        END
      WHEN p.subscription_tier = 'pro' THEN
        CASE _window_type
          WHEN 'minute' THEN 80  -- 60 + 20 burst
          WHEN 'hour' THEN 1000
          WHEN 'day' THEN 10000
        END
      WHEN p.subscription_tier = 'max' THEN
        CASE _window_type
          WHEN 'minute' THEN 400  -- 300 + 100 burst
          WHEN 'hour' THEN 5000
          WHEN 'day' THEN 50000
        END
      ELSE 15  -- Default to free tier
    END INTO max_requests
  FROM profiles p
  WHERE p.id = _user_id;

  -- Build result
  result := jsonb_build_object(
    'allowed', current_count < max_requests,
    'current_count', current_count,
    'limit', max_requests,
    'remaining', GREATEST(0, max_requests - current_count),
    'window_start', window_start,
    'window_end', window_end,
    'reset_time', window_end
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team analytics summary
CREATE OR REPLACE FUNCTION get_team_analytics(
  _team_id UUID,
  _user_id UUID DEFAULT auth.uid(),
  _start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  _end_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  team_member_role TEXT;
BEGIN
  -- Verify team access
  SELECT role INTO team_member_role
  FROM team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  IF team_member_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Access denied to team');
  END IF;

  SELECT jsonb_build_object(
    'total_receipts', COUNT(r.*),
    'total_amount', COALESCE(SUM(r.total), 0),
    'average_amount', COALESCE(AVG(r.total), 0),
    'currency', COALESCE(MODE() WITHIN GROUP (ORDER BY r.currency), 'USD'),
    'date_range', jsonb_build_object(
      'start', _start_date,
      'end', _end_date
    ),
    'category_breakdown', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'category', COALESCE(predicted_category, 'Uncategorized'),
          'count', count,
          'amount', amount,
          'percentage', ROUND((amount / NULLIF(total_amount, 0)) * 100, 2)
        ) ORDER BY amount DESC
      )
      FROM (
        SELECT
          predicted_category,
          COUNT(*) as count,
          SUM(total) as amount,
          SUM(SUM(total)) OVER () as total_amount
        FROM receipts
        WHERE team_id = _team_id
        AND date BETWEEN _start_date AND _end_date
        GROUP BY predicted_category
      ) category_stats
    ),
    'top_merchants', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'merchant', merchant,
          'count', count,
          'amount', amount
        ) ORDER BY amount DESC
      )
      FROM (
        SELECT
          merchant,
          COUNT(*) as count,
          SUM(total) as amount
        FROM receipts
        WHERE team_id = _team_id
        AND date BETWEEN _start_date AND _end_date
        GROUP BY merchant
        ORDER BY amount DESC
        LIMIT 10
      ) merchant_stats
    ),
    'member_activity', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'full_name', full_name,
          'receipt_count', receipt_count,
          'total_amount', total_amount
        ) ORDER BY receipt_count DESC
      )
      FROM (
        SELECT
          r.user_id,
          p.full_name,
          COUNT(r.*) as receipt_count,
          SUM(r.total) as total_amount
        FROM receipts r
        JOIN profiles p ON p.id = r.user_id
        WHERE r.team_id = _team_id
        AND r.date BETWEEN _start_date AND _end_date
        GROUP BY r.user_id, p.full_name
      ) member_stats
    )
  ) INTO result
  FROM receipts r
  WHERE r.team_id = _team_id
  AND r.date BETWEEN _start_date AND _end_date;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get search suggestions based on user history
CREATE OR REPLACE FUNCTION get_search_suggestions(
  _user_id UUID DEFAULT auth.uid(),
  _query_prefix TEXT DEFAULT '',
  _limit INTEGER DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
  suggestions JSONB;
BEGIN
  -- Get suggestions from recent searches, merchants, and categories
  WITH recent_merchants AS (
    SELECT DISTINCT merchant as suggestion, 'merchant' as type, COUNT(*) as frequency
    FROM receipts
    WHERE user_id = _user_id
    AND merchant ILIKE _query_prefix || '%'
    AND created_at >= NOW() - INTERVAL '90 days'
    GROUP BY merchant
    ORDER BY frequency DESC
    LIMIT 5
  ),
  recent_categories AS (
    SELECT DISTINCT predicted_category as suggestion, 'category' as type, COUNT(*) as frequency
    FROM receipts
    WHERE user_id = _user_id
    AND predicted_category ILIKE _query_prefix || '%'
    AND predicted_category IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'
    GROUP BY predicted_category
    ORDER BY frequency DESC
    LIMIT 3
  ),
  common_terms AS (
    SELECT unnest(ARRAY['receipt', 'expense', 'claim', 'food', 'transport', 'office']) as suggestion,
           'common' as type,
           1 as frequency
    WHERE _query_prefix = '' OR unnest(ARRAY['receipt', 'expense', 'claim', 'food', 'transport', 'office']) ILIKE _query_prefix || '%'
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'text', suggestion,
      'type', type,
      'frequency', frequency
    ) ORDER BY frequency DESC
  ) INTO suggestions
  FROM (
    SELECT * FROM recent_merchants
    UNION ALL
    SELECT * FROM recent_categories
    UNION ALL
    SELECT * FROM common_terms
    LIMIT _limit
  ) all_suggestions;

  RETURN COALESCE(suggestions, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get API performance metrics
CREATE OR REPLACE FUNCTION get_api_performance_metrics(
  _user_id UUID DEFAULT auth.uid(),
  _hours INTEGER DEFAULT 24
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_requests', COUNT(*),
    'avg_response_time_ms', ROUND(AVG(response_time_ms), 2),
    'success_rate', ROUND(
      (COUNT(*) FILTER (WHERE status_code < 400)::FLOAT / COUNT(*)) * 100, 2
    ),
    'requests_by_hour', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'hour', hour,
          'count', count,
          'avg_response_time', avg_response_time
        ) ORDER BY hour
      )
      FROM (
        SELECT
          date_trunc('hour', timestamp) as hour,
          COUNT(*) as count,
          ROUND(AVG(response_time_ms), 2) as avg_response_time
        FROM api_access_logs
        WHERE user_id = _user_id
        AND timestamp >= NOW() - INTERVAL '1 hour' * _hours
        GROUP BY date_trunc('hour', timestamp)
        ORDER BY hour
      ) hourly_stats
    ),
    'top_endpoints', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'endpoint', endpoint,
          'count', count,
          'avg_response_time', avg_response_time
        ) ORDER BY count DESC
      )
      FROM (
        SELECT
          endpoint,
          COUNT(*) as count,
          ROUND(AVG(response_time_ms), 2) as avg_response_time
        FROM api_access_logs
        WHERE user_id = _user_id
        AND timestamp >= NOW() - INTERVAL '1 hour' * _hours
        GROUP BY endpoint
        ORDER BY count DESC
        LIMIT 10
      ) endpoint_stats
    ),
    'error_breakdown', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'status_code', status_code,
          'count', count,
          'percentage', ROUND((count::FLOAT / total_requests) * 100, 2)
        ) ORDER BY count DESC
      )
      FROM (
        SELECT
          status_code,
          COUNT(*) as count,
          SUM(COUNT(*)) OVER () as total_requests
        FROM api_access_logs
        WHERE user_id = _user_id
        AND timestamp >= NOW() - INTERVAL '1 hour' * _hours
        AND status_code >= 400
        GROUP BY status_code
      ) error_stats
    )
  ) INTO result
  FROM api_access_logs
  WHERE user_id = _user_id
  AND timestamp >= NOW() - INTERVAL '1 hour' * _hours;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
