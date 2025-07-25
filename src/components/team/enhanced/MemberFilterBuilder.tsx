import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Filter,
  X,
  Calendar as CalendarIcon,
  Users,
  Activity,
  Crown,
  Shield,
  User,
  Eye,
  TrendingUp,
  Clock,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { TeamMemberRole } from '@/types/team';

export interface MemberFilters {
  roles: TeamMemberRole[];
  statuses: string[];
  activityLevels: string[];
  joinDateRange: {
    start?: Date;
    end?: Date;
  };
  lastActiveRange: {
    start?: Date;
    end?: Date;
  };
  engagementScoreRange: {
    min?: number;
    max?: number;
  };
  receiptCountRange: {
    min?: number;
    max?: number;
  };
}

interface MemberFilterBuilderProps {
  filters: MemberFilters;
  onFiltersChange: (filters: MemberFilters) => void;
  onReset?: () => void;
  className?: string;
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner', icon: Crown },
  { value: 'admin', label: 'Admin', icon: Shield },
  { value: 'member', label: 'Member', icon: User },
  { value: 'viewer', label: 'Viewer', icon: Eye },
] as const;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'inactive', label: 'Inactive', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'scheduled_removal', label: 'Scheduled Removal', color: 'bg-red-100 text-red-800' },
] as const;

const ACTIVITY_LEVEL_OPTIONS = [
  { value: 'very_active', label: 'Very Active', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'moderate', label: 'Moderate', color: 'bg-blue-100 text-blue-800' },
  { value: 'inactive', label: 'Inactive', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'dormant', label: 'Dormant', color: 'bg-gray-100 text-gray-800' },
] as const;

