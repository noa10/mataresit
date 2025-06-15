import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMobileViewport } from "@/hooks/use-mobile-viewport"
import { cn } from "@/lib/utils"

const MobileDialog = DialogPrimitive.Root

const MobileDialogTrigger = DialogPrimitive.Trigger

const MobileDialogPortal = DialogPrimitive.Portal

const MobileDialogClose = DialogPrimitive.Close

const MobileDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
MobileDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Browser feature detection utilities
function supportsHasSelector(): boolean {
  if (typeof window === 'undefined' || !window.CSS) return false;
  try {
    return window.CSS.supports('selector(:has(*))');
  } catch {
    return false;
  }
}

function supportsVisualViewport(): boolean {
  return typeof window !== 'undefined' && 'visualViewport' in window;
}

const MobileDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const isMobile = useIsMobile()
  const { height, width, isLandscape } = useMobileViewport()

  // Cross-browser body scroll prevention
  React.useEffect(() => {
    if (!isMobile) return;

    const body = document.body;
    const hasSupport = supportsHasSelector();

    // Store original styles
    const originalOverflow = body.style.overflow;
    const originalPosition = body.style.position;
    const originalWidth = body.style.width;
    const originalHeight = body.style.height;
    const originalTop = body.style.top;

    // Apply styles
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    body.style.height = '100%';

    // For browsers without :has() support, add a class
    if (!hasSupport) {
      body.classList.add('modal-open');
    }

    // Handle iOS viewport issues
    if (supportsVisualViewport() && window.visualViewport) {
      body.style.top = `-${window.scrollY}px`;
    }

    return () => {
      // Restore original styles
      body.style.overflow = originalOverflow;
      body.style.position = originalPosition;
      body.style.width = originalWidth;
      body.style.height = originalHeight;
      body.style.top = originalTop;

      if (!hasSupport) {
        body.classList.remove('modal-open');
      }

      // Restore scroll position on iOS
      if (supportsVisualViewport() && originalTop) {
        const scrollY = parseInt(originalTop.replace('-', '').replace('px', '')) || 0;
        window.scrollTo(0, scrollY);
      }
    };
  }, [isMobile])

  // Calculate cross-browser safe dimensions
  const getModalStyle = React.useMemo(() => {
    if (!isMobile) return undefined;

    const style: React.CSSProperties = {};

    // Use visual viewport if available, fallback to window dimensions
    if (supportsVisualViewport() && window.visualViewport) {
      style.height = `${window.visualViewport.height}px`;
      style.maxHeight = `${window.visualViewport.height}px`;
      style.width = `${window.visualViewport.width}px`;
    } else {
      style.height = `${height}px`;
      style.maxHeight = `${height}px`;
      style.width = `${width}px`;
    }

    return style;
  }, [isMobile, height, width]);

  return (
    <MobileDialogPortal>
      <MobileDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        style={getModalStyle}
        className={cn(
          // Base styles with cross-browser prefixes
          "fixed z-50 grid gap-4 border bg-background shadow-lg duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          // Mobile styles - full screen with cross-browser support
          isMobile ? [
            "inset-0 w-full max-w-none",
            "rounded-none p-4",
            "overflow-y-auto overflow-x-hidden",
            // Cross-browser smooth scrolling
            "[overflow-scrolling:touch]",
            "[overscroll-behavior:contain]",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
          ] : [
            // Desktop styles - centered modal
            "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]",
            "w-full max-w-lg rounded-lg p-6",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          ],
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close 
          className={cn(
            "absolute rounded-sm opacity-70 ring-offset-background transition-opacity",
            "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
            isMobile ? "right-4 top-4" : "right-4 top-4"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </MobileDialogPortal>
  )
})
MobileDialogContent.displayName = DialogPrimitive.Content.displayName

const MobileDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
MobileDialogHeader.displayName = "MobileDialogHeader"

const MobileDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
MobileDialogFooter.displayName = "MobileDialogFooter"

const MobileDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
MobileDialogTitle.displayName = DialogPrimitive.Title.displayName

const MobileDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
MobileDialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  MobileDialog,
  MobileDialogPortal,
  MobileDialogOverlay,
  MobileDialogClose,
  MobileDialogTrigger,
  MobileDialogContent,
  MobileDialogHeader,
  MobileDialogFooter,
  MobileDialogTitle,
  MobileDialogDescription,
}
