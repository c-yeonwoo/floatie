-- ---------------------------------------------------------------------------
-- Sea redesign — floatie interaction flow (recall, identity reveal, photos)
--
--  * missions.photo_answer      — sender can require a photo answer
--  * mission_deliveries.reply_photo — man's reply can carry one photo (path)
--  * recall_delivery(id)        — woman cancels a still-drifting floatie
--  * sender_card(id)            — man sees sender nick/age/region (NO photo)
--  * receiver_card(id)          — woman sees replier nick/age/region + photo
--
-- Reveal is asymmetric by design: before mutual OK the man never sees the
-- woman's photo, but when he replies the woman may see his photo thumbnail.
-- ---------------------------------------------------------------------------

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS photo_answer boolean NOT NULL DEFAULT false;

ALTER TABLE public.mission_deliveries
  ADD COLUMN IF NOT EXISTS reply_photo text;

-- ---- recall: sender pulls back a floatie nobody has answered yet ----
CREATE OR REPLACE FUNCTION public.recall_delivery(p_delivery_id bigint)
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
  IF v_row.sender_id <> v_uid THEN RAISE EXCEPTION 'not your floatie'; END IF;
  IF v_row.reply_body IS NOT NULL OR v_row.accepted_at IS NOT NULL OR v_row.status <> 'delivered' THEN
    RAISE EXCEPTION 'already in progress';
  END IF;
  UPDATE public.mission_deliveries SET status = 'closed' WHERE id = p_delivery_id;
END $$;

REVOKE ALL ON FUNCTION public.recall_delivery(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.recall_delivery(bigint) TO authenticated;

-- ---- limited identity cards (bypass profile RLS via definer, scoped checks) ----

-- man (receiver) → sender's nick/age/region only, no photo
CREATE OR REPLACE FUNCTION public.sender_card(p_delivery_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_receiver uuid;
  v_card jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT sender_id, receiver_id INTO v_sender, v_receiver
    FROM public.mission_deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_receiver <> v_uid THEN RAISE EXCEPTION 'not your inbox'; END IF;
  SELECT jsonb_build_object(
           'display_name', display_name,
           'birth_year', birth_year,
           'region', region
         ) INTO v_card
    FROM public.profiles WHERE id = v_sender;
  RETURN v_card;
END $$;

-- woman (sender) → replier's nick/age/region + first photo (revealed on reply)
CREATE OR REPLACE FUNCTION public.receiver_card(p_delivery_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_receiver uuid;
  v_reply text;
  v_card jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT sender_id, receiver_id, reply_body INTO v_sender, v_receiver, v_reply
    FROM public.mission_deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_sender <> v_uid THEN RAISE EXCEPTION 'not your floatie'; END IF;
  IF v_reply IS NULL THEN RAISE EXCEPTION 'no reply yet'; END IF;
  SELECT jsonb_build_object(
           'display_name', display_name,
           'birth_year', birth_year,
           'region', region,
           'photo', COALESCE(photos[1], avatar_url)
         ) INTO v_card
    FROM public.profiles WHERE id = v_receiver;
  RETURN v_card;
END $$;

REVOKE ALL ON FUNCTION public.sender_card(bigint) FROM public;
REVOKE ALL ON FUNCTION public.receiver_card(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.sender_card(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receiver_card(bigint) TO authenticated;

-- ---- attach a photo to an already-sent reply (man) ----
CREATE OR REPLACE FUNCTION public.set_reply_photo(p_delivery_id bigint, p_photo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_receiver uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT receiver_id INTO v_receiver FROM public.mission_deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery not found'; END IF;
  IF v_receiver <> v_uid THEN RAISE EXCEPTION 'not your reply'; END IF;
  UPDATE public.mission_deliveries SET reply_photo = p_photo WHERE id = p_delivery_id;
END $$;

REVOKE ALL ON FUNCTION public.set_reply_photo(bigint, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_reply_photo(bigint, text) TO authenticated;
