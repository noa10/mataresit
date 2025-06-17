/**
 * React Hook for Malaysian Cultural Adaptations
 * Provides cultural formatting and preferences for Malaysian users
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  MalaysianCulturalPreferences,
  MalaysianHoliday,
  DEFAULT_MALAYSIAN_PREFERENCES,
  formatMalaysianDate,
  formatMalaysianTime,
  formatMalaysianNumber,
  formatMalaysianCurrency,
  getMalaysianBusinessGreeting,
  isMalaysianBusinessHours
} from '@/utils/malaysianCulturalUtils';

interface UseMalaysianCultureReturn {
  preferences: MalaysianCulturalPreferences;
  loading: boolean;
  error: string | null;
  
  // Formatting functions
  formatDate: (date: Date | string) => string;
  formatTime: (time: Date | string) => string;
  formatNumber: (number: number) => string;
  formatCurrency: (amount: number, includeSymbol?: boolean) => string;
  
  // Cultural helpers
  getBusinessGreeting: () => string;
  isBusinessHours: (businessType?: string) => boolean;
  checkHoliday: (date: Date | string, stateCode?: string) => Promise<MalaysianHoliday>;
  getBusinessDays: (startDate: Date, endDate: Date, stateCode?: string) => Promise<number>;
  
  // Preference management
  updatePreferences: (newPreferences: Partial<MalaysianCulturalPreferences>) => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

export function useMalaysianCulture(): UseMalaysianCultureReturn {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<MalaysianCulturalPreferences>(DEFAULT_MALAYSIAN_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's cultural preferences
  const loadPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(DEFAULT_MALAYSIAN_PREFERENCES);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('get_user_cultural_preferences', { user_id: user.id });

      if (rpcError) {
        console.error('Error loading cultural preferences:', rpcError);
        setError('Failed to load cultural preferences');
        setPreferences(DEFAULT_MALAYSIAN_PREFERENCES);
      } else {
        setPreferences(data || DEFAULT_MALAYSIAN_PREFERENCES);
      }
    } catch (err) {
      console.error('Error loading cultural preferences:', err);
      setError('Failed to load cultural preferences');
      setPreferences(DEFAULT_MALAYSIAN_PREFERENCES);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update user's cultural preferences
  const updatePreferences = useCallback(async (newPreferences: Partial<MalaysianCulturalPreferences>) => {
    if (!user) return;

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          date_format_preference: newPreferences.date_format,
          time_format_preference: newPreferences.time_format,
          number_format_preference: newPreferences.number_format,
          timezone_preference: newPreferences.timezone,
          cultural_context: newPreferences.cultural_context,
          preferred_language: newPreferences.language
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating cultural preferences:', updateError);
        setError('Failed to update cultural preferences');
        return;
      }

      // Update local state
      setPreferences(prev => ({ ...prev, ...newPreferences }));
    } catch (err) {
      console.error('Error updating cultural preferences:', err);
      setError('Failed to update cultural preferences');
    }
  }, [user]);

  // Refresh preferences from database
  const refreshPreferences = useCallback(async () => {
    await loadPreferences();
  }, [loadPreferences]);

  // Load preferences on mount and user change
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Formatting functions using user preferences
  const formatDate = useCallback((date: Date | string) => {
    return formatMalaysianDate(date, preferences.date_format);
  }, [preferences.date_format]);

  const formatTime = useCallback((time: Date | string) => {
    return formatMalaysianTime(time, preferences.time_format);
  }, [preferences.time_format]);

  const formatNumber = useCallback((number: number) => {
    return formatMalaysianNumber(number, preferences.number_format);
  }, [preferences.number_format]);

  const formatCurrency = useCallback((amount: number, includeSymbol: boolean = true) => {
    return formatMalaysianCurrency(amount, includeSymbol, preferences.number_format);
  }, [preferences.number_format]);

  // Cultural helper functions
  const getBusinessGreeting = useCallback(() => {
    return getMalaysianBusinessGreeting(preferences.language);
  }, [preferences.language]);

  const isBusinessHours = useCallback((businessType: string = 'general') => {
    return isMalaysianBusinessHours(businessType);
  }, []);

  // Check if a date is a Malaysian public holiday
  const checkHoliday = useCallback(async (date: Date | string, stateCode?: string): Promise<MalaysianHoliday> => {
    try {
      const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .rpc('is_malaysian_public_holiday', {
          check_date: dateStr,
          state_code: stateCode || null
        });

      if (error) {
        console.error('Error checking holiday:', error);
        return { is_holiday: false };
      }

      return data || { is_holiday: false };
    } catch (err) {
      console.error('Error checking holiday:', err);
      return { is_holiday: false };
    }
  }, []);

  // Get business days between two dates
  const getBusinessDays = useCallback(async (startDate: Date, endDate: Date, stateCode?: string): Promise<number> => {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .rpc('get_malaysian_business_days', {
          start_date: startDateStr,
          end_date: endDateStr,
          state_code: stateCode || null
        });

      if (error) {
        console.error('Error calculating business days:', error);
        return 0;
      }

      return data || 0;
    } catch (err) {
      console.error('Error calculating business days:', err);
      return 0;
    }
  }, []);

  return {
    preferences,
    loading,
    error,
    
    // Formatting functions
    formatDate,
    formatTime,
    formatNumber,
    formatCurrency,
    
    // Cultural helpers
    getBusinessGreeting,
    isBusinessHours,
    checkHoliday,
    getBusinessDays,
    
    // Preference management
    updatePreferences,
    refreshPreferences
  };
}

export default useMalaysianCulture;
