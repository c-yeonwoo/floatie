import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const location = useLocation();
  const hideTabs =
    location.pathname.startsWith("/answer/") ||
    location.pathname.startsWith("/answer-detail/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto min-h-screen relative pb-24">
        <Outlet />
        {!hideTabs && <TabBar pathname={location.pathname} />}
      </div>
    </div>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  const items: Array<{ to: "/feed" | "/grid" | "/home" | "/me"; label: string }> = [
    { to: "/feed", label: "홈" },
    { to: "/grid", label: "탐색" },
    { to: "/home", label: "답하기" },
    { to: "/me", label: "나" },
  ];
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-20 bg-background/85 backdrop-blur-xl border-t border-border flex justify-around items-center px-10 z-40">
      {items.map((it) => {
        const active = pathname === it.to;
        return (
          <Link key={it.to} to={it.to} className="flex flex-col items-center gap-1.5 py-2">
            <span
              className={
                "text-[11px] uppercase tracking-widest font-medium transition-colors " +
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
        );
      })}
    </nav>
  );
}
