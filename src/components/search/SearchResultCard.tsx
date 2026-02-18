import React, { useState, useMemo } from 'react';
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
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { UnifiedSearchResult } from '@/types/unified-search';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  receipts: Receipt,
  claims: FileText,
  team_members: Users,
  custom_categories: Tag,
  business_directory: Building,
  conversations: MessageSquare
};

const colorMap: Record<string, string> = {
  receipts: 'border-l-blue-500',
  claims: 'border-l-green-500',
  team_members: 'border-l-purple-500',
  custom_categories: 'border-l-orange-500',
  business_directory: 'border-l-teal-500',
  conversations: 'border-l-indigo-500'
};

interface HighlightMatch {
  start: number;
  end: number;
  text: string;
}

interface SearchResultCardProps {
  result: UnifiedSearchResult;
  query: string;
  onAction?: (action: string, result: UnifiedSearchResult) => void;
  onCopy?: (text: string) => void;
  compact?: boolean;
  className?: string;
}

function highlightMatches(text: string, query: string): HighlightMatch[] {
  if (!query.trim()) return [];
  
  const matches: HighlightMatch[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let startIndex = 0;
  
  while (true) {
    const index = lowerText.indexOf(lowerQuery, startIndex);
    if (index === -1) break;
    
    matches.push({
      start: index,
      end: index + query.length,
      text: text.slice(index, index + query.length)
    });
    
    startIndex = index + 1;
  }
  
  return matches.slice(0, 5);
}

function renderHighlightedText(text: string, matches: HighlightMatch[]) {
  if (matches.length === 0) return text;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  matches.forEach((match, i) => {
    if (match.start > lastIndex) {
      parts.push(text.slice(lastIndex, match.start));
    }
    parts.push(
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {match.text}
      </mark>
    );
    lastIndex = match.end;
  });
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}

export function SearchResultCard({
  result,
  query,
  onAction,
  onCopy,
  compact = false,
  className
}: SearchResultCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  
  const IconComponent = iconMap[result.sourceType] || FileText;
  const borderColor = colorMap[result.sourceType] || 'border-l-gray-500';
  
  const titleMatches = useMemo(() => highlightMatches(result.title, query), [result.title, query]);
  const descriptionMatches = useMemo(() => highlightMatches(result.description, query), [result.description, query]);
  
  const handlePrimaryAction = () => {
    switch (result.sourceType) {
      case 'receipt':
        navigate(`/receipts/${result.sourceId}`);
        break;
      case 'claim':
        navigate(`/claims/${result.sourceId}`);
        break;
      case 'team_member':
        onAction?.('view_profile', result);
        break;
      case 'custom_category':
        onAction?.('filter_by_category', result);
        break;
      case 'business_directory':
        onAction?.('view_business', result);
        break;
      case 'conversation':
        navigate(`/search?c=${result.sourceId}`);
        break;
      default:
        onAction?.('view', result);
    }
  };

  const handleCopy = async () => {
    const textToCopy = `${result.title}\n${result.description}`;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.(textToCopy);
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
      currency
    }).format(amount);
  };

  const getQuickActions = () => [
    { label: 'View', action: 'view', icon: Eye },
    { label: 'Copy', action: 'copy', icon: copied ? Check : Copy },
    { label: 'Find Similar', action: 'search_similar', icon: Search }
  ];

  const sourceTypeLabels: Record<string, string> = {
    receipt: 'Receipt',
    claim: 'Claim',
    team_member: 'Team Member',
    custom_category: 'Category',
    business_directory: 'Business',
    conversation: 'Conversation'
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
              {sourceTypeLabels[result.sourceType] || result.sourceType}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        if (action.action === 'copy') {
                          handleCopy();
                        } else if (action.action === 'view') {
                          handlePrimaryAction();
                        } else {
                          onAction?.(action.action, result);
                        }
                      }}
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
          {titleMatches.length > 0 
            ? renderHighlightedText(result.title, titleMatches)
            : result.title
          }
        </CardTitle>
      </CardHeader>

      <CardContent className={cn("pt-0", compact ? "px-3 pb-3" : "px-6 pb-6")}>
        <p className={cn(
          "text-muted-foreground line-clamp-2 mb-3",
          compact ? "text-xs" : "text-sm"
        )}>
          {descriptionMatches.length > 0 
            ? renderHighlightedText(result.description, descriptionMatches)
            : result.description
          }
        </p>

        {/* Source-specific metadata */}
        <div className="space-y-2 text-sm">
          {result.metadata?.date && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatDate(result.metadata.date)}</span>
              {result.metadata.total && (
                <span className="font-medium">
                  {formatCurrency(result.metadata.total, result.metadata.currency)}
                </span>
              )}
            </div>
          )}
          {result.metadata?.status && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Status: {result.metadata.status}</span>
              {result.metadata.amount && (
                <span className="font-medium">
                  {formatCurrency(result.metadata.amount, result.metadata.currency)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-3">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handlePrimaryAction} 
            className="flex-1"
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleCopy}
            className="px-2"
            title="Copy"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onAction?.('search_similar', result)}
            className="px-2"
            title="Find similar"
          >
            <Search className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SearchResultListProps {
  results: UnifiedSearchResult[];
  query: string;
  onAction?: (action: string, result: UnifiedSearchResult) => void;
  onCopy?: (text: string) => void;
  viewMode?: 'grid' | 'list';
  className?: string;
}

export function SearchResultList({
  results,
  query,
  onAction,
  onCopy,
  viewMode = 'grid',
  className
}: SearchResultListProps) {
  return (
    <div className={cn(
      "grid gap-4",
      viewMode === 'grid' 
        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
        : "grid-cols-1",
      className
    )}>
      {results.map((result) => (
        <SearchResultCard
          key={result.id}
          result={result}
          query={query}
          onAction={onAction}
          onCopy={onCopy}
          compact={viewMode === 'list'}
        />
      ))}
    </div>
  );
}
