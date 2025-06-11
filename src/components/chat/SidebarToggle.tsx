import React, { useState } from 'react';
import { MessageSquare, ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  showKeyboardHint?: boolean;
}

export function SidebarToggle({
  isOpen,
  onToggle,
  className,
  showKeyboardHint = false
}: SidebarToggleProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    onToggle();

    // Add a subtle haptic feedback effect
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "flex items-center justify-center transition-all duration-300 ease-in-out",
          "hover:bg-muted/50 hover:scale-105 active:scale-95",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          className
        )}
        title={`${isOpen ? "Close chat" : "Open chat history"} (Ctrl+B)`}
        aria-label={`${isOpen ? "Close chat" : "Open chat history"}`}
      >
        <div className="relative">
          {isOpen ? (
            <ChevronLeft className={cn(
              "h-4 w-4 transition-all duration-300",
              isHovered && "transform -translate-x-0.5"
            )} />
          ) : (
            <MessageSquare className={cn(
              "h-4 w-4 transition-all duration-300",
              isHovered && "transform rotate-180"
            )} />
          )}
        </div>
      </Button>

      {/* Keyboard shortcut hint */}
      {showKeyboardHint && isHovered && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded border shadow-md whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1 duration-200">
          Ctrl+B
        </div>
      )}
    </div>
  );
}
