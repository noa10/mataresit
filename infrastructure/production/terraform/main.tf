# Terraform configuration for Paperless Maverick Production Infrastructure
terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  
  backend "s3" {
    bucket = "paperless-maverick-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "cluster_name" {
  description = "Kubernetes cluster name"
  type        = string
  default     = "paperless-maverick-prod"
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "paperless-maverick"
}

variable "app_replicas" {
  description = "Number of application replicas"
  type        = number
  default     = 3
}

variable "worker_replicas" {
  description = "Number of worker replicas"
  type        = number
  default     = 3
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "mataresit.com"
}

# Data sources
data "kubernetes_namespace" "paperless_maverick" {
  metadata {
    name = var.namespace
  }
}

# Random password for Grafana admin
resource "random_password" "grafana_admin_password" {
  length  = 16
  special = true
}

# Kubernetes resources
resource "kubernetes_namespace" "paperless_maverick" {
  count = var.namespace == "paperless-maverick" ? 1 : 0
  
  metadata {
    name = var.namespace
    labels = {
      name        = var.namespace
      environment = var.environment
      app         = "paperless-maverick"
    }
  }
}

# ConfigMaps
resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "paperless-maverick-config"
    namespace = var.namespace
    labels = {
      app         = "paperless-maverick"
      environment = var.environment
    }
  }

  data = {
    NODE_ENV                                    = "production"
    LOG_LEVEL                                  = "info"
    PORT                                       = "3000"
    ENABLE_PERFORMANCE_MONITORING             = "true"
    ENABLE_SECURITY_LOGGING                   = "true"
    ENABLE_EMBEDDING_MONITORING               = "true"
    ENABLE_QUEUE_PROCESSING                   = "false"
    ENABLE_BATCH_OPTIMIZATION                 = "false"
    API_RATE_LIMIT_WINDOW                     = "3600"
    API_RATE_LIMIT_MAX_REQUESTS               = "1000"
    CACHE_TTL_SECONDS                         = "300"
    CACHE_MAX_SIZE                            = "1000"
    QUEUE_POLL_INTERVAL                       = "5000"
    MAX_CONCURRENT_JOBS                       = "3"
    METRICS_PORT                              = "9090"
    HEALTH_CHECK_PORT                         = "8080"
    CORS_ALLOWED_ORIGINS                      = "https://${var.domain_name},https://app.${var.domain_name}"
    CORS_ALLOWED_METHODS                      = "GET,POST,PUT,DELETE,OPTIONS"
    CORS_ALLOWED_HEADERS                      = "X-API-Key,Content-Type,Authorization"
    EMBEDDING_MONITORING_ROLLOUT_PERCENTAGE   = "10"
    QUEUE_PROCESSING_ROLLOUT_PERCENTAGE       = "0"
    BATCH_OPTIMIZATION_ROLLOUT_PERCENTAGE     = "0"
  }
}

resource "kubernetes_config_map" "worker_config" {
  metadata {
    name      = "embedding-worker-config"
    namespace = var.namespace
    labels = {
      app         = "embedding-worker"
      environment = var.environment
    }
  }

  data = {
    NODE_ENV               = "production"
    LOG_LEVEL             = "info"
    WORKER_TYPE           = "embedding-queue"
    HEALTH_CHECK_PORT     = "8080"
    QUEUE_POLL_INTERVAL   = "5000"
    MAX_CONCURRENT_JOBS   = "3"
    QUEUE_RETRY_ATTEMPTS  = "3"
    QUEUE_RETRY_DELAY     = "5000"
    BATCH_SIZE            = "10"
    MAX_REQUESTS_PER_MINUTE = "60"
    MAX_TOKENS_PER_MINUTE = "100000"
    BACKOFF_MULTIPLIER    = "1.5"
    MAX_BACKOFF_MS        = "30000"
    METRICS_ENABLED       = "true"
    METRICS_PORT          = "9091"
  }
}

# Outputs
output "namespace" {
  description = "Kubernetes namespace"
  value       = var.namespace
}

output "grafana_admin_password" {
  description = "Grafana admin password"
  value       = random_password.grafana_admin_password.result
  sensitive   = true
}

output "app_config_name" {
  description = "Application ConfigMap name"
  value       = kubernetes_config_map.app_config.metadata[0].name
}

output "worker_config_name" {
  description = "Worker ConfigMap name"
  value       = kubernetes_config_map.worker_config.metadata[0].name
}
