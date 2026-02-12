-- Migration: Category rules, alias mapping, and explicit auto-categorization matching
-- Date: 2026-02-11
-- Purpose: Add rule-based category matching while preserving strict payer/category separation

-- =============================================
-- 1. HELPER NORMALIZATION FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.normalize_text(p_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_input IS NULL THEN NULL
    ELSE regexp_replace(lower(trim(p_input)), '\\s+', ' ', 'g')
  END;
$$;

-- =============================================
-- 2. RULES AND ALIASES TABLES
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'category_rule_match_type'
  ) THEN
    CREATE TYPE public.category_rule_match_type AS ENUM ('merchant_exact', 'merchant_contains');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  match_type public.category_rule_match_type NOT NULL,
  pattern text NOT NULL,
  normalized_pattern text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.custom_categories(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_rules_pattern_len CHECK (char_length(trim(pattern)) BETWEEN 1 AND 120)
);

CREATE TABLE IF NOT EXISTS public.category_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.custom_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_aliases_alias_len CHECK (char_length(trim(alias)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_rules_unique_pattern
  ON public.category_rules (user_id, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid), match_type, normalized_pattern);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_aliases_unique_alias
  ON public.category_aliases (user_id, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid), normalized_alias);

CREATE INDEX IF NOT EXISTS idx_category_rules_scope ON public.category_rules(user_id, team_id, archived);
CREATE INDEX IF NOT EXISTS idx_category_rules_category_id ON public.category_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_category_aliases_scope ON public.category_aliases(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_category_aliases_category_id ON public.category_aliases(category_id);

-- =============================================
-- 3. UPDATED_AT TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS update_category_rules_updated_at ON public.category_rules;
CREATE TRIGGER update_category_rules_updated_at
BEFORE UPDATE ON public.category_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_category_aliases_updated_at ON public.category_aliases;
CREATE TRIGGER update_category_aliases_updated_at
BEFORE UPDATE ON public.category_aliases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. RLS POLICIES
-- =============================================

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view accessible category rules" ON public.category_rules;
CREATE POLICY "Users can view accessible category rules" ON public.category_rules
  FOR SELECT USING (
    (auth.uid() = user_id AND team_id IS NULL)
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_rules.team_id
      AND user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can insert personal category rules" ON public.category_rules;
CREATE POLICY "Users can insert personal category rules" ON public.category_rules
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND team_id IS NULL
  );

DROP POLICY IF EXISTS "Team members can insert team category rules" ON public.category_rules;
CREATE POLICY "Team members can insert team category rules" ON public.category_rules
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_rules.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can update personal category rules" ON public.category_rules;
CREATE POLICY "Users can update personal category rules" ON public.category_rules
  FOR UPDATE USING (
    auth.uid() = user_id
    AND team_id IS NULL
  ) WITH CHECK (
    auth.uid() = user_id
    AND team_id IS NULL
  );

DROP POLICY IF EXISTS "Team members can update team category rules" ON public.category_rules;
CREATE POLICY "Team members can update team category rules" ON public.category_rules
  FOR UPDATE USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_rules.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  ) WITH CHECK (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_rules.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can delete personal category rules" ON public.category_rules;
CREATE POLICY "Users can delete personal category rules" ON public.category_rules
  FOR DELETE USING (
    auth.uid() = user_id
    AND team_id IS NULL
  );

DROP POLICY IF EXISTS "Team members can delete team category rules" ON public.category_rules;
CREATE POLICY "Team members can delete team category rules" ON public.category_rules
  FOR DELETE USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_rules.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can view accessible category aliases" ON public.category_aliases;
CREATE POLICY "Users can view accessible category aliases" ON public.category_aliases
  FOR SELECT USING (
    (auth.uid() = user_id AND team_id IS NULL)
    OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_aliases.team_id
      AND user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can insert personal category aliases" ON public.category_aliases;
CREATE POLICY "Users can insert personal category aliases" ON public.category_aliases
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND team_id IS NULL
  );

DROP POLICY IF EXISTS "Team members can insert team category aliases" ON public.category_aliases;
CREATE POLICY "Team members can insert team category aliases" ON public.category_aliases
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_aliases.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can update personal category aliases" ON public.category_aliases;
CREATE POLICY "Users can update personal category aliases" ON public.category_aliases
  FOR UPDATE USING (
    auth.uid() = user_id
    AND team_id IS NULL
  ) WITH CHECK (
    auth.uid() = user_id
    AND team_id IS NULL
  );

DROP POLICY IF EXISTS "Team members can update team category aliases" ON public.category_aliases;
CREATE POLICY "Team members can update team category aliases" ON public.category_aliases
  FOR UPDATE USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_aliases.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  ) WITH CHECK (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_aliases.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can delete personal category aliases" ON public.category_aliases;
CREATE POLICY "Users can delete personal category aliases" ON public.category_aliases
  FOR DELETE USING (
    auth.uid() = user_id
    AND team_id IS NULL
  );

DROP POLICY IF EXISTS "Team members can delete team category aliases" ON public.category_aliases;
CREATE POLICY "Team members can delete team category aliases" ON public.category_aliases
  FOR DELETE USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = category_aliases.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

-- =============================================
-- 5. MATCHING FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.match_category_for_receipt(
  p_user_id uuid,
  p_team_id uuid,
  p_merchant text,
  p_line_items jsonb DEFAULT '[]'::jsonb,
  p_predicted_category text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
  v_merchant text;
  v_predicted_category text;
  v_match uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  v_team_id := p_team_id;
  v_merchant := public.normalize_text(p_merchant);
  v_predicted_category := public.normalize_text(p_predicted_category);

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Merchant exact match rules
  IF v_merchant IS NOT NULL THEN
    SELECT cr.category_id
    INTO v_match
    FROM public.category_rules cr
    JOIN public.custom_categories cc ON cc.id = cr.category_id
    WHERE cr.user_id = v_user_id
      AND cr.archived = false
      AND cc.archived = false
      AND ((v_team_id IS NULL AND cr.team_id IS NULL) OR cr.team_id = v_team_id)
      AND ((v_team_id IS NULL AND cc.team_id IS NULL) OR cc.team_id = v_team_id)
      AND cr.match_type = 'merchant_exact'
      AND cr.normalized_pattern = v_merchant
    ORDER BY cr.priority DESC, char_length(cr.normalized_pattern) DESC, cr.created_at ASC
    LIMIT 1;

    IF v_match IS NOT NULL THEN
      RETURN v_match;
    END IF;

    -- Merchant contains rules
    SELECT cr.category_id
    INTO v_match
    FROM public.category_rules cr
    JOIN public.custom_categories cc ON cc.id = cr.category_id
    WHERE cr.user_id = v_user_id
      AND cr.archived = false
      AND cc.archived = false
      AND ((v_team_id IS NULL AND cr.team_id IS NULL) OR cr.team_id = v_team_id)
      AND ((v_team_id IS NULL AND cc.team_id IS NULL) OR cc.team_id = v_team_id)
      AND cr.match_type = 'merchant_contains'
      AND v_merchant LIKE ('%' || cr.normalized_pattern || '%')
    ORDER BY cr.priority DESC, char_length(cr.normalized_pattern) DESC, cr.created_at ASC
    LIMIT 1;

    IF v_match IS NOT NULL THEN
      RETURN v_match;
    END IF;
  END IF;

  -- AI text alias mapping fallback
  IF v_predicted_category IS NOT NULL THEN
    SELECT ca.category_id
    INTO v_match
    FROM public.category_aliases ca
    JOIN public.custom_categories cc ON cc.id = ca.category_id
    WHERE ca.user_id = v_user_id
      AND cc.archived = false
      AND ((v_team_id IS NULL AND ca.team_id IS NULL) OR ca.team_id = v_team_id)
      AND ((v_team_id IS NULL AND cc.team_id IS NULL) OR cc.team_id = v_team_id)
      AND ca.normalized_alias = v_predicted_category
    LIMIT 1;

    IF v_match IS NOT NULL THEN
      RETURN v_match;
    END IF;

    -- Direct category name match fallback
    SELECT cc.id
    INTO v_match
    FROM public.custom_categories cc
    WHERE cc.user_id = v_user_id
      AND cc.archived = false
      AND ((v_team_id IS NULL AND cc.team_id IS NULL) OR cc.team_id = v_team_id)
      AND public.normalize_text(cc.name) = v_predicted_category
    LIMIT 1;

    IF v_match IS NOT NULL THEN
      RETURN v_match;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- =============================================
-- 6. RULE MANAGEMENT RPCs
-- =============================================

CREATE OR REPLACE FUNCTION public.get_category_rules(
  p_team_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  team_id uuid,
  match_type public.category_rule_match_type,
  pattern text,
  category_id uuid,
  category_name text,
  priority integer,
  archived boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied to team rules';
  END IF;

  RETURN QUERY
  SELECT
    cr.id,
    cr.user_id,
    cr.team_id,
    cr.match_type,
    cr.pattern,
    cr.category_id,
    cc.name AS category_name,
    cr.priority,
    cr.archived,
    cr.created_at,
    cr.updated_at
  FROM public.category_rules cr
  JOIN public.custom_categories cc ON cc.id = cr.category_id
  WHERE cr.user_id = v_user_id
    AND ((p_team_id IS NULL AND cr.team_id IS NULL) OR cr.team_id = p_team_id)
  ORDER BY cr.archived ASC, cr.priority DESC, cr.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_category_rule(
  p_rule_id uuid DEFAULT NULL,
  p_match_type public.category_rule_match_type DEFAULT 'merchant_exact',
  p_pattern text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_priority integer DEFAULT 0,
  p_team_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_rule_id uuid;
  v_existing_team_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_pattern IS NULL OR trim(p_pattern) = '' THEN
    RAISE EXCEPTION 'Rule pattern is required';
  END IF;

  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = v_user_id
      AND role IN ('owner', 'admin', 'member')
  ) THEN
    RAISE EXCEPTION 'Access denied to team rules';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.custom_categories cc
    WHERE cc.id = p_category_id
      AND cc.user_id = v_user_id
      AND cc.archived = false
      AND ((p_team_id IS NULL AND cc.team_id IS NULL) OR cc.team_id = p_team_id)
  ) THEN
    RAISE EXCEPTION 'Category not found for this scope';
  END IF;

  IF p_rule_id IS NULL THEN
    UPDATE public.category_rules
    SET category_id = p_category_id,
        priority = COALESCE(p_priority, 0),
        archived = false,
        pattern = trim(p_pattern),
        normalized_pattern = public.normalize_text(p_pattern),
        updated_at = now()
    WHERE user_id = v_user_id
      AND ((p_team_id IS NULL AND team_id IS NULL) OR team_id = p_team_id)
      AND match_type = p_match_type
      AND normalized_pattern = public.normalize_text(p_pattern)
    RETURNING id INTO v_rule_id;

    IF v_rule_id IS NULL THEN
      INSERT INTO public.category_rules (
        user_id,
        team_id,
        match_type,
        pattern,
        normalized_pattern,
        category_id,
        priority,
        archived
      ) VALUES (
        v_user_id,
        p_team_id,
        p_match_type,
        trim(p_pattern),
        public.normalize_text(p_pattern),
        p_category_id,
        COALESCE(p_priority, 0),
        false
      )
      RETURNING id INTO v_rule_id;
    END IF;
  ELSE
    SELECT team_id
    INTO v_existing_team_id
    FROM public.category_rules
    WHERE id = p_rule_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rule not found';
    END IF;

    IF p_team_id IS DISTINCT FROM v_existing_team_id THEN
      RAISE EXCEPTION 'Rule scope cannot be changed';
    END IF;

    UPDATE public.category_rules
    SET match_type = p_match_type,
        pattern = trim(p_pattern),
        normalized_pattern = public.normalize_text(p_pattern),
        category_id = p_category_id,
        priority = COALESCE(p_priority, 0),
        archived = false,
        updated_at = now()
    WHERE id = p_rule_id
      AND user_id = v_user_id
    RETURNING id INTO v_rule_id;
  END IF;

  RETURN v_rule_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_category_rule(
  p_rule_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  UPDATE public.category_rules
  SET archived = true,
      updated_at = now()
  WHERE id = p_rule_id
    AND user_id = v_user_id;

  RETURN FOUND;
END;
$$;

-- =============================================
-- 7. ALIAS MANAGEMENT RPCs
-- =============================================

CREATE OR REPLACE FUNCTION public.get_category_aliases(
  p_team_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  team_id uuid,
  alias text,
  category_id uuid,
  category_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied to team aliases';
  END IF;

  RETURN QUERY
  SELECT
    ca.id,
    ca.user_id,
    ca.team_id,
    ca.alias,
    ca.category_id,
    cc.name AS category_name,
    ca.created_at,
    ca.updated_at
  FROM public.category_aliases ca
  JOIN public.custom_categories cc ON cc.id = ca.category_id
  WHERE ca.user_id = v_user_id
    AND ((p_team_id IS NULL AND ca.team_id IS NULL) OR ca.team_id = p_team_id)
  ORDER BY ca.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_category_alias(
  p_alias_id uuid DEFAULT NULL,
  p_alias text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_team_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_alias_id uuid;
  v_existing_team_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_alias IS NULL OR trim(p_alias) = '' THEN
    RAISE EXCEPTION 'Alias is required';
  END IF;

  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = v_user_id
      AND role IN ('owner', 'admin', 'member')
  ) THEN
    RAISE EXCEPTION 'Access denied to team aliases';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.custom_categories cc
    WHERE cc.id = p_category_id
      AND cc.user_id = v_user_id
      AND cc.archived = false
      AND ((p_team_id IS NULL AND cc.team_id IS NULL) OR cc.team_id = p_team_id)
  ) THEN
    RAISE EXCEPTION 'Category not found for this scope';
  END IF;

  IF p_alias_id IS NULL THEN
    UPDATE public.category_aliases
    SET category_id = p_category_id,
        alias = trim(p_alias),
        normalized_alias = public.normalize_text(p_alias),
        updated_at = now()
    WHERE user_id = v_user_id
      AND ((p_team_id IS NULL AND team_id IS NULL) OR team_id = p_team_id)
      AND normalized_alias = public.normalize_text(p_alias)
    RETURNING id INTO v_alias_id;

    IF v_alias_id IS NULL THEN
      INSERT INTO public.category_aliases (
        user_id,
        team_id,
        alias,
        normalized_alias,
        category_id
      ) VALUES (
        v_user_id,
        p_team_id,
        trim(p_alias),
        public.normalize_text(p_alias),
        p_category_id
      )
      RETURNING id INTO v_alias_id;
    END IF;
  ELSE
    SELECT team_id
    INTO v_existing_team_id
    FROM public.category_aliases
    WHERE id = p_alias_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Alias not found';
    END IF;

    IF p_team_id IS DISTINCT FROM v_existing_team_id THEN
      RAISE EXCEPTION 'Alias scope cannot be changed';
    END IF;

    UPDATE public.category_aliases
    SET alias = trim(p_alias),
        normalized_alias = public.normalize_text(p_alias),
        category_id = p_category_id,
        updated_at = now()
    WHERE id = p_alias_id
      AND user_id = v_user_id
    RETURNING id INTO v_alias_id;
  END IF;

  RETURN v_alias_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_category_alias(
  p_alias_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  DELETE FROM public.category_aliases
  WHERE id = p_alias_id
    AND user_id = v_user_id;

  RETURN FOUND;
END;
$$;

-- =============================================
-- 8. CATEGORY NAME GUARDRAILS (PAYER CONFLICT)
-- =============================================

CREATE OR REPLACE FUNCTION public.create_custom_category(
  p_name text,
  p_color text DEFAULT '#3B82F6'::text,
  p_icon text DEFAULT 'tag'::text,
  p_team_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_category_id uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Category name cannot be empty';
  END IF;

  IF char_length(trim(p_name)) > 50 THEN
    RAISE EXCEPTION 'Category name cannot exceed 50 characters';
  END IF;

  IF p_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Invalid color format. Use hex format like #3B82F6';
  END IF;

  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = current_user_id
      AND role IN ('owner', 'admin', 'member')
  ) THEN
    RAISE EXCEPTION 'Access denied to team categories';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.custom_categories cc
    WHERE cc.user_id = current_user_id
      AND ((p_team_id IS NULL AND cc.team_id IS NULL) OR cc.team_id = p_team_id)
      AND lower(cc.name) = lower(trim(p_name))
      AND cc.archived = false
  ) THEN
    RAISE EXCEPTION 'Category with this name already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.paid_by pb
    WHERE pb.user_id = current_user_id
      AND ((p_team_id IS NULL AND pb.team_id IS NULL) OR pb.team_id = p_team_id)
      AND lower(pb.name) = lower(trim(p_name))
      AND pb.archived = false
  ) THEN
    RAISE EXCEPTION 'Category name conflicts with an existing payer name';
  END IF;

  INSERT INTO public.custom_categories (user_id, team_id, name, color, icon)
  VALUES (current_user_id, p_team_id, trim(p_name), p_color, p_icon)
  RETURNING id INTO new_category_id;

  RETURN new_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_custom_category(
  p_category_id uuid,
  p_name text DEFAULT NULL::text,
  p_color text DEFAULT NULL::text,
  p_icon text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  category_exists boolean;
  category_team_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.custom_categories
    WHERE id = p_category_id
      AND user_id = current_user_id
  ) INTO category_exists;

  IF NOT category_exists THEN
    RAISE EXCEPTION 'Category not found or access denied';
  END IF;

  SELECT team_id
  INTO category_team_id
  FROM public.custom_categories
  WHERE id = p_category_id;

  IF p_name IS NOT NULL THEN
    IF trim(p_name) = '' THEN
      RAISE EXCEPTION 'Category name cannot be empty';
    END IF;

    IF char_length(trim(p_name)) > 50 THEN
      RAISE EXCEPTION 'Category name cannot exceed 50 characters';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.custom_categories cc
      WHERE cc.user_id = current_user_id
        AND ((category_team_id IS NULL AND cc.team_id IS NULL) OR cc.team_id = category_team_id)
        AND lower(cc.name) = lower(trim(p_name))
        AND cc.id <> p_category_id
        AND cc.archived = false
    ) THEN
      RAISE EXCEPTION 'Category with this name already exists';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.paid_by pb
      WHERE pb.user_id = current_user_id
        AND ((category_team_id IS NULL AND pb.team_id IS NULL) OR pb.team_id = category_team_id)
        AND lower(pb.name) = lower(trim(p_name))
        AND pb.archived = false
    ) THEN
      RAISE EXCEPTION 'Category name conflicts with an existing payer name';
    END IF;
  END IF;

  IF p_color IS NOT NULL AND p_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Invalid color format. Use hex format like #3B82F6';
  END IF;

  UPDATE public.custom_categories
  SET name = COALESCE(trim(p_name), name),
      color = COALESCE(p_color, color),
      icon = COALESCE(p_icon, icon),
      updated_at = now()
  WHERE id = p_category_id
    AND user_id = current_user_id;

  RETURN true;
END;
$$;

COMMENT ON TABLE public.category_rules IS 'Explicit user-managed rules for auto-categorizing receipts';
COMMENT ON TABLE public.category_aliases IS 'Alias map from AI predicted category labels to custom category IDs';
