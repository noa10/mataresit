/**
 * Intelligent Search Prioritization System
 * Advanced prioritization based on user behavior, query characteristics, and system load
 */

import { UnifiedSearchParams } from '@/types/unified-search';
import { SearchPriority } from '@/services/optimized-background-search-service';

// User behavior patterns
interface UserBehaviorPattern {
  userId: string;
  searchFrequency: number; // searches per hour
  averageQueryComplexity: number;
  preferredSearchTypes: string[];
  timeOfDayPatterns: number[]; // 24-hour activity pattern
  responseTimeExpectation: number; // ms
  lastActiveTime: number;
  sessionDuration: number;
}

// Query characteristics
interface QueryCharacteristics {
  complexity: number; // 1-10 scale
  specificity: number; // 1-10 scale
  temporality: 'immediate' | 'recent' | 'historical' | 'none';
  scope: 'narrow' | 'medium' | 'broad';
  intent: 'search' | 'analysis' | 'comparison' | 'summary';
  estimatedProcessingTime: number; // ms
}

// System load metrics
interface SystemLoadMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeSearches: number;
  queueLength: number;
  averageResponseTime: number;
  errorRate: number;
}

// Prioritization factors
interface PrioritizationFactors {
  userPriority: number; // 0-1 scale
  queryUrgency: number; // 0-1 scale
  systemCapacity: number; // 0-1 scale
  businessValue: number; // 0-1 scale
  resourceCost: number; // 0-1 scale (inverted)
}

class IntelligentSearchPrioritizer {
  private userBehaviorCache = new Map<string, UserBehaviorPattern>();
  private queryHistory: Array<{
    query: string;
    characteristics: QueryCharacteristics;
    priority: SearchPriority;
    timestamp: number;
    userId: string;
  }> = [];

  private prioritizationWeights = {
    userPriority: 0.25,
    queryUrgency: 0.30,
    systemCapacity: 0.20,
    businessValue: 0.15,
    resourceCost: 0.10
  };

  /**
   * Determine optimal priority for a search request
   */
  determinePriority(
    query: string,
    searchParams: UnifiedSearchParams,
    userId: string,
    systemLoad: SystemLoadMetrics
  ): {
    priority: SearchPriority;
    confidence: number;
    reasoning: string[];
    estimatedWaitTime: number;
  } {
    
    // Analyze query characteristics
    const queryCharacteristics = this.analyzeQueryCharacteristics(query, searchParams);
    
    // Get user behavior pattern
    const userPattern = this.getUserBehaviorPattern(userId);
    
    // Calculate prioritization factors
    const factors = this.calculatePrioritizationFactors(
      queryCharacteristics,
      userPattern,
      systemLoad
    );

    // Calculate weighted priority score
    const priorityScore = this.calculatePriorityScore(factors);
    
    // Convert to priority enum
    const priority = this.scoreToPriority(priorityScore);
    
    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(userPattern, queryCharacteristics, systemLoad);
    
    // Generate reasoning
    const reasoning = this.generateReasoning(factors, queryCharacteristics, userPattern);
    
    // Estimate wait time
    const estimatedWaitTime = this.estimateWaitTime(priority, systemLoad, queryCharacteristics);

    // Update learning data
    this.updateLearningData(query, queryCharacteristics, priority, userId);

    return {
      priority,
      confidence,
      reasoning,
      estimatedWaitTime
    };
  }

