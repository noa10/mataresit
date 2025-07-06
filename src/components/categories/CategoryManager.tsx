import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Trash2,
  Tag,
  Palette,
  MoreHorizontal,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import {
  fetchUserCategories,
  deleteCategory,
} from "@/services/categoryService";
import { CustomCategory } from "@/types/receipt";
import { CategoryFormModal } from "./CategoryFormModal";
import { DeleteCategoryModal } from "./DeleteCategoryModal";
import { useCategoriesTranslation } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";

export const CategoryManager: React.FC = () => {
  const { t } = useCategoriesTranslation();
  const queryClient = useQueryClient();
  const { currentTeam } = useTeam();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CustomCategory | null>(null);

  // TEAM COLLABORATION FIX: Include team context in categories query
  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["categories", currentTeam?.id],
    queryFn: () => fetchUserCategories({ currentTeam }),
  });

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: ({ categoryId, reassignToCategoryId }: {
      categoryId: string;
      reassignToCategoryId?: string | null
    }) => deleteCategory(categoryId, reassignToCategoryId),
    onSuccess: () => {
      // TEAM COLLABORATION FIX: Invalidate team-aware caches
      queryClient.invalidateQueries({ queryKey: ["categories", currentTeam?.id] });
      queryClient.invalidateQueries({ queryKey: ["categories"] }); // Fallback for safety
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      setDeletingCategory(null);
    },
  });

  const handleEdit = (category: CustomCategory) => {
    setEditingCategory(category);
  };

  const handleDelete = (category: CustomCategory) => {
    setDeletingCategory(category);
  };

  const handleDeleteConfirm = (reassignToCategoryId?: string | null) => {
    if (deletingCategory) {
      deleteMutation.mutate({
        categoryId: deletingCategory.id,
        reassignToCategoryId,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t('title')}</h2>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('error.loadFailed')}</h3>
        <p className="text-muted-foreground">{t('error.tryRefresh')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
          <Plus size={16} />
          {t('actions.newCategory')}
        </Button>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Tag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('empty.title')}</h3>
          <p className="text-muted-foreground mb-6">
            {t('empty.description')}
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            {t('actions.createCategory')}
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {categories.map((category) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(category)}>
                            <Edit2 size={16} className="mr-2" />
                            {t('actions.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(category)}
                            className="text-destructive"
                          >
                            <Trash2 size={16} className="mr-2" />
                            {t('actions.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="gap-1">
                        <Tag size={12} />
                        {t('receiptCount', { count: category.receipt_count || 0 })}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Palette size={12} />
                        {category.color}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <CategoryFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          // TEAM COLLABORATION FIX: Invalidate team-aware caches
          queryClient.invalidateQueries({ queryKey: ["categories", currentTeam?.id] });
          queryClient.invalidateQueries({ queryKey: ["categories"] }); // Fallback for safety
          setIsCreateModalOpen(false);
        }}
      />

      <CategoryFormModal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        category={editingCategory}
        onSuccess={() => {
          // TEAM COLLABORATION FIX: Invalidate team-aware caches
          queryClient.invalidateQueries({ queryKey: ["categories", currentTeam?.id] });
          queryClient.invalidateQueries({ queryKey: ["categories"] }); // Fallback for safety
          setEditingCategory(null);
        }}
      />

      <DeleteCategoryModal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        category={deletingCategory}
        categories={categories.filter((c) => c.id !== deletingCategory?.id)}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};
