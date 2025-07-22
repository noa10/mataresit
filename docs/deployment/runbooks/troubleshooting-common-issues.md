# Troubleshooting Common Issues

This guide provides solutions for frequently encountered issues in the Paperless Maverick production deployment system.

## 🔍 Diagnostic Tools and Commands

### Quick Health Check
```bash
# Overall system status
kubectl get pods -n paperless-maverick
kubectl get services -n paperless-maverick
kubectl get deployments -n paperless-maverick

# Application health endpoints
curl -f https://api.mataresit.com/health/live
curl -f https://api.mataresit.com/health/ready
curl -f https://api.mataresit.com/health/database
```

### Log Analysis
```bash
# Application logs
kubectl logs -n paperless-maverick deployment/paperless-maverick --tail=100
kubectl logs -n paperless-maverick deployment/paperless-maverick --previous

# Worker logs
kubectl logs -n paperless-maverick deployment/embedding-queue-workers --tail=100

# System events
kubectl get events -n paperless-maverick --sort-by='.lastTimestamp'
```

### Resource Monitoring
```bash
# Resource utilization
kubectl top nodes
kubectl top pods -n paperless-maverick

# Detailed pod information
kubectl describe pod -n paperless-maverick [POD_NAME]
```

## 🚨 Application Issues

### Issue: Application Pods Crashing (CrashLoopBackOff)

#### Symptoms
- Pods in CrashLoopBackOff state
- Application not responding to health checks
- Users unable to access the application

#### Diagnosis
```bash
# Check pod status
kubectl get pods -n paperless-maverick -l app=paperless-maverick

# Check pod logs
kubectl logs -n paperless-maverick [POD_NAME] --previous

# Check pod events
kubectl describe pod -n paperless-maverick [POD_NAME]
```

#### Common Causes and Solutions

**1. Configuration Issues**
```bash
# Check ConfigMap and Secrets
kubectl get configmap -n paperless-maverick
kubectl describe configmap app-config -n paperless-maverick

# Verify environment variables
kubectl exec -n paperless-maverick [POD_NAME] -- env | grep -E "(DATABASE_URL|SUPABASE_|GEMINI_)"
```

**2. Database Connection Issues**
```bash
# Test database connectivity
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -f http://localhost:3000/health/database

# Check database pod status
kubectl get pods -n database
kubectl logs -n database deployment/postgresql --tail=50
```

**3. Resource Constraints**
```bash
# Check resource limits
kubectl describe pod -n paperless-maverick [POD_NAME] | grep -A 10 "Limits:"

# Increase resource limits if needed
kubectl patch deployment paperless-maverick -n paperless-maverick --patch '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "paperless-maverick",
            "resources": {
              "requests": {"cpu": "500m", "memory": "1Gi"},
              "limits": {"cpu": "2000m", "memory": "4Gi"}
            }
          }
        ]
      }
    }
  }
}'
```

### Issue: High Response Times

#### Symptoms
- API responses taking > 2 seconds
- User interface loading slowly
- Timeout errors in logs

#### Diagnosis
```bash
# Check response times
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s https://api.mataresit.com/health
done

# Check resource utilization
kubectl top pods -n paperless-maverick

# Check database performance
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

#### Solutions

**1. Scale Up Application**
```bash
# Increase replica count
kubectl scale deployment/paperless-maverick --replicas=6 -n paperless-maverick

# Monitor scaling progress
kubectl get pods -n paperless-maverick -w
```

**2. Database Optimization**
```bash
# Check for slow queries
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Restart database connection pool
kubectl rollout restart deployment/paperless-maverick -n paperless-maverick
```

**3. Clear Application Cache**
```bash
# Clear Redis cache if applicable
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -X POST http://localhost:3000/admin/clear-cache
```

## 🔄 Worker Issues

### Issue: Queue Processing Backlog

#### Symptoms
- Queue depth increasing continuously
- Receipts not being processed
- Workers showing errors in logs

#### Diagnosis
```bash
# Check queue depth
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/metrics | grep queue_depth

# Check worker status
kubectl get pods -n paperless-maverick -l app=embedding-queue-workers
kubectl logs -n paperless-maverick deployment/embedding-queue-workers --tail=100
```

#### Solutions

**1. Scale Up Workers**
```bash
# Increase worker replicas
kubectl scale deployment/embedding-queue-workers --replicas=8 -n paperless-maverick

# Monitor worker scaling
kubectl get pods -n paperless-maverick -l app=embedding-queue-workers -w
```

**2. Restart Stuck Workers**
```bash
# Restart worker deployment
kubectl rollout restart deployment/embedding-queue-workers -n paperless-maverick

# Delete stuck pods
kubectl delete pods -n paperless-maverick -l app=embedding-queue-workers --field-selector=status.phase=Failed
```

**3. Clear Queue if Corrupted**
```bash
# Clear stuck queue items (use with caution)
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -X POST http://localhost:3000/admin/clear-queue --data '{"reason":"stuck_items"}'
```

### Issue: Worker Memory Leaks

#### Symptoms
- Worker pods consuming increasing memory
- Pods being killed due to OOMKilled
- Performance degradation over time

#### Diagnosis
```bash
# Monitor memory usage over time
kubectl top pods -n paperless-maverick -l app=embedding-queue-workers

# Check for OOMKilled events
kubectl get events -n paperless-maverick | grep OOMKilled

