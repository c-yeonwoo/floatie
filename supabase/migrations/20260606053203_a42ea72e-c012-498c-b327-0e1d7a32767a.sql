
REVOKE EXECUTE ON FUNCTION public.are_mutual_follows(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_nudges_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_nudges_answered() FROM PUBLIC, anon, authenticated;
