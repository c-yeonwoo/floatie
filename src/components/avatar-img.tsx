import { StorageImg } from "@/components/storage-img";

/** Circular avatar with initial fallback when photo is missing or fails to sign. */
export function AvatarImg({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const initial = (name.trim().slice(0, 1) || "?").toUpperCase();
  const cls = [className, "empty"].filter(Boolean).join(" ");
  const fallback = (
    <span className={cls} aria-hidden="true">
      {initial}
    </span>
  );
  if (!src) return fallback;
  return <StorageImg src={src} alt="" className={className} fallback={fallback} />;
}
