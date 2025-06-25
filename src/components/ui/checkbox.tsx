import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  size?: "sm" | "md" | "lg";
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size = "md", style, ...props }, ref) => {
    const sizePx = size === "sm" ? 16 : size === "lg" ? 24 : 20;
  const sizeClass =
    size === "sm"
      ? "h-4 w-4"
      : size === "lg"
      ? "h-5 w-5 md:h-6 md:w-6"
      : "h-4 w-4 md:h-5 md:w-5"; // default md

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        `peer shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center flex-none p-0 min-h-0 min-w-0 appearance-none aspect-square data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ${sizeClass}`,
        className
      )}
      {...props}
      style={{ width: sizePx, height: sizePx, ...style }}
    >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
    );
  }
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
