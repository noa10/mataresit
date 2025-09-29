# Deployment Pipeline Migration Guide

## 🎯 **Architecture Migration Overview**

The Mataresit project has migrated from a Kubernetes-based deployment to a **Vercel + Supabase** serverless architecture. This guide explains the changes and how to handle the transition.

## 📋 **What Changed**

### **Old Architecture (Kubernetes)**
- Docker containers deployed to Kubernetes clusters
- Manual infrastructure management with Terraform
- Complex deployment scripts and validation
- Server-based application hosting
- Manual scaling and monitoring

### **New Architecture (Vercel + Supabase)**
- Static site deployment to Vercel
- Serverless backend with Supabase
- Git-based deployments
- Automatic scaling and monitoring
- Simplified deployment pipeline

## 🗂️ **Infrastructure Files Status**

### **Files Marked for Deprecation**
The following infrastructure files are **no longer used** but kept for reference:

#### **Kubernetes Manifests**
```
infrastructure/production/kubernetes/
├── deployment.yaml          # ❌ Not used (Vercel handles deployment)
├── service.yaml             # ❌ Not used (Vercel provides services)
├── hpa.yaml                 # ❌ Not used (Vercel auto-scales)
├── configmap.yaml           # ❌ Not used (Environment variables in Vercel)
├── namespace.yaml           # ❌ Not used (No Kubernetes)
└── workers/                 # ❌ Not used (Supabase Edge Functions)
```

#### **Terraform Configuration**
```
infrastructure/production/terraform/
├── main.tf                  # ❌ Not used (Vercel manages infrastructure)
├── variables.tf             # ❌ Not used
├── outputs.tf               # ❌ Not used
└── modules/                 # ❌ Not used
```

#### **Deployment Scripts**
```
infrastructure/production/scripts/
├── deploy.sh                # ❌ Replaced by Vercel deployment
├── master-deploy.sh         # ❌ Replaced by GitHub Actions
├── deploy-workers.sh        # ❌ Replaced by Supabase functions
└── validate-deployment.sh   # ❌ Replaced by Vercel validation
```

### **Files Kept for Reference**
These files are preserved in case of future needs or rollback scenarios:

#### **Configuration Files**
```
infrastructure/production/config/
├── deployment-config.yaml          # 📚 Reference only
├── monitoring-config.yaml          # 📚 Reference only
├── security-compliance-config.yaml # 📚 Reference only
└── validation-config.yaml          # 📚 Reference only
```

## 🚀 **New Deployment Pipeline**

### **Frontend Deployment (Vercel)**
1. **Automatic Deployment**
   - Push to `main` branch → Production deployment
   - Push to `develop` branch → Staging deployment
   - Pull requests → Preview deployments

2. **Configuration**
   - Environment variables managed in Vercel dashboard
   - Build settings configured in `vercel.json`
   - Domain management through Vercel

### **Backend Deployment (Supabase)**
1. **Database Migrations**
   - Managed through Supabase CLI
   - Deployed via GitHub Actions workflow
   - Version controlled in `supabase/migrations/`

2. **Edge Functions**
   - Deployed via Supabase CLI
   - Managed in `supabase/functions/`
   - Automatic scaling and monitoring

### **Deployment Workflows**
1. **`ci.yml`** - Code quality, testing, build validation
2. **`supabase-validate.yml`** - Supabase code validation (validation-only, no deployment)
3. **`monitoring.yml`** - Health checks and validation
4. **`vercel-rollback.yml`** - Emergency rollback procedures

## 🔧 **Migration Actions Taken**

### **1. Workflow Updates**
- ✅ Removed Kubernetes-based deployment workflows
- ✅ Created Vercel + Supabase specific workflows
- ✅ Updated validation logic for new architecture
- ✅ Implemented proper error handling

