-- Product funnel events (client insert; service_role / admin read later).
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx
  ON public.analytics_events(name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx
  ON public.analytics_events(user_id, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own analytics"
  ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own analytics"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.analytics_events_id_seq TO authenticated, service_role;

-- Hook: after in-app notification, ask Edge Function to fan-out push (best-effort).
-- Requires pg_net + vault secret `project_url` / service role — no-op if net unavailable.
CREATE OR REPLACE FUNCTION public.enqueue_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text;
  service_key text;
BEGIN
  BEGIN
    base_url := current_setting('app.settings.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    base_url := NULL;
  END;
  BEGIN
    service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  -- Prefer Supabase-managed secrets via env in Edge; trigger uses pg_net when configured.
  IF base_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := rtrim(base_url, '/') || '/functions/v1/dispatch-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', COALESCE(NEW.body, ''),
        'kind', NEW.kind,
        'payload', COALESCE(NEW.payload, '{}'::jsonb)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_net missing or misconfigured — in-app toast still works
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_push_for_notification ON public.in_app_notifications;
CREATE TRIGGER trg_enqueue_push_for_notification
  AFTER INSERT ON public.in_app_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_push_for_notification();
