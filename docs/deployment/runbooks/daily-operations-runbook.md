# Daily Operations Runbook

This runbook provides daily operational procedures for maintaining the Paperless Maverick production deployment system. These procedures ensure system health, performance, and reliability.

## 📅 Daily Operations Schedule

### Morning Health Check (9:00 AM UTC)
- System health verification
- Performance metrics review
- Error rate analysis
- Resource utilization check
- Security alert review

### Midday Monitoring (1:00 PM UTC)
- Queue depth monitoring
- Database performance check
- User activity analysis
- Alert status review

### Evening Review (6:00 PM UTC)
- Daily metrics summary
- Incident review
- Capacity planning check
- Backup verification
- Next day preparation

## 🔍 Morning Health Check Procedures

### System Health Verification
```bash
# Check overall system status
kubectl get nodes
kubectl get pods -n paperless-maverick
kubectl get services -n paperless-maverick

# Verify application health
curl -f https://api.mataresit.com/health/live
curl -f https://api.mataresit.com/health/ready
curl -f https://api.mataresit.com/health/database

# Check deployment status
kubectl get deployments -n paperless-maverick
kubectl rollout status deployment/paperless-maverick -n paperless-maverick
kubectl rollout status deployment/embedding-queue-workers -n paperless-maverick
```

### Performance Metrics Review
```bash
# Check response times (should be < 500ms average)
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s https://api.mataresit.com/health
done | awk '{sum+=$1; count++} END {print "Average response time:", sum/count, "seconds"}'

# Check resource utilization
kubectl top nodes
kubectl top pods -n paperless-maverick

# Review Prometheus metrics
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total[5m])" | jq '.data.result[0].value[1]'
```

### Error Rate Analysis
```bash
# Check application error logs (last 24 hours)
kubectl logs -n paperless-maverick deployment/paperless-maverick --since=24h | grep -i error | wc -l

# Check worker error logs
kubectl logs -n paperless-maverick deployment/embedding-queue-workers --since=24h | grep -i error | wc -l

# Review error rate metrics
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[24h])" | jq '.data.result[0].value[1]'
```

### Resource Utilization Check
```bash
# CPU utilization (should be < 80%)
kubectl top pods -n paperless-maverick | awk 'NR>1 {print $3}' | sed 's/m//' | awk '{sum+=$1; count++} END {print "Average CPU:", sum/count, "millicores"}'

# Memory utilization (should be < 85%)
kubectl top pods -n paperless-maverick | awk 'NR>1 {print $4}' | sed 's/Mi//' | awk '{sum+=$1; count++} END {print "Average Memory:", sum/count, "Mi"}'

# Disk usage check
kubectl exec -n paperless-maverick deployment/paperless-maverick -- df -h | grep -v tmpfs
```

## 📊 Midday Monitoring Procedures

### Queue Depth Monitoring
```bash
# Check embedding queue depth (should be < 100)
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/metrics | grep queue_depth

# Check worker processing rate
kubectl logs -n paperless-maverick deployment/embedding-queue-workers --tail=50 | grep "processed" | tail -10

# Monitor queue processing time
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/metrics | grep queue_processing_time
```

### Database Performance Check
```bash
# Check database connections (should be < 80% of max)
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/health/database | jq '.connections'

# Check slow queries (should be < 5 per hour)
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 seconds';"

# Database size monitoring
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT pg_size_pretty(pg_database_size('paperless_maverick'));"
```

### User Activity Analysis
```bash
# Active user count (last hour)
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/metrics | grep active_users_1h

# API request rate (requests per minute)
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total[1m])*60" | jq '.data.result[0].value[1]'

# Receipt processing rate (receipts per hour)
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/metrics | grep receipts_processed_1h
```

## 🌅 Evening Review Procedures

### Daily Metrics Summary
```bash
# Generate daily metrics report
./generate-daily-metrics-report.sh --date $(date +%Y-%m-%d) --environment production

# Key metrics to review:
# - Total requests processed
# - Average response time
# - Error rate percentage
# - Peak concurrent users
# - Queue processing efficiency
# - Database performance metrics
```

### Incident Review
```bash
# Check for any incidents in the last 24 hours
kubectl get events -n paperless-maverick --sort-by='.lastTimestamp' | grep -i warning
kubectl get events -n paperless-maverick --sort-by='.lastTimestamp' | grep -i error

# Review alert history
curl -s "http://prometheus:9090/api/v1/query?query=ALERTS{alertstate='firing'}" | jq '.data.result'

# Check PagerDuty incidents (if any)
# Review Slack #alerts channel for any notifications
```

