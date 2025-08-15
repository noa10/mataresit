import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Menu,
  X,
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  MoreVertical,
  RefreshCw,
  Search,
  Filter,
  SortAsc,
  Download,
  Upload,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { cn } from '../../lib/utils';
import {
  ConversationMetadata,
  groupConversationsByTime,
  formatRelativeTime,
  searchConversations,
  filterConversationsByTime,
  sortConversations,
  getConversationStats,
  exportConversations,
  importConversations
} from '../../lib/conversation-history';
import { useConversationHistory } from '../../hooks/useConversationHistory';
import { BackgroundSearchIndicator } from '../search/BackgroundSearchIndicator';

interface ConversationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
  className?: string;
  onWidthChange?: (width: number) => void;
  mainNavWidth?: number;
  mainNavOpen?: boolean;
}

export function ConversationSidebar({
  isOpen,
  onToggle,
  onNewChat,
  onSelectConversation,
  currentConversationId,
  className,
  onWidthChange,
  mainNavWidth = 0,
  mainNavOpen = false
}: ConversationSidebarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'title' | 'messageCount'>('recent');
  const [showStats, setShowStats] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Use the conversation history hook for real-time updates
  const {
    conversations,
    isLoading,
    error,
    isInitialized,
    deleteConversation: deleteConversationFromHook,
    refreshConversations
  } = useConversationHistory();

  // Memoized filtered and sorted conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = searchConversations(filtered, searchQuery);
    }

    // Apply time filter
    if (timeFilter !== 'all') {
      filtered = filterConversationsByTime(filtered, timeFilter);
    }

    // Apply sorting
    filtered = sortConversations(filtered, sortBy);

    return filtered;
  }, [conversations, searchQuery, timeFilter, sortBy]);

  // Conversation statistics
  const stats = useMemo(() => {
    return getConversationStats(conversations);
  }, [conversations]);

  // Toggle group collapse
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }, []);



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

  // Export conversations
  const handleExport = useCallback(() => {
    try {
      const data = exportConversations();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-conversations-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting conversations:', error);
    }
  }, []);

  // Import conversations
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result as string;
            const success = importConversations(data);
            if (success) {
              refreshConversations();
            } else {
              console.error('Failed to import conversations');
            }
          } catch (error) {
            console.error('Error importing conversations:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [refreshConversations]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setTimeFilter('all');
    setSortBy('recent');
  }, []);

  // Resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(240, Math.min(400, startWidth + (e.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('chat-sidebar-width', sidebarWidth.toString());
      onWidthChange?.(sidebarWidth);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  // Track desktop state and load saved sidebar width
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener('resize', checkDesktop);

    const savedWidth = localStorage.getItem('chat-sidebar-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      setSidebarWidth(width);
      onWidthChange?.(width);
    } else {
      onWidthChange?.(280); // Default width
    }

    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Enhanced mobile gesture handling
  useEffect(() => {
    if (!isOpen || isDesktop) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) {
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = Math.abs(e.touches[0].clientY - startY);

        // Only start dragging if horizontal movement is greater than vertical
        if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 10) {
          isDragging = true;
        }
      }

      if (isDragging && e.touches[0].clientX - startX < -50) {
        onToggle();
      }
    };

    const handleTouchEnd = () => {
      isDragging = false;
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onToggle, isDesktop]);

  // Group conversations by time
  const groupedConversations = groupConversationsByTime(filteredConversations);
  const timeGroups = ['Today', 'Yesterday', 'This week', 'Earlier', 'Older'];

  return (
    <>
      {/* Enhanced Mobile Overlay with better animations */}
      {isOpen && !isDesktop && (
        <div
          className={cn(
            "fixed inset-0 bg-black/50 z-40",
            "animate-in fade-in duration-300",
            "backdrop-blur-sm"
          )}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onToggle();
            }
          }}
          tabIndex={-1}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Enhanced Sidebar with improved animations */}
      <div
        id="conversation-sidebar"
        className={cn(
          "h-full bg-background border-r border-border",
          "transition-all duration-300 ease-in-out",
          // Mobile behavior: fixed positioning with transform
          !isDesktop && [
            "fixed top-0 z-50 shadow-lg",
            isOpen ? "translate-x-0" : "-translate-x-full"
          ],
          // Desktop behavior: fixed positioning to account for main nav
          isDesktop && [
            "fixed top-0 z-50 flex-shrink-0",
            isOpen ? "translate-x-0" : "-translate-x-full"
          ],
          // Enhanced focus management
          "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 lg:focus-within:ring-0",
          // Resizing state
          isResizing && "select-none",
          className
        )}
        style={{
          width: isDesktop ? `${sidebarWidth}px` : '280px',
          // Align with main sidebar CSS variable to avoid gaps
          left: isDesktop ? 'var(--sidebar-width, var(--nav-width))' : '0px',
          height: '100vh'
        }}
        role="complementary"
        aria-label="Chat history sidebar"
        tabIndex={-1}
      >
        {/* Sidebar Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          {/* Title and Actions */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold">Chat History</h2>
              {stats.total > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats.total}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" title="More options">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowStats(!showStats)}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    {showStats ? 'Hide' : 'Show'} Stats
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Conversations
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleImport}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Conversations
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshConversations}
                disabled={isLoading}
                title="Refresh conversations"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="lg:hidden"
                title="Close sidebar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="px-4 pb-4 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-8 text-sm"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex items-center space-x-2">
              {/* Time Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    {timeFilter === 'all' ? 'All' : timeFilter === 'today' ? 'Today' : timeFilter === 'week' ? 'Week' : timeFilter === 'month' ? 'Month' : 'Yesterday'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Filter by time</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={timeFilter} onValueChange={setTimeFilter}>
                    <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="yesterday">Yesterday</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="week">This week</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="month">This month</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <SortAsc className="h-3 w-3 mr-1" />
                    {sortBy === 'recent' ? 'Recent' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'title' ? 'Title' : 'Messages'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                    <DropdownMenuRadioItem value="recent">Most recent</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="title">Title A-Z</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="messageCount">Message count</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Clear Filters */}
              {(searchQuery || timeFilter !== 'all' || sortBy !== 'recent') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="h-7 text-xs"
                  title="Clear all filters"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Statistics */}
            {showStats && stats.total > 0 && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Statistics</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <span className="ml-1 font-medium">{stats.total}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Today:</span>
                    <span className="ml-1 font-medium">{stats.today}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">This week:</span>
                    <span className="ml-1 font-medium">{stats.thisWeek}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Messages:</span>
                    <span className="ml-1 font-medium">{stats.totalMessages}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1 h-[calc(100vh-200px)]">
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
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                {searchQuery || timeFilter !== 'all' ? (
                  <>
                    <p className="text-sm">No conversations found</p>
                    <p className="text-xs mt-1">Try adjusting your search or filters</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSearch}
                      className="mt-3"
                    >
                      Clear Filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm">No conversations yet</p>
                    <p className="text-xs mt-1">Start a new chat to begin</p>
                  </>
                )}
              </div>
            ) : (
              timeGroups.map(timeGroup => {
                const groupConversations = groupedConversations[timeGroup];
                if (!groupConversations || groupConversations.length === 0) {
                  return null;
                }

                const isCollapsed = collapsedGroups.has(timeGroup);

                return (
                  <div key={timeGroup} className="mb-4">
                    <Collapsible open={!isCollapsed} onOpenChange={() => toggleGroupCollapse(timeGroup)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between h-auto p-2 hover:bg-muted/50"
                        >
                          <div className="flex items-center space-x-2">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              {timeGroup}
                            </h3>
                            <Badge variant="secondary" className="text-xs h-4 px-1.5">
                              {groupConversations.length}
                            </Badge>
                          </div>
                          <ChevronDown className={cn(
                            "h-3 w-3 text-muted-foreground transition-transform",
                            isCollapsed && "rotate-180"
                          )} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-1 mt-1">
                        {groupConversations.map((conversation) => (
                          <ConversationItem
                            key={conversation.id}
                            conversation={conversation}
                            isActive={conversation.id === currentConversationId}
                            onSelect={() => handleSelectConversation(conversation.id)}
                            onDelete={() => handleDeleteConversation(conversation.id)}
                          />
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Resize Handle - Desktop only */}
        <div
          className={cn(
            "absolute top-0 right-0 w-1 h-full cursor-col-resize hidden lg:block",
            "hover:bg-primary/20 transition-colors duration-200",
            "group/resize",
            isResizing && "bg-primary/30"
          )}
          onMouseDown={handleResizeStart}
          title="Drag to resize sidebar"
        >
          <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 w-3 h-8 bg-border rounded-full opacity-0 group-hover/resize:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <div className="w-0.5 h-4 bg-muted-foreground rounded-full"></div>
          </div>
        </div>
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

const ConversationItem = React.memo(function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
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
          {/* Search status indicator */}
          {conversation.hasSearchResults && (
            <BackgroundSearchIndicator
              conversationId={conversation.id}
              variant="compact"
            />
          )}
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
});
