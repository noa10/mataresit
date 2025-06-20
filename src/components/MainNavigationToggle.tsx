import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface MainNavigationToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export function MainNavigationToggle({
  isOpen,
  onToggle,
  className
}: MainNavigationToggleProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn("relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="flex items-center justify-center"
        title={`${isOpen ? 'Close' : 'Open'} navigation menu (Ctrl+B)`}
        aria-label={`${isOpen ? 'Close' : 'Open'} navigation menu`}
        aria-expanded={isOpen}
        aria-controls="main-navigation-sidebar"
      >
        <Menu className={cn(
          "h-4 w-4 transition-all duration-300",
          isHovered && "transform rotate-90"
        )} />
      </Button>
    </div>
  );
}
