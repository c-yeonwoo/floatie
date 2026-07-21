import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchUnreadNotifications } from "@/lib/notifications";

// Bell that opens the notification center, with a peach unread badge.
export function NotifBell() {
  const { data = [] } = useQuery({
    queryKey: ["in-app-notifications"],
    queryFn: fetchUnreadNotifications,
    refetchInterval: 30000,
  });
  const count = data.length;

  return (
    <Link
      to="/notifications"
      aria-label={count > 0 ? `알림 ${count}개` : "알림"}
      className="relative -m-2 p-2 text-foreground/80 hover:text-foreground transition-colors"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 01-3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute right-0 top-0 grid h-4 min-w-[16px] place-items-center rounded-full bg-warm px-1 text-[10px] font-bold text-warm-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
