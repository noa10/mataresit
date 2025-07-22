// Feature Flag Evaluation API
// Endpoint for evaluating feature flags for users/teams

import { NextApiRequest, NextApiResponse } from 'next';
import { FeatureFlagManagerFactory, initializeFeatureFlags, evaluateFeatureFlag, evaluateAllPhase5Flags } from '@/lib/feature-flags/config';
import { EvaluationContext } from '@/lib/feature-flags/types';

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

    const {
      flagName,
      flagNames,
      userId,
      teamId,
      userAttributes,
      teamAttributes,
      customAttributes,
      evaluateAll = false,
      evaluatePhase5 = false
    } = req.body;

    // Validate input
    if (!evaluateAll && !evaluatePhase5 && !flagName && !flagNames) {
      return res.status(400).json({
        success: false,
        error: 'Either flagName, flagNames, evaluateAll, or evaluatePhase5 must be provided'
      });
    }

    const context: EvaluationContext = {
      userId,
      teamId,
      userAttributes,
      teamAttributes,
      customAttributes,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };

    let result: any;

    if (evaluatePhase5) {
      // Evaluate all Phase 5 flags
      result = await evaluateAllPhase5Flags(userId, teamId);
    } else if (evaluateAll) {
      // Evaluate all flags
      result = await flagService.evaluateAllFlags(context);
    } else if (flagNames && Array.isArray(flagNames)) {
      // Evaluate multiple specific flags
      result = {};
      for (const name of flagNames) {
        const evaluation = await flagService.evaluateFlag(name, context);
        result[name] = evaluation;
      }
    } else if (flagName) {
      // Evaluate single flag
      result = await flagService.evaluateFlag(flagName, context);
    }

    return res.status(200).json({
      success: true,
      data: result,
      context: {
        userId,
        teamId,
        environment: context.environment,
        timestamp: context.timestamp
      }
    });

  } catch (error) {
    console.error('Feature flag evaluation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to evaluate feature flag(s)',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
