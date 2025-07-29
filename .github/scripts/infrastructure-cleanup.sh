#!/bin/bash

# Infrastructure Cleanup Script
# Handles the transition from Kubernetes to Vercel + Supabase architecture

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Infrastructure Cleanup Script

This script helps manage the transition from Kubernetes to Vercel + Supabase architecture.

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --action ACTION         Action to perform (analyze|deprecate|archive|clean)
    --dry-run              Show what would be done without making changes
    --force                Force operations without confirmation
    --backup-dir DIR       Directory to backup files (default: .infrastructure-backup)

ACTIONS:
    analyze                Analyze current infrastructure files
    deprecate              Mark files as deprecated (add README warnings)
    archive                Move deprecated files to archive directory
    clean                  Remove deprecated files (use with caution)

EXAMPLES:
    $0 --action analyze
    $0 --action deprecate --dry-run
    $0 --action archive --backup-dir ./old-infrastructure

EOF
}

# Parse command line arguments
ACTION=""
DRY_RUN=false
FORCE=false
BACKUP_DIR=".infrastructure-backup"

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --action)
            ACTION="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate action
if [[ -z "$ACTION" ]]; then
    error "Action is required (use --action)"
    show_help
    exit 1
fi

# Define deprecated infrastructure files and directories
DEPRECATED_DIRS=(
    "infrastructure/production/kubernetes"
    "infrastructure/production/terraform"
    "infrastructure/production/scripts"
)

DEPRECATED_FILES=(
    "infrastructure/production/scripts/deploy.sh"
    "infrastructure/production/scripts/master-deploy.sh"
    "infrastructure/production/scripts/validate-deployment.sh"
    ".github/scripts/validate-deployment.sh"
)

REFERENCE_CONFIGS=(
    "infrastructure/production/config/deployment-config.yaml"
    "infrastructure/production/config/monitoring-config.yaml"
    "infrastructure/production/config/security-compliance-config.yaml"
    "infrastructure/production/config/validation-config.yaml"
)

# Analyze current infrastructure
analyze_infrastructure() {
    log "Analyzing current infrastructure files..."
    
    local total_files=0
    local deprecated_files=0
    local reference_files=0
    
    echo
    log "📊 Infrastructure Analysis Report"
    log "================================"
    
    # Check deprecated directories
    echo
    log "🗂️  Deprecated Directories:"
    for dir in "${DEPRECATED_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            local file_count=$(find "$dir" -type f | wc -l)
            warning "  $dir ($file_count files)"
            deprecated_files=$((deprecated_files + file_count))
            total_files=$((total_files + file_count))
        else
            success "  $dir (not found - already cleaned)"
        fi
    done
    
    # Check deprecated files
    echo
    log "📄 Deprecated Files:"
    for file in "${DEPRECATED_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            warning "  $file"
            deprecated_files=$((deprecated_files + 1))
            total_files=$((total_files + 1))
        else
            success "  $file (not found - already cleaned)"
        fi
    done
    
    # Check reference configs
    echo
    log "📚 Reference Configuration Files:"
    for file in "${REFERENCE_CONFIGS[@]}"; do
        if [[ -f "$file" ]]; then
            log "  $file (kept for reference)"
            reference_files=$((reference_files + 1))
            total_files=$((total_files + 1))
        else
            warning "  $file (not found)"
        fi
    done
    
    # Summary
    echo
    log "📈 Summary:"
    log "  Total infrastructure files: $total_files"
    log "  Deprecated files: $deprecated_files"
    log "  Reference files: $reference_files"
    
    if [[ $deprecated_files -gt 0 ]]; then
        echo
        warning "Recommendation: Run --action deprecate to mark deprecated files"
        warning "Then consider --action archive to move them to backup location"
    else
        success "No deprecated files found - infrastructure cleanup is complete"
    fi
}

