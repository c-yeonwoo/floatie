
-- 1. Length / format constraints
ALTER TABLE public.comments ADD CONSTRAINT comments_body_length CHECK (char_length(body) BETWEEN 1 AND 500);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 300);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_length CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 40);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_handle_format CHECK (handle IS NULL OR (char_length(handle) BETWEEN 3 AND 20 AND handle ~ '^[a-zA-Z0-9_]+$'));
ALTER TABLE public.reports ADD CONSTRAINT reports_detail_length CHECK (detail IS NULL OR char_length(detail) <= 1000);

-- 2. Rate limit triggers
CREATE OR REPLACE FUNCTION public.enforce_comments_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM public.comments WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute';
  IF c >= 10 THEN RAISE EXCEPTION '댓글을 너무 많이 달았어요. 잠시 후 다시 시도해 주세요.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER comments_rate_limit BEFORE INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.enforce_comments_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_likes_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM public.likes WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute';
  IF c >= 30 THEN RAISE EXCEPTION '잠시 후 다시 시도해 주세요.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER likes_rate_limit BEFORE INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.enforce_likes_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_follows_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM public.follows WHERE follower_id = NEW.follower_id AND created_at > now() - interval '1 minute';
  IF c >= 30 THEN RAISE EXCEPTION '잠시 후 다시 시도해 주세요.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER follows_rate_limit BEFORE INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.enforce_follows_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_answers_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM public.answers WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute';
  IF c >= 5 THEN RAISE EXCEPTION '잠시 후 다시 시도해 주세요.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER answers_rate_limit BEFORE INSERT ON public.answers FOR EACH ROW EXECUTE FUNCTION public.enforce_answers_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_reports_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM public.reports WHERE reporter_id = NEW.reporter_id AND created_at > now() - interval '1 hour';
  IF c >= 20 THEN RAISE EXCEPTION '신고가 너무 많아요. 잠시 후 다시 시도해 주세요.'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER reports_rate_limit BEFORE INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.enforce_reports_rate_limit();

-- 3. Storage cleanup when answer deleted
CREATE OR REPLACE FUNCTION public.cleanup_answer_photos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE
  photo_url text;
  photo_path text;
BEGIN
  IF OLD.photos IS NOT NULL THEN
    FOREACH photo_url IN ARRAY OLD.photos LOOP
      photo_path := regexp_replace(photo_url, '^.*/storage/v1/object/public/answers/', '');
      IF photo_path <> photo_url AND length(photo_path) > 0 THEN
        DELETE FROM storage.objects WHERE bucket_id = 'answers' AND name = photo_path;
      END IF;
    END LOOP;
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER cleanup_answer_photos_trigger BEFORE DELETE ON public.answers FOR EACH ROW EXECUTE FUNCTION public.cleanup_answer_photos();

-- 4. Answer owner can delete comments on their own answer
CREATE POLICY "answer owners delete comments on own answer"
ON public.comments
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.answers a WHERE a.id = comments.answer_id AND a.user_id = auth.uid()));
