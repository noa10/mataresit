# Deployment Security and Compliance System

This directory contains a comprehensive deployment security and compliance system for the Paperless Maverick application. The system provides automated security scanning, policy enforcement, vulnerability assessment, and compliance validation with detailed reporting and audit trails.

## 📋 Overview

The deployment security and compliance system consists of several integrated components:

1. **Security Scanner** (`deployment-security-scanner.sh`) - Comprehensive security scanning and validation
2. **Policy Enforcer** (`security-policy-enforcer.sh`) - Automated security policy enforcement
3. **Vulnerability Assessment** (`vulnerability-assessment.sh`) - Detailed vulnerability scanning and assessment
4. **Master Controller** (`deployment-security-compliance.sh`) - Orchestrates all security and compliance operations

## 🚀 Quick Start

### Basic Security Scan
```bash
# Run comprehensive security and compliance scan
./deployment-security-compliance.sh --environment production --operation full-scan

# Quick security scan only
./deployment-security-scanner.sh --scan-type quick --fail-on-critical

# Policy enforcement with warnings
./security-policy-enforcer.sh --mode warn --policy-set comprehensive
```

### Advanced Usage
```bash
# Full compliance validation with specific frameworks
./deployment-security-compliance.sh \
  --environment production \
  --operation full-scan \
  --compliance soc2,gdpr,iso27001 \
  --enforcement enforce \
  --fail-on-high

# Vulnerability assessment with remediation
./vulnerability-assessment.sh \
  --type comprehensive \
  --severity high \
  --include-deps \
  --include-infra
```

## 🔧 Security Scanner (`deployment-security-scanner.sh`)

### Features
- **Container Security Scanning** - Vulnerability scanning of container images using Trivy
- **Kubernetes Security Validation** - Security context, RBAC, and network policy validation
- **Secret Scanning** - Detection of hardcoded secrets and insecure configurations
- **Compliance Validation** - SOC 2, GDPR, and ISO 27001 compliance checking

### Usage Examples
```bash
# Comprehensive security scan
./deployment-security-scanner.sh \
  --environment production \
  --scan-type comprehensive \
  --compliance soc2,gdpr,iso27001 \
  --fail-on-critical

# Quick scan for critical vulnerabilities
./deployment-security-scanner.sh \
  --scan-type quick \
  --fail-on-critical \
  --verbose

# Standard scan with custom compliance frameworks
./deployment-security-scanner.sh \
  --scan-type standard \
  --compliance gdpr \
  --generate-report
```

### Scan Types
- **Quick** - Basic security checks and critical vulnerability scan
- **Standard** - Standard security scan with compliance validation
- **Comprehensive** - Full security audit with detailed compliance reporting

## 🛡️ Policy Enforcer (`security-policy-enforcer.sh`)

### Features
- **Pod Security Policies** - Prevents privileged containers and enforces security contexts
- **Network Policies** - Implements network segmentation and access controls
- **RBAC Policies** - Enforces role-based access control with least privilege
- **Resource Policies** - Enforces resource limits and quotas

### Usage Examples
```bash
# Enforce comprehensive security policies
./security-policy-enforcer.sh \
  --environment production \
  --mode enforce \
  --policy-set comprehensive

# Audit mode with automatic remediation
./security-policy-enforcer.sh \
  --mode audit \
  --auto-remediate \
  --verbose

# Warning mode for testing
./security-policy-enforcer.sh \
  --mode warn \
  --policy-set standard
```

### Enforcement Modes
- **Enforce** - Block deployments that violate policies
- **Warn** - Allow deployments but log warnings
- **Audit** - Only audit and report violations

## 🔍 Vulnerability Assessment (`vulnerability-assessment.sh`)

### Features
- **Container Vulnerability Scanning** - Comprehensive image vulnerability assessment
- **Dependency Scanning** - NPM and other dependency vulnerability detection
- **Infrastructure Assessment** - Kubernetes configuration vulnerability analysis
- **Remediation Recommendations** - Automated remediation guidance

### Usage Examples
```bash
# Comprehensive vulnerability assessment
./vulnerability-assessment.sh \
  --environment production \
  --type comprehensive \
  --severity medium \
  --include-deps \
  --include-infra

# Quick critical vulnerability scan
./vulnerability-assessment.sh \
  --type quick \
  --severity critical \
  --no-remediation

# Dependency-focused assessment
./vulnerability-assessment.sh \
  --type standard \
  --include-deps \
  --severity high
```

### Assessment Types
- **Quick** - Basic vulnerability scan of running containers
- **Standard** - Standard vulnerability assessment with dependencies
- **Comprehensive** - Full vulnerability assessment with remediation

## 🎛️ Master Controller (`deployment-security-compliance.sh`)

### Features
- **Orchestrated Execution** - Coordinates all security and compliance operations
- **Parallel Processing** - Executes multiple scans simultaneously for efficiency
- **Comprehensive Reporting** - Generates unified security and compliance reports
- **Flexible Operations** - Supports different operation modes and configurations

