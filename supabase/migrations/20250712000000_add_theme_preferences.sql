-- Migration: Add Theme Preferences Support
-- This migration extends the existing user_preferences table to support theme configuration

-- Add 'theme' to the allowed preference categories
ALTER TABLE user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_preference_category_check;

ALTER TABLE user_preferences 
ADD CONSTRAINT user_preferences_preference_category_check 
CHECK (preference_category IN (
  'communication_style',
  'response_length', 
  'technical_detail_level',
  'ui_layout',
  'feature_usage',
  'search_behavior',
  'content_preferences',
  'interaction_patterns',
  'theme'  -- Add theme category
));

-- Create a simplified theme preferences table for easier querying
-- This table provides a more direct interface for theme settings
CREATE TABLE IF NOT EXISTS public.theme_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Theme configuration
  theme_mode TEXT DEFAULT 'auto' CHECK (theme_mode IN ('light', 'dark', 'auto')),
  theme_variant TEXT DEFAULT 'default' CHECK (theme_variant IN ('default', 'ocean', 'forest', 'sunset')),
  
  -- Theme settings
  enable_transitions BOOLEAN DEFAULT true,
  sync_with_system BOOLEAN DEFAULT true,
  persist_across_devices BOOLEAN DEFAULT true,
  
  -- Analytics and preferences
  preferred_mode TEXT CHECK (preferred_mode IN ('light', 'dark', 'auto')),
  switch_frequency INTEGER DEFAULT 0,
  last_mode_switch TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one theme preference record per user
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_theme_preferences_user_id ON theme_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_theme_preferences_mode ON theme_preferences(theme_mode);
CREATE INDEX IF NOT EXISTS idx_theme_preferences_variant ON theme_preferences(theme_variant);

-- Enable RLS
ALTER TABLE theme_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for theme preferences
CREATE POLICY "Users can manage their own theme preferences" ON theme_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Function to get user theme configuration
CREATE OR REPLACE FUNCTION get_user_theme_config(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  theme_mode TEXT,
  theme_variant TEXT,
  enable_transitions BOOLEAN,
  sync_with_system BOOLEAN,
  persist_across_devices BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Use provided user_id or current authenticated user
  target_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Return theme configuration
  RETURN QUERY
  SELECT
    tp.theme_mode,
    tp.theme_variant,
    tp.enable_transitions,
    tp.sync_with_system,
    tp.persist_across_devices
  FROM theme_preferences tp
  WHERE tp.user_id = target_user_id;
  
  -- If no theme preferences exist, return defaults
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'auto'::TEXT as theme_mode,
      'default'::TEXT as theme_variant,
      true as enable_transitions,
      true as sync_with_system,
      true as persist_across_devices;
  END IF;
END;
$$;

-- Function to set user theme configuration
CREATE OR REPLACE FUNCTION set_user_theme_config(
  p_theme_mode TEXT DEFAULT NULL,
  p_theme_variant TEXT DEFAULT NULL,
  p_enable_transitions BOOLEAN DEFAULT NULL,
  p_sync_with_system BOOLEAN DEFAULT NULL,
  p_persist_across_devices BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  theme_pref_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Insert or update theme preferences
  INSERT INTO theme_preferences (
    user_id,
    theme_mode,
    theme_variant,
    enable_transitions,
    sync_with_system,
    persist_across_devices,
    last_mode_switch
  ) VALUES (
    current_user_id,
    COALESCE(p_theme_mode, 'auto'),
    COALESCE(p_theme_variant, 'default'),
    COALESCE(p_enable_transitions, true),
    COALESCE(p_sync_with_system, true),
    COALESCE(p_persist_across_devices, true),
    CASE WHEN p_theme_mode IS NOT NULL THEN NOW() ELSE NULL END
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    theme_mode = COALESCE(EXCLUDED.theme_mode, theme_preferences.theme_mode),
    theme_variant = COALESCE(EXCLUDED.theme_variant, theme_preferences.theme_variant),
    enable_transitions = COALESCE(EXCLUDED.enable_transitions, theme_preferences.enable_transitions),
    sync_with_system = COALESCE(EXCLUDED.sync_with_system, theme_preferences.sync_with_system),
    persist_across_devices = COALESCE(EXCLUDED.persist_across_devices, theme_preferences.persist_across_devices),
    last_mode_switch = CASE 
      WHEN EXCLUDED.theme_mode IS NOT NULL AND EXCLUDED.theme_mode != theme_preferences.theme_mode 
      THEN NOW() 
      ELSE theme_preferences.last_mode_switch 
    END,
    switch_frequency = CASE 
      WHEN EXCLUDED.theme_mode IS NOT NULL AND EXCLUDED.theme_mode != theme_preferences.theme_mode 
      THEN theme_preferences.switch_frequency + 1 
      ELSE theme_preferences.switch_frequency 
    END,
    updated_at = NOW()
  RETURNING id INTO theme_pref_id;
  
  -- Also store in the flexible user_preferences table for consistency
  PERFORM set_user_preference(
    'theme',
    'config',
    jsonb_build_object(
      'mode', COALESCE(p_theme_mode, (SELECT theme_mode FROM theme_preferences WHERE user_id = current_user_id)),
      'variant', COALESCE(p_theme_variant, (SELECT theme_variant FROM theme_preferences WHERE user_id = current_user_id))
    ),
    1.0,
    'explicit_setting'
  );
  
  RETURN theme_pref_id;
END;
$$;

-- Function to track theme usage analytics
CREATE OR REPLACE FUNCTION track_theme_usage(
  p_theme_mode TEXT,
  p_theme_variant TEXT,
  p_action TEXT DEFAULT 'switch'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Track theme interaction
  PERFORM track_user_interaction(
    'preference_change',
    jsonb_build_object(
      'preference_type', 'theme',
      'action', p_action,
      'theme_mode', p_theme_mode,
      'theme_variant', p_theme_variant,
      'timestamp', NOW()
    )
  );
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_theme_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_theme_preferences_updated_at
  BEFORE UPDATE ON theme_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_theme_preferences_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON theme_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_theme_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_theme_config(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION track_theme_usage(TEXT, TEXT, TEXT) TO authenticated;
