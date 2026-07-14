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
  replied_at: string | null;
  sender_verdict: "pending" | "ok" | "pass";
  receiver_verdict: "pending" | "ok" | "pass";
  unlocked_at: string | null;
  expires_at: string;
  created_at: string;
  mission?: { body: string; kind: string; chips: string[] };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
}): Promise<{ missionId: number; deliveryId: number }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("로그인이 필요해요.");

  const { data: mission, error: mErr } = await db
    .from("missions")
    .insert({
      sender_id: uid,
      preset_id: input.presetId ?? null,
      kind: input.kind,
      body: input.body.trim(),
      chips: input.chips ?? [],
    })
    .select("id")
    .single();
  if (mErr) throw mErr;

  const { data: deliveryId, error: dErr } = await db.rpc("deliver_mission", {
    p_mission_id: mission.id,
  });
  if (dErr) {
    // best-effort cleanup of undelivered mission
    await db.from("missions").delete().eq("id", mission.id);
    throw dErr;
  }

  return { missionId: mission.id, deliveryId };
}

export async function fetchInbox(userId: string): Promise<MissionDelivery[]> {
  const { data, error } = await db
    .from("mission_deliveries")
    .select(
      "id, mission_id, sender_id, receiver_id, status, reply_body, replied_at, sender_verdict, receiver_verdict, unlocked_at, expires_at, created_at, mission:missions(body, kind, chips)",
    )
    .eq("receiver_id", userId)
    .in("status", ["delivered", "replied"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MissionDelivery[];
}

export async function fetchOutbox(userId: string): Promise<MissionDelivery[]> {
  const { data, error } = await db
    .from("mission_deliveries")
    .select(
      "id, mission_id, sender_id, receiver_id, status, reply_body, replied_at, sender_verdict, receiver_verdict, unlocked_at, expires_at, created_at, mission:missions(body, kind, chips)",
    )
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as MissionDelivery[];
}

export async function fetchDelivery(id: number): Promise<MissionDelivery | null> {
  const { data, error } = await db
    .from("mission_deliveries")
    .select(
      "id, mission_id, sender_id, receiver_id, status, reply_body, replied_at, sender_verdict, receiver_verdict, unlocked_at, expires_at, created_at, mission:missions(body, kind, chips)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as MissionDelivery | null;
}

export async function replyToDelivery(id: number, replyBody: string) {
  const { error } = await db
    .from("mission_deliveries")
    .update({
      reply_body: replyBody.trim(),
      replied_at: new Date().toISOString(),
      status: "replied",
    })
    .eq("id", id)
    .is("reply_body", null);
  if (error) throw error;
}

export async function setVerdict(
  id: number,
  role: "sender" | "receiver",
  verdict: "ok" | "pass",
) {
  const col = role === "sender" ? "sender_verdict" : "receiver_verdict";
  const { error } = await db
    .from("mission_deliveries")
    .update({ [col]: verdict })
    .eq("id", id)
    .eq(col, "pending");
  if (error) throw error;
}

export async function fetchUnlockedPeer(peerId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("id, display_name, handle, bio, avatar_url, birth_year, region, gender")
    .eq("id", peerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchThreadByDelivery(deliveryId: number) {
  const { data, error } = await db
    .from("mission_threads")
    .select("id, delivery_id, expires_at")
    .eq("delivery_id", deliveryId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: number; delivery_id: number; expires_at: string } | null;
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
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("로그인이 필요해요.");
  const { error } = await db.from("mission_messages").insert({
    thread_id: threadId,
    sender_id: uid,
    body: body.trim(),
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
