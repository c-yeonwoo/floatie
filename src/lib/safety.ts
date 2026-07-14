import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type SafetyProfile = {
  id: string;
  status: "active" | "banned";
  is_admin: boolean;
  identity_verified_at: string | null;
  phone_e164: string | null;
  ban_reason: string | null;
};

export async function fetchSafetyProfile(): Promise<SafetyProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await db
    .from("profiles")
    .select("id, status, is_admin, identity_verified_at, phone_e164, ban_reason")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return data as SafetyProfile | null;
}

export async function requestPhoneOtp(phone: string): Promise<{
  ok: boolean;
  phone?: string;
  dev_code?: string;
}> {
  const { data, error } = await db.rpc("request_phone_otp", { p_phone: phone });
  if (error) throw error;
  return data as { ok: boolean; phone?: string; dev_code?: string };
}

export async function confirmPhoneOtp(phone: string, code: string) {
  const { error } = await db.rpc("confirm_phone_otp", {
    p_phone: phone,
    p_code: code,
  });
  if (error) throw error;
}

export type AdminReport = {
  id: number;
  reporter_id: string;
  target_type: string;
  target_user_id: string | null;
  target_delivery_id: number | null;
  reason: string;
  detail: string | null;
  status: string;
  created_at: string;
};

export async function fetchPendingReports(): Promise<AdminReport[]> {
  const { data, error } = await db
    .from("reports")
    .select(
      "id, reporter_id, target_type, target_user_id, target_delivery_id, reason, detail, status, created_at",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdminReport[];
}

export async function adminReviewReport(
  reportId: number,
  action: "dismiss" | "ban",
  note?: string,
) {
  const { error } = await db.rpc("admin_review_report", {
    p_report_id: reportId,
    p_action: action,
    p_note: note ?? null,
  });
  if (error) throw error;
}
