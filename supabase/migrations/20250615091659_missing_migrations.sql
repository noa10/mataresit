-- Create types only if they don't exist
DO $$ BEGIN
    CREATE TYPE "public"."claim_priority" AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."claim_status" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."email_delivery_status" AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced', 'complained');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."invitation_status" AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."notification_priority" AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."notification_type" AS ENUM ('team_invitation_sent', 'team_invitation_accepted', 'team_member_joined', 'team_member_left', 'team_member_role_changed', 'claim_submitted', 'claim_approved', 'claim_rejected', 'claim_review_requested', 'team_settings_updated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."team_member_role" AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."team_status" AS ENUM ('active', 'suspended', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop policies only if they exist
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can delete their own receipts" ON "public"."receipts";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can insert their own receipts" ON "public"."receipts";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update their own receipts" ON "public"."receipts";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own receipts" ON "public"."receipts";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

create table "public"."claim_audit_trail" (
    "id" uuid not null default gen_random_uuid(),
    "claim_id" uuid not null,
    "user_id" uuid not null,
    "action" character varying(50) not null,
    "old_status" claim_status,
    "new_status" claim_status,
    "comment" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."claim_audit_trail" enable row level security;

create table "public"."claims" (
    "id" uuid not null default gen_random_uuid(),
    "team_id" uuid not null,
    "claimant_id" uuid not null,
    "title" character varying(255) not null,
    "description" text,
    "amount" numeric(12,2) not null,
    "currency" character varying(5) not null default 'USD'::character varying,
    "category" character varying(100),
    "priority" claim_priority not null default 'medium'::claim_priority,
    "status" claim_status not null default 'draft'::claim_status,
    "submitted_at" timestamp with time zone,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "approved_by" uuid,
    "approved_at" timestamp with time zone,
    "rejection_reason" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "attachments" jsonb not null default '[]'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."claims" enable row level security;

create table "public"."custom_categories" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "name" text not null,
    "color" text not null default '#3B82F6'::text,
    "icon" text default 'tag'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."custom_categories" enable row level security;

create table "public"."email_deliveries" (
    "id" uuid not null default gen_random_uuid(),
    "recipient_email" character varying(255) not null,
    "subject" character varying(500) not null,
    "template_name" character varying(100),
    "status" email_delivery_status not null default 'pending'::email_delivery_status,
    "provider_message_id" character varying(255),
    "error_message" text,
    "retry_count" integer not null default 0,
    "max_retries" integer not null default 3,
    "related_entity_type" character varying(50),
    "related_entity_id" uuid,
    "team_id" uuid,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "next_retry_at" timestamp with time zone
);


alter table "public"."email_deliveries" enable row level security;

create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "recipient_id" uuid not null,
    "team_id" uuid,
    "type" notification_type not null,
    "priority" notification_priority not null default 'medium'::notification_priority,
    "title" character varying(255) not null,
    "message" text not null,
    "action_url" text,
    "read_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "related_entity_type" character varying(50),
    "related_entity_id" uuid,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone
);


alter table "public"."notifications" enable row level security;

create table "public"."posts" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "title" text not null,
    "content" text,
    "excerpt" text,
    "image_url" text,
    "tags" text[],
    "status" text not null default 'draft'::text,
    "published_at" timestamp with time zone,
    "author_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."posts" enable row level security;

create table "public"."team_invitations" (
    "id" uuid not null default gen_random_uuid(),
    "team_id" uuid not null,
    "email" character varying(255) not null,
    "role" team_member_role not null default 'member'::team_member_role,
    "invited_by" uuid not null,
    "status" invitation_status not null default 'pending'::invitation_status,
    "token" character varying(255) not null,
    "expires_at" timestamp with time zone not null,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."team_invitations" enable row level security;

create table "public"."team_members" (
    "id" uuid not null default gen_random_uuid(),
    "team_id" uuid not null,
    "user_id" uuid not null,
    "role" team_member_role not null default 'member'::team_member_role,
    "permissions" jsonb not null default '{}'::jsonb,
    "joined_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."team_members" enable row level security;

create table "public"."teams" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(255) not null,
    "description" text,
    "slug" character varying(100) not null,
    "status" team_status not null default 'active'::team_status,
    "owner_id" uuid not null,
    "settings" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."teams" enable row level security;

alter table "public"."receipts" add column "custom_category_id" uuid;

alter table "public"."receipts" add column "embedding_status" text;

alter table "public"."receipts" add column "has_embeddings" boolean default false;

alter table "public"."receipts" add column "team_id" uuid;

CREATE UNIQUE INDEX claim_audit_trail_pkey ON public.claim_audit_trail USING btree (id);

CREATE UNIQUE INDEX claims_pkey ON public.claims USING btree (id);

CREATE UNIQUE INDEX custom_categories_pkey ON public.custom_categories USING btree (id);

CREATE UNIQUE INDEX email_deliveries_pkey ON public.email_deliveries USING btree (id);

CREATE INDEX idx_claim_audit_trail_action ON public.claim_audit_trail USING btree (action);

CREATE INDEX idx_claim_audit_trail_claim_id ON public.claim_audit_trail USING btree (claim_id);

CREATE INDEX idx_claim_audit_trail_created_at ON public.claim_audit_trail USING btree (created_at);

CREATE INDEX idx_claim_audit_trail_user_id ON public.claim_audit_trail USING btree (user_id);

CREATE INDEX idx_claims_approved_by ON public.claims USING btree (approved_by);

CREATE INDEX idx_claims_claimant_id ON public.claims USING btree (claimant_id);

CREATE INDEX idx_claims_priority ON public.claims USING btree (priority);

CREATE INDEX idx_claims_reviewed_by ON public.claims USING btree (reviewed_by);

CREATE INDEX idx_claims_status ON public.claims USING btree (status);

CREATE INDEX idx_claims_submitted_at ON public.claims USING btree (submitted_at);

CREATE INDEX idx_claims_team_id ON public.claims USING btree (team_id);

CREATE INDEX idx_custom_categories_user_id ON public.custom_categories USING btree (user_id);

CREATE INDEX idx_email_deliveries_created_at ON public.email_deliveries USING btree (created_at);

CREATE INDEX idx_email_deliveries_next_retry_at ON public.email_deliveries USING btree (next_retry_at);

CREATE INDEX idx_email_deliveries_recipient_email ON public.email_deliveries USING btree (recipient_email);

CREATE INDEX idx_email_deliveries_related_entity ON public.email_deliveries USING btree (related_entity_type, related_entity_id);

CREATE INDEX idx_email_deliveries_status ON public.email_deliveries USING btree (status);

CREATE INDEX idx_email_deliveries_team_id ON public.email_deliveries USING btree (team_id);

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);

CREATE INDEX idx_notifications_expires_at ON public.notifications USING btree (expires_at);

CREATE INDEX idx_notifications_read_at ON public.notifications USING btree (read_at);

CREATE INDEX idx_notifications_recipient_id ON public.notifications USING btree (recipient_id);

CREATE INDEX idx_notifications_related_entity ON public.notifications USING btree (related_entity_type, related_entity_id);

CREATE INDEX idx_notifications_team_id ON public.notifications USING btree (team_id);

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);

CREATE INDEX idx_posts_author_id ON public.posts USING btree (author_id);

CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at);

CREATE INDEX idx_posts_published_at ON public.posts USING btree (published_at);

CREATE INDEX idx_posts_slug ON public.posts USING btree (slug);

CREATE INDEX idx_posts_status ON public.posts USING btree (status);

CREATE INDEX idx_posts_tags ON public.posts USING gin (tags);

CREATE INDEX idx_receipts_custom_category_id ON public.receipts USING btree (custom_category_id);

CREATE INDEX idx_receipts_embedding_status ON public.receipts USING btree (processing_status, has_embeddings, embedding_status);

CREATE INDEX idx_receipts_team_id ON public.receipts USING btree (team_id);

CREATE INDEX idx_team_invitations_email ON public.team_invitations USING btree (email);

CREATE INDEX idx_team_invitations_expires_at ON public.team_invitations USING btree (expires_at);

CREATE INDEX idx_team_invitations_status ON public.team_invitations USING btree (status);

CREATE INDEX idx_team_invitations_team_id ON public.team_invitations USING btree (team_id);

CREATE INDEX idx_team_invitations_token ON public.team_invitations USING btree (token);

CREATE INDEX idx_team_members_role ON public.team_members USING btree (role);

CREATE INDEX idx_team_members_team_id ON public.team_members USING btree (team_id);

CREATE INDEX idx_team_members_user_id ON public.team_members USING btree (user_id);

CREATE INDEX idx_teams_owner_id ON public.teams USING btree (owner_id);

CREATE INDEX idx_teams_slug ON public.teams USING btree (slug);

CREATE INDEX idx_teams_status ON public.teams USING btree (status);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (id);

CREATE UNIQUE INDEX posts_slug_key ON public.posts USING btree (slug);

CREATE UNIQUE INDEX team_invitations_pkey ON public.team_invitations USING btree (id);

CREATE UNIQUE INDEX team_invitations_token_key ON public.team_invitations USING btree (token);

CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (id);

CREATE UNIQUE INDEX team_members_team_id_user_id_key ON public.team_members USING btree (team_id, user_id);

CREATE UNIQUE INDEX teams_pkey ON public.teams USING btree (id);

CREATE UNIQUE INDEX teams_slug_key ON public.teams USING btree (slug);

CREATE UNIQUE INDEX unique_category_name_per_user ON public.custom_categories USING btree (user_id, name);

alter table "public"."claim_audit_trail" add constraint "claim_audit_trail_pkey" PRIMARY KEY using index "claim_audit_trail_pkey";

alter table "public"."claims" add constraint "claims_pkey" PRIMARY KEY using index "claims_pkey";

alter table "public"."custom_categories" add constraint "custom_categories_pkey" PRIMARY KEY using index "custom_categories_pkey";

alter table "public"."email_deliveries" add constraint "email_deliveries_pkey" PRIMARY KEY using index "email_deliveries_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."posts" add constraint "posts_pkey" PRIMARY KEY using index "posts_pkey";

alter table "public"."team_invitations" add constraint "team_invitations_pkey" PRIMARY KEY using index "team_invitations_pkey";

alter table "public"."team_members" add constraint "team_members_pkey" PRIMARY KEY using index "team_members_pkey";

alter table "public"."teams" add constraint "teams_pkey" PRIMARY KEY using index "teams_pkey";

alter table "public"."claim_audit_trail" add constraint "claim_audit_trail_claim_id_fkey" FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE not valid;

alter table "public"."claim_audit_trail" validate constraint "claim_audit_trail_claim_id_fkey";

alter table "public"."claim_audit_trail" add constraint "claim_audit_trail_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."claim_audit_trail" validate constraint "claim_audit_trail_user_id_fkey";

alter table "public"."claims" add constraint "claims_amount_positive" CHECK ((amount > (0)::numeric)) not valid;

alter table "public"."claims" validate constraint "claims_amount_positive";

alter table "public"."claims" add constraint "claims_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id) not valid;

alter table "public"."claims" validate constraint "claims_approved_by_fkey";

alter table "public"."claims" add constraint "claims_claimant_id_fkey" FOREIGN KEY (claimant_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."claims" validate constraint "claims_claimant_id_fkey";

alter table "public"."claims" add constraint "claims_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) not valid;

alter table "public"."claims" validate constraint "claims_reviewed_by_fkey";

alter table "public"."claims" add constraint "claims_status_workflow" CHECK ((((status = 'draft'::claim_status) AND (submitted_at IS NULL)) OR ((status <> 'draft'::claim_status) AND (submitted_at IS NOT NULL)))) not valid;

alter table "public"."claims" validate constraint "claims_status_workflow";

alter table "public"."claims" add constraint "claims_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE not valid;

alter table "public"."claims" validate constraint "claims_team_id_fkey";

alter table "public"."claims" add constraint "claims_title_length" CHECK (((char_length((title)::text) >= 3) AND (char_length((title)::text) <= 255))) not valid;

alter table "public"."claims" validate constraint "claims_title_length";

alter table "public"."custom_categories" add constraint "custom_categories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."custom_categories" validate constraint "custom_categories_user_id_fkey";

alter table "public"."custom_categories" add constraint "unique_category_name_per_user" UNIQUE using index "unique_category_name_per_user";

alter table "public"."custom_categories" add constraint "valid_color_format" CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text)) not valid;

