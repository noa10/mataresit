// Feature Flag Management API Endpoints
// RESTful API for managing feature flags

import { NextApiRequest, NextApiResponse } from 'next';
import { FeatureFlagManagerFactory, initializeFeatureFlags } from '@/lib/feature-flags/config';
import { FeatureFlag, FeatureFlagFilters } from '@/lib/feature-flags/types';

// Initialize feature flags on first request
let initialized = false;

const ensureInitialized = async () => {
  if (!initialized) {
    await initializeFeatureFlags();
    initialized = true;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureInitialized();
    const flagService = FeatureFlagManagerFactory.getInstance();

    switch (req.method) {
      case 'GET':
        return await handleGetFlags(req, res, flagService);
      case 'POST':
        return await handleCreateFlag(req, res, flagService);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Feature flag API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// GET /api/admin/feature-flags - List feature flags
async function handleGetFlags(
  req: NextApiRequest, 
  res: NextApiResponse, 
  flagService: any
) {
  try {
    const {
      enabled,
      category,
      priority,
      createdBy,
      lastModifiedAfter,
      lastModifiedBefore,
      tags
    } = req.query;

    const filters: FeatureFlagFilters = {};

    if (enabled !== undefined) {
      filters.enabled = enabled === 'true';
    }
    if (category) {
      filters.category = category as string;
    }
    if (priority) {
      filters.priority = priority as string;
    }
    if (createdBy) {
      filters.createdBy = createdBy as string;
    }
    if (lastModifiedAfter) {
      filters.lastModifiedAfter = lastModifiedAfter as string;
    }
    if (lastModifiedBefore) {
      filters.lastModifiedBefore = lastModifiedBefore as string;
    }
    if (tags) {
      filters.tags = Array.isArray(tags) ? tags as string[] : [tags as string];
    }

    const flags = await flagService.listFlags(filters);
    
    return res.status(200).json({
      success: true,
      data: flags,
      count: flags.length
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch feature flags',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// POST /api/admin/feature-flags - Create feature flag
async function handleCreateFlag(
  req: NextApiRequest, 
  res: NextApiResponse, 
  flagService: any
) {
  try {
    const {
      name,
      description,
      enabled = false,
      rolloutPercentage = 0,
      targetTeams = [],
      targetUsers = [],
      conditions = [],
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name and description are required'
      });
    }

    // Validate rollout percentage
    if (rolloutPercentage < 0 || rolloutPercentage > 100) {
      return res.status(400).json({
        success: false,
        error: 'Rollout percentage must be between 0 and 100'
      });
    }

    const flagData: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      description,
      enabled,
      rolloutPercentage,
      targetTeams,
      targetUsers,
      conditions,
      metadata: {
        category: metadata.category || 'general',
        priority: metadata.priority || 'medium',
        tags: metadata.tags || [],
        rolloutStrategy: metadata.rolloutStrategy || 'percentage',
        dependencies: metadata.dependencies || [],
        conflicts: metadata.conflicts || [],
        rollbackPlan: metadata.rollbackPlan || '',
        monitoringMetrics: metadata.monitoringMetrics || [],
        estimatedImpact: metadata.estimatedImpact || 'low',
        testingStatus: metadata.testingStatus || 'not_tested',
        ...metadata
      },
      createdBy: 'api-user', // TODO: Get from authentication
      lastModifiedBy: 'api-user'
    };

    const newFlag = await flagService.createFlag(flagData);

    return res.status(201).json({
      success: true,
      data: newFlag,
      message: 'Feature flag created successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to create feature flag',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
