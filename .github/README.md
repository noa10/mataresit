# CI/CD Pipeline Documentation

This directory contains the complete CI/CD pipeline configuration for Paperless Maverick, implementing automated deployment with comprehensive testing, security scanning, and monitoring.

## 🚀 Workflow Overview

### Core Workflows

1. **`ci.yml`** - Continuous Integration
   - Code quality checks (ESLint, TypeScript)
   - Security scanning (TruffleHog, npm audit, Snyk)
   - Unit and integration tests
   - Docker image building and pushing
   - Container security scanning (Trivy, Grype)

2. **`deploy-staging.yml`** - Staging Deployment
   - Triggered on `develop` branch pushes
   - Pre-deployment validation
   - Automated staging deployment
   - Post-deployment testing
   - Slack notifications

3. **`deploy-production.yml`** - Production Deployment
   - Triggered on `main` branch pushes or tags
   - Manual approval gates (2 approvers required)
   - Blue-green deployment strategy
   - Comprehensive validation
   - Automated rollback on failure

4. **`rollback.yml`** - Emergency Rollback
   - Manual trigger for emergency situations
   - Multi-step rollback capability
   - Emergency approval process
   - Health validation after rollback

5. **`security-scan.yml`** - Security Scanning
   - Daily automated security scans
   - Code analysis (CodeQL)
   - Dependency scanning (Snyk, npm audit)
   - Container scanning (Trivy, Grype)
   - Infrastructure scanning (Checkov)
   - Secrets detection (TruffleHog, GitLeaks)

6. **`monitoring.yml`** - Production Monitoring
   - 15-minute health checks
   - Performance monitoring
   - Critical alert notifications
   - System health reporting

## 🔧 Setup Instructions

### 1. Repository Secrets Configuration

Configure the following secrets in your GitHub repository settings:

#### Production Environment
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI/ML APIs
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# Security
API_KEY_ENCRYPTION_KEY=your_32_byte_encryption_key
JWT_SECRET=your_jwt_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn
GRAFANA_ADMIN_PASSWORD=your_grafana_password

# Notifications
SLACK_WEBHOOK_URL=your_slack_webhook_url
CRITICAL_ALERTS_WEBHOOK_URL=your_critical_alerts_webhook
SECURITY_SLACK_WEBHOOK_URL=your_security_webhook

# Kubernetes
PRODUCTION_KUBECONFIG=base64_encoded_kubeconfig
STAGING_KUBECONFIG=base64_encoded_staging_kubeconfig

# Approvers
PRODUCTION_APPROVERS=user1,user2,user3
EMERGENCY_APPROVERS=user1,user2

# Security Tools
SNYK_TOKEN=your_snyk_token
GITLEAKS_LICENSE=your_gitleaks_license
```

#### Staging Environment
```bash
# Staging-specific secrets (prefix with STAGING_)
STAGING_SUPABASE_URL=https://your-staging-project.supabase.co
STAGING_SUPABASE_ANON_KEY=your_staging_anon_key
STAGING_SUPABASE_SERVICE_ROLE_KEY=your_staging_service_role_key
STAGING_GEMINI_API_KEY=your_staging_gemini_key
STAGING_OPENAI_API_KEY=your_staging_openai_key
STAGING_API_KEY_ENCRYPTION_KEY=your_staging_encryption_key
STAGING_JWT_SECRET=your_staging_jwt_secret
```

#### Test Environment
```bash
# Test-specific secrets (prefix with TEST_)
TEST_SUPABASE_URL=https://your-test-project.supabase.co
TEST_SUPABASE_ANON_KEY=your_test_anon_key
TEST_SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key
TEST_GEMINI_API_KEY=your_test_gemini_key
```

### 2. Branch Protection Rules

Configure branch protection for `main` and `develop` branches:

#### Main Branch Protection
- Require pull request reviews (2 reviewers)
- Require status checks to pass before merging:
  - `Code Quality & Security`
  - `Test Suite`
  - `Build Application`
  - `Build Worker Image`
  - `Security Scan`
- Require branches to be up to date before merging
- Restrict pushes to matching branches
- Require signed commits

#### Develop Branch Protection
- Require pull request reviews (1 reviewer)
- Require status checks to pass before merging:
  - `Code Quality & Security`
  - `Test Suite`
- Require branches to be up to date before merging

### 3. Environment Configuration

#### Production Environment
- **Name:** `production`
- **URL:** `https://mataresit.com`
- **Protection Rules:**
  - Required reviewers: 2
  - Deployment branches: `main` only
  - Environment secrets: Production secrets

