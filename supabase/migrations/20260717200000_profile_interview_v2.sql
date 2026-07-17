-- ---------------------------------------------------------------------------
-- Profile interview v2: ideal line, job/smoke facts, chip seed for admin later.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_ideal_line text,
  ADD COLUMN IF NOT EXISTS job_chip text,
  ADD COLUMN IF NOT EXISTS smoke text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_smoke_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_smoke_check
      CHECK (smoke IS NULL OR smoke IN ('안 함', '가끔', '함', '비공개'));
  END IF;
END $$;

-- Clients may edit the new profile fields (column lockdown).
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (
  display_name,
  handle,
  bio,
  avatar_url,
  birth_year,
  region,
  height_cm,
  gender,
  photos,
  intro_answers,
  ai_intro,
  ai_tags,
  ai_ideal_line,
  job_chip,
  smoke,
  onboarded
) ON TABLE public.profiles TO authenticated;

-- Chip catalogue seed (admin UI later; clients ship code fallback).
INSERT INTO public.app_config (key, value)
VALUES (
  'interview_chips_v2',
  '{"job":["직장인","학생","프리랜서","창업","기타"],"smoke":["안 함","가끔","함","비공개"],"weekend":["집에서 충전","나가서 충전","사람 만나며","혼자만의 시간","그때그때 달라요"],"vibes":["잔잔한","유머 있는","진지한","따뜻한","솔직한","여유로운","호기심 많은"],"pace":["천천히 알아가기","자주 연락","주말 위주","즉흥 만남","아직 모르겠어요"]}'
)
ON CONFLICT (key) DO NOTHING;

-- regenerate_intro: also persist ideal line (3rd arg optional via DEFAULT).
DROP FUNCTION IF EXISTS public.regenerate_intro(text, text[]);
CREATE OR REPLACE FUNCTION public.regenerate_intro(
  p_intro text,
  p_tags text[],
  p_ideal_line text DEFAULT NULL
)
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
         ai_ideal_line = COALESCE(p_ideal_line, ai_ideal_line),
         intro_regen_date = v_date,
         intro_regen_count = v_count + 1
   WHERE id = v_uid;

  RETURN v_cap - (v_count + 1);
END $$;

REVOKE ALL ON FUNCTION public.regenerate_intro(text, text[], text) FROM public;
GRANT EXECUTE ON FUNCTION public.regenerate_intro(text, text[], text) TO authenticated;