alter table "public"."custom_categories" validate constraint "valid_color_format";

alter table "public"."custom_categories" add constraint "valid_name_length" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 50))) not valid;

alter table "public"."custom_categories" validate constraint "valid_name_length";

alter table "public"."email_deliveries" add constraint "email_deliveries_retry_count_valid" CHECK (((retry_count >= 0) AND (retry_count <= max_retries))) not valid;

alter table "public"."email_deliveries" validate constraint "email_deliveries_retry_count_valid";

alter table "public"."email_deliveries" add constraint "email_deliveries_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL not valid;

alter table "public"."email_deliveries" validate constraint "email_deliveries_team_id_fkey";

alter table "public"."notifications" add constraint "notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_recipient_id_fkey";

alter table "public"."notifications" add constraint "notifications_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_team_id_fkey";

alter table "public"."notifications" add constraint "notifications_title_length" CHECK (((char_length((title)::text) >= 1) AND (char_length((title)::text) <= 255))) not valid;

alter table "public"."notifications" validate constraint "notifications_title_length";

alter table "public"."posts" add constraint "posts_slug_key" UNIQUE using index "posts_slug_key";

alter table "public"."posts" add constraint "posts_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))) not valid;

alter table "public"."posts" validate constraint "posts_status_check";

alter table "public"."receipts" add constraint "receipts_custom_category_id_fkey" FOREIGN KEY (custom_category_id) REFERENCES custom_categories(id) ON DELETE SET NULL not valid;

