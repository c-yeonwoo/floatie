#!/usr/bin/env node
/**
 * 숨결 — persona similarity refresh batch
 *
 * 각 사용자의 최신 persona_reads.keywords를 기준으로
 * 사용자 간 Jaccard 유사도를 계산해 persona_similarity_cache에 upsert.
 *
 * 사용자별 상위 TOP_N 쌍만 유지 (그 외 본 사용자가 포함된 행은 삭제).
 *
 * 환경변수 (둘 다 필수):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY   ← service role, 절대 클라이언트에 노출 금지
 *
 * 로컬: `.env.local`(gitignored)에 두고 `node --env-file=.env.local scripts/refresh-persona-similarity.mjs`
 * CI: GitHub Actions Secrets로 주입 (.github/workflows/refresh-similarity.yml 참고)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "[refresh-persona-similarity] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — refusing to run.",
  );
  process.exit(1);
}

// 안전장치: VITE_ 접두사 키가 잘못 주입된 경우 거부 (publishable key로는 RLS에 막혀 실패)
if (SERVICE_ROLE.length < 100) {
  console.error(
    "[refresh-persona-similarity] SUPABASE_SERVICE_ROLE_KEY가 비정상적으로 짧아요. publishable key가 잘못 들어간 게 아닌지 확인하세요.",
  );
  process.exit(1);
}

const TOP_N = 20; // 사용자당 보관할 최대 닿는 사람 수
const MIN_SCORE = 0.05; // 너무 약한 결은 저장하지 않음

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Jaccard similarity over two keyword sets. */
function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return { score: 0, shared: [] };
  const shared = [];
  for (const k of setA) if (setB.has(k)) shared.push(k);
  const union = new Set([...setA, ...setB]).size;
  return { score: shared.length / union, shared };
}

async function fetchLatestPersonaPerUser() {
  // persona_reads의 사용자별 최신 1건만 사용
  const { data, error } = await supabase
    .from("persona_reads")
    .select("user_id, keywords, generated_at")
    .order("generated_at", { ascending: false });

  if (error) throw new Error(`persona_reads 조회 실패: ${error.message}`);

  const latest = new Map(); // user_id -> Set(keywords)
  for (const row of data ?? []) {
    if (latest.has(row.user_id)) continue;
    const kws = Array.isArray(row.keywords)
      ? row.keywords.filter((k) => typeof k === "string" && k.length > 0)
      : [];
    if (kws.length === 0) continue;
    latest.set(row.user_id, new Set(kws));
  }
  return latest;
}

async function main() {
  const startedAt = Date.now();
  console.log("[refresh-persona-similarity] 시작");

  const personas = await fetchLatestPersonaPerUser();
  const users = [...personas.keys()];
  console.log(`  대상 사용자: ${users.length}명`);

  if (users.length < 2) {
    console.log("  사용자가 2명 미만이라 계산할 쌍이 없어요. 종료.");
    return;
  }

  // pairwise — N(N-1)/2
  const perUserTop = new Map(); // user_id -> [{partner, score, shared}, ...]
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i];
      const b = users[j];
      const { score, shared } = jaccard(personas.get(a), personas.get(b));
      if (score < MIN_SCORE) continue;

      for (const [self, partner] of [
        [a, b],
        [b, a],
      ]) {
        const arr = perUserTop.get(self) ?? [];
        arr.push({ partner, score, shared });
        perUserTop.set(self, arr);
      }
    }
  }

  // 사용자별 상위 TOP_N만 남기고 유지할 쌍 집합 계산 (user_a < user_b 정규화)
  const keepPairs = new Map(); // key "a|b" -> { user_a, user_b, score, shared_keywords }
  for (const [self, list] of perUserTop) {
    list.sort((x, y) => y.score - x.score);
    for (const item of list.slice(0, TOP_N)) {
      const [user_a, user_b] = self < item.partner ? [self, item.partner] : [item.partner, self];
      const key = `${user_a}|${user_b}`;
      if (!keepPairs.has(key)) {
        keepPairs.set(key, {
          user_a,
          user_b,
          score: item.score,
          shared_keywords: item.shared,
        });
      }
    }
  }

  const rows = [...keepPairs.values()].map((r) => ({
    ...r,
    computed_at: new Date().toISOString(),
  }));
  console.log(`  upsert 대상 쌍: ${rows.length}개`);

  // 전체 캐시 삭제 후 upsert (이번 실행에 포함되지 않은 사용자의 stale 행도 정리)
  const { error: delErr } = await supabase
    .from("persona_similarity_cache")
    .delete()
    .gte("computed_at", "1970-01-01"); // 모든 행
  if (delErr) throw new Error(`기존 캐시 삭제 실패: ${delErr.message}`);

  if (rows.length > 0) {
    // 안전한 청크 단위 upsert
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("persona_similarity_cache")
        .upsert(chunk, { onConflict: "user_a,user_b" });
      if (error) throw new Error(`upsert 실패: ${error.message}`);
    }
  }

  const ms = Date.now() - startedAt;
  console.log(`[refresh-persona-similarity] 완료 — ${rows.length} 쌍, ${ms}ms`);
}

main().catch((err) => {
  console.error("[refresh-persona-similarity] 실패:", err);
  process.exit(1);
});
