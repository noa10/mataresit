/**
 * Self-Correction System with Generator and Critic Models
 * 
 * This module implements a two-step generation process where a generator model
 * creates an initial response and a critic model reviews it for factual consistency
 * and accuracy against the source documents.
 */

export interface GeneratorResponse {
  content: string;
  uiComponents: any[];
  followUpSuggestions: string[];
  confidence: number;
  sourceReferences: SourceReference[];
  claims: ExtractedClaim[];
}

export interface SourceReference {
  sourceId: string;
  sourceType: string;
  contentText: string;
  relevanceScore: number;
  usedInResponse: boolean;
}

export interface ExtractedClaim {
  claim: string;
  claimType: 'factual' | 'numerical' | 'temporal' | 'categorical';
  confidence: number;
  sourceSupport: string[];
  position: { start: number; end: number };
}

export interface CriticAnalysis {
  overallAccuracy: number;
  factualConsistency: number;
  sourceAlignment: number;
  claimVerification: ClaimVerification[];
  identifiedIssues: IdentificationIssue[];
  correctionSuggestions: CorrectionSuggestion[];
  approvalStatus: 'approved' | 'needs_correction' | 'rejected';
}

export interface ClaimVerification {
  claim: string;
  isSupported: boolean;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  confidenceScore: number;
  verificationMethod: 'exact_match' | 'semantic_match' | 'calculation' | 'inference';
}

export interface IdentificationIssue {
  issueType: 'factual_error' | 'unsupported_claim' | 'calculation_error' | 'source_misattribution' | 'hallucination';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedText: string;
  suggestedFix: string;
  sourceLocation?: string;
}

export interface CorrectionSuggestion {
  originalText: string;
  correctedText: string;
  reasoning: string;
  confidence: number;
  requiresUserApproval: boolean;
}

export interface SelfCorrectionResult {
  finalResponse: GeneratorResponse;
  generatorOutput: GeneratorResponse;
  criticAnalysis: CriticAnalysis;
  correctionApplied: boolean;
  iterationCount: number;
  processingMetadata: {
    generatorTime: number;
    criticTime: number;
    correctionTime: number;
    totalTime: number;
    modelsUsed: string[];
  };
}

/**
 * Main self-correction pipeline
 */
export async function selfCorrectionPipeline(
  query: string,
  searchResults: any[],
  context: any,
  geminiApiKey: string,
  maxIterations: number = 2
): Promise<SelfCorrectionResult> {
  const startTime = Date.now();
  let iterationCount = 0;
  let currentResponse: GeneratorResponse;
  let criticAnalysis: CriticAnalysis;
  let correctionApplied = false;

  console.log('🔄 Starting self-correction pipeline...');

  try {
    // Step 1: Generate initial response
    console.log('📝 Step 1: Generating initial response...');
    const generatorStart = Date.now();
    currentResponse = await generateInitialResponse(query, searchResults, context, geminiApiKey);
    const generatorTime = Date.now() - generatorStart;

    console.log(`✅ Initial response generated in ${generatorTime}ms`);

    // Step 2: Critic analysis loop
    while (iterationCount < maxIterations) {
      iterationCount++;
      console.log(`🔍 Step 2.${iterationCount}: Running critic analysis...`);
      
      const criticStart = Date.now();
      criticAnalysis = await runCriticAnalysis(
        currentResponse,
        searchResults,
        query,
        context,
        geminiApiKey
      );
      const criticTime = Date.now() - criticStart;

      console.log(`✅ Critic analysis completed in ${criticTime}ms - Status: ${criticAnalysis.approvalStatus}`);

      // If approved or rejected, break the loop
      if (criticAnalysis.approvalStatus === 'approved' || criticAnalysis.approvalStatus === 'rejected') {
        break;
      }

      // Step 3: Apply corrections if needed
      if (criticAnalysis.approvalStatus === 'needs_correction' && criticAnalysis.correctionSuggestions.length > 0) {
        console.log(`🔧 Step 3.${iterationCount}: Applying corrections...`);
        
        const correctionStart = Date.now();
        const correctedResponse = await applyCorrections(
          currentResponse,
          criticAnalysis.correctionSuggestions,
          searchResults,
          geminiApiKey
        );
        const correctionTime = Date.now() - correctionStart;

        if (correctedResponse) {
          currentResponse = correctedResponse;
          correctionApplied = true;
          console.log(`✅ Corrections applied in ${correctionTime}ms`);
        } else {
          console.log('⚠️ Correction application failed, using original response');
          break;
        }
      } else {
        break;
      }
    }

    return {
      finalResponse: currentResponse,
      generatorOutput: currentResponse, // Store original for comparison
      criticAnalysis: criticAnalysis!,
      correctionApplied,
      iterationCount,
      processingMetadata: {
        generatorTime: generatorTime,
        criticTime: criticAnalysis ? Date.now() - startTime - generatorTime : 0,
        correctionTime: correctionApplied ? 100 : 0, // Placeholder
        totalTime: Date.now() - startTime,
        modelsUsed: ['gemini-1.5-flash-generator', 'gemini-1.5-flash-critic']
      }
    };

  } catch (error) {
    console.error('❌ Self-correction pipeline error:', error);
    
    // Return fallback result
    return {
      finalResponse: currentResponse! || await generateFallbackResponse(query, searchResults),
      generatorOutput: currentResponse! || await generateFallbackResponse(query, searchResults),
      criticAnalysis: {
        overallAccuracy: 0.3,
        factualConsistency: 0.3,
        sourceAlignment: 0.3,
        claimVerification: [],
        identifiedIssues: [{
          issueType: 'hallucination',
          description: 'Self-correction pipeline failed',
          severity: 'high',
          affectedText: 'entire response',
          suggestedFix: 'Use fallback response generation'
        }],
        correctionSuggestions: [],
        approvalStatus: 'rejected'
      },
      correctionApplied: false,
      iterationCount: 0,
      processingMetadata: {
        generatorTime: 0,
        criticTime: 0,
        correctionTime: 0,
        totalTime: Date.now() - startTime,
        modelsUsed: ['fallback']
      }
    };
  }
}

