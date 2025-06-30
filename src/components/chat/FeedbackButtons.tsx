/**
 * Feedback Buttons Component
 * 
 * Provides thumbs up/down feedback buttons for chat messages
 * with visual feedback and storage integration.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare,
  Check,
  X
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FeedbackButtonsProps {
  messageId: string;
  conversationId?: string;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
}

interface MessageFeedback {
  id: string;
  feedback_type: 'positive' | 'negative';
  feedback_comment?: string;
  created_at: string;
  updated_at: string;
}

export function FeedbackButtons({
  messageId,
  conversationId,
  onFeedback,
  className = '',
  size = 'sm',
  variant = 'ghost'
}: FeedbackButtonsProps) {
  const { user } = useAuth();
  const [currentFeedback, setCurrentFeedback] = useState<MessageFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState<'positive' | 'negative' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing feedback on mount
  useEffect(() => {
    if (user && messageId) {
      loadExistingFeedback();
    }
  }, [user, messageId]);

  /**
   * Load existing feedback for this message
   */
  const loadExistingFeedback = async () => {
    try {
      const { data, error } = await supabase.rpc('get_message_feedback', {
        p_message_id: messageId
      });

      if (error) {
        console.error('Error loading feedback:', error);
        return;
      }

      if (data && data.length > 0) {
        setCurrentFeedback(data[0]);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
    }
  };

  /**
   * Handle feedback button click
   */
  const handleFeedbackClick = async (feedbackType: 'positive' | 'negative') => {
    if (!user) {
      toast.error('Please sign in to provide feedback');
      return;
    }

    // If clicking the same feedback type that's already selected, remove it
    if (currentFeedback?.feedback_type === feedbackType) {
      await removeFeedback();
      return;
    }

    // For negative feedback, show comment dialog
    if (feedbackType === 'negative') {
      setPendingFeedback(feedbackType);
      setComment(currentFeedback?.feedback_comment || '');
      setShowCommentDialog(true);
      return;
    }

    // For positive feedback, submit immediately
    await submitFeedback(feedbackType);
  };

  /**
   * Submit feedback to the database
   */
  const submitFeedback = async (feedbackType: 'positive' | 'negative', feedbackComment?: string) => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc('submit_message_feedback', {
        p_message_id: messageId,
        p_conversation_id: conversationId || null,
        p_feedback_type: feedbackType,
        p_feedback_comment: feedbackComment || null
      });

      if (error) {
        throw error;
      }

      // Update local state
      setCurrentFeedback({
        id: data,
        feedback_type: feedbackType,
        feedback_comment: feedbackComment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Call callback if provided
      onFeedback?.(messageId, feedbackType);

      // Show success message
      toast.success(
        feedbackType === 'positive' 
          ? 'Thank you for your positive feedback!' 
          : 'Thank you for your feedback. We\'ll use it to improve our responses.'
      );

    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove existing feedback
   */
  const removeFeedback = async () => {
    if (!currentFeedback) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('message_feedback')
        .delete()
        .eq('id', currentFeedback.id);

      if (error) {
        throw error;
      }

      setCurrentFeedback(null);
      toast.success('Feedback removed');

    } catch (error) {
      console.error('Error removing feedback:', error);
      toast.error('Failed to remove feedback');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle comment dialog submission
   */
  const handleCommentSubmit = async () => {
    if (!pendingFeedback) return;

    setIsSubmitting(true);

    try {
      await submitFeedback(pendingFeedback, comment.trim() || undefined);
      setShowCommentDialog(false);
      setPendingFeedback(null);
      setComment('');
    } catch (error) {
      // Error handling is done in submitFeedback
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle comment dialog cancel
   */
  const handleCommentCancel = () => {
    setShowCommentDialog(false);
    setPendingFeedback(null);
    setComment('');
  };

  if (!user) {
    return null; // Don't show feedback buttons for non-authenticated users
  }

  const isPositiveSelected = currentFeedback?.feedback_type === 'positive';
  const isNegativeSelected = currentFeedback?.feedback_type === 'negative';

  return (
    <>
      <div className={`flex items-center gap-1 ${className}`}>
        {/* Positive Feedback Button */}
        <Button
          variant={isPositiveSelected ? 'default' : variant}
          size={size}
          onClick={() => handleFeedbackClick('positive')}
          disabled={isLoading}
          className={`transition-all duration-200 ${
            isPositiveSelected 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : 'hover:bg-green-50 hover:text-green-600'
          }`}
          title={isPositiveSelected ? 'Remove positive feedback' : 'This response was helpful'}
        >
          {isPositiveSelected ? (
            <Check className="h-4 w-4" />
          ) : (
            <ThumbsUp className="h-4 w-4" />
          )}
        </Button>

        {/* Negative Feedback Button */}
        <Button
          variant={isNegativeSelected ? 'destructive' : variant}
          size={size}
          onClick={() => handleFeedbackClick('negative')}
          disabled={isLoading}
          className={`transition-all duration-200 ${
            isNegativeSelected 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'hover:bg-red-50 hover:text-red-600'
          }`}
          title={isNegativeSelected ? 'Remove negative feedback' : 'This response was not helpful'}
        >
          {isNegativeSelected ? (
            <X className="h-4 w-4" />
          ) : (
            <ThumbsDown className="h-4 w-4" />
          )}
        </Button>

        {/* Show comment indicator if negative feedback has comment */}
        {isNegativeSelected && currentFeedback?.feedback_comment && (
          <MessageSquare className="h-3 w-3 text-muted-foreground ml-1" />
        )}
      </div>

      {/* Comment Dialog for Negative Feedback */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Help us improve</DialogTitle>
            <DialogDescription>
              What could we do better? Your feedback helps us improve our responses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              placeholder="Tell us what went wrong or how we can improve..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="text-xs text-muted-foreground">
              This feedback is optional but helps us provide better responses.
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCommentCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCommentSubmit}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
