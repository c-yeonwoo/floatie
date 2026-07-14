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
    location.pathname.startsWith("/delivery/") ||
    location.pathname.startsWith("/thread/") ||
    location.pathname.startsWith("/answer/") ||
    location.pathname.startsWith("/answer-detail/") ||
    location.pathname.startsWith("/answer-edit/") ||
    location.pathname === "/onboarding";
  const lockPageScroll = location.pathname === "/me";
  const tabBarHeight = hideTabs ? "0px" : "var(--tabbar-height)";

  return (
    <div
      className="fixed inset-0 bg-background text-foreground overflow-hidden"
      style={{ height: "var(--app-vh)" }}
    >
      <div
        className="max-w-md mx-auto min-h-0 flex flex-col overflow-hidden"
        style={{ height: "var(--app-vh)" }}
      >
        <div
          className={
            "flex-1 min-h-0 " +
            (lockPageScroll ? "overflow-hidden" : "overflow-y-auto overscroll-contain")
          }
          style={{ paddingBottom: hideTabs ? 0 : tabBarHeight, paddingTop: "var(--safe-top)" }}
        >
          <Outlet />
        </div>
        {!hideTabs && <TabBar pathname={location.pathname} height={tabBarHeight} />}
      </div>
    </div>
  );
}



function TabBar({ pathname, height }: { pathname: string; height: string }) {
  const items: Array<{ to: "/home" | "/send" | "/outbox" | "/me"; label: string }> = [
    { to: "/home", label: "받은" },
    { to: "/send", label: "보내기" },
    { to: "/outbox", label: "결과" },
    { to: "/me", label: "나" },
  ];
  return (
    <nav
      className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 bg-background border-t border-border flex items-start z-40 shadow-nav"
      style={{
        height,
        paddingBottom: "var(--safe-bottom)",
      }}
    >

      {items.map((it, idx) => {
        const active = pathname === it.to || pathname.startsWith(it.to + "/");
        return (
          <div key={it.to} className="flex-1 h-[var(--tabbar-content-height)] flex items-stretch">
            <Link
              to={it.to}
              className="flex-1 h-[var(--tabbar-content-height)] flex flex-col items-center justify-center gap-1"
            >
              <span
                className={
                  "text-[15px] tracking-wide font-medium transition-colors " +
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
