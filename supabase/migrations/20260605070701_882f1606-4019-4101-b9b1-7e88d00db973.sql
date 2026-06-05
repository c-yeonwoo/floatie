CREATE TABLE public.persona_similarity_cache (
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  score double precision NOT NULL,
  shared_keywords text[] NOT NULL DEFAULT '{}'::text[],
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CONSTRAINT persona_similarity_cache_order CHECK (user_a < user_b),
  CONSTRAINT persona_similarity_cache_score_range CHECK (score >= 0 AND score <= 1)
);

CREATE INDEX persona_similarity_cache_user_a_idx
  ON public.persona_similarity_cache (user_a, score DESC);
CREATE INDEX persona_similarity_cache_user_b_idx
  ON public.persona_similarity_cache (user_b, score DESC);

GRANT SELECT ON public.persona_similarity_cache TO authenticated;
GRANT ALL ON public.persona_similarity_cache TO service_role;

ALTER TABLE public.persona_similarity_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own similarity pairs"
  ON public.persona_similarity_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
