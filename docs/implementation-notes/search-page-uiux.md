# Refactoring the Search Page for Improved UI/UX

### High-Level Plan

We will create a shared context that manages the state and content of the main application sidebar. The `SemanticSearchPage` will then use this context to dynamically "inject" the `ConversationSidebar` into the main sidebar area when the user is on that page.

This approach will:
1.  **Eliminate the double sidebar.**
2.  **Create a single, consistent sidebar** whose content changes based on the current route.
3.  **Decouple the layout from the page content**, making the system more modular and scalable.

---

### Step-by-Step Implementation Guide

#### 1. Create a New Shared Context for the Sidebar

First, let's create a new context to manage the sidebar's state and content. This will be our single source of truth.

**Create a new file: `src/contexts/AppSidebarContext.tsx`**

```tsx
// src/contexts/AppSidebarContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppSidebarContextType {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  sidebarContent: ReactNode;
  setSidebarContent: (content: ReactNode) => void;
}

const AppSidebarContext = createContext<AppSidebarContextType | undefined>(undefined);

export function AppSidebarProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open on desktop
  const [sidebarContent, setSidebarContent] = useState<ReactNode>(null);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  return (
    <AppSidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, sidebarContent, setSidebarContent }}>
      {children}
    </AppSidebarContext.Provider>
  );
}

export function useAppSidebar() {
  const context = useContext(AppSidebarContext);
  if (!context) {
    throw new Error('useAppSidebar must be used within an AppSidebarProvider');
  }
  return context;
}
```

#### 2. Integrate the Context into `AppLayout.tsx`

Next, we'll modify `AppLayout.tsx` to use this new context. It will become the owner of the sidebar's state and will render either the default navigation or the dynamic content provided by a page.

**Update `src/components/AppLayout.tsx`**

We'll wrap the `AppLayout` with our new `AppSidebarProvider` and make the sidebar's content dynamic.

```tsx
// src/components/AppLayout.tsx
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { MainNavigationSidebar } from "./MainNavigationSidebar";
import { MainNavigationToggle } from "./MainNavigationToggle";
import { useChatControls } from "@/contexts/ChatControlsContext";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext"; // Import the provider and hook

function AppLayoutContent() {
  const { isSidebarOpen, toggleSidebar, sidebarContent } = useAppSidebar();
  const { chatControls } = useChatControls();

  return (
    <div className="flex min-h-screen bg-background">
      {/* The Sidebar is now dynamic */}
      <div className="flex-shrink-0">
        {sidebarContent ? (
          sidebarContent // Render content from context if it exists
        ) : (
          // Otherwise, render the default main navigation
          <MainNavigationSidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          navControls={{
            navSidebarToggle: (
              <MainNavigationToggle isOpen={isSidebarOpen} onToggle={toggleSidebar} />
            )
          }}
          chatControls={chatControls}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <AppSidebarProvider>
      <AppLayoutContent />
    </AppSidebarProvider>
  );
}
```
*I have removed the `useMainNav` context since this new `AppSidebarContext` will now be the single source of truth for the sidebar state, simplifying the architecture.*

#### 3. Refactor `SemanticSearchPage.tsx` to Use the Context

Now, the `SemanticSearchPage` will no longer render its own sidebar. Instead, it will use the `useAppSidebar` hook to set its content into the main layout's sidebar.

**Update `src/pages/SemanticSearch.tsx`**