# Mark files as deprecated
deprecate_infrastructure() {
    log "Marking infrastructure files as deprecated..."
    
    # Create deprecation notice for directories
    for dir in "${DEPRECATED_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            local readme_file="$dir/README_DEPRECATED.md"
            
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would create deprecation notice: $readme_file"
            else
                cat > "$readme_file" << EOF
# ⚠️ DEPRECATED INFRASTRUCTURE

## 🚨 Important Notice

This directory contains **DEPRECATED** infrastructure files that are no longer used in the current Vercel + Supabase architecture.

### Status: DEPRECATED
- **Date**: $(date '+%Y-%m-%d')
- **Reason**: Migration to Vercel + Supabase serverless architecture
- **Replacement**: See new deployment workflows in \`.github/workflows/\`

### What This Means
- ❌ These files are **NOT USED** in current deployments
- ❌ Do **NOT** modify these files
- ❌ Do **NOT** run scripts in this directory
- 📚 Files are kept for **REFERENCE ONLY**

### New Architecture
The project now uses:
- **Frontend**: Vercel (automatic Git-based deployment)
- **Backend**: Supabase (managed database + Edge Functions)
- **Deployment**: GitHub Actions workflows

### Migration Guide
See: \`.github/docs/DEPLOYMENT_MIGRATION_GUIDE.md\`

### Need Help?
- Check \`.github/workflows/README.md\` for current deployment process
- Review \`.github/docs/\` for setup and troubleshooting guides
- Contact the development team for migration questions

---
**This directory will be archived in a future cleanup.**
EOF
                success "Created deprecation notice: $readme_file"
            fi
        fi
    done
    
    # Create deprecation notices for individual files
    for file in "${DEPRECATED_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            local dir=$(dirname "$file")
            local filename=$(basename "$file")
            local deprecated_file="$dir/DEPRECATED_$filename"
            
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would rename $file to $deprecated_file"
            else
                mv "$file" "$deprecated_file"
                success "Renamed deprecated file: $file → $deprecated_file"
            fi
        fi
    done
    
    success "Infrastructure deprecation completed"
}

# Archive deprecated files
archive_infrastructure() {
    log "Archiving deprecated infrastructure files..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create backup directory: $BACKUP_DIR"
    else
        mkdir -p "$BACKUP_DIR"
        success "Created backup directory: $BACKUP_DIR"
    fi
    
    # Archive deprecated directories
    for dir in "${DEPRECATED_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            local backup_path="$BACKUP_DIR/$(basename "$dir")"
            
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would archive $dir to $backup_path"
            else
                cp -r "$dir" "$backup_path"
                success "Archived directory: $dir → $backup_path"
            fi
        fi
    done
    
    # Create archive manifest
    local manifest_file="$BACKUP_DIR/ARCHIVE_MANIFEST.md"
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create archive manifest: $manifest_file"
    else
        cat > "$manifest_file" << EOF
# Infrastructure Archive Manifest

## Archive Information
- **Date**: $(date '+%Y-%m-%d %H:%M:%S')
- **Reason**: Migration to Vercel + Supabase architecture
- **Original Location**: infrastructure/production/

## Archived Components
- Kubernetes manifests and configurations
- Terraform infrastructure definitions
- Deployment and validation scripts
- Legacy configuration files

## Important Notes
- These files are from the **OLD KUBERNETES ARCHITECTURE**
- They are **NOT COMPATIBLE** with the current Vercel + Supabase setup
- Kept for reference and potential rollback scenarios only
- Do not attempt to use these files with current deployment processes

## Current Architecture
The project now uses:
- **Frontend**: Vercel (Git-based deployment)
- **Backend**: Supabase (managed services)
- **Workflows**: GitHub Actions in \`.github/workflows/\`

## Restoration
If you need to restore these files:
1. Copy from this archive back to original locations
2. Update workflows to use Kubernetes deployment
3. Set up Kubernetes cluster and Terraform state
4. Update all configuration for your environment

**Warning**: Restoration requires significant infrastructure setup and is not recommended.
EOF
        success "Created archive manifest: $manifest_file"
    fi
    
    success "Infrastructure archiving completed"
}

# Clean deprecated files (dangerous operation)
clean_infrastructure() {
    if [[ "$FORCE" != "true" ]]; then
        echo
        warning "⚠️  DANGEROUS OPERATION: This will permanently delete deprecated infrastructure files"
        warning "Files will be removed:"
        
        for dir in "${DEPRECATED_DIRS[@]}"; do
            if [[ -d "$dir" ]]; then
                warning "  - Directory: $dir"
            fi
        done
        
        for file in "${DEPRECATED_FILES[@]}"; do
            if [[ -f "$file" ]]; then
                warning "  - File: $file"
            fi
        done
        
        echo
        read -p "Are you sure you want to proceed? (type 'DELETE' to confirm): " confirmation
        
        if [[ "$confirmation" != "DELETE" ]]; then
            log "Operation cancelled"
            exit 0
        fi
    fi
    
    log "Cleaning deprecated infrastructure files..."
    
    # Remove deprecated directories
    for dir in "${DEPRECATED_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would remove directory: $dir"
            else
                rm -rf "$dir"
                success "Removed directory: $dir"
            fi
        fi
    done
    
    # Remove deprecated files
    for file in "${DEPRECATED_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would remove file: $file"
            else
                rm -f "$file"
                success "Removed file: $file"
            fi
        fi
    done
    
    success "Infrastructure cleanup completed"
}

# Main execution
main() {
    log "Infrastructure Cleanup Script"
    log "============================="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        warning "DRY RUN MODE - No changes will be made"
    fi
    
    case "$ACTION" in
        "analyze")
            analyze_infrastructure
            ;;
        "deprecate")
            deprecate_infrastructure
            ;;
        "archive")
            archive_infrastructure
            ;;
        "clean")
            clean_infrastructure
            ;;
        *)
            error "Invalid action: $ACTION"
            error "Valid actions: analyze, deprecate, archive, clean"
            exit 1
            ;;
    esac
    
    echo
    success "Infrastructure cleanup action '$ACTION' completed successfully"
    
    if [[ "$ACTION" == "analyze" ]]; then
        echo
        log "Next steps:"
        log "1. Run: $0 --action deprecate --dry-run"
        log "2. Run: $0 --action deprecate"
        log "3. Run: $0 --action archive"
        log "4. Review: .github/docs/DEPLOYMENT_MIGRATION_GUIDE.md"
    fi
}

# Run main function
main "$@"
