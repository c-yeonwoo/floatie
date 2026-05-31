
REVOKE ALL ON FUNCTION public.enforce_comments_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_likes_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_follows_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_answers_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_reports_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_answer_photos() FROM PUBLIC, anon, authenticated;
