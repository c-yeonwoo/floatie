import { useQuery } from "@tanstack/react-query";
import {
  extractAnswersPath,
  signAnswersUrl,
  SIGNED_URL_STALE_MS,
} from "@/lib/storage-url";
import type { ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  /** Optional fallback element when there is no source or it fails to load. */
  fallback?: React.ReactNode;
};

/**
 * Renders an <img> for a file stored in the private `answers` bucket.
 * Resolves either a legacy public URL or a bare storage path into a
 * short-lived signed URL via TanStack Query (cached per path).
 */
export function StorageImg({ src, fallback, className, alt = "", ...rest }: Props) {
  const path = extractAnswersPath(src);
  const enabled = !!path;

  const { data: signed, isError, isPending } = useQuery({
    queryKey: ["signed-answers-url", path],
    queryFn: async () => {
      const url = await signAnswersUrl(path as string);
      if (!url) throw new Error("signed url unavailable");
      return url;
    },
    enabled,
    staleTime: SIGNED_URL_STALE_MS,
    gcTime: SIGNED_URL_STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // If the src is an unparseable value (blob:, data:, or already a non-storage URL),
  // fall back to rendering it directly so previews (e.g. local file previews) still work.
  if (!path) {
    if (src && (src.startsWith("blob:") || src.startsWith("data:"))) {
      return <img src={src} alt={alt} className={className} {...rest} />;
    }
    return <>{fallback ?? null}</>;
  }

  if (isError) return <>{fallback ?? null}</>;
  if (isPending || !signed) {
    return <span className={className} aria-hidden="true" />;
  }

  return <img src={signed} alt={alt} className={className} {...rest} />;
}
