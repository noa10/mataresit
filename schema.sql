

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."api_scope" AS ENUM (
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


ALTER TYPE "public"."api_scope" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."claim_priority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE "public"."claim_priority" OWNER TO "postgres";


CREATE TYPE "public"."claim_status" AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'cancelled'
);


ALTER TYPE "public"."claim_status" OWNER TO "postgres";


CREATE TYPE "public"."email_delivery_status" AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed',
    'bounced',
    'complained'
);


ALTER TYPE "public"."email_delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."http_header" AS (
	"field" character varying,
	"value" character varying
);


ALTER TYPE "public"."http_header" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_priority" AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE "public"."notification_priority" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'team_invitation_sent',
    'team_invitation_accepted',
    'team_member_joined',
    'team_member_left',
    'team_member_role_changed',
    'claim_submitted',
    'claim_approved',
    'claim_rejected',
    'claim_review_requested',
    'team_settings_updated'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_tier" AS ENUM (
    'free',
    'pro',
    'max'
);


ALTER TYPE "public"."subscription_tier" OWNER TO "postgres";


CREATE TYPE "public"."team_member_role" AS ENUM (
    'owner',
    'admin',
    'member',
    'viewer'
);


ALTER TYPE "public"."team_member_role" OWNER TO "postgres";


CREATE TYPE "public"."team_status" AS ENUM (
    'active',
    'suspended',
    'archived'
);


ALTER TYPE "public"."team_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_team_invitation"("_token" character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _invitation RECORD;
  _user_email VARCHAR(255);
BEGIN
  -- Get current user's email
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get invitation details
  SELECT * INTO _invitation
  FROM public.team_invitations
  WHERE token = _token AND status = 'pending' AND expires_at > NOW();

  IF _invitation IS NULL THEN
    -- Check if invitation exists but is expired or not pending
    IF EXISTS (SELECT 1 FROM public.team_invitations WHERE token = _token) THEN
      SELECT * INTO _invitation FROM public.team_invitations WHERE token = _token;
      IF _invitation.status != 'pending' THEN
        RAISE EXCEPTION 'This invitation has already been %', _invitation.status;
      ELSIF _invitation.expires_at <= NOW() THEN
        RAISE EXCEPTION 'This invitation has expired';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid invitation token';
    END IF;
  END IF;

  -- Check if invitation is for the current user
  IF _invitation.email != _user_email THEN
    RAISE EXCEPTION 'This invitation was sent to % but you are signed in as %. Please sign in with the correct email address.', _invitation.email, _user_email;
  END IF;

  -- Check if user is already a team member
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _invitation.team_id AND user_id = auth.uid()
  ) THEN
    -- Update invitation status and return success
    UPDATE public.team_invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = _invitation.id;
    
    RETURN TRUE;
  END IF;

  -- Add user to team
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (_invitation.team_id, auth.uid(), _invitation.role);

  -- Update invitation status
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = _invitation.id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."accept_team_invitation"("_token" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "text", "p_message_type" "text" DEFAULT 'text'::"text", "p_search_results" "jsonb" DEFAULT NULL::"jsonb", "p_intent_data" "jsonb" DEFAULT NULL::"jsonb", "p_keywords_data" "jsonb" DEFAULT NULL::"jsonb", "p_enhancement_data" "jsonb" DEFAULT NULL::"jsonb", "p_validation_data" "jsonb" DEFAULT NULL::"jsonb", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_message_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate role
  IF p_role NOT IN ('user', 'assistant', 'system') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Validate message type
  IF p_message_type NOT IN ('text', 'search_result', 'analysis', 'error', 'system') THEN
    RAISE EXCEPTION 'Invalid message type: %', p_message_type;
  END IF;

  -- Insert message
  INSERT INTO chat_messages (
    conversation_id,
    user_id,
    role,
    content,
    message_type,
    search_results,
    intent_data,
    keywords_data,
    enhancement_data,
    validation_data,
    metadata
  ) VALUES (
    p_conversation_id,
    v_user_id,
    p_role,
    p_content,
    p_message_type,
    p_search_results,
    p_intent_data,
    p_keywords_data,
    p_enhancement_data,
    p_validation_data,
    p_metadata
  ) RETURNING id INTO v_message_id;

  -- Update conversation last activity
  UPDATE conversation_sessions 
  SET last_activity_at = NOW()
  WHERE id = p_conversation_id;

  -- Update analytics
  UPDATE conversation_analytics 
  SET 
    total_messages = total_messages + 1,
    user_messages = CASE WHEN p_role = 'user' THEN user_messages + 1 ELSE user_messages END,
    assistant_messages = CASE WHEN p_role = 'assistant' THEN assistant_messages + 1 ELSE assistant_messages END,
    search_queries = CASE WHEN p_message_type = 'search_result' THEN search_queries + 1 ELSE search_queries END,
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id;

  -- Update context conversation length
  UPDATE chat_contexts 
  SET 
    conversation_length = conversation_length + 1,
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id;

  RETURN v_message_id;
END;
$$;


ALTER FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "text", "p_message_type" "text", "p_search_results" "jsonb", "p_intent_data" "jsonb", "p_keywords_data" "jsonb", "p_enhancement_data" "jsonb", "p_validation_data" "jsonb", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" character varying, "p_content" "text", "p_message_type" character varying DEFAULT 'text'::character varying, "p_search_results" "jsonb" DEFAULT NULL::"jsonb", "p_intent_data" "jsonb" DEFAULT NULL::"jsonb", "p_keywords_data" "jsonb" DEFAULT NULL::"jsonb", "p_enhancement_data" "jsonb" DEFAULT NULL::"jsonb", "p_validation_data" "jsonb" DEFAULT NULL::"jsonb", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_message_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Verify user has access to the conversation
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_sessions 
    WHERE id = p_conversation_id 
    AND (user_id = v_user_id OR 
         (team_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.team_members 
           WHERE team_id = conversation_sessions.team_id 
           AND user_id = v_user_id
         )))
  ) THEN
    RAISE EXCEPTION 'Access denied to conversation';
  END IF;
  
  -- Insert the message
  INSERT INTO public.chat_messages (
    conversation_id,
    user_id,
    role,
    content,
    message_type,
    search_results,
    intent_data,
    keywords_data,
    enhancement_data,
    validation_data,
    metadata
  ) VALUES (
    p_conversation_id,
    v_user_id,
    p_role,
    p_content,
    p_message_type,
    p_search_results,
    p_intent_data,
    p_keywords_data,
    p_enhancement_data,
    p_validation_data,
    p_metadata
  ) RETURNING id INTO v_message_id;
  
  -- Update conversation last activity
  UPDATE public.conversation_sessions 
  SET last_activity_at = NOW(), updated_at = NOW()
  WHERE id = p_conversation_id;
  
  -- Update conversation analytics
  UPDATE public.conversation_analytics 
  SET 
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id;
  
  -- Update chat context conversation length
  UPDATE public.chat_contexts 
  SET 
    conversation_length = conversation_length + 1,
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id;
  
  RETURN v_message_id;
END;
$$;


ALTER FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" character varying, "p_content" "text", "p_message_type" character varying, "p_search_results" "jsonb", "p_intent_data" "jsonb", "p_keywords_data" "jsonb", "p_enhancement_data" "jsonb", "p_validation_data" "jsonb", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text", "p_content_text" "text", "p_embedding" "public"."vector", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_team_id" "uuid" DEFAULT NULL::"uuid", "p_language" "text" DEFAULT 'en'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  embedding_id UUID;
  enriched_metadata JSONB;
  receipt_date DATE;
BEGIN
  -- Validate that content_text is not empty
  IF p_content_text IS NULL OR TRIM(p_content_text) = '' THEN
    RAISE EXCEPTION 'Content text cannot be null or empty for embedding storage. Source: % ID: % Type: %', 
      p_source_type, p_source_id, p_content_type;
  END IF;

  -- Validate that embedding is not null
  IF p_embedding IS NULL THEN
    RAISE EXCEPTION 'Embedding vector cannot be null. Source: % ID: % Type: %', 
      p_source_type, p_source_id, p_content_type;
  END IF;

  -- Start with the provided metadata
  enriched_metadata := COALESCE(p_metadata, '{}'::jsonb);

  -- Auto-enrich metadata with temporal context for receipts
  IF p_source_type = 'receipt' THEN
    -- Try to get receipt date from metadata first, then from receipts table
    receipt_date := (p_metadata->>'receipt_date')::date;
    
    IF receipt_date IS NULL THEN
      -- Fetch receipt date from receipts table
      SELECT date INTO receipt_date
      FROM receipts 
      WHERE id = p_source_id;
    END IF;
    
    -- If we have a receipt date, enrich with temporal metadata
    IF receipt_date IS NOT NULL THEN
      enriched_metadata := enriched_metadata || jsonb_build_object(
        'receipt_date', receipt_date::text,
        'temporal_context', CASE 
          WHEN receipt_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'recent'
          WHEN receipt_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'this_month'
          WHEN receipt_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'recent_quarter'
          WHEN receipt_date >= CURRENT_DATE - INTERVAL '365 days' THEN 'this_year'
          ELSE 'older'
        END,
        'date_bucket', date_trunc('week', receipt_date)::text,
        'month_bucket', date_trunc('month', receipt_date)::text,
        'quarter_bucket', date_trunc('quarter', receipt_date)::text,
        'year_bucket', date_trunc('year', receipt_date)::text,
        'days_ago', (CURRENT_DATE - receipt_date),
        'is_weekend', CASE 
          WHEN EXTRACT(dow FROM receipt_date) IN (0, 6) THEN true 
          ELSE false 
        END,
        'season', CASE 
          WHEN EXTRACT(month FROM receipt_date) IN (12, 1, 2) THEN 'winter'
          WHEN EXTRACT(month FROM receipt_date) IN (3, 4, 5) THEN 'spring'
          WHEN EXTRACT(month FROM receipt_date) IN (6, 7, 8) THEN 'summer'
          WHEN EXTRACT(month FROM receipt_date) IN (9, 10, 11) THEN 'autumn'
        END,
        'auto_enriched', true,
        'enriched_at', NOW()::text
      );
    END IF;
    
    -- Add receipt-specific metadata if not already present
    IF NOT (enriched_metadata ? 'total') THEN
      -- Fetch additional receipt data and merge it
      SELECT enriched_metadata || jsonb_build_object(
        'total', r.total,
        'currency', r.currency,
        'merchant', r.merchant,
        'category', r.predicted_category
      ) INTO enriched_metadata
      FROM receipts r 
      WHERE r.id = p_source_id;
    END IF;
  END IF;

  -- Auto-enrich metadata with temporal context for other source types
  IF p_source_type IN ('claim', 'custom_categorie', 'team_member') THEN
    enriched_metadata := enriched_metadata || jsonb_build_object(
      'temporal_context', 'recent',
      'creation_date_bucket', date_trunc('week', NOW()::date)::text,
      'days_since_creation', 0,
      'auto_enriched', true,
      'enriched_at', NOW()::text
    );
  END IF;

  -- Log the embedding storage for debugging
  RAISE NOTICE 'Storing embedding: source_type=%, source_id=%, content_type=%, content_length=%, temporal_context=%', 
    p_source_type, p_source_id, p_content_type, LENGTH(p_content_text), enriched_metadata->>'temporal_context';

  -- Insert or update embedding with enriched metadata
  INSERT INTO unified_embeddings (
    source_type, source_id, content_type, content_text,
    embedding, metadata, user_id, team_id, language,
    created_at, updated_at
  ) VALUES (
    p_source_type, p_source_id, p_content_type, p_content_text,
    p_embedding, enriched_metadata, p_user_id, p_team_id, p_language,
    NOW(), NOW()
  )
  ON CONFLICT (source_type, source_id, content_type)
  DO UPDATE SET
    content_text = EXCLUDED.content_text,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO embedding_id;

  RETURN embedding_id;
END;
$$;


ALTER FUNCTION "public"."add_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text", "p_content_text" "text", "p_embedding" "public"."vector", "p_metadata" "jsonb", "p_user_id" "uuid", "p_team_id" "uuid", "p_language" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text", "p_content_text" "text", "p_embedding" "public"."vector", "p_metadata" "jsonb", "p_user_id" "uuid", "p_team_id" "uuid", "p_language" "text") IS 'Enhanced embedding storage function with automatic temporal metadata enrichment for receipts and other source types';



CREATE OR REPLACE FUNCTION "public"."approve_claim"("_claim_id" "uuid", "_comment" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _claim_record public.claims;
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record
  FROM public.claims
  WHERE id = _claim_id;

  -- Check if claim exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user has permission (must be team admin/owner)
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _claim_record.team_id 
    AND tm.user_id = auth.uid() 
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to approve claim';
  END IF;

  -- Check if claim can be approved
  IF _claim_record.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Claim cannot be approved in current status: %', _claim_record.status;
  END IF;

  -- Update claim status
  UPDATE public.claims 
  SET 
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = NOW(),
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, old_status, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'approved', _claim_record.status, 'approved', _comment
  );

  -- Create notification for claimant with specific claim URL
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  ) VALUES (
    _claim_record.claimant_id, _claim_record.team_id, 'claim_approved', 'high',
    'Claim Approved',
    'Your claim "' || _claim_record.title || '" has been approved',
    '/claims/' || _claim_id,
    'claim', _claim_id
  );

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."approve_claim"("_claim_id" "uuid", "_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_notification"("_notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.notifications 
  SET archived_at = NOW()
  WHERE id = _notification_id 
  AND recipient_id = auth.uid();

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."archive_notification"("_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basic_search_receipts"("p_query" "text", "p_limit" integer DEFAULT 10, "p_offset" integer DEFAULT 0, "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_min_amount" numeric DEFAULT NULL::numeric, "p_max_amount" numeric DEFAULT NULL::numeric, "p_merchants" "text"[] DEFAULT NULL::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_query TEXT := p_query;
  v_receipts JSONB;
  v_total_count INTEGER;
  v_result JSONB;
BEGIN
  -- Convert query to lowercase and escape special characters
  v_query := lower(v_query);
  
  -- First count total matching results
  WITH matching_receipts AS (
    SELECT r.id
    FROM receipts r
    WHERE 
      -- Text search (basic like pattern)
      (
        v_query IS NULL OR v_query = '' OR
        lower(r.merchant) LIKE '%' || v_query || '%' OR
        CASE WHEN r.fulltext IS NOT NULL THEN lower(r.fulltext) ELSE '' END LIKE '%' || v_query || '%' OR
        CASE WHEN r.predicted_category IS NOT NULL THEN lower(r.predicted_category) ELSE '' END LIKE '%' || v_query || '%'
      )
      -- Date range filter
      AND (p_start_date IS NULL OR r.date >= p_start_date)
      AND (p_end_date IS NULL OR r.date <= p_end_date)
      -- Amount range filter
      AND (p_min_amount IS NULL OR r.total >= p_min_amount)
      AND (p_max_amount IS NULL OR r.total <= p_max_amount)
      -- Merchants filter
      AND (p_merchants IS NULL OR r.merchant = ANY(p_merchants))
  )
  SELECT COUNT(*) INTO v_total_count FROM matching_receipts;
  
  -- Then get the actual receipts with pagination
  WITH matching_receipts AS (
    SELECT 
      r.*,
      CASE
        WHEN lower(r.merchant) LIKE '%' || v_query || '%' THEN 0.9
        WHEN CASE WHEN r.predicted_category IS NOT NULL THEN lower(r.predicted_category) ELSE '' END LIKE '%' || v_query || '%' THEN 0.7
        WHEN CASE WHEN r.fulltext IS NOT NULL THEN lower(r.fulltext) ELSE '' END LIKE '%' || v_query || '%' THEN 0.5
        ELSE 0.1
      END AS match_score
    FROM receipts r
    WHERE 
      -- Text search (basic like pattern)
      (
        v_query IS NULL OR v_query = '' OR
        lower(r.merchant) LIKE '%' || v_query || '%' OR
        CASE WHEN r.fulltext IS NOT NULL THEN lower(r.fulltext) ELSE '' END LIKE '%' || v_query || '%' OR
        CASE WHEN r.predicted_category IS NOT NULL THEN lower(r.predicted_category) ELSE '' END LIKE '%' || v_query || '%'
      )
      -- Date range filter
      AND (p_start_date IS NULL OR r.date >= p_start_date)
      AND (p_end_date IS NULL OR r.date <= p_end_date)
      -- Amount range filter
      AND (p_min_amount IS NULL OR r.total >= p_min_amount)
      AND (p_max_amount IS NULL OR r.total <= p_max_amount)
      -- Merchants filter
      AND (p_merchants IS NULL OR r.merchant = ANY(p_merchants))
    ORDER BY match_score DESC, r.date DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id,
    'date', r.date,
    'merchant', r.merchant,
    'total', r.total,
    'currency', r.currency,
    'predicted_category', r.predicted_category,
    'status', r.status,
    'processing_status', r.processing_status,
    'similarity_score', r.match_score
  )) INTO v_receipts
  FROM matching_receipts r;
  
  -- Handle empty results
  IF v_receipts IS NULL THEN
    v_receipts := '[]'::jsonb;
  END IF;
  
  -- Build the final response
  v_result := jsonb_build_object(
    'success', TRUE,
    'results', jsonb_build_object(
      'receipts', v_receipts,
      'count', jsonb_array_length(v_receipts),
      'total', v_total_count
    ),
    'searchParams', jsonb_build_object(
      'query', p_query,
      'isVectorSearch', FALSE
    )
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."basic_search_receipts"("p_query" "text", "p_limit" integer, "p_offset" integer, "p_start_date" "date", "p_end_date" "date", "p_min_amount" numeric, "p_max_amount" numeric, "p_merchants" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_assign_category"("p_receipt_ids" "uuid"[], "p_category_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_user_id uuid;
  updated_count integer;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate category if provided
  IF p_category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.custom_categories 
      WHERE id = p_category_id AND user_id = current_user_id
    ) THEN
      RAISE EXCEPTION 'Category not found or access denied';
    END IF;
  END IF;

  -- Update receipts (only those belonging to the user)
  UPDATE public.receipts
  SET 
    custom_category_id = p_category_id,
    updated_at = now()
  WHERE id = ANY(p_receipt_ids)
    AND user_id = current_user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."bulk_assign_category"("p_receipt_ids" "uuid"[], "p_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_malaysian_tax"("total_amount" numeric, "tax_rate" numeric, "is_inclusive" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  tax_amount DECIMAL(10,2);
  subtotal DECIMAL(10,2);
  result JSONB;
BEGIN
  IF tax_rate = 0 THEN
    -- No tax applicable
    result := jsonb_build_object(
      'subtotal', total_amount,
      'tax_amount', 0.00,
      'tax_rate', tax_rate,
      'total', total_amount,
      'is_inclusive', is_inclusive,
      'calculation_method', 'zero_rated'
    );
  ELSIF is_inclusive THEN
    -- Tax is included in the total amount
    tax_amount := ROUND(total_amount * tax_rate / (100 + tax_rate), 2);
    subtotal := total_amount - tax_amount;
    result := jsonb_build_object(
      'subtotal', subtotal,
      'tax_amount', tax_amount,
      'tax_rate', tax_rate,
      'total', total_amount,
      'is_inclusive', is_inclusive,
      'calculation_method', 'inclusive'
    );
  ELSE
    -- Tax is added to the subtotal
    subtotal := total_amount;
    tax_amount := ROUND(total_amount * tax_rate / 100, 2);
    result := jsonb_build_object(
      'subtotal', subtotal,
      'tax_amount', tax_amount,
      'tax_rate', tax_rate,
      'total', subtotal + tax_amount,
      'is_inclusive', is_inclusive,
      'calculation_method', 'exclusive'
    );
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."calculate_malaysian_tax"("total_amount" numeric, "tax_rate" numeric, "is_inclusive" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_approve_claims"("_team_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT public.is_team_member(_team_id, _user_id, 'admin');
$$;


ALTER FUNCTION "public"."can_approve_claims"("_team_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_perform_action"("_user_id" "uuid" DEFAULT NULL::"uuid", "_action" "text" DEFAULT NULL::"text", "_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_id_to_check UUID;
  user_profile RECORD;
  action_result JSONB;
  sources_array TEXT[];
  limit_value INTEGER;
BEGIN
  -- Use provided user_id or get from auth context
  user_id_to_check := COALESCE(_user_id, auth.uid());
  
  IF user_id_to_check IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'User not authenticated',
      'tier', 'none'
    );
  END IF;

  -- Get user profile with subscription info
  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = user_id_to_check;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'User profile not found',
      'tier', 'none'
    );
  END IF;

  -- Handle unified search action
  IF _action = 'unified_search' THEN
    -- Properly parse JSON array to PostgreSQL array
    IF _payload ? 'sources' AND jsonb_typeof(_payload->'sources') = 'array' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(_payload->'sources')) INTO sources_array;
    ELSE
      sources_array := ARRAY['receipt'];
    END IF;
    
    -- Parse limit value
    limit_value := COALESCE((_payload->>'result_limit')::INTEGER, 10);
    
    RETURN public.can_perform_unified_search(
      user_id_to_check,
      sources_array,
      limit_value
    );
  END IF;

  -- Handle other existing actions (upload_batch, etc.)
  -- For now, allow all other actions
  
  -- Default fallback
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'Action not specifically restricted',
    'tier', COALESCE(user_profile.subscription_tier, 'free')
  );
END;
$$;


ALTER FUNCTION "public"."can_perform_action"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_perform_action"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") IS 'Fixed version - Comprehensive subscription limit checking with detailed response';



CREATE OR REPLACE FUNCTION "public"."can_perform_unified_search"("p_user_id" "uuid", "p_sources" "text"[], "p_result_limit" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_profile RECORD;
  tier_limits JSONB;
  daily_usage INTEGER;
  monthly_usage INTEGER;
BEGIN
  -- Get user profile with subscription info
  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'User profile not found',
      'tier', 'none'
    );
  END IF;

  -- Define tier limits (removed the circular call to can_perform_action)
  tier_limits := CASE COALESCE(user_profile.subscription_tier, 'free')
    WHEN 'free' THEN jsonb_build_object(
      'daily_searches', 50,
      'monthly_searches', 1000,
      'max_results_per_search', 10
    )
    WHEN 'pro' THEN jsonb_build_object(
      'daily_searches', 500,
      'monthly_searches', 10000,
      'max_results_per_search', 50
    )
    WHEN 'max' THEN jsonb_build_object(
      'daily_searches', -1,
      'monthly_searches', -1,
      'max_results_per_search', 100
    )
    ELSE jsonb_build_object(
      'daily_searches', 50,
      'monthly_searches', 1000,
      'max_results_per_search', 10
    )
  END;

  -- Check result limit
  IF p_result_limit > (tier_limits->>'max_results_per_search')::INTEGER 
     AND (tier_limits->>'max_results_per_search')::INTEGER > 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Result limit exceeds tier maximum of %s', tier_limits->>'max_results_per_search'),
      'tier', user_profile.subscription_tier
    );
  END IF;

  -- For now, allow all searches (we can add usage tracking later)
  -- TODO: Implement actual usage tracking if needed
  
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'Search allowed',
    'tier', COALESCE(user_profile.subscription_tier, 'free'),
    'limits', tier_limits
  );
END;
$$;


ALTER FUNCTION "public"."can_perform_unified_search"("p_user_id" "uuid", "p_sources" "text"[], "p_result_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_perform_unified_search"("p_user_id" "uuid", "p_sources" "text"[], "p_result_limit" integer) IS 'Checks if user can perform unified search based on subscription tier and applies appropriate filtering';



CREATE OR REPLACE FUNCTION "public"."can_review_claims"("_team_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT public.is_team_member(_team_id, _user_id, 'admin');
$$;


ALTER FUNCTION "public"."can_review_claims"("_team_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_submit_claims"("_team_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT public.is_team_member(_team_id, _user_id, 'member');
$$;


ALTER FUNCTION "public"."can_submit_claims"("_team_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_activity"() RETURNS TABLE("activity_type" "text", "details" "jsonb", "activity_timestamp" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Return team invitations
  RETURN QUERY
  SELECT 
    'team_invitation'::text,
    jsonb_build_object(
      'email', ti.email,
      'role', ti.role,
      'status', ti.status,
      'team_name', t.name
    ),
    ti.created_at
  FROM team_invitations ti
  JOIN teams t ON ti.team_id = t.id
  WHERE ti.created_at > NOW() - INTERVAL '1 hour'
  
  UNION ALL
  
  -- Return email deliveries
  SELECT 
    'email_delivery'::text,
    jsonb_build_object(
      'recipient', ed.recipient_email,
      'subject', ed.subject,
      'status', ed.status,
      'template', ed.template_name
    ),
    ed.created_at
  FROM email_deliveries ed
  WHERE ed.created_at > NOW() - INTERVAL '1 hour'
  
  ORDER BY activity_timestamp DESC;
END;
$$;


ALTER FUNCTION "public"."check_email_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_pgvector_status"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  extension_exists boolean;
  vector_table_exists boolean;
  api_key_exists boolean;
  result json;
begin
  -- Check if pgvector extension is installed
  select exists(
    select 1 from pg_catalog.pg_extension where extname = 'vector'
  ) into extension_exists;

  -- Check if receipt_embeddings table exists
  select exists(
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'receipt_embeddings'
  ) into vector_table_exists;
  
  -- Check if Gemini API key is set
  select exists(
    select 1 from pg_settings where name = 'app.settings.gemini_api_key' and setting is not null and setting != ''
  ) into api_key_exists;

  -- Return results as JSON
  result := json_build_object(
    'extension_exists', extension_exists,
    'vector_table_exists', vector_table_exists,
    'api_key_exists', api_key_exists
  );

  return result;
end;
$$;


ALTER FUNCTION "public"."check_pgvector_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_subscription_limit"("_user_id" "uuid" DEFAULT "auth"."uid"(), "_limit_type" "text" DEFAULT 'monthly_receipts'::"text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  user_tier public.subscription_tier;
  user_receipts_count INTEGER;
  tier_limit INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM public.profiles
  WHERE id = _user_id;

  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  -- Get the limit for this tier
  SELECT monthly_receipts INTO tier_limit
  FROM public.subscription_limits
  WHERE tier = user_tier;

  -- If unlimited (-1), return true
  IF tier_limit = -1 THEN
    RETURN true;
  END IF;

  -- Count user's receipts this month
  SELECT COUNT(*) INTO user_receipts_count
  FROM public.receipts
  WHERE user_id = _user_id
    AND created_at >= DATE_TRUNC('month', NOW());

  RETURN user_receipts_count < tier_limit;
END;
$$;


ALTER FUNCTION "public"."check_subscription_limit"("_user_id" "uuid", "_limit_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_subscription_limit"("_user_id" "uuid", "_limit_type" "text") IS 'Checks if user has exceeded their subscription limits';



CREATE OR REPLACE FUNCTION "public"."check_subscription_limit_enhanced"("_user_id" "uuid" DEFAULT "auth"."uid"(), "_action" "text" DEFAULT 'upload_receipt'::"text", "_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
BEGIN
  result := public.can_perform_action(_user_id, _action, _payload);
  RETURN (result->>'allowed')::BOOLEAN;
END;
$$;


ALTER FUNCTION "public"."check_subscription_limit_enhanced"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_subscription_limit_enhanced"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") IS 'Boolean wrapper for can_perform_action for backward compatibility';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_cache"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.performance_cache 
  WHERE expires_at < NOW();
  
  -- Log cleanup activity
  PERFORM public.log_performance_metric(
    'cache_cleanup', 
    'maintenance', 
    1, 
    'count', 
    jsonb_build_object('cleanup_timestamp', NOW())
  );
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_cache"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_cache"() IS 'Removes expired cache entries to maintain performance';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_conversations"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Archive conversations that have been inactive for more than 90 days
  UPDATE public.conversation_sessions 
  SET status = 'archived', updated_at = NOW()
  WHERE status = 'active' 
  AND last_activity_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Delete conversations that have been archived for more than 1 year
  DELETE FROM public.conversation_sessions 
  WHERE status = 'archived' 
  AND updated_at < NOW() - INTERVAL '1 year';
  
  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_conversations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_conversations"() IS 'Should be called periodically to clean up old conversations. Consider setting up with pg_cron or external scheduler.';



CREATE OR REPLACE FUNCTION "public"."column_exists"("p_table" "text", "p_column" "text", "p_schema" "text" DEFAULT 'public'::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = p_schema
        AND table_name = p_table
        AND column_name = p_column
    );
END;
$$;


ALTER FUNCTION "public"."column_exists"("p_table" "text", "p_column" "text", "p_schema" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_malaysian_currency"("amount" numeric, "from_currency" character varying, "to_currency" character varying, "conversion_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  exchange_rate DECIMAL(10,6);
  converted_amount DECIMAL(10,2);
  result JSONB;
BEGIN
  -- If same currency, no conversion needed
  IF from_currency = to_currency THEN
    RETURN jsonb_build_object(
      'original_amount', amount,
      'converted_amount', amount,
      'from_currency', from_currency,
      'to_currency', to_currency,
      'exchange_rate', 1.000000,
      'conversion_date', conversion_date,
      'formatted_amount', public.format_malaysian_currency(amount, to_currency)
    );
  END IF;
  
  -- Get exchange rate
  SELECT mcr.exchange_rate INTO exchange_rate
  FROM public.malaysian_currency_rates mcr
  WHERE 
    mcr.from_currency = convert_malaysian_currency.from_currency
    AND mcr.to_currency = convert_malaysian_currency.to_currency
    AND mcr.rate_date <= conversion_date
    AND mcr.is_active = true
  ORDER BY mcr.rate_date DESC
  LIMIT 1;
  
  -- If no direct rate found, try reverse rate
  IF exchange_rate IS NULL THEN
    SELECT (1.0 / mcr.exchange_rate) INTO exchange_rate
    FROM public.malaysian_currency_rates mcr
    WHERE 
      mcr.from_currency = convert_malaysian_currency.to_currency
      AND mcr.to_currency = convert_malaysian_currency.from_currency
      AND mcr.rate_date <= conversion_date
      AND mcr.is_active = true
    ORDER BY mcr.rate_date DESC
    LIMIT 1;
  END IF;
  
  -- If still no rate found, return error
  IF exchange_rate IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Exchange rate not found',
      'from_currency', from_currency,
      'to_currency', to_currency
    );
  END IF;
  
  -- Calculate converted amount
  converted_amount := ROUND(amount * exchange_rate, 2);
  
  -- Build result
  result := jsonb_build_object(
    'original_amount', amount,
    'converted_amount', converted_amount,
    'from_currency', from_currency,
    'to_currency', to_currency,
    'exchange_rate', exchange_rate,
    'conversion_date', conversion_date,
    'formatted_amount', public.format_malaysian_currency(converted_amount, to_currency)
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."convert_malaysian_currency"("amount" numeric, "from_currency" character varying, "to_currency" character varying, "conversion_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."convert_malaysian_currency"("amount" numeric, "from_currency" character varying, "to_currency" character varying, "conversion_date" "date") IS 'Converts between currencies using stored exchange rates';



CREATE OR REPLACE FUNCTION "public"."create_claim"("_team_id" "uuid", "_title" character varying, "_description" "text", "_amount" numeric, "_currency" character varying, "_category" character varying, "_priority" "public"."claim_priority", "_attachments" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _claim_id UUID;
BEGIN
  -- Check if user can submit claims in this team
  IF NOT public.can_submit_claims(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Insufficient permissions to create claims in this team';
  END IF;

  -- Insert the claim
  INSERT INTO public.claims (
    team_id, claimant_id, title, description, amount, currency, 
    category, priority, attachments
  ) VALUES (
    _team_id, auth.uid(), _title, _description, _amount, 
    COALESCE(_currency, 'USD'), _category, COALESCE(_priority, 'medium'), 
    COALESCE(_attachments, '[]'::jsonb)
  ) RETURNING id INTO _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'created', 'draft', 'Claim created'
  );

  RETURN _claim_id;
END;
$$;


ALTER FUNCTION "public"."create_claim"("_team_id" "uuid", "_title" character varying, "_description" "text", "_amount" numeric, "_currency" character varying, "_category" character varying, "_priority" "public"."claim_priority", "_attachments" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_conversation_session"("p_title" "text" DEFAULT NULL::"text", "p_session_type" "text" DEFAULT 'chat'::"text", "p_team_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate session type
  IF p_session_type NOT IN ('chat', 'search', 'analysis', 'support') THEN
    RAISE EXCEPTION 'Invalid session type: %', p_session_type;
  END IF;

  -- Create conversation session
  INSERT INTO conversation_sessions (
    user_id,
    team_id,
    title,
    session_type,
    metadata
  ) VALUES (
    v_user_id,
    p_team_id,
    p_title,
    p_session_type,
    p_metadata
  ) RETURNING id INTO v_conversation_id;

  -- Create initial context
  INSERT INTO chat_contexts (
    conversation_id,
    user_id,
    context_data,
    session_start_time
  ) VALUES (
    v_conversation_id,
    v_user_id,
    jsonb_build_object(
      'previousQueries', '[]'::jsonb,
      'searchHistory', '[]'::jsonb,
      'userPreferences', jsonb_build_object(
        'preferredResponseStyle', 'friendly',
        'commonSearchTerms', '[]'::jsonb,
        'frequentMerchants', '[]'::jsonb
      ),
      'timeOfDay', EXTRACT(HOUR FROM NOW()),
      'conversationLength', 0,
      'sessionStartTime', NOW()
    ),
    NOW()
  );

  -- Create initial analytics
  INSERT INTO conversation_analytics (
    conversation_id,
    user_id
  ) VALUES (
    v_conversation_id,
    v_user_id
  );

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."create_conversation_session"("p_title" "text", "p_session_type" "text", "p_team_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_conversation_session"("p_title" character varying DEFAULT NULL::character varying, "p_session_type" character varying DEFAULT 'chat'::character varying, "p_team_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Create the conversation session
  INSERT INTO public.conversation_sessions (
    user_id,
    team_id,
    title,
    session_type,
    metadata
  ) VALUES (
    v_user_id,
    p_team_id,
    p_title,
    p_session_type,
    p_metadata
  ) RETURNING id INTO v_conversation_id;
  
  -- Create initial chat context
  INSERT INTO public.chat_contexts (
    conversation_id,
    user_id,
    context_data,
    session_start_time
  ) VALUES (
    v_conversation_id,
    v_user_id,
    '{"sessionStartTime": "' || NOW()::text || '", "conversationLength": 0}',
    NOW()
  );
  
  -- Create initial analytics record
  INSERT INTO public.conversation_analytics (
    conversation_id,
    user_id
  ) VALUES (
    v_conversation_id,
    v_user_id
  );
  
  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."create_conversation_session"("p_title" character varying, "p_session_type" character varying, "p_team_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_custom_category"("p_name" "text", "p_color" "text" DEFAULT '#3B82F6'::"text", "p_icon" "text" DEFAULT 'tag'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  new_category_id uuid;
  current_user_id uuid;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate inputs
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Category name cannot be empty';
  END IF;

  IF char_length(trim(p_name)) > 50 THEN
    RAISE EXCEPTION 'Category name cannot exceed 50 characters';
  END IF;

  IF p_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Invalid color format. Use hex format like #3B82F6';
  END IF;

  -- Check for duplicate name
  IF EXISTS (
    SELECT 1 FROM public.custom_categories 
    WHERE user_id = current_user_id AND LOWER(name) = LOWER(trim(p_name))
  ) THEN
    RAISE EXCEPTION 'Category with this name already exists';
  END IF;

  -- Insert new category
  INSERT INTO public.custom_categories (user_id, name, color, icon)
  VALUES (current_user_id, trim(p_name), p_color, p_icon)
  RETURNING id INTO new_category_id;

  RETURN new_category_id;
END;
$_$;


ALTER FUNCTION "public"."create_custom_category"("p_name" "text", "p_color" "text", "p_icon" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_categories_for_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if user already has categories
  IF EXISTS (SELECT 1 FROM public.custom_categories WHERE user_id = p_user_id) THEN
    RETURN; -- User already has categories, don't create defaults
  END IF;

  -- Insert default categories
  INSERT INTO public.custom_categories (user_id, name, color, icon) VALUES
    (p_user_id, 'Food & Dining', '#F59E0B', 'utensils'),
    (p_user_id, 'Transportation', '#3B82F6', 'car'),
    (p_user_id, 'Shopping', '#10B981', 'shopping-cart'),
    (p_user_id, 'Business', '#6B7280', 'briefcase'),
    (p_user_id, 'Entertainment', '#8B5CF6', 'gamepad'),
    (p_user_id, 'Healthcare', '#EF4444', 'heart'),
    (p_user_id, 'Utilities', '#06B6D4', 'home'),
    (p_user_id, 'Travel', '#EC4899', 'plane');
END;
$$;


ALTER FUNCTION "public"."create_default_categories_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_chat_preferences"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Create default chat preferences for new users
  INSERT INTO public.user_chat_preferences (
    user_id,
    preferred_response_style,
    common_search_terms,
    frequent_merchants,
    search_filters,
    ui_preferences,
    notification_preferences
  ) VALUES (
    NEW.id,
    'friendly',
    '[]',
    '[]',
    '{}',
    '{"theme": "system", "compactMode": false}',
    '{"emailNotifications": true, "pushNotifications": false}'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_chat_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_email_delivery"("_recipient_email" character varying, "_subject" character varying, "_template_name" character varying, "_related_entity_type" character varying, "_related_entity_id" "uuid", "_team_id" "uuid", "_metadata" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _delivery_id UUID;
BEGIN
  INSERT INTO public.email_deliveries (
    recipient_email, subject, template_name, related_entity_type,
    related_entity_id, team_id, metadata
  ) VALUES (
    _recipient_email, _subject, _template_name, _related_entity_type,
    _related_entity_id, _team_id, COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO _delivery_id;

  RETURN _delivery_id;
END;
$$;


ALTER FUNCTION "public"."create_email_delivery"("_recipient_email" character varying, "_subject" character varying, "_template_name" character varying, "_related_entity_type" character varying, "_related_entity_id" "uuid", "_team_id" "uuid", "_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_expense_from_receipt"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if the status was updated to 'reviewed' and wasn't 'reviewed' before
  IF NEW.status = 'reviewed' AND OLD.status IS DISTINCT FROM 'reviewed' THEN
    -- Check if an expense record for this receipt_id already exists
    IF NOT EXISTS (SELECT 1 FROM public.expenses WHERE receipt_id = NEW.id) THEN
      -- Insert into the expenses table
      INSERT INTO public.expenses (user_id, receipt_id, date, description, amount, currency, category, created_at, updated_at)
      VALUES (
        NEW.user_id,         -- user_id from the updated receipt
        NEW.id,              -- receipt_id is the id of the updated receipt
        NEW.date,            -- date from the updated receipt
        NEW.merchant,        -- description from the receipt's merchant
        NEW.total,           -- amount from the receipt's total
        NEW.currency,        -- currency from the receipt
        NEW.predicted_category, -- category from the receipt (can be NULL)
        now(),               -- current timestamp for created_at
        now()                -- current timestamp for updated_at
      );
    END IF;
  END IF;

  -- Return the updated row
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_expense_from_receipt"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_first_admin"("_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO _user_id FROM auth.users WHERE email = _email;

  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if the user already has admin role
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Insert as admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin');

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."create_first_admin"("_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team"("_name" character varying, "_description" "text" DEFAULT NULL::"text", "_slug" character varying DEFAULT NULL::character varying) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _team_id UUID;
  _generated_slug VARCHAR(100);
BEGIN
  -- Generate slug if not provided
  IF _slug IS NULL THEN
    _generated_slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
    _generated_slug := trim(both '-' from _generated_slug);
    
    -- Ensure slug is unique
    WHILE EXISTS (SELECT 1 FROM public.teams WHERE slug = _generated_slug) LOOP
      _generated_slug := _generated_slug || '-' || floor(random() * 1000)::text;
    END LOOP;
  ELSE
    _generated_slug := _slug;
  END IF;

  -- Create the team
  INSERT INTO public.teams (name, description, slug, owner_id)
  VALUES (_name, _description, _generated_slug, auth.uid())
  RETURNING id INTO _team_id;

  -- Add the creator as the owner in team_members
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (_team_id, auth.uid(), 'owner');

  RETURN _team_id;
END;
$$;


ALTER FUNCTION "public"."create_team"("_name" character varying, "_description" "text", "_slug" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_conversation"("p_conversation_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."delete_conversation"("p_conversation_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_custom_category"("p_category_id" "uuid", "p_reassign_to_category_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_user_id uuid;
  category_exists boolean;
  receipt_count bigint;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if category exists and belongs to user
  SELECT EXISTS (
    SELECT 1 FROM public.custom_categories 
    WHERE id = p_category_id AND user_id = current_user_id
  ) INTO category_exists;

  IF NOT category_exists THEN
    RAISE EXCEPTION 'Category not found or access denied';
  END IF;

  -- Count receipts using this category
  SELECT COUNT(*) INTO receipt_count
  FROM public.receipts
  WHERE custom_category_id = p_category_id;

  -- If reassigning, validate the target category
  IF p_reassign_to_category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.custom_categories 
      WHERE id = p_reassign_to_category_id AND user_id = current_user_id
    ) THEN
      RAISE EXCEPTION 'Target category for reassignment not found or access denied';
    END IF;

    -- Reassign receipts to the new category
    UPDATE public.receipts
    SET custom_category_id = p_reassign_to_category_id
    WHERE custom_category_id = p_category_id;
  ELSE
    -- Set receipts to NULL (uncategorized)
    UPDATE public.receipts
    SET custom_category_id = NULL
    WHERE custom_category_id = p_category_id;
  END IF;

  -- Delete the category
  DELETE FROM public.custom_categories
  WHERE id = p_category_id AND user_id = current_user_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."delete_custom_category"("p_category_id" "uuid", "p_reassign_to_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_content_language"("content_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  malay_keywords TEXT[] := ARRAY[
    'ringgit', 'sen', 'jumlah', 'bayaran', 'cukai', 'gst', 'sst',
    'kedai', 'restoran', 'mamak', 'kopitiam', 'pasar', 'mall',
    'selamat', 'terima', 'kasih', 'sila', 'datang', 'lagi'
  ];
  english_keywords TEXT[] := ARRAY[
    'total', 'amount', 'payment', 'tax', 'receipt', 'invoice',
    'store', 'restaurant', 'shop', 'market', 'mall', 'center',
    'thank', 'you', 'please', 'come', 'again', 'welcome'
  ];
  chinese_keywords TEXT[] := ARRAY[
    '总额', '付款', '税', '收据', '商店', '餐厅', '谢谢'
  ];
  
  malay_count INTEGER := 0;
  english_count INTEGER := 0;
  chinese_count INTEGER := 0;
  total_words INTEGER;
  primary_language TEXT;
  confidence DECIMAL(5,2);
  
BEGIN
  -- Convert to lowercase for matching
  content_text := LOWER(content_text);
  
  -- Count keyword matches
  SELECT COUNT(*) INTO malay_count
  FROM unnest(malay_keywords) AS keyword
  WHERE content_text LIKE '%' || keyword || '%';
  
  SELECT COUNT(*) INTO english_count
  FROM unnest(english_keywords) AS keyword
  WHERE content_text LIKE '%' || keyword || '%';
  
  SELECT COUNT(*) INTO chinese_count
  FROM unnest(chinese_keywords) AS keyword
  WHERE content_text LIKE '%' || keyword || '%';
  
  -- Estimate total words
  total_words := array_length(string_to_array(trim(content_text), ' '), 1);
  
  -- Determine primary language
  IF malay_count >= english_count AND malay_count >= chinese_count THEN
    primary_language := 'ms';
    confidence := LEAST(95.0, (malay_count::DECIMAL / GREATEST(total_words, 1)) * 100 + 20);
  ELSIF chinese_count >= english_count THEN
    primary_language := 'zh';
    confidence := LEAST(95.0, (chinese_count::DECIMAL / GREATEST(total_words, 1)) * 100 + 20);
  ELSE
    primary_language := 'en';
    confidence := LEAST(95.0, (english_count::DECIMAL / GREATEST(total_words, 1)) * 100 + 30);
  END IF;
  
  -- Ensure minimum confidence
  confidence := GREATEST(confidence, 10.0);
  
  RETURN jsonb_build_object(
    'primary_language', primary_language,
    'confidence', confidence,
    'language_scores', jsonb_build_object(
      'malay', malay_count,
      'english', english_count,
      'chinese', chinese_count
    ),
    'total_words', total_words,
    'is_multilingual', (malay_count > 0 AND english_count > 0) OR 
                      (malay_count > 0 AND chinese_count > 0) OR 
                      (english_count > 0 AND chinese_count > 0)
  );
END;
$$;


ALTER FUNCTION "public"."detect_content_language"("content_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detect_content_language"("content_text" "text") IS 'Detects primary language in content for AI model optimization';



CREATE OR REPLACE FUNCTION "public"."detect_malaysian_payment_method"("receipt_text" "text") RETURNS TABLE("method_name" character varying, "method_type" character varying, "provider" character varying, "confidence_score" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mpm.method_name,
    mpm.method_type,
    mpm.provider,
    CASE 
      -- Exact keyword match gets highest score
      WHEN EXISTS (
        SELECT 1 FROM unnest(mpm.keywords) AS keyword
        WHERE LOWER(receipt_text) LIKE '%' || LOWER(keyword) || '%'
      ) THEN 90
      -- Partial match gets lower score
      WHEN LOWER(receipt_text) LIKE '%' || LOWER(mpm.method_name) || '%' THEN 70
      ELSE 0
    END as confidence_score
  FROM public.malaysian_payment_methods mpm
  WHERE 
    mpm.is_active = true
    AND (
      EXISTS (
        SELECT 1 FROM unnest(mpm.keywords) AS keyword
        WHERE LOWER(receipt_text) LIKE '%' || LOWER(keyword) || '%'
      )
      OR LOWER(receipt_text) LIKE '%' || LOWER(mpm.method_name) || '%'
    )
  ORDER BY confidence_score DESC, mpm.method_name
  LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."detect_malaysian_payment_method"("receipt_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detect_malaysian_payment_method"("receipt_text" "text") IS 'Detects payment methods from receipt text using keyword matching';



CREATE OR REPLACE FUNCTION "public"."detect_malaysian_tax_category"("merchant_name" "text", "receipt_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("tax_type" character varying, "tax_rate" numeric, "category_name" character varying, "confidence_score" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mtc.tax_type,
    mtc.tax_rate,
    mtc.category_name,
    mbc.confidence_weight as confidence_score
  FROM public.malaysian_business_categories mbc
  JOIN public.malaysian_tax_categories mtc ON mbc.tax_category_id = mtc.id
  WHERE 
    mtc.is_active = true
    AND (mtc.effective_from <= receipt_date)
    AND (mtc.effective_to IS NULL OR mtc.effective_to >= receipt_date)
    AND EXISTS (
      SELECT 1 FROM unnest(mbc.business_keywords) AS keyword
      WHERE LOWER(merchant_name) LIKE '%' || LOWER(keyword) || '%'
    )
  ORDER BY mbc.confidence_weight DESC, mtc.tax_rate DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."detect_malaysian_tax_category"("merchant_name" "text", "receipt_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enhanced_hybrid_search"("query_embedding" "public"."vector", "query_text" "text", "source_types" "text"[] DEFAULT ARRAY['receipt'::"text", 'claim'::"text", 'team_member'::"text", 'custom_category'::"text", 'business_directory'::"text"], "content_types" "text"[] DEFAULT NULL::"text"[], "similarity_threshold" double precision DEFAULT 0.2, "trigram_threshold" double precision DEFAULT 0.3, "semantic_weight" double precision DEFAULT 0.6, "keyword_weight" double precision DEFAULT 0.25, "trigram_weight" double precision DEFAULT 0.15, "match_count" integer DEFAULT 20, "user_filter" "uuid" DEFAULT NULL::"uuid", "team_filter" "uuid" DEFAULT NULL::"uuid", "language_filter" "text" DEFAULT NULL::"text", "amount_min" double precision DEFAULT NULL::double precision, "amount_max" double precision DEFAULT NULL::double precision, "amount_currency" "text" DEFAULT NULL::"text", "receipt_ids_filter" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("id" "uuid", "source_type" "text", "source_id" "uuid", "content_type" "text", "content_text" "text", "similarity" double precision, "trigram_similarity" double precision, "keyword_score" double precision, "combined_score" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Validate weights sum to approximately 1.0
  IF ABS((semantic_weight + keyword_weight + trigram_weight) - 1.0) > 0.01 THEN
    RAISE EXCEPTION 'Weights must sum to approximately 1.0. Current sum: %', 
      (semantic_weight + keyword_weight + trigram_weight);
  END IF;

  RETURN QUERY
  WITH combined_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      GREATEST(0::DOUBLE PRECISION, 1 - (ue.embedding <=> query_embedding)) as semantic_sim,
      GREATEST(0::DOUBLE PRECISION, similarity(ue.content_text, query_text)::DOUBLE PRECISION) as trigram_sim,
      CASE 
        WHEN ue.content_text ILIKE '%' || query_text || '%' THEN 1.0::DOUBLE PRECISION
        WHEN ue.content_text ILIKE '%' || split_part(query_text, ' ', 1) || '%' THEN 0.7::DOUBLE PRECISION
        WHEN ue.content_text ILIKE '%' || split_part(query_text, ' ', -1) || '%' THEN 0.7::DOUBLE PRECISION
        ELSE 0.0::DOUBLE PRECISION
      END as keyword_sc,
      ue.metadata
    FROM unified_embeddings ue
    LEFT JOIN receipts r ON (ue.source_type = 'receipt' AND ue.source_id = r.id)
    WHERE 
      (source_types IS NULL OR ue.source_type = ANY(source_types))
      AND (content_types IS NULL OR ue.content_type = ANY(content_types))
      AND (user_filter IS NULL OR ue.user_id = user_filter)
      AND (team_filter IS NULL OR ue.team_id = team_filter)
      AND (language_filter IS NULL OR ue.language = language_filter)
      AND (ue.source_type != 'receipt' OR r.id IS NOT NULL)
      AND (amount_min IS NULL OR ue.source_type != 'receipt' OR r.total >= amount_min)
      AND (amount_max IS NULL OR ue.source_type != 'receipt' OR r.total <= amount_max)
      AND (amount_currency IS NULL OR ue.source_type != 'receipt' OR r.currency = amount_currency)
      AND (receipt_ids_filter IS NULL OR ue.source_type != 'receipt' OR ue.source_id = ANY(receipt_ids_filter))
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
      AND ue.embedding IS NOT NULL
  )
  
  SELECT 
    cr.id,
    cr.source_type,
    cr.source_id,
    cr.content_type,
    cr.content_text,
    cr.semantic_sim as similarity,
    cr.trigram_sim as trigram_similarity,
    cr.keyword_sc as keyword_score,
    (cr.semantic_sim * semantic_weight) + 
    (cr.trigram_sim * trigram_weight) + 
    (cr.keyword_sc * keyword_weight) as combined_score,
    cr.metadata
  FROM combined_results cr
  WHERE
    (cr.semantic_sim > similarity_threshold OR
     cr.trigram_sim > trigram_threshold OR
     cr.keyword_sc > 0.01)
  ORDER BY 
    combined_score DESC,
    cr.semantic_sim DESC,
    cr.trigram_sim DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."enhanced_hybrid_search"("query_embedding" "public"."vector", "query_text" "text", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "trigram_threshold" double precision, "semantic_weight" double precision, "keyword_weight" double precision, "trigram_weight" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "amount_min" double precision, "amount_max" double precision, "amount_currency" "text", "receipt_ids_filter" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_business_directory_content"("p_business_id" "uuid") RETURNS TABLE("content_type" "text", "content_text" "text", "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  business_record RECORD;
  keywords_text TEXT;
  address_text TEXT;
BEGIN
  -- Get business data
  SELECT * INTO business_record
  FROM public.malaysian_business_directory
  WHERE id = p_business_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Extract keywords
  SELECT STRING_AGG(keyword, ' ') INTO keywords_text
  FROM unnest(business_record.keywords) AS keyword;
  
  -- Build address text
  address_text := CONCAT_WS(', ', 
    business_record.address, 
    business_record.city, 
    business_record.state, 
    business_record.postcode
  );
  
  -- Return business name content
  IF business_record.business_name IS NOT NULL AND LENGTH(TRIM(business_record.business_name)) > 0 THEN
    RETURN QUERY SELECT 
      'business_name'::TEXT,
      CONCAT_WS(' ', business_record.business_name, business_record.business_name_malay),
      jsonb_build_object(
        'business_type', business_record.business_type,
        'state', business_record.state,
        'city', business_record.city,
        'is_active', business_record.is_active
      );
  END IF;
  
  -- Return keywords content
  IF keywords_text IS NOT NULL AND LENGTH(TRIM(keywords_text)) > 0 THEN
    RETURN QUERY SELECT 
      'keywords'::TEXT,
      keywords_text,
      jsonb_build_object(
        'business_name', business_record.business_name,
        'business_type', business_record.business_type,
        'state', business_record.state
      );
  END IF;
  
  -- Return address content
  IF address_text IS NOT NULL AND LENGTH(TRIM(address_text)) > 0 THEN
    RETURN QUERY SELECT 
      'address'::TEXT,
      address_text,
      jsonb_build_object(
        'business_name', business_record.business_name,
        'postcode', business_record.postcode,
        'state', business_record.state,
        'city', business_record.city
      );
  END IF;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."extract_business_directory_content"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_claim_content"("p_claim_id" "uuid") RETURNS TABLE("content_type" "text", "content_text" "text", "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  claim_record RECORD;
  attachments_text TEXT;
BEGIN
  -- Get claim data
  SELECT * INTO claim_record
  FROM public.claims
  WHERE id = p_claim_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Extract attachment descriptions
  SELECT STRING_AGG(
    COALESCE(attachment->>'description', attachment->>'name', ''), 
    ' | '
  ) INTO attachments_text
  FROM jsonb_array_elements(COALESCE(claim_record.attachments, '[]'::jsonb)) AS attachment;
  
  -- Return title content
  IF claim_record.title IS NOT NULL AND LENGTH(TRIM(claim_record.title)) > 0 THEN
    RETURN QUERY SELECT 
      'title'::TEXT,
      claim_record.title,
      jsonb_build_object(
        'status', claim_record.status,
        'priority', claim_record.priority,
        'amount', claim_record.amount,
        'currency', claim_record.currency,
        'created_by', claim_record.created_by
      );
  END IF;
  
  -- Return description content
  IF claim_record.description IS NOT NULL AND LENGTH(TRIM(claim_record.description)) > 0 THEN
    RETURN QUERY SELECT 
      'description'::TEXT,
      claim_record.description,
      jsonb_build_object(
        'title', claim_record.title,
        'status', claim_record.status,
        'amount', claim_record.amount,
        'currency', claim_record.currency
      );
  END IF;
  
  -- Return attachments content
  IF attachments_text IS NOT NULL AND LENGTH(TRIM(attachments_text)) > 0 THEN
    RETURN QUERY SELECT 
      'attachments_text'::TEXT,
      attachments_text,
      jsonb_build_object(
        'title', claim_record.title,
        'attachment_count', jsonb_array_length(COALESCE(claim_record.attachments, '[]'::jsonb))
      );
  END IF;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."extract_claim_content"("p_claim_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_custom_category_content"("p_category_id" "uuid") RETURNS TABLE("content_type" "text", "content_text" "text", "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  category_record RECORD;
BEGIN
  -- Get category data
  SELECT * INTO category_record
  FROM public.custom_categories
  WHERE id = p_category_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Return name content
  IF category_record.name IS NOT NULL AND LENGTH(TRIM(category_record.name)) > 0 THEN
    RETURN QUERY SELECT 
      'name'::TEXT,
      category_record.name,
      jsonb_build_object(
        'color', category_record.color,
        'icon', category_record.icon,
        'user_id', category_record.user_id
      );
  END IF;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."extract_custom_category_content"("p_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_receipt_content"("p_receipt_id" "uuid") RETURNS TABLE("content_type" "text", "content_text" "text", "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  receipt_record RECORD;
  line_items_text TEXT;
BEGIN
  -- Get receipt data
  SELECT * INTO receipt_record
  FROM public.receipts
  WHERE id = p_receipt_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Extract line items text
  SELECT STRING_AGG(description, ' | ') INTO line_items_text
  FROM public.line_items
  WHERE receipt_id = p_receipt_id;
  
  -- Return full_text content
  IF receipt_record."fullText" IS NOT NULL AND LENGTH(TRIM(receipt_record."fullText")) > 0 THEN
    RETURN QUERY SELECT 
      'full_text'::TEXT,
      receipt_record."fullText",
      jsonb_build_object(
        'merchant', receipt_record.merchant,
        'total', receipt_record.total,
        'currency', receipt_record.currency,
        'date', receipt_record.date,
        'category', receipt_record.predicted_category
      );
  END IF;
  
  -- Return merchant content
  IF receipt_record.merchant IS NOT NULL AND LENGTH(TRIM(receipt_record.merchant)) > 0 THEN
    RETURN QUERY SELECT 
      'merchant'::TEXT,
      receipt_record.merchant,
      jsonb_build_object(
        'normalized_merchant', receipt_record.normalized_merchant,
        'total', receipt_record.total,
        'currency', receipt_record.currency,
        'date', receipt_record.date
      );
  END IF;
  
  -- Return line items content
  IF line_items_text IS NOT NULL AND LENGTH(TRIM(line_items_text)) > 0 THEN
    RETURN QUERY SELECT 
      'line_items'::TEXT,
      line_items_text,
      jsonb_build_object(
        'merchant', receipt_record.merchant,
        'total', receipt_record.total,
        'currency', receipt_record.currency,
        'item_count', (SELECT COUNT(*) FROM public.line_items WHERE receipt_id = p_receipt_id)
      );
  END IF;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."extract_receipt_content"("p_receipt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_team_member_content"("p_team_member_id" "uuid") RETURNS TABLE("content_type" "text", "content_text" "text", "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  member_record RECORD;
  profile_record RECORD;
  profile_text TEXT;
BEGIN
  -- Get team member data with profile
  SELECT tm.*, p.first_name, p.last_name, p.email
  INTO member_record
  FROM public.team_members tm
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  WHERE tm.id = p_team_member_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Build profile text
  profile_text := CONCAT_WS(' ', 
    member_record.first_name, 
    member_record.last_name, 
    member_record.email,
    member_record.role
  );
  
  -- Return profile content
  IF profile_text IS NOT NULL AND LENGTH(TRIM(profile_text)) > 0 THEN
    RETURN QUERY SELECT 
      'profile'::TEXT,
      profile_text,
      jsonb_build_object(
        'role', member_record.role,
        'email', member_record.email,
        'first_name', member_record.first_name,
        'last_name', member_record.last_name,
        'status', member_record.status,
        'team_id', member_record.team_id
      );
  END IF;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."extract_team_member_content"("p_team_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_missing_embeddings"("source_table" "text", "limit_count" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "missing_content_types" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Dynamic query based on source table
  CASE source_table
    WHEN 'receipts' THEN
      RETURN QUERY
      SELECT r.id, ARRAY['merchant', 'full_text']::TEXT[] as missing_content_types
      FROM receipts r
      WHERE NOT EXISTS (
        SELECT 1 FROM unified_embeddings ue 
        WHERE ue.source_type = 'receipt' 
        AND ue.source_id = r.id
      )
      LIMIT limit_count;
      
    WHEN 'claims' THEN
      RETURN QUERY
      SELECT c.id, ARRAY['title', 'description']::TEXT[] as missing_content_types
      FROM claims c
      WHERE NOT EXISTS (
        SELECT 1 FROM unified_embeddings ue 
        WHERE ue.source_type = 'claim' 
        AND ue.source_id = c.id
      )
      LIMIT limit_count;
      
    WHEN 'team_members' THEN
      RETURN QUERY
      SELECT tm.id, ARRAY['profile']::TEXT[] as missing_content_types
      FROM team_members tm
      JOIN profiles p ON tm.user_id = p.id
      WHERE NOT EXISTS (
        SELECT 1 FROM unified_embeddings ue 
        WHERE ue.source_type = 'team_member' 
        AND ue.source_id = tm.id
      )
      LIMIT limit_count;
      
    WHEN 'custom_categories' THEN
      RETURN QUERY
      SELECT cc.id, ARRAY['name']::TEXT[] as missing_content_types
      FROM custom_categories cc
      WHERE NOT EXISTS (
        SELECT 1 FROM unified_embeddings ue 
        WHERE ue.source_type = 'custom_category' 
        AND ue.source_id = cc.id
      )
      LIMIT limit_count;
      
    WHEN 'malaysian_business_directory' THEN
      RETURN QUERY
      SELECT mbd.id, ARRAY['business_name', 'keywords']::TEXT[] as missing_content_types
      FROM malaysian_business_directory mbd
      WHERE NOT EXISTS (
        SELECT 1 FROM unified_embeddings ue 
        WHERE ue.source_type = 'business_directory' 
        AND ue.source_id = mbd.id
      )
      LIMIT limit_count;
      
    ELSE
      -- Return empty result for unknown tables
      RETURN;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."find_missing_embeddings"("source_table" "text", "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_receipts_missing_embeddings"("limit_count" integer DEFAULT 10) RETURNS TABLE("receipt_id" "uuid", "merchant" character varying, "date" "date", "missing_content_types" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS receipt_id,
    r.merchant,
    r.date,
    ARRAY(
      SELECT content_type 
      FROM (VALUES ('full_text'), ('merchant')) AS ct(content_type)
      WHERE NOT EXISTS (
        SELECT 1 FROM unified_embeddings ue 
        WHERE ue.source_type = 'receipt' 
          AND ue.source_id = r.id 
          AND ue.content_type = ct.content_type
      )
      AND (
        (ct.content_type = 'full_text' AND r."fullText" IS NOT NULL AND TRIM(r."fullText") != '') OR
        (ct.content_type = 'merchant' AND r.merchant IS NOT NULL AND TRIM(r.merchant) != '')
      )
    ) AS missing_content_types
  FROM receipts r
  WHERE EXISTS (
    SELECT content_type 
    FROM (VALUES ('full_text'), ('merchant')) AS ct(content_type)
    WHERE NOT EXISTS (
      SELECT 1 FROM unified_embeddings ue 
      WHERE ue.source_type = 'receipt' 
        AND ue.source_id = r.id 
        AND ue.content_type = ct.content_type
    )
    AND (
      (ct.content_type = 'full_text' AND r."fullText" IS NOT NULL AND TRIM(r."fullText") != '') OR
      (ct.content_type = 'merchant' AND r.merchant IS NOT NULL AND TRIM(r.merchant) != '')
    )
  )
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."find_receipts_missing_embeddings"("limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_receipt_embedding_content"() RETURNS TABLE("embedding_id" "uuid", "receipt_id" "uuid", "content_type" "text", "original_content" "text", "fixed_content" "text", "success" boolean, "error_message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  rec RECORD;
  receipt_data RECORD;
  new_content TEXT;
  fix_success BOOLEAN;
  error_msg TEXT;
BEGIN
  -- Loop through all receipt embeddings with empty content
  FOR rec IN 
    SELECT ue.id, ue.source_id, ue.content_type, ue.content_text
    FROM unified_embeddings ue
    WHERE ue.source_type = 'receipt' 
      AND (ue.content_text IS NULL OR TRIM(ue.content_text) = '')
  LOOP
    -- Get the receipt data
    SELECT r.merchant, r."fullText", r.date, r.total, r.payment_method, r.predicted_category
    INTO receipt_data
    FROM receipts r
    WHERE r.id = rec.source_id;

    -- Initialize variables
    new_content := '';
    fix_success := FALSE;
    error_msg := NULL;

    BEGIN
      -- Determine content based on content_type
      CASE rec.content_type
        WHEN 'merchant' THEN
          new_content := COALESCE(receipt_data.merchant, '');
        WHEN 'full_text' THEN
          new_content := COALESCE(receipt_data."fullText", '');
        WHEN 'fallback' THEN
          new_content := CONCAT_WS(E'\n',
            CASE WHEN receipt_data.merchant IS NOT NULL THEN 'Merchant: ' || receipt_data.merchant END,
            CASE WHEN receipt_data.date IS NOT NULL THEN 'Date: ' || receipt_data.date END,
            CASE WHEN receipt_data.total IS NOT NULL THEN 'Total: ' || receipt_data.total END
          );
        WHEN 'line_item' THEN
          -- For line items, use merchant as fallback since line item data is in separate table
          new_content := COALESCE(receipt_data.merchant, '');
        ELSE
          new_content := COALESCE(receipt_data.merchant, '');
      END CASE;

      -- Only update if we have content
      IF new_content IS NOT NULL AND TRIM(new_content) != '' THEN
        UPDATE unified_embeddings 
        SET content_text = new_content, updated_at = NOW()
        WHERE id = rec.id;
        
        fix_success := TRUE;
      ELSE
        error_msg := 'No content available to fix';
      END IF;

    EXCEPTION WHEN OTHERS THEN
      fix_success := FALSE;
      error_msg := SQLERRM;
    END;

    -- Return the result
    embedding_id := rec.id;
    receipt_id := rec.source_id;
    content_type := rec.content_type;
    original_content := rec.content_text;
    fixed_content := new_content;
    success := fix_success;
    error_message := error_msg;
    
    RETURN NEXT;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."fix_receipt_embedding_content"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_malaysian_currency"("amount" numeric, "currency_code" character varying DEFAULT 'MYR'::character varying, "include_symbol" boolean DEFAULT true) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  formatted_amount TEXT;
  currency_symbol TEXT;
BEGIN
  -- Format the amount with commas for thousands
  formatted_amount := TO_CHAR(amount, 'FM999,999,999,990.00');
  
  -- Determine currency symbol
  CASE currency_code
    WHEN 'MYR' THEN currency_symbol := 'RM';
    WHEN 'USD' THEN currency_symbol := '$';
    WHEN 'SGD' THEN currency_symbol := 'S$';
    WHEN 'EUR' THEN currency_symbol := '€';
    WHEN 'GBP' THEN currency_symbol := '£';
    WHEN 'JPY' THEN currency_symbol := '¥';
    WHEN 'CNY' THEN currency_symbol := '¥';
    WHEN 'THB' THEN currency_symbol := '฿';
    WHEN 'IDR' THEN currency_symbol := 'Rp';
    ELSE currency_symbol := currency_code || ' ';
  END CASE;
  
  -- Return formatted currency
  IF include_symbol THEN
    RETURN currency_symbol || ' ' || formatted_amount;
  ELSE
    RETURN formatted_amount;
  END IF;
END;
$_$;


ALTER FUNCTION "public"."format_malaysian_currency"("amount" numeric, "currency_code" character varying, "include_symbol" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."format_malaysian_currency"("amount" numeric, "currency_code" character varying, "include_symbol" boolean) IS 'Formats currency amounts in Malaysian style with proper symbols';



CREATE OR REPLACE FUNCTION "public"."format_malaysian_date"("input_date" "date", "format_preference" character varying DEFAULT 'DD/MM/YYYY'::character varying, "separator_preference" character varying DEFAULT '/'::character varying) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  formatted_date TEXT;
BEGIN
  CASE format_preference
    WHEN 'DD/MM/YYYY' THEN
      formatted_date := TO_CHAR(input_date, 'DD') || separator_preference || 
                       TO_CHAR(input_date, 'MM') || separator_preference || 
                       TO_CHAR(input_date, 'YYYY');
    WHEN 'MM/DD/YYYY' THEN
      formatted_date := TO_CHAR(input_date, 'MM') || separator_preference || 
                       TO_CHAR(input_date, 'DD') || separator_preference || 
                       TO_CHAR(input_date, 'YYYY');
    WHEN 'YYYY-MM-DD' THEN
      formatted_date := TO_CHAR(input_date, 'YYYY-MM-DD');
    WHEN 'DD-MM-YYYY' THEN
      formatted_date := TO_CHAR(input_date, 'DD-MM-YYYY');
    ELSE
      -- Default to DD/MM/YYYY
      formatted_date := TO_CHAR(input_date, 'DD/MM/YYYY');
  END CASE;
  
  RETURN formatted_date;
END;
$$;


ALTER FUNCTION "public"."format_malaysian_date"("input_date" "date", "format_preference" character varying, "separator_preference" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."format_malaysian_date"("input_date" "date", "format_preference" character varying, "separator_preference" character varying) IS 'Formats dates according to Malaysian cultural preferences';



CREATE OR REPLACE FUNCTION "public"."format_malaysian_number"("input_number" numeric, "format_style" character varying DEFAULT 'MY'::character varying, "thousands_sep" character varying DEFAULT ','::character varying, "decimal_sep" character varying DEFAULT '.'::character varying) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  formatted_number TEXT;
  integer_part TEXT;
  decimal_part TEXT;
BEGIN
  -- Split number into integer and decimal parts
  integer_part := FLOOR(input_number)::TEXT;
  decimal_part := LPAD(((input_number - FLOOR(input_number)) * 100)::INTEGER::TEXT, 2, '0');
  
  CASE format_style
    WHEN 'MY' THEN
      -- Malaysian style: 1,234.56
      formatted_number := REGEXP_REPLACE(integer_part, '(\d)(?=(\d{3})+(?!\d))', '\1' || thousands_sep, 'g');
      IF decimal_part != '00' THEN
        formatted_number := formatted_number || decimal_sep || decimal_part;
      END IF;
    WHEN 'EU' THEN
      -- European style: 1.234,56
      formatted_number := REGEXP_REPLACE(integer_part, '(\d)(?=(\d{3})+(?!\d))', '\1.', 'g');
      IF decimal_part != '00' THEN
        formatted_number := formatted_number || ',' || decimal_part;
      END IF;
    ELSE
      -- Default Malaysian style
      formatted_number := REGEXP_REPLACE(integer_part, '(\d)(?=(\d{3})+(?!\d))', '\1,', 'g');
      IF decimal_part != '00' THEN
        formatted_number := formatted_number || '.' || decimal_part;
      END IF;
  END CASE;
  
  RETURN formatted_number;
END;
$$;


ALTER FUNCTION "public"."format_malaysian_number"("input_number" numeric, "format_style" character varying, "thousands_sep" character varying, "decimal_sep" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."format_malaysian_number"("input_number" numeric, "format_style" character varying, "thousands_sep" character varying, "decimal_sep" character varying) IS 'Formats numbers according to Malaysian cultural preferences';



CREATE OR REPLACE FUNCTION "public"."format_malaysian_time"("input_time" time without time zone, "format_preference" character varying DEFAULT '24h'::character varying, "separator_preference" character varying DEFAULT ':'::character varying) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  formatted_time TEXT;
BEGIN
  CASE format_preference
    WHEN '12h' THEN
      formatted_time := TO_CHAR(input_time, 'HH12') || separator_preference || 
                       TO_CHAR(input_time, 'MI') || ' ' || 
                       TO_CHAR(input_time, 'AM');
    WHEN '24h' THEN
      formatted_time := TO_CHAR(input_time, 'HH24') || separator_preference || 
                       TO_CHAR(input_time, 'MI');
    ELSE
      -- Default to 24h
      formatted_time := TO_CHAR(input_time, 'HH24:MI');
  END CASE;
  
  RETURN formatted_time;
END;
$$;


ALTER FUNCTION "public"."format_malaysian_time"("input_time" time without time zone, "format_preference" character varying, "separator_preference" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."format_malaysian_time"("input_time" time without time zone, "format_preference" character varying, "separator_preference" character varying) IS 'Formats time according to Malaysian cultural preferences';



CREATE OR REPLACE FUNCTION "public"."generate_line_item_embeddings"("p_line_item_id" "uuid", "p_embedding" "public"."vector") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update the line item with the provided embedding
  UPDATE public.line_items
  SET 
    embedding = p_embedding,
    updated_at = NOW()
  WHERE id = p_line_item_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."generate_line_item_embeddings"("p_line_item_id" "uuid", "p_embedding" "public"."vector") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_receipt_embeddings"("p_receipt_id" "uuid", "p_process_all_fields" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_receipt RECORD;
  v_embedding VECTOR(1536);
  v_content_text TEXT;
  v_embedding_id UUID;
  v_result JSONB := jsonb_build_object('success', FALSE);
  v_processed_count INT := 0;
BEGIN
  -- Check if the receipt exists
  SELECT * INTO v_receipt FROM receipts WHERE id = p_receipt_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Receipt not found',
      'receiptId', p_receipt_id
    );
  END IF;
  
  -- This is just a placeholder function that marks the receipt as processed
  -- without actually generating embeddings (since that requires the Gemini API)
  -- In a real implementation, you would call the API to generate embeddings
  
  -- Mark embeddings as processed in the receipt table
  UPDATE receipts
  SET has_embeddings = TRUE,
      embedding_status = 'processed',
      updated_at = NOW()
  WHERE id = p_receipt_id;
  
  -- Insert a placeholder embedding record
  INSERT INTO receipt_embeddings (
    receipt_id,
    content_type,
    embedding,
    metadata
  )
  VALUES (
    p_receipt_id,
    'database_function',
    '[0.1, 0.2, 0.3]'::vector(1536), -- placeholder vector
    jsonb_build_object(
      'generated_by', 'database_function',
      'timestamp', NOW()
    )
  )
  RETURNING id INTO v_embedding_id;
  
  v_processed_count := 1;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', TRUE,
    'receiptId', p_receipt_id,
    'processedCount', v_processed_count,
    'embeddingIds', jsonb_build_array(v_embedding_id)
  );
END;
$$;


ALTER FUNCTION "public"."generate_receipt_embeddings"("p_receipt_id" "uuid", "p_process_all_fields" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_users"() RETURNS TABLE("id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "confirmed_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone, "created_at" timestamp with time zone, "roles" "jsonb")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT
    au.id,
    au.email,
    p.first_name,
    p.last_name,
    au.confirmed_at,
    au.last_sign_in_at,
    au.created_at,
    COALESCE(
      (SELECT json_agg(ur.role)
       FROM public.user_roles ur
       WHERE ur.user_id = au.id),
      '[]'::json
    ) as roles
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE public.has_role('admin'::public.app_role) -- Only admins can access
  ORDER BY au.created_at DESC;
$$;


ALTER FUNCTION "public"."get_admin_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_statistics"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("total_conversations" integer, "active_conversations" integer, "total_messages" integer, "total_searches" integer, "avg_session_duration" numeric, "top_search_terms" "jsonb", "conversation_types" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Get the current user ID
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  ) INTO v_is_admin;
  
  -- If not admin and requesting stats for different user, deny access
  IF NOT v_is_admin AND p_user_id IS NOT NULL AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT cs.id)::INTEGER as total_conversations,
    COUNT(DISTINCT CASE WHEN cs.status = 'active' THEN cs.id END)::INTEGER as active_conversations,
    COALESCE(SUM(ca.message_count), 0)::INTEGER as total_messages,
    COALESCE(SUM(ca.search_count), 0)::INTEGER as total_searches,
    COALESCE(AVG(ca.session_duration_seconds), 0)::NUMERIC as avg_session_duration,
    COALESCE(
      jsonb_agg(DISTINCT ca.top_search_terms) FILTER (WHERE ca.top_search_terms IS NOT NULL),
      '[]'::jsonb
    ) as top_search_terms,
    COALESCE(
      jsonb_object_agg(cs.session_type, COUNT(cs.session_type)) FILTER (WHERE cs.session_type IS NOT NULL),
      '{}'::jsonb
    ) as conversation_types
  FROM public.conversation_sessions cs
  LEFT JOIN public.conversation_analytics ca ON cs.id = ca.conversation_id
  WHERE cs.user_id = v_user_id
  AND cs.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$;


ALTER FUNCTION "public"."get_chat_statistics"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversation_context"("p_conversation_id" "text", "p_context_type" "text" DEFAULT NULL::"text", "p_min_relevance" numeric DEFAULT 0.5) RETURNS TABLE("context_type" "text", "context_data" "jsonb", "relevance_score" numeric, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.context_type,
    cc.context_data,
    cc.relevance_score,
    cc.created_at
  FROM conversation_contexts cc
  WHERE cc.user_id = auth.uid()
    AND cc.conversation_id = p_conversation_id
    AND (p_context_type IS NULL OR cc.context_type = p_context_type)
    AND cc.relevance_score >= p_min_relevance
    AND (cc.expires_at IS NULL OR cc.expires_at > NOW())
  ORDER BY cc.relevance_score DESC, cc.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_min_relevance" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversation_context_window"("p_conversation_id" "text", "p_max_tokens" integer DEFAULT 4000, "p_include_memory" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
  SELECT contexts INTO conversation_context
  FROM context_data;

  -- Get user memory if requested
  IF p_include_memory THEN
    WITH memory_data AS (
      SELECT jsonb_object_agg(memory_type, jsonb_agg(memory_data)) as memories
      FROM conversation_memory
      WHERE user_id = auth.uid()
        AND confidence_score >= 0.7
        AND last_accessed >= NOW() - INTERVAL '30 days'
    )
    SELECT memories INTO user_memory
    FROM memory_data;
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


ALTER FUNCTION "public"."get_conversation_context_window"("p_conversation_id" "text", "p_max_tokens" integer, "p_include_memory" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversation_memory"("p_memory_type" "text" DEFAULT NULL::"text", "p_memory_key" "text" DEFAULT NULL::"text", "p_min_confidence" numeric DEFAULT 0.3, "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "memory_type" "text", "memory_key" "text", "memory_data" "jsonb", "confidence_score" numeric, "source_conversations" "text"[], "last_accessed" timestamp with time zone, "access_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update last_accessed for accessed memories (fix all ambiguous column references)
  UPDATE conversation_memory 
  SET 
    last_accessed = NOW(),
    access_count = conversation_memory.access_count + 1
  WHERE conversation_memory.user_id = auth.uid()
    AND (p_memory_type IS NULL OR conversation_memory.memory_type = p_memory_type)
    AND (p_memory_key IS NULL OR conversation_memory.memory_key = p_memory_key)
    AND conversation_memory.confidence_score >= p_min_confidence;
  
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
    cm.created_at,
    cm.updated_at
  FROM conversation_memory cm
  WHERE cm.user_id = auth.uid()
    AND (p_memory_type IS NULL OR cm.memory_type = p_memory_type)
    AND (p_memory_key IS NULL OR cm.memory_key = p_memory_key)
    AND cm.confidence_score >= p_min_confidence
  ORDER BY cm.confidence_score DESC, cm.last_accessed DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_min_confidence" numeric, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversation_messages"("p_conversation_id" "text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0, "p_include_metadata" boolean DEFAULT false) RETURNS TABLE("message_id" "text", "message_type" "text", "content" "text", "metadata" "jsonb", "parent_message_id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.message_id,
    cm.message_type,
    cm.content,
    CASE WHEN p_include_metadata THEN cm.metadata ELSE '{}'::jsonb END,
    cm.parent_message_id,
    cm.created_at
  FROM conversation_messages cm
  WHERE cm.user_id = auth.uid()
    AND cm.conversation_id = p_conversation_id
  ORDER BY cm.created_at ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_conversation_messages"("p_conversation_id" "text", "p_limit" integer, "p_offset" integer, "p_include_metadata" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversation_with_messages"("p_conversation_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("conversation_data" "jsonb", "messages_data" "jsonb", "context_data" "jsonb", "analytics_data" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_conversation JSONB;
  v_messages JSONB;
  v_context JSONB;
  v_analytics JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get conversation
  SELECT to_jsonb(cs.*) INTO v_conversation
  FROM conversation_sessions cs
  WHERE cs.id = p_conversation_id
    AND (cs.user_id = v_user_id OR (
      cs.team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = cs.team_id 
        AND user_id = v_user_id
      )
    ));

  IF v_conversation IS NULL THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;

  -- Get messages
  SELECT jsonb_agg(to_jsonb(cm.*) ORDER BY cm.created_at ASC) INTO v_messages
  FROM chat_messages cm
  WHERE cm.conversation_id = p_conversation_id
    AND NOT cm.is_deleted
  ORDER BY cm.created_at ASC
  LIMIT p_limit OFFSET p_offset;

  -- Get context
  SELECT to_jsonb(cc.*) INTO v_context
  FROM chat_contexts cc
  WHERE cc.conversation_id = p_conversation_id;

  -- Get analytics
  SELECT to_jsonb(ca.*) INTO v_analytics
  FROM conversation_analytics ca
  WHERE ca.conversation_id = p_conversation_id;

  RETURN QUERY SELECT v_conversation, v_messages, v_context, v_analytics;
END;
$$;


ALTER FUNCTION "public"."get_conversation_with_messages"("p_conversation_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_embedding_migration_stats"() RETURNS TABLE("total_receipts" bigint, "receipts_with_old_embeddings" bigint, "receipts_with_unified_embeddings" bigint, "receipts_missing_embeddings" bigint, "migration_needed" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  total_count BIGINT;
  old_embedding_count BIGINT;
  unified_embedding_count BIGINT;
  missing_count BIGINT;
BEGIN
  -- Get total receipts
  SELECT COUNT(*) INTO total_count FROM receipts;
  
  -- Get receipts with old embeddings
  SELECT COUNT(DISTINCT receipt_id) INTO old_embedding_count 
  FROM receipt_embeddings;
  
  -- Get receipts with unified embeddings
  SELECT COUNT(DISTINCT source_id) INTO unified_embedding_count 
  FROM unified_embeddings 
  WHERE source_type = 'receipt';
  
  -- Calculate missing
  missing_count := total_count - unified_embedding_count;
  
  RETURN QUERY SELECT 
    total_count,
    old_embedding_count,
    unified_embedding_count,
    missing_count,
    (old_embedding_count > 0 AND unified_embedding_count < old_embedding_count) AS migration_needed;
END;
$$;


ALTER FUNCTION "public"."get_embedding_migration_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feedback_analytics"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("total_feedback" bigint, "positive_feedback" bigint, "negative_feedback" bigint, "positive_percentage" numeric, "feedback_by_day" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  ) INTO is_admin;

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


ALTER FUNCTION "public"."get_feedback_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invitation_by_token"("_token" character varying, "_pending_only" boolean DEFAULT true) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _invitation RECORD;
  _team_name VARCHAR(255);
  _inviter_name VARCHAR(255);
  _result JSON;
BEGIN
  -- Get invitation details
  IF _pending_only THEN
    SELECT * INTO _invitation
    FROM public.team_invitations
    WHERE token = _token AND status = 'pending' AND expires_at > NOW();
  ELSE
    SELECT * INTO _invitation
    FROM public.team_invitations
    WHERE token = _token;
  END IF;

  IF _invitation IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get team name
  SELECT name INTO _team_name
  FROM public.teams
  WHERE id = _invitation.team_id;

  -- Get inviter name
  SELECT COALESCE(
    CASE 
      WHEN first_name IS NOT NULL THEN TRIM(first_name || ' ' || COALESCE(last_name, ''))
      ELSE email
    END,
    'Unknown'
  ) INTO _inviter_name
  FROM public.profiles
  WHERE id = _invitation.invited_by;

  -- Build result JSON
  _result := json_build_object(
    'id', _invitation.id,
    'team_id', _invitation.team_id,
    'email', _invitation.email,
    'role', _invitation.role,
    'invited_by', _invitation.invited_by,
    'status', _invitation.status,
    'token', _invitation.token,
    'expires_at', _invitation.expires_at,
    'accepted_at', _invitation.accepted_at,
    'created_at', _invitation.created_at,
    'updated_at', _invitation.updated_at,
    'team_name', _team_name,
    'invited_by_name', _inviter_name
  );

  RETURN _result;
END;
$$;


ALTER FUNCTION "public"."get_invitation_by_token"("_token" character varying, "_pending_only" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_malaysian_exchange_rate"("from_currency" character varying, "to_currency" character varying) RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  rate DECIMAL(10,6);
BEGIN
  -- Get the latest exchange rate
  SELECT mcr.exchange_rate INTO rate
  FROM public.malaysian_currency_rates mcr
  WHERE 
    mcr.from_currency = get_latest_malaysian_exchange_rate.from_currency
    AND mcr.to_currency = get_latest_malaysian_exchange_rate.to_currency
    AND mcr.is_active = true
  ORDER BY mcr.rate_date DESC
  LIMIT 1;
  
  -- If no direct rate, try reverse
  IF rate IS NULL THEN
    SELECT (1.0 / mcr.exchange_rate) INTO rate
    FROM public.malaysian_currency_rates mcr
    WHERE 
      mcr.from_currency = get_latest_malaysian_exchange_rate.to_currency
      AND mcr.to_currency = get_latest_malaysian_exchange_rate.from_currency
      AND mcr.is_active = true
    ORDER BY mcr.rate_date DESC
    LIMIT 1;
  END IF;
  
  RETURN rate;
END;
$$;


ALTER FUNCTION "public"."get_latest_malaysian_exchange_rate"("from_currency" character varying, "to_currency" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_latest_malaysian_exchange_rate"("from_currency" character varying, "to_currency" character varying) IS 'Gets the latest exchange rate between two currencies';



CREATE OR REPLACE FUNCTION "public"."get_line_items_without_embeddings_for_receipt"("p_receipt_id" "uuid") RETURNS TABLE("id" "uuid", "description" "text", "amount" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$ BEGIN RETURN QUERY SELECT li.id, li.description, li.amount FROM public.line_items li WHERE li.receipt_id = p_receipt_id AND li.description IS NOT NULL AND NOT EXISTS ( SELECT 1 FROM public.receipt_embeddings re WHERE re.content_type = 'line_item' AND re.receipt_id = p_receipt_id AND (re.metadata->>'line_item_id')::uuid = li.id ); END; $$;


ALTER FUNCTION "public"."get_line_items_without_embeddings_for_receipt"("p_receipt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_malaysian_business_days"("start_date" "date", "end_date" "date", "state_code" character varying DEFAULT NULL::character varying) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  business_days INTEGER := 0;
  check_date DATE := start_date;
  day_of_week INTEGER;
  holiday_check JSONB;
BEGIN
  WHILE check_date <= end_date LOOP
    -- Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    day_of_week := EXTRACT(DOW FROM check_date);
    
    -- Check if it's a weekday (Monday to Friday)
    IF day_of_week BETWEEN 1 AND 5 THEN
      -- Check if it's not a public holiday
      holiday_check := public.is_malaysian_public_holiday(check_date, state_code);
      
      IF NOT (holiday_check->>'is_holiday')::BOOLEAN THEN
        business_days := business_days + 1;
      END IF;
    END IF;
    
    check_date := check_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN business_days;
END;
$$;


ALTER FUNCTION "public"."get_malaysian_business_days"("start_date" "date", "end_date" "date", "state_code" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_malaysian_business_days"("start_date" "date", "end_date" "date", "state_code" character varying) IS 'Calculates business days excluding weekends and Malaysian holidays';



CREATE OR REPLACE FUNCTION "public"."get_malaysian_business_hours"("business_type_param" character varying, "day_of_week_param" integer DEFAULT NULL::integer) RETURNS TABLE("day_of_week" integer, "open_time" time without time zone, "close_time" time without time zone, "is_closed" boolean, "notes" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mbh.day_of_week,
    mbh.open_time,
    mbh.close_time,
    mbh.is_closed,
    mbh.notes
  FROM public.malaysian_business_hours mbh
  WHERE 
    mbh.business_type = business_type_param
    AND (day_of_week_param IS NULL OR mbh.day_of_week = day_of_week_param)
  ORDER BY mbh.day_of_week;
END;
$$;


ALTER FUNCTION "public"."get_malaysian_business_hours"("business_type_param" character varying, "day_of_week_param" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_malaysian_business_hours"("business_type_param" character varying, "day_of_week_param" integer) IS 'Gets typical business hours for Malaysian business types';



CREATE OR REPLACE FUNCTION "public"."get_malaysian_tax_info"("merchant_name" "text", "receipt_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  tax_info RECORD;
  result JSONB;
BEGIN
  -- Get tax category information
  SELECT * INTO tax_info
  FROM public.detect_malaysian_tax_category(merchant_name, receipt_date);
  
  IF tax_info IS NULL THEN
    -- Default to exempt if no match found
    result := jsonb_build_object(
      'tax_type', 'EXEMPT',
      'tax_rate', 0.00,
      'category_name', 'Unknown/Exempt',
      'confidence_score', 0,
      'is_detected', false
    );
  ELSE
    result := jsonb_build_object(
      'tax_type', tax_info.tax_type,
      'tax_rate', tax_info.tax_rate,
      'category_name', tax_info.category_name,
      'confidence_score', tax_info.confidence_score,
      'is_detected', true
    );
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_malaysian_tax_info"("merchant_name" "text", "receipt_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_merchant_analysis"("user_filter" "uuid", "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date", "currency_filter" "text" DEFAULT 'MYR'::"text", "limit_results" integer DEFAULT 20) RETURNS TABLE("merchant" "text", "merchant_category" "text", "business_type" "text", "location_city" "text", "location_state" "text", "total_amount" numeric, "transaction_count" bigint, "average_amount" numeric, "first_visit" "date", "last_visit" "date", "frequency_score" numeric, "loyalty_programs" "text"[], "payment_methods" "text"[], "business_expense_ratio" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH merchant_stats AS (
    SELECT 
      COALESCE(r.merchant_normalized, r.merchant) as merchant,
      r.merchant_category,
      r.business_type,
      r.location_city,
      r.location_state,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount,
      MIN(r.date) as first_visit,
      MAX(r.date) as last_visit,
      -- Calculate frequency score based on visit pattern
      CASE 
        WHEN MAX(r.date) - MIN(r.date) > 0 THEN 
          COUNT(*)::DECIMAL / EXTRACT(DAYS FROM (MAX(r.date) - MIN(r.date)) + 1) * 30
        ELSE COUNT(*)::DECIMAL
      END as frequency_score,
      ARRAY_AGG(DISTINCT r.loyalty_program) FILTER (WHERE r.loyalty_program IS NOT NULL) as loyalty_programs,
      ARRAY_AGG(DISTINCT r.payment_method) FILTER (WHERE r.payment_method IS NOT NULL) as payment_methods,
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(*) FILTER (WHERE r.is_business_expense = true)::DECIMAL / COUNT(*) * 100)
        ELSE 0
      END as business_expense_ratio
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
    GROUP BY 
      COALESCE(r.merchant_normalized, r.merchant),
      r.merchant_category,
      r.business_type,
      r.location_city,
      r.location_state
  )
  SELECT 
    ms.merchant,
    ms.merchant_category,
    ms.business_type,
    ms.location_city,
    ms.location_state,
    ms.total_amount::DECIMAL(12,2),
    ms.transaction_count::BIGINT,
    ms.average_amount::DECIMAL(12,2),
    ms.first_visit,
    ms.last_visit,
    ms.frequency_score::DECIMAL(5,2),
    ms.loyalty_programs,
    ms.payment_methods,
    ms.business_expense_ratio::DECIMAL(5,2)
  FROM merchant_stats ms
  ORDER BY ms.total_amount DESC
  LIMIT limit_results;
END;
$$;


ALTER FUNCTION "public"."get_merchant_analysis"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text", "limit_results" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_message_feedback"("p_message_id" "text") RETURNS TABLE("id" "uuid", "feedback_type" "text", "feedback_comment" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_message_feedback"("p_message_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_spending_trends"("user_filter" "uuid", "months_back" integer DEFAULT 12, "currency_filter" "text" DEFAULT 'MYR'::"text") RETURNS TABLE("year" integer, "month" integer, "month_name" "text", "total_amount" numeric, "transaction_count" bigint, "average_amount" numeric, "top_category" "text", "top_merchant" "text", "business_expense_amount" numeric, "personal_expense_amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      EXTRACT(YEAR FROM r.date)::INTEGER as year,
      EXTRACT(MONTH FROM r.date)::INTEGER as month,
      TO_CHAR(r.date, 'Month') as month_name,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount,
      SUM(CASE WHEN r.is_business_expense = true THEN r.total ELSE 0 END) as business_expense_amount,
      SUM(CASE WHEN r.is_business_expense = false OR r.is_business_expense IS NULL THEN r.total ELSE 0 END) as personal_expense_amount
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND r.date >= (CURRENT_DATE - INTERVAL '1 month' * months_back)
    GROUP BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date), TO_CHAR(r.date, 'Month')
  ),
  top_categories AS (
    SELECT 
      EXTRACT(YEAR FROM r.date)::INTEGER as year,
      EXTRACT(MONTH FROM r.date)::INTEGER as month,
      r.predicted_category,
      SUM(r.total) as category_total,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date) ORDER BY SUM(r.total) DESC) as rn
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND r.date >= (CURRENT_DATE - INTERVAL '1 month' * months_back)
      AND r.predicted_category IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date), r.predicted_category
  ),
  top_merchants AS (
    SELECT 
      EXTRACT(YEAR FROM r.date)::INTEGER as year,
      EXTRACT(MONTH FROM r.date)::INTEGER as month,
      COALESCE(r.merchant_normalized, r.merchant) as merchant,
      SUM(r.total) as merchant_total,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date) ORDER BY SUM(r.total) DESC) as rn
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND r.date >= (CURRENT_DATE - INTERVAL '1 month' * months_back)
    GROUP BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date), COALESCE(r.merchant_normalized, r.merchant)
  )
  SELECT 
    md.year,
    md.month,
    md.month_name,
    md.total_amount::DECIMAL(12,2),
    md.transaction_count::BIGINT,
    md.average_amount::DECIMAL(12,2),
    tc.predicted_category as top_category,
    tm.merchant as top_merchant,
    md.business_expense_amount::DECIMAL(12,2),
    md.personal_expense_amount::DECIMAL(12,2)
  FROM monthly_data md
  LEFT JOIN top_categories tc ON md.year = tc.year AND md.month = tc.month AND tc.rn = 1
  LEFT JOIN top_merchants tm ON md.year = tm.year AND md.month = tm.month AND tm.rn = 1
  ORDER BY md.year DESC, md.month DESC;
END;
$$;


ALTER FUNCTION "public"."get_monthly_spending_trends"("user_filter" "uuid", "months_back" integer, "currency_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_optimal_ai_model"("content_text" "text", "processing_type" character varying DEFAULT 'receipt_processing'::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  language_info JSONB;
  recommended_model TEXT;
  model_config JSONB;
BEGIN
  -- Detect content language
  language_info := public.detect_content_language(content_text);
  
  -- Select optimal model based on content and processing type
  CASE 
    WHEN (language_info->>'primary_language') = 'ms' AND processing_type = 'receipt_processing' THEN
      recommended_model := 'gemini-2.0-flash-lite';
      model_config := jsonb_build_object(
        'temperature', 0.2,
        'max_tokens', 2048,
        'supports_malay', true,
        'processing_priority', 'accuracy'
      );
    WHEN (language_info->>'is_multilingual')::BOOLEAN = true THEN
      recommended_model := 'gemini-2.5-flash-preview-05-20';
      model_config := jsonb_build_object(
        'temperature', 0.3,
        'max_tokens', 2048,
        'supports_multilingual', true,
        'processing_priority', 'multilingual'
      );
    WHEN processing_type = 'batch_processing' THEN
      recommended_model := 'gemini-2.0-flash-lite';
      model_config := jsonb_build_object(
        'temperature', 0.2,
        'max_tokens', 1024,
        'supports_batch', true,
        'processing_priority', 'speed'
      );
    ELSE
      recommended_model := 'gemini-2.0-flash-lite';
      model_config := jsonb_build_object(
        'temperature', 0.3,
        'max_tokens', 2048,
        'supports_general', true,
        'processing_priority', 'balanced'
      );
  END CASE;
  
  RETURN jsonb_build_object(
    'recommended_model', recommended_model,
    'model_config', model_config,
    'language_info', language_info,
    'processing_type', processing_type,
    'selection_reason', CASE 
      WHEN (language_info->>'primary_language') = 'ms' THEN 'malay_optimized'
      WHEN (language_info->>'is_multilingual')::BOOLEAN = true THEN 'multilingual_support'
      WHEN processing_type = 'batch_processing' THEN 'batch_optimized'
      ELSE 'general_purpose'
    END
  );
END;
$$;


ALTER FUNCTION "public"."get_optimal_ai_model"("content_text" "text", "processing_type" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_optimal_ai_model"("content_text" "text", "processing_type" character varying) IS 'Recommends optimal AI model based on content language and processing type';



CREATE OR REPLACE FUNCTION "public"."get_performance_alerts"("p_query_time_threshold" numeric DEFAULT 2000, "p_cache_hit_rate_threshold" numeric DEFAULT 70, "p_time_window_minutes" integer DEFAULT 5) RETURNS TABLE("alert_type" "text", "alert_message" "text", "metric_name" "text", "current_value" numeric, "threshold_value" numeric, "severity" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  avg_query_time NUMERIC;
  cache_hit_rate NUMERIC;
  total_cache_requests BIGINT;
  cache_hits BIGINT;
BEGIN
  -- Calculate average query time in the last time window
  SELECT COALESCE(AVG(metric_value), 0) INTO avg_query_time
  FROM performance_metrics
  WHERE metric_name = 'search_query_time'
    AND created_at >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL;

  -- Calculate cache hit rate in the last time window
  SELECT 
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(CASE WHEN metric_value = 1 THEN 1 ELSE 0 END), 0)
  INTO total_cache_requests, cache_hits
  FROM performance_metrics
  WHERE metric_name = 'search_cache_hit'
    AND created_at >= NOW() - (p_time_window_minutes || ' minutes')::INTERVAL;

  -- Calculate cache hit rate percentage
  IF total_cache_requests > 0 THEN
    cache_hit_rate := (cache_hits::NUMERIC / total_cache_requests::NUMERIC) * 100;
  ELSE
    cache_hit_rate := 0;
  END IF;

  -- Check for query time alerts
  IF avg_query_time > p_query_time_threshold THEN
    alert_type := 'performance';
    alert_message := 'Average query time is above threshold';
    metric_name := 'search_query_time';
    current_value := avg_query_time;
    threshold_value := p_query_time_threshold;
    severity := CASE 
      WHEN avg_query_time > p_query_time_threshold * 2 THEN 'critical'
      WHEN avg_query_time > p_query_time_threshold * 1.5 THEN 'warning'
      ELSE 'info'
    END;
    created_at := NOW();
    RETURN NEXT;
  END IF;

  -- Check for cache hit rate alerts
  IF cache_hit_rate < p_cache_hit_rate_threshold AND total_cache_requests > 5 THEN
    alert_type := 'cache';
    alert_message := 'Cache hit rate is below threshold';
    metric_name := 'search_cache_hit';
    current_value := cache_hit_rate;
    threshold_value := p_cache_hit_rate_threshold;
    severity := CASE 
      WHEN cache_hit_rate < p_cache_hit_rate_threshold * 0.5 THEN 'critical'
      WHEN cache_hit_rate < p_cache_hit_rate_threshold * 0.7 THEN 'warning'
      ELSE 'info'
    END;
    created_at := NOW();
    RETURN NEXT;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_performance_alerts"("p_query_time_threshold" numeric, "p_cache_hit_rate_threshold" numeric, "p_time_window_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_performance_alerts"("p_query_time_threshold" numeric, "p_cache_hit_rate_threshold" numeric, "p_time_window_minutes" integer) IS 'Generates real-time performance alerts based on thresholds';



CREATE OR REPLACE FUNCTION "public"."get_performance_summary"("p_start_date" timestamp with time zone DEFAULT ("now"() - '01:00:00'::interval), "p_end_date" timestamp with time zone DEFAULT "now"(), "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("metric_name" "text", "metric_type" "text", "total_count" bigint, "avg_value" numeric, "min_value" numeric, "max_value" numeric, "percentile_50" numeric, "percentile_95" numeric, "percentile_99" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.metric_name,
    pm.metric_type,
    COUNT(*) as total_count,
    ROUND(AVG(pm.metric_value), 2) as avg_value,
    MIN(pm.metric_value) as min_value,
    MAX(pm.metric_value) as max_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.metric_value), 2) as percentile_50,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.metric_value), 2) as percentile_95,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pm.metric_value), 2) as percentile_99
  FROM performance_metrics pm
  WHERE 
    pm.created_at >= p_start_date
    AND pm.created_at <= p_end_date
    AND (p_user_id IS NULL OR pm.user_id = p_user_id)
  GROUP BY pm.metric_name, pm.metric_type
  ORDER BY pm.metric_name, pm.metric_type;
END;
$$;


ALTER FUNCTION "public"."get_performance_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_performance_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") IS 'Provides statistical summary of performance metrics';



CREATE OR REPLACE FUNCTION "public"."get_performance_trends"("p_metric_name" "text", "p_start_date" timestamp with time zone DEFAULT ("now"() - '24:00:00'::interval), "p_end_date" timestamp with time zone DEFAULT "now"(), "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("time_bucket" timestamp with time zone, "avg_value" numeric, "min_value" numeric, "max_value" numeric, "count_values" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('hour', pm.created_at) as time_bucket,
    ROUND(AVG(pm.metric_value), 2) as avg_value,
    MIN(pm.metric_value) as min_value,
    MAX(pm.metric_value) as max_value,
    COUNT(*) as count_values
  FROM performance_metrics pm
  WHERE 
    pm.metric_name = p_metric_name
    AND pm.created_at >= p_start_date
    AND pm.created_at <= p_end_date
    AND (p_user_id IS NULL OR pm.user_id = p_user_id)
  GROUP BY DATE_TRUNC('hour', pm.created_at)
  ORDER BY time_bucket;
END;
$$;


ALTER FUNCTION "public"."get_performance_trends"("p_metric_name" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_performance_trends"("p_metric_name" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") IS 'Returns hourly aggregated performance trends';



CREATE OR REPLACE FUNCTION "public"."get_receipt_count_by_criteria"("search_text" "text" DEFAULT NULL::"text", "price_min" numeric DEFAULT NULL::numeric, "price_max" numeric DEFAULT NULL::numeric, "date_from" "date" DEFAULT NULL::"date", "date_to" "date" DEFAULT NULL::"date", "merchant_filter" "text" DEFAULT NULL::"text", "category_filter" "text" DEFAULT NULL::"text", "user_filter" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("unique_receipt_count" bigint, "total_receipts_in_db" bigint, "search_criteria" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  total_count BIGINT;
BEGIN
  -- Get total receipt count for the user
  SELECT COUNT(*) INTO total_count
  FROM receipts r
  WHERE (user_filter IS NULL OR r.user_id = user_filter);

  RETURN QUERY
  WITH filtered_receipts AS (
    SELECT DISTINCT r.id
    FROM receipts r
    WHERE 
      (user_filter IS NULL OR r.user_id = user_filter)
      AND (search_text IS NULL OR 
           r.merchant ILIKE '%' || search_text || '%' OR
           r."fullText" ILIKE '%' || search_text || '%' OR
           r.predicted_category ILIKE '%' || search_text || '%')
      AND (price_min IS NULL OR r.total >= price_min)
      AND (price_max IS NULL OR r.total <= price_max)
      AND (date_from IS NULL OR r.date >= date_from)
      AND (date_to IS NULL OR r.date <= date_to)
      AND (merchant_filter IS NULL OR r.merchant ILIKE '%' || merchant_filter || '%')
      AND (category_filter IS NULL OR r.predicted_category ILIKE '%' || category_filter || '%')
  )
  SELECT 
    COALESCE((SELECT COUNT(*) FROM filtered_receipts), 0)::BIGINT as unique_receipt_count,
    total_count as total_receipts_in_db,
    jsonb_build_object(
      'search_text', search_text,
      'price_range', CASE 
        WHEN price_min IS NOT NULL OR price_max IS NOT NULL 
        THEN jsonb_build_object('min', price_min, 'max', price_max)
        ELSE NULL 
      END,
      'date_range', CASE 
        WHEN date_from IS NOT NULL OR date_to IS NOT NULL 
        THEN jsonb_build_object('from', date_from, 'to', date_to)
        ELSE NULL 
      END,
      'merchant', merchant_filter,
      'category', category_filter
    ) as search_criteria;
END;
$$;


ALTER FUNCTION "public"."get_receipt_count_by_criteria"("search_text" "text", "price_min" numeric, "price_max" numeric, "date_from" "date", "date_to" "date", "merchant_filter" "text", "category_filter" "text", "user_filter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_receipt_ids_in_date_range"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text" DEFAULT NULL::"text", "amount_min" double precision DEFAULT NULL::double precision, "amount_max" double precision DEFAULT NULL::double precision) RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  receipt_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT ue.source_id)
  INTO receipt_ids
  FROM unified_embeddings ue
  WHERE 
    ue.source_type = 'receipt'
    AND ue.user_id = user_filter
    AND (ue.metadata->>'receipt_date')::date >= date_range_start
    AND (ue.metadata->>'receipt_date')::date <= date_range_end
    AND (temporal_context IS NULL OR ue.metadata->>'temporal_context' = temporal_context)
    AND (amount_min IS NULL OR (ue.metadata->>'total')::FLOAT >= amount_min)
    AND (amount_max IS NULL OR (ue.metadata->>'total')::FLOAT <= amount_max);
    
  RETURN COALESCE(receipt_ids, ARRAY[]::UUID[]);
END;
$$;


ALTER FUNCTION "public"."get_receipt_ids_in_date_range"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text", "amount_min" double precision, "amount_max" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_receipts_over_amount"("amount_threshold" numeric, "user_filter" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("receipt_count" bigint, "total_amount" numeric, "avg_amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as receipt_count,
    COALESCE(SUM(r.total), 0) as total_amount,
    COALESCE(AVG(r.total), 0) as avg_amount
  FROM receipts r
  WHERE 
    (user_filter IS NULL OR r.user_id = user_filter)
    AND r.total > amount_threshold;
END;
$$;


ALTER FUNCTION "public"."get_receipts_over_amount"("amount_threshold" numeric, "user_filter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_receipts_with_missing_line_item_embeddings"("p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT r.id
  FROM public.receipts r
  WHERE EXISTS (
    SELECT 1
    FROM public.line_items li
    WHERE li.receipt_id = r.id
      AND li.description IS NOT NULL -- Only include items that can be processed
      AND NOT EXISTS ( -- Check if embedding does NOT exist in the receipt_embeddings table
         SELECT 1
         FROM public.receipt_embeddings re
         WHERE re.content_type = 'line_item'
           AND re.receipt_id = r.id
           AND (re.metadata->>'line_item_id')::uuid = li.id
      )
  )
  GROUP BY r.id, r.date -- Group by to ensure uniqueness
  ORDER BY r.date DESC -- Order by most recent first
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_receipts_with_missing_line_item_embeddings"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_search_tier_limits"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_tier subscription_tier;
  result JSONB;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Default to free if no tier found
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;
  
  -- Return tier-specific limits
  CASE user_tier
    WHEN 'free' THEN
      result := jsonb_build_object(
        'tier', 'free',
        'max_results', 10,
        'allowed_sources', ARRAY['receipt', 'business_directory'],
        'advanced_filters', false,
        'team_search', false,
        'export_enabled', false,
        'search_history', false
      );
    WHEN 'pro' THEN
      result := jsonb_build_object(
        'tier', 'pro',
        'max_results', 50,
        'allowed_sources', ARRAY['receipt', 'claim', 'custom_category', 'business_directory'],
        'advanced_filters', true,
        'team_search', true,
        'export_enabled', true,
        'search_history', true
      );
    WHEN 'max' THEN
      result := jsonb_build_object(
        'tier', 'max',
        'max_results', 100,
        'allowed_sources', ARRAY['receipt', 'claim', 'team_member', 'custom_category', 'business_directory', 'conversation'],
        'advanced_filters', true,
        'team_search', true,
        'export_enabled', true,
        'search_history', true,
        'bulk_operations', true,
        'api_access', true
      );
    ELSE
      result := jsonb_build_object(
        'tier', 'free',
        'max_results', 10,
        'allowed_sources', ARRAY['receipt', 'business_directory'],
        'advanced_filters', false,
        'team_search', false,
        'export_enabled', false,
        'search_history', false
      );
  END CASE;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_search_tier_limits"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_spending_anomalies"("user_filter" "uuid", "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date", "currency_filter" "text" DEFAULT 'MYR'::"text") RETURNS TABLE("receipt_id" "uuid", "merchant" "text", "date" "date", "amount" numeric, "category" "text", "anomaly_type" "text", "anomaly_score" numeric, "description" "text", "comparison_baseline" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  avg_transaction DECIMAL(12,2);
  std_dev_transaction DECIMAL(12,2);
BEGIN
  -- Calculate baseline statistics
  SELECT 
    AVG(r.total),
    STDDEV(r.total)
  INTO avg_transaction, std_dev_transaction
  FROM receipts r
  WHERE r.user_id = user_filter
    AND r.currency = currency_filter
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date);

  -- Return anomalies
  RETURN QUERY
  WITH anomaly_detection AS (
    SELECT 
      r.id as receipt_id,
      COALESCE(r.merchant_normalized, r.merchant) as merchant,
      r.date,
      r.total as amount,
      r.predicted_category as category,
      CASE 
        WHEN r.total > (avg_transaction + 2 * std_dev_transaction) THEN 'high_amount'
        WHEN r.total < (avg_transaction - 2 * std_dev_transaction) AND r.total > 0 THEN 'low_amount'
        WHEN r.anomaly_flags IS NOT NULL THEN 'ai_detected'
        WHEN EXTRACT(HOUR FROM r.transaction_time) < 6 OR EXTRACT(HOUR FROM r.transaction_time) > 23 THEN 'unusual_time'
        WHEN r.discount_amount > (r.subtotal * 0.5) THEN 'high_discount'
        ELSE NULL
      END as anomaly_type,
      CASE 
        WHEN r.total > (avg_transaction + 2 * std_dev_transaction) THEN 
          LEAST(100, ((r.total - avg_transaction) / std_dev_transaction * 10))
        WHEN r.total < (avg_transaction - 2 * std_dev_transaction) AND r.total > 0 THEN 
          LEAST(100, ((avg_transaction - r.total) / std_dev_transaction * 10))
        WHEN r.anomaly_flags IS NOT NULL THEN 85
        WHEN EXTRACT(HOUR FROM r.transaction_time) < 6 OR EXTRACT(HOUR FROM r.transaction_time) > 23 THEN 60
        WHEN r.discount_amount > (r.subtotal * 0.5) THEN 70
        ELSE 0
      END as anomaly_score,
      CASE 
        WHEN r.total > (avg_transaction + 2 * std_dev_transaction) THEN 
          'Unusually high transaction amount compared to your average'
        WHEN r.total < (avg_transaction - 2 * std_dev_transaction) AND r.total > 0 THEN 
          'Unusually low transaction amount'
        WHEN r.anomaly_flags IS NOT NULL THEN 
          'AI detected unusual patterns in this transaction'
        WHEN EXTRACT(HOUR FROM r.transaction_time) < 6 OR EXTRACT(HOUR FROM r.transaction_time) > 23 THEN 
          'Transaction occurred at unusual hours'
        WHEN r.discount_amount > (r.subtotal * 0.5) THEN 
          'Unusually high discount percentage'
        ELSE 'Normal transaction'
      END as description,
      avg_transaction as comparison_baseline
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
  )
  SELECT 
    ad.receipt_id,
    ad.merchant,
    ad.date,
    ad.amount::DECIMAL(12,2),
    ad.category,
    ad.anomaly_type,
    ad.anomaly_score::DECIMAL(5,2),
    ad.description,
    ad.comparison_baseline::DECIMAL(12,2)
  FROM anomaly_detection ad
  WHERE ad.anomaly_type IS NOT NULL
    AND ad.anomaly_score > 50
  ORDER BY ad.anomaly_score DESC, ad.date DESC;
END;
$$;


ALTER FUNCTION "public"."get_spending_anomalies"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_spending_by_category"("user_filter" "uuid", "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date", "currency_filter" "text" DEFAULT 'MYR'::"text") RETURNS TABLE("category" "text", "total_amount" numeric, "transaction_count" bigint, "average_amount" numeric, "percentage_of_total" numeric, "first_transaction" "date", "last_transaction" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  total_spending DECIMAL(12,2);
BEGIN
  -- Calculate total spending for percentage calculation
  SELECT COALESCE(SUM(r.total), 0) INTO total_spending
  FROM receipts r
  WHERE r.user_id = user_filter
    AND r.currency = currency_filter
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date);

  -- Return category breakdown
  RETURN QUERY
  SELECT 
    COALESCE(r.predicted_category, 'Uncategorized') as category,
    COALESCE(SUM(r.total), 0)::DECIMAL(12,2) as total_amount,
    COUNT(*)::BIGINT as transaction_count,
    COALESCE(AVG(r.total), 0)::DECIMAL(12,2) as average_amount,
    CASE 
      WHEN total_spending > 0 THEN (COALESCE(SUM(r.total), 0) / total_spending * 100)::DECIMAL(5,2)
      ELSE 0::DECIMAL(5,2)
    END as percentage_of_total,
    MIN(r.date) as first_transaction,
    MAX(r.date) as last_transaction
  FROM receipts r
  WHERE r.user_id = user_filter
    AND r.currency = currency_filter
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date)
  GROUP BY COALESCE(r.predicted_category, 'Uncategorized')
  ORDER BY total_amount DESC;
END;
$$;


ALTER FUNCTION "public"."get_spending_by_category"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_stripe_price_id"("_tier" "public"."subscription_tier", "_billing_interval" "text" DEFAULT 'monthly'::"text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
        DECLARE
          price_id TEXT;
        BEGIN
          -- Validate billing interval
          IF _billing_interval NOT IN ('monthly', 'annual') THEN
            RAISE EXCEPTION 'Invalid billing interval. Must be monthly or annual.';
          END IF;

          -- Get price ID from database
          IF _billing_interval = 'monthly' THEN
            SELECT stripe_monthly_price_id INTO price_id
            FROM public.subscription_limits
            WHERE tier = _tier;
          ELSE
            SELECT stripe_annual_price_id INTO price_id
            FROM public.subscription_limits
            WHERE tier = _tier;
          END IF;

          RETURN price_id;
        END;
        $$;


ALTER FUNCTION "public"."get_stripe_price_id"("_tier" "public"."subscription_tier", "_billing_interval" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_stripe_price_id"("_tier" "public"."subscription_tier", "_billing_interval" "text") IS 'Get Stripe price ID for a tier and billing interval';



CREATE OR REPLACE FUNCTION "public"."get_team_claims"("_team_id" "uuid", "_status" "public"."claim_status", "_limit" integer, "_offset" integer) RETURNS TABLE("id" "uuid", "title" character varying, "description" "text", "amount" numeric, "currency" character varying, "category" character varying, "priority" "public"."claim_priority", "status" "public"."claim_status", "claimant_id" "uuid", "claimant_name" "text", "claimant_email" "text", "submitted_at" timestamp with time zone, "reviewed_by" "uuid", "reviewed_at" timestamp with time zone, "approved_by" "uuid", "approved_at" timestamp with time zone, "rejection_reason" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT 
    c.id,
    c.title,
    c.description,
    c.amount,
    c.currency,
    c.category,
    c.priority,
    c.status,
    c.claimant_id,
    COALESCE(p.first_name || ' ' || p.last_name, p.first_name, u.email) as claimant_name,
    u.email as claimant_email,
    c.submitted_at,
    c.reviewed_by,
    c.reviewed_at,
    c.approved_by,
    c.approved_at,
    c.rejection_reason,
    c.created_at,
    c.updated_at
  FROM public.claims c
  JOIN auth.users u ON c.claimant_id = u.id
  LEFT JOIN public.profiles p ON c.claimant_id = p.id
  WHERE c.team_id = _team_id
  AND (_status IS NULL OR c.status = _status)
  AND public.is_team_member(_team_id, auth.uid(), 'viewer')
  ORDER BY c.created_at DESC
  LIMIT _limit OFFSET _offset;
$$;


ALTER FUNCTION "public"."get_team_claims"("_team_id" "uuid", "_status" "public"."claim_status", "_limit" integer, "_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_members"("_team_id" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "email" character varying, "first_name" "text", "last_name" "text", "role" "public"."team_member_role", "joined_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT 
    tm.id,
    tm.user_id,
    au.email,
    p.first_name,
    p.last_name,
    tm.role,
    tm.joined_at
  FROM public.team_members tm
  JOIN auth.users au ON tm.user_id = au.id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE tm.team_id = _team_id
  AND public.is_team_member(_team_id, auth.uid(), 'viewer')
  ORDER BY 
    CASE tm.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      WHEN 'viewer' THEN 4
    END,
    tm.joined_at ASC;
$$;


ALTER FUNCTION "public"."get_team_members"("_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_temporal_metadata_health"() RETURNS TABLE("source_type" "text", "total_embeddings" bigint, "with_temporal_context" bigint, "auto_enriched" bigint, "needs_refresh" bigint, "avg_days_old" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.source_type,
    COUNT(*) as total_embeddings,
    COUNT(CASE WHEN ue.metadata ? 'temporal_context' THEN 1 END) as with_temporal_context,
    COUNT(CASE WHEN (ue.metadata->>'auto_enriched')::boolean = true THEN 1 END) as auto_enriched,
    COUNT(CASE 
      WHEN ue.metadata ? 'temporal_context' 
        AND ue.metadata ? 'last_refreshed' 
        AND (ue.metadata->>'last_refreshed')::timestamp < NOW() - INTERVAL '7 days' 
      THEN 1 
    END) as needs_refresh,
    ROUND(AVG(
      CASE 
        WHEN ue.metadata ? 'days_ago' THEN (ue.metadata->>'days_ago')::numeric
        WHEN ue.metadata ? 'days_since_creation' THEN (ue.metadata->>'days_since_creation')::numeric
        ELSE NULL
      END
    ), 2) as avg_days_old
  FROM unified_embeddings ue
  GROUP BY ue.source_type
  ORDER BY ue.source_type;
END;
$$;


ALTER FUNCTION "public"."get_temporal_metadata_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_temporal_search_stats"("user_filter" "uuid") RETURNS TABLE("temporal_context" "text", "total_embeddings" bigint, "unique_receipts" bigint, "date_range_start" "date", "date_range_end" "date", "avg_amount" numeric, "weekend_count" bigint, "weekday_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.metadata->>'temporal_context' as temporal_context,
    COUNT(*) as total_embeddings,
    COUNT(DISTINCT ue.source_id) as unique_receipts,
    MIN((ue.metadata->>'receipt_date')::date) as date_range_start,
    MAX((ue.metadata->>'receipt_date')::date) as date_range_end,
    ROUND(AVG((ue.metadata->>'total')::numeric), 2) as avg_amount,
    COUNT(CASE WHEN (ue.metadata->>'is_weekend')::boolean = true THEN 1 END) as weekend_count,
    COUNT(CASE WHEN (ue.metadata->>'is_weekend')::boolean = false THEN 1 END) as weekday_count
  FROM unified_embeddings ue
  WHERE 
    ue.source_type = 'receipt'
    AND ue.user_id = user_filter
    AND ue.metadata ? 'temporal_context'
    AND ue.metadata ? 'receipt_date'
  GROUP BY ue.metadata->>'temporal_context'
  ORDER BY 
    CASE ue.metadata->>'temporal_context'
      WHEN 'recent' THEN 1
      WHEN 'this_month' THEN 2
      WHEN 'recent_quarter' THEN 3
      WHEN 'this_year' THEN 4
      WHEN 'older' THEN 5
    END;
END;
$$;


ALTER FUNCTION "public"."get_temporal_search_stats"("user_filter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_temporal_statistics"("p_user_id" "uuid") RETURNS TABLE("source_type" "text", "temporal_context" "text", "count" bigint, "avg_total" numeric, "earliest_date" "date", "latest_date" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.source_type,
    ue.metadata->>'temporal_context' as temporal_context,
    COUNT(*) as count,
    ROUND(AVG((ue.metadata->>'total')::numeric), 2) as avg_total,
    MIN((ue.metadata->>'receipt_date')::date) as earliest_date,
    MAX((ue.metadata->>'receipt_date')::date) as latest_date
  FROM unified_embeddings ue
  WHERE 
    ue.user_id = p_user_id
    AND ue.metadata ? 'temporal_context'
    AND ue.metadata ? 'receipt_date'
  GROUP BY ue.source_type, ue.metadata->>'temporal_context'
  ORDER BY ue.source_type, 
    CASE ue.metadata->>'temporal_context'
      WHEN 'recent' THEN 1
      WHEN 'this_month' THEN 2
      WHEN 'recent_quarter' THEN 3
      WHEN 'this_year' THEN 4
      WHEN 'older' THEN 5
    END;
END;
$$;


ALTER FUNCTION "public"."get_temporal_statistics"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tier_from_price_id"("_price_id" "text") RETURNS "public"."subscription_tier"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
        DECLARE
          tier_result public.subscription_tier;
        BEGIN
          -- Look up tier by price ID
          SELECT tier INTO tier_result
          FROM public.subscription_limits
          WHERE stripe_monthly_price_id = _price_id
             OR stripe_annual_price_id = _price_id;

          -- Default to free if not found
          RETURN COALESCE(tier_result, 'free');
        END;
        $$;


ALTER FUNCTION "public"."get_tier_from_price_id"("_price_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_tier_from_price_id"("_price_id" "text") IS 'Map Stripe price ID to subscription tier';



CREATE OR REPLACE FUNCTION "public"."get_time_based_patterns"("user_filter" "uuid", "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date", "currency_filter" "text" DEFAULT 'MYR'::"text") RETURNS TABLE("time_period" "text", "period_value" "text", "total_amount" numeric, "transaction_count" bigint, "average_amount" numeric, "top_category" "text", "top_merchant" "text", "business_expense_ratio" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  -- Day of week patterns
  WITH dow_patterns AS (
    SELECT 
      'day_of_week' as time_period,
      TO_CHAR(r.date, 'Day') as period_value,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount,
      MODE() WITHIN GROUP (ORDER BY r.predicted_category) as top_category,
      MODE() WITHIN GROUP (ORDER BY COALESCE(r.merchant_normalized, r.merchant)) as top_merchant,
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(*) FILTER (WHERE r.is_business_expense = true)::DECIMAL / COUNT(*) * 100)
        ELSE 0
      END as business_expense_ratio
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
    GROUP BY TO_CHAR(r.date, 'Day'), EXTRACT(DOW FROM r.date)
    ORDER BY EXTRACT(DOW FROM r.date)
  ),
  -- Hour of day patterns
  hour_patterns AS (
    SELECT 
      'hour_of_day' as time_period,
      CASE 
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 6 AND 11 THEN 'Morning (6-11)'
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 12 AND 17 THEN 'Afternoon (12-17)'
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 18 AND 22 THEN 'Evening (18-22)'
        ELSE 'Night (23-5)'
      END as period_value,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount,
      MODE() WITHIN GROUP (ORDER BY r.predicted_category) as top_category,
      MODE() WITHIN GROUP (ORDER BY COALESCE(r.merchant_normalized, r.merchant)) as top_merchant,
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(*) FILTER (WHERE r.is_business_expense = true)::DECIMAL / COUNT(*) * 100)
        ELSE 0
      END as business_expense_ratio
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND r.transaction_time IS NOT NULL
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
    GROUP BY 
      CASE 
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 6 AND 11 THEN 'Morning (6-11)'
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 12 AND 17 THEN 'Afternoon (12-17)'
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 18 AND 22 THEN 'Evening (18-22)'
        ELSE 'Night (23-5)'
      END
  )
  SELECT 
    dp.time_period,
    dp.period_value,
    dp.total_amount::DECIMAL(12,2),
    dp.transaction_count::BIGINT,
    dp.average_amount::DECIMAL(12,2),
    dp.top_category,
    dp.top_merchant,
    dp.business_expense_ratio::DECIMAL(5,2)
  FROM dow_patterns dp
  UNION ALL
  SELECT 
    hp.time_period,
    hp.period_value,
    hp.total_amount::DECIMAL(12,2),
    hp.transaction_count::BIGINT,
    hp.average_amount::DECIMAL(12,2),
    hp.top_category,
    hp.top_merchant,
    hp.business_expense_ratio::DECIMAL(5,2)
  FROM hour_patterns hp
  ORDER BY time_period, total_amount DESC;
END;
$$;


ALTER FUNCTION "public"."get_time_based_patterns"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unified_embedding_stats"() RETURNS TABLE("source_type" "text", "content_type" "text", "count" bigint, "avg_similarity" double precision, "languages" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.source_type,
    ue.content_type,
    COUNT(*) as count,
    0.0 as avg_similarity, -- Placeholder for future similarity calculations
    ARRAY_AGG(DISTINCT ue.language) as languages
  FROM public.unified_embeddings ue
  WHERE ue.embedding IS NOT NULL
  GROUP BY ue.source_type, ue.content_type
  ORDER BY ue.source_type, ue.content_type;
END;
$$;


ALTER FUNCTION "public"."get_unified_embedding_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unified_search_stats"("user_filter" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("source_type" "text", "content_type" "text", "total_embeddings" bigint, "has_content" bigint, "avg_content_length" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.source_type,
    ue.content_type,
    COUNT(*) as total_embeddings,
    COUNT(CASE WHEN ue.content_text IS NOT NULL AND TRIM(ue.content_text) != '' THEN 1 END) as has_content,
    AVG(LENGTH(ue.content_text)) FILTER (WHERE ue.content_text IS NOT NULL AND TRIM(ue.content_text) != '') as avg_content_length
  FROM unified_embeddings ue
  WHERE 
    -- Apply user filtering to ensure security
    (user_filter IS NULL OR ue.user_id = user_filter OR ue.source_type = 'business_directory')
  GROUP BY ue.source_type, ue.content_type
  ORDER BY ue.source_type, ue.content_type;
END;
$$;


ALTER FUNCTION "public"."get_unified_search_stats"("user_filter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unique_receipt_count_for_search"("query_embedding" "public"."vector", "similarity_threshold" double precision DEFAULT 0.2, "user_filter" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("unique_receipt_count" bigint, "total_embeddings_found" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH search_results AS (
    SELECT DISTINCT 
      ue.source_id,
      MAX(1 - (ue.embedding <=> query_embedding)) as max_similarity
    FROM unified_embeddings ue
    WHERE 
      ue.source_type = 'receipt'
      AND (user_filter IS NULL OR ue.user_id = user_filter)
      AND (1 - (ue.embedding <=> query_embedding)) > similarity_threshold
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
      AND ue.embedding IS NOT NULL
    GROUP BY ue.source_id
  ),
  embedding_count AS (
    SELECT COUNT(*) as total_embeddings
    FROM unified_embeddings ue
    WHERE 
      ue.source_type = 'receipt'
      AND (user_filter IS NULL OR ue.user_id = user_filter)
      AND (1 - (ue.embedding <=> query_embedding)) > similarity_threshold
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
      AND ue.embedding IS NOT NULL
  )
  SELECT 
    COALESCE((SELECT COUNT(*) FROM search_results), 0)::BIGINT as unique_receipt_count,
    COALESCE((SELECT total_embeddings FROM embedding_count), 0)::BIGINT as total_embeddings_found;
END;
$$;


ALTER FUNCTION "public"."get_unique_receipt_count_for_search"("query_embedding" "public"."vector", "similarity_threshold" double precision, "user_filter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_notification_count"("_team_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE recipient_id = auth.uid()
  AND read_at IS NULL
  AND archived_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (_team_id IS NULL OR team_id = _team_id);
$$;


ALTER FUNCTION "public"."get_unread_notification_count"("_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_categories_with_counts"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS TABLE("id" "uuid", "name" "text", "color" "text", "icon" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "receipt_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verify user can access their own data
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    cc.id,
    cc.name,
    cc.color,
    cc.icon,
    cc.created_at,
    cc.updated_at,
    COALESCE(COUNT(r.id), 0) as receipt_count
  FROM public.custom_categories cc
  LEFT JOIN public.receipts r ON r.custom_category_id = cc.id
  WHERE cc.user_id = p_user_id
  GROUP BY cc.id, cc.name, cc.color, cc.icon, cc.created_at, cc.updated_at
  ORDER BY cc.name ASC;
END;
$$;


ALTER FUNCTION "public"."get_user_categories_with_counts"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_chat_preferences"() RETURNS TABLE("preferred_response_style" "text", "common_search_terms" "text"[], "frequent_merchants" "text"[], "search_filters" "jsonb", "ui_preferences" "jsonb", "notification_preferences" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  RETURN QUERY
  SELECT 
    ucp.preferred_response_style,
    ucp.common_search_terms,
    ucp.frequent_merchants,
    ucp.search_filters,
    ucp.ui_preferences,
    ucp.notification_preferences,
    ucp.created_at,
    ucp.updated_at
  FROM user_chat_preferences ucp
  WHERE ucp.user_id = v_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_chat_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_conversations"("p_include_archived" boolean DEFAULT false, "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "text", "title" "text", "is_archived" boolean, "is_favorite" boolean, "message_count" integer, "last_message_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_user_conversations"("p_include_archived" boolean, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_conversations"("p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_status" character varying DEFAULT 'active'::character varying) RETURNS TABLE("conversation_id" "uuid", "title" character varying, "session_type" character varying, "status" character varying, "last_activity_at" timestamp with time zone, "message_count" integer, "last_message_content" "text", "last_message_role" character varying, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  RETURN QUERY
  SELECT 
    cs.id as conversation_id,
    cs.title,
    cs.session_type,
    cs.status,
    cs.last_activity_at,
    COALESCE(ca.message_count, 0) as message_count,
    lm.content as last_message_content,
    lm.role as last_message_role,
    cs.created_at
  FROM public.conversation_sessions cs
  LEFT JOIN public.conversation_analytics ca ON cs.id = ca.conversation_id
  LEFT JOIN LATERAL (
    SELECT content, role 
    FROM public.chat_messages cm 
    WHERE cm.conversation_id = cs.id 
    AND cm.is_deleted = FALSE
    ORDER BY cm.created_at DESC 
    LIMIT 1
  ) lm ON true
  WHERE cs.user_id = v_user_id 
  AND (p_status IS NULL OR cs.status = p_status)
  ORDER BY cs.last_activity_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_user_conversations"("p_limit" integer, "p_offset" integer, "p_status" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_cultural_preferences"("user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_prefs RECORD;
  result JSONB;
BEGIN
  -- Get user preferences from profiles
  SELECT 
    date_format_preference,
    time_format_preference,
    number_format_preference,
    timezone_preference,
    cultural_context,
    preferred_language
  INTO user_prefs
  FROM public.profiles
  WHERE id = user_id;
  
  IF user_prefs IS NOT NULL THEN
    result := jsonb_build_object(
      'date_format', COALESCE(user_prefs.date_format_preference, 'DD/MM/YYYY'),
      'time_format', COALESCE(user_prefs.time_format_preference, '24h'),
      'number_format', COALESCE(user_prefs.number_format_preference, 'MY'),
      'timezone', COALESCE(user_prefs.timezone_preference, 'Asia/Kuala_Lumpur'),
      'cultural_context', COALESCE(user_prefs.cultural_context, 'MY'),
      'language', COALESCE(user_prefs.preferred_language, 'en')
    );
  ELSE
    -- Default Malaysian preferences
    result := jsonb_build_object(
      'date_format', 'DD/MM/YYYY',
      'time_format', '24h',
      'number_format', 'MY',
      'timezone', 'Asia/Kuala_Lumpur',
      'cultural_context', 'MY',
      'language', 'en'
    );
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_user_cultural_preferences"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_cultural_preferences"("user_id" "uuid") IS 'Gets user cultural preferences with Malaysian defaults';



CREATE OR REPLACE FUNCTION "public"."get_user_notifications"("_limit" integer, "_offset" integer, "_unread_only" boolean) RETURNS TABLE("id" "uuid", "team_id" "uuid", "team_name" character varying, "type" "public"."notification_type", "priority" "public"."notification_priority", "title" character varying, "message" "text", "action_url" "text", "read_at" timestamp with time zone, "created_at" timestamp with time zone, "expires_at" timestamp with time zone, "related_entity_type" character varying, "related_entity_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT 
    n.id,
    n.team_id,
    t.name as team_name,
    n.type,
    n.priority,
    n.title,
    n.message,
    n.action_url,
    n.read_at,
    n.created_at,
    n.expires_at,
    n.related_entity_type,
    n.related_entity_id
  FROM public.notifications n
  LEFT JOIN public.teams t ON n.team_id = t.id
  WHERE n.recipient_id = auth.uid()
  AND (_unread_only = FALSE OR n.read_at IS NULL)
  AND (n.expires_at IS NULL OR n.expires_at > NOW())
  AND n.archived_at IS NULL
  ORDER BY n.created_at DESC
  LIMIT _limit OFFSET _offset;
$$;


ALTER FUNCTION "public"."get_user_notifications"("_limit" integer, "_offset" integer, "_unread_only" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_personalization_profile"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  profile JSONB;
  preferences JSONB;
  patterns JSONB;
  completeness TEXT := 'minimal';
  pref_count INTEGER := 0;
  pattern_count INTEGER := 0;
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
  SELECT jsonb_object_agg(preference_category, category_prefs)
  INTO preferences
  FROM user_prefs;
  
  -- Get behavioral patterns
  WITH user_patterns AS (
    SELECT
      pattern_type,
      jsonb_build_object(
        'data', pattern_data,
        'confidence', confidence,
        'sample_size', sample_size,
        'last_computed', last_computed
      ) as pattern_info
    FROM user_behavioral_patterns
    WHERE user_id = auth.uid()
      AND confidence >= 0.3
  )
  SELECT jsonb_object_agg(pattern_type, pattern_info)
  INTO patterns
  FROM user_patterns;
  
  -- Determine profile completeness
  IF preferences IS NOT NULL THEN
    pref_count := (SELECT COUNT(*) FROM jsonb_object_keys(preferences));
  END IF;
  
  IF patterns IS NOT NULL THEN
    pattern_count := (SELECT COUNT(*) FROM jsonb_object_keys(patterns));
  END IF;
  
  IF pref_count >= 5 AND pattern_count >= 3 THEN
    completeness := 'complete';
  ELSIF pref_count >= 3 AND pattern_count >= 2 THEN
    completeness := 'intermediate';
  ELSIF pref_count >= 1 OR pattern_count >= 1 THEN
    completeness := 'basic';
  END IF;
  
  -- Build complete profile
  profile := jsonb_build_object(
    'user_id', auth.uid(),
    'profile_completeness', completeness,
    'preferences', COALESCE(preferences, '{}'::jsonb),
    'behavioral_patterns', COALESCE(patterns, '{}'::jsonb),
    'last_updated', NOW(),
    'created_at', NOW()
  );
  
  -- Update or insert profile cache
  INSERT INTO user_personalization_profiles (
    user_id, profile_completeness, preferences, behavioral_patterns
  ) VALUES (
    auth.uid(), completeness, COALESCE(preferences, '{}'::jsonb), COALESCE(patterns, '{}'::jsonb)
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    profile_completeness = EXCLUDED.profile_completeness,
    preferences = EXCLUDED.preferences,
    behavioral_patterns = EXCLUDED.behavioral_patterns,
    last_updated = NOW();
  
  RETURN profile;
END;
$$;


ALTER FUNCTION "public"."get_user_personalization_profile"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_personalization_profile"() IS 'Get complete personalization profile including preferences and patterns';



CREATE OR REPLACE FUNCTION "public"."get_user_preferences"("p_category" "text" DEFAULT NULL::"text", "p_min_confidence" numeric DEFAULT 0.3) RETURNS TABLE("preference_category" "text", "preference_key" "text", "preference_value" "jsonb", "confidence_score" numeric, "learning_source" "text", "last_updated" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
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
  WHERE up.user_id = auth.uid()
    AND (p_category IS NULL OR up.preference_category = p_category)
    AND up.confidence_score >= p_min_confidence
  ORDER BY up.preference_category, up.preference_key;
END;
$$;


ALTER FUNCTION "public"."get_user_preferences"("p_category" "text", "p_min_confidence" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_preferences"("p_category" "text", "p_min_confidence" numeric) IS 'Retrieve user preferences with optional filtering by category and confidence';



CREATE OR REPLACE FUNCTION "public"."get_user_receipt_usage_stats"() RETURNS TABLE("primary_method" "text", "receipt_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT
    -- Group NULL or empty methods as 'UNKNOWN'
    COALESCE(NULLIF(TRIM(r.primary_method), ''), 'UNKNOWN') AS primary_method,
    COUNT(*) AS receipt_count
  FROM
    public.receipts r
  WHERE
    r.user_id = auth.uid() -- Filter by the currently authenticated user
  GROUP BY
    COALESCE(NULLIF(TRIM(r.primary_method), ''), 'UNKNOWN')
  ORDER BY
    receipt_count DESC;
$$;


ALTER FUNCTION "public"."get_user_receipt_usage_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_teams"("_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS TABLE("id" "uuid", "name" character varying, "description" "text", "slug" character varying, "status" "public"."team_status", "owner_id" "uuid", "user_role" "public"."team_member_role", "member_count" bigint, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT 
    t.id,
    t.name,
    t.description,
    t.slug,
    t.status,
    t.owner_id,
    tm.role as user_role,
    (SELECT COUNT(*) FROM public.team_members WHERE team_id = t.id) as member_count,
    t.created_at
  FROM public.teams t
  JOIN public.team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = _user_id
  ORDER BY t.created_at DESC;
$$;


ALTER FUNCTION "public"."get_user_teams"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_by_ids"("user_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "email" "text", "first_name" "text", "last_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT,
    COALESCE(p.first_name, '')::TEXT as first_name,
    COALESCE(p.last_name, '')::TEXT as last_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE u.id = ANY(user_ids);
END;
$$;


ALTER FUNCTION "public"."get_users_by_ids"("user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_batch_item"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  json_body TEXT;
BEGIN
  -- Construct the JSON body payload using the NEW record's ID
  json_body := '{"batch_item_id":"' || NEW.id::text || '"}';

  -- Call the http_request function using PERFORM because we don't need its return value
  -- Ensure positional arguments match the function signature
  PERFORM supabase_functions.http_request(
    url := 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/process-batch-item',
    method := 'POST',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzAxMjM4OSwiZXhwIjoyMDU4NTg4Mzg5fQ.o6Xn7TTIYF4U9zAOhGWVf5MoAcl_BGPtQ_BRcR2xV0o"}',
    body := json_body,
    timeout_milliseconds := 5000
  );

  -- For AFTER triggers, RETURN NULL is conventional for side-effect functions
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."handle_new_batch_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Extract Google avatar URL from user metadata if available
  DECLARE
    google_avatar TEXT := NULL;
    user_language TEXT := 'en'; -- Default language
  BEGIN
    -- Try to extract avatar URL from Google OAuth metadata
    IF new.raw_user_meta_data IS NOT NULL THEN
      google_avatar := new.raw_user_meta_data->>'avatar_url';
      -- Try to detect language from user metadata or locale
      user_language := COALESCE(
        new.raw_user_meta_data->>'locale',
        new.raw_user_meta_data->>'language',
        'en'
      );
      -- Map common locale codes to our supported languages
      IF user_language LIKE 'ms%' OR user_language LIKE 'my%' THEN
        user_language := 'ms';
      ELSE
        user_language := 'en';
      END IF;
    END IF;
  END;

  -- Insert profile with default subscription values, Google avatar, and language preference
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name,
    email,
    google_avatar_url,
    preferred_language,
    subscription_tier,
    subscription_status,
    receipts_used_this_month,
    monthly_reset_date
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'given_name', ''),
    COALESCE(new.raw_user_meta_data->>'family_name', ''),
    new.email,
    google_avatar,
    user_language,
    'free',
    'active',
    0,
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    google_avatar_url = COALESCE(EXCLUDED.google_avatar_url, profiles.google_avatar_url),
    preferred_language = COALESCE(EXCLUDED.preferred_language, profiles.preferred_language),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
    updated_at = NOW();
  
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;


ALTER FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision DEFAULT 0.5, "similarity_weight" double precision DEFAULT 0.7, "text_weight" double precision DEFAULT 0.3, "match_count" integer DEFAULT 10, "min_amount" double precision DEFAULT NULL::double precision, "max_amount" double precision DEFAULT NULL::double precision, "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("line_item_id" "uuid", "receipt_id" "uuid", "line_item_description" "text", "line_item_quantity" numeric, "line_item_price" numeric, "parent_receipt_merchant" "text", "parent_receipt_date" "date", "similarity" double precision, "text_score" double precision, "score" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      li.id as line_item_id,
      li.receipt_id,
      li.description as line_item_description,
      li.quantity as line_item_quantity,
      li.price as line_item_price,
      r.merchant as parent_receipt_merchant,
      r.date as parent_receipt_date,
      1 - (li.embedding <=> query_embedding) as similarity
    FROM
      line_items li
    JOIN
      receipts r ON li.receipt_id = r.id
    WHERE
      li.embedding IS NOT NULL
      AND (1 - (li.embedding <=> query_embedding)) > similarity_threshold
      AND (min_amount IS NULL OR li.price >= min_amount)
      AND (max_amount IS NULL OR li.price <= max_amount)
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
  ),
  text_results AS (
    SELECT
      li.id as line_item_id,
      ts_rank(to_tsvector('english', coalesce(li.description, '')), plainto_tsquery('english', query_text)) as text_score
    FROM
      line_items li
    WHERE
      query_text IS NOT NULL
      AND query_text <> ''
  )
  SELECT
    vr.line_item_id,
    vr.receipt_id,
    vr.line_item_description,
    vr.line_item_quantity,
    vr.line_item_price,
    vr.parent_receipt_merchant,
    vr.parent_receipt_date,
    vr.similarity,
    COALESCE(tr.text_score, 0) as text_score,
    (vr.similarity * similarity_weight) + (COALESCE(tr.text_score, 0) * text_weight) as score
  FROM
    vector_results vr
  LEFT JOIN
    text_results tr ON vr.line_item_id = tr.line_item_id
  ORDER BY
    score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision, "similarity_weight" double precision, "text_weight" double precision, "match_count" integer, "min_amount" double precision, "max_amount" double precision, "start_date" "date", "end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision DEFAULT 0.5, "similarity_weight" double precision DEFAULT 0.7, "text_weight" double precision DEFAULT 0.3, "match_count" integer DEFAULT 10, "min_amount" numeric DEFAULT NULL::numeric, "max_amount" numeric DEFAULT NULL::numeric, "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("line_item_id" "uuid", "receipt_id" "uuid", "line_item_description" "text", "line_item_amount" numeric, "parent_receipt_merchant" "text", "parent_receipt_date" "date", "similarity" double precision, "text_score" double precision, "score" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      li.id as line_item_id,
      li.receipt_id,
      li.description as line_item_description,
      li.amount as line_item_amount,
      r.merchant as parent_receipt_merchant,
      r.date as parent_receipt_date,
      1 - (li.embedding <=> query_embedding) as similarity
    FROM
      line_items li
    JOIN
      receipts r ON li.receipt_id = r.id
    WHERE
      li.embedding IS NOT NULL
      AND (1 - (li.embedding <=> query_embedding)) > similarity_threshold
      AND (min_amount IS NULL OR li.amount >= min_amount)
      AND (max_amount IS NULL OR li.amount <= max_amount)
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
  ),
  text_results AS (
    SELECT
      li.id as line_item_id,
      ts_rank(to_tsvector('english', coalesce(li.description, '')), plainto_tsquery('english', query_text)) as text_score
    FROM
      line_items li
    WHERE
      query_text IS NOT NULL
      AND query_text <> ''
  )
  SELECT
    vr.line_item_id,
    vr.receipt_id,
    vr.line_item_description,
    vr.line_item_amount,
    vr.parent_receipt_merchant,
    vr.parent_receipt_date,
    vr.similarity,
    COALESCE(tr.text_score, 0) as text_score,
    (vr.similarity * similarity_weight) + (COALESCE(tr.text_score, 0) * text_weight) as score
  FROM
    vector_results vr
  LEFT JOIN
    text_results tr ON vr.line_item_id = tr.line_item_id
  ORDER BY
    score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision, "similarity_weight" double precision, "text_weight" double precision, "match_count" integer, "min_amount" numeric, "max_amount" numeric, "start_date" "date", "end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_search_receipts"("search_text" "text", "query_embedding" "public"."vector", "content_type" "text" DEFAULT 'full_text'::"text", "similarity_weight" double precision DEFAULT 0.7, "text_weight" double precision DEFAULT 0.3, "match_count" integer DEFAULT 10) RETURNS TABLE("receipt_id" "uuid", "score" double precision)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  with vector_results as (
    select 
      e.receipt_id,
      1 - (e.embedding <=> query_embedding) as similarity
    from receipt_embeddings e
    where e.content_type = hybrid_search_receipts.content_type
  ),
  text_results as (
    select 
      r.id as receipt_id,
      ts_rank_cd(to_tsvector('english', coalesce(r.merchant, '') || ' ' || 
                coalesce(r.notes, '') || ' ' || 
                coalesce(r.raw_text, '')), 
                plainto_tsquery('english', search_text)) as text_similarity
    from receipts r
  ),
  combined_results as (
    select 
      coalesce(v.receipt_id, t.receipt_id) as receipt_id,
      (coalesce(v.similarity, 0) * similarity_weight) + 
      (coalesce(t.text_similarity, 0) * text_weight) as score
    from vector_results v
    full outer join text_results t on v.receipt_id = t.receipt_id
  )
  select * from combined_results
  where score > 0
  order by score desc
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."hybrid_search_receipts"("search_text" "text", "query_embedding" "public"."vector", "content_type" "text", "similarity_weight" double precision, "text_weight" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_temporal_semantic_search"("query_embedding" "public"."vector", "query_text" "text", "user_filter" "uuid", "receipt_ids" "uuid"[], "content_types" "text"[] DEFAULT NULL::"text"[], "similarity_threshold" double precision DEFAULT 0.1, "semantic_weight" double precision DEFAULT 0.7, "keyword_weight" double precision DEFAULT 0.2, "trigram_weight" double precision DEFAULT 0.1, "match_count" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "source_type" "text", "source_id" "uuid", "content_type" "text", "content_text" "text", "similarity" double precision, "trigram_similarity" double precision, "keyword_score" double precision, "combined_score" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.id,
    ue.source_type,
    ue.source_id,
    ue.content_type,
    ue.content_text,
    (1 - (ue.embedding <=> query_embedding))::DOUBLE PRECISION as similarity,
    similarity(ue.content_text, query_text)::DOUBLE PRECISION as trigram_similarity,
    ts_rank(to_tsvector('english', ue.content_text), plainto_tsquery('english', query_text))::DOUBLE PRECISION as keyword_score,
    -- Weighted combined score optimized for temporal queries
    (((1 - (ue.embedding <=> query_embedding)) * semantic_weight) + 
    (similarity(ue.content_text, query_text) * trigram_weight) + 
    (ts_rank(to_tsvector('english', ue.content_text), plainto_tsquery('english', query_text)) * keyword_weight) +
    -- Temporal recency boost
    CASE 
      WHEN ue.metadata->>'temporal_context' = 'recent' THEN 0.1
      WHEN ue.metadata->>'temporal_context' = 'this_month' THEN 0.05
      ELSE 0.0
    END)::DOUBLE PRECISION as combined_score,
    ue.metadata
  FROM unified_embeddings ue
  WHERE 
    ue.source_type = 'receipt'
    AND ue.user_id = user_filter
    AND ue.source_id = ANY(receipt_ids)
    AND (content_types IS NULL OR ue.content_type = ANY(content_types))
    AND ue.content_text IS NOT NULL 
    AND TRIM(ue.content_text) != ''
    AND ue.embedding IS NOT NULL
    AND (
      (1 - (ue.embedding <=> query_embedding)) > similarity_threshold OR
      similarity(ue.content_text, query_text) > 0.2 OR
      to_tsvector('english', ue.content_text) @@ plainto_tsquery('english', query_text)
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."hybrid_temporal_semantic_search"("query_embedding" "public"."vector", "query_text" "text", "user_filter" "uuid", "receipt_ids" "uuid"[], "content_types" "text"[], "similarity_threshold" double precision, "semantic_weight" double precision, "keyword_weight" double precision, "trigram_weight" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_batch_counter"("batch_uuid" "uuid", "field_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF field_name = 'succeeded' THEN
    UPDATE batches
    SET succeeded = succeeded + 1, updated_at = NOW()
    WHERE id = batch_uuid;
  ELSIF field_name = 'failed' THEN
    UPDATE batches
    SET failed = failed + 1, updated_at = NOW()
    WHERE id = batch_uuid;
  END IF;
END;
$$;


ALTER FUNCTION "public"."increment_batch_counter"("batch_uuid" "uuid", "field_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_team_member"("_team_id" "uuid", "_email" character varying, "_role" "public"."team_member_role" DEFAULT 'member'::"public"."team_member_role") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _invitation_id UUID;
  _token VARCHAR(255);
  _current_user_id UUID;
BEGIN
  -- Get current user ID
  _current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF _current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if user has permission to invite (admin or owner)
  IF NOT public.is_team_member(_team_id, _current_user_id, 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to invite team members';
  END IF;

  -- Validate email format
  IF _email IS NULL OR trim(_email) = '' THEN
    RAISE EXCEPTION 'Email address is required';
  END IF;

  -- Check if user is already a team member
  IF EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN auth.users u ON tm.user_id = u.id
    WHERE tm.team_id = _team_id AND u.email = _email
  ) THEN
    RAISE EXCEPTION 'User is already a team member';
  END IF;

  -- Check if there's already a pending invitation
  IF EXISTS (
    SELECT 1 FROM public.team_invitations
    WHERE team_id = _team_id AND email = _email AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Invitation already sent to this email';
  END IF;

  -- Generate unique token
  _token := encode(gen_random_bytes(32), 'hex');

  -- Create invitation with explicit column list
  INSERT INTO public.team_invitations (
    team_id, 
    email, 
    role, 
    invited_by, 
    token, 
    expires_at,
    status,
    created_at,
    updated_at
  ) VALUES (
    _team_id, 
    trim(_email), 
    _role, 
    _current_user_id, 
    _token,
    NOW() + INTERVAL '7 days',
    'pending',
    NOW(),
    NOW()
  ) RETURNING id INTO _invitation_id;

  -- Log the successful invitation creation
  RAISE NOTICE 'Team invitation created successfully: %', _invitation_id;

  RETURN _invitation_id;
END;
$$;


ALTER FUNCTION "public"."invite_team_member"("_team_id" "uuid", "_email" character varying, "_role" "public"."team_member_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_malaysian_public_holiday"("check_date" "date", "state_code" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  holiday_record RECORD;
  result JSONB;
BEGIN
  -- Check for holidays on the given date
  SELECT holiday_name, holiday_name_malay, holiday_type, applicable_states
  INTO holiday_record
  FROM public.malaysian_public_holidays
  WHERE 
    holiday_date = check_date
    AND is_active = true
    AND (
      applicable_states IS NULL  -- Federal holiday (applies to all states)
      OR state_code IS NULL      -- No state specified, check all holidays
      OR state_code = ANY(applicable_states)  -- State-specific holiday
    )
  ORDER BY 
    CASE WHEN applicable_states IS NULL THEN 1 ELSE 2 END  -- Federal holidays first
  LIMIT 1;
  
  IF holiday_record IS NOT NULL THEN
    result := jsonb_build_object(
      'is_holiday', true,
      'holiday_name', holiday_record.holiday_name,
      'holiday_name_malay', holiday_record.holiday_name_malay,
      'holiday_type', holiday_record.holiday_type,
      'applicable_states', holiday_record.applicable_states
    );
  ELSE
    result := jsonb_build_object(
      'is_holiday', false,
      'holiday_name', NULL,
      'holiday_name_malay', NULL,
      'holiday_type', NULL,
      'applicable_states', NULL
    );
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."is_malaysian_public_holiday"("check_date" "date", "state_code" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_malaysian_public_holiday"("check_date" "date", "state_code" character varying) IS 'Checks if a date is a Malaysian public holiday';



CREATE OR REPLACE FUNCTION "public"."is_team_member"("_team_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"(), "_min_role" "public"."team_member_role" DEFAULT 'viewer'::"public"."team_member_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _team_id 
    AND tm.user_id = _user_id
    AND (
      CASE _min_role
        WHEN 'viewer' THEN tm.role IN ('viewer', 'member', 'admin', 'owner')
        WHEN 'member' THEN tm.role IN ('member', 'admin', 'owner')
        WHEN 'admin' THEN tm.role IN ('admin', 'owner')
        WHEN 'owner' THEN tm.role = 'owner'
        ELSE false
      END
    )
  );
$$;


ALTER FUNCTION "public"."is_team_member"("_team_id" "uuid", "_user_id" "uuid", "_min_role" "public"."team_member_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_owner"("_team_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id AND t.owner_id = _user_id
  );
$$;


ALTER FUNCTION "public"."is_team_owner"("_team_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_performance_metric"("p_metric_name" character varying, "p_metric_type" character varying, "p_metric_value" numeric, "p_metric_unit" character varying, "p_context" "jsonb" DEFAULT NULL::"jsonb", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.performance_metrics (
    metric_name, 
    metric_type, 
    metric_value, 
    metric_unit, 
    context, 
    user_id
  )
  VALUES (
    p_metric_name, 
    p_metric_type, 
    p_metric_value, 
    p_metric_unit, 
    p_context, 
    p_user_id
  );
END;
$$;


ALTER FUNCTION "public"."log_performance_metric"("p_metric_name" character varying, "p_metric_type" character varying, "p_metric_value" numeric, "p_metric_unit" character varying, "p_context" "jsonb", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_performance_metric"("p_metric_name" character varying, "p_metric_type" character varying, "p_metric_value" numeric, "p_metric_unit" character varying, "p_context" "jsonb", "p_user_id" "uuid") IS 'Logs performance metrics for monitoring and optimization';



CREATE OR REPLACE FUNCTION "public"."maintain_search_history_size"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_search_history JSONB;
  v_max_history_size INTEGER := 50;
BEGIN
  -- Get current search history
  v_search_history := NEW.search_history;
  
  -- If search history is an array and exceeds max size, trim it
  IF jsonb_typeof(v_search_history) = 'array' AND jsonb_array_length(v_search_history) > v_max_history_size THEN
    -- Keep only the most recent entries
    NEW.search_history := jsonb_path_query_array(
      v_search_history, 
      '$[' || (jsonb_array_length(v_search_history) - v_max_history_size) || ' to last]'
    );
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."maintain_search_history_size"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"("_team_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _updated_count INTEGER;
BEGIN
  UPDATE public.notifications 
  SET read_at = NOW()
  WHERE recipient_id = auth.uid()
  AND read_at IS NULL
  AND (_team_id IS NULL OR team_id = _team_id);

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RETURN _updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"("_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("_notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.notifications 
  SET read_at = NOW()
  WHERE id = _notification_id 
  AND recipient_id = auth.uid()
  AND read_at IS NULL;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_receipt_embeddings_to_unified"() RETURNS TABLE("migrated_count" bigint, "skipped_count" bigint, "error_count" bigint, "total_processed" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  migrated BIGINT := 0;
  skipped BIGINT := 0;
  errors BIGINT := 0;
  total BIGINT := 0;
  rec RECORD;
  content_text TEXT;
BEGIN
  FOR rec IN 
    SELECT re.id, re.receipt_id, re.content_type, re.embedding, re.metadata, re.created_at,
           r.user_id, r.merchant, r."fullText", r.date, r.total
    FROM receipt_embeddings re
    INNER JOIN receipts r ON r.id = re.receipt_id
    LEFT JOIN unified_embeddings ue ON ue.source_id = re.receipt_id 
                                    AND ue.source_type = 'receipt' 
                                    AND ue.content_type = re.content_type
    WHERE ue.id IS NULL
  LOOP
    BEGIN
      total := total + 1;
      
      -- Only handle content types that exist in receipts table
      CASE rec.content_type
        WHEN 'full_text' THEN content_text := COALESCE(rec."fullText", '');
        WHEN 'merchant' THEN content_text := COALESCE(rec.merchant, '');
        ELSE content_text := COALESCE(rec.merchant, ''); -- fallback to merchant
      END CASE;
      
      IF content_text IS NULL OR TRIM(content_text) = '' THEN
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      
      INSERT INTO unified_embeddings (
        source_type, source_id, content_type, content_text, embedding,
        metadata, user_id, language, created_at, updated_at
      ) VALUES (
        'receipt', rec.receipt_id, rec.content_type, content_text, rec.embedding,
        COALESCE(rec.metadata, '{}'::JSONB) || jsonb_build_object(
          'migrated_from', 'receipt_embeddings', 'migration_date', NOW()
        ),
        rec.user_id, 'en', rec.created_at, NOW()
      );
      
      migrated := migrated + 1;
      
    EXCEPTION WHEN OTHERS THEN
      errors := errors + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT migrated, skipped, errors, total;
END;
$$;


ALTER FUNCTION "public"."migrate_receipt_embeddings_to_unified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_currency_code"("input_currency" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
BEGIN
    -- Handle null or empty input
    IF input_currency IS NULL OR TRIM(input_currency) = '' THEN
        RETURN 'MYR';
    END IF;
    
    -- Normalize common currency symbols and codes
    CASE UPPER(TRIM(input_currency))
        WHEN 'RM' THEN RETURN 'MYR';
        WHEN '$' THEN RETURN 'USD';
        WHEN 'S$' THEN RETURN 'SGD';
        WHEN '€' THEN RETURN 'EUR';
        WHEN '£' THEN RETURN 'GBP';
        WHEN '¥' THEN RETURN 'JPY';
        WHEN 'RMB' THEN RETURN 'CNY';
        WHEN '฿' THEN RETURN 'THB';
        WHEN 'RP' THEN RETURN 'IDR';
        WHEN '₱' THEN RETURN 'PHP';
        WHEN '₫' THEN RETURN 'VND';
        ELSE
            -- If it's already a 3-letter code, return it uppercase
            IF UPPER(TRIM(input_currency)) ~ '^[A-Z]{3}$' THEN
                RETURN UPPER(TRIM(input_currency));
            ELSE
                -- Default to MYR for unrecognized codes
                RETURN 'MYR';
            END IF;
    END CASE;
END;
$_$;


ALTER FUNCTION "public"."normalize_currency_code"("input_currency" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."normalize_currency_code"("input_currency" "text") IS 'Normalizes currency codes to ISO 4217 standard. Maps common symbols (RM, $, €, etc.) to proper 3-letter codes.';



CREATE OR REPLACE FUNCTION "public"."parse_malaysian_address"("address_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result JSONB;
  detected_state TEXT := NULL;
  detected_postcode TEXT := NULL;
  confidence_score INTEGER := 0;
  state_record RECORD;
BEGIN
  -- Extract postcode (5 digits)
  SELECT substring(address_text FROM '[0-9]{5}') INTO detected_postcode;
  
  -- If postcode found, try to match with state
  IF detected_postcode IS NOT NULL THEN
    SELECT state_name, state_code INTO state_record
    FROM public.malaysian_address_formats
    WHERE detected_postcode ~ postcode_pattern
    LIMIT 1;
    
    IF state_record IS NOT NULL THEN
      detected_state := state_record.state_name;
      confidence_score := 90;
    END IF;
  END IF;
  
  -- If no postcode match, try to find state name in address
  IF detected_state IS NULL THEN
    SELECT state_name INTO detected_state
    FROM public.malaysian_address_formats
    WHERE LOWER(address_text) LIKE '%' || LOWER(state_name) || '%'
       OR LOWER(address_text) LIKE '%' || LOWER(state_code) || '%'
       OR EXISTS (
         SELECT 1 FROM unnest(common_cities) AS city
         WHERE LOWER(address_text) LIKE '%' || LOWER(city) || '%'
       )
    ORDER BY 
      CASE 
        WHEN LOWER(address_text) LIKE '%' || LOWER(state_name) || '%' THEN 1
        WHEN LOWER(address_text) LIKE '%' || LOWER(state_code) || '%' THEN 2
        ELSE 3
      END
    LIMIT 1;
    
    IF detected_state IS NOT NULL THEN
      confidence_score := 70;
    END IF;
  END IF;
  
  result := jsonb_build_object(
    'detected_state', detected_state,
    'detected_postcode', detected_postcode,
    'confidence_score', confidence_score
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."parse_malaysian_address"("address_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."parse_malaysian_address"("address_text" "text") IS 'Parses Malaysian addresses to extract state and postcode information';



CREATE OR REPLACE FUNCTION "public"."refresh_all_temporal_metadata"() RETURNS TABLE("updated_count" integer, "processing_time_ms" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  start_time TIMESTAMP;
  updated_receipts INTEGER := 0;
  updated_others INTEGER := 0;
BEGIN
  start_time := NOW();
  
  -- Update temporal context for receipt embeddings
  UPDATE unified_embeddings 
  SET metadata = metadata || jsonb_build_object(
    'temporal_context', CASE 
      WHEN (metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '7 days' THEN 'recent'
      WHEN (metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '30 days' THEN 'this_month'
      WHEN (metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '90 days' THEN 'recent_quarter'
      WHEN (metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '365 days' THEN 'this_year'
      ELSE 'older'
    END,
    'days_ago', (CURRENT_DATE - (metadata->>'receipt_date')::date),
    'last_refreshed', NOW()::text
  )
  WHERE source_type = 'receipt' 
    AND metadata ? 'receipt_date' 
    AND metadata->>'receipt_date' IS NOT NULL;
    
  GET DIAGNOSTICS updated_receipts = ROW_COUNT;
  
  -- Update temporal context for other source types
  UPDATE unified_embeddings 
  SET metadata = metadata || jsonb_build_object(
    'temporal_context', CASE 
      WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'recent'
      WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'this_month'
      WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 'recent_quarter'
      WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '365 days' THEN 'this_year'
      ELSE 'older'
    END,
    'days_since_creation', EXTRACT(days FROM (CURRENT_TIMESTAMP - created_at)),
    'last_refreshed', NOW()::text
  )
  WHERE source_type IN ('claim', 'custom_categorie', 'team_member');
  
  GET DIAGNOSTICS updated_others = ROW_COUNT;
  
  RETURN QUERY SELECT 
    (updated_receipts + updated_others)::INTEGER as updated_count,
    EXTRACT(milliseconds FROM (NOW() - start_time))::INTEGER as processing_time_ms;
END;
$$;


ALTER FUNCTION "public"."refresh_all_temporal_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_malaysian_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Refresh reference data view
  REFRESH MATERIALIZED VIEW public.mv_malaysian_reference_data;
  
  -- Log the refresh
  INSERT INTO public.performance_metrics (metric_name, metric_type, metric_value, metric_unit, context)
  VALUES ('materialized_view_refresh', 'maintenance', 1, 'count', 
          jsonb_build_object('timestamp', NOW(), 'views_refreshed', 1));
END;
$$;


ALTER FUNCTION "public"."refresh_malaysian_materialized_views"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_malaysian_materialized_views"() IS 'Refreshes all Malaysian-related materialized views for performance optimization';



CREATE OR REPLACE FUNCTION "public"."refresh_user_temporal_metadata"("p_user_id" "uuid") RETURNS TABLE("updated_count" integer, "processing_time_ms" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  start_time TIMESTAMP;
  updated_count_val INTEGER := 0;
BEGIN
  start_time := NOW();
  
  -- Update temporal context for user's embeddings
  UPDATE unified_embeddings 
  SET metadata = metadata || jsonb_build_object(
    'temporal_context', CASE 
      WHEN source_type = 'receipt' AND (metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '7 days' THEN 'recent'
      WHEN source_type = 'receipt' AND (metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '30 days' THEN 'this_month'
      WHEN source_type = 'receipt' AND (metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '90 days' THEN 'recent_quarter'
      WHEN source_type = 'receipt' AND (metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '365 days' THEN 'this_year'
      WHEN source_type = 'receipt' THEN 'older'
      WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'recent'
      WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'this_month'
      WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 'recent_quarter'
      WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '365 days' THEN 'this_year'
      ELSE 'older'
    END,
    'last_refreshed', NOW()::text
  )
  WHERE user_id = p_user_id;
    
  GET DIAGNOSTICS updated_count_val = ROW_COUNT;
  
  RETURN QUERY SELECT 
    updated_count_val as updated_count,
    EXTRACT(milliseconds FROM (NOW() - start_time))::INTEGER as processing_time_ms;
END;
$$;


ALTER FUNCTION "public"."refresh_user_temporal_metadata"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_claim"("_claim_id" "uuid", "_rejection_reason" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _claim_record public.claims;
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record
  FROM public.claims
  WHERE id = _claim_id;

  -- Check if claim exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user has permission (must be team admin/owner)
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _claim_record.team_id 
    AND tm.user_id = auth.uid() 
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to reject claim';
  END IF;

  -- Check if claim can be rejected
  IF _claim_record.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Claim cannot be rejected in current status: %', _claim_record.status;
  END IF;

  -- Update claim status
  UPDATE public.claims 
  SET 
    status = 'rejected',
    rejection_reason = _rejection_reason,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, old_status, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'rejected', _claim_record.status, 'rejected', _rejection_reason
  );

  -- Create notification for claimant with specific claim URL
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  ) VALUES (
    _claim_record.claimant_id, _claim_record.team_id, 'claim_rejected', 'high',
    'Claim Rejected',
    'Your claim "' || _claim_record.title || '" has been rejected: ' || _rejection_reason,
    '/claims/' || _claim_id,
    'claim', _claim_id
  );

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."reject_claim"("_claim_id" "uuid", "_rejection_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_team_member"("_team_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _member_role public.team_member_role;
BEGIN
  -- Get the member's role
  SELECT role INTO _member_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  IF _member_role IS NULL THEN
    RAISE EXCEPTION 'User is not a team member';
  END IF;

  -- Cannot remove the owner
  IF _member_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove team owner';
  END IF;

  -- Check permissions: admin can remove anyone, users can remove themselves
  IF NOT (public.is_team_member(_team_id, auth.uid(), 'admin') OR _user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Insufficient permissions to remove team member';
  END IF;

  -- Remove the member
  DELETE FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."remove_team_member"("_team_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.unified_embeddings
  WHERE source_type = p_source_type
    AND source_id = p_source_id
    AND (p_content_type IS NULL OR content_type = p_content_type);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."remove_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_conversation"("p_conversation_id" "text", "p_new_title" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."rename_conversation"("p_conversation_id" "text", "p_new_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_monthly_usage"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
  SET
    receipts_used_this_month = 0,
    monthly_reset_date = DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  WHERE monthly_reset_date <= NOW();
END;
$$;


ALTER FUNCTION "public"."reset_monthly_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_conversation"("p_conversation_id" "text", "p_title" "text", "p_message_count" integer DEFAULT 0, "p_is_archived" boolean DEFAULT false, "p_is_favorite" boolean DEFAULT false) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."save_conversation"("p_conversation_id" "text", "p_title" "text", "p_message_count" integer, "p_is_archived" boolean, "p_is_favorite" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_context_data" "jsonb", "p_relevance_score" numeric DEFAULT 1.0, "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  context_id UUID;
BEGIN
  INSERT INTO conversation_contexts (
    user_id,
    conversation_id,
    context_type,
    context_data,
    relevance_score,
    expires_at
  ) VALUES (
    auth.uid(),
    p_conversation_id,
    p_context_type,
    p_context_data,
    p_relevance_score,
    p_expires_at
  ) RETURNING id INTO context_id;
  
  RETURN context_id;
END;
$$;


ALTER FUNCTION "public"."save_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_context_data" "jsonb", "p_relevance_score" numeric, "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_memory_data" "jsonb", "p_confidence_score" numeric DEFAULT 0.5, "p_source_conversation_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  memory_id UUID;
  source_conversations TEXT[];
BEGIN
  -- Get existing source conversations or initialize empty array
  SELECT COALESCE(cm.source_conversations, '{}') INTO source_conversations
  FROM conversation_memory cm
  WHERE cm.user_id = auth.uid()
    AND cm.memory_type = p_memory_type
    AND cm.memory_key = p_memory_key;
  
  -- Add new source conversation if provided
  IF p_source_conversation_id IS NOT NULL THEN
    source_conversations := array_append(source_conversations, p_source_conversation_id);
  END IF;
  
  INSERT INTO conversation_memory (
    user_id,
    memory_type,
    memory_key,
    memory_data,
    confidence_score,
    source_conversations
  ) VALUES (
    auth.uid(),
    p_memory_type,
    p_memory_key,
    p_memory_data,
    p_confidence_score,
    source_conversations
  )
  ON CONFLICT (user_id, memory_type, memory_key)
  DO UPDATE SET
    memory_data = EXCLUDED.memory_data,
    confidence_score = EXCLUDED.confidence_score,
    source_conversations = EXCLUDED.source_conversations,
    last_accessed = NOW(),
    access_count = conversation_memory.access_count + 1,
    updated_at = NOW()
  RETURNING id INTO memory_id;
  
  RETURN memory_id;
END;
$$;


ALTER FUNCTION "public"."save_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_memory_data" "jsonb", "p_confidence_score" numeric, "p_source_conversation_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_conversation_message"("p_conversation_id" "text", "p_message_id" "text", "p_message_type" "text", "p_content" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_parent_message_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  message_id UUID;
BEGIN
  INSERT INTO conversation_messages (
    user_id,
    conversation_id,
    message_id,
    message_type,
    content,
    metadata,
    parent_message_id
  ) VALUES (
    auth.uid(),
    p_conversation_id,
    p_message_id,
    p_message_type,
    p_content,
    p_metadata,
    p_parent_message_id
  ) RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$$;


ALTER FUNCTION "public"."save_conversation_message"("p_conversation_id" "text", "p_message_id" "text", "p_message_type" "text", "p_content" "text", "p_metadata" "jsonb", "p_parent_message_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_by_temporal_context"("p_user_id" "uuid", "p_temporal_context" "text" DEFAULT NULL::"text", "p_source_types" "text"[] DEFAULT ARRAY['receipt'::"text"], "p_season" "text" DEFAULT NULL::"text", "p_is_weekend" boolean DEFAULT NULL::boolean, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "source_type" "text", "source_id" "uuid", "content_type" "text", "content_text" "text", "metadata" "jsonb", "temporal_context" "text", "receipt_date" "text", "days_ago" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.id,
    ue.source_type,
    ue.source_id,
    ue.content_type,
    ue.content_text,
    ue.metadata,
    ue.metadata->>'temporal_context' as temporal_context,
    ue.metadata->>'receipt_date' as receipt_date,
    (ue.metadata->>'days_ago')::int as days_ago
  FROM unified_embeddings ue
  WHERE 
    ue.user_id = p_user_id
    AND (p_source_types IS NULL OR ue.source_type = ANY(p_source_types))
    AND (p_temporal_context IS NULL OR ue.metadata->>'temporal_context' = p_temporal_context)
    AND (p_season IS NULL OR ue.metadata->>'season' = p_season)
    AND (p_is_weekend IS NULL OR (ue.metadata->>'is_weekend')::boolean = p_is_weekend)
    AND ue.metadata ? 'temporal_context'
  ORDER BY 
    CASE ue.metadata->>'temporal_context'
      WHEN 'recent' THEN 1
      WHEN 'this_month' THEN 2
      WHEN 'recent_quarter' THEN 3
      WHEN 'this_year' THEN 4
      WHEN 'older' THEN 5
    END,
    (ue.metadata->>'receipt_date')::date DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."search_by_temporal_context"("p_user_id" "uuid", "p_temporal_context" "text", "p_source_types" "text"[], "p_season" "text", "p_is_weekend" boolean, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_conversation_memory"("p_query" "text", "p_min_confidence" numeric DEFAULT 0.4, "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "memory_type" "text", "memory_key" "text", "memory_data" "jsonb", "confidence_score" numeric, "source_conversations" "text"[], "last_accessed" timestamp with time zone, "access_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "relevance_score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Search conversation memory based on query text
  -- This function searches through memory data and keys for relevant content
  
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
    cm.created_at,
    cm.updated_at,
    -- Calculate relevance score based on text similarity
    CASE 
      WHEN cm.memory_key ILIKE '%' || p_query || '%' THEN 1.0
      WHEN cm.memory_data::text ILIKE '%' || p_query || '%' THEN 0.8
      ELSE 0.5
    END as relevance_score
  FROM conversation_memory cm
  WHERE cm.user_id = auth.uid()
    AND cm.confidence_score >= p_min_confidence
    AND (
      cm.memory_key ILIKE '%' || p_query || '%' OR
      cm.memory_data::text ILIKE '%' || p_query || '%' OR
      cm.memory_type ILIKE '%' || p_query || '%'
    )
  ORDER BY 
    relevance_score DESC,
    cm.confidence_score DESC, 
    cm.last_accessed DESC
  LIMIT p_limit;
  
  -- Update access count for searched memories (fix ambiguous column references)
  UPDATE conversation_memory 
  SET 
    last_accessed = NOW(),
    access_count = conversation_memory.access_count + 1
  WHERE conversation_memory.user_id = auth.uid()
    AND conversation_memory.confidence_score >= p_min_confidence
    AND (
      conversation_memory.memory_key ILIKE '%' || p_query || '%' OR
      conversation_memory.memory_data::text ILIKE '%' || p_query || '%' OR
      conversation_memory.memory_type ILIKE '%' || p_query || '%'
    );
END;
$$;


ALTER FUNCTION "public"."search_conversation_memory"("p_query" "text", "p_min_confidence" numeric, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_line_items"("query_embedding" "public"."vector", "similarity_threshold" double precision DEFAULT 0.5, "match_count" integer DEFAULT 10) RETURNS TABLE("line_item_id" "uuid", "receipt_id" "uuid", "line_item_description" "text", "line_item_amount" numeric, "parent_receipt_merchant" "text", "parent_receipt_date" "date", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    li.id as line_item_id,
    li.receipt_id,
    li.description as line_item_description,
    li.amount as line_item_amount,
    r.merchant as parent_receipt_merchant,
    r.date as parent_receipt_date,
    1 - (li.embedding <=> query_embedding) as similarity
  FROM
    line_items li
  JOIN
    receipts r ON li.receipt_id = r.id
  WHERE
    li.embedding IS NOT NULL
    AND (1 - (li.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_line_items"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_malaysian_business"("search_term" "text", "limit_results" integer DEFAULT 10) RETURNS TABLE("business_name" character varying, "business_type" character varying, "industry_category" character varying, "confidence_score" integer, "is_chain" boolean, "registration_number" character varying)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mbd.business_name,
    mbd.business_type,
    mbd.industry_category,
    mbd.confidence_score,
    mbd.is_chain,
    mbd.registration_number
  FROM public.malaysian_business_directory mbd
  WHERE 
    mbd.is_active = true
    AND (
      LOWER(mbd.business_name) LIKE '%' || LOWER(search_term) || '%'
      OR LOWER(mbd.business_name_malay) LIKE '%' || LOWER(search_term) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(mbd.keywords) AS keyword
        WHERE LOWER(keyword) LIKE '%' || LOWER(search_term) || '%'
      )
    )
  ORDER BY 
    -- Exact matches first
    CASE WHEN LOWER(mbd.business_name) = LOWER(search_term) THEN 1 ELSE 2 END,
    -- Then by confidence score
    mbd.confidence_score DESC,
    -- Then by chain status (chains are more recognizable)
    CASE WHEN mbd.is_chain THEN 1 ELSE 2 END,
    -- Finally by name length (shorter names are often more common)
    LENGTH(mbd.business_name)
  LIMIT limit_results;
END;
$$;


ALTER FUNCTION "public"."search_malaysian_business"("search_term" "text", "limit_results" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_malaysian_business"("search_term" "text", "limit_results" integer) IS 'Searches Malaysian business directory with fuzzy matching';



CREATE OR REPLACE FUNCTION "public"."search_malaysian_business_optimized"("search_term" "text", "limit_results" integer DEFAULT 10, "use_cache" boolean DEFAULT true) RETURNS TABLE("business_name" character varying, "business_type" character varying, "industry_category" character varying, "confidence_score" integer, "is_chain" boolean, "keywords" "text"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  execution_time DECIMAL(10,3);
BEGIN
  start_time := clock_timestamp();
  
  -- Use materialized view for better performance
  IF use_cache THEN
    RETURN QUERY
    SELECT 
      mrd.name::VARCHAR(200) as business_name,
      mrd.category::VARCHAR(100) as business_type,
      mrd.category::VARCHAR(100) as industry_category,
      mrd.confidence_score::INTEGER,
      true as is_chain, -- Assume chains for cached data
      mrd.keywords
    FROM public.mv_malaysian_reference_data mrd
    WHERE 
      mrd.data_type = 'business_directory'
      AND (
        LOWER(mrd.name) LIKE '%' || LOWER(search_term) || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(mrd.keywords) AS keyword
          WHERE LOWER(keyword) LIKE '%' || LOWER(search_term) || '%'
        )
      )
    ORDER BY 
      CASE WHEN LOWER(mrd.name) = LOWER(search_term) THEN 1 ELSE 2 END,
      mrd.confidence_score DESC,
      LENGTH(mrd.name)
    LIMIT limit_results;
  ELSE
    -- Fallback to direct table query
    RETURN QUERY
    SELECT 
      mbd.business_name,
      mbd.business_type,
      mbd.industry_category,
      mbd.confidence_score,
      mbd.is_chain,
      mbd.keywords
    FROM public.malaysian_business_directory mbd
    WHERE 
      mbd.is_active = true
      AND (
        LOWER(mbd.business_name) LIKE '%' || LOWER(search_term) || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(mbd.keywords) AS keyword
          WHERE LOWER(keyword) LIKE '%' || LOWER(search_term) || '%'
        )
      )
    ORDER BY 
      CASE WHEN LOWER(mbd.business_name) = LOWER(search_term) THEN 1 ELSE 2 END,
      mbd.confidence_score DESC,
      LENGTH(mbd.business_name)
    LIMIT limit_results;
  END IF;
  
  -- Log performance metric
  end_time := clock_timestamp();
  execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  PERFORM public.log_performance_metric(
    'malaysian_business_search',
    'query_time',
    execution_time,
    'ms',
    jsonb_build_object(
      'search_term', search_term,
      'use_cache', use_cache,
      'limit_results', limit_results
    )
  );
END;
$$;


ALTER FUNCTION "public"."search_malaysian_business_optimized"("search_term" "text", "limit_results" integer, "use_cache" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_malaysian_business_optimized"("search_term" "text", "limit_results" integer, "use_cache" boolean) IS 'Optimized search function for Malaysian businesses with caching support';



CREATE OR REPLACE FUNCTION "public"."search_receipts"("query_embedding" "public"."vector", "similarity_threshold" double precision DEFAULT 0.5, "match_count" integer DEFAULT 10, "content_type" "text" DEFAULT 'full_text'::"text") RETURNS TABLE("id" "uuid", "receipt_id" "uuid", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    re.id,
    re.receipt_id,
    1 - (re.embedding <=> query_embedding) as similarity
  from receipt_embeddings re
  where
    re.content_type = search_receipts.content_type
    and 1 - (re.embedding <=> query_embedding) > similarity_threshold
  order by similarity desc
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."search_receipts"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer, "content_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_team_invitation_email_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only send email for new invitations
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Use pg_notify to trigger email sending asynchronously
    PERFORM pg_notify(
      'team_invitation_created',
      json_build_object(
        'invitation_id', NEW.id,
        'email', NEW.email,
        'team_id', NEW.team_id,
        'role', NEW.role
      )::text
    );
    
    -- Also directly call the edge function using the supabase.functions.invoke approach
    -- This will be handled by a separate process or manually triggered
    RAISE NOTICE 'Team invitation email trigger fired for invitation: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."send_team_invitation_email_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_preference"("p_category" "text", "p_key" "text", "p_value" "jsonb", "p_confidence" numeric DEFAULT 1.0, "p_source" "text" DEFAULT 'explicit_setting'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  preference_id UUID;
BEGIN
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
  
  RETURN preference_id;
END;
$$;


ALTER FUNCTION "public"."set_user_preference"("p_category" "text", "p_key" "text", "p_value" "jsonb", "p_confidence" numeric, "p_source" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_user_preference"("p_category" "text", "p_key" "text", "p_value" "jsonb", "p_confidence" numeric, "p_source" "text") IS 'Set or update a user preference with confidence scoring';



CREATE OR REPLACE FUNCTION "public"."set_user_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only admins can change roles
  IF NOT public.has_role('admin'::public.app_role) THEN
    RETURN FALSE;
  END IF;

  -- Check if the user already has this role
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) THEN
    RETURN TRUE;
  END IF;

  -- Remove other roles first (assuming a user can have only one role)
  DELETE FROM public.user_roles WHERE user_id = _user_id;

  -- Add the new role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role);

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."set_user_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."simple_hybrid_search"("query_text" "text", "source_types" "text"[] DEFAULT ARRAY['receipt'::"text"], "user_filter" "uuid" DEFAULT NULL::"uuid", "match_count" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "source_type" "text", "source_id" "uuid", "content_type" "text", "content_text" "text", "trigram_similarity" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.id,
    ue.source_type,
    ue.source_id,
    ue.content_type,
    ue.content_text,
    similarity(ue.content_text, query_text)::FLOAT as trigram_similarity,
    ue.metadata
  FROM unified_embeddings ue
  WHERE 
    query_text IS NOT NULL 
    AND query_text != ''
    AND (source_types IS NULL OR ue.source_type = ANY(source_types))
    AND (user_filter IS NULL OR ue.user_id = user_filter)
    AND similarity(ue.content_text, query_text) > 0.1
    AND ue.content_text IS NOT NULL 
    AND TRIM(ue.content_text) != ''
  ORDER BY trigram_similarity DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."simple_hybrid_search"("query_text" "text", "source_types" "text"[], "user_filter" "uuid", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_claim"("_claim_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _claim_record public.claims;
  _team_admins uuid[];
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record
  FROM public.claims
  WHERE id = _claim_id;

  -- Check if claim exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user is the claimant or has permission
  IF _claim_record.claimant_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _claim_record.team_id 
    AND tm.user_id = auth.uid() 
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to submit claim';
  END IF;

  -- Check if claim can be submitted
  IF _claim_record.status != 'draft' THEN
    RAISE EXCEPTION 'Claim cannot be submitted in current status: %', _claim_record.status;
  END IF;

  -- Update claim status
  UPDATE public.claims 
  SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
  WHERE id = _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, old_status, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'submitted', 'draft', 'submitted', 'Claim submitted for review'
  );

  -- Get team admins for notifications
  SELECT ARRAY_AGG(tm.user_id) INTO _team_admins
  FROM public.team_members tm
  WHERE tm.team_id = _claim_record.team_id 
  AND tm.role IN ('owner', 'admin');

  -- Create notifications for team admins with specific claim URL
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  )
  SELECT 
    admin_id, _claim_record.team_id, 'claim_submitted', 'medium',
    'New Claim Submitted',
    'A new claim "' || _claim_record.title || '" has been submitted for review',
    '/claims/' || _claim_id,
    'claim', _claim_id
  FROM UNNEST(_team_admins) AS admin_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."submit_claim"("_claim_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_message_feedback"("p_message_id" "text", "p_conversation_id" "text", "p_feedback_type" "text", "p_feedback_comment" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."submit_message_feedback"("p_message_id" "text", "p_conversation_id" "text", "p_feedback_type" "text", "p_feedback_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."temporal_search_receipts"("user_filter" "uuid", "date_range_start" "date" DEFAULT NULL::"date", "date_range_end" "date" DEFAULT NULL::"date", "temporal_context" "text" DEFAULT NULL::"text", "season_filter" "text" DEFAULT NULL::"text", "is_weekend_filter" boolean DEFAULT NULL::boolean, "days_ago_min" integer DEFAULT NULL::integer, "days_ago_max" integer DEFAULT NULL::integer, "amount_min" double precision DEFAULT NULL::double precision, "amount_max" double precision DEFAULT NULL::double precision, "match_count" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "source_type" "text", "source_id" "uuid", "content_type" "text", "content_text" "text", "similarity" double precision, "metadata" "jsonb", "receipt_date" "date", "temporal_context_value" "text", "days_ago_value" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.id,
    ue.source_type,
    ue.source_id,
    ue.content_type,
    ue.content_text,
    1.0::DOUBLE PRECISION as similarity, -- Perfect match for date filtering
    ue.metadata,
    (ue.metadata->>'receipt_date')::date as receipt_date,
    ue.metadata->>'temporal_context' as temporal_context_value,
    (ue.metadata->>'days_ago')::int as days_ago_value
  FROM unified_embeddings ue
  WHERE 
    ue.source_type = 'receipt'
    AND ue.user_id = user_filter
    AND ue.content_text IS NOT NULL 
    AND TRIM(ue.content_text) != ''
    
    -- Temporal filtering
    AND (temporal_context IS NULL OR ue.metadata->>'temporal_context' = temporal_context)
    AND (date_range_start IS NULL OR (ue.metadata->>'receipt_date')::date >= date_range_start)
    AND (date_range_end IS NULL OR (ue.metadata->>'receipt_date')::date <= date_range_end)
    AND (season_filter IS NULL OR ue.metadata->>'season' = season_filter)
    AND (is_weekend_filter IS NULL OR (ue.metadata->>'is_weekend')::boolean = is_weekend_filter)
    AND (days_ago_min IS NULL OR (ue.metadata->>'days_ago')::int >= days_ago_min)
    AND (days_ago_max IS NULL OR (ue.metadata->>'days_ago')::int <= days_ago_max)
    
    -- Amount filtering
    AND (amount_min IS NULL OR (ue.metadata->>'total')::DOUBLE PRECISION >= amount_min)
    AND (amount_max IS NULL OR (ue.metadata->>'total')::DOUBLE PRECISION <= amount_max)
    
  ORDER BY 
    (ue.metadata->>'receipt_date')::date DESC,
    ue.content_type -- Prioritize merchant names over line items
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."temporal_search_receipts"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text", "season_filter" "text", "is_weekend_filter" boolean, "days_ago_min" integer, "days_ago_max" integer, "amount_min" double precision, "amount_max" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_conversation_archive"("p_conversation_id" "text", "p_is_archived" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."toggle_conversation_archive"("p_conversation_id" "text", "p_is_archived" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_conversation_favorite"("p_conversation_id" "text", "p_is_favorite" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."toggle_conversation_favorite"("p_conversation_id" "text", "p_is_favorite" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_user_interaction"("p_interaction_type" "text", "p_interaction_context" "jsonb", "p_interaction_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_session_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  interaction_id UUID;
  session_id TEXT;
BEGIN
  -- Generate session ID if not provided
  session_id := COALESCE(p_session_id, 'session_' || extract(epoch from now())::text || '_' || COALESCE(auth.uid()::text, 'anonymous'));
  
  -- Insert interaction record
  INSERT INTO user_interactions (
    user_id,
    session_id,
    interaction_type,
    interaction_context,
    interaction_metadata
  ) VALUES (
    auth.uid(),
    session_id,
    p_interaction_type,
    p_interaction_context,
    p_interaction_metadata
  ) RETURNING id INTO interaction_id;
  
  RETURN interaction_id;
END;
$$;


ALTER FUNCTION "public"."track_user_interaction"("p_interaction_type" "text", "p_interaction_context" "jsonb", "p_interaction_metadata" "jsonb", "p_session_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."track_user_interaction"("p_interaction_type" "text", "p_interaction_context" "jsonb", "p_interaction_metadata" "jsonb", "p_session_id" "text") IS 'Track user interactions for behavioral analysis and preference learning';



CREATE OR REPLACE FUNCTION "public"."trigger_create_default_categories"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Create default categories for the new user
  PERFORM create_default_categories_for_user(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_create_default_categories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_embedding_generation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  priority_level TEXT := 'medium';
BEGIN
  -- Determine priority based on table and operation
  IF TG_TABLE_NAME = 'receipts' THEN
    priority_level := 'high';
  ELSIF TG_OP = 'INSERT' THEN
    priority_level := 'medium';
  ELSE
    priority_level := 'low';
  END IF;

  -- Insert into embedding queue for async processing
  INSERT INTO public.embedding_queue (
    source_type,
    source_id,
    operation,
    priority,
    metadata
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    priority_level,
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', NOW()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trigger_embedding_generation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_temporal_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only update if this is an UPDATE operation and temporal metadata exists
  IF TG_OP = 'UPDATE' AND NEW.metadata ? 'temporal_context' THEN
    -- Update temporal context based on source type
    IF NEW.source_type = 'receipt' AND NEW.metadata ? 'receipt_date' THEN
      NEW.metadata := NEW.metadata || jsonb_build_object(
        'temporal_context', CASE 
          WHEN (NEW.metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '7 days' THEN 'recent'
          WHEN (NEW.metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '30 days' THEN 'this_month'
          WHEN (NEW.metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '90 days' THEN 'recent_quarter'
          WHEN (NEW.metadata->>'receipt_date')::date >= CURRENT_DATE - INTERVAL '365 days' THEN 'this_year'
          ELSE 'older'
        END,
        'days_ago', (CURRENT_DATE - (NEW.metadata->>'receipt_date')::date),
        'last_auto_updated', NOW()::text
      );
    ELSIF NEW.source_type IN ('claim', 'custom_categorie', 'team_member') THEN
      NEW.metadata := NEW.metadata || jsonb_build_object(
        'temporal_context', CASE 
          WHEN NEW.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'recent'
          WHEN NEW.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'this_month'
          WHEN NEW.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 'recent_quarter'
          WHEN NEW.created_at >= CURRENT_TIMESTAMP - INTERVAL '365 days' THEN 'this_year'
          ELSE 'older'
        END,
        'days_since_creation', EXTRACT(days FROM (CURRENT_TIMESTAMP - NEW.created_at)),
        'last_auto_updated', NOW()::text
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_temporal_metadata"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_update_temporal_metadata"() IS 'Automatically updates temporal metadata when embeddings are modified';



CREATE OR REPLACE FUNCTION "public"."unified_search"("query_embedding" "public"."vector", "source_types" "text"[] DEFAULT ARRAY['receipt'::"text", 'claim'::"text", 'team_member'::"text", 'custom_category'::"text", 'business_directory'::"text"], "content_types" "text"[] DEFAULT NULL::"text"[], "similarity_threshold" double precision DEFAULT 0.2, "match_count" integer DEFAULT 20, "user_filter" "uuid" DEFAULT NULL::"uuid", "team_filter" "uuid" DEFAULT NULL::"uuid", "language_filter" "text" DEFAULT NULL::"text", "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date", "min_amount" numeric DEFAULT NULL::numeric, "max_amount" numeric DEFAULT NULL::numeric) RETURNS TABLE("id" "uuid", "source_type" "text", "source_id" "uuid", "content_type" "text", "content_text" "text", "similarity" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Log the temporal filtering parameters for debugging
  RAISE NOTICE 'unified_search called with temporal filters: start_date=%, end_date=%, min_amount=%, max_amount=%', 
    start_date, end_date, min_amount, max_amount;

  RETURN QUERY
  SELECT 
    ue.id,
    ue.source_type,
    ue.source_id,
    ue.content_type,
    ue.content_text,
    1 - (ue.embedding <=> query_embedding) as similarity,
    ue.metadata
  FROM unified_embeddings ue
  -- Join with receipts table for date/amount filtering when searching receipts
  LEFT JOIN receipts r ON (ue.source_type = 'receipt' AND ue.source_id = r.id)
  WHERE 
    -- Source type filtering
    (source_types IS NULL OR ue.source_type = ANY(source_types))
    
    -- Content type filtering
    AND (content_types IS NULL OR ue.content_type = ANY(content_types))
    
    -- User filtering (if specified)
    AND (user_filter IS NULL OR ue.user_id = user_filter)
    
    -- Team filtering (if specified)
    AND (team_filter IS NULL OR ue.team_id = team_filter)
    
    -- Language filtering (if specified)
    AND (language_filter IS NULL OR ue.metadata->>'language' = language_filter)
    
    -- CRITICAL: Date range filtering for receipts
    AND (
      ue.source_type != 'receipt' 
      OR (
        (start_date IS NULL OR r.date >= start_date)
        AND (end_date IS NULL OR r.date <= end_date)
      )
    )
    
    -- CRITICAL: Amount filtering for receipts
    AND (
      ue.source_type != 'receipt'
      OR (
        (min_amount IS NULL OR r.total >= min_amount)
        AND (max_amount IS NULL OR r.total <= max_amount)
      )
    )
    
    -- Similarity threshold
    AND (1 - (ue.embedding <=> query_embedding)) > similarity_threshold
    
    -- Ensure we have valid content
    AND ue.content_text IS NOT NULL 
    AND TRIM(ue.content_text) != ''
    AND ue.embedding IS NOT NULL
    
    -- Ensure receipts exist when filtering by date/amount
    AND (ue.source_type != 'receipt' OR r.id IS NOT NULL)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."unified_search"("query_embedding" "public"."vector", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "start_date" "date", "end_date" "date", "min_amount" numeric, "max_amount" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."unified_search"("query_embedding" "public"."vector", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "start_date" "date", "end_date" "date", "min_amount" numeric, "max_amount" numeric) IS 'Enhanced unified search function with temporal and amount filtering support for accurate receipt date searches';



CREATE OR REPLACE FUNCTION "public"."update_batch_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    succeeded_delta INT := 0;
    failed_delta INT := 0;
BEGIN
    -- Check if status changed to a terminal state
    IF OLD.status <> NEW.status THEN
        IF NEW.status = 'complete' THEN
            succeeded_delta := 1;
        ELSIF NEW.status = 'error' THEN -- Assuming 'error' is the terminal failure state
            failed_delta := 1;
        END IF;

        -- If status changed FROM a terminal state (e.g., retry), decrement previous count
        IF OLD.status = 'complete' THEN
             succeeded_delta := succeeded_delta - 1;
        ELSIF OLD.status = 'error' THEN
             failed_delta := failed_delta - 1;
        END IF;
    END IF;

    IF succeeded_delta <> 0 OR failed_delta <> 0 THEN
        UPDATE public.batches
        SET
            succeeded = succeeded + succeeded_delta,
            failed = failed + failed_delta,
            updated_at = NOW()
        WHERE id = NEW.batch_id;
        -- TODO: Add logic here to update batches.status to 'complete' or 'partially_complete'
        -- when succeeded + failed = total_items
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_batch_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_batch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.batches
    SET updated_at = NOW()
    WHERE id = NEW.batch_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_batch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb" DEFAULT NULL::"jsonb", "p_search_history" "text"[] DEFAULT NULL::"text"[], "p_user_preferences" "jsonb" DEFAULT NULL::"jsonb", "p_last_keywords" "jsonb" DEFAULT NULL::"jsonb", "p_last_results" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Update context
  UPDATE chat_contexts 
  SET 
    context_data = COALESCE(p_context_data, context_data),
    search_history = COALESCE(p_search_history, search_history),
    user_preferences = COALESCE(p_user_preferences, user_preferences),
    last_keywords = COALESCE(p_last_keywords, last_keywords),
    last_results = COALESCE(p_last_results, last_results),
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  -- Update conversation last activity
  UPDATE conversation_sessions 
  SET last_activity_at = NOW()
  WHERE id = p_conversation_id;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb", "p_search_history" "text"[], "p_user_preferences" "jsonb", "p_last_keywords" "jsonb", "p_last_results" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb" DEFAULT NULL::"jsonb", "p_search_history" "jsonb" DEFAULT NULL::"jsonb", "p_user_preferences" "jsonb" DEFAULT NULL::"jsonb", "p_last_keywords" "jsonb" DEFAULT NULL::"jsonb", "p_last_results" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Update the chat context
  UPDATE public.chat_contexts 
  SET 
    context_data = COALESCE(p_context_data, context_data),
    search_history = COALESCE(p_search_history, search_history),
    user_preferences = COALESCE(p_user_preferences, user_preferences),
    last_keywords = COALESCE(p_last_keywords, last_keywords),
    last_results = COALESCE(p_last_results, last_results),
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id 
  AND user_id = v_user_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb", "p_search_history" "jsonb", "p_user_preferences" "jsonb", "p_last_keywords" "jsonb", "p_last_results" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_analytics_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_search_count INTEGER;
  v_session_duration INTEGER;
BEGIN
  -- Count search messages
  SELECT COUNT(*) INTO v_search_count
  FROM public.chat_messages 
  WHERE conversation_id = NEW.conversation_id 
  AND message_type = 'search_result';
  
  -- Calculate session duration
  SELECT EXTRACT(EPOCH FROM (NOW() - session_start_time))::INTEGER INTO v_session_duration
  FROM public.chat_contexts 
  WHERE conversation_id = NEW.conversation_id;
  
  -- Update analytics
  UPDATE public.conversation_analytics 
  SET 
    search_count = v_search_count,
    session_duration_seconds = COALESCE(v_session_duration, 0),
    updated_at = NOW()
  WHERE conversation_id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_analytics_on_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_custom_categories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_custom_categories_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_custom_category"("p_category_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_color" "text" DEFAULT NULL::"text", "p_icon" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  current_user_id uuid;
  category_exists boolean;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if category exists and belongs to user
  SELECT EXISTS (
    SELECT 1 FROM public.custom_categories 
    WHERE id = p_category_id AND user_id = current_user_id
  ) INTO category_exists;

  IF NOT category_exists THEN
    RAISE EXCEPTION 'Category not found or access denied';
  END IF;

  -- Validate inputs if provided
  IF p_name IS NOT NULL THEN
    IF trim(p_name) = '' THEN
      RAISE EXCEPTION 'Category name cannot be empty';
    END IF;
    
    IF char_length(trim(p_name)) > 50 THEN
      RAISE EXCEPTION 'Category name cannot exceed 50 characters';
    END IF;

    -- Check for duplicate name (excluding current category)
    IF EXISTS (
      SELECT 1 FROM public.custom_categories 
      WHERE user_id = current_user_id 
        AND LOWER(name) = LOWER(trim(p_name))
        AND id != p_category_id
    ) THEN
      RAISE EXCEPTION 'Category with this name already exists';
    END IF;
  END IF;

  IF p_color IS NOT NULL AND p_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Invalid color format. Use hex format like #3B82F6';
  END IF;

  -- Update category
  UPDATE public.custom_categories
  SET 
    name = COALESCE(trim(p_name), name),
    color = COALESCE(p_color, color),
    icon = COALESCE(p_icon, icon),
    updated_at = now()
  WHERE id = p_category_id AND user_id = current_user_id;

  RETURN true;
END;
$_$;


ALTER FUNCTION "public"."update_custom_category"("p_category_id" "uuid", "p_name" "text", "p_color" "text", "p_icon" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_delivery_status"("_delivery_id" "uuid", "_status" "public"."email_delivery_status", "_provider_message_id" character varying, "_error_message" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.email_deliveries 
  SET 
    status = _status,
    provider_message_id = COALESCE(_provider_message_id, provider_message_id),
    error_message = _error_message,
    sent_at = CASE WHEN _status = 'sent' THEN NOW() ELSE sent_at END,
    delivered_at = CASE WHEN _status = 'delivered' THEN NOW() ELSE delivered_at END,
    failed_at = CASE WHEN _status IN ('failed', 'bounced', 'complained') THEN NOW() ELSE failed_at END
  WHERE id = _delivery_id;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_email_delivery_status"("_delivery_id" "uuid", "_status" "public"."email_delivery_status", "_provider_message_id" character varying, "_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_embedding_temporal_context"("p_embedding_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_receipt_date DATE;
  v_source_type TEXT;
BEGIN
  -- Get the embedding details
  SELECT source_type, (metadata->>'receipt_date')::date 
  INTO v_source_type, v_receipt_date
  FROM unified_embeddings 
  WHERE id = p_embedding_id;
  
  -- Update temporal context for receipts
  IF v_source_type = 'receipt' AND v_receipt_date IS NOT NULL THEN
    UPDATE unified_embeddings 
    SET metadata = metadata || jsonb_build_object(
      'temporal_context', CASE 
        WHEN v_receipt_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'recent'
        WHEN v_receipt_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'this_month'
        WHEN v_receipt_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'recent_quarter'
        WHEN v_receipt_date >= CURRENT_DATE - INTERVAL '365 days' THEN 'this_year'
        ELSE 'older'
      END,
      'date_bucket', date_trunc('week', v_receipt_date)::text,
      'month_bucket', date_trunc('month', v_receipt_date)::text,
      'quarter_bucket', date_trunc('quarter', v_receipt_date)::text,
      'year_bucket', date_trunc('year', v_receipt_date)::text,
      'days_ago', (CURRENT_DATE - v_receipt_date),
      'is_weekend', CASE 
        WHEN EXTRACT(dow FROM v_receipt_date) IN (0, 6) THEN true 
        ELSE false 
      END,
      'season', CASE 
        WHEN EXTRACT(month FROM v_receipt_date) IN (12, 1, 2) THEN 'winter'
        WHEN EXTRACT(month FROM v_receipt_date) IN (3, 4, 5) THEN 'spring'
        WHEN EXTRACT(month FROM v_receipt_date) IN (6, 7, 8) THEN 'summer'
        WHEN EXTRACT(month FROM v_receipt_date) IN (9, 10, 11) THEN 'autumn'
      END
    )
    WHERE id = p_embedding_id;
    
    RETURN TRUE;
  END IF;
  
  -- Update temporal context for other source types based on creation date
  IF v_source_type IN ('custom_categorie', 'team_member', 'claim') THEN
    UPDATE unified_embeddings 
    SET metadata = metadata || jsonb_build_object(
      'temporal_context', CASE 
        WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'recent'
        WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'this_month'
        WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 'recent_quarter'
        WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL '365 days' THEN 'this_year'
        ELSE 'older'
      END,
      'creation_date_bucket', date_trunc('week', created_at::date)::text,
      'days_since_creation', EXTRACT(days FROM (CURRENT_TIMESTAMP - created_at))
    )
    WHERE id = p_embedding_id;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."update_embedding_temporal_context"("p_embedding_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_line_item_embedding"("p_line_item_id" "uuid", "p_embedding" "public"."vector") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_receipt_id UUID;
  v_embedding_id UUID;
BEGIN
  -- Get the receipt_id for this line item
  SELECT receipt_id INTO v_receipt_id
  FROM line_items
  WHERE id = p_line_item_id;
  
  IF v_receipt_id IS NULL THEN
    RAISE EXCEPTION 'Line item % not found', p_line_item_id;
  END IF;

  -- Use the add_embedding function to update or insert the embedding
  -- This handles the case where the embedding already exists or needs to be created
  SELECT add_embedding(
    'line_item',            -- source_type
    p_line_item_id,         -- source_id
    v_receipt_id,           -- receipt_id
    'line_item',            -- content_type
    p_embedding,            -- embedding
    jsonb_build_object('updated_at', NOW(), 'regenerated', true)  -- metadata with regeneration flag
  ) INTO v_embedding_id;
  
  RETURN v_embedding_id;
END;
$$;


ALTER FUNCTION "public"."update_line_item_embedding"("p_line_item_id" "uuid", "p_embedding" "public"."vector") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_processing_status_if_failed"("receipt_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.receipts
  SET 
    processing_status = 'complete',
    processing_error = NULL
  WHERE 
    id = receipt_id 
    AND processing_status IN ('failed_ocr', 'failed_ai');
END;
$$;


ALTER FUNCTION "public"."update_processing_status_if_failed"("receipt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subscription_from_stripe"("_stripe_customer_id" "text", "_stripe_subscription_id" "text", "_tier" "public"."subscription_tier", "_status" "public"."subscription_status", "_current_period_start" timestamp with time zone, "_current_period_end" timestamp with time zone, "_trial_end" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _affected_rows INTEGER;
BEGIN
  -- Log the function call
  RAISE LOG 'update_subscription_from_stripe called with: customer_id=%, subscription_id=%, tier=%, status=%', 
    _stripe_customer_id, _stripe_subscription_id, _tier, _status;

  UPDATE public.profiles
  SET
    subscription_tier = _tier,
    subscription_status = _status,
    stripe_subscription_id = _stripe_subscription_id,
    subscription_start_date = _current_period_start,
    subscription_end_date = _current_period_end,
    trial_end_date = _trial_end,
    updated_at = NOW()
  WHERE stripe_customer_id = _stripe_customer_id;

  GET DIAGNOSTICS _affected_rows = ROW_COUNT;
  
  -- Log the result
  RAISE LOG 'update_subscription_from_stripe updated % rows for customer_id=%', _affected_rows, _stripe_customer_id;
  
  -- If no rows were affected, it means the customer doesn't exist
  IF _affected_rows = 0 THEN
    RAISE WARNING 'No profile found for stripe_customer_id: %', _stripe_customer_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_subscription_from_stripe"("_stripe_customer_id" "text", "_stripe_subscription_id" "text", "_tier" "public"."subscription_tier", "_status" "public"."subscription_status", "_current_period_start" timestamp with time zone, "_current_period_end" timestamp with time zone, "_trial_end" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_subscription_from_stripe"("_stripe_customer_id" "text", "_stripe_subscription_id" "text", "_tier" "public"."subscription_tier", "_status" "public"."subscription_status", "_current_period_start" timestamp with time zone, "_current_period_end" timestamp with time zone, "_trial_end" timestamp with time zone) IS 'Updates user subscription from Stripe webhook data with enhanced logging';



CREATE OR REPLACE FUNCTION "public"."update_team_member_role"("_team_id" "uuid", "_user_id" "uuid", "_new_role" "public"."team_member_role") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _current_role public.team_member_role;
BEGIN
  -- Check if user has admin permissions
  IF NOT public.is_team_member(_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to update member role';
  END IF;

  -- Get current role
  SELECT role INTO _current_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  IF _current_role IS NULL THEN
    RAISE EXCEPTION 'User is not a team member';
  END IF;

  -- Cannot change owner role
  IF _current_role = 'owner' OR _new_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change owner role';
  END IF;

  -- Update the role
  UPDATE public.team_members
  SET role = _new_role, updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _user_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."update_team_member_role"("_team_id" "uuid", "_user_id" "uuid", "_new_role" "public"."team_member_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_unified_embeddings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_unified_embeddings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_behavioral_patterns"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  target_user_id UUID;
  patterns_updated INTEGER := 0;
  interaction_count INTEGER;
  communication_pattern JSONB;
  search_pattern JSONB;
  ui_pattern JSONB;
BEGIN
  -- Use provided user_id or current user
  target_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Check if user has enough interactions (minimum 5)
  SELECT COUNT(*) INTO interaction_count
  FROM user_interactions
  WHERE user_id = target_user_id;
  
  IF interaction_count < 5 THEN
    RETURN 0;
  END IF;
  
  -- Analyze communication style patterns
  WITH communication_analysis AS (
    SELECT 
      AVG(CASE WHEN (interaction_context->>'message_length')::INTEGER > 100 THEN 1 ELSE 0 END) as long_message_ratio,
      AVG(CASE WHEN interaction_context->>'contains_question' = 'true' THEN 1 ELSE 0 END) as question_ratio,
      COUNT(*) as total_messages
    FROM user_interactions
    WHERE user_id = target_user_id 
      AND interaction_type = 'chat_message'
      AND timestamp > NOW() - INTERVAL '30 days'
  )
  SELECT jsonb_build_object(
    'preferred_length', CASE 
      WHEN long_message_ratio > 0.6 THEN 'detailed'
      WHEN long_message_ratio < 0.3 THEN 'brief'
      ELSE 'balanced'
    END,
    'question_frequency', question_ratio,
    'communication_style', CASE
      WHEN question_ratio > 0.5 THEN 'inquisitive'
      WHEN long_message_ratio > 0.6 THEN 'detailed'
      ELSE 'balanced'
    END,
    'confidence', LEAST(total_messages / 20.0, 1.0)
  ) INTO communication_pattern
  FROM communication_analysis;
  
  -- Insert or update communication pattern
  INSERT INTO user_behavioral_patterns (
    user_id, pattern_type, pattern_data, confidence, sample_size
  ) VALUES (
    target_user_id, 'communication_style', communication_pattern, 
    (communication_pattern->>'confidence')::NUMERIC, interaction_count
  )
  ON CONFLICT (user_id, pattern_type)
  DO UPDATE SET
    pattern_data = EXCLUDED.pattern_data,
    confidence = EXCLUDED.confidence,
    sample_size = EXCLUDED.sample_size,
    last_computed = NOW();
  
  patterns_updated := patterns_updated + 1;
  
  RETURN patterns_updated;
END;
$$;


ALTER FUNCTION "public"."update_user_behavioral_patterns"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_behavioral_patterns"("p_user_id" "uuid") IS 'Compute and update behavioral patterns from user interactions';



CREATE OR REPLACE FUNCTION "public"."update_user_chat_preferences"("p_preferred_response_style" "text" DEFAULT NULL::"text", "p_common_search_terms" "text"[] DEFAULT NULL::"text"[], "p_frequent_merchants" "text"[] DEFAULT NULL::"text"[], "p_search_filters" "jsonb" DEFAULT NULL::"jsonb", "p_ui_preferences" "jsonb" DEFAULT NULL::"jsonb", "p_notification_preferences" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate response style
  IF p_preferred_response_style IS NOT NULL AND 
     p_preferred_response_style NOT IN ('concise', 'detailed', 'friendly', 'professional') THEN
    RAISE EXCEPTION 'Invalid response style: %', p_preferred_response_style;
  END IF;

  -- Insert or update preferences
  INSERT INTO user_chat_preferences (
    user_id,
    preferred_response_style,
    common_search_terms,
    frequent_merchants,
    search_filters,
    ui_preferences,
    notification_preferences
  ) VALUES (
    v_user_id,
    COALESCE(p_preferred_response_style, 'friendly'),
    COALESCE(p_common_search_terms, '{}'),
    COALESCE(p_frequent_merchants, '{}'),
    COALESCE(p_search_filters, '{}'),
    COALESCE(p_ui_preferences, '{}'),
    COALESCE(p_notification_preferences, '{}')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    preferred_response_style = COALESCE(p_preferred_response_style, user_chat_preferences.preferred_response_style),
    common_search_terms = COALESCE(p_common_search_terms, user_chat_preferences.common_search_terms),
    frequent_merchants = COALESCE(p_frequent_merchants, user_chat_preferences.frequent_merchants),
    search_filters = COALESCE(p_search_filters, user_chat_preferences.search_filters),
    ui_preferences = COALESCE(p_ui_preferences, user_chat_preferences.ui_preferences),
    notification_preferences = COALESCE(p_notification_preferences, user_chat_preferences.notification_preferences),
    updated_at = NOW();

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."update_user_chat_preferences"("p_preferred_response_style" "text", "p_common_search_terms" "text"[], "p_frequent_merchants" "text"[], "p_search_filters" "jsonb", "p_ui_preferences" "jsonb", "p_notification_preferences" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_malaysian_registration_number"("registration_number" "text", "registration_type" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  result JSONB;
  is_valid BOOLEAN := false;
  detected_type TEXT := NULL;
BEGIN
  -- Remove spaces and convert to uppercase
  registration_number := UPPER(REPLACE(registration_number, ' ', ''));
  
  -- SSM Company Registration (e.g., 123456-A, 123456-P, 123456-T)
  IF registration_number ~ '^[0-9]{6}-[APTUVWX]$' THEN
    is_valid := true;
    detected_type := 'SSM';
  -- ROC Registration (e.g., 123456-07)
  ELSIF registration_number ~ '^[0-9]{6}-[0-9]{2}$' THEN
    is_valid := true;
    detected_type := 'ROC';
  -- ROB Registration (e.g., PG0123456-A)
  ELSIF registration_number ~ '^[A-Z]{2}[0-9]{7}-[A-Z]$' THEN
    is_valid := true;
    detected_type := 'ROB';
  -- LLP Registration (e.g., LLP0012345-LGN)
  ELSIF registration_number ~ '^LLP[0-9]{7}-[A-Z]{3}$' THEN
    is_valid := true;
    detected_type := 'LLP';
  END IF;
  
  result := jsonb_build_object(
    'is_valid', is_valid,
    'detected_type', detected_type,
    'formatted_number', registration_number
  );
  
  RETURN result;
END;
$_$;


ALTER FUNCTION "public"."validate_malaysian_registration_number"("registration_number" "text", "registration_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_malaysian_registration_number"("registration_number" "text", "registration_type" "text") IS 'Validates Malaysian business registration numbers (SSM, ROC, ROB, LLP)';



CREATE OR REPLACE FUNCTION "public"."validate_unified_search_setup"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSONB := '{}';
  table_exists BOOLEAN;
  index_count INTEGER;
  function_count INTEGER;
  migrated_count INTEGER;
  unique_combinations INTEGER;
  policy_count INTEGER;
  status_value TEXT;
  missing_count INTEGER;
BEGIN
  -- Check if unified_embeddings table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'unified_embeddings'
  ) INTO table_exists;
  
  result := jsonb_set(result, '{table_exists}', to_jsonb(table_exists));
  
  -- Check indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND tablename = 'unified_embeddings';
  
  result := jsonb_set(result, '{index_count}', to_jsonb(index_count));
  
  -- Check functions
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name IN ('unified_search', 'add_unified_embedding', 'remove_unified_embedding', 'can_perform_unified_search');
  
  result := jsonb_set(result, '{function_count}', to_jsonb(function_count));
  
  -- Check RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename = 'unified_embeddings';
  
  result := jsonb_set(result, '{policy_count}', to_jsonb(policy_count));
  
  -- Check migration status correctly (unique combinations)
  SELECT COUNT(DISTINCT (re.receipt_id, re.content_type)) INTO unique_combinations
  FROM public.receipt_embeddings re
  JOIN public.receipts r ON r.id = re.receipt_id
  WHERE re.embedding IS NOT NULL;
  
  SELECT COUNT(*) INTO migrated_count 
  FROM public.unified_embeddings 
  WHERE source_type = 'receipt';
  
  -- Count missing unique combinations
  SELECT COUNT(*) INTO missing_count
  FROM (
    SELECT DISTINCT re.receipt_id, re.content_type
    FROM public.receipt_embeddings re
    JOIN public.receipts r ON r.id = re.receipt_id
    WHERE re.embedding IS NOT NULL
  ) unique_re
  WHERE NOT EXISTS (
    SELECT 1 FROM public.unified_embeddings ue 
    WHERE ue.source_type = 'receipt' 
    AND ue.source_id = unique_re.receipt_id 
    AND ue.content_type = unique_re.content_type
  );
  
  result := jsonb_set(result, '{unique_combinations}', to_jsonb(unique_combinations));
  result := jsonb_set(result, '{migrated_embeddings}', to_jsonb(migrated_count));
  result := jsonb_set(result, '{missing_combinations}', to_jsonb(missing_count));
  result := jsonb_set(result, '{migration_complete}', to_jsonb(missing_count = 0));
  
  -- Check available data sources
  result := jsonb_set(result, '{available_sources}', jsonb_build_object(
    'receipts', (SELECT COUNT(*) FROM public.receipts),
    'claims', (SELECT COUNT(*) FROM public.claims),
    'team_members', (SELECT COUNT(*) FROM public.team_members),
    'custom_categories', (SELECT COUNT(*) FROM public.custom_categories),
    'business_directory', (SELECT COUNT(*) FROM public.malaysian_business_directory)
  ));
  
  -- Check embedding statistics by source type
  result := jsonb_set(result, '{embedding_stats}', (
    SELECT jsonb_object_agg(source_type, count)
    FROM (
      SELECT source_type, COUNT(*) as count
      FROM public.unified_embeddings
      GROUP BY source_type
    ) stats
  ));
  
  -- Determine overall status
  IF table_exists AND index_count >= 6 AND function_count >= 4 AND policy_count >= 2 AND missing_count = 0 THEN
    status_value := 'ready';
  ELSE
    status_value := 'incomplete';
  END IF;
  
  result := jsonb_set(result, '{status}', to_jsonb(status_value));
  result := jsonb_set(result, '{timestamp}', to_jsonb(NOW()));
  result := jsonb_set(result, '{phase_1_complete}', to_jsonb(status_value = 'ready'));
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."validate_unified_search_setup"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_performance_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_id" character varying(255) NOT NULL,
    "agent_type" character varying(100) NOT NULL,
    "performance_snapshot" "jsonb" NOT NULL,
    "benchmark_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "optimization_recommendations" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_performance_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_key_id" "uuid",
    "user_id" "uuid",
    "team_id" "uuid",
    "endpoint" "text" NOT NULL,
    "method" "text" NOT NULL,
    "status_code" integer NOT NULL,
    "response_time_ms" integer,
    "ip_address" "inet",
    "user_agent" "text",
    "request_size_bytes" integer,
    "response_size_bytes" integer,
    "error_message" "text",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "api_logs_valid_response_time" CHECK (("response_time_ms" >= 0)),
    CONSTRAINT "api_logs_valid_status" CHECK ((("status_code" >= 100) AND ("status_code" < 600)))
);


ALTER TABLE "public"."api_access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "key_hash" character varying(255) NOT NULL,
    "key_prefix" character varying(20) NOT NULL,
    "scopes" "public"."api_scope"[] DEFAULT '{}'::"public"."api_scope"[] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "usage_count" integer DEFAULT 0,
    "created_by" "uuid",
    CONSTRAINT "api_keys_name_length" CHECK ((("char_length"(("name")::"text") >= 3) AND ("char_length"(("name")::"text") <= 255))),
    CONSTRAINT "api_keys_valid_expiry" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "created_at")))
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "api_key_id" "uuid",
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rate_limits_valid_count" CHECK (("request_count" >= 0)),
    CONSTRAINT "rate_limits_valid_window" CHECK (("window_end" > "window_start"))
);


ALTER TABLE "public"."api_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_contexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "search_history" "jsonb" DEFAULT '[]'::"jsonb",
    "user_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "conversation_length" integer DEFAULT 0,
    "session_start_time" timestamp with time zone DEFAULT "now"(),
    "last_keywords" "jsonb",
    "last_results" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_contexts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(20) NOT NULL,
    "content" "text" NOT NULL,
    "message_type" character varying(50) DEFAULT 'text'::character varying,
    "search_results" "jsonb",
    "intent_data" "jsonb",
    "keywords_data" "jsonb",
    "enhancement_data" "jsonb",
    "validation_data" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    CONSTRAINT "chat_messages_message_type_check" CHECK ((("message_type")::"text" = ANY ((ARRAY['text'::character varying, 'search_result'::character varying, 'analysis'::character varying, 'error'::character varying, 'system'::character varying])::"text"[]))),
    CONSTRAINT "chat_messages_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying])::"text"[])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claim_audit_trail" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" character varying(50) NOT NULL,
    "old_status" "public"."claim_status",
    "new_status" "public"."claim_status",
    "comment" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."claim_audit_trail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "claimant_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "amount" numeric(12,2) NOT NULL,
    "currency" character varying(5) DEFAULT 'USD'::character varying NOT NULL,
    "category" character varying(100),
    "priority" "public"."claim_priority" DEFAULT 'medium'::"public"."claim_priority" NOT NULL,
    "status" "public"."claim_status" DEFAULT 'draft'::"public"."claim_status" NOT NULL,
    "submitted_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title_ms" "text",
    "description_ms" "text",
    CONSTRAINT "claims_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "claims_status_workflow" CHECK (((("status" = 'draft'::"public"."claim_status") AND ("submitted_at" IS NULL)) OR (("status" <> 'draft'::"public"."claim_status") AND ("submitted_at" IS NOT NULL)))),
    CONSTRAINT "claims_title_length" CHECK ((("char_length"(("title")::"text") >= 3) AND ("char_length"(("title")::"text") <= 255)))
);


ALTER TABLE "public"."claims" OWNER TO "postgres";


COMMENT ON COLUMN "public"."claims"."title_ms" IS 'Claim title in Malay language';



COMMENT ON COLUMN "public"."claims"."description_ms" IS 'Claim description in Malay language';



CREATE TABLE IF NOT EXISTS "public"."conversation_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_count" integer DEFAULT 0,
    "search_count" integer DEFAULT 0,
    "session_duration_seconds" integer DEFAULT 0,
    "top_search_terms" "jsonb" DEFAULT '[]'::"jsonb",
    "enhancement_stats" "jsonb" DEFAULT '{}'::"jsonb",
    "performance_metrics" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_context" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "context_type" "text" NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "context_tokens" integer DEFAULT 0,
    "relevance_score" numeric(3,2) DEFAULT 1.0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_updated" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversation_context_relevance_score_check" CHECK ((("relevance_score" >= (0)::numeric) AND ("relevance_score" <= (1)::numeric)))
);


ALTER TABLE "public"."conversation_context" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_contexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "conversation_id" "text" NOT NULL,
    "context_type" "text" NOT NULL,
    "context_data" "jsonb" NOT NULL,
    "relevance_score" numeric(3,2) DEFAULT 1.0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversation_contexts_context_type_check" CHECK (("context_type" = ANY (ARRAY['user_intent'::"text", 'topic_focus'::"text", 'emotional_tone'::"text", 'technical_level'::"text", 'conversation_goal'::"text", 'domain_context'::"text"]))),
    CONSTRAINT "conversation_contexts_relevance_score_check" CHECK ((("relevance_score" >= (0)::numeric) AND ("relevance_score" <= (1)::numeric)))
);


ALTER TABLE "public"."conversation_contexts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "memory_type" "text" NOT NULL,
    "memory_key" "text" NOT NULL,
    "memory_data" "jsonb" NOT NULL,
    "confidence_score" numeric(3,2) DEFAULT 0.5,
    "source_conversations" "text"[] DEFAULT '{}'::"text"[],
    "last_accessed" timestamp with time zone DEFAULT "now"(),
    "access_count" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversation_memory_confidence_score_check" CHECK ((("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric))),
    CONSTRAINT "conversation_memory_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['user_preference'::"text", 'conversation_turn'::"text", 'learning_progress'::"text", 'interaction_patterns'::"text", 'domain_knowledge'::"text", 'personal_context'::"text"])))
);


ALTER TABLE "public"."conversation_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "conversation_id" "text" NOT NULL,
    "message_id" "text" NOT NULL,
    "message_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "parent_message_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversation_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['user'::"text", 'ai'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."conversation_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid",
    "title" character varying(255),
    "session_type" character varying(50) DEFAULT 'chat'::character varying,
    "status" character varying(50) DEFAULT 'active'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "conversation_sessions_session_type_check" CHECK ((("session_type")::"text" = ANY ((ARRAY['chat'::character varying, 'search'::character varying, 'analysis'::character varying, 'support'::character varying])::"text"[]))),
    CONSTRAINT "conversation_sessions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'archived'::character varying, 'deleted'::character varying])::"text"[])))
);


ALTER TABLE "public"."conversation_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "text" NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "is_archived" boolean DEFAULT false,
    "is_favorite" boolean DEFAULT false,
    "message_count" integer DEFAULT 0,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."corrections" (
    "id" integer NOT NULL,
    "receipt_id" "uuid",
    "field_name" "text" NOT NULL,
    "original_value" "text",
    "ai_suggestion" "text",
    "corrected_value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."corrections" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."corrections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."corrections_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."corrections_id_seq" OWNED BY "public"."corrections"."id";



CREATE TABLE IF NOT EXISTS "public"."custom_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#3B82F6'::"text" NOT NULL,
    "icon" "text" DEFAULT 'tag'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name_ms" "text",
    CONSTRAINT "valid_color_format" CHECK (("color" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "valid_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 50)))
);


ALTER TABLE "public"."custom_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_categories" IS 'User-defined categories for organizing receipts';



COMMENT ON COLUMN "public"."custom_categories"."color" IS 'Hex color code for category display (e.g., #3B82F6)';



COMMENT ON COLUMN "public"."custom_categories"."icon" IS 'Icon name for category display (e.g., tag, shopping-cart, etc.)';



COMMENT ON COLUMN "public"."custom_categories"."name_ms" IS 'Category name in Malay language';



CREATE TABLE IF NOT EXISTS "public"."email_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_email" character varying(255) NOT NULL,
    "subject" character varying(500) NOT NULL,
    "template_name" character varying(100),
    "status" "public"."email_delivery_status" DEFAULT 'pending'::"public"."email_delivery_status" NOT NULL,
    "provider_message_id" character varying(255),
    "error_message" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 3 NOT NULL,
    "related_entity_type" character varying(50),
    "related_entity_id" "uuid",
    "team_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "next_retry_at" timestamp with time zone,
    CONSTRAINT "email_deliveries_retry_count_valid" CHECK ((("retry_count" >= 0) AND ("retry_count" <= "max_retries")))
);


ALTER TABLE "public"."email_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unified_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "content_text" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "user_id" "uuid",
    "team_id" "uuid",
    "language" "text" DEFAULT 'en'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."unified_embeddings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."embedding_content_health" AS
 SELECT "unified_embeddings"."source_type",
    "unified_embeddings"."content_type",
    "count"(*) AS "total_embeddings",
    "count"(
        CASE
            WHEN (("unified_embeddings"."content_text" IS NULL) OR (TRIM(BOTH FROM "unified_embeddings"."content_text") = ''::"text")) THEN 1
            ELSE NULL::integer
        END) AS "empty_content",
    "count"(
        CASE
            WHEN (("unified_embeddings"."content_text" IS NOT NULL) AND (TRIM(BOTH FROM "unified_embeddings"."content_text") <> ''::"text")) THEN 1
            ELSE NULL::integer
        END) AS "has_content",
    "round"(((("count"(
        CASE
            WHEN (("unified_embeddings"."content_text" IS NOT NULL) AND (TRIM(BOTH FROM "unified_embeddings"."content_text") <> ''::"text")) THEN 1
            ELSE NULL::integer
        END))::numeric / ("count"(*))::numeric) * (100)::numeric), 2) AS "content_health_percentage"
   FROM "public"."unified_embeddings"
  GROUP BY "unified_embeddings"."source_type", "unified_embeddings"."content_type"
  ORDER BY "unified_embeddings"."source_type", "unified_embeddings"."content_type";


ALTER TABLE "public"."embedding_content_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."embedding_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "operation" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."embedding_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."errors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eta_calculations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workflow_id" character varying(255) NOT NULL,
    "estimated_completion" timestamp with time zone,
    "confidence_score" numeric(5,4) DEFAULT 0,
    "method_used" character varying(100),
    "calculation_factors" "jsonb" DEFAULT '{}'::"jsonb",
    "actual_completion" timestamp with time zone,
    "accuracy_score" numeric(5,4),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."eta_calculations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."line_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."line_items" IS 'Line items table with single foreign key constraint to receipts table (duplicate fk_receipt constraint removed)';



CREATE TABLE IF NOT EXISTS "public"."load_balancing_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "insight_type" character varying(50) NOT NULL,
    "message" "text" NOT NULL,
    "affected_agents" "text"[] DEFAULT '{}'::"text"[],
    "priority" character varying(20) NOT NULL,
    "resolved" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "load_balancing_insights_insight_type_check" CHECK ((("insight_type")::"text" = ANY ((ARRAY['optimization'::character varying, 'warning'::character varying, 'recommendation'::character varying])::"text"[]))),
    CONSTRAINT "load_balancing_insights_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::"text"[])))
);


ALTER TABLE "public"."load_balancing_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."malaysian_address_formats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state_name" character varying(50) NOT NULL,
    "state_code" character varying(10) NOT NULL,
    "postcode_pattern" character varying(20) NOT NULL,
    "common_cities" "text"[],
    "timezone" character varying(50) DEFAULT 'Asia/Kuala_Lumpur'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_address_formats" OWNER TO "postgres";


COMMENT ON TABLE "public"."malaysian_address_formats" IS 'Malaysian state and postcode patterns for address validation';



CREATE TABLE IF NOT EXISTS "public"."malaysian_business_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_type" character varying(100) NOT NULL,
    "business_keywords" "text"[],
    "tax_category_id" "uuid",
    "confidence_weight" integer DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_business_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."malaysian_business_directory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_name" character varying(200) NOT NULL,
    "business_name_malay" character varying(200),
    "business_type" character varying(100) NOT NULL,
    "registration_number" character varying(50),
    "registration_type" character varying(20),
    "address_line1" "text",
    "address_line2" "text",
    "city" character varying(100),
    "state" character varying(50),
    "postcode" character varying(10),
    "phone" character varying(20),
    "website" character varying(200),
    "industry_category" character varying(100),
    "is_chain" boolean DEFAULT false,
    "parent_company" character varying(200),
    "keywords" "text"[],
    "confidence_score" integer DEFAULT 100,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_business_directory" OWNER TO "postgres";


COMMENT ON TABLE "public"."malaysian_business_directory" IS 'Comprehensive directory of Malaysian businesses for enhanced recognition';



CREATE TABLE IF NOT EXISTS "public"."malaysian_business_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_type" character varying(100) NOT NULL,
    "day_of_week" integer NOT NULL,
    "open_time" time without time zone,
    "close_time" time without time zone,
    "is_closed" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_business_hours" OWNER TO "postgres";


COMMENT ON TABLE "public"."malaysian_business_hours" IS 'Typical business hours for different types of Malaysian businesses';



CREATE TABLE IF NOT EXISTS "public"."malaysian_cultural_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "preference_name" character varying(100) NOT NULL,
    "preference_category" character varying(50) NOT NULL,
    "default_value" "text" NOT NULL,
    "possible_values" "text"[],
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_cultural_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."malaysian_cultural_preferences" IS 'Cultural preferences for Malaysian users (date/time/number formats)';



CREATE TABLE IF NOT EXISTS "public"."malaysian_currency_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_currency" character varying(5) NOT NULL,
    "to_currency" character varying(5) NOT NULL,
    "exchange_rate" numeric(10,6) NOT NULL,
    "rate_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "source" character varying(50) DEFAULT 'manual'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_currency_rates" OWNER TO "postgres";


COMMENT ON TABLE "public"."malaysian_currency_rates" IS 'Exchange rates for Malaysian Ringgit and other currencies';



CREATE TABLE IF NOT EXISTS "public"."malaysian_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "method_name" character varying(100) NOT NULL,
    "method_type" character varying(50) NOT NULL,
    "provider" character varying(100),
    "keywords" "text"[],
    "is_active" boolean DEFAULT true,
    "processing_fee_percentage" numeric(5,2) DEFAULT 0.00,
    "min_amount" numeric(10,2) DEFAULT 0.00,
    "max_amount" numeric(10,2),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_payment_methods" OWNER TO "postgres";


COMMENT ON TABLE "public"."malaysian_payment_methods" IS 'Malaysian payment methods with detection keywords and processing fees';



CREATE TABLE IF NOT EXISTS "public"."malaysian_public_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "holiday_name" character varying(100) NOT NULL,
    "holiday_name_malay" character varying(100),
    "holiday_date" "date" NOT NULL,
    "holiday_type" character varying(50) NOT NULL,
    "applicable_states" "text"[],
    "is_recurring" boolean DEFAULT false,
    "recurring_pattern" character varying(100),
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_public_holidays" OWNER TO "postgres";


COMMENT ON TABLE "public"."malaysian_public_holidays" IS 'Malaysian federal and state public holidays with recurring patterns';



CREATE TABLE IF NOT EXISTS "public"."malaysian_receipt_formats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_type" character varying(100) NOT NULL,
    "format_name" character varying(100) NOT NULL,
    "currency_patterns" "text"[],
    "amount_patterns" "text"[],
    "tax_patterns" "text"[],
    "payment_patterns" "text"[],
    "date_patterns" "text"[],
    "confidence_weight" integer DEFAULT 100,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_receipt_formats" OWNER TO "postgres";


COMMENT ON TABLE "public"."malaysian_receipt_formats" IS 'Receipt format patterns for better parsing of Malaysian receipts';



CREATE TABLE IF NOT EXISTS "public"."malaysian_tax_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tax_type" character varying(20) NOT NULL,
    "category_name" character varying(100) NOT NULL,
    "category_code" character varying(20),
    "tax_rate" numeric(5,2) NOT NULL,
    "description" "text",
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."malaysian_tax_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "text" NOT NULL,
    "conversation_id" "text",
    "user_id" "uuid",
    "feedback_type" "text" NOT NULL,
    "feedback_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_feedback_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['positive'::"text", 'negative'::"text"])))
);


ALTER TABLE "public"."message_feedback" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_malaysian_reference_data" AS
 SELECT 'business_directory'::"text" AS "data_type",
    "mbd"."business_name" AS "name",
    "mbd"."business_type" AS "category",
    "mbd"."keywords",
    "mbd"."confidence_score",
    NULL::numeric AS "rate",
    NULL::"text"[] AS "states"
   FROM "public"."malaysian_business_directory" "mbd"
  WHERE ("mbd"."is_active" = true)
UNION ALL
 SELECT 'tax_categories'::"text" AS "data_type",
    "mtc"."category_name" AS "name",
    "mtc"."tax_type" AS "category",
    NULL::"text"[] AS "keywords",
    100 AS "confidence_score",
    "mtc"."tax_rate" AS "rate",
    NULL::"text"[] AS "states"
   FROM "public"."malaysian_tax_categories" "mtc"
  WHERE ("mtc"."is_active" = true)
UNION ALL
 SELECT 'payment_methods'::"text" AS "data_type",
    "mpm"."method_name" AS "name",
    "mpm"."method_type" AS "category",
    "mpm"."keywords",
    90 AS "confidence_score",
    "mpm"."processing_fee_percentage" AS "rate",
    NULL::"text"[] AS "states"
   FROM "public"."malaysian_payment_methods" "mpm"
  WHERE ("mpm"."is_active" = true)
UNION ALL
 SELECT 'holidays'::"text" AS "data_type",
    "mph"."holiday_name" AS "name",
    "mph"."holiday_type" AS "category",
    NULL::"text"[] AS "keywords",
    100 AS "confidence_score",
    NULL::numeric AS "rate",
    "mph"."applicable_states" AS "states"
   FROM "public"."malaysian_public_holidays" "mph"
  WHERE (("mph"."is_active" = true) AND ("mph"."holiday_date" >= (CURRENT_DATE - '1 year'::interval)) AND ("mph"."holiday_date" <= (CURRENT_DATE + '1 year'::interval)))
  WITH NO DATA;


ALTER TABLE "public"."mv_malaysian_reference_data" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."mv_malaysian_reference_data" IS 'Cached reference data for Malaysian business, tax, payment, and holiday information';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "team_id" "uuid",
    "type" "public"."notification_type" NOT NULL,
    "priority" "public"."notification_priority" DEFAULT 'medium'::"public"."notification_priority" NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "action_url" "text",
    "read_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "related_entity_type" character varying(50),
    "related_entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "title_ms" "text",
    "message_ms" "text",
    CONSTRAINT "notifications_title_length" CHECK ((("char_length"(("title")::"text") >= 1) AND ("char_length"(("title")::"text") <= 255)))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notifications"."title_ms" IS 'Notification title in Malay language';



COMMENT ON COLUMN "public"."notifications"."message_ms" IS 'Notification message in Malay language';



CREATE TABLE IF NOT EXISTS "public"."payment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" "text" NOT NULL,
    "stripe_subscription_id" "text",
    "amount" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "tier" "public"."subscription_tier" NOT NULL,
    "billing_period_start" timestamp with time zone,
    "billing_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_history" IS 'Stores payment transaction history';



CREATE TABLE IF NOT EXISTS "public"."performance_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "alert_type" character varying(50) NOT NULL,
    "severity" character varying(20) NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "source_component" character varying(100),
    "affected_resources" "jsonb" DEFAULT '{}'::"jsonb",
    "acknowledged" boolean DEFAULT false,
    "resolved" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "acknowledged_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "performance_alerts_severity_check" CHECK ((("severity")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::"text"[])))
);


ALTER TABLE "public"."performance_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cache_key" character varying(255) NOT NULL,
    "cache_value" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."performance_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."performance_cache" IS 'Caching table for Malaysian multi-language performance optimizations';



CREATE TABLE IF NOT EXISTS "public"."performance_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metric_name" character varying(100) NOT NULL,
    "metric_type" character varying(50) NOT NULL,
    "metric_value" numeric(10,3) NOT NULL,
    "metric_unit" character varying(20) NOT NULL,
    "context" "jsonb",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."performance_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."performance_metrics" IS 'Performance monitoring and analytics for Malaysian multi-language features';



CREATE OR REPLACE VIEW "public"."performance_dashboard" AS
 SELECT "pm"."metric_name",
    "pm"."metric_type",
    "count"(*) AS "total_measurements",
    "round"("avg"("pm"."metric_value"), 2) AS "avg_value",
    "round"("min"("pm"."metric_value"), 2) AS "min_value",
    "round"("max"("pm"."metric_value"), 2) AS "max_value",
    "round"("stddev"("pm"."metric_value"), 2) AS "std_deviation",
    "pm"."metric_unit",
    "max"("pm"."created_at") AS "last_measurement"
   FROM "public"."performance_metrics" "pm"
  WHERE ("pm"."created_at" >= ("now"() - '01:00:00'::interval))
  GROUP BY "pm"."metric_name", "pm"."metric_type", "pm"."metric_unit"
  ORDER BY "pm"."metric_name";


ALTER TABLE "public"."performance_dashboard" OWNER TO "postgres";


COMMENT ON VIEW "public"."performance_dashboard" IS 'Real-time performance dashboard view with key metrics';



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "excerpt" "text",
    "image_url" "text",
    "tags" "text"[],
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "author_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processing_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status_message" "text" NOT NULL,
    "step_name" "text",
    "batch_item_id" "uuid"
);


ALTER TABLE "public"."processing_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."processing_logs" IS 'Processing logs table with single foreign key constraint to receipts table (duplicate fk_receipt constraint removed)';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subscription_tier" "public"."subscription_tier" DEFAULT 'free'::"public"."subscription_tier",
    "subscription_status" "public"."subscription_status" DEFAULT 'active'::"public"."subscription_status",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "subscription_start_date" timestamp with time zone,
    "subscription_end_date" timestamp with time zone,
    "trial_end_date" timestamp with time zone,
    "receipts_used_this_month" integer DEFAULT 0,
    "monthly_reset_date" timestamp with time zone DEFAULT ("date_trunc"('month'::"text", "now"()) + '1 mon'::interval),
    "email" "text",
    "avatar_url" "text",
    "google_avatar_url" "text",
    "avatar_updated_at" timestamp with time zone,
    "preferred_language" character varying(10) DEFAULT 'en'::character varying,
    "date_format_preference" character varying(20) DEFAULT 'DD/MM/YYYY'::character varying,
    "time_format_preference" character varying(10) DEFAULT '24h'::character varying,
    "number_format_preference" character varying(20) DEFAULT 'MY'::character varying,
    "timezone_preference" character varying(50) DEFAULT 'Asia/Kuala_Lumpur'::character varying,
    "cultural_context" character varying(20) DEFAULT 'MY'::character varying
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."avatar_url" IS 'URL to user-uploaded custom avatar image';



COMMENT ON COLUMN "public"."profiles"."google_avatar_url" IS 'URL to Google profile picture from OAuth';



COMMENT ON COLUMN "public"."profiles"."avatar_updated_at" IS 'Timestamp when avatar was last updated';



COMMENT ON COLUMN "public"."profiles"."preferred_language" IS 'User preferred language code (en, ms, etc.)';



COMMENT ON COLUMN "public"."profiles"."date_format_preference" IS 'User preferred date format (DD/MM/YYYY, MM/DD/YYYY, etc.)';



COMMENT ON COLUMN "public"."profiles"."time_format_preference" IS 'User preferred time format (12h or 24h)';



COMMENT ON COLUMN "public"."profiles"."number_format_preference" IS 'User preferred number format (MY, US, EU)';



COMMENT ON COLUMN "public"."profiles"."timezone_preference" IS 'User preferred timezone (default: Asia/Kuala_Lumpur)';



COMMENT ON COLUMN "public"."profiles"."cultural_context" IS 'User cultural context for localization (MY, SG, etc.)';



CREATE TABLE IF NOT EXISTS "public"."receipt_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receipt_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "merchant" character varying(255) NOT NULL,
    "date" "date" NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "tax" numeric(10,2),
    "currency" character varying(5) DEFAULT 'USD'::character varying,
    "payment_method" character varying(100),
    "status" character varying(50) DEFAULT 'unreviewed'::character varying,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fullText" "text",
    "ai_suggestions" "jsonb",
    "predicted_category" "text",
    "document_structure" "jsonb",
    "field_geometry" "jsonb",
    "model_used" "text",
    "primary_method" "text",
    "has_alternative_data" boolean DEFAULT false,
    "discrepancies" "jsonb",
    "processing_time" double precision,
    "processing_status" "text",
    "processing_error" "text",
    "confidence_scores" "jsonb",
    "thumbnail_url" "text",
    "batch_id" "uuid",
    "currency_converted" boolean DEFAULT false,
    "normalized_merchant" "text",
    "has_embeddings" boolean DEFAULT false,
    "embedding_status" "text",
    "team_id" "uuid",
    "custom_category_id" "uuid",
    "detected_tax_type" character varying(20),
    "detected_tax_rate" numeric(5,2),
    "tax_breakdown" "jsonb",
    "is_tax_inclusive" boolean DEFAULT true,
    "malaysian_business_category" character varying(100),
    "malaysian_registration_number" character varying(50),
    "malaysian_business_type" character varying(100),
    "detected_state" character varying(50),
    "address_confidence" integer DEFAULT 0,
    "original_currency" character varying(5),
    "exchange_rate" numeric(10,6),
    "payment_method_confidence" integer DEFAULT 0,
    "currency_confidence" integer DEFAULT 0,
    "malaysian_payment_provider" character varying(100),
    "merchant_normalized" "text",
    "merchant_category" character varying(100),
    "business_type" character varying(100),
    "location_city" character varying(100),
    "location_state" character varying(50),
    "location_country" character varying(50) DEFAULT 'Malaysia'::character varying,
    "receipt_type" character varying(50),
    "transaction_time" time without time zone,
    "item_count" integer DEFAULT 0,
    "discount_amount" numeric(10,2) DEFAULT 0,
    "service_charge" numeric(10,2) DEFAULT 0,
    "tip_amount" numeric(10,2) DEFAULT 0,
    "subtotal" numeric(10,2),
    "total_before_tax" numeric(10,2),
    "cashier_name" character varying(100),
    "receipt_number" character varying(100),
    "transaction_id" character varying(100),
    "loyalty_program" character varying(100),
    "loyalty_points" integer,
    "payment_card_last4" character varying(4),
    "payment_approval_code" character varying(50),
    "is_business_expense" boolean DEFAULT false,
    "expense_type" character varying(100),
    "vendor_registration_number" character varying(100),
    "invoice_number" character varying(100),
    "purchase_order_number" character varying(100),
    "line_items_analysis" "jsonb",
    "spending_patterns" "jsonb",
    "anomaly_flags" "jsonb",
    "extraction_metadata" "jsonb"
);


ALTER TABLE "public"."receipts" OWNER TO "postgres";


COMMENT ON TABLE "public"."receipts" IS 'Updated deprecated models to use available models on 2025-02-03';



COMMENT ON COLUMN "public"."receipts"."currency" IS 'ISO 4217 currency code (3 letters, uppercase). Common mappings: RM->MYR, $->USD, €->EUR, £->GBP, etc.';



COMMENT ON COLUMN "public"."receipts"."document_structure" IS 'Stores the raw document structure from OCR processing';



COMMENT ON COLUMN "public"."receipts"."field_geometry" IS 'Stores the bounding box coordinates for each field';



COMMENT ON COLUMN "public"."receipts"."model_used" IS 'The AI model used for processing (e.g., gemini-1.5-flash)';



COMMENT ON COLUMN "public"."receipts"."primary_method" IS 'The primary processing method used (ocr-ai or ai-vision)';



COMMENT ON COLUMN "public"."receipts"."has_alternative_data" IS 'Whether alternative processing method data is available';



COMMENT ON COLUMN "public"."receipts"."discrepancies" IS 'Discrepancies found between primary and alternative processing methods';



COMMENT ON COLUMN "public"."receipts"."processing_time" IS 'Time taken for backend processing (e.g., in seconds)';



COMMENT ON COLUMN "public"."receipts"."processing_status" IS 'Tracks the current status of receipt processing (uploading, uploaded, processing_ocr, etc.)';



COMMENT ON COLUMN "public"."receipts"."processing_error" IS 'Stores error messages if processing fails at any step';



COMMENT ON COLUMN "public"."receipts"."confidence_scores" IS 'Stores the calculated confidence scores for various extracted fields as a JSON object.';



COMMENT ON COLUMN "public"."receipts"."thumbnail_url" IS 'URL to the thumbnail version of the receipt image';



CREATE TABLE IF NOT EXISTS "public"."subscription_limits" (
    "tier" "public"."subscription_tier" NOT NULL,
    "monthly_receipts" integer NOT NULL,
    "storage_limit_mb" integer NOT NULL,
    "retention_days" integer NOT NULL,
    "batch_upload_limit" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version_control_enabled" boolean DEFAULT false,
    "integrations_level" "text" DEFAULT 'none'::"text",
    "custom_branding_enabled" boolean DEFAULT false,
    "max_users" integer DEFAULT 1,
    "support_level" "text" DEFAULT 'basic'::"text",
    "api_access_enabled" boolean DEFAULT false,
    "stripe_monthly_price_id" "text",
    "stripe_annual_price_id" "text"
);


ALTER TABLE "public"."subscription_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_limits" IS 'Updated pricing structure: Free (50 receipts), Pro (500 receipts), Max (unlimited) - Updated 2025-01-28';



COMMENT ON COLUMN "public"."subscription_limits"."version_control_enabled" IS 'Whether version control features are enabled for this tier';



COMMENT ON COLUMN "public"."subscription_limits"."integrations_level" IS 'Level of integrations available: none, basic, advanced';



COMMENT ON COLUMN "public"."subscription_limits"."custom_branding_enabled" IS 'Whether custom branding is available for this tier';



COMMENT ON COLUMN "public"."subscription_limits"."max_users" IS 'Maximum number of users allowed (-1 for unlimited)';



COMMENT ON COLUMN "public"."subscription_limits"."support_level" IS 'Level of support: basic, standard, priority';



COMMENT ON COLUMN "public"."subscription_limits"."api_access_enabled" IS 'Whether API access is enabled for this tier';



COMMENT ON COLUMN "public"."subscription_limits"."stripe_monthly_price_id" IS 'Stripe price ID for monthly billing';



COMMENT ON COLUMN "public"."subscription_limits"."stripe_annual_price_id" IS 'Stripe price ID for annual billing';



CREATE TABLE IF NOT EXISTS "public"."team_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "role" "public"."team_member_role" DEFAULT 'member'::"public"."team_member_role" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status" NOT NULL,
    "token" character varying(255) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_invitations_email_format" CHECK ((("email")::"text" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "team_invitations_expires_future" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."team_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."team_member_role" DEFAULT 'member'::"public"."team_member_role" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "slug" character varying(100) NOT NULL,
    "status" "public"."team_status" DEFAULT 'active'::"public"."team_status" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teams_name_length" CHECK ((("char_length"(("name")::"text") >= 2) AND ("char_length"(("name")::"text") <= 255))),
    CONSTRAINT "teams_slug_format" CHECK ((("slug")::"text" ~ '^[a-z0-9-]+$'::"text")),
    CONSTRAINT "teams_slug_length" CHECK ((("char_length"(("slug")::"text") >= 2) AND ("char_length"(("slug")::"text") <= 100)))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "namespace" character varying(50) NOT NULL,
    "key" character varying(200) NOT NULL,
    "language" character varying(10) NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."translations" OWNER TO "postgres";


COMMENT ON TABLE "public"."translations" IS 'Dynamic translations for UI elements';



CREATE TABLE IF NOT EXISTS "public"."user_behavioral_patterns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "pattern_type" "text" NOT NULL,
    "pattern_data" "jsonb" NOT NULL,
    "confidence" numeric(3,2) DEFAULT 0.5,
    "sample_size" integer DEFAULT 0,
    "last_computed" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_behavioral_patterns_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "user_behavioral_patterns_pattern_type_check" CHECK (("pattern_type" = ANY (ARRAY['communication_style'::"text", 'response_preference'::"text", 'search_patterns'::"text", 'ui_usage_patterns'::"text", 'feature_adoption'::"text", 'time_patterns'::"text", 'content_engagement'::"text", 'feedback_patterns'::"text"])))
);


ALTER TABLE "public"."user_behavioral_patterns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_chat_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "preferred_response_style" character varying(50) DEFAULT 'friendly'::character varying,
    "common_search_terms" "jsonb" DEFAULT '[]'::"jsonb",
    "frequent_merchants" "jsonb" DEFAULT '[]'::"jsonb",
    "search_filters" "jsonb" DEFAULT '{}'::"jsonb",
    "ui_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "notification_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_chat_preferences_preferred_response_style_check" CHECK ((("preferred_response_style")::"text" = ANY ((ARRAY['concise'::character varying, 'detailed'::character varying, 'friendly'::character varying, 'professional'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_chat_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text" NOT NULL,
    "interaction_type" "text" NOT NULL,
    "interaction_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "interaction_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['chat_message'::"text", 'search_query'::"text", 'ui_action'::"text", 'feature_usage'::"text", 'feedback_given'::"text", 'preference_change'::"text", 'session_activity'::"text", 'error_encountered'::"text"])))
);


ALTER TABLE "public"."user_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_personalization_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "profile_completeness" "text" DEFAULT 'minimal'::"text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "behavioral_patterns" "jsonb" DEFAULT '{}'::"jsonb",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_personalization_profiles_profile_completeness_check" CHECK (("profile_completeness" = ANY (ARRAY['minimal'::"text", 'basic'::"text", 'intermediate'::"text", 'complete'::"text"])))
);


ALTER TABLE "public"."user_personalization_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "preference_category" "text" NOT NULL,
    "preference_key" "text" NOT NULL,
    "preference_value" "jsonb" NOT NULL,
    "confidence_score" numeric(3,2) DEFAULT 0.5,
    "learning_source" "text",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_preferences_confidence_score_check" CHECK ((("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric))),
    CONSTRAINT "user_preferences_learning_source_check" CHECK (("learning_source" = ANY (ARRAY['explicit_setting'::"text", 'behavioral_analysis'::"text", 'feedback_pattern'::"text", 'usage_frequency'::"text", 'time_analysis'::"text", 'interaction_style'::"text"]))),
    CONSTRAINT "user_preferences_preference_category_check" CHECK (("preference_category" = ANY (ARRAY['communication_style'::"text", 'response_length'::"text", 'technical_detail_level'::"text", 'ui_layout'::"text", 'feature_usage'::"text", 'search_behavior'::"text", 'content_preferences'::"text", 'interaction_patterns'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Stores user role assignments for RBAC';



CREATE TABLE IF NOT EXISTS "public"."workflow_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workflow_id" character varying(255) NOT NULL,
    "progress_percentage" numeric(5,2) DEFAULT 0,
    "eta_seconds" integer DEFAULT 0,
    "current_step" character varying(255),
    "agent_assignments" "jsonb" DEFAULT '{}'::"jsonb",
    "performance_data" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workflow_progress" OWNER TO "postgres";


ALTER TABLE ONLY "public"."corrections" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."corrections_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agent_performance_history"
    ADD CONSTRAINT "agent_performance_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_access_logs"
    ADD CONSTRAINT "api_access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_user_id_api_key_id_window_start_key" UNIQUE ("user_id", "api_key_id", "window_start");



ALTER TABLE ONLY "public"."chat_contexts"
    ADD CONSTRAINT "chat_contexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claim_audit_trail"
    ADD CONSTRAINT "claim_audit_trail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_analytics"
    ADD CONSTRAINT "conversation_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_context"
    ADD CONSTRAINT "conversation_context_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_contexts"
    ADD CONSTRAINT "conversation_contexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_memory"
    ADD CONSTRAINT "conversation_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_memory"
    ADD CONSTRAINT "conversation_memory_user_id_memory_type_memory_key_key" UNIQUE ("user_id", "memory_type", "memory_key");



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_conversation_id_message_id_key" UNIQUE ("conversation_id", "message_id");



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corrections"
    ADD CONSTRAINT "corrections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_deliveries"
    ADD CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embedding_queue"
    ADD CONSTRAINT "embedding_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."errors"
    ADD CONSTRAINT "errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eta_calculations"
    ADD CONSTRAINT "eta_calculations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."line_items"
    ADD CONSTRAINT "line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."load_balancing_insights"
    ADD CONSTRAINT "load_balancing_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_address_formats"
    ADD CONSTRAINT "malaysian_address_formats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_business_categories"
    ADD CONSTRAINT "malaysian_business_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_business_directory"
    ADD CONSTRAINT "malaysian_business_directory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_business_hours"
    ADD CONSTRAINT "malaysian_business_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_cultural_preferences"
    ADD CONSTRAINT "malaysian_cultural_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_cultural_preferences"
    ADD CONSTRAINT "malaysian_cultural_preferences_preference_name_key" UNIQUE ("preference_name");



ALTER TABLE ONLY "public"."malaysian_currency_rates"
    ADD CONSTRAINT "malaysian_currency_rates_from_currency_to_currency_rate_dat_key" UNIQUE ("from_currency", "to_currency", "rate_date");



ALTER TABLE ONLY "public"."malaysian_currency_rates"
    ADD CONSTRAINT "malaysian_currency_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_payment_methods"
    ADD CONSTRAINT "malaysian_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_public_holidays"
    ADD CONSTRAINT "malaysian_public_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_receipt_formats"
    ADD CONSTRAINT "malaysian_receipt_formats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."malaysian_tax_categories"
    ADD CONSTRAINT "malaysian_tax_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_feedback"
    ADD CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_alerts"
    ADD CONSTRAINT "performance_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_cache"
    ADD CONSTRAINT "performance_cache_cache_key_key" UNIQUE ("cache_key");



ALTER TABLE ONLY "public"."performance_cache"
    ADD CONSTRAINT "performance_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_metrics"
    ADD CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."processing_logs"
    ADD CONSTRAINT "processing_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipt_embeddings"
    ADD CONSTRAINT "receipt_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_limits"
    ADD CONSTRAINT "subscription_limits_pkey" PRIMARY KEY ("tier");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_user_id_key" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."translations"
    ADD CONSTRAINT "translations_namespace_key_language_key" UNIQUE ("namespace", "key", "language");



ALTER TABLE ONLY "public"."translations"
    ADD CONSTRAINT "translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unified_embeddings"
    ADD CONSTRAINT "unified_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unified_embeddings"
    ADD CONSTRAINT "unified_embeddings_unique_source_content" UNIQUE ("source_type", "source_id", "content_type");



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "unique_category_name_per_user" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."unified_embeddings"
    ADD CONSTRAINT "unique_unified_embedding" UNIQUE ("source_type", "source_id", "content_type");



ALTER TABLE ONLY "public"."user_behavioral_patterns"
    ADD CONSTRAINT "user_behavioral_patterns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_behavioral_patterns"
    ADD CONSTRAINT "user_behavioral_patterns_user_id_pattern_type_key" UNIQUE ("user_id", "pattern_type");



ALTER TABLE ONLY "public"."user_chat_preferences"
    ADD CONSTRAINT "user_chat_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_chat_preferences"
    ADD CONSTRAINT "user_chat_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_personalization_profiles"
    ADD CONSTRAINT "user_personalization_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_personalization_profiles"
    ADD CONSTRAINT "user_personalization_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_preference_category_preference_key_key" UNIQUE ("user_id", "preference_category", "preference_key");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role");



ALTER TABLE ONLY "public"."workflow_progress"
    ADD CONSTRAINT "workflow_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_progress"
    ADD CONSTRAINT "workflow_progress_workflow_id_user_id_key" UNIQUE ("workflow_id", "user_id");



CREATE INDEX "embedding_queue_source_idx" ON "public"."embedding_queue" USING "btree" ("source_type", "source_id");



CREATE INDEX "embedding_queue_status_idx" ON "public"."embedding_queue" USING "btree" ("status", "priority", "created_at");



CREATE INDEX "idx_api_keys_active" ON "public"."api_keys" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_api_keys_expires" ON "public"."api_keys" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_api_keys_key_hash" ON "public"."api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_api_keys_team_id" ON "public"."api_keys" USING "btree" ("team_id");



CREATE INDEX "idx_api_keys_user_id" ON "public"."api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_api_logs_api_key_id" ON "public"."api_access_logs" USING "btree" ("api_key_id");



CREATE INDEX "idx_api_logs_endpoint" ON "public"."api_access_logs" USING "btree" ("endpoint");



CREATE INDEX "idx_api_logs_status" ON "public"."api_access_logs" USING "btree" ("status_code");



CREATE INDEX "idx_api_logs_timestamp" ON "public"."api_access_logs" USING "btree" ("timestamp");



CREATE INDEX "idx_api_logs_user_id" ON "public"."api_access_logs" USING "btree" ("user_id");



CREATE INDEX "idx_behavioral_patterns_computed" ON "public"."user_behavioral_patterns" USING "btree" ("last_computed");



CREATE INDEX "idx_behavioral_patterns_confidence" ON "public"."user_behavioral_patterns" USING "btree" ("confidence");



CREATE INDEX "idx_behavioral_patterns_type" ON "public"."user_behavioral_patterns" USING "btree" ("pattern_type");



CREATE INDEX "idx_behavioral_patterns_user_id" ON "public"."user_behavioral_patterns" USING "btree" ("user_id");



CREATE INDEX "idx_chat_contexts_conversation_id" ON "public"."chat_contexts" USING "btree" ("conversation_id");



CREATE INDEX "idx_chat_contexts_user_id" ON "public"."chat_contexts" USING "btree" ("user_id");



CREATE INDEX "idx_chat_messages_conversation_id" ON "public"."chat_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_chat_messages_created_at" ON "public"."chat_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chat_messages_message_type" ON "public"."chat_messages" USING "btree" ("message_type");



CREATE INDEX "idx_chat_messages_not_deleted" ON "public"."chat_messages" USING "btree" ("conversation_id", "created_at") WHERE (NOT "is_deleted");



CREATE INDEX "idx_chat_messages_role" ON "public"."chat_messages" USING "btree" ("role");



CREATE INDEX "idx_chat_messages_user_id" ON "public"."chat_messages" USING "btree" ("user_id");



CREATE INDEX "idx_claim_audit_trail_action" ON "public"."claim_audit_trail" USING "btree" ("action");



CREATE INDEX "idx_claim_audit_trail_claim_id" ON "public"."claim_audit_trail" USING "btree" ("claim_id");



CREATE INDEX "idx_claim_audit_trail_created_at" ON "public"."claim_audit_trail" USING "btree" ("created_at");



CREATE INDEX "idx_claim_audit_trail_user_id" ON "public"."claim_audit_trail" USING "btree" ("user_id");



CREATE INDEX "idx_claims_approved_by" ON "public"."claims" USING "btree" ("approved_by");



CREATE INDEX "idx_claims_claimant_id" ON "public"."claims" USING "btree" ("claimant_id");



CREATE INDEX "idx_claims_priority" ON "public"."claims" USING "btree" ("priority");



CREATE INDEX "idx_claims_reviewed_by" ON "public"."claims" USING "btree" ("reviewed_by");



CREATE INDEX "idx_claims_status" ON "public"."claims" USING "btree" ("status");



CREATE INDEX "idx_claims_submitted_at" ON "public"."claims" USING "btree" ("submitted_at");



CREATE INDEX "idx_claims_team_id" ON "public"."claims" USING "btree" ("team_id");



CREATE INDEX "idx_conversation_analytics_conversation_id" ON "public"."conversation_analytics" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_analytics_user_id" ON "public"."conversation_analytics" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_context_conversation_id" ON "public"."conversation_context" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_context_expires" ON "public"."conversation_context" USING "btree" ("expires_at");



CREATE INDEX "idx_conversation_context_relevance" ON "public"."conversation_context" USING "btree" ("relevance_score");



CREATE INDEX "idx_conversation_context_type" ON "public"."conversation_context" USING "btree" ("context_type");



CREATE INDEX "idx_conversation_context_user_id" ON "public"."conversation_context" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_contexts_conversation" ON "public"."conversation_contexts" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_contexts_relevance" ON "public"."conversation_contexts" USING "btree" ("relevance_score");



CREATE INDEX "idx_conversation_contexts_type" ON "public"."conversation_contexts" USING "btree" ("context_type");



CREATE INDEX "idx_conversation_contexts_user_id" ON "public"."conversation_contexts" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_memory_accessed" ON "public"."conversation_memory" USING "btree" ("last_accessed");



CREATE INDEX "idx_conversation_memory_confidence" ON "public"."conversation_memory" USING "btree" ("confidence_score");



CREATE INDEX "idx_conversation_memory_type" ON "public"."conversation_memory" USING "btree" ("memory_type");



CREATE INDEX "idx_conversation_memory_user_id" ON "public"."conversation_memory" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_messages_conversation" ON "public"."conversation_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_messages_created" ON "public"."conversation_messages" USING "btree" ("created_at");



CREATE INDEX "idx_conversation_messages_type" ON "public"."conversation_messages" USING "btree" ("message_type");



CREATE INDEX "idx_conversation_messages_user_id" ON "public"."conversation_messages" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_sessions_last_activity" ON "public"."conversation_sessions" USING "btree" ("last_activity_at" DESC);



CREATE INDEX "idx_conversation_sessions_status" ON "public"."conversation_sessions" USING "btree" ("status");



CREATE INDEX "idx_conversation_sessions_team_id" ON "public"."conversation_sessions" USING "btree" ("team_id");



CREATE INDEX "idx_conversation_sessions_user_id" ON "public"."conversation_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_is_archived" ON "public"."conversations" USING "btree" ("is_archived");



CREATE INDEX "idx_conversations_is_favorite" ON "public"."conversations" USING "btree" ("is_favorite");



CREATE INDEX "idx_conversations_last_message_at" ON "public"."conversations" USING "btree" ("last_message_at");



CREATE INDEX "idx_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_corrections_receipt_id" ON "public"."corrections" USING "btree" ("receipt_id");



CREATE INDEX "idx_custom_categories_user_id" ON "public"."custom_categories" USING "btree" ("user_id");



CREATE INDEX "idx_email_deliveries_created_at" ON "public"."email_deliveries" USING "btree" ("created_at");



CREATE INDEX "idx_email_deliveries_next_retry_at" ON "public"."email_deliveries" USING "btree" ("next_retry_at");



CREATE INDEX "idx_email_deliveries_recipient_email" ON "public"."email_deliveries" USING "btree" ("recipient_email");



CREATE INDEX "idx_email_deliveries_related_entity" ON "public"."email_deliveries" USING "btree" ("related_entity_type", "related_entity_id");



CREATE INDEX "idx_email_deliveries_status" ON "public"."email_deliveries" USING "btree" ("status");



CREATE INDEX "idx_email_deliveries_team_id" ON "public"."email_deliveries" USING "btree" ("team_id");



CREATE INDEX "idx_malaysian_address_formats_state" ON "public"."malaysian_address_formats" USING "btree" ("state_name");



CREATE INDEX "idx_malaysian_business_categories_type" ON "public"."malaysian_business_categories" USING "btree" ("business_type");



CREATE INDEX "idx_malaysian_business_directory_keywords" ON "public"."malaysian_business_directory" USING "gin" ("keywords");



CREATE INDEX "idx_malaysian_business_directory_name" ON "public"."malaysian_business_directory" USING "btree" ("business_name");



CREATE INDEX "idx_malaysian_business_directory_registration" ON "public"."malaysian_business_directory" USING "btree" ("registration_number");



CREATE INDEX "idx_malaysian_business_directory_search_performance" ON "public"."malaysian_business_directory" USING "gin" ("keywords") WHERE ("is_active" = true);



CREATE INDEX "idx_malaysian_business_directory_type" ON "public"."malaysian_business_directory" USING "btree" ("business_type");



CREATE INDEX "idx_malaysian_business_hours_type_day" ON "public"."malaysian_business_hours" USING "btree" ("business_type", "day_of_week");



CREATE INDEX "idx_malaysian_cultural_preferences_category" ON "public"."malaysian_cultural_preferences" USING "btree" ("preference_category");



CREATE INDEX "idx_malaysian_currency_rates_currencies" ON "public"."malaysian_currency_rates" USING "btree" ("from_currency", "to_currency");



CREATE INDEX "idx_malaysian_currency_rates_date" ON "public"."malaysian_currency_rates" USING "btree" ("rate_date" DESC);



CREATE INDEX "idx_malaysian_holidays_date_state_performance" ON "public"."malaysian_public_holidays" USING "btree" ("holiday_date", "applicable_states") WHERE ("is_active" = true);



CREATE INDEX "idx_malaysian_payment_methods_keywords" ON "public"."malaysian_payment_methods" USING "gin" ("keywords");



CREATE INDEX "idx_malaysian_payment_methods_search_performance" ON "public"."malaysian_payment_methods" USING "gin" ("keywords") WHERE ("is_active" = true);



CREATE INDEX "idx_malaysian_payment_methods_type" ON "public"."malaysian_payment_methods" USING "btree" ("method_type");



CREATE INDEX "idx_malaysian_public_holidays_date" ON "public"."malaysian_public_holidays" USING "btree" ("holiday_date");



CREATE INDEX "idx_malaysian_public_holidays_states" ON "public"."malaysian_public_holidays" USING "gin" ("applicable_states");



CREATE INDEX "idx_malaysian_public_holidays_type" ON "public"."malaysian_public_holidays" USING "btree" ("holiday_type");



CREATE INDEX "idx_malaysian_receipt_formats_business_type" ON "public"."malaysian_receipt_formats" USING "btree" ("business_type");



CREATE INDEX "idx_malaysian_tax_categories_effective_dates" ON "public"."malaysian_tax_categories" USING "btree" ("effective_from", "effective_to");



CREATE INDEX "idx_malaysian_tax_categories_lookup_performance" ON "public"."malaysian_tax_categories" USING "btree" ("tax_type", "is_active", "effective_from", "effective_to") WHERE ("is_active" = true);



CREATE INDEX "idx_malaysian_tax_categories_type_active" ON "public"."malaysian_tax_categories" USING "btree" ("tax_type", "is_active");



CREATE INDEX "idx_message_feedback_conversation_id" ON "public"."message_feedback" USING "btree" ("conversation_id");



CREATE INDEX "idx_message_feedback_created_at" ON "public"."message_feedback" USING "btree" ("created_at");



CREATE INDEX "idx_message_feedback_message_id" ON "public"."message_feedback" USING "btree" ("message_id");



CREATE INDEX "idx_message_feedback_user_id" ON "public"."message_feedback" USING "btree" ("user_id");



CREATE INDEX "idx_mv_malaysian_reference_data_keywords" ON "public"."mv_malaysian_reference_data" USING "gin" ("keywords") WHERE ("keywords" IS NOT NULL);



CREATE INDEX "idx_mv_malaysian_reference_data_type_category" ON "public"."mv_malaysian_reference_data" USING "btree" ("data_type", "category");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "idx_notifications_expires_at" ON "public"."notifications" USING "btree" ("expires_at");



CREATE INDEX "idx_notifications_read_at" ON "public"."notifications" USING "btree" ("read_at");



CREATE INDEX "idx_notifications_recipient_id" ON "public"."notifications" USING "btree" ("recipient_id");



CREATE INDEX "idx_notifications_related_entity" ON "public"."notifications" USING "btree" ("related_entity_type", "related_entity_id");



CREATE INDEX "idx_notifications_team_id" ON "public"."notifications" USING "btree" ("team_id");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_payment_history_stripe_subscription_id" ON "public"."payment_history" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_payment_history_user_id" ON "public"."payment_history" USING "btree" ("user_id");



CREATE INDEX "idx_performance_cache_expires_at" ON "public"."performance_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_performance_cache_key" ON "public"."performance_cache" USING "btree" ("cache_key");



CREATE INDEX "idx_performance_metrics_context_gin" ON "public"."performance_metrics" USING "gin" ("context");



CREATE INDEX "idx_performance_metrics_created_at" ON "public"."performance_metrics" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_performance_metrics_name_type" ON "public"."performance_metrics" USING "btree" ("metric_name", "metric_type");



CREATE INDEX "idx_performance_metrics_name_type_date" ON "public"."performance_metrics" USING "btree" ("metric_name", "metric_type", "created_at" DESC);



CREATE INDEX "idx_performance_metrics_user_date" ON "public"."performance_metrics" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_performance_metrics_user_id" ON "public"."performance_metrics" USING "btree" ("user_id");



CREATE INDEX "idx_personalization_profiles_completeness" ON "public"."user_personalization_profiles" USING "btree" ("profile_completeness");



CREATE INDEX "idx_personalization_profiles_updated" ON "public"."user_personalization_profiles" USING "btree" ("last_updated");



CREATE INDEX "idx_personalization_profiles_user_id" ON "public"."user_personalization_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_posts_author_id" ON "public"."posts" USING "btree" ("author_id");



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at");



CREATE INDEX "idx_posts_published_at" ON "public"."posts" USING "btree" ("published_at");



CREATE INDEX "idx_posts_slug" ON "public"."posts" USING "btree" ("slug");



CREATE INDEX "idx_posts_status" ON "public"."posts" USING "btree" ("status");



CREATE INDEX "idx_posts_tags" ON "public"."posts" USING "gin" ("tags");



CREATE INDEX "idx_processing_logs_batch_item_id" ON "public"."processing_logs" USING "btree" ("batch_item_id");



CREATE INDEX "idx_profiles_avatar_updated_at" ON "public"."profiles" USING "btree" ("avatar_updated_at");



CREATE INDEX "idx_profiles_cultural_context" ON "public"."profiles" USING "btree" ("cultural_context");



CREATE INDEX "idx_profiles_preferred_language" ON "public"."profiles" USING "btree" ("preferred_language");



CREATE INDEX "idx_profiles_stripe_customer_id" ON "public"."profiles" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_profiles_subscription_tier" ON "public"."profiles" USING "btree" ("subscription_tier");



CREATE INDEX "idx_rate_limits_user_key" ON "public"."api_rate_limits" USING "btree" ("user_id", "api_key_id");



CREATE INDEX "idx_rate_limits_window" ON "public"."api_rate_limits" USING "btree" ("window_start", "window_end");



CREATE INDEX "idx_receipts_amount_range" ON "public"."receipts" USING "btree" ("total", "date");



CREATE INDEX "idx_receipts_anomaly_flags_gin" ON "public"."receipts" USING "gin" ("anomaly_flags");



CREATE INDEX "idx_receipts_batch_id" ON "public"."receipts" USING "btree" ("batch_id");



CREATE INDEX "idx_receipts_business_expense_date" ON "public"."receipts" USING "btree" ("is_business_expense", "date") WHERE ("is_business_expense" = true);



CREATE INDEX "idx_receipts_business_type" ON "public"."receipts" USING "btree" ("business_type");



CREATE INDEX "idx_receipts_custom_category_id" ON "public"."receipts" USING "btree" ("custom_category_id");



CREATE INDEX "idx_receipts_date" ON "public"."receipts" USING "btree" ("date");



CREATE INDEX "idx_receipts_date_merchant_category" ON "public"."receipts" USING "btree" ("date", "merchant_category");



CREATE INDEX "idx_receipts_date_total_performance" ON "public"."receipts" USING "btree" ("date", "total", "id");



CREATE INDEX "idx_receipts_detected_tax_type" ON "public"."receipts" USING "btree" ("detected_tax_type");



CREATE INDEX "idx_receipts_discount_amount" ON "public"."receipts" USING "btree" ("discount_amount");



CREATE INDEX "idx_receipts_embedding_status" ON "public"."receipts" USING "btree" ("processing_status", "has_embeddings", "embedding_status");



CREATE INDEX "idx_receipts_expense_type" ON "public"."receipts" USING "btree" ("expense_type");



CREATE INDEX "idx_receipts_extraction_metadata_gin" ON "public"."receipts" USING "gin" ("extraction_metadata");



CREATE INDEX "idx_receipts_is_business_expense" ON "public"."receipts" USING "btree" ("is_business_expense");



CREATE INDEX "idx_receipts_item_count" ON "public"."receipts" USING "btree" ("item_count");



CREATE INDEX "idx_receipts_line_items_analysis_gin" ON "public"."receipts" USING "gin" ("line_items_analysis");



CREATE INDEX "idx_receipts_location_city" ON "public"."receipts" USING "btree" ("location_city");



CREATE INDEX "idx_receipts_location_date" ON "public"."receipts" USING "btree" ("location_city", "location_state", "date");



CREATE INDEX "idx_receipts_location_state" ON "public"."receipts" USING "btree" ("location_state");



CREATE INDEX "idx_receipts_malaysian_business_category" ON "public"."receipts" USING "btree" ("malaysian_business_category");



CREATE INDEX "idx_receipts_malaysian_business_performance" ON "public"."receipts" USING "btree" ("malaysian_business_category", "detected_tax_type", "currency") WHERE ("malaysian_business_category" IS NOT NULL);



CREATE INDEX "idx_receipts_merchant" ON "public"."receipts" USING "btree" ("merchant");



CREATE INDEX "idx_receipts_merchant_category" ON "public"."receipts" USING "btree" ("merchant_category");



CREATE INDEX "idx_receipts_merchant_category_performance" ON "public"."receipts" USING "btree" ("merchant", "predicted_category", "total" DESC);



CREATE INDEX "idx_receipts_merchant_normalized" ON "public"."receipts" USING "btree" ("merchant_normalized");



CREATE INDEX "idx_receipts_predicted_category" ON "public"."receipts" USING "btree" ("predicted_category");



CREATE INDEX "idx_receipts_processing_status" ON "public"."receipts" USING "btree" ("processing_status");



CREATE INDEX "idx_receipts_receipt_type" ON "public"."receipts" USING "btree" ("receipt_type");



CREATE INDEX "idx_receipts_service_charge" ON "public"."receipts" USING "btree" ("service_charge");



CREATE INDEX "idx_receipts_spending_patterns_gin" ON "public"."receipts" USING "gin" ("spending_patterns");



CREATE INDEX "idx_receipts_status" ON "public"."receipts" USING "btree" ("status");



CREATE INDEX "idx_receipts_subtotal" ON "public"."receipts" USING "btree" ("subtotal");



CREATE INDEX "idx_receipts_team_id" ON "public"."receipts" USING "btree" ("team_id");



CREATE INDEX "idx_receipts_total_before_tax" ON "public"."receipts" USING "btree" ("total_before_tax");



CREATE INDEX "idx_receipts_user_date_performance" ON "public"."receipts" USING "btree" ("user_id", "date" DESC, "id");



CREATE INDEX "idx_receipts_user_expense_type" ON "public"."receipts" USING "btree" ("user_id", "expense_type");



CREATE INDEX "idx_receipts_user_id" ON "public"."receipts" USING "btree" ("user_id");



CREATE INDEX "idx_team_invitations_email" ON "public"."team_invitations" USING "btree" ("email");



CREATE INDEX "idx_team_invitations_expires_at" ON "public"."team_invitations" USING "btree" ("expires_at");



CREATE INDEX "idx_team_invitations_status" ON "public"."team_invitations" USING "btree" ("status");



CREATE INDEX "idx_team_invitations_team_id" ON "public"."team_invitations" USING "btree" ("team_id");



CREATE INDEX "idx_team_invitations_token" ON "public"."team_invitations" USING "btree" ("token");



CREATE INDEX "idx_team_members_role" ON "public"."team_members" USING "btree" ("role");



CREATE INDEX "idx_team_members_team_id" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_team_members_user_id" ON "public"."team_members" USING "btree" ("user_id");



CREATE INDEX "idx_teams_owner_id" ON "public"."teams" USING "btree" ("owner_id");



CREATE INDEX "idx_teams_slug" ON "public"."teams" USING "btree" ("slug");



CREATE INDEX "idx_teams_status" ON "public"."teams" USING "btree" ("status");



CREATE INDEX "idx_translations_language" ON "public"."translations" USING "btree" ("language");



CREATE INDEX "idx_translations_namespace_key" ON "public"."translations" USING "btree" ("namespace", "key");



CREATE INDEX "idx_unified_embeddings_content_type" ON "public"."unified_embeddings" USING "btree" ("source_type", "content_type", "user_id");



CREATE INDEX "idx_unified_embeddings_language" ON "public"."unified_embeddings" USING "btree" ("language", "source_type", "user_id");



CREATE INDEX "idx_unified_embeddings_metadata" ON "public"."unified_embeddings" USING "gin" ("metadata");



CREATE INDEX "idx_unified_embeddings_receipt_source" ON "public"."unified_embeddings" USING "btree" ("source_type", "source_id") WHERE ("source_type" = 'receipt'::"text");



CREATE INDEX "idx_unified_embeddings_source_id_receipt" ON "public"."unified_embeddings" USING "btree" ("source_id") WHERE ("source_type" = 'receipt'::"text");



CREATE INDEX "idx_unified_embeddings_source_type" ON "public"."unified_embeddings" USING "btree" ("source_type", "user_id", "created_at" DESC);



CREATE INDEX "idx_unified_embeddings_team_scope" ON "public"."unified_embeddings" USING "btree" ("team_id", "source_type", "created_at" DESC) WHERE ("team_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_unified_embeddings_unique_content" ON "public"."unified_embeddings" USING "btree" ("source_type", "source_id", "content_type");



CREATE INDEX "idx_unified_embeddings_vector_search" ON "public"."unified_embeddings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_user_chat_preferences_user_id" ON "public"."user_chat_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_interactions_session" ON "public"."user_interactions" USING "btree" ("session_id");



CREATE INDEX "idx_user_interactions_timestamp" ON "public"."user_interactions" USING "btree" ("timestamp");



CREATE INDEX "idx_user_interactions_type" ON "public"."user_interactions" USING "btree" ("interaction_type");



CREATE INDEX "idx_user_interactions_user_id" ON "public"."user_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_user_preferences_category" ON "public"."user_preferences" USING "btree" ("preference_category");



CREATE INDEX "idx_user_preferences_confidence" ON "public"."user_preferences" USING "btree" ("confidence_score");



CREATE INDEX "idx_user_preferences_updated" ON "public"."user_preferences" USING "btree" ("last_updated");



CREATE INDEX "idx_user_preferences_user_id" ON "public"."user_preferences" USING "btree" ("user_id");



CREATE INDEX "line_items_embedding_idx" ON "public"."line_items" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "receipt_embeddings_embedding_idx" ON "public"."receipt_embeddings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "unified_embeddings_content_type_idx" ON "public"."unified_embeddings" USING "btree" ("content_type");



CREATE INDEX "unified_embeddings_source_idx" ON "public"."unified_embeddings" USING "btree" ("source_type", "source_id");



CREATE INDEX "unified_embeddings_team_idx" ON "public"."unified_embeddings" USING "btree" ("team_id");



CREATE INDEX "unified_embeddings_user_idx" ON "public"."unified_embeddings" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "create_user_chat_preferences_on_signup" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_chat_preferences"();



CREATE OR REPLACE TRIGGER "maintain_search_history_size_trigger" BEFORE UPDATE ON "public"."chat_contexts" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_search_history_size"();



CREATE OR REPLACE TRIGGER "posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_posts_updated_at"();



CREATE OR REPLACE TRIGGER "team_invitation_email_trigger" AFTER INSERT ON "public"."team_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."send_team_invitation_email_trigger"();



CREATE OR REPLACE TRIGGER "trigger_business_directory_embedding" AFTER INSERT OR DELETE OR UPDATE ON "public"."malaysian_business_directory" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_embedding_generation"();



CREATE OR REPLACE TRIGGER "trigger_claims_embedding" AFTER INSERT OR DELETE OR UPDATE ON "public"."claims" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_embedding_generation"();



CREATE OR REPLACE TRIGGER "trigger_custom_categories_embedding" AFTER INSERT OR DELETE OR UPDATE ON "public"."custom_categories" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_embedding_generation"();



CREATE OR REPLACE TRIGGER "trigger_receipts_embedding" AFTER INSERT OR DELETE OR UPDATE ON "public"."receipts" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_embedding_generation"();



CREATE OR REPLACE TRIGGER "trigger_team_members_embedding" AFTER INSERT OR DELETE OR UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_embedding_generation"();



CREATE OR REPLACE TRIGGER "trigger_temporal_metadata_update" BEFORE UPDATE ON "public"."unified_embeddings" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_temporal_metadata"();



COMMENT ON TRIGGER "trigger_temporal_metadata_update" ON "public"."unified_embeddings" IS 'Keeps temporal context current when embeddings are updated';



CREATE OR REPLACE TRIGGER "trigger_update_unified_embeddings_updated_at" BEFORE UPDATE ON "public"."unified_embeddings" FOR EACH ROW EXECUTE FUNCTION "public"."update_unified_embeddings_updated_at"();



CREATE OR REPLACE TRIGGER "update_analytics_on_message_insert" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_analytics_on_message"();



CREATE OR REPLACE TRIGGER "update_chat_contexts_updated_at" BEFORE UPDATE ON "public"."chat_contexts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_messages_updated_at" BEFORE UPDATE ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_conversation_analytics_updated_at" BEFORE UPDATE ON "public"."conversation_analytics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_conversation_sessions_updated_at" BEFORE UPDATE ON "public"."conversation_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_custom_categories_updated_at" BEFORE UPDATE ON "public"."custom_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_custom_categories_updated_at"();



CREATE OR REPLACE TRIGGER "update_team_invitations_updated_at" BEFORE UPDATE ON "public"."team_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_team_members_updated_at" BEFORE UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_chat_preferences_updated_at" BEFORE UPDATE ON "public"."user_chat_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agent_performance_history"
    ADD CONSTRAINT "agent_performance_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_access_logs"
    ADD CONSTRAINT "api_access_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_access_logs"
    ADD CONSTRAINT "api_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_contexts"
    ADD CONSTRAINT "chat_contexts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_contexts"
    ADD CONSTRAINT "chat_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claim_audit_trail"
    ADD CONSTRAINT "claim_audit_trail_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claim_audit_trail"
    ADD CONSTRAINT "claim_audit_trail_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_analytics"
    ADD CONSTRAINT "conversation_analytics_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_analytics"
    ADD CONSTRAINT "conversation_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_context"
    ADD CONSTRAINT "conversation_context_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_contexts"
    ADD CONSTRAINT "conversation_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_memory"
    ADD CONSTRAINT "conversation_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "conversation_sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "conversation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."corrections"
    ADD CONSTRAINT "corrections_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_deliveries"
    ADD CONSTRAINT "email_deliveries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eta_calculations"
    ADD CONSTRAINT "eta_calculations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."line_items"
    ADD CONSTRAINT "fk_receipt" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id");



ALTER TABLE ONLY "public"."receipt_embeddings"
    ADD CONSTRAINT "fk_receipt" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."line_items"
    ADD CONSTRAINT "line_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."load_balancing_insights"
    ADD CONSTRAINT "load_balancing_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."malaysian_business_categories"
    ADD CONSTRAINT "malaysian_business_categories_tax_category_id_fkey" FOREIGN KEY ("tax_category_id") REFERENCES "public"."malaysian_tax_categories"("id");



ALTER TABLE ONLY "public"."message_feedback"
    ADD CONSTRAINT "message_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_alerts"
    ADD CONSTRAINT "performance_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."processing_logs"
    ADD CONSTRAINT "processing_logs_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receipt_embeddings"
    ADD CONSTRAINT "receipt_embeddings_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_custom_category_id_fkey" FOREIGN KEY ("custom_category_id") REFERENCES "public"."custom_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_behavioral_patterns"
    ADD CONSTRAINT "user_behavioral_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_chat_preferences"
    ADD CONSTRAINT "user_chat_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_personalization_profiles"
    ADD CONSTRAINT "user_personalization_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workflow_progress"
    ADD CONSTRAINT "workflow_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Address formats are viewable by everyone" ON "public"."malaysian_address_formats" FOR SELECT USING (true);



CREATE POLICY "Admins can assign roles" ON "public"."user_roles" FOR INSERT WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can delete roles" ON "public"."user_roles" FOR DELETE USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can read all roles" ON "public"."user_roles" FOR SELECT USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can update roles" ON "public"."user_roles" FOR UPDATE USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can view all chat contexts" ON "public"."chat_contexts" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Admins can view all chat messages" ON "public"."chat_messages" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Admins can view all conversation analytics" ON "public"."conversation_analytics" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Admins can view all conversations" ON "public"."conversation_sessions" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Admins can view all conversations" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Admins can view all feedback" ON "public"."message_feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Admins can view all performance metrics" ON "public"."performance_metrics" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Admins can view all user chat preferences" ON "public"."user_chat_preferences" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Anyone can read published posts" ON "public"."posts" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Anyone can read subscription limits" ON "public"."subscription_limits" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can manage cache" ON "public"."performance_cache" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can read published posts" ON "public"."posts" FOR SELECT TO "authenticated" USING (("status" = 'published'::"text"));



CREATE POLICY "Authors can delete their own posts" ON "public"."posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Authors can insert their own posts" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Authors can read their own posts" ON "public"."posts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Authors can update their own posts" ON "public"."posts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Business categories are viewable by everyone" ON "public"."malaysian_business_categories" FOR SELECT USING (true);



CREATE POLICY "Business directory is viewable by everyone" ON "public"."malaysian_business_directory" FOR SELECT USING (true);



CREATE POLICY "Business hours are viewable by everyone" ON "public"."malaysian_business_hours" FOR SELECT USING (true);



CREATE POLICY "Claimants can update own draft claims" ON "public"."claims" FOR UPDATE USING ((("claimant_id" = "auth"."uid"()) AND ("status" = 'draft'::"public"."claim_status")));



CREATE POLICY "Cultural preferences are viewable by everyone" ON "public"."malaysian_cultural_preferences" FOR SELECT USING (true);



CREATE POLICY "Currency rates are viewable by everyone" ON "public"."malaysian_currency_rates" FOR SELECT USING (true);



CREATE POLICY "Only admins can manage address formats" ON "public"."malaysian_address_formats" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage business categories" ON "public"."malaysian_business_categories" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage business directory" ON "public"."malaysian_business_directory" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage business hours" ON "public"."malaysian_business_hours" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage cultural preferences" ON "public"."malaysian_cultural_preferences" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage currency rates" ON "public"."malaysian_currency_rates" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage payment methods" ON "public"."malaysian_payment_methods" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage public holidays" ON "public"."malaysian_public_holidays" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage receipt formats" ON "public"."malaysian_receipt_formats" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage tax categories" ON "public"."malaysian_tax_categories" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Only admins can manage translations" ON "public"."translations" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."raw_user_meta_data" ->> 'role'::"text") = 'admin'::"text")))));



CREATE POLICY "Payment methods are viewable by everyone" ON "public"."malaysian_payment_methods" FOR SELECT USING (true);



CREATE POLICY "Public holidays are viewable by everyone" ON "public"."malaysian_public_holidays" FOR SELECT USING (true);



CREATE POLICY "Receipt formats are viewable by everyone" ON "public"."malaysian_receipt_formats" FOR SELECT USING (true);



CREATE POLICY "Service role can insert API logs" ON "public"."api_access_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert logs" ON "public"."processing_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert payment history" ON "public"."payment_history" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage embedding queue" ON "public"."embedding_queue" USING (true);



CREATE POLICY "Service role can manage rate limits" ON "public"."api_rate_limits" TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can update payment history" ON "public"."payment_history" FOR UPDATE TO "service_role" USING (true);



CREATE POLICY "System can create notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert audit trail records" ON "public"."claim_audit_trail" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert performance metrics" ON "public"."performance_metrics" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can manage email deliveries" ON "public"."email_deliveries" USING (true);



CREATE POLICY "Tax categories are viewable by everyone" ON "public"."malaysian_tax_categories" FOR SELECT USING (true);



CREATE POLICY "Team admins can add members" ON "public"."team_members" FOR INSERT WITH CHECK ("public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role"));



CREATE POLICY "Team admins can create invitations" ON "public"."team_invitations" FOR INSERT WITH CHECK (("public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role") AND ("invited_by" = "auth"."uid"())));



CREATE POLICY "Team admins can delete invitations" ON "public"."team_invitations" FOR DELETE USING ("public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role"));



CREATE POLICY "Team admins can remove members or users can remove themselves" ON "public"."team_members" FOR DELETE USING (("public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Team admins can review claims" ON "public"."claims" FOR UPDATE USING ("public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role"));



CREATE POLICY "Team admins can update invitations" ON "public"."team_invitations" FOR UPDATE USING ("public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role"));



CREATE POLICY "Team admins can update member roles" ON "public"."team_members" FOR UPDATE USING (("public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role") AND ("role" <> 'owner'::"public"."team_member_role")));



CREATE POLICY "Team admins can view team email deliveries" ON "public"."email_deliveries" FOR SELECT USING ((("team_id" IS NULL) OR "public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role")));



CREATE POLICY "Team admins can view team invitations" ON "public"."team_invitations" FOR SELECT USING ("public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role"));



CREATE POLICY "Team members can create claims" ON "public"."claims" FOR INSERT WITH CHECK (("public"."is_team_member"("team_id", "auth"."uid"(), 'member'::"public"."team_member_role") AND ("claimant_id" = "auth"."uid"())));



CREATE POLICY "Team members can view claim audit trail" ON "public"."claim_audit_trail" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."claims" "c"
  WHERE (("c"."id" = "claim_audit_trail"."claim_id") AND "public"."is_team_member"("c"."team_id", "auth"."uid"(), 'viewer'::"public"."team_member_role")))));



CREATE POLICY "Team members can view team API keys" ON "public"."api_keys" FOR SELECT TO "authenticated" USING ((("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "api_keys"."team_id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = ANY (ARRAY['admin'::"public"."team_member_role", 'member'::"public"."team_member_role"])))))));



CREATE POLICY "Team members can view team claims" ON "public"."claims" FOR SELECT USING ("public"."is_team_member"("team_id", "auth"."uid"(), 'viewer'::"public"."team_member_role"));



CREATE POLICY "Team members can view team conversations" ON "public"."conversation_sessions" FOR SELECT USING ((("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "conversation_sessions"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Team owners can delete claims" ON "public"."claims" FOR DELETE USING ("public"."is_team_owner"("team_id", "auth"."uid"()));



CREATE POLICY "Team owners can delete teams" ON "public"."teams" FOR DELETE USING ("public"."is_team_owner"("id", "auth"."uid"()));



CREATE POLICY "Team owners can update teams" ON "public"."teams" FOR UPDATE USING ("public"."is_team_owner"("id", "auth"."uid"()));



CREATE POLICY "Translations are viewable by everyone" ON "public"."translations" FOR SELECT USING (true);



CREATE POLICY "Users can create messages in their conversations" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversation_sessions" "cs"
  WHERE (("cs"."id" = "chat_messages"."conversation_id") AND (("cs"."user_id" = "auth"."uid"()) OR (("cs"."team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."team_members" "tm"
          WHERE (("tm"."team_id" = "cs"."team_id") AND ("tm"."user_id" = "auth"."uid"())))))))))));



CREATE POLICY "Users can create teams" ON "public"."teams" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can create their own API keys" ON "public"."api_keys" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("auth"."uid"() = "created_by")));



CREATE POLICY "Users can create their own chat contexts" ON "public"."chat_contexts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own chat preferences" ON "public"."user_chat_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own conversation analytics" ON "public"."conversation_analytics" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own conversations" ON "public"."conversation_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own notifications" ON "public"."notifications" FOR DELETE USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own preferences" ON "public"."user_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own API keys" ON "public"."api_keys" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own categories" ON "public"."custom_categories" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own chat contexts" ON "public"."chat_contexts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own chat preferences" ON "public"."user_chat_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own conversations" ON "public"."conversation_sessions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own corrections" ON "public"."corrections" FOR DELETE TO "authenticated" USING (("receipt_id" IN ( SELECT "receipts"."id"
   FROM "public"."receipts"
  WHERE ("receipts"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own feedback" ON "public"."message_feedback" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own line items" ON "public"."line_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."receipts"
  WHERE (("receipts"."id" = "line_items"."receipt_id") AND ("receipts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own receipts or team receipts" ON "public"."receipts" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (("team_id" IS NOT NULL) AND "public"."is_team_member"("team_id", "auth"."uid"(), 'admin'::"public"."team_member_role"))));



CREATE POLICY "Users can insert logs for their own receipts" ON "public"."processing_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IN ( SELECT "receipts"."user_id"
   FROM "public"."receipts"
  WHERE ("receipts"."id" = "processing_logs"."receipt_id"))));



CREATE POLICY "Users can insert own contexts" ON "public"."conversation_contexts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own interactions" ON "public"."user_interactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own memory" ON "public"."conversation_memory" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own messages" ON "public"."conversation_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own patterns" ON "public"."user_behavioral_patterns" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."user_personalization_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own categories" ON "public"."custom_categories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own corrections" ON "public"."corrections" FOR INSERT TO "authenticated" WITH CHECK (("receipt_id" IN ( SELECT "receipts"."id"
   FROM "public"."receipts"
  WHERE ("receipts"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own embeddings" ON "public"."unified_embeddings" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR ("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own feedback" ON "public"."message_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own line items" ON "public"."line_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receipts"
  WHERE (("receipts"."id" = "line_items"."receipt_id") AND ("receipts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own performance metrics" ON "public"."performance_metrics" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own receipts or team receipts" ON "public"."receipts" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (("team_id" IS NULL) OR "public"."is_team_member"("team_id", "auth"."uid"(), 'member'::"public"."team_member_role"))));



CREATE POLICY "Users can manage their own conversation context" ON "public"."conversation_context" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own conversations" ON "public"."conversations" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can soft delete their own messages" ON "public"."chat_messages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own memory" ON "public"."conversation_memory" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "Users can update own patterns" ON "public"."user_behavioral_patterns" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_personalization_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own API keys" ON "public"."api_keys" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own categories" ON "public"."custom_categories" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own chat contexts" ON "public"."chat_contexts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own chat preferences" ON "public"."user_chat_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own conversation analytics" ON "public"."conversation_analytics" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own conversations" ON "public"."conversation_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own corrections" ON "public"."corrections" FOR UPDATE TO "authenticated" USING (("receipt_id" IN ( SELECT "receipts"."id"
   FROM "public"."receipts"
  WHERE ("receipts"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own embeddings" ON "public"."unified_embeddings" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR ("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own feedback" ON "public"."message_feedback" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own line items" ON "public"."line_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."receipts"
  WHERE (("receipts"."id" = "line_items"."receipt_id") AND ("receipts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own messages" ON "public"."chat_messages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own performance metrics" ON "public"."performance_metrics" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL))) WITH CHECK ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own receipts or team receipts" ON "public"."receipts" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (("team_id" IS NOT NULL) AND "public"."is_team_member"("team_id", "auth"."uid"(), 'member'::"public"."team_member_role"))));



CREATE POLICY "Users can view messages in their conversations" ON "public"."chat_messages" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."conversation_sessions" "cs"
  WHERE (("cs"."id" = "chat_messages"."conversation_id") AND (("cs"."user_id" = "auth"."uid"()) OR (("cs"."team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."team_members" "tm"
          WHERE (("tm"."team_id" = "cs"."team_id") AND ("tm"."user_id" = "auth"."uid"())))))))))));



CREATE POLICY "Users can view own contexts" ON "public"."conversation_contexts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own interactions" ON "public"."user_interactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own memory" ON "public"."conversation_memory" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own messages" ON "public"."conversation_messages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "Users can view own patterns" ON "public"."user_behavioral_patterns" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."user_personalization_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view team members of their teams" ON "public"."team_members" FOR SELECT USING ("public"."is_team_member"("team_id", "auth"."uid"(), 'viewer'::"public"."team_member_role"));



CREATE POLICY "Users can view teams they belong to" ON "public"."teams" FOR SELECT USING ((("auth"."uid"() = "owner_id") OR "public"."is_team_member"("id", "auth"."uid"(), 'viewer'::"public"."team_member_role")));



CREATE POLICY "Users can view their own API keys" ON "public"."api_keys" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own API logs" ON "public"."api_access_logs" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own categories" ON "public"."custom_categories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own chat contexts" ON "public"."chat_contexts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own chat preferences" ON "public"."user_chat_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own conversation analytics" ON "public"."conversation_analytics" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own conversations" ON "public"."conversation_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own corrections" ON "public"."corrections" FOR SELECT TO "authenticated" USING (("receipt_id" IN ( SELECT "receipts"."id"
   FROM "public"."receipts"
  WHERE ("receipts"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own embeddings" ON "public"."unified_embeddings" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own feedback" ON "public"."message_feedback" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own line items" ON "public"."line_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."receipts"
  WHERE (("receipts"."id" = "line_items"."receipt_id") AND ("receipts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own payment history" ON "public"."payment_history" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own performance metrics" ON "public"."performance_metrics" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own rate limits" ON "public"."api_rate_limits" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own receipt logs" ON "public"."processing_logs" FOR SELECT USING (("auth"."uid"() IN ( SELECT "receipts"."user_id"
   FROM "public"."receipts"
  WHERE ("receipts"."id" = "processing_logs"."receipt_id"))));



CREATE POLICY "Users can view their own receipts or team receipts" ON "public"."receipts" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (("team_id" IS NOT NULL) AND "public"."is_team_member"("team_id", "auth"."uid"(), 'viewer'::"public"."team_member_role"))));



ALTER TABLE "public"."agent_performance_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_contexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claim_audit_trail" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_context" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_contexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."corrections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."embedding_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eta_calculations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."load_balancing_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_address_formats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_business_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_business_directory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_business_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_cultural_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_currency_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_public_holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_receipt_formats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."malaysian_tax_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processing_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."translations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unified_embeddings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unified_embeddings_team_access" ON "public"."unified_embeddings" USING ((("user_id" = "auth"."uid"()) OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "unified_embeddings"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))) OR ("source_type" = 'business_directory'::"text")));



CREATE POLICY "unified_embeddings_user_access" ON "public"."unified_embeddings" USING ((("user_id" = "auth"."uid"()) OR ("source_type" = 'business_directory'::"text")));



ALTER TABLE "public"."user_behavioral_patterns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_chat_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_personalization_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_progress" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."accept_team_invitation"("_token" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."accept_team_invitation"("_token" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_team_invitation"("_token" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "text", "p_message_type" "text", "p_search_results" "jsonb", "p_intent_data" "jsonb", "p_keywords_data" "jsonb", "p_enhancement_data" "jsonb", "p_validation_data" "jsonb", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "text", "p_message_type" "text", "p_search_results" "jsonb", "p_intent_data" "jsonb", "p_keywords_data" "jsonb", "p_enhancement_data" "jsonb", "p_validation_data" "jsonb", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" "text", "p_content" "text", "p_message_type" "text", "p_search_results" "jsonb", "p_intent_data" "jsonb", "p_keywords_data" "jsonb", "p_enhancement_data" "jsonb", "p_validation_data" "jsonb", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" character varying, "p_content" "text", "p_message_type" character varying, "p_search_results" "jsonb", "p_intent_data" "jsonb", "p_keywords_data" "jsonb", "p_enhancement_data" "jsonb", "p_validation_data" "jsonb", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" character varying, "p_content" "text", "p_message_type" character varying, "p_search_results" "jsonb", "p_intent_data" "jsonb", "p_keywords_data" "jsonb", "p_enhancement_data" "jsonb", "p_validation_data" "jsonb", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_chat_message"("p_conversation_id" "uuid", "p_role" character varying, "p_content" "text", "p_message_type" character varying, "p_search_results" "jsonb", "p_intent_data" "jsonb", "p_keywords_data" "jsonb", "p_enhancement_data" "jsonb", "p_validation_data" "jsonb", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text", "p_content_text" "text", "p_embedding" "public"."vector", "p_metadata" "jsonb", "p_user_id" "uuid", "p_team_id" "uuid", "p_language" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text", "p_content_text" "text", "p_embedding" "public"."vector", "p_metadata" "jsonb", "p_user_id" "uuid", "p_team_id" "uuid", "p_language" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text", "p_content_text" "text", "p_embedding" "public"."vector", "p_metadata" "jsonb", "p_user_id" "uuid", "p_team_id" "uuid", "p_language" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_claim"("_claim_id" "uuid", "_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_claim"("_claim_id" "uuid", "_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_claim"("_claim_id" "uuid", "_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_notification"("_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_notification"("_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_notification"("_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."basic_search_receipts"("p_query" "text", "p_limit" integer, "p_offset" integer, "p_start_date" "date", "p_end_date" "date", "p_min_amount" numeric, "p_max_amount" numeric, "p_merchants" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."basic_search_receipts"("p_query" "text", "p_limit" integer, "p_offset" integer, "p_start_date" "date", "p_end_date" "date", "p_min_amount" numeric, "p_max_amount" numeric, "p_merchants" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."basic_search_receipts"("p_query" "text", "p_limit" integer, "p_offset" integer, "p_start_date" "date", "p_end_date" "date", "p_min_amount" numeric, "p_max_amount" numeric, "p_merchants" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_assign_category"("p_receipt_ids" "uuid"[], "p_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_assign_category"("p_receipt_ids" "uuid"[], "p_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_assign_category"("p_receipt_ids" "uuid"[], "p_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_malaysian_tax"("total_amount" numeric, "tax_rate" numeric, "is_inclusive" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_malaysian_tax"("total_amount" numeric, "tax_rate" numeric, "is_inclusive" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_malaysian_tax"("total_amount" numeric, "tax_rate" numeric, "is_inclusive" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_approve_claims"("_team_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_approve_claims"("_team_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_approve_claims"("_team_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_perform_action"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."can_perform_action"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_perform_action"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_perform_unified_search"("p_user_id" "uuid", "p_sources" "text"[], "p_result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."can_perform_unified_search"("p_user_id" "uuid", "p_sources" "text"[], "p_result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_perform_unified_search"("p_user_id" "uuid", "p_sources" "text"[], "p_result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_review_claims"("_team_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_review_claims"("_team_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_review_claims"("_team_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_submit_claims"("_team_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_submit_claims"("_team_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_submit_claims"("_team_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_pgvector_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_pgvector_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_pgvector_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_subscription_limit"("_user_id" "uuid", "_limit_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_subscription_limit"("_user_id" "uuid", "_limit_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_subscription_limit"("_user_id" "uuid", "_limit_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_subscription_limit_enhanced"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."check_subscription_limit_enhanced"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_subscription_limit_enhanced"("_user_id" "uuid", "_action" "text", "_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_conversations"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_conversations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."column_exists"("p_table" "text", "p_column" "text", "p_schema" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."column_exists"("p_table" "text", "p_column" "text", "p_schema" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."column_exists"("p_table" "text", "p_column" "text", "p_schema" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_malaysian_currency"("amount" numeric, "from_currency" character varying, "to_currency" character varying, "conversion_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_malaysian_currency"("amount" numeric, "from_currency" character varying, "to_currency" character varying, "conversion_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_malaysian_currency"("amount" numeric, "from_currency" character varying, "to_currency" character varying, "conversion_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_claim"("_team_id" "uuid", "_title" character varying, "_description" "text", "_amount" numeric, "_currency" character varying, "_category" character varying, "_priority" "public"."claim_priority", "_attachments" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_claim"("_team_id" "uuid", "_title" character varying, "_description" "text", "_amount" numeric, "_currency" character varying, "_category" character varying, "_priority" "public"."claim_priority", "_attachments" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_claim"("_team_id" "uuid", "_title" character varying, "_description" "text", "_amount" numeric, "_currency" character varying, "_category" character varying, "_priority" "public"."claim_priority", "_attachments" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_conversation_session"("p_title" "text", "p_session_type" "text", "p_team_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_conversation_session"("p_title" "text", "p_session_type" "text", "p_team_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_conversation_session"("p_title" "text", "p_session_type" "text", "p_team_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_conversation_session"("p_title" character varying, "p_session_type" character varying, "p_team_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_conversation_session"("p_title" character varying, "p_session_type" character varying, "p_team_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_conversation_session"("p_title" character varying, "p_session_type" character varying, "p_team_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_custom_category"("p_name" "text", "p_color" "text", "p_icon" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_custom_category"("p_name" "text", "p_color" "text", "p_icon" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_custom_category"("p_name" "text", "p_color" "text", "p_icon" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_categories_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_categories_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_categories_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_chat_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_chat_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_chat_preferences"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_email_delivery"("_recipient_email" character varying, "_subject" character varying, "_template_name" character varying, "_related_entity_type" character varying, "_related_entity_id" "uuid", "_team_id" "uuid", "_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_email_delivery"("_recipient_email" character varying, "_subject" character varying, "_template_name" character varying, "_related_entity_type" character varying, "_related_entity_id" "uuid", "_team_id" "uuid", "_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_email_delivery"("_recipient_email" character varying, "_subject" character varying, "_template_name" character varying, "_related_entity_type" character varying, "_related_entity_id" "uuid", "_team_id" "uuid", "_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_expense_from_receipt"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_expense_from_receipt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_expense_from_receipt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_first_admin"("_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_first_admin"("_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_first_admin"("_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_team"("_name" character varying, "_description" "text", "_slug" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."create_team"("_name" character varying, "_description" "text", "_slug" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_team"("_name" character varying, "_description" "text", "_slug" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_conversation"("p_conversation_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_conversation"("p_conversation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_conversation"("p_conversation_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_custom_category"("p_category_id" "uuid", "p_reassign_to_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_custom_category"("p_category_id" "uuid", "p_reassign_to_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_custom_category"("p_category_id" "uuid", "p_reassign_to_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_content_language"("content_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_content_language"("content_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_content_language"("content_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_malaysian_payment_method"("receipt_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_malaysian_payment_method"("receipt_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_malaysian_payment_method"("receipt_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_malaysian_tax_category"("merchant_name" "text", "receipt_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_malaysian_tax_category"("merchant_name" "text", "receipt_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_malaysian_tax_category"("merchant_name" "text", "receipt_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."enhanced_hybrid_search"("query_embedding" "public"."vector", "query_text" "text", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "trigram_threshold" double precision, "semantic_weight" double precision, "keyword_weight" double precision, "trigram_weight" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "amount_min" double precision, "amount_max" double precision, "amount_currency" "text", "receipt_ids_filter" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."enhanced_hybrid_search"("query_embedding" "public"."vector", "query_text" "text", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "trigram_threshold" double precision, "semantic_weight" double precision, "keyword_weight" double precision, "trigram_weight" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "amount_min" double precision, "amount_max" double precision, "amount_currency" "text", "receipt_ids_filter" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enhanced_hybrid_search"("query_embedding" "public"."vector", "query_text" "text", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "trigram_threshold" double precision, "semantic_weight" double precision, "keyword_weight" double precision, "trigram_weight" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "amount_min" double precision, "amount_max" double precision, "amount_currency" "text", "receipt_ids_filter" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_business_directory_content"("p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_business_directory_content"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_business_directory_content"("p_business_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_claim_content"("p_claim_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_claim_content"("p_claim_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_claim_content"("p_claim_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_custom_category_content"("p_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_custom_category_content"("p_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_custom_category_content"("p_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_receipt_content"("p_receipt_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_receipt_content"("p_receipt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_receipt_content"("p_receipt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_team_member_content"("p_team_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_team_member_content"("p_team_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_team_member_content"("p_team_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_missing_embeddings"("source_table" "text", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_missing_embeddings"("source_table" "text", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_missing_embeddings"("source_table" "text", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_receipts_missing_embeddings"("limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_receipts_missing_embeddings"("limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_receipts_missing_embeddings"("limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_receipt_embedding_content"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_receipt_embedding_content"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_receipt_embedding_content"() TO "service_role";



GRANT ALL ON FUNCTION "public"."format_malaysian_currency"("amount" numeric, "currency_code" character varying, "include_symbol" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."format_malaysian_currency"("amount" numeric, "currency_code" character varying, "include_symbol" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_malaysian_currency"("amount" numeric, "currency_code" character varying, "include_symbol" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."format_malaysian_date"("input_date" "date", "format_preference" character varying, "separator_preference" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."format_malaysian_date"("input_date" "date", "format_preference" character varying, "separator_preference" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_malaysian_date"("input_date" "date", "format_preference" character varying, "separator_preference" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."format_malaysian_number"("input_number" numeric, "format_style" character varying, "thousands_sep" character varying, "decimal_sep" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."format_malaysian_number"("input_number" numeric, "format_style" character varying, "thousands_sep" character varying, "decimal_sep" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_malaysian_number"("input_number" numeric, "format_style" character varying, "thousands_sep" character varying, "decimal_sep" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."format_malaysian_time"("input_time" time without time zone, "format_preference" character varying, "separator_preference" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."format_malaysian_time"("input_time" time without time zone, "format_preference" character varying, "separator_preference" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_malaysian_time"("input_time" time without time zone, "format_preference" character varying, "separator_preference" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_line_item_embeddings"("p_line_item_id" "uuid", "p_embedding" "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_line_item_embeddings"("p_line_item_id" "uuid", "p_embedding" "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_line_item_embeddings"("p_line_item_id" "uuid", "p_embedding" "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_receipt_embeddings"("p_receipt_id" "uuid", "p_process_all_fields" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_receipt_embeddings"("p_receipt_id" "uuid", "p_process_all_fields" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_receipt_embeddings"("p_receipt_id" "uuid", "p_process_all_fields" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_statistics"("p_user_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_statistics"("p_user_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_statistics"("p_user_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_min_relevance" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_min_relevance" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_min_relevance" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_context_window"("p_conversation_id" "text", "p_max_tokens" integer, "p_include_memory" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_context_window"("p_conversation_id" "text", "p_max_tokens" integer, "p_include_memory" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_context_window"("p_conversation_id" "text", "p_max_tokens" integer, "p_include_memory" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_min_confidence" numeric, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_min_confidence" numeric, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_min_confidence" numeric, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_messages"("p_conversation_id" "text", "p_limit" integer, "p_offset" integer, "p_include_metadata" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_messages"("p_conversation_id" "text", "p_limit" integer, "p_offset" integer, "p_include_metadata" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_messages"("p_conversation_id" "text", "p_limit" integer, "p_offset" integer, "p_include_metadata" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_with_messages"("p_conversation_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_with_messages"("p_conversation_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_with_messages"("p_conversation_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_embedding_migration_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_embedding_migration_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_embedding_migration_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feedback_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_feedback_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feedback_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("_token" character varying, "_pending_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("_token" character varying, "_pending_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("_token" character varying, "_pending_only" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_malaysian_exchange_rate"("from_currency" character varying, "to_currency" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_malaysian_exchange_rate"("from_currency" character varying, "to_currency" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_malaysian_exchange_rate"("from_currency" character varying, "to_currency" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_line_items_without_embeddings_for_receipt"("p_receipt_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_line_items_without_embeddings_for_receipt"("p_receipt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_line_items_without_embeddings_for_receipt"("p_receipt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_malaysian_business_days"("start_date" "date", "end_date" "date", "state_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_malaysian_business_days"("start_date" "date", "end_date" "date", "state_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_malaysian_business_days"("start_date" "date", "end_date" "date", "state_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_malaysian_business_hours"("business_type_param" character varying, "day_of_week_param" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_malaysian_business_hours"("business_type_param" character varying, "day_of_week_param" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_malaysian_business_hours"("business_type_param" character varying, "day_of_week_param" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_malaysian_tax_info"("merchant_name" "text", "receipt_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_malaysian_tax_info"("merchant_name" "text", "receipt_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_malaysian_tax_info"("merchant_name" "text", "receipt_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_merchant_analysis"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text", "limit_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_merchant_analysis"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text", "limit_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_merchant_analysis"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text", "limit_results" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_message_feedback"("p_message_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_message_feedback"("p_message_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_message_feedback"("p_message_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_spending_trends"("user_filter" "uuid", "months_back" integer, "currency_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_spending_trends"("user_filter" "uuid", "months_back" integer, "currency_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_spending_trends"("user_filter" "uuid", "months_back" integer, "currency_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_optimal_ai_model"("content_text" "text", "processing_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_optimal_ai_model"("content_text" "text", "processing_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_optimal_ai_model"("content_text" "text", "processing_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_performance_alerts"("p_query_time_threshold" numeric, "p_cache_hit_rate_threshold" numeric, "p_time_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_performance_alerts"("p_query_time_threshold" numeric, "p_cache_hit_rate_threshold" numeric, "p_time_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_performance_alerts"("p_query_time_threshold" numeric, "p_cache_hit_rate_threshold" numeric, "p_time_window_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_performance_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_performance_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_performance_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_performance_trends"("p_metric_name" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_performance_trends"("p_metric_name" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_performance_trends"("p_metric_name" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_receipt_count_by_criteria"("search_text" "text", "price_min" numeric, "price_max" numeric, "date_from" "date", "date_to" "date", "merchant_filter" "text", "category_filter" "text", "user_filter" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_receipt_count_by_criteria"("search_text" "text", "price_min" numeric, "price_max" numeric, "date_from" "date", "date_to" "date", "merchant_filter" "text", "category_filter" "text", "user_filter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_receipt_count_by_criteria"("search_text" "text", "price_min" numeric, "price_max" numeric, "date_from" "date", "date_to" "date", "merchant_filter" "text", "category_filter" "text", "user_filter" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_receipt_ids_in_date_range"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text", "amount_min" double precision, "amount_max" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_receipt_ids_in_date_range"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text", "amount_min" double precision, "amount_max" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_receipt_ids_in_date_range"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text", "amount_min" double precision, "amount_max" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_receipts_over_amount"("amount_threshold" numeric, "user_filter" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_receipts_over_amount"("amount_threshold" numeric, "user_filter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_receipts_over_amount"("amount_threshold" numeric, "user_filter" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_receipts_with_missing_line_item_embeddings"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_receipts_with_missing_line_item_embeddings"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_receipts_with_missing_line_item_embeddings"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_search_tier_limits"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_search_tier_limits"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_search_tier_limits"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_spending_anomalies"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_spending_anomalies"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_spending_anomalies"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_spending_by_category"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_spending_by_category"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_spending_by_category"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_stripe_price_id"("_tier" "public"."subscription_tier", "_billing_interval" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_stripe_price_id"("_tier" "public"."subscription_tier", "_billing_interval" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_stripe_price_id"("_tier" "public"."subscription_tier", "_billing_interval" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_claims"("_team_id" "uuid", "_status" "public"."claim_status", "_limit" integer, "_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_claims"("_team_id" "uuid", "_status" "public"."claim_status", "_limit" integer, "_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_claims"("_team_id" "uuid", "_status" "public"."claim_status", "_limit" integer, "_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_members"("_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_members"("_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_members"("_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_temporal_metadata_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_temporal_metadata_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_temporal_metadata_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_temporal_search_stats"("user_filter" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_temporal_search_stats"("user_filter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_temporal_search_stats"("user_filter" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_temporal_statistics"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_temporal_statistics"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_temporal_statistics"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tier_from_price_id"("_price_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tier_from_price_id"("_price_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tier_from_price_id"("_price_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_time_based_patterns"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_time_based_patterns"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_time_based_patterns"("user_filter" "uuid", "start_date" "date", "end_date" "date", "currency_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unified_embedding_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_unified_embedding_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unified_embedding_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unified_search_stats"("user_filter" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unified_search_stats"("user_filter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unified_search_stats"("user_filter" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unique_receipt_count_for_search"("query_embedding" "public"."vector", "similarity_threshold" double precision, "user_filter" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unique_receipt_count_for_search"("query_embedding" "public"."vector", "similarity_threshold" double precision, "user_filter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unique_receipt_count_for_search"("query_embedding" "public"."vector", "similarity_threshold" double precision, "user_filter" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_categories_with_counts"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_categories_with_counts"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_categories_with_counts"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_chat_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_chat_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_chat_preferences"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_conversations"("p_include_archived" boolean, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_conversations"("p_include_archived" boolean, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_conversations"("p_include_archived" boolean, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_conversations"("p_limit" integer, "p_offset" integer, "p_status" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_conversations"("p_limit" integer, "p_offset" integer, "p_status" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_conversations"("p_limit" integer, "p_offset" integer, "p_status" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_cultural_preferences"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_cultural_preferences"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_cultural_preferences"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_notifications"("_limit" integer, "_offset" integer, "_unread_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_notifications"("_limit" integer, "_offset" integer, "_unread_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_notifications"("_limit" integer, "_offset" integer, "_unread_only" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_personalization_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_personalization_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_personalization_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_preferences"("p_category" "text", "p_min_confidence" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_preferences"("p_category" "text", "p_min_confidence" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_preferences"("p_category" "text", "p_min_confidence" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_receipt_usage_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_receipt_usage_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_receipt_usage_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_teams"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_teams"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_teams"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_by_ids"("user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_by_ids"("user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_by_ids"("user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_batch_item"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_batch_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_batch_item"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_posts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision, "similarity_weight" double precision, "text_weight" double precision, "match_count" integer, "min_amount" double precision, "max_amount" double precision, "start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision, "similarity_weight" double precision, "text_weight" double precision, "match_count" integer, "min_amount" double precision, "max_amount" double precision, "start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision, "similarity_weight" double precision, "text_weight" double precision, "match_count" integer, "min_amount" double precision, "max_amount" double precision, "start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision, "similarity_weight" double precision, "text_weight" double precision, "match_count" integer, "min_amount" numeric, "max_amount" numeric, "start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision, "similarity_weight" double precision, "text_weight" double precision, "match_count" integer, "min_amount" numeric, "max_amount" numeric, "start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search_line_items"("query_embedding" "public"."vector", "query_text" "text", "similarity_threshold" double precision, "similarity_weight" double precision, "text_weight" double precision, "match_count" integer, "min_amount" numeric, "max_amount" numeric, "start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search_receipts"("search_text" "text", "query_embedding" "public"."vector", "content_type" "text", "similarity_weight" double precision, "text_weight" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search_receipts"("search_text" "text", "query_embedding" "public"."vector", "content_type" "text", "similarity_weight" double precision, "text_weight" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search_receipts"("search_text" "text", "query_embedding" "public"."vector", "content_type" "text", "similarity_weight" double precision, "text_weight" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_temporal_semantic_search"("query_embedding" "public"."vector", "query_text" "text", "user_filter" "uuid", "receipt_ids" "uuid"[], "content_types" "text"[], "similarity_threshold" double precision, "semantic_weight" double precision, "keyword_weight" double precision, "trigram_weight" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_temporal_semantic_search"("query_embedding" "public"."vector", "query_text" "text", "user_filter" "uuid", "receipt_ids" "uuid"[], "content_types" "text"[], "similarity_threshold" double precision, "semantic_weight" double precision, "keyword_weight" double precision, "trigram_weight" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_temporal_semantic_search"("query_embedding" "public"."vector", "query_text" "text", "user_filter" "uuid", "receipt_ids" "uuid"[], "content_types" "text"[], "similarity_threshold" double precision, "semantic_weight" double precision, "keyword_weight" double precision, "trigram_weight" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_batch_counter"("batch_uuid" "uuid", "field_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_batch_counter"("batch_uuid" "uuid", "field_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_batch_counter"("batch_uuid" "uuid", "field_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_team_member"("_team_id" "uuid", "_email" character varying, "_role" "public"."team_member_role") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_team_member"("_team_id" "uuid", "_email" character varying, "_role" "public"."team_member_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_team_member"("_team_id" "uuid", "_email" character varying, "_role" "public"."team_member_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_malaysian_public_holiday"("check_date" "date", "state_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."is_malaysian_public_holiday"("check_date" "date", "state_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_malaysian_public_holiday"("check_date" "date", "state_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"("_team_id" "uuid", "_user_id" "uuid", "_min_role" "public"."team_member_role") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"("_team_id" "uuid", "_user_id" "uuid", "_min_role" "public"."team_member_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"("_team_id" "uuid", "_user_id" "uuid", "_min_role" "public"."team_member_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_owner"("_team_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_owner"("_team_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_owner"("_team_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_performance_metric"("p_metric_name" character varying, "p_metric_type" character varying, "p_metric_value" numeric, "p_metric_unit" character varying, "p_context" "jsonb", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."log_performance_metric"("p_metric_name" character varying, "p_metric_type" character varying, "p_metric_value" numeric, "p_metric_unit" character varying, "p_context" "jsonb", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_performance_metric"("p_metric_name" character varying, "p_metric_type" character varying, "p_metric_value" numeric, "p_metric_unit" character varying, "p_context" "jsonb", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."maintain_search_history_size"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_search_history_size"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_search_history_size"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_receipt_embeddings_to_unified"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_receipt_embeddings_to_unified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_receipt_embeddings_to_unified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_currency_code"("input_currency" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_currency_code"("input_currency" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_currency_code"("input_currency" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_malaysian_address"("address_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_malaysian_address"("address_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_malaysian_address"("address_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_all_temporal_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_all_temporal_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_all_temporal_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_malaysian_materialized_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_malaysian_materialized_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_malaysian_materialized_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_user_temporal_metadata"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_user_temporal_metadata"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_user_temporal_metadata"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_claim"("_claim_id" "uuid", "_rejection_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_claim"("_claim_id" "uuid", "_rejection_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_claim"("_claim_id" "uuid", "_rejection_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_team_member"("_team_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_team_member"("_team_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_team_member"("_team_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_unified_embedding"("p_source_type" "text", "p_source_id" "uuid", "p_content_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rename_conversation"("p_conversation_id" "text", "p_new_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rename_conversation"("p_conversation_id" "text", "p_new_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_conversation"("p_conversation_id" "text", "p_new_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_monthly_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_monthly_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_monthly_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."save_conversation"("p_conversation_id" "text", "p_title" "text", "p_message_count" integer, "p_is_archived" boolean, "p_is_favorite" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."save_conversation"("p_conversation_id" "text", "p_title" "text", "p_message_count" integer, "p_is_archived" boolean, "p_is_favorite" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_conversation"("p_conversation_id" "text", "p_title" "text", "p_message_count" integer, "p_is_archived" boolean, "p_is_favorite" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."save_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_context_data" "jsonb", "p_relevance_score" numeric, "p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."save_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_context_data" "jsonb", "p_relevance_score" numeric, "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_conversation_context"("p_conversation_id" "text", "p_context_type" "text", "p_context_data" "jsonb", "p_relevance_score" numeric, "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."save_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_memory_data" "jsonb", "p_confidence_score" numeric, "p_source_conversation_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."save_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_memory_data" "jsonb", "p_confidence_score" numeric, "p_source_conversation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_conversation_memory"("p_memory_type" "text", "p_memory_key" "text", "p_memory_data" "jsonb", "p_confidence_score" numeric, "p_source_conversation_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_conversation_message"("p_conversation_id" "text", "p_message_id" "text", "p_message_type" "text", "p_content" "text", "p_metadata" "jsonb", "p_parent_message_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."save_conversation_message"("p_conversation_id" "text", "p_message_id" "text", "p_message_type" "text", "p_content" "text", "p_metadata" "jsonb", "p_parent_message_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_conversation_message"("p_conversation_id" "text", "p_message_id" "text", "p_message_type" "text", "p_content" "text", "p_metadata" "jsonb", "p_parent_message_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_by_temporal_context"("p_user_id" "uuid", "p_temporal_context" "text", "p_source_types" "text"[], "p_season" "text", "p_is_weekend" boolean, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_by_temporal_context"("p_user_id" "uuid", "p_temporal_context" "text", "p_source_types" "text"[], "p_season" "text", "p_is_weekend" boolean, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_by_temporal_context"("p_user_id" "uuid", "p_temporal_context" "text", "p_source_types" "text"[], "p_season" "text", "p_is_weekend" boolean, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_conversation_memory"("p_query" "text", "p_min_confidence" numeric, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_conversation_memory"("p_query" "text", "p_min_confidence" numeric, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_conversation_memory"("p_query" "text", "p_min_confidence" numeric, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_line_items"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_line_items"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_line_items"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_malaysian_business"("search_term" "text", "limit_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_malaysian_business"("search_term" "text", "limit_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_malaysian_business"("search_term" "text", "limit_results" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_malaysian_business_optimized"("search_term" "text", "limit_results" integer, "use_cache" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."search_malaysian_business_optimized"("search_term" "text", "limit_results" integer, "use_cache" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_malaysian_business_optimized"("search_term" "text", "limit_results" integer, "use_cache" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_receipts"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer, "content_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_receipts"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer, "content_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_receipts"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer, "content_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_team_invitation_email_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_team_invitation_email_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_team_invitation_email_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_user_preference"("p_category" "text", "p_key" "text", "p_value" "jsonb", "p_confidence" numeric, "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_preference"("p_category" "text", "p_key" "text", "p_value" "jsonb", "p_confidence" numeric, "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_preference"("p_category" "text", "p_key" "text", "p_value" "jsonb", "p_confidence" numeric, "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."simple_hybrid_search"("query_text" "text", "source_types" "text"[], "user_filter" "uuid", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."simple_hybrid_search"("query_text" "text", "source_types" "text"[], "user_filter" "uuid", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."simple_hybrid_search"("query_text" "text", "source_types" "text"[], "user_filter" "uuid", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_claim"("_claim_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_claim"("_claim_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_claim"("_claim_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_message_feedback"("p_message_id" "text", "p_conversation_id" "text", "p_feedback_type" "text", "p_feedback_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_message_feedback"("p_message_id" "text", "p_conversation_id" "text", "p_feedback_type" "text", "p_feedback_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_message_feedback"("p_message_id" "text", "p_conversation_id" "text", "p_feedback_type" "text", "p_feedback_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."temporal_search_receipts"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text", "season_filter" "text", "is_weekend_filter" boolean, "days_ago_min" integer, "days_ago_max" integer, "amount_min" double precision, "amount_max" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."temporal_search_receipts"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text", "season_filter" "text", "is_weekend_filter" boolean, "days_ago_min" integer, "days_ago_max" integer, "amount_min" double precision, "amount_max" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."temporal_search_receipts"("user_filter" "uuid", "date_range_start" "date", "date_range_end" "date", "temporal_context" "text", "season_filter" "text", "is_weekend_filter" boolean, "days_ago_min" integer, "days_ago_max" integer, "amount_min" double precision, "amount_max" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_conversation_archive"("p_conversation_id" "text", "p_is_archived" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_conversation_archive"("p_conversation_id" "text", "p_is_archived" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_conversation_archive"("p_conversation_id" "text", "p_is_archived" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_conversation_favorite"("p_conversation_id" "text", "p_is_favorite" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_conversation_favorite"("p_conversation_id" "text", "p_is_favorite" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_conversation_favorite"("p_conversation_id" "text", "p_is_favorite" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."track_user_interaction"("p_interaction_type" "text", "p_interaction_context" "jsonb", "p_interaction_metadata" "jsonb", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."track_user_interaction"("p_interaction_type" "text", "p_interaction_context" "jsonb", "p_interaction_metadata" "jsonb", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_user_interaction"("p_interaction_type" "text", "p_interaction_context" "jsonb", "p_interaction_metadata" "jsonb", "p_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_create_default_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_create_default_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_create_default_categories"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_embedding_generation"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_embedding_generation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_embedding_generation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_temporal_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_temporal_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_temporal_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unified_search"("query_embedding" "public"."vector", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "start_date" "date", "end_date" "date", "min_amount" numeric, "max_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."unified_search"("query_embedding" "public"."vector", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "start_date" "date", "end_date" "date", "min_amount" numeric, "max_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."unified_search"("query_embedding" "public"."vector", "source_types" "text"[], "content_types" "text"[], "similarity_threshold" double precision, "match_count" integer, "user_filter" "uuid", "team_filter" "uuid", "language_filter" "text", "start_date" "date", "end_date" "date", "min_amount" numeric, "max_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_batch_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_batch_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_batch_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_batch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_batch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_batch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb", "p_search_history" "text"[], "p_user_preferences" "jsonb", "p_last_keywords" "jsonb", "p_last_results" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb", "p_search_history" "text"[], "p_user_preferences" "jsonb", "p_last_keywords" "jsonb", "p_last_results" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb", "p_search_history" "text"[], "p_user_preferences" "jsonb", "p_last_keywords" "jsonb", "p_last_results" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb", "p_search_history" "jsonb", "p_user_preferences" "jsonb", "p_last_keywords" "jsonb", "p_last_results" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb", "p_search_history" "jsonb", "p_user_preferences" "jsonb", "p_last_keywords" "jsonb", "p_last_results" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_context"("p_conversation_id" "uuid", "p_context_data" "jsonb", "p_search_history" "jsonb", "p_user_preferences" "jsonb", "p_last_keywords" "jsonb", "p_last_results" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_analytics_on_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_analytics_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_analytics_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_custom_categories_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_custom_categories_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_custom_categories_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_custom_category"("p_category_id" "uuid", "p_name" "text", "p_color" "text", "p_icon" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_custom_category"("p_category_id" "uuid", "p_name" "text", "p_color" "text", "p_icon" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_custom_category"("p_category_id" "uuid", "p_name" "text", "p_color" "text", "p_icon" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_delivery_status"("_delivery_id" "uuid", "_status" "public"."email_delivery_status", "_provider_message_id" character varying, "_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_delivery_status"("_delivery_id" "uuid", "_status" "public"."email_delivery_status", "_provider_message_id" character varying, "_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_delivery_status"("_delivery_id" "uuid", "_status" "public"."email_delivery_status", "_provider_message_id" character varying, "_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_embedding_temporal_context"("p_embedding_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_embedding_temporal_context"("p_embedding_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_embedding_temporal_context"("p_embedding_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_line_item_embedding"("p_line_item_id" "uuid", "p_embedding" "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."update_line_item_embedding"("p_line_item_id" "uuid", "p_embedding" "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_line_item_embedding"("p_line_item_id" "uuid", "p_embedding" "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_processing_status_if_failed"("receipt_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_processing_status_if_failed"("receipt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_processing_status_if_failed"("receipt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subscription_from_stripe"("_stripe_customer_id" "text", "_stripe_subscription_id" "text", "_tier" "public"."subscription_tier", "_status" "public"."subscription_status", "_current_period_start" timestamp with time zone, "_current_period_end" timestamp with time zone, "_trial_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."update_subscription_from_stripe"("_stripe_customer_id" "text", "_stripe_subscription_id" "text", "_tier" "public"."subscription_tier", "_status" "public"."subscription_status", "_current_period_start" timestamp with time zone, "_current_period_end" timestamp with time zone, "_trial_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subscription_from_stripe"("_stripe_customer_id" "text", "_stripe_subscription_id" "text", "_tier" "public"."subscription_tier", "_status" "public"."subscription_status", "_current_period_start" timestamp with time zone, "_current_period_end" timestamp with time zone, "_trial_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_team_member_role"("_team_id" "uuid", "_user_id" "uuid", "_new_role" "public"."team_member_role") TO "anon";
GRANT ALL ON FUNCTION "public"."update_team_member_role"("_team_id" "uuid", "_user_id" "uuid", "_new_role" "public"."team_member_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_team_member_role"("_team_id" "uuid", "_user_id" "uuid", "_new_role" "public"."team_member_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_unified_embeddings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_unified_embeddings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_unified_embeddings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_behavioral_patterns"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_behavioral_patterns"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_behavioral_patterns"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_chat_preferences"("p_preferred_response_style" "text", "p_common_search_terms" "text"[], "p_frequent_merchants" "text"[], "p_search_filters" "jsonb", "p_ui_preferences" "jsonb", "p_notification_preferences" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_chat_preferences"("p_preferred_response_style" "text", "p_common_search_terms" "text"[], "p_frequent_merchants" "text"[], "p_search_filters" "jsonb", "p_ui_preferences" "jsonb", "p_notification_preferences" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_chat_preferences"("p_preferred_response_style" "text", "p_common_search_terms" "text"[], "p_frequent_merchants" "text"[], "p_search_filters" "jsonb", "p_ui_preferences" "jsonb", "p_notification_preferences" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_malaysian_registration_number"("registration_number" "text", "registration_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_malaysian_registration_number"("registration_number" "text", "registration_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_malaysian_registration_number"("registration_number" "text", "registration_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_unified_search_setup"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_unified_search_setup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_unified_search_setup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";


















GRANT ALL ON TABLE "public"."agent_performance_history" TO "anon";
GRANT ALL ON TABLE "public"."agent_performance_history" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_performance_history" TO "service_role";



GRANT ALL ON TABLE "public"."api_access_logs" TO "anon";
GRANT ALL ON TABLE "public"."api_access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."api_access_logs" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."api_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."api_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."api_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."chat_contexts" TO "anon";
GRANT ALL ON TABLE "public"."chat_contexts" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_contexts" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."claim_audit_trail" TO "anon";
GRANT ALL ON TABLE "public"."claim_audit_trail" TO "authenticated";
GRANT ALL ON TABLE "public"."claim_audit_trail" TO "service_role";



GRANT ALL ON TABLE "public"."claims" TO "anon";
GRANT ALL ON TABLE "public"."claims" TO "authenticated";
GRANT ALL ON TABLE "public"."claims" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_analytics" TO "anon";
GRANT ALL ON TABLE "public"."conversation_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_context" TO "anon";
GRANT ALL ON TABLE "public"."conversation_context" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_context" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_contexts" TO "anon";
GRANT ALL ON TABLE "public"."conversation_contexts" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_contexts" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_memory" TO "anon";
GRANT ALL ON TABLE "public"."conversation_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_memory" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_messages" TO "anon";
GRANT ALL ON TABLE "public"."conversation_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_messages" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."conversation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."corrections" TO "anon";
GRANT ALL ON TABLE "public"."corrections" TO "authenticated";
GRANT ALL ON TABLE "public"."corrections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."corrections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."corrections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."corrections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."custom_categories" TO "anon";
GRANT ALL ON TABLE "public"."custom_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_categories" TO "service_role";



GRANT ALL ON TABLE "public"."email_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."email_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."email_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."unified_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."unified_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."embedding_content_health" TO "anon";
GRANT ALL ON TABLE "public"."embedding_content_health" TO "authenticated";
GRANT ALL ON TABLE "public"."embedding_content_health" TO "service_role";



GRANT ALL ON TABLE "public"."embedding_queue" TO "anon";
GRANT ALL ON TABLE "public"."embedding_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."embedding_queue" TO "service_role";



GRANT ALL ON TABLE "public"."errors" TO "anon";
GRANT ALL ON TABLE "public"."errors" TO "authenticated";
GRANT ALL ON TABLE "public"."errors" TO "service_role";



GRANT ALL ON TABLE "public"."eta_calculations" TO "anon";
GRANT ALL ON TABLE "public"."eta_calculations" TO "authenticated";
GRANT ALL ON TABLE "public"."eta_calculations" TO "service_role";



GRANT ALL ON TABLE "public"."line_items" TO "anon";
GRANT ALL ON TABLE "public"."line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."line_items" TO "service_role";



GRANT ALL ON TABLE "public"."load_balancing_insights" TO "anon";
GRANT ALL ON TABLE "public"."load_balancing_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."load_balancing_insights" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_address_formats" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_address_formats" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_address_formats" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_business_categories" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_business_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_business_categories" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_business_directory" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_business_directory" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_business_directory" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_business_hours" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_business_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_business_hours" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_cultural_preferences" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_cultural_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_cultural_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_currency_rates" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_currency_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_currency_rates" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_public_holidays" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_public_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_public_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_receipt_formats" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_receipt_formats" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_receipt_formats" TO "service_role";



GRANT ALL ON TABLE "public"."malaysian_tax_categories" TO "anon";
GRANT ALL ON TABLE "public"."malaysian_tax_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."malaysian_tax_categories" TO "service_role";



GRANT ALL ON TABLE "public"."message_feedback" TO "anon";
GRANT ALL ON TABLE "public"."message_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."message_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."mv_malaysian_reference_data" TO "anon";
GRANT ALL ON TABLE "public"."mv_malaysian_reference_data" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_malaysian_reference_data" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payment_history" TO "anon";
GRANT ALL ON TABLE "public"."payment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_history" TO "service_role";



GRANT ALL ON TABLE "public"."performance_alerts" TO "anon";
GRANT ALL ON TABLE "public"."performance_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."performance_cache" TO "anon";
GRANT ALL ON TABLE "public"."performance_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_cache" TO "service_role";



GRANT ALL ON TABLE "public"."performance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."performance_dashboard" TO "anon";
GRANT ALL ON TABLE "public"."performance_dashboard" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_dashboard" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."processing_logs" TO "anon";
GRANT ALL ON TABLE "public"."processing_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."processing_logs" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."receipt_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."receipt_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."receipt_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."receipts" TO "anon";
GRANT ALL ON TABLE "public"."receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."receipts" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_limits" TO "anon";
GRANT ALL ON TABLE "public"."subscription_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_limits" TO "service_role";



GRANT ALL ON TABLE "public"."team_invitations" TO "anon";
GRANT ALL ON TABLE "public"."team_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."team_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."translations" TO "anon";
GRANT ALL ON TABLE "public"."translations" TO "authenticated";
GRANT ALL ON TABLE "public"."translations" TO "service_role";



GRANT ALL ON TABLE "public"."user_behavioral_patterns" TO "anon";
GRANT ALL ON TABLE "public"."user_behavioral_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."user_behavioral_patterns" TO "service_role";



GRANT ALL ON TABLE "public"."user_chat_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_chat_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_chat_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_interactions" TO "anon";
GRANT ALL ON TABLE "public"."user_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_personalization_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_personalization_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_personalization_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_progress" TO "anon";
GRANT ALL ON TABLE "public"."workflow_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_progress" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
