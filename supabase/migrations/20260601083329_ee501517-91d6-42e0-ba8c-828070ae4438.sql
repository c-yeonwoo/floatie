-- Replace SELECT policy to also allow answer owner and comment author to see comments on private answers
DROP POLICY IF EXISTS "comments on public answers viewable by everyone" ON public.comments;

CREATE POLICY "comments viewable to public, owner, or self"
ON public.comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.answers a
    WHERE a.id = comments.answer_id
      AND (
        a.visibility = 'public'
        OR a.user_id = auth.uid()
        OR comments.user_id = auth.uid()
      )
  )
);

-- Drop duplicate stricter check constraint; keep the 500-char one
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_body_check;
