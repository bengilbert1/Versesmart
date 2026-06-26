-- Drop the permissive insert policy
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;

-- Add validation constraints
ALTER TABLE public.feedback
  DROP CONSTRAINT IF EXISTS feedback_category_check,
  DROP CONSTRAINT IF EXISTS feedback_message_check,
  DROP CONSTRAINT IF EXISTS feedback_email_check,
  DROP CONSTRAINT IF EXISTS feedback_name_check,
  DROP CONSTRAINT IF EXISTS feedback_user_agent_check;

ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_category_check
    CHECK (category IN ('feature', 'feedback', 'contact')),
  ADD CONSTRAINT feedback_message_check
    CHECK (char_length(message) BETWEEN 1 AND 5000),
  ADD CONSTRAINT feedback_email_check
    CHECK (email IS NULL OR (char_length(email) <= 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  ADD CONSTRAINT feedback_name_check
    CHECK (name IS NULL OR char_length(name) <= 100),
  ADD CONSTRAINT feedback_user_agent_check
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 500);

-- Recreate insert policy with validation in WITH CHECK (not just `true`)
CREATE POLICY "Public can submit validated feedback"
ON public.feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (
  category IN ('feature', 'feedback', 'contact')
  AND char_length(message) BETWEEN 1 AND 5000
  AND (email IS NULL OR char_length(email) <= 255)
  AND (name IS NULL OR char_length(name) <= 100)
);