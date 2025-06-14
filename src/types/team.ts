// Team Management Types

export type TeamStatus = 'active' | 'suspended' | 'archived';

export type TeamMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Team {
  id: string;
  name: string;
  description?: string;
  slug: string;
  status: TeamStatus;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  permissions: Record<string, any>;
  joined_at: string;
  updated_at: string;
  // Joined data from auth.users and profiles
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: TeamMemberRole;
  invited_by: string;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  team_name?: string;
  invited_by_name?: string;
}

export interface UserTeam {
  id: string;
  name: string;
  description?: string;
  slug: string;
  status: TeamStatus;
  owner_id: string;
  user_role: TeamMemberRole;
  member_count: number;
  created_at: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  slug?: string;
}

export interface InviteTeamMemberRequest {
  team_id: string;
  email: string;
  role: TeamMemberRole;
}

export interface UpdateTeamMemberRoleRequest {
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
}

export interface TeamSettings {
  // Receipt sharing settings
  receipt_sharing_enabled: boolean;
  default_receipt_visibility: 'private' | 'team';
  
  // Member permissions
  member_can_invite: boolean;
  member_can_upload: boolean;
  member_can_edit_receipts: boolean;
  
  // Notification settings
  notify_on_new_member: boolean;
  notify_on_receipt_upload: boolean;
  
  // Integration settings
  integrations: {
    [key: string]: {
      enabled: boolean;
      config: Record<string, any>;
    };
  };
}

export interface TeamStats {
  total_members: number;
  total_receipts: number;
  total_amount: number;
  receipts_this_month: number;
  amount_this_month: number;
  top_categories: Array<{
    category: string;
    count: number;
    amount: number;
  }>;
  recent_activity: Array<{
    type: 'receipt_uploaded' | 'member_joined' | 'member_left';
    user_name: string;
    timestamp: string;
    details?: Record<string, any>;
  }>;
}

// Permission helpers
export const TEAM_PERMISSIONS = {
  // Team management
  VIEW_TEAM: ['owner', 'admin', 'member', 'viewer'],
  EDIT_TEAM: ['owner'],
  DELETE_TEAM: ['owner'],
  
  // Member management
  VIEW_MEMBERS: ['owner', 'admin', 'member', 'viewer'],
  INVITE_MEMBERS: ['owner', 'admin'],
  REMOVE_MEMBERS: ['owner', 'admin'],
  UPDATE_MEMBER_ROLES: ['owner', 'admin'],
  
  // Receipt management
  VIEW_RECEIPTS: ['owner', 'admin', 'member', 'viewer'],
  UPLOAD_RECEIPTS: ['owner', 'admin', 'member'],
  EDIT_RECEIPTS: ['owner', 'admin', 'member'],
  DELETE_RECEIPTS: ['owner', 'admin'],
  
  // Settings
  VIEW_SETTINGS: ['owner', 'admin'],
  EDIT_SETTINGS: ['owner', 'admin'],
} as const;

export function hasTeamPermission(
  userRole: TeamMemberRole,
  permission: keyof typeof TEAM_PERMISSIONS
): boolean {
  return TEAM_PERMISSIONS[permission].includes(userRole);
}

export function getTeamRoleDisplayName(role: TeamMemberRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'member':
      return 'Member';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Unknown';
  }
}

export function getTeamRoleDescription(role: TeamMemberRole): string {
  switch (role) {
    case 'owner':
      return 'Full access to team settings, members, and data. Can delete the team.';
    case 'admin':
      return 'Can manage team members, settings, and all receipts. Cannot delete the team.';
    case 'member':
      return 'Can upload, edit, and view receipts. Can view team members.';
    case 'viewer':
      return 'Can only view receipts and team members. Cannot upload or edit.';
    default:
      return 'Unknown role';
  }
}

export const TEAM_ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-blue-100 text-blue-800 border-blue-200',
  member: 'bg-green-100 text-green-800 border-green-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200',
} as const;
