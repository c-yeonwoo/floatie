REVOKE ALL ON FUNCTION public.is_blocked_by(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_by(uuid) TO service_role;