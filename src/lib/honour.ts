import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVisitorCountry } from "@/lib/geo.functions";

/**
 * Returns "Honor" for US visitors, "Honour" otherwise.
 * Replaces any occurrence of the British spelling in `text`.
 */
export function useHonourSpelling(): "Honour" | "Honor" {
  const fetchCountry = useServerFn(getVisitorCountry);
  const { data } = useQuery({
    queryKey: ["visitor-country"],
    queryFn: () => fetchCountry(),
    staleTime: 1000 * 60 * 60 * 24,
  });
  return data?.country === "US" ? "Honor" : "Honour";
}

export function localizeHonour(text: string, spelling: "Honour" | "Honor"): string {
  if (spelling === "Honour") return text;
  return text.replace(/Honour/g, "Honor").replace(/honour/g, "honor");
}
