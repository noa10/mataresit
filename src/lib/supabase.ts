// Re-export the Supabase client from the integrations path
export { supabase } from "@/integrations/supabase/client";

// Add a warning comment to help future developers
// WARNING: Do not create a new Supabase client instance here!
// The application MUST use only ONE Supabase client instance across all components
// to ensure authentication state is properly maintained.
