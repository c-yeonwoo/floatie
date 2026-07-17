-- ---------------------------------------------------------------------------
-- Product decisions 2026-07-17 (PO):
--  * Chat: unlimited messages, 7-day window only (extend-with-ticket later)
--  * Post-accept forfeit / 12h no-reply: 24h receive ban (not trust_score)
--  * Beta ticket stash: 10 (open launch will use 2 — see app_config)
-- ---------------------------------------------------------------------------

-- 1) Unlimited messages: NULL message_cap = no cap
ALTER TABLE public.mission_threads
  ALTER COLUMN message_cap DROP NOT NULL,
  ALTER COLUMN message_cap SET DEFAULT NULL;

UPDATE public.mission_threads SET message_cap = NULL;

-- 2) Receive cooldown column (forfeit / unanswered after accept)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS receive_blocked_until timestamptz;

ALTER TABLE public.profiles
  ALTER COLUMN ticket_balance SET DEFAULT 10;

-- Beta top-up to 10 (does not reduce anyone already above 10)
UPDATE public.profiles
SET ticket_balance = 10
WHERE ticket_balance < 10;

-- app_config: beta vs open signup grant (ops can flip without redeploy)
INSERT INTO public.app_config (key, value)
VALUES
  ('ticket_grant_beta', '10'),
  ('ticket_grant_open', '2'),
  ('ticket_grant_mode', 'beta')  -- 'beta' | 'open'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3) send_mission_message: drop message-count close; keep 7d + block + ban checks
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
  v_msg_id bigint;
  v_body text := trim(p_body);
  v_other uuid;
BEGIN
  v_uid := public.assert_user_active_verified();
  IF v_body IS NULL OR length(v_body) < 1 OR length(v_body) > 500 THEN
    RAISE EXCEPTION 'invalid message';
  END IF;

  SELECT * INTO v_thread FROM public.mission_threads WHERE id = p_thread_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'thread not found'; END IF;
  IF v_thread.closed_at IS NOT NULL OR v_thread.expires_at < now() THEN
    RAISE EXCEPTION 'thread closed';
  END IF;

  SELECT * INTO v_delivery FROM public.mission_deliveries WHERE id = v_thread.delivery_id;
  IF v_delivery.sender_id <> v_uid AND v_delivery.receiver_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_delivery.unlocked_at IS NULL THEN RAISE EXCEPTION 'not unlocked'; END IF;

  v_other := CASE WHEN v_uid = v_delivery.sender_id THEN v_delivery.receiver_id
                  ELSE v_delivery.sender_id END;

  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = v_uid AND b.blocked_id = v_other)
       OR (b.blocker_id = v_other AND b.blocked_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- message_cap NULL or <= 0 → unlimited (time window only)
  IF v_thread.message_cap IS NOT NULL AND v_thread.message_cap > 0 THEN
    IF (SELECT count(*) FROM public.mission_messages WHERE thread_id = p_thread_id)
         >= v_thread.message_cap THEN
      UPDATE public.mission_threads SET closed_at = now()
        WHERE id = p_thread_id AND closed_at IS NULL;
      RAISE EXCEPTION 'message cap reached';
    END IF;
  END IF;

  INSERT INTO public.mission_messages (thread_id, sender_id, body)
  VALUES (p_thread_id, v_uid, v_body)
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_mission_message(bigint, text) TO authenticated;

-- 4) Helper: apply 24h receive ban (no trust change)
CREATE OR REPLACE FUNCTION public._apply_receive_ban(p_user uuid, p_hours int DEFAULT 24)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET receive_blocked_until = GREATEST(
        coalesce(receive_blocked_until, now()),
        now() + make_interval(hours => p_hours)
      )
  WHERE id = p_user;
END;
$$;

-- 5) forfeit: expire + 24h receive ban (no trust penalty)
CREATE OR REPLACE FUNCTION public.forfeit_delivery(p_delivery_id bigint)
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
    RAISE EXCEPTION 'cannot forfeit';
  END IF;
  IF v_row.accepted_at IS NULL THEN
    RAISE EXCEPTION 'not accepted';
  END IF;

  UPDATE public.mission_deliveries SET status = 'expired' WHERE id = p_delivery_id;
  PERFORM public._apply_receive_ban(v_uid, 24);

  SELECT body INTO v_body FROM public.missions WHERE id = v_row.mission_id;

  INSERT INTO public.in_app_notifications(user_id, kind, title, body, payload)
  VALUES (
    v_row.sender_id,
    'mission_no_response',
    '미션에 응하지 않았어요',
    '같은 미션 내용으로 플로티를 다시 보내시겠습니까?',
    jsonb_build_object(
      'delivery_id', p_delivery_id,
      'mission_id', v_row.mission_id,
      'mission_body', v_body,
      'can_resend', true
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.forfeit_delivery(bigint) TO authenticated;

-- 6) expire_stale: accepted path → receive ban; unaccepted path unchanged
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
  v_unaccepted_window interval := interval '48 hours';
BEGIN
  -- (1) Accepted but unanswered past 12h: expire + 24h receive ban (no trust)
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
    PERFORM public._apply_receive_ban(r.receiver_id, 24);

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

  -- (2) Never accepted within 48h: expire, no receive ban
  FOR r IN
    SELECT d.*
    FROM public.mission_deliveries d
    WHERE d.status = 'delivered'
      AND d.reply_body IS NULL
      AND d.accepted_at IS NULL
      AND d.created_at < now() - v_unaccepted_window
    FOR UPDATE
  LOOP
    UPDATE public.mission_deliveries SET status = 'expired' WHERE id = r.id;

    SELECT body INTO v_body FROM public.missions WHERE id = r.mission_id;

    INSERT INTO public.in_app_notifications(user_id, kind, title, body, payload)
    VALUES (
      r.sender_id,
      'mission_no_response',
      '아직 아무도 받지 않았어요',
      '다른 사람에게 다시 보낼 수 있어요.',
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

-- 7) deliver_mission: skip men under receive_blocked_until
--    Re-apply latest body from reports_ban + sea filters + receive ban.
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

  -- Ideal filters retired from product; ignore client filter args (no-op storage)
  IF p_filter_kind IS NOT NULL THEN
    NULL; -- intentionally ignored
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
      AND (p.receive_blocked_until IS NULL OR p.receive_blocked_until <= now())
      AND (
        v_window IS NULL
        OR (p.last_active_at IS NOT NULL AND p.last_active_at >= now() - v_window)
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
    '플로티가 도착했어요',
    left(v_mission.body, 80),
    jsonb_build_object('delivery_id', v_delivery_id, 'mission_body', v_mission.body)
  );

  RETURN v_delivery_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deliver_mission(bigint, boolean, text, text) TO authenticated;
