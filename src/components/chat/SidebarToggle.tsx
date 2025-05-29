import React from 'react';
import { Menu, ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export function SidebarToggle({ isOpen, onToggle, className }: SidebarToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={cn(
        "flex items-center justify-center transition-all duration-200",
        "hover:bg-muted/50",
        className
      )}
      title={isOpen ? "Close sidebar" : "Open sidebar"}
    >
      {isOpen ? (
        <ChevronLeft className="h-4 w-4" />
      ) : (
        <Menu className="h-4 w-4" />
      )}
    </Button>
  );
}
