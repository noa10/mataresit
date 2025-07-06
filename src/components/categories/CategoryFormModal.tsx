import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Palette, Tag } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  createCategory,
  updateCategory,
  validateCategoryData,
  DEFAULT_CATEGORY_COLORS,
  DEFAULT_CATEGORY_ICONS,
} from "@/services/categoryService";
import { CustomCategory, CreateCategoryRequest, UpdateCategoryRequest } from "@/types/receipt";
import { useTeam } from "@/contexts/TeamContext";

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category?: CustomCategory | null; // If provided, we're editing
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  category,
}) => {
  const { currentTeam } = useTeam();
  const isEditing = !!category;
  const [formData, setFormData] = useState({
    name: "",
    color: DEFAULT_CATEGORY_COLORS[0],
    icon: DEFAULT_CATEGORY_ICONS[0],
  });
  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      if (category) {
        setFormData({
          name: category.name,
          color: category.color,
          icon: category.icon,
        });
      } else {
        setFormData({
          name: "",
          color: DEFAULT_CATEGORY_COLORS[0],
          icon: DEFAULT_CATEGORY_ICONS[0],
        });
      }
      setErrors([]);
    }
  }, [isOpen, category]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryRequest) => createCategory(data, { currentTeam }),
    onSuccess: (result) => {
      if (result) {
        onSuccess();
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateCategoryRequest) => 
      updateCategory(category!.id, data),
    onSuccess: (result) => {
      if (result) {
        onSuccess();
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    const validationErrors = validateCategoryData(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Category" : "Create New Category"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter category name"
              maxLength={50}
              required
            />
            <div className="text-xs text-muted-foreground">
              {formData.name.length}/50 characters
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {DEFAULT_CATEGORY_COLORS.map((color) => (
                <motion.button
                  key={color}
                  type="button"
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                    formData.color === color
                      ? "border-primary scale-110"
                      : "border-border hover:border-primary/50"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {formData.color === color && (
                    <Check size={16} className="text-white drop-shadow-sm" />
                  )}
                </motion.button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-8 p-1 border rounded"
              />
              <span className="text-sm text-muted-foreground">
                Or choose custom color
              </span>
            </div>
          </div>

          {/* Icon Selection */}
          <div className="space-y-3">
            <Label>Icon</Label>
            <div className="grid grid-cols-5 gap-2">
              {DEFAULT_CATEGORY_ICONS.map((icon) => (
                <Button
                  key={icon}
                  type="button"
                  variant={formData.icon === icon ? "default" : "outline"}
                  size="sm"
                  className="h-10"
                  onClick={() => setFormData({ ...formData, icon })}
                >
                  <Tag size={16} />
                </Button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: formData.color }}
              />
              <Badge variant="secondary" className="gap-1">
                <Tag size={12} />
                {formData.name || "Category Name"}
              </Badge>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="space-y-1">
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-destructive">
                  {error}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
