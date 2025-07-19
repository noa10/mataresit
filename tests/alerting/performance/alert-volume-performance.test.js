/**
 * Performance Tests for Alert Volume Handling
 * Tests system performance under various alert loads
 */

import { performance } from 'perf_hooks';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54331',
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || 'test-key',
  testDuration: 60000, // 1 minute
  alertBatches: [10, 50, 100, 500, 1000],
  concurrentUsers: [1, 5, 10, 20],
  performanceThresholds: {
    alertProcessingTime: 5000, // 5 seconds max
    notificationDeliveryTime: 30000, // 30 seconds max
    throughput: 100, // alerts per second
    errorRate: 0.01, // 1% max error rate
    memoryUsage: 512 * 1024 * 1024, // 512MB max
    cpuUsage: 80 // 80% max
  }
};

// Initialize Supabase client
const supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey);

// Performance monitoring utilities
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      alertsProcessed: 0,
      alertsSuccessful: 0,
      alertsFailed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      peakProcessingTime: 0,
      notificationsDelivered: 0,
      notificationsFailed: 0,
      memoryUsage: [],
      cpuUsage: [],
      errors: []
    };
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = performance.now();
    this.startMemoryMonitoring();
  }

  stop() {
    this.endTime = performance.now();
    this.stopMemoryMonitoring();
    this.calculateAverages();
  }

  recordAlert(processingTime, success = true) {
    this.metrics.alertsProcessed++;
    if (success) {
      this.metrics.alertsSuccessful++;
    } else {
      this.metrics.alertsFailed++;
    }
    
    this.metrics.totalProcessingTime += processingTime;
    if (processingTime > this.metrics.peakProcessingTime) {
      this.metrics.peakProcessingTime = processingTime;
    }
  }

  recordNotification(success = true) {
    if (success) {
      this.metrics.notificationsDelivered++;
    } else {
      this.metrics.notificationsFailed++;
    }
  }

  recordError(error) {
    this.metrics.errors.push({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack
    });
  }

  startMemoryMonitoring() {
    this.memoryInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      });
    }, 1000);
  }

  stopMemoryMonitoring() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
  }

  calculateAverages() {
    if (this.metrics.alertsProcessed > 0) {
      this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.alertsProcessed;
    }
  }

  getReport() {
    const duration = this.endTime - this.startTime;
    const throughput = (this.metrics.alertsProcessed / duration) * 1000; // alerts per second
    const errorRate = this.metrics.alertsFailed / this.metrics.alertsProcessed;
    const successRate = this.metrics.alertsSuccessful / this.metrics.alertsProcessed;

    return {
      duration,
      throughput,
      errorRate,
      successRate,
      ...this.metrics,
      thresholdViolations: this.checkThresholds()
    };
  }

  checkThresholds() {
    const violations = [];
    
    if (this.metrics.averageProcessingTime > TEST_CONFIG.performanceThresholds.alertProcessingTime) {
      violations.push(`Average processing time (${this.metrics.averageProcessingTime}ms) exceeds threshold (${TEST_CONFIG.performanceThresholds.alertProcessingTime}ms)`);
    }
    
    if (this.metrics.peakProcessingTime > TEST_CONFIG.performanceThresholds.alertProcessingTime * 2) {
      violations.push(`Peak processing time (${this.metrics.peakProcessingTime}ms) exceeds threshold (${TEST_CONFIG.performanceThresholds.alertProcessingTime * 2}ms)`);
    }
    
    const errorRate = this.metrics.alertsFailed / this.metrics.alertsProcessed;
    if (errorRate > TEST_CONFIG.performanceThresholds.errorRate) {
      violations.push(`Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(TEST_CONFIG.performanceThresholds.errorRate * 100).toFixed(2)}%)`);
    }

    return violations;
  }
}

// Test data generators
function generateTestAlertRule(index) {
  return {
    name: `Performance Test Rule ${index}`,
    description: `Generated rule for performance testing`,
    team_id: 'perf-test-team',
    metric_name: `test_metric_${index}`,
    condition_type: 'threshold',
    threshold_value: 80,
    threshold_operator: 'greater_than',
    evaluation_window_minutes: 1,
    evaluation_frequency_minutes: 1,
    consecutive_failures_required: 1,
    severity: ['low', 'medium', 'high', 'critical'][index % 4],
    enabled: true,
    cooldown_minutes: 5,
    max_alerts_per_hour: 100,
    created_by: 'perf-test-user'
  };
}

