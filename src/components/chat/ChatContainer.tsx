import React, { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { WelcomeScreen } from './WelcomeScreen';
import { TypingIndicator } from './TypingIndicator';
import { ChatMessage as ChatMessageType } from './ChatMessage';

interface ChatContainerProps {
  messages: ChatMessageType[];
  isLoading?: boolean;
  onExampleClick: (example: string) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  sidebarOpen?: boolean;
}

export function ChatContainer({
  messages,
  isLoading = false,
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
            onCopy={onCopy}
            onFeedback={onFeedback}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && <TypingIndicator />}

        {/* Scroll anchor with extra spacing for fixed input */}
        <div ref={messagesEndRef} className="h-4" />
      </div>
    </div>
  );
}
