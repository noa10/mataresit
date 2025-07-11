import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  Send, 
  Trash2, 
  Edit3, 
  Clock,
  Users,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscribeToReceiptAll } from '@/services/receiptService';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  receipt_id: string;
  user_id: string;
  team_id?: string;
  comment_text: string;
  is_internal: boolean;
  parent_comment_id?: string;
  created_at: string;
  updated_at: string;
  user_profile?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    avatar_url?: string;
  };
}

interface ReceiptCommentsProps {
  receiptId: string;
  teamId?: string;
  canComment?: boolean;
  className?: string;
}

export function ReceiptComments({ receiptId, teamId, canComment = true, className }: ReceiptCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Load comments
  useEffect(() => {
    loadComments();
  }, [receiptId]);

  // Define loadComments before useEffect to avoid dependency issues
  const loadComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('receipt_comments')
        .select(`
          *,
          user_profile:profiles(first_name, last_name, email, avatar_url)
        `)
        .eq('receipt_id', receiptId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading comments:', error);
        toast.error('Failed to load comments');
        return;
      }

      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [receiptId]);

  // OPTIMIZATION: Use unified subscription system for receipt comments
  useEffect(() => {
    const unsubscribe = subscribeToReceiptAll(
      receiptId,
      'receipt-comments',
      {
        onCommentUpdate: (payload) => {
          if (payload.eventType === 'INSERT') {
            loadComments(); // Reload to get user profile data
          } else if (payload.eventType === 'UPDATE') {
            setComments(prev => prev.map(comment =>
              comment.id === payload.new.id
                ? { ...comment, ...payload.new }
                : comment
            ));
          } else if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(comment => comment.id !== payload.old.id));
          }
        }
      },
      {
        subscribeToComments: true
      }
    );

    return unsubscribe;
  }, [receiptId, loadComments]);

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('receipt_comments')
        .insert({
          receipt_id: receiptId,
          user_id: user.id,
          team_id: teamId,
          comment_text: newComment.trim(),
          is_internal: false,
        });

      if (error) {
        console.error('Error adding comment:', error);
        toast.error('Failed to add comment');
        return;
      }

      setNewComment('');
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingText.trim()) return;

    try {
      const { error } = await supabase
        .from('receipt_comments')
        .update({ 
          comment_text: editingText.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .eq('user_id', user?.id); // Ensure user can only edit their own comments

      if (error) {
        console.error('Error updating comment:', error);
        toast.error('Failed to update comment');
        return;
      }

      setEditingCommentId(null);
      setEditingText('');
      toast.success('Comment updated successfully');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('receipt_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user?.id); // Ensure user can only delete their own comments

      if (error) {
        console.error('Error deleting comment:', error);
        toast.error('Failed to delete comment');
        return;
      }

      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const getUserDisplayName = (comment: Comment): string => {
    const profile = comment.user_profile;
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile?.email || 'Unknown User';
  };

  const getUserInitials = (comment: Comment): string => {
    const profile = comment.user_profile;
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return 'U';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Comments
          {comments.length > 0 && (
            <Badge variant="secondary">{comments.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {teamId ? 'Team discussion about this receipt' : 'Add notes and comments about this receipt'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        {comments.length > 0 ? (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {comments.map((comment, index) => (
                <div key={comment.id}>
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.user_profile?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getUserInitials(comment)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {getUserDisplayName(comment)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                        {comment.is_internal && (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Internal
                          </Badge>
                        )}
                        {teamId && (
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            Team
                          </Badge>
                        )}
                      </div>
                      
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="min-h-[60px]"
                            placeholder="Edit your comment..."
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEditComment(comment.id)}
                              disabled={!editingText.trim()}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingText('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {comment.comment_text}
                          </p>
                          {comment.user_id === user?.id && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditingText(comment.comment_text);
                                }}
                                className="h-6 px-2 text-xs"
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {index < comments.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs">Be the first to add a comment</p>
          </div>
        )}

        {/* Add Comment Form */}
        {canComment && user && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-[80px] resize-none"
                  disabled={isSubmitting}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {newComment.length}/2000 characters
                  </span>
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || isSubmitting}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {isSubmitting ? 'Adding...' : 'Add Comment'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!canComment && (
          <div className="text-center py-4 text-muted-foreground">
            <Lock className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">You don't have permission to comment on this receipt</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
