-- Migration: Conversation Memory & Context Retention System
-- Description: Extends conversation system with advanced memory, context retention, and summarization
-- Phase 5: Personalization & Memory System - Task 2

-- ============================================================================
-- CONVERSATION MESSAGES TABLE
-- ============================================================================

-- Store individual messages with full context
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL, -- Client-side message ID for deduplication
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'ai', 'system')),
  content TEXT NOT NULL,
  content_tokens INTEGER, -- Token count for context window management
  metadata JSONB DEFAULT '{}', -- Search results, UI components, etc.
  parent_message_id TEXT, -- For threading and conversation flow
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Performance optimization
  created_date DATE GENERATED ALWAYS AS (DATE(timestamp)) STORED,
  
  -- Ensure unique message IDs per conversation
  UNIQUE(conversation_id, message_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user_id ON conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON conversation_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_type ON conversation_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_parent ON conversation_messages(parent_message_id);

-- Enable RLS
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own conversation messages" ON conversation_messages
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversation messages" ON conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- CONVERSATION CONTEXT TABLE
-- ============================================================================

-- Store conversation context and memory
CREATE TABLE IF NOT EXISTS conversation_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN (
    'summary',
    'key_topics',
    'user_intent',
    'conversation_flow',
    'important_facts',
    'preferences_mentioned',
    'action_items',
    'context_window'
  )),
  context_data JSONB NOT NULL,
  context_tokens INTEGER DEFAULT 0, -- Token count for this context
  relevance_score NUMERIC(3,2) DEFAULT 1.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- For temporary context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one context per type per conversation
  UNIQUE(conversation_id, context_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_context_conversation_id ON conversation_context(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_user_id ON conversation_context(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_type ON conversation_context(context_type);
CREATE INDEX IF NOT EXISTS idx_conversation_context_relevance ON conversation_context(relevance_score);
CREATE INDEX IF NOT EXISTS idx_conversation_context_expires ON conversation_context(expires_at);

-- Enable RLS
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own conversation context" ON conversation_context
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversation context" ON conversation_context
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- CONVERSATION MEMORY TABLE
-- ============================================================================

-- Store long-term conversation memory across sessions
CREATE TABLE IF NOT EXISTS conversation_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'user_profile',
    'preferences',
    'recurring_topics',
    'relationship_context',
    'historical_patterns',
    'important_events',
    'learning_progress',
    'conversation_style'
  )),
  memory_key TEXT NOT NULL, -- Specific identifier for this memory
  memory_data JSONB NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_conversations TEXT[], -- Array of conversation IDs that contributed to this memory
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique memory keys per type per user
  UNIQUE(user_id, memory_type, memory_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_memory_user_id ON conversation_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_type ON conversation_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_confidence ON conversation_memory(confidence_score);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_accessed ON conversation_memory(last_accessed);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_updated ON conversation_memory(updated_at);

-- Enable RLS
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own conversation memory" ON conversation_memory
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversation memory" ON conversation_memory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- CONVERSATION EMBEDDINGS TABLE
-- ============================================================================

-- Store conversation embeddings for semantic search and context retrieval
CREATE TABLE IF NOT EXISTS conversation_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding_type TEXT NOT NULL CHECK (embedding_type IN (
    'conversation_summary',
    'key_topics',
    'user_intent',
    'message_cluster'
  )),
  content_text TEXT NOT NULL, -- The text that was embedded
  embedding vector(1536), -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique embeddings per type per conversation
  UNIQUE(conversation_id, embedding_type)
);

-- Indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_conversation_id ON conversation_embeddings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_user_id ON conversation_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_type ON conversation_embeddings(embedding_type);

-- Vector similarity index (requires pgvector extension)
CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_vector 
  ON conversation_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE conversation_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own conversation embeddings" ON conversation_embeddings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversation embeddings" ON conversation_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- CONVERSATION MEMORY FUNCTIONS
-- ============================================================================

-- Function to save conversation message
CREATE OR REPLACE FUNCTION save_conversation_message(
  p_conversation_id TEXT,
  p_message_id TEXT,
  p_message_type TEXT,
  p_content TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_parent_message_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_uuid UUID;
  token_count INTEGER;
BEGIN
  -- Estimate token count (rough approximation: 1 token ≈ 4 characters)
  token_count := LENGTH(p_content) / 4;

  -- Insert or update message
  INSERT INTO conversation_messages (
    conversation_id,
    user_id,
    message_id,
    message_type,
    content,
    content_tokens,
    metadata,
    parent_message_id
  ) VALUES (
    p_conversation_id,
    auth.uid(),
    p_message_id,
    p_message_type,
    p_content,
    token_count,
    p_metadata,
    p_parent_message_id
  )
  ON CONFLICT (conversation_id, message_id) DO UPDATE SET
    content = EXCLUDED.content,
    content_tokens = EXCLUDED.content_tokens,
    metadata = EXCLUDED.metadata,
    parent_message_id = EXCLUDED.parent_message_id,
    timestamp = NOW()
  RETURNING id INTO message_uuid;

  -- Update conversation message count
  UPDATE conversations
  SET
    message_count = (
      SELECT COUNT(*)
      FROM conversation_messages
      WHERE conversation_id = p_conversation_id
    ),
    last_message_at = NOW(),
    updated_at = NOW()
  WHERE id = p_conversation_id AND user_id = auth.uid();

  RETURN message_uuid;
END;
$$;

-- Function to get conversation messages with pagination
CREATE OR REPLACE FUNCTION get_conversation_messages(
  p_conversation_id TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_include_metadata BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id UUID,
  message_id TEXT,
  message_type TEXT,
  content TEXT,
  content_tokens INTEGER,
  metadata JSONB,
  parent_message_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.message_id,
    cm.message_type,
    cm.content,
    cm.content_tokens,
    CASE WHEN p_include_metadata THEN cm.metadata ELSE '{}'::jsonb END,
    cm.parent_message_id,
    cm.timestamp
  FROM conversation_messages cm
  WHERE cm.conversation_id = p_conversation_id
    AND cm.user_id = auth.uid()
  ORDER BY cm.timestamp ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to save conversation context
CREATE OR REPLACE FUNCTION save_conversation_context(
  p_conversation_id TEXT,
  p_context_type TEXT,
  p_context_data JSONB,
  p_relevance_score NUMERIC DEFAULT 1.0,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  context_uuid UUID;
  token_count INTEGER;
BEGIN
  -- Estimate token count for context data
  token_count := LENGTH(p_context_data::text) / 4;

  -- Insert or update context
  INSERT INTO conversation_context (
    conversation_id,
    user_id,
    context_type,
    context_data,
    context_tokens,
    relevance_score,
    expires_at
  ) VALUES (
    p_conversation_id,
    auth.uid(),
    p_context_type,
    p_context_data,
    token_count,
    p_relevance_score,
    p_expires_at
  )
  ON CONFLICT (conversation_id, context_type) DO UPDATE SET
    context_data = EXCLUDED.context_data,
    context_tokens = EXCLUDED.context_tokens,
    relevance_score = EXCLUDED.relevance_score,
    expires_at = EXCLUDED.expires_at,
    last_updated = NOW()
  RETURNING id INTO context_uuid;

  RETURN context_uuid;
END;
$$;

-- Function to get conversation context
CREATE OR REPLACE FUNCTION get_conversation_context(
  p_conversation_id TEXT,
  p_context_type TEXT DEFAULT NULL,
  p_min_relevance NUMERIC DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  context_type TEXT,
  context_data JSONB,
  context_tokens INTEGER,
  relevance_score NUMERIC,
  last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.context_type,
    cc.context_data,
    cc.context_tokens,
    cc.relevance_score,
    cc.last_updated
  FROM conversation_context cc
  WHERE cc.conversation_id = p_conversation_id
    AND cc.user_id = auth.uid()
    AND (p_context_type IS NULL OR cc.context_type = p_context_type)
    AND cc.relevance_score >= p_min_relevance
    AND (cc.expires_at IS NULL OR cc.expires_at > NOW())
  ORDER BY cc.relevance_score DESC, cc.last_updated DESC;
END;
$$;

-- Function to save conversation memory
CREATE OR REPLACE FUNCTION save_conversation_memory(
  p_memory_type TEXT,
  p_memory_key TEXT,
  p_memory_data JSONB,
  p_confidence_score NUMERIC DEFAULT 0.5,
  p_source_conversation_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  memory_uuid UUID;
  current_sources TEXT[];
BEGIN
  -- Get existing source conversations if updating
  SELECT source_conversations INTO current_sources
  FROM conversation_memory
  WHERE user_id = auth.uid()
    AND memory_type = p_memory_type
    AND memory_key = p_memory_key;

  -- Add new source conversation to array if provided
  IF p_source_conversation_id IS NOT NULL THEN
    current_sources := COALESCE(current_sources, ARRAY[]::TEXT[]);
    IF NOT (p_source_conversation_id = ANY(current_sources)) THEN
      current_sources := array_append(current_sources, p_source_conversation_id);
    END IF;
  END IF;

  -- Insert or update memory
  INSERT INTO conversation_memory (
    user_id,
    memory_type,
    memory_key,
    memory_data,
    confidence_score,
    source_conversations,
    access_count
  ) VALUES (
    auth.uid(),
    p_memory_type,
    p_memory_key,
    p_memory_data,
    p_confidence_score,
    current_sources,
    1
  )
  ON CONFLICT (user_id, memory_type, memory_key) DO UPDATE SET
    memory_data = EXCLUDED.memory_data,
    confidence_score = GREATEST(conversation_memory.confidence_score, EXCLUDED.confidence_score),
    source_conversations = EXCLUDED.source_conversations,
    updated_at = NOW(),
    access_count = conversation_memory.access_count + 1
  RETURNING id INTO memory_uuid;

  RETURN memory_uuid;
END;
$$;

-- Function to get conversation memory
CREATE OR REPLACE FUNCTION get_conversation_memory(
  p_memory_type TEXT DEFAULT NULL,
  p_memory_key TEXT DEFAULT NULL,
  p_min_confidence NUMERIC DEFAULT 0.3,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  memory_key TEXT,
  memory_data JSONB,
  confidence_score NUMERIC,
  source_conversations TEXT[],
  last_accessed TIMESTAMP WITH TIME ZONE,
  access_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update last_accessed for retrieved memories
  UPDATE conversation_memory
  SET last_accessed = NOW()
  WHERE user_id = auth.uid()
    AND (p_memory_type IS NULL OR memory_type = p_memory_type)
    AND (p_memory_key IS NULL OR memory_key = p_memory_key)
    AND confidence_score >= p_min_confidence;

  RETURN QUERY
  SELECT
    cm.id,
    cm.memory_type,
    cm.memory_key,
    cm.memory_data,
    cm.confidence_score,
    cm.source_conversations,
    cm.last_accessed,
    cm.access_count,
    cm.created_at
  FROM conversation_memory cm
  WHERE cm.user_id = auth.uid()
    AND (p_memory_type IS NULL OR cm.memory_type = p_memory_type)
    AND (p_memory_key IS NULL OR cm.memory_key = p_memory_key)
    AND cm.confidence_score >= p_min_confidence
  ORDER BY cm.confidence_score DESC, cm.last_accessed DESC
  LIMIT p_limit;
END;
$$;

-- Function to compress conversation context (summarization)
CREATE OR REPLACE FUNCTION compress_conversation_context(
  p_conversation_id TEXT,
  p_max_tokens INTEGER DEFAULT 2000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_tokens INTEGER := 0;
  compressed_context JSONB := '{}';
  message_summary TEXT;
  key_topics TEXT[];
  user_intents TEXT[];
  important_facts TEXT[];
BEGIN
  -- Calculate total tokens in conversation
  SELECT COALESCE(SUM(content_tokens), 0) INTO total_tokens
  FROM conversation_messages
  WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

  -- If under token limit, return basic summary
  IF total_tokens <= p_max_tokens THEN
    SELECT jsonb_build_object(
      'needs_compression', false,
      'total_tokens', total_tokens,
      'message_count', COUNT(*),
      'last_updated', NOW()
    ) INTO compressed_context
    FROM conversation_messages
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

    RETURN compressed_context;
  END IF;

  -- Create compressed summary for conversations over token limit
  -- Extract key information from messages
  WITH message_analysis AS (
    SELECT
      string_agg(
        CASE
          WHEN message_type = 'user' THEN 'User: ' || LEFT(content, 100)
          WHEN message_type = 'ai' THEN 'AI: ' || LEFT(content, 100)
          ELSE content
        END,
        E'\n'
        ORDER BY timestamp
      ) as conversation_flow,
      array_agg(DISTINCT
        CASE WHEN message_type = 'user' AND content LIKE '%?%'
        THEN LEFT(content, 50) END
      ) FILTER (WHERE message_type = 'user' AND content LIKE '%?%') as questions_asked
    FROM conversation_messages
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND timestamp >= NOW() - INTERVAL '24 hours' -- Focus on recent messages
  )
  SELECT
    LEFT(conversation_flow, 500) as summary,
    questions_asked
  INTO message_summary, user_intents
  FROM message_analysis;

  -- Build compressed context
  compressed_context := jsonb_build_object(
    'needs_compression', true,
    'original_tokens', total_tokens,
    'compressed_tokens', LENGTH(message_summary) / 4,
    'compression_ratio', ROUND((LENGTH(message_summary)::NUMERIC / 4) / total_tokens::NUMERIC, 2),
    'summary', message_summary,
    'user_intents', COALESCE(user_intents, ARRAY[]::TEXT[]),
    'key_topics', COALESCE(key_topics, ARRAY[]::TEXT[]),
    'important_facts', COALESCE(important_facts, ARRAY[]::TEXT[]),
    'compressed_at', NOW(),
    'conversation_id', p_conversation_id
  );

  -- Save compressed context
  PERFORM save_conversation_context(
    p_conversation_id,
    'context_window',
    compressed_context,
    0.8
  );

  RETURN compressed_context;
END;
$$;

-- Function to get conversation context window
CREATE OR REPLACE FUNCTION get_conversation_context_window(
  p_conversation_id TEXT,
  p_max_tokens INTEGER DEFAULT 4000,
  p_include_memory BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  context_window JSONB;
  recent_messages JSONB;
  conversation_context JSONB;
  user_memory JSONB;
  total_tokens INTEGER := 0;
BEGIN
  -- Get recent messages within token limit
  WITH recent_msgs AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'id', message_id,
          'type', message_type,
          'content', content,
          'timestamp', timestamp,
          'tokens', content_tokens
        ) ORDER BY timestamp DESC
      ) as messages,
      SUM(content_tokens) as msg_tokens
    FROM (
      SELECT *
      FROM conversation_messages
      WHERE conversation_id = p_conversation_id
        AND user_id = auth.uid()
      ORDER BY timestamp DESC
      LIMIT 20 -- Limit to recent messages
    ) sub
  )
  SELECT messages, msg_tokens INTO recent_messages, total_tokens
  FROM recent_msgs;

  -- Get conversation context
  WITH context_data AS (
    SELECT jsonb_object_agg(context_type, context_data) as contexts
    FROM conversation_context
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND (expires_at IS NULL OR expires_at > NOW())
      AND relevance_score >= 0.5
  )
  SELECT contexts INTO conversation_context FROM context_data;

  -- Get relevant user memory if requested
  IF p_include_memory THEN
    WITH memory_data AS (
      SELECT jsonb_object_agg(
        memory_type || '_' || memory_key,
        jsonb_build_object(
          'data', memory_data,
          'confidence', confidence_score,
          'last_accessed', last_accessed
        )
      ) as memories
      FROM conversation_memory
      WHERE user_id = auth.uid()
        AND confidence_score >= 0.6
        AND last_accessed >= NOW() - INTERVAL '30 days'
      ORDER BY confidence_score DESC, last_accessed DESC
      LIMIT 10
    )
    SELECT memories INTO user_memory FROM memory_data;
  END IF;

  -- Build context window
  context_window := jsonb_build_object(
    'conversation_id', p_conversation_id,
    'messages', COALESCE(recent_messages, '[]'::jsonb),
    'context', COALESCE(conversation_context, '{}'::jsonb),
    'memory', COALESCE(user_memory, '{}'::jsonb),
    'total_tokens', total_tokens,
    'max_tokens', p_max_tokens,
    'generated_at', NOW()
  );

  RETURN context_window;
END;
$$;

-- Function to search conversation memory
CREATE OR REPLACE FUNCTION search_conversation_memory(
  p_query TEXT,
  p_memory_types TEXT[] DEFAULT NULL,
  p_min_confidence NUMERIC DEFAULT 0.3,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  memory_key TEXT,
  memory_data JSONB,
  confidence_score NUMERIC,
  relevance_score NUMERIC,
  last_accessed TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.memory_type,
    cm.memory_key,
    cm.memory_data,
    cm.confidence_score,
    -- Calculate relevance based on text similarity
    CASE
      WHEN cm.memory_data::text ILIKE '%' || p_query || '%' THEN 1.0
      WHEN cm.memory_key ILIKE '%' || p_query || '%' THEN 0.8
      ELSE 0.3
    END as relevance_score,
    cm.last_accessed
  FROM conversation_memory cm
  WHERE cm.user_id = auth.uid()
    AND cm.confidence_score >= p_min_confidence
    AND (p_memory_types IS NULL OR cm.memory_type = ANY(p_memory_types))
    AND (
      cm.memory_data::text ILIKE '%' || p_query || '%' OR
      cm.memory_key ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE
      WHEN cm.memory_data::text ILIKE '%' || p_query || '%' THEN 1.0
      WHEN cm.memory_key ILIKE '%' || p_query || '%' THEN 0.8
      ELSE 0.3
    END DESC,
    cm.confidence_score DESC,
    cm.last_accessed DESC
  LIMIT p_limit;
END;
$$;

-- Function to cleanup expired context and old memories
CREATE OR REPLACE FUNCTION cleanup_conversation_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count INTEGER := 0;
BEGIN
  -- Clean up expired context
  DELETE FROM conversation_context
  WHERE expires_at IS NOT NULL AND expires_at <= NOW();

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;

  -- Clean up old, low-confidence memories (older than 90 days with confidence < 0.3)
  DELETE FROM conversation_memory
  WHERE confidence_score < 0.3
    AND created_at <= NOW() - INTERVAL '90 days'
    AND access_count <= 2;

  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;

  -- Clean up old messages from conversations with no recent activity (older than 1 year)
  DELETE FROM conversation_messages
  WHERE conversation_id IN (
    SELECT id FROM conversations
    WHERE last_message_at <= NOW() - INTERVAL '1 year'
      AND is_favorite = FALSE
  );

  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;

  RETURN cleaned_count;
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION save_conversation_message IS 'Save individual conversation messages with metadata and token counting';
COMMENT ON FUNCTION get_conversation_messages IS 'Retrieve conversation messages with pagination and optional metadata';
COMMENT ON FUNCTION save_conversation_context IS 'Save conversation context data with relevance scoring and expiration';
COMMENT ON FUNCTION get_conversation_context IS 'Retrieve conversation context filtered by type and relevance';
COMMENT ON FUNCTION save_conversation_memory IS 'Save long-term conversation memory with confidence scoring';
COMMENT ON FUNCTION get_conversation_memory IS 'Retrieve conversation memory with access tracking';
COMMENT ON FUNCTION compress_conversation_context IS 'Compress conversation context when token limit is exceeded';
COMMENT ON FUNCTION get_conversation_context_window IS 'Get complete conversation context window for AI processing';
COMMENT ON FUNCTION search_conversation_memory IS 'Search conversation memory with text similarity scoring';
COMMENT ON FUNCTION cleanup_conversation_data IS 'Clean up expired context and old conversation data';
