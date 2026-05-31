import { Capacitor } from "@capacitor/core";

/**
 * Pick a photo using the native camera/photo library on iOS (Capacitor),
 * or fall back to a hidden <input type="file"> on the web.
 *
 * Returns a File ready to be uploaded, or null if the user cancelled.
 */
export async function pickPhoto(source: "camera" | "library"): Promise<File | null> {
  if (Capacitor.isNativePlatform()) {
    // Lazy import so the web bundle never tries to resolve native-only code paths eagerly.
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
        saveToGallery: false,
        correctOrientation: true,
      });
      if (!photo.webPath) return null;
      const res = await fetch(photo.webPath);
      const blob = await res.blob();
      const ext = (photo.format || "jpg").toLowerCase();
      const type = blob.type || (ext === "png" ? "image/png" : "image/jpeg");
      return new File([blob], `photo-${Date.now()}.${ext}`, { type });
    } catch (err) {
      // User cancelled or permission denied — treat as no selection.
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(message)) return null;
      throw err;
    }
  }

  // Web fallback — open a file picker.
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    if (source === "camera") input.setAttribute("capture", "environment");
    input.onchange = () => {
      const f = input.files?.[0] ?? null;
      resolve(f);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