#### Staging Environment
- **Name:** `staging`
- **URL:** `https://staging.mataresit.com`
- **Protection Rules:**
  - Required reviewers: 1
  - Deployment branches: `develop` only
  - Environment secrets: Staging secrets

## 🔄 Deployment Process

### Staging Deployment
1. Push to `develop` branch
2. CI pipeline runs automatically
3. If CI passes, staging deployment triggers
4. Automated deployment to staging environment
5. Post-deployment tests run
6. Slack notification sent

### Production Deployment
1. Create pull request to `main` branch
2. Code review and approval (2 reviewers required)
3. Merge to `main` triggers production pipeline
4. Pre-deployment validation runs
5. **Manual approval required** (2 approvers)
6. Blue-green deployment to production
7. Post-deployment validation
8. Success notification or automated rollback

### Emergency Rollback
1. Go to Actions → Emergency Rollback
2. Select environment and rollback steps
3. Provide rollback reason
4. **Emergency approval required** (1 approver for production)
5. Automated rollback execution
6. Health validation
7. Incident notifications

## 📊 Monitoring & Alerts

### Automated Monitoring
- **Health Checks:** Every 15 minutes
- **Performance Tests:** Daily
- **Security Scans:** Daily
- **Dependency Checks:** On every push

### Alert Conditions
- System health check failures
- Performance degradation
- Security vulnerabilities
- Deployment failures
- High error rates

### Notification Channels
- **Slack:** General notifications and alerts
- **Critical Alerts:** Separate channel for urgent issues
- **Security:** Dedicated security team notifications
- **GitHub Issues:** Automatic incident creation

## 🔐 Security Features

### Code Security
- **CodeQL Analysis:** Advanced semantic code analysis
- **Dependency Scanning:** npm audit + Snyk integration
- **Secrets Detection:** TruffleHog + GitLeaks
- **Container Scanning:** Trivy + Grype vulnerability scanning
- **Infrastructure Scanning:** Checkov policy validation

### Deployment Security
- **Image Signing:** Docker images signed and verified
- **Security Gates:** Deployment blocked on critical vulnerabilities
- **RBAC:** Role-based access control for deployments
- **Audit Logging:** Complete deployment audit trail

## 🚨 Troubleshooting

### Common Issues

#### CI Pipeline Failures
```bash
# Check workflow logs
gh run list --workflow=ci.yml
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id> --failed
```

#### Deployment Failures
```bash
# Check deployment status
kubectl get deployments -n paperless-maverick
kubectl describe deployment paperless-maverick -n paperless-maverick

# View pod logs
kubectl logs -f deployment/paperless-maverick -n paperless-maverick
```

#### Security Scan Failures
```bash
# View security scan results
gh run view <run-id> --log
# Check GitHub Security tab for detailed findings
```

### Emergency Procedures

#### Production Down
1. Check monitoring dashboard
2. Review recent deployments
3. Execute emergency rollback if needed
4. Escalate to on-call engineer
5. Create incident issue

#### Security Incident
1. Review security scan results
2. Assess vulnerability impact
3. Apply security patches
4. Re-run security scans
5. Document remediation

## 📈 Metrics & Reporting

### Key Metrics
- **Deployment Frequency:** Tracked per environment
- **Lead Time:** From commit to production
- **Mean Time to Recovery:** Incident resolution time
- **Change Failure Rate:** Failed deployment percentage

### Reports
- **Daily:** Security scan summary
- **Weekly:** Deployment metrics
- **Monthly:** Performance trends
- **Quarterly:** Security posture review

## 🔗 Integration Points

- **GitHub:** Source code and CI/CD
- **Kubernetes:** Container orchestration
- **Docker Registry:** Container images (GHCR)
- **Supabase:** Database and backend services
- **Slack:** Notifications and alerts
- **Sentry:** Error monitoring
- **Grafana:** Metrics and dashboards

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Deployment Guide](../infrastructure/production/README.md)
- [Security Best Practices](../docs/security/README.md)
- [Monitoring Setup Guide](../docs/monitoring/README.md)

---

**Note:** This CI/CD pipeline implements industry best practices for secure, reliable, and automated software delivery with comprehensive monitoring and rollback capabilities.
