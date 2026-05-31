import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "비밀번호 재설정 — 결" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase recovery 링크는 hash에 access_token을 담아 옴 → onAuthStateChange가 PASSWORD_RECOVERY 발생
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // 이미 세션이 복구된 경우
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 해요.");
      return;
    }
    if (password !== confirm) {
      toast.error("비밀번호가 일치하지 않아요.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("비밀번호가 변경되었어요.");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-12">
          <h1 className="font-serif text-5xl tracking-tighter text-foreground">결</h1>
        </Link>
        <h2 className="text-center text-lg mb-2">새 비밀번호 설정</h2>
        <p className="text-center text-sm text-muted-foreground mb-8">
          {ready ? "새로운 비밀번호를 입력해 주세요." : "링크를 확인하는 중이에요..."}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">새 비밀번호</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready}
              className="mt-1 w-full bg-transparent border-b border-border py-2 outline-none focus:border-foreground transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">비밀번호 확인</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!ready}
              className="mt-1 w-full bg-transparent border-b border-border py-2 outline-none focus:border-foreground transition-colors disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !ready}
            className="w-full bg-foreground text-background py-3 rounded-md text-sm font-medium mt-6 disabled:opacity-50"
          >
            {loading ? "변경하는 중..." : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </main>
  );
}
