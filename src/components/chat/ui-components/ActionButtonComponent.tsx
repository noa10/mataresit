/**
 * Action Button UI Component for Chat Interface
 * 
 * Renders interactive action buttons that users can click to perform common tasks.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  Plus, 
  BarChart3, 
  Download, 
  Filter, 
  ExternalLink, 
  Edit, 
  Tag, 
  FileText,
  Search,
  Settings,
  Users,
  Calendar,
  DollarSign
} from 'lucide-react';
import { ActionButtonData, UIComponentProps, ActionType } from '@/types/ui-components';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ActionButtonComponentProps extends Omit<UIComponentProps, 'component'> {
  data: ActionButtonData;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

// Icon mapping for different action types
const ACTION_ICONS = {
  upload_receipt: Upload,
  create_claim: Plus,
  view_analytics: BarChart3,
  export_data: Download,
  filter_results: Filter,
  view_receipt: ExternalLink,
  edit_receipt: Edit,
  categorize_receipt: Tag,
  create_report: FileText,
  search: Search,
  settings: Settings,
  team: Users,
  calendar: Calendar,
  finance: DollarSign,
} as const;

// Action descriptions for accessibility and tooltips
const ACTION_DESCRIPTIONS = {
  upload_receipt: 'Upload a new receipt for processing',
  create_claim: 'Create a new expense claim',
  view_analytics: 'View spending analytics and insights',
  export_data: 'Export data to CSV or PDF',
  filter_results: 'Apply filters to current results',
  view_receipt: 'View receipt details',
  edit_receipt: 'Edit receipt information',
  categorize_receipt: 'Categorize this receipt',
  create_report: 'Generate a detailed report',
} as const;

// URL mappings for different actions
const ACTION_URLS = {
  upload_receipt: '/upload',
  create_claim: '/claims/new',
  view_analytics: '/analytics',
  export_data: '/export',
  filter_results: '#',
  view_receipt: '/receipts',
  edit_receipt: '/receipts',
  categorize_receipt: '#',
  create_report: '/reports/new',
} as const;

export function ActionButtonComponent({ 
  data, 
  onAction, 
  className = '', 
  compact = false 
}: ActionButtonComponentProps) {
  const navigate = useNavigate();

  // Get the appropriate icon for the action
  const getActionIcon = (action: ActionType, customIcon?: string) => {
    if (customIcon) {
      // If a custom icon is provided, try to match it to our available icons
      const IconComponent = ACTION_ICONS[customIcon as keyof typeof ACTION_ICONS];
      if (IconComponent) return IconComponent;
    }
    
    return ACTION_ICONS[action] || ExternalLink;
  };

  // Get action description
  const getActionDescription = (action: ActionType) => {
    return ACTION_DESCRIPTIONS[action] || `Perform ${action.replace('_', ' ')}`;
  };

  // Handle button click
  const handleClick = () => {
    const actionData = {
      action: data.action,
      params: data.params,
      url: data.url,
    };

    // Handle navigation if URL is provided
    if (data.url) {
      if (data.url.startsWith('http')) {
        // External URL
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        // Internal navigation
        navigate(data.url);
      }
    } else {
      // Use default URL mapping
      const defaultUrl = ACTION_URLS[data.action];
      if (defaultUrl && defaultUrl !== '#') {
        // Append parameters if provided
        let finalUrl = defaultUrl;
        if (data.params) {
          const searchParams = new URLSearchParams();
          Object.entries(data.params).forEach(([key, value]) => {
            searchParams.append(key, String(value));
          });
          finalUrl += `?${searchParams.toString()}`;
        }
        navigate(finalUrl);
      }
    }

    // Handle special actions
    switch (data.action) {
      case 'filter_results':
        toast.info('Filter functionality will be applied to current results');
        break;
      case 'categorize_receipt':
        toast.info('Categorization modal will open');
        break;
      case 'export_data':
        toast.info('Export process initiated');
        break;
      default:
        break;
    }

    // Call the onAction callback
    onAction?.(data.action, actionData);
  };

  // Get button size based on compact mode
  const buttonSize = compact ? 'sm' : 'default';
  
  // Get icon size based on compact mode
  const iconSize = compact ? 'h-3 w-3' : 'h-4 w-4';

  const IconComponent = getActionIcon(data.action, data.icon);

  if (compact) {
    return (
      <Button
        variant={data.variant}
        size={buttonSize}
        onClick={handleClick}
        className={`inline-flex items-center gap-1 ${className}`}
        title={getActionDescription(data.action)}
      >
        <IconComponent className={iconSize} />
        <span className="text-xs">{data.label}</span>
      </Button>
    );
  }

  return (
    <div className={`inline-block ${className}`}>
      <Button
        variant={data.variant}
        size={buttonSize}
        onClick={handleClick}
        className="inline-flex items-center gap-2 min-w-[120px] justify-center"
        title={getActionDescription(data.action)}
      >
        <IconComponent className={iconSize} />
        <span>{data.label}</span>
      </Button>
    </div>
  );
}

/**
 * Action Button Group Component
 * Renders multiple action buttons in a group layout
 */
interface ActionButtonGroupProps {
  buttons: ActionButtonData[];
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
  layout?: 'horizontal' | 'vertical' | 'grid';
}

export function ActionButtonGroup({ 
  buttons, 
  onAction, 
  className = '', 
  compact = false,
  layout = 'horizontal'
}: ActionButtonGroupProps) {
  const getLayoutClasses = () => {
    switch (layout) {
      case 'vertical':
        return 'flex flex-col gap-2';
      case 'grid':
        return 'grid grid-cols-2 gap-2';
      case 'horizontal':
      default:
        return 'flex flex-wrap gap-2';
    }
  };

  return (
    <div className={`${getLayoutClasses()} ${className}`}>
      {buttons.map((buttonData, index) => (
        <ActionButtonComponent
          key={index}
          data={buttonData}
          onAction={onAction}
          compact={compact}
        />
      ))}
    </div>
  );
}

/**
 * Quick Actions Component
 * Renders a set of common quick action buttons
 */
interface QuickActionsProps {
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

export function QuickActions({ onAction, className = '', compact = false }: QuickActionsProps) {
  const quickActionButtons: ActionButtonData[] = [
    {
      action: 'upload_receipt',
      label: 'Upload Receipt',
      variant: 'primary',
      icon: 'upload',
    },
    {
      action: 'create_claim',
      label: 'New Claim',
      variant: 'secondary',
      icon: 'plus',
    },
    {
      action: 'view_analytics',
      label: 'Analytics',
      variant: 'outline',
      icon: 'chart',
    },
  ];

  return (
    <ActionButtonGroup
      buttons={quickActionButtons}
      onAction={onAction}
      className={className}
      compact={compact}
      layout="horizontal"
    />
  );
}
