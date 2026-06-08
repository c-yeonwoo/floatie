// 햅틱 통합 헬퍼. 네이티브(Capacitor) 환경에서는 Haptics 플러그인,
// 웹에서는 navigator.vibrate 폴백. 미지원 환경에서는 조용히 noop.
import { Capacitor } from "@capacitor/core";

type Intensity = "light" | "medium" | "heavy" | "success" | "selection";

export async function haptic(intensity: Intensity = "light") {
  try {
    if (Capacitor?.isNativePlatform?.()) {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      if (intensity === "success") {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (intensity === "selection") {
        await Haptics.selectionStart();
        await Haptics.selectionEnd();
      } else {
        const style =
          intensity === "heavy"
            ? ImpactStyle.Heavy
            : intensity === "medium"
              ? ImpactStyle.Medium
              : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
      return;
    }
  } catch {
    /* fall through to web */
  }
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      const ms =
        intensity === "heavy" ? 30 : intensity === "medium" ? 18 : intensity === "success" ? [10, 40, 20] : 10;
      (navigator as any).vibrate(ms);
    }
  } catch {
    /* noop */
  }
}
