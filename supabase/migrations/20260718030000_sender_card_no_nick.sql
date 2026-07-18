-- Pre-open: do not expose sender nick via sender_card (age/region only).
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
           'birth_year', birth_year,
           'region', region
         ) INTO v_card
    FROM public.profiles WHERE id = v_sender;
  RETURN v_card;
END $$;
