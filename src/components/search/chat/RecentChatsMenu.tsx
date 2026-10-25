import { useState } from 'react';
import { History, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useDashboardTranslation, useLanguage } from '@/contexts/LanguageContext';
import type { SearchChatSummary } from '@/lib/search-chat/history';

interface RecentChatsMenuProps {
  conversations: SearchChatSummary[];
  currentConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const formatWhen = (iso: string, language: string, justNow: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const locale = language === 'ms' ? 'ms-MY' : 'en-MY';

  if (diff < 60_000) return justNow;

  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diff < 3_600_000) return relative.format(-Math.round(diff / 60_000), 'minute');
  if (diff < 86_400_000) return relative.format(-Math.round(diff / 3_600_000), 'hour');
  if (diff < 604_800_000) return relative.format(-Math.round(diff / 86_400_000), 'day');

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
};

export function RecentChatsMenu({
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
}: RecentChatsMenuProps) {
  const { t } = useDashboardTranslation();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="accent-outline"
          size="sm"
          aria-label={t('workspace.search.chat.recentTitle')}
        >
          <History className="h-3.5 w-3.5 sm:mr-1.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {t('workspace.search.chat.recentTitle')}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[20rem] p-0" sideOffset={6}>
        <div className="border-b border-ledger-line px-3 py-2.5">
          <p className="text-sm font-semibold text-ledger-ink">
            {t('workspace.search.chat.recentTitle')}
          </p>
        </div>

        {conversations.length === 0 ? (
          <div className="grid justify-items-center gap-1.5 px-4 py-7 text-center">
            <MessageSquare className="h-5 w-5 text-ledger-line-strong" aria-hidden="true" />
            <p className="text-xs text-ledger-muted">
              {t('workspace.search.chat.recentEmpty')}
            </p>
          </div>
        ) : (
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {conversations.map((chat) => {
              const isCurrent = chat.id === currentConversationId;
              return (
                <li key={chat.id} className="flex items-center gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(chat.id);
                      setOpen(false);
                    }}
                    className={`min-w-0 flex-1 rounded-[6px] px-2 py-2 text-left transition-colors hover:bg-ledger-surface-2 focus-visible:bg-ledger-surface-2 focus-visible:outline-none ${
                      isCurrent ? 'bg-ledger-accent-soft' : ''
                    }`}
                  >
                    <span className="block truncate text-[0.8125rem] font-medium text-ledger-ink">
                      {chat.title || t('workspace.search.chat.untitled')}
                    </span>
                    <span className="mt-0.5 block text-[0.6875rem] text-ledger-muted">
                      {formatWhen(
                        chat.updatedAt,
                        language,
                        t('workspace.search.chat.justNow')
                      )}
                      {' · '}
                      {t('workspace.search.chat.messageCount', {
                        count: chat.messageCount,
                      })}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDeleteId(chat.id);
                    }}
                    aria-label={t('workspace.search.chat.deleteChat')}
                    title={t('workspace.search.chat.deleteChat')}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-ledger-muted transition-colors hover:bg-ledger-surface-2 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>

    <AlertDialog
      open={Boolean(pendingDeleteId)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setPendingDeleteId(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('workspace.search.chat.deleteChatTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('workspace.search.chat.deleteChatDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('workspace.search.chat.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (pendingDeleteId) onDelete(pendingDeleteId);
              setPendingDeleteId(null);
            }}
          >
            {t('workspace.search.chat.deleteChat')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
