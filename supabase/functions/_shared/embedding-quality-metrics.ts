/**
 * Embedding Quality Metrics for AI Vision Enhanced Processing
 * Tracks and validates the quality of generated embeddings
 */

export interface EmbeddingQualityMetrics {
  receiptId: string;
  totalContentTypes: number;
  successfulEmbeddings: number;
  failedEmbeddings: number;
  syntheticContentUsed: boolean;
  contentQualityScores: ContentQualityScore[];
  overallQualityScore: number;
  processingMethod: 'enhanced' | 'fallback' | 'legacy';
  timestamp: string;
}

export interface ContentQualityScore {
  contentType: string;
  contentLength: number;
  qualityScore: number; // 0-100
  qualityFactors: {
    hasMinimumLength: boolean;
    hasStructuredData: boolean;
    hasContextualInfo: boolean;
    isSynthetic: boolean;
  };
}

/**
 * Calculate quality score for content
 */
export function calculateContentQuality(
  contentType: string,
  contentText: string,
  metadata: any = {}
): ContentQualityScore {
  const qualityFactors = {
    hasMinimumLength: contentText.length >= 10,
    hasStructuredData: contentType !== 'full_text' || contentText.includes(':'),
    hasContextualInfo: contentText.includes('Merchant:') || contentText.includes('Total:') || contentText.includes('Items:'),
    isSynthetic: metadata.is_synthetic === true
  };
  
  // Calculate quality score based on factors
  let qualityScore = 0;
  
  // Base score for minimum length
  if (qualityFactors.hasMinimumLength) qualityScore += 25;
  
  // Bonus for structured data
  if (qualityFactors.hasStructuredData) qualityScore += 25;
  
  // Bonus for contextual information
  if (qualityFactors.hasContextualInfo) qualityScore += 25;
  
  // Length-based scoring
  if (contentText.length >= 50) qualityScore += 10;
  if (contentText.length >= 100) qualityScore += 10;
  if (contentText.length >= 200) qualityScore += 5;
  
  // Synthetic content gets slight penalty but still valuable
  if (qualityFactors.isSynthetic) qualityScore = Math.max(qualityScore - 5, 0);
  
  return {
    contentType,
    contentLength: contentText.length,
    qualityScore: Math.min(qualityScore, 100),
    qualityFactors
  };
}

/**
 * Generate comprehensive quality metrics for a receipt's embeddings
 */
