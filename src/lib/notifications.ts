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

export type NotificationNav =
  | { to: "/home"; search?: { d: number } }
  | { to: "/thread/$threadId"; params: { threadId: string } };

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

/** Where a notification should navigate in the Sea-first app. */
export function notificationTarget(
  n: Pick<InAppNotification, "kind" | "payload">,
): NotificationNav | null {
  const id = n.payload?.delivery_id;
  const threadId = n.payload?.thread_id;
  if (n.kind === "matched" && threadId) {
    return { to: "/thread/$threadId", params: { threadId: String(threadId) } };
  }
  if (
    n.kind === "profile_opened" ||
    n.kind === "mission_arrived" ||
    n.kind === "mission_accepted" ||
    n.kind === "mission_replied" ||
    n.kind === "mission_no_response" ||
    n.kind === "matched"
  ) {
    return id ? { to: "/home", search: { d: id } } : { to: "/home" };
  }
  return null;
}

/** @deprecated use notificationTarget */
export function notificationHref(
  n: Pick<InAppNotification, "kind" | "payload">,
): string | null {
  const t = notificationTarget(n);
  if (!t) return null;
  if (t.to === "/thread/$threadId") return `/thread/${t.params.threadId}`;
  if (t.search?.d) return `/home?d=${t.search.d}`;
  return "/home";
}
