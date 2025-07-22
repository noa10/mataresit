# Terraform Variables for Paperless Maverick Production Infrastructure

variable "environment" {
  description = "Environment name (production, staging, development)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be one of: production, staging, development."
  }
}

variable "cluster_name" {
  description = "Kubernetes cluster name"
  type        = string
  default     = "paperless-maverick-prod"
}

variable "namespace" {
  description = "Kubernetes namespace for the application"
  type        = string
  default     = "paperless-maverick"
}

variable "app_replicas" {
  description = "Number of application pod replicas"
  type        = number
  default     = 3
  
  validation {
    condition     = var.app_replicas >= 1 && var.app_replicas <= 20
    error_message = "App replicas must be between 1 and 20."
  }
}

variable "worker_replicas" {
  description = "Number of embedding worker pod replicas"
  type        = number
  default     = 3
  
  validation {
    condition     = var.worker_replicas >= 1 && var.worker_replicas <= 10
    error_message = "Worker replicas must be between 1 and 10."
  }
}

variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
  default     = "mataresit.com"
}

variable "app_image" {
  description = "Docker image for the main application"
  type        = string
  default     = "paperless-maverick:latest"
}

variable "worker_image" {
  description = "Docker image for embedding workers"
  type        = string
  default     = "paperless-maverick-worker:latest"
}

variable "app_resources" {
  description = "Resource limits and requests for application pods"
  type = object({
    requests = object({
      cpu    = string
      memory = string
    })
    limits = object({
      cpu    = string
      memory = string
    })
  })
  default = {
    requests = {
      cpu    = "250m"
      memory = "512Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "1Gi"
    }
  }
}

variable "worker_resources" {
  description = "Resource limits and requests for worker pods"
  type = object({
    requests = object({
      cpu    = string
      memory = string
    })
    limits = object({
      cpu    = string
      memory = string
    })
  })
  default = {
    requests = {
      cpu    = "250m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "512Mi"
    }
  }
}

variable "hpa_config" {
  description = "Horizontal Pod Autoscaler configuration"
  type = object({
    app = object({
      min_replicas                    = number
      max_replicas                    = number
      target_cpu_utilization_percentage = number
      target_memory_utilization_percentage = number
    })
    worker = object({
      min_replicas                    = number
      max_replicas                    = number
      target_cpu_utilization_percentage = number
      target_memory_utilization_percentage = number
    })
  })
  default = {
    app = {
      min_replicas                    = 3
      max_replicas                    = 10
      target_cpu_utilization_percentage = 70
      target_memory_utilization_percentage = 80
    }
    worker = {
      min_replicas                    = 2
      max_replicas                    = 6
      target_cpu_utilization_percentage = 80
      target_memory_utilization_percentage = 85
    }
  }
}

variable "feature_flags" {
  description = "Feature flag configuration for gradual rollout"
  type = object({
    embedding_monitoring_enabled = bool
    embedding_monitoring_rollout_percentage = number
    queue_processing_enabled = bool
    queue_processing_rollout_percentage = number
    batch_optimization_enabled = bool
    batch_optimization_rollout_percentage = number
  })
  default = {
    embedding_monitoring_enabled = true
    embedding_monitoring_rollout_percentage = 10
    queue_processing_enabled = false
    queue_processing_rollout_percentage = 0
    batch_optimization_enabled = false
    batch_optimization_rollout_percentage = 0
  }
}

variable "monitoring_config" {
  description = "Monitoring and alerting configuration"
  type = object({
    prometheus_enabled = bool
    grafana_enabled = bool
    alertmanager_enabled = bool
    retention_days = number
  })
  default = {
    prometheus_enabled = true
    grafana_enabled = true
    alertmanager_enabled = true
    retention_days = 30
  }
}

variable "backup_config" {
  description = "Backup configuration"
  type = object({
    enabled = bool
    schedule = string
    retention_days = number
    storage_class = string
  })
  default = {
    enabled = true
    schedule = "0 2 * * *"  # Daily at 2 AM
    retention_days = 30
    storage_class = "standard"
  }
}

variable "security_config" {
  description = "Security configuration"
  type = object({
    network_policies_enabled = bool
    pod_security_standards = string
    rbac_enabled = bool
  })
  default = {
    network_policies_enabled = true
    pod_security_standards = "restricted"
    rbac_enabled = true
  }
}

variable "ingress_config" {
  description = "Ingress configuration"
  type = object({
    class = string
    tls_enabled = bool
    cert_manager_issuer = string
    rate_limit = number
    rate_limit_window = string
  })
  default = {
    class = "nginx"
    tls_enabled = true
    cert_manager_issuer = "letsencrypt-prod"
    rate_limit = 100
    rate_limit_window = "1m"
  }
}
