-- ---------------------------------------------------------------------------
-- In-app account deletion (App Store 5.1.1(v) requirement)
--
-- delete_my_account() lets a signed-in user permanently delete their own
-- account. profiles.id references auth.users ON DELETE CASCADE, and virtually
-- every user-owned row (missions, deliveries, threads, messages, notifications,
-- cooldowns, OTP challenges) references profiles(id) ON DELETE CASCADE — so
-- deleting the auth user cascades all of it. We first release the one
-- non-cascade reference (reports.reviewed_by) and clean up rows that reference
-- the user by plain uuid with no FK (reports.reporter_id, blocks).
--
-- SECURITY DEFINER so it can delete from auth.users as the owning role.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Release the only non-cascade FK to the user (admin who reviewed reports).
  UPDATE public.reports SET reviewed_by = NULL WHERE reviewed_by = v_uid;

  -- Rows that reference the user by plain uuid (no FK / no cascade).
  DELETE FROM public.reports WHERE reporter_id = v_uid;
  DELETE FROM public.blocks WHERE blocker_id = v_uid OR blocked_id = v_uid;

  -- Delete the auth user → cascades profile and all profile-linked data.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