  /**
   * Analyze query characteristics
   */
  private analyzeQueryCharacteristics(query: string, searchParams: UnifiedSearchParams): QueryCharacteristics {
    const queryLower = query.toLowerCase();
    const words = query.split(/\s+/);

    // Calculate complexity
    let complexity = Math.min(10, Math.max(1, words.length / 2));
    
    // Adjust for filters
    if (searchParams.filters) {
      const filterCount = Object.values(searchParams.filters).filter(v => v !== undefined && v !== null).length;
      complexity += filterCount * 0.5;
    }

    // Calculate specificity
    const specificTerms = ['specific', 'exact', 'particular', 'precise', 'detailed'];
    const generalTerms = ['all', 'any', 'everything', 'general', 'overall'];
    
    let specificity = 5; // baseline
    if (specificTerms.some(term => queryLower.includes(term))) specificity += 2;
    if (generalTerms.some(term => queryLower.includes(term))) specificity -= 2;
    if (searchParams.filters?.dateRange) specificity += 1;
    if (searchParams.filters?.amountRange) specificity += 1;

    // Determine temporality
    const immediateTerms = ['now', 'today', 'current', 'latest', 'recent'];
    const historicalTerms = ['last year', 'old', 'previous', 'past', 'history'];
    
    let temporality: QueryCharacteristics['temporality'] = 'none';
    if (immediateTerms.some(term => queryLower.includes(term))) {
      temporality = 'immediate';
    } else if (queryLower.includes('this week') || queryLower.includes('this month')) {
      temporality = 'recent';
    } else if (historicalTerms.some(term => queryLower.includes(term))) {
      temporality = 'historical';
    }

    // Determine scope
    let scope: QueryCharacteristics['scope'] = 'medium';
    if (words.length <= 3 && !searchParams.filters) scope = 'narrow';
    if (words.length > 10 || (searchParams.filters && Object.keys(searchParams.filters).length > 3)) scope = 'broad';

    // Determine intent
    const searchTerms = ['find', 'search', 'look', 'show'];
    const analysisTerms = ['analyze', 'breakdown', 'pattern', 'trend'];
    const comparisonTerms = ['compare', 'versus', 'difference', 'better'];
    const summaryTerms = ['summary', 'total', 'overview', 'report'];

    let intent: QueryCharacteristics['intent'] = 'search';
    if (analysisTerms.some(term => queryLower.includes(term))) intent = 'analysis';
    else if (comparisonTerms.some(term => queryLower.includes(term))) intent = 'comparison';
    else if (summaryTerms.some(term => queryLower.includes(term))) intent = 'summary';

    // Estimate processing time
    let estimatedProcessingTime = 1000; // baseline 1 second
    estimatedProcessingTime += complexity * 200;
    estimatedProcessingTime += (searchParams.limit || 20) * 10;
    if (intent === 'analysis') estimatedProcessingTime *= 1.5;
    if (scope === 'broad') estimatedProcessingTime *= 1.3;

    return {
      complexity: Math.min(10, Math.max(1, complexity)),
      specificity: Math.min(10, Math.max(1, specificity)),
      temporality,
      scope,
      intent,
      estimatedProcessingTime
    };
  }

  /**
   * Get or create user behavior pattern
   */
  private getUserBehaviorPattern(userId: string): UserBehaviorPattern {
    let pattern = this.userBehaviorCache.get(userId);
    
    if (!pattern) {
      // Create default pattern for new user
      pattern = {
        userId,
        searchFrequency: 5, // default 5 searches per hour
        averageQueryComplexity: 5,
        preferredSearchTypes: ['search'],
        timeOfDayPatterns: new Array(24).fill(1), // uniform activity
        responseTimeExpectation: 3000, // 3 seconds
        lastActiveTime: Date.now(),
        sessionDuration: 0
      };
      
      this.userBehaviorCache.set(userId, pattern);
    }

    return pattern;
  }

