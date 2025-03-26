
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export const supabaseClient = (authHeader: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
};
