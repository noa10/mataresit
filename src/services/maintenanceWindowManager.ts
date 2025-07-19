/**
 * Maintenance Window Manager
 * Manages maintenance windows for alert suppression during planned downtime
 * Task 6: Implement Alert Suppression and Rate Limiting - Maintenance Windows
 */

import { supabase } from '@/lib/supabase';
import { AlertSeverity } from '@/types/alerting';

interface MaintenanceWindow {
  id: string;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  timezone: string;
  affected_systems: string[];
  affected_severities: AlertSeverity[];
  suppress_all: boolean;
  notify_before_minutes: number;
  notify_after_completion: boolean;
  enabled: boolean;
  recurring: boolean;
  recurrence_config: Record<string, any>;
  team_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface MaintenanceWindowCreate {
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  timezone?: string;
  affected_systems?: string[];
  affected_severities?: AlertSeverity[];
  suppress_all?: boolean;
  notify_before_minutes?: number;
  notify_after_completion?: boolean;
  recurring?: boolean;
  recurrence_config?: Record<string, any>;
  team_id?: string;
}

interface RecurrenceConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // Every N days/weeks/months
  days_of_week?: number[]; // 0-6, Sunday = 0
  day_of_month?: number; // 1-31
  end_date?: string;
  max_occurrences?: number;
}

interface MaintenanceStatus {
  isActive: boolean;
  activeWindows: MaintenanceWindow[];
  upcomingWindows: MaintenanceWindow[];
  affectedSystems: string[];
  suppressionLevel: 'none' | 'partial' | 'full';
}

