/**
 * Search Ranking Analytics Hook
 * Provides analytics and optimization for search result ranking
 */

import { useState, useEffect, useCallback } from 'react';
import { UnifiedSearchResult, UnifiedSearchParams } from '@/types/unified-search';
import { advancedSearchRanking } from '@/lib/advancedSearchRanking';
import type { RankingContext, RankingScore } from '@/lib/advancedSearchRanking';

interface RankingAnalytics {
  totalSearches: number;
  averageResultCount: number;
  topPerformingSources: Array<{
    source: string;
    averageScore: number;
    searchCount: number;
  }>;
  rankingDistribution: {
    highQuality: number;    // Score > 0.8
    mediumQuality: number;  // Score 0.5-0.8
    lowQuality: number;     // Score < 0.5
  };
  boostEffectiveness: Record<string, {
    timesApplied: number;
    averageImprovement: number;
  }>;
  searchPatterns: {
    exactMatches: number;
    semanticMatches: number;
    crossLanguageMatches: number;
    businessMatches: number;
  };
}

interface RankingOptimization {
  suggestions: Array<{
    type: 'source_weight' | 'content_type' | 'boost_factor' | 'threshold';
    description: string;
    currentValue: number;
    suggestedValue: number;
    expectedImprovement: string;
    confidence: number;
  }>;
  performanceImpact: {
    averageScoreImprovement: number;
    topResultAccuracy: number;
    userSatisfactionEstimate: number;
  };
}

interface SearchRankingSession {
  query: string;
  params: UnifiedSearchParams;
  results: Array<{
    result: UnifiedSearchResult;
    rankingScore: RankingScore;
    originalPosition: number;
    newPosition: number;
  }>;
  context: RankingContext;
  timestamp: string;
}

interface UseSearchRankingAnalyticsReturn {
  // Analytics data
  analytics: RankingAnalytics | null;
  optimization: RankingOptimization | null;
  recentSessions: SearchRankingSession[];
  
  // State
  loading: boolean;
  error: string | null;
  
  // Actions
  recordSearchSession: (
    query: string,
    params: UnifiedSearchParams,
    originalResults: UnifiedSearchResult[],
    rankedResults: UnifiedSearchResult[]
  ) => void;
  analyzeRankingPerformance: () => Promise<void>;
  generateOptimizationSuggestions: () => Promise<void>;
  exportAnalytics: () => string;
  clearAnalytics: () => void;
  
  // Real-time analysis
  analyzeSearchResults: (
    results: UnifiedSearchResult[],
    query: string,
    params: UnifiedSearchParams
  ) => {
    rankingScores: RankingScore[];
    qualityMetrics: {
      averageScore: number;
      scoreDistribution: number[];
      topResultQuality: number;
    };
    recommendations: string[];
  };
}

