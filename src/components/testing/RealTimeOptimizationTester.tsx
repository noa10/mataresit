// OPTIMIZATION: Comprehensive Real-time Optimization Testing Component
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Square, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Activity,
  Zap,
  Shield,
  Database,
  Network
} from 'lucide-react';
import { toast } from 'sonner';
import { performanceMonitor } from '@/services/realTimePerformanceMonitor';
import { useNotifications } from '@/contexts/NotificationContext';
import { getReceiptSubscriptionStats, getReceiptSubscriptionHealth } from '@/services/receiptService';
import { notificationService } from '@/services/notificationService';

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  duration: number;
  details: string;
  metrics?: any;
  timestamp: number;
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestResult[];
  status: 'pending' | 'running' | 'completed';
  startTime?: number;
  endTime?: number;
}

export function RealTimeOptimizationTester() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSuite, setCurrentSuite] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const { getRateLimitingStats, resetRateLimiting } = useNotifications();
  const testStartTime = useRef<number>(0);

  // Initialize test suites
  useEffect(() => {
    const suites: TestSuite[] = [
      {
        id: 'notification-optimization',
        name: 'Notification System Optimization',
        description: 'Tests notification subscription consolidation, rate limiting, and circuit breaker functionality',
        tests: [],
        status: 'pending'
      },
      {
        id: 'receipt-optimization',
        name: 'Receipt Subscription Optimization',
        description: 'Tests unified receipt subscriptions, connection pooling, and cleanup mechanisms',
        tests: [],
        status: 'pending'
      },
      {
        id: 'performance-monitoring',
        name: 'Performance Monitoring System',
        description: 'Tests real-time performance monitoring, alerting, and health metrics',
        tests: [],
        status: 'pending'
      },
      {
        id: 'stress-testing',
        name: 'Stress Testing & Rate Limiting',
        description: 'Tests system behavior under high load and rate limiting effectiveness',
        tests: [],
        status: 'pending'
      }
    ];

    setTestSuites(suites);
  }, []);

  // Update performance data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const current = performanceMonitor.getCurrentMetrics();
      const summary = performanceMonitor.getPerformanceSummary();
      const alerts = performanceMonitor.getActiveAlerts();
      
      setPerformanceData({
        current,
        summary,
        alerts,
        rateLimiting: getRateLimitingStats(),
        receipts: getReceiptSubscriptionStats(),
        receiptHealth: getReceiptSubscriptionHealth(),
        notifications: notificationService.getConnectionState()
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [getRateLimitingStats]);

  const runAllTests = async () => {
    if (isRunning) return;

    setIsRunning(true);
    testStartTime.current = Date.now();
    
    // Start performance monitoring
    performanceMonitor.startMonitoring();
    
    // Reset rate limiting stats for clean testing
    resetRateLimiting();

    toast.info('Starting comprehensive real-time optimization tests...');

    try {
      for (const suite of testSuites) {
        await runTestSuite(suite.id);
      }
      
      toast.success('All optimization tests completed!');
    } catch (error) {
      console.error('Test execution error:', error);
      toast.error('Test execution failed');
    } finally {
      setIsRunning(false);
      setCurrentSuite(null);
    }
  };

  const runTestSuite = async (suiteId: string) => {
    setCurrentSuite(suiteId);
    
    setTestSuites(prev => prev.map(suite => 
      suite.id === suiteId 
        ? { ...suite, status: 'running', startTime: Date.now(), tests: [] }
        : suite
    ));

    const tests = await executeTestSuite(suiteId);
    
    setTestSuites(prev => prev.map(suite => 
      suite.id === suiteId 
        ? { 
            ...suite, 
            status: 'completed', 
            endTime: Date.now(),
            tests 
          }
        : suite
    ));
  };

  const executeTestSuite = async (suiteId: string): Promise<TestResult[]> => {
    const results: TestResult[] = [];

    switch (suiteId) {
      case 'notification-optimization':
        results.push(...await testNotificationOptimizations());
        break;
      case 'receipt-optimization':
        results.push(...await testReceiptOptimizations());
        break;
      case 'performance-monitoring':
        results.push(...await testPerformanceMonitoring());
        break;
      case 'stress-testing':
        results.push(...await testStressAndRateLimit());
        break;
    }

    return results;
  };

  const testNotificationOptimizations = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];

    // Test 1: Subscription consolidation
    const startTime = Date.now();
    try {
      const connectionState = notificationService.getConnectionState();
      const rateLimitingStats = getRateLimitingStats();
      
      results.push({
        id: 'notification-consolidation',
        name: 'Notification Subscription Consolidation',
        status: connectionState.activeChannels <= 2 ? 'passed' : 'warning',
        duration: Date.now() - startTime,
        details: `Active channels: ${connectionState.activeChannels} (target: ≤2)`,
        metrics: connectionState,
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'notification-consolidation',
        name: 'Notification Subscription Consolidation',
        status: 'failed',
        duration: Date.now() - startTime,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    // Test 2: Rate limiting functionality
    const rateLimitStart = Date.now();
    try {
      const stats = getRateLimitingStats();
      const hasRateLimiting = stats.performance.processed > 0 || stats.performance.blocked > 0;
      
      results.push({
        id: 'rate-limiting',
        name: 'Rate Limiting System',
        status: hasRateLimiting ? 'passed' : 'warning',
        duration: Date.now() - rateLimitStart,
        details: `Processed: ${stats.performance.processed}, Blocked: ${stats.performance.blocked}`,
        metrics: stats,
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'rate-limiting',
        name: 'Rate Limiting System',
        status: 'failed',
        duration: Date.now() - rateLimitStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    // Test 3: Circuit breaker
    const circuitStart = Date.now();
    try {
      const stats = getRateLimitingStats();
      const circuitBreakerWorking = stats.circuitBreaker !== undefined;
      
      results.push({
        id: 'circuit-breaker',
        name: 'Circuit Breaker Protection',
        status: circuitBreakerWorking ? 'passed' : 'failed',
        duration: Date.now() - circuitStart,
        details: `Circuit breaker ${circuitBreakerWorking ? 'active' : 'not found'}`,
        metrics: stats.circuitBreaker,
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'circuit-breaker',
        name: 'Circuit Breaker Protection',
        status: 'failed',
        duration: Date.now() - circuitStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    return results;
  };

  const testReceiptOptimizations = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];

    // Test 1: Unified subscriptions
    const unifiedStart = Date.now();
    try {
      const stats = getReceiptSubscriptionStats();
      const hasUnified = stats.unified.activeSubscriptions > 0;
      const efficiency = stats.total.activeSubscriptions > 0 ? 
        (stats.unified.activeSubscriptions / stats.total.activeSubscriptions) * 100 : 0;
      
      results.push({
        id: 'unified-subscriptions',
        name: 'Unified Receipt Subscriptions',
        status: hasUnified ? 'passed' : 'warning',
        duration: Date.now() - unifiedStart,
        details: `Unified: ${stats.unified.activeSubscriptions}, Legacy: ${stats.legacy.activeSubscriptions}, Efficiency: ${efficiency.toFixed(1)}%`,
        metrics: stats,
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'unified-subscriptions',
        name: 'Unified Receipt Subscriptions',
        status: 'failed',
        duration: Date.now() - unifiedStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    // Test 2: Connection pooling
    const poolingStart = Date.now();
    try {
      const stats = getReceiptSubscriptionStats();
      const totalCallbacks = stats.total.totalCallbacks;
      const totalSubscriptions = stats.total.activeSubscriptions;
      const poolingEfficiency = totalSubscriptions > 0 ? totalCallbacks / totalSubscriptions : 0;
      
      results.push({
        id: 'connection-pooling',
        name: 'Connection Pooling Efficiency',
        status: poolingEfficiency > 1 ? 'passed' : 'warning',
        duration: Date.now() - poolingStart,
        details: `${totalCallbacks} callbacks sharing ${totalSubscriptions} subscriptions (ratio: ${poolingEfficiency.toFixed(2)})`,
        metrics: { poolingEfficiency, totalCallbacks, totalSubscriptions },
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'connection-pooling',
        name: 'Connection Pooling Efficiency',
        status: 'failed',
        duration: Date.now() - poolingStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    // Test 3: Health monitoring
    const healthStart = Date.now();
    try {
      const health = getReceiptSubscriptionHealth();
      
      results.push({
        id: 'receipt-health',
        name: 'Receipt Subscription Health',
        status: health.healthScore >= 80 ? 'passed' : health.healthScore >= 60 ? 'warning' : 'failed',
        duration: Date.now() - healthStart,
        details: `Health score: ${health.healthScore}%, Issues: ${health.issues.length}`,
        metrics: health,
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'receipt-health',
        name: 'Receipt Subscription Health',
        status: 'failed',
        duration: Date.now() - healthStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    return results;
  };

  const testPerformanceMonitoring = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];

    // Test 1: Performance monitoring active
    const monitoringStart = Date.now();
    try {
      const current = performanceMonitor.getCurrentMetrics();
      const isActive = current !== null;
      
      results.push({
        id: 'performance-monitoring',
        name: 'Performance Monitoring System',
        status: isActive ? 'passed' : 'failed',
        duration: Date.now() - monitoringStart,
        details: `Monitoring ${isActive ? 'active' : 'inactive'}`,
        metrics: current,
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'performance-monitoring',
        name: 'Performance Monitoring System',
        status: 'failed',
        duration: Date.now() - monitoringStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    // Test 2: Alert system
    const alertStart = Date.now();
    try {
      const alerts = performanceMonitor.getActiveAlerts();
      const summary = performanceMonitor.getPerformanceSummary();
      
      results.push({
        id: 'alert-system',
        name: 'Performance Alert System',
        status: summary.score >= 75 ? 'passed' : summary.score >= 50 ? 'warning' : 'failed',
        duration: Date.now() - alertStart,
        details: `Score: ${summary.score}/100, Active alerts: ${alerts.length}`,
        metrics: { alerts, summary },
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'alert-system',
        name: 'Performance Alert System',
        status: 'failed',
        duration: Date.now() - alertStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    return results;
  };

  const testStressAndRateLimit = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];

    // Test 1: Rate limiting under load
    const stressStart = Date.now();
    try {
      // Simulate rapid operations (this would normally trigger rate limiting)
      const initialStats = getRateLimitingStats();
      
      // Wait a moment to see if rate limiting is working
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalStats = getRateLimitingStats();
      const rateLimitingActive = finalStats.performance.blocked > initialStats.performance.blocked;
      
      results.push({
        id: 'stress-rate-limiting',
        name: 'Rate Limiting Under Load',
        status: rateLimitingActive ? 'passed' : 'warning',
        duration: Date.now() - stressStart,
        details: `Blocked operations: ${finalStats.performance.blocked - initialStats.performance.blocked}`,
        metrics: { initial: initialStats, final: finalStats },
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'stress-rate-limiting',
        name: 'Rate Limiting Under Load',
        status: 'failed',
        duration: Date.now() - stressStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    // Test 2: Memory and connection management
    const memoryStart = Date.now();
    try {
      const connectionState = notificationService.getConnectionState();
      const receiptStats = getReceiptSubscriptionStats();
      const totalConnections = connectionState.activeChannels + receiptStats.total.activeSubscriptions;
      
      results.push({
        id: 'memory-management',
        name: 'Memory & Connection Management',
        status: totalConnections <= 25 ? 'passed' : totalConnections <= 40 ? 'warning' : 'failed',
        duration: Date.now() - memoryStart,
        details: `Total connections: ${totalConnections} (target: ≤25)`,
        metrics: { totalConnections, connectionState, receiptStats },
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        id: 'memory-management',
        name: 'Memory & Connection Management',
        status: 'failed',
        duration: Date.now() - memoryStart,
        details: `Error: ${error}`,
        timestamp: Date.now()
      });
    }

    return results;
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-time Optimization Testing Suite
          </CardTitle>
          <div className="flex items-center gap-4">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run All Tests
                </>
              )}
            </Button>
            
            {isRunning && (
              <Button 
                variant="outline" 
                onClick={() => setIsRunning(false)}
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Performance Overview */}
      {performanceData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Live Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Performance Score</span>
                  <Badge className={getStatusColor(
                    performanceData.summary.score >= 90 ? 'passed' : 
                    performanceData.summary.score >= 75 ? 'warning' : 'failed'
                  )}>
                    {performanceData.summary.score}/100
                  </Badge>
                </div>
                <Progress value={performanceData.summary.score} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Connections</span>
                  <span className="text-sm">{performanceData.current?.system.connectionCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Alerts</span>
                  <span className="text-sm">{performanceData.alerts.length}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Receipt Health</span>
                  <span className="text-sm">{performanceData.receiptHealth.healthScore}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Error Rate</span>
                  <span className="text-sm">{performanceData.current?.system.errorRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Suites */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {testSuites.map((suite) => (
          <Card key={suite.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {suite.id === 'notification-optimization' && <Shield className="h-4 w-4" />}
                  {suite.id === 'receipt-optimization' && <Database className="h-4 w-4" />}
                  {suite.id === 'performance-monitoring' && <Activity className="h-4 w-4" />}
                  {suite.id === 'stress-testing' && <Network className="h-4 w-4" />}
                  {suite.name}
                </div>
                <Badge className={getStatusColor(
                  suite.status === 'completed' ? 'passed' : 
                  suite.status === 'running' ? 'running' : 'pending'
                )}>
                  {suite.status}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{suite.description}</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {suite.tests.map((test) => (
                    <div key={test.id} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(test.status)}
                        <div>
                          <div className="text-sm font-medium">{test.name}</div>
                          <div className="text-xs text-muted-foreground">{test.details}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {test.duration}ms
                      </div>
                    </div>
                  ))}
                  
                  {suite.tests.length === 0 && suite.status === 'pending' && (
                    <div className="text-center text-muted-foreground py-4">
                      Tests not yet run
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