function generateTestAlert(ruleId, index) {
  return {
    alert_rule_id: ruleId,
    team_id: 'perf-test-team',
    severity: ['low', 'medium', 'high', 'critical'][index % 4],
    status: 'active',
    message: `Performance test alert ${index}`,
    metric_value: 85 + (index % 15),
    triggered_at: new Date().toISOString()
  };
}

function generateTestNotificationChannel(index) {
  return {
    name: `Perf Test Channel ${index}`,
    description: 'Channel for performance testing',
    channel_type: ['email', 'webhook', 'slack'][index % 3],
    enabled: true,
    configuration: {
      recipients: [`test${index}@example.com`],
      url: `https://httpbin.org/post?channel=${index}`,
      webhook_url: `https://hooks.slack.com/test/${index}`
    },
    max_notifications_per_hour: 1000,
    max_notifications_per_day: 10000,
    created_by: 'perf-test-user',
    team_id: 'perf-test-team'
  };
}

// Performance test functions
async function testAlertCreationPerformance(alertCount) {
  console.log(`Testing alert creation performance with ${alertCount} alerts...`);
  
  const monitor = new PerformanceMonitor();
  monitor.start();

  // Create test alert rule
  const { data: alertRule } = await supabase
    .from('alert_rules')
    .insert(generateTestAlertRule(1))
    .select()
    .single();

  // Create alerts in batches
  const batchSize = 50;
  const batches = Math.ceil(alertCount / batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = performance.now();
    const currentBatchSize = Math.min(batchSize, alertCount - (batch * batchSize));
    
    const alerts = Array.from({ length: currentBatchSize }, (_, i) => 
      generateTestAlert(alertRule.id, batch * batchSize + i)
    );

    try {
      const { data, error } = await supabase
        .from('alerts')
        .insert(alerts)
        .select();

      const batchTime = performance.now() - batchStart;
      
      if (error) {
        monitor.recordError(new Error(`Batch ${batch} failed: ${error.message}`));
        alerts.forEach(() => monitor.recordAlert(batchTime / currentBatchSize, false));
      } else {
        data.forEach(() => monitor.recordAlert(batchTime / currentBatchSize, true));
      }
    } catch (err) {
      monitor.recordError(err);
      alerts.forEach(() => monitor.recordAlert(0, false));
    }
  }

  monitor.stop();
  
  // Cleanup
  await supabase.from('alerts').delete().eq('alert_rule_id', alertRule.id);
  await supabase.from('alert_rules').delete().eq('id', alertRule.id);

  return monitor.getReport();
}

async function testNotificationDeliveryPerformance(notificationCount) {
  console.log(`Testing notification delivery performance with ${notificationCount} notifications...`);
  
  const monitor = new PerformanceMonitor();
  monitor.start();

  // Create test channels
  const channels = await Promise.all(
    Array.from({ length: 5 }, (_, i) => 
      supabase
        .from('notification_channels')
        .insert(generateTestNotificationChannel(i))
        .select()
        .single()
    )
  );

  // Create test alert
  const { data: alertRule } = await supabase
    .from('alert_rules')
    .insert(generateTestAlertRule(1))
    .select()
    .single();

  const { data: alert } = await supabase
    .from('alerts')
    .insert(generateTestAlert(alertRule.id, 1))
    .select()
    .single();

  // Send notifications
  const notificationPromises = Array.from({ length: notificationCount }, async (_, i) => {
    const notificationStart = performance.now();
    const channel = channels.data[i % channels.length];
    
    try {
      // Simulate notification delivery
      const deliveryTime = Math.random() * 2000 + 500; // 500-2500ms
      await new Promise(resolve => setTimeout(resolve, deliveryTime));
      
      const notificationTime = performance.now() - notificationStart;
      monitor.recordNotification(true);
      
      return { success: true, time: notificationTime };
    } catch (err) {
      monitor.recordError(err);
      monitor.recordNotification(false);
      return { success: false, error: err.message };
    }
  });

  await Promise.all(notificationPromises);
  monitor.stop();

  // Cleanup
  await supabase.from('alerts').delete().eq('id', alert.data.id);
  await supabase.from('alert_rules').delete().eq('id', alertRule.id);
  await Promise.all(channels.map(channel => 
    supabase.from('notification_channels').delete().eq('id', channel.data.id)
  ));

  return monitor.getReport();
}