alter table "public"."receipts" validate constraint "receipts_custom_category_id_fkey";

alter table "public"."receipts" add constraint "receipts_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL not valid;

alter table "public"."receipts" validate constraint "receipts_team_id_fkey";

alter table "public"."team_invitations" add constraint "team_invitations_email_format" CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)) not valid;

alter table "public"."team_invitations" validate constraint "team_invitations_email_format";

alter table "public"."team_invitations" add constraint "team_invitations_expires_future" CHECK ((expires_at > created_at)) not valid;

alter table "public"."team_invitations" validate constraint "team_invitations_expires_future";

alter table "public"."team_invitations" add constraint "team_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."team_invitations" validate constraint "team_invitations_invited_by_fkey";

alter table "public"."team_invitations" add constraint "team_invitations_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE not valid;

alter table "public"."team_invitations" validate constraint "team_invitations_team_id_fkey";

alter table "public"."team_invitations" add constraint "team_invitations_token_key" UNIQUE using index "team_invitations_token_key";

alter table "public"."team_members" add constraint "team_members_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_team_id_fkey";

alter table "public"."team_members" add constraint "team_members_team_id_user_id_key" UNIQUE using index "team_members_team_id_user_id_key";

alter table "public"."team_members" add constraint "team_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_user_id_fkey";