export function MemberFilterBuilder({
  filters,
  onFiltersChange,
  onReset,
  className
}: MemberFilterBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilters = (updates: Partial<MemberFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleRole = (role: TeamMemberRole) => {
    const newRoles = filters.roles.includes(role)
      ? filters.roles.filter(r => r !== role)
      : [...filters.roles, role];
    updateFilters({ roles: newRoles });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    updateFilters({ statuses: newStatuses });
  };

  const toggleActivityLevel = (level: string) => {
    const newLevels = filters.activityLevels.includes(level)
      ? filters.activityLevels.filter(l => l !== level)
      : [...filters.activityLevels, level];
    updateFilters({ activityLevels: newLevels });
  };

  const setJoinDateRange = (start?: Date, end?: Date) => {
    updateFilters({
      joinDateRange: { start, end }
    });
  };

  const setLastActiveRange = (start?: Date, end?: Date) => {
    updateFilters({
      lastActiveRange: { start, end }
    });
  };

  const setEngagementRange = (min?: number, max?: number) => {
    updateFilters({
      engagementScoreRange: { min, max }
    });
  };

  const setReceiptCountRange = (min?: number, max?: number) => {
    updateFilters({
      receiptCountRange: { min, max }
    });
  };

  const resetFilters = () => {
    const emptyFilters: MemberFilters = {
      roles: [],
      statuses: [],
      activityLevels: [],
      joinDateRange: {},
      lastActiveRange: {},
      engagementScoreRange: {},
      receiptCountRange: {},
    };
    onFiltersChange(emptyFilters);
    if (onReset) onReset();
  };

  const getActiveFilterCount = () => {
    return (
      filters.roles.length +
      filters.statuses.length +
      filters.activityLevels.length +
      (filters.joinDateRange.start || filters.joinDateRange.end ? 1 : 0) +
      (filters.lastActiveRange.start || filters.lastActiveRange.end ? 1 : 0) +
      (filters.engagementScoreRange.min !== undefined || filters.engagementScoreRange.max !== undefined ? 1 : 0) +
      (filters.receiptCountRange.min !== undefined || filters.receiptCountRange.max !== undefined ? 1 : 0)
    );
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className={cn("relative", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <div className="p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filter Members</h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  disabled={activeFilterCount === 0}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Role Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Roles
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((role) => {
                  const Icon = role.icon;
                  return (
                    <div key={role.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role.value}`}
                        checked={filters.roles.includes(role.value as TeamMemberRole)}
                        onCheckedChange={() => toggleRole(role.value as TeamMemberRole)}
                      />
                      <label
                        htmlFor={`role-${role.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1 cursor-pointer"
                      >
                        <Icon className="h-3 w-3" />
                        {role.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Status
              </Label>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((status) => (
                  <div key={status.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.value}`}
                      checked={filters.statuses.includes(status.value)}
                      onCheckedChange={() => toggleStatus(status.value)}
                    />
                    <label
                      htmlFor={`status-${status.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <Badge variant="outline" className={cn("text-xs", status.color)}>
                        {status.label}
                      </Badge>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Level Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Activity Level
              </Label>
              <div className="space-y-2">
                {ACTIVITY_LEVEL_OPTIONS.map((level) => (
                  <div key={level.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`activity-${level.value}`}
                      checked={filters.activityLevels.includes(level.value)}
                      onCheckedChange={() => toggleActivityLevel(level.value)}
                    />
                    <label
                      htmlFor={`activity-${level.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <Badge variant="outline" className={cn("text-xs", level.color)}>
                        {level.label}
                      </Badge>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Ranges */}
            <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Date Ranges
              </Label>
              
              {/* Join Date Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Join Date</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {filters.joinDateRange.start ? format(filters.joinDateRange.start, "MMM dd") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.joinDateRange.start}
                        onSelect={(date) => setJoinDateRange(date, filters.joinDateRange.end)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {filters.joinDateRange.end ? format(filters.joinDateRange.end, "MMM dd") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.joinDateRange.end}
                        onSelect={(date) => setJoinDateRange(filters.joinDateRange.start, date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Last Active Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Last Active</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                        <Clock className="mr-2 h-3 w-3" />
                        {filters.lastActiveRange.start ? format(filters.lastActiveRange.start, "MMM dd") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.lastActiveRange.start}
                        onSelect={(date) => setLastActiveRange(date, filters.lastActiveRange.end)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                        <Clock className="mr-2 h-3 w-3" />
                        {filters.lastActiveRange.end ? format(filters.lastActiveRange.end, "MMM dd") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.lastActiveRange.end}
                        onSelect={(date) => setLastActiveRange(filters.lastActiveRange.start, date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Numeric Ranges */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Metrics</Label>
              
              {/* Engagement Score Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Engagement Score (0-100)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    min="0"
                    max="100"
                    value={filters.engagementScoreRange.min || ''}
                    onChange={(e) => setEngagementRange(
                      e.target.value ? parseInt(e.target.value) : undefined,
                      filters.engagementScoreRange.max
                    )}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    min="0"
                    max="100"
                    value={filters.engagementScoreRange.max || ''}
                    onChange={(e) => setEngagementRange(
                      filters.engagementScoreRange.min,
                      e.target.value ? parseInt(e.target.value) : undefined
                    )}
                  />
                </div>
              </div>

              {/* Receipt Count Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Receipt Count</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    min="0"
                    value={filters.receiptCountRange.min || ''}
                    onChange={(e) => setReceiptCountRange(
                      e.target.value ? parseInt(e.target.value) : undefined,
                      filters.receiptCountRange.max
                    )}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    min="0"
                    value={filters.receiptCountRange.max || ''}
                    onChange={(e) => setReceiptCountRange(
                      filters.receiptCountRange.min,
                      e.target.value ? parseInt(e.target.value) : undefined
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setIsOpen(false)}>
                Apply Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {filters.roles.map((role) => (
            <Badge key={role} variant="secondary" className="text-xs">
              {role}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-3 w-3 p-0"
                onClick={() => toggleRole(role)}
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
          {filters.statuses.map((status) => (
            <Badge key={status} variant="secondary" className="text-xs">
              {status}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-3 w-3 p-0"
                onClick={() => toggleStatus(status)}
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
          {filters.activityLevels.map((level) => (
            <Badge key={level} variant="secondary" className="text-xs">
              {level}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-3 w-3 p-0"
                onClick={() => toggleActivityLevel(level)}
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
