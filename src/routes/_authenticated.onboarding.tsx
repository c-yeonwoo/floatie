import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "프로필 설정 — 결" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
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

  const onSubmit = async () => {
    const name = displayName.trim();
    if (!name) return toast.error("닉네임을 입력해 주세요.");
    if (name.length > 40) return toast.error("닉네임은 40자 이하예요.");

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          onboarded: true,
        })
        .eq("id", uid);
      if (error) throw error;

      toast.success("결을 시작해 볼까요?");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl">반가워요</h1>
          <p className="text-sm text-muted-foreground mt-2">
            결에서 사용할 이름을 정해 주세요.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
              닉네임
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="당신의 이름"
              className="mt-1 w-full bg-transparent border-b border-border py-2 outline-none focus:border-foreground"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-2">
              언제든지 프로필에서 바꿀 수 있어요.
            </p>
          </div>

          <button
            onClick={onSubmit}
            disabled={saving}
            className="w-full bg-foreground text-background py-3 rounded-md text-sm font-medium mt-6 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "시작하기"}
          </button>
        </div>
      </div>
    </main>
  );
}
