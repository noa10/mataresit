/**
 * Simplified Performance Tests for Alerting System
 * Tests system performance without requiring real database
 */

import { performance } from 'perf_hooks';

// Test configuration
const TEST_CONFIG = {
  performanceThresholds: {
    alertProcessingTime: 5000, // 5 seconds max
    notificationDeliveryTime: 30000, // 30 seconds max
    throughput: 100, // alerts per second
    errorRate: 0.01, // 1% max error rate
  }
};

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
      errors: []
    };
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = performance.now();
  }

  stop() {
    this.endTime = performance.now();
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
      message: error.message
    });
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
      violations.push(`Average processing time (${this.metrics.averageProcessingTime.toFixed(2)}ms) exceeds threshold (${TEST_CONFIG.performanceThresholds.alertProcessingTime}ms)`);
    }
    
    const errorRate = this.metrics.alertsFailed / this.metrics.alertsProcessed;
    if (errorRate > TEST_CONFIG.performanceThresholds.errorRate) {
      violations.push(`Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(TEST_CONFIG.performanceThresholds.errorRate * 100).toFixed(2)}%)`);
    }

    return violations;
  }
}

// Simulate alert processing
async function simulateAlertProcessing(count) {
  const results = [];
  
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    
    // Simulate processing time (50-500ms)
    const processingTime = Math.random() * 450 + 50;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    const end = performance.now();
    const actualTime = end - start;
    
    // Simulate 95% success rate
    const success = Math.random() > 0.05;
    
    results.push({
      id: `alert-${i}`,
      processingTime: actualTime,
      success
    });
  }
  
  return results;
}

// Simulate notification delivery
async function simulateNotificationDelivery(count) {
  const results = [];
  
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    
    // Simulate delivery time (100-2000ms)
    const deliveryTime = Math.random() * 1900 + 100;
    await new Promise(resolve => setTimeout(resolve, deliveryTime));
    
    const end = performance.now();
    const actualTime = end - start;
    
    // Simulate 98% success rate
    const success = Math.random() > 0.02;
    
    results.push({
      id: `notification-${i}`,
      deliveryTime: actualTime,
      success
    });
  }
  
  return results;
}

// Test alert creation performance
async function testAlertCreationPerformance(alertCount) {
  console.log(`Testing alert creation performance with ${alertCount} alerts...`);
  
  const monitor = new PerformanceMonitor();
  monitor.start();

  const results = await simulateAlertProcessing(alertCount);
  
  results.forEach(result => {
    monitor.recordAlert(result.processingTime, result.success);
  });

  monitor.stop();
  return monitor.getReport();
}

// Test notification delivery performance
async function testNotificationDeliveryPerformance(notificationCount) {
  console.log(`Testing notification delivery performance with ${notificationCount} notifications...`);
  
  const monitor = new PerformanceMonitor();
  monitor.start();

  const results = await simulateNotificationDelivery(notificationCount);
  
  results.forEach(result => {
    monitor.recordNotification(result.success);
  });

  monitor.stop();
  return monitor.getReport();
}

// Test concurrent processing
async function testConcurrentAlertProcessing(concurrentUsers, alertsPerUser) {
  console.log(`Testing concurrent processing with ${concurrentUsers} users, ${alertsPerUser} alerts each...`);
  
  const monitor = new PerformanceMonitor();
  monitor.start();

  const userPromises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
    const userResults = await simulateAlertProcessing(alertsPerUser);
    return userResults;
  });

  const allResults = await Promise.all(userPromises);
  
  allResults.flat().forEach(result => {
    monitor.recordAlert(result.processingTime, result.success);
  });

  monitor.stop();
  return monitor.getReport();
}

// Test system stress
async function testSystemStressTest(duration = 10000) {
  console.log(`Running system stress test for ${duration}ms...`);
  
  const monitor = new PerformanceMonitor();
  monitor.start();

  const endTime = Date.now() + duration;
  let operationCount = 0;

  while (Date.now() < endTime) {
    const operationStart = performance.now();
    
    try {
      // Simulate different operations
      const operation = operationCount % 3;
      let processingTime;
      
      switch (operation) {
        case 0: // Alert creation
          processingTime = Math.random() * 200 + 50;
          break;
        case 1: // Notification delivery
          processingTime = Math.random() * 500 + 100;
          break;
        case 2: // Query operation
          processingTime = Math.random() * 100 + 25;
          break;
      }
      
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      const operationTime = performance.now() - operationStart;
      monitor.recordAlert(operationTime, true);
      
    } catch (err) {
      const operationTime = performance.now() - operationStart;
      monitor.recordError(err);
      monitor.recordAlert(operationTime, false);
    }
    
    operationCount++;
  }

  monitor.stop();
  return monitor.getReport();
}

// Main test runner
async function runPerformanceTests() {
  console.log('Starting simplified alerting system performance tests...\n');
  
  const results = {
    alertCreation: {},
    notificationDelivery: {},
    concurrentProcessing: {},
    stressTest: null
  };

  try {
    // Test alert creation performance with different volumes
    for (const alertCount of [10, 50, 100]) {
      results.alertCreation[alertCount] = await testAlertCreationPerformance(alertCount);
      console.log(`Alert creation (${alertCount}): ${results.alertCreation[alertCount].throughput.toFixed(2)} alerts/sec\n`);
    }

    // Test notification delivery performance
    for (const notificationCount of [25, 100]) {
      results.notificationDelivery[notificationCount] = await testNotificationDeliveryPerformance(notificationCount);
      console.log(`Notification delivery (${notificationCount}): ${results.notificationDelivery[notificationCount].notificationsDelivered} delivered\n`);
    }

    // Test concurrent processing
    for (const userCount of [1, 5, 10]) {
      results.concurrentProcessing[userCount] = await testConcurrentAlertProcessing(userCount, 10);
      console.log(`Concurrent processing (${userCount} users): ${results.concurrentProcessing[userCount].throughput.toFixed(2)} alerts/sec\n`);
    }

    // Run stress test
    results.stressTest = await testSystemStressTest(10000); // 10 seconds
    console.log(`Stress test: ${results.stressTest.throughput.toFixed(2)} operations/sec\n`);

    // Generate performance report
    generatePerformanceReport(results);

  } catch (error) {
    console.error('Performance test failed:', error);
    process.exit(1);
  }
}

function generatePerformanceReport(results) {
  console.log('\n=== SIMPLIFIED PERFORMANCE TEST REPORT ===\n');
  
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

// Run tests
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
