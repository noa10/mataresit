# GitHub Actions Workflows - Vercel + Supabase Architecture

This directory contains GitHub Actions workflows optimized for the Mataresit application's Vercel + Supabase architecture.

## 🏗️ **Architecture Overview**

- **Frontend**: React/TypeScript SPA deployed on Vercel
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **Deployment**: Git-based deployments via Vercel
- **Database**: Supabase managed PostgreSQL with migrations

## 📋 **Workflow Files**

### **Core Workflows**

#### `ci.yml` - Continuous Integration
- **Purpose**: Code quality, testing, and build validation
- **Triggers**: Push to main/develop/feature branches, PRs
- **Features**:
  - ESLint and TypeScript checks
  - Security auditing (npm audit, TruffleHog)
  - Unit and integration testing
  - Build validation
  - Vercel preview deployments for PRs
  - Deployment readiness gates

#### `supabase-validate.yml` - Supabase Code Validation
- **Purpose**: Validate Supabase migrations and Edge Functions (validation-only, no deployment)
- **Triggers**: Push to main/develop (supabase/ changes), manual dispatch
- **Features**:
  - Migration file syntax and naming validation
  - Edge Function TypeScript validation
  - Supabase configuration validation
  - HTTP API connectivity testing
  - Manual deployment required after validation passes

#### `security-scan.yml` - Security Scanning
- **Purpose**: Comprehensive security analysis
- **Triggers**: Daily schedule, push to main/develop, manual dispatch
- **Features**:
  - CodeQL analysis
  - Dependency vulnerability scanning
  - Frontend security checks (bundle analysis)
  - Supabase configuration security
  - Secret scanning

#### `monitoring.yml` - Production Monitoring
- **Purpose**: Health checks and system monitoring
- **Triggers**: Every 15 minutes, manual dispatch
- **Features**:
  - Supabase service health checks
  - Vercel deployment monitoring
  - Public endpoint testing
  - Security header validation
  - Alert system testing



#### `vercel-rollback.yml` - Emergency Rollback
- **Purpose**: Emergency rollback for production issues
- **Triggers**: Manual dispatch only
- **Features**:
  - Git-based frontend rollback
  - Supabase Edge Function rollback
  - Approval gates for production
  - Post-rollback validation

### **Removed Workflows**

The following workflows were removed as they were incompatible with Vercel + Supabase:

- `enhanced-ci.yml` - Redundant with main CI
- `automated-deployment.yml` - Kubernetes-based deployment
- `deploy-production.yml` - Kubernetes deployment
- `deploy-staging.yml` - Kubernetes deployment
- `rollback.yml` - Kubernetes rollback
- `deployment-gates.yml` - Containerized deployment gates incompatible with serverless architecture

## 🔧 **Required Secrets**

### **Vercel Secrets**
```
VERCEL_TOKEN - Vercel API token
VERCEL_ORG_ID - Vercel organization ID
VERCEL_PROJECT_ID - Vercel project ID
```

### **Supabase Secrets**
```
# Production
SUPABASE_URL - Production Supabase URL
SUPABASE_ANON_KEY - Production anonymous key
SUPABASE_SERVICE_ROLE_KEY - Production service role key
SUPABASE_PROJECT_ID - Production project ID
SUPABASE_ACCESS_TOKEN - Supabase CLI access token

# Staging
STAGING_SUPABASE_URL - Staging Supabase URL
STAGING_SUPABASE_ANON_KEY - Staging anonymous key
STAGING_SUPABASE_SERVICE_ROLE_KEY - Staging service role key
STAGING_SUPABASE_PROJECT_ID - Staging project ID

# Testing
TEST_SUPABASE_URL - Test Supabase URL
TEST_SUPABASE_ANON_KEY - Test anonymous key
TEST_SUPABASE_SERVICE_ROLE_KEY - Test service role key
TEST_GEMINI_API_KEY - Test Gemini API key
```

### **Security & Monitoring**
```
SNYK_TOKEN - Snyk security scanning token
SLACK_WEBHOOK_URL - Slack notifications webhook
SECURITY_SLACK_WEBHOOK_URL - Security alerts webhook
CRITICAL_ALERTS_WEBHOOK_URL - Critical alerts webhook
EMERGENCY_APPROVERS - GitHub usernames for emergency approvals
```

## 🚀 **Deployment Flow**

### **Development Flow**
1. Feature branch → PR created
2. CI workflow runs (quality checks, tests, build)
3. Vercel preview deployment created
4. Code review and approval
5. Merge to develop → Staging deployment

### **Production Flow**
1. Develop → Main branch (via PR)
2. CI workflow validates changes
3. Supabase validation workflow checks migrations and functions
4. Manual Supabase deployment (if needed)
5. Vercel automatically deploys to production
6. Monitoring validates deployment

### **Emergency Rollback**
1. Manual trigger of `vercel-rollback.yml`
2. Approval gate for production
3. Git-based rollback to previous commit
4. Supabase Edge Function rollback
5. Validation and notifications

## 📊 **Monitoring & Alerts**

### **Health Checks**
- Supabase service availability
- Vercel deployment status
- Public endpoint accessibility
- Security header validation

### **Alert Conditions**
- Health check failures
- Security scan failures
- Deployment failures
- Performance degradation

### **Notification Channels**
- Slack webhooks for team notifications
- GitHub issues for tracking
- Email alerts for critical issues

## 🔒 **Security Features**

### **Code Security**
- CodeQL analysis for vulnerabilities
- Dependency scanning with npm audit and Snyk
- Blocking npm audit gates evaluate production/runtime dependencies (`--omit=dev`) at high/critical severity; full dependency audit remains informational
- Secret scanning with TruffleHog
- Frontend bundle security analysis

### **Infrastructure Security**
- Supabase configuration validation
- Edge Function security checks
- Database migration security
- Environment variable validation

### **Deployment Security**
- Approval gates for production
- Security scoring system
- Lighthouse security audits
- Post-deployment validation

## 🛠️ **Maintenance**

### **Regular Tasks**
- Review security scan results
- Update dependency versions
- Monitor workflow performance
- Validate secret rotation
- Run infrastructure cleanup analysis
- Test deployment validation scripts

### **Troubleshooting**
- Check workflow logs in GitHub Actions
- Validate secret configuration
- Test Supabase connectivity
- Verify Vercel deployment status
- Use new validation scripts for debugging
- Review migration documentation for architecture issues

### **Environment Secrets Configuration**
- Ensure secrets are configured as "Environment secrets" in GitHub repository settings
- All Supabase deployment jobs require `environment: Production` to access environment secrets
- Repository secrets are accessible without environment specification
- Environment secrets provide additional security and access control

### **Infrastructure Management**
```bash
# Analyze deprecated infrastructure
.github/scripts/infrastructure-cleanup.sh --action analyze

# Validate deployment configuration
.github/scripts/vercel-supabase-validator.sh --environment production --check-type all

# Check for configuration issues
.github/scripts/quick-security-check.sh
```

## 📚 **Additional Resources**

### **External Documentation**
- [Vercel Deployment Documentation](https://vercel.com/docs)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

### **Project Documentation**
- [Deployment Migration Guide](../docs/DEPLOYMENT_MIGRATION_GUIDE.md)
- [Deployment Configuration Summary](../docs/DEPLOYMENT_CONFIGURATION_SUMMARY.md)
- [Security Scanning Setup](../docs/SECURITY_SCANNING_SETUP.md)
- [Security Troubleshooting](../docs/SECURITY_TROUBLESHOOTING.md)
