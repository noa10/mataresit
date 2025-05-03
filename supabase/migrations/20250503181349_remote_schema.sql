-- Skip HTTP extension creation as it already exists
-- create extension if not exists "http" with schema "public" version '1.6';

drop policy "Service role can insert logs" on "public"."processing_logs";

drop policy "Admins can assign roles" on "public"."user_roles";

drop policy "Admins can delete roles" on "public"."user_roles";

drop policy "Admins can read all roles" on "public"."user_roles";

drop policy "Admins can update roles" on "public"."user_roles";

drop function if exists "public"."has_role"(_user_id uuid, _role app_role);

create table "public"."errors" (
    "id" uuid not null default uuid_generate_v4(),
    "message" text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."processing_logs" add column "batch_item_id" uuid;

alter table "public"."processing_logs" alter column "receipt_id" drop not null;

alter table "public"."profiles" add column "email" text;

alter table "public"."receipts" add column "batch_id" uuid;

alter table "public"."receipts" add column "currency_converted" boolean default false;

alter table "public"."receipts" add column "normalized_merchant" text;

CREATE UNIQUE INDEX errors_pkey ON public.errors USING btree (id);

CREATE INDEX idx_processing_logs_batch_item_id ON public.processing_logs USING btree (batch_item_id);

CREATE INDEX idx_receipts_batch_id ON public.receipts USING btree (batch_id);

CREATE INDEX idx_receipts_date ON public.receipts USING btree (date);

CREATE INDEX idx_receipts_merchant ON public.receipts USING btree (merchant);

CREATE INDEX idx_receipts_predicted_category ON public.receipts USING btree (predicted_category);

CREATE INDEX idx_receipts_status ON public.receipts USING btree (status);

CREATE INDEX idx_receipts_user_id ON public.receipts USING btree (user_id);

alter table "public"."errors" add constraint "errors_pkey" PRIMARY KEY using index "errors_pkey";

alter table "public"."line_items" add constraint "fk_receipt" FOREIGN KEY (receipt_id) REFERENCES receipts(id) not valid;

alter table "public"."line_items" validate constraint "fk_receipt";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.column_exists(p_table text, p_column text, p_schema text DEFAULT 'public'::text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = p_schema
        AND table_name = p_table
        AND column_name = p_column
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_expense_from_receipt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

CREATE OR REPLACE FUNCTION public.get_user_receipt_usage_stats()
 RETURNS TABLE(primary_method text, receipt_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_batch_item()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_role app_role, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.increment_batch_counter(batch_uuid uuid, field_name text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_batch_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_batch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE public.batches
    SET updated_at = NOW()
    WHERE id = NEW.batch_id;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
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

grant delete on table "public"."errors" to "anon";

grant insert on table "public"."errors" to "anon";

grant references on table "public"."errors" to "anon";

grant select on table "public"."errors" to "anon";

grant trigger on table "public"."errors" to "anon";

grant truncate on table "public"."errors" to "anon";

grant update on table "public"."errors" to "anon";

grant delete on table "public"."errors" to "authenticated";

grant insert on table "public"."errors" to "authenticated";

grant references on table "public"."errors" to "authenticated";

grant select on table "public"."errors" to "authenticated";

grant trigger on table "public"."errors" to "authenticated";

grant truncate on table "public"."errors" to "authenticated";

grant update on table "public"."errors" to "authenticated";

grant delete on table "public"."errors" to "service_role";

grant insert on table "public"."errors" to "service_role";

grant references on table "public"."errors" to "service_role";

grant select on table "public"."errors" to "service_role";

grant trigger on table "public"."errors" to "service_role";

grant truncate on table "public"."errors" to "service_role";

grant update on table "public"."errors" to "service_role";

create policy "Users can delete their own corrections"
on "public"."corrections"
as permissive
for delete
to authenticated
using ((receipt_id IN ( SELECT receipts.id
   FROM receipts
  WHERE (receipts.user_id = auth.uid()))));


create policy "Users can insert their own corrections"
on "public"."corrections"
as permissive
for insert
to authenticated
with check ((receipt_id IN ( SELECT receipts.id
   FROM receipts
  WHERE (receipts.user_id = auth.uid()))));


create policy "Users can update their own corrections"
on "public"."corrections"
as permissive
for update
to authenticated
using ((receipt_id IN ( SELECT receipts.id
   FROM receipts
  WHERE (receipts.user_id = auth.uid()))));


create policy "Users can view their own corrections"
on "public"."corrections"
as permissive
for select
to authenticated
using ((receipt_id IN ( SELECT receipts.id
   FROM receipts
  WHERE (receipts.user_id = auth.uid()))));


create policy "Service role can insert logs"
on "public"."processing_logs"
as permissive
for insert
to service_role
with check (true);


create policy "Admins can assign roles"
on "public"."user_roles"
as permissive
for insert
to public
with check (has_role('admin'::app_role));


create policy "Admins can delete roles"
on "public"."user_roles"
as permissive
for delete
to public
using (has_role('admin'::app_role));


create policy "Admins can read all roles"
on "public"."user_roles"
as permissive
for select
to public
using (has_role('admin'::app_role));


create policy "Admins can update roles"
on "public"."user_roles"
as permissive
for update
to public
using (has_role('admin'::app_role));



