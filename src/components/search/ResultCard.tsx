import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Receipt, 
  FileText, 
  Users, 
  Tag, 
  Building, 
  MessageSquare,
  MoreHorizontal,
  Eye,
  Search,
  Share,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ResultCardProps } from '@/types/unified-search';

// Icon mapping
const iconMap = {
  receipts: Receipt,
  claims: FileText,
  team_members: Users,
  custom_categories: Tag,
  business_directory: Building,
  conversations: MessageSquare
};

// Color mapping
const colorMap = {
  receipts: 'border-l-blue-500',
  claims: 'border-l-green-500',
  team_members: 'border-l-purple-500',
  custom_categories: 'border-l-orange-500',
  business_directory: 'border-l-teal-500',
  conversations: 'border-l-indigo-500'
};

export function ResultCard({ result, onAction, compact = false, className }: ResultCardProps) {
  const navigate = useNavigate();
  
  const IconComponent = iconMap[result.sourceType as keyof typeof iconMap] || FileText;
  const borderColor = colorMap[result.sourceType as keyof typeof colorMap] || 'border-l-gray-500';

  const handlePrimaryAction = () => {
    switch (result.sourceType) {
      case 'receipt':
        navigate(`/receipts/${result.sourceId}`);
        break;
      case 'claim':
        navigate(`/claims/${result.sourceId}`);
        break;
      case 'team_member':
        onAction('view_profile', result);
        break;
      case 'custom_category':
        onAction('filter_by_category', result);
        break;
      case 'business_directory':
        onAction('view_business', result);
        break;
      case 'conversation':
        navigate(`/search?c=${result.sourceId}`);
        break;
      default:
        onAction('view', result);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'MYR') => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const renderSourceSpecificMetadata = () => {
    switch (result.sourceType) {
      case 'receipt':
        return (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatDate(result.metadata.date || result.createdAt)}</span>
            {result.metadata.total && (
              <span className="font-medium">
                {formatCurrency(result.metadata.total, result.metadata.currency)}
              </span>
            )}
          </div>
        );

      case 'claim':
        return (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Status: {result.metadata.status || 'Pending'}</span>
            {result.metadata.amount && (
              <span className="font-medium">
                {formatCurrency(result.metadata.amount, result.metadata.currency)}
              </span>
            )}
          </div>
        );

      case 'team_member':
        return (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{result.metadata.role || 'Team Member'}</span>
            <span>{result.metadata.email}</span>
          </div>
        );

      case 'business_directory':
        return (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{result.metadata.business_type || 'Business'}</span>
            <span>{result.metadata.state || result.metadata.location}</span>
          </div>
        );

      case 'custom_category':
        return (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Category</span>
            {result.metadata.color && (
              <div 
                className="w-3 h-3 rounded-full border"
                style={{ backgroundColor: result.metadata.color }}
              />
            )}
          </div>
        );

      case 'conversation':
        return (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatDate(result.createdAt)}</span>
            <span>{result.metadata.messageCount || 0} messages</span>
          </div>
        );

      default:
        return null;
    }
  };

  const getQuickActions = () => {
    const actions = [
      { label: 'View', action: 'view', icon: Eye },
      { label: 'Find Similar', action: 'search_similar', icon: Search }
    ];

    // Add source-specific actions
    switch (result.sourceType) {
      case 'receipt':
        actions.push({ label: 'View Receipt', action: 'view_receipt', icon: ExternalLink });
        break;
      case 'claim':
        actions.push({ label: 'View Claim', action: 'view_claim', icon: ExternalLink });
        break;
      case 'business_directory':
        actions.push({ label: 'Get Directions', action: 'get_directions', icon: ExternalLink });
        break;
    }

    actions.push({ label: 'Share', action: 'share', icon: Share });
    return actions;
  };

  return (
    <Card className={cn(
      "border-l-4 hover:shadow-md transition-all duration-200 cursor-pointer group",
      borderColor,
      compact && "p-2",
      className
    )}>
      <CardHeader className={cn("pb-2", compact ? "px-3 pt-3" : "px-6 pt-6")}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex-shrink-0">
              <IconComponent className="h-4 w-4 text-muted-foreground" />
            </div>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {result.sourceType.replace('_', ' ')}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {result.similarity > 0 && (
              <Badge variant="secondary" className="text-xs">
                {Math.round(result.similarity * 100)}% match
              </Badge>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {getQuickActions().map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <DropdownMenuItem 
                      key={action.action}
                      onClick={() => onAction(action.action, result)}
                    >
                      <ActionIcon className="mr-2 h-4 w-4" />
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <CardTitle 
          className={cn(
            "line-clamp-2 cursor-pointer hover:text-primary transition-colors",
            compact ? "text-sm" : "text-base"
          )}
          onClick={handlePrimaryAction}
        >
          {result.title}
        </CardTitle>
      </CardHeader>

      <CardContent className={cn("pt-0", compact ? "px-3 pb-3" : "px-6 pb-6")}>
        <p className={cn(
          "text-muted-foreground line-clamp-2 mb-3",
          compact ? "text-xs" : "text-sm"
        )}>
          {result.description}
        </p>

        {/* Source-specific metadata */}
        <div className="space-y-2">
          {renderSourceSpecificMetadata()}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-3">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handlePrimaryAction} 
            className="flex-1"
          >
            View
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onAction('search_similar', result)}
            className="px-2"
          >
            <Search className="h-3 w-3" />
          </Button>
        </div>

        {/* Access Level Indicator */}
        {result.accessLevel !== 'user' && (
          <div className="mt-2 flex justify-end">
            <Badge 
              variant={result.accessLevel === 'team' ? 'default' : 'secondary'} 
              className="text-xs"
            >
              {result.accessLevel === 'team' ? 'Team' : 'Public'}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
