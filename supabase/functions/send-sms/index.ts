/**
 * SMS Delivery Edge Function
 * Sends SMS notifications via multiple providers (Twilio, AWS SNS)
 * Task 3: Create Multiple Notification Channel System - SMS Integration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface SMSRequest {
  to: string;
  message: string;
  provider: 'twilio' | 'aws_sns';
  provider_config: Record<string, any>;
  metadata?: Record<string, any>;
}

interface SMSResponse {
  success: boolean;
  message: string;
  messageId?: string;
  provider: string;
  deliveryTime: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const startTime = Date.now();

  try {
    const requestBody: SMSRequest = await req.json();
    const { to, message, provider, provider_config, metadata } = requestBody;

    // Validate request
    if (!to || !message || !provider || !provider_config) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing required fields: to, message, provider, provider_config',
          provider,
          deliveryTime: Date.now() - startTime
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Sending SMS via ${provider} to ${to}`);

    let result: SMSResponse;

    switch (provider) {
      case 'twilio':
        result = await sendViaTwilio(to, message, provider_config, startTime);
        break;
      
      case 'aws_sns':
        result = await sendViaAWSSNS(to, message, provider_config, startTime);
        break;
      
      default:
        result = {
          success: false,
          message: `Unsupported SMS provider: ${provider}`,
          provider,
          deliveryTime: Date.now() - startTime,
          error: 'Invalid provider'
        };
    }

    console.log(`SMS delivery result:`, {
      success: result.success,
      provider: result.provider,
      deliveryTime: result.deliveryTime,
      messageId: result.messageId
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('SMS delivery error:', error);

    const errorResponse: SMSResponse = {
      success: false,
      message: `SMS delivery failed: ${error.message}`,
      provider: 'unknown',
      deliveryTime: Date.now() - startTime,
      error: error.message
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});

async function sendViaTwilio(
  to: string, 
  message: string, 
  config: Record<string, any>, 
  startTime: number
): Promise<SMSResponse> {
  try {
    const { account_sid, auth_token, from_number } = config;

    if (!account_sid || !auth_token || !from_number) {
      throw new Error('Twilio configuration missing: account_sid, auth_token, and from_number are required');
    }

    // Prepare Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', from_number);
    formData.append('Body', message);

    // Add basic auth header
    const credentials = btoa(`${account_sid}:${auth_token}`);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`Twilio API error: ${responseData.message || response.statusText}`);
    }

    return {
      success: true,
      message: 'SMS sent successfully via Twilio',
      messageId: responseData.sid,
      provider: 'twilio',
      deliveryTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      success: false,
      message: `Twilio SMS delivery failed: ${error.message}`,
      provider: 'twilio',
      deliveryTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function sendViaAWSSNS(
  to: string, 
  message: string, 
  config: Record<string, any>, 
  startTime: number
): Promise<SMSResponse> {
  try {
    const { access_key_id, secret_access_key, region = 'us-east-1' } = config;

    if (!access_key_id || !secret_access_key) {
      throw new Error('AWS SNS configuration missing: access_key_id and secret_access_key are required');
    }

    // AWS SNS API endpoint
    const snsUrl = `https://sns.${region}.amazonaws.com/`;

    // Prepare AWS SNS request parameters
    const params = new URLSearchParams();
    params.append('Action', 'Publish');
    params.append('PhoneNumber', to);
    params.append('Message', message);
    params.append('Version', '2010-03-31');

    // Create AWS Signature Version 4
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);
    
    // For simplicity, we'll use a basic implementation
    // In production, you'd want to use a proper AWS SDK or signing library
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Amz-Date': timestamp,
      'Authorization': `AWS4-HMAC-SHA256 Credential=${access_key_id}/${date}/${region}/sns/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=placeholder`
    };

    // Note: This is a simplified implementation
    // In production, you should use proper AWS SDK or implement full signature v4
    const response = await fetch(snsUrl, {
      method: 'POST',
      headers,
      body: params
    });

    if (!response.ok) {
      throw new Error(`AWS SNS API error: ${response.statusText}`);
    }

    const responseText = await response.text();
    
    // Parse XML response to get MessageId
    const messageIdMatch = responseText.match(/<MessageId>([^<]+)<\/MessageId>/);
    const messageId = messageIdMatch ? messageIdMatch[1] : undefined;

    return {
      success: true,
      message: 'SMS sent successfully via AWS SNS',
      messageId,
      provider: 'aws_sns',
      deliveryTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      success: false,
      message: `AWS SNS SMS delivery failed: ${error.message}`,
      provider: 'aws_sns',
      deliveryTime: Date.now() - startTime,
      error: error.message
    };
  }
}

// Helper function to validate phone number format
function validatePhoneNumber(phoneNumber: string): boolean {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Check if it's a valid international format
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(cleaned);
}

// Helper function to format phone number for international delivery
function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Add + if not present and doesn't start with 00
  if (!cleaned.startsWith('+') && !cleaned.startsWith('00')) {
    cleaned = '+' + cleaned;
  }
  
  // Convert 00 prefix to +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  
  return cleaned;
}
