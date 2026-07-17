// Supabase Edge Function — AI profile draft (story sections + ideal + tags).
//
// Input:  {
//   answers: string[],          // S1–S3 text + S4 chip
//   ideal?: { vibes, pace },
//   profile?: { displayName, gender, birthYear, region, heightCm, jobChip, smoke, drink, tattoo }
// }
// Output: { sections: [{heading, body}], ideal_line, tags }  (+ intro flat for compat)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `너는 라이트 소셜 앱 "플로티"의 프로필 작가야.
사용자는 인터뷰에 단답(예: "테니스", "책임감 강함")을 쓰는 경우가 많아.
먼저 아래 [기본 정보]·[나]·[끌리는 사람]을 모두 읽고 이 사람을 파악한 뒤(이 단계는 출력하지 마),
그 이해를 바탕으로 JSON만 출력해.

규칙:
- 단답은 같은 말 반복이 아니라, 다른 답·팩트·칩과 "연결"해서 풀어 써.
- 답·칩·팩트에 없는 장면·횟수·감정·취미·직업 디테일은 절대 지어내지 마.
- 추론 허용: "테니스 + 쉬는 날 + 직장인" → 쉬는 날 운동으로 푸는 사람 정도로만. "주 3회 코트" 같은 구체 창작 금지.
- 톤: 따뜻·담백, 한국어 존댓말("~이에요/~해요"), 과장·이모지·해시태그(본문) 금지.

출력:
- "sections": 이야기 챕터 정확히 3개. {"heading":"짧은 제목(6자 내)","body":"3~5문장, 약 80~140자"}.
  흐름: 요즘의 나(관심) → 쉬는 날/일상 → 주변이 보는 나·연애관.
- "ideal_line": 끌리는 사람 한 문장. 「~랑 잘 맞을 것 같아요」톤. 단정·조건 강제 금지. 칩 없으면 "".
- "tags": 관심사 태그 3~6개 (각 "#단어"). 답에서 뽑고, 없으면 일상 톤 태그.

반드시 JSON만:
{"sections":[{"heading":"...","body":"..."}],"ideal_line":"...","tags":["#.."]}`;

const SELF_LABELS = [
  "요즘 빠져 있는 것",
  "쉬는 날 보내는 방식",
  "주변에서 자주 듣는 말",
  "연애에서 가까운 쪽",
];

type ProfileIn = {
  displayName?: string | null;
  gender?: string | null;
  birthYear?: number | null;
  region?: string | null;
  heightCm?: number | null;
  jobChip?: string | null;
  smoke?: string | null;
  drink?: string | null;
  tattoo?: string | null;
};

function profileBlock(p: ProfileIn | null | undefined): string {
  if (!p || typeof p !== "object") return "[기본 정보]\n(없음)";
  const gender =
    p.gender === "female" ? "여자" : p.gender === "male" ? "남자" : p.gender || "";
  const lines = [
    p.displayName && `닉네임: ${p.displayName}`,
    gender && `성별: ${gender}`,
    p.birthYear != null && `출생연도: ${p.birthYear}`,
    p.region && `지역: ${p.region}`,
    p.heightCm != null && `키: ${p.heightCm}cm`,
    p.jobChip && `하는 일: ${p.jobChip}`,
    p.smoke && `흡연: ${p.smoke}`,
    p.drink && `음주: ${p.drink}`,
    p.tattoo && `타투: ${p.tattoo}`,
  ].filter(Boolean);
  return `[기본 정보]\n${lines.length ? lines.join("\n") : "(없음)"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const answers = body?.answers;
    const ideal = body?.ideal;
    const profile = body?.profile as ProfileIn | null | undefined;
    if (!Array.isArray(answers)) return json({ error: "answers[] required" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);

    const selfBlock = (answers as string[])
      .map((a, i) => `Q${i + 1}. ${SELF_LABELS[i] ?? ""}\nA. ${a || "(무응답)"}`)
      .join("\n\n");

    const vibes = Array.isArray(ideal?.vibes) ? ideal.vibes.filter((x: unknown) => typeof x === "string") : [];
    const pace = typeof ideal?.pace === "string" ? ideal.pace : "";
    const idealBlock =
      vibes.length || pace
        ? `\n\n[끌리는 사람]\n분위기 칩: ${vibes.join(", ") || "(없음)"}\n리듬 칩: ${pace || "(없음)"}`
        : "\n\n[끌리는 사람]\n(없음)";

    const userContent = `${profileBlock(profile)}\n\n[나]\n${selfBlock}${idealBlock}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) return json({ error: `anthropic ${resp.status}` }, 502);
    const data = await resp.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "no json in response" }, 502);
    const parsed = JSON.parse(match[0]);

    const sections = Array.isArray(parsed.sections)
      ? parsed.sections
          .filter((s: unknown) => s && typeof s === "object")
          .map((s: { heading?: string; body?: string }) => ({
            heading: typeof s.heading === "string" ? s.heading : "",
            body: typeof s.body === "string" ? s.body : "",
          }))
          .filter((s: { body: string }) => s.body.trim())
          .slice(0, 3)
      : [];

    const ideal_line = typeof parsed.ideal_line === "string" ? parsed.ideal_line : "";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 6)
      : [];

    const intro = sections
      .map((s: { heading: string; body: string }) => `## ${s.heading || "소개"}\n${s.body}`)
      .join("\n\n");

    return json({ sections, intro, ideal_line, tags });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
