/**
 * Contextual Snippet Extraction System
 * 
 * This module provides advanced snippet extraction capabilities for search results,
 * highlighting relevant portions of content based on query context.
 */

export interface SnippetExtractionParams {
  content: string;
  query: string;
  maxSnippets?: number;
  snippetLength?: number;
  highlightTerms?: boolean;
  contextWindow?: number;
  queryIntent?: string;
}

export interface ExtractedSnippet {
  text: string;
  startPosition: number;
  endPosition: number;
  relevanceScore: number;
  highlightedTerms: string[];
  contextType: 'exact_match' | 'semantic_match' | 'contextual' | 'fallback';
}

export interface SnippetExtractionResult {
  snippets: ExtractedSnippet[];
  totalMatches: number;
  extractionMetadata: {
    processingTime: number;
    strategy: string;
    queryTermsFound: string[];
    contentLength: number;
  };
}

/**
 * Extract contextual snippets from content based on query
 */
export async function extractContextualSnippets(
  params: SnippetExtractionParams
): Promise<SnippetExtractionResult> {
  const startTime = Date.now();
  
  const {
    content,
    query,
    maxSnippets = 3,
    snippetLength = 200,
    highlightTerms = true,
    contextWindow = 50,
    queryIntent = 'general'
  } = params;

  if (!content || !query || content.trim() === '' || query.trim() === '') {
    return createEmptyResult(startTime);
  }

  try {
    // Normalize inputs
    const normalizedContent = normalizeText(content);
    const normalizedQuery = normalizeText(query);
    const queryTerms = extractQueryTerms(normalizedQuery);

    // Find all potential snippet locations
    const snippetCandidates = findSnippetCandidates(
      normalizedContent,
      queryTerms,
      snippetLength,
      contextWindow
    );

    // Score and rank snippet candidates
    const scoredSnippets = scoreSnippetCandidates(
      snippetCandidates,
      queryTerms,
      queryIntent,
      content
    );

    // Select best snippets
    const selectedSnippets = selectBestSnippets(
      scoredSnippets,
      maxSnippets,
      snippetLength
    );

    // Apply highlighting if requested
    const finalSnippets = highlightTerms 
      ? applyHighlighting(selectedSnippets, queryTerms)
      : selectedSnippets;

    return {
      snippets: finalSnippets,
      totalMatches: snippetCandidates.length,
      extractionMetadata: {
        processingTime: Date.now() - startTime,
        strategy: 'contextual_extraction',
        queryTermsFound: queryTerms.filter(term => 
          normalizedContent.includes(term.toLowerCase())
        ),
        contentLength: content.length
      }
    };

  } catch (error) {
    console.error('Snippet extraction error:', error);
    return createFallbackResult(params, startTime);
  }
}

/**
 * Normalize text for better matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract meaningful query terms
 */
function extractQueryTerms(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you',
    'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);

  return query
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term))
    .slice(0, 10); // Limit to 10 most important terms
}

/**
 * Find potential snippet locations in content
 */
function findSnippetCandidates(
  content: string,
  queryTerms: string[],
  snippetLength: number,
  contextWindow: number
): SnippetCandidate[] {
  const candidates: SnippetCandidate[] = [];
  const words = content.split(/\s+/);

  // Find exact matches
  queryTerms.forEach(term => {
    let searchIndex = 0;
    while (true) {
      const matchIndex = content.indexOf(term, searchIndex);
      if (matchIndex === -1) break;

      // Find word boundaries around the match
      const wordIndex = findWordIndex(words, matchIndex, content);
      if (wordIndex !== -1) {
        const startWord = Math.max(0, wordIndex - contextWindow);
        const endWord = Math.min(words.length, wordIndex + contextWindow);
        
        candidates.push({
          startPosition: getCharPosition(words, startWord),
          endPosition: getCharPosition(words, endWord),
          matchedTerms: [term],
          matchType: 'exact_match',
          centerWord: wordIndex
        });
      }

      searchIndex = matchIndex + 1;
    }
  });

  // Find phrase matches (multiple terms close together)
  if (queryTerms.length > 1) {
    const phraseMatches = findPhraseMatches(content, queryTerms, contextWindow);
    candidates.push(...phraseMatches);
  }

  // Add fallback snippets if no matches found
  if (candidates.length === 0) {
    candidates.push({
      startPosition: 0,
      endPosition: Math.min(content.length, snippetLength * 2),
      matchedTerms: [],
      matchType: 'fallback',
      centerWord: 0
    });
  }

  return candidates;
}

interface SnippetCandidate {
  startPosition: number;
  endPosition: number;
  matchedTerms: string[];
  matchType: 'exact_match' | 'phrase_match' | 'semantic_match' | 'fallback';
  centerWord: number;
}

/**
 * Find phrase matches where multiple query terms appear close together
 */
function findPhraseMatches(
  content: string,
  queryTerms: string[],
  contextWindow: number
): SnippetCandidate[] {
  const candidates: SnippetCandidate[] = [];
  const words = content.split(/\s+/);

  for (let i = 0; i < words.length - 1; i++) {
    const windowEnd = Math.min(words.length, i + contextWindow);
    const windowText = words.slice(i, windowEnd).join(' ');
    
    const matchedTerms = queryTerms.filter(term => 
      windowText.includes(term)
    );

    if (matchedTerms.length >= 2) {
      candidates.push({
        startPosition: getCharPosition(words, Math.max(0, i - contextWindow / 2)),
        endPosition: getCharPosition(words, Math.min(words.length, windowEnd + contextWindow / 2)),
        matchedTerms,
        matchType: 'phrase_match',
        centerWord: i + Math.floor((windowEnd - i) / 2)
      });
    }
  }

  return candidates;
}

