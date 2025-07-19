/**
 * Alert Notification Delivery Service
 * Multi-channel notification delivery system for alerts
 * Task 3: Create Multiple Notification Channel System
 */

import { supabase } from '@/lib/supabase';
import { notificationService } from './notificationService';
import { 
  Alert, 
  NotificationChannel, 
  AlertNotification,
  EmailChannelConfig,
  WebhookChannelConfig,
  SlackChannelConfig,
  SMSChannelConfig,
  NotificationChannelType
} from '@/types/alerting';

interface DeliveryResult {
  success: boolean;
  channelId: string;
  channelType: NotificationChannelType;
  deliveryId?: string;
  externalMessageId?: string;
  error?: string;
  deliveryTime: number;
}

interface DeliveryBatch {
  alertId: string;
  channels: NotificationChannel[];
  results: DeliveryResult[];
  totalDeliveryTime: number;
  successCount: number;
  failureCount: number;
}

export class AlertNotificationDeliveryService {
  private readonly maxRetryAttempts = 3;
  private readonly retryDelays = [5000, 15000, 60000]; // 5s, 15s, 1m
  private readonly deliveryTimeout = 30000; // 30 seconds

  /**
   * Deliver alert notification to all configured channels
   */
  async deliverAlert(alert: Alert): Promise<DeliveryBatch> {
    const startTime = Date.now();
    
    console.log(`📨 Starting alert delivery for: ${alert.title} (${alert.id})`);

    try {
      // Get notification channels for this alert rule
      const channels = await this.getChannelsForAlert(alert);
      
      if (channels.length === 0) {
        console.warn(`No notification channels configured for alert ${alert.id}`);
        return {
          alertId: alert.id,
          channels: [],
          results: [],
          totalDeliveryTime: Date.now() - startTime,
          successCount: 0,
          failureCount: 0
        };
      }

      console.log(`📡 Delivering to ${channels.length} channels: ${channels.map(c => c.channel_type).join(', ')}`);

      // Deliver to all channels in parallel
      const deliveryPromises = channels.map(channel => 
        this.deliverToChannel(alert, channel)
      );

      const results = await Promise.allSettled(deliveryPromises);
      
      // Process results
      const deliveryResults: DeliveryResult[] = [];
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        const channel = channels[index];
        
        if (result.status === 'fulfilled') {
          deliveryResults.push(result.value);
          if (result.value.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          console.error(`Delivery failed for channel ${channel.id}:`, result.reason);
          deliveryResults.push({
            success: false,
            channelId: channel.id,
            channelType: channel.channel_type,
            error: result.reason?.message || 'Unknown error',
            deliveryTime: 0
          });
          failureCount++;
        }
      });

      const totalDeliveryTime = Date.now() - startTime;

      console.log(`✅ Alert delivery completed: ${successCount} success, ${failureCount} failed in ${totalDeliveryTime}ms`);

      return {
        alertId: alert.id,
        channels,
        results: deliveryResults,
        totalDeliveryTime,
        successCount,
        failureCount
      };

    } catch (error) {
      console.error(`Error during alert delivery for ${alert.id}:`, error);
      throw error;
    }
  }

  /**
   * Deliver alert to a specific channel
   */
  private async deliverToChannel(alert: Alert, channel: NotificationChannel): Promise<DeliveryResult> {
    const startTime = Date.now();
    
    try {
      // Check if channel is enabled
      if (!channel.enabled) {
        return {
          success: false,
          channelId: channel.id,
          channelType: channel.channel_type,
          error: 'Channel is disabled',
          deliveryTime: Date.now() - startTime
        };
      }

      // Check rate limiting
      const rateLimitOk = await this.checkRateLimit(channel);
      if (!rateLimitOk) {
        return {
          success: false,
          channelId: channel.id,
          channelType: channel.channel_type,
          error: 'Rate limit exceeded',
          deliveryTime: Date.now() - startTime
        };
      }

      // Create notification record
      const notificationId = await this.createNotificationRecord(alert, channel);

      let deliveryResult: DeliveryResult;

      // Deliver based on channel type
      switch (channel.channel_type) {
        case 'email':
          deliveryResult = await this.deliverEmail(alert, channel, notificationId);
          break;
        
        case 'push':
          deliveryResult = await this.deliverPush(alert, channel, notificationId);
          break;
        
        case 'webhook':
          deliveryResult = await this.deliverWebhook(alert, channel, notificationId);
          break;
        
        case 'slack':
          deliveryResult = await this.deliverSlack(alert, channel, notificationId);
          break;
        
        case 'sms':
          deliveryResult = await this.deliverSMS(alert, channel, notificationId);
          break;
        
        case 'in_app':
          deliveryResult = await this.deliverInApp(alert, channel, notificationId);
          break;
        
        default:
          deliveryResult = {
            success: false,
            channelId: channel.id,
            channelType: channel.channel_type,
            error: `Unsupported channel type: ${channel.channel_type}`,
            deliveryTime: Date.now() - startTime
          };
      }

      // Update notification record with result
      await this.updateNotificationRecord(notificationId, deliveryResult);

      return deliveryResult;

    } catch (error) {
      console.error(`Error delivering to channel ${channel.id}:`, error);
      return {
        success: false,
        channelId: channel.id,
        channelType: channel.channel_type,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get notification channels for an alert
   */
  private async getChannelsForAlert(alert: Alert): Promise<NotificationChannel[]> {
    const { data, error } = await supabase
      .from('alert_rule_channels')
      .select(`
        notification_channel_id,
        severity_filter,
        enabled,
        notification_channels (*)
      `)
      .eq('alert_rule_id', alert.alert_rule_id)
      .eq('enabled', true);

    if (error) {
      console.error('Error fetching channels for alert:', error);
      return [];
    }

    if (!data) return [];

    // Filter channels based on severity
    const filteredChannels = data.filter(mapping => {
      const severityFilter = mapping.severity_filter;
      
      // If no severity filter, include all alerts
      if (!severityFilter || severityFilter.length === 0) {
        return true;
      }
      
      // Check if alert severity matches filter
      return severityFilter.includes(alert.severity);
    });

    return filteredChannels
      .map(mapping => mapping.notification_channels)
      .filter(channel => channel && channel.enabled);
  }

  /**
   * Check rate limiting for a channel
   */
  private async checkRateLimit(channel: NotificationChannel): Promise<boolean> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check hourly limit
    const { data: hourlyCount, error: hourlyError } = await supabase
      .from('alert_notifications')
      .select('id')
      .eq('notification_channel_id', channel.id)
      .gte('created_at', hourAgo.toISOString());

    if (hourlyError) {
      console.error('Error checking hourly rate limit:', hourlyError);
      return true; // Allow on error
    }

    if (hourlyCount && hourlyCount.length >= channel.max_notifications_per_hour) {
      console.warn(`Hourly rate limit exceeded for channel ${channel.id}: ${hourlyCount.length}/${channel.max_notifications_per_hour}`);
      return false;
    }

    // Check daily limit
    const { data: dailyCount, error: dailyError } = await supabase
      .from('alert_notifications')
      .select('id')
      .eq('notification_channel_id', channel.id)
      .gte('created_at', dayAgo.toISOString());

    if (dailyError) {
      console.error('Error checking daily rate limit:', dailyError);
      return true; // Allow on error
    }

    if (dailyCount && dailyCount.length >= channel.max_notifications_per_day) {
      console.warn(`Daily rate limit exceeded for channel ${channel.id}: ${dailyCount.length}/${channel.max_notifications_per_day}`);
      return false;
    }

    return true;
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(alert: Alert, channel: NotificationChannel): Promise<string> {
    const { subject, message } = this.formatAlertMessage(alert, channel);

    const { data, error } = await supabase
      .from('alert_notifications')
      .insert({
        alert_id: alert.id,
        notification_channel_id: channel.id,
        delivery_status: 'pending',
        delivery_attempt: 1,
        max_delivery_attempts: this.maxRetryAttempts,
        subject,
        message
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create notification record: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update notification record with delivery result
   */
  private async updateNotificationRecord(notificationId: string, result: DeliveryResult): Promise<void> {
    const updateData: any = {
      delivery_status: result.success ? 'sent' : 'failed',
      updated_at: new Date().toISOString()
    };

    if (result.success) {
      updateData.sent_at = new Date().toISOString();
      if (result.externalMessageId) {
        updateData.external_message_id = result.externalMessageId;
      }
    } else {
      updateData.failed_at = new Date().toISOString();
      updateData.error_message = result.error;
    }

    const { error } = await supabase
      .from('alert_notifications')
      .update(updateData)
      .eq('id', notificationId);

    if (error) {
      console.error('Error updating notification record:', error);
    }
  }

  /**
   * Format alert message for different channels
   */
  private formatAlertMessage(alert: Alert, channel: NotificationChannel): { subject: string; message: string } {
    const severityEmoji = this.getSeverityEmoji(alert.severity);
    const timestamp = new Date(alert.created_at).toLocaleString();

    const subject = `${severityEmoji} ${alert.title}`;
    
    let message = `Alert: ${alert.title}\n`;
    message += `Severity: ${alert.severity.toUpperCase()}\n`;
    message += `Time: ${timestamp}\n`;
    
    if (alert.description) {
      message += `\nDescription: ${alert.description}\n`;
    }
    
    if (alert.metric_name && alert.metric_value !== undefined) {
      message += `\nMetric: ${alert.metric_name} = ${alert.metric_value}`;
      if (alert.threshold_value !== undefined) {
        message += ` (threshold: ${alert.threshold_operator} ${alert.threshold_value})`;
      }
    }

    // Add context if available
    if (alert.context && Object.keys(alert.context).length > 0) {
      message += `\n\nContext:\n${JSON.stringify(alert.context, null, 2)}`;
    }

    return { subject, message };
  }

  /**
   * Get emoji for alert severity
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      case 'info': return '📢';
      default: return '🔔';
    }
  }

  /**
   * Deliver email notification
   */
  private async deliverEmail(alert: Alert, channel: NotificationChannel, notificationId: string): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const config = channel.configuration as EmailChannelConfig;
      const { subject, message } = this.formatAlertMessage(alert, channel);

      // Use custom templates if configured
      const emailSubject = config.subject_template
        ? this.processTemplate(config.subject_template, alert)
        : subject;

      const emailBody = config.body_template
        ? this.processTemplate(config.body_template, alert)
        : message;

      // Send to all recipients
      const deliveryPromises = config.recipients.map(async (recipient) => {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            to: recipient,
            subject: emailSubject,
            html: this.formatEmailHTML(emailBody, alert),
            template_name: 'alert_notification',
            template_data: {
              alert_title: alert.title,
              alert_severity: alert.severity,
              alert_description: alert.description,
              alert_metric: alert.metric_name,
              alert_value: alert.metric_value,
              alert_threshold: alert.threshold_value,
              alert_time: new Date(alert.created_at).toLocaleString()
            },
            related_entity_type: 'alert',
            related_entity_id: alert.id,
            metadata: {
              notification_id: notificationId,
              channel_id: channel.id,
              alert_severity: alert.severity
            }
          }
        });

        if (error) {
          throw new Error(`Email delivery failed to ${recipient}: ${error.message}`);
        }

        return recipient;
      });

      await Promise.all(deliveryPromises);

      return {
        success: true,
        channelId: channel.id,
        channelType: 'email',
        deliveryId: notificationId,
        deliveryTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        channelId: channel.id,
        channelType: 'email',
        error: error instanceof Error ? error.message : 'Email delivery failed',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Deliver push notification
   */
  private async deliverPush(alert: Alert, channel: NotificationChannel, notificationId: string): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const { subject, message } = this.formatAlertMessage(alert, channel);

      // Get team members for push notifications
      const teamMembers = await this.getTeamMembers(alert.team_id);

      if (teamMembers.length === 0) {
        return {
          success: false,
          channelId: channel.id,
          channelType: 'push',
          error: 'No team members found for push notifications',
          deliveryTime: Date.now() - startTime
        };
      }

      // Send push notifications to all team members
      const pushPromises = teamMembers.map(async (memberId) => {
        const { error } = await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: memberId,
            title: subject,
            body: message,
            icon: '/mataresit-icon.png',
            badge: '/mataresit-icon.png',
            tag: `alert-${alert.id}`,
            data: {
              alertId: alert.id,
              severity: alert.severity,
              type: 'alert_notification',
              url: `/alerts/${alert.id}`
            },
            requireInteraction: alert.severity === 'critical',
            respectPreferences: true,
            respectQuietHours: alert.severity !== 'critical'
          }
        });

        if (error) {
          console.error(`Push notification failed for user ${memberId}:`, error);
        }

        return memberId;
      });

      await Promise.allSettled(pushPromises);

      return {
        success: true,
        channelId: channel.id,
        channelType: 'push',
        deliveryId: notificationId,
        deliveryTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        channelId: channel.id,
        channelType: 'push',
        error: error instanceof Error ? error.message : 'Push notification failed',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Deliver webhook notification
   */
  private async deliverWebhook(alert: Alert, channel: NotificationChannel, notificationId: string): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const config = channel.configuration as WebhookChannelConfig;

      // Prepare payload
      const payload = config.payload_template
        ? this.processTemplate(config.payload_template, alert)
        : JSON.stringify({
            alert: {
              id: alert.id,
              title: alert.title,
              description: alert.description,
              severity: alert.severity,
              status: alert.status,
              metric_name: alert.metric_name,
              metric_value: alert.metric_value,
              threshold_value: alert.threshold_value,
              threshold_operator: alert.threshold_operator,
              created_at: alert.created_at,
              team_id: alert.team_id,
              context: alert.context
            },
            notification: {
              id: notificationId,
              channel_id: channel.id,
              channel_name: channel.name,
              timestamp: new Date().toISOString()
            }
          });

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mataresit-Alert-System/1.0',
        ...config.headers
      };

      // Add authentication if configured
      if (config.authentication) {
        const auth = config.authentication;
        switch (auth.type) {
          case 'bearer':
            headers['Authorization'] = `Bearer ${auth.token}`;
            break;
          case 'basic':
            const credentials = btoa(`${auth.username}:${auth.password}`);
            headers['Authorization'] = `Basic ${credentials}`;
            break;
          case 'api_key':
            if (auth.api_key_header && auth.api_key_value) {
              headers[auth.api_key_header] = auth.api_key_value;
            }
            break;
        }
      }

      // Make HTTP request
      const response = await fetch(config.url, {
        method: config.method,
        headers,
        body: payload,
        signal: AbortSignal.timeout(this.deliveryTimeout)
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();

      return {
        success: true,
        channelId: channel.id,
        channelType: 'webhook',
        deliveryId: notificationId,
        externalMessageId: response.headers.get('x-message-id') || undefined,
        deliveryTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        channelId: channel.id,
        channelType: 'webhook',
        error: error instanceof Error ? error.message : 'Webhook delivery failed',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Deliver Slack notification
   */
  private async deliverSlack(alert: Alert, channel: NotificationChannel, notificationId: string): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const config = channel.configuration as SlackChannelConfig;
      const { subject, message } = this.formatAlertMessage(alert, channel);

      // Format Slack message
      const slackMessage = config.message_template
        ? this.processTemplate(config.message_template, alert)
        : this.formatSlackMessage(alert, subject, message);

      const payload = {
        text: subject,
        attachments: [
          {
            color: this.getSlackColor(alert.severity),
            title: alert.title,
            text: alert.description || '',
            fields: [
              {
                title: 'Severity',
                value: alert.severity.toUpperCase(),
                short: true
              },
              {
                title: 'Time',
                value: new Date(alert.created_at).toLocaleString(),
                short: true
              }
            ],
            footer: 'Mataresit Alert System',
            ts: Math.floor(new Date(alert.created_at).getTime() / 1000)
          }
        ],
        username: config.username || 'Mataresit Alerts',
        icon_emoji: config.icon_emoji || ':warning:',
        channel: config.channel
      };

      // Add metric information if available
      if (alert.metric_name && alert.metric_value !== undefined) {
        payload.attachments[0].fields.push({
          title: 'Metric',
          value: `${alert.metric_name}: ${alert.metric_value}`,
          short: true
        });
      }

      if (alert.threshold_value !== undefined) {
        payload.attachments[0].fields.push({
          title: 'Threshold',
          value: `${alert.threshold_operator} ${alert.threshold_value}`,
          short: true
        });
      }

      // Send to Slack
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.deliveryTimeout)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        channelId: channel.id,
        channelType: 'slack',
        deliveryId: notificationId,
        deliveryTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        channelId: channel.id,
        channelType: 'slack',
        error: error instanceof Error ? error.message : 'Slack delivery failed',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Deliver SMS notification
   */
  private async deliverSMS(alert: Alert, channel: NotificationChannel, notificationId: string): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const config = channel.configuration as SMSChannelConfig;
      const { subject, message } = this.formatAlertMessage(alert, channel);

      // Format SMS message (keep it short)
      const smsMessage = config.message_template
        ? this.processTemplate(config.message_template, alert)
        : `${subject}\n${alert.description || ''}\nTime: ${new Date(alert.created_at).toLocaleString()}`;

      // Truncate if too long (SMS limit is typically 160 characters)
      const truncatedMessage = smsMessage.length > 160
        ? smsMessage.substring(0, 157) + '...'
        : smsMessage;

      // Send SMS via Edge Function (would need to be implemented)
      const deliveryPromises = config.phone_numbers.map(async (phoneNumber) => {
        const { error } = await supabase.functions.invoke('send-sms', {
          body: {
            to: phoneNumber,
            message: truncatedMessage,
            provider: config.provider,
            provider_config: config.provider_config,
            metadata: {
              notification_id: notificationId,
              alert_id: alert.id,
              severity: alert.severity
            }
          }
        });

        if (error) {
          throw new Error(`SMS delivery failed to ${phoneNumber}: ${error.message}`);
        }

        return phoneNumber;
      });

      await Promise.all(deliveryPromises);

      return {
        success: true,
        channelId: channel.id,
        channelType: 'sms',
        deliveryId: notificationId,
        deliveryTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        channelId: channel.id,
        channelType: 'sms',
        error: error instanceof Error ? error.message : 'SMS delivery failed',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Deliver in-app notification
   */
  private async deliverInApp(alert: Alert, channel: NotificationChannel, notificationId: string): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const { subject, message } = this.formatAlertMessage(alert, channel);

      // Get team members for in-app notifications
      const teamMembers = await this.getTeamMembers(alert.team_id);

      if (teamMembers.length === 0) {
        return {
          success: false,
          channelId: channel.id,
          channelType: 'in_app',
          error: 'No team members found for in-app notifications',
          deliveryTime: Date.now() - startTime
        };
      }

      // Create in-app notifications for all team members
      const notificationPromises = teamMembers.map(async (memberId) => {
        return await notificationService.createNotification(
          memberId,
          this.getNotificationTypeForSeverity(alert.severity),
          subject,
          message,
          {
            teamId: alert.team_id,
            priority: this.getPriorityForSeverity(alert.severity),
            actionUrl: `/alerts/${alert.id}`,
            relatedEntityType: 'alert',
            relatedEntityId: alert.id,
            metadata: {
              alert_severity: alert.severity,
              alert_metric: alert.metric_name,
              alert_value: alert.metric_value,
              notification_channel_id: channel.id,
              delivery_notification_id: notificationId
            }
          }
        );
      });

      await Promise.all(notificationPromises);

      return {
        success: true,
        channelId: channel.id,
        channelType: 'in_app',
        deliveryId: notificationId,
        deliveryTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        channelId: channel.id,
        channelType: 'in_app',
        error: error instanceof Error ? error.message : 'In-app notification failed',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Utility Functions
   */

  private async getTeamMembers(teamId?: string): Promise<string[]> {
    if (!teamId) return [];

    const { data, error } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);

    if (error) {
      console.error('Error fetching team members:', error);
      return [];
    }

    return data?.map(member => member.user_id) || [];
  }

  private processTemplate(template: string, alert: Alert): string {
    return template
      .replace(/\{\{alert\.title\}\}/g, alert.title)
      .replace(/\{\{alert\.description\}\}/g, alert.description || '')
      .replace(/\{\{alert\.severity\}\}/g, alert.severity)
      .replace(/\{\{alert\.status\}\}/g, alert.status)
      .replace(/\{\{alert\.metric_name\}\}/g, alert.metric_name || '')
      .replace(/\{\{alert\.metric_value\}\}/g, String(alert.metric_value || ''))
      .replace(/\{\{alert\.threshold_value\}\}/g, String(alert.threshold_value || ''))
      .replace(/\{\{alert\.threshold_operator\}\}/g, alert.threshold_operator || '')
      .replace(/\{\{alert\.created_at\}\}/g, new Date(alert.created_at).toLocaleString())
      .replace(/\{\{alert\.team_id\}\}/g, alert.team_id || '');
  }

  private formatEmailHTML(message: string, alert: Alert): string {
    const severityColor = this.getSeverityColor(alert.severity);

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${severityColor}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${this.getSeverityEmoji(alert.severity)} Alert Notification</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">${alert.title}</h2>
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; margin: 0;">${message}</pre>
          </div>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p>This is an automated alert from Mataresit Alert System.</p>
            <p>Alert ID: ${alert.id}</p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    `;
  }

  private formatSlackMessage(alert: Alert, subject: string, message: string): string {
    return `${subject}\n\`\`\`\n${message}\n\`\`\``;
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc2626'; // red-600
      case 'high': return '#ea580c'; // orange-600
      case 'medium': return '#d97706'; // amber-600
      case 'low': return '#2563eb'; // blue-600
      case 'info': return '#059669'; // emerald-600
      default: return '#6b7280'; // gray-500
    }
  }

  private getSlackColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return '#d97706';
      case 'low': return 'good';
      case 'info': return '#2563eb';
      default: return '#6b7280';
    }
  }

  private getNotificationTypeForSeverity(severity: string): any {
    switch (severity) {
      case 'critical': return 'system_alert_critical';
      case 'high': return 'system_alert_high';
      case 'medium': return 'system_alert_medium';
      default: return 'system_alert_medium';
    }
  }

  private getPriorityForSeverity(severity: string): 'low' | 'medium' | 'high' {
    switch (severity) {
      case 'critical': return 'high';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }

  /**
   * Retry failed notification delivery
   */
  async retryFailedNotification(notificationId: string): Promise<DeliveryResult> {
    try {
      // Get notification details
      const { data: notification, error } = await supabase
        .from('alert_notifications')
        .select(`
          *,
          alerts (*),
          notification_channels (*)
        `)
        .eq('id', notificationId)
        .single();

      if (error || !notification) {
        throw new Error('Notification not found');
      }

      if (notification.delivery_attempt >= notification.max_delivery_attempts) {
        throw new Error('Maximum retry attempts exceeded');
      }

      // Update attempt count
      await supabase
        .from('alert_notifications')
        .update({
          delivery_attempt: notification.delivery_attempt + 1,
          delivery_status: 'retrying',
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      // Retry delivery
      const result = await this.deliverToChannel(
        notification.alerts,
        notification.notification_channels
      );

      return result;

    } catch (error) {
      console.error(`Error retrying notification ${notificationId}:`, error);
      throw error;
    }
  }

  /**
   * Get delivery statistics for a channel
   */
  async getChannelStatistics(channelId: string, hours: number = 24): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    averageDeliveryTime: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('alert_notifications')
      .select('delivery_status, created_at, sent_at')
      .eq('notification_channel_id', channelId)
      .gte('created_at', since.toISOString());

    if (error) {
      console.error('Error fetching channel statistics:', error);
      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0,
        averageDeliveryTime: 0
      };
    }

    const totalDeliveries = data?.length || 0;
    const successfulDeliveries = data?.filter(n => n.delivery_status === 'sent' || n.delivery_status === 'delivered').length || 0;
    const failedDeliveries = data?.filter(n => n.delivery_status === 'failed').length || 0;
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    // Calculate average delivery time for successful deliveries
    const successfulWithTimes = data?.filter(n =>
      (n.delivery_status === 'sent' || n.delivery_status === 'delivered') &&
      n.sent_at
    ) || [];

    const averageDeliveryTime = successfulWithTimes.length > 0
      ? successfulWithTimes.reduce((sum, n) => {
          const deliveryTime = new Date(n.sent_at!).getTime() - new Date(n.created_at).getTime();
          return sum + deliveryTime;
        }, 0) / successfulWithTimes.length
      : 0;

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      successRate,
      averageDeliveryTime
    };
  }
}

// Export singleton instance
export const alertNotificationDeliveryService = new AlertNotificationDeliveryService();
