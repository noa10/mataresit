import type { ApiContext } from './api-auth.ts';
import { hasScope } from './api-auth.ts';

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  google_avatar_url: string | null;
  preferred_currency: string | null;
  preferred_language: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  receipts_used_this_month: number | null;
  monthly_reset_date: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  trial_end_date: string | null;
}

interface SubscriptionLimitsRow {
  monthly_receipts: number;
  storage_limit_mb: number;
  retention_days: number;
  batch_upload_limit: number;
  api_access_enabled: boolean | null;
  max_users: number | null;
  support_level: string | null;
}

interface TeamMembershipRow {
  id: string;
  role: string;
  joined_at: string;
  teams: {
    id: string;
    name: string;
    description: string | null;
    status: string | null;
  } | null;
}

export async function handleMeAPI(
  req: Request,
  pathSegments: string[],
  context: ApiContext,
): Promise<Response> {
  if (pathSegments.length > 1) {
    return createErrorResponse('Profile resource not found', 404);
  }

  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  if (!hasScope(context, 'profile:read')) {
    return createErrorResponse('Insufficient permissions for profile:read', 403);
  }

  try {
    const [{ data: profile, error: profileError }, { data: memberships, error: membershipsError }] = await Promise.all([
      context.supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          avatar_url,
          google_avatar_url,
          preferred_currency,
          preferred_language,
          subscription_tier,
          subscription_status,
          receipts_used_this_month,
          monthly_reset_date,
          subscription_start_date,
          subscription_end_date,
          trial_end_date
        `)
        .eq('id', context.userId)
        .maybeSingle(),
      context.supabase
        .from('team_members')
        .select(`
          id,
          role,
          joined_at,
          teams:team_id (
            id,
            name,
            description,
            status
          )
        `)
        .eq('user_id', context.userId),
    ]);

    if (profileError) {
      console.error('Error fetching profile for /me:', profileError);
      return createErrorResponse('Failed to retrieve profile', 500);
    }

    if (membershipsError) {
      console.error('Error fetching team memberships for /me:', membershipsError);
      return createErrorResponse('Failed to retrieve team memberships', 500);
    }

    if (!profile) {
      return createErrorResponse('Profile not found', 404);
    }

    const subscriptionTier = profile.subscription_tier ?? 'free';
    const { data: subscriptionLimits, error: limitsError } = await context.supabase
      .from('subscription_limits')
      .select(`
        monthly_receipts,
        storage_limit_mb,
        retention_days,
        batch_upload_limit,
        api_access_enabled,
        max_users,
        support_level
      `)
      .eq('tier', subscriptionTier)
      .maybeSingle();

    if (limitsError) {
      console.error('Error fetching subscription limits for /me:', limitsError);
    }

    return createSuccessResponse({
      user: formatUser(profile),
      subscription: formatSubscription(profile, subscriptionLimits ?? null),
      teams: formatTeamMemberships(memberships ?? []),
    });
  } catch (error) {
    console.error('Unexpected error in GET /me:', error);
    return createErrorResponse('Failed to retrieve profile', 500);
  }
}

function formatUser(profile: ProfileRow) {
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || profile.email || null;

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    displayName,
    avatarUrl: profile.avatar_url ?? profile.google_avatar_url,
    preferredCurrency: profile.preferred_currency ?? 'MYR',
    preferredLanguage: profile.preferred_language ?? 'en',
  };
}

function formatSubscription(profile: ProfileRow, limits: SubscriptionLimitsRow | null) {
  return {
    tier: profile.subscription_tier ?? 'free',
    status: profile.subscription_status ?? 'active',
    receiptsUsedThisMonth: profile.receipts_used_this_month ?? 0,
    monthlyResetDate: profile.monthly_reset_date,
    subscriptionStartDate: profile.subscription_start_date,
    subscriptionEndDate: profile.subscription_end_date,
    trialEndDate: profile.trial_end_date,
    limits: limits
      ? {
          monthlyReceipts: limits.monthly_receipts,
          storageLimitMb: limits.storage_limit_mb,
          retentionDays: limits.retention_days,
          batchUploadLimit: limits.batch_upload_limit,
          apiAccessEnabled: limits.api_access_enabled,
          maxUsers: limits.max_users,
          supportLevel: limits.support_level,
        }
      : null,
  };
}

function formatTeamMemberships(memberships: TeamMembershipRow[]) {
  return memberships
    .flatMap((membership) => {
      if (!membership.teams) {
        return [];
      }

      return [{
        id: membership.id,
        role: membership.role,
        joinedAt: membership.joined_at,
        team: {
          id: membership.teams.id,
          name: membership.teams.name,
          description: membership.teams.description,
          status: membership.teams.status,
        },
      }];
    });
}

function createSuccessResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

function createErrorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      error: true,
      message,
      code: status,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}