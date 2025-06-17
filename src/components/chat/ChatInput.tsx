import React, { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { useChatTranslation } from '@/contexts/LanguageContext';

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  onSendMessage,
  isLoading = false,
  placeholder,
  disabled = false
}: ChatInputProps) {
  const { t } = useChatTranslation();
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use translated placeholder if none provided
  const inputPlaceholder = placeholder || t('input.placeholder');

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      toast.error(t('input.validation.empty'));
      return;
    }

    if (isLoading) {
      return;
    }

    try {
      await onSendMessage(trimmedMessage);
      setMessage('');

      // Reset textarea height and maintain focus
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        // Keep focus on the input for better UX
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('input.validation.failed'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleStop = () => {
    // This would be used to stop AI generation if implemented
    console.log('Stop generation requested');
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative flex items-end space-x-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            disabled={disabled || isLoading}
            className="min-h-[44px] max-h-[120px] resize-none pr-12 py-3 text-sm leading-relaxed"
            rows={1}
          />

          {/* Send/Stop button inside textarea */}
          <div className="absolute right-2 bottom-2">
            {isLoading ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleStop}
                className="h-8 w-8 p-0 hover:bg-destructive/10"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={!message.trim() || disabled}
                className="h-8 w-8 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Helper text */}
      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
        <span>{t('input.helper.shortcuts')}</span>
        <span>{message.length}/2000</span>
      </div>
    </form>
  );
}
