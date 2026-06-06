import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "환영합니다 — 숨결" }] }),
  component: OnboardingPage,
});

type Step = "name" | "intro-1" | "intro-2" | "intro-3" | "intro-4";
const ORDER: Step[] = ["name", "intro-1", "intro-2", "intro-3", "intro-4"];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, onboarded")
        .eq("id", uid)
        .maybeSingle();
      if (prof?.onboarded) {
        navigate({ to: "/home" });
        return;
      }
      if (prof?.display_name && !prof.display_name.startsWith("user_")) {
        setDisplayName(prof.display_name);
      }
    })();
  }, [navigate]);

  const goNext = () => {
    const i = ORDER.indexOf(step);
    if (i < ORDER.length - 1) setStep(ORDER[i + 1]);
  };
  const goBack = () => {
    const i = ORDER.indexOf(step);
    if (i > 0) setStep(ORDER[i - 1]);
  };

  const handleNameNext = () => {
    const name = displayName.trim();
    if (!name) return toast.error("닉네임을 입력해 주세요.");
    if (name.length > 40) return toast.error("닉네임은 40자 이하예요.");
    goNext();
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          onboarded: true,
        })
        .eq("id", uid);
      if (error) throw error;
      toast.success("숨결을 시작해 볼까요?");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = ORDER.indexOf(step);

  return (
    <main className="min-h-[100dvh] bg-background flex flex-col px-6 py-10">
      {/* progress */}
      <div className="flex gap-1.5 mb-10">
        {ORDER.map((s, i) => (
          <span
            key={s}
            className={
              "h-1 flex-1 rounded-full transition-colors " +
              (i <= stepIndex ? "bg-foreground" : "bg-border")
            }
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
        {step === "name" && (
          <div>
            <div className="text-center mb-10">
              <h1 className="font-serif text-3xl">반가워요</h1>
              <p className="text-[15px] text-muted-foreground mt-3 leading-relaxed">
                숨결에서 사용할 이름을 정해 주세요.
              </p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                닉네임
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                placeholder="당신의 이름"
                className="mt-2 w-full bg-transparent border-b border-border py-2 text-base outline-none focus:border-foreground"
              />
              <p className="text-xs text-muted-foreground/70 mt-2">
                언제든지 프로필에서 바꿀 수 있어요.
              </p>
            </div>
          </div>
        )}

        {step === "intro-1" && (
          <IntroSlide
            eyebrow="숨결이란"
            title={"숨 쉬듯 가볍게,\n하루 한 장."}
            body={
              "매일 던져지는 가벼운 질문에 사진 한 장과 짧은 캡션으로 답하세요. 잘 찍지 않아도, 잘 쓰지 않아도 괜찮아요."
            }
          />
        )}

        {step === "intro-2" && (
          <IntroSlide
            eyebrow="숨 · 결"
            title={"한 번의 답은 \u2018숨\u2019,\n쌓이면 \u2018결\u2019이 돼요."}
            body={
              "하나의 답변은 가벼운 한 호흡, ‘숨’이에요. 그 숨이 모이면 나만의 무늬, ‘결’이 드러나요."
            }
          />
        )}

        {step === "intro-3" && (
          <IntroSlide
            eyebrow="둘러보기"
            title={"오늘의 숨 · 피드 ·\n탐색 · 나"}
            body={
              "오늘의 숨에서 답하고, 피드에서 친구의 숨을 보고, 탐색에서 같은 질문의 다른 결을 만나요. ‘나’에서는 내 결이 그려져요."
            }
          />
        )}

        {step === "intro-4" && (
          <IntroSlide
            eyebrow="너의 결"
            title={"답이 모이면\nAI가 결을 읽어줘요."}
            body={
              "충분히 답하고 나면, ‘너는 이런 결의 사람이야’ 하고 부드럽게 읽어드려요. 결이 닿는 사람들도 만날 수 있어요."
            }
          />
        )}
      </div>

      <div className="max-w-sm w-full mx-auto mt-8 space-y-3">
        {step === "name" ? (
          <button
            onClick={handleNameNext}
            className="w-full bg-foreground text-background py-3.5 rounded-md text-[15px] font-medium"
          >
            다음
          </button>
        ) : step === "intro-4" ? (
          <button
            onClick={finishOnboarding}
            disabled={saving}
            className="w-full bg-foreground text-background py-3.5 rounded-md text-[15px] font-medium disabled:opacity-50"
          >
            {saving ? "시작하는 중..." : "시작하기"}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="w-full bg-foreground text-background py-3.5 rounded-md text-[15px] font-medium"
          >
            다음
          </button>
        )}

        {step !== "name" && (
          <button
            onClick={goBack}
            className="w-full py-2 text-sm text-muted-foreground"
          >
            이전
          </button>
        )}
      </div>
    </main>
  );
}

function IntroSlide({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <span className="text-xs uppercase tracking-widest text-accent font-semibold">
        {eyebrow}
      </span>
      <h2 className="font-serif text-[28px] mt-3 leading-snug whitespace-pre-line break-keep [word-break:keep-all]">
        {title}
      </h2>
      <p className="text-[15px] text-muted-foreground mt-5 leading-relaxed break-keep [word-break:keep-all]">
        {body}
      </p>
    </div>
  );
}
