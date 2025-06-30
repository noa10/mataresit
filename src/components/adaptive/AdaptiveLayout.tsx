// Adaptive Layout Component
// Phase 5: Personalization & Memory System - Task 4

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAdaptiveUI } from '@/hooks/useAdaptiveUI';
import { AdaptiveContainer } from './AdaptiveContainer';
import { AdaptiveNavigation } from './AdaptiveNavigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  PanelLeft,
  PanelRight,
  Maximize2,
  Minimize2,
  Layout,
  Zap,
  Settings
} from 'lucide-react';

interface AdaptiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  enableAdaptation?: boolean;
  showAdaptationControls?: boolean;
}

export function AdaptiveLayout({
  children,
  sidebar,
  header,
  footer,
  className,
  enableAdaptation = true,
  showAdaptationControls = false
}: AdaptiveLayoutProps) {
  const {
    getLayoutConfig,
    isCompactLayout,
    getSidebarPosition,
    getNavigationStyle,
    adaptationConfidence,
    trackComponentInteraction,
    adaptUI
  } = useAdaptiveUI();

  const [isAdaptationVisible, setIsAdaptationVisible] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<string, any>>({});

  const layoutConfig = getLayoutConfig();
  const sidebarPosition = getSidebarPosition();
  const navigationStyle = getNavigationStyle();
  const isCompact = isCompactLayout();

  // Track layout interactions
  useEffect(() => {
    trackComponentInteraction('adaptive-layout', 'mount');
  }, [trackComponentInteraction]);

  const handleSidebarToggle = () => {
    const newPosition = sidebarPosition === 'hidden' ? 'left' : 'hidden';
    setManualOverrides(prev => ({ ...prev, sidebarPosition: newPosition }));
    trackComponentInteraction('adaptive-layout', 'sidebar_toggle');
  };

  const handleLayoutToggle = () => {
    const newLayout = isCompact ? 'spacious' : 'compact';
    setManualOverrides(prev => ({ ...prev, layoutType: newLayout }));
    trackComponentInteraction('adaptive-layout', 'layout_toggle');
  };

  const handleAdaptationRefresh = async () => {
    await adaptUI();
    trackComponentInteraction('adaptive-layout', 'adaptation_refresh');
  };

  // Apply manual overrides to layout config
  const effectiveSidebarPosition = manualOverrides.sidebarPosition || sidebarPosition;
  const effectiveLayoutType = manualOverrides.layoutType || layoutConfig.layoutType;
  const effectiveIsCompact = effectiveLayoutType === 'compact';

  // Determine grid template based on sidebar position and layout
  const getGridTemplate = () => {
    if (effectiveSidebarPosition === 'hidden') {
      return 'grid-cols-1';
    }
    
    if (effectiveIsCompact) {
      return effectiveSidebarPosition === 'right' 
        ? 'grid-cols-[1fr_200px]' 
        : 'grid-cols-[200px_1fr]';
    }
    
    return effectiveSidebarPosition === 'right' 
      ? 'grid-cols-[1fr_280px]' 
      : 'grid-cols-[280px_1fr]';
  };

  const renderSidebar = () => {
    if (effectiveSidebarPosition === 'hidden') return null;

    const sidebarContent = sidebar || (
      <AdaptiveNavigation 
        orientation="vertical"
        showLabels={!effectiveIsCompact}
      />
    );

    return (
      <AdaptiveContainer
        componentId="adaptive-sidebar"
        className={cn(
          'adaptive-sidebar border-r bg-muted/30',
          effectiveIsCompact ? 'w-[200px]' : 'w-[280px]',
          effectiveSidebarPosition === 'right' && 'border-l border-r-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className={cn(
                'font-semibold',
                effectiveIsCompact ? 'text-sm' : 'text-base'
              )}>
                Navigation
              </h2>
              {adaptationConfidence > 0.5 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        {(adaptationConfidence * 100).toFixed(0)}%
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        Adaptation Confidence: {(adaptationConfidence * 100).toFixed(1)}%
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {sidebarContent}
          </div>

          {/* Adaptation Controls */}
          {showAdaptationControls && (
            <div className="p-4 border-t">
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdaptationVisible(!isAdaptationVisible)}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Layout Controls
                </Button>
                
                {isAdaptationVisible && (
                  <div className="space-y-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLayoutToggle}
                      className="w-full justify-start"
                    >
                      {effectiveIsCompact ? <Maximize2 className="h-4 w-4 mr-2" /> : <Minimize2 className="h-4 w-4 mr-2" />}
                      {effectiveIsCompact ? 'Expand' : 'Compact'}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAdaptationRefresh}
                      className="w-full justify-start"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Refresh Adaptation
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AdaptiveContainer>
    );
  };

  const renderHeader = () => {
    if (!header) return null;

    return (
      <AdaptiveContainer
        componentId="adaptive-header"
        className="adaptive-header border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        {header}
      </AdaptiveContainer>
    );
  };

  const renderFooter = () => {
    if (!footer) return null;

    return (
      <AdaptiveContainer
        componentId="adaptive-footer"
        className="adaptive-footer border-t bg-muted/30"
      >
        {footer}
      </AdaptiveContainer>
    );
  };

  const renderMainContent = () => {
    return (
      <AdaptiveContainer
        componentId="adaptive-main-content"
        className={cn(
          'adaptive-main-content flex flex-col min-h-0',
          effectiveIsCompact ? 'p-4' : 'p-6'
        )}
      >
        {/* Content Header */}
        {enableAdaptation && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layout className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {effectiveLayoutType} layout • {navigationStyle} navigation
              </span>
            </div>
            
            {showAdaptationControls && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSidebarToggle}
                >
                  {effectiveSidebarPosition === 'left' ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : effectiveSidebarPosition === 'right' ? (
                    <PanelRight className="h-4 w-4" />
                  ) : (
                    <PanelLeft className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </AdaptiveContainer>
    );
  };

  return (
    <div className={cn(
      'adaptive-layout min-h-screen bg-background',
      className
    )}>
      {/* Header */}
      {renderHeader()}

      {/* Main Layout Grid */}
      <div className={cn(
        'grid min-h-0 flex-1',
        getGridTemplate()
      )}>
        {/* Sidebar - Left */}
        {effectiveSidebarPosition === 'left' && renderSidebar()}

        {/* Main Content */}
        {renderMainContent()}

        {/* Sidebar - Right */}
        {effectiveSidebarPosition === 'right' && renderSidebar()}
      </div>

      {/* Footer */}
      {renderFooter()}

      {/* Adaptation Status Indicator */}
      {enableAdaptation && adaptationConfidence > 0.3 && (
        <div className="fixed bottom-4 right-4 z-50">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge 
                  variant="outline" 
                  className="bg-background/95 backdrop-blur"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Adaptive UI
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <div>Layout adapted to your preferences</div>
                  <div className="text-muted-foreground">
                    Confidence: {(adaptationConfidence * 100).toFixed(1)}%
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

export default AdaptiveLayout;
