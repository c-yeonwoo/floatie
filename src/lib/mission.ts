import { supabase } from "@/integrations/supabase/client";

export type MissionPreset = {
  id: number;
  kind: "question" | "action_text";
  body: string;
  chips: string[];
  tags: string[];
};

export type MissionDelivery = {
  id: number;
  mission_id: number;
  sender_id: string;
  receiver_id: string;
  status: string;
  reply_body: string | null;
  reply_photo: string | null;
  replied_at: string | null;
  sender_verdict: "pending" | "ok" | "pass";
  receiver_verdict: "pending" | "ok" | "pass";
  unlocked_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
  mission?: { body: string; kind: string; chips: string[]; photo_answer?: boolean };
};

export type PersonCard = {
  display_name: string | null;
  birth_year: number | null;
  region: string | null;
  photo?: string | null;
};

export type MyMissionProfile = {
  id: string;
  gender: "female" | "male" | "other" | null;
  birth_year: number | null;
  region: string | null;
  height_cm: number | null;
  ticket_balance: number;
  trust_score: number;
  display_name: string | null;
};

export type IdealFilter =
  | { kind: "age_band"; value: string }
  | { kind: "region"; value: string }
  | { kind: "height"; value: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function touchLastActive() {
  await db.rpc("touch_last_active");
}

export async function expireStaleDeliveries() {
  await db.rpc("expire_stale_deliveries");
}

export async function fetchMyMissionProfile(): Promise<MyMissionProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await db
    .from("profiles")
    .select("id, gender, birth_year, region, height_cm, ticket_balance, trust_score, display_name")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return data as MyMissionProfile | null;
}

export async function countSendsToday(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await db
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId)
    .gte("created_at", start.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function fetchPresets(): Promise<MissionPreset[]> {
  const { data, error } = await db
    .from("mission_presets")
    .select("id, kind, body, chips, tags")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createAndDeliverMission(input: {
  presetId?: number;
  kind: "question" | "action_text";
  body: string;
  chips?: string[];
  useTicket?: boolean;
  filter?: IdealFilter | null;
  photoAnswer?: boolean;
}): Promise<{ missionId: number; deliveryId: number }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("로그인이 필요해요.");

  const profile = await fetchMyMissionProfile();
  if (profile?.gender !== "female") {
    throw new Error("only female can send");
  }

  const { data: mission, error: mErr } = await db
    .from("missions")
    .insert({
      sender_id: uid,
      preset_id: input.presetId ?? null,
      kind: input.kind,
      body: input.body.trim(),
      chips: input.chips ?? [],
      photo_answer: !!input.photoAnswer,
    })
    .select("id")
    .single();
  if (mErr) throw mErr;

  const { data: deliveryId, error: dErr } = await db.rpc("deliver_mission", {
    p_mission_id: mission.id,
    p_use_ticket: !!input.useTicket,
    p_filter_kind: input.filter?.kind ?? null,
    p_filter_value: input.filter?.value ?? null,
  });
  if (dErr) {
    await db.from("missions").delete().eq("id", mission.id);
    throw dErr;
  }

  return { missionId: mission.id, deliveryId };
}

async function withExpiry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await expireStaleDeliveries();
  } catch {
    // ignore if migration not applied yet
  }
  return fn();
}

