import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Settings, 
  Activity, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  Database,
  Zap,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

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
        title: "Error",
        description: "Failed to load queue data",
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
          title: "Success",
          description: `Worker ${data.workerId} started successfully`
        });
        await loadWorkerStatus();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to start worker: ${error.message}`,
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
          title: "Success",
          description: "Worker stopped successfully"
        });
        await loadWorkerStatus();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to stop worker: ${error.message}`,
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
        title: "Success",
        description: `Configuration updated: ${key}`
      });
      
      await loadConfig();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update configuration: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const requeFailedItems = async () => {
    try {
      const { data, error } = await supabase.rpc('requeue_failed_items', { max_items: 100 });
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Requeued ${data} failed items`
      });
      
      await loadQueueStats();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to requeue items: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const cleanupOldItems = async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_old_queue_items');
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Cleaned up ${data} old items`
      });
      
      await loadQueueStats();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to cleanup items: ${error.message}`,
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
          <h2 className="text-2xl font-bold">Queue Management</h2>
          <p className="text-muted-foreground">
            Monitor and control the embedding queue processing system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadQueueData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Queue Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Items</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.total_pending || 0}</div>
            {queueStats?.oldest_pending_age_hours && queueStats.oldest_pending_age_hours > 0 && (
              <p className="text-xs text-muted-foreground">
                Oldest: {queueStats.oldest_pending_age_hours.toFixed(1)}h ago
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.total_processing || 0}</div>
            <p className="text-xs text-muted-foreground">
              {queueStats?.active_workers || 0} active workers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.total_completed || 0}</div>
            {queueStats?.avg_processing_time_ms && (
              <p className="text-xs text-muted-foreground">
                Avg: {(queueStats.avg_processing_time_ms / 1000).toFixed(1)}s
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{queueStats?.total_failed || 0}</div>
            <p className="text-xs text-muted-foreground">
              {queueStats?.total_rate_limited || 0} rate limited
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Management Tabs */}
      <Tabs defaultValue="workers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-4">
          {/* Worker Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Worker Control
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${workerStatus?.isRunning ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-sm font-medium">
                    {workerStatus?.isRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>

                {workerStatus?.worker && (
                  <div className="text-sm text-muted-foreground">
                    ID: {workerStatus.worker.workerId} |
                    Processed: {workerStatus.worker.processedCount} |
                    Errors: {workerStatus.worker.errorCount}
                  </div>
                )}

                <div className="flex gap-2 ml-auto">
                  <Button
                    onClick={startWorker}
                    disabled={workerStatus?.isRunning}
                    size="sm"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Worker
                  </Button>
                  <Button
                    onClick={stopWorker}
                    disabled={!workerStatus?.isRunning}
                    variant="outline"
                    size="sm"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Worker
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workers List */}
          <Card>
            <CardHeader>
              <CardTitle>Active Workers</CardTitle>
            </CardHeader>
            <CardContent>
              {workers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No workers found</p>
              ) : (
                <div className="space-y-3">
                  {workers.map((worker) => (
                    <div key={worker.worker_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(worker.status)}`} />
                        <div>
                          <div className="font-medium">{worker.worker_id}</div>
                          <div className="text-sm text-muted-foreground">
                            Last seen: {new Date(worker.last_heartbeat).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={getStatusBadgeVariant(worker.status)}>
                          {worker.status}
                        </Badge>
                        <div className="text-sm text-right">
                          <div>Tasks: {worker.tasks_processed}</div>
                          <div>Errors: {worker.error_count}</div>
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
                Queue Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="queue_enabled">Queue Processing Enabled</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="queue_enabled"
                      checked={config.queue_enabled === true || config.queue_enabled === 'true'}
                      onCheckedChange={(checked) => updateConfig('queue_enabled', checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {config.queue_enabled === true || config.queue_enabled === 'true' ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batch_size">Batch Size</Label>
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
                  <Label htmlFor="max_concurrent_workers">Max Concurrent Workers</Label>
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
                  <Label htmlFor="rate_limit_delay_ms">Rate Limit Delay (ms)</Label>
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
                  <Label htmlFor="max_retries">Max Retries</Label>
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
                  <Label htmlFor="worker_heartbeat_interval_ms">Heartbeat Interval (ms)</Label>
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
                Queue Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={requeFailedItems} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Requeue Failed Items
                </Button>

                <Button onClick={cleanupOldItems} variant="outline">
                  <Database className="h-4 w-4 mr-2" />
                  Cleanup Old Items
                </Button>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Maintenance operations may affect queue performance. Use during low-traffic periods.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
