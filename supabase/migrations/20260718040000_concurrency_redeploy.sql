-- ---------------------------------------------------------------------------
-- Concurrency slots + pass auto-redeploy + mission-level 48h recall
-- ADR: docs/decisions/0010-concurrency-and-redeploy.md
-- ---------------------------------------------------------------------------

-- ---- schema ----
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS redeploy_count int NOT NULL DEFAULT 0
    CHECK (redeploy_count >= 0);

DROP INDEX IF EXISTS public.mission_deliveries_one_per_mission;
CREATE UNIQUE INDEX IF NOT EXISTS mission_deliveries_one_active_per_mission
  ON public.mission_deliveries (mission_id)
  WHERE status IN ('delivered', 'replied');

ALTER TABLE public.in_app_notifications DROP CONSTRAINT IF EXISTS in_app_notifications_kind_check;
ALTER TABLE public.in_app_notifications
  ADD CONSTRAINT in_app_notifications_kind_check
  CHECK (kind IN (
    'mission_arrived',
    'mission_accepted',
    'mission_replied',
    'mission_no_response',
    'mission_redeployed',
    'profile_opened',
    'matched'
  ));

-- ---- helpers ----
CREATE OR REPLACE FUNCTION public._user_has_active_chat(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mission_threads t
    JOIN public.mission_deliveries d ON d.id = t.delivery_id
    WHERE t.closed_at IS NULL
      AND t.expires_at > now()
      AND (d.sender_id = p_uid OR d.receiver_id = p_uid)
  );
$$;

