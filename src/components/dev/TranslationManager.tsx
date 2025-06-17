/**
 * Translation Manager Component
 * Development tool for managing translations, detecting missing keys, and monitoring performance
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { translationUtils, NAMESPACES } from '@/lib/i18n';
import { performanceUtils } from '@/lib/i18n-performance';
import { lazyTranslationLoader } from '@/lib/i18n-lazy';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, RefreshCw, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';

interface MissingKey {
  lng: string;
  ns: string;
  key: string;
  fallbackValue: string;
  timestamp: string;
}

interface NamespaceCompleteness {
  namespace: string;
  complete: boolean;
  missing: string[];
  coverage: number;
}

export function TranslationManager() {
  const { language, changeLanguage } = useLanguage();
  const [missingKeys, setMissingKeys] = useState<MissingKey[]>([]);
  const [completeness, setCompleteness] = useState<NamespaceCompleteness[]>([]);
  const [performanceStats, setPerformanceStats] = useState<any>({});
  const [cacheStats, setCacheStats] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadTranslationData();
  }, [language]);

  const loadTranslationData = async () => {
    setIsLoading(true);
    
    try {
      // Load missing keys
      const missing = translationUtils.getMissingKeys();
      setMissingKeys(missing);

      // Check completeness for all namespaces
      const completenessData = NAMESPACES.map(namespace => 
        translationUtils.validateTranslationCompleteness(namespace)
      );
      setCompleteness(completenessData);

      // Get performance stats
      const perfStats = performanceUtils.getPerformanceStats();
      setPerformanceStats(perfStats);

      // Get cache stats
      const cacheData = lazyTranslationLoader.getCacheStats();
      setCacheStats(cacheData);

    } catch (error) {
      console.error('Failed to load translation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportMissingKeys = () => {
    const exportData = translationUtils.exportMissingKeys();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-translations-${language}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearMissingKeys = () => {
    translationUtils.clearMissingKeys();
    setMissingKeys([]);
  };

  const handleClearCache = () => {
    lazyTranslationLoader.clearCache();
    setCacheStats({ size: 0, maxSize: 0, hitRate: 0, entries: [] });
  };

  const getCompletenessColor = (coverage: number) => {
    if (coverage >= 95) return 'bg-green-500';
    if (coverage >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getCompletenessVariant = (coverage: number) => {
    if (coverage >= 95) return 'default';
    if (coverage >= 80) return 'secondary';
    return 'destructive';
  };

  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Translation Manager</h1>
          <p className="text-muted-foreground">
            Development tool for managing multi-language support
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadTranslationData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => changeLanguage(language === 'en' ? 'ms' : 'en')}>
            Switch to {language === 'en' ? 'Malay' : 'English'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="completeness" className="space-y-4">
        <TabsList>
          <TabsTrigger value="completeness">Translation Completeness</TabsTrigger>
          <TabsTrigger value="missing">Missing Keys</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="cache">Cache Management</TabsTrigger>
        </TabsList>

        <TabsContent value="completeness" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Translation Completeness by Namespace
              </CardTitle>
              <CardDescription>
                Coverage percentage for each translation namespace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {completeness.map((item) => (
                  <div key={item.namespace} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={getCompletenessVariant(item.coverage)}>
                        {item.namespace}
                      </Badge>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{item.coverage}% complete</span>
                          {item.complete && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {!item.complete && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                        </div>
                        <Progress value={item.coverage} className="h-2" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {item.missing.length} missing keys
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Missing Translation Keys
              </CardTitle>
              <CardDescription>
                Keys that were requested but not found in translation files
              </CardDescription>
              <div className="flex gap-2">
                <Button onClick={handleExportMissingKeys} disabled={missingKeys.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Missing Keys
                </Button>
                <Button variant="outline" onClick={handleClearMissingKeys} disabled={missingKeys.length === 0}>
                  Clear Missing Keys
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {missingKeys.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    No missing translation keys detected. Great job!
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {missingKeys.map((key, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{key.lng}:{key.ns}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(key.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        <strong>Key:</strong> {key.key}
                      </div>
                      {key.fallbackValue && (
                        <div className="text-sm text-muted-foreground">
                          <strong>Fallback:</strong> {key.fallbackValue}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Statistics
              </CardTitle>
              <CardDescription>
                Translation loading times and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(performanceStats).length === 0 ? (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    No performance data available yet. Use the application to generate metrics.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4">
                  {Object.entries(performanceStats).map(([key, stats]: [string, any]) => (
                    <div key={key} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{key}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {stats.count} measurements
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Average</div>
                          <div className="font-medium">{stats.avg.toFixed(2)}ms</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Min</div>
                          <div className="font-medium">{stats.min.toFixed(2)}ms</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Max</div>
                          <div className="font-medium">{stats.max.toFixed(2)}ms</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Cache Management
              </CardTitle>
              <CardDescription>
                Translation cache statistics and management
              </CardDescription>
              <Button variant="outline" onClick={handleClearCache}>
                Clear Cache
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Cache Size</div>
                    <div className="text-2xl font-bold">
                      {cacheStats.size || 0} / {cacheStats.maxSize || 0}
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Hit Rate</div>
                    <div className="text-2xl font-bold">{cacheStats.hitRate || 0}%</div>
                  </div>
                </div>
                
                {cacheStats.entries && cacheStats.entries.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Cached Entries</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {cacheStats.entries.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{entry.key}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{entry.accessCount} accesses</span>
                            <span>{Math.round(entry.age / 1000)}s old</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
