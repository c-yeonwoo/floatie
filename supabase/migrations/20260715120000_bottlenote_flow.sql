-- Floatie flow: accept → 12h reply window, trust penalty, in-app notifications, resend

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trust_score int NOT NULL DEFAULT 100
    CHECK (trust_score >= 0 AND trust_score <= 100);

ALTER TABLE public.mission_deliveries
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS resend_of_delivery_id bigint
    REFERENCES public.mission_deliveries(id) ON DELETE SET NULL;

ALTER TABLE public.mission_deliveries
  ALTER COLUMN expires_at DROP NOT NULL,
  ALTER COLUMN expires_at DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- In-app notifications (push later; MVP uses poll + toast)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'mission_arrived',
    'mission_accepted',
    'mission_replied',
    'mission_no_response'
  )),
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS in_app_notifications_user_unread_idx
  ON public.in_app_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own notifications"
  ON public.in_app_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users mark own notifications read"
  ON public.in_app_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Accept mission → start 12h reply timer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_delivery(p_delivery_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.mission_deliveries%ROWTYPE;
  v_body text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_row FROM public.mission_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_row.receiver_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.status <> 'delivered' OR v_row.reply_body IS NOT NULL THEN
    RAISE EXCEPTION 'cannot accept';
  END IF;
  IF v_row.accepted_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.mission_deliveries
  SET accepted_at = now(),
      expires_at = now() + interval '12 hours'
  WHERE id = p_delivery_id;

  SELECT body INTO v_body FROM public.missions WHERE id = v_row.mission_id;

  INSERT INTO public.in_app_notifications(user_id, kind, title, body, payload)
  VALUES (
    v_row.sender_id,
    'mission_accepted',
    '누군가 플로티를 받았어요',
    '12시간 안에 답장이 오면 알려드릴게요.',
    jsonb_build_object('delivery_id', p_delivery_id, 'mission_body', v_body)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_delivery(bigint) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reply (requires accept)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reply_to_delivery(p_delivery_id bigint, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.mission_deliveries%ROWTYPE;
  v_body text := trim(p_body);
  v_mission_body text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF v_body IS NULL OR length(v_body) < 1 OR length(v_body) > 200 THEN
    RAISE EXCEPTION 'invalid reply';
  END IF;

  SELECT * INTO v_row FROM public.mission_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_row.receiver_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.status <> 'delivered' OR v_row.reply_body IS NOT NULL THEN
    RAISE EXCEPTION 'already replied';
  END IF;
  IF v_row.accepted_at IS NULL THEN RAISE EXCEPTION 'accept required'; END IF;
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    RAISE EXCEPTION 'expired';
  END IF;

  UPDATE public.mission_deliveries
  SET reply_body = v_body,
      replied_at = now(),
      status = 'replied'
  WHERE id = p_delivery_id;

  SELECT body INTO v_mission_body FROM public.missions WHERE id = v_row.mission_id;

  INSERT INTO public.in_app_notifications(user_id, kind, title, body, payload)
  VALUES (
    v_row.sender_id,
    'mission_replied',
    '답장이 도착했어요',
    left(v_body, 80),
    jsonb_build_object('delivery_id', p_delivery_id, 'mission_body', v_mission_body)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reply_to_delivery(bigint, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Expire accepted-but-unanswered → trust penalty + sender resend prompt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_deliveries()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n int := 0;
  v_body text;
  v_penalty int := 15;
BEGIN
  FOR r IN
    SELECT d.*
    FROM public.mission_deliveries d
    WHERE d.status = 'delivered'
      AND d.reply_body IS NULL
      AND d.accepted_at IS NOT NULL
      AND d.expires_at IS NOT NULL
      AND d.expires_at < now()
    FOR UPDATE
  LOOP
    UPDATE public.mission_deliveries SET status = 'expired' WHERE id = r.id;

    UPDATE public.profiles
    SET trust_score = GREATEST(0, trust_score - v_penalty)
    WHERE id = r.receiver_id;

    SELECT body INTO v_body FROM public.missions WHERE id = r.mission_id;

    INSERT INTO public.in_app_notifications(user_id, kind, title, body, payload)
    VALUES (
      r.sender_id,
      'mission_no_response',
      '미션에 응하지 않았어요',
      '같은 미션 내용으로 플로티를 다시 보내시겠습니까?',
      jsonb_build_object(
        'delivery_id', r.id,
        'mission_id', r.mission_id,
        'mission_body', v_body,
        'can_resend', true
      )
    );

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

-- ---------------------------------------------------------------------------
-- Resend same mission body after no-response expiry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resend_expired_mission(
  p_delivery_id bigint,
  p_use_ticket boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_old public.mission_deliveries%ROWTYPE;
  v_old_mission public.missions%ROWTYPE;
  v_new_mission_id bigint;
  v_new_delivery_id bigint;
BEGIN
  v_uid := public.assert_user_active_verified();

  SELECT * INTO v_old FROM public.mission_deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_old.sender_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_old.status <> 'expired' OR v_old.reply_body IS NOT NULL THEN
    RAISE EXCEPTION 'cannot resend';
  END IF;

  SELECT * INTO v_old_mission FROM public.missions WHERE id = v_old.mission_id;

  INSERT INTO public.missions (
    sender_id, preset_id, kind, body, chips, filter_kind, filter_value
  )
  VALUES (
    v_uid,
    v_old_mission.preset_id,
    v_old_mission.kind,
    v_old_mission.body,
    v_old_mission.chips,
    v_old_mission.filter_kind,
    v_old_mission.filter_value
  )
  RETURNING id INTO v_new_mission_id;

  v_new_delivery_id := public.deliver_mission(
    v_new_mission_id,
    p_use_ticket,
    v_old_mission.filter_kind,
    v_old_mission.filter_value
  );

  UPDATE public.mission_deliveries
  SET resend_of_delivery_id = p_delivery_id
  WHERE id = v_new_delivery_id;

  UPDATE public.in_app_notifications
  SET read_at = now()
  WHERE user_id = v_uid
    AND kind = 'mission_no_response'
    AND (payload->>'delivery_id')::bigint = p_delivery_id
    AND read_at IS NULL;

  RETURN v_new_delivery_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resend_expired_mission(bigint, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- deliver_mission: no expires_at until accept; notify receiver on arrival
-- ---------------------------------------------------------------------------
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
    ORDER BY COALESCE(p.trust_score, 100) DESC, random()
    LIMIT 1;

    EXIT WHEN v_receiver IS NOT NULL;
  END LOOP;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'no eligible recipient';
  END IF;

  INSERT INTO public.mission_deliveries (mission_id, sender_id, receiver_id, expires_at)
  VALUES (p_mission_id, v_sender, v_receiver, NULL)
  RETURNING id INTO v_delivery_id;

  INSERT INTO public.in_app_notifications(user_id, kind, title, body, payload)
  VALUES (
    v_receiver,
    'mission_arrived',
    '익명 미션이 도착했어요',
    left(v_mission.body, 80),
    jsonb_build_object('delivery_id', v_delivery_id, 'mission_body', v_mission.body)
  );

  RETURN v_delivery_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deliver_mission(bigint, boolean, text, text) TO authenticated;
