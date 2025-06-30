-- Migration: User Preference Learning System
-- Description: Creates comprehensive user preference tracking and learning infrastructure
-- Phase 5: Personalization & Memory System - Task 1

-- ============================================================================
-- USER PREFERENCES TABLE
-- ============================================================================

-- Core user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_category TEXT NOT NULL CHECK (preference_category IN (
    'communication_style',
    'response_length', 
    'technical_detail_level',
    'ui_layout',
    'feature_usage',
    'search_behavior',
    'content_preferences',
    'interaction_patterns'
  )),
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  learning_source TEXT CHECK (learning_source IN (
    'explicit_setting',
    'behavioral_analysis', 
    'feedback_pattern',
    'usage_frequency',
    'time_analysis',
    'interaction_style'
  )),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one preference per category/key per user
  UNIQUE(user_id, preference_category, preference_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON user_preferences(preference_category);
CREATE INDEX IF NOT EXISTS idx_user_preferences_confidence ON user_preferences(confidence_score);
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated ON user_preferences(last_updated);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences" ON user_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- USER INTERACTION TRACKING TABLE
-- ============================================================================

-- Track detailed user interactions for behavioral analysis
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'chat_message',
    'search_query', 
    'ui_action',
    'feature_usage',
    'feedback_given',
    'preference_change',
    'session_activity',
    'error_encountered'
  )),
  interaction_context JSONB NOT NULL, -- Flexible context data
  interaction_metadata JSONB DEFAULT '{}', -- Additional metadata
  session_id TEXT, -- Group interactions by session
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Performance optimization
  created_date DATE GENERATED ALWAYS AS (DATE(timestamp)) STORED
);

-- Indexes for performance and analytics
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_timestamp ON user_interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session ON user_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_date ON user_interactions(created_date);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_type_date 
  ON user_interactions(user_id, interaction_type, created_date);

-- Enable RLS
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own interactions" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert interactions" ON user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all interactions" ON user_interactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- BEHAVIORAL PATTERNS TABLE
-- ============================================================================