/**
 * Score snippet candidates based on relevance
 */
function scoreSnippetCandidates(
  candidates: SnippetCandidate[],
  queryTerms: string[],
  queryIntent: string,
  originalContent: string
): ExtractedSnippet[] {
  return candidates.map(candidate => {
    const snippetText = originalContent.substring(
      candidate.startPosition,
      candidate.endPosition
    ).trim();

    // Calculate relevance score
    let relevanceScore = 0;

    // Term match score
    const termMatchScore = candidate.matchedTerms.length / queryTerms.length;
    relevanceScore += termMatchScore * 0.4;

    // Match type score
    const matchTypeScores = {
      'exact_match': 1.0,
      'phrase_match': 0.8,
      'semantic_match': 0.6,
      'fallback': 0.2
    };
    relevanceScore += matchTypeScores[candidate.matchType] * 0.3;

    // Content quality score
    const contentQualityScore = calculateContentQuality(snippetText);
    relevanceScore += contentQualityScore * 0.2;

    // Position score (earlier content often more relevant)
    const positionScore = 1 - (candidate.startPosition / originalContent.length);
    relevanceScore += positionScore * 0.1;

    return {
      text: snippetText,
      startPosition: candidate.startPosition,
      endPosition: candidate.endPosition,
      relevanceScore,
      highlightedTerms: candidate.matchedTerms,
      contextType: candidate.matchType
    };
  });
}

/**
 * Calculate content quality score
 */
function calculateContentQuality(text: string): number {
  if (!text || text.length < 10) return 0.1;

  let score = 0;

  // Length score (prefer medium-length snippets)
  const lengthScore = Math.min(1, text.length / 200) * (1 - Math.max(0, (text.length - 300) / 200));
  score += lengthScore * 0.3;

  // Word diversity score
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const diversityScore = uniqueWords.size / words.length;
  score += diversityScore * 0.3;

  // Sentence completeness score
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const completenessScore = sentences.length > 0 ? 1 : 0.5;
  score += completenessScore * 0.2;

  // Readability score (simple heuristic)
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const readabilityScore = Math.max(0, 1 - Math.abs(avgWordLength - 5) / 10);
  score += readabilityScore * 0.2;

  return Math.min(1, score);
}

/**
 * Select best snippets avoiding overlap
 */
function selectBestSnippets(
  scoredSnippets: ExtractedSnippet[],
  maxSnippets: number,
  snippetLength: number
): ExtractedSnippet[] {
  // Sort by relevance score
  const sortedSnippets = [...scoredSnippets].sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  const selectedSnippets: ExtractedSnippet[] = [];
  const minGap = snippetLength / 2; // Minimum gap between snippets

  for (const snippet of sortedSnippets) {
    if (selectedSnippets.length >= maxSnippets) break;

    // Check for overlap with already selected snippets
    const hasOverlap = selectedSnippets.some(selected => 
      Math.abs(snippet.startPosition - selected.startPosition) < minGap ||
      Math.abs(snippet.endPosition - selected.endPosition) < minGap
    );

    if (!hasOverlap) {
      selectedSnippets.push(snippet);
    }
  }

  // Sort selected snippets by position in original content
  return selectedSnippets.sort((a, b) => a.startPosition - b.startPosition);
}

/**
 * Apply highlighting to snippets
 */
function applyHighlighting(
  snippets: ExtractedSnippet[],
  queryTerms: string[]
): ExtractedSnippet[] {
  return snippets.map(snippet => {
    let highlightedText = snippet.text;
    
    // Apply highlighting to each query term
    queryTerms.forEach(term => {
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `**$&**`);
    });

    return {
      ...snippet,
      text: highlightedText
    };
  });
}

/**
 * Helper functions
 */
function findWordIndex(words: string[], charIndex: number, content: string): number {
  let currentPos = 0;
  for (let i = 0; i < words.length; i++) {
    if (currentPos <= charIndex && charIndex < currentPos + words[i].length) {
      return i;
    }
    currentPos += words[i].length + 1; // +1 for space
  }
  return -1;
}

function getCharPosition(words: string[], wordIndex: number): number {
  return words.slice(0, wordIndex).join(' ').length + (wordIndex > 0 ? 1 : 0);
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createEmptyResult(startTime: number): SnippetExtractionResult {
  return {
    snippets: [],
    totalMatches: 0,
    extractionMetadata: {
      processingTime: Date.now() - startTime,
      strategy: 'empty',
      queryTermsFound: [],
      contentLength: 0
    }
  };
}

function createFallbackResult(
  params: SnippetExtractionParams,
  startTime: number
): SnippetExtractionResult {
  const fallbackSnippet: ExtractedSnippet = {
    text: params.content.substring(0, params.snippetLength || 200),
    startPosition: 0,
    endPosition: Math.min(params.content.length, params.snippetLength || 200),
    relevanceScore: 0.3,
    highlightedTerms: [],
    contextType: 'fallback'
  };

  return {
    snippets: [fallbackSnippet],
    totalMatches: 1,
    extractionMetadata: {
      processingTime: Date.now() - startTime,
      strategy: 'fallback',
      queryTermsFound: [],
      contentLength: params.content.length
    }
  };
}
