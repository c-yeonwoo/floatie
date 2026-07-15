import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchUnreadNotifications,
  markNotificationRead,
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
  const deliveryId = n.payload.delivery_id;

  if (n.kind === "mission_arrived" && deliveryId) {
    toast(n.title, {
      description: n.body,
      duration: 8000,
      action: {
        label: "열기",
        onClick: () => {
          onDismiss();
          navigate({ to: "/delivery/$deliveryId", params: { deliveryId: String(deliveryId) } });
        },
      },
    });
    return;
  }

  if (n.kind === "mission_no_response" && deliveryId) {
    toast(n.title, {
      description: n.body,
      duration: 12_000,
      action: {
        label: "다시 보내기",
        onClick: () => {
          onDismiss();
          navigate({ to: "/waiting/$deliveryId", params: { deliveryId: String(deliveryId) } });
        },
      },
    });
    return;
  }

  if (n.kind === "mission_replied" && deliveryId) {
    toast(n.title, {
      description: n.body,
      duration: 8000,
      action: {
        label: "보기",
        onClick: () => {
          onDismiss();
          navigate({ to: "/delivery/$deliveryId", params: { deliveryId: String(deliveryId) } });
        },
      },
    });
    return;
  }

  toast(n.title, { description: n.body, duration: 6000, onDismiss });
}
