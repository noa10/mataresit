-- Fix HTTP extension
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public" VERSION '1.6';

-- Create HTTP method type if it doesn't exist
DROP TYPE IF EXISTS public.http_method CASCADE;
CREATE TYPE public.http_method AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS');

-- Create HTTP request type if it doesn't exist
DROP TYPE IF EXISTS public.http_request CASCADE;
CREATE TYPE public.http_request AS (
    method text,
    uri character varying,
    headers public.http_header[],
    content_type character varying,
    content character varying
);

-- Create HTTP response type if it doesn't exist
DROP TYPE IF EXISTS public.http_response CASCADE;
CREATE TYPE public.http_response AS (
    status integer,
    content_type character varying,
    headers public.http_header[],
    content character varying
);
