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

const SHOWN = new Set<number>();

export function NotificationToasts() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mounted = useRef(false);

  const { data: unread = [] } = useQuery({
    queryKey: ["in-app-notifications"],
    queryFn: fetchUnreadNotifications,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    for (const n of unread) {
      if (SHOWN.has(n.id)) continue;
      SHOWN.add(n.id);
      showNotificationToast(n, navigate, () => {
        markNotificationRead(n.id)
          .then(() => qc.invalidateQueries({ queryKey: ["in-app-notifications"] }))
          .catch(() => {});
      });
    }
  }, [unread, navigate, qc]);

  return null;
}

function showNotificationToast(
  n: InAppNotification,
  navigate: ReturnType<typeof useNavigate>,
  onDismiss: () => void,
) {
  const target = notificationTarget(n);
  const actionLabel =
    n.kind === "mission_no_response"
      ? "다시 보내기"
      : n.kind === "matched"
        ? "대화"
        : "열기";

  if (!target) {
    toast(n.title, { description: n.body, duration: 6000, onDismiss });
    return;
  }

  toast(n.title, {
    description: n.body,
    duration: n.kind === "mission_no_response" ? 12_000 : 8000,
    action: {
      label: actionLabel,
      onClick: () => {
        onDismiss();
        if (target.to === "/thread/$threadId") {
          navigate({ to: target.to, params: target.params });
        } else {
          navigate({ to: "/home", search: target.search ?? {} });
        }
      },
    },
  });
}
