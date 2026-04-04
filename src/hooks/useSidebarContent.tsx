import { useEffect } from 'react';
import { useAppSidebar, SidebarContentType } from '@/contexts/AppSidebarContext';
import { ReactNode } from 'react';

/**
 * Hook for pages to easily inject their sidebar content into the unified sidebar system.
 * Automatically cleans up when the component unmounts.
 */
export function useSidebarContent(
  content: ReactNode,
  type: SidebarContentType = 'custom',
  dependencies: any[] = []
) {
  const { setSidebarContent, clearSidebarContent } = useAppSidebar();

  useEffect(() => {
    // Set the sidebar content when the component mounts or dependencies change
    setSidebarContent(content, type);

    // Clean up when the component unmounts or dependencies change
    return () => {
      clearSidebarContent();
    };
  }, [setSidebarContent, clearSidebarContent, content, type, ...dependencies]);
}

/**
 * Hook for pages that want to use the conversation sidebar.
 * Provides a convenient way to inject conversation sidebar with proper cleanup.
 */
export function useConversationSidebar(
  onNewChat: () => void,
  onSelectConversation: (conversationId: string) => void,
  currentConversationId?: string,
  className?: string
) {
  const { setSidebarContent, clearSidebarContent } = useAppSidebar();

  useEffect(() => {
    // Dynamically import and render the ConversationSidebarContent
    import('../components/sidebar/ConversationSidebarContent').then(({ ConversationSidebarContent }) => {
      const content = (
        <ConversationSidebarContent
          onNewChat={onNewChat}
          onSelectConversation={onSelectConversation}
          currentConversationId={currentConversationId}
          className={className}
        />
      );
      setSidebarContent(content, 'conversation');
    });

    // Clean up when the component unmounts
    return () => {
      clearSidebarContent();
    };
  }, [
    setSidebarContent,
    clearSidebarContent,
    onNewChat,
    onSelectConversation,
    currentConversationId,
    className
  ]);
}
