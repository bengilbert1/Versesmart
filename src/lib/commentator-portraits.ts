// Shared client-side lookup for admin-uploaded commentator portraits.
// Pulls from the same query key the admin panel uses so updates are
// instantly reflected everywhere AuthorThumbnail renders.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  listCommentatorOverrides,
  type CommentatorOverrideRow,
} from "@/lib/commentator-overrides.functions";
import { normalizeName } from "@/lib/commentator-metadata";

export const commentatorOverridesQueryOptions = {
  queryKey: ["commentator-overrides"] as const,
  queryFn: () => listCommentatorOverrides(),
  staleTime: 60_000,
  gcTime: 1000 * 60 * 60,
};

export function usePortraitForName(name: string): string | null {
  const { data } = useQuery(commentatorOverridesQueryOptions);
  return useMemo(() => {
    if (!data || !name) return null;
    const key = normalizeName(name);
    // Prefer the primary variant's portrait; fall back to any variant that has one.
    const matches = data.filter(
      (o: CommentatorOverrideRow) => o.name_key === key && o.portrait_url,
    );
    if (matches.length === 0) return null;
    const primary = matches.find((m) => m.is_primary);
    return (primary ?? matches[0]).portrait_url;
  }, [data, name]);
}
