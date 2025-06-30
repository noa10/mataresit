import React, { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { WelcomeScreen } from './WelcomeScreen';
import { TypingIndicator } from './TypingIndicator';
import { StatusIndicator, StatusUpdate } from './StatusIndicator';
import { ChatMessage as ChatMessageType } from './ChatMessage';

interface ChatContainerProps {
  messages: ChatMessageType[];
  isLoading?: boolean;
  status?: StatusUpdate;
  conversationId?: string;
  onExampleClick: (example: string) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  sidebarOpen?: boolean;
}

export function ChatContainer({
  messages,
  isLoading = false,
  status,
  conversationId,
  onExampleClick,
  onCopy,
  onFeedback,
  sidebarOpen = false
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current && containerRef.current) {
      const container = containerRef.current;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;

      // Only auto-scroll if user is near the bottom or if it's a new conversation
      if (isNearBottom || messages.length <= 2) {
        // Use a slight delay to ensure DOM updates are complete
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'end'
          });
        }, 100);
      }
    }
  }, [messages, isLoading]);

  // Show welcome screen if no messages
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 overflow-y-auto pt-8 pb-32 space-y-4">
        <WelcomeScreen onExampleClick={onExampleClick} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto pt-8 pb-32 space-y-4"
    >
      <div className="w-full">
        {/* Render all messages */}
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            conversationId={conversationId}
            onCopy={onCopy}
            onFeedback={onFeedback}
          />
        ))}

        {/* Status indicator for real-time feedback */}
        {status && status.stage !== 'idle' && status.stage !== 'complete' && (
          <div className="px-4 py-2">
            <StatusIndicator status={status} compact={true} />
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && <TypingIndicator />}

        {/* Scroll anchor with extra spacing for fixed input */}
        <div ref={messagesEndRef} className="h-4" />
      </div>
    </div>
  );
}
