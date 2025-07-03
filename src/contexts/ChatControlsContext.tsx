import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatControls {
  sidebarToggle?: React.ReactNode;
  onNewChat?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  currentConversationId?: string;
  showChatTitle?: boolean;
}

interface ChatControlsContextType {
  chatControls: ChatControls | null;
  setChatControls: (controls: ChatControls | null) => void;
}

const ChatControlsContext = createContext<ChatControlsContextType | undefined>(undefined);

export function ChatControlsProvider({ children }: { children: ReactNode }) {
  const [chatControls, setChatControls] = useState<ChatControls | null>(null);

  return (
    <ChatControlsContext.Provider value={{ chatControls, setChatControls }}>
      {children}
    </ChatControlsContext.Provider>
  );
}

export function useChatControls() {
  const context = useContext(ChatControlsContext);
  if (context === undefined) {
    throw new Error('useChatControls must be used within a ChatControlsProvider');
  }
  return context;
}
