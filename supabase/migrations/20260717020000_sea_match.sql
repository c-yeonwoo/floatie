-- ---------------------------------------------------------------------------
-- Sea redesign — profile-open + paid match
--
-- New model (differs from the old "both OK → auto thread"):
--   1. Woman (sender) likes the reply  → her profile OPENS to the man.
--      No thread yet. The man is notified.
--   2. Either side taps "매칭하고 대화 시작" → pays 1 ticket → thread created.
--
-- So unlock triggers on the SENDER's 'ok' (with a reply present), and thread
-- creation moves out of the trigger into start_match().
-- ---------------------------------------------------------------------------

-- allow the two new notification kinds
ALTER TABLE public.in_app_notifications DROP CONSTRAINT IF EXISTS in_app_notifications_kind_check;
ALTER TABLE public.in_app_notifications
  ADD CONSTRAINT in_app_notifications_kind_check
  CHECK (kind IN ('mission_arrived', 'mission_accepted', 'mission_replied',
                  'mission_no_response', 'profile_opened', 'matched'));

-- ---- unlock trigger: open on sender-ok, notify the man, NO auto thread ----
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

  -- Woman likes the reply → open her profile to the man (no thread yet).
  IF NEW.sender_verdict = 'ok' AND NEW.reply_body IS NOT NULL AND OLD.unlocked_at IS NULL THEN
    NEW.unlocked_at := now();
    INSERT INTO public.in_app_notifications (user_id, kind, title, body, payload)
    VALUES (NEW.receiver_id, 'profile_opened', '프로필이 열렸어요',
            '상대가 답장을 마음에 들어했어요. 프로필을 확인해보세요.',
            jsonb_build_object('delivery_id', NEW.id));
  END IF;

  -- a pass from either side puts the pair on a 14-day cooldown
  IF NEW.sender_verdict = 'pass' OR NEW.receiver_verdict = 'pass' THEN
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

-- ---- start_match: pay 1 ticket, create the thread ----
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_row FROM public.mission_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_uid <> v_row.sender_id AND v_uid <> v_row.receiver_id THEN
    RAISE EXCEPTION 'not your match';
  END IF;
  IF v_row.unlocked_at IS NULL THEN RAISE EXCEPTION 'not open yet'; END IF;

  -- idempotent: if a thread already exists, return it without charging
  SELECT id INTO v_thread FROM public.mission_threads WHERE delivery_id = p_delivery_id;
  IF v_thread IS NOT NULL THEN RETURN v_thread; END IF;

  -- charge one ticket from the initiator (guarded decrement)
  UPDATE public.profiles SET ticket_balance = ticket_balance - 1
   WHERE id = v_uid AND ticket_balance >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket required'; END IF;

  INSERT INTO public.mission_threads (delivery_id) VALUES (p_delivery_id) RETURNING id INTO v_thread;
  UPDATE public.mission_deliveries SET status = 'closed' WHERE id = p_delivery_id;

  v_other := CASE WHEN v_uid = v_row.sender_id THEN v_row.receiver_id ELSE v_row.sender_id END;
  INSERT INTO public.in_app_notifications (user_id, kind, title, body, payload)
  VALUES (v_other, 'matched', '매칭됐어요!', '대화방이 열렸어요. 천천히 알아가요 💬',
          jsonb_build_object('delivery_id', p_delivery_id, 'thread_id', v_thread));

  RETURN v_thread;
END $$;

REVOKE ALL ON FUNCTION public.start_match(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.start_match(bigint) TO authenticated;
