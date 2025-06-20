-- Diagnose Existing Functions
-- This script will show us exactly what unified_search functions exist

-- Check all unified_search functions with their exact signatures
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as full_definition,
    p.oid as function_oid
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
AND p.proname = 'unified_search'
ORDER BY p.oid;

-- Also check for any functions that might be similar
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.oid as function_oid
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
AND (p.proname LIKE '%search%' OR p.proname LIKE '%embedding%')
ORDER BY p.proname, p.oid;
