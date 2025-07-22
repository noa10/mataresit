/**
 * Stress Testing Scenarios
 * 
 * This test suite pushes the system beyond normal limits to test
 * breaking points, graceful degradation, and recovery mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam } from '../setup/test-setup';
import { LoadTestRunner } from './load-test-runner';
import { STRESS_TEST_CONFIG, SPIKE_TEST_CONFIG, ENDURANCE_TEST_CONFIG, LOAD_TEST_VALIDATION } from './load-test-config';
import { simulateRandomFailures, simulateAPIRateLimit } from '../setup/mock-services';

describe('Stress Testing Scenarios', () => {
  setupTestSuite('Stress Testing');
  setupTest();

  let loadTestRunner: LoadTestRunner;
  let testUser: any;
  let testTeam: any;

  beforeAll(async () => {
    const { user } = await createTestUser('stress-test@example.com');
    const team = await createTestTeam(user.id, 'Stress Test Team');
    
    testUser = user;
    testTeam = team;
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset mock services for consistent stress testing
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

  describe('System Breaking Point Tests', () => {
    it('should handle extreme load with 100 concurrent users', async () => {
      console.log('\n💥 Starting Extreme Load Stress Test');
      console.log('Scenario: 100 concurrent users with large batch uploads');
      
      // Run stress test
      const results = await loadTestRunner.runLoadTest(STRESS_TEST_CONFIG);
      
      // Validate stress test results
      const validation = LOAD_TEST_VALIDATION.stressTest;
      
      // Under stress, lower performance is acceptable
      expect(results.throughput).toBeGreaterThan(validation.minThroughput);
      console.log(`✅ Stress Throughput: ${results.throughput.toFixed(1)} requests/min (target: >${validation.minThroughput})`);
      
      // Higher error rate is acceptable under stress
      expect(results.errorRate).toBeLessThan(validation.maxErrorRate);
      console.log(`✅ Stress Error Rate: ${(results.errorRate * 100).toFixed(1)}% (target: <${validation.maxErrorRate * 100}%)`);
      
      // Response times may be higher under stress
      const avgResponseTime = results.totalResponseTime / results.totalRequests;
      expect(avgResponseTime).toBeLessThan(validation.maxResponseTime);
      console.log(`✅ Stress Response Time: ${avgResponseTime.toFixed(0)}ms (target: <${validation.maxResponseTime}ms)`);
      
      // System should show graceful degradation
      const gracefulDegradation = this.validateGracefulDegradation(results.systemHealth);
      expect(gracefulDegradation.detected).toBe(validation.gracefulDegradation);
      
      console.log(`✅ Graceful Degradation: ${gracefulDegradation.detected ? 'Detected' : 'Not Required'}`);
      
      // System should not crash
      expect(results.totalRequests).toBeGreaterThan(1000); // Should process significant requests
      expect(results.successfulRequests).toBeGreaterThan(800); // Should have reasonable success count
      
    }, 1200000); // 20 minutes timeout

    it('should recover from resource exhaustion', async () => {
      console.log('\n🔄 Testing Recovery from Resource Exhaustion');
      
      // Create resource exhaustion scenario
      const exhaustionConfig = {
        ...STRESS_TEST_CONFIG,
        config: {
          ...STRESS_TEST_CONFIG.config,
          name: 'Resource Exhaustion Test',
          concurrentUsers: 120, // Even more users
          batchSize: 75, // Larger batches
          duration: 600000 // 10 minutes
        }
      };
      
      const testState = getTestState();
      
      // Introduce additional stress factors
      setTimeout(() => {
        console.log('🔥 Introducing API failures to simulate resource exhaustion');
        simulateRandomFailures(testState.mockServices, 0.3); // 30% failure rate
        simulateAPIRateLimit(testState.mockServices, 'gemini', 120000); // 2 minute rate limit
      }, 120000); // 2 minutes into test
      
      // Simulate recovery
      setTimeout(() => {
        console.log('🛠️ Simulating resource recovery');
        testState.mockServices.geminiMock.reset();
        testState.mockServices.openrouterMock.reset();
      }, 360000); // 6 minutes into test
      
      // Run exhaustion test
      const results = await loadTestRunner.runLoadTest(exhaustionConfig);
      
      // Validate recovery
      const recoveryMetrics = this.analyzeRecoveryPattern(results.systemHealth);
      
      // System should show degradation during exhaustion
      expect(recoveryMetrics.degradationDetected).toBe(true);
      
      // System should recover after resources are restored
      expect(recoveryMetrics.recoveryDetected).toBe(true);
      expect(recoveryMetrics.recoveryTime).toBeLessThan(180000); // 3 minutes recovery time
      
      // Final performance should be reasonable
      expect(recoveryMetrics.finalThroughput).toBeGreaterThan(100); // 100 requests/min
      expect(recoveryMetrics.finalErrorRate).toBeLessThan(0.15); // 15%
      
      console.log(`✅ Degradation Detected: ${recoveryMetrics.degradationDetected}`);
      console.log(`✅ Recovery Detected: ${recoveryMetrics.recoveryDetected}`);
      console.log(`✅ Recovery Time: ${(recoveryMetrics.recoveryTime / 1000).toFixed(1)}s`);
      console.log(`✅ Final Throughput: ${recoveryMetrics.finalThroughput.toFixed(1)} requests/min`);
      
    }, 900000); // 15 minutes timeout

    it('should handle sudden traffic spikes', async () => {
      console.log('\n⚡ Testing Sudden Traffic Spike Handling');
      
      // Run spike test
      const results = await loadTestRunner.runLoadTest(SPIKE_TEST_CONFIG);
      
      // Validate spike handling
      const validation = LOAD_TEST_VALIDATION.spikeTest;
      const spikeMetrics = this.analyzeSpikeResponse(results.systemHealth);
      
      // System should handle spike reasonably
      expect(results.throughput).toBeGreaterThan(validation.minThroughput);
      expect(results.errorRate).toBeLessThan(validation.maxErrorRate);
      
      // Spike response should be reasonable
      expect(spikeMetrics.peakResponseTime).toBeLessThan(validation.maxResponseTime);
      expect(spikeMetrics.recoveryTime).toBeLessThan(validation.recoveryTime);
      
      // System should stabilize after spike
      expect(spikeMetrics.postSpikeStability).toBe(true);
      
      console.log(`✅ Spike Throughput: ${results.throughput.toFixed(1)} requests/min`);
      console.log(`✅ Peak Response Time: ${spikeMetrics.peakResponseTime.toFixed(0)}ms`);
      console.log(`✅ Recovery Time: ${(spikeMetrics.recoveryTime / 1000).toFixed(1)}s`);
      console.log(`✅ Post-Spike Stability: ${spikeMetrics.postSpikeStability}`);
      
    }, 600000); // 10 minutes timeout
  });

  describe('Endurance and Memory Leak Tests', () => {
    it('should maintain performance over extended periods', async () => {
      console.log('\n⏰ Starting Endurance Test');
      console.log('Scenario: 60-minute test with moderate load to detect memory leaks');
      
      // Run endurance test
      const results = await loadTestRunner.runLoadTest(ENDURANCE_TEST_CONFIG);
      
      // Validate endurance test results
      const validation = LOAD_TEST_VALIDATION.enduranceTest;
      const enduranceMetrics = this.analyzeEnduranceMetrics(results.systemHealth);
      
      // Performance should remain stable
      expect(results.throughput).toBeGreaterThan(validation.minThroughput);
      expect(results.errorRate).toBeLessThan(validation.maxErrorRate);
      
      // Memory usage should not grow significantly
      expect(enduranceMetrics.memoryGrowth).toBeLessThan(validation.memoryLeakThreshold);
      
      // Performance should not degrade significantly
      expect(enduranceMetrics.performanceDegradation).toBeLessThan(validation.performanceDegradation);
      
      // Response times should remain reasonable
      const avgResponseTime = results.totalResponseTime / results.totalRequests;
      expect(avgResponseTime).toBeLessThan(validation.maxResponseTime);
      
      console.log(`✅ Endurance Throughput: ${results.throughput.toFixed(1)} requests/min`);
      console.log(`✅ Memory Growth: ${(enduranceMetrics.memoryGrowth * 100).toFixed(1)}%`);
      console.log(`✅ Performance Degradation: ${(enduranceMetrics.performanceDegradation * 100).toFixed(1)}%`);
      console.log(`✅ Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
      
    }, 4200000); // 70 minutes timeout

    it('should detect and prevent memory leaks', async () => {
      console.log('\n🧠 Testing Memory Leak Detection');
      
      // Create memory-intensive scenario
      const memoryTestConfig = {
        ...ENDURANCE_TEST_CONFIG,
        config: {
          ...ENDURANCE_TEST_CONFIG.config,
          name: 'Memory Leak Detection Test',
          duration: 1800000, // 30 minutes
          batchSize: 20, // Larger batches to stress memory
          requestsPerUser: 50
        }
      };
      
      // Run memory test
      const results = await loadTestRunner.runLoadTest(memoryTestConfig);
      
      // Analyze memory patterns
      const memoryAnalysis = this.analyzeMemoryPatterns(results.systemHealth);
      
      // Memory should not grow linearly
      expect(memoryAnalysis.linearGrowthDetected).toBe(false);
      
      // Memory should stabilize or show sawtooth pattern (GC)
      expect(memoryAnalysis.memoryStabilized || memoryAnalysis.gcPatternDetected).toBe(true);
      
      // Peak memory should be reasonable
      expect(memoryAnalysis.peakMemoryUsage).toBeLessThan(0.90); // 90%
      
      console.log(`✅ Linear Growth Detected: ${memoryAnalysis.linearGrowthDetected}`);
      console.log(`✅ Memory Stabilized: ${memoryAnalysis.memoryStabilized}`);
      console.log(`✅ GC Pattern Detected: ${memoryAnalysis.gcPatternDetected}`);
      console.log(`✅ Peak Memory Usage: ${(memoryAnalysis.peakMemoryUsage * 100).toFixed(1)}%`);
      
    }, 2400000); // 40 minutes timeout
  });

  describe('Cascading Failure Tests', () => {
    it('should handle cascading system failures', async () => {
      console.log('\n🌊 Testing Cascading Failure Handling');
      
      // Create cascading failure scenario
      const cascadingConfig = {
        ...STRESS_TEST_CONFIG,
        config: {
          ...STRESS_TEST_CONFIG.config,
          name: 'Cascading Failure Test',
          duration: 720000 // 12 minutes
        }
      };
      
      const testState = getTestState();
      
      // Orchestrate cascading failures
      setTimeout(() => {
        console.log('🔥 Stage 1: API failures');
        simulateRandomFailures(testState.mockServices, 0.4);
      }, 120000); // 2 minutes
      
      setTimeout(() => {
        console.log('🔥 Stage 2: Rate limiting');
        simulateAPIRateLimit(testState.mockServices, 'gemini', 180000);
      }, 240000); // 4 minutes
      
      setTimeout(() => {
        console.log('🔥 Stage 3: Secondary API issues');
        simulateAPIRateLimit(testState.mockServices, 'openrouter', 120000);
      }, 360000); // 6 minutes
      
      setTimeout(() => {
        console.log('🛠️ Recovery: Restoring services');
        testState.mockServices.geminiMock.reset();
        testState.mockServices.openrouterMock.reset();
      }, 480000); // 8 minutes
      
      // Run cascading failure test
      const results = await loadTestRunner.runLoadTest(cascadingConfig);
      
      // Validate cascading failure handling
      const cascadingMetrics = this.analyzeCascadingFailures(results.systemHealth);
      
      // System should survive cascading failures
      expect(results.totalRequests).toBeGreaterThan(500);
      expect(results.successfulRequests / results.totalRequests).toBeGreaterThan(0.6); // 60% success rate
      
      // System should show resilience patterns
      expect(cascadingMetrics.failureStagesDetected).toBeGreaterThanOrEqual(3);
      expect(cascadingMetrics.recoveryDetected).toBe(true);
      expect(cascadingMetrics.systemSurvived).toBe(true);
      
      console.log(`✅ System Survived: ${cascadingMetrics.systemSurvived}`);
      console.log(`✅ Failure Stages Detected: ${cascadingMetrics.failureStagesDetected}`);
      console.log(`✅ Recovery Detected: ${cascadingMetrics.recoveryDetected}`);
      console.log(`✅ Final Success Rate: ${((results.successfulRequests / results.totalRequests) * 100).toFixed(1)}%`);
      
    }, 900000); // 15 minutes timeout
  });

  // Helper methods for stress test analysis
  private validateGracefulDegradation(healthSnapshots: any[]): { detected: boolean; stages: string[] } {
    const stages: string[] = [];
    let degradationDetected = false;
    
    for (let i = 1; i < healthSnapshots.length; i++) {
      const current = healthSnapshots[i];
      const previous = healthSnapshots[i - 1];
      
      // Check for performance degradation indicators
      if (current.avgResponseTime > previous.avgResponseTime * 1.5) {
        stages.push('response_time_degradation');
        degradationDetected = true;
      }
      
      if (current.errorRate > previous.errorRate * 2) {
        stages.push('error_rate_increase');
        degradationDetected = true;
      }
      
      if (current.throughput < previous.throughput * 0.7) {
        stages.push('throughput_reduction');
        degradationDetected = true;
      }
    }
    
    return { detected: degradationDetected, stages };
  }

  private analyzeRecoveryPattern(healthSnapshots: any[]): any {
    const midPoint = Math.floor(healthSnapshots.length / 2);
    const firstHalf = healthSnapshots.slice(0, midPoint);
    const secondHalf = healthSnapshots.slice(midPoint);
    
    const firstHalfAvgThroughput = firstHalf.reduce((sum, h) => sum + h.throughput, 0) / firstHalf.length;
    const secondHalfAvgThroughput = secondHalf.reduce((sum, h) => sum + h.throughput, 0) / secondHalf.length;
    
    const firstHalfAvgErrorRate = firstHalf.reduce((sum, h) => sum + h.errorRate, 0) / firstHalf.length;
    const secondHalfAvgErrorRate = secondHalf.reduce((sum, h) => sum + h.errorRate, 0) / secondHalf.length;
    
    // Find recovery point
    let recoveryTime = 0;
    const peakErrorRate = Math.max(...healthSnapshots.map(h => h.errorRate));
    const peakIndex = healthSnapshots.findIndex(h => h.errorRate === peakErrorRate);
    
    for (let i = peakIndex; i < healthSnapshots.length; i++) {
      if (healthSnapshots[i].errorRate < peakErrorRate * 0.5) {
        recoveryTime = healthSnapshots[i].timestamp - healthSnapshots[peakIndex].timestamp;
        break;
      }
    }
    
    return {
      degradationDetected: firstHalfAvgErrorRate < secondHalfAvgErrorRate * 0.8,
      recoveryDetected: secondHalfAvgThroughput > firstHalfAvgThroughput * 0.8,
      recoveryTime,
      finalThroughput: secondHalfAvgThroughput,
      finalErrorRate: secondHalfAvgErrorRate
    };
  }

  private analyzeSpikeResponse(healthSnapshots: any[]): any {
    const peakResponseTime = Math.max(...healthSnapshots.map(h => h.avgResponseTime));
    const peakIndex = healthSnapshots.findIndex(h => h.avgResponseTime === peakResponseTime);
    
    // Find recovery time
    let recoveryTime = 0;
    for (let i = peakIndex; i < healthSnapshots.length; i++) {
      if (healthSnapshots[i].avgResponseTime < peakResponseTime * 0.6) {
        recoveryTime = healthSnapshots[i].timestamp - healthSnapshots[peakIndex].timestamp;
        break;
      }
    }
    
    // Check post-spike stability
    const postSpikeSnapshots = healthSnapshots.slice(-5); // Last 5 snapshots
    const postSpikeVariability = this.calculateVariability(postSpikeSnapshots.map(h => h.avgResponseTime));
    
    return {
      peakResponseTime,
      recoveryTime,
      postSpikeStability: postSpikeVariability < 0.3 // 30% coefficient of variation
    };
  }

  private analyzeEnduranceMetrics(healthSnapshots: any[]): any {
    const firstQuarter = healthSnapshots.slice(0, Math.floor(healthSnapshots.length / 4));
    const lastQuarter = healthSnapshots.slice(-Math.floor(healthSnapshots.length / 4));
    
    const initialMemory = firstQuarter.reduce((sum, h) => sum + h.memoryUsage, 0) / firstQuarter.length;
    const finalMemory = lastQuarter.reduce((sum, h) => sum + h.memoryUsage, 0) / lastQuarter.length;
    
    const initialThroughput = firstQuarter.reduce((sum, h) => sum + h.throughput, 0) / firstQuarter.length;
    const finalThroughput = lastQuarter.reduce((sum, h) => sum + h.throughput, 0) / lastQuarter.length;
    
    return {
      memoryGrowth: (finalMemory - initialMemory) / initialMemory,
      performanceDegradation: (initialThroughput - finalThroughput) / initialThroughput
    };
  }

  private analyzeMemoryPatterns(healthSnapshots: any[]): any {
    const memoryValues = healthSnapshots.map(h => h.memoryUsage);
    
    // Check for linear growth
    const linearTrend = this.calculateLinearTrend(memoryValues);
    const linearGrowthDetected = linearTrend > 0.001; // Significant positive trend
    
    // Check for GC pattern (sawtooth)
    const gcPatternDetected = this.detectSawtoothPattern(memoryValues);
    
    // Check for stabilization
    const lastQuarter = memoryValues.slice(-Math.floor(memoryValues.length / 4));
    const memoryVariability = this.calculateVariability(lastQuarter);
    const memoryStabilized = memoryVariability < 0.1; // 10% variation
    
    return {
      linearGrowthDetected,
      gcPatternDetected,
      memoryStabilized,
      peakMemoryUsage: Math.max(...memoryValues)
    };
  }

  private analyzeCascadingFailures(healthSnapshots: any[]): any {
    const errorRates = healthSnapshots.map(h => h.errorRate);
    const responseTimes = healthSnapshots.map(h => h.avgResponseTime);
    
    // Detect failure stages (spikes in error rate or response time)
    let failureStagesDetected = 0;
    for (let i = 1; i < healthSnapshots.length; i++) {
      if (errorRates[i] > errorRates[i - 1] * 2 || responseTimes[i] > responseTimes[i - 1] * 2) {
        failureStagesDetected++;
      }
    }
    
    // Check if system survived (didn't crash)
    const systemSurvived = healthSnapshots.length > 10 && healthSnapshots[healthSnapshots.length - 1].throughput > 0;
    
    // Check for recovery (improvement in final quarter)
    const lastQuarter = healthSnapshots.slice(-Math.floor(healthSnapshots.length / 4));
    const avgFinalErrorRate = lastQuarter.reduce((sum, h) => sum + h.errorRate, 0) / lastQuarter.length;
    const recoveryDetected = avgFinalErrorRate < Math.max(...errorRates) * 0.5;
    
    return {
      failureStagesDetected,
      systemSurvived,
      recoveryDetected
    };
  }

  private calculateVariability(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private calculateLinearTrend(values: number[]): number {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private detectSawtoothPattern(values: number[]): boolean {
    let peaks = 0;
    let valleys = 0;
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks++;
      }
      if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
        valleys++;
      }
    }
    
    // Sawtooth pattern should have multiple peaks and valleys
    return peaks >= 3 && valleys >= 3;
  }
});
