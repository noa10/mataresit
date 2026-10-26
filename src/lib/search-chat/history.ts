import type { SearchChatMessage } from '@/types/search-chat';
import type { UnifiedSearchResult } from '@/types/unified-search';

export const SEARCH_CHAT_HISTORY_EVENT = 'search-chat-history:changed';
export const SEARCH_CHAT_STORAGE_PREFIX = 'mataresit_search_chat_history_v1';
/** @deprecated Unscoped key from before per-user storage; only used for cleanup. */
export const SEARCH_CHAT_STORAGE_KEY = SEARCH_CHAT_STORAGE_PREFIX;

export const getSearchChatStorageKey = (userId: string): string =>
  `${SEARCH_CHAT_STORAGE_PREFIX}_${userId}`;

const LEGACY_STORAGE_KEY = 'paperless_chat_conversations';
const LEGACY_MIGRATION_FLAG = 'mataresit_search_chat_migrated_v1';
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVERSATION = 100;
const MAX_RESULTS_PER_MESSAGE = 40;
const MAX_CONTENT_LENGTH = 20_000;
const MAX_TITLE_LENGTH = 60;
const MAX_MIGRATED_CONVERSATIONS = 10;

interface LegacyChatMessage {
  id?: unknown;
  type?: unknown;
  content?: unknown;
  timestamp?: unknown;
}

interface LegacyChatConversation {
  metadata?: {
    id?: unknown;
    title?: unknown;
    timestamp?: unknown;
  };
  messages?: unknown;
}

export interface SearchChatSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StoredSearchChatResult {
  id: string;
  sourceType: UnifiedSearchResult['sourceType'];
  sourceId: string;
  contentType: string;
  title: string;
  description: string;
  similarity: number;
  accessLevel: UnifiedSearchResult['accessLevel'];
  createdAt: string;
  metadata: Record<string, string | number | undefined>;
}

interface StoredSearchChatMessage {
  id: string;
  role: SearchChatMessage['role'];
  content: string;
  createdAt: string;
  status: 'complete' | 'error';
  query?: string;
  results?: StoredSearchChatResult[];
  totalResults?: number;
  offset?: number;
  hasMore?: boolean;
  followUpSuggestions?: string[];
}

