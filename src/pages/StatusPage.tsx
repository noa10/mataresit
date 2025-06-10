import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { checkAllServices, ServiceCheckResult, ServiceStatus } from '@/services/statusService';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const getStatusIcon = (status: ServiceStatus) => {
  switch (status) {
    case 'operational':
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
    case 'outage':
      return <AlertTriangle className="h-6 w-6 text-red-500" />;
    case 'loading':
      return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  }
};

const getStatusBadgeVariant = (status: ServiceStatus) => {
  switch (status) {
    case 'operational':
      return 'default';
    case 'degraded':
      return 'secondary';
    case 'outage':
      return 'destructive';
    default:
      return 'outline';
  }
};

const StatusPage = () => {
  const [services, setServices] = useState<ServiceCheckResult[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [overallStatus, setOverallStatus] = useState<ServiceStatus>('loading');
  const [isLoading, setIsLoading] = useState(true);

  const runChecks = useCallback(async () => {
    setIsLoading(true);
    setOverallStatus('loading');
    setServices(prev => prev.map(s => ({ ...s, status: 'loading' })));

    const results = await checkAllServices();
    setServices(results);
    setLastChecked(new Date());

    if (results.some(s => s.status === 'outage')) {
      setOverallStatus('outage');
    } else if (results.some(s => s.status === 'degraded')) {
      setOverallStatus('degraded');
    } else {
      setOverallStatus('operational');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const getOverallStatusMessage = () => {
    switch (overallStatus) {
      case 'operational':
        return { title: 'All systems operational', color: 'text-green-500', icon: CheckCircle };
      case 'degraded':
        return { title: 'Some systems are experiencing issues', color: 'text-yellow-500', icon: AlertTriangle };
      case 'outage':
        return { title: 'Major outage detected', color: 'text-red-500', icon: AlertTriangle };
      default:
        return { title: 'Checking system status...', color: 'text-muted-foreground', icon: Loader2 };
    }
  };

  const { title, color, icon: OverallIcon } = getOverallStatusMessage();

  return (
    <>
      <Helmet>
        <title>System Status - ReceiptScan</title>
        <meta name="description" content="Live status of ReceiptScan services and third-party integrations." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">System Status</h1>
          </div>
          <p className="mt-4 text-lg text-muted-foreground">
            Live status of our services and third-party integrations.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <OverallIcon className={cn("h-8 w-8", color, overallStatus === 'loading' && 'animate-spin')} />
                  <CardTitle className={cn("text-2xl", color)}>{title}</CardTitle>
                </div>
                <Button onClick={runChecks} disabled={isLoading} size="sm">
                  <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
              {lastChecked && (
                <CardDescription className="pt-2">
                  Last checked: {formatDistanceToNow(lastChecked, { addSuffix: true })}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Separator className="mb-6" />
              <div className="space-y-4">
                {services.map((service, index) => (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                  >
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(service.status)}
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-sm text-muted-foreground">{service.message}</p>
                        </div>
                      </div>
                      <Badge variant={getStatusBadgeVariant(service.status)} className="capitalize">
                        {service.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center mt-12"
        >
          <p className="text-muted-foreground">
            Experiencing issues? Please visit our{' '}
            <Link to="/help" className="text-primary hover:underline">
              Help Center
            </Link>
            {' '}or contact support.
          </p>
        </motion.div>
      </div>
    </>
  );
};

export default StatusPage;
