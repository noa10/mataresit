-- Add receipt comments system
-- Migration: 20250703140000_add_receipt_comments_system.sql

-- Create receipt comments table
CREATE TABLE IF NOT EXISTS public.receipt_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false, -- Internal team comments vs public comments
  parent_comment_id UUID REFERENCES public.receipt_comments(id) ON DELETE CASCADE, -- For threaded comments
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT comment_text_not_empty CHECK (LENGTH(TRIM(comment_text)) > 0),
  CONSTRAINT comment_text_length CHECK (LENGTH(comment_text) <= 2000)
);

-- Create receipt sharing table
CREATE TABLE IF NOT EXISTS public.receipt_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE NOT NULL,
  shared_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('team', 'user', 'public')),
  permissions JSONB DEFAULT '{"view": true, "edit": false, "comment": true}'::JSONB,
  message TEXT, -- Optional message when sharing
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure either team or user is specified, not both
  CONSTRAINT share_target_check CHECK (
    (shared_with_team_id IS NOT NULL AND shared_with_user_id IS NULL) OR
    (shared_with_team_id IS NULL AND shared_with_user_id IS NOT NULL) OR
    (share_type = 'public')
  ),
  
  -- Unique constraint to prevent duplicate shares
  UNIQUE(receipt_id, shared_with_team_id, shared_with_user_id)
);

