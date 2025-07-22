# Terraform Outputs for Paperless Maverick Production Infrastructure

output "cluster_info" {
  description = "Kubernetes cluster information"
  value = {
    name      = var.cluster_name
    namespace = var.namespace
    environment = var.environment
  }
}

output "application_info" {
  description = "Application deployment information"
  value = {
    name = "paperless-maverick"
    replicas = var.app_replicas
    image = var.app_image
    domain = var.domain_name
    config_map = kubernetes_config_map.app_config.metadata[0].name
  }
}

output "worker_info" {
  description = "Worker deployment information"
  value = {
    name = "embedding-queue-workers"
    replicas = var.worker_replicas
    image = var.worker_image
    config_map = kubernetes_config_map.worker_config.metadata[0].name
  }
}

output "feature_flags" {
  description = "Current feature flag configuration"
  value = var.feature_flags
}

output "monitoring_endpoints" {
  description = "Monitoring service endpoints"
  value = {
    prometheus = "http://prometheus.${var.namespace}.svc.cluster.local:9090"
    grafana = "http://grafana.${var.namespace}.svc.cluster.local:3000"
    app_metrics = "http://paperless-maverick-service.${var.namespace}.svc.cluster.local:9090/metrics"
    worker_metrics = "http://embedding-worker-service.${var.namespace}.svc.cluster.local:9091/metrics"
  }
}

output "health_check_endpoints" {
  description = "Health check endpoints"
  value = {
    app_health = "http://paperless-maverick-service.${var.namespace}.svc.cluster.local/health"
    app_ready = "http://paperless-maverick-service.${var.namespace}.svc.cluster.local/ready"
    worker_health = "http://embedding-worker-service.${var.namespace}.svc.cluster.local:8080/health"
    worker_ready = "http://embedding-worker-service.${var.namespace}.svc.cluster.local:8080/ready"
  }
}

output "ingress_info" {
  description = "Ingress configuration information"
  value = {
    hosts = [
      var.domain_name,
      "app.${var.domain_name}",
      "api.${var.domain_name}"
    ]
    tls_enabled = var.ingress_config.tls_enabled
    cert_issuer = var.ingress_config.cert_manager_issuer
    rate_limit = var.ingress_config.rate_limit
  }
}

output "resource_quotas" {
  description = "Resource quota information"
  value = {
    app_resources = var.app_resources
    worker_resources = var.worker_resources
    hpa_config = var.hpa_config
  }
}

output "security_config" {
  description = "Security configuration"
  value = {
    network_policies_enabled = var.security_config.network_policies_enabled
    pod_security_standards = var.security_config.pod_security_standards
    rbac_enabled = var.security_config.rbac_enabled
  }
  sensitive = false
}

output "backup_info" {
  description = "Backup configuration information"
  value = {
    enabled = var.backup_config.enabled
    schedule = var.backup_config.schedule
    retention_days = var.backup_config.retention_days
    storage_class = var.backup_config.storage_class
  }
}

output "grafana_admin_password" {
  description = "Grafana admin password (sensitive)"
  value = random_password.grafana_admin_password.result
  sensitive = true
}

output "deployment_commands" {
  description = "Useful kubectl commands for deployment management"
  value = {
    get_pods = "kubectl get pods -n ${var.namespace}"
    get_services = "kubectl get services -n ${var.namespace}"
    get_ingress = "kubectl get ingress -n ${var.namespace}"
    describe_hpa = "kubectl describe hpa -n ${var.namespace}"
    logs_app = "kubectl logs -f deployment/paperless-maverick -n ${var.namespace}"
    logs_worker = "kubectl logs -f deployment/embedding-queue-workers -n ${var.namespace}"
    port_forward_app = "kubectl port-forward service/paperless-maverick-service 8080:80 -n ${var.namespace}"
    port_forward_grafana = "kubectl port-forward service/grafana 3000:3000 -n ${var.namespace}"
  }
}

output "terraform_state_info" {
  description = "Terraform state information"
  value = {
    backend = "s3"
    bucket = "paperless-maverick-terraform-state"
    key = "production/terraform.tfstate"
    region = "us-east-1"
  }
}
