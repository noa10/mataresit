import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Receipt, 
  FileText, 
  Users, 
  Tag, 
  Building, 
  MessageSquare,
  Lock,
  Crown
} from 'lucide-react';
import { SearchTargetSelectorProps } from '@/types/unified-search';
import { subscriptionLimits } from '@/config/search-targets';

// Icon mapping
const iconMap = {
  Receipt,
  FileText,
  Users,
  Tag,
  Building,
  MessageSquare
};

export function SearchTargetSelector({
  targets,
  selectedTargets,
  onSelectionChange,
  subscriptionTier,
  disabled = false,
  layout = 'horizontal',
  className
}: SearchTargetSelectorProps) {
  const limits = subscriptionLimits[subscriptionTier];

  const handleTargetToggle = (targetId: string, checked: boolean) => {
    if (disabled) return;

    let newSelection: string[];
    if (checked) {
      newSelection = [...selectedTargets, targetId];
    } else {
      newSelection = selectedTargets.filter(id => id !== targetId);
    }

    onSelectionChange(newSelection);
  };

  const isTargetAvailable = (targetId: string) => {
    return limits.allowedSources.includes(targetId);
  };

  const getSubscriptionIcon = (requiredTier: string) => {
    if (requiredTier === 'pro' || requiredTier === 'max') {
      return <Crown className="h-3 w-3 text-amber-500" />;
    }
    return null;
  };

  const renderTargetItem = (target: any, index: number) => {
    const IconComponent = iconMap[target.icon as keyof typeof iconMap];
    const isAvailable = isTargetAvailable(target.id);
    const isSelected = selectedTargets.includes(target.id);
    const isDisabled = disabled || !isAvailable || !target.enabled;

    const targetButton = (
      <div
        key={target.id}
        className={cn(
          "flex items-center space-x-2 p-3 rounded-lg border transition-all duration-200",
          layout === 'grid' && "flex-col space-x-0 space-y-2 text-center",
          isSelected && isAvailable
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-border hover:border-primary/50",
          isDisabled && "opacity-50 cursor-not-allowed",
          !isDisabled && "cursor-pointer hover:shadow-sm",
          className
        )}
        onClick={() => !isDisabled && handleTargetToggle(target.id, !isSelected)}
      >
        <div className={cn(
          "flex items-center",
          layout === 'grid' && "flex-col space-y-1"
        )}>
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md",
            target.color,
            isSelected ? "text-white" : "text-white/80"
          )}>
            {IconComponent && <IconComponent className="h-4 w-4" />}
          </div>
          
          {layout !== 'grid' && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Label className={cn(
                  "text-sm font-medium cursor-pointer",
                  isDisabled && "cursor-not-allowed"
                )}>
                  {target.label}
                </Label>
                {!isAvailable && (
                  <div className="flex items-center gap-1">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    {getSubscriptionIcon(target.subscriptionRequired)}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {target.description}
              </p>
            </div>
          )}
        </div>

        {layout === 'grid' && (
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Label className={cn(
                "text-xs font-medium cursor-pointer text-center",
                isDisabled && "cursor-not-allowed"
              )}>
                {target.label}
              </Label>
              {!isAvailable && (
                <div className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  {getSubscriptionIcon(target.subscriptionRequired)}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center line-clamp-2">
              {target.description}
            </p>
          </div>
        )}

        <Checkbox
          checked={isSelected}
          disabled={isDisabled}
          className={cn(
            layout === 'grid' && "mt-2"
          )}
          onChange={(checked) => handleTargetToggle(target.id, checked)}
        />
      </div>
    );

    // Wrap with tooltip for unavailable targets
    if (!isAvailable) {
      return (
        <TooltipProvider key={target.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {targetButton}
            </TooltipTrigger>
            <TooltipContent>
              <p>Requires {target.subscriptionRequired.toUpperCase()} plan</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return targetButton;
  };

  if (layout === 'horizontal') {
    return (
      <div className={cn("w-full", className)}>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {targets.map(renderTargetItem)}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  }

  if (layout === 'grid') {
    return (
      <div className={cn(
        "grid gap-3",
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        className
      )}>
        {targets.map(renderTargetItem)}
      </div>
    );
  }

  // Vertical layout
  return (
    <div className={cn("space-y-3", className)}>
      {targets.map(renderTargetItem)}
    </div>
  );
}

// Quick selection buttons
export function SearchTargetQuickSelect({
  targets,
  selectedTargets,
  onSelectionChange,
  subscriptionTier,
  className
}: Omit<SearchTargetSelectorProps, 'layout'>) {
  const limits = subscriptionLimits[subscriptionTier];
  
  const handleSelectAll = () => {
    const availableTargets = targets
      .filter(target => limits.allowedSources.includes(target.id) && target.enabled)
      .map(target => target.id);
    onSelectionChange(availableTargets);
  };

  const handleSelectNone = () => {
    onSelectionChange([]);
  };

  const handleSelectDefault = () => {
    // Default to receipts and business directory for all tiers
    const defaultTargets = ['receipts', 'business_directory'].filter(id =>
      limits.allowedSources.includes(id)
    );
    onSelectionChange(defaultTargets);
  };

  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSelectAll}
        className="text-xs"
      >
        Select All
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSelectNone}
        className="text-xs"
      >
        Clear
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSelectDefault}
        className="text-xs"
      >
        Default
      </Button>
      
      {selectedTargets.length > 0 && (
        <Badge variant="secondary" className="text-xs">
          {selectedTargets.length} selected
        </Badge>
      )}
    </div>
  );
}
