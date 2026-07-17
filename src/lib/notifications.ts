import { supabase } from "@/integrations/supabase/client";

export type InAppNotification = {
  id: number;
  kind:
    | "mission_arrived"
    | "mission_accepted"
    | "mission_replied"
    | "mission_no_response"
    | "profile_opened"
    | "matched";
  title: string;
  body: string;
  payload: {
    delivery_id?: number;
    mission_body?: string;
    can_resend?: boolean;
    thread_id?: number;
  };
  read_at: string | null;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function fetchUnreadNotifications(): Promise<InAppNotification[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data, error } = await db
    .from("in_app_notifications")
    .select("id, kind, title, body, payload, read_at, created_at")
    .eq("user_id", uid)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    if (/relation|does not exist/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []) as InAppNotification[];
}

export async function fetchNotifications(limit = 50): Promise<InAppNotification[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data, error } = await db
    .from("in_app_notifications")
    .select("id, kind, title, body, payload, read_at, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/relation|does not exist/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []) as InAppNotification[];
}

export async function markNotificationRead(id: number) {
  const { error } = await db
    .from("in_app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  const { error } = await db
    .from("in_app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid)
    .is("read_at", null);
  if (error) throw error;
}

/** Screen a notification should open when tapped. */
export function notificationHref(
  n: Pick<InAppNotification, "kind" | "payload">,
): string | null {
  const id = n.payload?.delivery_id;
  // profile-open / match land back on the sea, where the floatie carries the action
  if (n.kind === "profile_opened" || n.kind === "matched") return "/home";
  if (!id) return null;
  if (n.kind === "mission_no_response") return `/waiting/${id}`;
  return `/delivery/${id}`; // arrived / accepted / replied
}
