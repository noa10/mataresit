import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { toast } from 'sonner';

// Type definitions for collaboration features
export interface Message {
  id: string;
  team_id: string;
  sender_id: string;
  recipient_id?: string;
  conversation_id: string;
  message_type: 'direct' | 'group' | 'project' | 'system';
  content: string;
  message_format: 'text' | 'markdown' | 'rich';
  attachments: any[];
  reply_to_id?: string;
  edited_at?: string;
  deleted_at?: string;
  read_by: Record<string, string>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  team_id: string;
  conversation_type: 'direct' | 'group' | 'project';
  title?: string;
  description?: string;
  participants: string[];
  created_by: string;
  last_message_at: string;
  last_message_id?: string;
  is_archived: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  start_date?: string;
  due_date?: string;
  completion_date?: string;
  progress_percentage: number;
  created_by: string;
  assigned_to?: string;
  project_manager_id?: string;
  budget_allocated?: number;
  budget_spent: number;
  tags: string[];
  attachments: any[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  team_id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  created_by: string;
  due_date?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  dependencies: string[];
  tags: string[];
  attachments: any[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DiscussionThread {
  id: string;
  team_id: string;
  title: string;
  description?: string;
  thread_type: 'general' | 'receipt' | 'claim' | 'project' | 'announcement';
  related_entity_type?: string;
  related_entity_id?: string;
  created_by: string;
  is_pinned: boolean;
  is_locked: boolean;
  is_archived: boolean;
  last_activity_at: string;
  participant_count: number;
  message_count: number;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SharedFile {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  file_path: string;
  file_size: number;
  file_type: string;
  mime_type: string;
  uploaded_by: string;
  shared_with: string[];
  access_level: 'view' | 'comment' | 'edit' | 'admin';
  version_number: number;
  parent_file_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  download_count: number;
  is_public: boolean;
  expires_at?: string;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

class CollaborationService {
  // ============================================================================
  // MESSAGING METHODS
  // ============================================================================

  async getConversations(teamId: string): Promise<{ success: boolean; data?: Conversation[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async createConversation(
    teamId: string,
    participants: string[],
    type: 'direct' | 'group' | 'project' = 'direct',
    title?: string,
    description?: string
  ): Promise<{ success: boolean; data?: Conversation; error?: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const conversationData = {
        team_id: teamId,
        conversation_type: type,
        title,
        description,
        participants: JSON.stringify([user.user.id, ...participants.filter(p => p !== user.user.id)]),
        created_by: user.user.id,
      };

      const { data, error } = await supabase
        .from('conversations')
        .insert(conversationData)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error creating conversation:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendMessage(
    conversationId: string,
    content: string,
    messageType: 'direct' | 'group' | 'project' | 'system' = 'direct',
    replyToId?: string,
    attachments: any[] = []
  ): Promise<{ success: boolean; data?: Message; error?: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Get conversation details
      const { data: conversation } = await supabase
        .from('conversations')
        .select('team_id, participants')
        .eq('id', conversationId)
        .single();

      if (!conversation) throw new Error('Conversation not found');

      const messageData = {
        team_id: conversation.team_id,
        sender_id: user.user.id,
        conversation_id: conversationId,
        message_type: messageType,
        content,
        attachments: JSON.stringify(attachments),
        reply_to_id: replyToId,
        read_by: JSON.stringify({ [user.user.id]: new Date().toISOString() }),
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      // Update conversation last message
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_id: data.id,
        })
        .eq('id', conversationId);

      return { success: true, data };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; data?: Message[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { success: true, data: data?.reverse() || [] };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async markMessageAsRead(messageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: message } = await supabase
        .from('messages')
        .select('read_by')
        .eq('id', messageId)
        .single();

      if (!message) throw new Error('Message not found');

      const readBy = typeof message.read_by === 'string' 
        ? JSON.parse(message.read_by) 
        : message.read_by || {};
      
      readBy[user.user.id] = new Date().toISOString();

      const { error } = await supabase
        .from('messages')
        .update({ read_by: JSON.stringify(readBy) })
        .eq('id', messageId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error marking message as read:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ============================================================================
  // PROJECT MANAGEMENT METHODS
  // ============================================================================

  async getProjects(teamId: string): Promise<{ success: boolean; data?: Project[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching projects:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async createProject(
    teamId: string,
    projectData: Partial<Project>
  ): Promise<{ success: boolean; data?: Project; error?: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const newProject = {
        team_id: teamId,
        created_by: user.user.id,
        ...projectData,
        tags: JSON.stringify(projectData.tags || []),
        attachments: JSON.stringify(projectData.attachments || []),
        metadata: JSON.stringify(projectData.metadata || {}),
      };

      const { data, error } = await supabase
        .from('projects')
        .insert(newProject)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error creating project:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateProject(
    projectId: string,
    updates: Partial<Project>
  ): Promise<{ success: boolean; data?: Project; error?: string }> {
    try {
      const updateData = {
        ...updates,
        tags: updates.tags ? JSON.stringify(updates.tags) : undefined,
        attachments: updates.attachments ? JSON.stringify(updates.attachments) : undefined,
        metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined,
      };

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating project:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getProjectTasks(projectId: string): Promise<{ success: boolean; data?: ProjectTask[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching project tasks:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async createTask(
    projectId: string,
    taskData: Partial<ProjectTask>
  ): Promise<{ success: boolean; data?: ProjectTask; error?: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Get project team_id
      const { data: project } = await supabase
        .from('projects')
        .select('team_id')
        .eq('id', projectId)
        .single();

      if (!project) throw new Error('Project not found');

      const newTask = {
        project_id: projectId,
        team_id: project.team_id,
        created_by: user.user.id,
        ...taskData,
        dependencies: JSON.stringify(taskData.dependencies || []),
        tags: JSON.stringify(taskData.tags || []),
        attachments: JSON.stringify(taskData.attachments || []),
        metadata: JSON.stringify(taskData.metadata || {}),
      };

      const { data, error } = await supabase
        .from('project_tasks')
        .insert(newTask)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error creating task:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  subscribeToConversations(teamId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`conversations:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `team_id=eq.${teamId}`,
        },
        callback
      )
      .subscribe();
  }

  subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        callback
      )
      .subscribe();
  }

  subscribeToProjects(teamId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`projects:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `team_id=eq.${teamId}`,
        },
        callback
      )
      .subscribe();
  }
}

export const collaborationService = new CollaborationService();
