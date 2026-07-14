-- Pivot: anonymous mission / note app ("쪽지")
-- Keeps: profiles (extended), blocks, reports patterns
-- Adds: presets, missions, deliveries, pair cooldowns, unlock threads

-- ---------------------------------------------------------------------------
-- Profiles: matching prefs (minimal)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('female', 'male', 'other')),
  ADD COLUMN IF NOT EXISTS birth_year int CHECK (birth_year >= 1920 AND birth_year <= 2010),
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS prefer_gender text CHECK (prefer_gender IN ('female', 'male', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS show_age_hint boolean NOT NULL DEFAULT true;

-- Tighten profile visibility: self + unlocked peers only (drop public browse)
DROP POLICY IF EXISTS "profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Unlocked peers policy added after mission_deliveries exists (below)

-- ---------------------------------------------------------------------------
-- Presets
-- ---------------------------------------------------------------------------
CREATE TABLE public.mission_presets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('question', 'action_text')),
  body text NOT NULL,
  chips text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mission_presets TO anon, authenticated;
GRANT ALL ON public.mission_presets TO service_role;

ALTER TABLE public.mission_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presets viewable when active"
  ON public.mission_presets FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- ---------------------------------------------------------------------------
-- Missions (created by sender)
-- ---------------------------------------------------------------------------
CREATE TABLE public.missions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preset_id bigint REFERENCES public.mission_presets(id),
  kind text NOT NULL CHECK (kind IN ('question', 'action_text')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 80),
  chips text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX missions_sender_created_idx ON public.missions(sender_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sender views own missions"
  ON public.missions FOR SELECT TO authenticated
  USING (auth.uid() = sender_id);

CREATE POLICY "users insert own missions"
  ON public.missions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- Deliveries (1 mission → 1 receiver for MVP)
-- ---------------------------------------------------------------------------
CREATE TABLE public.mission_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_id bigint NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'delivered'
    CHECK (status IN ('delivered', 'replied', 'expired', 'closed')),
  reply_body text CHECK (reply_body IS NULL OR char_length(reply_body) BETWEEN 1 AND 200),
  replied_at timestamptz,
  sender_verdict text NOT NULL DEFAULT 'pending'
    CHECK (sender_verdict IN ('pending', 'ok', 'pass')),
  receiver_verdict text NOT NULL DEFAULT 'pending'
    CHECK (receiver_verdict IN ('pending', 'ok', 'pass')),
  unlocked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> receiver_id)
);

CREATE INDEX mission_deliveries_receiver_status_idx
  ON public.mission_deliveries(receiver_id, status, created_at DESC);
CREATE INDEX mission_deliveries_sender_created_idx
  ON public.mission_deliveries(sender_id, created_at DESC);
CREATE UNIQUE INDEX mission_deliveries_one_per_mission
  ON public.mission_deliveries(mission_id);

GRANT SELECT, INSERT, UPDATE ON public.mission_deliveries TO authenticated;
GRANT ALL ON public.mission_deliveries TO service_role;

ALTER TABLE public.mission_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants view deliveries"
  ON public.mission_deliveries FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "sender insert deliveries"
  ON public.mission_deliveries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "participants update deliveries"
  ON public.mission_deliveries FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "receiver views mission via delivery"
  ON public.missions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mission_deliveries d
      WHERE d.mission_id = missions.id AND d.receiver_id = auth.uid()
    )
  );

CREATE POLICY "users delete own undelivered missions"
  ON public.missions FOR DELETE TO authenticated
  USING (
    auth.uid() = sender_id
    AND NOT EXISTS (
      SELECT 1 FROM public.mission_deliveries d WHERE d.mission_id = missions.id
    )
  );

