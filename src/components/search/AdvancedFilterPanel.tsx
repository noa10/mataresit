import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Filter, 
  ChevronDown, 
  Calendar as CalendarIcon,
  ArrowDown,
  ArrowUp,
  X,
  Crown
} from 'lucide-react';
import { format } from 'date-fns';
import { AdvancedFilterPanelProps, SearchFilters } from '@/types/unified-search';

export function AdvancedFilterPanel({
  filters,
  onFiltersChange,
  availableCategories,
  availableTeams,
  isOpen,
  onToggle,
  subscriptionFeatures,
  className
}: AdvancedFilterPanelProps) {
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

  const hasAdvancedFilters = subscriptionFeatures.includes('advanced_filters');
  const hasTeamSearch = subscriptionFeatures.includes('team_search');

  const updateFilters = (updates: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearFilter = (filterKey: keyof SearchFilters) => {
    const newFilters = { ...filters };
    delete newFilters[filterKey];
    onFiltersChange(newFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.dateRange) count++;
    if (filters.amountRange) count++;
    if (filters.categories?.length) count++;
    if (filters.merchants?.length) count++;
    if (filters.teamId) count++;
    if (filters.status?.length) count++;
    if (filters.priority) count++;
    return count;
  };

  const renderDateRangeFilter = () => (
    <div className="space-y-2">
      <Label>Date Range</Label>
      <div className="flex gap-2">
        <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange ? (
                `${format(new Date(filters.dateRange.start), 'MMM dd')} - ${format(new Date(filters.dateRange.end), 'MMM dd')}`
              ) : (
                'Select date range'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-3">
              <div className="flex gap-2">
                {['today', 'week', 'month', 'quarter', 'year'].map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      let start = new Date();
                      
                      switch (preset) {
                        case 'today':
                          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          break;
                        case 'week':
                          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                          break;
                        case 'month':
                          start = new Date(now.getFullYear(), now.getMonth(), 1);
                          break;
                        case 'quarter':
                          start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                          break;
                        case 'year':
                          start = new Date(now.getFullYear(), 0, 1);
                          break;
                      }
                      
                      updateFilters({
                        dateRange: {
                          start: start.toISOString().split('T')[0],
                          end: now.toISOString().split('T')[0],
                          preset: preset as any
                        }
                      });
                      setDateRangeOpen(false);
                    }}
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                selected={{
                  from: filters.dateRange ? new Date(filters.dateRange.start) : undefined,
                  to: filters.dateRange ? new Date(filters.dateRange.end) : undefined
                }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    updateFilters({
                      dateRange: {
                        start: range.from.toISOString().split('T')[0],
                        end: range.to.toISOString().split('T')[0],
                        preset: 'custom'
                      }
                    });
                  }
                }}
                numberOfMonths={2}
              />
            </div>
          </PopoverContent>
        </Popover>
        {filters.dateRange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearFilter('dateRange')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderAmountRangeFilter = () => (
    <div className="space-y-2">
      <Label>Amount Range (MYR)</Label>
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Min"
          value={filters.amountRange?.min || ''}
          onChange={(e) => updateFilters({
            amountRange: {
              ...filters.amountRange,
              min: parseFloat(e.target.value) || 0,
              max: filters.amountRange?.max || 1000,
              currency: 'MYR'
            }
          })}
        />
        <Input
          type="number"
          placeholder="Max"
          value={filters.amountRange?.max || ''}
          onChange={(e) => updateFilters({
            amountRange: {
              ...filters.amountRange,
              min: filters.amountRange?.min || 0,
              max: parseFloat(e.target.value) || 1000,
              currency: 'MYR'
            }
          })}
        />
        {filters.amountRange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearFilter('amountRange')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className={className}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Advanced Filters
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()}
              </Badge>
            )}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 mt-4">
        {/* Basic Filters - Available to all tiers */}
        <div className="space-y-4">
          {renderDateRangeFilter()}
          
          {/* Language Toggle */}
          <div className="space-y-2">
            <Label>Language</Label>
            <ToggleGroup
              type="single"
              value={filters.language || 'en'}
              onValueChange={(language) => updateFilters({ language: language as 'en' | 'ms' })}
            >
              <ToggleGroupItem value="en">English</ToggleGroupItem>
              <ToggleGroupItem value="ms">Bahasa Malaysia</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Sort Options */}
          <div className="space-y-2">
            <Label>Sort By</Label>
            <div className="flex gap-2">
              <Select
                value={filters.sortBy || 'relevance'}
                onValueChange={(sortBy) => updateFilters({ sortBy: sortBy as any })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>

              <ToggleGroup
                type="single"
                value={filters.sortOrder || 'desc'}
                onValueChange={(sortOrder) => updateFilters({ sortOrder: sortOrder as 'asc' | 'desc' })}
              >
                <ToggleGroupItem value="desc">
                  <ArrowDown className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="asc">
                  <ArrowUp className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        {/* Advanced Filters - Pro/Max only */}
        {hasAdvancedFilters && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <Label className="text-sm font-medium">Advanced Filters</Label>
              </div>

              {renderAmountRangeFilter()}

              {/* Category Multi-Select */}
              <div className="space-y-2">
                <Label>Categories</Label>
                <Select
                  value={filters.categories?.[0] || ''}
                  onValueChange={(categoryId) => {
                    if (categoryId) {
                      updateFilters({
                        categories: filters.categories?.includes(categoryId)
                          ? filters.categories.filter(id => id !== categoryId)
                          : [...(filters.categories || []), categoryId]
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select categories..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filters.categories && filters.categories.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {filters.categories.map(categoryId => {
                      const category = availableCategories.find(c => c.id === categoryId);
                      return category ? (
                        <Badge key={categoryId} variant="secondary" className="text-xs">
                          {category.name}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-auto p-0"
                            onClick={() => updateFilters({
                              categories: filters.categories?.filter(id => id !== categoryId)
                            })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {/* Team Scope (Pro/Max only) */}
              {hasTeamSearch && (
                <div className="space-y-2">
                  <Label>Team Scope</Label>
                  <Select
                    value={filters.teamId || ''}
                    onValueChange={(teamId) => updateFilters({ teamId })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All teams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All teams</SelectItem>
                      {availableTeams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </>
        )}

        {/* Clear All Filters */}
        {getActiveFilterCount() > 0 && (
          <>
            <Separator />
            <Button
              variant="outline"
              onClick={() => onFiltersChange({})}
              className="w-full"
            >
              Clear All Filters
            </Button>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
