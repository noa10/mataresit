/**
 * Shared vector validation utilities for Edge Functions
 * Prevents embedding corruption and ensures consistent vector handling
 */

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Safely parse and validate vector data from Supabase client
 * Fixes the dimension corruption issue where vectors get malformed during JavaScript processing
 * 
 * @param vectorData - Raw vector data from Supabase (can be array, string, or other format)
 * @param expectedDimensions - Expected number of dimensions (default: 1536)
 * @returns Validated number array or null if invalid
 */
export function parseAndValidateVector(vectorData: any, expectedDimensions: number = EMBEDDING_DIMENSIONS): number[] | null {
  if (!vectorData) {
    console.warn('🔧 Vector data is null or undefined');
    return null;
  }

  let parsedVector: number[];

  try {
    // Handle different vector formats from Supabase client
    if (Array.isArray(vectorData)) {
      // Already an array - validate it's numbers
      parsedVector = vectorData.map(v => {
        const num = typeof v === 'number' ? v : parseFloat(v);
        if (isNaN(num)) {
          throw new Error(`Invalid vector value: ${v}`);
        }
        return num;
      });
    } else if (typeof vectorData === 'string') {
      // String representation - parse it
      try {
        // Handle PostgreSQL vector format: [1.0,2.0,3.0]
        const cleanedString = vectorData.trim().replace(/^\[|\]$/g, '');
        parsedVector = cleanedString.split(',').map(v => {
          const num = parseFloat(v.trim());
          if (isNaN(num)) {
            throw new Error(`Invalid vector value in string: ${v}`);
          }
          return num;
        });
      } catch (parseError) {
        console.error('🔧 Failed to parse vector string:', parseError);
        return null;
      }
    } else {
      console.error('🔧 Invalid vector format:', typeof vectorData);
      return null;
    }

    // Validate dimensions
    if (parsedVector.length !== expectedDimensions) {
      console.warn(`🔧 Invalid vector dimensions: expected=${expectedDimensions}, actual=${parsedVector.length}`);
      return null;
    }

    // Validate all values are finite numbers
    if (!parsedVector.every(v => Number.isFinite(v))) {
      console.warn('🔧 Vector contains non-finite values');
      return null;
    }

    return parsedVector;
  } catch (error) {
    console.error('🔧 Error parsing vector:', error);
    return null;
  }
}

/**
 * Validate and convert embedding dimensions with enhanced error checking
 * Prevents corruption during dimension conversion process
 * 
 * @param embedding - Input embedding array
 * @param targetDimensions - Target dimensions (default: 1536)
 * @returns Validated and converted embedding
 */
