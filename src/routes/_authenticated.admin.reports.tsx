import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminReviewReport,
  fetchPendingReports,
  fetchSafetyProfile,
  type AdminReport,
} from "@/lib/safety";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "신고 검토 — 플로티" }] }),
  component: AdminReportsPage,
});

function AdminReportsPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["safety-profile"],
    queryFn: fetchSafetyProfile,
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-pending-reports"],
    enabled: !!me?.is_admin,
    queryFn: fetchPendingReports,
  });

  const review = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number;
      action: "dismiss" | "ban";
    }) => adminReviewReport(id, action),
    onSuccess: (_, v) => {
      toast.success(v.action === "ban" ? "영구 제명 처리했어요." : "신고를 기각했어요.");
      qc.invalidateQueries({ queryKey: ["admin-pending-reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });

  if (me && !me.is_admin) {
    return (
      <main className="px-5 py-10">
        <p className="text-sm text-muted-foreground">관리자만 접근할 수 있어요.</p>
        <Link to="/home" className="mt-4 inline-block text-sm underline">
          홈으로
        </Link>
      </main>
    );
  }

  return (
    <main className="px-5 py-8 pb-16">
      <header className="mb-6">
        <Link to="/me" className="text-sm text-muted-foreground">
          ← 나
        </Link>
        <h1 className="font-serif text-3xl mt-2">신고 검토</h1>
        <p className="text-sm text-muted-foreground mt-2">
          검토 후 기각하거나 영구 제명할 수 있어요.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}
      {!isLoading && reports.length === 0 && (
        <p className="text-sm text-muted-foreground">대기 중인 신고가 없어요.</p>
      )}

      <ul className="space-y-4">
        {reports.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            busy={review.isPending}
            onDismiss={() => review.mutate({ id: r.id, action: "dismiss" })}
            onBan={() => {
              if (confirm("이 유저를 영구 제명할까요? 되돌리기 어렵습니다.")) {
                review.mutate({ id: r.id, action: "ban" });
              }
            }}
          />
        ))}
      </ul>
    </main>
  );
}

function ReportCard({
  report,
  busy,
  onDismiss,
  onBan,
}: {
  report: AdminReport;
  busy: boolean;
  onDismiss: () => void;
  onBan: () => void;
}) {
  return (
    <li className="rounded-2xl border border-border px-4 py-4">
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>#{report.id} · {report.target_type}</span>
        <span>{new Date(report.created_at).toLocaleString("ko-KR")}</span>
      </div>
      <p className="font-medium text-[15px]">{report.reason}</p>
      {report.detail && (
        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{report.detail}</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground break-all">
        target_user: {report.target_user_id ?? "(delivery에서 추정)"}
        {report.target_delivery_id ? ` · delivery #${report.target_delivery_id}` : ""}
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="flex-1 rounded-full border border-border py-2.5 text-sm disabled:opacity-40"
        >
          기각
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onBan}
          className="flex-1 rounded-full bg-foreground text-background py-2.5 text-sm disabled:opacity-40"
        >
          영구 제명
        </button>
      </div>
    </li>
  );
}
