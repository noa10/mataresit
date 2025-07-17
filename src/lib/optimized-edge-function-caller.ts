/**
 * Optimized Edge Function Caller
 * High-performance edge function calls with intelligent retry, timeout management, and connection optimization
 */

import { supabase } from './supabase';

// Edge function call configuration
interface EdgeFunctionConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// Call metrics
interface CallMetrics {
  functionName: string;
  duration: number;
  success: boolean;
  retryCount: number;
  errorType?: string;
  timestamp: number;
}

class OptimizedEdgeFunctionCaller {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private callMetrics: CallMetrics[] = [];
  private activeRequests: Map<string, AbortController> = new Map();
  
  private readonly defaultConfig: EdgeFunctionConfig = {
    timeout: 15000, // 15 seconds (reduced from 90s)
    retries: 1, // Reduced retries for speed
    retryDelay: 1000, // 1 second delay
    circuitBreakerThreshold: 5, // Open circuit after 5 failures
    circuitBreakerTimeout: 30000 // 30 seconds before trying again
  };

  // Function-specific configurations
  private readonly functionConfigs: Record<string, Partial<EdgeFunctionConfig>> = {
    'unified-search': {
      timeout: 15000,
      retries: 1,
      circuitBreakerThreshold: 3
    },
    'semantic-search': {
      timeout: 10000,
      retries: 2,
      circuitBreakerThreshold: 5
    },
    'generate-embeddings': {
      timeout: 30000,
      retries: 0,
      circuitBreakerThreshold: 10
    }
  };

  /**
   * Call edge function with optimizations
   */
  async callOptimized<T = any>(
    functionName: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    body?: any,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const startTime = performance.now();
    const config = this.getConfig(functionName);
    const requestId = this.generateRequestId(functionName);

    try {
      // Check circuit breaker
      if (this.isCircuitOpen(functionName)) {
        throw new Error(`Circuit breaker open for ${functionName}`);
      }

      // Execute call with retries
      const result = await this.executeWithRetries(
        functionName,
        method,
        body,
        queryParams,
        config,
        requestId
      );

      // Record success metrics
      this.recordMetrics({
        functionName,
        duration: performance.now() - startTime,
        success: true,
        retryCount: 0,
        timestamp: Date.now()
      });

      // Reset circuit breaker on success
      this.resetCircuitBreaker(functionName);

      return result;

    } catch (error) {
      // Record failure metrics
      this.recordMetrics({
        functionName,
        duration: performance.now() - startTime,
        success: false,
        retryCount: 0,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        timestamp: Date.now()
      });

      // Update circuit breaker
      this.recordFailure(functionName);

      throw error;
    } finally {
      // Clean up active request
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Execute call with intelligent retry logic
   */
  private async executeWithRetries<T>(
    functionName: string,
    method: string,
    body: any,
    queryParams: Record<string, string> | undefined,
    config: EdgeFunctionConfig,
    requestId: string
  ): Promise<T> {
    let lastError: Error;
    let retryCount = 0;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        // Add delay for retries
        if (attempt > 0) {
          await this.delay(config.retryDelay * attempt);
        }

        const result = await this.executeSingleCall<T>(
          functionName,
          method,
          body,
          queryParams,
          config,
          requestId
        );

        // Update retry count in metrics
        if (retryCount > 0) {
          const lastMetric = this.callMetrics[this.callMetrics.length - 1];
          if (lastMetric) {
            lastMetric.retryCount = retryCount;
          }
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        // Don't retry certain errors
        if (this.shouldNotRetry(lastError)) {
          break;
        }

        console.warn(`Edge function ${functionName} attempt ${attempt + 1} failed:`, lastError.message);
      }
    }

    throw lastError!;
  }

  /**
   * Execute single edge function call
   */
  private async executeSingleCall<T>(
    functionName: string,
    method: string,
    body: any,
    queryParams: Record<string, string> | undefined,
    config: EdgeFunctionConfig,
    requestId: string
  ): Promise<T> {
    
    // Create abort controller for timeout
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config.timeout);

    try {
      // Get session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`);
      }

      if (!session) {
        throw new Error('No active session found');
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'X-Request-ID': requestId,
        'X-Client-Info': 'optimized-caller/1.0'
      };

      // Build URL with query parameters
      const baseUrl = `${supabase.supabaseUrl}/functions/v1/${functionName}`;
      const url = new URL(baseUrl);
      
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      // Add cache-busting timestamp
      url.searchParams.append('t', Date.now().toString());

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal
      };

      // Add body for non-GET requests
      if (method !== 'GET' && body) {
        requestOptions.body = JSON.stringify(body);
      }

