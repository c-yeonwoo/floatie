import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchUnreadNotifications,
  markNotificationRead,
  notificationTarget,
  type InAppNotification,
} from "@/lib/notifications";

/** Session-scoped: backlog is primed silently; only post-prime arrivals toast. */
const SHOWN = new Set<number>();

export function NotificationToasts() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const primed = useRef(false);
  const toasting = useRef(false);

  const { data: unread = [], isFetched } = useQuery({
    queryKey: ["in-app-notifications"],
    queryFn: fetchUnreadNotifications,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!isFetched) return;

    if (!primed.current) {
      for (const n of unread) SHOWN.add(n.id);
      primed.current = true;
      return;
    }

    if (toasting.current) return;
    const next = unread.find((n) => !SHOWN.has(n.id));
    if (!next) return;

    SHOWN.add(next.id);
    toasting.current = true;
    showNotificationToast(next, navigate, () => {
      toasting.current = false;
      markNotificationRead(next.id)
        .then(() => {
          void qc.invalidateQueries({ queryKey: ["in-app-notifications"] });
        })
        .catch(() => {});
    });
  }, [unread, isFetched, navigate, qc]);

  return null;
}

function showNotificationToast(
  n: InAppNotification,
  navigate: ReturnType<typeof useNavigate>,
  onDone: () => void,
) {
  const target = notificationTarget(n);
  const rewrite = n.kind === "mission_no_response" && n.payload?.can_rewrite;
  const actionLabel =
    n.kind === "mission_redeployed"
      ? "바다 보기"
      : rewrite
        ? "다시 쓰기"
        : n.kind === "mission_no_response"
          ? "다시 보내기"
          : n.kind === "matched"
            ? "대화"
            : "열기";

  const finish = () => onDone();

  if (!target) {
    toast(n.title, { description: n.body, duration: 4500, onDismiss: finish, onAutoClose: finish });
    return;
  }

  toast(n.title, {
    description: n.body,
    duration: n.kind === "mission_no_response" || n.kind === "mission_redeployed" ? 7000 : 4500,
    onDismiss: finish,
    onAutoClose: finish,
    action: {
      label: actionLabel,
      onClick: () => {
        finish();
        if (rewrite && n.payload?.mission_body) {
          try {
            sessionStorage.setItem("floatie_compose_draft", n.payload.mission_body);
          } catch {
            /* ignore */
          }
        }
        if (target.to === "/thread/$threadId") {
          navigate({ to: target.to, params: target.params });
        } else {
          navigate({
            to: "/home",
            search: rewrite ? { compose: true } : (target.search ?? {}),
          });
        }
      },
    },
  });
}
