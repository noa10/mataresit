-- Migration: Add Message Feedback System
-- Description: Creates tables and functions for chat message feedback and conversation management

-- Create message_feedback table
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT CHECK (feedback_type IN ('positive', 'negative')) NOT NULL,
  feedback_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_conversation_id ON message_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_created_at ON message_feedback(created_at);

-- Enable RLS
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_feedback
CREATE POLICY "Users can view their own feedback" ON message_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback" ON message_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON message_feedback
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback" ON message_feedback
  FOR DELETE USING (auth.uid() = user_id);

-- Admin policy for viewing all feedback
CREATE POLICY "Admins can view all feedback" ON message_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create conversations table for enhanced conversation management
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX IF NOT EXISTS idx_conversations_is_archived ON conversations(is_archived);
CREATE INDEX IF NOT EXISTS idx_conversations_is_favorite ON conversations(is_favorite);

-- Enable RLS for conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Users can manage their own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- Admin policy for viewing all conversations
CREATE POLICY "Admins can view all conversations" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Function to submit message feedback
CREATE OR REPLACE FUNCTION submit_message_feedback(
  p_message_id TEXT,
  p_conversation_id TEXT,
  p_feedback_type TEXT,
  p_feedback_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  feedback_id UUID;
BEGIN
  -- Validate feedback type
  IF p_feedback_type NOT IN ('positive', 'negative') THEN
    RAISE EXCEPTION 'Invalid feedback type. Must be positive or negative.';
  END IF;

  -- Check if user already provided feedback for this message
  SELECT id INTO feedback_id
  FROM message_feedback
  WHERE message_id = p_message_id 
    AND user_id = auth.uid();

  IF feedback_id IS NOT NULL THEN
    -- Update existing feedback
    UPDATE message_feedback
    SET 
      feedback_type = p_feedback_type,
      feedback_comment = p_feedback_comment,
      updated_at = NOW()
    WHERE id = feedback_id;
  ELSE
    -- Insert new feedback
    INSERT INTO message_feedback (
      message_id,
      conversation_id,
      user_id,
      feedback_type,
      feedback_comment
    ) VALUES (
      p_message_id,
      p_conversation_id,
      auth.uid(),
      p_feedback_type,
      p_feedback_comment
    ) RETURNING id INTO feedback_id;
  END IF;

  RETURN feedback_id;
END;
$$;

-- Function to get message feedback for a user
CREATE OR REPLACE FUNCTION get_message_feedback(p_message_id TEXT)
RETURNS TABLE (
  id UUID,
  feedback_type TEXT,
  feedback_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mf.id,
    mf.feedback_type,
    mf.feedback_comment,
    mf.created_at,
    mf.updated_at
  FROM message_feedback mf
  WHERE mf.message_id = p_message_id 
    AND mf.user_id = auth.uid();
END;
$$;

-- Function to save/update conversation
CREATE OR REPLACE FUNCTION save_conversation(
  p_conversation_id TEXT,
  p_title TEXT,
  p_message_count INTEGER DEFAULT 0,
  p_is_archived BOOLEAN DEFAULT FALSE,
  p_is_favorite BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO conversations (
    id,
    user_id,
    title,
    message_count,
    is_archived,
    is_favorite,
    last_message_at,
    updated_at
  ) VALUES (
    p_conversation_id,
    auth.uid(),
    p_title,
    p_message_count,
    p_is_archived,
    p_is_favorite,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    message_count = EXCLUDED.message_count,
    is_archived = EXCLUDED.is_archived,
    is_favorite = EXCLUDED.is_favorite,
    last_message_at = NOW(),
    updated_at = NOW();

  RETURN p_conversation_id;
END;
$$;

-- Function to get user conversations
CREATE OR REPLACE FUNCTION get_user_conversations(
  p_include_archived BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  is_archived BOOLEAN,
  is_favorite BOOLEAN,
  message_count INTEGER,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.is_archived,
    c.is_favorite,
    c.message_count,
    c.last_message_at,
    c.created_at
  FROM conversations c
  WHERE c.user_id = auth.uid()
    AND (p_include_archived OR NOT c.is_archived)
  ORDER BY 
    c.is_favorite DESC,
    c.last_message_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to archive/unarchive conversation
CREATE OR REPLACE FUNCTION toggle_conversation_archive(
  p_conversation_id TEXT,
  p_is_archived BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE conversations
  SET 
    is_archived = p_is_archived,
    updated_at = NOW()
  WHERE id = p_conversation_id 
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$;

-- Function to toggle conversation favorite
CREATE OR REPLACE FUNCTION toggle_conversation_favorite(
  p_conversation_id TEXT,
  p_is_favorite BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE conversations
  SET 
    is_favorite = p_is_favorite,
    updated_at = NOW()
  WHERE id = p_conversation_id 
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$;

-- Function to rename conversation
CREATE OR REPLACE FUNCTION rename_conversation(
  p_conversation_id TEXT,
  p_new_title TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate title length
  IF LENGTH(TRIM(p_new_title)) < 1 OR LENGTH(p_new_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 1 and 200 characters';
  END IF;

  UPDATE conversations
  SET 
    title = TRIM(p_new_title),
    updated_at = NOW()
  WHERE id = p_conversation_id 
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$;

-- Function to delete conversation
CREATE OR REPLACE FUNCTION delete_conversation(p_conversation_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete associated feedback first
  DELETE FROM message_feedback
  WHERE conversation_id = p_conversation_id 
    AND user_id = auth.uid();

  -- Delete conversation
  DELETE FROM conversations
  WHERE id = p_conversation_id 
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$;

-- Function to get feedback analytics (admin only)
CREATE OR REPLACE FUNCTION get_feedback_analytics(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  total_feedback BIGINT,
  positive_feedback BIGINT,
  negative_feedback BIGINT,
  positive_percentage NUMERIC,
  feedback_by_day JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if user is admin using the user_roles table
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  WITH feedback_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive,
      COUNT(*) FILTER (WHERE feedback_type = 'negative') as negative
    FROM message_feedback
    WHERE created_at BETWEEN p_start_date AND p_end_date
  ),
  daily_feedback AS (
    SELECT 
      DATE(created_at) as feedback_date,
      COUNT(*) as daily_count,
      COUNT(*) FILTER (WHERE feedback_type = 'positive') as daily_positive
    FROM message_feedback
    WHERE created_at BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(created_at)
    ORDER BY feedback_date
  )
  SELECT 
    fs.total,
    fs.positive,
    fs.negative,
    CASE 
      WHEN fs.total > 0 THEN ROUND((fs.positive::NUMERIC / fs.total::NUMERIC) * 100, 2)
      ELSE 0
    END as positive_percentage,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', df.feedback_date,
          'total', df.daily_count,
          'positive', df.daily_positive
        ) ORDER BY df.feedback_date
      ),
      '[]'::jsonb
    ) as feedback_by_day
  FROM feedback_stats fs
  LEFT JOIN daily_feedback df ON true
  GROUP BY fs.total, fs.positive, fs.negative;
END;
$$;
