import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/storage-img";
import { fetchSafetyProfile, deleteAccount } from "@/lib/safety";
import { pageTitle } from "@/lib/brand";
import { checkPushPermission, registerPush, type PushPermission } from "@/lib/push";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/me/")({
  head: () => ({ meta: [{ title: pageTitle("나") }] }),
  component: MePage,
});

function notifLabel(perm: PushPermission | undefined): string {
  if (!perm || perm === "web") return "웹";
  if (perm === "granted") return "켜짐";
  if (perm === "denied") return "꺼짐";
  return "꺼짐";
}

function MePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("display_name, avatar_url, photos")
        .eq("id", uid)
        .maybeSingle();
      return { profile };
    },
  });

  const { data: safety } = useQuery({
    queryKey: ["safety-profile"],
    queryFn: fetchSafetyProfile,
  });

  const { data: pushPerm, isLoading: pushLoading } = useQuery({
    queryKey: ["push-permission"],
    queryFn: () => checkPushPermission(),
    staleTime: 30_000,
  });

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

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

  const onEnablePush = async () => {
    setEnablingPush(true);
    track("notif_enable_tap", { source: "me" });
    try {
      const result = await registerPush();
      await qc.invalidateQueries({ queryKey: ["push-permission"] });
      if (result === "granted") {
        toast.success("알림을 켰어요", { description: "플로티가 도착하면 알려 드릴게요." });
      } else if (result === "denied") {
        toast.error("알림이 꺼져 있어요", { description: "기기 설정에서 알림을 허용해 주세요." });
      } else {
        toast("웹에서는 앱 알림으로 알려 드려요", { description: "상단 종 아이콘을 확인해 주세요." });
      }
    } finally {
      setEnablingPush(false);
    }
  };

  const p = data?.profile;
  const photo = p?.photos?.[0] ?? p?.avatar_url;
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

        <section className="fl-me-id-row">
          {photo ? (
            <StorageImg src={photo} alt="" className="fl-me-id-av" />
          ) : (
            <div className="fl-me-id-av empty" />
          )}
          <span className="fl-me-id-name">{p?.display_name ?? "…"}</span>
        </section>

        <nav className="fl-me-nav">
          <Link to="/me/edit" className="fl-me-nav-item">프로필 수정</Link>
          <Link to="/verify" className="fl-me-nav-item">
            본인인증
            <span>{safety?.identity_verified_at ? "완료" : "필요"}</span>
          </Link>
          <Link to="/me/blocked" className="fl-me-nav-item">차단 목록</Link>

          <div className="fl-me-nav-item fl-me-notif" role="group" aria-label="알림">
            <div className="fl-me-notif-text">
              <span className="fl-me-notif-title">알림</span>
              {pushLoading && <span className="fl-me-notif-desc">확인 중…</span>}
              {!pushLoading && pushPerm === "web" && (
                <span className="fl-me-notif-desc">
                  앱에서 푸시를 받을 수 있어요 · 웹은 종 아이콘 인앱 알림
                </span>
              )}
              {!pushLoading && pushPerm === "denied" && (
                <span className="fl-me-notif-desc">기기 설정에서 알림을 허용해 주세요</span>
              )}
              {!pushLoading && pushPerm === "granted" && (
                <span className="fl-me-notif-desc">플로티 도착·답장을 푸시로 받아요</span>
              )}
              {!pushLoading && pushPerm === "prompt" && (
                <span className="fl-me-notif-desc">아직 허용하지 않았어요</span>
              )}
            </div>
            {!pushLoading && pushPerm === "prompt" ? (
              <button
                type="button"
                className="fl-me-notif-btn"
                disabled={enablingPush}
                onClick={onEnablePush}
              >
                {enablingPush ? "…" : "알림 켜기"}
              </button>
            ) : (
              <span>{pushLoading ? "…" : notifLabel(pushPerm)}</span>
            )}
          </div>

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
