// Fan-out push for a single in-app notification.
// If FCM_SERVER_KEY is unset, returns { skipped: true } — in-app remains source of truth.
// Payload.url should be Sea-first: /home?d=<id> or /thread/<id>

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const { user_id, title, body, kind, payload } = await req.json();
    if (!user_id || !title) return json({ error: "user_id + title required" }, 400);

    const fcmKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmKey) {
      return json({ skipped: true, reason: "FCM_SERVER_KEY not set — in-app only" });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, service);

    const { data: tokens, error } = await sb
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", user_id);
    if (error) return json({ error: error.message }, 500);
    if (!tokens?.length) return json({ sent: 0, reason: "no tokens" });

    const deep =
      typeof payload?.url === "string"
        ? payload.url
        : payload?.delivery_id != null
          ? `/home?d=${payload.delivery_id}`
          : payload?.thread_id != null
            ? `/thread/${payload.thread_id}`
            : "/home";

    let sent = 0;
    for (const row of tokens) {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${fcmKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: row.token,
          notification: { title, body: body || "" },
          data: { url: deep, kind: kind || "" },
        }),
      });
      if (res.ok) sent += 1;
    }
    return json({ sent, total: tokens.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