### Capacity Planning Check
```bash
# Resource trend analysis (7-day average)
curl -s "http://prometheus:9090/api/v1/query?query=avg_over_time(node_memory_MemAvailable_bytes[7d])" | jq '.data.result[0].value[1]'

# Storage growth rate
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT pg_size_pretty(pg_total_relation_size('receipts'));"

# User growth trend
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/metrics | grep total_users
```

## 🔧 Maintenance Tasks

### Weekly Tasks (Mondays)
```bash
# Container image cleanup
docker system prune -f
kubectl delete pods -n paperless-maverick --field-selector=status.phase=Succeeded

# Log rotation and cleanup
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  find /var/log -name "*.log" -mtime +7 -delete

# Certificate expiry check
kubectl get certificates -n paperless-maverick -o custom-columns=NAME:.metadata.name,READY:.status.conditions[0].status,EXPIRY:.status.notAfter
```

### Monthly Tasks (First Monday)
```bash
# Security patch review
kubectl get nodes -o wide
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}"

# Backup verification
./verify-backups.sh --environment production --last-30-days

# Performance baseline update
./update-performance-baseline.sh --environment production
```

## 📈 Monitoring Dashboard Review

### Key Dashboards to Check
1. **Production Overview Dashboard**
   - System uptime and availability
   - Request rate and response times
   - Error rates and success rates
   - Resource utilization trends

2. **Worker Health Dashboard**
   - Worker pod status and health
   - Queue processing metrics
   - Worker resource utilization
   - Processing success rates

3. **Database Performance Dashboard**
   - Connection pool utilization
   - Query performance metrics
   - Database size and growth
   - Slow query analysis

4. **Security Dashboard**
   - Failed authentication attempts
   - Rate limiting effectiveness
   - Security alert summary
   - Vulnerability scan results

### Alert Status Review
```bash
# Check active alerts
curl -s "http://prometheus:9090/api/v1/alerts" | jq '.data.alerts[] | select(.state=="firing")'

# Review alert history
curl -s "http://prometheus:9090/api/v1/query?query=increase(prometheus_notifications_total[24h])" | jq '.data.result'

# Check alertmanager status
curl -f http://alertmanager:9093/-/healthy
```

## 🚨 Daily Health Check Checklist

### System Health ✅
- [ ] All pods running and healthy
- [ ] All services accessible
- [ ] Health endpoints responding
- [ ] No critical alerts firing
- [ ] Resource utilization within limits

### Performance ✅
- [ ] Response times < 500ms average
- [ ] Error rate < 1%
- [ ] Queue depth < 100 items
- [ ] Database performance normal
- [ ] No slow queries detected

### Security ✅
- [ ] No security alerts
- [ ] Authentication working properly
- [ ] Rate limiting functional
- [ ] SSL certificates valid
- [ ] No suspicious activity detected

### Capacity ✅
- [ ] CPU utilization < 80%
- [ ] Memory utilization < 85%
- [ ] Disk usage < 80%
- [ ] Database connections < 80% of max
- [ ] Network bandwidth sufficient

## 📞 Escalation Procedures

### When to Escalate
- Any health check failing for > 15 minutes
- Error rate > 5% for > 5 minutes
- Response time > 2 seconds for > 10 minutes
- Resource utilization > 90% for > 5 minutes
- Security alerts or suspicious activity

### Escalation Contacts
- **Level 1**: operations-team@mataresit.com
- **Level 2**: engineering-oncall@mataresit.com
- **Level 3**: engineering-manager@mataresit.com
- **Emergency**: emergency-hotline@mataresit.com

### Communication Channels
- **Slack**: #operations-alerts
- **Email**: operations-team@mataresit.com
- **PagerDuty**: For critical issues
- **Status Page**: For user-facing issues

## 📝 Daily Operations Log Template

```markdown
# Daily Operations Log - [DATE]

## Morning Health Check (9:00 AM UTC)
- [ ] System health: ✅ All systems operational
- [ ] Performance: ✅ Response times normal
- [ ] Error rates: ✅ < 1%
- [ ] Resource usage: ✅ Within limits
- [ ] Security: ✅ No alerts

## Issues Identified
- None

## Actions Taken
- Routine health checks completed
- No interventions required

## Notes
- System performing well
- No capacity concerns

## Next Day Preparation
- [ ] Review scheduled maintenance
- [ ] Check deployment calendar
- [ ] Verify on-call coverage

**Operator**: [NAME]
**Shift**: Morning (9 AM - 5 PM UTC)
```

---

**Last Updated**: 2025-01-21  
**Version**: 1.0.0  
**Next Review**: 2025-02-21