      console.log(`🚀 Calling optimized edge function: ${functionName} (${method})`);

      // Execute request
      const response = await fetch(url.toString(), requestOptions);

      // Clear timeout
      clearTimeout(timeoutId);

      // Check response status
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Parse response
      const result = await response.json();

      console.log(`✅ Edge function ${functionName} completed successfully`);
      return result;

    } catch (error) {
      clearTimeout(timeoutId);

      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error(`Edge function ${functionName} timed out after ${config.timeout}ms`);
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network error calling ${functionName}: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Check if error should not be retried
   */
  private shouldNotRetry(error: Error): boolean {
    const nonRetryableErrors = [
      'Authentication error',
      'No active session',
      'HTTP 400',
      'HTTP 401',
      'HTTP 403',
      'HTTP 404'
    ];

    return nonRetryableErrors.some(pattern => error.message.includes(pattern));
  }

  /**
   * Get configuration for function
   */
  private getConfig(functionName: string): EdgeFunctionConfig {
    const functionConfig = this.functionConfigs[functionName] || {};
    return { ...this.defaultConfig, ...functionConfig };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(functionName: string): string {
    return `${functionName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(functionName: string): boolean {
    const breaker = this.circuitBreakers.get(functionName);
    
    if (!breaker || breaker.state === 'closed') {
      return false;
    }

    if (breaker.state === 'open') {
      const config = this.getConfig(functionName);
      if (Date.now() - breaker.lastFailure > config.circuitBreakerTimeout) {
        // Move to half-open state
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }

    return false; // half-open state allows one attempt
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(functionName: string): void {
    const config = this.getConfig(functionName);
    let breaker = this.circuitBreakers.get(functionName);
    
    if (!breaker) {
      breaker = { failures: 0, lastFailure: 0, state: 'closed' };
      this.circuitBreakers.set(functionName, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= config.circuitBreakerThreshold) {
      breaker.state = 'open';
      console.warn(`🔴 Circuit breaker opened for ${functionName} after ${breaker.failures} failures`);
    }
  }

  /**
   * Reset circuit breaker on success
   */
  private resetCircuitBreaker(functionName: string): void {
    const breaker = this.circuitBreakers.get(functionName);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
    }
  }

  /**
   * Record call metrics
   */
  private recordMetrics(metrics: CallMetrics): void {
    this.callMetrics.push(metrics);

    // Keep only recent metrics
    if (this.callMetrics.length > 1000) {
      this.callMetrics = this.callMetrics.slice(-1000);
    }

    // Log slow calls
    if (metrics.duration > 5000) {
      console.warn(`🐌 Slow edge function call: ${functionName} took ${metrics.duration.toFixed(2)}ms`);
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests(): void {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageCallTime: number;
    successRate: number;
    circuitBreakerStatus: Record<string, string>;
    functionStats: Record<string, {
      calls: number;
      averageTime: number;
      successRate: number;
    }>;
  } {
    const metrics = this.callMetrics;
    
    if (metrics.length === 0) {
      return {
        averageCallTime: 0,
        successRate: 0,
        circuitBreakerStatus: {},
        functionStats: {}
      };
    }

    const avgTime = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    const successes = metrics.filter(m => m.success).length;
    const successRate = (successes / metrics.length) * 100;

    // Circuit breaker status
    const circuitBreakerStatus: Record<string, string> = {};
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerStatus[name] = breaker.state;
    }

    // Function-specific stats
    const functionStats: Record<string, any> = {};
    const functionGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.functionName]) {
        groups[metric.functionName] = [];
      }
      groups[metric.functionName].push(metric);
      return groups;
    }, {} as Record<string, CallMetrics[]>);

    for (const [name, funcMetrics] of Object.entries(functionGroups)) {
      const funcSuccesses = funcMetrics.filter(m => m.success).length;
      const funcAvgTime = funcMetrics.reduce((sum, m) => sum + m.duration, 0) / funcMetrics.length;
      
      functionStats[name] = {
        calls: funcMetrics.length,
        averageTime: funcAvgTime,
        successRate: (funcSuccesses / funcMetrics.length) * 100
      };
    }

    return {
      averageCallTime: avgTime,
      successRate,
      circuitBreakerStatus,
      functionStats
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }

  /**
   * Clear metrics and reset state
   */
  cleanup(): void {
    this.cancelAllRequests();
    this.circuitBreakers.clear();
    this.callMetrics = [];
  }
}

// Export singleton instance
export const optimizedEdgeFunctionCaller = new OptimizedEdgeFunctionCaller();
export type { CallMetrics, EdgeFunctionConfig };