export interface StoredSearchChat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredSearchChatMessage[];
}

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const createId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}${crypto.randomUUID()}`;
  }
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const safeIso = (value: unknown, fallback: string): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
};

const cleanText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const truncate = (value: string, length: number): string =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

const buildTitle = (messages: StoredSearchChatMessage[]): string => {
  const firstUserMessage = messages.find(
    (message) => message.role === 'user' && message.content.trim()
  );
  return firstUserMessage
    ? truncate(cleanText(firstUserMessage.content), MAX_TITLE_LENGTH)
    : '';
};

const readStoredChats = (userId: string): StoredSearchChat[] => {
  if (!isBrowser() || !userId) return [];
  try {
    const raw = window.localStorage.getItem(getSearchChatStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSearchChat[]) : [];
  } catch (error) {
    console.error('Failed to read search chat history', error);
    return [];
  }
};

const writeStoredChats = (userId: string, chats: StoredSearchChat[]): boolean => {
  if (!isBrowser() || !userId) return false;
  const key = getSearchChatStorageKey(userId);
  try {
    window.localStorage.setItem(key, JSON.stringify(chats));
    return true;
  } catch (error) {
    console.error('Failed to save search chat history', error);
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify(chats.slice(0, Math.max(1, Math.floor(MAX_CONVERSATIONS / 2))))
      );
      return true;
    } catch (retryError) {
      console.error('Failed to save trimmed search chat history', retryError);
      return false;
    }
  }
};

const notifyHistoryChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SEARCH_CHAT_HISTORY_EVENT));
};

const numberFrom = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const stringFrom = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const toStoredResult = (result: UnifiedSearchResult): StoredSearchChatResult => {
  const metadata = result.metadata ?? {};
  return {
    id: result.id,
    sourceType: result.sourceType,
    sourceId: result.sourceId,
    contentType: result.contentType,
    title: result.title,
    description: truncate(result.description || '', 400),
    similarity: result.similarity,
    accessLevel: result.accessLevel,
    createdAt: result.createdAt,
    metadata: {
      total: numberFrom(metadata.total),
      amount: numberFrom(metadata.amount),
      currency: stringFrom(metadata.currency),
      date: stringFrom(metadata.date),
      merchant: stringFrom(metadata.merchant),
      parent_receipt_merchant: stringFrom(metadata.parent_receipt_merchant),
      line_item: stringFrom(metadata.line_item),
      receipt_id: stringFrom(metadata.receipt_id),
      receiptId: stringFrom(metadata.receiptId),
    },
  };
};

const toStoredMessage = (message: SearchChatMessage): StoredSearchChatMessage => ({
  id: message.id,
  role: message.role,
  content: message.content.slice(0, MAX_CONTENT_LENGTH),
  createdAt: safeIso(message.createdAt, new Date().toISOString()),
  status: message.status === 'error' ? 'error' : 'complete',
  query: message.query,
  results: message.results?.slice(0, MAX_RESULTS_PER_MESSAGE).map(toStoredResult),
  totalResults: message.totalResults,
  offset: message.offset,
  hasMore: message.hasMore,
  followUpSuggestions: message.followUpSuggestions?.slice(0, 5),
});

const toRuntimeResult = (result: StoredSearchChatResult): UnifiedSearchResult => ({
  id: result.id,
  sourceType: result.sourceType,
  sourceId: result.sourceId,
  contentType: result.contentType,
  title: result.title,
  description: result.description,
  similarity: result.similarity,
  accessLevel: result.accessLevel,
  createdAt: result.createdAt,
  metadata: result.metadata,
});

export function toSearchChatMessages(stored: StoredSearchChat): SearchChatMessage[] {
  return stored.messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt),
    status: message.status,
    query: message.query,
    results: message.results?.map(toRuntimeResult),
    totalResults: message.totalResults,
    offset: message.offset,
    hasMore: message.hasMore,
    followUpSuggestions: message.followUpSuggestions,
  }));
}

/**
 * One-time import of the legacy chat history (the previous /search page stored
 * its conversations in `paperless_chat_conversations` as localStorage too).
 * Only message text is imported; legacy result payloads are intentionally
 * dropped because their shape is not compatible with the ledger result rows.
 *
 * Migration is per user. The old unscoped history key is removed rather than
 * imported: it cannot be attributed to an account, and this data includes
 * receipts, merchants and amounts.
 */
function migrateLegacyChats(userId: string) {
  if (!isBrowser() || !userId) return;
  const migrationKey = `${LEGACY_MIGRATION_FLAG}_${userId}`;
  try {
    if (window.localStorage.getItem(migrationKey)) return;

    // Drop any history written before per-user namespacing.
    window.localStorage.removeItem(SEARCH_CHAT_STORAGE_KEY);

    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(migrationKey, '1');
      return;
    }

    const legacy: unknown = JSON.parse(raw);
    if (!Array.isArray(legacy)) {
      window.localStorage.setItem(migrationKey, '1');
      return;
    }

    const migrated: StoredSearchChat[] = [];

    legacy.forEach((entry, index: number) => {
      const conversation = (entry ?? {}) as LegacyChatConversation;
      const metadata = conversation.metadata ?? {};
      const legacyMessages = Array.isArray(conversation.messages)
        ? conversation.messages
        : [];
      const fallbackDate = safeIso(metadata.timestamp, new Date().toISOString());
      const messages: StoredSearchChatMessage[] = [];

      legacyMessages.forEach((entryMessage, messageIndex: number) => {
        const message = (entryMessage ?? {}) as LegacyChatMessage;
        const role =
          message.type === 'user'
            ? 'user'
            : message.type === 'ai' || message.type === 'assistant'
              ? 'assistant'
              : null;
        if (!role) return;

        const rawContent = typeof message.content === 'string' ? message.content : '';
        const content = rawContent
          .replace(/```(?:json)?[\s\S]*?```/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (!content) return;

        messages.push({
          id: typeof message.id === 'string' ? message.id : `legacy_msg_${index}_${messageIndex}`,
          role,
          content: content.slice(0, MAX_CONTENT_LENGTH),
          createdAt: safeIso(message.timestamp, fallbackDate),
          status: 'complete',
        });
      });

      const hasUser = messages.some((message) => message.role === 'user');
      const hasAssistant = messages.some((message) => message.role === 'assistant');
      if (!hasUser || !hasAssistant) return;

      const title =
        typeof metadata.title === 'string' && metadata.title.trim()
          ? truncate(cleanText(metadata.title), MAX_TITLE_LENGTH)
          : buildTitle(messages);

      migrated.push({
        id: `legacy_${typeof metadata.id === 'string' ? metadata.id : index}`,
        title,
        createdAt: fallbackDate,
        updatedAt: fallbackDate,
        messages,
      });
    });

    const existing = readStoredChats(userId);
    const merged = [...migrated.slice(0, MAX_MIGRATED_CONVERSATIONS), ...existing]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_CONVERSATIONS);

    writeStoredChats(userId, merged);
    window.localStorage.setItem(migrationKey, '1');
  } catch (error) {
    console.warn('Failed to migrate legacy search chats', error);
    try {
      window.localStorage.setItem(migrationKey, '1');
    } catch {
      // Ignore storage failures during migration.
    }
  }
}

export function createSearchChatId(): string {
  return createId('chat_');
}

export function listSearchChats(userId: string): SearchChatSummary[] {
  if (!userId) return [];
  migrateLegacyChats(userId);
  return readStoredChats(userId)
    .map((chat) => ({
      id: chat.id,
      title: chat.title,
      messageCount: chat.messages.length,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSearchChat(userId: string, id: string): StoredSearchChat | null {
  if (!userId) return null;
  migrateLegacyChats(userId);
  return readStoredChats(userId).find((chat) => chat.id === id) ?? null;
}

export function saveSearchChat({
  userId,
  id,
  messages,
}: {
  userId: string;
  id: string;
  messages: SearchChatMessage[];
}): void {
  if (!userId) return;
  migrateLegacyChats(userId);

  const persistable = messages.filter(
    (message) => message.status !== 'loading' && message.content.trim()
  );
  if (!persistable.some((message) => message.role === 'user')) return;

  const existing = readStoredChats(userId);
  const previous = existing.find((chat) => chat.id === id);
  const storedMessages = persistable
    .slice(-MAX_MESSAGES_PER_CONVERSATION)
    .map(toStoredMessage);
  const now = new Date().toISOString();

  const record: StoredSearchChat = {
    id,
    title: previous?.title || buildTitle(storedMessages),
    createdAt: previous?.createdAt ?? safeIso(persistable[0].createdAt, now),
    updatedAt: now,
    messages: storedMessages,
  };

  const next = [record, ...existing.filter((chat) => chat.id !== id)].slice(
    0,
    MAX_CONVERSATIONS
  );

  if (writeStoredChats(userId, next)) {
    notifyHistoryChanged();
  }
}

export function deleteSearchChat(userId: string, id: string): void {
  if (!userId) return;
  migrateLegacyChats(userId);
  const next = readStoredChats(userId).filter((chat) => chat.id !== id);
  if (writeStoredChats(userId, next)) {
    notifyHistoryChanged();
  }
}

export function clearSearchChatHistory(userId?: string): void {
  if (!isBrowser()) return;
  try {
    if (userId) {
      window.localStorage.removeItem(getSearchChatStorageKey(userId));
    }
    // Always drop the pre-namespacing key; it cannot be attributed to an account.
    window.localStorage.removeItem(SEARCH_CHAT_STORAGE_KEY);
    notifyHistoryChanged();
  } catch (error) {
    console.error('Failed to clear search chat history', error);
  }
}
