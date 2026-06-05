
-- 1. answers: split public policy so blocks are enforced for authenticated users
DROP POLICY IF EXISTS "public answers viewable by everyone" ON public.answers;

CREATE POLICY "public answers viewable by anon"
ON public.answers FOR SELECT
TO anon
USING (visibility = 'public');

CREATE POLICY "public answers viewable by authenticated"
ON public.answers FOR SELECT
TO authenticated
USING (visibility = 'public' AND NOT public.is_blocked_by(user_id));

-- 2. likes: enforce block check
DROP POLICY IF EXISTS "likes on public answers viewable by everyone" ON public.likes;

CREATE POLICY "likes on public answers viewable by anon"
ON public.likes FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM public.answers a
  WHERE a.id = likes.answer_id AND a.visibility = 'public'
));

CREATE POLICY "likes on public answers viewable by authenticated"
ON public.likes FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.answers a
  WHERE a.id = likes.answer_id
    AND a.visibility = 'public'
    AND NOT public.is_blocked_by(a.user_id)
));

-- 3. persona_reads: allow owners to delete
CREATE POLICY "users can delete own persona reads"
ON public.persona_reads FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
