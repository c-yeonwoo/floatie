import { supabase } from "@/integrations/supabase/client";

let registered = false;

/**
 * Register for push on native (iOS/Android) and store the device token.
 * No-op on web. Safe to call multiple times (e.g. empty-sea CTA).
 * Send side: Edge `dispatch-push` + FCM_SERVER_KEY (optional).
 */
export async function registerPush(): Promise<"granted" | "denied" | "web"> {
  if (typeof window === "undefined") return "web";

  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return "web";

  const { PushNotifications } = await import("@capacitor/push-notifications");

  let receive = (await PushNotifications.checkPermissions()).receive;
  if (receive === "prompt" || receive === "prompt-with-rationale") {
    receive = (await PushNotifications.requestPermissions()).receive;
  }
  if (receive !== "granted") return "denied";

  if (!registered) {
    registered = true;

    await PushNotifications.addListener("registration", async (token) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc("upsert_device_token", {
          p_token: token.value,
          p_platform: Capacitor.getPlatform(),
        });
      } catch {
        /* best-effort */
      }
    });

    await PushNotifications.addListener("registrationError", () => {
      /* ignore */
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action.notification.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        window.location.href = url.startsWith("/delivery/")
          ? `/home?d=${url.split("/").pop()}`
          : url.startsWith("/waiting/")
            ? `/home?d=${url.split("/").pop()}`
            : url;
      }
    });
  }

  await PushNotifications.register();
  return "granted";
}
