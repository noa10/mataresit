-- Fix: Add missing api_scope enum values
-- The original external_api_infrastructure migration (20250626000000) was missing
-- three scope values that the frontend and Edge Function code use:
--   profile:read, categories:read, gamification:read
-- This caused a PostgreSQL 22P02 error ('invalid input value for enum api_scope')
-- when users created API keys with the default 'Read' access level.

ALTER TYPE public.api_scope ADD VALUE 'profile:read';
ALTER TYPE public.api_scope ADD VALUE 'categories:read';
ALTER TYPE public.api_scope ADD VALUE 'gamification:read';
