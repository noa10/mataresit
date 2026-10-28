import { Sparkles } from 'lucide-react';
import { useDashboardTranslation } from '@/contexts/LanguageContext';

interface SearchChatWelcomeProps {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
}

export function SearchChatWelcome({ prompts, onSelectPrompt }: SearchChatWelcomeProps) {
  const { t } = useDashboardTranslation();

  return (
    <div className="grid justify-items-center gap-4 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ledger-accent-soft text-ledger-accent">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </div>

      <div>
        <h2 className="text-base font-semibold text-ledger-ink">
          {t('workspace.search.startTitle')}
        </h2>
        <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-ledger-muted">
          {t('workspace.search.startLede')}
        </p>
      </div>

      <div
        className="mt-1 flex flex-wrap justify-center gap-2"
        aria-label={t('workspace.search.examples')}
      >
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="rounded-full border border-ledger-line bg-ledger-surface px-3 py-1.5 text-xs text-ledger-ink-2 transition-colors hover:border-ledger-line-strong hover:bg-ledger-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/30"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
