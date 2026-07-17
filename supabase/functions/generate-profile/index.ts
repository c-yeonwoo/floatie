// Supabase Edge Function — generate an AI profile draft from interview answers.
//
// Input:  { answers: string[] }   (the 3 self-intro question answers)
// Output: { intro: string, tags: string[] }
//
// Uses Anthropic Claude (Haiku — fast/cheap) to write a warm, first-person-ish
// intro paragraph + interest tags in Korean. Requires the ANTHROPIC_API_KEY
// secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// The client (src/lib/profile-ai.ts) falls back to a local template if this
// function errors or isn't deployed, so onboarding always works.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `너는 라이트 소셜 앱 "플로티"의 프로필 작가야.
사용자가 자기소개 질문 3개에 답한 내용을 받아서:
- "intro": 따뜻하고 담백한 3인칭 소개문 2~3문장 (한국어, 존댓말 어미 "~이에요/~해요", 과장·이모지·해시태그 금지, 100자 내외)
- "tags": 관심사/성향 해시태그 3~6개 (각 "#단어" 형식, 한국어)
답변이 비어 있으면 무리하게 지어내지 말고 있는 내용만 반영해.
반드시 JSON만 출력: {"intro": "...", "tags": ["#..", "#.."]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const { answers } = await req.json();
    if (!Array.isArray(answers)) return json({ error: "answers[] required" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);

    const userText = (answers as string[])
      .map((a, i) => `Q${i + 1}. ${["가장 마음이 편해지는 순간", "요즘 빠져 있는 것", "좋아하는 대화"][i] ?? ""}\nA. ${a || "(무응답)"}`)
      .join("\n\n");

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: userText }],
      }),
    });

    if (!resp.ok) return json({ error: `anthropic ${resp.status}` }, 502);
    const data = await resp.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "no json in response" }, 502);
    const parsed = JSON.parse(match[0]);
    const intro = typeof parsed.intro === "string" ? parsed.intro : "";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 6)
      : [];
    return json({ intro, tags });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