-- Store computed behavioral patterns and insights
CREATE TABLE IF NOT EXISTS user_behavioral_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'communication_style',
    'usage_frequency',
    'feature_preferences', 
    'time_patterns',
    'search_patterns',
    'response_preferences',
    'ui_preferences',
    'error_patterns'
  )),
  pattern_data JSONB NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  sample_size INTEGER DEFAULT 0, -- Number of interactions used to compute pattern
  last_computed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_computation TIMESTAMP WITH TIME ZONE, -- When to recompute
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one pattern per type per user
  UNIQUE(user_id, pattern_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_user_id ON user_behavioral_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_type ON user_behavioral_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_confidence ON user_behavioral_patterns(confidence_score);
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_next_computation ON user_behavioral_patterns(next_computation);

-- Enable RLS
ALTER TABLE user_behavioral_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own patterns" ON user_behavioral_patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage patterns" ON user_behavioral_patterns
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all patterns" ON user_behavioral_patterns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- PREFERENCE LEARNING FUNCTIONS
-- ============================================================================

-- Function to track user interaction
CREATE OR REPLACE FUNCTION track_user_interaction(
  p_interaction_type TEXT,
  p_interaction_context JSONB,
  p_interaction_metadata JSONB DEFAULT '{}',
  p_session_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  interaction_id UUID;
BEGIN
  -- Validate interaction type
  IF p_interaction_type NOT IN (
    'chat_message', 'search_query', 'ui_action', 'feature_usage',
    'feedback_given', 'preference_change', 'session_activity', 'error_encountered'
  ) THEN
    RAISE EXCEPTION 'Invalid interaction type: %', p_interaction_type;
  END IF;

  -- Insert interaction record
  INSERT INTO user_interactions (
    user_id,
    interaction_type,
    interaction_context,
    interaction_metadata,
    session_id
  ) VALUES (
    auth.uid(),
    p_interaction_type,
    p_interaction_context,
    p_interaction_metadata,
    p_session_id
  ) RETURNING id INTO interaction_id;

  -- Trigger pattern analysis for certain interaction types
  IF p_interaction_type IN ('chat_message', 'search_query', 'feedback_given') THEN
    PERFORM analyze_user_patterns_async(auth.uid());
  END IF;

  RETURN interaction_id;
END;
$$;

-- Function to get user preferences
CREATE OR REPLACE FUNCTION get_user_preferences(
  p_category TEXT DEFAULT NULL,
  p_min_confidence NUMERIC DEFAULT 0.3
)
RETURNS TABLE (
  preference_category TEXT,
  preference_key TEXT,
  preference_value JSONB,
  confidence_score NUMERIC,
  learning_source TEXT,
  last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.preference_category,
    up.preference_key,
    up.preference_value,
    up.confidence_score,
    up.learning_source,
    up.last_updated
  FROM user_preferences up
  WHERE
    up.user_id = auth.uid()
    AND (p_category IS NULL OR up.preference_category = p_category)
    AND up.confidence_score >= p_min_confidence
  ORDER BY up.preference_category, up.confidence_score DESC, up.last_updated DESC;
END;
$$;

-- Function to set user preference
CREATE OR REPLACE FUNCTION set_user_preference(
  p_category TEXT,
  p_key TEXT,
  p_value JSONB,
  p_confidence NUMERIC DEFAULT 1.0,
  p_source TEXT DEFAULT 'explicit_setting'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  preference_id UUID;
BEGIN
  -- Validate inputs
  IF p_confidence < 0 OR p_confidence > 1 THEN
    RAISE EXCEPTION 'Confidence score must be between 0 and 1';
  END IF;

  -- Insert or update preference
  INSERT INTO user_preferences (
    user_id,
    preference_category,
    preference_key,
    preference_value,
    confidence_score,
    learning_source
  ) VALUES (
    auth.uid(),
    p_category,
    p_key,
    p_value,
    p_confidence,
    p_source
  )
  ON CONFLICT (user_id, preference_category, preference_key)
  DO UPDATE SET
    preference_value = EXCLUDED.preference_value,
    confidence_score = EXCLUDED.confidence_score,
    learning_source = EXCLUDED.learning_source,
    last_updated = NOW()
  RETURNING id INTO preference_id;

  -- Track the preference change
  PERFORM track_user_interaction(
    'preference_change',
    jsonb_build_object(
      'category', p_category,
      'key', p_key,
      'value', p_value,
      'confidence', p_confidence,
      'source', p_source
    )
  );

  RETURN preference_id;
END;
$$;

-- Function to analyze user patterns (async trigger)
CREATE OR REPLACE FUNCTION analyze_user_patterns_async(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function will be called asynchronously to analyze patterns
  -- For now, it's a placeholder that could trigger background jobs
  -- In a full implementation, this would queue pattern analysis tasks

  -- Update the next computation time for patterns that need refresh
  UPDATE user_behavioral_patterns
  SET next_computation = NOW() + INTERVAL '1 hour'
  WHERE user_id = p_user_id
    AND (next_computation IS NULL OR next_computation <= NOW());

  -- Note: Actual pattern computation will be implemented in subsequent functions
END;
$$;

-- Function to compute communication style patterns
CREATE OR REPLACE FUNCTION compute_communication_style_pattern(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pattern_data JSONB;
  total_messages INTEGER;
  avg_message_length NUMERIC;
  question_ratio NUMERIC;
  technical_term_ratio NUMERIC;
  response_time_preference NUMERIC;
BEGIN
  -- Analyze chat messages for communication patterns
  WITH message_analysis AS (
    SELECT
      COUNT(*) as total_count,
      AVG(LENGTH(interaction_context->>'message')) as avg_length,
      COUNT(*) FILTER (WHERE interaction_context->>'message' LIKE '%?%') as question_count,
      COUNT(*) FILTER (WHERE
        interaction_context->>'message' ~* '(api|database|function|query|technical|code|sql|json)'
      ) as technical_count
    FROM user_interactions
    WHERE user_id = p_user_id
      AND interaction_type = 'chat_message'
      AND timestamp >= NOW() - INTERVAL '30 days'
  )
  SELECT
    ma.total_count,
    ma.avg_length,
    CASE WHEN ma.total_count > 0 THEN ma.question_count::NUMERIC / ma.total_count ELSE 0 END,
    CASE WHEN ma.total_count > 0 THEN ma.technical_count::NUMERIC / ma.total_count ELSE 0 END
  INTO total_messages, avg_message_length, question_ratio, technical_term_ratio
  FROM message_analysis ma;

  -- Determine communication style
  pattern_data := jsonb_build_object(
    'total_messages', COALESCE(total_messages, 0),
    'avg_message_length', COALESCE(avg_message_length, 0),
    'question_ratio', COALESCE(question_ratio, 0),
    'technical_term_ratio', COALESCE(technical_term_ratio, 0),
    'communication_style', CASE
      WHEN technical_term_ratio > 0.3 THEN 'technical'
      WHEN question_ratio > 0.4 THEN 'inquisitive'
      WHEN avg_message_length > 100 THEN 'detailed'
      WHEN avg_message_length < 30 THEN 'concise'
      ELSE 'balanced'
    END,
    'preferred_response_length', CASE
      WHEN avg_message_length > 100 THEN 'detailed'
      WHEN avg_message_length < 30 THEN 'brief'
      ELSE 'moderate'
    END,
    'technical_level', CASE
      WHEN technical_term_ratio > 0.4 THEN 'advanced'
      WHEN technical_term_ratio > 0.2 THEN 'intermediate'
      ELSE 'basic'
    END
  );

  RETURN pattern_data;
END;
$$;

-- Function to compute usage frequency patterns
CREATE OR REPLACE FUNCTION compute_usage_frequency_pattern(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pattern_data JSONB;
  daily_avg NUMERIC;
  peak_hours INTEGER[];
  most_used_features TEXT[];
  session_duration_avg NUMERIC;
BEGIN
  -- Calculate daily usage average
  WITH daily_usage AS (
    SELECT
      created_date,
      COUNT(*) as daily_interactions
    FROM user_interactions
    WHERE user_id = p_user_id
      AND timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY created_date
  )
  SELECT AVG(daily_interactions) INTO daily_avg FROM daily_usage;

  -- Find peak usage hours
  WITH hourly_usage AS (
    SELECT
      EXTRACT(HOUR FROM timestamp) as hour,
      COUNT(*) as hour_count
    FROM user_interactions
    WHERE user_id = p_user_id
      AND timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY EXTRACT(HOUR FROM timestamp)
    ORDER BY hour_count DESC
    LIMIT 3
  )
  SELECT ARRAY_AGG(hour::INTEGER) INTO peak_hours FROM hourly_usage;

  -- Find most used features
  WITH feature_usage AS (
    SELECT
      interaction_type,
      COUNT(*) as usage_count
    FROM user_interactions
    WHERE user_id = p_user_id
      AND timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY interaction_type
    ORDER BY usage_count DESC
    LIMIT 5
  )
  SELECT ARRAY_AGG(interaction_type) INTO most_used_features FROM feature_usage;

  pattern_data := jsonb_build_object(
    'daily_avg_interactions', COALESCE(daily_avg, 0),
    'peak_hours', COALESCE(peak_hours, ARRAY[]::INTEGER[]),
    'most_used_features', COALESCE(most_used_features, ARRAY[]::TEXT[]),
    'usage_intensity', CASE
      WHEN daily_avg > 50 THEN 'high'
      WHEN daily_avg > 20 THEN 'moderate'
      WHEN daily_avg > 5 THEN 'low'
      ELSE 'minimal'
    END
  );

  RETURN pattern_data;
END;
$$;

-- Function to update behavioral patterns
CREATE OR REPLACE FUNCTION update_user_behavioral_patterns(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patterns_updated INTEGER := 0;
  communication_pattern JSONB;
  usage_pattern JSONB;
  sample_count INTEGER;
BEGIN
  -- Get sample size for confidence calculation
  SELECT COUNT(*) INTO sample_count
  FROM user_interactions
  WHERE user_id = p_user_id
    AND timestamp >= NOW() - INTERVAL '30 days';

  -- Only proceed if we have enough data
  IF sample_count < 5 THEN
    RETURN 0;
  END IF;

  -- Compute communication style pattern
  communication_pattern := compute_communication_style_pattern(p_user_id);

  INSERT INTO user_behavioral_patterns (
    user_id, pattern_type, pattern_data, confidence_score, sample_size, next_computation
  ) VALUES (
    p_user_id, 'communication_style', communication_pattern,
    LEAST(1.0, sample_count / 50.0), sample_count, NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id, pattern_type) DO UPDATE SET
    pattern_data = EXCLUDED.pattern_data,
    confidence_score = EXCLUDED.confidence_score,
    sample_size = EXCLUDED.sample_size,
    last_computed = NOW(),
    next_computation = EXCLUDED.next_computation;

  patterns_updated := patterns_updated + 1;

  -- Compute usage frequency pattern
  usage_pattern := compute_usage_frequency_pattern(p_user_id);

  INSERT INTO user_behavioral_patterns (
    user_id, pattern_type, pattern_data, confidence_score, sample_size, next_computation
  ) VALUES (
    p_user_id, 'usage_frequency', usage_pattern,
    LEAST(1.0, sample_count / 30.0), sample_count, NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id, pattern_type) DO UPDATE SET
    pattern_data = EXCLUDED.pattern_data,
    confidence_score = EXCLUDED.confidence_score,
    sample_size = EXCLUDED.sample_size,
    last_computed = NOW(),
    next_computation = EXCLUDED.next_computation;

  patterns_updated := patterns_updated + 1;

  -- Auto-generate preferences based on patterns
  PERFORM generate_preferences_from_patterns(p_user_id);

  RETURN patterns_updated;
END;
$$;

-- Function to generate preferences from behavioral patterns
CREATE OR REPLACE FUNCTION generate_preferences_from_patterns(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  preferences_generated INTEGER := 0;
  comm_pattern JSONB;
  usage_pattern JSONB;
  confidence NUMERIC;
BEGIN
  -- Get communication pattern
  SELECT pattern_data, confidence_score INTO comm_pattern, confidence
  FROM user_behavioral_patterns
  WHERE user_id = p_user_id AND pattern_type = 'communication_style';

  IF comm_pattern IS NOT NULL THEN
    -- Generate communication style preference
    PERFORM set_user_preference(
      'communication_style',
      'preferred_style',
      jsonb_build_object('style', comm_pattern->>'communication_style'),
      confidence * 0.8, -- Slightly lower confidence for derived preferences
      'behavioral_analysis'
    );

    -- Generate response length preference
    PERFORM set_user_preference(
      'response_length',
      'preferred_length',
      jsonb_build_object('length', comm_pattern->>'preferred_response_length'),
      confidence * 0.8,
      'behavioral_analysis'
    );

    -- Generate technical detail level preference
    PERFORM set_user_preference(
      'technical_detail_level',
      'preferred_level',
      jsonb_build_object('level', comm_pattern->>'technical_level'),
      confidence * 0.8,
      'behavioral_analysis'
    );

    preferences_generated := preferences_generated + 3;
  END IF;

  -- Get usage pattern for feature preferences
  SELECT pattern_data, confidence_score INTO usage_pattern, confidence
  FROM user_behavioral_patterns
  WHERE user_id = p_user_id AND pattern_type = 'usage_frequency';

  IF usage_pattern IS NOT NULL THEN
    -- Generate feature usage preferences
    PERFORM set_user_preference(
      'feature_usage',
      'preferred_features',
      jsonb_build_object('features', usage_pattern->'most_used_features'),
      confidence * 0.7,
      'behavioral_analysis'
    );

    preferences_generated := preferences_generated + 1;
  END IF;

  RETURN preferences_generated;
END;
$$;

-- Function to get personalized user profile
CREATE OR REPLACE FUNCTION get_user_personalization_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile JSONB;
  preferences JSONB;
  patterns JSONB;
BEGIN
  -- Get user preferences
  WITH user_prefs AS (
    SELECT
      preference_category,
      jsonb_object_agg(preference_key,
        jsonb_build_object(
          'value', preference_value,
          'confidence', confidence_score,
          'source', learning_source
        )
      ) as category_prefs
    FROM user_preferences
    WHERE user_id = auth.uid()
      AND confidence_score >= 0.3
    GROUP BY preference_category
  )
  SELECT jsonb_object_agg(preference_category, category_prefs) INTO preferences
  FROM user_prefs;

  -- Get behavioral patterns
  WITH user_patterns AS (
    SELECT
      pattern_type,
      jsonb_build_object(
        'data', pattern_data,
        'confidence', confidence_score,
        'last_computed', last_computed,
        'sample_size', sample_size
      ) as pattern_info
    FROM user_behavioral_patterns
    WHERE user_id = auth.uid()
      AND confidence_score >= 0.3
  )
  SELECT jsonb_object_agg(pattern_type, pattern_info) INTO patterns
  FROM user_patterns;

  -- Build complete profile
  profile := jsonb_build_object(
    'user_id', auth.uid(),
    'preferences', COALESCE(preferences, '{}'::jsonb),
    'behavioral_patterns', COALESCE(patterns, '{}'::jsonb),
    'profile_completeness', CASE
      WHEN preferences IS NOT NULL AND patterns IS NOT NULL THEN 'complete'
      WHEN preferences IS NOT NULL OR patterns IS NOT NULL THEN 'partial'
      ELSE 'minimal'
    END,
    'last_updated', NOW()
  );

  RETURN profile;
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION track_user_interaction IS 'Track user interactions for behavioral analysis and preference learning';
COMMENT ON FUNCTION get_user_preferences IS 'Retrieve user preferences with optional filtering by category and confidence';
COMMENT ON FUNCTION set_user_preference IS 'Set or update a user preference with confidence scoring';
COMMENT ON FUNCTION update_user_behavioral_patterns IS 'Compute and update behavioral patterns from user interactions';
COMMENT ON FUNCTION get_user_personalization_profile IS 'Get complete personalization profile including preferences and patterns';
