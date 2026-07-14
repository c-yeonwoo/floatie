import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/storage-img";
import { ageBand } from "@/lib/mission";
import { fetchSafetyProfile } from "@/lib/safety";

export const Route = createFileRoute("/_authenticated/me/")({
  head: () => ({ meta: [{ title: "나 — 쪽지" }] }),
  component: MePage,
});

function MePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("display_name, handle, bio, avatar_url, birth_year, region, gender")
        .eq("id", uid)
        .maybeSingle();
      return { profile };
    },
  });

  const { data: safety } = useQuery({
    queryKey: ["safety-profile"],
    queryFn: fetchSafetyProfile,
  });

  const onLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const p = data?.profile;

  return (
    <main className="px-5 py-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="font-serif text-[26px]">나</h1>
        <button
          type="button"
          onClick={onLogout}
          className="text-[15px] text-muted-foreground hover:text-foreground"
        >
          로그아웃
        </button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}

      <section className="text-center flex flex-col items-center mb-10">
        {p?.avatar_url ? (
          <StorageImg
            src={p.avatar_url}
            alt=""
            className="size-16 rounded-full object-cover border border-border mb-3"
          />
        ) : (
          <div className="size-16 rounded-full bg-surface border border-border mb-3" />
        )}
        <h2 className="font-serif text-2xl">{p?.display_name ?? "…"}</h2>
        {p?.bio && (
          <p className="text-[13px] text-muted-foreground mt-2 max-w-sm">{p.bio}</p>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {[ageBand(p?.birth_year), p?.region].filter(Boolean).join(" · ") ||
            "프로필을 채워 주세요"}
        </p>
        <p className="text-[12px] text-muted-foreground mt-2 max-w-xs leading-relaxed">
          unlock 전에는 상대에게 거의 보이지 않아요. 서로 OK한 뒤에만 공유됩니다.
        </p>
      </section>

      <nav className="space-y-2">
        <Link
          to="/me/edit"
          className="block rounded-xl border border-border px-4 py-3.5 text-[15px]"
        >
          프로필 수정
        </Link>
        <Link
          to="/verify"
          className="block rounded-xl border border-border px-4 py-3.5 text-[15px]"
        >
          본인인증
          <span className="ml-2 text-xs text-muted-foreground">
            {safety?.identity_verified_at ? "완료" : "필요"}
          </span>
        </Link>
        <Link
          to="/me/blocked"
          className="block rounded-xl border border-border px-4 py-3.5 text-[15px]"
        >
          차단 목록
        </Link>
        {safety?.is_admin && (
          <Link
            to="/admin/reports"
            className="block rounded-xl border border-border px-4 py-3.5 text-[15px]"
          >
            관리자 · 신고 검토
          </Link>
        )}
        <Link
          to="/terms"
          className="block rounded-xl border border-border px-4 py-3.5 text-[15px] text-muted-foreground"
        >
          이용약관
        </Link>
        <Link
          to="/privacy"
          className="block rounded-xl border border-border px-4 py-3.5 text-[15px] text-muted-foreground"
        >
          개인정보 처리방침
        </Link>
      </nav>
    </main>
  );
}
