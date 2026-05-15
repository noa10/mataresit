import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateTeamInvitationEmail } from '../send-email/templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { invitation_id } = await req.json();

    if (!invitation_id) {
      return new Response(
        JSON.stringify({ error: 'Missing invitation_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: invitation, error: invitationError } = await supabaseClient
      .from('team_invitations')
      .select(`*, teams!team_id(name)`)
      .eq('id', invitation_id)
      .single();

    if (invitationError || !invitation) {
      console.error('Error fetching invitation:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Invitation not found', details: invitationError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inviterProfile } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, email, preferred_language')
      .eq('id', invitation.invited_by)
      .single();

    const inviterName = inviterProfile?.first_name
      ? `${inviterProfile.first_name} ${inviterProfile.last_name || ''}`.trim()
      : inviterProfile?.email || 'Someone';

    const siteUrl = Deno.env.get('SITE_URL') || 'https://mataresit.co';
    const acceptUrl = `${siteUrl}/invite/${invitation.token}`;

    const emailData = {
      inviteeEmail: invitation.email,
      teamName: invitation.teams?.name || 'Unknown Team',
      inviterName,
      role: invitation.role,
      acceptUrl,
      expiresAt: invitation.expires_at,
      language: inviterProfile?.preferred_language || 'en',
    };

    const { subject, html, text } = generateTeamInvitationEmail(emailData);

    // Track delivery via existing RPC (matches send-email behavior)
    let deliveryId: string | undefined;
    const { data: deliveryData, error: deliveryError } = await supabaseClient.rpc('create_email_delivery', {
      _recipient_email: invitation.email,
      _subject: subject,
      _template_name: 'team_invitation',
      _related_entity_type: 'team_invitation',
      _related_entity_id: invitation_id,
      _team_id: invitation.team_id,
      _metadata: {
        invitation_id,
        team_name: invitation.teams?.name,
        role: invitation.role,
        inviter_email: inviterProfile?.email,
      },
    });

    if (deliveryError) {
      console.error('Error creating email delivery record:', deliveryError);
    } else {
      deliveryId = deliveryData as string;
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Mataresit <noreply@mataresit.co>';

    if (!RESEND_API_KEY) {
      const errorMessage = 'RESEND_API_KEY is not configured';
      console.error(errorMessage);
      if (deliveryId) {
        await supabaseClient.rpc('update_email_delivery_status', {
          _delivery_id: deliveryId,
          _status: 'failed',
          _provider_message_id: null,
          _error_message: errorMessage,
        });
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let providerMessageId: string | undefined;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [invitation.email],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      providerMessageId = result.id;

      if (deliveryId) {
        await supabaseClient.rpc('update_email_delivery_status', {
          _delivery_id: deliveryId,
          _status: 'sent',
          _provider_message_id: providerMessageId,
          _error_message: null,
        });
      }

      console.log('Team invitation email sent successfully:', {
        invitation_id,
        recipient: invitation.email,
        team: invitation.teams?.name,
        provider_message_id: providerMessageId,
      });
    } catch (sendError) {
      console.error('Error sending invitation email via Resend:', sendError);
      if (deliveryId) {
        await supabaseClient.rpc('update_email_delivery_status', {
          _delivery_id: deliveryId,
          _status: 'failed',
          _provider_message_id: null,
          _error_message: (sendError as Error).message,
        });
      }
      return new Response(
        JSON.stringify({
          error: 'Failed to send invitation email',
          details: (sendError as Error).message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Team invitation email sent successfully',
        invitation_id,
        recipient: invitation.email,
        delivery_id: deliveryId,
        provider_message_id: providerMessageId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-team-invitation-email function:', error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
