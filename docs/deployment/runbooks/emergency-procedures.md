# Emergency Procedures

This document outlines critical emergency procedures for the Paperless Maverick production deployment system. These procedures are designed for immediate response to critical incidents.

## 🚨 Emergency Response Overview

### Severity Levels
- **P0 - Critical**: Complete system outage, data loss risk
- **P1 - High**: Major functionality impaired, significant user impact
- **P2 - Medium**: Partial functionality affected, moderate user impact
- **P3 - Low**: Minor issues, minimal user impact

### Response Times
- **P0**: Immediate response (0-5 minutes)
- **P1**: Urgent response (5-15 minutes)
- **P2**: Standard response (15-60 minutes)
- **P3**: Scheduled response (1-24 hours)

## 🔥 Critical Emergency Procedures

### P0: Complete System Outage

#### Immediate Actions (0-5 minutes)
```bash
# 1. Verify outage scope
curl -f https://api.mataresit.com/health || echo "API DOWN"
curl -f https://app.mataresit.com || echo "APP DOWN"

# 2. Check infrastructure status
kubectl get nodes
kubectl get pods -n paperless-maverick
kubectl get services -n paperless-maverick

# 3. Activate incident response
# Send alert to #incident-response Slack channel
# Page on-call engineer via PagerDuty
```

#### Assessment Phase (5-10 minutes)
```bash
# Check recent deployments
kubectl rollout history deployment/paperless-maverick -n paperless-maverick

# Review system logs
kubectl logs -n paperless-maverick deployment/paperless-maverick --tail=100
kubectl logs -n kube-system -l app=ingress-nginx --tail=50

# Check resource utilization
kubectl top nodes
kubectl top pods -n paperless-maverick
```

#### Recovery Actions (10-30 minutes)
```bash
# Option 1: Immediate rollback if recent deployment
./rollback-automation.sh \
  --environment production \
  --immediate \
  --reason "P0 outage recovery"

# Option 2: Restart services if infrastructure issue
kubectl rollout restart deployment/paperless-maverick -n paperless-maverick
kubectl rollout restart deployment/embedding-queue-workers -n paperless-maverick

# Option 3: Scale up if resource exhaustion
kubectl scale deployment/paperless-maverick --replicas=6 -n paperless-maverick
```

### P0: Database Connectivity Loss

#### Immediate Actions
```bash
# 1. Verify database status
kubectl get pods -n database
kubectl logs -n database -l app=postgresql --tail=50

# 2. Check connection pool
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -f http://localhost:3000/health/database

# 3. Restart application with database retry
kubectl set env deployment/paperless-maverick \
  DB_RETRY_ATTEMPTS=10 \
  DB_RETRY_DELAY=5000 \
  -n paperless-maverick
```

#### Recovery Actions
```bash
# If database pod issues
kubectl delete pod -n database -l app=postgresql
kubectl wait --for=condition=ready pod -n database -l app=postgresql --timeout=300s

# If connection pool exhaustion
kubectl scale deployment/paperless-maverick --replicas=2 -n paperless-maverick
sleep 60
kubectl scale deployment/paperless-maverick --replicas=4 -n paperless-maverick
```

### P0: Security Breach Detection

#### Immediate Actions
```bash
# 1. Isolate affected systems
kubectl patch networkpolicy default-deny -n paperless-maverick --patch '{"spec":{"podSelector":{}}}'

# 2. Capture forensic data
kubectl get events -n paperless-maverick --sort-by='.lastTimestamp'
kubectl logs -n paperless-maverick --all-containers=true --since=1h > /tmp/security-incident-logs.txt

# 3. Notify security team
# Send immediate alert to security@mataresit.com
# Activate security incident response team
```

#### Containment Actions
```bash
# Rotate all secrets immediately
kubectl delete secret -n paperless-maverick --all
./deploy-secrets.sh --environment production --emergency-rotation

# Scale down to minimum viable service
kubectl scale deployment/paperless-maverick --replicas=1 -n paperless-maverick
kubectl scale deployment/embedding-queue-workers --replicas=0 -n paperless-maverick
```

## 🔧 P1: High Priority Incidents

### Application Performance Degradation

#### Detection and Assessment
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.mataresit.com/health

# Monitor resource usage
kubectl top pods -n paperless-maverick
kubectl describe nodes

# Check error rates
kubectl logs -n paperless-maverick deployment/paperless-maverick --tail=200 | grep -i error
```

#### Mitigation Actions
```bash
# Scale up application
kubectl scale deployment/paperless-maverick --replicas=8 -n paperless-maverick

