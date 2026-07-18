import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "../integrations/supabase/client";
import { Toaster } from "sonner";
import { BRAND_EN } from "@/lib/brand";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-6xl text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">없는 페이지예요.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-foreground">문제가 생겼어요</h1>
        <p className="mt-2 text-sm text-muted-foreground">잠시 후 다시 시도해 주세요.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: `${BRAND_EN} — 마음이 오면, 그때 열려요` },
      { name: "description", content: "가벼운 질문에 답하고, 마음이 오면 그때 프로필이 열려요." },
      { name: "theme-color", content: "#F1F7F5" },
      { property: "og:title", content: BRAND_EN },
      { property: "og:description", content: "가벼운 질문에 답하고, 마음이 오면 그때 프로필이 열려요." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: BRAND_EN },
      { name: "twitter:description", content: "가벼운 질문에 답하고, 마음이 오면 그때 프로필이 열려요." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c1c1ac07-cacb-4d76-81a9-543e9431b769/id-preview-66f224c0--e7936f15-a0c6-4d73-beb0-73adbb2e98e3.lovable.app-1780246467661.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c1c1ac07-cacb-4d76-81a9-543e9431b769/id-preview-66f224c0--e7936f15-a0c6-4d73-beb0-73adbb2e98e3.lovable.app-1780246467661.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Pretendard — single brand typeface. TODO(capacitor): self-host woff2 for offline.
      { rel: "preconnect", href: "https://cdn.jsdelivr.net", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" },
      // Jua — soft rounded display face for the wordmark + big titles.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Jua&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        <div id="boot-splash" aria-hidden="true">
          <img src="/icon-192.png" alt="" width={88} height={88} />
          <span>플로티</span>
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function ViewportSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const set = () => {
      const h = (window.visualViewport?.height ?? window.innerHeight) + "px";
      root.style.setProperty("--app-vh", h);
    };
    set();
    window.addEventListener("resize", set);
    window.addEventListener("orientationchange", set);
    window.visualViewport?.addEventListener("resize", set);
    window.visualViewport?.addEventListener("scroll", set);

    // iOS Safari bounce / 문서 자체 스크롤 잠금 강화
    const preventDocScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      // 스크롤 가능한 컨테이너 내부 터치는 허용
      let el: HTMLElement | null = target;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
          return;
        }
        el = el.parentElement;
      }
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventDocScroll, { passive: false });

    return () => {
      window.removeEventListener("resize", set);
      window.removeEventListener("orientationchange", set);
      window.visualViewport?.removeEventListener("resize", set);
      window.visualViewport?.removeEventListener("scroll", set);
      document.removeEventListener("touchmove", preventDocScroll);
    };
  }, []);
  return null;
}

function BootSplashHide() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const t = setTimeout(() => {
      document.body.classList.add("app-ready");
    }, 150);
    return () => clearTimeout(t);
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ViewportSync />
      <AuthSync />
      <BootSplashHide />
      <Outlet />
      <Toaster
        position="top-center"
        visibleToasts={1}
        toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
      />
    </QueryClientProvider>
  );
}

