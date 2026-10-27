import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AISearchPage from '@/pages/AISearchPage';

const chat = vi.hoisted(() => ({
  messages: [] as Array<Record<string, unknown>>,
  conversationId: null as string | null,
  isLoading: false,
  loadingMoreId: null as string | null,
  sendMessage: vi.fn(),
  retryMessage: vi.fn(),
  loadMore: vi.fn(),
  newChat: vi.fn(),
  loadConversation: vi.fn(),
}));

const history = vi.hoisted(() => ({
  conversations: [] as Array<Record<string, unknown>>,
  deleteConversation: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/hooks/useSearchChat', () => ({
  useSearchChat: () => chat,
}));

vi.mock('@/hooks/useSearchChatHistory', () => ({
  useSearchChatHistory: () => history,
}));

vi.mock('@/components/receipts/ReceiptDetailSheet', () => ({
  ReceiptDetailSheet: () => null,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
  useDashboardTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'workspace.search.eyebrow': 'AI search',
        'workspace.search.title': 'Ask the ledger.',
        'workspace.search.lede': 'Plain-language search across merchants and amounts.',
        'workspace.search.startTitle': 'Ask the ledger anything',
        'workspace.search.startLede': 'Search receipts in plain language.',
        'workspace.search.examples': 'Try an example',
        'workspace.search.example1': 'coffee this month',
        'workspace.search.example2': 'software subscriptions',
        'workspace.search.example3': 'uber rides over 20',
        'workspace.search.example4': 'meals in october',
        'workspace.search.example5': 'groceries last week',
        'workspace.search.example6': 'parking receipts',
        'workspace.search.chat.panelTitle': 'Conversation',
        'workspace.search.chat.newChat': 'New chat',
        'workspace.search.chat.recentTitle': 'Recent chats',
        'workspace.search.chat.recentEmpty': 'No recent chats yet',
        'workspace.search.chat.untitled': 'Untitled chat',
        'workspace.search.chat.deleteChat': 'Delete chat',
        'workspace.search.chat.justNow': 'just now',
        'workspace.search.chat.messageCount': '{{count}} messages',
        'workspace.search.chat.placeholder': 'Ask about your receipts…',
        'workspace.search.chat.hint': 'Enter to send',
        'workspace.search.chat.send': 'Send',
        'workspace.search.chat.loaded': '{{loaded}} of {{total}} shown',
        'workspace.search.chat.followUps': 'Try next',
        'workspace.search.chat.typing': 'Searching…',
        'workspace.search.kinds.receipt': 'receipt',
        'workspace.search.searching': 'Searching...',
      };
      const template = translations[key] ?? key;
      return Object.entries(options ?? {}).reduce(
        (value, [name, replacement]) =>
          value.replaceAll(`{{${name}}}`, String(replacement)),
        template
      );
    },
  }),
}));

describe('AISearchPage', () => {
  beforeEach(() => {
    chat.messages = [];
    chat.conversationId = null;
    chat.isLoading = false;
    chat.loadingMoreId = null;
    chat.sendMessage.mockReset();
    chat.retryMessage.mockReset();
    chat.loadMore.mockReset();
    chat.newChat.mockReset();
    chat.loadConversation.mockReset();
    history.conversations = [];
    history.deleteConversation.mockReset();
    history.refresh.mockReset();
  });

  it('shows the welcome prompts and sends a clicked prompt', () => {
    render(
      <MemoryRouter>
        <AISearchPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Ask the ledger.' })).toBeInTheDocument();
    expect(screen.getByText('Ask the ledger anything')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'coffee this month' }));
    expect(chat.sendMessage).toHaveBeenCalledWith('coffee this month');
  });

  it('submits the composer with Enter', () => {
    render(
      <MemoryRouter>
        <AISearchPage />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Ask about your receipts…');
    fireEvent.change(input, { target: { value: 'parking receipts' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(chat.sendMessage).toHaveBeenCalledWith('parking receipts');
  });

  it('disables New chat until a conversation exists', () => {
    render(
      <MemoryRouter>
        <AISearchPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'New chat' })).toBeDisabled();
  });

  it('renders assistant answers, result rows and follow-up prompts', () => {
    chat.messages = [
      {
        id: 'user-1',
        role: 'user',
        content: 'coffee',
        createdAt: new Date(),
        status: 'complete',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'I found one coffee receipt.',
        createdAt: new Date(),
        status: 'complete',
        query: 'coffee',
        results: [
          {
            id: 'receipt-1',
            sourceType: 'receipt',
            sourceId: 'receipt-1',
            contentType: 'receipt',
            title: 'Kedai Kopi',
            description: 'Coffee',
            similarity: 0.8,
            metadata: { total: 12.5, currency: 'MYR', date: '2026-10-01' },
            accessLevel: 'user',
            createdAt: '2026-10-01T08:00:00.000Z',
          },
        ],
        totalResults: 1,
        hasMore: false,
        followUpSuggestions: ['Show me last month'],
      },
    ];

    render(
      <MemoryRouter>
        <AISearchPage />
      </MemoryRouter>
    );

    expect(screen.getByText('I found one coffee receipt.')).toBeInTheDocument();
    expect(screen.getByText('Kedai Kopi')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 shown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show me last month' })).toBeInTheDocument();
  });
});
