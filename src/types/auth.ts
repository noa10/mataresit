import { User, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'user';

export interface UserWithRole extends User {
  roles?: AppRole[];
}

export interface AuthState {
  user: UserWithRole | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  confirmed_at?: string;
  last_sign_in_at?: string;
  created_at: string;
  roles: AppRole[];
}