# Restart unhealthy pods
kubectl delete pods -n paperless-maverick -l app=paperless-maverick --field-selector=status.phase!=Running

# Enable performance monitoring
kubectl patch deployment/paperless-maverick -n paperless-maverick --patch '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "paperless-maverick",
            "env": [
              {"name": "LOG_LEVEL", "value": "debug"},
              {"name": "METRICS_ENABLED", "value": "true"}
            ]
          }
        ]
      }
    }
  }
}'
```

### Worker Queue Backlog

#### Assessment
```bash
# Check queue depth
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -s http://localhost:3000/metrics | grep queue_depth

# Check worker status
kubectl get pods -n paperless-maverick -l app=embedding-queue-workers
kubectl logs -n paperless-maverick deployment/embedding-queue-workers --tail=100
```

#### Recovery Actions
```bash
# Scale up workers
kubectl scale deployment/embedding-queue-workers --replicas=10 -n paperless-maverick

# Restart stuck workers
kubectl rollout restart deployment/embedding-queue-workers -n paperless-maverick

# Increase worker resources
kubectl patch deployment/embedding-queue-workers -n paperless-maverick --patch '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "embedding-worker",
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

## 📞 Communication Procedures

### Incident Declaration
```bash
# Create incident in PagerDuty
curl -X POST https://api.pagerduty.com/incidents \
  -H "Authorization: Token YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "incident": {
      "type": "incident",
      "title": "Production Outage - Paperless Maverick",
      "service": {"id": "SERVICE_ID", "type": "service_reference"},
      "urgency": "high",
      "body": {"type": "incident_body", "details": "System outage detected"}
    }
  }'
```

### Status Page Updates
```bash
# Update status page
curl -X POST https://api.statuspage.io/v1/pages/PAGE_ID/incidents \
  -H "Authorization: OAuth YOUR_API_KEY" \
  -d "incident[name]=Service Disruption" \
  -d "incident[status]=investigating" \
  -d "incident[impact_override]=major"
```

### Team Notifications
- **Slack**: Post to #incident-response with @channel
- **Email**: Send to incident-response@mataresit.com
- **SMS**: Use PagerDuty for critical personnel
- **Status Page**: Update public status page immediately

## 🔄 Recovery Validation

### System Health Verification
```bash
# Comprehensive health check
./deployment-validation-framework.sh \
  --environment production \
  --emergency-validation \
  --quick-check

# API endpoint verification
curl -f https://api.mataresit.com/health/live
curl -f https://api.mataresit.com/health/ready
curl -f https://api.mataresit.com/metrics

# Database connectivity
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -f http://localhost:3000/health/database
```

### Performance Validation
```bash
# Response time check
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s https://api.mataresit.com/health
done

# Load test (if appropriate)
kubectl run load-test --image=busybox --rm -it --restart=Never -- \
  wget -q -O- https://api.mataresit.com/health
```

## 📋 Post-Incident Procedures

### Immediate Post-Recovery (0-30 minutes)
- [ ] Verify all systems operational
- [ ] Update incident status to resolved
- [ ] Notify stakeholders of resolution
- [ ] Document timeline and actions taken
- [ ] Schedule post-incident review

### Short-term Follow-up (1-24 hours)
- [ ] Conduct post-incident review meeting
- [ ] Document root cause analysis
- [ ] Identify preventive measures
- [ ] Update monitoring and alerting
- [ ] Create action items for improvements

### Long-term Actions (1-7 days)
- [ ] Implement preventive measures
- [ ] Update runbooks and procedures
- [ ] Conduct team training if needed
- [ ] Review and update emergency contacts
- [ ] Test recovery procedures

## 📚 Emergency Contacts

### Primary On-Call
- **Engineering**: +1-XXX-XXX-XXXX
- **Infrastructure**: +1-XXX-XXX-XXXX
- **Security**: +1-XXX-XXX-XXXX

### Escalation Chain
1. **On-Call Engineer** (0-15 minutes)
2. **Team Lead** (15-30 minutes)
3. **Engineering Manager** (30-60 minutes)
4. **VP Engineering** (60+ minutes)
5. **CTO** (Critical incidents only)

### External Contacts
- **Cloud Provider Support**: Available 24/7
- **Database Support**: Available 24/7
- **Security Vendor**: Available 24/7
- **Legal/Compliance**: Business hours only

---

**Last Updated**: 2025-01-21  
**Version**: 1.0.0  
**Emergency Hotline**: +1-XXX-XXX-XXXX
