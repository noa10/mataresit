import React from 'react';
import { ConversationSidebar } from '../chat/ConversationSidebar';
import { useAppSidebar } from '@/contexts/AppSidebarContext';
import { useSidebarAccessibility } from '@/hooks/useSidebarAccessibility';

interface ConversationSidebarContentProps {
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
  className?: string;
}

/**
 * Conversation sidebar content wrapper for the unified sidebar system.
 * This component wraps the ConversationSidebar to work with the AppSidebarContext.
 * Used specifically for the search/chat page.
 */
export function ConversationSidebarContent({
  onNewChat,
  onSelectConversation,
  currentConversationId,
  className
}: ConversationSidebarContentProps) {
  const { isSidebarOpen, toggleSidebar, sidebarWidth } = useAppSidebar();

  // Enhanced accessibility support for conversation sidebar
  const { sidebarProps } = useSidebarAccessibility({
    sidebarId: 'conversation-sidebar',
    autoFocus: true,
    trapFocus: true,
    announceStateChanges: true
  });

  return (
    <ConversationSidebar
      isOpen={isSidebarOpen}
      onToggle={toggleSidebar}
      onNewChat={onNewChat}
      onSelectConversation={onSelectConversation}
      currentConversationId={currentConversationId}
      className={className}
      onWidthChange={() => {}} // Width is now managed by AppSidebarContext
      mainNavWidth={0} // No longer needed with unified sidebar
      mainNavOpen={false} // No longer needed with unified sidebar
    />
  );
}
