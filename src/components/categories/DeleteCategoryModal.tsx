import React, { useState } from "react";
import { AlertTriangle, Tag } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { CustomCategory } from "@/types/receipt";

interface DeleteCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: CustomCategory | null;
  categories: CustomCategory[]; // Other categories for reassignment
  onConfirm: (reassignToCategoryId?: string | null) => void;
  isDeleting: boolean;
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  categories,
  onConfirm,
  isDeleting,
}) => {
  const [reassignmentOption, setReassignmentOption] = useState<"none" | "category">("none");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  if (!category) return null;

  const hasReceipts = (category.receipt_count || 0) > 0;
  const hasOtherCategories = categories.length > 0;

  const handleConfirm = () => {
    if (reassignmentOption === "category" && selectedCategoryId) {
      onConfirm(selectedCategoryId);
    } else {
      onConfirm(null);
    }
  };

  const handleClose = () => {
    setReassignmentOption("none");
    setSelectedCategoryId("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Category
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Info */}
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <Badge variant="secondary" className="gap-1">
              <Tag size={12} />
              {category.name}
            </Badge>
            <span className="text-sm text-muted-foreground">
              ({category.receipt_count || 0} receipts)
            </span>
          </div>

          {/* Warning */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium mb-1">
              This action cannot be undone
            </p>
            <p className="text-sm text-muted-foreground">
              {hasReceipts
                ? `This category is assigned to ${category.receipt_count} receipt(s). Choose what to do with them below.`
                : "This category will be permanently deleted."}
            </p>
          </div>

          {/* Reassignment Options */}
          {hasReceipts && (
            <div className="space-y-3">
              <Label>What should happen to receipts in this category?</Label>
              <RadioGroup
                value={reassignmentOption}
                onValueChange={(value) => setReassignmentOption(value as "none" | "category")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none" className="text-sm">
                    Remove category (receipts become uncategorized)
                  </Label>
                </div>
                
                {hasOtherCategories && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="category" id="category" />
                    <Label htmlFor="category" className="text-sm">
                      Move to another category
                    </Label>
                  </div>
                )}
              </RadioGroup>

              {/* Category Selection */}
              {reassignmentOption === "category" && hasOtherCategories && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="reassign-category">Select category:</Label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={setSelectedCategoryId}
                  >
                    <SelectTrigger id="reassign-category">
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={
              isDeleting ||
              (reassignmentOption === "category" && !selectedCategoryId)
            }
          >
            {isDeleting ? "Deleting..." : "Delete Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
