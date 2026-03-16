-- Add OpenClaw v1 read scopes to external API key enum

ALTER TYPE public.api_scope ADD VALUE IF NOT EXISTS 'profile:read';
ALTER TYPE public.api_scope ADD VALUE IF NOT EXISTS 'categories:read';
ALTER TYPE public.api_scope ADD VALUE IF NOT EXISTS 'gamification:read';