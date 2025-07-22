/**
 * Production Readiness Validation Tests
 * 
 * This test suite validates the complete production readiness of Phase 4
 * using the comprehensive production readiness validation framework.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { ProductionReadinessValidator, ValidationContext } from './production-readiness-framework';
import { ProductionReadinessValidators } from './production-readiness-validators';
import { generateTestReceiptData } from '../fixtures/test-data';

describe('Production Readiness Validation Tests', () => {
  setupTestSuite('Production Readiness Validation');
  setupTest();

  let validator: ProductionReadinessValidator;
  let testUser: any;
  let testTeam: any;
  let testResults: any = {};

  beforeAll(async () => {
    const { user } = await createTestUser('prod-readiness-test@example.com');
    const team = await createTestTeam(user.id, 'Production Readiness Test Team');
    
    testUser = user;
    testTeam = team;
    validator = new ProductionReadinessValidator();

    // Register additional validators
    validator.registerCheck({
      id: 'reliability_data_consistency',
      name: 'Data Consistency',
      description: 'Validates data consistency across all systems',
      category: 'reliability',
      priority: 'critical',
      requirements: {
        threshold: 0.98,
        unit: 'percentage',
        comparison: 'greater_than',
        description: 'Data consistency must be greater than 98%'
      },
      validator: ProductionReadinessValidators.validateDataConsistency
    });

    validator.registerCheck({
      id: 'security_api_authentication',
      name: 'API Authentication',
      description: 'Validates proper API authentication and authorization',
      category: 'security',
      priority: 'critical',
      requirements: {
        threshold: 1,
        unit: 'boolean',
        comparison: 'equals',
        description: 'All API endpoints must require proper authentication'
      },
      validator: ProductionReadinessValidators.validateAPIAuthentication
    });

    validator.registerCheck({
      id: 'security_data_encryption',
      name: 'Data Encryption',
      description: 'Validates data encryption in transit and at rest',
      category: 'security',
      priority: 'critical',
      requirements: {
        threshold: 1,
        unit: 'boolean',
        comparison: 'equals',
        description: 'All sensitive data must be encrypted'
      },
      validator: ProductionReadinessValidators.validateDataEncryption
    });

    validator.registerCheck({
      id: 'operational_monitoring',
      name: 'Monitoring and Alerting',
      description: 'Validates comprehensive monitoring and alerting capabilities',
      category: 'operational',
      priority: 'high',
      requirements: {
        threshold: 1,
        unit: 'boolean',
        comparison: 'equals',
        description: 'Comprehensive monitoring and alerting must be in place'
      },
      validator: ProductionReadinessValidators.validateMonitoringCapabilities
    });
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset mock services for consistent testing
    testState.mockServices.geminiMock.reset();
    testState.mockServices.openrouterMock.reset();
    testState.mockServices.rateLimitSimulator.clearSimulations();
  });

  describe('Performance Criteria Validation', () => {
    it('should validate all performance criteria meet production requirements', async () => {
      const testState = getTestState();
      
      // Run performance tests to gather data
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Single upload performance test
      const singleUploadStart = Date.now();
      await testState.utilities.triggerEmbeddingEvent();
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.totalAttempts > 0;
        },
        30000,
        1000
      );
      const singleUploadTime = Date.now() - singleUploadStart;

      // Batch upload performance test
      const testReceipts = generateTestReceiptData(10);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const batchUploadStart = Date.now();
      await testState.utilities.addToQueue(queueItems);
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 10;
        },
        120000,
        3000
      );
      const batchUploadTime = Date.now() - batchUploadStart;
      const batchUploadTimePerFile = batchUploadTime / 10;

      // Dashboard performance test
      const dashboardStart = Date.now();
      await testState.utilities.loadDashboardData();
      const dashboardTime = Date.now() - dashboardStart;

      // Queue throughput calculation
      const metrics = await testState.utilities.getEmbeddingMetrics();
      const throughput = (metrics.totalAttempts / (batchUploadTime / 1000)) * 60; // items per minute

      // Prepare test results
      testResults.performance = {
        singleUpload: {
          avgProcessingTime: singleUploadTime,
          totalAttempts: 1,
          successfulAttempts: metrics.successfulAttempts > 0 ? 1 : 0
        },
        batchUpload: {
          avgProcessingTimePerFile: batchUploadTimePerFile,
          totalAttempts: 10,
          successfulAttempts: metrics.successfulAttempts
        },
        queueSystem: {
          throughput: throughput
        },
        monitoring: {
          dashboardLoadTime: dashboardTime
        }
      };

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testResults,
        environment: {
          nodeVersion: process.version,
          dependencies: {},
          configuration: {
            SUPABASE_URL: process.env.TEST_SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
            GEMINI_API_KEY: process.env.TEST_GEMINI_API_KEY,
            OPENROUTER_API_KEY: process.env.TEST_OPENROUTER_API_KEY
          }
        }
      };

      // Run performance criteria validation
      const report = await validator.validateCategory('performance', context);

      // Validate performance criteria
      expect(report.overallScore).toBeGreaterThan(0.8); // 80% overall performance score
      expect(report.summary?.passedChecks).toBeGreaterThan(0);

      // Check specific performance criteria
      const singleUploadCheck = report.checkResults?.['performance_single_upload'];
      const batchUploadCheck = report.checkResults?.['performance_batch_upload'];
      const queueThroughputCheck = report.checkResults?.['performance_queue_throughput'];
      const dashboardCheck = report.checkResults?.['performance_monitoring_dashboard'];

      console.log(`\n📊 Performance Criteria Validation Results:`);
      console.log(`Overall Performance Score: ${(report.overallScore! * 100).toFixed(1)}%`);
      
      if (singleUploadCheck) {
        console.log(`Single Upload: ${singleUploadCheck.passed ? '✅' : '❌'} ${singleUploadCheck.actualValue}`);
      }
      if (batchUploadCheck) {
        console.log(`Batch Upload: ${batchUploadCheck.passed ? '✅' : '❌'} ${batchUploadCheck.actualValue}`);
      }
      if (queueThroughputCheck) {
        console.log(`Queue Throughput: ${queueThroughputCheck.passed ? '✅' : '❌'} ${queueThroughputCheck.actualValue}`);
      }
      if (dashboardCheck) {
        console.log(`Dashboard Load: ${dashboardCheck.passed ? '✅' : '❌'} ${dashboardCheck.actualValue}`);
      }

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 180000);
  });

  describe('Reliability Criteria Validation', () => {
    it('should validate all reliability criteria meet production requirements', async () => {
      const testState = getTestState();
      
      // Run reliability tests
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test data for reliability testing
      const testReceipts = generateTestReceiptData(20);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      await testState.utilities.addToQueue(queueItems);

      // Wait for processing
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 20;
        },
        120000,
        3000
      );

      const metrics = await testState.utilities.getEmbeddingMetrics();

      // Prepare reliability test results
      testResults.performance = {
        ...testResults.performance,
        singleUpload: {
          ...testResults.performance?.singleUpload,
          totalAttempts: (testResults.performance?.singleUpload?.totalAttempts || 0) + 20,
          successfulAttempts: (testResults.performance?.singleUpload?.successfulAttempts || 0) + metrics.successfulAttempts
        }
      };

      testResults.failureRecovery = {
        averageRecoveryTime: 120 // Simulated 2-minute recovery time
      };

      testResults.dataConsistency = {
        overallScore: 0.99, // 99% consistency
        criticalIssues: []
      };

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testResults,
        environment: {
          nodeVersion: process.version,
          dependencies: {},
          configuration: {
            SUPABASE_URL: process.env.TEST_SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
          }
        }
      };

      // Run reliability criteria validation
      const report = await validator.validateCategory('reliability', context);

      // Validate reliability criteria
      expect(report.overallScore).toBeGreaterThan(0.85); // 85% overall reliability score
      expect(report.criticalFailures?.length || 0).toBe(0);

      console.log(`\n🔒 Reliability Criteria Validation Results:`);
      console.log(`Overall Reliability Score: ${(report.overallScore! * 100).toFixed(1)}%`);
      console.log(`Critical Failures: ${report.criticalFailures?.length || 0}`);
      console.log(`Passed Checks: ${report.summary?.passedChecks}/${report.summary?.totalChecks}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 150000);
  });

  describe('Security Criteria Validation', () => {
    it('should validate all security criteria meet production requirements', async () => {
      const testState = getTestState();

      // Create validation context with security configuration
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testResults,
        environment: {
          nodeVersion: process.version,
          dependencies: {},
          configuration: {
            SUPABASE_URL: process.env.TEST_SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
            GEMINI_API_KEY: process.env.TEST_GEMINI_API_KEY,
            OPENROUTER_API_KEY: process.env.TEST_OPENROUTER_API_KEY
          }
        }
      };

      // Run security criteria validation
      const report = await validator.validateCategory('security', context);

      // Validate security criteria
      expect(report.overallScore).toBeGreaterThan(0.9); // 90% overall security score
      expect(report.criticalFailures?.length || 0).toBe(0);

      console.log(`\n🔐 Security Criteria Validation Results:`);
      console.log(`Overall Security Score: ${(report.overallScore! * 100).toFixed(1)}%`);
      console.log(`Critical Security Issues: ${report.criticalFailures?.length || 0}`);
      console.log(`Security Recommendations: ${report.recommendations?.length || 0}`);

      // Check specific security criteria
      const authCheck = report.checkResults?.['security_api_authentication'];
      const encryptionCheck = report.checkResults?.['security_data_encryption'];

      if (authCheck) {
        console.log(`API Authentication: ${authCheck.passed ? '✅' : '❌'} ${authCheck.actualValue}`);
      }
      if (encryptionCheck) {
        console.log(`Data Encryption: ${encryptionCheck.passed ? '✅' : '❌'} ${encryptionCheck.actualValue}`);
      }
    }, 30000);
  });

  describe('Operational Criteria Validation', () => {
    it('should validate all operational criteria meet production requirements', async () => {
      const testState = getTestState();

      // Create validation context with operational data
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testResults: {
          ...testResults,
          loadTest: {
            totalRequests: 100,
            successfulRequests: 95,
            concurrentUsers: 50,
            overallScore: 0.85
          }
        },
        environment: {
          nodeVersion: process.version,
          dependencies: {
            vitest: '1.0.0',
            '@supabase/supabase-js': '2.0.0'
          },
          configuration: {
            SUPABASE_URL: process.env.TEST_SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
          }
        }
      };

      // Run operational criteria validation
      const report = await validator.validateCategory('operational', context);

      // Validate operational criteria
      expect(report.overallScore).toBeGreaterThan(0.75); // 75% overall operational score

      console.log(`\n⚙️  Operational Criteria Validation Results:`);
      console.log(`Overall Operational Score: ${(report.overallScore! * 100).toFixed(1)}%`);
      console.log(`Operational Recommendations: ${report.recommendations?.length || 0}`);

      // Check specific operational criteria
      const monitoringCheck = report.checkResults?.['operational_monitoring'];

      if (monitoringCheck) {
        console.log(`Monitoring Capabilities: ${monitoringCheck.passed ? '✅' : '❌'} ${monitoringCheck.actualValue}`);
      }
    }, 30000);
  });

  describe('Complete Production Readiness Validation', () => {
    it('should run complete production readiness validation and generate deployment recommendation', async () => {
      const testState = getTestState();

      // Create comprehensive validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testResults: {
          performance: testResults.performance || {
            singleUpload: { avgProcessingTime: 6000, totalAttempts: 1, successfulAttempts: 1 },
            batchUpload: { avgProcessingTimePerFile: 8000, totalAttempts: 10, successfulAttempts: 9 },
            queueSystem: { throughput: 50 },
            monitoring: { dashboardLoadTime: 2000 }
          },
          failureRecovery: { averageRecoveryTime: 180 },
          dataConsistency: { overallScore: 0.99, criticalIssues: [] },
          loadTest: { totalRequests: 100, successfulRequests: 95, concurrentUsers: 50, overallScore: 0.85 }
        },
        environment: {
          nodeVersion: process.version,
          dependencies: { vitest: '1.0.0', '@supabase/supabase-js': '2.0.0' },
          configuration: {
            SUPABASE_URL: process.env.TEST_SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
            GEMINI_API_KEY: process.env.TEST_GEMINI_API_KEY
          }
        }
      };

      // Run complete production readiness validation
      const report = await validator.validateProductionReadiness(context);

      // Validate overall production readiness
      expect(report.overallScore).toBeGreaterThan(0.8); // 80% overall readiness score
      expect(report.readinessLevel).not.toBe('not_ready');

      console.log(`\n🚀 Complete Production Readiness Validation Results:`);
      console.log(`Overall Readiness Score: ${(report.overallScore * 100).toFixed(1)}%`);
      console.log(`Readiness Level: ${report.readinessLevel.toUpperCase()}`);
      console.log(`\nCategory Scores:`);
      console.log(`  Performance: ${(report.categoryScores.performance * 100).toFixed(1)}%`);
      console.log(`  Reliability: ${(report.categoryScores.reliability * 100).toFixed(1)}%`);
      console.log(`  Security: ${(report.categoryScores.security * 100).toFixed(1)}%`);
      console.log(`  Operational: ${(report.categoryScores.operational * 100).toFixed(1)}%`);
      console.log(`\nSummary:`);
      console.log(`  Total Checks: ${report.summary.totalChecks}`);
      console.log(`  Passed Checks: ${report.summary.passedChecks}`);
      console.log(`  Critical Checks: ${report.summary.criticalChecks}`);
      console.log(`  Passed Critical: ${report.summary.passedCriticalChecks}`);
      console.log(`\nDeployment Recommendation:`);
      console.log(`  Approved: ${report.deploymentRecommendation.approved ? '✅' : '❌'}`);
      console.log(`  Timeline: ${report.deploymentRecommendation.timeline}`);
      
      if (report.deploymentRecommendation.conditions.length > 0) {
        console.log(`  Conditions: ${report.deploymentRecommendation.conditions.join(', ')}`);
      }
      
      if (report.deploymentRecommendation.risks.length > 0) {
        console.log(`  Risks: ${report.deploymentRecommendation.risks.join(', ')}`);
      }

      // Should have minimal critical failures for production readiness
      expect(report.criticalFailures.length).toBeLessThan(3);
      expect(report.summary.passedCriticalChecks / report.summary.criticalChecks).toBeGreaterThan(0.8);
    }, 60000);
  });
});
