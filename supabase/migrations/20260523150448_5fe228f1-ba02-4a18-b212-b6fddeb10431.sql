CREATE POLICY "Users can view own daily usage"
ON public.daily_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);