# Mataresit Architecture Monitoring Guide

This document explains how the monitoring system is designed to work with Mataresit's hybrid architecture.

## 🏗️ Architecture Overview

Mataresit uses a **hybrid architecture** that combines multiple deployment and hosting strategies:

### Core Components

1. **Supabase Backend** (Primary)
   - PostgreSQL database with Row Level Security (RLS)
   - Authentication and user management
   - Edge Functions for serverless processing
   - Real-time subscriptions
   - File storage and CDN

2. **Application Layer** (Flexible Deployment)
   - React frontend with TypeScript
   - Node.js backend services
   - Embedding queue workers
   - Can be deployed via:
     - Kubernetes (production)
     - Docker Compose (development/staging)
     - Direct hosting (alternative)

3. **External Services**
   - Google Gemini AI (primary)
   - OpenAI (fallback)
   - Stripe (payments)
   - Resend (email)

## 📊 Monitoring Strategy

The monitoring system is designed to be **architecture-agnostic** and focuses on:

### 1. Service-Level Monitoring (Primary)
- **Supabase Services**: Database, Auth, Storage, Realtime, Edge Functions
- **External APIs**: AI services, payment processing, email delivery
- **Application Endpoints**: Health checks, API responses, user-facing services

### 2. Infrastructure Monitoring (Secondary)
- **Kubernetes**: When available and configured
- **Container Health**: Docker containers and orchestration
- **Resource Usage**: CPU, memory, network utilization

### 3. Application Monitoring (Continuous)
- **Performance Metrics**: Response times, throughput, error rates
- **Security Validation**: Authentication, authorization, data protection
- **Business Logic**: Queue processing, embedding generation, user workflows

## 🔍 Monitoring Jobs

### Health Monitoring
**Purpose**: Overall system health and endpoint availability
**Focus**: Supabase connectivity, public endpoints, Edge Functions
**Fallback**: Kubernetes pod health (when available)

```yaml
Tests:
- Supabase health endpoint
- Database connectivity
- Edge Function responsiveness
- Public domain accessibility
- Application health endpoints
- Kubernetes pods (optional)
```

### Supabase Services Monitoring
**Purpose**: Core backend service validation
**Focus**: All Supabase services that Mataresit depends on
**Critical**: Database, Auth, Storage, Realtime

```yaml
Tests:
- Database queries and connectivity
- Authentication service status
- Storage service availability
- Realtime WebSocket connections
- Queue system functionality
```

### Performance Monitoring
**Purpose**: System performance and responsiveness
**Focus**: Response times, throughput, resource utilization
**Adaptive**: Works with or without infrastructure access

```yaml
Tests:
- Supabase response times
- Database query performance
- Edge Function execution time
- Application endpoint speed
- Resource usage (when available)
```

### Security Monitoring
**Purpose**: Security posture and vulnerability detection
**Focus**: Authentication, authorization, data protection
**Comprehensive**: Multiple security layers

```yaml
Tests:
- Authentication enforcement
- Row Level Security (RLS) policies
- Security headers validation
- SSL/TLS configuration
- Dependency vulnerabilities
- Container security (when available)
```

### Alert Monitoring
**Purpose**: Notification system functionality
**Focus**: Alert delivery and escalation
**Resilient**: Multiple notification channels

```yaml
Tests:
- Slack webhook connectivity
- Email notification capability
- GitHub issue creation
- Alert system responsiveness
```

## 🔄 Adaptive Monitoring

The monitoring system adapts to different deployment scenarios:

### Scenario 1: Full Kubernetes Deployment
- All monitoring jobs run successfully
- Infrastructure monitoring provides detailed metrics
- Container-level health checks available
- Resource utilization tracking enabled

### Scenario 2: Docker Compose Deployment
- Service-level monitoring works fully
- Limited infrastructure monitoring
- Container health via Docker API
- Local resource monitoring

### Scenario 3: Supabase-Only Deployment
- Supabase monitoring provides core functionality
- Application monitoring via public endpoints
- No infrastructure monitoring
- Focus on service availability

### Scenario 4: Hybrid/Transitional
- Graceful degradation of monitoring capabilities
- Warnings for unavailable monitoring features
- Fallback to available monitoring methods
- Clear indication of monitoring coverage

## 🚨 Alert Escalation

### Critical Alerts (Immediate Response)
- Supabase database connectivity failure
- Authentication service outage
- Application completely inaccessible
- Security breach indicators

### Warning Alerts (Monitor Closely)
- Performance degradation
- Partial service unavailability
- Infrastructure resource constraints
- Non-critical security issues

### Info Alerts (Awareness)
- Monitoring system limitations
- Configuration recommendations
- Performance optimization opportunities
- Maintenance notifications

## 📈 Monitoring Metrics

### Service Availability
- **Supabase Services**: 99.9% uptime target
- **Application Endpoints**: 99.5% availability target
- **Edge Functions**: 99% success rate target

### Performance Thresholds
- **Database Queries**: < 3 seconds response time
- **API Endpoints**: < 5 seconds response time
- **Page Load**: < 4 seconds initial load
- **Edge Functions**: < 10 seconds execution time

### Security Standards
- **Authentication**: 100% enforcement
- **HTTPS**: Required for all endpoints
- **RLS Policies**: Active and validated
- **Security Headers**: Complete implementation

## 🔧 Configuration

### Environment Variables
```bash
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application Domains (Auto-detected)
DOMAIN=mataresit.com
API_DOMAIN=api.mataresit.com

# Kubernetes Configuration (Optional)
PRODUCTION_KUBECONFIG=base64_encoded_config
STAGING_KUBECONFIG=base64_encoded_config

# Notification Configuration (Optional)
SLACK_WEBHOOK_URL=your_webhook_url
CRITICAL_ALERTS_WEBHOOK_URL=your_critical_webhook_url
```

### Monitoring Schedule
- **Automated**: Every 15 minutes
- **Manual**: On-demand via workflow dispatch
- **Triggered**: On deployment completion
- **Emergency**: Manual critical checks

## 🛠️ Troubleshooting

### Common Issues

1. **"Supabase connectivity failed"**
   - Check Supabase service status
   - Verify environment variables
   - Test network connectivity

2. **"Kubernetes monitoring unavailable"**
   - Normal for non-K8s deployments
   - Check kubeconfig configuration
   - Verify cluster accessibility

3. **"Performance thresholds exceeded"**
   - Review database performance
   - Check external service status
   - Analyze resource utilization

4. **"Security validation failed"**
   - Review RLS policies
   - Check security headers
   - Verify SSL/TLS configuration

### Monitoring Coverage

The monitoring system provides different levels of coverage:

- **Full Coverage**: Kubernetes + Supabase + Application
- **Standard Coverage**: Supabase + Application
- **Basic Coverage**: Supabase + Public Endpoints
- **Minimal Coverage**: Health checks only

Each level provides appropriate monitoring for the deployment scenario while maintaining system reliability and observability.

## 📚 Related Documentation

- [Slack Webhook Setup Guide](SLACK_WEBHOOK_SETUP.md)
- [Monitoring Scripts README](../../scripts/monitoring/README.md)
- [Production Deployment Guide](../deployment/production-config.md)
- [Supabase Configuration Guide](../supabase/configuration.md)
