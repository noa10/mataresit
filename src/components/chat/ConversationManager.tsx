/**
 * Conversation Manager Component
 * 
 * Provides comprehensive conversation management including
 * rename, archive, delete, and organization features.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal,
  Edit3,
  Archive,
  ArchiveRestore,
  Trash2,
  Star,
  StarOff,
  MessageSquare,
  Calendar,
  Search,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  title: string;
  is_archived: boolean;
  is_favorite: boolean;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

interface ConversationManagerProps {
  currentConversationId?: string;
  onConversationSelect?: (conversationId: string) => void;
  onConversationUpdate?: () => void;
  className?: string;
}

type SortOption = 'recent' | 'oldest' | 'title' | 'messages';
type FilterOption = 'all' | 'favorites' | 'archived';

export function ConversationManager({
  currentConversationId,
  onConversationSelect,
  onConversationUpdate,
  className = ''
}: ConversationManagerProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load conversations on mount and when user changes
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, filterBy]);

  /**
   * Load conversations from database
   */
  const loadConversations = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('get_user_conversations', {
        p_include_archived: filterBy === 'archived' || filterBy === 'all',
        p_limit: 100,
        p_offset: 0
      });

      if (error) {
        throw error;
      }

      let filteredData = data || [];

      // Apply additional filtering
      if (filterBy === 'favorites') {
        filteredData = filteredData.filter(conv => conv.is_favorite);
      } else if (filterBy === 'archived') {
        filteredData = filteredData.filter(conv => conv.is_archived);
      } else if (filterBy === 'all') {
        // Show all conversations
      }

      setConversations(filteredData);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Filter and sort conversations
   */
  const getFilteredAndSortedConversations = () => {
    let filtered = conversations;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => 
        conv.title.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'messages':
          return b.message_count - a.message_count;
        default:
          return 0;
      }
    });

    return filtered;
  };

  /**
   * Handle conversation rename
   */
  const handleRename = async () => {
    if (!selectedConversation || !newTitle.trim()) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('rename_conversation', {
        p_conversation_id: selectedConversation.id,
        p_new_title: newTitle.trim()
      });

      if (error) {
        throw error;
      }

      if (data) {
        // Update local state
        setConversations(prev => 
          prev.map(conv => 
            conv.id === selectedConversation.id 
              ? { ...conv, title: newTitle.trim() }
              : conv
          )
        );

        toast.success('Conversation renamed successfully');
        setShowRenameDialog(false);
        setSelectedConversation(null);
        setNewTitle('');
        onConversationUpdate?.();
      } else {
        throw new Error('Failed to rename conversation');
      }
    } catch (error) {
      console.error('Error renaming conversation:', error);
      toast.error('Failed to rename conversation');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle conversation delete
   */
  const handleDelete = async () => {
    if (!selectedConversation) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('delete_conversation', {
        p_conversation_id: selectedConversation.id
      });

      if (error) {
        throw error;
      }

      if (data) {
        // Remove from local state
        setConversations(prev => 
          prev.filter(conv => conv.id !== selectedConversation.id)
        );

        toast.success('Conversation deleted successfully');
        setShowDeleteDialog(false);
        setSelectedConversation(null);
        onConversationUpdate?.();

        // If this was the current conversation, we might want to redirect
        if (currentConversationId === selectedConversation.id) {
          onConversationSelect?.('');
        }
      } else {
        throw new Error('Failed to delete conversation');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Toggle conversation archive status
   */
  const handleToggleArchive = async (conversation: Conversation) => {
    try {
      const { data, error } = await supabase.rpc('toggle_conversation_archive', {
        p_conversation_id: conversation.id,
        p_is_archived: !conversation.is_archived
      });

      if (error) {
        throw error;
      }

      if (data) {
        // Update local state
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversation.id 
              ? { ...conv, is_archived: !conv.is_archived }
              : conv
          )
        );

        toast.success(
          conversation.is_archived 
            ? 'Conversation unarchived' 
            : 'Conversation archived'
        );
        onConversationUpdate?.();
      }
    } catch (error) {
      console.error('Error toggling archive:', error);
      toast.error('Failed to update conversation');
    }
  };

  /**
   * Toggle conversation favorite status
   */
  const handleToggleFavorite = async (conversation: Conversation) => {
    try {
      const { data, error } = await supabase.rpc('toggle_conversation_favorite', {
        p_conversation_id: conversation.id,
        p_is_favorite: !conversation.is_favorite
      });

      if (error) {
        throw error;
      }

      if (data) {
        // Update local state
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversation.id 
              ? { ...conv, is_favorite: !conv.is_favorite }
              : conv
          )
        );

        toast.success(
          conversation.is_favorite 
            ? 'Removed from favorites' 
            : 'Added to favorites'
        );
        onConversationUpdate?.();
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update conversation');
    }
  };

  /**
   * Open rename dialog
   */
  const openRenameDialog = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setNewTitle(conversation.title);
    setShowRenameDialog(true);
  };

  /**
   * Open delete dialog
   */
  const openDeleteDialog = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowDeleteDialog(true);
  };

  const filteredConversations = getFilteredAndSortedConversations();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {filterBy === 'all' ? 'All' : 
                 filterBy === 'favorites' ? 'Favorites' : 'Archived'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterBy('all')}>
                All Conversations
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterBy('favorites')}>
                Favorites Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterBy('archived')}>
                Archived Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                {sortBy === 'recent' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy('recent')}>
                Most Recent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                Oldest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('title')}>
                By Title
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('messages')}>
                By Message Count
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conversations List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No conversations match your search' : 'No conversations found'}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === currentConversationId}
              onSelect={() => onConversationSelect?.(conversation.id)}
              onRename={() => openRenameDialog(conversation)}
              onDelete={() => openDeleteDialog(conversation)}
              onToggleArchive={() => handleToggleArchive(conversation)}
              onToggleFavorite={() => handleToggleFavorite(conversation)}
            />
          ))
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new title for this conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Conversation title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRename();
                }
              }}
            />
            <div className="text-xs text-muted-foreground">
              {newTitle.length}/200 characters
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={isSubmitting || !newTitle.trim()}
            >
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedConversation?.title}"? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Individual Conversation Item Component
 */
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
  onToggleFavorite: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onToggleArchive,
  onToggleFavorite
}: ConversationItemProps) {
  return (
    <div
      className={`group p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${
        isActive 
          ? 'bg-primary/5 border-primary/20' 
          : 'bg-background hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {conversation.is_favorite && (
              <Star className="h-3 w-3 text-yellow-500 fill-current" />
            )}
            <h4 className={`font-medium text-sm truncate ${
              isActive ? 'text-primary' : 'text-foreground'
            }`}>
              {conversation.title}
            </h4>
            {conversation.is_archived && (
              <Badge variant="secondary" className="text-xs">
                Archived
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {conversation.message_count} messages
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
              <Edit3 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
              {conversation.is_favorite ? (
                <>
                  <StarOff className="h-4 w-4 mr-2" />
                  Remove from Favorites
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Add to Favorites
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleArchive(); }}>
              {conversation.is_archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