```tsx
// src/pages/SemanticSearch.tsx

// ... other imports
import { useAppSidebar } from '@/contexts/AppSidebarContext'; // Import the new hook
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import { SidebarToggle } from '../components/chat/SidebarToggle';

// ... (keep most of the existing code)

export default function SemanticSearchPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // ... other states remain the same

  // --- REMOVE all local sidebar state management ---
  // const [sidebarOpen, setSidebarOpen] = useState(false);
  // const [isDesktop, setIsDesktop] = useState(false);
  // const [sidebarWidth, setSidebarWidth] = useState(280);

  const { isSidebarOpen, toggleSidebar, setSidebarContent } = useAppSidebar();
  const { setChatControls } = useChatControls();

  // ... (keep conversation logic like saveCurrentConversation, loadConversation, etc.)

  // Use the context to toggle the sidebar
  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  // Inject the ConversationSidebar into the AppLayout's sidebar
  useEffect(() => {
    // When this page mounts, set the sidebar content to be the ConversationSidebar
    setSidebarContent(
      <ConversationSidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        currentConversationId={currentConversationId}
        // No need for width management here anymore, AppLayout handles it.
      />
    );

    // When the component unmounts, clean up by setting the content back to null.
    // This will make the AppLayout render the default MainNavigationSidebar again.
    return () => {
      setSidebarContent(null);
    };
  }, [
    setSidebarContent,
    isSidebarOpen,
    toggleSidebar,
    handleNewChat,
    handleSelectConversation,
    currentConversationId
  ]);
  
  // Update chat controls for the Navbar
  useEffect(() => {
    setChatControls({
      // The toggle button in the navbar will now control the main sidebar
      sidebarToggle: (
        <SidebarToggle isOpen={isSidebarOpen} onToggle={toggleSidebar} showKeyboardHint />
      ),
      onNewChat: handleNewChat,
      showChatTitle: true,
    });

    return () => {
      setChatControls(null);
    };
  }, [isSidebarOpen, toggleSidebar, handleNewChat, setChatControls]);

  // The rest of the component remains largely the same, but you can remove
  // all direct rendering of the ConversationSidebar.

  return (
    <div className="min-h-screen bg-background flex">
      <Helmet>
        <title>AI Chat - ReceiptScan</title>
      </Helmet>
      
      {/* 
        NO SIDEBAR IS RENDERED HERE ANYMORE. 
        It's now handled by AppLayout.
      */}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-300 ease-in-out">
        {/* Chat Content Area */}
        <div className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ...`}>
           <ChatContainer
                messages={messages}
                isLoading={isLoading}
                onExampleClick={handleExampleClick}
                onCopy={handleCopy}
                onFeedback={handleFeedback}
                sidebarOpen={isSidebarOpen} // Pass down the sidebar state
              />
        </div>

        {/* Fixed Chat Input (You might need to adjust its `left` style based on the sidebar state) */}
        <div className="fixed bottom-0 right-0 z-40 ...">
          {/* ... */}
        </div>
      </div>
    </div>
  );
}
```

#### 4. Final Adjustments

1.  **Remove `useMainNav`**: Since `AppSidebarContext` now handles the sidebar's open/close state and width, you can remove the `MainNavContext` and the `useMainNav` hook from `AppLayout.tsx` to simplify the code.

2.  **Adjust `ConversationSidebar`**: The `ConversationSidebar` component might have some internal logic tied to its `isOpen` prop that was previously managed locally. You may need to simplify it to be a more "presentational" component, as its visibility is now fully controlled by `AppLayout`. The `onToggle` prop will now correctly control the main application sidebar.

3.  **Styling**: You will likely need to adjust the `margin-left` or `padding-left` on your main content area in `SemanticSearchPage` to account for the main application sidebar being open. The `AppLayout` can provide the sidebar width via the context if needed, so child pages can adapt their layouts accordingly.

    *Update `AppSidebarContext.tsx` and `AppLayout.tsx` to include width management for a complete solution.*

---

### Benefits of This Refactor

*   **Improved UX**: A single, consistent sidebar provides a much more professional and intuitive user experience.
*   **Single Source of Truth**: The sidebar's state (`isOpen`, `content`) is managed in one place (`AppSidebarContext`), preventing bugs and simplifying state management.
*   **Reusability & Scalability**: This pattern is highly scalable. If another page needs to use the sidebar for its own content (e.g., a "Details" panel on another page), it can simply use the `setSidebarContent` function from the context.
*   **Decoupled Components**: `SemanticSearchPage` no longer needs to know *how* the sidebar is rendered; it only needs to provide the content for it. This makes your components cleaner and more focused on their specific responsibilities.