alter table "public"."teams" add constraint "teams_name_length" CHECK (((char_length((name)::text) >= 2) AND (char_length((name)::text) <= 255))) not valid;

alter table "public"."teams" validate constraint "teams_name_length";

alter table "public"."teams" add constraint "teams_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."teams" validate constraint "teams_owner_id_fkey";

alter table "public"."teams" add constraint "teams_slug_format" CHECK (((slug)::text ~ '^[a-z0-9-]+$'::text)) not valid;

alter table "public"."teams" validate constraint "teams_slug_format";

alter table "public"."teams" add constraint "teams_slug_key" UNIQUE using index "teams_slug_key";

alter table "public"."teams" add constraint "teams_slug_length" CHECK (((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100))) not valid;

alter table "public"."teams" validate constraint "teams_slug_length";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _invitation RECORD;
  _user_email VARCHAR(255);
BEGIN
  -- Get current user's email
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Get invitation details
  SELECT * INTO _invitation
  FROM public.team_invitations
  WHERE token = _token AND status = 'pending' AND expires_at > NOW();

  IF _invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Check if invitation is for the current user
  IF _invitation.email != _user_email THEN
    RAISE EXCEPTION 'Invitation is not for the current user';
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
$function$
;

CREATE OR REPLACE FUNCTION public.approve_claim(_claim_id uuid, _comment text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _claim_record public.claims;
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record FROM public.claims WHERE id = _claim_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user can approve claims in this team
  IF NOT public.can_approve_claims(_claim_record.team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Insufficient permissions to approve claims in this team';
  END IF;

  -- Check if claim is in a state that can be approved
  IF _claim_record.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Only submitted or under review claims can be approved';
  END IF;

  -- Update claim status
  UPDATE public.claims 
  SET 
    status = 'approved', 
    approved_by = auth.uid(),
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, old_status, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'approved', _claim_record.status, 'approved', 
    COALESCE(_comment, 'Claim approved')
  );

  -- Create notification for claimant
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  ) VALUES (
    _claim_record.claimant_id, _claim_record.team_id, 'claim_approved', 'high',
    'Claim Approved',
    'Your claim "' || _claim_record.title || '" has been approved',
    '/teams/' || _claim_record.team_id || '/claims/' || _claim_id,
    'claim', _claim_id
  );

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.archive_notification(_notification_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.notifications 
  SET archived_at = NOW()
  WHERE id = _notification_id 
  AND recipient_id = auth.uid();

  RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.bulk_assign_category(p_receipt_ids uuid[], p_category_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.can_approve_claims(_team_id uuid, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT public.is_team_member(_team_id, _user_id, 'admin');
$function$
;

CREATE OR REPLACE FUNCTION public.can_review_claims(_team_id uuid, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT public.is_team_member(_team_id, _user_id, 'admin');
$function$
;

CREATE OR REPLACE FUNCTION public.can_submit_claims(_team_id uuid, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT public.is_team_member(_team_id, _user_id, 'member');
$function$
;

CREATE OR REPLACE FUNCTION public.create_claim(_team_id uuid, _title character varying, _description text, _amount numeric, _currency character varying, _category character varying, _priority claim_priority, _attachments jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_custom_category(p_name text, p_color text DEFAULT '#3B82F6'::text, p_icon text DEFAULT 'tag'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_default_categories_for_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_email_delivery(_recipient_email character varying, _subject character varying, _template_name character varying, _related_entity_type character varying, _related_entity_id uuid, _team_id uuid, _metadata jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_team(_name character varying, _description text DEFAULT NULL::text, _slug character varying DEFAULT NULL::character varying)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_custom_category(p_category_id uuid, p_reassign_to_category_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_line_items_without_embeddings_for_receipt(p_receipt_id uuid)
 RETURNS TABLE(id uuid, description text, amount numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$ BEGIN RETURN QUERY SELECT li.id, li.description, li.amount FROM public.line_items li WHERE li.receipt_id = p_receipt_id AND li.description IS NOT NULL AND NOT EXISTS ( SELECT 1 FROM public.receipt_embeddings re WHERE re.content_type = 'line_item' AND re.receipt_id = p_receipt_id AND (re.metadata->>'line_item_id')::uuid = li.id ); END; $function$
;

CREATE OR REPLACE FUNCTION public.get_receipts_with_missing_line_item_embeddings(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_team_claims(_team_id uuid, _status claim_status, _limit integer, _offset integer)
 RETURNS TABLE(id uuid, title character varying, description text, amount numeric, currency character varying, category character varying, priority claim_priority, status claim_status, claimant_id uuid, claimant_name text, claimant_email text, submitted_at timestamp with time zone, reviewed_by uuid, reviewed_at timestamp with time zone, approved_by uuid, approved_at timestamp with time zone, rejection_reason text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_team_members(_team_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, email character varying, first_name text, last_name text, role team_member_role, joined_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(_team_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE recipient_id = auth.uid()
  AND read_at IS NULL
  AND archived_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (_team_id IS NULL OR team_id = _team_id);
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_categories_with_counts(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(id uuid, name text, color text, icon text, created_at timestamp with time zone, updated_at timestamp with time zone, receipt_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_notifications(_limit integer, _offset integer, _unread_only boolean)
 RETURNS TABLE(id uuid, team_id uuid, team_name character varying, type notification_type, priority notification_priority, title character varying, message text, action_url text, read_at timestamp with time zone, created_at timestamp with time zone, expires_at timestamp with time zone, related_entity_type character varying, related_entity_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_teams(_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(id uuid, name character varying, description text, slug character varying, status team_status, owner_id uuid, user_role team_member_role, member_count bigint, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_users_by_ids(user_ids uuid[])
 RETURNS TABLE(id uuid, email text, first_name text, last_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_posts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invite_team_member(_team_id uuid, _email character varying, _role team_member_role DEFAULT 'member'::team_member_role)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _invitation_id UUID;
  _token VARCHAR(255);
BEGIN
  -- Check if user has permission to invite
  IF NOT public.is_team_member(_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to invite team members';
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

  -- Create invitation
  INSERT INTO public.team_invitations (
    team_id, email, role, invited_by, token, expires_at
  ) VALUES (
    _team_id, _email, _role, auth.uid(), NOW() + INTERVAL '7 days'
  ) RETURNING id INTO _invitation_id;

  RETURN _invitation_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid DEFAULT auth.uid(), _min_role team_member_role DEFAULT 'viewer'::team_member_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_team_owner(_team_id uuid, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id AND t.owner_id = _user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(_team_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.mark_notification_read(_notification_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.notifications 
  SET read_at = NOW()
  WHERE id = _notification_id 
  AND recipient_id = auth.uid()
  AND read_at IS NULL;

  RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_claim(_claim_id uuid, _rejection_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _claim_record public.claims;
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record FROM public.claims WHERE id = _claim_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user can approve claims in this team
  IF NOT public.can_approve_claims(_claim_record.team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Insufficient permissions to reject claims in this team';
  END IF;

  -- Check if claim is in a state that can be rejected
  IF _claim_record.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Only submitted or under review claims can be rejected';
  END IF;

  -- Update claim status
  UPDATE public.claims 
  SET 
    status = 'rejected', 
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    rejection_reason = _rejection_reason,
    updated_at = NOW()
  WHERE id = _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, old_status, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'rejected', _claim_record.status, 'rejected', _rejection_reason
  );

  -- Create notification for claimant
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  ) VALUES (
    _claim_record.claimant_id, _claim_record.team_id, 'claim_rejected', 'high',
    'Claim Rejected',
    'Your claim "' || _claim_record.title || '" has been rejected: ' || _rejection_reason,
    '/teams/' || _claim_record.team_id || '/claims/' || _claim_id,
    'claim', _claim_id
  );

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_team_member(_team_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.send_team_invitation_email_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_claim(_claim_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _claim_record public.claims;
  _team_admins UUID[];
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record FROM public.claims WHERE id = _claim_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user owns the claim and it's in draft status
  IF _claim_record.claimant_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own claims';
  END IF;

  IF _claim_record.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft claims can be submitted';
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

  -- Create notifications for team admins
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  )
  SELECT 
    admin_id, _claim_record.team_id, 'claim_submitted', 'medium',
    'New Claim Submitted',
    'A new claim "' || _claim_record.title || '" has been submitted for review',
    '/teams/' || _claim_record.team_id || '/claims/' || _claim_id,
    'claim', _claim_id
  FROM UNNEST(_team_admins) AS admin_id;

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_create_default_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create default categories for the new user
  PERFORM create_default_categories_for_user(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_custom_categories_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_custom_category(p_category_id uuid, p_name text DEFAULT NULL::text, p_color text DEFAULT NULL::text, p_icon text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_email_delivery_status(_delivery_id uuid, _status email_delivery_status, _provider_message_id character varying, _error_message text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_team_member_role(_team_id uuid, _user_id uuid, _new_role team_member_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

grant delete on table "public"."claim_audit_trail" to "anon";

grant insert on table "public"."claim_audit_trail" to "anon";

grant references on table "public"."claim_audit_trail" to "anon";

grant select on table "public"."claim_audit_trail" to "anon";

grant trigger on table "public"."claim_audit_trail" to "anon";

grant truncate on table "public"."claim_audit_trail" to "anon";

grant update on table "public"."claim_audit_trail" to "anon";

grant delete on table "public"."claim_audit_trail" to "authenticated";

grant insert on table "public"."claim_audit_trail" to "authenticated";

grant references on table "public"."claim_audit_trail" to "authenticated";

grant select on table "public"."claim_audit_trail" to "authenticated";

grant trigger on table "public"."claim_audit_trail" to "authenticated";

grant truncate on table "public"."claim_audit_trail" to "authenticated";

grant update on table "public"."claim_audit_trail" to "authenticated";

grant delete on table "public"."claim_audit_trail" to "service_role";

grant insert on table "public"."claim_audit_trail" to "service_role";

grant references on table "public"."claim_audit_trail" to "service_role";

grant select on table "public"."claim_audit_trail" to "service_role";

grant trigger on table "public"."claim_audit_trail" to "service_role";

grant truncate on table "public"."claim_audit_trail" to "service_role";

grant update on table "public"."claim_audit_trail" to "service_role";

grant delete on table "public"."claims" to "anon";

grant insert on table "public"."claims" to "anon";

grant references on table "public"."claims" to "anon";

grant select on table "public"."claims" to "anon";

grant trigger on table "public"."claims" to "anon";

grant truncate on table "public"."claims" to "anon";

grant update on table "public"."claims" to "anon";

grant delete on table "public"."claims" to "authenticated";

grant insert on table "public"."claims" to "authenticated";

grant references on table "public"."claims" to "authenticated";

grant select on table "public"."claims" to "authenticated";

grant trigger on table "public"."claims" to "authenticated";

grant truncate on table "public"."claims" to "authenticated";

grant update on table "public"."claims" to "authenticated";

grant delete on table "public"."claims" to "service_role";

grant insert on table "public"."claims" to "service_role";

grant references on table "public"."claims" to "service_role";

grant select on table "public"."claims" to "service_role";

grant trigger on table "public"."claims" to "service_role";

grant truncate on table "public"."claims" to "service_role";

grant update on table "public"."claims" to "service_role";

grant delete on table "public"."custom_categories" to "anon";

grant insert on table "public"."custom_categories" to "anon";

grant references on table "public"."custom_categories" to "anon";

grant select on table "public"."custom_categories" to "anon";

grant trigger on table "public"."custom_categories" to "anon";

grant truncate on table "public"."custom_categories" to "anon";

grant update on table "public"."custom_categories" to "anon";

grant delete on table "public"."custom_categories" to "authenticated";

grant insert on table "public"."custom_categories" to "authenticated";

grant references on table "public"."custom_categories" to "authenticated";

grant select on table "public"."custom_categories" to "authenticated";

grant trigger on table "public"."custom_categories" to "authenticated";

grant truncate on table "public"."custom_categories" to "authenticated";

grant update on table "public"."custom_categories" to "authenticated";

grant delete on table "public"."custom_categories" to "service_role";

grant insert on table "public"."custom_categories" to "service_role";

grant references on table "public"."custom_categories" to "service_role";

grant select on table "public"."custom_categories" to "service_role";

grant trigger on table "public"."custom_categories" to "service_role";

grant truncate on table "public"."custom_categories" to "service_role";

grant update on table "public"."custom_categories" to "service_role";

grant delete on table "public"."email_deliveries" to "anon";

grant insert on table "public"."email_deliveries" to "anon";

grant references on table "public"."email_deliveries" to "anon";

grant select on table "public"."email_deliveries" to "anon";

grant trigger on table "public"."email_deliveries" to "anon";

grant truncate on table "public"."email_deliveries" to "anon";

grant update on table "public"."email_deliveries" to "anon";

grant delete on table "public"."email_deliveries" to "authenticated";

grant insert on table "public"."email_deliveries" to "authenticated";

grant references on table "public"."email_deliveries" to "authenticated";

grant select on table "public"."email_deliveries" to "authenticated";

grant trigger on table "public"."email_deliveries" to "authenticated";

grant truncate on table "public"."email_deliveries" to "authenticated";

grant update on table "public"."email_deliveries" to "authenticated";

grant delete on table "public"."email_deliveries" to "service_role";

grant insert on table "public"."email_deliveries" to "service_role";

grant references on table "public"."email_deliveries" to "service_role";

grant select on table "public"."email_deliveries" to "service_role";

grant trigger on table "public"."email_deliveries" to "service_role";

grant truncate on table "public"."email_deliveries" to "service_role";

grant update on table "public"."email_deliveries" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."posts" to "anon";

grant insert on table "public"."posts" to "anon";

grant references on table "public"."posts" to "anon";

grant select on table "public"."posts" to "anon";

grant trigger on table "public"."posts" to "anon";

grant truncate on table "public"."posts" to "anon";

grant update on table "public"."posts" to "anon";

grant delete on table "public"."posts" to "authenticated";

grant insert on table "public"."posts" to "authenticated";

grant references on table "public"."posts" to "authenticated";

grant select on table "public"."posts" to "authenticated";

grant trigger on table "public"."posts" to "authenticated";

grant truncate on table "public"."posts" to "authenticated";

grant update on table "public"."posts" to "authenticated";

grant delete on table "public"."posts" to "service_role";

grant insert on table "public"."posts" to "service_role";

grant references on table "public"."posts" to "service_role";

grant select on table "public"."posts" to "service_role";

grant trigger on table "public"."posts" to "service_role";

grant truncate on table "public"."posts" to "service_role";

grant update on table "public"."posts" to "service_role";

grant delete on table "public"."team_invitations" to "anon";

grant insert on table "public"."team_invitations" to "anon";

grant references on table "public"."team_invitations" to "anon";

grant select on table "public"."team_invitations" to "anon";

grant trigger on table "public"."team_invitations" to "anon";

grant truncate on table "public"."team_invitations" to "anon";

grant update on table "public"."team_invitations" to "anon";

grant delete on table "public"."team_invitations" to "authenticated";

grant insert on table "public"."team_invitations" to "authenticated";

grant references on table "public"."team_invitations" to "authenticated";

grant select on table "public"."team_invitations" to "authenticated";

grant trigger on table "public"."team_invitations" to "authenticated";

grant truncate on table "public"."team_invitations" to "authenticated";

grant update on table "public"."team_invitations" to "authenticated";

grant delete on table "public"."team_invitations" to "service_role";

grant insert on table "public"."team_invitations" to "service_role";

grant references on table "public"."team_invitations" to "service_role";

grant select on table "public"."team_invitations" to "service_role";

grant trigger on table "public"."team_invitations" to "service_role";

grant truncate on table "public"."team_invitations" to "service_role";

grant update on table "public"."team_invitations" to "service_role";

grant delete on table "public"."team_members" to "anon";

grant insert on table "public"."team_members" to "anon";

grant references on table "public"."team_members" to "anon";

grant select on table "public"."team_members" to "anon";

grant trigger on table "public"."team_members" to "anon";

grant truncate on table "public"."team_members" to "anon";

grant update on table "public"."team_members" to "anon";

grant delete on table "public"."team_members" to "authenticated";

grant insert on table "public"."team_members" to "authenticated";

grant references on table "public"."team_members" to "authenticated";

grant select on table "public"."team_members" to "authenticated";

grant trigger on table "public"."team_members" to "authenticated";

grant truncate on table "public"."team_members" to "authenticated";

grant update on table "public"."team_members" to "authenticated";

grant delete on table "public"."team_members" to "service_role";

grant insert on table "public"."team_members" to "service_role";

grant references on table "public"."team_members" to "service_role";

grant select on table "public"."team_members" to "service_role";

grant trigger on table "public"."team_members" to "service_role";

grant truncate on table "public"."team_members" to "service_role";

grant update on table "public"."team_members" to "service_role";

grant delete on table "public"."teams" to "anon";

grant insert on table "public"."teams" to "anon";

grant references on table "public"."teams" to "anon";

grant select on table "public"."teams" to "anon";

grant trigger on table "public"."teams" to "anon";

grant truncate on table "public"."teams" to "anon";

grant update on table "public"."teams" to "anon";

grant delete on table "public"."teams" to "authenticated";

grant insert on table "public"."teams" to "authenticated";

grant references on table "public"."teams" to "authenticated";

grant select on table "public"."teams" to "authenticated";

grant trigger on table "public"."teams" to "authenticated";

grant truncate on table "public"."teams" to "authenticated";

grant update on table "public"."teams" to "authenticated";

grant delete on table "public"."teams" to "service_role";

grant insert on table "public"."teams" to "service_role";

grant references on table "public"."teams" to "service_role";

grant select on table "public"."teams" to "service_role";

grant trigger on table "public"."teams" to "service_role";

grant truncate on table "public"."teams" to "service_role";

grant update on table "public"."teams" to "service_role";

create policy "System can insert audit trail records"
on "public"."claim_audit_trail"
as permissive
for insert
to public
with check (true);


create policy "Team members can view claim audit trail"
on "public"."claim_audit_trail"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM claims c
  WHERE ((c.id = claim_audit_trail.claim_id) AND is_team_member(c.team_id, auth.uid(), 'viewer'::team_member_role)))));


create policy "Claimants can update own draft claims"
on "public"."claims"
as permissive
for update
to public
using (((claimant_id = auth.uid()) AND (status = 'draft'::claim_status)));


create policy "Team admins can review claims"
on "public"."claims"
as permissive
for update
to public
using (is_team_member(team_id, auth.uid(), 'admin'::team_member_role));


create policy "Team members can create claims"
on "public"."claims"
as permissive
for insert
to public
with check ((is_team_member(team_id, auth.uid(), 'member'::team_member_role) AND (claimant_id = auth.uid())));


create policy "Team members can view team claims"
on "public"."claims"
as permissive
for select
to public
using (is_team_member(team_id, auth.uid(), 'viewer'::team_member_role));


create policy "Team owners can delete claims"
on "public"."claims"
as permissive
for delete
to public
using (is_team_owner(team_id, auth.uid()));


create policy "Users can delete their own categories"
on "public"."custom_categories"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own categories"
on "public"."custom_categories"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own categories"
on "public"."custom_categories"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view their own categories"
on "public"."custom_categories"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "System can manage email deliveries"
on "public"."email_deliveries"
as permissive
for all
to public
using (true);


create policy "Team admins can view team email deliveries"
on "public"."email_deliveries"
as permissive
for select
to public
using (((team_id IS NULL) OR is_team_member(team_id, auth.uid(), 'admin'::team_member_role)));


create policy "System can create notifications"
on "public"."notifications"
as permissive
for insert
to public
with check (true);


create policy "Users can delete own notifications"
on "public"."notifications"
as permissive
for delete
to public
using ((recipient_id = auth.uid()));


create policy "Users can update own notifications"
on "public"."notifications"
as permissive
for update
to public
using ((recipient_id = auth.uid()));


create policy "Users can view own notifications"
on "public"."notifications"
as permissive
for select
to public
using ((recipient_id = auth.uid()));


create policy "Anyone can read published posts"
on "public"."posts"
as permissive
for select
to public
using ((status = 'published'::text));


create policy "Authenticated users can read published posts"
on "public"."posts"
as permissive
for select
to authenticated
using ((status = 'published'::text));


create policy "Authors can delete their own posts"
on "public"."posts"
as permissive
for delete
to authenticated
using ((auth.uid() = author_id));


create policy "Authors can insert their own posts"
on "public"."posts"
as permissive
for insert
to authenticated
with check ((auth.uid() = author_id));


create policy "Authors can read their own posts"
on "public"."posts"
as permissive
for select
to authenticated
using ((auth.uid() = author_id));


create policy "Authors can update their own posts"
on "public"."posts"
as permissive
for update
to authenticated
using ((auth.uid() = author_id));


create policy "Users can delete their own receipts or team receipts"
on "public"."receipts"
as permissive
for delete
to public
using (((auth.uid() = user_id) OR ((team_id IS NOT NULL) AND is_team_member(team_id, auth.uid(), 'admin'::team_member_role))));


create policy "Users can insert their own receipts or team receipts"
on "public"."receipts"
as permissive
for insert
to public
with check (((auth.uid() = user_id) AND ((team_id IS NULL) OR is_team_member(team_id, auth.uid(), 'member'::team_member_role))));


create policy "Users can update their own receipts or team receipts"
on "public"."receipts"
as permissive
for update
to public
using (((auth.uid() = user_id) OR ((team_id IS NOT NULL) AND is_team_member(team_id, auth.uid(), 'member'::team_member_role))));


create policy "Users can view their own receipts or team receipts"
on "public"."receipts"
as permissive
for select
to public
using (((auth.uid() = user_id) OR ((team_id IS NOT NULL) AND is_team_member(team_id, auth.uid(), 'viewer'::team_member_role))));


create policy "Team admins can create invitations"
on "public"."team_invitations"
as permissive
for insert
to public
with check ((is_team_member(team_id, auth.uid(), 'admin'::team_member_role) AND (invited_by = auth.uid())));


create policy "Team admins can delete invitations"
on "public"."team_invitations"
as permissive
for delete
to public
using (is_team_member(team_id, auth.uid(), 'admin'::team_member_role));


create policy "Team admins can update invitations"
on "public"."team_invitations"
as permissive
for update
to public
using (is_team_member(team_id, auth.uid(), 'admin'::team_member_role));


create policy "Team admins can view team invitations"
on "public"."team_invitations"
as permissive
for select
to public
using (is_team_member(team_id, auth.uid(), 'admin'::team_member_role));


create policy "Team admins can add members"
on "public"."team_members"
as permissive
for insert
to public
with check (is_team_member(team_id, auth.uid(), 'admin'::team_member_role));


create policy "Team admins can remove members or users can remove themselves"
on "public"."team_members"
as permissive
for delete
to public
using ((is_team_member(team_id, auth.uid(), 'admin'::team_member_role) OR (user_id = auth.uid())));


create policy "Team admins can update member roles"
on "public"."team_members"
as permissive
for update
to public
using ((is_team_member(team_id, auth.uid(), 'admin'::team_member_role) AND (role <> 'owner'::team_member_role)));


create policy "Users can view team members of their teams"
on "public"."team_members"
as permissive
for select
to public
using (is_team_member(team_id, auth.uid(), 'viewer'::team_member_role));


create policy "Team owners can delete teams"
on "public"."teams"
as permissive
for delete
to public
using (is_team_owner(id, auth.uid()));


create policy "Team owners can update teams"
on "public"."teams"
as permissive
for update
to public
using (is_team_owner(id, auth.uid()));


create policy "Users can create teams"
on "public"."teams"
as permissive
for insert
to public
with check ((auth.uid() = owner_id));


create policy "Users can view teams they belong to"
on "public"."teams"
as permissive
for select
to public
using (((auth.uid() = owner_id) OR is_team_member(id, auth.uid(), 'viewer'::team_member_role)));


CREATE TRIGGER update_custom_categories_updated_at BEFORE UPDATE ON public.custom_categories FOR EACH ROW EXECUTE FUNCTION update_custom_categories_updated_at();

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION handle_posts_updated_at();

CREATE TRIGGER team_invitation_email_trigger AFTER INSERT ON public.team_invitations FOR EACH ROW EXECUTE FUNCTION send_team_invitation_email_trigger();

CREATE TRIGGER update_team_invitations_updated_at BEFORE UPDATE ON public.team_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


