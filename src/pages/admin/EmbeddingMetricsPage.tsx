/**
 * Embedding Metrics Admin Page
 * Admin page for embedding performance monitoring and management
 * Phase 1: Embedding Success Rate Monitoring Dashboard
 */

import React from 'react';
import { EmbeddingMetricsDashboard } from '@/components/admin/EmbeddingMetricsDashboard';

export default function EmbeddingMetricsPage() {
  return (
    <div className="container mx-auto p-6">
      <EmbeddingMetricsDashboard />
    </div>
  );
}
