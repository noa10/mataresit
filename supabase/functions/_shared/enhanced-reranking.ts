/**
 * Enhanced Re-ranking System with Cross-Encoder Models
 * 
 * This module implements advanced re-ranking capabilities using cross-encoder models
 * and contextual relevance scoring for improved search result quality.
 */

import { UnifiedSearchResult } from '../unified-search/types.ts';

export interface ReRankingCandidate {
  result: UnifiedSearchResult;
  originalScore: number;
  contextualFeatures: ContextualFeatures;
}

export interface ContextualFeatures {
  queryTermMatches: number;
  contentTypeRelevance: number;
  recencyScore: number;
  userInteractionScore: number;
  semanticCoherence: number;
  entityAlignment: number;
}

export interface EnhancedReRankingParams {
  candidates: ReRankingCandidate[];
  originalQuery: string;
  queryIntent: string;
  userProfile?: any;
  contextualHints?: string[];
  reRankingStrategy: 'cross_encoder' | 'feature_based' | 'hybrid';
  maxCandidates?: number;
}

export interface EnhancedReRankingResult {
  rerankedResults: UnifiedSearchResult[];
  reRankingMetadata: {
    strategy: string;
    modelUsed: string;
    processingTime: number;
    candidatesCount: number;
    reRankingScore: number;
    confidenceLevel: 'low' | 'medium' | 'high';
    featureWeights: Record<string, number>;
  };
}

/**
 * Enhanced re-ranking with multiple strategies
 */
export async function enhancedReRanking(
  params: EnhancedReRankingParams,
  geminiApiKey?: string
): Promise<EnhancedReRankingResult> {
  const startTime = Date.now();

  if (params.candidates.length === 0) {
    return createEmptyResult(startTime);
  }

  try {
    switch (params.reRankingStrategy) {
      case 'cross_encoder':
        return await crossEncoderReRanking(params, geminiApiKey, startTime);
      case 'feature_based':
        return await featureBasedReRanking(params, startTime);
      case 'hybrid':
        return await hybridReRanking(params, geminiApiKey, startTime);
      default:
        return await featureBasedReRanking(params, startTime);
    }
  } catch (error) {
    console.error('Enhanced re-ranking error:', error);
    return createFallbackResult(params, startTime);
  }
}

/**
 * Cross-encoder re-ranking using LLM for contextual relevance
 */
