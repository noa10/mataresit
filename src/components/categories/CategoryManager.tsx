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
  PlusCircle,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  fetchUserCategories,
  deleteCategory,
} from "@/services/categoryService";
import { archiveCategoryRule, fetchCategoryRules, upsertCategoryRule } from "@/services/categoryRuleService";
import { deleteCategoryAlias, fetchCategoryAliases, upsertCategoryAlias } from "@/services/categoryAliasService";
import { CategoryAlias, CategoryRule, CategoryRuleMatchType, CustomCategory } from "@/types/receipt";
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
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleCategoryId, setNewRuleCategoryId] = useState("");
  const [newRuleMatchType, setNewRuleMatchType] = useState<CategoryRuleMatchType>("merchant_exact");
  const [newAliasText, setNewAliasText] = useState("");
  const [newAliasCategoryId, setNewAliasCategoryId] = useState("");

  // TEAM COLLABORATION FIX: Include team context in categories query
  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["categories", currentTeam?.id],
    queryFn: () => fetchUserCategories({ currentTeam }),
  });
  const {
    data: categoryRules = [],
    isLoading: isRulesLoading,
  } = useQuery({
    queryKey: ["categoryRules", currentTeam?.id],
    queryFn: () => fetchCategoryRules({ currentTeam }),
  });
  const {
    data: categoryAliases = [],
    isLoading: isAliasesLoading,
  } = useQuery({
    queryKey: ["categoryAliases", currentTeam?.id],
    queryFn: () => fetchCategoryAliases({ currentTeam }),
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

  const createRuleMutation = useMutation({
    mutationFn: () =>
      upsertCategoryRule(
        {
          matchType: newRuleMatchType,
          pattern: newRulePattern,
          categoryId: newRuleCategoryId,
          priority: 0,
        },
        { currentTeam }
      ),
    onSuccess: (ruleId) => {
      if (!ruleId) return;
      queryClient.invalidateQueries({ queryKey: ["categoryRules", currentTeam?.id] });
      setNewRulePattern("");
      setNewRuleCategoryId("");
      setNewRuleMatchType("merchant_exact");
    },
  });

  const archiveRuleMutation = useMutation({
    mutationFn: (ruleId: string) => archiveCategoryRule(ruleId),
    onSuccess: (ok) => {
      if (!ok) return;
      queryClient.invalidateQueries({ queryKey: ["categoryRules", currentTeam?.id] });
    },
  });

  const createAliasMutation = useMutation({
    mutationFn: () =>
      upsertCategoryAlias(
        {
          alias: newAliasText,
          categoryId: newAliasCategoryId,
        },
        { currentTeam }
      ),
    onSuccess: (aliasId) => {
      if (!aliasId) return;
      queryClient.invalidateQueries({ queryKey: ["categoryAliases", currentTeam?.id] });
      setNewAliasText("");
      setNewAliasCategoryId("");
    },
  });

  const deleteAliasMutation = useMutation({
    mutationFn: (aliasId: string) => deleteCategoryAlias(aliasId),
    onSuccess: (ok) => {
      if (!ok) return;
      queryClient.invalidateQueries({ queryKey: ["categoryAliases", currentTeam?.id] });
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

  const handleCreateRule = () => {
    if (!newRulePattern.trim() || !newRuleCategoryId) return;
    createRuleMutation.mutate();
  };

  const handleCreateAlias = () => {
    if (!newAliasText.trim() || !newAliasCategoryId) return;
    createAliasMutation.mutate();
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

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories">{t("tabs.categories")}</TabsTrigger>
          <TabsTrigger value="rules">{t("tabs.rules")}</TabsTrigger>
          <TabsTrigger value="aliases">{t("tabs.aliases")}</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
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
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("rules.newTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>{t("rules.pattern")}</Label>
                  <Input
                    value={newRulePattern}
                    onChange={(event) => setNewRulePattern(event.target.value)}
                    placeholder={t("rules.patternPlaceholder")}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("rules.matchType")}</Label>
                  <Select value={newRuleMatchType} onValueChange={(value) => setNewRuleMatchType(value as CategoryRuleMatchType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merchant_exact">{t("rules.merchantExact")}</SelectItem>
                      <SelectItem value="merchant_contains">{t("rules.merchantContains")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("rules.category")}</Label>
                  <Select value={newRuleCategoryId} onValueChange={setNewRuleCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("rules.selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleCreateRule}
                disabled={!newRulePattern.trim() || !newRuleCategoryId || createRuleMutation.isPending}
                className="gap-2"
              >
                <PlusCircle size={16} />
                {t("rules.save")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("rules.existingTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isRulesLoading && <p className="text-sm text-muted-foreground">{t("rules.loading")}</p>}
              {!isRulesLoading && categoryRules.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("rules.empty")}</p>
              )}
              {categoryRules.filter((rule) => !rule.archived).map((rule: CategoryRule) => (
                <div key={rule.id} className="flex items-center justify-between border rounded p-3">
                  <div className="space-y-1">
                    <p className="font-medium">{rule.pattern}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule.match_type} • {rule.category_name || t("rules.unknownCategory")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => archiveRuleMutation.mutate(rule.id)}
                    disabled={archiveRuleMutation.isPending}
                  >
                    {t("rules.archive")}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aliases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("aliases.newTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>{t("aliases.label")}</Label>
                  <Input
                    value={newAliasText}
                    onChange={(event) => setNewAliasText(event.target.value)}
                    placeholder={t("aliases.placeholder")}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("aliases.category")}</Label>
                  <Select value={newAliasCategoryId} onValueChange={setNewAliasCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("aliases.selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleCreateAlias}
                disabled={!newAliasText.trim() || !newAliasCategoryId || createAliasMutation.isPending}
                className="gap-2"
              >
                <PlusCircle size={16} />
                {t("aliases.save")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("aliases.existingTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isAliasesLoading && <p className="text-sm text-muted-foreground">{t("aliases.loading")}</p>}
              {!isAliasesLoading && categoryAliases.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("aliases.empty")}</p>
              )}
              {categoryAliases.map((alias: CategoryAlias) => (
                <div key={alias.id} className="flex items-center justify-between border rounded p-3">
                  <div className="space-y-1">
                    <p className="font-medium">{alias.alias}</p>
                    <p className="text-xs text-muted-foreground">{alias.category_name || t("aliases.unknownCategory")}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteAliasMutation.mutate(alias.id)}
                    disabled={deleteAliasMutation.isPending}
                  >
                    {t("aliases.delete")}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
