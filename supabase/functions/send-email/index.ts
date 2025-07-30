import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
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
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Mataresit <noreply@mataresit.com>';

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
