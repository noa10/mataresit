/**
 * UI Component Renderer for Chat Interface
 * 
 * Central component that renders different types of UI components
 * based on their type and data.
 */

import React from 'react';
import { UIComponent, UIComponentProps } from '@/types/ui-components';
import { ReceiptCardComponent } from './ReceiptCardComponent';
import { LineItemCardComponent } from './LineItemCardComponent';
import { ActionButtonComponent } from './ActionButtonComponent';
import { DataTableComponent } from './DataTableComponent';
import { BarChartComponent } from './BarChartComponent';
import { PieChartComponent } from './PieChartComponent';
import { SummaryCardComponent } from './SummaryCardComponent';
import { SectionHeaderComponent } from './SectionHeaderComponent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface UIComponentRendererProps {
  components: UIComponent[];
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

/**
 * Main UI Component Renderer
 */
export function UIComponentRenderer({
  components,
  onAction,
  className = '',
  compact = false
}: UIComponentRendererProps) {
  // 🔍 DEBUG: Log UI components being rendered
  console.log('🔍 DEBUG: UIComponentRenderer received components:', {
    componentsLength: components?.length || 0,
    componentsPreview: components?.map((comp, idx) => ({
      index: idx,
      type: comp.type,
      component: comp.component,
      hasData: !!comp.data,
      dataKeys: comp.data ? Object.keys(comp.data) : [],
      dataPreview: comp.component === 'data_table' ? {
        columns: comp.data?.columns?.length || 0,
        rows: comp.data?.rows?.length || 0,
        firstRowPreview: comp.data?.rows?.[0]
      } : comp.data
    }))
  });

  if (!components || components.length === 0) {
    console.log('🔍 DEBUG: UIComponentRenderer - No components to render');
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {components.map((component, index) => (
        <SingleUIComponent
          key={index}
          component={component}
          onAction={onAction}
          compact={compact}
        />
      ))}
    </div>
  );
}

/**
 * Single UI Component Renderer
 */
interface SingleUIComponentProps {
  component: UIComponent;
  onAction?: (action: string, data?: any) => void;
  compact?: boolean;
}

function SingleUIComponent({ component, onAction, compact = false }: SingleUIComponentProps) {
  try {
    switch (component.component) {
      case 'receipt_card':
        return (
          <ReceiptCardComponent
            data={component.data as any}
            onAction={onAction}
            compact={compact}
          />
        );

      case 'line_item_card':
        return (
          <LineItemCardComponent
            data={component.data as any}
            onAction={onAction}
            compact={compact}
          />
        );

      case 'action_button':
        return (
          <ActionButtonComponent
            data={component.data as any}
            onAction={onAction}
            compact={compact}
          />
        );

      case 'data_table':
        return (
          <DataTableComponent
            data={component.data as any}
            onAction={onAction}
            compact={compact}
          />
        );

      case 'bar_chart':
        return (
          <BarChartComponent
            data={component.data as any}
            onAction={onAction}
            compact={compact}
          />
        );

      case 'pie_chart':
        return (
          <PieChartComponent
            data={component.data as any}
            onAction={onAction}
            compact={compact}
          />
        );

      case 'summary_card':
        return (
          <SummaryCardComponent
            data={component.data as any}
            onAction={onAction}
            compact={compact}
          />
        );

      case 'section_header':
        return (
          <SectionHeaderComponent
            data={component.data as any}
            onAction={onAction}
            compact={compact}
          />
        );

      case 'spending_chart':
        return (
          <UnsupportedComponent
            type="spending_chart"
            message="Spending charts coming soon!"
          />
        );

      case 'category_breakdown':
        return (
          <UnsupportedComponent 
            type="category_breakdown" 
            message="Category breakdown coming soon!" 
          />
        );

      case 'trend_chart':
        return (
          <UnsupportedComponent 
            type="trend_chart" 
            message="Trend charts coming soon!" 
          />
        );

      case 'merchant_summary':
        return (
          <UnsupportedComponent 
            type="merchant_summary" 
            message="Merchant summaries coming soon!" 
          />
        );

      case 'financial_insight':
        return (
          <UnsupportedComponent 
            type="financial_insight" 
            message="Financial insights coming soon!" 
          />
        );

      default:
        return (
          <UnsupportedComponent 
            type={component.component} 
            message={`Unknown component type: ${component.component}`} 
          />
        );
    }
  } catch (error) {
    console.error('Error rendering UI component:', error);
    return (
      <ErrorComponent 
        error={error.message} 
        componentType={component.component}
      />
    );
  }
}

/**
 * Unsupported Component Placeholder
 */
interface UnsupportedComponentProps {
  type: string;
  message: string;
}

function UnsupportedComponent({ type, message }: UnsupportedComponentProps) {
  return (
    <Alert className="border-dashed">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <strong>{type.replace('_', ' ').toUpperCase()}</strong>: {message}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Error Component for Failed Renders
 */
interface ErrorComponentProps {
  error: string;
  componentType: string;
}

function ErrorComponent({ error, componentType }: ErrorComponentProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <strong>Component Error ({componentType})</strong>: {error}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Component Group Renderer
 * Renders multiple components with proper spacing and layout
 */
interface ComponentGroupProps {
  components: UIComponent[];
  onAction?: (action: string, data?: any) => void;
  title?: string;
  className?: string;
  compact?: boolean;
  layout?: 'stack' | 'grid' | 'inline';
}

export function ComponentGroup({ 
  components, 
  onAction, 
  title, 
  className = '', 
  compact = false,
  layout = 'stack'
}: ComponentGroupProps) {
  if (!components || components.length === 0) {
    return null;
  }

  const getLayoutClasses = () => {
    switch (layout) {
      case 'grid':
        return 'grid grid-cols-1 md:grid-cols-2 gap-3';
      case 'inline':
        return 'flex flex-wrap gap-2';
      case 'stack':
      default:
        return 'space-y-3';
    }
  };

  return (
    <div className={`${className}`}>
      {title && (
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          {title}
        </h4>
      )}
      <div className={getLayoutClasses()}>
        {components.map((component, index) => (
          <SingleUIComponent
            key={index}
            component={component}
            onAction={onAction}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Utility function to group components by type
 */
export function groupComponentsByType(components: UIComponent[]): Record<string, UIComponent[]> {
  return components.reduce((groups, component) => {
    const type = component.component;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(component);
    return groups;
  }, {} as Record<string, UIComponent[]>);
}

/**
 * Utility function to filter components by priority
 */
export function filterComponentsByPriority(
  components: UIComponent[], 
  priority: 'high' | 'medium' | 'low'
): UIComponent[] {
  return components.filter(component => 
    component.metadata.priority === priority
  );
}

/**
 * Utility function to sort components by priority
 */
export function sortComponentsByPriority(components: UIComponent[]): UIComponent[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  
  return [...components].sort((a, b) => {
    const aPriority = a.metadata.priority || 'medium';
    const bPriority = b.metadata.priority || 'medium';
    return priorityOrder[aPriority] - priorityOrder[bPriority];
  });
}
