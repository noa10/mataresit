import React, { useState, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  RefreshCw,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { cn } from '../../lib/utils';
import {
  ConversationMetadata,
  formatRelativeTime,
  sortConversations
} from '../../lib/conversation-history';
import { useConversationHistory } from '../../hooks/useConversationHistory';

interface CompactChatHistoryProps {
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
  maxItems?: number; // Default: 10
  showSearch?: boolean; // Default: false
  className?: string;
  maxHeight?: string; // Optional max height constraint for the scroll area
}

/**
 * Compact chat history component designed for integration within the main navigation sidebar.
 * Provides essential conversation functionality without overwhelming the navigation context.
 */
export function CompactChatHistory({
  onNewChat,
  onSelectConversation,
  currentConversationId,
  maxItems = 10,
  showSearch = false,
  className,
  maxHeight
}: CompactChatHistoryProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  // Use the conversation history hook for real-time updates
  const {
    conversations,
    isLoading,
    error,
    deleteConversation: deleteConversationFromHook,
    refreshConversations
  } = useConversationHistory();

  // Get recent conversations (sorted by most recent, limited to maxItems)
  const recentConversations = useMemo(() => {
    const sorted = sortConversations(conversations, 'recent');
    return sorted.slice(0, maxItems);
  }, [conversations, maxItems]);

  const handleDeleteConversation = (conversationId: string) => {
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (conversationToDelete) {
      deleteConversationFromHook(conversationToDelete);

      // If we're deleting the current conversation, start a new chat
      if (conversationToDelete === currentConversationId) {
        onNewChat();
      }
    }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const handleNewChat = () => {
    onNewChat();
  };

  const handleSelectConversation = (conversationId: string) => {
    onSelectConversation(conversationId);
  };

  return (
    <>
      <div className={cn("flex flex-col min-h-0 h-full", className)}>
        {/* Mini Header - Consistent with main navigation styling */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Chats</span>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshConversations}
              disabled={isLoading}
              title="Refresh conversations"
              className="h-7 w-7 p-0 hover:bg-secondary/50 transition-colors"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              title="New chat"
              className="h-7 w-7 p-0 hover:bg-secondary/50 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Conversation List - Enhanced styling and spacing with proper height management */}
        <ScrollArea
          className={cn("flex-1 min-h-0", maxHeight && `max-h-[${maxHeight}]`)}
          role="region"
          aria-label="Recent conversations"
          style={{
            maxHeight: maxHeight ? maxHeight : undefined,
            WebkitOverflowScrolling: 'touch', // iOS smooth scrolling
            overscrollBehavior: 'contain' // Prevent scroll chaining
          }}
        >
          <div className="p-3 space-y-1">
            {error ? (
              <div className="text-center py-6 text-muted-foreground animate-in fade-in duration-300">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-destructive font-medium">Error loading conversations</p>
                <p className="text-xs mt-1 mb-3">Please try again</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshConversations}
                  className="h-7 text-xs hover:bg-secondary/50 transition-colors"
                >
                  Try Again
                </Button>
              </div>
            ) : isLoading ? (
              <div className="text-center py-6 text-muted-foreground animate-in fade-in duration-300">
                <RefreshCw className="h-6 w-6 mx-auto mb-2 opacity-50 animate-spin" />
                <p className="text-sm">Loading conversations...</p>
              </div>
            ) : recentConversations.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground animate-in fade-in duration-300">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs mt-1 text-muted-foreground/80">Start a new chat to begin</p>
              </div>
            ) : (
              <div
                className="space-y-1 animate-in fade-in duration-300"
                role="list"
                aria-label="Conversation list"
              >
                {recentConversations.map((conversation, index) => (
                  <CompactConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === currentConversationId}
                    onSelect={() => handleSelectConversation(conversation.id)}
                    onDelete={() => handleDeleteConversation(conversation.id)}
                    tabIndex={index === 0 ? 0 : -1} // Only first item is tabbable initially
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface CompactConversationItemProps {
  conversation: ConversationMetadata;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  tabIndex?: number;
}

/**
 * Compact conversation item optimized for 280px width constraint.
 * Single-line layout with truncated text and minimal height.
 */
const CompactConversationItem = React.memo(function CompactConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  tabIndex = 0
}: CompactConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex items-center px-3 py-2 rounded-md cursor-pointer transition-all duration-200",
        "hover:bg-secondary/50 hover:shadow-sm focus-within:ring-2 focus-within:ring-primary/20",
        isActive && "bg-secondary/70 text-primary font-semibold border border-border/50 shadow-sm"
      )}
      onClick={onSelect}
      role="listitem"
      tabIndex={tabIndex}
      aria-label={`Select conversation: ${conversation.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex-1 min-w-0">
        {/* Single line with title and timestamp - Enhanced typography */}
        <div className="flex items-center justify-between mb-1">
          <h4 className={cn(
            "text-sm truncate pr-2 transition-colors",
            isActive ? "font-semibold text-primary" : "font-medium text-foreground"
          )}>
            {conversation.title}
          </h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(conversation.timestamp)}
          </span>
        </div>

        {/* Optional second line for last message preview (compact) */}
        {conversation.lastMessage && (
          <p className="text-xs text-muted-foreground/80 truncate leading-relaxed">
            {conversation.lastMessage}
          </p>
        )}
      </div>

      {/* More Options Menu - Enhanced styling */}
      <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "opacity-0 group-hover:opacity-100 h-6 w-6 p-0 ml-2 transition-all duration-200",
              "hover:bg-secondary/70 hover:scale-105",
              showMenu && "opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(true);
            }}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setShowMenu(false);
            }}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
