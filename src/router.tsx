import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function normalizeInitialPath() {
  if (typeof window === "undefined") return;

  const pathname = window.location.pathname || "";
  const shouldNormalize =
    pathname === "/index.html" ||
    pathname === "/assets/" ||
    pathname === "/assets" ||
    pathname.endsWith("/index.html");

  if (!shouldNormalize) return;

  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = "/";
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

normalizeInitialPath();

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh across tab switches/navigation for 1 minute.
        // Individual queries can opt out with their own staleTime.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
