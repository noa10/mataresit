import { useState, useRef } from "react";
import { Camera, Upload, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useProfileTranslation } from "@/contexts/LanguageContext";
import { uploadAvatar, removeAvatar, getAvatarUrl, getUserInitials } from "@/services/avatarService";
import { ProfileData } from "@/services/profileService";

interface AvatarUploadProps {
  profile: ProfileData;
  onAvatarUpdate: (avatarUrl: string | null) => void;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-16 w-16", 
  lg: "h-24 w-24",
  xl: "h-32 w-32"
};

const iconSizes = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24
};

export function AvatarUpload({
  profile,
  onAvatarUpdate,
  size = "lg"
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useProfileTranslation();

  const avatarUrl = getAvatarUrl(profile);
  const initials = getUserInitials(profile);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const result = await uploadAvatar(file, profile.id);
      
      if (result.success && result.avatarUrl) {
        toast({
          title: "Avatar updated",
          description: "Your profile picture has been updated successfully.",
        });
        onAvatarUpdate(result.avatarUrl);
      } else {
        toast({
          title: "Upload failed",
          description: result.error || "Failed to upload avatar. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast({
        title: "Upload failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile.avatar_url) return;

    setIsRemoving(true);

    try {
      const result = await removeAvatar(profile.id);
      
      if (result.success) {
        toast({
          title: "Avatar removed",
          description: "Your custom avatar has been removed.",
        });
        onAvatarUpdate(null);
      } else {
        toast({
          title: "Removal failed",
          description: result.error || "Failed to remove avatar. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Avatar removal error:", error);
      toast({
        title: "Removal failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Avatar Display */}
      <div className="relative group">
        <Avatar className={`${sizeClasses[size]} ring-2 ring-border`}>
          {avatarUrl && (
            <AvatarImage 
              src={avatarUrl} 
              alt="Profile picture"
              className="object-cover"
            />
          )}
          <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Hover overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={openFileDialog}
        >
          {isUploading ? (
            <Loader2 className="text-white animate-spin" size={iconSizes[size]} />
          ) : (
            <Camera className="text-white" size={iconSizes[size]} />
          )}
        </div>
      </div>

      {/* Upload Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openFileDialog}
          disabled={isUploading || isRemoving}
          className="gap-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isUploading ? t("avatar.uploading") : t("avatar.uploadPhoto")}
        </Button>

        {profile.avatar_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveAvatar}
            disabled={isUploading || isRemoving}
            className="gap-2 text-destructive hover:text-destructive"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isRemoving ? t("avatar.removing") : t("avatar.remove")}
          </Button>
        )}
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload avatar image"
      />

      {/* Help Text */}
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Upload a photo to personalize your profile. 
        Recommended: Square image, max 5MB (JPEG, PNG, WebP).
      </p>
    </div>
  );
}
