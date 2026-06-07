import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });

    // Onboarding gate: force profile setup before letting users into the app
    if (location.pathname !== "/onboarding") {
      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!prof?.onboarded) throw redirect({ to: "/onboarding" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const location = useLocation();
  const hideTabs =
    location.pathname.startsWith("/answer/") ||
    location.pathname.startsWith("/answer-detail/") ||
    location.pathname.startsWith("/answer-edit/") ||
    location.pathname === "/onboarding";
  const lockPageScroll = location.pathname === "/me";

  return (
    <div className="fixed inset-0 bg-background text-foreground overflow-hidden">
      <div className="max-w-md mx-auto h-[100dvh] min-h-0 flex flex-col overflow-hidden">
        <div
          className={
            "flex-1 min-h-0 " +
            (lockPageScroll ? "overflow-hidden" : "overflow-y-auto overscroll-contain")
          }
        >
          <Outlet />
        </div>
        {!hideTabs && <TabBar pathname={location.pathname} />}
      </div>
    </div>
  );
}


function TabBar({ pathname }: { pathname: string }) {
  const items: Array<{ to: "/home" | "/feed" | "/grid" | "/me"; label: string }> = [
    { to: "/home", label: "오늘의 숨" },
    { to: "/feed", label: "피드" },
    { to: "/grid", label: "탐색" },
    { to: "/me", label: "나" },
  ];
  return (
    <nav
      className="shrink-0 w-full bg-background border-t border-border flex z-40 shadow-nav"
      style={{
        height: "calc(3rem + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {items.map((it, idx) => {
        const active = pathname === it.to;
        return (
          <div key={it.to} className="flex-1 flex items-stretch">
            <Link
              to={it.to}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1"
            >
              <span
                className={
                  "text-[13px] tracking-wide font-medium transition-colors " +
                  (active ? "text-foreground" : "text-muted-foreground")
                }
              >
                {it.label}
              </span>
              <span
                className={
                  "size-1 rounded-full transition-all " +
                  (active ? "bg-foreground" : "bg-transparent")
                }
              />
            </Link>
            {idx < items.length - 1 && (
              <span className="w-px my-3 bg-border" aria-hidden />
            )}
          </div>
        );
      })}
    </nav>
  );
}