### Usage Examples
```bash
# Full security and compliance scan
./deployment-security-compliance.sh \
  --environment production \
  --operation full-scan \
  --compliance soc2,gdpr,iso27001 \
  --enforcement enforce

# Security scanning only
./deployment-security-compliance.sh \
  --operation security-only \
  --fail-on-high \
  --verbose

# Compliance validation only
./deployment-security-compliance.sh \
  --operation compliance-only \
  --compliance gdpr \
  --enforcement audit
```

### Operations
- **full-scan** - Complete security scan, policy enforcement, and compliance validation
- **security-only** - Security scanning and vulnerability assessment only
- **compliance-only** - Compliance validation only
- **policy-only** - Security policy enforcement only

## 📊 Configuration

### Security and Compliance Configuration (`security-compliance-config.yaml`)

The system uses a comprehensive configuration file that defines:

- **Vulnerability Scanning Settings** - Tool configurations, severity thresholds, scan targets
- **Container Security Policies** - Image scanning, runtime security, security policies
- **Network Security Configuration** - Network policies, TLS settings
- **Secrets Management** - Encryption, secret scanning, access control
- **Compliance Framework Settings** - SOC 2, GDPR, ISO 27001 controls
- **Audit and Reporting** - Logging, reporting, alerting configurations

### Environment-Specific Overrides

The configuration supports environment-specific overrides:

```yaml
environments:
  development:
    security:
      vulnerability_scanning:
        fail_on_critical: false
  production:
    security:
      vulnerability_scanning:
        fail_on_critical: true
        fail_on_high: true
```

## 📈 Reporting and Monitoring

### Generated Reports
- **Security Scan Reports** - Detailed vulnerability and security findings
- **Compliance Reports** - Framework-specific compliance validation results
- **Policy Violation Reports** - Security policy enforcement results
- **Vulnerability Assessment Reports** - Comprehensive vulnerability analysis
- **Remediation Recommendations** - Actionable security improvement guidance

### Report Formats
- **JSON** - Machine-readable structured data
- **HTML** - Human-readable formatted reports
- **Markdown** - Documentation-friendly format

### Log Files
- **Security Logs** - `logs/security/security-scan-*.log`
- **Policy Logs** - `logs/security/policy-enforcement-*.log`
- **Vulnerability Logs** - `logs/security/vulnerability-assessment-*.log`
- **Audit Logs** - `audit/security/security-audit-*.log`

## 🔐 Compliance Frameworks

### SOC 2 Type II
- Security controls (access controls, authentication, encryption)
- Availability controls (monitoring, backup, capacity planning)
- Processing integrity controls (data validation, error handling)
- Confidentiality controls (data classification, access restrictions)
- Privacy controls (data collection, usage, retention)

### GDPR
- Data protection principles (lawfulness, fairness, transparency)
- Individual rights (access, rectification, erasure, portability)
- Technical measures (privacy by design, impact assessment)

### ISO 27001
- Information security policies and risk management
- Organization of information security
- Asset management and access control
- Cryptography and incident management

## 🚨 Integration with CI/CD

### GitHub Actions Integration
The security system integrates with existing GitHub Actions workflows:

```yaml
- name: Security and Compliance Scan
  run: |
    ./infrastructure/production/scripts/deployment-security-compliance.sh \
      --environment production \
      --operation full-scan \
      --fail-on-critical
```

### Pre-deployment Gates
Use as deployment gates to ensure security compliance:

```bash
# Pre-deployment security validation
if ! ./deployment-security-compliance.sh --operation security-only; then
  echo "Security validation failed - blocking deployment"
  exit 1
fi
```

## 📞 Support and Troubleshooting

### Common Issues
1. **Tool Dependencies** - Ensure Docker, kubectl, jq, and curl are installed
2. **Cluster Access** - Verify Kubernetes cluster connectivity
3. **Permissions** - Ensure proper RBAC permissions for scanning
4. **Resource Limits** - Check cluster resources for scanning operations

### Debug Commands
```bash
# Verbose output for debugging
./deployment-security-scanner.sh --verbose --dry-run

# Check tool availability
kubectl version --client
docker version
jq --version

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Log Analysis
```bash
# Check security scan logs
tail -f logs/security/security-scan-*.log

# Review policy violations
grep "ERROR\|WARNING" logs/security/policy-enforcement-*.log

# Analyze vulnerability findings
jq '.' reports/security/vulnerability-report-*.json
```

## 🔄 Maintenance and Updates

### Regular Tasks
- **Weekly** - Review security scan results and address findings
- **Monthly** - Update vulnerability databases and scanning tools
- **Quarterly** - Review and update security policies and compliance frameworks

### Tool Updates
```bash
# Update Trivy vulnerability database
docker pull aquasec/trivy:latest

# Update security scanning tools
docker pull aquasec/grype:latest
```

---

**Last Updated**: 2025-01-21  
**Version**: 1.0.0  
**Maintained By**: Security & Infrastructure Team
