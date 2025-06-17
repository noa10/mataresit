import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Edit, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useProfileTranslation } from "@/contexts/LanguageContext";
import { updateProfile, ProfileData, getFullName } from "@/services/profileService";

// Note: Validation messages will be handled by translation keys in the component
const profileSchema = z.object({
  first_name: z.string().max(50).optional(),
  last_name: z.string().max(50).optional(),
  email: z.string().email().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileInfoEditorProps {
  profile: ProfileData;
  onProfileUpdate: (updatedProfile: ProfileData) => void;
}

export function ProfileInfoEditor({ profile, onProfileUpdate }: ProfileInfoEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { t } = useProfileTranslation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
    }
  });

  const handleEdit = () => {
    setIsEditing(true);
    reset({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    reset();
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsUpdating(true);

    try {
      const result = await updateProfile(profile.id, data);
      
      if (result.success && result.profile) {
        toast({
          title: t("notifications.updateSuccess"),
          description: t("notifications.updateSuccessDescription"),
        });
        onProfileUpdate(result.profile);
        setIsEditing(false);
      } else {
        toast({
          title: t("notifications.updateFailed"),
          description: result.error || t("notifications.updateFailedDescription"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: t("notifications.updateFailed"),
        description: t("notifications.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{t("editor.title")}</CardTitle>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            {t("editor.actions.edit")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">{t("editor.fields.firstName")}</Label>
                <Input
                  id="first_name"
                  {...register("first_name")}
                  placeholder={t("editor.placeholders.firstName")}
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{t("editor.validation.firstNameTooLong")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">{t("editor.fields.lastName")}</Label>
                <Input
                  id="last_name"
                  {...register("last_name")}
                  placeholder={t("editor.placeholders.lastName")}
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{t("editor.validation.lastNameTooLong")}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("editor.fields.email")}</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder={t("editor.placeholders.email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{t("editor.validation.invalidEmail")}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("editor.descriptions.emailNote")}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={isUpdating || !isDirty}
                className="gap-2"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isUpdating ? t("editor.actions.saving") : t("editor.actions.saveChanges")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isUpdating}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                {t("editor.actions.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">{t("editor.display.fullName")}</Label>
                <p className="text-sm font-medium">
                  {getFullName(profile) || t("editor.display.notProvided")}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">{t("editor.display.email")}</Label>
                <p className="text-sm font-medium">
                  {profile.email || t("editor.display.notProvided")}
                </p>
              </div>
            </div>

            {profile.first_name && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
                <p className="text-sm font-medium">{profile.first_name}</p>
              </div>
            )}

            {profile.last_name && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
                <p className="text-sm font-medium">{profile.last_name}</p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Member Since</Label>
              <p className="text-sm font-medium">
                {new Date(profile.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
