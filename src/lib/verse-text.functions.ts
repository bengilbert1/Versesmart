import { z } from "zod";

const Input = z.object({
  reference: z.string().min(1).max(120),
  translation: z.string().min(1).max(20).optional().default("web"),
});

export type VerseTextResult = {
  reference: string;
  text: string;
  translation: string;
};

/**
 * Fetch Bible verse text (client-safe version)
 */
export async function getVerseText(
  input: unknown
): Promise<VerseTextResult | null> {
  const data = Input.parse(input);

  const trans = (data.translation || "web").toLowerCase();
  const ref = encodeURIComponent(data.reference);

  const url = `https://bible-api.com/${ref}?translation=${encodeURIComponent(
    trans
  )}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as {
      reference?: string;
      text?: string;
      translation_id?: string;
    };

    if (!json?.text || !json?.reference) return null;

    return {
      reference: json.reference,
      text: json.text.trim().replace(/\s+/g, " "),
      translation: (json.translation_id || trans).toUpperCase(),
    };
  } catch {
    return null;
  }
}