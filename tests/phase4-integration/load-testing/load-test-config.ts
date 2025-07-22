/**
 * Load Testing Configuration
 * 
 * This file defines the configuration and scenarios for load testing
 * the Phase 4 integrated system under various load conditions.
 */

export interface LoadTestConfig {
  name: string;
  description: string;
  duration: number; // milliseconds
  concurrentUsers: number;
  rampUpTime: number; // milliseconds
  rampDownTime: number; // milliseconds
  batchSize: number;
  requestsPerUser: number;
  thinkTime: number; // milliseconds between requests
  maxResponseTime: number; // milliseconds
  minSuccessRate: number; // percentage
  resourceLimits: {
    maxCpuUsage: number;
    maxMemoryUsage: number;
    maxNetworkUsage: number;
  };
}

export interface LoadTestScenario {
  config: LoadTestConfig;
  userBehavior: UserBehaviorPattern[];
  expectedOutcomes: ExpectedOutcomes;
}

export interface UserBehaviorPattern {
  action: 'upload_single' | 'upload_batch' | 'view_dashboard' | 'check_status' | 'wait';
  weight: number; // probability weight
  parameters?: {
    batchSize?: number;
    fileSize?: number;
    priority?: string;
    waitTime?: number;
  };
}

export interface ExpectedOutcomes {
  minThroughput: number; // requests per minute
  maxErrorRate: number; // percentage
  maxResponseTime: number; // milliseconds
  systemStability: 'stable' | 'degraded' | 'unstable';
  gracefulDegradation: boolean;
}

/**
 * Peak Usage Load Test Configuration
 * Simulates normal peak usage with 50 concurrent users
 */
export const PEAK_USAGE_CONFIG: LoadTestScenario = {
  config: {
    name: 'Peak Usage Simulation',
    description: '50 concurrent users performing typical batch upload operations during peak hours',
    duration: 600000, // 10 minutes
    concurrentUsers: 50,
    rampUpTime: 120000, // 2 minutes ramp up
    rampDownTime: 60000, // 1 minute ramp down
    batchSize: 15, // Average batch size
    requestsPerUser: 20, // Requests per user during test
    thinkTime: 5000, // 5 seconds between requests
    maxResponseTime: 15000, // 15 seconds max response time
    minSuccessRate: 0.95, // 95% success rate
    resourceLimits: {
      maxCpuUsage: 0.80, // 80% CPU
      maxMemoryUsage: 0.85, // 85% Memory
      maxNetworkUsage: 0.75 // 75% Network
    }
  },
  userBehavior: [
    {
      action: 'upload_batch',
      weight: 0.6, // 60% of actions are batch uploads
      parameters: {
        batchSize: 15,
        priority: 'medium'
      }
    },
    {
      action: 'upload_single',
      weight: 0.2, // 20% single uploads
      parameters: {
        priority: 'high'
      }
    },
    {
      action: 'view_dashboard',
      weight: 0.15, // 15% dashboard views
    },
    {
      action: 'check_status',
      weight: 0.05, // 5% status checks
    }
  ],
  expectedOutcomes: {
    minThroughput: 200, // 200 requests per minute
    maxErrorRate: 0.05, // 5% error rate
    maxResponseTime: 12000, // 12 seconds
    systemStability: 'stable',
    gracefulDegradation: false
  }
};

/**
 * Stress Test Configuration
 * Pushes system beyond normal limits to test breaking points
 */
export const STRESS_TEST_CONFIG: LoadTestScenario = {
  config: {
    name: 'Stress Test',
    description: 'Push system beyond normal limits with 100 concurrent users and large batches',
    duration: 900000, // 15 minutes
    concurrentUsers: 100,
    rampUpTime: 180000, // 3 minutes ramp up
    rampDownTime: 120000, // 2 minutes ramp down
    batchSize: 50, // Large batch size
    requestsPerUser: 30, // More requests per user
    thinkTime: 2000, // 2 seconds between requests (faster)
    maxResponseTime: 30000, // 30 seconds max response time
    minSuccessRate: 0.80, // 80% success rate (lower due to stress)
    resourceLimits: {
      maxCpuUsage: 0.95, // 95% CPU
      maxMemoryUsage: 0.90, // 90% Memory
      maxNetworkUsage: 0.85 // 85% Network
    }
  },
  userBehavior: [
    {
      action: 'upload_batch',
      weight: 0.8, // 80% batch uploads under stress
      parameters: {
        batchSize: 50,
        priority: 'high'
      }
    },
    {
      action: 'upload_single',
      weight: 0.1, // 10% single uploads
      parameters: {
        priority: 'urgent'
      }
    },
    {
      action: 'view_dashboard',
      weight: 0.08, // 8% dashboard views
    },
    {
      action: 'check_status',
      weight: 0.02, // 2% status checks
    }
  ],
  expectedOutcomes: {
    minThroughput: 150, // Lower throughput under stress
    maxErrorRate: 0.20, // 20% error rate acceptable under stress
    maxResponseTime: 25000, // 25 seconds
    systemStability: 'degraded',
    gracefulDegradation: true
  }
};

/**
 * Spike Test Configuration
 * Sudden spike in traffic to test system elasticity
 */
