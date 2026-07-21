/**
 * Humanize QA/smoke mission bodies, replies, and strip QA tags.
 * Usage: node scripts/repair-qa-copy.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PROJECT = "psrlbanwvmnhacgyrgvl";

const BAD_BODY = /^(ui병|e2e|smoke|test|스모크|테스트)\b/i;
const BAD_REPLY = /스모크\s*답장|e2e\s*reply|smoke\s*reply/i;
const BAD_TAG = /^(#?(qa|e2e|test|테스트|스모크))$/i;

const HUMAN_MISSIONS = [
  "요즘 주말에 제일 기다리고 있는 순간이 있어요?",
  "최근에 혼자 가서 좋았던 곳이 있다면요?",
  "하루를 잘 보냈다고 느낄 때는 언제예요?",
  "처음 만난 사람에게 편하게 건네고 싶은 질문은요?",
];

function loadEnv() {
  const raw = readFileSync(resolve(ROOT, ".env"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function serviceRoleKey() {
  const out = execSync(`supabase projects api-keys --project-ref ${PROJECT} -o json`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const parsed = JSON.parse(out);
  const keys = Array.isArray(parsed) ? parsed : parsed.keys;
  const sr = keys.find((k) => k.id === "service_role" || k.name === "service_role");
  if (!sr?.api_key) throw new Error("service_role key missing");
  return sr.api_key;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const admin = createClient(url, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let missionsFixed = 0;
  const { data: missions } = await admin.from("missions").select("id, body");
  for (const m of missions ?? []) {
    const body = (m.body ?? "").trim();
    if (!BAD_BODY.test(body) && !/ui병\s*\d+/i.test(body)) continue;
    const next = HUMAN_MISSIONS[m.id % HUMAN_MISSIONS.length];
    const { error } = await admin.from("missions").update({ body: next }).eq("id", m.id);
    if (error) throw error;
    missionsFixed += 1;
  }

  let repliesFixed = 0;
  const { data: deliveries } = await admin
    .from("mission_deliveries")
    .select("id, reply_body")
    .not("reply_body", "is", null);
  for (const d of deliveries ?? []) {
    const body = (d.reply_body ?? "").trim();
    if (!BAD_REPLY.test(body) && !BAD_BODY.test(body)) continue;
    const { error } = await admin
      .from("mission_deliveries")
      .update({ reply_body: "요즘 산책이랑 카페가 제일 편해요." })
      .eq("id", d.id);
    if (error) throw error;
    repliesFixed += 1;
  }

  let tagsFixed = 0;
  const { data: profiles } = await admin.from("profiles").select("id, ai_tags").eq("onboarded", true);
  for (const p of profiles ?? []) {
    const tags = Array.isArray(p.ai_tags) ? p.ai_tags : [];
    const cleaned = tags.filter((t) => typeof t === "string" && !BAD_TAG.test(t.trim()));
    if (cleaned.length === tags.length) continue;
    const next = cleaned.length ? cleaned : ["#일상", "#담백"];
    const { error } = await admin.from("profiles").update({ ai_tags: next }).eq("id", p.id);
    if (error) throw error;
    tagsFixed += 1;
  }

  console.log(`missions ${missionsFixed} · replies ${repliesFixed} · tags ${tagsFixed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
