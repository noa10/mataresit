/**
 * Dark Mode Utility Functions
 * Provides consistent color classes that work in both light and dark modes
 */

import { cn } from '@/lib/utils';

/**
 * Alert color variants that work in both light and dark modes
 */
export function getAlertColors(type: 'critical' | 'warning' | 'success' | 'info') {
  const colorMap = {
    critical: {
      background: 'bg-red-50 dark:bg-red-950/50',
      text: 'text-red-900 dark:text-red-100',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400'
    },
    warning: {
      background: 'bg-yellow-50 dark:bg-yellow-950/50',
      text: 'text-yellow-900 dark:text-yellow-100',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: 'text-yellow-600 dark:text-yellow-400'
    },
    success: {
      background: 'bg-green-50 dark:bg-green-950/50',
      text: 'text-green-900 dark:text-green-100',
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400'
    },
    info: {
      background: 'bg-blue-50 dark:bg-blue-950/50',
      text: 'text-blue-900 dark:text-blue-100',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400'
    }
  };

  return colorMap[type];
}

/**
 * Status badge colors that work in both light and dark modes
 */
export function getStatusColors(status: 'healthy' | 'warning' | 'degraded' | 'critical' | 'unknown') {
  const colorMap = {
    healthy: {
      background: 'bg-green-50 dark:bg-green-950/50',
      text: 'text-green-900 dark:text-green-100',
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400'
    },
    warning: {
      background: 'bg-yellow-50 dark:bg-yellow-950/50',
      text: 'text-yellow-900 dark:text-yellow-100',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: 'text-yellow-600 dark:text-yellow-400'
    },
    degraded: {
      background: 'bg-orange-50 dark:bg-orange-950/50',
      text: 'text-orange-900 dark:text-orange-100',
      border: 'border-orange-200 dark:border-orange-800',
      icon: 'text-orange-600 dark:text-orange-400'
    },
    critical: {
      background: 'bg-red-50 dark:bg-red-950/50',
      text: 'text-red-900 dark:text-red-100',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400'
    },
    unknown: {
      background: 'bg-gray-50 dark:bg-gray-950/50',
      text: 'text-gray-900 dark:text-gray-100',
      border: 'border-gray-200 dark:border-gray-800',
      icon: 'text-gray-600 dark:text-gray-400'
    }
  };

  return colorMap[status];
}

/**
 * Get combined alert styling classes
 */
export function getAlertClasses(type: 'critical' | 'warning' | 'success' | 'info', className?: string) {
  const colors = getAlertColors(type);
  return cn(
    'p-4 rounded-lg border transition-all',
    colors.background,
    colors.text,
    colors.border,
    className
  );
}

/**
 * Get combined status badge classes
 */
export function getStatusBadgeClasses(status: 'healthy' | 'warning' | 'degraded' | 'critical' | 'unknown', className?: string) {
  const colors = getStatusColors(status);
  return cn(
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
    colors.background,
    colors.text,
    colors.border,
    'border',
    className
  );
}

/**
 * Button state colors for toggles and interactive elements
 */
export function getButtonStateColors(isActive: boolean) {
  return {
    active: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
    inactive: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
  };
}

/**
 * Get button state classes
 */
export function getButtonStateClasses(isActive: boolean, className?: string) {
  const colors = getButtonStateColors(isActive);
  return cn(
    'transition-colors',
    isActive ? colors.active : colors.inactive,
    className
  );
}

/**
 * Ring colors for focus states and highlights
 */
export function getRingColors(type: 'critical' | 'warning' | 'success' | 'info') {
  const ringMap = {
    critical: 'ring-red-500/20 dark:ring-red-400/20',
    warning: 'ring-yellow-500/20 dark:ring-yellow-400/20',
    success: 'ring-green-500/20 dark:ring-green-400/20',
    info: 'ring-blue-500/20 dark:ring-blue-400/20'
  };

  return ringMap[type];
}

/**
 * Get auto-refresh button styling
 */
export function getAutoRefreshClasses(isActive: boolean, className?: string) {
  return cn(
    'transition-colors',
    isActive 
      ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' 
      : 'bg-background hover:bg-accent',
    className
  );
}

/**
 * Get muted text colors for secondary information
 */
export function getMutedTextClasses(className?: string) {
  return cn('text-gray-600 dark:text-gray-400', className);
}

/**
 * Get emphasis text colors for important information
 */
export function getEmphasisTextClasses(className?: string) {
  return cn('text-gray-900 dark:text-gray-100 font-medium', className);
}
