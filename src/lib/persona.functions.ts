import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOVABLE_API_KEY_ENV = "LOVABLE_API_KEY";

export const generatePersonaRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({}).optional())
  .handler(async ({ context }) => {
    const apiKey = process.env[LOVABLE_API_KEY_ENV];
    if (!apiKey) throw new Error("AI 키가 설정되지 않았어.");

    const { supabase, userId } = context;
    const { data: answers, error } = await supabase
      .from("answers")
      .select("photos, questions(text, category)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) throw new Error(error.message);
    if (!answers || answers.length < 3) {
      throw new Error("기록이 3개 이상 모이면 너의 결을 읽어줄 수 있어.");
    }

    const corpus = answers
      .map((a: any, i: number) => {
        const q = a.questions;
        const photoCount = (a.photos ?? []).length;
        return `${i + 1}. [${q?.category ?? ""}] ${q?.text ?? ""} → 사진 ${photoCount}장으로 답함`;
      })
      .join("\n");

    const systemPrompt = `너는 사진 답변형 SNS '결'의 따뜻한 큐레이터야. 사용자가 어떤 질문에 사진으로 답했는지를 보고, 그 사람이 어디에 시선이 머무는지 그 결을 부드럽게 해석해줘.

규칙:
- 반드시 한국어 반말로.
- 단정/평가/진단하지 마. "이런 결이 느껴져", "~인 것 같아" 같은 해석체로.
- 부정적이거나 평가하는 표현 금지.
- 3~4문장의 따뜻한 요약 + 그 사람을 압축하는 짧은 키워드 4~6개.
- 키워드는 한국어 단어, 띄어쓰기 없이 (예: "오후의빛", "조용한관찰자").
- JSON으로만 답해: {"summary": "...", "keywords": ["...", "..."]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `다음은 한 사용자가 사진으로 답한 질문들이야. 어떤 질문에 시선이 머물렀는지 보고 그 사람의 결을 읽어줘:\n\n${corpus}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("잠시 후 다시 시도해줘.");
      if (res.status === 402) throw new Error("AI 사용량이 부족해.");
      throw new Error(`AI 호출 실패: ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as any;
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { summary: string; keywords: string[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI 응답을 읽지 못했어.");
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
