// Individual Feature Flag Management API
// CRUD operations for specific feature flags

import { NextApiRequest, NextApiResponse } from 'next';
import { FeatureFlagManagerFactory, initializeFeatureFlags } from '@/lib/feature-flags/config';

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
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'Feature flag ID is required' 
      });
    }

    switch (req.method) {
      case 'GET':
        return await handleGetFlag(req, res, flagService, id);
      case 'PUT':
        return await handleUpdateFlag(req, res, flagService, id);
      case 'DELETE':
        return await handleDeleteFlag(req, res, flagService, id);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
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

// GET /api/admin/feature-flags/[id] - Get specific feature flag
async function handleGetFlag(
  req: NextApiRequest, 
  res: NextApiResponse, 
  flagService: any,
  id: string
) {
  try {
    const flag = await flagService.getFlag(id);
    
    if (!flag) {
      return res.status(404).json({
        success: false,
        error: 'Feature flag not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: flag
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch feature flag',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// PUT /api/admin/feature-flags/[id] - Update feature flag
async function handleUpdateFlag(
  req: NextApiRequest, 
  res: NextApiResponse, 
  flagService: any,
  id: string
) {
  try {
    const {
      name,
      description,
      enabled,
      rolloutPercentage,
      targetTeams,
      targetUsers,
      conditions,
      metadata
    } = req.body;

    // Validate rollout percentage if provided
    if (rolloutPercentage !== undefined && (rolloutPercentage < 0 || rolloutPercentage > 100)) {
      return res.status(400).json({
        success: false,
        error: 'Rollout percentage must be between 0 and 100'
      });
    }

    // Build update object with only provided fields
    const updates: any = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (enabled !== undefined) updates.enabled = enabled;
    if (rolloutPercentage !== undefined) updates.rolloutPercentage = rolloutPercentage;
    if (targetTeams !== undefined) updates.targetTeams = targetTeams;
    if (targetUsers !== undefined) updates.targetUsers = targetUsers;
    if (conditions !== undefined) updates.conditions = conditions;
    if (metadata !== undefined) updates.metadata = metadata;

    const updatedFlag = await flagService.updateFlag(id, updates);

    return res.status(200).json({
      success: true,
      data: updatedFlag,
      message: 'Feature flag updated successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Feature flag not found'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to update feature flag',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// DELETE /api/admin/feature-flags/[id] - Delete feature flag
async function handleDeleteFlag(
  req: NextApiRequest, 
  res: NextApiResponse, 
  flagService: any,
  id: string
) {
  try {
    await flagService.deleteFlag(id);

    return res.status(200).json({
      success: true,
      message: 'Feature flag deleted successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Feature flag not found'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to delete feature flag',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
