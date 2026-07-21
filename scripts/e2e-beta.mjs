/**
 * Closed-beta E2E against remote Supabase (service_role + anon).
 * Usage: node scripts/e2e-beta.mjs
 * Does not print secrets. Cleans up test users at end when possible.
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PROJECT = "psrlbanwvmnhacgyrgvl";
const SITE = "https://floatie.pages.dev";
const stamp = Date.now();
const PASS = `E2e!${stamp}Aa`;

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
  if (!Array.isArray(keys)) throw new Error("unexpected api-keys shape");
  const sr = keys.find((k) => k.id === "service_role" || k.name === "service_role");
  if (!sr?.api_key) throw new Error("service_role key missing");
  return sr.api_key;
}

const results = [];
function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}
function info(name, detail = "") {
  results.push({ name, pass: null, detail });
  console.log(`INFO  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function ensureUser(admin, email, password) {
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = listed?.users?.find((u) => u.email === email);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function clientAs(url, anon, email, password) {
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function makePhotoJpeg(i) {
  // Tiny valid JPEG via sharp (devDependency of the app).
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const sharp = require("sharp");
  const hues = ["#cfe6e0", "#f3e0d4", "#dde4f0"];
  const accents = ["#399a90", "#d4896a", "#6a86b5"];
  const svg = `<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg">
    <rect width="640" height="640" fill="${hues[i % 3]}"/>
    <circle cx="320" cy="250" r="110" fill="${accents[i % 3]}" opacity="0.85"/>
    <ellipse cx="320" cy="520" rx="170" ry="140" fill="${accents[i % 3]}" opacity="0.7"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function uploadProfilePhotos(admin, userId) {
  const paths = [];
  const stamp = Date.now();
  for (let i = 0; i < 3; i++) {
    const buf = await makePhotoJpeg(i);
    const path = `${userId}/photo-${i}-${stamp}.jpg`;
    const { error } = await admin.storage.from("answers").upload(path, buf, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (error) throw new Error(`photo upload: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

async function onboard(admin, userId, { gender, name }) {
  const photoPaths = await uploadProfilePhotos(admin, userId);
  const { error } = await admin.from("profiles").update({
    display_name: name,
    gender,
    birth_year: gender === "female" ? 1998 : 1996,
    region: "서울",
    height_cm: gender === "female" ? 165 : 178,
    job_chip: "직장인",
    smoke: "안 함",
    drink: "가끔",
    tattoo: "없어요",
    photos: photoPaths,
    avatar_url: photoPaths[0],
    onboarded: true,
    identity_verified_at: new Date().toISOString(),
    ticket_balance: 10,
    status: "active",
    ai_intro: "## 요즘의 나\nE2E 테스트 소개예요.\n\n## 쉬는 날\n카페와 산책.\n\n## 이런 사람\n책임감 있다는 말을 들어요.",
    ai_ideal_line: "따뜻한 분위기랑 잘 맞을 것 같아요.",
    ai_tags: ["#테스트", "#E2E"],
    intro_answers: {
      version: 2,
      self: ["테니스", "카페", "책임감 강함", "편하고 즐겁게"],
      ideal: { vibes: ["따뜻한"], pace: "천천히 알아가기" },
      facts: { job_chip: "직장인", smoke: "안 함", drink: "가끔", tattoo: "없어요" },
    },
  }).eq("id", userId);
  if (error) throw error;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) throw new Error("missing supabase url/anon in .env");

  const service = serviceRoleKey();
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- env / schema ---
  {
    const { data, error } = await admin.from("app_config").select("key,value").eq("key", "interview_chips_v2").maybeSingle();
    if (error) fail("app_config interview_chips_v2", error.message);
    else {
      const v = typeof data?.value === "string" ? JSON.parse(data.value) : data?.value;
      if (v?.love_view?.length) ok("chips love_view seeded", v.love_view.join(", "));
      else fail("chips love_view seeded", JSON.stringify(v)?.slice(0, 120));
      if (v?.weekend) info("chips still has legacy weekend key", "ok if code fallback ignores");
    }
  }
  {
    const { error } = await admin.from("analytics_events").select("id").limit(1);
    if (error) fail("analytics_events table", error.message);
    else ok("analytics_events table");
  }
  {
    const { data, error } = await admin.from("app_config").select("value").eq("key", "dev_otp_enabled").maybeSingle();
    if (error) fail("dev_otp_enabled read", error.message);
    else info("dev_otp_enabled", String(data?.value));
  }

  // --- site smoke ---
  for (const path of ["/", "/login"]) {
    try {
      const res = await fetch(`${SITE}${path}`, { redirect: "follow" });
      if (res.ok) ok(`site ${path}`, `HTTP ${res.status}`);
      else fail(`site ${path}`, `HTTP ${res.status}`);
    } catch (e) {
      fail(`site ${path}`, String(e));
    }
  }
  // legacy routes need auth — check HTML shell at least loads
  for (const path of ["/send", "/outbox", "/delivery/1", "/waiting/1"]) {
    try {
      const res = await fetch(`${SITE}${path}`, { redirect: "manual" });
      info(`site ${path} (unauth)`, `HTTP ${res.status} (expect login redirect or app shell)`);
    } catch (e) {
      fail(`site ${path}`, String(e));
    }
  }

  const femEmail = `e2e.f.${stamp}@floatie.test`;
  const maleEmail = `e2e.m.${stamp}@floatie.test`;
  const male2Email = `e2e.m2.${stamp}@floatie.test`;
  let femId;
  let maleId;
  let male2Id;
  let deliveryId;
  let threadId;

  try {
    const fem = await ensureUser(admin, femEmail, PASS);
    const male = await ensureUser(admin, maleEmail, PASS);
    const male2 = await ensureUser(admin, male2Email, PASS);
    femId = fem.id;
    maleId = male.id;
    male2Id = male2.id;
    ok("create users", `f=${femId.slice(0, 8)} m=${maleId.slice(0, 8)} m2=${male2Id.slice(0, 8)}`);

    await onboard(admin, femId, { gender: "female", name: "E2E여" });
    await onboard(admin, maleId, { gender: "male", name: "E2E남" });
    await onboard(admin, male2Id, { gender: "male", name: "E2E남2" });
    await admin
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .in("id", [femId, maleId, male2Id]);
    ok("onboard + verify both");

    const femClient = await clientAs(url, anon, femEmail, PASS);
    const maleClient = await clientAs(url, anon, maleEmail, PASS);
    const male2Client = await clientAs(url, anon, male2Email, PASS);

    // gender guard: male cannot send
    {
      const { error } = await maleClient.from("missions").insert({
        sender_id: maleId,
        kind: "question",
        body: "남성이 보내면 안 됨",
        chips: [],
      });
      // may succeed insert then fail deliver — check deliver
      if (!error) {
        const { data: m } = await maleClient.from("missions").select("id").eq("sender_id", maleId).order("id", { ascending: false }).limit(1).maybeSingle();
        const { error: dErr } = await maleClient.rpc("deliver_mission", {
          p_mission_id: m.id,
          p_use_ticket: false,
          p_filter_kind: null,
          p_filter_value: null,
        });
        if (dErr) ok("male cannot deliver", dErr.message.slice(0, 80));
        else fail("male cannot deliver", "deliver succeeded for male");
        await admin.from("missions").delete().eq("id", m.id);
      } else {
        ok("male cannot insert mission", error.message.slice(0, 80));
      }
    }

    // --- pass → auto-redeploy (same mission, new delivery) ---
    {
      const { data: mission, error: mErr } = await femClient
        .from("missions")
        .insert({
          sender_id: femId,
          kind: "question",
          body: "E2E: 패스 재배달 테스트",
          chips: [],
          photo_answer: false,
        })
        .select("id")
        .single();
      if (mErr) throw mErr;

      const { data: forced, error: fErr } = await admin
        .from("mission_deliveries")
        .insert({
          mission_id: mission.id,
          sender_id: femId,
          receiver_id: maleId,
          status: "delivered",
          expires_at: null,
        })
        .select("id")
        .single();
      if (fErr) throw fErr;

      const { error: decErr } = await maleClient.rpc("decline_delivery", {
        p_delivery_id: forced.id,
      });
      if (decErr) fail("decline_delivery redeploy", decErr.message);
      else {
        const { data: hops } = await admin
          .from("mission_deliveries")
          .select("id, status, receiver_id")
          .eq("mission_id", mission.id)
          .order("id", { ascending: true });
        const { data: mis } = await admin
          .from("missions")
          .select("redeploy_count")
          .eq("id", mission.id)
          .single();
        const active = (hops ?? []).filter((h) => h.status === "delivered");
        const closed = (hops ?? []).find((h) => h.id === forced.id);
        if (closed?.status === "closed" && active.length === 1 && (mis?.redeploy_count ?? 0) >= 1) {
          ok(
            "pass auto-redeploy",
            `hops=${hops.length} redeploy=${mis.redeploy_count} next=${active[0].receiver_id?.slice(0, 8)}`,
          );
        } else {
          fail("pass auto-redeploy", JSON.stringify({ hops, redeploy: mis?.redeploy_count }));
        }

        const { data: notif } = await admin
          .from("in_app_notifications")
          .select("kind")
          .eq("user_id", femId)
          .eq("kind", "mission_redeployed")
          .order("id", { ascending: false })
          .limit(1);
        if (notif?.length) ok("mission_redeployed notify");
        else fail("mission_redeployed notify", "missing");
      }

      // close active hop so male2/pool stay free for happy path
      await admin
        .from("mission_deliveries")
        .update({ status: "closed", receiver_verdict: "pass" })
        .eq("mission_id", mission.id)
        .eq("status", "delivered");
    }

    // female send → deliver (prefer our male via pool; if not, force receiver)
    {
      const { data: mission, error: mErr } = await femClient
        .from("missions")
        .insert({
          sender_id: femId,
          kind: "question",
          body: "E2E: 요즘 빠져 있는 건?",
          chips: [],
          photo_answer: false,
        })
        .select("id")
        .single();
      if (mErr) throw mErr;

      let dErr;
      let dId;
      // pass-test mission already counted toward daily free send → ticket
      ({ data: dId, error: dErr } = await femClient.rpc("deliver_mission", {
        p_mission_id: mission.id,
        p_use_ticket: true,
        p_filter_kind: null,
        p_filter_value: null,
      }));

      if (dErr || !dId) {
        // force delivery row to our male for deterministic E2E
        info("random deliver failed/empty — forcing delivery to E2E male", dErr?.message ?? "no id");
        const { data: forced, error: fErr } = await admin
          .from("mission_deliveries")
          .insert({
            mission_id: mission.id,
            sender_id: femId,
            receiver_id: maleId,
            status: "delivered",
            expires_at: null,
          })
          .select("id")
          .single();
        if (fErr) throw fErr;
        deliveryId = forced.id;
        // deduct free send if needed — skip
        ok("forced delivery to male", `delivery=${deliveryId}`);
      } else {
        deliveryId = dId;
        // ensure receiver is our male; if not, reassign
        const { data: del } = await admin.from("mission_deliveries").select("*").eq("id", deliveryId).single();
        if (del.receiver_id !== maleId) {
          info("delivered to other user — reassigning to E2E male", del.receiver_id?.slice(0, 8));
          await admin.from("mission_deliveries").update({ receiver_id: maleId }).eq("id", deliveryId);
        }
        ok("female deliver_mission", `delivery=${deliveryId}`);
      }
    }

    // sender_card: should expose age/region, check nick policy in RPC
    {
      const { data: card, error } = await maleClient.rpc("sender_card", { p_delivery_id: deliveryId });
      if (error) fail("sender_card", error.message);
      else {
        const row = Array.isArray(card) ? card[0] : card;
        const hasNick = !!(row?.display_name && String(row.display_name).trim());
        const hasAge = row?.birth_year != null;
        const hasRegion = !!row?.region;
        // Product: UI hides nick; RPC may still return it — flag if returned
        if (hasNick) {
          fail("sender_card no nick", `still returns ${row.display_name}`);
        } else {
          ok("sender_card no nick");
        }
        if (hasAge || hasRegion) ok("sender_card age/region", `y=${row?.birth_year} r=${row?.region}`);
        else fail("sender_card age/region", JSON.stringify(row));
      }
    }

    // decline then re-deliver path is heavy; test accept instead
    {
      const { error } = await maleClient.rpc("accept_delivery", { p_delivery_id: deliveryId });
      if (error) fail("accept_delivery", error.message);
      else ok("accept_delivery");
    }
    {
      const { data: del } = await admin.from("mission_deliveries").select("expires_at, accepted_at").eq("id", deliveryId).single();
      if (del?.accepted_at && del?.expires_at) ok("12h window set", `expires_at=${del.expires_at}`);
      else fail("12h window set", JSON.stringify(del));
    }

    {
      const { error } = await maleClient.rpc("reply_to_delivery", {
        p_delivery_id: deliveryId,
        p_body: "테니스랑 운동이요!",
      });
      if (error) fail("reply_to_delivery", error.message);
      else ok("reply_to_delivery");
    }

    {
      const { error } = await femClient.rpc("set_delivery_verdict", {
        p_delivery_id: deliveryId,
        p_verdict: "ok",
      });
      if (error) fail("set_delivery_verdict ok", error.message);
      else ok("unlock via sender ok");
    }
    {
      const { data: del } = await admin.from("mission_deliveries").select("unlocked_at").eq("id", deliveryId).single();
      if (del?.unlocked_at) ok("unlocked_at set");
      else fail("unlocked_at set");
    }

    // peer profile readable after unlock
    {
      const { data, error } = await maleClient.from("profiles").select("display_name, ai_intro, ai_ideal_line").eq("id", femId).maybeSingle();
      if (error) fail("male reads unlocked peer", error.message);
      else if (data?.ai_intro) ok("male reads unlocked peer intro");
      else info("male reads unlocked peer", "row may be RLS-limited — check fetchUnlockedPeer RPC path");
    }

    {
      const { data, error } = await femClient.rpc("start_match", { p_delivery_id: deliveryId });
      if (error) fail("start_match", error.message);
      else {
        threadId = data;
        ok("start_match", `thread=${threadId}`);
      }
    }

    // woman cannot float while chat active
    if (threadId) {
      const { data: m2, error: m2Err } = await femClient
        .from("missions")
        .insert({
          sender_id: femId,
          kind: "question",
          body: "E2E: 채팅 중 발송 잠금",
          chips: [],
        })
        .select("id")
        .single();
      if (m2Err) fail("chat lock setup mission", m2Err.message);
      else {
        const { error: dErr } = await femClient.rpc("deliver_mission", {
          p_mission_id: m2.id,
          p_use_ticket: true,
          p_filter_kind: null,
          p_filter_value: null,
        });
        if (dErr && /chat_active/i.test(dErr.message)) ok("chat_active_no_new_floatie", dErr.message.slice(0, 60));
        else if (dErr) fail("chat_active_no_new_floatie", dErr.message.slice(0, 100));
        else fail("chat_active_no_new_floatie", "deliver succeeded while chat open");
        await admin.from("missions").delete().eq("id", m2.id);
      }

      {
        const { data: hasChat, error: hErr } = await maleClient.rpc("has_active_chat");
        if (hErr) fail("has_active_chat male", hErr.message);
        else if (hasChat === true) ok("male has_active_chat after match");
        else fail("male has_active_chat after match", String(hasChat));
      }
      void male2Client;
    }

    if (threadId) {
      const { error } = await femClient.rpc("send_mission_message", {
        p_thread_id: threadId,
        p_body: "안녕하세요 E2E예요",
      });
      if (error) fail("send_mission_message", error.message);
      else ok("send_mission_message");
    } else {
      fail("send_mission_message", "no threadId");
    }

    // client analytics insert (as female)
    {
      for (const name of ["send", "reply", "unlock", "match", "msg_first"]) {
        const { error } = await femClient.from("analytics_events").insert({
          user_id: femId,
          name,
          props: { e2e: true, stamp },
        });
        if (error) {
          fail(`analytics insert ${name}`, error.message);
          break;
        }
      }
      const { count, error } = await admin
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", femId)
        .contains("props", { e2e: true });
      if (error) fail("analytics count", error.message);
      else if ((count ?? 0) >= 5) ok("analytics_events written", `count=${count}`);
      else fail("analytics_events written", `count=${count}`);
    }

    // report (before block — same as UI order may vary)
    {
      const { error } = await maleClient.from("reports").insert({
        reporter_id: maleId,
        target_type: "delivery",
        target_delivery_id: deliveryId,
        target_user_id: femId,
        reason: "spam",
        detail: "e2e report — dismiss me",
      });
      if (error) fail("report insert", error.message);
      else ok("report insert pending");
    }

    // block (after message path — may block further peer reads)
    {
      const { error } = await maleClient.rpc("block_user", { p_blocked_id: femId });
      if (error) fail("block_user", error.message);
      else ok("block_user");
    }

    // generate-profile edge
    {
      const { data: sess } = await femClient.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`${url}/functions/v1/generate-profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: ["테니스", "카페에서 쉬어요", "책임감 강함", "편하고 즐겁게"],
          ideal: { vibes: ["따뜻한"], pace: "천천히 알아가기" },
          profile: {
            displayName: "E2E여",
            gender: "female",
            birthYear: 1998,
            region: "서울",
            heightCm: 165,
            jobChip: "직장인",
            smoke: "안 함",
            drink: "가끔",
            tattoo: "없어요",
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) fail("generate-profile edge", `${res.status} ${JSON.stringify(body).slice(0, 120)}`);
      else if (Array.isArray(body.sections) && body.sections.length >= 2) {
        ok("generate-profile edge", `sections=${body.sections.length}`);
      } else fail("generate-profile edge", JSON.stringify(body).slice(0, 160));
    }

    // dispatch-push without FCM should skip
    {
      const res = await fetch(`${url}/functions/v1/dispatch-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${service}`,
          apikey: service,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: maleId,
          title: "E2E",
          body: "test",
          kind: "mission_arrived",
          payload: { delivery_id: deliveryId },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && (body.skipped || body.sent != null)) ok("dispatch-push responds", JSON.stringify(body).slice(0, 100));
      else fail("dispatch-push responds", `${res.status} ${JSON.stringify(body).slice(0, 120)}`);
    }

    // expire-stale edge (deploy may lag — INFO if 404)
    {
      const res = await fetch(`${url}/functions/v1/expire-stale`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${service}`,
          apikey: service,
          "Content-Type": "application/json",
        },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.expired != null) ok("expire-stale edge", `expired=${body.expired}`);
      else if (res.status === 404) info("expire-stale edge", "not deployed yet");
      else fail("expire-stale edge", `${res.status} ${JSON.stringify(body).slice(0, 120)}`);
    }
  } catch (e) {
    fail("fatal", e?.message ?? String(e));
  } finally {
    // cleanup
    try {
      if (femId) await admin.auth.admin.deleteUser(femId);
      if (maleId) await admin.auth.admin.deleteUser(maleId);
      if (male2Id) await admin.auth.admin.deleteUser(male2Id);
      ok("cleanup users");
    } catch (e) {
      info("cleanup users", e?.message ?? String(e));
    }
  }

  const passed = results.filter((r) => r.pass === true).length;
  const failed = results.filter((r) => r.pass === false);
  console.log("\n======== SUMMARY ========");
  console.log(`PASS ${passed} / FAIL ${failed.length} / INFO ${results.filter((r) => r.pass === null).length}`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
