import { useQuery } from "@tanstack/react-query";

type VisitorCountryResponse = {
  country?: string;
};

/**
 * Client-safe version (no TanStack Start)
 * Assumes you have an API route or external endpoint for geo lookup.
 * Replace URL below with your real endpoint if needed.
 */
async function fetchVisitorCountry(): Promise<VisitorCountryResponse> {
  try {
    const res = await fetch("/api/geo");

    if (!res.ok) return {};

    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Returns "Honor" for US visitors, "Honour" otherwise.
 */
export function useHonourSpelling(): "Honour" | "Honor" {
  const { data } = useQuery({
    queryKey: ["visitor-country"],
    queryFn: fetchVisitorCountry,
    staleTime: 1000 * 60 * 60 * 24,
  });

  return data?.country === "US" ? "Honor" : "Honour";
}

/**
 * Localizes spelling in text
 */
export function localizeHonour(
  text: string,
  spelling: "Honour" | "Honor"
): string {
  if (spelling === "Honour") return text;

  return text
    .replace(/Honour/g, "Honor")
    .replace(/honour/g, "honor");
}