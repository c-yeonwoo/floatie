/** Profile photos are required: exactly the product minimum of 3 real storage paths. */

export const REQUIRED_PHOTO_COUNT = 3;

/** Paths written by broken E2E/QA seeds — never treat as valid photos. */
export function isPlaceholderPhotoPath(path: string | null | undefined): boolean {
  if (!path) return true;
  const p = path.trim().toLowerCase();
  if (!p) return true;
  if (p.startsWith("e2e/")) return true;
  if (p.includes("placeholder")) return true;
  return false;
}

export function normalizePhotoPaths(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());
}

/**
 * True when the profile has ≥3 photo paths and none are placeholders.
 * Mirrors SQL `profile_has_required_photos`.
 */
export function hasRequiredPhotos(photos: unknown): boolean {
  const paths = normalizePhotoPaths(photos);
  if (paths.length < REQUIRED_PHOTO_COUNT) return false;
  if (paths.some(isPlaceholderPhotoPath)) return false;
  return true;
}