export function useSearchRankingAnalytics(): UseSearchRankingAnalyticsReturn {
  const [analytics, setAnalytics] = useState<RankingAnalytics | null>(null);
  const [optimization, setOptimization] = useState<RankingOptimization | null>(null);
  const [recentSessions, setRecentSessions] = useState<SearchRankingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Record a search session for analytics
   */
  const recordSearchSession = useCallback((
    query: string,
    params: UnifiedSearchParams,
    originalResults: UnifiedSearchResult[],
    rankedResults: UnifiedSearchResult[]
  ) => {
    try {
      const context = advancedSearchRanking.analyzeSearchContext(query, params);
      
      const sessionResults = rankedResults.map((result, newPosition) => {
        const originalPosition = originalResults.findIndex(r => r.id === result.id);
        const rankingScore = advancedSearchRanking.calculateRankingScore(result, context, params);
        
        return {
          result,
          rankingScore,
          originalPosition,
          newPosition
        };
      });

      const session: SearchRankingSession = {
        query,
        params,
        results: sessionResults,
        context,
        timestamp: new Date().toISOString()
      };

      setRecentSessions(prev => {
        const updated = [session, ...prev];
        return updated.slice(0, 100); // Keep last 100 sessions
      });

      console.log(`📊 Recorded search ranking session: "${query}" (${sessionResults.length} results)`);
    } catch (err) {
      console.error('Failed to record search session:', err);
    }
  }, []);

  /**
   * Analyze ranking performance from recorded sessions
   */
  const analyzeRankingPerformance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (recentSessions.length === 0) {
        setAnalytics({
          totalSearches: 0,
          averageResultCount: 0,
          topPerformingSources: [],
          rankingDistribution: { highQuality: 0, mediumQuality: 0, lowQuality: 0 },
          boostEffectiveness: {},
          searchPatterns: { exactMatches: 0, semanticMatches: 0, crossLanguageMatches: 0, businessMatches: 0 }
        });
        return;
      }

      // Analyze source performance
      const sourceStats = new Map<string, { scores: number[]; count: number }>();
      const boostStats = new Map<string, { applications: number; improvements: number[] }>();
      const searchPatterns = { exactMatches: 0, semanticMatches: 0, crossLanguageMatches: 0, businessMatches: 0 };
      let totalResults = 0;
      let qualityDistribution = { highQuality: 0, mediumQuality: 0, lowQuality: 0 };

      recentSessions.forEach(session => {
        // Count search patterns
        switch (session.context.searchType) {
          case 'exact': searchPatterns.exactMatches++; break;
          case 'semantic': searchPatterns.semanticMatches++; break;
          case 'cross_language': searchPatterns.crossLanguageMatches++; break;
          case 'business': searchPatterns.businessMatches++; break;
        }

        session.results.forEach(({ result, rankingScore }) => {
          totalResults++;

          // Source performance
          const sourceKey = result.sourceType;
          if (!sourceStats.has(sourceKey)) {
            sourceStats.set(sourceKey, { scores: [], count: 0 });
          }
          const sourceData = sourceStats.get(sourceKey)!;
          sourceData.scores.push(rankingScore.finalScore);
          sourceData.count++;

          // Quality distribution
          if (rankingScore.finalScore > 0.8) {
            qualityDistribution.highQuality++;
          } else if (rankingScore.finalScore > 0.5) {
            qualityDistribution.mediumQuality++;
          } else {
            qualityDistribution.lowQuality++;
          }

          // Boost effectiveness (simplified analysis)
          const boostImprovement = rankingScore.boostScore - rankingScore.contentTypeScore;
          if (boostImprovement > 0) {
            rankingScore.explanation.forEach(explanation => {
              if (explanation.includes('Boosts applied:')) {
                const boosts = explanation.split('Boosts applied: ')[1]?.split(' →')[0]?.split(', ') || [];
                boosts.forEach(boost => {
                  const [boostType] = boost.split(': ');
                  if (!boostStats.has(boostType)) {
                    boostStats.set(boostType, { applications: 0, improvements: [] });
                  }
                  const boostData = boostStats.get(boostType)!;
                  boostData.applications++;
                  boostData.improvements.push(boostImprovement);
                });
              }
            });
          }
        });
      });

      // Calculate analytics
      const topPerformingSources = Array.from(sourceStats.entries())
        .map(([source, data]) => ({
          source,
          averageScore: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
          searchCount: data.count
        }))
        .sort((a, b) => b.averageScore - a.averageScore);

      const boostEffectiveness = Object.fromEntries(
        Array.from(boostStats.entries()).map(([boost, data]) => [
          boost,
          {
            timesApplied: data.applications,
            averageImprovement: data.improvements.reduce((sum, imp) => sum + imp, 0) / data.improvements.length
          }
        ])
      );

      const analyticsData: RankingAnalytics = {
        totalSearches: recentSessions.length,
        averageResultCount: totalResults / recentSessions.length,
        topPerformingSources,
        rankingDistribution: {
          highQuality: Math.round((qualityDistribution.highQuality / totalResults) * 100),
          mediumQuality: Math.round((qualityDistribution.mediumQuality / totalResults) * 100),
          lowQuality: Math.round((qualityDistribution.lowQuality / totalResults) * 100)
        },
        boostEffectiveness,
        searchPatterns
      };

      setAnalytics(analyticsData);
      console.log('📈 Ranking performance analysis complete:', analyticsData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze ranking performance';
      setError(errorMessage);
      console.error('Ranking analysis error:', err);
    } finally {
      setLoading(false);
    }
  }, [recentSessions]);

  /**
   * Generate optimization suggestions
   */
  const generateOptimizationSuggestions = useCallback(async () => {
    try {
      if (!analytics) {
        await analyzeRankingPerformance();
        return;
      }

      const suggestions: RankingOptimization['suggestions'] = [];

      // Source weight optimization
      const lowPerformingSources = analytics.topPerformingSources.filter(s => s.averageScore < 0.6);
      lowPerformingSources.forEach(source => {
        suggestions.push({
          type: 'source_weight',
          description: `Reduce weight for ${source.source} due to low average score`,
          currentValue: 1.0,
          suggestedValue: 0.8,
          expectedImprovement: '5-10% better ranking accuracy',
          confidence: 0.7
        });
      });

      // Quality distribution optimization
      if (analytics.rankingDistribution.lowQuality > 30) {
        suggestions.push({
          type: 'threshold',
          description: 'Increase similarity threshold to reduce low-quality results',
          currentValue: 0.2,
          suggestedValue: 0.3,
          expectedImprovement: '15-20% reduction in low-quality results',
          confidence: 0.8
        });
      }

      // Boost factor optimization
      Object.entries(analytics.boostEffectiveness).forEach(([boost, data]) => {
        if (data.averageImprovement < 0.1 && data.timesApplied > 10) {
          suggestions.push({
            type: 'boost_factor',
            description: `Reduce ${boost} boost factor due to low effectiveness`,
            currentValue: 1.5,
            suggestedValue: 1.2,
            expectedImprovement: 'Better ranking balance',
            confidence: 0.6
          });
        }
      });

      const performanceImpact = {
        averageScoreImprovement: suggestions.length * 0.05, // Estimated 5% per suggestion
        topResultAccuracy: Math.min(95, 85 + suggestions.length * 2), // Estimated improvement
        userSatisfactionEstimate: Math.min(90, 75 + suggestions.length * 3) // Estimated satisfaction
      };

      setOptimization({
        suggestions,
        performanceImpact
      });

      console.log(`💡 Generated ${suggestions.length} optimization suggestions`);
    } catch (err) {
      console.error('Failed to generate optimization suggestions:', err);
    }
  }, [analytics, analyzeRankingPerformance]);

  /**
   * Analyze search results in real-time
   */
  const analyzeSearchResults = useCallback((
    results: UnifiedSearchResult[],
    query: string,
    params: UnifiedSearchParams
  ) => {
    try {
      const context = advancedSearchRanking.analyzeSearchContext(query, params);
      const rankingScores = results.map(result => 
        advancedSearchRanking.calculateRankingScore(result, context, params)
      );

      const scores = rankingScores.map(rs => rs.finalScore);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const topResultQuality = scores[0] || 0;

      const qualityMetrics = {
        averageScore,
        scoreDistribution: [
          scores.filter(s => s > 0.8).length,
          scores.filter(s => s > 0.5 && s <= 0.8).length,
          scores.filter(s => s <= 0.5).length
        ],
        topResultQuality
      };

      const recommendations: string[] = [];
      if (averageScore < 0.6) {
        recommendations.push('Consider refining search query or adjusting similarity threshold');
      }
      if (topResultQuality < 0.7) {
        recommendations.push('Top result quality is low - review ranking algorithm parameters');
      }
      if (results.length < 3) {
        recommendations.push('Low result count - consider lowering similarity threshold');
      }

      return {
        rankingScores,
        qualityMetrics,
        recommendations
      };
    } catch (err) {
      console.error('Failed to analyze search results:', err);
      return {
        rankingScores: [],
        qualityMetrics: { averageScore: 0, scoreDistribution: [0, 0, 0], topResultQuality: 0 },
        recommendations: ['Analysis failed - check search parameters']
      };
    }
  }, []);

  /**
   * Export analytics data
   */
  const exportAnalytics = useCallback(() => {
    const exportData = {
      analytics,
      optimization,
      recentSessions: recentSessions.slice(0, 50), // Export last 50 sessions
      exportTimestamp: new Date().toISOString()
    };
    return JSON.stringify(exportData, null, 2);
  }, [analytics, optimization, recentSessions]);

  /**
   * Clear analytics data
   */
  const clearAnalytics = useCallback(() => {
    setAnalytics(null);
    setOptimization(null);
    setRecentSessions([]);
    console.log('🗑️ Cleared search ranking analytics');
  }, []);

  // Auto-analyze when sessions change
  useEffect(() => {
    if (recentSessions.length > 0 && recentSessions.length % 10 === 0) {
      analyzeRankingPerformance();
    }
  }, [recentSessions, analyzeRankingPerformance]);

  return {
    // Analytics data
    analytics,
    optimization,
    recentSessions,
    
    // State
    loading,
    error,
    
    // Actions
    recordSearchSession,
    analyzeRankingPerformance,
    generateOptimizationSuggestions,
    exportAnalytics,
    clearAnalytics,
    
    // Real-time analysis
    analyzeSearchResults
  };
}

export default useSearchRankingAnalytics;
