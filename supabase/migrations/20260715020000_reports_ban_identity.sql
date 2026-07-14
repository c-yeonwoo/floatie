-- Reports review queue, permanent ban, phone identity verification

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Profiles: ban + identity
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'banned')),
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_e164_unique
  ON public.profiles(phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles(status);

-- ---------------------------------------------------------------------------
-- Reports: mission targets + review status
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('answer', 'comment', 'user', 'delivery', 'message'));

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS target_delivery_id bigint REFERENCES public.mission_deliveries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_message_id bigint REFERENCES public.mission_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed_ok', 'banned', 'dismissed')),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS admin_note text;

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_user_idx ON public.reports(target_user_id);

-- Admins can list all pending reports
CREATE POLICY "admins view all reports"
  ON public.reports FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "admins update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- Phone OTP challenges
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.phone_otp_challenges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_otp_user_idx
  ON public.phone_otp_challenges(user_id, created_at DESC);

ALTER TABLE public.phone_otp_challenges ENABLE ROW LEVEL SECURITY;
-- no direct client access; RPC only
GRANT ALL ON public.phone_otp_challenges TO service_role;

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO public.app_config(key, value)
VALUES ('dev_otp_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read app_config"
  ON public.app_config FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;

CREATE OR REPLACE FUNCTION public._normalize_kr_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  IF d ~ '^010\d{8}$' THEN
    RETURN '+82' || substr(d, 2);
  END IF;
  IF d ~ '^8210\d{8}$' THEN
    RETURN '+' || d;
  END IF;
  IF p_phone ~ '^\+8210\d{8}$' THEN
    RETURN p_phone;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_phone_otp(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_code text;
  v_dev boolean;
  v_recent int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND status = 'banned') THEN
    RAISE EXCEPTION 'account banned';
  END IF;

  v_phone := public._normalize_kr_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'invalid phone';
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE phone_e164 = v_phone AND id <> v_uid AND phone_verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'phone already used';
  END IF;

  SELECT count(*) INTO v_recent
  FROM phone_otp_challenges
  WHERE user_id = v_uid AND created_at > now() - interval '10 minutes';
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'otp rate limit';
  END IF;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  INSERT INTO phone_otp_challenges(user_id, phone_e164, code_hash, expires_at)
  VALUES (
    v_uid,
    v_phone,
    encode(digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex'),
    now() + interval '5 minutes'
  );

  SELECT value = 'true' INTO v_dev FROM app_config WHERE key = 'dev_otp_enabled';

  -- Production: wire SMS provider (NCP SENS / Twilio) from Edge Function.
  -- While dev_otp_enabled, return code to client for TestFlight/internal QA.
  IF coalesce(v_dev, false) THEN
    RETURN jsonb_build_object('ok', true, 'dev_code', v_code, 'phone', v_phone);
  END IF;

  RETURN jsonb_build_object('ok', true, 'phone', v_phone);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_phone_otp(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_phone_otp(p_phone text, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_row phone_otp_challenges%ROWTYPE;
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_phone := public._normalize_kr_phone(p_phone);
  IF v_phone IS NULL THEN RAISE EXCEPTION 'invalid phone'; END IF;
  IF p_code IS NULL OR length(trim(p_code)) <> 6 THEN RAISE EXCEPTION 'invalid code'; END IF;

  SELECT * INTO v_row
  FROM phone_otp_challenges
  WHERE user_id = v_uid
    AND phone_e164 = v_phone
    AND consumed_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'otp expired'; END IF;
  IF v_row.attempts >= 5 THEN RAISE EXCEPTION 'otp locked'; END IF;

  v_hash := encode(digest(convert_to(trim(p_code), 'UTF8'), 'sha256'), 'hex');
  IF v_hash <> v_row.code_hash THEN
    UPDATE phone_otp_challenges SET attempts = attempts + 1 WHERE id = v_row.id;
    RAISE EXCEPTION 'otp mismatch';
  END IF;

  UPDATE phone_otp_challenges SET consumed_at = now() WHERE id = v_row.id;

  UPDATE profiles
  SET
    phone_e164 = v_phone,
    phone_verified_at = now(),
    identity_verified_at = now()
  WHERE id = v_uid AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_phone_otp(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin: dismiss / ban from report
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_report(
  p_report_id bigint,
  p_action text, -- 'dismiss' | 'ban'
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_report reports%ROWTYPE;
  v_target uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND is_admin = true) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_action NOT IN ('dismiss', 'ban') THEN RAISE EXCEPTION 'invalid action'; END IF;

  SELECT * INTO v_report FROM reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;
  IF v_report.status <> 'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;

  v_target := v_report.target_user_id;
  IF v_target IS NULL AND v_report.target_delivery_id IS NOT NULL THEN
    SELECT CASE
      WHEN sender_id = v_report.reporter_id THEN receiver_id
      ELSE sender_id
    END INTO v_target
    FROM mission_deliveries WHERE id = v_report.target_delivery_id;
  END IF;

  IF p_action = 'dismiss' THEN
    UPDATE reports
    SET status = 'dismissed',
        reviewed_at = now(),
        reviewed_by = v_uid,
        admin_note = p_note
    WHERE id = p_report_id;
    RETURN;
  END IF;

  -- ban
  IF v_target IS NULL THEN RAISE EXCEPTION 'no target user'; END IF;
  IF v_target = v_uid THEN RAISE EXCEPTION 'cannot ban self'; END IF;

  UPDATE profiles
  SET status = 'banned',
      banned_at = now(),
      ban_reason = coalesce(p_note, v_report.reason),
      onboarded = false
  WHERE id = v_target;

  UPDATE reports
  SET status = 'banned',
      reviewed_at = now(),
      reviewed_by = v_uid,
      admin_note = p_note,
      target_user_id = coalesce(target_user_id, v_target)
  WHERE id = p_report_id;

  -- close open deliveries involving banned user
  UPDATE mission_deliveries
  SET status = 'closed'
  WHERE status IN ('delivered', 'replied')
    AND (sender_id = v_target OR receiver_id = v_target);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_report(bigint, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Harden deliver_mission: require identity + not banned
-- (recreate by replacing body — keep signature)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_user_active_verified()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_verified timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT status, identity_verified_at INTO v_status, v_verified
  FROM profiles WHERE id = v_uid;
  IF v_status = 'banned' THEN RAISE EXCEPTION 'account banned'; END IF;
  IF v_verified IS NULL THEN RAISE EXCEPTION 'identity required'; END IF;
  RETURN v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_user_active_verified() TO authenticated;

CREATE OR REPLACE FUNCTION public.deliver_mission(
  p_mission_id bigint,
  p_use_ticket boolean DEFAULT false,
  p_filter_kind text DEFAULT NULL,
  p_filter_value text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sender uuid;
  v_sender_gender text;
  v_mission public.missions%ROWTYPE;
  v_receiver uuid;
  v_delivery_id bigint;
  v_send_count int;
  v_recv_cap int := 8;
  v_send_free_cap int := 1;
  v_tickets int;
  v_window interval;
  v_windows interval[] := ARRAY[
    interval '48 hours',
    interval '7 days',
    interval '30 days',
    NULL
  ];
  v_i int;
  v_age_min int;
  v_age_max int;
  v_height_min int;
  v_height_max int;
  v_year_now int := EXTRACT(YEAR FROM now())::int;
BEGIN
  v_sender := public.assert_user_active_verified();

  SELECT gender, ticket_balance INTO v_sender_gender, v_tickets
  FROM public.profiles WHERE id = v_sender;

  IF v_sender_gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'only female can send';
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  IF NOT FOUND OR v_mission.sender_id <> v_sender THEN
    RAISE EXCEPTION 'mission not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.mission_deliveries WHERE mission_id = p_mission_id) THEN
    RAISE EXCEPTION 'already delivered';
  END IF;

  IF p_filter_kind IS NOT NULL THEN
    IF p_filter_kind NOT IN ('age_band', 'region', 'height') THEN
      RAISE EXCEPTION 'invalid filter';
    END IF;
    IF p_filter_value IS NULL OR length(trim(p_filter_value)) = 0 THEN
      RAISE EXCEPTION 'invalid filter';
    END IF;
    UPDATE public.missions
    SET filter_kind = p_filter_kind, filter_value = trim(p_filter_value)
    WHERE id = p_mission_id;
    v_mission.filter_kind := p_filter_kind;
    v_mission.filter_value := trim(p_filter_value);
  END IF;

  SELECT count(*) INTO v_send_count
  FROM public.missions m
  WHERE m.sender_id = v_sender AND m.created_at > date_trunc('day', now());

  IF v_send_count > v_send_free_cap THEN
    IF NOT COALESCE(p_use_ticket, false) THEN
      RAISE EXCEPTION 'ticket required';
    END IF;
    IF COALESCE(v_tickets, 0) < 1 THEN
      RAISE EXCEPTION 'ticket required';
    END IF;
    UPDATE public.profiles
    SET ticket_balance = ticket_balance - 1
    WHERE id = v_sender AND ticket_balance >= 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ticket required';
    END IF;
  END IF;

  IF v_mission.filter_kind = 'height' AND v_mission.filter_value IS NOT NULL THEN
    v_height_min := split_part(v_mission.filter_value, '-', 1)::int;
    v_height_max := split_part(v_mission.filter_value, '-', 2)::int;
  END IF;

  IF v_mission.filter_kind = 'age_band' AND v_mission.filter_value IS NOT NULL THEN
    v_age_min := split_part(v_mission.filter_value, '-', 1)::int;
    v_age_max := split_part(v_mission.filter_value, '-', 2)::int;
  END IF;

  FOR v_i IN 1..4 LOOP
    v_window := v_windows[v_i];

    SELECT p.id INTO v_receiver
    FROM public.profiles p
    WHERE p.onboarded = true
      AND p.status = 'active'
      AND p.identity_verified_at IS NOT NULL
      AND p.id <> v_sender
      AND p.gender = 'male'
      AND p.birth_year IS NOT NULL
      AND (
        v_window IS NULL
        OR (p.last_active_at IS NOT NULL AND p.last_active_at >= now() - v_window)
      )
      AND (
        v_mission.filter_kind IS NULL
        OR (
          v_mission.filter_kind = 'region'
          AND p.region IS NOT NULL
          AND p.region = v_mission.filter_value
        )
        OR (
          v_mission.filter_kind = 'age_band'
          AND (v_year_now - p.birth_year) BETWEEN v_age_min AND v_age_max
        )
        OR (
          v_mission.filter_kind = 'height'
          AND p.height_cm IS NOT NULL
          AND p.height_cm BETWEEN v_height_min AND v_height_max
        )
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
    ORDER BY random()
    LIMIT 1;

    EXIT WHEN v_receiver IS NOT NULL;
  END LOOP;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'no eligible recipient';
  END IF;

  INSERT INTO public.mission_deliveries (mission_id, sender_id, receiver_id)
  VALUES (p_mission_id, v_sender, v_receiver)
  RETURNING id INTO v_delivery_id;

  RETURN v_delivery_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deliver_mission(bigint, boolean, text, text) TO authenticated;

-- Patch send_mission_message identity/ban check
CREATE OR REPLACE FUNCTION public.send_mission_message(
  p_thread_id bigint,
  p_body text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_thread public.mission_threads%ROWTYPE;
  v_delivery public.mission_deliveries%ROWTYPE;
  v_count int;
  v_msg_id bigint;
  v_body text := trim(p_body);
BEGIN
  v_uid := public.assert_user_active_verified();
  IF v_body IS NULL OR length(v_body) < 1 OR length(v_body) > 500 THEN
    RAISE EXCEPTION 'invalid message';
  END IF;

  SELECT * INTO v_thread FROM public.mission_threads WHERE id = p_thread_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'thread not found'; END IF;
  IF v_thread.closed_at IS NOT NULL OR v_thread.expires_at < now() THEN
    RAISE EXCEPTION 'thread closed';
  END IF;

  SELECT * INTO v_delivery FROM public.mission_deliveries WHERE id = v_thread.delivery_id;
  IF v_delivery.sender_id <> v_uid AND v_delivery.receiver_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_delivery.unlocked_at IS NULL THEN RAISE EXCEPTION 'not unlocked'; END IF;

  SELECT count(*) INTO v_count FROM public.mission_messages WHERE thread_id = p_thread_id;
  IF v_count >= COALESCE(v_thread.message_cap, 20) THEN
    UPDATE public.mission_threads SET closed_at = now() WHERE id = p_thread_id AND closed_at IS NULL;
    RAISE EXCEPTION 'message cap reached';
  END IF;

  INSERT INTO public.mission_messages (thread_id, sender_id, body)
  VALUES (p_thread_id, v_uid, v_body)
  RETURNING id INTO v_msg_id;

  SELECT count(*) INTO v_count FROM public.mission_messages WHERE thread_id = p_thread_id;
  IF v_count >= COALESCE(v_thread.message_cap, 20) THEN
    UPDATE public.mission_threads SET closed_at = now() WHERE id = p_thread_id;
  END IF;

  RETURN v_msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_mission_message(bigint, text) TO authenticated;

