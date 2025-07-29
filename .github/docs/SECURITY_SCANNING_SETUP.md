# Security Scanning Configuration Guide

This guide provides comprehensive instructions for setting up security scanning in the Mataresit project's GitHub Actions workflows.

## 🔒 **Overview**

The security scanning system is designed for the Vercel + Supabase architecture and includes:

- **Code Security Analysis** (CodeQL)
- **Dependency Vulnerability Scanning** (npm audit, Snyk)
- **Frontend Security Checks** (Bundle analysis, client-side security)
- **Supabase Security Validation** (Edge Functions, configuration)
- **Secret Scanning** (TruffleHog, GitLeaks)

## 🔑 **Required Secrets Setup**

### **Step 1: Create Security Tool Accounts**

#### **Snyk Account Setup**
1. Go to [snyk.io](https://snyk.io) and create an account
2. Navigate to Account Settings → API Token
3. Generate a new API token
4. Copy the token (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

#### **GitLeaks License (Optional)**
1. GitLeaks is free for open source projects
2. For private repositories, consider purchasing a license
3. If you have a license, add it to secrets

### **Step 2: Configure GitHub Repository Secrets**

Add the following secrets to your GitHub repository:

#### **Security Scanning Secrets**
```bash
# Required for Snyk scanning
SNYK_TOKEN=your_snyk_api_token_here

# Optional for GitLeaks (if you have a license)
GITLEAKS_LICENSE=your_gitleaks_license_here

# Notification webhooks
SECURITY_SLACK_WEBHOOK_URL=your_security_alerts_webhook_here
SLACK_WEBHOOK_URL=your_general_notifications_webhook_here
```

#### **Supabase Secrets (for security validation)**
```bash
# Production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_PROJECT_ID=your_project_id

# Staging
STAGING_SUPABASE_URL=https://your-staging-project.supabase.co
STAGING_SUPABASE_ANON_KEY=your_staging_anon_key
STAGING_SUPABASE_SERVICE_ROLE_KEY=your_staging_service_role_key
STAGING_SUPABASE_PROJECT_ID=your_staging_project_id

# Testing
TEST_SUPABASE_URL=https://your-test-project.supabase.co
TEST_SUPABASE_ANON_KEY=your_test_anon_key
TEST_SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key
```

### **Step 3: Automated Secret Setup**

Use the provided script to set up secrets automatically:

```bash
# Create environment file
cp .github/scripts/secrets-template.env .env.production

# Edit with your actual values
nano .env.production

# Set up secrets (requires GitHub CLI)
.github/scripts/setup-secrets.sh --repo your-username/mataresit --env-file .env.production
```

## 🛠️ **Security Scanning Configuration**

### **CodeQL Configuration**

CodeQL is configured to scan JavaScript and TypeScript code with security-focused queries:

```yaml
# .github/workflows/security-scan.yml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: javascript, typescript
    queries: security-extended,security-and-quality
```

**No additional configuration required** - CodeQL works out of the box.

### **Snyk Configuration**

Snyk scans for dependency vulnerabilities:

```yaml
- name: Run Snyk security scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --severity-threshold=high --json > snyk-results.json
```

**Configuration Options:**
- `--severity-threshold=high` - Only report high and critical vulnerabilities
- `--json` - Output results in JSON format for processing
- `continue-on-error: true` - Don't fail the workflow on vulnerabilities

### **Frontend Security Configuration**

Custom security checks for the React/TypeScript frontend:

```bash
# Check for source maps in production (security risk)
find dist -name "*.map"

# Check for potential secrets in build output
grep -r "sk_\|pk_\|api_key\|secret" dist/ --include="*.js" --include="*.css"

# Check bundle size (potential security risk if too large)
du -sb dist/
```

### **Supabase Security Configuration**

Security validation for Supabase components:

```bash
# Check for hardcoded secrets in Edge Functions
grep -r "sk_\|pk_\|api_key\|secret\|password" supabase/functions/

# Check for unsafe code patterns
grep -r "eval\|innerHTML\|document.write" supabase/functions/

# Validate configuration files
grep -i "localhost\|127.0.0.1\|password\|secret" supabase/config.toml
```

## 🚨 **Security Thresholds and Gates**

### **Environment-Specific Thresholds**

#### **Production**
- **Critical vulnerabilities**: 0 allowed
- **High vulnerabilities**: Maximum 2 allowed
- **Medium vulnerabilities**: Maximum 10 allowed
- **Lighthouse security score**: Minimum 80

#### **Staging**
- **Critical vulnerabilities**: Maximum 1 allowed
- **High vulnerabilities**: Maximum 5 allowed
- **Medium vulnerabilities**: Maximum 20 allowed
- **Lighthouse security score**: Minimum 70

#### **Development**
- **Critical vulnerabilities**: Maximum 3 allowed
- **High vulnerabilities**: Maximum 10 allowed
- **Medium vulnerabilities**: Maximum 50 allowed
- **Lighthouse security score**: Minimum 60

### **Security Gate Configuration**

The security gate evaluates overall security posture:

```bash
# Score calculation (0-100)
SCORE=100
SCORE=$((SCORE - (CRITICAL * 20)))  # Critical: -20 points each
SCORE=$((SCORE - (HIGH * 10)))      # High: -10 points each
SCORE=$((SCORE - (MEDIUM * 2)))     # Medium: -2 points each

# Factor in Lighthouse score (30% weight)
FINAL_SCORE=$(((SCORE * 70) + (LIGHTHOUSE_SCORE * 30)) / 100)
```

## 📊 **Monitoring and Alerts**

### **Slack Notifications**

Configure Slack webhooks for security alerts:

1. Create a Slack app in your workspace
2. Add incoming webhook integration
3. Copy webhook URL to `SECURITY_SLACK_WEBHOOK_URL` secret

### **GitHub Security Tab**

Security scan results are automatically uploaded to GitHub's Security tab:

- CodeQL results appear as code scanning alerts
- Snyk results are uploaded as SARIF files
- Secret scanning results are tracked automatically

### **Scheduled Scanning**

Security scans run automatically:

- **Daily at 2 AM UTC** - Full security scan
- **On every push** to main/develop branches
- **On pull requests** to main branch
- **Manual trigger** available via workflow dispatch

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Snyk Token Issues**
```bash
# Error: "Authentication failed"
# Solution: Verify SNYK_TOKEN secret is correctly set
gh secret list --repo your-username/mataresit | grep SNYK_TOKEN
```

#### **CodeQL Build Failures**
```bash
# Error: "Build failed"
# Solution: Ensure npm ci and npm run build work locally
npm ci
npm run build
```

#### **Frontend Security False Positives**
```bash
# Issue: Source maps detected in production
# Solution: Configure Vite to exclude source maps in production
# vite.config.ts: build.sourcemap = false
```

#### **Supabase Connection Issues**
```bash
# Error: "Supabase health check failed"
# Solution: Verify Supabase URL and keys are correct
curl -f "$SUPABASE_URL/health"
```

### **Debug Mode**

Enable debug mode for detailed logging:

```yaml
# Add to workflow step
- name: Debug security scan
  run: |
    echo "Debug mode enabled"
    set -x  # Enable bash debug mode
    # Your security scan commands here
```

## 📚 **Additional Resources**

- [Snyk Documentation](https://docs.snyk.io/)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [GitHub Security Features](https://docs.github.com/en/code-security)
- [TruffleHog Documentation](https://github.com/trufflesecurity/trufflehog)
- [GitLeaks Documentation](https://github.com/zricethezav/gitleaks)

## 🔄 **Maintenance**

### **Regular Tasks**
- Review security scan results weekly
- Update Snyk token annually
- Rotate webhook URLs if compromised
- Update security thresholds based on project maturity

### **Security Incident Response**
1. Critical vulnerability detected → Immediate Slack alert
2. Review vulnerability details in GitHub Security tab
3. Create hotfix branch if needed
4. Deploy fix and re-run security scans
5. Document incident and lessons learned
