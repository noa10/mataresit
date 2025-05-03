
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
