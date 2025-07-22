/**
 * Production Readiness Checklist
 * 
 * This file defines the comprehensive production readiness checklist
 * with specific criteria and validation requirements for Phase 4.
 */

export interface ChecklistItem {
  id: string;
  category: 'performance' | 'reliability' | 'security' | 'operational';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  criteria: {
    requirement: string;
    threshold?: string;
    measurement: string;
  };
  validationMethod: string;
  status: 'pending' | 'passed' | 'failed' | 'not_applicable';
  evidence?: string;
  notes?: string;
}

/**
 * Complete Production Readiness Checklist for Phase 4
 */
export const PRODUCTION_READINESS_CHECKLIST: ChecklistItem[] = [
  // Performance Criteria
  {
    id: 'perf_001',
    category: 'performance',
    priority: 'critical',
    title: 'Single Upload Processing Time',
    description: 'Individual receipt processing must complete within acceptable time limits',
    criteria: {
      requirement: 'Single upload processing time < 7.5 seconds',
      threshold: '7500ms',
      measurement: 'Average processing time from upload to embedding completion'
    },
    validationMethod: 'Automated performance test with 20 individual uploads',
    status: 'pending'
  },
  {
    id: 'perf_002',
    category: 'performance',
    priority: 'critical',
    title: 'Batch Upload Processing Time',
    description: 'Batch processing must maintain efficiency at scale',
    criteria: {
      requirement: 'Batch upload processing time < 9 seconds per file',
      threshold: '9000ms per file',
      measurement: 'Average processing time per file in 50-file batches'
    },
    validationMethod: 'Automated batch performance test with multiple batch sizes',
    status: 'pending'
  },
  {
    id: 'perf_003',
    category: 'performance',
    priority: 'high',
    title: 'Queue System Throughput',
    description: 'Queue system must handle production load efficiently',
    criteria: {
      requirement: 'Queue throughput > 45 items per minute',
      threshold: '45 items/min',
      measurement: 'Items processed per minute under normal load'
    },
    validationMethod: 'Queue performance test with 100+ items',
    status: 'pending'
  },
  {
    id: 'perf_004',
    category: 'performance',
    priority: 'medium',
    title: 'Monitoring Dashboard Load Time',
    description: 'Dashboard must load quickly for operational efficiency',
    criteria: {
      requirement: 'Dashboard load time < 2.5 seconds',
      threshold: '2500ms',
      measurement: 'Time to fully load dashboard with 2000+ metrics'
    },
    validationMethod: 'Dashboard performance test with large datasets',
    status: 'pending'
  },
  {
    id: 'perf_005',
    category: 'performance',
    priority: 'high',
    title: 'API Response Time',
    description: 'API endpoints must respond within acceptable limits',
    criteria: {
      requirement: 'API response time < 3 seconds (95th percentile)',
      threshold: '3000ms',
      measurement: '95th percentile response time under normal load'
    },
    validationMethod: 'Load testing with 50 concurrent users',
    status: 'pending'
  },

  // Reliability Criteria
  {
    id: 'rel_001',
    category: 'reliability',
    priority: 'critical',
    title: 'System Success Rate',
    description: 'Overall system must maintain high success rate',
    criteria: {
      requirement: 'System success rate > 95%',
      threshold: '95%',
      measurement: 'Successful operations / Total operations across all tests'
    },
    validationMethod: 'Aggregated success rate from all performance and load tests',
    status: 'pending'
  },
  {
    id: 'rel_002',
    category: 'reliability',
    priority: 'critical',
    title: 'Failure Recovery Time',
    description: 'System must recover quickly from failures',
    criteria: {
      requirement: 'Recovery time < 5 minutes',
      threshold: '300 seconds',
      measurement: 'Time from failure detection to full system recovery'
    },
    validationMethod: 'Failure injection and recovery testing',
    status: 'pending'
  },
  {
    id: 'rel_003',
    category: 'reliability',
    priority: 'critical',
    title: 'Data Consistency',
    description: 'Data must remain consistent across all systems',
    criteria: {
      requirement: 'Data consistency > 98%',
      threshold: '98%',
      measurement: 'Consistency score from comprehensive data validation'
    },
    validationMethod: 'Data consistency validation framework',
    status: 'pending'
  },
  {
    id: 'rel_004',
    category: 'reliability',
    priority: 'high',
    title: 'Concurrent Operation Handling',
    description: 'System must handle concurrent operations without corruption',
    criteria: {
      requirement: 'No data corruption during concurrent operations',
      threshold: '0% corruption rate',
      measurement: 'Data integrity validation during concurrent modifications'
    },
    validationMethod: 'Concurrent modification testing with 15+ operations',
    status: 'pending'
  },
  {
    id: 'rel_005',
    category: 'reliability',
    priority: 'high',
    title: 'Queue System Reliability',
    description: 'Queue must not lose items and handle failures gracefully',
    criteria: {
      requirement: 'Queue item loss rate < 1%',
      threshold: '1%',
      measurement: 'Items lost / Total items processed'
    },
    validationMethod: 'Queue reliability testing with worker failures',
    status: 'pending'
  },

  // Security Criteria
  {
    id: 'sec_001',
    category: 'security',
    priority: 'critical',
    title: 'API Authentication',
    description: 'All API endpoints must require proper authentication',
    criteria: {
      requirement: 'All endpoints require valid authentication',
      threshold: '100%',
      measurement: 'Authenticated endpoints / Total endpoints'
    },
    validationMethod: 'Security configuration validation',
    status: 'pending'
  },
  {
    id: 'sec_002',
    category: 'security',
    priority: 'critical',
    title: 'Data Encryption',
    description: 'All sensitive data must be encrypted in transit and at rest',
    criteria: {
      requirement: 'All data connections use HTTPS/TLS',
      threshold: '100%',
      measurement: 'Encrypted connections / Total connections'
    },
    validationMethod: 'Connection security validation',
    status: 'pending'
  },
  {
    id: 'sec_003',
    category: 'security',
    priority: 'high',
    title: 'Input Validation',
    description: 'All user inputs must be properly validated and sanitized',
    criteria: {
      requirement: 'Comprehensive input validation implemented',
      threshold: '100%',
      measurement: 'Validated input types / Total input types'
    },
    validationMethod: 'Input validation testing',
    status: 'pending'
  },
  {
    id: 'sec_004',
    category: 'security',
    priority: 'high',
    title: 'API Key Security',
    description: 'API keys must be properly secured and not exposed',
    criteria: {
      requirement: 'No API keys in client-side code or logs',
      threshold: '0 exposures',
      measurement: 'API key exposure scan results'
    },
    validationMethod: 'Security scan and configuration review',
    status: 'pending'
  },

  // Operational Criteria
  {
    id: 'ops_001',
    category: 'operational',
    priority: 'high',
    title: 'Monitoring and Alerting',
    description: 'Comprehensive monitoring and alerting must be in place',
    criteria: {
      requirement: 'All critical metrics monitored with alerts',
      threshold: '100%',
      measurement: 'Monitored metrics / Critical metrics'
    },
    validationMethod: 'Monitoring capability validation',
    status: 'pending'
  },
  {
    id: 'ops_002',
    category: 'operational',
    priority: 'medium',
    title: 'Logging and Observability',
    description: 'Proper logging and observability features must be implemented',
    criteria: {
      requirement: 'Structured logging with appropriate levels',
      threshold: 'All components',
      measurement: 'Components with proper logging / Total components'
    },
    validationMethod: 'Logging capability assessment',
    status: 'pending'
  },
  {
    id: 'ops_003',
    category: 'operational',
    priority: 'medium',
    title: 'Scalability Readiness',
    description: 'System must be ready for horizontal and vertical scaling',
    criteria: {
      requirement: 'System handles 50+ concurrent users',
      threshold: '50 users',
      measurement: 'Maximum concurrent users with acceptable performance'
    },
    validationMethod: 'Load testing and scalability assessment',
    status: 'pending'
  },
  {
    id: 'ops_004',
    category: 'operational',
    priority: 'high',
    title: 'Backup and Recovery',
    description: 'Backup and disaster recovery procedures must be in place',
    criteria: {
      requirement: 'Automated backups with tested recovery',
      threshold: '100%',
      measurement: 'Backup coverage and recovery test success'
    },
    validationMethod: 'Backup and recovery validation',
    status: 'pending'
  },
  {
    id: 'ops_005',
    category: 'operational',
    priority: 'medium',
    title: 'Documentation Completeness',
    description: 'Complete operational documentation must be available',
    criteria: {
      requirement: 'All operational procedures documented',
      threshold: '100%',
      measurement: 'Documented procedures / Required procedures'
    },
    validationMethod: 'Documentation review and validation',
    status: 'pending'
  },
  {
    id: 'ops_006',
    category: 'operational',
    priority: 'medium',
    title: 'Environment Configuration',
    description: 'Production environment must be properly configured',
    criteria: {
      requirement: 'All required environment variables configured',
      threshold: '100%',
      measurement: 'Configured variables / Required variables'
    },
    validationMethod: 'Environment configuration validation',
    status: 'pending'
  }
];

