/**
 * Performance Testing and Validation Suite
 * Comprehensive testing for usage statistics loading performance
 */

import { supabase } from '@/integrations/supabase/client';

export interface PerformanceMetrics {
  testName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  dataSize?: number;
  cacheHit?: boolean;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

export class PerformanceTestSuite {
  private metrics: PerformanceMetrics[] = [];
  private testStartTime: number = 0;

  /**
   * Start the performance test suite
   */
  startTesting() {
    this.testStartTime = Date.now();
    this.metrics = [];
    console.log('🚀 Starting Performance Test Suite...');
  }

  /**
   * Test 1: Basic RPC Function Performance
   */
  async testRPCFunctionPerformance(): Promise<PerformanceMetrics> {
    const testName = 'RPC Function Performance';
    const startTime = Date.now();
    
    try {
      console.log('📊 Testing RPC function performance...');
      
      const { data, error } = await supabase.rpc('get_my_usage_stats_optimized');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (error) {
        throw new Error(error.message);
      }

      const metric: PerformanceMetrics = {
        testName,
        startTime,
        endTime,
        duration,
        success: true,
        dataSize: JSON.stringify(data).length,
        metadata: {
          hasData: !!data,
          calculationMethod: data?.calculation_method,
          receiptsCount: data?.receipts_used_this_month,
          storageUsed: data?.storage_used_mb,
        }
      };

      this.metrics.push(metric);
      console.log(`✅ ${testName}: ${duration}ms`);
      return metric;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const metric: PerformanceMetrics = {
        testName,
        startTime,
        endTime,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.metrics.push(metric);
      console.error(`❌ ${testName}: ${error}`);
      return metric;
    }
  }

  /**
   * Test 2: React Query Cache Performance
   */
  async testReactQueryCachePerformance(): Promise<PerformanceMetrics> {
    const testName = 'React Query Cache Performance';
    const startTime = Date.now();
    
    try {
      console.log('🗄️ Testing React Query cache performance...');
      
      // This would be called from a component context in real usage
      // For testing, we'll simulate the cache behavior
      const cacheKey = 'subscription-usage-test';
      const cachedData = localStorage.getItem(cacheKey);
      
      let isCacheHit = false;
      let data;
      
      if (cachedData) {
        data = JSON.parse(cachedData);
        isCacheHit = true;
      } else {
        // Simulate fresh fetch
        const { data: freshData, error } = await supabase.rpc('get_my_usage_stats_optimized');
        if (error) throw new Error(error.message);
        
        data = freshData;
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      const metric: PerformanceMetrics = {
        testName,
        startTime,
        endTime,
        duration,
        success: true,
        cacheHit: isCacheHit,
        dataSize: JSON.stringify(data).length,
        metadata: {
          cacheStrategy: isCacheHit ? 'cache_hit' : 'fresh_fetch',
          dataFreshness: isCacheHit ? 'cached' : 'fresh'
        }
      };

      this.metrics.push(metric);
      console.log(`✅ ${testName}: ${duration}ms (${isCacheHit ? 'Cache Hit' : 'Fresh Fetch'})`);
      return metric;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const metric: PerformanceMetrics = {
        testName,
        startTime,
        endTime,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.metrics.push(metric);
      console.error(`❌ ${testName}: ${error}`);
      return metric;
    }
  }

  /**
   * Test 3: Data Accuracy Validation
   */
  async validateDataAccuracy(): Promise<ValidationResult> {
    console.log('🔍 Validating data accuracy...');
    
    try {
      const { data, error } = await supabase.rpc('get_my_usage_stats_optimized');
      
      if (error) {
        return {
          isValid: false,
          errors: [`RPC Error: ${error.message}`],
          warnings: []
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate required fields
      const requiredFields = [
        'receipts_used_this_month',
        'storage_used_mb',
        'total_receipts',
        'limits',
        'calculation_method'
      ];

      for (const field of requiredFields) {
        if (data[field] === undefined || data[field] === null) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Validate data types and ranges
      if (typeof data.receipts_used_this_month !== 'number' || data.receipts_used_this_month < 0) {
        errors.push('receipts_used_this_month must be a non-negative number');
      }

      if (typeof data.storage_used_mb !== 'number' || data.storage_used_mb < 0) {
        errors.push('storage_used_mb must be a non-negative number');
      }

      if (typeof data.total_receipts !== 'number' || data.total_receipts < 0) {
        errors.push('total_receipts must be a non-negative number');
      }

      // Validate logical consistency
      if (data.receipts_used_this_month > data.total_receipts) {
        warnings.push('receipts_used_this_month is greater than total_receipts');
      }

      // Validate limits structure
      if (!data.limits || typeof data.limits !== 'object') {
        errors.push('limits must be an object');
      } else {
        const requiredLimitFields = ['monthly_receipts', 'storage_limit_mb', 'batch_upload_limit'];
        for (const field of requiredLimitFields) {
          if (data.limits[field] === undefined) {
            errors.push(`Missing limit field: ${field}`);
          }
        }
      }

      const isValid = errors.length === 0;
      
      if (isValid) {
        console.log('✅ Data accuracy validation passed');
      } else {
        console.error('❌ Data accuracy validation failed:', errors);
      }

      if (warnings.length > 0) {
        console.warn('⚠️ Data accuracy warnings:', warnings);
      }

      return {
        isValid,
        errors,
        warnings,
        data
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Test 4: Cross-validation with Legacy Queries
   */
  async testDataConsistency(): Promise<PerformanceMetrics> {
    const testName = 'Data Consistency Validation';
    const startTime = Date.now();

    try {
      console.log('🔄 Testing data consistency between optimized and legacy queries...');

      // Get optimized data
      const { data: optimizedData, error: optimizedError } = await supabase.rpc('get_my_usage_stats_optimized');
      if (optimizedError) throw new Error(`Optimized query failed: ${optimizedError.message}`);

      // Get legacy data for comparison (simplified version)
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('receipts')
        .select('id, created_at, image_url')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      if (receiptsError) throw new Error(`Legacy query failed: ${receiptsError.message}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Compare results
      const legacyReceiptsThisMonth = receiptsData?.length || 0;
      const optimizedReceiptsThisMonth = optimizedData?.receipts_used_this_month || 0;

      const consistencyCheck = Math.abs(legacyReceiptsThisMonth - optimizedReceiptsThisMonth) <= 1; // Allow 1 receipt difference due to timing

      const metric: PerformanceMetrics = {
        testName,
        startTime,
        endTime,
        duration,
        success: consistencyCheck,
        error: consistencyCheck ? undefined : `Data inconsistency: Legacy=${legacyReceiptsThisMonth}, Optimized=${optimizedReceiptsThisMonth}`,
        metadata: {
          legacyReceiptsThisMonth,
          optimizedReceiptsThisMonth,
          difference: Math.abs(legacyReceiptsThisMonth - optimizedReceiptsThisMonth),
          consistencyCheck,
          optimizedCalculationMethod: optimizedData?.calculation_method
        }
      };

      this.metrics.push(metric);
      console.log(`${consistencyCheck ? '✅' : '❌'} ${testName}: ${duration}ms`);
      return metric;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const metric: PerformanceMetrics = {
        testName,
        startTime,
        endTime,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.metrics.push(metric);
      console.error(`❌ ${testName}: ${error}`);
      return metric;
    }
  }

  /**
   * Test 5: Load Testing with Realistic Data Volumes
   */
  async testWithRealisticDataVolume(): Promise<PerformanceMetrics> {
    const testName = 'Realistic Data Volume Test';
    const startTime = Date.now();
    
    try {
      console.log('📈 Testing with realistic data volumes...');
      
      // Get current user's actual data volume
      const { data: receiptCount } = await supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true });

      const { data: usageStats, error } = await supabase.rpc('get_my_usage_stats_optimized');
      
      if (error) {
        throw new Error(error.message);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      const metric: PerformanceMetrics = {
        testName,
        startTime,
        endTime,
        duration,
        success: true,
        metadata: {
          receiptCount: receiptCount || 0,
          totalReceipts: usageStats?.total_receipts || 0,
          receiptsThisMonth: usageStats?.receipts_used_this_month || 0,
          storageUsedMB: usageStats?.storage_used_mb || 0,
          calculationMethod: usageStats?.calculation_method,
          dataVolumeCategory: this.categorizeDataVolume(receiptCount || 0)
        }
      };

      this.metrics.push(metric);
      console.log(`✅ ${testName}: ${duration}ms with ${receiptCount || 0} receipts`);
      return metric;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const metric: PerformanceMetrics = {
        testName,
        startTime,
        endTime,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.metrics.push(metric);
      console.error(`❌ ${testName}: ${error}`);
      return metric;
    }
  }

  /**
   * Categorize data volume for testing
   */
  private categorizeDataVolume(receiptCount: number): string {
    if (receiptCount < 10) return 'minimal';
    if (receiptCount < 50) return 'light';
    if (receiptCount < 200) return 'moderate';
    if (receiptCount < 500) return 'heavy';
    return 'very_heavy';
  }

  /**
   * Generate comprehensive test report
   */
  generateReport(): {
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      averageDuration: number;
      under3Seconds: boolean;
    };
    metrics: PerformanceMetrics[];
    recommendations: string[];
  } {
    const totalTests = this.metrics.length;
    const passedTests = this.metrics.filter(m => m.success).length;
    const failedTests = totalTests - passedTests;
    const averageDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalTests;
    const under3Seconds = this.metrics.every(m => m.duration < 3000);

    const recommendations: string[] = [];

    // Performance recommendations
    if (averageDuration > 3000) {
      recommendations.push('⚠️ Average load time exceeds 3 seconds - consider further optimization');
    }

    if (averageDuration > 1000) {
      recommendations.push('💡 Consider implementing more aggressive caching strategies');
    }

    if (failedTests > 0) {
      recommendations.push('🔧 Address failed tests before deploying to production');
    }

    if (under3Seconds && passedTests === totalTests) {
      recommendations.push('🎉 All performance targets met! Ready for production');
    }

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        averageDuration,
        under3Seconds
      },
      metrics: this.metrics,
      recommendations
    };
  }

  /**
   * Run complete test suite
   */
  async runCompleteTestSuite(): Promise<any> {
    this.startTesting();

    console.log('🧪 Running Complete Performance Test Suite...\n');

    // Run all tests
    await this.testRPCFunctionPerformance();
    await this.testReactQueryCachePerformance();
    const validation = await this.validateDataAccuracy();
    await this.testDataConsistency();
    await this.testWithRealisticDataVolume();

    // Generate report
    const report = this.generateReport();

    console.log('\n📋 Performance Test Report:');
    console.log('================================');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Average Duration: ${report.summary.averageDuration.toFixed(2)}ms`);
    console.log(`Under 3 seconds: ${report.summary.under3Seconds ? '✅ Yes' : '❌ No'}`);
    console.log(`Data Validation: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(rec));
    }

    return {
      ...report,
      validation,
      totalTestTime: Date.now() - this.testStartTime
    };
  }
}
