import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Tag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";

import { fetchUserCategories } from "@/services/categoryService";
import { CustomCategory } from "@/types/receipt";
import { CategoryFormModal } from "./CategoryFormModal";
import { useTeam } from "@/contexts/TeamContext";

interface CategorySelectorProps {
  value?: string | null;
  onChange: (categoryId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  className?: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  value,
  onChange,
  placeholder = "Select category...",
  disabled = false,
  allowCreate = true,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { currentTeam } = useTeam();

  // TEAM COLLABORATION FIX: Include team context in categories query
  const {
    data: categories = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["categories", currentTeam?.id],
    queryFn: () => fetchUserCategories({ currentTeam }),
  });

  const selectedCategory = categories.find((cat) => cat.id === value);

  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    setOpen(false);
  };

  const handleCreateSuccess = () => {
    refetch();
    setIsCreateModalOpen(false);
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`w-full justify-between ${className}`}
            disabled={disabled}
          >
            {selectedCategory ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCategory.color }}
                />
                <span>{selectedCategory.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <Tag className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No categories found.</CommandEmpty>
              
              {/* Clear Selection */}
              {value && (
                <>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleSelect(null)}
                      className="text-muted-foreground"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove category
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Categories */}
              <CommandGroup heading="Categories">
                {categories.map((category) => (
                  <CommandItem
                    key={category.id}
                    onSelect={() => handleSelect(category.id)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {category.receipt_count || 0}
                      </Badge>
                    </div>
                    {value === category.id && (
                      <Check className="ml-2 h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>

              {/* Create New Category */}
              {allowCreate && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setIsCreateModalOpen(true);
                      }}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create new category
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Category Modal */}
      <CategoryFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
};

// Simplified version for display only
interface CategoryDisplayProps {
  category: CustomCategory | null;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
}

export const CategoryDisplay: React.FC<CategoryDisplayProps> = ({
  category,
  showCount = false,
  size = "md",
}) => {
  // Define size-specific classes using Tailwind utilities
  const sizeClasses = {
    sm: "text-[0.7rem] px-1.5 py-0.5 max-w-[90px]",
    md: "text-xs px-2 py-0.5 max-w-[120px]",
    lg: "text-sm px-2.5 py-1 max-w-[140px]",
  } as const;

  // Base pill styling with proper centering and background
  const basePill = `inline-flex items-center justify-center gap-1 font-medium rounded-md shrink-0 border leading-none ${sizeClasses[size]}`;

  if (!category) {
    // Uncategorized badge with muted styling
    return (
      <div
        className={`${basePill} bg-muted/50 text-muted-foreground border-border`}
        data-debug="uncategorized-badge"
        data-size={size}
      >
        <Tag size={12} />
        <span className="truncate">Uncategorized</span>
      </div>
    );
  }

  // Categorized badge with secondary styling
  return (
    <div className={`${basePill} bg-secondary text-secondary-foreground border-transparent`}>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: category.color }}
      />
      <span className="truncate">{category.name}</span>
      {showCount && category.receipt_count !== undefined && (
        <span className="ml-1 opacity-70 shrink-0">({category.receipt_count})</span>
      )}
    </div>
  );
};
