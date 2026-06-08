
CREATE TABLE public.stays (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_id BIGINT NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, answer_id)
);

CREATE INDEX stays_answer_id_idx ON public.stays(answer_id);
CREATE INDEX stays_user_id_idx ON public.stays(user_id);

GRANT SELECT, INSERT, DELETE ON public.stays TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.stays_id_seq TO authenticated;
GRANT ALL ON public.stays TO service_role;
GRANT ALL ON SEQUENCE public.stays_id_seq TO service_role;

ALTER TABLE public.stays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stays viewable by authenticated"
  ON public.stays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users insert own stay"
  ON public.stays FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own stay"
  ON public.stays FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 간단한 rate limit: 1분에 60건
CREATE OR REPLACE FUNCTION public.enforce_stays_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM public.stays
    WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute';
  IF c >= 60 THEN
    RAISE EXCEPTION '잠시 후 다시 시도해 주세요.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER stays_rate_limit
BEFORE INSERT ON public.stays
FOR EACH ROW EXECUTE FUNCTION public.enforce_stays_rate_limit();