-- profiles: unlocked peers
CREATE POLICY "users view unlocked peer profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mission_deliveries d
      WHERE d.unlocked_at IS NOT NULL
        AND (
          (d.sender_id = auth.uid() AND d.receiver_id = profiles.id)
          OR (d.receiver_id = auth.uid() AND d.sender_id = profiles.id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Pair cooldown (normalized user_a < user_b)
-- ---------------------------------------------------------------------------
CREATE TABLE public.pair_cooldowns (
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  until_at timestamptz NOT NULL,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

GRANT SELECT ON public.pair_cooldowns TO authenticated;
GRANT ALL ON public.pair_cooldowns TO service_role;

ALTER TABLE public.pair_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own cooldowns"
  ON public.pair_cooldowns FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- ---------------------------------------------------------------------------
-- Chat after unlock
-- ---------------------------------------------------------------------------
CREATE TABLE public.mission_threads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  delivery_id bigint NOT NULL UNIQUE REFERENCES public.mission_deliveries(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mission_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id bigint NOT NULL REFERENCES public.mission_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mission_messages_thread_idx ON public.mission_messages(thread_id, created_at);

GRANT SELECT, INSERT ON public.mission_threads TO authenticated;
GRANT SELECT, INSERT ON public.mission_messages TO authenticated;
GRANT ALL ON public.mission_threads TO service_role;
GRANT ALL ON public.mission_messages TO service_role;

ALTER TABLE public.mission_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants view threads"
  ON public.mission_threads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mission_deliveries d
      WHERE d.id = mission_threads.delivery_id
        AND (d.sender_id = auth.uid() OR d.receiver_id = auth.uid())
        AND d.unlocked_at IS NOT NULL
    )
  );

CREATE POLICY "system insert threads via unlock"
  ON public.mission_threads FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mission_deliveries d
      WHERE d.id = delivery_id
        AND (d.sender_id = auth.uid() OR d.receiver_id = auth.uid())
        AND d.unlocked_at IS NOT NULL
    )
  );

CREATE POLICY "participants view messages"
  ON public.mission_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mission_threads t
      JOIN public.mission_deliveries d ON d.id = t.delivery_id
      WHERE t.id = mission_messages.thread_id
        AND (d.sender_id = auth.uid() OR d.receiver_id = auth.uid())
    )
  );

CREATE POLICY "participants insert messages"
  ON public.mission_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.mission_threads t
      JOIN public.mission_deliveries d ON d.id = t.delivery_id
      WHERE t.id = thread_id
        AND (d.sender_id = auth.uid() OR d.receiver_id = auth.uid())
        AND d.unlocked_at IS NOT NULL
        AND t.expires_at > now()
    )
  );

-- ---------------------------------------------------------------------------
-- Unlock + cooldown trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_try_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a uuid;
  b uuid;
BEGIN
  IF NEW.sender_verdict = 'pass' OR NEW.receiver_verdict = 'pass' THEN
    NEW.status := 'closed';
  END IF;

  IF NEW.sender_verdict = 'ok' AND NEW.receiver_verdict = 'ok' AND OLD.unlocked_at IS NULL THEN
    NEW.unlocked_at := now();
    NEW.status := 'closed';
    INSERT INTO public.mission_threads (delivery_id)
    VALUES (NEW.id)
    ON CONFLICT (delivery_id) DO NOTHING;
  END IF;

  IF (NEW.sender_verdict <> 'pending' AND NEW.receiver_verdict <> 'pending')
     OR NEW.sender_verdict = 'pass'
     OR NEW.receiver_verdict = 'pass' THEN
    a := LEAST(NEW.sender_id, NEW.receiver_id);
    b := GREATEST(NEW.sender_id, NEW.receiver_id);
    INSERT INTO public.pair_cooldowns (user_a, user_b, until_at)
    VALUES (a, b, now() + interval '14 days')
    ON CONFLICT (user_a, user_b)
    DO UPDATE SET until_at = GREATEST(public.pair_cooldowns.until_at, EXCLUDED.until_at);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_try_unlock ON public.mission_deliveries;
CREATE TRIGGER trg_mission_try_unlock
  BEFORE UPDATE OF sender_verdict, receiver_verdict ON public.mission_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.mission_try_unlock();