async function testConcurrentAlertProcessing(concurrentUsers, alertsPerUser) {
  console.log(`Testing concurrent processing with ${concurrentUsers} users, ${alertsPerUser} alerts each...`);
  
  const monitor = new PerformanceMonitor();
  monitor.start();

  // Create user simulation functions
  const userSimulations = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
    const userStart = performance.now();
    
    // Create alert rule for this user
    const { data: alertRule } = await supabase
      .from('alert_rules')
      .insert(generateTestAlertRule(userIndex))
      .select()
      .single();

    // Create alerts for this user
    const userAlerts = Array.from({ length: alertsPerUser }, (_, alertIndex) => 
      generateTestAlert(alertRule.id, alertIndex)
    );

    try {
      const { data, error } = await supabase
        .from('alerts')
        .insert(userAlerts)
        .select();

      const userTime = performance.now() - userStart;
      
      if (error) {
        monitor.recordError(new Error(`User ${userIndex} failed: ${error.message}`));
        userAlerts.forEach(() => monitor.recordAlert(userTime / alertsPerUser, false));
      } else {
        data.forEach(() => monitor.recordAlert(userTime / alertsPerUser, true));
      }

      // Cleanup user data
      await supabase.from('alerts').delete().eq('alert_rule_id', alertRule.id);
      await supabase.from('alert_rules').delete().eq('id', alertRule.id);

      return { userIndex, success: true, time: userTime };
    } catch (err) {
      monitor.recordError(err);
      userAlerts.forEach(() => monitor.recordAlert(0, false));
      return { userIndex, success: false, error: err.message };
    }
  });

  await Promise.all(userSimulations);
  monitor.stop();

  return monitor.getReport();
}