### **2. Infrastructure Cleanup**
- ✅ Marked Kubernetes files as deprecated
- ✅ Updated documentation to reflect new architecture
- ✅ Created migration guides and troubleshooting docs
- ✅ Preserved files for reference/rollback scenarios

### **3. Validation Updates**
- ✅ Replaced Kubernetes validation with Vercel checks
- ✅ Updated health checks for Supabase services
- ✅ Implemented frontend-specific validation
- ✅ Created new deployment gates for serverless architecture

## 🛠️ **Troubleshooting Common Issues**

### **Issue: "Kubernetes manifest validation failed"**
**Cause**: Old workflows trying to validate Kubernetes files

**Solution**: These validations have been removed. If you see this error:
1. Ensure you're using the updated workflows
2. Check that old deployment workflows were properly removed
3. Verify you're not running deprecated scripts

### **Issue: "Missing infrastructure files"**
**Cause**: Scripts looking for Terraform or Kubernetes files

**Solution**: 
1. Use new Vercel + Supabase workflows instead
2. Check `.github/workflows/` for current deployment processes
3. Refer to this migration guide for architecture changes

### **Issue: "Deployment validation timeout"**
**Cause**: Validation scripts waiting for Kubernetes resources

**Solution**:
1. Use new validation scripts in `.github/scripts/`
2. Check Vercel deployment status instead of Kubernetes
3. Monitor Supabase services for backend validation

## 📊 **Deployment Validation Matrix**

### **Old Validation (Kubernetes)**
| Component | Validation Method | Status |
|-----------|------------------|---------|
| Pods | `kubectl get pods` | ❌ Deprecated |
| Services | `kubectl get services` | ❌ Deprecated |
| Ingress | `kubectl get ingress` | ❌ Deprecated |
| ConfigMaps | `kubectl get configmaps` | ❌ Deprecated |

### **New Validation (Vercel + Supabase)**
| Component | Validation Method | Status |
|-----------|------------------|---------|
| Frontend | Vercel deployment API | ✅ Active |
| Database | Supabase health endpoint | ✅ Active |
| Functions | Supabase function testing | ✅ Active |
| Domain | DNS and SSL checks | ✅ Active |

## 🔄 **Rollback Procedures**

### **Frontend Rollback**
```bash
# Automatic via Git
git revert <commit-hash>
git push origin main

# Manual via Vercel CLI
vercel rollback <deployment-url>
```

### **Backend Rollback**
```bash
# Database migrations (manual)
# Note: Supabase doesn't support automatic rollbacks
supabase db reset --linked

# Edge Functions
supabase functions deploy <function-name> --project-ref <old-ref>
```

## 📚 **Additional Resources**

### **New Architecture Documentation**
- [Vercel Deployment Guide](https://vercel.com/docs/deployments)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [GitHub Actions for Vercel](https://vercel.com/docs/deployments/git)

### **Project-Specific Guides**
- [Workflow Documentation](.github/workflows/README.md)
- [Security Scanning Setup](.github/docs/SECURITY_SCANNING_SETUP.md)
- [Troubleshooting Guide](.github/docs/SECURITY_TROUBLESHOOTING.md)

## ✅ **Migration Checklist**

- [x] Remove incompatible Kubernetes workflows
- [x] Create Vercel + Supabase workflows
- [x] Update validation scripts
- [x] Document architecture changes
- [x] Create troubleshooting guides
- [x] Preserve old files for reference
- [x] Test new deployment pipeline
- [x] Update team documentation

## 🎉 **Benefits of New Architecture**

1. **Simplified Deployment** - Git-based, automatic deployments
2. **Reduced Complexity** - No infrastructure management needed
3. **Better Scaling** - Automatic scaling with Vercel and Supabase
4. **Improved Reliability** - Managed services with high availability
5. **Cost Efficiency** - Pay-per-use pricing model
6. **Developer Experience** - Faster deployments and easier debugging

The migration to Vercel + Supabase provides a more modern, scalable, and maintainable deployment pipeline while reducing operational overhead.
