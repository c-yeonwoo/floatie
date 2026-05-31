// Strips EXIF/GPS metadata by re-encoding the image through a canvas.
// Also resizes to a max dimension to keep storage costs reasonable.
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.9;

export async function stripExifAndCompress(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;

    const cleanName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], cleanName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function stripExifMany(files: File[]): Promise<File[]> {
  return Promise.all(files.map(stripExifAndCompress));
}
