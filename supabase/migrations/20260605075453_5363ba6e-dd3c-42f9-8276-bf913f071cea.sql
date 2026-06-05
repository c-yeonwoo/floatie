
DROP POLICY IF EXISTS "follows viewable by participants" ON public.follows;

CREATE POLICY "follows viewable by authenticated"
ON public.follows
FOR SELECT
TO authenticated
USING (true);