# Check memory limits
kubectl describe deployment embedding-queue-workers -n paperless-maverick | grep -A 5 "Limits:"
```

#### Solutions

**1. Increase Memory Limits**
```bash
kubectl patch deployment embedding-queue-workers -n paperless-maverick --patch '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "embedding-worker",
            "resources": {
              "requests": {"memory": "2Gi"},
              "limits": {"memory": "8Gi"}
            }
          }
        ]
      }
    }
  }
}'
```

**2. Implement Worker Restart Policy**
```bash
# Add periodic restart to prevent memory leaks
kubectl patch deployment embedding-queue-workers -n paperless-maverick --patch '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "embedding-worker",
            "env": [
              {"name": "WORKER_MAX_JOBS", "value": "100"},
              {"name": "WORKER_RESTART_AFTER", "value": "1000"}
            ]
          }
        ]
      }
    }
  }
}'
```

## 🗄️ Database Issues

### Issue: Database Connection Pool Exhaustion

#### Symptoms
- "Too many connections" errors
- Application unable to connect to database
- Slow database queries

#### Diagnosis
```bash
# Check current connections
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection limits
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -c "SHOW max_connections;"

# Check application connection pool
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/health/database | jq '.connections'
```

#### Solutions

**1. Restart Application to Reset Connections**
```bash
kubectl rollout restart deployment/paperless-maverick -n paperless-maverick
kubectl rollout restart deployment/embedding-queue-workers -n paperless-maverick
```

**2. Kill Long-Running Queries**
```bash
# Identify long-running queries
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"

# Kill specific query (replace PID)
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT pg_terminate_backend([PID]);"
```

**3. Optimize Connection Pool Settings**
```bash
# Update application connection pool configuration
kubectl patch configmap app-config -n paperless-maverick --patch '
{
  "data": {
    "DB_POOL_SIZE": "20",
    "DB_POOL_TIMEOUT": "30000",
    "DB_POOL_IDLE_TIMEOUT": "600000"
  }
}'

kubectl rollout restart deployment/paperless-maverick -n paperless-maverick
```

### Issue: Database Performance Degradation

#### Symptoms
- Slow query responses
- High database CPU usage
- Application timeouts

#### Diagnosis
```bash
# Check database performance metrics
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT * FROM pg_stat_database WHERE datname = 'paperless_maverick';"

# Check for blocking queries
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT blocked_locks.pid AS blocked_pid, blocked_activity.usename AS blocked_user, blocking_locks.pid AS blocking_pid, blocking_activity.usename AS blocking_user, blocked_activity.query AS blocked_statement, blocking_activity.query AS current_statement_in_blocking_process FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid AND blocking_locks.pid != blocked_locks.pid JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid WHERE NOT blocked_locks.GRANTED;"
```

#### Solutions

**1. Run Database Maintenance**
```bash
# Analyze and vacuum tables
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "VACUUM ANALYZE;"

# Reindex if needed
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "REINDEX DATABASE paperless_maverick;"
```

**2. Check and Create Missing Indexes**
```bash
# Check for missing indexes on frequently queried columns
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT schemaname, tablename, attname, n_distinct, correlation FROM pg_stats WHERE schemaname = 'public' ORDER BY n_distinct DESC;"
```

## 🌐 Network and Connectivity Issues

### Issue: External API Timeouts

#### Symptoms
- Gemini API calls failing
- Stripe webhook timeouts
- External service integration errors

#### Diagnosis
```bash
# Test external connectivity from pods
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -I https://generativelanguage.googleapis.com/

kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -I https://api.stripe.com/

# Check DNS resolution
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  nslookup generativelanguage.googleapis.com
```

#### Solutions

**1. Check Network Policies**
```bash
# List network policies
kubectl get networkpolicies -n paperless-maverick

# Temporarily allow all egress (for testing)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all-egress
  namespace: paperless-maverick
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - {}
EOF
```

**2. Update DNS Configuration**
```bash
# Check CoreDNS configuration
kubectl get configmap coredns -n kube-system -o yaml

# Restart CoreDNS if needed
kubectl rollout restart deployment/coredns -n kube-system
```

## 📊 Monitoring and Alerting Issues

### Issue: Prometheus Not Collecting Metrics

#### Symptoms
- Missing metrics in Grafana dashboards
- Prometheus targets showing as down
- No data in monitoring queries

#### Diagnosis
```bash
# Check Prometheus targets
curl -s http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'

# Check Prometheus configuration
kubectl get configmap prometheus-config -n monitoring -o yaml

# Check application metrics endpoint
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/metrics
```

#### Solutions

**1. Restart Prometheus**
```bash
kubectl rollout restart deployment/prometheus -n monitoring
```

**2. Fix Service Discovery**
```bash
# Check service annotations
kubectl get services -n paperless-maverick -o yaml | grep -A 5 annotations

# Add missing annotations
kubectl annotate service paperless-maverick -n paperless-maverick \
  prometheus.io/scrape=true \
  prometheus.io/port=3000 \
  prometheus.io/path=/metrics
```

## 📞 When to Escalate

### Immediate Escalation Required
- Complete system outage (all pods down)
- Data corruption or loss detected
- Security breach indicators
- Database unavailable for > 5 minutes

### Standard Escalation (within 30 minutes)
- Performance degradation not resolved by standard procedures
- Worker queues backed up for > 1 hour
- Multiple component failures
- External service integration completely failing

### Escalation Contacts
- **Level 1**: operations-team@mataresit.com
- **Level 2**: engineering-oncall@mataresit.com  
- **Level 3**: engineering-manager@mataresit.com
- **Emergency**: emergency-hotline@mataresit.com

---

**Last Updated**: 2025-01-21  
**Version**: 1.0.0  
**Next Review**: 2025-02-21
