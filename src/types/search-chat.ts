import type { UnifiedSearchResult } from './unified-search';

export type SearchChatRole = 'user' | 'assistant';

export type SearchChatStatus = 'loading' | 'complete' | 'error';

export interface SearchChatMessage {
  id: string;
  role: SearchChatRole;
  content: string;
  createdAt: Date;
  status: SearchChatStatus;
  /** The query that produced this assistant message (used by retry + load more). */
  query?: string;
  results?: UnifiedSearchResult[];
  totalResults?: number;
  /** Offset of the next page of results. */
  offset?: number;
  hasMore?: boolean;
  followUpSuggestions?: string[];
}