  /**
   * Calculate prioritization factors
   */
  private calculatePrioritizationFactors(
    queryCharacteristics: QueryCharacteristics,
    userPattern: UserBehaviorPattern,
    systemLoad: SystemLoadMetrics
  ): PrioritizationFactors {
    
    // User priority based on behavior
    let userPriority = 0.5; // baseline
    
    // High-frequency users get higher priority
    if (userPattern.searchFrequency > 10) userPriority += 0.2;
    
    // Recent activity boosts priority
    const timeSinceLastActive = Date.now() - userPattern.lastActiveTime;
    if (timeSinceLastActive < 60000) userPriority += 0.2; // active in last minute
    
    // Session duration affects priority
    if (userPattern.sessionDuration > 300000) userPriority += 0.1; // long session

    // Query urgency based on characteristics
    let queryUrgency = 0.5; // baseline
    
    if (queryCharacteristics.temporality === 'immediate') queryUrgency += 0.3;
    if (queryCharacteristics.temporality === 'recent') queryUrgency += 0.1;
    if (queryCharacteristics.specificity > 7) queryUrgency += 0.2;
    if (queryCharacteristics.intent === 'analysis') queryUrgency += 0.1;

    // System capacity (inverted load)
    const systemCapacity = Math.max(0, 1 - (
      (systemLoad.cpuUsage / 100) * 0.4 +
      (systemLoad.memoryUsage / 100) * 0.3 +
      (systemLoad.activeSearches / 10) * 0.2 +
      (systemLoad.queueLength / 20) * 0.1
    ));

    // Business value based on query type and user
    let businessValue = 0.5; // baseline
    if (queryCharacteristics.intent === 'analysis') businessValue += 0.2;
    if (queryCharacteristics.scope === 'broad') businessValue += 0.1;
    if (userPattern.searchFrequency > 15) businessValue += 0.2; // power user

    // Resource cost (inverted)
    const resourceCost = 1 - Math.min(1, (
      (queryCharacteristics.complexity / 10) * 0.4 +
      (queryCharacteristics.estimatedProcessingTime / 10000) * 0.3 +
      (queryCharacteristics.scope === 'broad' ? 0.2 : 0) +
      (queryCharacteristics.intent === 'analysis' ? 0.1 : 0)
    ));

    return {
      userPriority: Math.min(1, Math.max(0, userPriority)),
      queryUrgency: Math.min(1, Math.max(0, queryUrgency)),
      systemCapacity: Math.min(1, Math.max(0, systemCapacity)),
      businessValue: Math.min(1, Math.max(0, businessValue)),
      resourceCost: Math.min(1, Math.max(0, resourceCost))
    };
  }

  /**
   * Calculate weighted priority score
   */
  private calculatePriorityScore(factors: PrioritizationFactors): number {
    return (
      factors.userPriority * this.prioritizationWeights.userPriority +
      factors.queryUrgency * this.prioritizationWeights.queryUrgency +
      factors.systemCapacity * this.prioritizationWeights.systemCapacity +
      factors.businessValue * this.prioritizationWeights.businessValue +
      factors.resourceCost * this.prioritizationWeights.resourceCost
    );
  }

  /**
   * Convert priority score to enum
   */
  private scoreToPriority(score: number): SearchPriority {
    if (score >= 0.8) return SearchPriority.URGENT;
    if (score >= 0.6) return SearchPriority.HIGH;
    if (score >= 0.4) return SearchPriority.NORMAL;
    return SearchPriority.LOW;
  }

  /**
   * Calculate confidence in prioritization decision
   */
  private calculateConfidence(
    userPattern: UserBehaviorPattern,
    queryCharacteristics: QueryCharacteristics,
    systemLoad: SystemLoadMetrics
  ): number {
    let confidence = 0.5; // baseline

    // More data about user increases confidence
    const userDataAge = Date.now() - userPattern.lastActiveTime;
    if (userDataAge < 3600000) confidence += 0.2; // recent data
    if (userPattern.searchFrequency > 5) confidence += 0.1; // sufficient history

    // Clear query characteristics increase confidence
    if (queryCharacteristics.specificity > 6) confidence += 0.1;
    if (queryCharacteristics.temporality !== 'none') confidence += 0.1;

    // Stable system load increases confidence
    if (systemLoad.errorRate < 0.05) confidence += 0.1;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    factors: PrioritizationFactors,
    queryCharacteristics: QueryCharacteristics,
    userPattern: UserBehaviorPattern
  ): string[] {
    const reasoning: string[] = [];

    if (factors.queryUrgency > 0.7) {
      reasoning.push(`High urgency query (${queryCharacteristics.temporality} request)`);
    }

    if (factors.userPriority > 0.7) {
      reasoning.push(`Active user with high search frequency (${userPattern.searchFrequency}/hour)`);
    }

    if (factors.systemCapacity < 0.3) {
      reasoning.push('System under high load, priority adjusted');
    }

    if (queryCharacteristics.complexity > 7) {
      reasoning.push('Complex query requiring additional processing time');
    }

    if (queryCharacteristics.intent === 'analysis') {
      reasoning.push('Analysis request with higher business value');
    }

    if (reasoning.length === 0) {
      reasoning.push('Standard priority based on balanced factors');
    }

    return reasoning;
  }

