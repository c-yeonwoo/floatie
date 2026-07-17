import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationTarget,
  type InAppNotification,
} from "@/lib/notifications";
import { EmptyState } from "@/components/empty-state";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: pageTitle("알림") }] }),
  component: NotificationsPage,
});

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
  });

  const unread = data.filter((n) => !n.read_at).length;

  const onOpen = async (n: InAppNotification) => {
    if (!n.read_at) {
      markNotificationRead(n.id).catch(() => {});
    }
    const target = notificationTarget(n);
    if (!target) return;
    if (target.to === "/thread/$threadId") {
      navigate({ to: target.to, params: target.params });
    } else {
      navigate({ to: "/home", search: target.search ?? {} });
    }
  };

  const onReadAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["unread-notifications"] });
  };

  return (
    <main className="px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          className="text-[15px] text-muted-foreground hover:text-foreground"
        >
          ← 뒤로
        </button>
        {unread > 0 && (
          <button
            type="button"
            onClick={onReadAll}
            className="text-[13px] text-tide-deep font-semibold"
          >
            모두 읽음
          </button>
        )}
      </header>

      <h1 className="font-serif text-3xl mb-5">알림</h1>

      {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}

      {!isLoading && data.length === 0 && (
        <EmptyState
          title="아직 알림이 없어요"
          description="미션이 도착하거나 답장이 오면 여기에 모여요."
        />
      )}

      <ul className="space-y-2.5">
        {data.map((n) => {
          const unreadRow = !n.read_at;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onOpen(n)}
                className={
                  "w-full text-left rounded-2xl px-4 py-3.5 transition-shadow duration-150 hover:shadow-[var(--shadow-md)] " +
                  (unreadRow ? "bg-warm-wash" : "bg-surface")
                }
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={
                      "mt-1.5 size-2 shrink-0 rounded-full " +
                      (unreadRow ? "bg-warm" : "bg-transparent")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[15px] font-semibold truncate">{n.title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {relTime(n.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground line-clamp-2">
                      {n.body}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
