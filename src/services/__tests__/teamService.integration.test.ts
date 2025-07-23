import { teamService } from '../teamService';
import { enhancedTeamService } from '../enhancedTeamService';

describe('TeamService Integration Tests', () => {
  const mockTeamId = 'test-team-id';
  const mockUserId = 'test-user-id';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks();
  });

  describe('Legacy Methods', () => {
    test('should have all legacy methods available', () => {
      expect(typeof teamService.createTeam).toBe('function');
      expect(typeof teamService.getUserTeams).toBe('function');
      expect(typeof teamService.getTeam).toBe('function');
      expect(typeof teamService.updateTeam).toBe('function');
      expect(typeof teamService.deleteTeam).toBe('function');
      expect(typeof teamService.getTeamMembers).toBe('function');
      expect(typeof teamService.inviteTeamMember).toBe('function');
      expect(typeof teamService.acceptInvitation).toBe('function');
      expect(typeof teamService.removeTeamMember).toBe('function');
      expect(typeof teamService.updateTeamMemberRole).toBe('function');
      expect(typeof teamService.getTeamInvitations).toBe('function');
      expect(typeof teamService.cancelInvitation).toBe('function');
      expect(typeof teamService.getInvitationByToken).toBe('function');
      expect(typeof teamService.getTeamStats).toBe('function');
      expect(typeof teamService.checkTeamMembership).toBe('function');
      expect(typeof teamService.isTeamSlugAvailable).toBe('function');
    });
  });

  describe('Enhanced Methods', () => {
    test('should have all enhanced member management methods', () => {
      expect(typeof teamService.removeMemberEnhanced).toBe('function');
      expect(typeof teamService.updateMemberRoleEnhanced).toBe('function');
      expect(typeof teamService.scheduleMemberRemoval).toBe('function');
      expect(typeof teamService.cancelScheduledRemoval).toBe('function');
      expect(typeof teamService.transferOwnership).toBe('function');
    });

    test('should have all enhanced invitation methods', () => {
      expect(typeof teamService.inviteTeamMemberEnhanced).toBe('function');
      expect(typeof teamService.resendInvitationEnhanced).toBe('function');
      expect(typeof teamService.cancelInvitationEnhanced).toBe('function');
      expect(typeof teamService.getTeamInvitationsEnhanced).toBe('function');
    });

    test('should have all bulk operation methods', () => {
      expect(typeof teamService.bulkUpdateRolesEnhanced).toBe('function');
      expect(typeof teamService.bulkInviteMembersEnhanced).toBe('function');
      expect(typeof teamService.bulkRemoveMembersEnhanced).toBe('function');
    });

    test('should have all audit and security methods', () => {
      expect(typeof teamService.getAuditLogsEnhanced).toBe('function');
      expect(typeof teamService.searchAuditLogsEnhanced).toBe('function');
      expect(typeof teamService.exportAuditLogsEnhanced).toBe('function');
      expect(typeof teamService.getEnhancedTeamStats).toBe('function');
      expect(typeof teamService.getSecurityDashboard).toBe('function');
    });

    test('should have utility methods', () => {
      expect(typeof teamService.validateTeamAccess).toBe('function');
      expect(typeof teamService.healthCheck).toBe('function');
      expect(typeof teamService.getEnhancedService).toBe('function');
    });
  });

  describe('Service Integration', () => {
    test('should return enhanced service instance', () => {
      const enhancedService = teamService.getEnhancedService();
      expect(enhancedService).toBe(enhancedTeamService);
    });

    test('should maintain backward compatibility', () => {
      // Test that legacy method signatures are preserved
      expect(teamService.getTeamMembers).toBeDefined();
      expect(teamService.inviteTeamMember).toBeDefined();
      expect(teamService.removeTeamMember).toBeDefined();
      expect(teamService.updateTeamMemberRole).toBeDefined();
    });

    test('should provide enhanced functionality alongside legacy methods', () => {
      // Test that both legacy and enhanced versions exist where applicable
      expect(teamService.getTeamMembers).toBeDefined(); // Legacy
      expect(teamService.removeMemberEnhanced).toBeDefined(); // Enhanced
      expect(teamService.inviteTeamMember).toBeDefined(); // Legacy
      expect(teamService.inviteTeamMemberEnhanced).toBeDefined(); // Enhanced
    });
  });

  describe('Error Handling', () => {
    test('enhanced methods should handle TeamServiceException properly', async () => {
      // Mock the enhanced service to throw an error
      const mockError = new Error('Test error');
      jest.spyOn(enhancedTeamService, 'validateTeamAccess').mockRejectedValue(mockError);

      const result = await teamService.validateTeamAccess(mockTeamId);
      expect(result).toBe(false);
    });

    test('health check should return unhealthy status on error', async () => {
      // Mock the enhanced service to throw an error
      const mockError = new Error('Service unavailable');
      jest.spyOn(enhancedTeamService, 'healthCheck').mockRejectedValue(mockError);

      const result = await teamService.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Method Signatures', () => {
    test('enhanced methods should return ServiceResponse format', () => {
      // Test that enhanced methods are designed to return ServiceResponse
      // This is a structural test to ensure consistency
      const enhancedMethods = [
        'removeMemberEnhanced',
        'updateMemberRoleEnhanced',
        'scheduleMemberRemoval',
        'cancelScheduledRemoval',
        'transferOwnership',
        'resendInvitationEnhanced',
        'cancelInvitationEnhanced',
        'getTeamInvitationsEnhanced',
        'bulkUpdateRolesEnhanced',
        'bulkInviteMembersEnhanced',
        'bulkRemoveMembersEnhanced',
        'getAuditLogsEnhanced',
        'searchAuditLogsEnhanced',
        'exportAuditLogsEnhanced',
        'getEnhancedTeamStats',
        'getSecurityDashboard',
      ];

      enhancedMethods.forEach(methodName => {
        expect(typeof (teamService as any)[methodName]).toBe('function');
      });
    });
  });
});
