/**
 * Load Test Runner
 * 
 * This file provides the infrastructure for running load tests
 * with concurrent users, system monitoring, and result collection.
 */

import { LoadTestScenario, UserBehaviorPattern, HEALTH_MONITORING_CONFIG } from './load-test-config';
import { generateTestReceiptData } from '../fixtures/test-data';

export interface LoadTestUser {
  id: string;
  userId: string;
  teamId: string;
  isActive: boolean;
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  lastRequestTime: number;
}

export interface LoadTestMetrics {
  startTime: number;
  endTime?: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number; // requests per minute
  errorRate: number;
  concurrentUsers: number;
  systemHealth: SystemHealthSnapshot[];
  userMetrics: LoadTestUser[];
}

export interface SystemHealthSnapshot {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  networkUsage: number;
  queueDepth: number;
  activeWorkers: number;
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
}

export class LoadTestRunner {
  private testState: any;
  private activeUsers: Map<string, LoadTestUser> = new Map();
  private metrics: LoadTestMetrics;
  private healthMonitor?: NodeJS.Timeout;
  private isRunning = false;

  constructor(testState: any) {
    this.testState = testState;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): LoadTestMetrics {
    return {
      startTime: Date.now(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      concurrentUsers: 0,
      systemHealth: [],
      userMetrics: []
    };
  }

  /**
   * Run a load test scenario
   */
  async runLoadTest(scenario: LoadTestScenario): Promise<LoadTestMetrics> {
    console.log(`\n🚀 Starting Load Test: ${scenario.config.name}`);
    console.log(`Description: ${scenario.config.description}`);
    console.log(`Duration: ${scenario.config.duration / 1000}s`);
    console.log(`Concurrent Users: ${scenario.config.concurrentUsers}`);

    this.isRunning = true;
    this.metrics = this.initializeMetrics();
    this.metrics.startTime = Date.now();

    try {
      // Start system health monitoring
      this.startHealthMonitoring();

      // Start workers for load test
      const workerIds = await this.testState.utilities.startQueueWorkers(
        Math.min(scenario.config.concurrentUsers / 5, 10) // Scale workers with users
      );

      // Create test users
      await this.createTestUsers(scenario.config.concurrentUsers);

      // Ramp up users
      await this.rampUpUsers(scenario);

      // Run main test duration
      await this.runMainTestPhase(scenario);

      // Ramp down users
      await this.rampDownUsers(scenario);

      // Stop workers
      await this.testState.utilities.stopQueueWorkers(workerIds);

      // Stop health monitoring
      this.stopHealthMonitoring();

      this.metrics.endTime = Date.now();
      this.calculateFinalMetrics();

      console.log(`\n✅ Load Test Completed: ${scenario.config.name}`);
      this.printTestSummary();

      return this.metrics;

    } catch (error) {
      console.error(`\n❌ Load Test Failed: ${scenario.config.name}`, error);
      this.isRunning = false;
      this.stopHealthMonitoring();
      throw error;
    }
  }

  /**
   * Create test users for load testing
   */
  private async createTestUsers(userCount: number): Promise<void> {
    console.log(`📝 Creating ${userCount} test users...`);

    for (let i = 1; i <= userCount; i++) {
      const userId = `load-test-user-${i}`;
      const teamId = `load-test-team-${Math.ceil(i / 10)}`; // 10 users per team

      const user: LoadTestUser = {
        id: `user-${i}`,
        userId,
        teamId,
        isActive: false,
        requestCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        lastRequestTime: 0
      };

      this.activeUsers.set(user.id, user);
    }

    this.metrics.concurrentUsers = userCount;
  }

  /**
   * Ramp up users gradually
   */
  private async rampUpUsers(scenario: LoadTestScenario): Promise<void> {
    const { concurrentUsers, rampUpTime } = scenario.config;
    const intervalTime = rampUpTime / concurrentUsers;

    console.log(`📈 Ramping up ${concurrentUsers} users over ${rampUpTime / 1000}s...`);

    const users = Array.from(this.activeUsers.values());
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      user.isActive = true;
      
      // Start user behavior
      this.startUserBehavior(user, scenario);
      
      // Wait before starting next user
      if (i < users.length - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalTime));
      }
    }

    console.log(`✅ All users ramped up and active`);
  }

  /**
   * Run main test phase
   */
  private async runMainTestPhase(scenario: LoadTestScenario): Promise<void> {
    const mainDuration = scenario.config.duration - scenario.config.rampUpTime - scenario.config.rampDownTime;
    
    console.log(`⚡ Running main test phase for ${mainDuration / 1000}s...`);
    
    // Wait for main test duration
    await new Promise(resolve => setTimeout(resolve, mainDuration));
    
    console.log(`✅ Main test phase completed`);
  }

  /**
   * Ramp down users gradually
   */
  private async rampDownUsers(scenario: LoadTestScenario): Promise<void> {
    const { concurrentUsers, rampDownTime } = scenario.config;
    const intervalTime = rampDownTime / concurrentUsers;

    console.log(`📉 Ramping down ${concurrentUsers} users over ${rampDownTime / 1000}s...`);

    const users = Array.from(this.activeUsers.values());
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      user.isActive = false;
      
      // Wait before stopping next user
      if (i < users.length - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalTime));
      }
    }

    console.log(`✅ All users ramped down`);
  }

  /**
   * Start user behavior simulation
   */
  private async startUserBehavior(user: LoadTestUser, scenario: LoadTestScenario): Promise<void> {
    const executeUserAction = async () => {
      if (!user.isActive || !this.isRunning) {
        return;
      }

      try {
        // Select action based on behavior pattern weights
        const action = this.selectUserAction(scenario.userBehavior);
        
        // Execute action and measure response time
        const startTime = Date.now();
        await this.executeUserAction(user, action);
        const endTime = Date.now();
        
        const responseTime = endTime - startTime;
        
        // Update metrics
        this.updateUserMetrics(user, responseTime, true);
        this.updateGlobalMetrics(responseTime, true);
        
        user.lastRequestTime = endTime;

      } catch (error) {
        // Handle error
        this.updateUserMetrics(user, 0, false);
        this.updateGlobalMetrics(0, false);
        
        console.warn(`User ${user.id} action failed:`, error);
      }

      // Schedule next action
      if (user.isActive && this.isRunning) {
        const thinkTime = scenario.config.thinkTime + (Math.random() * 2000 - 1000); // ±1s variation
        setTimeout(executeUserAction, Math.max(0, thinkTime));
      }
    };

    // Start user behavior
    executeUserAction();
  }

  /**
   * Select user action based on behavior pattern weights
   */
  private selectUserAction(behaviorPatterns: UserBehaviorPattern[]): UserBehaviorPattern {
    const totalWeight = behaviorPatterns.reduce((sum, pattern) => sum + pattern.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const pattern of behaviorPatterns) {
      currentWeight += pattern.weight;
      if (random <= currentWeight) {
        return pattern;
      }
    }
    
    return behaviorPatterns[0]; // Fallback
  }

  /**
   * Execute a specific user action
   */
  private async executeUserAction(user: LoadTestUser, action: UserBehaviorPattern): Promise<void> {
    switch (action.action) {
      case 'upload_single':
        await this.simulateSingleUpload(user, action.parameters);
        break;
      case 'upload_batch':
        await this.simulateBatchUpload(user, action.parameters);
        break;
      case 'view_dashboard':
        await this.simulateDashboardView(user);
        break;
      case 'check_status':
        await this.simulateStatusCheck(user);
        break;
      case 'wait':
        await new Promise(resolve => setTimeout(resolve, action.parameters?.waitTime || 1000));
        break;
    }
  }

  /**
   * Simulate single upload
   */
  private async simulateSingleUpload(user: LoadTestUser, parameters?: any): Promise<void> {
    const receipt = generateTestReceiptData(1)[0];
    
    await this.testState.utilities.addToQueue([{
      source_type: 'receipts',
      source_id: `${receipt.id}-${user.id}`,
      operation: 'INSERT',
      priority: parameters?.priority || 'medium'
    }]);
  }

  /**
   * Simulate batch upload
   */
  private async simulateBatchUpload(user: LoadTestUser, parameters?: any): Promise<void> {
    const batchSize = parameters?.batchSize || 10;
    const receipts = generateTestReceiptData(batchSize);
    
    const queueItems = receipts.map(receipt => ({
      source_type: 'receipts',
      source_id: `${receipt.id}-${user.id}`,
      operation: 'INSERT',
      priority: parameters?.priority || 'medium'
    }));

    await this.testState.utilities.addToQueue(queueItems);
  }

  /**
   * Simulate dashboard view
   */
  private async simulateDashboardView(user: LoadTestUser): Promise<void> {
    await this.testState.utilities.loadDashboardData();
  }

  /**
   * Simulate status check
   */
  private async simulateStatusCheck(user: LoadTestUser): Promise<void> {
    await this.testState.utilities.getQueueStatus();
  }

  /**
   * Update user-specific metrics
   */
  private updateUserMetrics(user: LoadTestUser, responseTime: number, success: boolean): void {
    user.requestCount++;
    if (!success) {
      user.errorCount++;
    }
    if (responseTime > 0) {
      user.totalResponseTime += responseTime;
    }
  }

  /**
   * Update global metrics
   */
  private updateGlobalMetrics(responseTime: number, success: boolean): void {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    if (responseTime > 0) {
      this.metrics.totalResponseTime += responseTime;
      this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, responseTime);
      this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, responseTime);
    }
  }

  /**
   * Start system health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthMonitor = setInterval(async () => {
      try {
        const healthSnapshot = await this.collectHealthSnapshot();
        this.metrics.systemHealth.push(healthSnapshot);
        
        // Check for graceful degradation triggers
        this.checkGracefulDegradationTriggers(healthSnapshot);
        
      } catch (error) {
        console.warn('Health monitoring error:', error);
      }
    }, HEALTH_MONITORING_CONFIG.checkInterval);
  }

  /**
   * Stop system health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthMonitor) {
      clearInterval(this.healthMonitor);
      this.healthMonitor = undefined;
    }
  }

  /**
   * Collect system health snapshot
   */
  private async collectHealthSnapshot(): Promise<SystemHealthSnapshot> {
    const queueStatus = await this.testState.utilities.getQueueStatus();
    const currentTime = Date.now();
    const recentRequests = this.metrics.totalRequests;
    const recentErrors = this.metrics.failedRequests;
    
    return {
      timestamp: currentTime,
      cpuUsage: Math.random() * 0.3 + 0.4, // Simulated: 40-70%
      memoryUsage: Math.random() * 0.2 + 0.5, // Simulated: 50-70%
      networkUsage: Math.random() * 0.2 + 0.3, // Simulated: 30-50%
      queueDepth: queueStatus.pendingItems,
      activeWorkers: queueStatus.activeWorkers,
      avgResponseTime: this.metrics.totalRequests > 0 ? 
        this.metrics.totalResponseTime / this.metrics.totalRequests : 0,
      errorRate: this.metrics.totalRequests > 0 ? 
        this.metrics.failedRequests / this.metrics.totalRequests : 0,
      throughput: this.calculateCurrentThroughput()
    };
  }

  /**
   * Check for graceful degradation triggers
   */
  private checkGracefulDegradationTriggers(health: SystemHealthSnapshot): void {
    const triggers = HEALTH_MONITORING_CONFIG.gracefulDegradationTriggers;
    
    if (health.cpuUsage > triggers.cpu_usage ||
        health.memoryUsage > triggers.memory_usage ||
        health.errorRate > triggers.error_rate ||
        health.avgResponseTime > triggers.response_time) {
      
      console.warn(`⚠️  Graceful degradation triggered at ${new Date(health.timestamp).toISOString()}`);
      console.warn(`CPU: ${(health.cpuUsage * 100).toFixed(1)}%, Memory: ${(health.memoryUsage * 100).toFixed(1)}%`);
      console.warn(`Error Rate: ${(health.errorRate * 100).toFixed(1)}%, Response Time: ${health.avgResponseTime.toFixed(0)}ms`);
    }
  }

  /**
   * Calculate current throughput
   */
  private calculateCurrentThroughput(): number {
    const elapsedTime = (Date.now() - this.metrics.startTime) / 1000 / 60; // minutes
    return elapsedTime > 0 ? this.metrics.totalRequests / elapsedTime : 0;
  }

  /**
   * Calculate final metrics
   */
  private calculateFinalMetrics(): void {
    const totalTime = (this.metrics.endTime! - this.metrics.startTime) / 1000 / 60; // minutes
    
    this.metrics.throughput = totalTime > 0 ? this.metrics.totalRequests / totalTime : 0;
    this.metrics.errorRate = this.metrics.totalRequests > 0 ? 
      this.metrics.failedRequests / this.metrics.totalRequests : 0;
    
    // Update user metrics
    this.metrics.userMetrics = Array.from(this.activeUsers.values());
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    console.log(`\n📊 Load Test Summary:`);
    console.log(`Total Requests: ${this.metrics.totalRequests}`);
    console.log(`Successful: ${this.metrics.successfulRequests} (${((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${this.metrics.failedRequests} (${(this.metrics.errorRate * 100).toFixed(1)}%)`);
    console.log(`Throughput: ${this.metrics.throughput.toFixed(1)} requests/min`);
    console.log(`Avg Response Time: ${(this.metrics.totalResponseTime / this.metrics.totalRequests).toFixed(0)}ms`);
    console.log(`Response Time Range: ${this.metrics.minResponseTime.toFixed(0)}ms - ${this.metrics.maxResponseTime.toFixed(0)}ms`);
    console.log(`Concurrent Users: ${this.metrics.concurrentUsers}`);
  }
}
