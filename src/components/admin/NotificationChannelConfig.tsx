/**
 * Notification Channel Configuration Component
 * Interface for configuring notification channels
 * Task 5: Develop Configurable Alert Rules Interface - Channel Configuration
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Plus,
  Edit,
  Trash2,
  TestTube,
  Mail,
  MessageSquare,
  Webhook,
  Smartphone,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNotificationChannels } from '@/hooks/useNotificationChannels';
import { 
  NotificationChannel, 
  NotificationChannelType,
  EmailChannelConfig,
  WebhookChannelConfig,
  SlackChannelConfig,
  SMSChannelConfig
} from '@/types/alerting';

// Channel configuration schemas
const emailConfigSchema = z.object({
  recipients: z.array(z.string().email()).min(1, 'At least one recipient required'),
  subject_template: z.string().optional(),
  body_template: z.string().optional(),
});

const webhookConfigSchema = z.object({
  url: z.string().url('Invalid URL'),
  method: z.enum(['POST', 'PUT', 'PATCH']),
  headers: z.record(z.string()).optional(),
  payload_template: z.string().optional(),
  authentication: z.object({
    type: z.enum(['none', 'bearer', 'basic', 'api_key']),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    api_key_header: z.string().optional(),
    api_key_value: z.string().optional(),
  }).optional(),
});

const slackConfigSchema = z.object({
  webhook_url: z.string().url('Invalid Slack webhook URL'),
  channel: z.string().optional(),
  username: z.string().optional(),
  icon_emoji: z.string().optional(),
  message_template: z.string().optional(),
});

const smsConfigSchema = z.object({
  phone_numbers: z.array(z.string()).min(1, 'At least one phone number required'),
  provider: z.enum(['twilio', 'aws_sns']),
  provider_config: z.record(z.any()),
  message_template: z.string().optional(),
});

const channelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(255, 'Name too long'),
  description: z.string().optional(),
  channel_type: z.enum(['email', 'webhook', 'slack', 'sms', 'push', 'in_app']),
  enabled: z.boolean(),
  max_notifications_per_hour: z.number().min(1, 'Must allow at least 1 notification per hour'),
  max_notifications_per_day: z.number().min(1, 'Must allow at least 1 notification per day'),
  configuration: z.any(), // Will be validated based on channel type
});

type ChannelFormData = z.infer<typeof channelSchema>;

interface NotificationChannelConfigProps {
  teamId?: string;
  className?: string;
}

export function NotificationChannelConfig({ teamId, className }: NotificationChannelConfigProps) {
  // Hooks
  const {
    channels,
    createChannel,
    updateChannel,
    deleteChannel,
    testChannel,
    validateChannelConfiguration,
    getChannelsByType,
    isLoading,
    error
  } = useNotificationChannels({ teamId, autoRefresh: true });

  // State
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedChannelType, setSelectedChannelType] = useState<NotificationChannelType>('email');
  const [showSecrets, setShowSecrets] = useState(false);

  // Form
  const form = useForm<ChannelFormData>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      enabled: true,
      max_notifications_per_hour: 60,
      max_notifications_per_day: 1000,
      channel_type: 'email',
      configuration: {}
    }
  });

  // Get channel type icon
  const getChannelIcon = (type: NotificationChannelType) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'webhook': return <Webhook className="h-4 w-4" />;
      case 'slack': return <MessageSquare className="h-4 w-4" />;
      case 'sms': return <Smartphone className="h-4 w-4" />;
      case 'push': return <Bell className="h-4 w-4" />;
      case 'in_app': return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  // Handle form submission
  const handleCreateChannel = async (data: ChannelFormData) => {
    try {
      // Validate configuration based on channel type
      const validation = validateChannelConfiguration(data.channel_type, data.configuration);
      if (!validation.isValid) {
        toast.error(`Configuration error: ${validation.errors.join(', ')}`);
        return;
      }

      await createChannel(data);
      setIsCreateDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  const handleEditChannel = async (data: ChannelFormData) => {
    if (!selectedChannel) return;
    
    try {
      // Validate configuration
      const validation = validateChannelConfiguration(data.channel_type, data.configuration);
      if (!validation.isValid) {
        toast.error(`Configuration error: ${validation.errors.join(', ')}`);
        return;
      }

      await updateChannel(selectedChannel.id, data);
      setIsEditDialogOpen(false);
      setSelectedChannel(null);
      form.reset();
    } catch (error) {
      console.error('Error updating channel:', error);
    }
  };

  const handleTestChannel = async (channelId: string) => {
    try {
      const result = await testChannel(channelId);
      if (result.success) {
        toast.success(`Test successful: ${result.message}`);
      } else {
        toast.error(`Test failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error testing channel:', error);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await deleteChannel(channelId);
    } catch (error) {
      console.error('Error deleting channel:', error);
    }
  };

  const openEditDialog = (channel: NotificationChannel) => {
    setSelectedChannel(channel);
    form.reset({
      name: channel.name,
      description: channel.description || '',
      channel_type: channel.channel_type,
      enabled: channel.enabled,
      max_notifications_per_hour: channel.max_notifications_per_hour,
      max_notifications_per_day: channel.max_notifications_per_day,
      configuration: channel.configuration
    });
    setSelectedChannelType(channel.channel_type);
    setIsEditDialogOpen(true);
  };

  // Render configuration form based on channel type
  const renderChannelConfiguration = (channelType: NotificationChannelType) => {
    switch (channelType) {
      case 'email':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="configuration.recipients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Recipients</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="user1@example.com&#10;user2@example.com"
                      {...field}
                      value={Array.isArray(field.value) ? field.value.join('\n') : ''}
                      onChange={(e) => field.onChange(e.target.value.split('\n').filter(Boolean))}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter email addresses, one per line
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration.subject_template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Template (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Alert: {{alert.title}}"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use {{alert.title}}, {{alert.severity}}, etc. for dynamic content
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration.body_template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body Template (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Alert: {{alert.title}}&#10;Severity: {{alert.severity}}&#10;Description: {{alert.description}}"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Custom email body template with alert variables
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 'webhook':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="configuration.url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Webhook URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://api.example.com/webhooks/alerts"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The endpoint URL to send webhook notifications
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration.method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>HTTP Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select HTTP method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration.authentication.type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authentication</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select authentication type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('configuration.authentication.type') === 'bearer' && (
              <FormField
                control={form.control}
                name="configuration.authentication.token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bearer Token</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showSecrets ? 'text' : 'password'}
                          placeholder="your-bearer-token"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowSecrets(!showSecrets)}
                        >
                          {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        );

      case 'slack':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="configuration.webhook_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slack Webhook URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://hooks.slack.com/services/..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Get this from your Slack app's Incoming Webhooks settings
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration.channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="#alerts"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Override the default channel (e.g., #alerts, @username)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Username (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Alert Bot"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Custom username for the bot
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 'sms':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="configuration.phone_numbers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Numbers</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="+1234567890&#10;+0987654321"
                      {...field}
                      value={Array.isArray(field.value) ? field.value.join('\n') : ''}
                      onChange={(e) => field.onChange(e.target.value.split('\n').filter(Boolean))}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter phone numbers in international format, one per line
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration.provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SMS Provider</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select SMS provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="aws_sns">AWS SNS</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Configuration for {channelType} channels is not yet implemented.
            </p>
          </div>
        );
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification Channels</h2>
          <p className="text-muted-foreground">
            Configure how alerts are delivered to your team
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Channel Types Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {(['email', 'webhook', 'slack', 'sms', 'push', 'in_app'] as NotificationChannelType[]).map((type) => {
          const typeChannels = getChannelsByType(type);
          const enabledCount = typeChannels.filter(c => c.enabled).length;

          return (
            <Card key={type} className="text-center">
              <CardContent className="p-4">
                <div className="flex flex-col items-center gap-2">
                  {getChannelIcon(type)}
                  <div>
                    <p className="font-medium capitalize">{type}</p>
                    <p className="text-sm text-muted-foreground">
                      {enabledCount}/{typeChannels.length} active
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Channels List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Channels ({channels.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Notification Channels</h3>
              <p className="text-muted-foreground mb-4">
                Add notification channels to receive alerts via email, Slack, webhooks, and more.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Channel
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getChannelIcon(channel.channel_type)}
                      <div>
                        <h4 className="font-semibold">{channel.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {channel.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={channel.enabled ? 'default' : 'secondary'}>
                        {channel.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {channel.channel_type}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestChannel(channel.id)}
                      disabled={!channel.enabled}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateChannel(channel.id, { enabled: !channel.enabled })}
                    >
                      {channel.enabled ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(channel)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteChannel(channel.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Channel Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Notification Channel</DialogTitle>
            <DialogDescription>
              Configure a new notification channel to receive alerts.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateChannel)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="channel_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Type</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedChannelType(value as NotificationChannelType);
                          // Reset configuration when type changes
                          form.setValue('configuration', {});
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select channel type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email
                            </div>
                          </SelectItem>
                          <SelectItem value="webhook">
                            <div className="flex items-center gap-2">
                              <Webhook className="h-4 w-4" />
                              Webhook
                            </div>
                          </SelectItem>
                          <SelectItem value="slack">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Slack
                            </div>
                          </SelectItem>
                          <SelectItem value="sms">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4" />
                              SMS
                            </div>
                          </SelectItem>
                          <SelectItem value="push">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4" />
                              Push Notifications
                            </div>
                          </SelectItem>
                          <SelectItem value="in_app">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4" />
                              In-App Notifications
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Team Email Alerts" {...field} />
                      </FormControl>
                      <FormDescription>
                        A descriptive name for this notification channel
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Sends alerts to the development team..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional description of this channel's purpose
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Channel-specific Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Channel Configuration</h3>
                {renderChannelConfiguration(selectedChannelType)}
              </div>

              <Separator />

              {/* Rate Limiting */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="max_notifications_per_hour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Notifications/Hour</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="60"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormDescription>
                        Rate limit for this channel
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_notifications_per_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Notifications/Day</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1000"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormDescription>
                        Daily rate limit for this channel
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Channel</FormLabel>
                      <FormDescription>
                        Whether this channel should receive notifications
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Channel'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Channel Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Notification Channel</DialogTitle>
            <DialogDescription>
              Modify the configuration for "{selectedChannel?.name}".
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditChannel)} className="space-y-6">
              {/* Same form fields as create dialog, but with pre-populated values */}
              <div className="text-center py-4">
                <p className="text-muted-foreground">
                  Edit form would contain the same fields as create form, pre-populated with current values.
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update Channel'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