/**
 * Production Readiness Scoring Weights
 */
export const SCORING_WEIGHTS = {
  categories: {
    performance: 0.30,
    reliability: 0.30,
    security: 0.25,
    operational: 0.15
  },
  priorities: {
    critical: 1.0,
    high: 0.8,
    medium: 0.6,
    low: 0.4
  }
};

/**
 * Production Readiness Thresholds
 */
export const READINESS_THRESHOLDS = {
  production_ready: 0.90,      // 90% overall score
  needs_improvement: 0.75,     // 75% overall score
  not_ready: 0.75,            // Below 75% overall score
  critical_pass_rate: 0.90    // 90% of critical checks must pass
};

/**
 * Deployment Approval Criteria
 */
export const DEPLOYMENT_CRITERIA = {
  minimum_overall_score: 0.85,
  minimum_critical_pass_rate: 0.90,
  maximum_critical_failures: 2,
  required_categories: {
    performance: 0.80,
    reliability: 0.85,
    security: 0.95,
    operational: 0.75
  }
};

/**
 * Get checklist items by category
 */
export function getChecklistByCategory(category: string): ChecklistItem[] {
  return PRODUCTION_READINESS_CHECKLIST.filter(item => item.category === category);
}

/**
 * Get checklist items by priority
 */
export function getChecklistByPriority(priority: string): ChecklistItem[] {
  return PRODUCTION_READINESS_CHECKLIST.filter(item => item.priority === priority);
}