  /**
   * Estimate wait time based on priority and system load
   */
  private estimateWaitTime(
    priority: SearchPriority,
    systemLoad: SystemLoadMetrics,
    queryCharacteristics: QueryCharacteristics
  ): number {
    let baseWaitTime = systemLoad.averageResponseTime || 2000;

    // Adjust for priority
    const priorityMultiplier = {
      [SearchPriority.URGENT]: 0.1,
      [SearchPriority.HIGH]: 0.3,
      [SearchPriority.NORMAL]: 1.0,
      [SearchPriority.LOW]: 2.0
    };

    baseWaitTime *= priorityMultiplier[priority];

    // Adjust for queue length
    const queueDelay = systemLoad.queueLength * 500; // 500ms per queued item

    // Adjust for query complexity
    const complexityDelay = queryCharacteristics.estimatedProcessingTime * 0.1;

    return Math.max(100, baseWaitTime + queueDelay + complexityDelay);
  }

  /**
   * Update learning data for future prioritization
   */
  private updateLearningData(
    query: string,
    characteristics: QueryCharacteristics,
    priority: SearchPriority,
    userId: string
  ): void {
    // Add to query history
    this.queryHistory.push({
      query,
      characteristics,
      priority,
      timestamp: Date.now(),
      userId
    });

    // Keep history limited
    if (this.queryHistory.length > 10000) {
      this.queryHistory = this.queryHistory.slice(-5000);
    }

    // Update user pattern
    const userPattern = this.getUserBehaviorPattern(userId);
    userPattern.lastActiveTime = Date.now();
    
    // Update average complexity
    userPattern.averageQueryComplexity = 
      (userPattern.averageQueryComplexity * 0.9) + (characteristics.complexity * 0.1);

    // Update preferred search types
    if (!userPattern.preferredSearchTypes.includes(characteristics.intent)) {
      userPattern.preferredSearchTypes.push(characteristics.intent);
    }
  }

  /**
   * Get prioritization analytics
   */
  getAnalytics(): {
    totalQueries: number;
    priorityDistribution: Record<SearchPriority, number>;
    averageConfidence: number;
    topQueryTypes: string[];
    userPatterns: number;
  } {
    const priorityDistribution = {
      [SearchPriority.LOW]: 0,
      [SearchPriority.NORMAL]: 0,
      [SearchPriority.HIGH]: 0,
      [SearchPriority.URGENT]: 0
    };

    this.queryHistory.forEach(entry => {
      priorityDistribution[entry.priority]++;
    });

    const intentCounts = this.queryHistory.reduce((acc, entry) => {
      acc[entry.characteristics.intent] = (acc[entry.characteristics.intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topQueryTypes = Object.entries(intentCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([intent]) => intent);

    return {
      totalQueries: this.queryHistory.length,
      priorityDistribution,
      averageConfidence: 0.75, // Would calculate from actual confidence scores
      topQueryTypes,
      userPatterns: this.userBehaviorCache.size
    };
  }

  /**
   * Update prioritization weights based on performance
   */
  updateWeights(newWeights: Partial<typeof this.prioritizationWeights>): void {
    this.prioritizationWeights = { ...this.prioritizationWeights, ...newWeights };
    console.log('🎯 Updated prioritization weights:', newWeights);
  }

  /**
   * Clear learning data
   */
  clearLearningData(): void {
    this.queryHistory = [];
    this.userBehaviorCache.clear();
    console.log('🧹 Cleared prioritization learning data');
  }
}

// Export singleton instance
export const intelligentSearchPrioritizer = new IntelligentSearchPrioritizer();
export type { QueryCharacteristics, UserBehaviorPattern, PrioritizationFactors };
