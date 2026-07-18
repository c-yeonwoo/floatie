import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { touchLastActive } from "@/lib/mission";
import { registerPush } from "@/lib/push";
import { NotificationToasts } from "@/components/notification-toasts";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    // getSession = local/cache (fast). getUser always hits Auth network and
    // makes cold boot feel stuck on the splash.
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) throw redirect({ to: "/login" });

    const path = location.pathname;
    const skipOnboard = path === "/onboarding";
    const skipVerify =
      path === "/verify" || path === "/banned" || path === "/onboarding";
    const skipBanCheck = path === "/banned";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (supabase as any)
      .from("profiles")
      .select("onboarded, status, identity_verified_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!skipBanCheck && prof?.status === "banned") {
      throw redirect({ to: "/banned" });
    }

    if (!skipOnboard && !prof?.onboarded && prof?.status !== "banned") {
      throw redirect({ to: "/onboarding" });
    }

    if (
      !skipVerify &&
      prof?.onboarded &&
      prof?.status === "active" &&
      !prof?.identity_verified_at
    ) {
      throw redirect({ to: "/verify" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const location = useLocation();
  // The sea home + onboarding are full-bleed (they position their own chrome);
  // every other route scrolls inside the padded column.
  const fullBleed = location.pathname === "/home" || location.pathname === "/onboarding";

  useEffect(() => {
    touchLastActive().catch(() => {});
    registerPush().catch(() => {}); // native only; no-op on web
    const id = setInterval(() => {
      touchLastActive().catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="fixed inset-0 text-foreground overflow-hidden"
      style={{ height: "var(--app-vh)", background: "var(--backdrop)" }}
    >
      <div
        className="max-w-md mx-auto min-h-0 flex flex-col overflow-hidden bg-background shadow-[var(--shadow-lg)] relative"
        style={{ height: "var(--app-vh)" }}
      >
        {fullBleed ? (
          <Outlet />
        ) : (
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            style={{ paddingTop: "var(--safe-top)" }}
          >
            <Outlet />
          </div>
        )}
      </div>
      {location.pathname !== "/notifications" && <NotificationToasts />}
    </div>
  );
}
