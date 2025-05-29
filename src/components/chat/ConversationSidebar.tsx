import React, { useState } from 'react';
import {
  Menu,
  X,
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import {
  ConversationMetadata,
  groupConversationsByTime,
  formatRelativeTime
} from '../../lib/conversation-history';
import { useConversationHistory } from '../../hooks/useConversationHistory';

interface ConversationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
  className?: string;
}

export function ConversationSidebar({
  isOpen,
  onToggle,
  onNewChat,
  onSelectConversation,
  currentConversationId,
  className
}: ConversationSidebarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  // Use the conversation history hook for real-time updates
  const {
    conversations,
    isLoading,
    error,
    isInitialized,
    deleteConversation: deleteConversationFromHook,
    refreshConversations
  } = useConversationHistory();



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
    // On mobile, close sidebar after creating new chat
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    onSelectConversation(conversationId);
    // On mobile, close sidebar after selecting conversation
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  // Group conversations by time
  const groupedConversations = groupConversationsByTime(conversations);
  const timeGroups = ['Today', 'Yesterday', 'This week', 'Earlier', 'Older'];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full bg-background border-r border-border z-50 transform transition-transform duration-300 ease-in-out",
          "w-[280px] lg:w-[280px]", // 280px width as specified
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:transform-none lg:transition-none",
          className
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Chat History</h2>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshConversations}
              disabled={isLoading}
              className="flex items-center space-x-1"
              title="Refresh conversations"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className="flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="lg:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
          <div className="p-2">
            {error ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm text-destructive">Error loading conversations</p>
                <p className="text-xs mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshConversations}
                  className="mt-3"
                >
                  Try Again
                </Button>
              </div>
            ) : isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-50 animate-spin" />
                <p className="text-sm">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              timeGroups.map(timeGroup => {
                const groupConversations = groupedConversations[timeGroup];
                if (!groupConversations || groupConversations.length === 0) {
                  return null;
                }

                return (
                  <div key={timeGroup} className="mb-4">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 mb-2">
                      {timeGroup}
                    </h3>
                    <div className="space-y-1">
                      {groupConversations.map((conversation) => (
                        <ConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          isActive={conversation.id === currentConversationId}
                          onSelect={() => handleSelectConversation(conversation.id)}
                          onDelete={() => handleDeleteConversation(conversation.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
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
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ConversationItemProps {
  conversation: ConversationMetadata;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex items-center p-3 rounded-lg cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isActive && "bg-muted border border-border"
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium truncate pr-2">
            {conversation.title}
          </h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(conversation.timestamp)}
          </span>
        </div>
        {conversation.lastMessage && (
          <p className="text-xs text-muted-foreground truncate">
            {conversation.lastMessage}
          </p>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* More Options Menu */}
      <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 ml-2"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(true);
            }}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setShowMenu(false);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
