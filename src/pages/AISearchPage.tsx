import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ledger/Panel';
import { ReceiptDetailSheet } from '@/components/receipts/ReceiptDetailSheet';
import { RecentChatsMenu } from '@/components/search/chat/RecentChatsMenu';
import { SearchChatComposer } from '@/components/search/chat/SearchChatComposer';
import { SearchChatThread } from '@/components/search/chat/SearchChatThread';
import { useDashboardTranslation } from '@/contexts/LanguageContext';
import { useSearchChat } from '@/hooks/useSearchChat';
import { useSearchChatHistory } from '@/hooks/useSearchChatHistory';
import type { UnifiedSearchResult } from '@/types/unified-search';

const EXAMPLE_KEYS = [
  'workspace.search.example1',
  'workspace.search.example2',
  'workspace.search.example3',
  'workspace.search.example4',
  'workspace.search.example5',
  'workspace.search.example6',
];

export default function AISearchPage() {
  const { t } = useDashboardTranslation();
  const navigate = useNavigate();
  const {
    messages,
    conversationId,
    isLoading,
    loadingMoreId,
    sendMessage,
    retryMessage,
    loadMore,
    newChat,
    loadConversation,
  } = useSearchChat();
  const { conversations, deleteConversation } = useSearchChatHistory();

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const prompts = EXAMPLE_KEYS.map((key) => t(key)).filter(Boolean);

  const handleDeleteConversation = (id: string) => {
    if (id === conversationId) {
      newChat();
    }
    deleteConversation(id);
  };

  const openResult = (result: UnifiedSearchResult) => {
    if (result.sourceType === 'receipt') {
      const receiptId =
        (result.metadata?.receipt_id as string | undefined) ||
        (result.metadata?.receiptId as string | undefined) ||
        result.sourceId ||
        result.id;
      if (receiptId) {
        setSelectedReceiptId(receiptId);
        return;
      }
    }
    if (result.sourceType === 'claim' && result.sourceId) {
      navigate(`/claims/${result.sourceId}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header>
        <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
          {t('workspace.search.eyebrow')}
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
          {t('workspace.search.title')}
        </h1>
        <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
          {t('workspace.search.lede')}
        </p>
      </header>

      <Panel
        className="mt-7"
        title={t('workspace.search.chat.panelTitle')}
        action={
          <>
            <RecentChatsMenu
              conversations={conversations}
              currentConversationId={conversationId}
              onSelect={loadConversation}
              onDelete={handleDeleteConversation}
            />
            <Button
              type="button"
              variant="accent-outline"
              size="sm"
              onClick={newChat}
              disabled={messages.length === 0 && !isLoading}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t('workspace.search.chat.newChat')}
            </Button>
          </>
        }
        flush
      >
        <div className="flex flex-col">
          <SearchChatThread
            messages={messages}
            isLoading={isLoading}
            loadingMoreId={loadingMoreId}
            prompts={prompts}
            onSelectPrompt={(prompt) => void sendMessage(prompt)}
            onOpenResult={openResult}
            onShowMore={(messageId) => void loadMore(messageId)}
            onFollowUp={(query) => void sendMessage(query)}
            onRetry={retryMessage}
          />

          <div className="border-t border-ledger-line bg-ledger-surface p-[18px]">
            <SearchChatComposer onSend={sendMessage} isLoading={isLoading} />
          </div>
        </div>
      </Panel>

      <ReceiptDetailSheet
        receiptId={selectedReceiptId}
        onOpenChange={(open) => {
          if (!open) setSelectedReceiptId(null);
        }}
      />
    </div>
  );
}
