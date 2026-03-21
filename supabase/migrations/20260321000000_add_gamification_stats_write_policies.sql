-- Allow authenticated users to update their own gamification preferences.
-- Without these policies, the client-side upsert in gamificationService.updatePreferences()
-- is silently blocked by RLS, causing the leaderboard opt-in toggle and scanner theme
-- picker to appear non-functional.

DROP POLICY IF EXISTS "Users can update their own gamification stats" ON public.user_gamification_stats;
CREATE POLICY "Users can update their own gamification stats" ON public.user_gamification_stats
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own gamification stats" ON public.user_gamification_stats;
CREATE POLICY "Users can insert their own gamification stats" ON public.user_gamification_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