async function testSystemStressTest(duration = 60000) {
  console.log(`Running system stress test for ${duration}ms...`);
  
  const monitor = new PerformanceMonitor();
  monitor.start();

  const endTime = Date.now() + duration;
  let operationCount = 0;

  while (Date.now() < endTime) {
    const operationStart = performance.now();
    
    try {
      // Mix of operations
      const operation = operationCount % 4;
      
      switch (operation) {
        case 0: // Create alert rule
          const { data: rule } = await supabase
            .from('alert_rules')
            .insert(generateTestAlertRule(operationCount))
            .select()
            .single();
          
          // Clean up immediately
          await supabase.from('alert_rules').delete().eq('id', rule.id);
          break;
          
        case 1: // Create and delete alert
          const { data: alertRule } = await supabase
            .from('alert_rules')
            .insert(generateTestAlertRule(operationCount))
            .select()
            .single();
          
          const { data: alert } = await supabase
            .from('alerts')
            .insert(generateTestAlert(alertRule.id, operationCount))
            .select()
            .single();
          
          await supabase.from('alerts').delete().eq('id', alert.id);
          await supabase.from('alert_rules').delete().eq('id', alertRule.id);
          break;
          
        case 2: // Query alerts
          await supabase
            .from('alerts')
            .select('*')
            .eq('team_id', 'perf-test-team')
            .limit(10);
          break;
          
        case 3: // Query alert statistics
          await supabase.rpc('get_alert_statistics', { team_id: 'perf-test-team' });
          break;
      }
      
      const operationTime = performance.now() - operationStart;
      monitor.recordAlert(operationTime, true);
      
    } catch (err) {
      const operationTime = performance.now() - operationStart;
      monitor.recordError(err);
      monitor.recordAlert(operationTime, false);
    }
    
    operationCount++;
    
    // Small delay to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  monitor.stop();
  return monitor.getReport();
}

// Main test runner
async function runPerformanceTests() {
  console.log('Starting alerting system performance tests...\n');
  
  const results = {
    alertCreation: {},
    notificationDelivery: {},
    concurrentProcessing: {},
    stressTest: null
  };

  try {
    // Test alert creation performance with different volumes
    for (const alertCount of TEST_CONFIG.alertBatches) {
      results.alertCreation[alertCount] = await testAlertCreationPerformance(alertCount);
      console.log(`Alert creation (${alertCount}): ${results.alertCreation[alertCount].throughput.toFixed(2)} alerts/sec\n`);
    }

    // Test notification delivery performance
    for (const notificationCount of [100, 500, 1000]) {
      results.notificationDelivery[notificationCount] = await testNotificationDeliveryPerformance(notificationCount);
      console.log(`Notification delivery (${notificationCount}): ${results.notificationDelivery[notificationCount].notificationsDelivered} delivered\n`);
    }

    // Test concurrent processing
    for (const userCount of TEST_CONFIG.concurrentUsers) {
      results.concurrentProcessing[userCount] = await testConcurrentAlertProcessing(userCount, 20);
      console.log(`Concurrent processing (${userCount} users): ${results.concurrentProcessing[userCount].throughput.toFixed(2)} alerts/sec\n`);
    }

    // Run stress test
    results.stressTest = await testSystemStressTest(TEST_CONFIG.testDuration);
    console.log(`Stress test: ${results.stressTest.throughput.toFixed(2)} operations/sec\n`);

    // Generate performance report
    generatePerformanceReport(results);

  } catch (error) {
    console.error('Performance test failed:', error);
    process.exit(1);
  }
}

function generatePerformanceReport(results) {
  console.log('\n=== PERFORMANCE TEST REPORT ===\n');
  
  // Alert Creation Performance
  console.log('Alert Creation Performance:');
  Object.entries(results.alertCreation).forEach(([count, result]) => {
    console.log(`  ${count} alerts: ${result.throughput.toFixed(2)} alerts/sec, ${result.averageProcessingTime.toFixed(2)}ms avg`);
    if (result.thresholdViolations.length > 0) {
      console.log(`    ⚠️  Violations: ${result.thresholdViolations.join(', ')}`);
    }
  });
  
  // Notification Delivery Performance
  console.log('\nNotification Delivery Performance:');
  Object.entries(results.notificationDelivery).forEach(([count, result]) => {
    const successRate = (result.successRate * 100).toFixed(2);
    console.log(`  ${count} notifications: ${result.notificationsDelivered} delivered (${successRate}% success)`);
  });
  
  // Concurrent Processing Performance
  console.log('\nConcurrent Processing Performance:');
  Object.entries(results.concurrentProcessing).forEach(([users, result]) => {
    console.log(`  ${users} users: ${result.throughput.toFixed(2)} alerts/sec, ${(result.successRate * 100).toFixed(2)}% success`);
  });
  
  // Stress Test Results
  console.log('\nStress Test Results:');
  const stressResult = results.stressTest;
  console.log(`  Duration: ${(stressResult.duration / 1000).toFixed(2)}s`);
  console.log(`  Operations: ${stressResult.alertsProcessed}`);
  console.log(`  Throughput: ${stressResult.throughput.toFixed(2)} ops/sec`);
  console.log(`  Success Rate: ${(stressResult.successRate * 100).toFixed(2)}%`);
  console.log(`  Average Processing Time: ${stressResult.averageProcessingTime.toFixed(2)}ms`);
  console.log(`  Peak Processing Time: ${stressResult.peakProcessingTime.toFixed(2)}ms`);
  
  if (stressResult.thresholdViolations.length > 0) {
    console.log(`  ⚠️  Threshold Violations:`);
    stressResult.thresholdViolations.forEach(violation => {
      console.log(`    - ${violation}`);
    });
  }
  
  console.log('\n=== END REPORT ===\n');
}

// Run tests if this file is executed directly
runPerformanceTests()
  .then(() => {
    console.log('Performance tests completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Performance tests failed:', error);
    process.exit(1);
  });

export {
  testAlertCreationPerformance,
  testNotificationDeliveryPerformance,
  testConcurrentAlertProcessing,
  testSystemStressTest,
  runPerformanceTests
};