/**
 * Get critical checklist items
 */
export function getCriticalChecklist(): ChecklistItem[] {
  return getChecklistByPriority('critical');
}

/**
 * Calculate category score
 */
export function calculateCategoryScore(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  
  const totalWeight = items.reduce((sum, item) => sum + SCORING_WEIGHTS.priorities[item.priority], 0);
  const passedWeight = items
    .filter(item => item.status === 'passed')
    .reduce((sum, item) => sum + SCORING_WEIGHTS.priorities[item.priority], 0);
  
  return totalWeight > 0 ? passedWeight / totalWeight : 0;
}

/**
 * Calculate overall readiness score
 */
export function calculateOverallScore(): number {
  const categoryScores = {
    performance: calculateCategoryScore(getChecklistByCategory('performance')),
    reliability: calculateCategoryScore(getChecklistByCategory('reliability')),
    security: calculateCategoryScore(getChecklistByCategory('security')),
    operational: calculateCategoryScore(getChecklistByCategory('operational'))
  };

  return (
    categoryScores.performance * SCORING_WEIGHTS.categories.performance +
    categoryScores.reliability * SCORING_WEIGHTS.categories.reliability +
    categoryScores.security * SCORING_WEIGHTS.categories.security +
    categoryScores.operational * SCORING_WEIGHTS.categories.operational
  );
}

/**
 * Determine readiness level
 */
export function determineReadinessLevel(overallScore: number): string {
  if (overallScore >= READINESS_THRESHOLDS.production_ready) {
    return 'production_ready';
  } else if (overallScore >= READINESS_THRESHOLDS.needs_improvement) {
    return 'needs_improvement';
  } else {
    return 'not_ready';
  }
}

/**
 * Check deployment approval
 */
export function checkDeploymentApproval(): {
  approved: boolean;
  reasons: string[];
  conditions: string[];
} {
  const overallScore = calculateOverallScore();
  const criticalItems = getCriticalChecklist();
  const passedCritical = criticalItems.filter(item => item.status === 'passed').length;
  const criticalPassRate = criticalItems.length > 0 ? passedCritical / criticalItems.length : 1;
  const criticalFailures = criticalItems.filter(item => item.status === 'failed').length;

  const reasons: string[] = [];
  const conditions: string[] = [];
  let approved = true;

  // Check overall score
  if (overallScore < DEPLOYMENT_CRITERIA.minimum_overall_score) {
    approved = false;
    reasons.push(`Overall score ${(overallScore * 100).toFixed(1)}% below minimum ${(DEPLOYMENT_CRITERIA.minimum_overall_score * 100)}%`);
    conditions.push('Improve overall readiness score');
  }

  // Check critical pass rate
  if (criticalPassRate < DEPLOYMENT_CRITERIA.minimum_critical_pass_rate) {
    approved = false;
    reasons.push(`Critical pass rate ${(criticalPassRate * 100).toFixed(1)}% below minimum ${(DEPLOYMENT_CRITERIA.minimum_critical_pass_rate * 100)}%`);
    conditions.push('Pass all critical checks');
  }

  // Check critical failures
  if (criticalFailures > DEPLOYMENT_CRITERIA.maximum_critical_failures) {
    approved = false;
    reasons.push(`${criticalFailures} critical failures exceed maximum ${DEPLOYMENT_CRITERIA.maximum_critical_failures}`);
    conditions.push('Resolve critical failures');
  }

  // Check category requirements
  const categoryScores = {
    performance: calculateCategoryScore(getChecklistByCategory('performance')),
    reliability: calculateCategoryScore(getChecklistByCategory('reliability')),
    security: calculateCategoryScore(getChecklistByCategory('security')),
    operational: calculateCategoryScore(getChecklistByCategory('operational'))
  };

  for (const [category, requiredScore] of Object.entries(DEPLOYMENT_CRITERIA.required_categories)) {
    const actualScore = categoryScores[category as keyof typeof categoryScores];
    if (actualScore < requiredScore) {
      approved = false;
      reasons.push(`${category} score ${(actualScore * 100).toFixed(1)}% below required ${(requiredScore * 100)}%`);
      conditions.push(`Improve ${category} criteria`);
    }
  }

  return { approved, reasons, conditions };
}