export function generateEmbeddingQualityMetrics(
  receiptId: string,
  embeddingResults: any[],
  processingMethod: 'enhanced' | 'fallback' | 'legacy' = 'enhanced'
): EmbeddingQualityMetrics {
  const successfulEmbeddings = embeddingResults.filter(r => r.success).length;
  const failedEmbeddings = embeddingResults.filter(r => !r.success).length;
  
  const contentQualityScores: ContentQualityScore[] = embeddingResults
    .filter(r => r.success && r.contentText)
    .map(r => calculateContentQuality(r.contentType, r.contentText, r.metadata || {}));
  
  // Calculate overall quality score
  const avgContentQuality = contentQualityScores.length > 0
    ? contentQualityScores.reduce((sum, score) => sum + score.qualityScore, 0) / contentQualityScores.length
    : 0;
  
  // Adjust for success rate
  const successRate = embeddingResults.length > 0 ? successfulEmbeddings / embeddingResults.length : 0;
  const overallQualityScore = Math.round(avgContentQuality * successRate);
  
  // Check if synthetic content was used
  const syntheticContentUsed = contentQualityScores.some(score => score.qualityFactors.isSynthetic);
  
  return {
    receiptId,
    totalContentTypes: embeddingResults.length,
    successfulEmbeddings,
    failedEmbeddings,
    syntheticContentUsed,
    contentQualityScores,
    overallQualityScore,
    processingMethod,
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate embedding quality and suggest improvements
 */
export function validateEmbeddingQuality(metrics: EmbeddingQualityMetrics): {
  isAcceptable: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check overall quality score
  if (metrics.overallQualityScore < 50) {
    issues.push('Overall quality score is below acceptable threshold (50)');
    suggestions.push('Review content extraction logic and ensure sufficient data is available');
  }
  
  // Check success rate
  const successRate = metrics.totalContentTypes > 0 
    ? metrics.successfulEmbeddings / metrics.totalContentTypes 
    : 0;
  
  if (successRate < 0.7) {
    issues.push('Embedding success rate is below 70%');
    suggestions.push('Investigate embedding generation failures and improve error handling');
  }
  
  // Check for minimum content types
  if (metrics.successfulEmbeddings < 2) {
    issues.push('Insufficient content types processed (minimum 2 recommended)');
    suggestions.push('Ensure both merchant and full_text content are available');
  }
  
  // Check content quality scores
  const lowQualityContent = metrics.contentQualityScores.filter(score => score.qualityScore < 40);
  if (lowQualityContent.length > 0) {
    issues.push(`${lowQualityContent.length} content types have low quality scores`);
    suggestions.push('Improve content synthesis for: ' + lowQualityContent.map(c => c.contentType).join(', '));
  }
  
  // Check for synthetic content usage
  if (metrics.syntheticContentUsed && metrics.processingMethod === 'enhanced') {
    suggestions.push('Synthetic content was used - consider validating AI vision extraction quality');
  }
  
  return {
    isAcceptable: issues.length === 0 && metrics.overallQualityScore >= 50,
    issues,
    suggestions
  };
}

/**
 * Log quality metrics for monitoring
 */
export function logEmbeddingQualityMetrics(metrics: EmbeddingQualityMetrics): void {
  console.log(`📊 Embedding Quality Metrics for Receipt ${metrics.receiptId}:`);
  console.log(`   Overall Quality Score: ${metrics.overallQualityScore}/100`);
  console.log(`   Processing Method: ${metrics.processingMethod}`);
  console.log(`   Content Types: ${metrics.successfulEmbeddings}/${metrics.totalContentTypes} successful`);
  console.log(`   Synthetic Content Used: ${metrics.syntheticContentUsed ? 'Yes' : 'No'}`);
  
  if (metrics.contentQualityScores.length > 0) {
    console.log(`   Content Quality Breakdown:`);
    metrics.contentQualityScores.forEach(score => {
      console.log(`     ${score.contentType}: ${score.qualityScore}/100 (${score.contentLength} chars)`);
    });
  }
  
  const validation = validateEmbeddingQuality(metrics);
  if (!validation.isAcceptable) {
    console.log(`   ⚠️ Quality Issues: ${validation.issues.join(', ')}`);
    console.log(`   💡 Suggestions: ${validation.suggestions.join(', ')}`);
  } else {
    console.log(`   ✅ Quality validation passed`);
  }
}

/**
 * Store quality metrics in database for analysis
 */
export async function storeEmbeddingQualityMetrics(
  metrics: EmbeddingQualityMetrics,
  supabaseClient: any
): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('embedding_quality_metrics')
      .insert({
        receipt_id: metrics.receiptId,
        total_content_types: metrics.totalContentTypes,
        successful_embeddings: metrics.successfulEmbeddings,
        failed_embeddings: metrics.failedEmbeddings,
        synthetic_content_used: metrics.syntheticContentUsed,
        overall_quality_score: metrics.overallQualityScore,
        processing_method: metrics.processingMethod,
        content_quality_scores: metrics.contentQualityScores,
        created_at: metrics.timestamp
      });
    
    if (error) {
      console.error('Failed to store embedding quality metrics:', error);
    } else {
      console.log(`📊 Stored quality metrics for receipt ${metrics.receiptId}`);
    }
  } catch (error) {
    console.error('Error storing embedding quality metrics:', error);
  }
}

/**
 * Get quality metrics summary for a set of receipts
 */
export function summarizeQualityMetrics(metricsArray: EmbeddingQualityMetrics[]): {
  totalReceipts: number;
  averageQualityScore: number;
  syntheticContentUsageRate: number;
  processingMethodBreakdown: Record<string, number>;
  commonIssues: string[];
} {
  if (metricsArray.length === 0) {
    return {
      totalReceipts: 0,
      averageQualityScore: 0,
      syntheticContentUsageRate: 0,
      processingMethodBreakdown: {},
      commonIssues: []
    };
  }
  
  const totalReceipts = metricsArray.length;
  const averageQualityScore = metricsArray.reduce((sum, m) => sum + m.overallQualityScore, 0) / totalReceipts;
  const syntheticContentUsageRate = metricsArray.filter(m => m.syntheticContentUsed).length / totalReceipts;
  
  const processingMethodBreakdown: Record<string, number> = {};
  metricsArray.forEach(m => {
    processingMethodBreakdown[m.processingMethod] = (processingMethodBreakdown[m.processingMethod] || 0) + 1;
  });
  
  // Collect common issues
  const allIssues: string[] = [];
  metricsArray.forEach(m => {
    const validation = validateEmbeddingQuality(m);
    allIssues.push(...validation.issues);
  });
  
  const issueFrequency: Record<string, number> = {};
  allIssues.forEach(issue => {
    issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
  });
  
  const commonIssues = Object.entries(issueFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([issue]) => issue);
  
  return {
    totalReceipts,
    averageQualityScore: Math.round(averageQualityScore),
    syntheticContentUsageRate: Math.round(syntheticContentUsageRate * 100) / 100,
    processingMethodBreakdown,
    commonIssues
  };
}
