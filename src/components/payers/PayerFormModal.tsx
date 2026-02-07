import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createPayer,
  updatePayer,
  validatePayerData,
  fetchUserPayers,
} from "@/services/paidByService";
import { PaidBy } from "@/types/receipt";
import { useTeam } from "@/contexts/TeamContext";

interface PayerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onCreated?: (payerId: string, payerName: string) => void;
  payer?: PaidBy | null;
  initialName?: string;
}

export const PayerFormModal: React.FC<PayerFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onCreated,
  payer,
  initialName = "",
}) => {
  const { currentTeam } = useTeam();
  const isEditing = !!payer;
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);

  const { data: existingPayers = [] } = useQuery({
    queryKey: ["payers", currentTeam?.id],
    queryFn: () => fetchUserPayers({ currentTeam }),
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      if (payer) {
        setName(payer.name);
      } else {
        setName(initialName);
      }
      setErrors([]);
    }
  }, [isOpen, payer, initialName]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => createPayer(data, { currentTeam }),
    onSuccess: (result) => {
      if (result) {
        onCreated?.(result, name.trim());
        onSuccess();
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (newName: string) => updatePayer(payer!.id, newName),
    onSuccess: (result) => {
      if (result) {
        onSuccess();
      }
    },
  });

  const checkDuplicateAndSubmit = () => {
    if (!isEditing) {
      const duplicate = existingPayers.find(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) {
        setDuplicateConfirmOpen(true);
        return;
      }
    }
    performSubmit();
  };

  const performSubmit = () => {
    if (isEditing) {
      updateMutation.mutate(name.trim());
    } else {
      createMutation.mutate({ name: name.trim() });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validatePayerData({ name: name.trim() });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    checkDuplicateAndSubmit();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Payer" : "Create New Payer"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the payer name."
                : "Add a new payer to track who paid for receipts."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="payer-name">Payer Name</Label>
              <Input
                id="payer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter payer name"
                maxLength={50}
                required
                autoFocus
              />
              <div className="text-xs text-muted-foreground">
                {name.length}/50 characters
              </div>
            </div>

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

      <AlertDialog open={duplicateConfirmOpen} onOpenChange={setDuplicateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Duplicate Payer Name
            </AlertDialogTitle>
            <AlertDialogDescription>
              A payer named "{name.trim()}" already exists. Do you want to create
              another payer with the same name?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateConfirmOpen(false);
                performSubmit();
              }}
            >
              Create Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
