import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BRAND_KO, pageTitle } from "@/lib/brand";
import { SeaBanner } from "@/components/sea-banner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: pageTitle("로그인") }],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !agreed) {
      toast.error("이용약관과 개인정보 처리방침에 동의해 주세요.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/home" },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(true);
          return;
        }
        toast.success(`가입이 완료되었어요. ${BRAND_KO}를 시작해 볼까요?`);
        navigate({ to: "/home" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/confirm/i.test(error.message) || /not confirmed/i.test(error.message)) {
            setConfirmSent(true);
            return;
          }
          throw error;
        }
        navigate({ to: "/home" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (mode === "signup" && !agreed) {
      toast.error("이용약관과 개인정보 처리방침에 동의해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/home" },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "구글 로그인에 실패했어요.");
      setLoading(false);
    }
  };

  const onResend = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/home" },
      });
      if (error) throw error;
      toast.success("인증 메일을 다시 보냈어요.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <main className="fixed inset-0 h-[100dvh] overflow-hidden overscroll-none bg-background flex items-center justify-center px-6">

        <div className="w-full max-w-sm text-center">
          <h1 className="font-serif text-3xl mb-4">메일을 보냈어요</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="text-foreground">{email}</span> 으로 인증 메일을
            보냈어요. 메일에 있는 링크를 눌러 가입을 마무리해 주세요.
          </p>
          <p className="text-[12px] text-muted-foreground mt-6">
            메일이 안 보이면 스팸함을 확인해 주세요.
          </p>
          <button
            onClick={onResend}
            disabled={loading}
            className="mt-6 block mx-auto text-[12px] text-foreground underline underline-offset-4 disabled:opacity-50"
          >
            {loading ? "보내는 중..." : "메일 다시 보내기"}
          </button>
          <button
            onClick={() => {
              setConfirmSent(false);
              setMode("signin");
            }}
            className="mt-6 text-[11px] uppercase tracking-widest text-accent underline underline-offset-4"
          >
            로그인 화면으로
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 h-[100dvh] overflow-hidden overscroll-none bg-background flex flex-col">
      <SeaBanner className="h-44 shrink-0" />
      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        <div className="mx-auto w-full max-w-sm pt-7 pb-8">
          <div className="mb-7 text-center">
            <h1 className="font-serif text-4xl tracking-tight text-foreground">플로티</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              가벼운 질문 하나로 시작해요. 서로 좋으면, 그때 열려요.
            </p>
          </div>

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
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">비밀번호</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full bg-transparent border-b border-border py-2 outline-none focus:border-foreground transition-colors"
            />
          </div>

          {mode === "signin" && (
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
          )}



          {mode === "signup" && (
            <label className="flex items-start gap-2 pt-2 text-[12px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 accent-foreground"
              />
              <span>
                <Link to="/terms" className="text-foreground underline underline-offset-4">
                  이용약관
                </Link>
                {" 및 "}
                <Link to="/privacy" className="text-foreground underline underline-offset-4">
                  개인정보 처리방침
                </Link>
                에 동의합니다.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-foreground text-background py-3 rounded-md text-sm font-medium mt-6 disabled:opacity-50"
          >
            {loading ? "잠시만요..." : mode === "signin" ? "들어가기" : "가입하기"}
          </button>
        </form>

        <div className="flex items-center my-5 gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">또는</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={loading}
          className="w-full border border-border py-3 rounded-md text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
        >
          Google로 계속하기
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "처음이신가요?" : "이미 가입하셨나요?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-foreground underline underline-offset-4"
          >
            {mode === "signin" ? "가입하기" : "로그인하기"}
          </button>
        </p>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">이용약관</Link>
          {" · "}
          <Link to="/privacy" className="hover:text-foreground">개인정보 처리방침</Link>
        </p>
        </div>
      </div>
    </main>
  );
}
