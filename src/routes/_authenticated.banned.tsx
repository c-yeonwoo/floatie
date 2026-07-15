import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchSafetyProfile } from "@/lib/safety";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/banned")({
  head: () => ({ meta: [{ title: "이용 제한 — 플로티" }] }),
  component: BannedPage,
});

function BannedPage() {
  const { data } = useQuery({
    queryKey: ["safety-profile"],
    queryFn: fetchSafetyProfile,
  });

  return (
    <main className="px-6 py-16 max-w-sm mx-auto text-center">
      <h1 className="font-serif text-3xl">이용이 제한됐어요</h1>
      <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
        신고 검토 결과 계정이 영구 제명되었습니다.
        {data?.ban_reason ? ` 사유: ${data.ban_reason}` : ""}
      </p>
      <button
        type="button"
        className="mt-8 text-sm underline text-muted-foreground"
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = "/login";
        }}
      >
        로그아웃
      </button>
      <p className="mt-6 text-xs text-muted-foreground">
        문의가 필요하면 지원 채널로 연락해 주세요.
      </p>
      <Link to="/terms" className="mt-4 inline-block text-xs underline text-muted-foreground">
        이용약관
      </Link>
    </main>
  );
}