export async function fetchInbox(userId: string): Promise<MissionDelivery[]> {
  return withExpiry(async () => {
    const { data, error } = await db
      .from("mission_deliveries")
      .select(
        "id, mission_id, sender_id, receiver_id, status, reply_body, reply_photo, replied_at, sender_verdict, receiver_verdict, unlocked_at, accepted_at, expires_at, created_at, mission:missions(body, kind, chips, photo_answer)",
      )
      .eq("receiver_id", userId)
      .in("status", ["delivered", "replied"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as MissionDelivery[];
  });
}

export async function fetchOutbox(userId: string): Promise<MissionDelivery[]> {
  return withExpiry(async () => {
    const { data, error } = await db
      .from("mission_deliveries")
      .select(
        "id, mission_id, sender_id, receiver_id, status, reply_body, reply_photo, replied_at, sender_verdict, receiver_verdict, unlocked_at, accepted_at, expires_at, created_at, mission:missions(body, kind, chips, photo_answer)",
      )
      .eq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return (data ?? []) as MissionDelivery[];
  });
}

export async function fetchDelivery(id: number): Promise<MissionDelivery | null> {
  return withExpiry(async () => {
    const { data, error } = await db
      .from("mission_deliveries")
      .select(
        "id, mission_id, sender_id, receiver_id, status, reply_body, reply_photo, replied_at, sender_verdict, receiver_verdict, unlocked_at, accepted_at, expires_at, created_at, mission:missions(body, kind, chips, photo_answer)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as MissionDelivery | null;
  });
}

export async function acceptDelivery(id: number) {
  const { error } = await db.rpc("accept_delivery", { p_delivery_id: id });
  if (error) throw error;
}

export async function replyToDelivery(id: number, replyBody: string) {
  const { error } = await db.rpc("reply_to_delivery", {
    p_delivery_id: id,
    p_body: replyBody.trim(),
  });
  if (error) throw error;
}

export async function resendExpiredMission(
  deliveryId: number,
  useTicket = false,
): Promise<number> {
  const { data, error } = await db.rpc("resend_expired_mission", {
    p_delivery_id: deliveryId,
    p_use_ticket: useTicket,
  });
  if (error) throw error;
  return data as number;
}

export async function setVerdict(
  id: number,
  role: "sender" | "receiver",
  verdict: "ok" | "pass",
) {
  // Verdicts go through a SECURITY DEFINER RPC that writes only the caller's
  // own column — direct table UPDATE is revoked to prevent verdict forgery.
  // `role` is kept for call-site clarity; the RPC resolves the column from auth.uid().
  void role;
  const { error } = await db.rpc("set_delivery_verdict", {
    p_delivery_id: id,
    p_verdict: verdict,
  });
  if (error) throw error;
}

export type MissionThread = {
  id: number;
  delivery_id: number;
  expires_at: string;
  message_cap: number;
  closed_at: string | null;
  sender_contact: string | null;
  receiver_contact: string | null;
  sender_id?: string;
  receiver_id?: string;
};

export const MESSAGE_CAP_DEFAULT = 20;

export type UnlockedPeer = {
  id: string;
  display_name: string | null;
  handle: string | null;
  bio: string | null;
  avatar_url: string | null;
  birth_year: number | null;
  region: string | null;
  gender: string | null;
  height_cm: number | null;
  photos: string[] | null;
  ai_intro: string | null;
  ai_tags: string[] | null;
  intro_answers: { answers?: string[] } | null;
};

export async function fetchUnlockedPeer(peerId: string): Promise<UnlockedPeer | null> {
  const { data, error } = await db
    .from("profiles")
    .select(
      "id, display_name, handle, bio, avatar_url, birth_year, region, gender, height_cm, photos, ai_intro, ai_tags, intro_answers",
    )
    .eq("id", peerId)
    .maybeSingle();
  if (error) throw error;
  return data as UnlockedPeer | null;
}

/** Pay 1 ticket → create (or fetch) the chat thread for a matched delivery. */
export async function startMatch(deliveryId: number): Promise<number> {
  const { data, error } = await db.rpc("start_match", { p_delivery_id: deliveryId });
  if (error) throw error;
  return data as number;
}

export async function fetchThreadByDelivery(deliveryId: number) {
  const { data, error } = await db
    .from("mission_threads")
    .select(
      "id, delivery_id, expires_at, message_cap, closed_at, sender_contact, receiver_contact",
    )
    .eq("delivery_id", deliveryId)
    .maybeSingle();
  if (error) throw error;
  return data as MissionThread | null;
}

export async function fetchThread(threadId: number) {
  const { data: thread, error } = await db
    .from("mission_threads")
    .select(
      "id, delivery_id, expires_at, message_cap, closed_at, sender_contact, receiver_contact",
    )
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw error;
  if (!thread) return null;

  const { data: delivery } = await db
    .from("mission_deliveries")
    .select("sender_id, receiver_id")
    .eq("id", thread.delivery_id)
    .maybeSingle();

  return {
    ...(thread as MissionThread),
    sender_id: delivery?.sender_id,
    receiver_id: delivery?.receiver_id,
  } as MissionThread;
}

export async function fetchMessages(threadId: number) {
  const { data, error } = await db
    .from("mission_messages")
    .select("id, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(threadId: number, body: string) {
  const { error } = await db.rpc("send_mission_message", {
    p_thread_id: threadId,
    p_body: body.trim(),
  });
  if (error) throw error;
}

export async function offerThreadContact(threadId: number, contact: string) {
  const { error } = await db.rpc("offer_thread_contact", {
    p_thread_id: threadId,
    p_contact: contact.trim(),
  });
  if (error) throw error;
}

export function ageBand(birthYear: number | null | undefined): string | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  if (age < 20) return "10대";
  if (age < 25) return "20대 초반";
  if (age < 30) return "20대 후반";
  if (age < 35) return "30대 초반";
  if (age < 40) return "30대 후반";
  return "40대+";
}

/** Remaining ms until expires_at; negative if past or no deadline. */
export function msUntil(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  return new Date(iso).getTime() - Date.now();
}

export function formatCountdown(iso: string | null | undefined): string {
  if (!iso) return "수락 대기";
  const ms = msUntil(iso);
  if (ms <= 0) return "만료";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}일 ${h % 24}시간`;
  }
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export const AGE_BAND_OPTIONS = [
  { label: "20–24", value: "20-24" },
  { label: "25–29", value: "25-29" },
  { label: "30–34", value: "30-34" },
  { label: "35–39", value: "35-39" },
] as const;

export const HEIGHT_OPTIONS = [
  { label: "165–174", value: "165-174" },
  { label: "175–184", value: "175-184" },
  { label: "185+", value: "185-230" },
] as const;

// ---- sea redesign RPCs ----

/** Woman pulls back a still-drifting floatie (no reply/accept yet). */
export async function recallDelivery(id: number): Promise<void> {
  const { error } = await db.rpc("recall_delivery", { p_delivery_id: id });
  if (error) throw error;
}

/** Man's view of the sender before opening — nick/age/region only (no photo). */
export async function fetchSenderCard(id: number): Promise<PersonCard | null> {
  const { data, error } = await db.rpc("sender_card", { p_delivery_id: id });
  if (error) throw error;
  return (data as PersonCard) ?? null;
}

/** Woman's view of the replier — nick/age/region + first photo thumbnail. */
export async function fetchReceiverCard(id: number): Promise<PersonCard | null> {
  const { data, error } = await db.rpc("receiver_card", { p_delivery_id: id });
  if (error) throw error;
  return (data as PersonCard) ?? null;
}

/** Attach a photo (storage path) to an already-sent reply. */
export async function setReplyPhoto(id: number, path: string): Promise<void> {
  const { error } = await db.rpc("set_reply_photo", { p_delivery_id: id, p_photo: path });
  if (error) throw error;
}
