import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { cn } from "@/lib/utils"

interface EnhancedScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  showScrollIndicator?: boolean;
  fadeEdges?: boolean;
  maxHeight?: string;
}

const EnhancedScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  EnhancedScrollAreaProps
>(({ className, children, showScrollIndicator = true, fadeEdges = true, maxHeight, ...props }, ref) => {
  const [isScrollable, setIsScrollable] = React.useState(false);
  const [showTopFade, setShowTopFade] = React.useState(false);
  const [showBottomFade, setShowBottomFade] = React.useState(false);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const checkScrollable = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const { scrollHeight, clientHeight, scrollTop } = viewport;
    const scrollable = scrollHeight > clientHeight;
    
    setIsScrollable(scrollable);
    
    if (fadeEdges && scrollable) {
      setShowTopFade(scrollTop > 10);
      setShowBottomFade(scrollTop < scrollHeight - clientHeight - 10);
    }
  }, [fadeEdges]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Initial check
    checkScrollable();

    // Check on scroll
    const handleScroll = () => checkScrollable();
    viewport.addEventListener('scroll', handleScroll);

    // Check on resize
    const resizeObserver = new ResizeObserver(checkScrollable);
    resizeObserver.observe(viewport);

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [checkScrollable]);

  return (
    <div className="relative">
      <ScrollAreaPrimitive.Root
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        style={{ maxHeight }}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          ref={viewportRef}
          className="h-full w-full rounded-[inherit] scroll-smooth"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch', // iOS smooth scrolling
            overscrollBehavior: 'contain' // Prevent scroll chaining
          }}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        
        {/* Enhanced scroll bar */}
        <ScrollAreaPrimitive.ScrollAreaScrollbar
          orientation="vertical"
          className={cn(
            "flex touch-none select-none transition-all duration-300",
            "h-full w-2.5 border-l border-l-transparent p-[1px]",
            isScrollable && showScrollIndicator ? "opacity-100" : "opacity-0 hover:opacity-100"
          )}
        >
          <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border hover:bg-border/80 transition-colors" />
        </ScrollAreaPrimitive.ScrollAreaScrollbar>
        
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>

      {/* Fade edges */}
      {fadeEdges && (
        <>
          {showTopFade && (
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
          )}
          {showBottomFade && (
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
          )}
        </>
      )}

      {/* Scroll indicator */}
      {showScrollIndicator && isScrollable && (
        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border pointer-events-none z-10">
          Scroll for more
        </div>
      )}
    </div>
  );
});

EnhancedScrollArea.displayName = "EnhancedScrollArea";

export { EnhancedScrollArea };
