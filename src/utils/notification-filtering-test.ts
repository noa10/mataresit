import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/services/notificationService';
import { shouldShowNotificationWithPreferences } from '@/types/notifications';
import type { NotificationPreferences, Notification } from '@/types/notifications';

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export class NotificationFilteringTester {
  private userId: string;
  private originalPreferences: NotificationPreferences | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
      // Save original preferences
      this.originalPreferences = await notificationService.getUserNotificationPreferences();

      // Run individual tests
      results.push(await this.testProcessingStartedFiltering());
      results.push(await this.testReadyForReviewFiltering());
      results.push(await this.testPushDisabledFiltering());
      results.push(await this.testIndividualTypeFiltering());
      results.push(await this.testServerClientConsistency());

    } catch (error) {
      results.push({
        testName: 'Test Setup',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      // Restore original preferences
      if (this.originalPreferences) {
        await notificationService.updateNotificationPreferences(this.originalPreferences);
      }
    }

    return results;
  }

  private async testProcessingStartedFiltering(): Promise<TestResult> {
    try {
      // Create a processing_started notification
      const testNotificationId = await notificationService.createNotification(
        this.userId,
        'receipt_processing_started',
        'Test Processing Started',
        'This notification should never appear in the panel',
        {
          priority: 'low',
          metadata: { testId: 'filter-test-processing-started' }
        }
      );

      // Wait for notification to be created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the notification
      const { data: notification } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', testNotificationId)
        .single();

      if (!notification) {
        return {
          testName: 'Processing Started Filtering',
          passed: false,
          error: 'Failed to create test notification'
        };
      }

      // Test client-side filtering
      const shouldShow = shouldShowNotificationWithPreferences(
        notification as Notification,
        this.originalPreferences || undefined
      );

      // Clean up test notification
      await supabase.from('notifications').delete().eq('id', testNotificationId);

      return {
        testName: 'Processing Started Filtering',
        passed: !shouldShow,
        error: shouldShow ? 'receipt_processing_started notification should be filtered out' : undefined,
        details: { shouldShow, notificationType: notification.type }
      };

    } catch (error) {
      return {
        testName: 'Processing Started Filtering',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testReadyForReviewFiltering(): Promise<TestResult> {
    try {
      // Test that "ready for review" notifications are no longer created
      // Since we removed the duplicate notification creation, these should not exist

      // Check recent notifications for any "ready for review" types
      const { data: recentNotifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', this.userId)
        .eq('type', 'receipt_ready_for_review')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false });

      const hasRecentReadyForReview = (recentNotifications || []).length > 0;

      return {
        testName: 'Ready for Review Filtering',
        passed: !hasRecentReadyForReview,
        error: hasRecentReadyForReview ?
          `Found ${recentNotifications?.length} recent "ready for review" notifications - these should no longer be created` :
          undefined,
        details: {
          recentCount: recentNotifications?.length || 0,
          message: hasRecentReadyForReview ?
            'Ready for review notifications are still being created' :
            'No ready for review notifications found - duplicate creation successfully removed'
        }
      };

    } catch (error) {
      return {
        testName: 'Ready for Review Filtering',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testPushDisabledFiltering(): Promise<TestResult> {
    try {
      if (!this.originalPreferences) {
        throw new Error('Original preferences not available');
      }

      // Create a test notification
      const testNotificationId = await notificationService.createNotification(
        this.userId,
        'receipt_processing_completed',
        'Test Push Disabled Filtering',
        'This notification should be hidden when push is disabled',
        {
          priority: 'medium',
          metadata: { testId: 'filter-test-push-disabled' }
        }
      );

      // Get the notification
      const { data: notification } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', testNotificationId)
        .single();

      if (!notification) {
        throw new Error('Failed to create test notification');
      }

      // Test with push_enabled = false
      const shouldShowWithPushDisabled = shouldShowNotificationWithPreferences(
        notification as Notification,
        { ...this.originalPreferences, push_enabled: false }
      );

      // Test with push_enabled = true
      const shouldShowWithPushEnabled = shouldShowNotificationWithPreferences(
        notification as Notification,
        { ...this.originalPreferences, push_enabled: true }
      );

      // Clean up test notification
      await supabase.from('notifications').delete().eq('id', testNotificationId);

      const passed = !shouldShowWithPushDisabled && shouldShowWithPushEnabled;

      return {
        testName: 'Push Disabled Global Filtering',
        passed,
        error: passed ? undefined : 'Push disabled filtering not working correctly',
        details: {
          shouldShowWithPushDisabled,
          shouldShowWithPushEnabled,
          notificationType: notification.type
        }
      };

    } catch (error) {
      return {
        testName: 'Push Disabled Global Filtering',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testIndividualTypeFiltering(): Promise<TestResult> {
    try {
      if (!this.originalPreferences) {
        throw new Error('Original preferences not available');
      }

      // Create a test notification
      const testNotificationId = await notificationService.createNotification(
        this.userId,
        'receipt_processing_completed',
        'Test Individual Type Filtering',
        'This notification should be hidden when its type is disabled',
        {
          priority: 'medium',
          metadata: { testId: 'filter-test-individual-type' }
        }
      );

      // Get the notification
      const { data: notification } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', testNotificationId)
        .single();

      if (!notification) {
        throw new Error('Failed to create test notification');
      }

      // Test with specific type disabled
      const shouldShowWithTypeDisabled = shouldShowNotificationWithPreferences(
        notification as Notification,
        { ...this.originalPreferences, push_receipt_processing_completed: false }
      );

      // Test with specific type enabled
      const shouldShowWithTypeEnabled = shouldShowNotificationWithPreferences(
        notification as Notification,
        { ...this.originalPreferences, push_receipt_processing_completed: true }
      );

      // Clean up test notification
      await supabase.from('notifications').delete().eq('id', testNotificationId);

      const passed = !shouldShowWithTypeDisabled && shouldShowWithTypeEnabled;

      return {
        testName: 'Individual Type Filtering',
        passed,
        error: passed ? undefined : 'Individual type filtering not working correctly',
        details: {
          shouldShowWithTypeDisabled,
          shouldShowWithTypeEnabled,
          notificationType: notification.type
        }
      };

    } catch (error) {
      return {
        testName: 'Individual Type Filtering',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testServerClientConsistency(): Promise<TestResult> {
    try {
      const testTypes = [
        'receipt_processing_completed',
        'receipt_processing_failed',
        'receipt_batch_completed'
      ];

      const inconsistencies: string[] = [];

      for (const notificationType of testTypes) {
        // Create test notification
        const testNotificationId = await notificationService.createNotification(
          this.userId,
          notificationType as any,
          `Test ${notificationType}`,
          `Testing consistency for ${notificationType}`,
          {
            priority: 'medium',
            metadata: { testId: `consistency-test-${notificationType}` }
          }
        );

        // Get the notification
        const { data: notification } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', testNotificationId)
          .single();

        if (notification) {
          // Test client-side filtering
          const clientResult = shouldShowNotificationWithPreferences(
            notification as Notification,
            this.originalPreferences || undefined
          );

          // Test server-side filtering
          try {
            const { data: serverResult, error } = await supabase.functions.invoke('test-notification-filtering', {
              body: {
                notificationType,
                userId: this.userId
              }
            });

            if (error) {
              console.warn(`Server-side test failed for ${notificationType}:`, error);
            } else if (clientResult !== serverResult?.inAppEnabled) {
              inconsistencies.push(`${notificationType}: client=${clientResult}, server=${serverResult?.inAppEnabled}`);
            }
          } catch (serverError) {
            console.warn(`Server-side test error for ${notificationType}:`, serverError);
          }
        }

        // Clean up test notification
        await supabase.from('notifications').delete().eq('id', testNotificationId);
      }

      return {
        testName: 'Server-Client Filtering Consistency',
        passed: inconsistencies.length === 0,
        error: inconsistencies.length > 0 ? `Inconsistencies found: ${inconsistencies.join(', ')}` : undefined,
        details: { inconsistencies, testedTypes: testTypes }
      };

    } catch (error) {
      return {
        testName: 'Server-Client Filtering Consistency',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export a function to run tests from the browser console
export async function runNotificationFilteringTests(userId: string): Promise<void> {
  console.log('🧪 Starting Notification Filtering Tests...');
  
  const tester = new NotificationFilteringTester(userId);
  const results = await tester.runAllTests();

  console.log('\n📊 Test Results:');
  console.log('================');

  let passedCount = 0;
  let failedCount = 0;

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.testName}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.details) {
      console.log(`   Details:`, result.details);
    }
    
    console.log('');

    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  });

  console.log(`📈 Summary: ${passedCount} passed, ${failedCount} failed`);
  
  if (failedCount === 0) {
    console.log('🎉 All notification filtering tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }
}

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).runNotificationFilteringTests = runNotificationFilteringTests;
}
