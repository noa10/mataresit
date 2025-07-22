/**
 * Peak Usage Load Tests
 * 
 * This test suite simulates peak usage scenarios with 50 concurrent users
 * performing typical batch upload operations during peak hours.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam } from '../setup/test-setup';
import { LoadTestRunner } from './load-test-runner';
import { PEAK_USAGE_CONFIG, LOAD_TEST_VALIDATION } from './load-test-config';

describe('Peak Usage Load Tests', () => {
  setupTestSuite('Peak Usage Load Testing');
  setupTest();

  let loadTestRunner: LoadTestRunner;
  let testUser: any;
  let testTeam: any;

  beforeAll(async () => {
    const { user } = await createTestUser('peak-load-test@example.com');
    const team = await createTestTeam(user.id, 'Peak Load Test Team');
    
    testUser = user;
    testTeam = team;
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset mock services for consistent load testing
    testState.mockServices.geminiMock.reset();
    testState.mockServices.openrouterMock.reset();
    testState.mockServices.rateLimitSimulator.clearSimulations();
    
    // Initialize load test runner
    loadTestRunner = new LoadTestRunner(testState);
  });

  afterEach(async () => {
    // Cleanup any remaining test data
    const testState = getTestState();
    await testState.utilities.cleanup();
  });

  describe('Peak Usage Simulation', () => {
    it('should handle 50 concurrent users during peak hours', async () => {
      console.log('\n🚀 Starting Peak Usage Load Test');
      console.log('Scenario: 50 concurrent users with typical batch upload patterns');
      
      // Run peak usage load test
      const results = await loadTestRunner.runLoadTest(PEAK_USAGE_CONFIG);
      
      // Validate load test results against criteria
      const validation = LOAD_TEST_VALIDATION.peakUsage;
      
      // Assert throughput requirements
      expect(results.throughput).toBeGreaterThan(validation.minThroughput);
      console.log(`✅ Throughput: ${results.throughput.toFixed(1)} requests/min (target: >${validation.minThroughput})`);
      
      // Assert error rate requirements
      expect(results.errorRate).toBeLessThan(validation.maxErrorRate);
      console.log(`✅ Error Rate: ${(results.errorRate * 100).toFixed(1)}% (target: <${validation.maxErrorRate * 100}%)`);
      
      // Assert response time requirements
      const avgResponseTime = results.totalResponseTime / results.totalRequests;
      expect(avgResponseTime).toBeLessThan(validation.maxResponseTime);
      console.log(`✅ Avg Response Time: ${avgResponseTime.toFixed(0)}ms (target: <${validation.maxResponseTime}ms)`);
      
      // Assert system stability
      const maxCpuUsage = Math.max(...results.systemHealth.map(h => h.cpuUsage));
      const maxMemoryUsage = Math.max(...results.systemHealth.map(h => h.memoryUsage));
      
      expect(maxCpuUsage).toBeLessThan(validation.resourceUtilization);
      expect(maxMemoryUsage).toBeLessThan(validation.resourceUtilization);
      
      console.log(`✅ Max CPU Usage: ${(maxCpuUsage * 100).toFixed(1)}% (target: <${validation.resourceUtilization * 100}%)`);
      console.log(`✅ Max Memory Usage: ${(maxMemoryUsage * 100).toFixed(1)}% (target: <${validation.resourceUtilization * 100}%)`);
      
      // Validate user distribution
      const activeUsers = results.userMetrics.filter(u => u.requestCount > 0);
      expect(activeUsers.length).toBe(50);
      
      // Validate request distribution
      const avgRequestsPerUser = results.totalRequests / activeUsers.length;
      expect(avgRequestsPerUser).toBeGreaterThan(10); // Each user should make reasonable number of requests
      
      console.log(`✅ Active Users: ${activeUsers.length}/50`);
      console.log(`✅ Avg Requests per User: ${avgRequestsPerUser.toFixed(1)}`);
      
      // Validate system health trends
      const healthTrend = this.analyzeHealthTrend(results.systemHealth);
      expect(healthTrend.stable).toBe(true);
      
      console.log(`✅ System Health: ${healthTrend.stable ? 'Stable' : 'Unstable'}`);
      
    }, 900000); // 15 minutes timeout

    it('should maintain performance consistency during peak load', async () => {
      console.log('\n📊 Testing Performance Consistency During Peak Load');
      
      // Run peak usage load test
      const results = await loadTestRunner.runLoadTest(PEAK_USAGE_CONFIG);
      
      // Analyze performance consistency over time
      const timeWindows = this.divideIntoTimeWindows(results.systemHealth, 60000); // 1-minute windows
      const throughputVariability = this.calculateThroughputVariability(timeWindows);
      const responseTimeVariability = this.calculateResponseTimeVariability(timeWindows);
      
      // Performance should be consistent (low variability)
      expect(throughputVariability).toBeLessThan(0.3); // 30% coefficient of variation
      expect(responseTimeVariability).toBeLessThan(0.4); // 40% coefficient of variation
      
      console.log(`✅ Throughput Variability: ${(throughputVariability * 100).toFixed(1)}% (target: <30%)`);
      console.log(`✅ Response Time Variability: ${(responseTimeVariability * 100).toFixed(1)}% (target: <40%)`);
      
      // Validate no performance degradation over time
      const firstHalf = timeWindows.slice(0, Math.floor(timeWindows.length / 2));
      const secondHalf = timeWindows.slice(Math.floor(timeWindows.length / 2));
      
      const firstHalfAvgThroughput = firstHalf.reduce((sum, w) => sum + w.avgThroughput, 0) / firstHalf.length;
      const secondHalfAvgThroughput = secondHalf.reduce((sum, w) => sum + w.avgThroughput, 0) / secondHalf.length;
      
      const performanceDegradation = (firstHalfAvgThroughput - secondHalfAvgThroughput) / firstHalfAvgThroughput;
      
      // Performance should not degrade more than 10%
      expect(performanceDegradation).toBeLessThan(0.1);
      
      console.log(`✅ Performance Degradation: ${(performanceDegradation * 100).toFixed(1)}% (target: <10%)`);
      
    }, 900000); // 15 minutes timeout

    it('should handle mixed workload patterns effectively', async () => {
      console.log('\n🔄 Testing Mixed Workload Pattern Handling');
      
      // Create custom scenario with varied workload
      const mixedWorkloadConfig = {
        ...PEAK_USAGE_CONFIG,
        config: {
          ...PEAK_USAGE_CONFIG.config,
          name: 'Mixed Workload Peak Test',
          description: 'Peak load with varied batch sizes and priorities'
        },
        userBehavior: [
          {
            action: 'upload_batch' as const,
            weight: 0.4,
            parameters: { batchSize: 5, priority: 'high' }
          },
          {
            action: 'upload_batch' as const,
            weight: 0.3,
            parameters: { batchSize: 25, priority: 'medium' }
          },
          {
            action: 'upload_single' as const,
            weight: 0.2,
            parameters: { priority: 'urgent' }
          },
          {
            action: 'view_dashboard' as const,
            weight: 0.1
          }
        ]
      };
      
      // Run mixed workload test
      const results = await loadTestRunner.runLoadTest(mixedWorkloadConfig);
      
      // Validate mixed workload handling
      expect(results.throughput).toBeGreaterThan(LOAD_TEST_VALIDATION.peakUsage.minThroughput * 0.9); // 90% of normal throughput
      expect(results.errorRate).toBeLessThan(LOAD_TEST_VALIDATION.peakUsage.maxErrorRate * 1.2); // 20% higher error tolerance
      
      // Validate queue handling of mixed priorities
      const finalQueueStatus = await getTestState().utilities.getQueueStatus();
      expect(finalQueueStatus.pendingItems).toBeLessThan(100); // Queue should drain effectively
      
      console.log(`✅ Mixed Workload Throughput: ${results.throughput.toFixed(1)} requests/min`);
      console.log(`✅ Mixed Workload Error Rate: ${(results.errorRate * 100).toFixed(1)}%`);
      console.log(`✅ Final Queue Depth: ${finalQueueStatus.pendingItems} items`);
      
    }, 900000); // 15 minutes timeout
  });

  describe('Peak Load System Health', () => {
    it('should maintain system health under peak load', async () => {
      console.log('\n🏥 Testing System Health Under Peak Load');
      
      // Run peak usage load test with health monitoring
      const results = await loadTestRunner.runLoadTest(PEAK_USAGE_CONFIG);
      
      // Analyze system health metrics
      const healthMetrics = this.analyzeSystemHealth(results.systemHealth);
      
      // CPU usage should be reasonable
      expect(healthMetrics.avgCpuUsage).toBeLessThan(0.80); // 80%
      expect(healthMetrics.maxCpuUsage).toBeLessThan(0.90); // 90%
      
      // Memory usage should be stable
      expect(healthMetrics.avgMemoryUsage).toBeLessThan(0.75); // 75%
      expect(healthMetrics.memoryGrowth).toBeLessThan(0.10); // 10% growth
      
      // Queue should be manageable
      expect(healthMetrics.avgQueueDepth).toBeLessThan(200); // 200 items
      expect(healthMetrics.maxQueueDepth).toBeLessThan(500); // 500 items
      
      // Workers should be efficient
      expect(healthMetrics.avgWorkerUtilization).toBeGreaterThan(0.70); // 70%
      
      console.log(`✅ Avg CPU Usage: ${(healthMetrics.avgCpuUsage * 100).toFixed(1)}%`);
      console.log(`✅ Max CPU Usage: ${(healthMetrics.maxCpuUsage * 100).toFixed(1)}%`);
      console.log(`✅ Avg Memory Usage: ${(healthMetrics.avgMemoryUsage * 100).toFixed(1)}%`);
      console.log(`✅ Memory Growth: ${(healthMetrics.memoryGrowth * 100).toFixed(1)}%`);
      console.log(`✅ Avg Queue Depth: ${healthMetrics.avgQueueDepth.toFixed(0)} items`);
      console.log(`✅ Worker Utilization: ${(healthMetrics.avgWorkerUtilization * 100).toFixed(1)}%`);
      
    }, 900000); // 15 minutes timeout

    it('should recover gracefully from temporary spikes', async () => {
      console.log('\n⚡ Testing Recovery from Temporary Spikes');
      
      // Create spike scenario within peak test
      const spikeConfig = {
        ...PEAK_USAGE_CONFIG,
        config: {
          ...PEAK_USAGE_CONFIG.config,
          name: 'Peak with Spike Test',
          concurrentUsers: 70, // Spike to 70 users
          rampUpTime: 60000, // Faster ramp up
          duration: 480000 // 8 minutes
        }
      };
      
      // Run spike test
      const results = await loadTestRunner.runLoadTest(spikeConfig);
      
      // Validate spike handling
      const spikeRecoveryTime = this.calculateSpikeRecoveryTime(results.systemHealth);
      
      // System should recover within 2 minutes
      expect(spikeRecoveryTime).toBeLessThan(120000); // 2 minutes
      
      // Final performance should be reasonable
      const finalPeriodHealth = results.systemHealth.slice(-10); // Last 10 snapshots
      const finalAvgResponseTime = finalPeriodHealth.reduce((sum, h) => sum + h.avgResponseTime, 0) / finalPeriodHealth.length;
      const finalErrorRate = finalPeriodHealth.reduce((sum, h) => sum + h.errorRate, 0) / finalPeriodHealth.length;
      
      expect(finalAvgResponseTime).toBeLessThan(15000); // 15 seconds
      expect(finalErrorRate).toBeLessThan(0.10); // 10%
      
      console.log(`✅ Spike Recovery Time: ${(spikeRecoveryTime / 1000).toFixed(1)}s`);
      console.log(`✅ Final Avg Response Time: ${finalAvgResponseTime.toFixed(0)}ms`);
      console.log(`✅ Final Error Rate: ${(finalErrorRate * 100).toFixed(1)}%`);
      
    }, 600000); // 10 minutes timeout
  });

  // Helper methods for analysis
  private analyzeHealthTrend(healthSnapshots: any[]): { stable: boolean; trend: string } {
    if (healthSnapshots.length < 10) {
      return { stable: true, trend: 'insufficient_data' };
    }

    const cpuTrend = this.calculateTrend(healthSnapshots.map(h => h.cpuUsage));
    const memoryTrend = this.calculateTrend(healthSnapshots.map(h => h.memoryUsage));
    const errorTrend = this.calculateTrend(healthSnapshots.map(h => h.errorRate));

    const stable = Math.abs(cpuTrend) < 0.1 && Math.abs(memoryTrend) < 0.1 && Math.abs(errorTrend) < 0.05;

    return { stable, trend: stable ? 'stable' : 'unstable' };
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private divideIntoTimeWindows(healthSnapshots: any[], windowSizeMs: number): any[] {
    const windows: any[] = [];
    const startTime = healthSnapshots[0]?.timestamp || Date.now();

    for (let i = 0; i < healthSnapshots.length; i++) {
      const windowIndex = Math.floor((healthSnapshots[i].timestamp - startTime) / windowSizeMs);
      
      if (!windows[windowIndex]) {
        windows[windowIndex] = {
          snapshots: [],
          avgThroughput: 0,
          avgResponseTime: 0,
          avgErrorRate: 0
        };
      }
      
      windows[windowIndex].snapshots.push(healthSnapshots[i]);
    }

    // Calculate averages for each window
    windows.forEach(window => {
      const snapshots = window.snapshots;
      window.avgThroughput = snapshots.reduce((sum: number, s: any) => sum + s.throughput, 0) / snapshots.length;
      window.avgResponseTime = snapshots.reduce((sum: number, s: any) => sum + s.avgResponseTime, 0) / snapshots.length;
      window.avgErrorRate = snapshots.reduce((sum: number, s: any) => sum + s.errorRate, 0) / snapshots.length;
    });

    return windows.filter(w => w.snapshots.length > 0);
  }

  private calculateThroughputVariability(timeWindows: any[]): number {
    const throughputs = timeWindows.map(w => w.avgThroughput);
    const mean = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
    const variance = throughputs.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / throughputs.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private calculateResponseTimeVariability(timeWindows: any[]): number {
    const responseTimes = timeWindows.map(w => w.avgResponseTime);
    const mean = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const variance = responseTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / responseTimes.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private analyzeSystemHealth(healthSnapshots: any[]): any {
    return {
      avgCpuUsage: healthSnapshots.reduce((sum, h) => sum + h.cpuUsage, 0) / healthSnapshots.length,
      maxCpuUsage: Math.max(...healthSnapshots.map(h => h.cpuUsage)),
      avgMemoryUsage: healthSnapshots.reduce((sum, h) => sum + h.memoryUsage, 0) / healthSnapshots.length,
      memoryGrowth: (healthSnapshots[healthSnapshots.length - 1].memoryUsage - healthSnapshots[0].memoryUsage) / healthSnapshots[0].memoryUsage,
      avgQueueDepth: healthSnapshots.reduce((sum, h) => sum + h.queueDepth, 0) / healthSnapshots.length,
      maxQueueDepth: Math.max(...healthSnapshots.map(h => h.queueDepth)),
      avgWorkerUtilization: healthSnapshots.reduce((sum, h) => sum + (h.activeWorkers / 10), 0) / healthSnapshots.length // Assuming max 10 workers
    };
  }

  private calculateSpikeRecoveryTime(healthSnapshots: any[]): number {
    // Find the peak response time
    const peakResponseTime = Math.max(...healthSnapshots.map(h => h.avgResponseTime));
    const peakIndex = healthSnapshots.findIndex(h => h.avgResponseTime === peakResponseTime);
    
    // Find when response time returns to reasonable levels (< 10s)
    for (let i = peakIndex; i < healthSnapshots.length; i++) {
      if (healthSnapshots[i].avgResponseTime < 10000) {
        return healthSnapshots[i].timestamp - healthSnapshots[peakIndex].timestamp;
      }
    }
    
    return healthSnapshots[healthSnapshots.length - 1].timestamp - healthSnapshots[peakIndex].timestamp;
  }
});