/**
 * Generate initial response using the generator model
 */
async function generateInitialResponse(
  query: string,
  searchResults: any[],
  context: any,
  geminiApiKey: string
): Promise<GeneratorResponse> {
  const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Prepare source references
  const sourceReferences: SourceReference[] = searchResults.map((result, index) => ({
    sourceId: result.id || `source-${index}`,
    sourceType: result.sourceType || 'unknown',
    contentText: result.contentText || result.description || '',
    relevanceScore: result.similarity || 0,
    usedInResponse: false
  }));

  const prompt = `
You are a financial data analysis expert for Mataresit, a Malaysian receipt management platform. Generate a comprehensive response to the user's query based on the provided search results.

CRITICAL INSTRUCTIONS:
1. Base your response ONLY on the provided search results
2. Include specific references to source data
3. Make factual claims that can be verified against the sources
4. Include numerical calculations when relevant
5. Structure your response with clear sections

User Query: "${query}"

Search Results:
${searchResults.map((result, index) => `
Source ${index + 1} [ID: ${result.id}]:
Type: ${result.sourceType} - ${result.contentType}
Content: ${result.contentText || result.description}
Metadata: ${JSON.stringify(result.metadata || {})}
Relevance: ${(result.similarity * 100).toFixed(1)}%
`).join('\n')}

Generate a response that includes:
1. **Summary**: Clear answer to the user's question
2. **Details**: Specific information from the sources
3. **Calculations**: Any numerical analysis (totals, averages, etc.)
4. **Source References**: Which sources support each claim
5. **UI Components**: Suggest appropriate visualizations

Format your response as JSON:
{
  "content": "Main response text with clear sections",
  "claims": [
    {
      "claim": "Specific factual statement",
      "claimType": "factual|numerical|temporal|categorical",
      "confidence": 0.0-1.0,
      "sourceSupport": ["source-1", "source-2"]
    }
  ],
  "calculations": [
    {
      "description": "What was calculated",
      "formula": "Mathematical formula used",
      "result": "Final result",
      "sources": ["source-1"]
    }
  ],
  "uiComponents": [
    {
      "type": "ui_component",
      "component": "summary_card|data_table|bar_chart|pie_chart",
      "data": {...}
    }
  ],
  "followUpSuggestions": ["suggestion1", "suggestion2", "suggestion3"]
}

Return only valid JSON, no explanation.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
    },
  });

  const responseText = result.response.text();
  
  try {
    const parsed = JSON.parse(responseText);
    
    return {
      content: parsed.content || responseText,
      uiComponents: parsed.uiComponents || [],
      followUpSuggestions: parsed.followUpSuggestions || [],
      confidence: 0.8,
      sourceReferences,
      claims: parsed.claims || []
    };
  } catch (parseError) {
    console.warn('Failed to parse generator response as JSON, using text response');
    
    return {
      content: responseText,
      uiComponents: [],
      followUpSuggestions: [],
      confidence: 0.6,
      sourceReferences,
      claims: []
    };
  }
}

/**
 * Run critic analysis on the generated response
 */
async function runCriticAnalysis(
  generatorResponse: GeneratorResponse,
  searchResults: any[],
  originalQuery: string,
  context: any,
  geminiApiKey: string
): Promise<CriticAnalysis> {
  const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are a fact-checking expert reviewing a response for accuracy and consistency. Your job is to verify that all claims in the response are supported by the provided source documents.

Original Query: "${originalQuery}"

Generated Response to Review:
${generatorResponse.content}

Claims Made in Response:
${generatorResponse.claims.map((claim, index) => `
${index + 1}. ${claim.claim} (Type: ${claim.claimType}, Confidence: ${claim.confidence})
   Sources cited: ${claim.sourceSupport.join(', ')}
`).join('\n')}

Source Documents for Verification:
${searchResults.map((result, index) => `
Source ${index + 1} [ID: ${result.id}]:
Content: ${result.contentText || result.description}
Metadata: ${JSON.stringify(result.metadata || {})}
`).join('\n')}

VERIFICATION TASKS:
1. Check each claim against the source documents
2. Identify any unsupported or contradictory statements
3. Verify numerical calculations and data
4. Check for potential hallucinations or fabricated information
5. Assess overall factual consistency

Provide your analysis as JSON:
{
  "overallAccuracy": 0.0-1.0,
  "factualConsistency": 0.0-1.0,
  "sourceAlignment": 0.0-1.0,
  "claimVerification": [
    {
      "claim": "The specific claim being verified",
      "isSupported": true/false,
      "supportingEvidence": ["evidence from sources"],
      "contradictingEvidence": ["contradictory evidence"],
      "confidenceScore": 0.0-1.0,
      "verificationMethod": "exact_match|semantic_match|calculation|inference"
    }
  ],
  "identifiedIssues": [
    {
      "issueType": "factual_error|unsupported_claim|calculation_error|source_misattribution|hallucination",
      "description": "Detailed description of the issue",
      "severity": "low|medium|high|critical",
      "affectedText": "The problematic text",
      "suggestedFix": "How to fix this issue"
    }
  ],
  "correctionSuggestions": [
    {
      "originalText": "Text that needs correction",
      "correctedText": "Suggested correction",
      "reasoning": "Why this correction is needed",
      "confidence": 0.0-1.0,
      "requiresUserApproval": true/false
    }
  ],
  "approvalStatus": "approved|needs_correction|rejected"
}

Return only valid JSON, no explanation.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2000,
    },
  });

  const responseText = result.response.text();
  
  try {
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (parseError) {
    console.error('Failed to parse critic analysis:', parseError);
    
    // Return default analysis indicating issues
    return {
      overallAccuracy: 0.5,
      factualConsistency: 0.5,
      sourceAlignment: 0.5,
      claimVerification: [],
      identifiedIssues: [{
        issueType: 'hallucination',
        description: 'Unable to verify response due to parsing error',
        severity: 'medium',
        affectedText: 'entire response',
        suggestedFix: 'Manual review required'
      }],
      correctionSuggestions: [],
      approvalStatus: 'needs_correction'
    };
  }
}

/**
 * Apply corrections to the response based on critic suggestions
 */
async function applyCorrections(
  originalResponse: GeneratorResponse,
  corrections: CorrectionSuggestion[],
  searchResults: any[],
  geminiApiKey: string
): Promise<GeneratorResponse | null> {
  if (corrections.length === 0) {
    return originalResponse;
  }

  const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
Apply the following corrections to the response while maintaining its structure and flow.

Original Response:
${originalResponse.content}

Corrections to Apply:
${corrections.map((correction, index) => `
${index + 1}. Replace: "${correction.originalText}"
   With: "${correction.correctedText}"
   Reason: ${correction.reasoning}
`).join('\n')}

Generate the corrected response maintaining the same format and structure. Return only the corrected content, no explanation.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000,
      },
    });

    const correctedContent = result.response.text();

    return {
      ...originalResponse,
      content: correctedContent,
      confidence: Math.min(originalResponse.confidence + 0.1, 1.0)
    };

  } catch (error) {
    console.error('Failed to apply corrections:', error);
    return null;
  }
}

/**
 * Generate fallback response when self-correction fails
 */
async function generateFallbackResponse(query: string, searchResults: any[]): Promise<GeneratorResponse> {
  const hasResults = searchResults && searchResults.length > 0;
  
  const content = hasResults
    ? `I found ${searchResults.length} results for "${query}". Let me help you explore this information.`
    : `I couldn't find specific results for "${query}", but I can help you refine your search or explore your data in other ways.`;

  return {
    content,
    uiComponents: [],
    followUpSuggestions: [
      "Refine my search",
      "Show me related data",
      "Help me explore"
    ],
    confidence: 0.3,
    sourceReferences: [],
    claims: []
  };
}
