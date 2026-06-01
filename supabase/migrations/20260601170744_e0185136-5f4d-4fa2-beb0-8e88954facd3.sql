DROP POLICY IF EXISTS "authenticated users insert own comments" ON public.comments;

CREATE POLICY "authenticated users insert own comments"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.answers a
      WHERE a.id = answer_id
        AND (a.visibility = 'public' OR a.user_id = auth.uid())
    )
  );