-- Create receipt flags table for flagging receipts for review
CREATE TABLE IF NOT EXISTS public.receipt_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE NOT NULL,
  flagged_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('review_required', 'suspicious', 'duplicate', 'incorrect_data', 'policy_violation', 'other')),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipt_comments_receipt_id ON public.receipt_comments(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_comments_user_id ON public.receipt_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_comments_team_id ON public.receipt_comments(team_id);
CREATE INDEX IF NOT EXISTS idx_receipt_comments_parent_id ON public.receipt_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_receipt_comments_created_at ON public.receipt_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipt_shares_receipt_id ON public.receipt_shares(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_shares_shared_by ON public.receipt_shares(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_shares_team_id ON public.receipt_shares(shared_with_team_id);
CREATE INDEX IF NOT EXISTS idx_receipt_shares_user_id ON public.receipt_shares(shared_with_user_id);

CREATE INDEX IF NOT EXISTS idx_receipt_flags_receipt_id ON public.receipt_flags(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_flags_team_id ON public.receipt_flags(team_id);
CREATE INDEX IF NOT EXISTS idx_receipt_flags_status ON public.receipt_flags(status);

-- Enable RLS
ALTER TABLE public.receipt_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies for receipt comments
CREATE POLICY "Users can view comments on receipts they can access" ON public.receipt_comments
  FOR SELECT USING (
    -- User can see comments on their own receipts
    receipt_id IN (SELECT id FROM public.receipts WHERE user_id = auth.uid())
    OR
    -- User can see comments on team receipts if they're a team member
    (team_id IS NOT NULL AND team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND status = 'active'
    ))
    OR
    -- User can see comments on receipts shared with them
    receipt_id IN (
      SELECT receipt_id FROM public.receipt_shares 
      WHERE shared_with_user_id = auth.uid()
      OR shared_with_team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can create comments on accessible receipts" ON public.receipt_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Can comment on own receipts
      receipt_id IN (SELECT id FROM public.receipts WHERE user_id = auth.uid())
      OR
      -- Can comment on team receipts if they're a team member
      (team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      ))
      OR
      -- Can comment on receipts shared with them (if comment permission is granted)
      receipt_id IN (
        SELECT receipt_id FROM public.receipt_shares 
        WHERE (shared_with_user_id = auth.uid() OR shared_with_team_id IN (
          SELECT team_id FROM public.team_members 
          WHERE user_id = auth.uid() AND status = 'active'
        ))
        AND (permissions->>'comment')::BOOLEAN = true
      )
    )
  );

CREATE POLICY "Users can update their own comments" ON public.receipt_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON public.receipt_comments
  FOR DELETE USING (user_id = auth.uid());

-- RLS policies for receipt shares
CREATE POLICY "Users can view shares for their receipts or shares involving them" ON public.receipt_shares
  FOR SELECT USING (
    shared_by_user_id = auth.uid()
    OR shared_with_user_id = auth.uid()
    OR shared_with_team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR receipt_id IN (SELECT id FROM public.receipts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create shares for their own receipts" ON public.receipt_shares
  FOR INSERT WITH CHECK (
    shared_by_user_id = auth.uid()
    AND receipt_id IN (SELECT id FROM public.receipts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own shares" ON public.receipt_shares
  FOR UPDATE USING (shared_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own shares" ON public.receipt_shares
  FOR DELETE USING (shared_by_user_id = auth.uid());

-- RLS policies for receipt flags
CREATE POLICY "Users can view flags for accessible receipts" ON public.receipt_flags
  FOR SELECT USING (
    -- Can see flags on own receipts
    receipt_id IN (SELECT id FROM public.receipts WHERE user_id = auth.uid())
    OR
    -- Team members can see flags on team receipts
    (team_id IS NOT NULL AND team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND status = 'active'
    ))
    OR
    -- Can see flags they created
    flagged_by_user_id = auth.uid()
  );

CREATE POLICY "Users can create flags for accessible receipts" ON public.receipt_flags
  FOR INSERT WITH CHECK (
    flagged_by_user_id = auth.uid()
    AND (
      -- Can flag own receipts
      receipt_id IN (SELECT id FROM public.receipts WHERE user_id = auth.uid())
      OR
      -- Can flag team receipts if they're a team member
      (team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      ))
    )
  );

CREATE POLICY "Team admins can update flags" ON public.receipt_flags
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND status = 'active' 
      AND role IN ('admin', 'owner')
    )
    OR flagged_by_user_id = auth.uid()
  );

-- Function to handle comment notifications
CREATE OR REPLACE FUNCTION public.handle_receipt_comment_notification()
RETURNS TRIGGER AS $function$
DECLARE
  _receipt_data RECORD;
  _commenter_name TEXT;
  _team_members RECORD;
BEGIN
  -- Get receipt and commenter information
  SELECT r.user_id, r.merchant, r.team_id, u.email
  INTO _receipt_data
  FROM public.receipts r
  LEFT JOIN auth.users u ON u.id = r.user_id
  WHERE r.id = NEW.receipt_id;
  
  -- Get commenter name
  SELECT COALESCE(p.first_name || ' ' || p.last_name, u.email, 'Unknown User')
  INTO _commenter_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = NEW.user_id;
  
  -- Create notification for receipt owner (if not the commenter)
  IF _receipt_data.user_id != NEW.user_id THEN
    INSERT INTO public.notifications (
      recipient_id,
      type,
      title,
      message,
      priority,
      action_url,
      related_entity_type,
      related_entity_id,
      metadata,
      team_id,
      created_at
    ) VALUES (
      _receipt_data.user_id,
      'receipt_comment_added',
      'New Comment Added',
      _commenter_name || ' added a comment' || 
      CASE WHEN _receipt_data.merchant IS NOT NULL 
           THEN ' to the receipt from ' || _receipt_data.merchant
           ELSE ' to your receipt' END ||
      CASE WHEN LENGTH(NEW.comment_text) > 50
           THEN ': "' || LEFT(NEW.comment_text, 50) || '..."'
           ELSE ': "' || NEW.comment_text || '"' END,
      'medium',
      '/receipts/' || NEW.receipt_id,
      'receipt_comment',
      NEW.id,
      jsonb_build_object(
        'commenter_name', _commenter_name,
        'comment_text', NEW.comment_text,
        'merchant', _receipt_data.merchant,
        'receipt_id', NEW.receipt_id
      ),
      NEW.team_id,
      NOW()
    );
  END IF;
  
  -- Create notifications for other team members (if it's a team receipt)
  IF NEW.team_id IS NOT NULL THEN
    FOR _team_members IN 
      SELECT tm.user_id
      FROM public.team_members tm
      WHERE tm.team_id = NEW.team_id 
      AND tm.status = 'active'
      AND tm.user_id != NEW.user_id  -- Don't notify the commenter
      AND tm.user_id != _receipt_data.user_id  -- Don't duplicate notification for receipt owner
    LOOP
      INSERT INTO public.notifications (
        recipient_id,
        type,
        title,
        message,
        priority,
        action_url,
        related_entity_type,
        related_entity_id,
        metadata,
        team_id,
        created_at
      ) VALUES (
        _team_members.user_id,
        'receipt_comment_added',
        'New Team Comment',
        _commenter_name || ' commented on a team receipt' ||
        CASE WHEN _receipt_data.merchant IS NOT NULL 
             THEN ' from ' || _receipt_data.merchant
             ELSE '' END ||
        CASE WHEN LENGTH(NEW.comment_text) > 50
             THEN ': "' || LEFT(NEW.comment_text, 50) || '..."'
             ELSE ': "' || NEW.comment_text || '"' END,
        'medium',
        '/receipts/' || NEW.receipt_id,
        'receipt_comment',
        NEW.id,
        jsonb_build_object(
          'commenter_name', _commenter_name,
          'comment_text', NEW.comment_text,
          'merchant', _receipt_data.merchant,
          'receipt_id', NEW.receipt_id
        ),
        NEW.team_id,
        NOW()
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment notifications
DROP TRIGGER IF EXISTS receipt_comment_notification_trigger ON public.receipt_comments;
CREATE TRIGGER receipt_comment_notification_trigger
  AFTER INSERT ON public.receipt_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_receipt_comment_notification();

-- Function to handle receipt sharing notifications
CREATE OR REPLACE FUNCTION public.handle_receipt_share_notification()
RETURNS TRIGGER AS $function$
DECLARE
  _receipt_data RECORD;
  _sharer_name TEXT;
  _team_members RECORD;
BEGIN
  -- Get receipt and sharer information
  SELECT r.merchant, r.total, r.currency
  INTO _receipt_data
  FROM public.receipts r
  WHERE r.id = NEW.receipt_id;
  
  -- Get sharer name
  SELECT COALESCE(p.first_name || ' ' || p.last_name, u.email, 'Unknown User')
  INTO _sharer_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = NEW.shared_by_user_id;
  
  -- Handle team sharing
  IF NEW.share_type = 'team' AND NEW.shared_with_team_id IS NOT NULL THEN
    FOR _team_members IN 
      SELECT tm.user_id
      FROM public.team_members tm
      WHERE tm.team_id = NEW.shared_with_team_id 
      AND tm.status = 'active'
      AND tm.user_id != NEW.shared_by_user_id  -- Don't notify the sharer
    LOOP
      INSERT INTO public.notifications (
        recipient_id,
        type,
        title,
        message,
        priority,
        action_url,
        related_entity_type,
        related_entity_id,
        metadata,
        team_id,
        created_at
      ) VALUES (
        _team_members.user_id,
        'receipt_shared',
        'Receipt Shared',
        _sharer_name || ' shared a receipt' ||
        CASE WHEN _receipt_data.merchant IS NOT NULL 
             THEN ' from ' || _receipt_data.merchant
             ELSE '' END ||
        ' with your team' ||
        CASE WHEN NEW.message IS NOT NULL AND NEW.message != ''
             THEN ': "' || NEW.message || '"'
             ELSE '' END,
        'medium',
        '/receipts/' || NEW.receipt_id,
        'receipt_share',
        NEW.id,
        jsonb_build_object(
          'sharer_name', _sharer_name,
          'merchant', _receipt_data.merchant,
          'total', _receipt_data.total,
          'currency', _receipt_data.currency,
          'share_message', NEW.message,
          'receipt_id', NEW.receipt_id
        ),
        NEW.shared_with_team_id,
        NOW()
      );
    END LOOP;
  END IF;
  
  -- Handle user sharing
  IF NEW.share_type = 'user' AND NEW.shared_with_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id,
      type,
      title,
      message,
      priority,
      action_url,
      related_entity_type,
      related_entity_id,
      metadata,
      created_at
    ) VALUES (
      NEW.shared_with_user_id,
      'receipt_shared',
      'Receipt Shared',
      _sharer_name || ' shared a receipt' ||
      CASE WHEN _receipt_data.merchant IS NOT NULL 
           THEN ' from ' || _receipt_data.merchant
           ELSE '' END ||
      ' with you' ||
      CASE WHEN NEW.message IS NOT NULL AND NEW.message != ''
           THEN ': "' || NEW.message || '"'
           ELSE '' END,
      'medium',
      '/receipts/' || NEW.receipt_id,
      'receipt_share',
      NEW.id,
      jsonb_build_object(
        'sharer_name', _sharer_name,
        'merchant', _receipt_data.merchant,
        'total', _receipt_data.total,
        'currency', _receipt_data.currency,
        'share_message', NEW.message,
        'receipt_id', NEW.receipt_id
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for share notifications
DROP TRIGGER IF EXISTS receipt_share_notification_trigger ON public.receipt_shares;
CREATE TRIGGER receipt_share_notification_trigger
  AFTER INSERT ON public.receipt_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_receipt_share_notification();

-- Add updated_at trigger for receipt_comments
CREATE OR REPLACE FUNCTION public.update_receipt_comments_updated_at()
RETURNS TRIGGER AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

CREATE TRIGGER update_receipt_comments_updated_at
  BEFORE UPDATE ON public.receipt_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_receipt_comments_updated_at();

-- Add updated_at trigger for receipt_flags
CREATE OR REPLACE FUNCTION public.update_receipt_flags_updated_at()
RETURNS TRIGGER AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

CREATE TRIGGER update_receipt_flags_updated_at
  BEFORE UPDATE ON public.receipt_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_receipt_flags_updated_at();
