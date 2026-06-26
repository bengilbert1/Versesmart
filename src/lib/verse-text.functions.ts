import { createServerFn } from "@tanstack/react-start";
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
 * Lightweight, AI-free verse text fetch.
 * Uses bible-api.com (public-domain WEB / KJV) so it returns in a few
 * hundred ms and consumes no AI credits. Used to render the verse
 * instantly while the heavier commentary lookup runs in the background.
 */
export const getVerseText = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<VerseTextResult | null> => {
    const trans = (data.translation || "web").toLowerCase();
    // bible-api.com supports: web, kjv, oeb-us, oeb-cw, clementine, almeida, rccv
    const ref = encodeURIComponent(data.reference);
    const url = `https://bible-api.com/${ref}?translation=${encodeURIComponent(trans)}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
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
  });
