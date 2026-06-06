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

function ensureTsrFallback(router: ReturnType<typeof createRouter>) {
  if (typeof window === "undefined") return;

  const existingState = (window as any).$_TSR;
  if (existingState?.router) return;

  try {
    const fallbackTsr = {
      h() {
        this.hydrated = true;
        this.c();
      },
      e() {
        this.streamEnded = true;
        this.c();
      },
      c() {
        if (this.hydrated && this.streamEnded) {
          if (typeof window !== "undefined") {
            delete (window as any).$_TSR;
            const seroval = (window as any).$R;
            if (seroval && typeof seroval === "object") {
              delete seroval.tsr;
            }
          }
        }
      },
      p(script: () => void) {
        if (!this.initialized) {
          this.buffer.push(script);
        } else {
          script();
        }
      },
      buffer: [],
    };

    const resolvedMatches =
      router.matchRoutes(router.stores.location.get()) ??
      router.matchRoutes("/") ??
      [];

    const matches = resolvedMatches.length
      ? resolvedMatches
      : (() => {
          const hasRoot = Object.prototype.hasOwnProperty.call(
            router.looseRoutesById,
            "/",
          );
          return hasRoot ? [{ routeId: "/" }] : [];
        })();
    if (!matches.length) return;

    const serializedMatches = matches.map((match) => ({ i: match.routeId }));

    (window as any).$_TSR = {
      ...fallbackTsr,
      router: {
        matches: serializedMatches,
        lastMatchId: serializedMatches[serializedMatches.length - 1].i,
        manifest: { routes: {} },
        dehydratedData: {},
      },
    };
  } catch (error) {
    console.error("[router] failed to prepare SSR fallback payload", error);
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  ensureTsrFallback(router);

  return router;
};
