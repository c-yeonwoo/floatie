// Periodic / manual invoke: run expire_stale_deliveries() as service role.
// Schedule in Dashboard → Edge Functions → expire-stale → Cron (e.g. */15 * * * *)
// or: curl -X POST "$SUPABASE_URL/functions/v1/expire-stale" \
//        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json({ error: "method not allowed" }, 405);
    }

    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    if (!service || !url) return json({ error: "missing supabase env" }, 500);

    const auth = req.headers.get("Authorization") ?? "";
    const bearer = auth.replace(/^Bearer\s+/i, "");
    const apikey = req.headers.get("apikey") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const roleOf = (token: string) => {
      try {
        const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
        return payload.role as string | undefined;
      } catch {
        return undefined;
      }
    };
    const isService =
      bearer === service ||
      apikey === service ||
      roleOf(bearer) === "service_role" ||
      roleOf(apikey) === "service_role";
    const isCron =
      !!cronSecret &&
      (bearer === cronSecret ||
        apikey === cronSecret ||
        req.headers.get("x-cron-secret") === cronSecret);
    if (!isService && !isCron) return json({ error: "unauthorized" }, 401);

    const sb = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.rpc("expire_stale_deliveries");
    if (error) return json({ error: error.message }, 500);
    return json({ expired: data ?? 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
