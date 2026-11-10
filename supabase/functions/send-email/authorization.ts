import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  callerOwnsEmail,
  isTeamAdmin,
  normalizeEmail,
  type Caller,
} from '../_shared/function-auth.ts';

export interface EmailAuthorization {
  allowed: boolean;
  reason?: string;
}

async function lookupTeamId(
  admin: SupabaseClient,
  table: 'alerts' | 'notification_channels',
  id: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from(table)
    .select('team_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return typeof data.team_id === 'string' ? data.team_id : null;
}

/**
 * A removal notice is only legitimate immediately after that admin removed
 * that user from that team. The audit trigger writes the row on DELETE, so the
 * recipient is already gone from team_members by the time this email is sent.
 */
async function hasRecentTeamRemoval(
  admin: SupabaseClient,
  teamId: string,
  actorId: string | undefined,
  recipient: string,
): Promise<boolean> {
  if (!actorId) return false;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let query = admin
    .from('team_audit_logs')
    .select('id')
    .eq('team_id', teamId)
    .eq('action', 'member_removed')
    .eq('performed_by', actorId)
    .gte('created_at', since)
    .limit(1);

  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('email', recipient)
    .maybeSingle();

  if (target?.id) {
    query = query.eq('target_user_id', target.id);
  } else {
    query = query.eq('target_user_email', recipient);
  }

  const { data, error } = await query;
  return !error && Array.isArray(data) && data.length > 0;
}

/**
 * A non-privileged caller may email themselves, or a recipient outside their
 * own mailbox only when the message is scoped to a team they administer.
 * Everything else (billing templates, arbitrary subject/html, other users'
 * receipt notifications) is reserved for service-role and global-admin callers.
 *
 * Self-ownership comes from the confirmed auth identity only. `profiles.email`
 * is user-writable, so trusting it would let any authenticated user relay mail
 * to an arbitrary address from the platform's verified sender.
 */
export async function authorizeUserEmail(
  caller: Caller,
  body: Record<string, any>,
  admin: SupabaseClient,
): Promise<EmailAuthorization> {
  const recipient = normalizeEmail(body.to);
  if (!recipient) return { allowed: false, reason: 'invalid_recipient' };
  if (callerOwnsEmail(caller, recipient)) return { allowed: true };

  // Preview and dry-run requests never send; they only echo content the
  // caller supplied, so any authenticated user may invoke them.
  if (body.preview_mode === true || body.metadata?.dry_run === true) {
    return { allowed: true };
  }

  const template = typeof body.template_name === 'string' ? body.template_name : null;
  const relatedType = typeof body.related_entity_type === 'string'
    ? body.related_entity_type
    : null;
  const relatedId = typeof body.related_entity_id === 'string'
    ? body.related_entity_id
    : null;

  if (template === 'team_member_removed' && relatedType === 'team' && relatedId) {
    if (!(await isTeamAdmin(admin, caller.userId, relatedId))) {
      return { allowed: false, reason: 'not_team_admin' };
    }
    return (await hasRecentTeamRemoval(admin, relatedId, caller.userId, recipient))
      ? { allowed: true }
      : { allowed: false, reason: 'no_matching_removal' };
  }

  if (template === 'alert_notification' && relatedType === 'alert' && relatedId) {
    const teamId = await lookupTeamId(admin, 'alerts', relatedId);
    return (await isTeamAdmin(admin, caller.userId, teamId))
      ? { allowed: true }
      : { allowed: false, reason: 'not_team_admin' };
  }

  if (template === 'test_notification') {
    const channelId = body.metadata && typeof body.metadata.channel_id === 'string'
      ? body.metadata.channel_id
      : null;
    if (!channelId) return { allowed: false, reason: 'missing_channel' };

    const teamId = await lookupTeamId(admin, 'notification_channels', channelId);
    return (await isTeamAdmin(admin, caller.userId, teamId))
      ? { allowed: true }
      : { allowed: false, reason: 'not_team_admin' };
  }

  return { allowed: false, reason: 'template_not_user_callable' };
}
