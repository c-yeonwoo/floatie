
-- 1) Helper: is current user blocked by target?
CREATE OR REPLACE FUNCTION public.is_blocked_by(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.blocks
    WHERE blocker_id = target_user_id
      AND blocked_id = auth.uid()
  );
$$;

-- 2) Enforce blocks at the database layer
-- answers: keep public-visibility view but exclude blockers
DROP POLICY IF EXISTS "public answers viewable by everyone" ON public.answers;
CREATE POLICY "public answers viewable by everyone"
ON public.answers
FOR SELECT
TO anon, authenticated
USING (
  visibility = 'public'
  AND NOT public.is_blocked_by(user_id)
);

-- profiles: anyone authenticated can see profiles except blockers; owner always sees self
DROP POLICY IF EXISTS "profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "profiles viewable by authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR NOT public.is_blocked_by(id)
);

-- comments: same visibility model, plus exclude blockers
DROP POLICY IF EXISTS "comments viewable to public, owner, or self" ON public.comments;
CREATE POLICY "comments viewable to public, owner, or self"
ON public.comments
FOR SELECT
TO public
USING (
  NOT public.is_blocked_by(comments.user_id)
  AND EXISTS (
    SELECT 1 FROM public.answers a
    WHERE a.id = comments.answer_id
      AND (
        a.visibility = 'public'
        OR a.user_id = auth.uid()
        OR comments.user_id = auth.uid()
      )
  )
);

-- 3) Move "gender" off the public profile into an owner-only settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY,
  gender text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own settings"
ON public.user_settings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users insert own settings"
ON public.user_settings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own settings"
ON public.user_settings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users delete own settings"
ON public.user_settings
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_user_settings_updated ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_user_settings_updated_at();

-- Migrate existing gender values
INSERT INTO public.user_settings (user_id, gender)
SELECT id, gender FROM public.profiles WHERE gender IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET gender = EXCLUDED.gender;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS gender;

-- 4) Tighten avatar storage: only avatars currently referenced by a profile are readable
DROP POLICY IF EXISTS "answer photos readable when owner, public answer, or avatar" ON storage.objects;
CREATE POLICY "answer photos readable when owner, public answer, or avatar"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'answers'
  AND (
    -- owner can always read their own files
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- photos on public answers
    EXISTS (
      SELECT 1 FROM public.answers a
      WHERE a.visibility = 'public'
        AND EXISTS (
          SELECT 1 FROM unnest(a.photos) p(p)
          WHERE p.p LIKE ('%/' || objects.name)
        )
    )
    OR
    -- avatars: only readable by authenticated users AND only when referenced by a current profile
    (
      auth.role() = 'authenticated'
      AND name LIKE '%/avatar-%'
      AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.avatar_url LIKE ('%' || name)
      )
    )
  )
);
