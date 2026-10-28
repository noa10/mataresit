import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTeamTranslation } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shared team creation flow. Creates the team through TeamContext and switches
 * straight into it, matching the old workspace selector behaviour.
 */
export function CreateTeamDialog({ open, onOpenChange }: CreateTeamDialogProps) {
  const { createTeam, switchTeam } = useTeam();
  const { t } = useTeamTranslation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (creating) return;
    if (!nextOpen) {
      setName("");
      setDescription("");
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName || creating) return;

    try {
      setCreating(true);
      const teamId = await createTeam(
        trimmedName,
        description.trim() || undefined
      );
      await switchTeam(teamId);
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch {
      // TeamContext already surfaces the failure toast.
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
            <DialogDescription>{t("create.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-team-name">{t("create.fields.name")}</Label>
              <Input
                id="create-team-name"
                placeholder={t("create.placeholders.name")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={creating}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-team-description">
                {t("create.fields.description")}
              </Label>
              <Textarea
                id="create-team-description"
                placeholder={t("create.placeholders.description")}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={creating}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={creating}
            >
              {t("create.actions.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {creating
                ? t("create.actions.creating")
                : t("create.actions.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
