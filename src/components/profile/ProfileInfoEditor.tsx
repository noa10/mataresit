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
import { updateProfile, ProfileData, getFullName } from "@/services/profileService";

const profileSchema = z.object({
  first_name: z.string().max(50, "First name must be 50 characters or less").optional(),
  last_name: z.string().max(50, "Last name must be 50 characters or less").optional(),
  email: z.string().email("Please enter a valid email address").optional(),
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
          title: "Profile updated",
          description: "Your profile information has been updated successfully.",
        });
        onProfileUpdate(result.profile);
        setIsEditing(false);
      } else {
        toast({
          title: "Update failed",
          description: result.error || "Failed to update profile. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: "Update failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Personal Information</CardTitle>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  {...register("first_name")}
                  placeholder="Enter your first name"
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  {...register("last_name")}
                  placeholder="Enter your last name"
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="Enter your email address"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Note: Changing your email may require re-verification
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
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isUpdating}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                <p className="text-sm font-medium">
                  {getFullName(profile) || "Not provided"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                <p className="text-sm font-medium">
                  {profile.email || "Not provided"}
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
