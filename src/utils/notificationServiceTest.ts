/**
 * 🔧 Test utility to validate notification service fixes
 * This file helps test the stack overflow fix and ensures proper cleanup
 */

import { notificationService } from '@/services/notificationService';

export interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/**
 * Test the notification service for stack overflow issues
 */
export async function testNotificationServiceStability(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  console.log('🧪 Starting notification service stability tests...');

  // Test 1: Quick real-time test (the problematic method)
  const test1Start = Date.now();
  try {
    console.log('🧪 Test 1: Quick real-time connection test');
    const result = await notificationService.quickRealTimeTest();
    results.push({
      testName: 'Quick Real-time Test',
      passed: true,
      duration: Date.now() - test1Start
    });
    console.log(`✅ Test 1 passed: ${result ? 'Connected' : 'Not connected'}`);
  } catch (error) {
    results.push({
      testName: 'Quick Real-time Test',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - test1Start
    });
    console.error('❌ Test 1 failed:', error);
  }

  // Test 2: Multiple rapid connection tests (stress test)
  const test2Start = Date.now();
  try {
    console.log('🧪 Test 2: Multiple rapid connection tests');
    const promises = Array.from({ length: 5 }, (_, i) => 
      notificationService.quickRealTimeTest()
    );
    
    await Promise.all(promises);
    results.push({
      testName: 'Multiple Rapid Tests',
      passed: true,
      duration: Date.now() - test2Start
    });
    console.log('✅ Test 2 passed: Multiple rapid tests completed');
  } catch (error) {
    results.push({
      testName: 'Multiple Rapid Tests',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - test2Start
    });
    console.error('❌ Test 2 failed:', error);
  }

  // Test 3: Connection state management
  const test3Start = Date.now();
  try {
    console.log('🧪 Test 3: Connection state management');
    const connectionState = notificationService.getConnectionState();
    const monitoringDashboard = notificationService.getMonitoringDashboard();
    
    results.push({
      testName: 'Connection State Management',
      passed: true,
      duration: Date.now() - test3Start
    });
    console.log('✅ Test 3 passed: Connection state accessible');
    console.log('📊 Connection state:', connectionState);
    console.log('📊 Monitoring dashboard:', monitoringDashboard);
  } catch (error) {
    results.push({
      testName: 'Connection State Management',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - test3Start
    });
    console.error('❌ Test 3 failed:', error);
  }

  // Test 4: Cleanup functionality
  const test4Start = Date.now();
  try {
    console.log('🧪 Test 4: Cleanup functionality');
    
    // Test cleanup without causing issues
    notificationService.cleanup();
    
    results.push({
      testName: 'Cleanup Functionality',
      passed: true,
      duration: Date.now() - test4Start
    });
    console.log('✅ Test 4 passed: Cleanup completed successfully');
  } catch (error) {
    results.push({
      testName: 'Cleanup Functionality',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - test4Start
    });
    console.error('❌ Test 4 failed:', error);
  }

  // Summary
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  console.log(`\n🧪 Test Summary: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('✅ All tests passed! Stack overflow fix appears to be working.');
  } else {
    console.log('❌ Some tests failed. Please review the errors above.');
  }

  return results;
}

/**
 * Test notification service in development mode
 */
export function runDevelopmentTests(): void {
  if (import.meta.env.DEV) {
    console.log('🔧 Development mode detected, running notification service tests...');
    
    // Add test functions to window for manual testing
    (window as any).testNotificationService = {
      runStabilityTests: testNotificationServiceStability,
      getConnectionState: () => notificationService.getConnectionState(),
      getMonitoringDashboard: () => notificationService.getMonitoringDashboard(),
      cleanup: () => notificationService.cleanup(),
      quickTest: () => notificationService.quickRealTimeTest()
    };
    
    console.log('🔧 Test functions available at window.testNotificationService');
    console.log('🔧 Run window.testNotificationService.runStabilityTests() to test the fix');
  }
}

// Auto-run in development
if (import.meta.env.DEV) {
  // Delay to ensure notification service is initialized
  setTimeout(() => {
    runDevelopmentTests();
  }, 1000);
}
