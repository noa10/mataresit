
import { User, Session } from '@supabase/supabase-js';
import type { SubscriptionTier, SubscriptionStatus } from '@/config/stripe';

export type AppRole = 'admin' | 'user';

export interface UserWithRole extends User {
  roles?: AppRole[];
  subscription_tier?: SubscriptionTier;
  subscription_status?: SubscriptionStatus;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  receipts_used_this_month?: number;
  avatar_url?: string | null;
  google_avatar_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface AuthState {
  user: UserWithRole | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
}
