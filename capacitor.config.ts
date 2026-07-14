import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for packaging 숨결 as an iOS/Android app.
 *
 * IMPORTANT — Why server.url is enabled by default
 * -------------------------------------------------
 * This project runs on TanStack Start, which is a SSR framework. The browser
 * bundle expects an SSR-injected hydration payload (router state, head, etc.)
 * to be present in the initial HTML. Capacitor's local web bundle only ships
 * a static shell (`dist/client/index.html`) without that payload, so loading
 * the bundled assets directly results in a blank/broken WebView.
 *
 * The reliable fix is to point the native WebView at the live SSR endpoint:
 *   https://sumgyeol.lovable.app   (published production URL — stable)
 *
 * This makes the iOS/Android app a thin native shell around the live SSR
 * web app — Capacitor plugins (Camera, etc.) still work natively, but page
 * rendering happens against the server.
 *
 * If you ever want to switch back to a fully bundled offline build, you must
 * first migrate the project to a SPA build target (Vite SPA, not TanStack
 * Start SSR), then comment out `server` below.
 *
 * Build flow:
 *   bun install
 *   bun run build
 *   npx cap add ios          # first time only
 *   npx cap sync ios
 *   npx cap open ios         # opens Xcode
 */
const config: CapacitorConfig = {
  appId: "app.gyeol.client",
  appName: "쪽지",
  webDir: "dist/client",
  bundledWebRuntime: false,
  server: {
    url: "https://sumgyeol.lovable.app",
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
  },
  ios: {
    infoPlist: {
      NSCameraUsageDescription: "질문에 답변을 첨부하려고 카메라를 사용합니다.",
      NSPhotoLibraryUsageDescription: "사진 라이브러리에서 답변에 사용할 이미지를 선택합니다.",
      NSPhotoLibraryAddUsageDescription: "편집한 사진을 저장하기 위해 사진 라이브러리에 저장할 수 있습니다.",
    },
    contentInset: "never",
    backgroundColor: "#F9F8F6",
  },
  android: {
    webContentsDebuggingEnabled: false,
    backgroundColor: "#F9F8F6",
  },
};

export default config;
