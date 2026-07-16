// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Web (Cloudflare) build only: enable the Nitro deploy plugin to emit a
  // Cloudflare Pages bundle into dist/ (_worker.js + static). Gated by env so
  // the default `build` stays a mobile/Capacitor client build (dist/client).
  //   web:    DEPLOY_TARGET=cloudflare vite build   (npm run build:web)
  //   mobile: vite build                            (npm run build)
  ...(process.env.DEPLOY_TARGET === "cloudflare"
    ? { nitro: { preset: "cloudflare-pages" } }
    : {}),
});
