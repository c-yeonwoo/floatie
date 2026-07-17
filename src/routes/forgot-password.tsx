import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: pageTitle("비밀번호 찾기") }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-serif text-3xl mb-4">메일을 보냈어요</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="text-foreground">{email}</span> 으로 비밀번호 재설정
            링크를 보냈어요.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-block text-[11px] uppercase tracking-widest text-tide-deep font-semibold"
          >
            로그인 화면으로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-12">
          <h1 className="font-serif text-5xl tracking-tight text-foreground">플로티</h1>
        </Link>
        <h2 className="text-center text-lg mb-2">비밀번호를 잊으셨나요?</h2>
        <p className="text-center text-sm text-muted-foreground mb-8">
          가입한 이메일로 재설정 링크를 보내드릴게요.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full bg-transparent border-b border-border py-2 outline-none focus:border-foreground transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-foreground text-background py-3 rounded-md text-sm font-medium mt-6 disabled:opacity-50"
          >
            {loading ? "보내는 중..." : "재설정 링크 보내기"}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-tide-deep font-semibold">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}
