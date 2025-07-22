# Infrastructure Provisioning Automation

This directory contains comprehensive infrastructure provisioning automation scripts for the Paperless Maverick application. The system provides robust infrastructure management with validation, secrets management, and environment setup capabilities.

## 📋 Overview

The infrastructure provisioning system consists of several components:

1. **Main Provisioning Script** (`provision-infrastructure.sh`) - Core infrastructure orchestration
2. **Infrastructure Validation** (`validate-infrastructure.sh`) - Comprehensive validation of configurations
3. **Environment Setup** (`setup-environment.sh`) - Environment configuration and setup
4. **Secrets Management** (`setup-secrets.sh`) - Kubernetes secrets provisioning

## 🚀 Quick Start

### Initial Environment Setup

```bash
# Setup environment configuration
./setup-environment.sh --environment production

# Validate configuration
./validate-infrastructure.sh --environment production

# Provision infrastructure
./provision-infrastructure.sh --environment production
```

### Using Generated Helper Scripts

After running environment setup, you'll have helper scripts:

```bash
# Quick deployment
./deploy-production.sh

# Quick validation
./validate-production.sh
```

## 🔧 Infrastructure Provisioning (`provision-infrastructure.sh`)

The main provisioning script provides comprehensive infrastructure automation with the following features:

### Key Features

- **Namespace and RBAC Management** - Automated namespace creation and RBAC configuration
- **Configuration Management** - ConfigMaps and environment-specific settings
- **Secrets Management** - Automated secrets provisioning with validation
- **Resource Provisioning** - Core application and worker resources
- **Monitoring Setup** - Prometheus, Grafana, and alerting infrastructure
- **Terraform Integration** - Optional Terraform-based infrastructure provisioning
- **Validation and Verification** - Post-provisioning resource validation

### Usage Examples

```bash
# Full infrastructure provisioning
./provision-infrastructure.sh --environment production

# Dry run to see what would be provisioned
./provision-infrastructure.sh --dry-run --environment production

# Skip secrets provisioning
./provision-infrastructure.sh --skip-secrets --environment staging

# Update existing resources
./provision-infrastructure.sh --update-existing --environment production

# Skip Terraform and monitoring
./provision-infrastructure.sh --skip-terraform --skip-monitoring
```

### Command Line Options

```
-h, --help                  Show help message
-e, --environment ENV       Target environment (production, staging, development)
-n, --namespace NS          Kubernetes namespace (default: paperless-maverick)
-d, --dry-run              Perform dry run without making changes
-v, --validate-only        Only validate configuration
-f, --force                Force provisioning, skip safety checks
--verbose                  Enable verbose logging
--skip-secrets             Skip secrets provisioning
--skip-terraform           Skip Terraform provisioning
--skip-monitoring          Skip monitoring resources provisioning
--update-existing          Update existing resources
```

## ✅ Infrastructure Validation (`validate-infrastructure.sh`)

Comprehensive validation of infrastructure configurations and cluster state.

### Validation Checks

1. **Kubernetes Manifests** - YAML syntax and kubectl validation
2. **Terraform Configuration** - Terraform syntax and formatting validation
3. **Environment Configuration** - Environment-specific settings validation
4. **Secrets Configuration** - Secrets templates and setup script validation
5. **Monitoring Configuration** - Monitoring manifests validation
6. **Cluster Connectivity** - Kubernetes cluster access and permissions

### Usage Examples

```bash
# Full validation
./validate-infrastructure.sh --environment production

# Quick validation (skip cluster connectivity)
./validate-infrastructure.sh --quick --environment staging

# Verbose validation with debug output
./validate-infrastructure.sh --verbose --environment development
```

## 🔧 Environment Setup (`setup-environment.sh`)

Interactive environment configuration and setup automation.

### Setup Features

- **Directory Structure Creation** - Creates required directories
- **Environment Template Generation** - Generates environment-specific configuration templates
- **Configuration Validation** - Validates environment variables and settings
- **Kubernetes Context Setup** - Validates and configures Kubernetes context
- **Helper Script Generation** - Creates environment-specific helper scripts

### Usage Examples

```bash
# Interactive setup for production
./setup-environment.sh --environment production

# Non-interactive setup
./setup-environment.sh --environment staging --non-interactive

# Force overwrite existing configuration
./setup-environment.sh --force --environment development

# Validate existing configuration only
./setup-environment.sh --validate-only --environment production
```

## 🔐 Secrets Management (`setup-secrets.sh`)

Automated Kubernetes secrets provisioning with comprehensive validation.

### Secrets Categories

1. **Supabase Secrets** - Database connection and API keys
2. **AI Secrets** - Gemini and OpenAI API keys
3. **Security Secrets** - Encryption keys and JWT secrets
4. **Monitoring Secrets** - Sentry DSN and Grafana passwords
5. **Notification Secrets** - Email, Slack, and PagerDuty integration keys

### Usage Examples

