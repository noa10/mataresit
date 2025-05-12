-- Skip HTTP extension creation as it already exists
-- create extension if not exists "http" with schema "public" version '1.6';

drop trigger if exists "line_item_delete_embeddings" on "public"."line_items";

drop policy "Users can view their own receipts" on "public"."receipts";

-- Skip dropping constraint that doesn't exist
-- alter table "public"."receipt_embeddings" drop constraint "enforce_unique_sources";

drop function if exists "public"."add_embedding"(p_source_type text, p_source_id uuid, p_receipt_id uuid, p_content_type text, p_embedding vector, p_metadata jsonb);

drop function if exists "public"."delete_line_item_embeddings"();

drop function if exists "public"."hybrid_search_embeddings"(search_text text, query_embedding vector, search_type text, content_type text, similarity_weight double precision, text_weight double precision, match_count integer, min_amount double precision, max_amount double precision, start_date date, end_date date);

drop view if exists "public"."line_item_embeddings_view";

drop function if exists "public"."search_embeddings"(query_embedding vector, search_type text, content_type text, similarity_threshold double precision, match_count integer);

drop function if exists "public"."search_receipts"(query_embedding vector, similarity_threshold double precision, match_count integer, content_type text);

drop function if exists "public"."update_line_item_embedding"(p_line_item_id uuid, p_embedding vector);

drop function if exists "public"."hybrid_search_line_items"(query_embedding vector, query_text text, similarity_threshold double precision, similarity_weight double precision, text_weight double precision, match_count integer, min_amount numeric, max_amount numeric, start_date date, end_date date);

drop index if exists "public"."enforce_unique_sources";

drop index if exists "public"."idx_receipt_embeddings_source_id";

drop index if exists "public"."idx_receipt_embeddings_source_type";

-- Skip adding embedding column that already exists
-- alter table "public"."line_items" add column "embedding" vector(1536);

-- Skip dropping column that doesn't exist
-- alter table "public"."receipt_embeddings" drop column "source_id";

-- Skip dropping column that doesn't exist
-- alter table "public"."receipt_embeddings" drop column "source_type";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.am_i_authenticated()
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- This will only work if called by an authenticated user
  RETURN (auth.role() = 'authenticated');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_auth_state()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result json;
BEGIN
  result := json_build_object(
    'current_user', current_user,
    'session_user', session_user,
    'auth_uid', auth.uid(),
    'is_authenticated', coalesce(auth.role() = 'authenticated', false),
    'auth_role', auth.role(),
    'receipt_count', (SELECT count(*) FROM public.receipts),
    'receipt_count_for_user', (SELECT count(*) FROM public.receipts WHERE user_id = auth.uid())
  );

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_line_item_embeddings(p_line_item_id uuid, p_embedding vector)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE line_items
    SET embedding = p_embedding
    WHERE id = p_line_item_id;
    
    RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_direct_receipt_count()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  counter integer;
BEGIN
  SELECT COUNT(*) INTO counter FROM public.receipts;
  RETURN counter;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_receipts_count()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    SELECT COUNT(*) FROM receipts_debug;
$function$
;

create type "public"."http_request" as ("method" http_method, "uri" character varying, "headers" http_header[], "content_type" character varying, "content" character varying);

create type "public"."http_response" as ("status" integer, "content_type" character varying, "headers" http_header[], "content" character varying);

CREATE OR REPLACE FUNCTION public.hybrid_search_line_items(query_embedding vector, query_text text, similarity_threshold double precision DEFAULT 0.5, similarity_weight double precision DEFAULT 0.7, text_weight double precision DEFAULT 0.3, match_count integer DEFAULT 10, min_amount double precision DEFAULT NULL::double precision, max_amount double precision DEFAULT NULL::double precision, start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date)
 RETURNS TABLE(line_item_id uuid, receipt_id uuid, line_item_description text, line_item_amount numeric, parent_receipt_merchant text, parent_receipt_date date, similarity double precision, text_score double precision, score double precision)
 LANGUAGE plpgsql
