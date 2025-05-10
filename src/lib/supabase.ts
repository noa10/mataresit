
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Define custom types for our RPC functions that aren't automatically generated
type RPCFunctions = {
  has_role: (args: { _user_id?: string; _role: 'admin' | 'user' }) => boolean;
  get_admin_users: () => {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    confirmed_at: string | null;
    last_sign_in_at: string | null;
    created_at: string;
    roles: ('admin' | 'user')[];
  }[];
  set_user_role: (args: { _user_id: string; _role: 'admin' | 'user' }) => boolean;
}

// Create a custom Supabase client type with our RPC functions
type SupabaseClientWithRPC = ReturnType<typeof createClient<Database>> & {
  rpc<T extends keyof RPCFunctions>(
    fn: T,
    args?: Parameters<RPCFunctions[T]>[0],
    options?: {
      head?: boolean;
      count?: null | 'exact' | 'planned' | 'estimated';
    }
  ): Promise<{
    data: ReturnType<RPCFunctions[T]>;
    error: null | {
      message: string;
    };
  }>;
}

// Create and export the Supabase client with our custom type
export const supabase = createClient(supabaseUrl, supabaseAnonKey) as SupabaseClientWithRPC; 
