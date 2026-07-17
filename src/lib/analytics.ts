import { supabase } from "@/integrations/supabase/client";

export type FunnelEvent =
  | "send"
  | "deliver_ok"
  | "open_accept"
  | "reply"
  | "unlock"
  | "match"
  | "msg_first"
  | "pass_preopen"
  | "pass_post"
  | "forfeit"
  | "notif_enable_tap"
  | "empty_sea_view";

/** Fire-and-forget product funnel event (RLS: insert own rows). */
export function track(name: FunnelEvent, props?: Record<string, unknown>): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("analytics_events").insert({
        user_id: uid,
        name,
        props: props ?? {},
      });
    } catch {
      /* never block UX */
    }
  })();
}
