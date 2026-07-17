import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/storage-img";
import { ageBand } from "@/lib/mission";
import { fetchSafetyProfile, deleteAccount } from "@/lib/safety";
import { profileMetaLine } from "@/lib/interview-chips";

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
        .select(
          "display_name, bio, avatar_url, birth_year, region, gender, photos, height_cm, job_chip, smoke, ai_intro, ai_ideal_line",
        )
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
  const photo = p?.photos?.[0] ?? p?.avatar_url;
  const intro = p?.ai_intro ?? p?.bio;
  const meta = profileMetaLine({
    height_cm: p?.height_cm,
    job_chip: p?.job_chip,
    smoke: p?.smoke,
  });

  return (
    <main className="fl-me">
      <header className="fl-me-top">
        <Link to="/home" className="fl-me-link">← 바다</Link>
        <h1 className="fl-me-title">나</h1>
        <button type="button" onClick={onLogout} className="fl-me-link">
          로그아웃
        </button>
      </header>

      <div className="fl-me-body">
        {isLoading && <p className="fl-me-hint">불러오는 중…</p>}

        <section className="fl-me-card">
          {photo ? (
            <StorageImg src={photo} alt="" className="fl-me-avatar" />
          ) : (
            <div className="fl-me-avatar empty" />
          )}
          <h2 className="fl-me-name">{p?.display_name ?? "…"}</h2>
          <p className="fl-me-meta">
            {[ageBand(p?.birth_year), p?.region, meta].filter(Boolean).join(" · ") ||
              "프로필을 채워 주세요"}
          </p>
          {intro && <p className="fl-me-intro">{intro}</p>}
          {p?.ai_ideal_line && (
            <p className="fl-me-ideal">이런 사람에게 끌려요 · {p.ai_ideal_line}</p>
          )}
          <p className="fl-me-hint center">
            열리기 전에는 거의 보이지 않아요. 서로 좋다고 하면 그때 공유돼요.
          </p>
        </section>

        <nav className="fl-me-nav">
          <Link to="/me/edit" className="fl-me-nav-item">프로필 수정</Link>
          <Link to="/verify" className="fl-me-nav-item">
            본인인증
            <span>{safety?.identity_verified_at ? "완료" : "필요"}</span>
          </Link>
          <Link to="/me/blocked" className="fl-me-nav-item">차단 목록</Link>
          {safety?.is_admin && (
            <Link to="/admin/reports" className="fl-me-nav-item">관리자 · 신고 검토</Link>
          )}
          <Link to="/terms" className="fl-me-nav-item muted">이용약관</Link>
          <Link to="/privacy" className="fl-me-nav-item muted">개인정보 처리방침</Link>
        </nav>

        <section className="fl-me-danger">
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="fl-me-leave">
              회원 탈퇴
            </button>
          ) : (
            <div className="fl-me-leave-box">
              <p className="t">정말 탈퇴할까요?</p>
              <p className="d">계정과 모든 미션·대화·프로필이 영구 삭제되고, 되돌릴 수 없어요.</p>
              <div className="row">
                <button type="button" disabled={deleting} onClick={onDelete} className="danger">
                  {deleting ? "탈퇴 중…" : "영구 탈퇴하기"}
                </button>
                <button type="button" disabled={deleting} onClick={() => setConfirming(false)}>
                  취소
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
