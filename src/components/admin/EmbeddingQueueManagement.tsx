import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Square,
  RefreshCw,
  Settings,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  Database
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAdminTranslation } from '@/contexts/LanguageContext';

interface QueueStats {
  total_pending: number;
  total_processing: number;
  total_completed: number;
  total_failed: number;
  total_rate_limited: number;
  avg_processing_time_ms: number;
  active_workers: number;
  oldest_pending_age_hours: number;
}

interface WorkerInfo {
  worker_id: string;
  status: string;
  last_heartbeat: string;
  tasks_processed: number;
  total_processing_time_ms: number;
  error_count: number;
  rate_limit_count: number;
}

interface QueueConfig {
  [key: string]: any;
}

export function EmbeddingQueueManagement() {
  const { t, language } = useAdminTranslation();
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [config, setConfig] = useState<QueueConfig>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadQueueData();
    const interval = setInterval(loadQueueData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadQueueData = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([
        loadQueueStats(),
        loadWorkers(),
        loadConfig(),
        loadWorkerStatus()
      ]);
    } catch (error) {
      console.error('Error loading queue data:', error);
      toast({
        title: t('embeddingMetrics.queue.errorTitle'),
        description: t('embeddingMetrics.queue.loadFailed'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadQueueStats = async () => {
    const { data, error } = await supabase.rpc('get_queue_statistics');
    if (error) throw error;
    if (data && data.length > 0) {
      setQueueStats(data[0]);
    }
  };

  const loadWorkers = async () => {
    const { data, error } = await supabase
      .from('embedding_queue_workers')
      .select('*')
      .order('last_heartbeat', { ascending: false });
    if (error) throw error;
    setWorkers(data || []);
  };

  const loadConfig = async () => {
    const { data, error } = await supabase
      .from('embedding_queue_config')
      .select('config_key, config_value');
    if (error) throw error;
    
    const configObj: QueueConfig = {};
    data?.forEach(item => {
      configObj[item.config_key] = item.config_value;
    });
    setConfig(configObj);
  };

  const loadWorkerStatus = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embedding-queue-worker?action=status`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );
      const data = await response.json();
      setWorkerStatus(data);
    } catch (error) {
      console.error('Error loading worker status:', error);
    }
  };

  const startWorker = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embedding-queue-worker?action=start`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: t('embeddingMetrics.queue.successTitle'),
          description: t('embeddingMetrics.queue.workerStarted', { id: data.workerId })
        });
        await loadWorkerStatus();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: t('embeddingMetrics.queue.errorTitle'),
        description: t('embeddingMetrics.queue.startFailed', { error: error.message }),
        variant: "destructive"
      });
    }
  };

  const stopWorker = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embedding-queue-worker?action=stop`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: t('embeddingMetrics.queue.successTitle'),
          description: t('embeddingMetrics.queue.workerStopped')
        });
        await loadWorkerStatus();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: t('embeddingMetrics.queue.errorTitle'),
        description: t('embeddingMetrics.queue.stopFailed', { error: error.message }),
        variant: "destructive"
      });
    }
  };

  const updateConfig = async (key: string, value: any) => {
    try {
      const { error } = await supabase.rpc('update_queue_config', {
        config_key_param: key,
        config_value_param: value,
        updated_by_param: null
      });
      
      if (error) throw error;
      
      toast({
        title: t('embeddingMetrics.queue.successTitle'),
        description: t('embeddingMetrics.queue.configUpdated', { key })
      });
      
      await loadConfig();
    } catch (error) {
      toast({
        title: t('embeddingMetrics.queue.errorTitle'),
        description: t('embeddingMetrics.queue.configUpdateFailed', { error: error.message }),
        variant: "destructive"
      });
    }
  };

  const requeFailedItems = async () => {
    try {
      const { data, error } = await supabase.rpc('requeue_failed_items', { max_items: 100 });
      if (error) throw error;
      
      toast({
        title: t('embeddingMetrics.queue.successTitle'),
        description: t('embeddingMetrics.queue.requeued', { count: data })
      });
      
      await loadQueueStats();
    } catch (error) {
      toast({
        title: t('embeddingMetrics.queue.errorTitle'),
        description: t('embeddingMetrics.queue.requeueFailed', { error: error.message }),
        variant: "destructive"
      });
    }
  };

  const cleanupOldItems = async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_old_queue_items');
      if (error) throw error;
      
      toast({
        title: t('embeddingMetrics.queue.successTitle'),
        description: t('embeddingMetrics.queue.cleanedUp', { count: data })
      });
      
      await loadQueueStats();
    } catch (error) {
      toast({
        title: t('embeddingMetrics.queue.errorTitle'),
        description: t('embeddingMetrics.queue.cleanupFailed', { error: error.message }),
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'stopped': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'idle': return 'secondary';
      case 'stopped': return 'outline';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('embeddingMetrics.queue.title')}</h2>
          <p className="text-muted-foreground">
            {t('embeddingMetrics.queue.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadQueueData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('embeddingMetrics.common.refresh')}
          </Button>
        </div>
      </div>

      {/* Queue Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('embeddingMetrics.queue.pendingItems')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.total_pending || 0}</div>
            {queueStats?.oldest_pending_age_hours && queueStats.oldest_pending_age_hours > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('embeddingMetrics.queue.oldest', {
                  hours: queueStats.oldest_pending_age_hours.toFixed(1),
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('embeddingMetrics.queue.processing')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.total_processing || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('embeddingMetrics.queue.activeWorkers', {
                count: queueStats?.active_workers || 0,
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('embeddingMetrics.queue.completed')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.total_completed || 0}</div>
            {queueStats?.avg_processing_time_ms && (
              <p className="text-xs text-muted-foreground">
                {t('embeddingMetrics.queue.avg', {
                  seconds: (queueStats.avg_processing_time_ms / 1000).toFixed(1),
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('embeddingMetrics.queue.failed')}</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{queueStats?.total_failed || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('embeddingMetrics.queue.rateLimited', {
                count: queueStats?.total_rate_limited || 0,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Management Tabs */}
      <Tabs defaultValue="workers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workers">{t('embeddingMetrics.queue.tabs.workers')}</TabsTrigger>
          <TabsTrigger value="config">{t('embeddingMetrics.queue.tabs.configuration')}</TabsTrigger>
          <TabsTrigger value="maintenance">{t('embeddingMetrics.queue.tabs.maintenance')}</TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-4">
          {/* Worker Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('embeddingMetrics.queue.workerControl')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${workerStatus?.isRunning ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-sm font-medium">
                    {workerStatus?.isRunning
                      ? t('embeddingMetrics.queue.running')
                      : t('embeddingMetrics.queue.stopped')}
                  </span>
                </div>

                {workerStatus?.worker && (
                  <div className="text-sm text-muted-foreground">
                    {t('embeddingMetrics.queue.idLabel')} {workerStatus.worker.workerId} |{' '}
                    {t('embeddingMetrics.queue.processedLabel')} {workerStatus.worker.processedCount} |{' '}
                    {t('embeddingMetrics.queue.errorsLabel')} {workerStatus.worker.errorCount}
                  </div>
                )}

                <div className="flex gap-2 ml-auto">
                  <Button
                    onClick={startWorker}
                    disabled={workerStatus?.isRunning}
                    size="sm"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {t('embeddingMetrics.queue.startWorker')}
                  </Button>
                  <Button
                    onClick={stopWorker}
                    disabled={!workerStatus?.isRunning}
                    variant="outline"
                    size="sm"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    {t('embeddingMetrics.queue.stopWorker')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workers List */}
          <Card>
            <CardHeader>
              <CardTitle>{t('embeddingMetrics.queue.activeWorkersTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {workers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">{t('embeddingMetrics.queue.noWorkers')}</p>
              ) : (
                <div className="space-y-3">
                  {workers.map((worker) => (
                    <div key={worker.worker_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(worker.status)}`} />
                        <div>
                          <div className="font-medium">{worker.worker_id}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('embeddingMetrics.queue.lastSeen', {
                              time: new Date(worker.last_heartbeat).toLocaleString(
                                language === 'ms' ? 'ms-MY' : 'en-MY'
                              ),
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={getStatusBadgeVariant(worker.status)}>
                          {t(`embeddingMetrics.common.${worker.status}`, {
                            defaultValue: worker.status,
                          })}
                        </Badge>
                        <div className="text-sm text-right">
                          <div>
                            {t('embeddingMetrics.queue.tasks', {
                              count: worker.tasks_processed,
                            })}
                          </div>
                          <div>
                            {t('embeddingMetrics.queue.errors', {
                              count: worker.error_count,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('embeddingMetrics.queue.queueConfiguration')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="queue_enabled">{t('embeddingMetrics.queue.queueProcessingEnabled')}</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="queue_enabled"
                      checked={config.queue_enabled === true || config.queue_enabled === 'true'}
                      onCheckedChange={(checked) => updateConfig('queue_enabled', checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {config.queue_enabled === true || config.queue_enabled === 'true'
                        ? t('embeddingMetrics.queue.enabled')
                        : t('embeddingMetrics.queue.disabled')}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batch_size">{t('embeddingMetrics.queue.batchSize')}</Label>
                  <Input
                    id="batch_size"
                    type="number"
                    value={config.batch_size || 5}
                    onChange={(e) => updateConfig('batch_size', parseInt(e.target.value))}
                    min="1"
                    max="20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_concurrent_workers">{t('embeddingMetrics.queue.maxConcurrentWorkers')}</Label>
                  <Input
                    id="max_concurrent_workers"
                    type="number"
                    value={config.max_concurrent_workers || 3}
                    onChange={(e) => updateConfig('max_concurrent_workers', parseInt(e.target.value))}
                    min="1"
                    max="10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate_limit_delay_ms">{t('embeddingMetrics.queue.rateLimitDelay')}</Label>
                  <Input
                    id="rate_limit_delay_ms"
                    type="number"
                    value={config.rate_limit_delay_ms || 1000}
                    onChange={(e) => updateConfig('rate_limit_delay_ms', parseInt(e.target.value))}
                    min="100"
                    max="10000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_retries">{t('embeddingMetrics.queue.maxRetries')}</Label>
                  <Input
                    id="max_retries"
                    type="number"
                    value={config.max_retries || 3}
                    onChange={(e) => updateConfig('max_retries', parseInt(e.target.value))}
                    min="1"
                    max="10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="worker_heartbeat_interval_ms">{t('embeddingMetrics.queue.heartbeatInterval')}</Label>
                  <Input
                    id="worker_heartbeat_interval_ms"
                    type="number"
                    value={config.worker_heartbeat_interval_ms || 30000}
                    onChange={(e) => updateConfig('worker_heartbeat_interval_ms', parseInt(e.target.value))}
                    min="5000"
                    max="120000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {t('embeddingMetrics.queue.queueMaintenance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={requeFailedItems} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('embeddingMetrics.queue.requeueFailedItems')}
                </Button>

                <Button onClick={cleanupOldItems} variant="outline">
                  <Database className="h-4 w-4 mr-2" />
                  {t('embeddingMetrics.queue.cleanupOldItems')}
                </Button>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('embeddingMetrics.queue.maintenanceWarning')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
