import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubscription } from '@/hooks/useSubscription';
import { Palette, Upload, Eye, Lock, Save } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CustomBrandingProps {
  className?: string;
}

export const CustomBranding: React.FC<CustomBrandingProps> = ({ className }) => {
  const { isFeatureAvailable } = useSubscription();
  const hasCustomBranding = isFeatureAvailable('custom_branding');
  
  const [brandingSettings, setBrandingSettings] = useState({
    companyName: 'Your Company',
    primaryColor: '#3b82f6',
    secondaryColor: '#64748b',
    logo: null as File | null,
  });

  if (!hasCustomBranding) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Custom Branding</CardTitle>
            </div>
            <Badge variant="outline">Pro Feature</Badge>
          </div>
          <CardDescription>
            Customize the appearance with your company branding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Custom branding is available with Pro and Max plans
            </p>
            <Button asChild>
              <Link to="/pricing">Upgrade to Pro</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleColorChange = (field: 'primaryColor' | 'secondaryColor', value: string) => {
    setBrandingSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBrandingSettings(prev => ({
        ...prev,
        logo: file
      }));
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-green-500" />
            <CardTitle>Custom Branding</CardTitle>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-200">
            Available
          </Badge>
        </div>
        <CardDescription>
          Customize the appearance with your company branding
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={brandingSettings.companyName}
              onChange={(e) => setBrandingSettings(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="Enter your company name"
              disabled
            />
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label htmlFor="logo">Company Logo</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                {brandingSettings.logo ? (
                  <img 
                    src={URL.createObjectURL(brandingSettings.logo)} 
                    alt="Logo preview" 
                    className="w-full h-full object-contain rounded"
                  />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled
                />
                <Button variant="outline" size="sm" disabled>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Logo
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG up to 2MB
                </p>
              </div>
            </div>
          </div>

          {/* Color Scheme */}
          <div className="space-y-4">
            <Label>Color Scheme</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor" className="text-sm">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: brandingSettings.primaryColor }}
                  />
                  <Input
                    id="primaryColor"
                    type="color"
                    value={brandingSettings.primaryColor}
                    onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                    className="w-16 h-8 p-0 border-0"
                    disabled
                  />
                  <Input
                    value={brandingSettings.primaryColor}
                    onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                    className="flex-1"
                    disabled
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor" className="text-sm">Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: brandingSettings.secondaryColor }}
                  />
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={brandingSettings.secondaryColor}
                    onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                    className="w-16 h-8 p-0 border-0"
                    disabled
                  />
                  <Input
                    value={brandingSettings.secondaryColor}
                    onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                    className="flex-1"
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div 
              className="p-4 border rounded-lg"
              style={{ 
                backgroundColor: brandingSettings.primaryColor + '10',
                borderColor: brandingSettings.primaryColor + '30'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {brandingSettings.logo && (
                  <img 
                    src={URL.createObjectURL(brandingSettings.logo)} 
                    alt="Logo" 
                    className="w-6 h-6 object-contain"
                  />
                )}
                <h3 
                  className="font-semibold"
                  style={{ color: brandingSettings.primaryColor }}
                >
                  {brandingSettings.companyName}
                </h3>
              </div>
              <p 
                className="text-sm"
                style={{ color: brandingSettings.secondaryColor }}
              >
                This is how your branding will appear in the application
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button disabled>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="outline" disabled>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Custom branding features coming soon!</p>
            <p>This is a preview of what will be available.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
