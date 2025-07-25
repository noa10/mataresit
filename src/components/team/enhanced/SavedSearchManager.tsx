import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Bookmark,
  BookmarkPlus,
  MoreHorizontal,
  Edit,
  Trash2,
  Share,
  Star,
  Clock,
  Search,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MemberFilters } from './MemberFilterBuilder';
import { preferenceLearningService } from '@/services/preferenceLearningService';
import { useTeam } from '@/contexts/TeamContext';

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: string;
  filters: MemberFilters;
  isStarred: boolean;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsed?: string;
}

interface SavedSearchManagerProps {
  currentQuery: string;
  currentFilters: MemberFilters;
  onSearchLoad: (search: SavedSearch) => void;
  className?: string;
}

export function SavedSearchManager({
  currentQuery,
  currentFilters,
  onSearchLoad,
  className
}: SavedSearchManagerProps) {
  const { currentTeam } = useTeam();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState<SavedSearch | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    isStarred: false,
    isShared: false
  });

  // Load saved searches on component mount
  useEffect(() => {
    loadSavedSearches();
  }, [currentTeam?.id]);

  const loadSavedSearches = async () => {
    try {
      setIsLoading(true);
      
      // Load from user preferences
      const preferences = await preferenceLearningService.getUserPreferences('search_behavior', 0.1);
      const savedSearchPrefs = preferences.filter(p => p.preference_key.startsWith('saved_member_search_'));
      
      const searches: SavedSearch[] = savedSearchPrefs.map(pref => ({
        id: pref.id,
        name: pref.preference_value.name || 'Untitled Search',
        description: pref.preference_value.description,
        query: pref.preference_value.query || '',
        filters: pref.preference_value.filters || {
          roles: [],
          statuses: [],
          activityLevels: [],
          joinDateRange: {},
          lastActiveRange: {},
          engagementScoreRange: {},
          receiptCountRange: {},
        },
        isStarred: pref.preference_value.isStarred || false,
        isShared: pref.preference_value.isShared || false,
        createdAt: pref.created_at,
        updatedAt: pref.last_updated,
        usageCount: pref.preference_value.usageCount || 0,
        lastUsed: pref.preference_value.lastUsed
      }));

      // Sort by starred first, then by last used, then by name
      searches.sort((a, b) => {
        if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
        if (a.lastUsed && b.lastUsed) return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
        if (a.lastUsed && !b.lastUsed) return -1;
        if (!a.lastUsed && b.lastUsed) return 1;
        return a.name.localeCompare(b.name);
      });

      setSavedSearches(searches);
    } catch (error) {
      console.error('Failed to load saved searches:', error);
      toast.error('Failed to load saved searches');
    } finally {
      setIsLoading(false);
    }
  };

  const saveCurrentSearch = async () => {
    if (!saveForm.name.trim()) {
      toast.error('Please enter a name for the search');
      return;
    }

    try {
      const searchId = `saved_member_search_${Date.now()}`;
      const searchData = {
        name: saveForm.name.trim(),
        description: saveForm.description.trim(),
        query: currentQuery,
        filters: currentFilters,
        isStarred: saveForm.isStarred,
        isShared: saveForm.isShared,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await preferenceLearningService.setUserPreference(
        'search_behavior',
        searchId,
        searchData,
        1.0,
        'explicit_setting'
      );

      toast.success('Search saved successfully');
      setSaveDialogOpen(false);
      setSaveForm({ name: '', description: '', isStarred: false, isShared: false });
      await loadSavedSearches();
    } catch (error) {
      console.error('Failed to save search:', error);
      toast.error('Failed to save search');
    }
  };

  const updateSearch = async () => {
    if (!selectedSearch || !saveForm.name.trim()) return;

    try {
      const searchData = {
        ...selectedSearch,
        name: saveForm.name.trim(),
        description: saveForm.description.trim(),
        isStarred: saveForm.isStarred,
        isShared: saveForm.isShared,
        updatedAt: new Date().toISOString()
      };

      await preferenceLearningService.setUserPreference(
        'search_behavior',
        `saved_member_search_${selectedSearch.id}`,
        searchData,
        1.0,
        'explicit_setting'
      );

      toast.success('Search updated successfully');
      setEditDialogOpen(false);
      setSelectedSearch(null);
      setSaveForm({ name: '', description: '', isStarred: false, isShared: false });
      await loadSavedSearches();
    } catch (error) {
      console.error('Failed to update search:', error);
      toast.error('Failed to update search');
    }
  };

  const deleteSearch = async (search: SavedSearch) => {
    try {
      // In a real implementation, you'd call a delete API
      // For now, we'll set the preference with a deleted flag
      await preferenceLearningService.setUserPreference(
        'search_behavior',
        `saved_member_search_${search.id}`,
        { ...search, deleted: true },
        0.0,
        'explicit_setting'
      );

      toast.success('Search deleted successfully');
      await loadSavedSearches();
    } catch (error) {
      console.error('Failed to delete search:', error);
      toast.error('Failed to delete search');
    }
  };

  const toggleStar = async (search: SavedSearch) => {
    try {
      const updatedSearch = {
        ...search,
        isStarred: !search.isStarred,
        updatedAt: new Date().toISOString()
      };

      await preferenceLearningService.setUserPreference(
        'search_behavior',
        `saved_member_search_${search.id}`,
        updatedSearch,
        1.0,
        'explicit_setting'
      );

      await loadSavedSearches();
    } catch (error) {
      console.error('Failed to toggle star:', error);
      toast.error('Failed to update search');
    }
  };

  const loadSearch = async (search: SavedSearch) => {
    try {
      // Update usage count and last used
      const updatedSearch = {
        ...search,
        usageCount: search.usageCount + 1,
        lastUsed: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await preferenceLearningService.setUserPreference(
        'search_behavior',
        `saved_member_search_${search.id}`,
        updatedSearch,
        1.0,
        'behavioral_analysis'
      );

      // Track usage
      await preferenceLearningService.trackInteraction(
        'search_query',
        {
          action: 'saved_search_loaded',
          search_id: search.id,
          search_name: search.name,
          team_id: currentTeam?.id
        }
      );

      onSearchLoad(search);
      setIsOpen(false);
      await loadSavedSearches();
    } catch (error) {
      console.error('Failed to load search:', error);
      toast.error('Failed to load search');
    }
  };

  const openEditDialog = (search: SavedSearch) => {
    setSelectedSearch(search);
    setSaveForm({
      name: search.name,
      description: search.description || '',
      isStarred: search.isStarred,
      isShared: search.isShared
    });
    setEditDialogOpen(true);
  };

  const getFilterSummary = (filters: MemberFilters) => {
    const parts = [];
    if (filters.roles.length > 0) parts.push(`${filters.roles.length} role${filters.roles.length > 1 ? 's' : ''}`);
    if (filters.statuses.length > 0) parts.push(`${filters.statuses.length} status${filters.statuses.length > 1 ? 'es' : ''}`);
    if (filters.activityLevels.length > 0) parts.push(`${filters.activityLevels.length} activity level${filters.activityLevels.length > 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : 'No filters';
  };

  const hasCurrentSearch = currentQuery.trim() || Object.values(currentFilters).some(value => 
    Array.isArray(value) ? value.length > 0 : 
    typeof value === 'object' && value !== null ? Object.keys(value).length > 0 : 
    value !== undefined
  );

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Bookmark className="h-4 w-4 mr-2" />
              Saved Searches
              {savedSearches.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                  {savedSearches.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Saved Searches</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={!hasCurrentSearch}
                >
                  <BookmarkPlus className="h-4 w-4" />
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Loading saved searches...
                </div>
              ) : savedSearches.length === 0 ? (
                <div className="text-center py-4">
                  <Bookmark className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No saved searches yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a search and save it for quick access
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="flex items-start gap-3 p-2 rounded-lg border hover:bg-accent cursor-pointer group"
                      onClick={() => loadSearch(search)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(search);
                        }}
                      >
                        <Star className={cn("h-3 w-3", search.isStarred && "fill-yellow-400 text-yellow-400")} />
                      </Button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium text-sm truncate">{search.name}</h5>
                          {search.isShared && (
                            <Share className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        
                        {search.description && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {search.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-1">
                          {search.query && (
                            <Badge variant="outline" className="text-xs">
                              <Search className="h-2 w-2 mr-1" />
                              "{search.query}"
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-2 w-2 mr-1" />
                            {getFilterSummary(search.filters)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {search.lastUsed 
                              ? `Used ${format(new Date(search.lastUsed), 'MMM dd')}`
                              : `Created ${format(new Date(search.createdAt), 'MMM dd')}`
                            }
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {search.usageCount} use{search.usageCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEditDialog(search)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStar(search)}>
                            <Star className="h-4 w-4 mr-2" />
                            {search.isStarred ? 'Unstar' : 'Star'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteSearch(search)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {hasCurrentSearch && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
          >
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Save Current Search
          </Button>
        )}
      </div>

      {/* Save Search Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
            <DialogDescription>
              Save your current search and filters for quick access later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Name *</Label>
              <Input
                id="search-name"
                placeholder="e.g., Active Admins, New Members This Month"
                value={saveForm.name}
                onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-description">Description</Label>
              <Textarea
                id="search-description"
                placeholder="Optional description of what this search is for..."
                value={saveForm.description}
                onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="star-search"
                  checked={saveForm.isStarred}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, isStarred: e.target.checked }))}
                />
                <Label htmlFor="star-search" className="text-sm">
                  Star this search (appears at the top)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="share-search"
                  checked={saveForm.isShared}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, isShared: e.target.checked }))}
                />
                <Label htmlFor="share-search" className="text-sm">
                  Share with team members
                </Label>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 bg-muted rounded-lg">
              <h5 className="text-sm font-medium mb-2">Search Preview:</h5>
              <div className="space-y-1">
                {currentQuery && (
                  <div className="text-xs">
                    <span className="font-medium">Query:</span> "{currentQuery}"
                  </div>
                )}
                <div className="text-xs">
                  <span className="font-medium">Filters:</span> {getFilterSummary(currentFilters)}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrentSearch} disabled={!saveForm.name.trim()}>
              Save Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Search Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Search</DialogTitle>
            <DialogDescription>
              Update the details of your saved search.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-search-name">Name *</Label>
              <Input
                id="edit-search-name"
                placeholder="Search name"
                value={saveForm.name}
                onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-search-description">Description</Label>
              <Textarea
                id="edit-search-description"
                placeholder="Optional description..."
                value={saveForm.description}
                onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-star-search"
                  checked={saveForm.isStarred}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, isStarred: e.target.checked }))}
                />
                <Label htmlFor="edit-star-search" className="text-sm">
                  Star this search
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-share-search"
                  checked={saveForm.isShared}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, isShared: e.target.checked }))}
                />
                <Label htmlFor="edit-share-search" className="text-sm">
                  Share with team members
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateSearch} disabled={!saveForm.name.trim()}>
              Update Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
