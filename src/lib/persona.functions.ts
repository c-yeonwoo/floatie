import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOVABLE_API_KEY_ENV = "LOVABLE_API_KEY";
const AI_TIMEOUT_MS = 8000;
const AI_GATEWAY_URL_ENV = "AI_GATEWAY_URL";
const AI_MODEL_ENV = "AI_MODEL";

export const generatePersonaRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ forceRecompute: z.boolean().optional() }).optional())
  .handler(async ({ context, data }) => {
    const apiKey = process.env[LOVABLE_API_KEY_ENV];
    if (!apiKey) throw new Error("AI 키가 설정되지 않았어요.");

    const { supabase, userId } = context;
    const { data: answers, error } = await supabase
      .from("answers")
      .select("photos, questions(text, category)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) throw new Error(error.message);
    if (!answers || answers.length < 3) {
      throw new Error("기록이 3개 이상 모이면 결을 읽어드릴 수 있어요.");
    }

    const { data: latestPersona, error: cacheError } = await supabase
      .from("persona_reads")
      .select("summary, keywords, based_on_count, generated_at")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cacheError) {
      throw new Error(cacheError.message);
    }
    const shouldReuseCache = !data?.forceRecompute;
    if (shouldReuseCache && latestPersona && latestPersona.based_on_count >= answers.length) {
      return {
        summary: latestPersona.summary,
        keywords: latestPersona.keywords ?? [],
        based_on_count: answers.length,
        fromCache: true,
      };
    }

    const aiGatewayUrl = process.env[AI_GATEWAY_URL_ENV] ?? "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = process.env[AI_MODEL_ENV] ?? "google/gemini-2.5-flash";

    const corpus = answers
      .map((a: any, i: number) => {
        const q = a.questions;
        const photoCount = (a.photos ?? []).length;
        return `${i + 1}. [${q?.category ?? ""}] ${q?.text ?? ""} → 사진 ${photoCount}장으로 답함`;
      })
      .join("\n");

    const systemPrompt = `너는 사진 답변형 SNS '숨결'의 따뜻한 큐레이터야. 사용자가 어떤 질문에 사진으로 답했는지를 보고, 그 사람이 어디에 시선이 머무는지 그 결을 부드럽게 해석해줘.

규칙:
- 반드시 한국어 존댓말로 (해요체). 예: "~인 것 같아요", "이런 결이 느껴져요".
- 단정/평가/진단하지 말기. 해석체로 부드럽게.
- 부정적이거나 평가하는 표현 금지.
- 3~4문장의 따뜻한 요약 + 그 사람을 압축하는 짧은 키워드 4~6개.
- 키워드는 한국어 단어, 띄어쓰기 없이 (예: "오후의빛", "조용한관찰자").
- JSON으로만 답해: {"summary": "...", "keywords": ["...", "..."]}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(aiGatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `다음은 한 사용자가 사진으로 답한 질문들이야. 어떤 질문에 시선이 머물렀는지 보고 그 사람의 결을 읽어줘:\n\n${corpus}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("AI 처리 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("잠시 후 다시 시도해 주세요.");
      if (res.status === 402) throw new Error("AI 사용량이 부족해요.");
      throw new Error(`AI 호출에 실패했어요: ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as any;
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { summary: string; keywords: string[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI 응답을 읽지 못했어요.");
    }

    const summary = String(parsed.summary ?? "").slice(0, 600);
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k) => String(k).slice(0, 24)).slice(0, 6)
      : [];

    const { error: insErr } = await supabase.from("persona_reads").insert({
      user_id: userId,
      summary,
      keywords,
      based_on_count: answers.length,
    });
    if (insErr) throw new Error(insErr.message);

    return { summary, keywords, based_on_count: answers.length };
  });
