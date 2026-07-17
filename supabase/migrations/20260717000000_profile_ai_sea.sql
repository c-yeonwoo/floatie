-- ---------------------------------------------------------------------------
-- Sea redesign — profile model additions
--
-- The redesigned profile is an AI-authored card built from a short interview:
--   * 3 required photos (stored in the existing `answers` bucket, path per user)
--   * a few free-text intro answers (Q&A)
--   * an AI-generated intro paragraph + interest tags
--   * a per-day regenerate limit (2/day) for re-running the AI draft
--
-- All additive columns on `profiles`; existing RLS (owner updates own row,
-- unlocked peers may read) already covers them. Reusing the `answers` storage
-- bucket for photos, so no new bucket here.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photos           text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intro_answers    jsonb   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_intro         text,
  ADD COLUMN IF NOT EXISTS ai_tags          text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intro_regen_date  date,
  ADD COLUMN IF NOT EXISTS intro_regen_count int     NOT NULL DEFAULT 0;

-- at most 3 profile photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_photos_max3'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_photos_max3
      CHECK (array_length(photos, 1) IS NULL OR array_length(photos, 1) <= 3);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- regenerate_intro(p_intro text, p_tags text[])
--
-- Persists a fresh AI draft (intro + tags) under a hard limit of 2 per calendar
-- day. The client generates the draft (via the generate-profile Edge Function)
-- and calls this to save it; the counter is enforced server-side so it can't be
-- bypassed. Returns the number of regenerations still available today.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.regenerate_intro(p_intro text, p_tags text[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_date  date;
  v_count int;
  v_cap   int := 2;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT intro_regen_date, intro_regen_count
    INTO v_date, v_count
    FROM public.profiles
   WHERE id = v_uid
     FOR UPDATE;

  -- new day → reset the counter
  IF v_date IS DISTINCT FROM current_date THEN
    v_date := current_date;
    v_count := 0;
  END IF;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'daily regenerate limit reached';
  END IF;

  UPDATE public.profiles
     SET ai_intro = p_intro,
         ai_tags = COALESCE(p_tags, '{}'),
         intro_regen_date = v_date,
         intro_regen_count = v_count + 1
   WHERE id = v_uid;

  RETURN v_cap - (v_count + 1);
END $$;

REVOKE ALL ON FUNCTION public.regenerate_intro(text, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.regenerate_intro(text, text[]) TO authenticated;
