/**
 * Repair onboarded profiles whose photos are missing or only e2e/placeholders.
 * Does NOT overwrite profiles that already have 3+ non-placeholder paths.
 * Safe order: run this BEFORE applying require_profile_photos migration on a new env.
 *
 * Usage: node scripts/repair-profile-photos.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = resolve(import.meta.dirname, "..");
const PROJECT = "psrlbanwvmnhacgyrgvl";

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

function isPlaceholder(path) {
  if (typeof path !== "string" || !path.trim()) return true;
  const x = path.trim().toLowerCase();
  return x.startsWith("e2e/") || x.includes("placeholder");
}

/** Only repair when there are fewer than 3 real paths (never clobber a full real set). */
function needsRepair(photos) {
  if (!Array.isArray(photos)) return true;
  const real = photos.filter((p) => !isPlaceholder(p));
  return real.length < 3;
}

async function makePhotoJpeg(i) {
  const hues = [
    { bg: "#cfe6e0", accent: "#399a90" },
    { bg: "#f3e0d4", accent: "#d4896a" },
    { bg: "#dde4f0", accent: "#6a86b5" },
  ][i % 3];
  const svg = `
<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg">
  <rect width="640" height="640" fill="${hues.bg}"/>
  <circle cx="320" cy="250" r="110" fill="${hues.accent}" opacity="0.85"/>
  <ellipse cx="320" cy="520" rx="170" ry="140" fill="${hues.accent}" opacity="0.7"/>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function ensurePhotos(admin, userId, existing) {
  const keep = (Array.isArray(existing) ? existing : []).filter((p) => !isPlaceholder(p));
  const paths = [...keep];
  const stamp = Date.now();
  let i = paths.length;
  while (paths.length < 3) {
    const buf = await makePhotoJpeg(i);
    const path = `${userId}/photo-${i}-${stamp}.jpg`;
    const { error } = await admin.storage.from("answers").upload(path, buf, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
    paths.push(path);
    i += 1;
  }
  const { error } = await admin
    .from("profiles")
    .update({ photos: paths.slice(0, 3), avatar_url: paths[0] })
    .eq("id", userId);
  if (error) throw new Error(`profile update: ${error.message}`);
  return paths.slice(0, 3);
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!url) throw new Error("missing supabase url");
  const admin = createClient(url, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await admin
    .from("profiles")
    .select("id, display_name, photos, onboarded")
    .eq("onboarded", true);
  if (error) throw error;

  let fixed = 0;
  for (const row of rows ?? []) {
    if (!needsRepair(row.photos)) continue;
    const paths = await ensurePhotos(admin, row.id, row.photos);
    console.log(`fixed ${row.display_name ?? row.id} → ${paths.join(", ")}`);
    fixed += 1;
  }
  console.log(`done · repaired ${fixed} profile(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
