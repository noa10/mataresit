import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardTranslation } from '@/contexts/LanguageContext';

interface SearchChatComposerProps {
  onSend: (query: string) => Promise<void>;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function SearchChatComposer({
  onSend,
  onStop,
  isLoading = false,
  disabled = false,
}: SearchChatComposerProps) {
  const { t } = useDashboardTranslation();
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasLoadingRef = useRef(false);

  const isDisabled = disabled || isLoading;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [message]);

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      textareaRef.current?.focus();
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  const submit = () => {
    const query = message.trim();
    if (!query || isDisabled) return;

    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    void onSend(query);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="search-chat-input">
          {t('workspace.search.chat.placeholder')}
        </label>
        <textarea
          ref={textareaRef}
          id="search-chat-input"
          name="chat-input"
          rows={1}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('workspace.search.chat.placeholder')}
          disabled={isDisabled}
          className="max-h-[140px] min-h-[54px] flex-1 resize-none rounded-[8px] border border-ledger-line-strong bg-ledger-surface px-4 py-3 text-[0.9375rem] leading-relaxed text-ledger-ink placeholder:text-ledger-muted/80 focus:border-ledger-accent focus:outline-none focus:ring-[3px] focus:ring-ledger-accent/15 disabled:opacity-60"
        />
        {isLoading ? (
          <Button
            type="button"
            variant="accent-outline"
            size="app"
            className="h-[54px] px-5"
            onClick={onStop}
          >
            <Square className="h-4 w-4" aria-hidden="true" />
            <span className="ml-2 hidden sm:inline">
              {t('workspace.search.chat.stop')}
            </span>
          </Button>
        ) : (
          <Button
            type="submit"
            variant="accent"
            size="app"
            className="h-[54px] px-5"
            disabled={isDisabled || !message.trim()}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span className="ml-2 hidden sm:inline">{t('workspace.search.chat.send')}</span>
          </Button>
        )}
      </div>
      <p className="font-data text-[0.6875rem] tracking-[0.02em] text-ledger-muted">
        {t('workspace.search.chat.hint')}
      </p>
    </form>
  );
}