export class MaintenanceWindowManager {
  private readonly activeWindows: Map<string, MaintenanceWindow> = new Map();
  private readonly upcomingWindows: Map<string, MaintenanceWindow> = new Map();
  private notificationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.loadMaintenanceWindows();
    this.startMaintenanceMonitoring();
  }

  /**
   * Create a new maintenance window
   */
  async createMaintenanceWindow(windowData: MaintenanceWindowCreate): Promise<MaintenanceWindow> {
    try {
      console.log(`🔧 Creating maintenance window: ${windowData.name}`);

      // Validate time range
      const startTime = new Date(windowData.start_time);
      const endTime = new Date(windowData.end_time);

      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }

      if (startTime <= new Date()) {
        throw new Error('Start time must be in the future');
      }

      // Create the maintenance window
      const { data, error } = await supabase
        .from('maintenance_windows')
        .insert({
          name: windowData.name,
          description: windowData.description,
          start_time: windowData.start_time,
          end_time: windowData.end_time,
          timezone: windowData.timezone || 'UTC',
          affected_systems: windowData.affected_systems || [],
          affected_severities: windowData.affected_severities || ['critical', 'high', 'medium', 'low', 'info'],
          suppress_all: windowData.suppress_all || false,
          notify_before_minutes: windowData.notify_before_minutes || 30,
          notify_after_completion: windowData.notify_after_completion !== false,
          recurring: windowData.recurring || false,
          recurrence_config: windowData.recurrence_config || {},
          team_id: windowData.team_id,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create maintenance window: ${error.message}`);
      }

      const maintenanceWindow = data as MaintenanceWindow;

      // Schedule notifications
      await this.scheduleMaintenanceNotifications(maintenanceWindow);

      // Generate recurring windows if needed
      if (maintenanceWindow.recurring) {
        await this.generateRecurringWindows(maintenanceWindow);
      }

      // Update local cache
      this.updateWindowCache(maintenanceWindow);

      console.log(`✅ Created maintenance window: ${maintenanceWindow.id}`);
      return maintenanceWindow;

    } catch (error) {
      console.error('Error creating maintenance window:', error);
      throw error;
    }
  }

  /**
   * Update an existing maintenance window
   */
  async updateMaintenanceWindow(
    windowId: string, 
    updates: Partial<MaintenanceWindowCreate>
  ): Promise<MaintenanceWindow> {
    try {
      const { data, error } = await supabase
        .from('maintenance_windows')
        .update(updates)
        .eq('id', windowId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update maintenance window: ${error.message}`);
      }

      const updatedWindow = data as MaintenanceWindow;

      // Reschedule notifications if timing changed
      if (updates.start_time || updates.notify_before_minutes) {
        await this.scheduleMaintenanceNotifications(updatedWindow);
      }

      // Update local cache
      this.updateWindowCache(updatedWindow);

      return updatedWindow;

    } catch (error) {
      console.error('Error updating maintenance window:', error);
      throw error;
    }
  }

  /**
   * Delete a maintenance window
   */
  async deleteMaintenanceWindow(windowId: string): Promise<void> {
    try {
      // Cancel any scheduled notifications
      const timer = this.notificationTimers.get(windowId);
      if (timer) {
        clearTimeout(timer);
        this.notificationTimers.delete(windowId);
      }

      // Delete from database
      const { error } = await supabase
        .from('maintenance_windows')
        .delete()
        .eq('id', windowId);

      if (error) {
        throw new Error(`Failed to delete maintenance window: ${error.message}`);
      }

      // Remove from local cache
      this.activeWindows.delete(windowId);
      this.upcomingWindows.delete(windowId);

      console.log(`🗑️ Deleted maintenance window: ${windowId}`);

    } catch (error) {
      console.error('Error deleting maintenance window:', error);
      throw error;
    }
  }

  /**
   * Check if alert should be suppressed due to maintenance
   */
  checkMaintenanceSuppression(
    metricName: string, 
    severity: AlertSeverity, 
    teamId?: string
  ): {
    shouldSuppress: boolean;
    reason?: string;
    maintenanceWindow?: MaintenanceWindow;
    suppressUntil?: Date;
  } {
    const now = new Date();

    // Check all active maintenance windows
    for (const window of this.activeWindows.values()) {
      // Skip if window is for a different team
      if (window.team_id && teamId && window.team_id !== teamId) {
        continue;
      }

      // Check if window is currently active
      const startTime = new Date(window.start_time);
      const endTime = new Date(window.end_time);

      if (now >= startTime && now <= endTime) {
        // Check if this alert should be suppressed
        const shouldSuppress = window.suppress_all ||
          window.affected_systems.includes(metricName) ||
          window.affected_severities.includes(severity);

        if (shouldSuppress) {
          return {
            shouldSuppress: true,
            reason: 'maintenance_window',
            maintenanceWindow: window,
            suppressUntil: endTime
          };
        }
      }
    }

    return { shouldSuppress: false };
  }

  /**
   * Get current maintenance status
   */
  getMaintenanceStatus(teamId?: string): MaintenanceStatus {
    const now = new Date();
    const activeWindows: MaintenanceWindow[] = [];
    const upcomingWindows: MaintenanceWindow[] = [];
    const affectedSystems: Set<string> = new Set();

    for (const window of this.activeWindows.values()) {
      // Filter by team if specified
      if (teamId && window.team_id && window.team_id !== teamId) {
        continue;
      }

      const startTime = new Date(window.start_time);
      const endTime = new Date(window.end_time);

      if (now >= startTime && now <= endTime) {
        activeWindows.push(window);
        window.affected_systems.forEach(system => affectedSystems.add(system));
      } else if (startTime > now && startTime.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) {
        // Upcoming within 24 hours
        upcomingWindows.push(window);
      }
    }

    // Determine suppression level
    let suppressionLevel: 'none' | 'partial' | 'full' = 'none';
    if (activeWindows.length > 0) {
      const hasFullSuppression = activeWindows.some(w => w.suppress_all);
      suppressionLevel = hasFullSuppression ? 'full' : 'partial';
    }

    return {
      isActive: activeWindows.length > 0,
      activeWindows,
      upcomingWindows,
      affectedSystems: Array.from(affectedSystems),
      suppressionLevel
    };
  }

  /**
   * Get all maintenance windows
   */
  async getMaintenanceWindows(teamId?: string): Promise<MaintenanceWindow[]> {
    try {
      let query = supabase
        .from('maintenance_windows')
        .select('*')
        .order('start_time', { ascending: true });

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch maintenance windows: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error('Error fetching maintenance windows:', error);
      throw error;
    }
  }

  /**
   * Schedule maintenance notifications
   */
  private async scheduleMaintenanceNotifications(window: MaintenanceWindow): Promise<void> {
    if (!window.notify_before_minutes || window.notify_before_minutes <= 0) {
      return;
    }

    const startTime = new Date(window.start_time);
    const notificationTime = new Date(startTime.getTime() - window.notify_before_minutes * 60 * 1000);
    const now = new Date();

    if (notificationTime <= now) {
      return; // Too late to schedule notification
    }

    const delay = notificationTime.getTime() - now.getTime();

    const timer = setTimeout(async () => {
      await this.sendMaintenanceNotification(window, 'starting_soon');
    }, delay);

    this.notificationTimers.set(window.id, timer);

    console.log(`⏰ Scheduled maintenance notification for ${window.name} at ${notificationTime.toISOString()}`);
  }

  /**
   * Send maintenance notification
   */
  private async sendMaintenanceNotification(
    window: MaintenanceWindow, 
    type: 'starting_soon' | 'started' | 'completed'
  ): Promise<void> {
    try {
      const notification = {
        type: 'maintenance_window',
        title: this.getNotificationTitle(window, type),
        message: this.getNotificationMessage(window, type),
        metadata: {
          maintenance_window_id: window.id,
          window_name: window.name,
          notification_type: type,
          start_time: window.start_time,
          end_time: window.end_time,
          affected_systems: window.affected_systems,
          suppress_all: window.suppress_all
        }
      };

      // Send to team members or all users
      if (window.team_id) {
        // Send to team members
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', window.team_id);

        if (teamMembers) {
          for (const member of teamMembers) {
            await supabase
              .from('notifications')
              .insert({
                recipient_id: member.user_id,
                ...notification
              });
          }
        }
      } else {
        // Send to all admin users
        const { data: adminUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin');

        if (adminUsers) {
          for (const user of adminUsers) {
            await supabase
              .from('notifications')
              .insert({
                recipient_id: user.id,
                ...notification
              });
          }
        }
      }

      console.log(`📢 Sent maintenance notification: ${window.name} - ${type}`);

    } catch (error) {
      console.error('Error sending maintenance notification:', error);
    }
  }

  /**
   * Generate recurring maintenance windows
   */
  private async generateRecurringWindows(window: MaintenanceWindow): Promise<void> {
    if (!window.recurring || !window.recurrence_config) {
      return;
    }

    const config = window.recurrence_config as RecurrenceConfig;
    const startTime = new Date(window.start_time);
    const endTime = new Date(window.end_time);
    const duration = endTime.getTime() - startTime.getTime();

    const maxOccurrences = config.max_occurrences || 52; // Default to 1 year of weekly occurrences
    const endDate = config.end_date ? new Date(config.end_date) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const recurringWindows: Omit<MaintenanceWindow, 'id' | 'created_at' | 'updated_at'>[] = [];

    for (let i = 1; i < maxOccurrences; i++) {
      const nextStartTime = this.calculateNextOccurrence(startTime, config, i);
      
      if (nextStartTime > endDate) {
        break;
      }

      const nextEndTime = new Date(nextStartTime.getTime() + duration);

      recurringWindows.push({
        name: `${window.name} (${i + 1})`,
        description: window.description,
        start_time: nextStartTime.toISOString(),
        end_time: nextEndTime.toISOString(),
        timezone: window.timezone,
        affected_systems: window.affected_systems,
        affected_severities: window.affected_severities,
        suppress_all: window.suppress_all,
        notify_before_minutes: window.notify_before_minutes,
        notify_after_completion: window.notify_after_completion,
        enabled: window.enabled,
        recurring: false, // Prevent infinite recursion
        recurrence_config: {},
        team_id: window.team_id,
        created_by: window.created_by
      });
    }

    if (recurringWindows.length > 0) {
      const { error } = await supabase
        .from('maintenance_windows')
        .insert(recurringWindows);

      if (error) {
        console.error('Error creating recurring windows:', error);
      } else {
        console.log(`📅 Generated ${recurringWindows.length} recurring maintenance windows`);
      }
    }
  }

  /**
   * Calculate next occurrence based on recurrence config
   */
  private calculateNextOccurrence(
    baseTime: Date, 
    config: RecurrenceConfig, 
    occurrence: number
  ): Date {
    const nextTime = new Date(baseTime);

    switch (config.type) {
      case 'daily':
        nextTime.setDate(nextTime.getDate() + (config.interval * occurrence));
        break;

      case 'weekly':
        nextTime.setDate(nextTime.getDate() + (7 * config.interval * occurrence));
        break;

      case 'monthly':
        nextTime.setMonth(nextTime.getMonth() + (config.interval * occurrence));
        break;

      default:
        // Custom logic would go here
        nextTime.setDate(nextTime.getDate() + (7 * occurrence)); // Default to weekly
    }

    return nextTime;
  }

  /**
   * Get notification title
   */
  private getNotificationTitle(window: MaintenanceWindow, type: string): string {
    switch (type) {
      case 'starting_soon':
        return `Maintenance Window Starting Soon: ${window.name}`;
      case 'started':
        return `Maintenance Window Started: ${window.name}`;
      case 'completed':
        return `Maintenance Window Completed: ${window.name}`;
      default:
        return `Maintenance Window: ${window.name}`;
    }
  }

  /**
   * Get notification message
   */
  private getNotificationMessage(window: MaintenanceWindow, type: string): string {
    const startTime = new Date(window.start_time).toLocaleString();
    const endTime = new Date(window.end_time).toLocaleString();

    switch (type) {
      case 'starting_soon':
        return `Maintenance window "${window.name}" will start at ${startTime}. ${window.suppress_all ? 'All alerts will be suppressed' : 'Some alerts may be suppressed'} during this period.`;
      case 'started':
        return `Maintenance window "${window.name}" has started and will end at ${endTime}. Alert suppression is now active.`;
      case 'completed':
        return `Maintenance window "${window.name}" has completed. Normal alert processing has resumed.`;
      default:
        return `Maintenance window "${window.name}" is scheduled from ${startTime} to ${endTime}.`;
    }
  }

  /**
   * Load maintenance windows from database
   */
  private async loadMaintenanceWindows(): Promise<void> {
    try {
      const now = new Date();
      const { data: windows } = await supabase
        .from('maintenance_windows')
        .select('*')
        .eq('enabled', true)
        .gte('end_time', now.toISOString())
        .order('start_time', { ascending: true });

      if (windows) {
        windows.forEach(window => this.updateWindowCache(window));
      }

      console.log(`📋 Loaded ${windows?.length || 0} maintenance windows`);
    } catch (error) {
      console.error('Error loading maintenance windows:', error);
    }
  }

  /**
   * Update window cache
   */
  private updateWindowCache(window: MaintenanceWindow): void {
    const now = new Date();
    const startTime = new Date(window.start_time);
    const endTime = new Date(window.end_time);

    if (now >= startTime && now <= endTime) {
      this.activeWindows.set(window.id, window);
      this.upcomingWindows.delete(window.id);
    } else if (startTime > now) {
      this.upcomingWindows.set(window.id, window);
      this.activeWindows.delete(window.id);
    } else {
      // Window has ended
      this.activeWindows.delete(window.id);
      this.upcomingWindows.delete(window.id);
    }
  }

  /**
   * Start maintenance monitoring
   */
  private startMaintenanceMonitoring(): void {
    // Check every minute for window transitions
    setInterval(() => {
      this.checkWindowTransitions();
    }, 60 * 1000);

    // Reload windows every hour
    setInterval(() => {
      this.loadMaintenanceWindows();
    }, 60 * 60 * 1000);
  }

  /**
   * Check for window transitions (starting/ending)
   */
  private checkWindowTransitions(): void {
    const now = new Date();

    // Check for windows that should start
    for (const [id, window] of this.upcomingWindows.entries()) {
      const startTime = new Date(window.start_time);
      if (now >= startTime) {
        this.activeWindows.set(id, window);
        this.upcomingWindows.delete(id);
        this.sendMaintenanceNotification(window, 'started');
        console.log(`🔧 Maintenance window started: ${window.name}`);
      }
    }

    // Check for windows that should end
    for (const [id, window] of this.activeWindows.entries()) {
      const endTime = new Date(window.end_time);
      if (now >= endTime) {
        this.activeWindows.delete(id);
        if (window.notify_after_completion) {
          this.sendMaintenanceNotification(window, 'completed');
        }
        console.log(`✅ Maintenance window completed: ${window.name}`);
      }
    }
  }

  /**
   * Get maintenance statistics
   */
  getMaintenanceStatistics(): {
    activeWindows: number;
    upcomingWindows: number;
    scheduledNotifications: number;
    totalSuppressedSystems: number;
  } {
    const totalSuppressedSystems = new Set();
    
    this.activeWindows.forEach(window => {
      window.affected_systems.forEach(system => totalSuppressedSystems.add(system));
    });

    return {
      activeWindows: this.activeWindows.size,
      upcomingWindows: this.upcomingWindows.size,
      scheduledNotifications: this.notificationTimers.size,
      totalSuppressedSystems: totalSuppressedSystems.size
    };
  }
}

// Export singleton instance
export const maintenanceWindowManager = new MaintenanceWindowManager();
