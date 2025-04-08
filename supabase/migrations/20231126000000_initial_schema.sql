create sequence "public"."corrections_id_seq";

create table "public"."confidence_scores" (
    "id" uuid not null default gen_random_uuid(),
    "receipt_id" uuid not null,
    "merchant" integer,
    "date" integer,
    "total" integer,
    "tax" integer,
    "line_items" integer,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "payment_method" double precision
);


alter table "public"."confidence_scores" enable row level security;

create table "public"."corrections" (
    "id" integer not null default nextval('corrections_id_seq'::regclass),
    "receipt_id" uuid,
    "field_name" text not null,
    "original_value" text,
    "ai_suggestion" text,
    "corrected_value" text not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."corrections" enable row level security;

create table "public"."line_items" (
    "id" uuid not null default gen_random_uuid(),
    "receipt_id" uuid not null,
    "description" text not null,
    "amount" numeric(10,2) not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."line_items" enable row level security;

create table "public"."processing_logs" (
    "id" uuid not null default gen_random_uuid(),
    "receipt_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "status_message" text not null,
    "step_name" text
);


alter table "public"."processing_logs" enable row level security;

create table "public"."profiles" (
    "id" uuid not null,
    "first_name" text,
    "last_name" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."profiles" enable row level security;

create table "public"."receipts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "merchant" character varying(255) not null,
    "date" date not null,
    "total" numeric(10,2) not null,
    "tax" numeric(10,2),
    "currency" character varying(5) default 'USD'::character varying,
    "payment_method" character varying(100),
    "status" character varying(50) default 'unreviewed'::character varying,
    "image_url" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "fullText" text,
    "ai_suggestions" jsonb,
    "predicted_category" text
);


alter table "public"."receipts" enable row level security;

alter sequence "public"."corrections_id_seq" owned by "public"."corrections"."id";

CREATE UNIQUE INDEX confidence_scores_pkey ON public.confidence_scores USING btree (id);

CREATE UNIQUE INDEX corrections_pkey ON public.corrections USING btree (id);

CREATE INDEX idx_corrections_receipt_id ON public.corrections USING btree (receipt_id);

CREATE UNIQUE INDEX line_items_pkey ON public.line_items USING btree (id);

CREATE UNIQUE INDEX processing_logs_pkey ON public.processing_logs USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX receipts_pkey ON public.receipts USING btree (id);

alter table "public"."confidence_scores" add constraint "confidence_scores_pkey" PRIMARY KEY using index "confidence_scores_pkey";

alter table "public"."corrections" add constraint "corrections_pkey" PRIMARY KEY using index "corrections_pkey";

alter table "public"."line_items" add constraint "line_items_pkey" PRIMARY KEY using index "line_items_pkey";

alter table "public"."processing_logs" add constraint "processing_logs_pkey" PRIMARY KEY using index "processing_logs_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."receipts" add constraint "receipts_pkey" PRIMARY KEY using index "receipts_pkey";

alter table "public"."confidence_scores" add constraint "confidence_scores_receipt_id_fkey" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE not valid;

alter table "public"."confidence_scores" validate constraint "confidence_scores_receipt_id_fkey";

alter table "public"."corrections" add constraint "corrections_receipt_id_fkey" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE not valid;

alter table "public"."corrections" validate constraint "corrections_receipt_id_fkey";

alter table "public"."line_items" add constraint "line_items_receipt_id_fkey" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE not valid;

alter table "public"."line_items" validate constraint "line_items_receipt_id_fkey";

alter table "public"."processing_logs" add constraint "fk_receipt" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE not valid;

alter table "public"."processing_logs" validate constraint "fk_receipt";

alter table "public"."processing_logs" add constraint "processing_logs_receipt_id_fkey" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE not valid;

alter table "public"."processing_logs" validate constraint "processing_logs_receipt_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."receipts" add constraint "receipts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."receipts" validate constraint "receipts_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (new.id, '', '');
  RETURN new;
END;
$function$
;

grant delete on table "public"."confidence_scores" to "anon";

grant insert on table "public"."confidence_scores" to "anon";

grant references on table "public"."confidence_scores" to "anon";

grant select on table "public"."confidence_scores" to "anon";

grant trigger on table "public"."confidence_scores" to "anon";

grant truncate on table "public"."confidence_scores" to "anon";

grant update on table "public"."confidence_scores" to "anon";

grant delete on table "public"."confidence_scores" to "authenticated";

grant insert on table "public"."confidence_scores" to "authenticated";

grant references on table "public"."confidence_scores" to "authenticated";

grant select on table "public"."confidence_scores" to "authenticated";

grant trigger on table "public"."confidence_scores" to "authenticated";

grant truncate on table "public"."confidence_scores" to "authenticated";

grant update on table "public"."confidence_scores" to "authenticated";

grant delete on table "public"."confidence_scores" to "service_role";

grant insert on table "public"."confidence_scores" to "service_role";

grant references on table "public"."confidence_scores" to "service_role";

grant select on table "public"."confidence_scores" to "service_role";

grant trigger on table "public"."confidence_scores" to "service_role";

grant truncate on table "public"."confidence_scores" to "service_role";

grant update on table "public"."confidence_scores" to "service_role";

grant delete on table "public"."corrections" to "anon";

grant insert on table "public"."corrections" to "anon";

grant references on table "public"."corrections" to "anon";

grant select on table "public"."corrections" to "anon";

grant trigger on table "public"."corrections" to "anon";

grant truncate on table "public"."corrections" to "anon";

grant update on table "public"."corrections" to "anon";

grant delete on table "public"."corrections" to "authenticated";

grant insert on table "public"."corrections" to "authenticated";

grant references on table "public"."corrections" to "authenticated";

grant select on table "public"."corrections" to "authenticated";

grant trigger on table "public"."corrections" to "authenticated";

grant truncate on table "public"."corrections" to "authenticated";

grant update on table "public"."corrections" to "authenticated";

grant delete on table "public"."corrections" to "service_role";

grant insert on table "public"."corrections" to "service_role";

grant references on table "public"."corrections" to "service_role";

grant select on table "public"."corrections" to "service_role";

grant trigger on table "public"."corrections" to "service_role";

grant truncate on table "public"."corrections" to "service_role";

grant update on table "public"."corrections" to "service_role";

grant delete on table "public"."line_items" to "anon";

grant insert on table "public"."line_items" to "anon";

grant references on table "public"."line_items" to "anon";

grant select on table "public"."line_items" to "anon";

grant trigger on table "public"."line_items" to "anon";

grant truncate on table "public"."line_items" to "anon";

grant update on table "public"."line_items" to "anon";

grant delete on table "public"."line_items" to "authenticated";

grant insert on table "public"."line_items" to "authenticated";

grant references on table "public"."line_items" to "authenticated";

grant select on table "public"."line_items" to "authenticated";

grant trigger on table "public"."line_items" to "authenticated";

grant truncate on table "public"."line_items" to "authenticated";

grant update on table "public"."line_items" to "authenticated";

grant delete on table "public"."line_items" to "service_role";

grant insert on table "public"."line_items" to "service_role";

grant references on table "public"."line_items" to "service_role";

grant select on table "public"."line_items" to "service_role";

grant trigger on table "public"."line_items" to "service_role";

grant truncate on table "public"."line_items" to "service_role";

grant update on table "public"."line_items" to "service_role";

grant delete on table "public"."processing_logs" to "anon";

grant insert on table "public"."processing_logs" to "anon";

grant references on table "public"."processing_logs" to "anon";

grant select on table "public"."processing_logs" to "anon";

grant trigger on table "public"."processing_logs" to "anon";

grant truncate on table "public"."processing_logs" to "anon";

grant update on table "public"."processing_logs" to "anon";

grant delete on table "public"."processing_logs" to "authenticated";

grant insert on table "public"."processing_logs" to "authenticated";

grant references on table "public"."processing_logs" to "authenticated";

grant select on table "public"."processing_logs" to "authenticated";

grant trigger on table "public"."processing_logs" to "authenticated";

grant truncate on table "public"."processing_logs" to "authenticated";

grant update on table "public"."processing_logs" to "authenticated";

grant delete on table "public"."processing_logs" to "service_role";

grant insert on table "public"."processing_logs" to "service_role";

grant references on table "public"."processing_logs" to "service_role";

grant select on table "public"."processing_logs" to "service_role";

grant trigger on table "public"."processing_logs" to "service_role";

grant truncate on table "public"."processing_logs" to "service_role";

grant update on table "public"."processing_logs" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."receipts" to "anon";

grant insert on table "public"."receipts" to "anon";

grant references on table "public"."receipts" to "anon";

grant select on table "public"."receipts" to "anon";

grant trigger on table "public"."receipts" to "anon";

grant truncate on table "public"."receipts" to "anon";

grant update on table "public"."receipts" to "anon";

grant delete on table "public"."receipts" to "authenticated";

grant insert on table "public"."receipts" to "authenticated";

grant references on table "public"."receipts" to "authenticated";

grant select on table "public"."receipts" to "authenticated";

grant trigger on table "public"."receipts" to "authenticated";

grant truncate on table "public"."receipts" to "authenticated";

grant update on table "public"."receipts" to "authenticated";

grant delete on table "public"."receipts" to "service_role";

grant insert on table "public"."receipts" to "service_role";

grant references on table "public"."receipts" to "service_role";

grant select on table "public"."receipts" to "service_role";

grant trigger on table "public"."receipts" to "service_role";

grant truncate on table "public"."receipts" to "service_role";

grant update on table "public"."receipts" to "service_role";

create policy "Users can delete their own confidence scores"
on "public"."confidence_scores"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM receipts
  WHERE ((receipts.id = confidence_scores.receipt_id) AND (receipts.user_id = auth.uid())))));


