/**
 * API Proxy Service
 * Provides a fetch-like interface that proxies requests to Supabase Edge Functions
 * This allows the frontend to use the same API patterns while routing to the correct endpoints
 */

import { teamApiService } from './teamApiService';

export interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
}

/**
 * Custom fetch implementation that routes API calls to appropriate services
 */
export async function apiProxy(url: string, options: RequestInit = {}): Promise<FetchResponse> {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body as string) : undefined;

  console.log('API Proxy intercepting request:', { url, method, body });

  // Route team member removal requests
  if (url === '/api/team/remove-member' && method === 'POST') {
    const result = await teamApiService.removeMember(body);
    
    return {
      ok: result.success,
      status: result.success ? 200 : 400,
      json: async () => result
    };
  }

  // Route team member schedule removal requests
  if (url === '/api/team/schedule-removal' && method === 'POST') {
    const result = await teamApiService.scheduleRemoval(body);
    
    return {
      ok: result.success,
      status: result.success ? 200 : 400,
      json: async () => result
    };
  }

  // Route bulk removal requests
  if (url === '/api/team/bulk-remove' && method === 'POST') {
    const result = await teamApiService.bulkRemoveMembers(body);

    return {
      ok: result.success,
      status: result.success ? 200 : 400,
      json: async () => result
    };
  }

  // Route member role update requests
  if (url === '/api/team/update-member-role' && method === 'POST') {
    const result = await teamApiService.updateMemberRole(
      body.team_id,
      body.user_id,
      body.new_role
    );

    return {
      ok: result.success,
      status: result.success ? 200 : 400,
      json: async () => result
    };
  }

  // For any other requests, fall back to regular fetch
  console.warn('API Proxy: No route found for', url, 'falling back to regular fetch');
  return fetch(url, options);
}

/**
 * Enhanced team API service with direct method calls
 * This provides a more convenient interface for team operations
 */
export class TeamAPI {
  /**
   * Remove a team member
   */
  static async removeMember(params: {
    team_id: string;
    user_id: string;
    reason?: string;
    transfer_data?: boolean;
    transfer_to_user_id?: string | null;
  }) {
    return teamApiService.removeMember(params);
  }

  /**
   * Schedule team member removal
   */
  static async scheduleRemoval(params: {
    team_id: string;
    user_id: string;
    removal_date: string;
    reason?: string;
  }) {
    return teamApiService.scheduleRemoval(params);
  }

  /**
   * Bulk remove team members
   */
  static async bulkRemove(params: {
    team_id: string;
    user_ids: string[];
    reason?: string;
    transfer_data?: boolean;
    transfer_to_user_id?: string | null;
  }) {
    return teamApiService.bulkRemoveMembers(params);
  }

  /**
   * Get team members
   */
  static async getMembers(teamId: string) {
    return teamApiService.getTeamMembers(teamId);
  }

  /**
   * Update member role
   */
  static async updateMemberRole(teamId: string, userId: string, role: string) {
    return teamApiService.updateMemberRole(teamId, userId, role);
  }
}