export function validateAndConvertEmbedding(embedding: number[], targetDimensions: number = EMBEDDING_DIMENSIONS): number[] {
  // Validate input embedding
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding: must be a non-empty array');
  }

  // Check for reasonable dimension bounds to prevent corruption
  if (embedding.length > targetDimensions * 50) {
    console.error(`🔧 CRITICAL: Embedding has suspicious dimensions: ${embedding.length}. This may indicate corruption.`);
    throw new Error(`Embedding dimensions too large: ${embedding.length}. Maximum expected: ${targetDimensions * 2}`);
  }

  // Validate all values are finite numbers
  if (!embedding.every(val => Number.isFinite(val))) {
    throw new Error('Embedding contains NaN or infinite values');
  }

  let convertedEmbedding = embedding;

  // Handle dimension conversion if needed
  if (embedding.length !== targetDimensions) {
    console.log(`🔧 Converting embedding dimensions from ${embedding.length} to ${targetDimensions}`);

    if (embedding.length < targetDimensions) {
      if (embedding.length === 768 && targetDimensions === 1536) {
        // Standard Gemini 768 -> 1536 conversion
        console.log('🔧 Applying standard Gemini 768->1536 conversion');
        convertedEmbedding = embedding.flatMap((val: number) => [val, val]);
      } else {
        // Pad with zeros for other cases
        console.log(`🔧 Padding embedding from ${embedding.length} to ${targetDimensions} dimensions`);
        const normalizationFactor = Math.sqrt(targetDimensions / embedding.length);
        const normalizedEmbedding = embedding.map((val: number) => val * normalizationFactor);
        const padding = new Array(targetDimensions - embedding.length).fill(0);
        convertedEmbedding = [...normalizedEmbedding, ...padding];
      }
    } else if (embedding.length > targetDimensions) {
      console.warn(`🔧 Embedding too large: ${embedding.length} dimensions. Reducing to ${targetDimensions}`);
      
      if (embedding.length === targetDimensions * 2) {
        // Average adjacent pairs for exact double
        const reducedEmbedding: number[] = [];
        for (let i = 0; i < embedding.length; i += 2) {
          reducedEmbedding.push((embedding[i] + embedding[i+1]) / 2);
        }
        convertedEmbedding = reducedEmbedding;
      } else {
        // Truncate for other cases
        convertedEmbedding = embedding.slice(0, targetDimensions);
      }
    }
  }

  // Final validation
  if (convertedEmbedding.length !== targetDimensions) {
    console.error(`🔧 CRITICAL: Final embedding validation failed. Expected: ${targetDimensions}, Got: ${convertedEmbedding.length}`);
    throw new Error(`Embedding dimension validation failed after conversion: ${convertedEmbedding.length} != ${targetDimensions}`);
  }

  // Validate all values are still finite after conversion
  if (!convertedEmbedding.every(val => Number.isFinite(val))) {
    console.error('🔧 CRITICAL: Embedding contains non-finite values after conversion');
    throw new Error('Embedding contains NaN or infinite values after conversion');
  }

  // Normalize the final embedding vector to unit length
  const magnitude = Math.sqrt(convertedEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
  if (magnitude > 0) {
    convertedEmbedding = convertedEmbedding.map((val: number) => val / magnitude);
  } else {
    console.warn('🔧 Warning: Zero magnitude embedding detected');
  }

  console.log(`🔧 Embedding validation passed: ${convertedEmbedding.length} dimensions, magnitude: ${magnitude.toFixed(6)}`);
  return convertedEmbedding;
}

/**
 * Log vector processing statistics for monitoring
 * 
 * @param context - Context information (function name, operation type)
 * @param stats - Processing statistics
 */
export function logVectorStats(context: string, stats: {
  totalProcessed: number;
  validVectors: number;
  invalidVectors: number;
  skippedVectors: number;
  averageDimensions?: number;
}) {
  console.log(`🔧 Vector Processing Stats [${context}]:`, {
    total: stats.totalProcessed,
    valid: stats.validVectors,
    invalid: stats.invalidVectors,
    skipped: stats.skippedVectors,
    successRate: stats.totalProcessed > 0 ? ((stats.validVectors / stats.totalProcessed) * 100).toFixed(2) + '%' : '0%',
    avgDimensions: stats.averageDimensions?.toFixed(0) || 'N/A'
  });
}

/**
 * Create a vector processing context for monitoring and debugging
 */
export class VectorProcessingContext {
  private stats = {
    totalProcessed: 0,
    validVectors: 0,
    invalidVectors: 0,
    skippedVectors: 0,
    dimensionSum: 0
  };

  constructor(private context: string) {}

  processVector(vectorData: any, expectedDimensions: number = EMBEDDING_DIMENSIONS): number[] | null {
    this.stats.totalProcessed++;
    
    const result = parseAndValidateVector(vectorData, expectedDimensions);
    
    if (result) {
      this.stats.validVectors++;
      this.stats.dimensionSum += result.length;
    } else {
      this.stats.invalidVectors++;
    }
    
    return result;
  }

  skipVector() {
    this.stats.skippedVectors++;
  }

  logStats() {
    logVectorStats(this.context, {
      ...this.stats,
      averageDimensions: this.stats.validVectors > 0 ? this.stats.dimensionSum / this.stats.validVectors : 0
    });
  }
}
