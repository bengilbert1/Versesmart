import { useQuery } from "@tanstack/react-query";
import { authorThumbQueryOptions } from "@/lib/author-wiki";
import { usePortraitForName } from "@/lib/commentator-portraits";
import { cn } from "@/lib/utils";
import authorFallback from "@/assets/author-fallback.jpg";

// Single static fallback thumbnail used for every author without a portrait.
// Exported so callers (preloaders, share cards, etc.) can reference the same asset.
export const AUTHOR_FALLBACK_THUMB = authorFallback;

export function AuthorThumbnail({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  // Admin-uploaded portraits take absolute priority over Wikipedia / fallback.
  const uploaded = usePortraitForName(name);
  const { data: wikiSrc, isLoading } = useQuery({
    ...authorThumbQueryOptions(name),
    enabled: !uploaded && authorThumbQueryOptions(name).enabled,
  });
  const dim = { width: size, height: size };
  const base = cn(
    "shrink-0 overflow-hidden rounded-full border border-border bg-muted object-cover",
    className,
  );

  const finalSrc = uploaded || wikiSrc || (isLoading ? authorFallback : authorFallback);

  return (
    <img
      src={finalSrc}
      alt={`Portrait of ${name}`}
      loading="lazy"
      style={dim}
      className={base}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src !== authorFallback) img.src = authorFallback;
      }}
    />
  );
}
