-- Create the missing can_perform_unified_search function
-- This function wraps the existing can_perform_action function for unified search

CREATE OR REPLACE FUNCTION can_perform_unified_search(
  p_user_id UUID,
  p_sources TEXT[],
  p_result_limit INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  action_result JSONB;
  filtered_sources TEXT[];
  filtered_limit INTEGER;
BEGIN
  -- Call the existing subscription enforcement function
  action_result := can_perform_action(
    p_user_id, 
    'unified_search', 
    jsonb_build_object(
      'sources', p_sources,
      'result_limit', p_result_limit
    )
  );
  
  -- If action is allowed, apply any tier-based filtering
  IF (action_result->>'allowed')::BOOLEAN THEN
    -- Apply source filtering based on subscription tier
    DECLARE
      user_tier TEXT := action_result->>'tier';
    BEGIN
      CASE user_tier
        WHEN 'free' THEN
          -- Free tier: only receipts and business directory
          filtered_sources := ARRAY(
            SELECT unnest(p_sources) 
            WHERE unnest(p_sources) IN ('receipt', 'business_directory')
          );
          filtered_limit := LEAST(p_result_limit, 10); -- Max 10 results for free
          
        WHEN 'pro' THEN
          -- Pro tier: all sources except advanced features
          filtered_sources := p_sources;
          filtered_limit := LEAST(p_result_limit, 50); -- Max 50 results for pro
          
        WHEN 'max' THEN
          -- Max tier: all sources, no limits
          filtered_sources := p_sources;
          filtered_limit := p_result_limit;
          
        ELSE
          -- Default to free tier restrictions
          filtered_sources := ARRAY(
            SELECT unnest(p_sources) 
            WHERE unnest(p_sources) IN ('receipt', 'business_directory')
          );
          filtered_limit := LEAST(p_result_limit, 10);
      END CASE;
      
      -- Return enhanced result with filtering information
      RETURN action_result || jsonb_build_object(
        'filtered_sources', filtered_sources,
        'filtered_limit', filtered_limit,
        'original_sources', p_sources,
        'original_limit', p_result_limit
      );
    END;
  ELSE
    -- Action not allowed, return the original result
    RETURN action_result;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION can_perform_unified_search TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION can_perform_unified_search IS 'Checks if user can perform unified search based on subscription tier and applies appropriate filtering';
