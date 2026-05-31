import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for packaging 결 as an iOS app.
 *
 * Two modes:
 * 1) Production-like build (default): set `webDir` and run `bun run build`,
 *    then `npx cap sync ios`. The built static assets are bundled into the app.
 * 2) Live-reload during development: uncomment `server.url` below and point
 *    it at your dev server / Lovable preview URL.
 *
 * Build flow (run on a Mac with Xcode + Apple Developer account):
 *   bun install
 *   bun run build
 *   npx cap add ios          # first time only
 *   npx cap sync ios
 *   npx cap open ios         # opens Xcode
 */
const config: CapacitorConfig = {
  appId: "app.gyeol.client",
  appName: "결",
  webDir: "dist",
  ios: {
    contentInset: "automatic",
    backgroundColor: "#F9F8F6",
  },
  // server: {
  //   url: "https://id-preview--e7936f15-a0c6-4d73-beb0-73adbb2e98e3.lovable.app",
  //   cleartext: false,
  // },
};

export default config;
