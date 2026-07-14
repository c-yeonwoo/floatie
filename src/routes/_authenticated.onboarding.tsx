import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "시작하기 — 쪽지" }] }),
  component: OnboardingPage,
});

type Step = "name" | "prefs" | "intro";
const ORDER: Step[] = ["name", "prefs", "intro"];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other" | "">("");
  const [birthYear, setBirthYear] = useState("");
  const [preferGender, setPreferGender] = useState<"female" | "male" | "any">("any");
  const [region, setRegion] = useState("");
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

  const handlePrefsNext = () => {
    if (!gender) return toast.error("성별을 선택해 주세요.");
    const year = Number(birthYear);
    if (!year || year < 1920 || year > 2008) {
      return toast.error("출생 연도를 확인해 주세요. (만 18+만 이용 가능)");
    }
    goNext();
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          gender,
          birth_year: Number(birthYear),
          prefer_gender: preferGender,
          region: region.trim() || null,
          onboarded: true,
        })
        .eq("id", uid);
      if (error) throw error;
      toast.success("쪽지를 시작해 볼까요?");
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
                unlock 후에만 보이는 닉네임이에요.
              </p>
            </div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              닉네임
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="닉네임"
              className="mt-2 w-full bg-transparent border-b border-border py-2 text-base outline-none focus:border-foreground"
            />
          </div>
        )}

        {step === "prefs" && (
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-3xl">기본 정보</h1>
              <p className="text-[15px] text-muted-foreground mt-2">
                매칭 가드에만 쓰여요. unlock 전엔 상대에게 거의 안 보여요.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">성별</p>
              <div className="flex gap-2">
                {(
                  [
                    ["female", "여성"],
                    ["male", "남성"],
                    ["other", "기타"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGender(v)}
                    className={
                      "flex-1 rounded-full border py-2 text-sm " +
                      (gender === v ? "border-foreground bg-foreground text-background" : "border-border")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">출생 연도</p>
              <input
                type="number"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="예: 1998"
                className="w-full rounded-xl border border-border px-3 py-2.5 text-[15px]"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">받고 싶은 쪽지 (성별)</p>
              <div className="flex gap-2">
                {(
                  [
                    ["any", "상관없음"],
                    ["female", "여성"],
                    ["male", "남성"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPreferGender(v)}
                    className={
                      "flex-1 rounded-full border py-2 text-sm " +
                      (preferGender === v
                        ? "border-foreground bg-foreground text-background"
                        : "border-border")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">지역 (선택, 시 단위)</p>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="예: 서울"
                className="w-full rounded-xl border border-border px-3 py-2.5 text-[15px]"
              />
            </div>
          </div>
        )}

        {step === "intro" && (
          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">쪽지</span>
            <h2 className="font-serif text-[28px] mt-3 leading-snug">
              익명으로 미션이 오고,
              <br />
              서로 OK면 열려요.
            </h2>
            <p className="text-[15px] text-muted-foreground mt-5 leading-relaxed">
              가벼운 질문이나 미션에 답해 보세요. 한쪽만 OK면 정체는 비밀로 남아요. 패스해도 괜찮아요.
            </p>
          </div>
        )}
      </div>

      <div className="max-w-sm w-full mx-auto mt-8 space-y-3">
        {step === "name" && (
          <button
            type="button"
            onClick={handleNameNext}
            className="w-full bg-foreground text-background py-3.5 rounded-md text-[15px] font-medium"
          >
            다음
          </button>
        )}
        {step === "prefs" && (
          <button
            type="button"
            onClick={handlePrefsNext}
            className="w-full bg-foreground text-background py-3.5 rounded-md text-[15px] font-medium"
          >
            다음
          </button>
        )}
        {step === "intro" && (
          <button
            type="button"
            onClick={finishOnboarding}
            disabled={saving}
            className="w-full bg-foreground text-background py-3.5 rounded-md text-[15px] font-medium disabled:opacity-50"
          >
            {saving ? "시작하는 중..." : "시작하기"}
          </button>
        )}
        {step !== "name" && (
          <button type="button" onClick={goBack} className="w-full py-2 text-sm text-muted-foreground">
            이전
          </button>
        )}
      </div>
    </main>
  );
}
