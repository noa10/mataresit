/**
 * Malaysian Cultural Settings Component
 * Allows users to configure their Malaysian cultural preferences
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, Hash, Globe, MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';
import useMalaysianCulture from '@/hooks/useMalaysianCulture';
import { MALAYSIAN_STATES } from '@/utils/malaysianCulturalUtils';

const MalaysianCulturalSettings: React.FC = () => {
  const { t } = useTranslation();
  const { preferences, loading, updatePreferences } = useMalaysianCulture();
  const [saving, setSaving] = useState(false);
  const [localPreferences, setLocalPreferences] = useState(preferences);

  // Update local preferences when global preferences change
  React.useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updatePreferences(localPreferences);
      toast.success(t('settings.cultural.saved'));
    } catch (error) {
      console.error('Error saving cultural preferences:', error);
      toast.error(t('settings.cultural.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(localPreferences) !== JSON.stringify(preferences);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('settings.cultural.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t('settings.cultural.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.cultural.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Format Settings */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4" />
            {t('settings.cultural.dateFormat')}
          </Label>
          <Select
            value={localPreferences.date_format}
            onValueChange={(value) => setLocalPreferences(prev => ({ ...prev, date_format: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">
                DD/MM/YYYY <Badge variant="secondary" className="ml-2">Malaysian</Badge>
              </SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settings.cultural.dateFormatExample')}: {new Date().toLocaleDateString('en-MY')}
          </p>
        </div>

        <Separator />

        {/* Time Format Settings */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" />
            {t('settings.cultural.timeFormat')}
          </Label>
          <Select
            value={localPreferences.time_format}
            onValueChange={(value) => setLocalPreferences(prev => ({ ...prev, time_format: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">
                24-hour <Badge variant="secondary" className="ml-2">14:30</Badge>
              </SelectItem>
              <SelectItem value="12h">
                12-hour <Badge variant="secondary" className="ml-2">2:30 PM</Badge>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settings.cultural.timeFormatExample')}: {new Date().toLocaleTimeString('en-MY')}
          </p>
        </div>

        <Separator />

        {/* Number Format Settings */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Hash className="h-4 w-4" />
            {t('settings.cultural.numberFormat')}
          </Label>
          <Select
            value={localPreferences.number_format}
            onValueChange={(value) => setLocalPreferences(prev => ({ ...prev, number_format: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MY">
                Malaysian <Badge variant="secondary" className="ml-2">1,234.56</Badge>
              </SelectItem>
              <SelectItem value="US">
                US <Badge variant="secondary" className="ml-2">1,234.56</Badge>
              </SelectItem>
              <SelectItem value="EU">
                European <Badge variant="secondary" className="ml-2">1.234,56</Badge>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settings.cultural.numberFormatExample')}: RM 1,234.56
          </p>
        </div>

        <Separator />

        {/* Timezone Settings */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" />
            {t('settings.cultural.timezone')}
          </Label>
          <Select
            value={localPreferences.timezone}
            onValueChange={(value) => setLocalPreferences(prev => ({ ...prev, timezone: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Kuala_Lumpur">
                Malaysia (UTC+8) <Badge variant="secondary" className="ml-2">Default</Badge>
              </SelectItem>
              <SelectItem value="Asia/Singapore">Singapore (UTC+8)</SelectItem>
              <SelectItem value="Asia/Jakarta">Jakarta (UTC+7)</SelectItem>
              <SelectItem value="Asia/Bangkok">Bangkok (UTC+7)</SelectItem>
              <SelectItem value="UTC">UTC (UTC+0)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settings.cultural.timezoneExample')}: {new Date().toLocaleString('en-MY', { timeZone: localPreferences.timezone })}
          </p>
        </div>

        <Separator />

        {/* Cultural Context Settings */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4" />
            {t('settings.cultural.culturalContext')}
          </Label>
          <Select
            value={localPreferences.cultural_context}
            onValueChange={(value) => setLocalPreferences(prev => ({ ...prev, cultural_context: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MY">
                Malaysia <Badge variant="secondary" className="ml-2">Default</Badge>
              </SelectItem>
              <SelectItem value="SG">Singapore</SelectItem>
              <SelectItem value="ID">Indonesia</SelectItem>
              <SelectItem value="TH">Thailand</SelectItem>
              <SelectItem value="GLOBAL">Global</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settings.cultural.culturalContextDescription')}
          </p>
        </div>

        {/* Malaysian States Information */}
        {localPreferences.cultural_context === 'MY' && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              {t('settings.cultural.malaysianStates')}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-700">
              {Object.entries(MALAYSIAN_STATES).map(([code, name]) => (
                <div key={code} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">{code}</Badge>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MalaysianCulturalSettings;
