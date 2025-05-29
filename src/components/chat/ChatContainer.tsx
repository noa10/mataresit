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
}

export function ChatContainer({ 
  messages, 
  isLoading = false, 
  onExampleClick,
  onCopy,
  onFeedback 
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Show welcome screen if no messages
  if (messages.length === 0 && !isLoading) {
    return <WelcomeScreen onExampleClick={onExampleClick} />;
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
    >
      <div className="max-w-4xl mx-auto">
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

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
