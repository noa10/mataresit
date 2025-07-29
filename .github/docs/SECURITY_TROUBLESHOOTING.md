# Security Scanning Troubleshooting Guide

This guide helps resolve common issues with security scanning in the Mataresit project's GitHub Actions workflows.

## 🚨 **Common Error Messages and Solutions**

### **Snyk Authentication Errors**

#### **Error: "Authentication failed"**
```
Error: Authentication failed. Please check your token.
```

**Cause**: Invalid or missing SNYK_TOKEN secret

**Solution**:
1. Verify your Snyk token:
   ```bash
   # Test token locally
   curl -H "Authorization: token YOUR_TOKEN" https://api.snyk.io/v1/user/me
   ```

2. Get a new token from [Snyk Account Settings](https://app.snyk.io/account)

3. Update GitHub secret:
   ```bash
   gh secret set SNYK_TOKEN --body "your_new_token" --repo your-username/mataresit
   ```

#### **Error: "Rate limit exceeded"**
```
Error: API rate limit exceeded
```

**Cause**: Too many API calls to Snyk

**Solution**:
- Wait 1 hour for rate limit reset
- Consider upgrading Snyk plan for higher limits
- Reduce scan frequency in workflows

### **CodeQL Build Failures**

#### **Error: "Build failed during CodeQL analysis"**
```
Error: We were unable to automatically build your code
```

**Cause**: Build dependencies or configuration issues

**Solution**:
1. Ensure build works locally:
   ```bash
   npm ci
   npm run build
   ```

2. Check Node.js version compatibility in workflow:
   ```yaml
   - name: Setup Node.js
     uses: actions/setup-node@v4
     with:
       node-version: '18'  # Match your local version
   ```

3. Add manual build steps if needed:
   ```yaml
   - name: Manual build for CodeQL
     run: |
       npm ci
       npm run build
   ```

### **TruffleHog Secret Detection Issues**

#### **Error: "TruffleHog scan failed"**
```
Error: TruffleHog exited with code 1
```

**Cause**: Secrets detected in code or scan configuration issues

**Solution**:
1. Review detected secrets:
   ```bash
   # Run locally to see details
   docker run --rm -v "$(pwd):/pwd" trufflesecurity/trufflehog:latest filesystem /pwd
   ```

2. Add false positives to `.trufflehogignore`:
   ```
   # Example patterns to ignore
   tests/fixtures/fake-api-key.txt
   docs/examples/sample-config.json
   ```

3. Use `--only-verified` flag to reduce false positives

### **GitLeaks Configuration Issues**

#### **Error: "GitLeaks license validation failed"**
```
Error: Invalid or expired GitLeaks license
```

**Cause**: Invalid GITLEAKS_LICENSE secret

**Solution**:
1. For open source projects, remove the license (GitLeaks is free)
2. For private repos, verify license validity
3. Update secret if needed:
   ```bash
   gh secret set GITLEAKS_LICENSE --body "your_license" --repo your-username/mataresit
   ```

### **Frontend Security Scan Issues**

#### **Error: "Build output not found"**
```
Error: dist/ directory not found
```

**Cause**: Build failed or incorrect build output directory

**Solution**:
1. Verify build configuration in `vite.config.ts`:
   ```typescript
   export default defineConfig({
     build: {
       outDir: 'dist',  // Ensure this matches workflow expectations
     }
   })
   ```

2. Check build script in `package.json`:
   ```json
   {
     "scripts": {
       "build": "vite build"
     }
   }
   ```

### **Supabase Security Validation Issues**

#### **Error: "Supabase configuration not found"**
```
Error: supabase/config.toml not found
```

**Cause**: Missing Supabase configuration

**Solution**:
1. Initialize Supabase if not done:
   ```bash
   npx supabase init
   ```

2. Ensure `supabase/config.toml` exists and is committed

3. Skip Supabase checks if not using Supabase:
   ```yaml
   - name: Scan Supabase configuration
     if: hashFiles('supabase/config.toml') != ''
     run: |
       # Supabase security checks
   ```

## 🔧 **Workflow Permission Issues**

### **Error: "Permission denied"**
```
Error: Resource not accessible by integration
```

**Cause**: Insufficient GitHub token permissions

**Solution**:
1. Update workflow permissions:
   ```yaml
   jobs:
     security-scan:
       permissions:
         actions: read
         contents: read
         security-events: write
         pull-requests: write
   ```

2. Check repository settings:
   - Go to Settings → Actions → General
   - Ensure "Read and write permissions" is enabled

### **Error: "Cannot upload SARIF file"**
```
Error: Failed to upload SARIF file to GitHub Security tab
```

**Cause**: Missing `security-events: write` permission

**Solution**:
```yaml
permissions:
  security-events: write
  contents: read
```

## 🛠️ **Debugging Steps**

### **Step 1: Enable Debug Logging**

Add debug output to workflows:
```yaml
- name: Debug security scan
  run: |
    echo "Debug information:"
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    echo "Working directory: $(pwd)"
    echo "Files in directory:"
    ls -la
    echo "Environment variables:"
    env | grep -E "(NODE_|NPM_|CI)" | sort
```

### **Step 2: Test Security Tools Locally**

#### **Test Snyk**
```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth YOUR_TOKEN

# Test scan
snyk test --severity-threshold=high
```

#### **Test TruffleHog**
```bash
# Run TruffleHog locally
docker run --rm -v "$(pwd):/pwd" trufflesecurity/trufflehog:latest filesystem /pwd --only-verified
```

#### **Test GitLeaks**
```bash
# Install GitLeaks
brew install gitleaks  # macOS
# or download from https://github.com/zricethezav/gitleaks/releases

# Run scan
gitleaks detect --source . --verbose
```

### **Step 3: Validate Secrets Configuration**

Use the validation script:
```bash
# Make script executable
chmod +x .github/scripts/validate-security-setup.sh

# Run validation
.github/scripts/validate-security-setup.sh --repo your-username/mataresit --all
```

### **Step 4: Check Workflow Syntax**

Validate workflow YAML:
```bash
# Install act (GitHub Actions runner)
brew install act  # macOS

# Validate workflow
act --list
act -n  # Dry run
```

## 📊 **Monitoring and Alerts**

### **Setting Up Slack Notifications**

1. Create Slack webhook:
   - Go to your Slack workspace
   - Create new app → Incoming Webhooks
   - Copy webhook URL

2. Add to GitHub secrets:
   ```bash
   gh secret set SECURITY_SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..." --repo your-username/mataresit
   ```

3. Test notification:
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test security notification"}' \
     YOUR_WEBHOOK_URL
   ```

### **GitHub Security Tab**

Monitor security issues:
1. Go to repository → Security tab
2. Check "Code scanning alerts"
3. Review "Secret scanning alerts"
4. Monitor "Dependabot alerts"

## 🔄 **Recovery Procedures**

### **If Security Scan Blocks Deployment**

1. **Immediate action** (for critical production issues):
   ```yaml
   # Temporarily skip security checks
   - name: Security scan
     if: github.event_name != 'push' || github.ref != 'refs/heads/main'
     run: |
       # Security scan commands
   ```

2. **Create hotfix branch**:
   ```bash
   git checkout -b hotfix/security-scan-fix
   # Fix security issues
   git commit -m "fix: resolve security scan issues"
   git push origin hotfix/security-scan-fix
   ```

3. **Re-enable security checks** after fixes

### **If Secrets Are Compromised**

1. **Immediately rotate secrets**:
   ```bash
   # Generate new tokens/keys
   # Update GitHub secrets
   gh secret set SECRET_NAME --body "new_value" --repo your-username/mataresit
   ```

2. **Review access logs**:
   - Check Supabase logs
   - Review Vercel deployment logs
   - Monitor for unauthorized access

3. **Update security policies** if needed

## 📞 **Getting Help**

### **Internal Resources**
- `.github/docs/SECURITY_SCANNING_SETUP.md` - Setup guide
- `.github/scripts/validate-security-setup.sh` - Validation script
- `.github/workflows/README.md` - Workflow documentation

### **External Resources**
- [Snyk Documentation](https://docs.snyk.io/)
- [GitHub Security Documentation](https://docs.github.com/en/code-security)
- [TruffleHog Documentation](https://github.com/trufflesecurity/trufflehog)
- [GitLeaks Documentation](https://github.com/zricethezav/gitleaks)

### **Support Channels**
- GitHub Issues for workflow problems
- Slack #security channel for urgent issues
- Team leads for approval and guidance