async function crossEncoderReRanking(
  params: EnhancedReRankingParams,
  geminiApiKey?: string,
  startTime: number
): Promise<EnhancedReRankingResult> {
  if (!geminiApiKey) {
    console.warn('No Gemini API key available, falling back to feature-based re-ranking');
    return await featureBasedReRanking(params, startTime);
  }

  try {
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Prepare candidates for cross-encoder evaluation
    const candidateDescriptions = params.candidates.slice(0, 20).map((candidate, index) => {
      const result = candidate.result;
      const features = candidate.contextualFeatures;
      
      return `${index + 1}. [${result.sourceType}:${result.contentType}] 
Content: "${result.contentText?.substring(0, 200)}..."
Original Score: ${candidate.originalScore.toFixed(3)}
Query Matches: ${features.queryTermMatches}
Recency: ${features.recencyScore.toFixed(2)}
Type Relevance: ${features.contentTypeRelevance.toFixed(2)}
Metadata: ${JSON.stringify(result.metadata)}`;
    }).join('\n\n');

    const prompt = `
You are an expert search result re-ranker for a Malaysian receipt management system. Re-rank these search results based on contextual relevance to the user's query and intent.

Original Query: "${params.originalQuery}"
Query Intent: ${params.queryIntent}
User Context: ${params.userProfile ? JSON.stringify(params.userProfile) : 'Not available'}
Contextual Hints: ${params.contextualHints?.join(', ') || 'None'}

Search Results to Re-rank:
${candidateDescriptions}

Re-ranking Criteria (in order of importance):
1. **Semantic Relevance**: How well does the content match the query intent?
2. **Content Quality**: Is the content complete and informative?
3. **Contextual Fit**: Does it align with user's typical patterns/preferences?
4. **Recency**: More recent content is generally more relevant
5. **Source Reliability**: Receipt data > Claims > Directory entries

Malaysian Business Context:
- Prioritize local merchants and business terms
- Consider Malaysian currency (MYR) and date formats
- Account for bilingual content (English/Malay)

Provide a JSON response with this exact structure:
{
  "rankedOrder": [1, 3, 2, 5, 4, ...],
  "reasoning": "Brief explanation of ranking decisions",
  "confidenceScore": 0.0-1.0,
  "topReasons": ["reason1", "reason2", "reason3"]
}

The rankedOrder should list the candidate numbers in order of relevance (most relevant first).
Return only valid JSON, no explanation.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      },
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    // Apply the re-ranking
    const rankedOrder = parsed.rankedOrder || params.candidates.map((_, i) => i + 1);
    const rerankedResults: UnifiedSearchResult[] = [];

    for (const rank of rankedOrder) {
      const candidateIndex = rank - 1;
      if (candidateIndex >= 0 && candidateIndex < params.candidates.length) {
        const candidate = params.candidates[candidateIndex];
        
        // Apply position-based boost to similarity score
        const positionBoost = 1 + (rankedOrder.length - rankedOrder.indexOf(rank)) * 0.03;
        const crossEncoderBoost = parsed.confidenceScore || 0.8;
        
        rerankedResults.push({
          ...candidate.result,
          similarity: Math.min(1.0, candidate.result.similarity * positionBoost * crossEncoderBoost)
        });
      }
    }

    return {
      rerankedResults,
      reRankingMetadata: {
        strategy: 'cross_encoder',
        modelUsed: 'gemini-1.5-flash',
        processingTime: Date.now() - startTime,
        candidatesCount: params.candidates.length,
        reRankingScore: parsed.confidenceScore || 0.8,
        confidenceLevel: parsed.confidenceScore > 0.8 ? 'high' : parsed.confidenceScore > 0.6 ? 'medium' : 'low',
        featureWeights: {
          semantic_relevance: 0.4,
          content_quality: 0.25,
          contextual_fit: 0.2,
          recency: 0.1,
          source_reliability: 0.05
        }
      }
    };

  } catch (error) {
    console.error('Cross-encoder re-ranking error:', error);
    return await featureBasedReRanking(params, startTime);
  }
}

/**
 * Feature-based re-ranking using contextual features
 */
async function featureBasedReRanking(
  params: EnhancedReRankingParams,
  startTime: number
): Promise<EnhancedReRankingResult> {
  // Define feature weights based on query intent
  const featureWeights = getFeatureWeights(params.queryIntent);

  // Calculate enhanced scores for each candidate
  const scoredCandidates = params.candidates.map(candidate => {
    const features = candidate.contextualFeatures;
    
    // Calculate weighted feature score
    const featureScore = 
      features.queryTermMatches * featureWeights.queryMatches +
      features.contentTypeRelevance * featureWeights.contentType +
      features.recencyScore * featureWeights.recency +
      features.userInteractionScore * featureWeights.userInteraction +
      features.semanticCoherence * featureWeights.semanticCoherence +
      features.entityAlignment * featureWeights.entityAlignment;

    // Combine with original score
    const combinedScore = (candidate.originalScore * 0.6) + (featureScore * 0.4);

    return {
      candidate,
      combinedScore,
      featureScore
    };
  });

  // Sort by combined score
  scoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);

  // Extract re-ranked results
  const rerankedResults = scoredCandidates.map(scored => scored.candidate.result);

  // Calculate confidence based on score distribution
  const scores = scoredCandidates.map(s => s.combinedScore);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const scoreVariance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
  const confidence = Math.min(1.0, avgScore + (1 - Math.sqrt(scoreVariance)));

  return {
    rerankedResults,
    reRankingMetadata: {
      strategy: 'feature_based',
      modelUsed: 'contextual_features',
      processingTime: Date.now() - startTime,
      candidatesCount: params.candidates.length,
      reRankingScore: confidence,
      confidenceLevel: confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low',
      featureWeights
    }
  };
}

/**
 * Hybrid re-ranking combining cross-encoder and feature-based approaches
 */
async function hybridReRanking(
  params: EnhancedReRankingParams,
  geminiApiKey?: string,
  startTime: number
): Promise<EnhancedReRankingResult> {
  // First apply feature-based re-ranking
  const featureResult = await featureBasedReRanking(params, startTime);
  
  // Then apply cross-encoder to top candidates
  if (geminiApiKey && featureResult.rerankedResults.length > 5) {
    const topCandidates = params.candidates
      .filter(c => featureResult.rerankedResults.slice(0, 10).some(r => r.id === c.result.id))
      .slice(0, 10);

    const crossEncoderParams = {
      ...params,
      candidates: topCandidates,
      reRankingStrategy: 'cross_encoder' as const
    };

    const crossEncoderResult = await crossEncoderReRanking(crossEncoderParams, geminiApiKey, startTime);
    
    // Combine results: cross-encoder for top 10, feature-based for the rest
    const hybridResults = [
      ...crossEncoderResult.rerankedResults,
      ...featureResult.rerankedResults.filter(r => 
        !crossEncoderResult.rerankedResults.some(cr => cr.id === r.id)
      )
    ];

    return {
      rerankedResults: hybridResults,
      reRankingMetadata: {
        strategy: 'hybrid',
        modelUsed: 'gemini-1.5-flash + contextual_features',
        processingTime: Date.now() - startTime,
        candidatesCount: params.candidates.length,
        reRankingScore: (crossEncoderResult.reRankingMetadata.reRankingScore + featureResult.reRankingMetadata.reRankingScore) / 2,
        confidenceLevel: 'high',
        featureWeights: featureResult.reRankingMetadata.featureWeights
      }
    };
  }

  return featureResult;
}

/**
 * Get feature weights based on query intent
 */
function getFeatureWeights(queryIntent: string): Record<string, number> {
  const weights: Record<string, Record<string, number>> = {
    financial_analysis: {
      queryMatches: 0.3,
      contentType: 0.25,
      recency: 0.2,
      userInteraction: 0.1,
      semanticCoherence: 0.1,
      entityAlignment: 0.05
    },
    document_retrieval: {
      queryMatches: 0.4,
      contentType: 0.2,
      recency: 0.15,
      userInteraction: 0.15,
      semanticCoherence: 0.05,
      entityAlignment: 0.05
    },
    summarization: {
      queryMatches: 0.2,
      contentType: 0.3,
      recency: 0.25,
      userInteraction: 0.1,
      semanticCoherence: 0.1,
      entityAlignment: 0.05
    },
    conversational: {
      queryMatches: 0.25,
      contentType: 0.15,
      recency: 0.2,
      userInteraction: 0.25,
      semanticCoherence: 0.1,
      entityAlignment: 0.05
    }
  };

  return weights[queryIntent] || weights.conversational;
}

/**
 * Calculate contextual features for a search result
 */
export function calculateContextualFeatures(
  result: UnifiedSearchResult,
  originalQuery: string,
  queryIntent: string,
  userProfile?: any
): ContextualFeatures {
  const queryWords = originalQuery.toLowerCase().split(/\s+/);
  const contentWords = (result.contentText || '').toLowerCase().split(/\s+/);
  
  // Query term matches
  const queryTermMatches = queryWords.filter(word => 
    contentWords.some(contentWord => contentWord.includes(word) || word.includes(contentWord))
  ).length / queryWords.length;

  // Content type relevance based on intent
  const contentTypeRelevance = getContentTypeRelevance(result.contentType, queryIntent);

  // Recency score (more recent = higher score)
  const recencyScore = calculateRecencyScore(result.metadata);

  // User interaction score (based on user's typical patterns)
  const userInteractionScore = calculateUserInteractionScore(result, userProfile);

  // Semantic coherence (how well the content flows)
  const semanticCoherence = calculateSemanticCoherence(result.contentText || '');

  // Entity alignment (how well entities match query entities)
  const entityAlignment = calculateEntityAlignment(result, originalQuery);

  return {
    queryTermMatches,
    contentTypeRelevance,
    recencyScore,
    userInteractionScore,
    semanticCoherence,
    entityAlignment
  };
}

/**
 * Helper functions for feature calculation
 */
function getContentTypeRelevance(contentType: string, queryIntent: string): number {
  const relevanceMap: Record<string, Record<string, number>> = {
    financial_analysis: {
      'full_text': 0.9,
      'merchant': 0.8,
      'line_items': 0.9,
      'total': 0.8,
      'category': 0.7,
      'notes': 0.6
    },
    document_retrieval: {
      'merchant': 0.9,
      'full_text': 0.8,
      'notes': 0.7,
      'line_items': 0.6,
      'category': 0.5
    }
  };

  return relevanceMap[queryIntent]?.[contentType] || 0.5;
}

function calculateRecencyScore(metadata: any): number {
  if (!metadata?.date) return 0.5;
  
  try {
    const date = new Date(metadata.date);
    const now = new Date();
    const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    
    // Exponential decay: more recent = higher score
    return Math.exp(-daysDiff / 30); // 30-day half-life
  } catch {
    return 0.5;
  }
}

function calculateUserInteractionScore(result: UnifiedSearchResult, userProfile?: any): number {
  // Placeholder for user interaction scoring
  // In a real implementation, this would consider:
  // - User's frequent merchants
  // - Preferred categories
  // - Historical interaction patterns
  return 0.5;
}

function calculateSemanticCoherence(content: string): number {
  if (!content || content.length < 10) return 0.3;
  
  // Simple heuristic: longer, more structured content = higher coherence
  const words = content.split(/\s+/);
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const sentenceCount = content.split(/[.!?]+/).length;
  
  // Normalize to 0-1 range
  return Math.min(1.0, (avgWordLength / 10) * (Math.log(words.length) / 5) * (sentenceCount / 10));
}

function calculateEntityAlignment(result: UnifiedSearchResult, query: string): number {
  // Placeholder for entity alignment calculation
  // In a real implementation, this would extract entities from both
  // the query and result content and calculate overlap
  return 0.5;
}

/**
 * Helper functions for result creation
 */
function createEmptyResult(startTime: number): EnhancedReRankingResult {
  return {
    rerankedResults: [],
    reRankingMetadata: {
      strategy: 'none',
      modelUsed: 'none',
      processingTime: Date.now() - startTime,
      candidatesCount: 0,
      reRankingScore: 0,
      confidenceLevel: 'low',
      featureWeights: {}
    }
  };
}

function createFallbackResult(params: EnhancedReRankingParams, startTime: number): EnhancedReRankingResult {
  return {
    rerankedResults: params.candidates.map(c => c.result),
    reRankingMetadata: {
      strategy: 'fallback',
      modelUsed: 'none',
      processingTime: Date.now() - startTime,
      candidatesCount: params.candidates.length,
      reRankingScore: 0.3,
      confidenceLevel: 'low',
      featureWeights: {}
    }
  };
}