AS $function$
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
      (1 - (li.embedding <=> query_embedding))::double precision as similarity
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
      ts_rank(to_tsvector('english', coalesce(li.description, '')), plainto_tsquery('english', query_text))::double precision as text_score
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
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search_receipts(query_embedding vector, search_text text, similarity_threshold double precision DEFAULT 0.5, similarity_weight double precision DEFAULT 0.7, text_weight double precision DEFAULT 0.3, match_count integer DEFAULT 10, content_type_filter text DEFAULT 'full_text'::text)
 RETURNS TABLE(receipt_id uuid, similarity double precision, text_score double precision, score double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH vector_matches AS (
    SELECT
      re.receipt_id,
      1 - (re.embedding <=> query_embedding) as similarity
    FROM
      receipt_embeddings re
    WHERE
      re.embedding IS NOT NULL
      AND (1 - (re.embedding <=> query_embedding)) > similarity_threshold
      AND (content_type_filter = 'all' OR re.content_type = content_type_filter)
  ),
  text_matches AS (
    SELECT
      r.id as receipt_id,
      ts_rank(
        setweight(to_tsvector('english', coalesce(r.merchant, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(r."fullText", '')), 'B') ||
        setweight(to_tsvector('english', coalesce(r.predicted_category, '')), 'C'),
        plainto_tsquery('english', search_text)
      )::double precision as text_score
    FROM
      receipts r
    WHERE
      search_text IS NOT NULL
      AND search_text <> ''
  )
  SELECT
    v.receipt_id,
    v.similarity,
    coalesce(t.text_score, 0) as text_score,
    (v.similarity * similarity_weight) + (coalesce(t.text_score, 0) * text_weight) as score
  FROM
    vector_matches v
  LEFT JOIN
    text_matches t ON v.receipt_id = t.receipt_id
  ORDER BY
    score DESC
  LIMIT match_count;
END;
$function$
;

create or replace view "public"."receipts_debug" as  SELECT receipts.id,
    receipts.user_id,
    receipts.merchant,
    receipts.date,
    receipts.total,
    receipts.tax,
    receipts.currency,
    receipts.payment_method,
    receipts.status,
    receipts.image_url,
    receipts.created_at,
    receipts.updated_at,
    receipts."fullText",
    receipts.ai_suggestions,
    receipts.predicted_category,
    receipts.processing_status,
    receipts.processing_error,
    receipts.processing_time,
    receipts.model_used,
    receipts.primary_method,
    receipts.has_alternative_data,
    receipts.discrepancies,
    receipts.normalized_merchant,
    receipts.currency_converted,
    receipts.confidence_scores,
    receipts.batch_id,
    receipts.thumbnail_url,
    receipts.document_structure,
    receipts.field_geometry
   FROM receipts;


CREATE OR REPLACE FUNCTION public.search_line_items(query_embedding vector, similarity_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 10)
 RETURNS TABLE(line_item_id uuid, receipt_id uuid, line_item_description text, line_item_amount numeric, parent_receipt_merchant text, parent_receipt_date date, similarity double precision)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.search_receipts(query_embedding vector, similarity_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 10, content_type_filter text DEFAULT 'full_text'::text)
 RETURNS TABLE(receipt_id uuid, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    re.receipt_id,
    1 - (re.embedding <=> query_embedding) as similarity
  FROM
    receipt_embeddings re
  JOIN
    receipts r ON re.receipt_id = r.id
  WHERE
    re.embedding IS NOT NULL
    AND (1 - (re.embedding <=> query_embedding)) > similarity_threshold
    AND (content_type_filter = 'all' OR re.content_type = content_type_filter)
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_pgvector_status()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  extension_exists boolean;
  vector_table_exists boolean;
  api_key_exists boolean;
  result json;
BEGIN
  -- Check if pgvector extension is installed
  SELECT EXISTS(
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) INTO extension_exists;

  -- Check if receipt_embeddings table exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'receipt_embeddings'
  ) INTO vector_table_exists;
  
  -- Always set api_key_exists to true since we're using environment variables
  -- and can't check them from SQL
  api_key_exists := true;

  -- Return results as JSON
  result := json_build_object(
    'extension_exists', extension_exists,
    'vector_table_exists', vector_table_exists,
    'api_key_exists', api_key_exists
  );

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_first_admin(_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_users()
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, confirmed_at timestamp with time zone, last_sign_in_at timestamp with time zone, created_at timestamp with time zone, roles jsonb)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search_line_items(query_embedding vector, query_text text, similarity_threshold double precision DEFAULT 0.5, similarity_weight double precision DEFAULT 0.7, text_weight double precision DEFAULT 0.3, match_count integer DEFAULT 10, min_amount numeric DEFAULT NULL::numeric, max_amount numeric DEFAULT NULL::numeric, start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date)
 RETURNS TABLE(line_item_id uuid, receipt_id uuid, line_item_description text, line_item_amount numeric, parent_receipt_merchant text, parent_receipt_date date, similarity double precision, text_score double precision, score double precision)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

create policy "Users can view their own receipts"
on "public"."receipts"
as permissive
for select
to authenticated
using ((auth.uid() = user_id));