-- ---------------------------------------------------------------------------
-- Deliver mission: pick weak-fit recipient + insert delivery
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deliver_mission(p_mission_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_mission public.missions%ROWTYPE;
  v_receiver uuid;
  v_delivery_id bigint;
  v_send_count int;
  v_recv_cap int := 8;
  v_send_cap int := 3;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  IF NOT FOUND OR v_mission.sender_id <> v_sender THEN
    RAISE EXCEPTION 'mission not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.mission_deliveries WHERE mission_id = p_mission_id) THEN
    RAISE EXCEPTION 'already delivered';
  END IF;

  SELECT count(*) INTO v_send_count
  FROM public.missions m
  WHERE m.sender_id = v_sender AND m.created_at > date_trunc('day', now());
  IF v_send_count > v_send_cap THEN
    RAISE EXCEPTION 'daily send cap reached';
  END IF;

  SELECT p.id INTO v_receiver
  FROM public.profiles p
  WHERE p.onboarded = true
    AND p.id <> v_sender
    AND p.gender IS NOT NULL
    AND p.birth_year IS NOT NULL
    -- gender preference (sender wants to reach prefer_gender; receiver's prefer must allow sender)
    AND (
      COALESCE((SELECT prefer_gender FROM public.profiles WHERE id = v_sender), 'any') = 'any'
      OR p.gender = (SELECT prefer_gender FROM public.profiles WHERE id = v_sender)
      OR p.gender = 'other'
    )
    AND (
      COALESCE(p.prefer_gender, 'any') = 'any'
      OR p.prefer_gender = (SELECT gender FROM public.profiles WHERE id = v_sender)
      OR (SELECT gender FROM public.profiles WHERE id = v_sender) = 'other'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_sender AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = v_sender)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pair_cooldowns c
      WHERE c.until_at > now()
        AND c.user_a = LEAST(v_sender, p.id)
        AND c.user_b = GREATEST(v_sender, p.id)
    )
    AND (
      SELECT count(*) FROM public.mission_deliveries d
      WHERE d.receiver_id = p.id AND d.created_at > date_trunc('day', now())
    ) < v_recv_cap
  ORDER BY
    CASE
      WHEN p.region IS NOT NULL AND p.region = (SELECT region FROM public.profiles WHERE id = v_sender)
      THEN 0 ELSE 1
    END,
    abs(p.birth_year - (SELECT birth_year FROM public.profiles WHERE id = v_sender)),
    random()
  LIMIT 1;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'no eligible recipient';
  END IF;

  INSERT INTO public.mission_deliveries (mission_id, sender_id, receiver_id)
  VALUES (p_mission_id, v_sender, v_receiver)
  RETURNING id INTO v_delivery_id;

  RETURN v_delivery_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deliver_mission(bigint) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed presets (sample set; expand to 80 later)
-- ---------------------------------------------------------------------------
INSERT INTO public.mission_presets (kind, body, chips, tags, sort_order) VALUES
  ('question', '오늘 기분, 한 단어로?', ARRAY['맑음','흐림','번개','무해'], ARRAY['mood'], 10),
  ('question', '지금 제일 땡기는 음료는?', ARRAY['커피','탄산','차','물'], ARRAY['food'], 20),
  ('question', '요즘 빠져 있는 노래 장르는?', ARRAY['힙합','인디','케이팝','잔잔'], ARRAY['taste'], 30),
  ('question', '주말에 더 끌리는 쪽은?', ARRAY['집콕','바깥','친구','혼자'], ARRAY['daily'], 40),
  ('question', '비 오는 날이면?', ARRAY['잠','영화','산책','요리'], ARRAY['mood'], 50),
  ('question', '운동, 있으면 뭐가 제일 괜찮아요?', ARRAY['걷기','헬스','구기','안 함'], ARRAY['hobby'], 60),
  ('question', '카페에서 기본 주문은?', ARRAY['아아','뜨아','라떼','디카페인'], ARRAY['food'], 70),
  ('question', '오늘 하늘 점수 (1~5)?', ARRAY['1','2','3','4','5'], ARRAY['daily'], 80),
  ('question', '여행이면 바다 vs 산?', ARRAY['바다','산','도심','온천'], ARRAY['taste'], 90),
  ('question', '오늘 칭찬하고 싶은 나 자신은?', ARRAY[]::text[], ARRAY['comfort'], 100),
  ('action_text', '오늘 물 한 잔 마시기! 마셨으면 한 줄', ARRAY[]::text[], ARRAY['daily'], 110),
  ('action_text', '창밖을 30초 보기. 뭘 봤나요?', ARRAY[]::text[], ARRAY['daily'], 120),
  ('action_text', '오늘 점심, 메뉴 이름만 인증', ARRAY[]::text[], ARRAY['food'], 130),
  ('action_text', '스트레칭 3번. 끝난 소감 한 단어', ARRAY[]::text[], ARRAY['hobby'], 140),
  ('action_text', '감사한 일 하나 적기', ARRAY[]::text[], ARRAY['comfort'], 150),
  ('action_text', '안 읽던 앨범 30초 들어보기', ARRAY[]::text[], ARRAY['taste'], 160),
  ('action_text', '책상/침대 주변 물건 하나 정리', ARRAY[]::text[], ARRAY['tiny_dare'], 170),
  ('action_text', '내일의 나에게 메모 한 줄', ARRAY[]::text[], ARRAY['comfort'], 180),
  ('action_text', '오늘의 날씨를 음식으로 비유하면?', ARRAY[]::text[], ARRAY['mood'], 190),
  ('action_text', '알림 끄고 5분. 뭐 했나요?', ARRAY[]::text[], ARRAY['daily'], 200);
