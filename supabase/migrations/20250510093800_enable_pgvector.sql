-- Enable the pgvector extension
create extension if not exists vector with schema public;

-- Create table for storing embeddings
create table if not exists public.receipt_embeddings (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  content_type text not null, -- 'full_text', 'merchant', 'items', etc.
  embedding vector(1536), -- Standard Gemini embedding dimension
  metadata jsonb,
  created_at timestamp with time zone default now(),
  
  constraint fk_receipt
    foreign key (receipt_id)
    references receipts(id)
    on delete cascade
);

-- Create indexes for vector similarity search
create index on receipt_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Create a function to search for similar receipts based on vector similarity
create or replace function search_receipts(
  query_embedding vector(1536),
  similarity_threshold float default 0.5,
  match_count int default 10,
  content_type text default 'full_text'
) returns table (
  id uuid,
  receipt_id uuid,
  similarity float
)
language plpgsql
as $$
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

-- Create a helper function to check pgvector status
create or replace function check_pgvector_status()
returns json
language plpgsql
security definer
as $$
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

-- Create a hybrid search function (combines full-text and vector search)
create or replace function hybrid_search_receipts(
  search_text text,
  query_embedding vector(1536),
  content_type text default 'full_text',
  similarity_weight float default 0.7,
  text_weight float default 0.3,
  match_count int default 10
)
returns table (
  receipt_id uuid,
  score float
)
language plpgsql
as $$
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