```bash
# Create secrets from environment file
./setup-secrets.sh --from-file .env.production

# Create secrets from environment variables
./setup-secrets.sh --from-env

# Update existing secrets
./setup-secrets.sh --update --from-file .env.production

# Delete all secrets
./setup-secrets.sh --delete
```

## 📁 Directory Structure

```
infrastructure/production/
├── config/
│   ├── deployment-config.yaml        # Deployment configuration
│   └── migration-dependencies.yaml   # Migration dependencies
├── env/
│   ├── .env.production               # Production environment variables
│   ├── .env.staging                  # Staging environment variables
│   └── .env.development              # Development environment variables
├── kubernetes/
│   ├── namespace.yaml                # Namespace and RBAC
│   ├── configmap.yaml                # Configuration maps
│   ├── secrets.yaml                  # Secrets templates
│   ├── deployment.yaml               # Application deployment
│   ├── service.yaml                  # Services and ingress
│   ├── hpa.yaml                      # Horizontal Pod Autoscaler
│   └── workers/                      # Worker-specific manifests
├── terraform/
│   ├── main.tf                       # Main Terraform configuration
│   ├── variables.tf                  # Terraform variables
│   └── outputs.tf                    # Terraform outputs
├── monitoring/
│   ├── prometheus-config.yaml        # Prometheus configuration
│   ├── grafana-config.yaml           # Grafana configuration
│   └── alertmanager-config.yaml      # Alertmanager configuration
└── scripts/
    ├── provision-infrastructure.sh   # Main provisioning script
    ├── validate-infrastructure.sh    # Validation script
    ├── setup-environment.sh          # Environment setup script
    ├── setup-secrets.sh              # Secrets management script
    └── INFRASTRUCTURE_README.md      # This documentation
```

## 🔄 Provisioning Process

The infrastructure provisioning follows these phases:

1. **Prerequisites Validation** - Validate required tools and connectivity
2. **Environment Configuration Validation** - Validate environment-specific settings
3. **Terraform Provisioning** - Optional Terraform-based infrastructure setup
4. **Namespace and RBAC** - Create namespace and configure RBAC
5. **Configuration Maps** - Deploy application and worker configuration
6. **Secrets Provisioning** - Create and validate Kubernetes secrets
7. **Core Resources** - Deploy application deployments, services, and HPA
8. **Worker Resources** - Deploy worker deployments and monitoring
9. **Monitoring Resources** - Deploy Prometheus, Grafana, and alerting
10. **Resource Validation** - Validate all provisioned resources

## 🔒 Security Features

### Production Protections

1. **Environment Validation** - Validates environment-specific configurations
2. **Secrets Validation** - Ensures all required secrets are properly configured
3. **RBAC Configuration** - Proper role-based access control setup
4. **Network Policies** - Optional network policy enforcement
5. **Resource Quotas** - Namespace-level resource quotas and limits

### Secrets Management

1. **Template-Based Secrets** - Uses templates for consistent secret structure
2. **Validation Checks** - Validates secret format and required fields
3. **Update Capabilities** - Safe updating of existing secrets
4. **Environment Isolation** - Environment-specific secret management

## 📊 Monitoring and Logging

### Log Files

- **Provisioning Logs** - `logs/infrastructure/provision-*.log`
- **Validation Logs** - `logs/infrastructure/validation-*.log`
- **Audit Logs** - `logs/infrastructure/provision-audit-*.log`

### Monitoring Integration

- **Prometheus Metrics** - Application and infrastructure metrics
- **Grafana Dashboards** - Pre-configured monitoring dashboards
- **Alertmanager Rules** - Automated alerting for critical issues

## ⚠️ Important Considerations

### Production Deployment

1. **Environment Validation** - Always validate configuration before deployment
2. **Backup Strategy** - Ensure backup systems are in place
3. **Rollback Plan** - Have tested rollback procedures ready
4. **Team Coordination** - Coordinate with team before production changes
5. **Monitoring Setup** - Ensure monitoring is configured and working

### Security Best Practices

1. **Secrets Management** - Never commit secrets to version control
2. **Access Control** - Use proper RBAC and namespace isolation
3. **Network Security** - Configure network policies where appropriate
4. **Regular Updates** - Keep infrastructure and dependencies updated
5. **Audit Logging** - Maintain comprehensive audit trails

## 🛠️ Troubleshooting

### Common Issues

1. **Kubernetes Connectivity** - Check kubectl configuration and cluster access
2. **Missing Secrets** - Ensure all required environment variables are set
3. **Resource Conflicts** - Check for existing resources with same names
4. **Permission Errors** - Verify RBAC permissions and cluster access

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
./provision-infrastructure.sh --verbose --dry-run
./validate-infrastructure.sh --verbose
```

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Terraform Documentation](https://www.terraform.io/docs/)
- [Helm Documentation](https://helm.sh/docs/)
- [Infrastructure as Code Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/)
