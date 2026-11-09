import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getServiceRoleKey } from '../_shared/service-role.ts';
import {
  callerOwnsEmail,
  isPrivileged,
  isTeamAdmin,
  normalizeEmail,
  resolveCaller,
  type Caller,
} from '../_shared/function-auth.ts';
import {
  generateReceiptProcessingEmail,
  generateBatchProcessingEmail,
  generateTeamCollaborationEmail,
  generateTeamMemberRemovedEmail,
  generateBillingReminderEmail,
  generatePaymentFailedEmail,
  generateSubscriptionExpiryEmail,
  generatePaymentConfirmationEmail,
  ReceiptProcessingEmailData,
  BatchProcessingEmailData,
  TeamCollaborationEmailData,
  TeamMemberRemovedEmailData,
  BillingReminderEmailData,
  PaymentFailedEmailData,
  SubscriptionExpiryEmailData,
  PaymentConfirmationEmailData
} from './templates.ts';

// Initialize Supabase client for database operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  getServiceRoleKey() ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailAuthorization {
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
 */
async function authorizeUserEmail(
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body once and extract all needed fields
    const requestBody = await req.json();
    const {
      to,
      subject,
      html,
      text,
      template_name,
      template_data,
      related_entity_type,
      related_entity_id,
      team_id,
      metadata,
      preview_mode = false
    } = requestBody;

    const caller = await resolveCaller(req, supabaseClient);
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!isPrivileged(caller)) {
      const authorization = await authorizeUserEmail(caller, requestBody, supabaseClient);
      if (!authorization.allowed) {
        console.warn('Rejected send-email request:', {
          callerRole: caller.role,
          reason: authorization.reason
        });
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (typeof to !== 'string' || !to.trim() || /[\r\n]/.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid recipient' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate email content from template if template_name and template_data are provided
    let emailSubject = subject;
    let emailHtml = html;
    let emailText = text;

    if (template_name && template_data) {
      try {
        let generatedEmail;

        switch (template_name) {
          case 'receipt_processing':
            generatedEmail = generateReceiptProcessingEmail(template_data as ReceiptProcessingEmailData);
            break;
          case 'batch_processing':
            generatedEmail = generateBatchProcessingEmail(template_data as BatchProcessingEmailData);
            break;
          case 'team_collaboration':
            generatedEmail = generateTeamCollaborationEmail(template_data as TeamCollaborationEmailData);
            break;
          case 'team_member_removed':
            generatedEmail = generateTeamMemberRemovedEmail(template_data as TeamMemberRemovedEmailData);
            break;
          case 'billing_reminder':
            generatedEmail = generateBillingReminderEmail(template_data as BillingReminderEmailData);
            break;
          case 'payment_failed':
            generatedEmail = generatePaymentFailedEmail(template_data as PaymentFailedEmailData);
            break;
          case 'subscription_expiry':
            generatedEmail = generateSubscriptionExpiryEmail(template_data as SubscriptionExpiryEmailData);
            break;
          case 'payment_confirmation':
            generatedEmail = generatePaymentConfirmationEmail(template_data as PaymentConfirmationEmailData);
            break;
          default:
            console.warn(`Unknown template: ${template_name}`);
            break;
        }

        if (generatedEmail) {
          emailSubject = generatedEmail.subject;
          emailHtml = generatedEmail.html;
          emailText = generatedEmail.text;
        }
      } catch (error) {
        console.error('Error generating email from template:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate email from template' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Handle preview mode
    if (preview_mode) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: {
            to,
            subject: emailSubject,
            html: emailHtml,
            text: emailText,
            template_name,
            template_data
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // A dry run measures the request path without creating a delivery record
    // or calling the email provider. Callers opt in with metadata.dry_run.
    if (metadata?.dry_run === true) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Dry run: email not sent',
          data: {
            id: `dry_run_${Date.now()}`,
            to: [to],
            subject: emailSubject
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!to || !emailSubject || (!emailHtml && !emailText)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, and html or text' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Processing email request:', {
      to,
      subject: emailSubject,
      template_name,
      html_length: emailHtml?.length || 0,
      text_length: emailText?.length || 0,
      using_template: !!template_name
    });

    // Enhanced implementation with Resend and delivery tracking
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || '';

    console.log('Environment check:', {
      hasResendKey: !!RESEND_API_KEY,
      fromEmail: FROM_EMAIL
    });

    let result;
    let deliveryId;

    // Create email delivery record
    const { data: deliveryData, error: deliveryError } = await supabaseClient.rpc('create_email_delivery', {
      _recipient_email: to,
      _subject: emailSubject,
      _template_name: template_name || null,
      _related_entity_type: related_entity_type || null,
      _related_entity_id: related_entity_id || null,
      _team_id: team_id || null,
      _metadata: {
        ...metadata,
        template_data: template_data || null,
        generated_from_template: !!template_name
      }
    });

    if (deliveryError) {
      console.error('Error creating email delivery record:', deliveryError);
    } else {
      deliveryId = deliveryData;
    }

    if (RESEND_API_KEY) {
      try {
        if (!FROM_EMAIL) {
          throw new Error('FROM_EMAIL is not configured');
        }

        console.log('Sending email via Resend API...');

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [to],
            subject: emailSubject,
            html: emailHtml,
            text: emailText,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Resend API error response:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Resend API error (${response.status}): ${errorText}`);
        }

        result = await response.json();
        console.log('Email sent successfully via Resend:', {
          id: result.id,
          to: result.to,
          subject: result.subject
        });

        // Update delivery status to sent
        if (deliveryId) {
          await supabaseClient.rpc('update_email_delivery_status', {
            _delivery_id: deliveryId,
            _status: 'sent',
            _provider_message_id: result.id
          });
        }

      } catch (error) {
        console.error('Error sending email via Resend:', error);

        // Update delivery status to failed
        if (deliveryId) {
          await supabaseClient.rpc('update_email_delivery_status', {
            _delivery_id: deliveryId,
            _status: 'failed',
            _error_message: error.message
          });
        }

        // Return error response instead of throwing
        return new Response(
          JSON.stringify({
            error: 'Failed to send email via Resend',
            details: error.message,
            timestamp: new Date().toISOString()
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      console.log('RESEND_API_KEY not configured, using mock response');
      // Mock successful response for development
      result = {
        id: `mock_${Date.now()}`,
        to: [to],
        subject: emailSubject,
        status: 'sent',
        created_at: new Date().toISOString(),
      };

      // Update delivery status to sent (mock)
      if (deliveryId) {
        await supabaseClient.rpc('update_email_delivery_status', {
          _delivery_id: deliveryId,
          _status: 'sent',
          _provider_message_id: result.id
        });
      }
    }



    // Determine success message based on whether real email was sent
    const successMessage = RESEND_API_KEY
      ? 'Email sent successfully via Resend'
      : 'Email sent successfully (mocked)';

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage,
        data: result,
        delivery_id: deliveryId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
