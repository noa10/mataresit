import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Trash2,
  User,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { fetchUserPayers, archivePayer } from "@/services/paidByService";
import { PaidBy } from "@/types/receipt";
import { PayerFormModal } from "./PayerFormModal";
import { useTeam } from "@/contexts/TeamContext";
import { useSettingsTranslation } from "@/contexts/LanguageContext";

export const PayerManager: React.FC = () => {
  const { t } = useSettingsTranslation();
  const queryClient = useQueryClient();
  const { currentTeam } = useTeam();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPayer, setEditingPayer] = useState<PaidBy | null>(null);
  const [deletingPayer, setDeletingPayer] = useState<PaidBy | null>(null);

  const {
    data: payers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["payers", currentTeam?.id],
    queryFn: () => fetchUserPayers({ currentTeam }),
  });

  const deleteMutation = useMutation({
    mutationFn: (payerId: string) => archivePayer(payerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payers", currentTeam?.id] });
      queryClient.invalidateQueries({ queryKey: ["payers"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      setDeletingPayer(null);
    },
  });

  const handleEdit = (payer: PaidBy) => {
    setEditingPayer(payer);
  };

  const handleDelete = (payer: PaidBy) => {
    setDeletingPayer(payer);
  };

  const handleDeleteConfirm = () => {
    if (deletingPayer) {
      deleteMutation.mutate(deletingPayer.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("payers.title")}</h2>
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
        <h3 className="text-lg font-medium mb-2">{t("payers.loadFailed")}</h3>
        <p className="text-muted-foreground">{t("payers.tryRefresh")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t("payers.title")}</h2>
          <p className="text-muted-foreground">
            {t("payers.description")}
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
          <Plus size={16} />
          {t("payers.newPayer")}
        </Button>
      </div>

      {payers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t("payers.emptyTitle")}</h3>
          <p className="text-muted-foreground mb-6">
            {t("payers.emptyDescription")}
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            {t("payers.createPayer")}
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {payers.map((payer) => (
              <motion.div
                key={payer.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-muted-foreground" />
                        <CardTitle className="text-lg">{payer.name}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(payer)}>
                            <Edit2 size={16} className="mr-2" />
                            {t("payers.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(payer)}
                            className="text-destructive"
                          >
                            <Trash2 size={16} className="mr-2" />
                            {t("payers.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <User size={12} />
                        {t("payers.receiptCount", { count: payer.receipt_count || 0 })}
                      </Badge>
                      {payer.is_team_payer && (
                        <Badge variant="outline">{t("payers.team")}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <PayerFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["payers", currentTeam?.id] });
          queryClient.invalidateQueries({ queryKey: ["payers"] });
          setIsCreateModalOpen(false);
        }}
      />

      <PayerFormModal
        isOpen={!!editingPayer}
        onClose={() => setEditingPayer(null)}
        payer={editingPayer}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["payers", currentTeam?.id] });
          queryClient.invalidateQueries({ queryKey: ["payers"] });
          setEditingPayer(null);
        }}
      />

      <AlertDialog open={!!deletingPayer} onOpenChange={() => setDeletingPayer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("payers.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("payers.deleteDescription", { name: deletingPayer?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("payers.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("payers.deleting") : t("payers.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
