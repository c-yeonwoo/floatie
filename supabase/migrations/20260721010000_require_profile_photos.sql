-- Profile photos are required (3 paths). Exclude placeholder/e2e seeds from the pool.
-- Sender must also have required photos before deliver_mission.

CREATE OR REPLACE FUNCTION public.profile_has_required_photos(p_photos text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_photos IS NOT NULL
    AND cardinality(p_photos) >= 3
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p_photos) AS ph
      WHERE ph IS NULL
         OR btrim(ph) = ''
         OR lower(ph) LIKE 'e2e/%'
         OR lower(ph) LIKE '%placeholder%'
    );
$$;

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
      AND public.profile_has_required_photos(p.photos)
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
  v_sender_photos text[];
  v_mission public.missions%ROWTYPE;
  v_receiver uuid;
  v_delivery_id bigint;
  v_send_count int;
  v_send_free_cap int := 1;
  v_tickets int;
BEGIN
  v_sender := public.assert_user_active_verified();

  SELECT gender, ticket_balance, photos
  INTO v_sender_gender, v_tickets, v_sender_photos
  FROM public.profiles WHERE id = v_sender;

  IF v_sender_gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'only female can send';
  END IF;

  IF NOT public.profile_has_required_photos(v_sender_photos) THEN
    RAISE EXCEPTION 'photos required';
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
