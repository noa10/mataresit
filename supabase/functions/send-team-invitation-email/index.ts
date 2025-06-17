import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateTeamInvitationEmail } from '../send-email/templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
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
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get invitation details with team and inviter information
    const { data: invitation, error: invitationError } = await supabaseClient
      .from('team_invitations')
      .select(`
        *,
        teams!team_id(name)
      `)
      .eq('id', invitation_id)
      .single();

    if (invitationError || !invitation) {
      console.error('Error fetching invitation:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get inviter information separately including language preference
    const { data: inviterProfile, error: inviterError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, email, preferred_language')
      .eq('id', invitation.invited_by)
      .single();

    // Prepare email data
    const inviterName = inviterProfile?.first_name
      ? `${inviterProfile.first_name} ${inviterProfile.last_name || ''}`.trim()
      : inviterProfile?.email || 'Someone';

    const acceptUrl = `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/invite/${invitation.token}`;

    const emailData = {
      inviteeEmail: invitation.email,
      teamName: invitation.teams?.name || 'Unknown Team',
      inviterName,
      role: invitation.role,
      acceptUrl,
      expiresAt: invitation.expires_at,
      language: inviterProfile?.preferred_language || 'en', // Use inviter's language preference
    };

    // Generate email content
    const { subject, html, text } = generateTeamInvitationEmail(emailData);

    // Send email using the send-email function
    const emailResponse = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: invitation.email,
        subject,
        html,
        text,
        template_name: 'team_invitation',
        related_entity_type: 'team_invitation',
        related_entity_id: invitation_id,
        team_id: invitation.team_id,
        metadata: {
          invitation_id,
          team_name: invitation.teams?.name,
          role: invitation.role,
          inviter_email: inviterProfile?.email,
        },
      },
    });

    if (emailResponse.error) {
      console.error('Error sending invitation email:', emailResponse.error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send invitation email',
          details: emailResponse.error 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Team invitation email sent successfully:', {
      invitation_id,
      recipient: invitation.email,
      team: invitation.teams?.name,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Team invitation email sent successfully',
        invitation_id,
        recipient: invitation.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in send-team-invitation-email function:', error);
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
