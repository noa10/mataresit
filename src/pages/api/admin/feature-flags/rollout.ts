// Feature Flag Rollout Management API
// Endpoints for managing rollout percentages and Phase 5 rollout automation

import { NextApiRequest, NextApiResponse } from 'next';
import { FeatureFlagManagerFactory, initializeFeatureFlags } from '@/lib/feature-flags/config';
import { Phase5RolloutManager } from '@/lib/feature-flags/phase5-flags';

// Initialize feature flags on first request
let initialized = false;

const ensureInitialized = async () => {
  if (!initialized) {
    await initializeFeatureFlags();
    initialized = true;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureInitialized();
    const flagService = FeatureFlagManagerFactory.getInstance();
    const rolloutManager = FeatureFlagManagerFactory.getRolloutManager();

    const { action, flagId, percentage, week, targetTeams, targetUsers } = req.body;

    switch (action) {
      case 'updatePercentage':
        return await handleUpdatePercentage(req, res, flagService, flagId, percentage);
      case 'weeklyRollout':
        return await handleWeeklyRollout(req, res, rolloutManager, week);
      case 'emergencyDisable':
        return await handleEmergencyDisable(req, res, rolloutManager);
      case 'addTargetTeam':
        return await handleAddTargetTeam(req, res, flagService, flagId, targetTeams);
      case 'removeTargetTeam':
        return await handleRemoveTargetTeam(req, res, flagService, flagId, targetTeams);
      case 'addTargetUser':
        return await handleAddTargetUser(req, res, flagService, flagId, targetUsers);
      case 'removeTargetUser':
        return await handleRemoveTargetUser(req, res, flagService, flagId, targetUsers);
      case 'getPhase5Status':
        return await handleGetPhase5Status(req, res, rolloutManager);
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Supported actions: updatePercentage, weeklyRollout, emergencyDisable, addTargetTeam, removeTargetTeam, addTargetUser, removeTargetUser, getPhase5Status'
        });
    }
  } catch (error) {
    console.error('Feature flag rollout API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Update rollout percentage for a specific flag
async function handleUpdatePercentage(
  req: NextApiRequest,
  res: NextApiResponse,
  flagService: any,
  flagId: string,
  percentage: number
) {
  if (!flagId) {
    return res.status(400).json({
      success: false,
      error: 'flagId is required for updatePercentage action'
    });
  }

  if (percentage === undefined || percentage < 0 || percentage > 100) {
    return res.status(400).json({
      success: false,
      error: 'percentage must be between 0 and 100'
    });
  }

  try {
    await flagService.updateRolloutPercentage(flagId, percentage);
    
    return res.status(200).json({
      success: true,
      message: `Rollout percentage updated to ${percentage}% for flag ${flagId}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update rollout percentage',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Execute weekly Phase 5 rollout
async function handleWeeklyRollout(
  req: NextApiRequest,
  res: NextApiResponse,
  rolloutManager: Phase5RolloutManager,
  week: number
) {
  if (!week || week < 1 || week > 10) {
    return res.status(400).json({
      success: false,
      error: 'week must be between 1 and 10'
    });
  }

  try {
    await rolloutManager.executeWeeklyRollout(week);
    
    return res.status(200).json({
      success: true,
      message: `Week ${week} rollout executed successfully`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to execute weekly rollout',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Emergency disable all Phase 5 features
async function handleEmergencyDisable(
  req: NextApiRequest,
  res: NextApiResponse,
  rolloutManager: Phase5RolloutManager
) {
  try {
    await rolloutManager.emergencyDisableAll();
    
    return res.status(200).json({
      success: true,
      message: 'All Phase 5 features disabled successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to emergency disable features',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Add target teams to a flag
async function handleAddTargetTeam(
  req: NextApiRequest,
  res: NextApiResponse,
  flagService: any,
  flagId: string,
  targetTeams: string[]
) {
  if (!flagId || !targetTeams || !Array.isArray(targetTeams)) {
    return res.status(400).json({
      success: false,
      error: 'flagId and targetTeams array are required'
    });
  }

  try {
    for (const teamId of targetTeams) {
      await flagService.addTargetTeam(flagId, teamId);
    }
    
    return res.status(200).json({
      success: true,
      message: `Added ${targetTeams.length} target teams to flag ${flagId}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to add target teams',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Remove target teams from a flag
async function handleRemoveTargetTeam(
  req: NextApiRequest,
  res: NextApiResponse,
  flagService: any,
  flagId: string,
  targetTeams: string[]
) {
  if (!flagId || !targetTeams || !Array.isArray(targetTeams)) {
    return res.status(400).json({
      success: false,
      error: 'flagId and targetTeams array are required'
    });
  }

  try {
    for (const teamId of targetTeams) {
      await flagService.removeTargetTeam(flagId, teamId);
    }
    
    return res.status(200).json({
      success: true,
      message: `Removed ${targetTeams.length} target teams from flag ${flagId}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to remove target teams',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Add target users to a flag
async function handleAddTargetUser(
  req: NextApiRequest,
  res: NextApiResponse,
  flagService: any,
  flagId: string,
  targetUsers: string[]
) {
  if (!flagId || !targetUsers || !Array.isArray(targetUsers)) {
    return res.status(400).json({
      success: false,
      error: 'flagId and targetUsers array are required'
    });
  }

  try {
    for (const userId of targetUsers) {
      await flagService.addTargetUser(flagId, userId);
    }
    
    return res.status(200).json({
      success: true,
      message: `Added ${targetUsers.length} target users to flag ${flagId}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to add target users',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Remove target users from a flag
async function handleRemoveTargetUser(
  req: NextApiRequest,
  res: NextApiResponse,
  flagService: any,
  flagId: string,
  targetUsers: string[]
) {
  if (!flagId || !targetUsers || !Array.isArray(targetUsers)) {
    return res.status(400).json({
      success: false,
      error: 'flagId and targetUsers array are required'
    });
  }

  try {
    for (const userId of targetUsers) {
      await flagService.removeTargetUser(flagId, userId);
    }
    
    return res.status(200).json({
      success: true,
      message: `Removed ${targetUsers.length} target users from flag ${flagId}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to remove target users',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Get Phase 5 rollout status
async function handleGetPhase5Status(
  req: NextApiRequest,
  res: NextApiResponse,
  rolloutManager: Phase5RolloutManager
) {
  try {
    const status = await rolloutManager.getPhase5Status();
    
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get Phase 5 status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