export const SPIKE_TEST_CONFIG: LoadTestScenario = {
  config: {
    name: 'Spike Test',
    description: 'Sudden traffic spike from 10 to 80 users to test system elasticity',
    duration: 480000, // 8 minutes
    concurrentUsers: 80,
    rampUpTime: 30000, // 30 seconds rapid ramp up
    rampDownTime: 30000, // 30 seconds rapid ramp down
    batchSize: 25,
    requestsPerUser: 15,
    thinkTime: 3000, // 3 seconds between requests
    maxResponseTime: 20000, // 20 seconds max response time
    minSuccessRate: 0.85, // 85% success rate
    resourceLimits: {
      maxCpuUsage: 0.90, // 90% CPU
      maxMemoryUsage: 0.88, // 88% Memory
      maxNetworkUsage: 0.80 // 80% Network
    }
  },
  userBehavior: [
    {
      action: 'upload_batch',
      weight: 0.7, // 70% batch uploads
      parameters: {
        batchSize: 25,
        priority: 'medium'
      }
    },
    {
      action: 'upload_single',
      weight: 0.2, // 20% single uploads
      parameters: {
        priority: 'high'
      }
    },
    {
      action: 'view_dashboard',
      weight: 0.1, // 10% dashboard views
    }
  ],
  expectedOutcomes: {
    minThroughput: 180, // 180 requests per minute
    maxErrorRate: 0.15, // 15% error rate during spike
    maxResponseTime: 18000, // 18 seconds
    systemStability: 'degraded',
    gracefulDegradation: true
  }
};

/**
 * Endurance Test Configuration
 * Long-running test to check for memory leaks and performance degradation
 */
export const ENDURANCE_TEST_CONFIG: LoadTestScenario = {
  config: {
    name: 'Endurance Test',
    description: 'Long-running test with moderate load to check for memory leaks and degradation',
    duration: 3600000, // 60 minutes
    concurrentUsers: 30,
    rampUpTime: 300000, // 5 minutes ramp up
    rampDownTime: 300000, // 5 minutes ramp down
    batchSize: 10,
    requestsPerUser: 100, // Many requests over long period
    thinkTime: 8000, // 8 seconds between requests
    maxResponseTime: 12000, // 12 seconds max response time
    minSuccessRate: 0.95, // 95% success rate
    resourceLimits: {
      maxCpuUsage: 0.70, // 70% CPU
      maxMemoryUsage: 0.75, // 75% Memory
      maxNetworkUsage: 0.65 // 65% Network
    }
  },
  userBehavior: [
    {
      action: 'upload_batch',
      weight: 0.5, // 50% batch uploads
      parameters: {
        batchSize: 10,
        priority: 'medium'
      }
    },
    {
      action: 'upload_single',
      weight: 0.3, // 30% single uploads
      parameters: {
        priority: 'medium'
      }
    },
    {
      action: 'view_dashboard',
      weight: 0.15, // 15% dashboard views
    },
    {
      action: 'check_status',
      weight: 0.05, // 5% status checks
    }
  ],
  expectedOutcomes: {
    minThroughput: 120, // 120 requests per minute
    maxErrorRate: 0.05, // 5% error rate
    maxResponseTime: 10000, // 10 seconds
    systemStability: 'stable',
    gracefulDegradation: false
  }
};

/**
 * All load test scenarios
 */
export const LOAD_TEST_SCENARIOS: LoadTestScenario[] = [
  PEAK_USAGE_CONFIG,
  STRESS_TEST_CONFIG,
  SPIKE_TEST_CONFIG,
  ENDURANCE_TEST_CONFIG
];

/**
 * System health monitoring configuration
 */
export const HEALTH_MONITORING_CONFIG = {
  checkInterval: 5000, // 5 seconds
  metrics: [
    'cpu_usage',
    'memory_usage',
    'network_usage',
    'queue_depth',
    'active_workers',
    'response_times',
    'error_rates',
    'throughput'
  ],
  alertThresholds: {
    cpu_usage: 0.90, // 90%
    memory_usage: 0.85, // 85%
    network_usage: 0.80, // 80%
    queue_depth: 1000, // items
    response_time: 15000, // 15 seconds
    error_rate: 0.10 // 10%
  },
  gracefulDegradationTriggers: {
    cpu_usage: 0.85, // 85%
    memory_usage: 0.80, // 80%
    error_rate: 0.15, // 15%
    response_time: 20000 // 20 seconds
  }
};

/**
 * Load test result validation criteria
 */
export const LOAD_TEST_VALIDATION = {
  peakUsage: {
    minThroughput: 200,
    maxErrorRate: 0.05,
    maxResponseTime: 12000,
    resourceUtilization: 0.80
  },
  stressTest: {
    minThroughput: 150,
    maxErrorRate: 0.20,
    maxResponseTime: 25000,
    resourceUtilization: 0.95,
    gracefulDegradation: true
  },
  spikeTest: {
    minThroughput: 180,
    maxErrorRate: 0.15,
    maxResponseTime: 18000,
    recoveryTime: 60000 // 1 minute
  },
  enduranceTest: {
    minThroughput: 120,
    maxErrorRate: 0.05,
    maxResponseTime: 10000,
    memoryLeakThreshold: 0.10, // 10% memory increase over time
    performanceDegradation: 0.05 // 5% performance degradation
  }
};