CREATE OR REPLACE FUNCTION public._male_is_busy(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public._user_has_active_chat(p_uid)
    OR EXISTS (
      SELECT 1
      FROM public.mission_deliveries d
      WHERE d.receiver_id = p_uid
        AND d.status IN ('delivered', 'replied')
    );
$$;

CREATE OR REPLACE FUNCTION public.has_active_chat()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public._user_has_active_chat(auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.has_active_chat() FROM public;
GRANT EXECUTE ON FUNCTION public.has_active_chat() TO authenticated;

CREATE OR REPLACE FUNCTION public._notify_rewrite(
  p_sender uuid,
  p_delivery_id bigint,
  p_mission_id bigint,
  p_body text,
  p_title text DEFAULT '플로티를 다시 써볼까요?',
  p_msg text DEFAULT '아직 받지 않았어요. 질문을 다듬어 다시 띄워보세요.'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.in_app_notifications (user_id, kind, title, body, payload)
  VALUES (
    p_sender,
    'mission_no_response',
    p_title,
    p_msg,
    jsonb_build_object(
      'delivery_id', p_delivery_id,
      'mission_id', p_mission_id,
      'mission_body', p_body,
      'can_resend', true,
      'can_rewrite', true
    )
  );
END;
$$;

-- Pick one eligible male. p_mission_id excludes prior receivers of that mission.
CREATE OR REPLACE FUNCTION public._pick_male_receiver(
  p_sender uuid,
  p_mission_id bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_receiver uuid;
  v_recv_cap int := 8;
  v_window interval;
  v_windows interval[] := ARRAY[
    interval '48 hours',
    interval '7 days',
    interval '30 days',
    NULL
  ];
  v_i int;
BEGIN
  FOR v_i IN 1..4 LOOP
    v_window := v_windows[v_i];

    SELECT p.id INTO v_receiver
    FROM public.profiles p
    WHERE p.onboarded = true
      AND p.status = 'active'
      AND p.identity_verified_at IS NOT NULL
      AND p.id <> p_sender
      AND p.gender = 'male'
      AND p.birth_year IS NOT NULL
      AND (p.receive_blocked_until IS NULL OR p.receive_blocked_until <= now())
      AND (
        v_window IS NULL
        OR (p.last_active_at IS NOT NULL AND p.last_active_at >= now() - v_window)
      )
      AND NOT public._male_is_busy(p.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = p_sender AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = p_sender)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.pair_cooldowns c
        WHERE c.until_at > now()
          AND c.user_a = LEAST(p_sender, p.id)
          AND c.user_b = GREATEST(p_sender, p.id)
      )
      AND (
        p_mission_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.mission_deliveries d
          WHERE d.mission_id = p_mission_id AND d.receiver_id = p.id
        )
      )
      AND (
        SELECT count(*) FROM public.mission_deliveries d
        WHERE d.receiver_id = p.id AND d.created_at > date_trunc('day', now())
      ) < v_recv_cap
    ORDER BY COALESCE(p.trust_score, 100) DESC, random()
    LIMIT 1;

    EXIT WHEN v_receiver IS NOT NULL;
  END LOOP;

  RETURN v_receiver;
END;
$$;

-- ---- deliver_mission (billing + optional redeploy) ----
DROP FUNCTION IF EXISTS public.deliver_mission(bigint, boolean, text, text);

CREATE OR REPLACE FUNCTION public.deliver_mission(
  p_mission_id bigint,
  p_use_ticket boolean DEFAULT false,
  p_filter_kind text DEFAULT NULL,
  p_filter_value text DEFAULT NULL,
  p_redeploy boolean DEFAULT false
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
  v_send_free_cap int := 1;
  v_tickets int;
BEGIN
  v_sender := public.assert_user_active_verified();

  SELECT gender, ticket_balance INTO v_sender_gender, v_tickets
  FROM public.profiles WHERE id = v_sender;

  IF v_sender_gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'only female can send';
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF NOT FOUND OR v_mission.sender_id <> v_sender THEN
    RAISE EXCEPTION 'mission not found';
  END IF;

  IF p_filter_kind IS NOT NULL THEN
    NULL; -- ideal filters retired
  END IF;

  IF p_redeploy THEN
    IF EXISTS (
      SELECT 1 FROM public.mission_deliveries
      WHERE mission_id = p_mission_id AND status IN ('delivered', 'replied')
    ) THEN
      RAISE EXCEPTION 'active delivery exists';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.mission_deliveries WHERE mission_id = p_mission_id
    ) THEN
      RAISE EXCEPTION 'already delivered';
    END IF;

    IF public._user_has_active_chat(v_sender) THEN
      RAISE EXCEPTION 'chat_active_no_new_floatie';
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
  END IF;

  v_receiver := public._pick_male_receiver(v_sender, p_mission_id);
  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'no eligible recipient';
  END IF;

  INSERT INTO public.mission_deliveries (mission_id, sender_id, receiver_id, expires_at)
  VALUES (p_mission_id, v_sender, v_receiver, NULL)
  RETURNING id INTO v_delivery_id;

  INSERT INTO public.in_app_notifications (user_id, kind, title, body, payload)
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

REVOKE ALL ON FUNCTION public.deliver_mission(bigint, boolean, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.deliver_mission(bigint, boolean, text, text, boolean) TO authenticated;

-- ---- decline → pass + auto redeploy ----
CREATE OR REPLACE FUNCTION public.decline_delivery(p_delivery_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.mission_deliveries%ROWTYPE;
  v_mission public.missions%ROWTYPE;
  v_receiver uuid;
  v_new_id bigint;
  v_max_redeploy int := 5;
  v_unaccepted interval := interval '48 hours';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_row FROM public.mission_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_row.receiver_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.accepted_at IS NOT NULL OR v_row.reply_body IS NOT NULL THEN
    RAISE EXCEPTION 'already opened';
  END IF;
  IF v_row.status NOT IN ('delivered') THEN
    RAISE EXCEPTION 'cannot decline';
  END IF;
  IF v_row.receiver_verdict <> 'pending' THEN
    RAISE EXCEPTION 'verdict already set';
  END IF;

  UPDATE public.mission_deliveries
  SET receiver_verdict = 'pass'
  WHERE id = p_delivery_id;

  SELECT * INTO v_mission FROM public.missions WHERE id = v_row.mission_id FOR UPDATE;

  -- Mission wall clock or hop cap → rewrite prompt, no redeploy
  IF v_mission.created_at < now() - v_unaccepted
     OR v_mission.redeploy_count >= v_max_redeploy THEN
    PERFORM public._notify_rewrite(
      v_row.sender_id,
      p_delivery_id,
      v_mission.id,
      v_mission.body,
      '플로티를 다시 써볼까요?',
      '여러 사람에게 닿아도 열리지 않았어요. 질문을 다듬어 다시 띄워보세요.'
    );
    RETURN;
  END IF;

  UPDATE public.missions
  SET redeploy_count = redeploy_count + 1
  WHERE id = v_mission.id;

  -- Hop insert as definer (declining man is not the sender)
  v_receiver := public._pick_male_receiver(v_row.sender_id, v_mission.id);
  IF v_receiver IS NULL THEN
    PERFORM public._notify_rewrite(
      v_row.sender_id,
      p_delivery_id,
      v_mission.id,
      v_mission.body,
      '받을 사람이 없어요',
      '지금은 풀이 비었어요. 질문을 다듬어 나중에 다시 띄워보세요.'
    );
    RETURN;
  END IF;

  INSERT INTO public.mission_deliveries (mission_id, sender_id, receiver_id, expires_at)
  VALUES (v_mission.id, v_row.sender_id, v_receiver, NULL)
  RETURNING id INTO v_new_id;

  INSERT INTO public.in_app_notifications (user_id, kind, title, body, payload)
  VALUES (
    v_receiver,
    'mission_arrived',
    '플로티가 도착했어요',
    left(v_mission.body, 80),
    jsonb_build_object('delivery_id', v_new_id, 'mission_body', v_mission.body)
  );

  INSERT INTO public.in_app_notifications (user_id, kind, title, body, payload)
  VALUES (
    v_row.sender_id,
    'mission_redeployed',
    '다른 사람에게 떠내려갔어요',
    '패스되어 새로운 사람에게 향하고 있어요.',
    jsonb_build_object(
      'delivery_id', v_new_id,
      'mission_id', v_mission.id,
      'prev_delivery_id', p_delivery_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decline_delivery(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.decline_delivery(bigint) TO authenticated;

-- ---- start_match: man already in chat ----
CREATE OR REPLACE FUNCTION public.start_match(p_delivery_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.mission_deliveries%ROWTYPE;
  v_thread bigint;
  v_other uuid;
  v_my_gender text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_row FROM public.mission_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_uid <> v_row.sender_id AND v_uid <> v_row.receiver_id THEN
    RAISE EXCEPTION 'not your match';
  END IF;
  IF v_row.unlocked_at IS NULL THEN RAISE EXCEPTION 'not open yet'; END IF;

  SELECT id INTO v_thread FROM public.mission_threads WHERE delivery_id = p_delivery_id;
  IF v_thread IS NOT NULL THEN RETURN v_thread; END IF;

  SELECT gender INTO v_my_gender FROM public.profiles WHERE id = v_uid;
  IF v_my_gender = 'male' AND public._user_has_active_chat(v_uid) THEN
    RAISE EXCEPTION 'already_in_chat';
  END IF;

  UPDATE public.profiles SET ticket_balance = ticket_balance - 1
   WHERE id = v_uid AND ticket_balance >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket required'; END IF;

  INSERT INTO public.mission_threads (delivery_id) VALUES (p_delivery_id) RETURNING id INTO v_thread;
  UPDATE public.mission_deliveries SET status = 'closed' WHERE id = p_delivery_id;

  v_other := CASE WHEN v_uid = v_row.sender_id THEN v_row.receiver_id ELSE v_row.sender_id END;
  INSERT INTO public.in_app_notifications (user_id, kind, title, body, payload)
  VALUES (
    v_other,
    'matched',
    '매칭됐어요!',
    '대화방이 열렸어요. 천천히 알아가요.',
    jsonb_build_object('delivery_id', p_delivery_id, 'thread_id', v_thread)
  );

  RETURN v_thread;
END;
$$;

REVOKE ALL ON FUNCTION public.start_match(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.start_match(bigint) TO authenticated;

-- ---- expire: mission-level 48h unaccepted ----
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
  m record;
BEGIN
  -- (1) Accepted but unanswered past 12h
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

    INSERT INTO public.in_app_notifications (user_id, kind, title, body, payload)
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

  -- (2) Mission age ≥ 48h and never accepted → expire active + rewrite
  FOR m IN
    SELECT mi.id AS mission_id, mi.sender_id, mi.body, mi.created_at
    FROM public.missions mi
    WHERE mi.created_at < now() - v_unaccepted_window
      AND NOT EXISTS (
        SELECT 1 FROM public.mission_deliveries d
        WHERE d.mission_id = mi.id AND d.accepted_at IS NOT NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.mission_deliveries d
        WHERE d.mission_id = mi.id
          AND d.status = 'delivered'
          AND d.accepted_at IS NULL
          AND d.reply_body IS NULL
      )
  LOOP
    FOR r IN
      SELECT d.*
      FROM public.mission_deliveries d
      WHERE d.mission_id = m.mission_id
        AND d.status = 'delivered'
        AND d.accepted_at IS NULL
        AND d.reply_body IS NULL
      FOR UPDATE
    LOOP
      UPDATE public.mission_deliveries SET status = 'expired' WHERE id = r.id;
      n := n + 1;
    END LOOP;

    PERFORM public._notify_rewrite(
      m.sender_id,
      (
        SELECT d.id FROM public.mission_deliveries d
        WHERE d.mission_id = m.mission_id
        ORDER BY d.created_at DESC
        LIMIT 1
      ),
      m.mission_id,
      m.body,
      '아직 아무도 받지 않았어요',
      '질문을 다듬어 다시 띄워보세요.'
    );
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_deliveries() FROM public;
GRANT EXECUTE ON FUNCTION public.expire_stale_deliveries() TO authenticated;
