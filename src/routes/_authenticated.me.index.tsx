import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/storage-img";
import { ageBand } from "@/lib/mission";
import { fetchSafetyProfile, deleteAccount } from "@/lib/safety";

export const Route = createFileRoute("/_authenticated/me/")({
  head: () => ({ meta: [{ title: "나 — 플로티" }] }),
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

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      window.location.href = "/login";
    } catch {
      toast.error("탈퇴에 실패했어요. 잠시 뒤 다시 시도해 주세요.");
      setDeleting(false);
    }
  };

  const p = data?.profile;

  return (
    <main className="px-5 py-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="font-serif text-3xl">나</h1>
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
          열리기 전에는 거의 보이지 않아요. 서로 좋다고 하면 그때 공유돼요.
        </p>
      </section>

      <nav className="space-y-2">
        <Link
          to="/me/edit"
          className="block rounded-2xl bg-secondary px-4 py-3.5 text-[15px]"
        >
          프로필 수정
        </Link>
        <Link
          to="/verify"
          className="block rounded-2xl bg-secondary px-4 py-3.5 text-[15px]"
        >
          본인인증
          <span className="ml-2 text-xs text-muted-foreground">
            {safety?.identity_verified_at ? "완료" : "필요"}
          </span>
        </Link>
        <Link
          to="/me/blocked"
          className="block rounded-2xl bg-secondary px-4 py-3.5 text-[15px]"
        >
          차단 목록
        </Link>
        {safety?.is_admin && (
          <Link
            to="/admin/reports"
            className="block rounded-2xl bg-secondary px-4 py-3.5 text-[15px]"
          >
            관리자 · 신고 검토
          </Link>
        )}
        <Link
          to="/terms"
          className="block rounded-2xl bg-secondary px-4 py-3.5 text-[15px] text-muted-foreground"
        >
          이용약관
        </Link>
        <Link
          to="/privacy"
          className="block rounded-2xl bg-secondary px-4 py-3.5 text-[15px] text-muted-foreground"
        >
          개인정보 처리방침
        </Link>
      </nav>

      <section className="mt-10 pt-6 border-t border-border">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-[13px] text-muted-foreground hover:text-destructive transition-colors"
          >
            회원 탈퇴
          </button>
        ) : (
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-sm font-semibold">정말 탈퇴할까요?</p>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
              계정과 모든 미션·대화·프로필이 영구 삭제되고, 되돌릴 수 없어요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="flex-1 rounded-full bg-destructive text-destructive-foreground py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? "탈퇴 중…" : "영구 탈퇴하기"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-full bg-surface py-2.5 text-sm font-medium"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
