-- ---------------------------------------------------------------------------
-- Harden: profiles self-mod, ticket/message INSERT bypass, decline/forfeit,
-- storage peer photos, block closes threads.
-- ---------------------------------------------------------------------------

-- 1) profiles: column-level UPDATE — clients may only edit safe fields.
--    SECURITY DEFINER RPCs (owner) still update ticket/trust/admin/etc.
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
  onboarded
) ON TABLE public.profiles TO authenticated;

-- Lock gender + onboarded after first completion (client cannot flip back).
CREATE OR REPLACE FUNCTION public.guard_profiles_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.onboarded IS TRUE THEN
    IF NEW.onboarded IS DISTINCT FROM OLD.onboarded THEN
      RAISE EXCEPTION 'onboarded locked';
    END IF;
    IF NEW.gender IS DISTINCT FROM OLD.gender THEN
      RAISE EXCEPTION 'gender locked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_lifecycle ON public.profiles;
CREATE TRIGGER trg_guard_profiles_lifecycle
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_lifecycle();

-- 2) Threads / messages: only SECURITY DEFINER RPCs may insert.
DROP POLICY IF EXISTS "system insert threads via unlock" ON public.mission_threads;
REVOKE INSERT ON public.mission_threads FROM authenticated;

DROP POLICY IF EXISTS "participants insert messages" ON public.mission_messages;
REVOKE INSERT ON public.mission_messages FROM authenticated;

-- 3) Pre-open decline (man): pass before accept — no trust penalty.
--    Uses receiver_verdict=pass → existing trigger closes + 14d cooldown.
--    Explicit RPC so we can reject post-accept misuse with a clear error.
CREATE OR REPLACE FUNCTION public.decline_delivery(p_delivery_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.mission_deliveries%ROWTYPE;
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
END;
$$;

REVOKE ALL ON FUNCTION public.decline_delivery(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.decline_delivery(bigint) TO authenticated;

-- 4) Post-accept forfeit (man gave up without reply) → trust -15 + expire.
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
  v_penalty int := 15;
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

  UPDATE public.profiles
  SET trust_score = GREATEST(0, trust_score - v_penalty)
  WHERE id = v_uid;

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

REVOKE ALL ON FUNCTION public.forfeit_delivery(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.forfeit_delivery(bigint) TO authenticated;

-- 5) Block: close open threads between the pair + helper RPC.
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = v_uid THEN
    RAISE EXCEPTION 'invalid target';
  END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (v_uid, p_blocked_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.mission_threads t
  SET closed_at = coalesce(t.closed_at, now())
  FROM public.mission_deliveries d
  WHERE t.delivery_id = d.id
    AND t.closed_at IS NULL
    AND (
      (d.sender_id = v_uid AND d.receiver_id = p_blocked_id)
      OR (d.receiver_id = v_uid AND d.sender_id = p_blocked_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

-- send_mission_message: reject if either side blocked the other.
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

-- 6) Storage: peers may read photos after unlock; sender may read reply-folder
--    photos once a reply exists (receiver_card / reply_photo).
DROP POLICY IF EXISTS "answer photos readable when owner, public answer, or avatar"
  ON storage.objects;

CREATE POLICY "answer photos readable owner public avatar peer"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'answers'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.answers a
      WHERE a.visibility = 'public'
        AND EXISTS (
          SELECT 1 FROM unnest(a.photos) p
          WHERE p LIKE '%/' || storage.objects.name
             OR p = storage.objects.name
        )
    )
    OR (
      auth.role() = 'authenticated'
      AND storage.objects.name LIKE '%/avatar-%'
    )
    OR EXISTS (
      SELECT 1
      FROM public.mission_deliveries d
      WHERE d.unlocked_at IS NOT NULL
        AND (storage.foldername(name))[1] IN (d.sender_id::text, d.receiver_id::text)
        AND (d.sender_id = auth.uid() OR d.receiver_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.mission_deliveries d
      WHERE d.sender_id = auth.uid()
        AND d.reply_body IS NOT NULL
        AND (storage.foldername(name))[1] = d.receiver_id::text
    )
  )
);
