// Supabase Edge Function — AI profile draft from interview answers (v2).
//
// Input:  { answers: string[], ideal?: { vibes: string[], pace: string } }
// Output: { intro: string, ideal_line: string, tags: string[] }
//
// Client falls back to a local template if this errors.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `너는 라이트 소셜 앱 "플로티"의 프로필 작가야.
사용자가 "나"에 대한 답(~70%)과 "끌리는 사람" 칩(~30%)을 줬어. JSON만 출력해:

- "intro": 따뜻하고 담백한 3인칭 소개 2~3문장 (한국어, "~이에요/~해요", 과장·이모지·해시태그 금지, 100자 내외). 나 중심.
- "ideal_line": 끌리는 사람 한 문장. 「이런 사람과 잘 맞을 것 같아요」톤. 단정·평가·조건 강제 금지. 칩이 없으면 빈 문자열.
- "tags": 관심사/성향 태그 3~6개 (각 "#단어", 한국어). 나 중심.

답변이 비어 있으면 지어내지 마.
반드시 JSON만: {"intro":"...","ideal_line":"...","tags":["#.."]}`;

const SELF_LABELS = [
  "가장 마음이 편해지는 순간",
  "요즘 빠져 있는 것",
  "좋아하는 대화",
  "주말 에너지",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const answers = body?.answers;
    const ideal = body?.ideal;
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

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM,
        messages: [{ role: "user", content: selfBlock + idealBlock }],
      }),
    });

    if (!resp.ok) return json({ error: `anthropic ${resp.status}` }, 502);
    const data = await resp.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "no json in response" }, 502);
    const parsed = JSON.parse(match[0]);
    const intro = typeof parsed.intro === "string" ? parsed.intro : "";
    const ideal_line = typeof parsed.ideal_line === "string" ? parsed.ideal_line : "";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 6)
      : [];
    return json({ intro, ideal_line, tags });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