create policy "Users can insert their own confidence scores"
on "public"."confidence_scores"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM receipts
  WHERE ((receipts.id = confidence_scores.receipt_id) AND (receipts.user_id = auth.uid())))));


create policy "Users can update their own confidence scores"
on "public"."confidence_scores"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM receipts
  WHERE ((receipts.id = confidence_scores.receipt_id) AND (receipts.user_id = auth.uid())))));


create policy "Users can view their own confidence scores"
on "public"."confidence_scores"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM receipts
  WHERE ((receipts.id = confidence_scores.receipt_id) AND (receipts.user_id = auth.uid())))));


create policy "Users can delete their own line items"
on "public"."line_items"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM receipts
  WHERE ((receipts.id = line_items.receipt_id) AND (receipts.user_id = auth.uid())))));


create policy "Users can insert their own line items"
on "public"."line_items"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM receipts
  WHERE ((receipts.id = line_items.receipt_id) AND (receipts.user_id = auth.uid())))));


create policy "Users can update their own line items"
on "public"."line_items"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM receipts
  WHERE ((receipts.id = line_items.receipt_id) AND (receipts.user_id = auth.uid())))));


create policy "Users can view their own line items"
on "public"."line_items"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM receipts
  WHERE ((receipts.id = line_items.receipt_id) AND (receipts.user_id = auth.uid())))));


create policy "Service role can insert logs"
on "public"."processing_logs"
as permissive
for insert
to authenticated
with check (true);


create policy "Users can view their own receipt logs"
on "public"."processing_logs"
as permissive
for select
to public
using ((auth.uid() IN ( SELECT receipts.user_id
   FROM receipts
  WHERE (receipts.id = processing_logs.receipt_id))));


create policy "Users can update their own profile"
on "public"."profiles"
as permissive
for update
to public
using ((auth.uid() = id));


create policy "Users can view their own profile"
on "public"."profiles"
as permissive
for select
to public
using ((auth.uid() = id));


create policy "Users can delete their own receipts"
on "public"."receipts"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own receipts"
on "public"."receipts"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own receipts"
on "public"."receipts"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view their own receipts"
on "public"."receipts"
as permissive
for select
to public
using ((auth.uid() = user_id));



